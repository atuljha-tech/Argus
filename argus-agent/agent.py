#!/usr/bin/env python3
"""
ARGUS Live Capture Agent
========================
Works on ANY machine — auto-detects the active interface.
Captures real packets, aggregates them into 2-second flow windows,
extracts 10 features (matching the production ML schema), then
POSTs to the backend /api/v1/ingest endpoint.

The backend runs ML inference on each flow and broadcasts results
via WebSocket to the Vercel frontend in real time.

Usage:
    sudo python3 agent.py                        # auto-detect interface
    sudo python3 agent.py --iface en0            # force interface
    sudo python3 agent.py --iface en0 --rate 1   # flush every 1 second
    sudo python3 agent.py --filter "tcp or udp"  # custom BPF

Requirements:
    pip install scapy requests
"""

import argparse
import json
import socket
import subprocess
import sys
import threading
import time
from collections import defaultdict
from datetime import datetime

import requests

try:
    from scapy.all import sniff, IP, TCP, UDP, conf as scapy_conf, get_if_list
except ImportError:
    print("❌  pip install scapy")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
BACKEND_URL  = "https://argus-backend-kbg6.onrender.com/api/v1"
INGEST_URL   = f"{BACKEND_URL}/ingest"
FLUSH_EVERY  = 5.0          # seconds between POST batches
WINDOW_SECS  = 5.0          # flow-aggregation window = same as flush
MAX_BATCH    = 50           # cap packets per POST to avoid timeout
# ─────────────────────────────────────────────────────────────────────────────


# ── Interface auto-detection ──────────────────────────────────────────────────
def detect_interface() -> str:
    """
    Returns the best available non-loopback network interface.
    Works on macOS and Linux without root for detection.
    """
    # 1. Try scapy's own best-interface guess
    try:
        iface = str(scapy_conf.iface)
        if iface and iface != "lo" and iface != "lo0":
            return iface
    except Exception:
        pass

    # 2. macOS: use route to find default interface
    try:
        out = subprocess.check_output(
            ["route", "-n", "get", "default"], stderr=subprocess.DEVNULL
        ).decode()
        for line in out.splitlines():
            if "interface:" in line:
                iface = line.split()[-1].strip()
                if iface:
                    return iface
    except Exception:
        pass

    # 3. Linux: ip route
    try:
        out = subprocess.check_output(
            ["ip", "route", "show", "default"], stderr=subprocess.DEVNULL
        ).decode()
        parts = out.split()
        if "dev" in parts:
            return parts[parts.index("dev") + 1]
    except Exception:
        pass

    # 4. Fallback: first non-loopback from scapy list
    try:
        for iface in get_if_list():
            if iface not in ("lo", "lo0"):
                return iface
    except Exception:
        pass

    return "en0"   # last resort


# ── Flow-window aggregator ────────────────────────────────────────────────────
class FlowAggregator:
    """
    Groups incoming packets by (src_ip, dst_ip, src_port, dst_port, proto)
    within WINDOW_SECS buckets and produces flow records with 10 features.
    """

    def __init__(self):
        self._flows: dict = defaultdict(list)
        self._lock = threading.Lock()

    def add(self, pkt):
        if not pkt.haslayer(IP):
            return
        ip     = pkt[IP]
        proto  = ip.proto
        length = len(pkt)
        ts     = float(pkt.time)
        sport  = pkt[TCP].sport if pkt.haslayer(TCP) else (pkt[UDP].sport if pkt.haslayer(UDP) else 0)
        dport  = pkt[TCP].dport if pkt.haslayer(TCP) else (pkt[UDP].dport if pkt.haslayer(UDP) else 0)

        bucket = int(ts // WINDOW_SECS)
        key    = (ip.src, ip.dst, sport, dport, proto, bucket)

        with self._lock:
            self._flows[key].append((ts, length))

    def drain(self) -> list[dict]:
        """Returns list of flow-feature dicts and clears the buffer."""
        with self._lock:
            flows = dict(self._flows)
            self._flows.clear()

        records = []
        for (src_ip, dst_ip, sport, dport, proto, _bucket), pkts in flows.items():
            if not pkts:
                continue
            timestamps = [p[0] for p in pkts]
            lengths    = [p[1] for p in pkts]
            n          = len(pkts)
            byte_total = sum(lengths)
            duration   = max(max(timestamps) - min(timestamps), 0.001)

            records.append({
                "src_ip":             src_ip,
                "dst_ip":             dst_ip,
                "src_port":           sport,
                "dst_port":           dport,
                "protocol":           proto,
                "length":             int(sum(lengths) / n),   # avg pkt size
                "packet_count":       float(n),
                "byte_count":         float(byte_total),
                "duration":           float(duration),
                "avg_packet_size":    float(byte_total / n),
                "bytes_per_second":   float(byte_total / duration),
                "packets_per_second": float(n / duration),
                "timestamp":          datetime.utcnow().isoformat() + "Z",
            })

        return records


# ── Global state ──────────────────────────────────────────────────────────────
aggregator   = FlowAggregator()
stats        = {"sent": 0, "dropped": 0, "flows": 0}


def packet_callback(pkt):
    aggregator.add(pkt)


# ── Flush thread ──────────────────────────────────────────────────────────────
def flush_loop(flush_every: float):
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    print(f"📡  Flush loop → {INGEST_URL}  (every {flush_every}s)")

    while True:
        time.sleep(flush_every)
        flows = aggregator.drain()
        if not flows:
            continue

        # Cap batch size
        batch  = flows[:MAX_BATCH]
        payload = json.dumps({"packets": batch})

        try:
            r = session.post(INGEST_URL, data=payload, timeout=10)
            if r.status_code == 200:
                stats["sent"]  += len(batch)
                stats["flows"] += len(batch)
                print(f"  ✅ [{datetime.now().strftime('%H:%M:%S')}]  "
                      f"+{len(batch)} flows  (total: {stats['sent']})")
            else:
                print(f"  ⚠️  Backend {r.status_code}: {r.text[:100]}")
                stats["dropped"] += len(batch)
        except requests.exceptions.RequestException as exc:
            print(f"  ❌ POST failed: {exc}")
            stats["dropped"] += len(batch)


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="ARGUS Live Capture Agent")
    parser.add_argument("--iface",  default=None,
                        help="Network interface (default: auto-detect)")
    parser.add_argument("--rate",   type=float, default=FLUSH_EVERY,
                        help="Seconds between backend flushes (default: 2)")
    parser.add_argument("--filter", default="ip",
                        help="BPF capture filter (default: 'ip')")
    args = parser.parse_args()

    iface = args.iface or detect_interface()

    print("=" * 57)
    print("  ARGUS LIVE CAPTURE AGENT")
    print("=" * 57)
    print(f"  Interface  : {iface}")
    print(f"  BPF filter : {args.filter}")
    print(f"  Flush rate : every {args.rate}s")
    print(f"  Backend    : {BACKEND_URL}")
    print(f"  Host       : {socket.gethostname()}")
    print("=" * 57)
    print("  Packets → flows → ML inference → WebSocket → dashboard")
    print("  Ctrl+C to stop\n")

    # Start flush thread
    t = threading.Thread(target=flush_loop, args=(args.rate,), daemon=True)
    t.start()

    # Start capture (blocking)
    try:
        sniff(
            iface=iface,
            filter=args.filter,
            prn=packet_callback,
            store=False,
        )
    except KeyboardInterrupt:
        print(f"\n\n  Stopped.  Flows sent: {stats['sent']}  "
              f"Dropped: {stats['dropped']}")
    except PermissionError:
        print("\n❌  Permission denied — run with sudo:\n"
              "       sudo python3 agent.py")
        sys.exit(1)


if __name__ == "__main__":
    main()
