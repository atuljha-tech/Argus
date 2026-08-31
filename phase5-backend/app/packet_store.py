#!/usr/bin/env python3
"""
Disk-backed recent-packet buffer.

Shared state across all uvicorn workers / Render process instances in the same
deployment, because the container filesystem IS shared (every process in a
Render Web Service sees the same ephemeral disk).

This fixes the core "packets posted by agent don't reach the frontend" bug:
  * BEFORE: ConnectionManager.recent was an in-memory deque per process.  If
    the agent POSTs /ingest to worker A and the frontend polls /recent to
    worker B, worker B sees buffer_size = 0 forever.
  * AFTER: /ingest appends each packet to a single JSONL file on disk and
    /recent reads the tail of that file.  All workers see the same data.

A background GC task trims the file to the most recent MAX_PACKETS records
once per minute.
"""

import asyncio
import json
import os
import sys
import threading
import time
from pathlib import Path
from typing import List, Optional


MAX_PACKETS = 800          # keep last ~800 flows (well over the 500 WS replay)
GC_EVERY_SEC = 60          # trim compact task cadence


# ── Resolve store path ───────────────────────────────────────────────────────
# Order: ARGUS_PACKET_STORE env → /tmp/argus_packets.jsonl → cwd/_run/packets.jsonl
# Render + Docker /tmp is fine; also works locally in dev.
def _resolve_store_path() -> Path:
    raw = os.environ.get("ARGUS_PACKET_STORE")
    if raw:
        p = Path(raw)
    elif Path("/tmp").is_dir():
        p = Path("/tmp/argus_packets.jsonl")
    else:
        p = Path.cwd() / "_run" / "packets.jsonl"
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        if not p.exists():
            p.touch()
    except Exception as exc:
        print(f"[STORE]  WARN: cannot write to {p} ({exc}); falling back to cwd", file=sys.stderr, flush=True)
        p = Path.cwd() / "_run" / "packets.jsonl"
        p.parent.mkdir(parents=True, exist_ok=True)
        if not p.exists():
            p.touch()
    return p


STORE_PATH: Path = _resolve_store_path()
_fs_lock = threading.Lock()   # serialise writes + GC within a single process

_GC_THREAD_STARTED = False
_GC_THREAD_LOCK = threading.Lock()


def _log(msg: str) -> None:
    print(f"[STORE]  {msg}", file=sys.stderr, flush=True)


# ── Public helpers ───────────────────────────────────────────────────────────

def ensure_gc_thread() -> None:
    """Ensure exactly one background GC/compaction thread per Python process."""
    global _GC_THREAD_STARTED
    with _GC_THREAD_LOCK:
        if _GC_THREAD_STARTED:
            return
        _GC_THREAD_STARTED = True
    t = threading.Thread(target=_gc_loop, name="argus-packet-store-gc", daemon=True)
    t.start()
    _log(f"GC thread started  file={STORE_PATH}  max_packets={MAX_PACKETS}")


def append_packet(pkt: dict) -> None:
    """Append one JSON line (packet) to the shared store.  Thread-safe."""
    line = json.dumps(pkt, separators=(",", ":"), default=str) + "\n"
    with _fs_lock:
        try:
            with open(STORE_PATH, "a", encoding="utf-8") as fh:
                fh.write(line)
                fh.flush()
                os.fsync(fh.fileno())
        except Exception as exc:
            _log(f"append FAILED: {exc}")


def append_many(pkts: List[dict]) -> None:
    """Bulk append — single fsync, much faster than per-packet writes."""
    if not pkts:
        return
    body = "".join(
        json.dumps(p, separators=(",", ":"), default=str) + "\n" for p in pkts
    )
    with _fs_lock:
        try:
            with open(STORE_PATH, "a", encoding="utf-8") as fh:
                fh.write(body)
                fh.flush()
                os.fsync(fh.fileno())
        except Exception as exc:
            _log(f"append_many FAILED ({len(pkts)} pkts): {exc}")


def read_tail(limit: int = 500, since: Optional[str] = None) -> tuple[List[dict], Optional[str]]:
    """
    Read up to `limit` most recent packets from the shared JSONL file.

    If `since` (ISO timestamp string) is provided, only packets whose
    `timestamp` field is strictly greater than `since` are returned.

    Returns (packets_list, newest_timestamp_seen).
    newest_timestamp_seen is the max timestamp across ALL records inspected
    (not just the returned ones) so callers can use it as the next `since`
    cursor even when every record in this batch was older than `since`.
    """
    try:
        file_size = STORE_PATH.stat().st_size
    except FileNotFoundError:
        return [], None

    # Heuristic: JSONL lines are ~1-2 KB.  Read the last limit * 3000 bytes
    # which should comfortably contain `limit` records, and we'll fall back to
    # full read if needed.
    read_start = max(0, file_size - limit * 3000)
    raw: bytes
    with _fs_lock:
        try:
            with open(STORE_PATH, "rb") as fh:
                if read_start > 0:
                    fh.seek(read_start)
                    # discard any partial first line by reading to next \n
                    if read_start > 0:
                        fh.readline()
                raw = fh.read()
        except Exception as exc:
            _log(f"read_tail FAILED: {exc}")
            return [], None

    if not raw:
        return [], None

    results: List[dict] = []
    newest: Optional[str] = None
    # Iterate newest-last so we can cap the tail efficiently.
    all_parsed: List[dict] = []
    for line in raw.decode("utf-8", errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except Exception:
            continue
        ts = obj.get("timestamp")
        if isinstance(ts, str) and (newest is None or ts > newest):
            newest = ts
        all_parsed.append(obj)

    # Filter by `since`, then truncate to newest `limit`.
    if since:
        filtered = [p for p in all_parsed if isinstance(p.get("timestamp"), str) and p["timestamp"] > since]
    else:
        filtered = all_parsed
    filtered = filtered[-limit:]

    return filtered, newest


def buffer_size() -> int:
    """Approximate line count (fast) — used by /recent buffer_size field."""
    try:
        with _fs_lock:
            with open(STORE_PATH, "rb") as fh:
                # Count newlines cheap
                n = 0
                for _ in fh:
                    n += 1
                return n
    except Exception:
        return 0


# ── Background GC / compaction ───────────────────────────────────────────────

def _gc_loop() -> None:
    # Sleep a bit so startup logs aren't interleaved.
    time.sleep(5)
    while True:
        try:
            _compact_if_needed()
        except Exception as exc:
            _log(f"GC iteration raised: {type(exc).__name__}: {exc}")
        time.sleep(GC_EVERY_SEC)


def _compact_if_needed() -> None:
    """Keep only the last MAX_PACKETS lines on disk."""
    try:
        n = buffer_size()
    except Exception:
        n = 0
    if n <= int(MAX_PACKETS * 1.25):
        return  # nothing to do
    _log(f"Compacting store: {n} lines -> keeping last {MAX_PACKETS}")
    # Read all, keep tail, write back atomically via temp + rename.
    all_pkts, _ = read_tail(limit=MAX_PACKETS)
    if not all_pkts:
        return
    tmp = STORE_PATH.with_suffix(STORE_PATH.suffix + ".tmp")
    with _fs_lock:
        try:
            with open(tmp, "w", encoding="utf-8") as fh:
                for p in all_pkts:
                    fh.write(json.dumps(p, separators=(",", ":"), default=str) + "\n")
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(tmp, STORE_PATH)
            _log(f"Compact OK. New size: {len(all_pkts)} records")
        except Exception as exc:
            _log(f"Compact FAILED: {exc}")
            try:
                tmp.unlink(missing_ok=True)
            except Exception:
                pass
