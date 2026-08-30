#!/usr/bin/env python3
"""
ARGUS Live Capture Agent
========================
Runs on your Mac, sniffs real packets off the active NIC,
extracts features from each packet, and POSTs them to the
deployed FastAPI backend via /api/v1/ingest  (new endpoint).

Usage:
  sudo python3 agent.py                        # auto-detect interface
  sudo python3 agent.py --iface en0            # explicit interface
  sudo python3 agent.py --iface en0 --rate 2   # send every 2 s

Requires:
  pip install scapy requests
  Run with sudo (raw socket capture needs root on macOS)
"""

import argparse
import json
import socket
import time
import threading
from collections import deque
from datetime import datetime

import requests

# ── Try to import scapy — friendly error if missing ──────────────────────────
try:
    from scapy.all import sniff, IP, TCP, UDP, conf
except ImportError:
    print("❌  scapy not installed.  Run:  pip install scapy")
    raise SystemExit(1)

# ─────────────────────────────────────────────────────────────────────────────
BACKEND_URL = "https://argus-backend-kbg6.onrender.com/api/v1"
INGEST_URL  = f"{BACKEND_URL}/ingest"
BATCH_SIZE  = 10          # packets bundled per request
FLUSH_EVERY = 2.0         # seconds between flushes (even if batch not full)
# ─────────────────────────────────────────────────────────────────────────────


def get_default_iface() -> str:
    """Return the first non-loopback interface that has an IP (en0, en1 …)."""
    try:
        # scapy's conf.iface is usually the right one
        return conf.iface
    except Exception:
        return "en0"


def extract_features(pkt) -> dict | None:
    """
    Pull the 4 core features the ML model was trained on from a scapy packet.
    Returns None for packets we can't parse.
    """
    if not pkt.haslayer(IP):
        return None

    ip   = pkt[IP]
    proto = ip.proto          # 6=TCP, 17=UDP, 50=ESP, etc.
    length = len(pkt)

    src_port = 0
    dst_port = 0

    if pkt.haslayer(TCP):
        src_port = pkt[TCP].sport
        dst_port = pkt[TCP].dport
    elif pkt.haslayer(UDP):
        src_port = pkt[UDP].sport
        dst_port = pkt[UDP].dport

    return {
        "src_port": src_port,
        "dst_port": dst_port,
        "protocol": proto,
        "length":   length,
        # extra meta — shown on dashboard, not fed to model
        "src_ip":   ip.src,
        "dst_ip":   ip.dst,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


class AgentState:
    """Thread-safe packet buffer + stats."""

    def __init__(self):
        self.buffer: deque[dict] = deque()
        self.lock = threading.Lock()
        self.sent   = 0
        self.dropped = 0

    def add(self, pkt_features: dict):
        with self.lock:
            self.buffer.append(pkt_features)

    def drain(self) -> list[dict]:
        with self.lock:
            items = list(self.buffer)
            self.buffer.clear()
            return items


state = AgentState()


# ── Packet callback (runs in scapy's capture thread) ─────────────────────────
def packet_callback(pkt):
    features = extract_features(pkt)
    if features:
        state.add(features)


# ── Flush thread — batches up captured packets and ships to backend ───────────
def flush_loop():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    print(f"📡  Flush loop started → {INGEST_URL}")

    while True:
        time.sleep(FLUSH_EVERY)
        batch = state.drain()
        if not batch:
            continue

        payload = {"packets": batch}
        try:
            r = session.post(INGEST_URL, data=json.dumps(payload), timeout=8)
            if r.status_code == 200:
                state.sent += len(batch)
                print(f"  ✅ Sent {len(batch)} packets  "
                      f"(total: {state.sent})  "
                      f"[{datetime.now().strftime('%H:%M:%S')}]")
            else:
                print(f"  ⚠️  Backend returned {r.status_code}: {r.text[:120]}")
                state.dropped += len(batch)
        except requests.exceptions.RequestException as e:
            print(f"  ❌ POST failed: {e}")
            state.dropped += len(batch)


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="ARGUS Live Capture Agent")
    parser.add_argument("--iface", default=None,
                        help="Network interface to sniff (default: auto-detect)")
    parser.add_argument("--rate", type=float, default=FLUSH_EVERY,
                        help="Seconds between backend flushes (default: 2)")
    parser.add_argument("--filter", default="ip",
                        help="BPF filter string (default: 'ip')")
    args = parser.parse_args()

    iface = args.iface or get_default_iface()

    print("=" * 55)
    print("  ARGUS LIVE CAPTURE AGENT")
    print("=" * 55)
    print(f"  Interface : {iface}")
    print(f"  BPF filter: {args.filter}")
    print(f"  Flush rate: every {args.rate}s")
    print(f"  Backend   : {BACKEND_URL}")
    print("=" * 55)
    print("  Ctrl+C to stop\n")

    # Start flush thread (daemon so it dies with main)
    t = threading.Thread(target=flush_loop, daemon=True)
    t.start()

    # Start packet capture (blocking — runs until Ctrl+C)
    try:
        sniff(
            iface=iface,
            filter=args.filter,
            prn=packet_callback,
            store=False,       # don't keep packets in RAM
        )
    except KeyboardInterrupt:
        print(f"\n\n  Stopped.  Sent: {state.sent}  Dropped: {state.dropped}")
    except PermissionError:
        print("\n❌  Permission denied — run with sudo:\n"
              "       sudo python3 agent.py")


if __name__ == "__main__":
    main()
