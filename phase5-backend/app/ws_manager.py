#!/usr/bin/env python3
"""
WebSocket Connection Manager
Keeps track of all connected frontend clients and broadcasts
analysed packet results to all of them simultaneously.
"""

import asyncio
import json
from collections import deque
from typing import Set
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()
        # A browser can connect a few seconds after an agent has posted a flow
        # (or reconnect after a transient network drop). Keep a small replay
        # window so the live dashboard does not remain empty in that case.
        self.recent: deque[dict] = deque(maxlen=250)
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self.active.add(ws)

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self.active.discard(ws)

    async def publish(self, data: dict):
        """Store a live result and deliver it to every connected frontend."""
        async with self._lock:
            self.recent.append(data)
        await self.broadcast(data)

    async def replay(self, ws: WebSocket):
        """Send the current replay window to one newly connected client."""
        async with self._lock:
            snapshot = list(self.recent)
        for data in snapshot:
            await ws.send_text(json.dumps(data))

    async def broadcast(self, data: dict):
        """Send an already-persisted message to every connected frontend."""
        if not self.active:
            return
        message = json.dumps(data)
        dead: Set[WebSocket] = set()
        async with self._lock:
            targets = set(self.active)
        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        if dead:
            async with self._lock:
                self.active -= dead


# Singleton — imported by routes.py
manager = ConnectionManager()
