#!/usr/bin/env python3
"""
Utility functions — ModelLoader, risk helpers, attack-type resolver.

Feature schema (must match capture_and_train.py FEATURE_COLS exactly):
    src_port, dst_port, protocol, length,
    packet_count, byte_count, duration,
    avg_packet_size, bytes_per_second, packets_per_second
"""

import joblib
import numpy as np
from datetime import datetime
from pathlib import Path

# ── Feature columns in training order ────────────────────────────────────────
FEATURE_COLS = [
    "src_port", "dst_port", "protocol", "length",
    "packet_count", "byte_count", "duration",
    "avg_packet_size", "bytes_per_second", "packets_per_second",
]

# ── Attack-type → human label ─────────────────────────────────────────────────
ATTACK_DISPLAY = {
    "benign":       "Normal Traffic",
    "normal":       "Normal Traffic",
    "ddos":         "DDoS Flood",
    "exfiltration": "Data Exfiltration",
    "port_scan":    "Port Scan",
    "vpn_exploit":  "VPN Exploit",
    "c2_beacon":    "C2 Beacon",
    "suspicious":   "Suspicious Traffic",
}


class ModelLoader:
    """
    Loads random_forest.pkl (or decision_tree.pkl as fallback),
    scaler.pkl, model_meta.pkl, and attack_labels.pkl from the
    models/ directory next to this file.
    """

    def __init__(self, model_dir: str | None = None):
        base = Path(__file__).parent.parent
        self.model_dir = Path(model_dir) if model_dir else base / "models"

        self.model         = None
        self.scaler        = None
        self.meta: dict    = {}
        self.feature_cols  = FEATURE_COLS      # default; overridden by meta
        self.attack_labels = []
        self.model_name    = "unknown"

    # ── Public ───────────────────────────────────────────────────────────────
    def load_models(self) -> bool:
        d = self.model_dir

        # 1. Model — prefer the real-traffic RF, fall back to old DT
        for name, fname in [
            ("Random Forest",  "random_forest.pkl"),
            ("Decision Tree",  "decision_tree.pkl"),
            ("Gradient Boost", "gradient_boosting.pkl"),
        ]:
            p = d / fname
            if p.exists():
                try:
                    self.model      = joblib.load(p)
                    self.model_name = name
                    print(f"✅ Model loaded : {fname}  ({name})")
                    break
                except Exception as e:
                    print(f"⚠️  Could not load {fname}: {e}")

        if self.model is None:
            print("❌ No model found in:", d)
            return False

        # 2. Scaler
        sp = d / "scaler.pkl"
        if sp.exists():
            try:
                self.scaler = joblib.load(sp)
                print(f"✅ Scaler loaded : scaler.pkl  "
                      f"(expects {getattr(self.scaler, 'n_features_in_', '?')} features)")
            except Exception as e:
                print(f"⚠️  Scaler load failed: {e}")

        # 3. Meta — tells us which feature_cols were used at training time
        mp = d / "model_meta.pkl"
        if mp.exists():
            try:
                self.meta = joblib.load(mp)
                if "feature_cols" in self.meta:
                    self.feature_cols = self.meta["feature_cols"]
                    print(f"✅ Meta loaded  : {len(self.feature_cols)} features → {self.feature_cols}")
            except Exception as e:
                print(f"⚠️  Meta load failed: {e}")

        # 4. Attack labels
        alp = d / "attack_labels.pkl"
        if alp.exists():
            try:
                self.attack_labels = joblib.load(alp)
                print(f"✅ Attack labels : {self.attack_labels}")
            except Exception as e:
                print(f"⚠️  Attack labels load failed: {e}")

        return True

    def predict(self, features: dict) -> tuple[int, float, str]:
        """
        features — dict with any subset of FEATURE_COLS.
        Missing keys default to 0.
        Also derives flow-level features if only raw packet fields are present.

        Returns (prediction: int, confidence: float, attack_type: str)
        """
        if self.model is None:
            raise ValueError("Model not loaded")

        # ── Derive missing flow features from raw packet fields ──────────────
        length      = features.get("length", 0)
        pkt_count   = features.get("packet_count", 1)
        byte_count  = features.get("byte_count", length)
        duration    = features.get("duration", 1.0)

        derived = {
            "packet_count":       pkt_count,
            "byte_count":         byte_count,
            "duration":           duration,
            "avg_packet_size":    byte_count / max(pkt_count, 1),
            "bytes_per_second":   byte_count / max(duration,  0.001),
            "packets_per_second": pkt_count  / max(duration,  0.001),
        }
        full = {**derived, **features}   # features override derived defaults

        # ── Build feature vector in training order ────────────────────────────
        n_expected = (
            self.scaler.n_features_in_
            if self.scaler is not None and hasattr(self.scaler, "n_features_in_")
            else len(self.feature_cols)
        )
        cols_to_use = self.feature_cols[:n_expected]
        vec = np.array([float(full.get(c, 0)) for c in cols_to_use]).reshape(1, -1)

        # ── Scale ─────────────────────────────────────────────────────────────
        if self.scaler is not None:
            try:
                vec = self.scaler.transform(vec)
            except Exception as e:
                print(f"⚠️  Scaler transform failed ({e}) — using raw features")

        # ── Predict ───────────────────────────────────────────────────────────
        prediction = int(self.model.predict(vec)[0])

        try:
            proba      = self.model.predict_proba(vec)[0]
            confidence = float(max(proba))
        except Exception:
            confidence = 0.5

        # ── Post-processing: sanity-check ML output against real thresholds ──
        # The model may have been trained on synthetic data and over-flags
        # normal home/office traffic. Only trust its "threat" prediction when
        # the flow features actually look anomalous.
        if prediction == 1:
            pps  = float(full.get("packets_per_second", 0))
            bps  = float(full.get("bytes_per_second",   0))
            aps  = float(full.get("avg_packet_size",     full.get("length", 0)))
            pkt  = float(full.get("packet_count",        1))
            dport = int(full.get("dst_port",             0))
            proto = int(full.get("protocol",             0))

            # If no feature actually looks suspicious, override to benign
            looks_suspicious = (
                pps  > 200          or   # real DDoS threshold
                bps  > 1_000_000    or   # 1 MB/s sustained
                (pkt > 30 and aps < 80)  or   # port scan pattern
                (dport in (500, 4500) and pps > 20) or  # VPN abuse
                (proto == 50 and pps > 50)              # ESP flood
            )
            if not looks_suspicious:
                prediction = 0
                confidence = 1.0 - confidence   # flip confidence to benign side

        # ── Attack type ───────────────────────────────────────────────────────
        return prediction, confidence, attack_type

    def model_info(self) -> dict:
        """Returns metadata dict for the /health and /model-info endpoints."""
        return {
            "model_name":    self.model_name,
            "feature_cols":  self.feature_cols,
            "n_features":    len(self.feature_cols),
            "accuracy":      self.meta.get("accuracy"),
            "trained_on":    self.meta.get("trained_on"),
            "n_samples":     self.meta.get("n_samples"),
            "attack_types":  self.meta.get("attack_types", self.attack_labels),
        }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _classify_attack_type(features: dict, prediction: int, confidence: float) -> str:
    """
    Realistic attack classification for real home/office WiFi traffic.
    Most traffic is normal — only flag with strong evidence.
    """
    if prediction == 0:
        return "benign"

    pps   = features.get("packets_per_second", 0)
    bps   = features.get("bytes_per_second",   0)
    aps   = features.get("avg_packet_size",     features.get("length", 0))
    pkt   = features.get("packet_count",        1)
    dport = features.get("dst_port",            0)
    proto = features.get("protocol",            0)
    dur   = features.get("duration",            1.0)

    # DDoS — very high packet rate (>200 pps is extreme for a single flow)
    if pps > 200:
        return "ddos"

    # Data exfiltration — sustained high throughput (>1 MB/s) with large packets
    if bps > 1_000_000 and aps > 800 and dur > 2:
        return "exfiltration"

    # Port scan — many tiny packets spread across a short window
    # (>30 packets, avg size < 80 bytes, fast rate)
    if pkt > 30 and aps < 80 and pps > 10:
        return "port_scan"

    # VPN abuse — IPsec-specific ports with anomalous rate
    if dport in (500, 4500) and pps > 20:
        return "vpn_exploit"

    # Raw ESP flood
    if proto == 50 and pps > 50:
        return "vpn_exploit"

    # Default for any ML-flagged traffic that doesn't match specific patterns
    return "suspicious"


def get_risk_level(prediction: int, confidence: float) -> str:
    if prediction == 0:
        return "LOW"
    if confidence > 0.85:
        return "CRITICAL"
    if confidence > 0.65:
        return "HIGH"
    if confidence > 0.45:
        return "MEDIUM"
    return "LOW"


def get_attack_display(attack_type: str) -> str:
    """Human-readable label for any attack_type string."""
    return ATTACK_DISPLAY.get(attack_type.lower(), attack_type.replace("_", " ").title())
