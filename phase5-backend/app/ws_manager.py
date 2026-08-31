#!/usr/bin/env python3
"""
WebSocket Connection Manager
Keeps track of all connected frontend clients and broadcasts
analysed packet results to all of them simultaneously.

SHARED STATE (critical for Render / multi-worker deployments):
  * The RECENT PACKET BUFFER now lives in a disk-backed JSONL file via
    packet_store.py.  All processes in the same deployment share one
    filesystem, so:
       - /ingest on Worker A writes packets → /recent + WS replay on Worker B
         can immediately read them back.
       - This fixes the original "buffer_size=0 even though agent posted 372
         flows" symptom.
  * The ACTIVE WS CLIENT set remains per-process (WebSocket connections are
    per-process by definition), which is fine — each worker broadcasts the
    packets it reads from disk to its own connected clients.
"""

import asyncio
import json
import sys
from collections import deque
from typing import Deque, Set, List
from fastapi import WebSocket

from .packet_store import (
    append_packet,
    append_many,
    read_tail,
    buffer_size as disk_buffer_size,
    ensure_gc_thread,
    STORE_PATH,
)


def _log(msg: str) -> None:
    """Structured stderr log — visible in Render dashboard logs."""
    print(f"[WS_MGR] {msg}", file=sys.stderr, flush=True)


# Start the disk-store GC thread exactly once per Python process.
ensure_gc_thread()


class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()
        # Smaller in-memory deque — now just a hint/quick cache.
        # The authoritative shared buffer is packet_store (disk JSONL).
        self.recent: Deque[dict] = deque(maxlen=100)
        self._lock = asyncio.Lock()
        _log(
            "ConnectionManager singleton initialised in this process.  "
            f"Shared packet store file: {STORE_PATH}"
        )

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
        """Persist to shared disk store + in-memory deque + broadcast."""
        # ── Write to SHARED disk store FIRST so ALL processes see it ────────
        append_packet(data)
        # Keep the small per-process deque consistent too (used for broadcast
        # hot-path on the same process — WS replay & /recent prefer disk).
        async with self._lock:
            self.recent.append(data)
        n = await self.broadcast(data)
        total_on_disk = disk_buffer_size()
        _log(
            f"PUBLISH type={data.get('type')} prediction={data.get('prediction')} "
            f"disk_buffer_size={total_on_disk}  ws_broadcast_to={n}"
        )

    async def publish_batch(self, data_list: List[dict]):
        """Bulk version of publish — one fsync instead of many.  Used by /ingest."""
        if not data_list:
            return 0
        # SHARED disk write (bulk)
        append_many(data_list)
        async with self._lock:
            for d in data_list:
                self.recent.append(d)
        # Broadcast each individually to WS clients on THIS process.
        sent_any = 0
        if self.active:
            for d in data_list:
                sent_any += await self.broadcast(d)
        total_on_disk = disk_buffer_size()
        _log(
            f"PUBLISH_BATCH count={len(data_list)}  disk_buffer_size={total_on_disk}  "
            f"ws_attempted={sent_any}  active_ws={len(self.active)}"
        )
        return len(data_list)

    def snapshot(self, limit: int = 500, since: str | None = None) -> tuple[List[dict], str | None]:
        """
        Shared-state snapshot for HTTP /recent fallback AND WS replay.

        Reads FROM DISK, so all Render worker processes see the same data
        regardless of which /ingest process originally persisted it.

        Returns (packets, newest_timestamp).
        """
        pkts, newest = read_tail(limit=limit, since=since)
        return pkts, newest

    async def replay(self, ws: WebSocket):
        """
        Replay shared recent buffer to a newly connected WS client.
        Reads FROM DISK so clients connecting to any worker get the full
        history, not just packets posted to that specific process.
        """
        pkts, _ = read_tail(limit=500)
        _log(f"REPLAY (disk) {len(pkts)} packets to new client")
        for data in pkts:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                break

    async def broadcast(self, data: dict) -> int:
        """Send one message to every WS client connected to THIS process.
        Returns number of send attempts."""
        if not self.active:
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
