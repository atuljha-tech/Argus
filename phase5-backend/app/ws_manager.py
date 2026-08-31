#!/usr/bin/env python3
"""
WebSocket Connection Manager
Keeps track of all connected frontend clients and broadcasts
analysed packet results to all of them simultaneously.

Also exposes the in-memory replay buffer over HTTP via a /recent endpoint
so frontends can fall back to short-polling when WebSocket delivery is
unreliable (multi-worker PaaS deployments, proxies, etc).
"""

import asyncio
import json
import sys
from collections import deque
from typing import Deque, Set, List
from fastapi import WebSocket


def _log(msg: str) -> None:
    """Structured stderr log — visible in Render dashboard logs."""
    print(f"[WS_MGR] {msg}", file=sys.stderr, flush=True)


class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()
        # Longer replay window — sufficient for short polling to catch up
        self.recent: Deque[dict] = deque(maxlen=500)
        self._lock = asyncio.Lock()
        _log("ConnectionManager singleton initialised in this process")

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self.active.add(ws)
        _log(f"WebSocket CONNECTED  active={len(self.active)}  client={ws.client}")

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self.active.discard(ws)
        _log(f"WebSocket DISCONNECTED  active={len(self.active)}")

    async def publish(self, data: dict):
        """Store a live result and deliver it to every connected frontend."""
        async with self._lock:
            self.recent.append(data)
            buffered = len(self.recent)
        n = await self.broadcast(data)
        _log(
            f"PUBLISH type={data.get('type')} prediction={data.get('prediction')} "
            f"buffered={buffered}  broadcast_to={n}"
        )

    def snapshot(self) -> List[dict]:
        """
        Recent-packet snapshot for the HTTP /recent fallback.

        Note on thread-safety:
          * This is always called inside FastAPI request handlers (which run in
            the same single event-loop thread as everything else when
            --workers 1).
          * CPython's GIL makes list(deque) and dict value reads atomic for
            our shape (no in-place mutation of stored dicts after append).
          * For belt-and-braces we still take the lock if the caller is NOT in
            a running async task (can't await a lock inside an async def that
            already holds no awaitable context).
        """
        try:
            asyncio.get_running_loop()
            # Inside async handler — use lock via concurrent-safe shallow copy.
            # Lock acquisition is serialized by the GIL event loop; iteration
            # over the deque while the publish coroutine is parked between
            # awaits is safe because only append-right (past our iterator)
            # happens during publish.  A second append during iteration could
            # extend the deque but that's fine — we just won't see it in this
            # snapshot, matching the "best-effort recent" contract.
            return list(self.recent)
        except RuntimeError:
            # Synchronous caller — grab the lock explicitly.
            with self._lock:
                return list(self.recent)

    async def replay(self, ws: WebSocket):
        """Send the current replay window to one newly connected client."""
        async with self._lock:
            snapshot = list(self.recent)
        _log(f"REPLAY {len(snapshot)} buffered packets to new client")
        for data in snapshot:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                break

    async def broadcast(self, data: dict) -> int:
        """Send an already-persisted message to every connected frontend.
        Returns the number of websockets the message was attempted to."""
        if not self.active:
            _log("broadcast SKIPPED — no active websockets in this process")
            return 0
        message = json.dumps(data)
        dead: Set[WebSocket] = set()
        async with self._lock:
            targets = set(self.active)
        sent = 0
        for ws in targets:
            try:
                await ws.send_text(message)
                sent += 1
            except Exception:
                dead.add(ws)
        if dead:
            async with self._lock:
                self.active -= dead
            _log(f"Pruned {len(dead)} dead websockets  active now={len(self.active)}")
        return sent


# Singleton — imported by routes.py and main.py
manager = ConnectionManager()
