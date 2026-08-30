#!/usr/bin/env python3
"""
WebSocket Connection Manager
Keeps track of all connected frontend clients and broadcasts
analysed packet results to all of them simultaneously.
"""

import asyncio
import json
from typing import Set
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self.active.add(ws)

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self.active.discard(ws)

    async def broadcast(self, data: dict):
        """Send JSON payload to every connected frontend."""
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
