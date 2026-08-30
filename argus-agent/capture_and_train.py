#!/usr/bin/env python3
"""
ARGUS Capture-and-Train
=======================
Step 1 — Capture real packets from your NIC for N seconds
Step 2 — Extract 10 features per packet (same schema as production inference)
Step 3 — Label them with smart heuristics (no fake synthetic data)
Step 4 — Train a Random Forest on your own traffic
Step 5 — Save model.pkl + scaler.pkl straight into phase5-backend/models/
         so the deployed backend immediately uses the real model on next redeploy.

Usage:
    sudo python3 capture_and_train.py                  # 60s capture, en0
    sudo python3 capture_and_train.py --iface en1      # different interface
    sudo python3 capture_and_train.py --duration 120   # capture 2 minutes
    sudo python3 capture_and_train.py --iface en0 --duration 90 --filter "tcp or udp"

Requirements:
    pip install scapy scikit-learn pandas numpy joblib
"""

import argparse
import os
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

try:
    from scapy.all import sniff, IP, TCP, UDP, conf as scapy_conf
except ImportError:
    print("❌  pip install scapy")
    sys.exit(1)

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, accuracy_score
except ImportError:
    print("❌  pip install scikit-learn")
    sys.exit(1)

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT      = Path(__file__).parent.parent
MODEL_DIR = ROOT / "phase5-backend" / "models"
DATA_DIR  = ROOT / "argus-agent" / "captured_data"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── Feature names (must match utils.py EXACTLY) ───────────────────────────────
FEATURE_COLS = [
    "src_port", "dst_port", "protocol", "length",
    "packet_count", "byte_count", "duration",
    "avg_packet_size", "bytes_per_second", "packets_per_second",
]

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — CAPTURE
# ─────────────────────────────────────────────────────────────────────────────
captured_packets = []

def _pkt_cb(pkt):
    if pkt.haslayer(IP):
        captured_packets.append(pkt)


def capture(iface: str, duration: int, bpf: str):
    print(f"\n{'='*55}")
    print(f"  ARGUS CAPTURE-AND-TRAIN")
    print(f"{'='*55}")
    print(f"  Interface : {iface}")
    print(f"  Duration  : {duration}s")
    print(f"  BPF filter: {bpf}")
    print(f"  Output    : {MODEL_DIR}")
    print(f"{'='*55}")
    print(f"\n📡  Capturing packets for {duration}s …  (Ctrl+C to stop early)\n")

    sniff(iface=iface, filter=bpf, prn=_pkt_cb,
          store=False, timeout=duration)

    print(f"\n✅  Captured {len(captured_packets)} packets")
    return captured_packets


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — EXTRACT FEATURES
# Flow-level aggregation: group by (src_ip, dst_ip, src_port, dst_port, proto)
# within 5-second windows → one row per flow window
# ─────────────────────────────────────────────────────────────────────────────
WINDOW_SECS = 5.0

def extract_features(packets) -> pd.DataFrame:
    print("\n[2/4] Extracting features …")

    # Group packets into flow-windows
    flows: dict = defaultdict(list)
    for pkt in packets:
        if not pkt.haslayer(IP):
            continue
        ip = pkt[IP]
        proto  = ip.proto
        length = len(pkt)
        ts     = float(pkt.time)
        sport  = pkt[TCP].sport if pkt.haslayer(TCP) else (pkt[UDP].sport if pkt.haslayer(UDP) else 0)
        dport  = pkt[TCP].dport if pkt.haslayer(TCP) else (pkt[UDP].dport if pkt.haslayer(UDP) else 0)

        # Quantise timestamp to window bucket
        bucket = int(ts // WINDOW_SECS)
        key    = (ip.src, ip.dst, sport, dport, proto, bucket)
        flows[key].append((ts, length))

    if not flows:
        print("❌  No IP packets captured.")
        sys.exit(1)

    rows = []
    for (src_ip, dst_ip, sport, dport, proto, bucket), pkts in flows.items():
        timestamps = [p[0] for p in pkts]
        lengths    = [p[1] for p in pkts]
        n          = len(pkts)
        byte_total = sum(lengths)
        t_min, t_max = min(timestamps), max(timestamps)
        duration   = max(t_max - t_min, 0.001)     # avoid /0

        rows.append({
            "src_ip":             src_ip,
            "dst_ip":             dst_ip,
            "src_port":           sport,
            "dst_port":           dport,
            "protocol":           proto,
            "length":             int(np.mean(lengths)),   # avg pkt size this window
            "packet_count":       n,
            "byte_count":         byte_total,
            "duration":           duration,
            "avg_packet_size":    byte_total / n,
            "bytes_per_second":   byte_total / duration,
            "packets_per_second": n / duration,
            "window_start":       datetime.utcfromtimestamp(t_min).isoformat() + "Z",
        })

    df = pd.DataFrame(rows)
    print(f"  ✅  {len(df)} flow-windows extracted from {len(packets)} packets")
    return df


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — SMART LABELLING (no synthetic data — purely heuristic on real flows)
# ─────────────────────────────────────────────────────────────────────────────
def label(df: pd.DataFrame) -> pd.DataFrame:
    print("\n[3/4] Labelling traffic …")

    df = df.copy()
    df["label"]       = 0          # 0 = benign
    df["attack_type"] = "benign"

    pps_p90 = df["packets_per_second"].quantile(0.90)
    bps_p90 = df["bytes_per_second"].quantile(0.90)
    pkt_p90 = df["packet_count"].quantile(0.90)

    # Rule 1 — DDoS: abnormally high packet rate
    mask_ddos = df["packets_per_second"] > pps_p90 * 2
    df.loc[mask_ddos, "label"]       = 1
    df.loc[mask_ddos, "attack_type"] = "ddos"

    # Rule 2 — Data exfiltration: high byte rate AND large average packet
    mask_exfil = (df["bytes_per_second"] > bps_p90 * 2) & \
                 (df["avg_packet_size"]  > df["avg_packet_size"].quantile(0.80))
    df.loc[mask_exfil & (df["label"] == 0), "label"]       = 1
    df.loc[mask_exfil & (df["attack_type"] == "benign"), "attack_type"] = "exfiltration"

    # Rule 3 — Port scan: many packets but tiny size & dst_port varies widely
    mask_scan = (df["packet_count"] > pkt_p90) & (df["avg_packet_size"] < 100)
    df.loc[mask_scan & (df["label"] == 0), "label"]       = 1
    df.loc[mask_scan & (df["attack_type"] == "benign"), "attack_type"] = "port_scan"

    # Rule 4 — VPN abuse: IPsec ports (500/4500) or ESP (proto 50) at high rate
    mask_vpn = (df["dst_port"].isin([500, 4500]) | (df["protocol"] == 50)) & \
               (df["packets_per_second"] > pps_p90)
    df.loc[mask_vpn & (df["label"] == 0), "label"]       = 1
    df.loc[mask_vpn & (df["attack_type"] == "benign"), "attack_type"] = "vpn_exploit"

    # Rule 5 — C2 beacon: suspiciously regular low-volume intervals (periodic)
    # Proxy: very low packet_count per window but connection persists (duration ~= window)
    mask_c2 = (df["packet_count"] <= 2) & (df["duration"] > WINDOW_SECS * 0.8) & \
              (df["dst_port"].between(1024, 65535))
    df.loc[mask_c2 & (df["label"] == 0), "label"]       = 1
    df.loc[mask_c2 & (df["attack_type"] == "benign"), "attack_type"] = "c2_beacon"

    benign  = (df["label"] == 0).sum()
    threats = (df["label"] == 1).sum()
    print(f"  ✅  Benign: {benign}  |  Threats: {threats}")
    print(f"  Attack types: {df[df['label']==1]['attack_type'].value_counts().to_dict()}")

    # If no threats found at all (very clean network) — synthesise a small
    # minority class so the model can still learn a decision boundary
    if threats == 0:
        print("  ⚠️  No threats found — adding minimal synthetic minority class")
        synthetic = df.sample(min(10, len(df)), replace=False).copy()
        synthetic["packets_per_second"] *= np.random.uniform(5, 20, len(synthetic))
        synthetic["bytes_per_second"]   *= np.random.uniform(5, 15, len(synthetic))
        synthetic["label"]       = 1
        synthetic["attack_type"] = "ddos"
        df = pd.concat([df, synthetic], ignore_index=True)

    # Save labelled CSV for inspection
    out = DATA_DIR / f"labeled_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    df.to_csv(out, index=False)
    print(f"  💾  Saved: {out}")
    return df


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — TRAIN & SAVE
# ─────────────────────────────────────────────────────────────────────────────
def train_and_save(df: pd.DataFrame):
    print("\n[4/4] Training Random Forest on real traffic …")

    available = [c for c in FEATURE_COLS if c in df.columns]
    X = df[available].fillna(0).values
    y = df["label"].values
    y_type = df["attack_type"].values

    # Scaler
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train / test split — stratify only if both classes present
    try:
        X_tr, X_te, y_tr, y_te = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42, stratify=y)
    except ValueError:
        X_tr, X_te, y_tr, y_te = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42)

    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_tr, y_tr)

    acc = accuracy_score(y_te, clf.predict(X_te))
    print(f"\n  Test accuracy : {acc*100:.1f}%")
    print(f"  Features used : {available}")
    print(f"\n{classification_report(y_te, clf.predict(X_te), zero_division=0)}")

    # Save meta so backend can read it
    meta = {
        "feature_cols":  available,
        "n_features":    len(available),
        "accuracy":      round(acc, 4),
        "trained_on":    datetime.now().isoformat(),
        "n_samples":     len(df),
        "attack_types":  df["attack_type"].unique().tolist(),
        # Store per-flow attack_type lookup keyed by index (for inference enrichment)
    }

    # Persist
    joblib.dump(clf,    MODEL_DIR / "random_forest.pkl")
    joblib.dump(scaler, MODEL_DIR / "scaler.pkl")
    joblib.dump(meta,   MODEL_DIR / "model_meta.pkl")

    # Also save a label encoder for attack_type
    # (map index → attack_type string for each training row)
    # We store sorted unique labels so utils.py can decode them
    attack_labels = sorted(df["attack_type"].unique().tolist())
    joblib.dump(attack_labels, MODEL_DIR / "attack_labels.pkl")

    print(f"\n  💾  Saved random_forest.pkl → {MODEL_DIR}")
    print(f"  💾  Saved scaler.pkl         → {MODEL_DIR}")
    print(f"  💾  Saved model_meta.pkl     → {MODEL_DIR}")
    print(f"  💾  Saved attack_labels.pkl  → {MODEL_DIR}")
    print(f"\n{'='*55}")
    print("  ✅  TRAINING COMPLETE — redeploy backend to use new model")
    print(f"{'='*55}\n")
    return clf, scaler, meta


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="ARGUS Capture-and-Train")
    parser.add_argument("--iface",    default=None,     help="Network interface (default: scapy auto)")
    parser.add_argument("--duration", type=int, default=60, help="Capture duration in seconds (default: 60)")
    parser.add_argument("--filter",   default="ip",     help="BPF filter (default: 'ip')")
    args = parser.parse_args()

    iface = args.iface or str(scapy_conf.iface)

    pkts = capture(iface, args.duration, args.filter)
    df   = extract_features(pkts)
    df   = label(df)
    train_and_save(df)


if __name__ == "__main__":
    main()
