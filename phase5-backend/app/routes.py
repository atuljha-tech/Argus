#!/usr/bin/env python3
"""
API Routes
"""

import asyncio
import json
import sys
from datetime import datetime
from typing import Dict, Any, List

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel

from .models import (
    PredictionRequest,
    PredictionResponse,
    HealthResponse,
)
from .utils import ModelLoader, get_risk_level, get_attack_display
from .ws_manager import manager


def _log(msg: str) -> None:
    """Structured stderr log — visible in Render dashboard."""
    print(f"[ROUTES] {msg}", file=sys.stderr, flush=True)


# ── Router & model ────────────────────────────────────────────────────────────
router = APIRouter()
model_loader = ModelLoader()
model_loaded = model_loader.load_models()
_log(f"Router initialised  model_loaded={model_loaded}")


# ── Pydantic models for ingest ────────────────────────────────────────────────
class RawPacket(BaseModel):
    src_port:           int   = 0
    dst_port:           int   = 0
    protocol:           int   = 0
    length:             int   = 0
    src_ip:             str   = ""
    dst_ip:             str   = ""
    timestamp:          str   = ""
    # flow-level fields populated by capture_and_train / agent flow aggregator
    packet_count:       float = 1.0
    byte_count:         float = 0.0
    duration:           float = 1.0
    avg_packet_size:    float = 0.0
    bytes_per_second:   float = 0.0
    packets_per_second: float = 0.0

class IngestRequest(BaseModel):
    packets: List[RawPacket]


# ── Existing endpoints ────────────────────────────────────────────────────────
@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy" if model_loaded else "degraded",
        model_loaded=model_loaded,
        version="1.0.0"
    )


@router.get("/model-info")
async def model_info():
    """Returns metadata about the currently loaded ML model."""
    return model_loader.model_info()


# ── DEBUG: run predict() on a sample agent packet + expose ALL exception info ─
#    Call GET /api/v1/debug-predict to verify the ML pipeline works end-to-end
#    without needing to run the agent.
@router.get("/debug-predict")
async def debug_predict():
    sample_features = {
        "src_port": 54321, "dst_port": 443, "protocol": 6, "length": 1420,
        "packet_count": 10, "byte_count": 14200, "duration": 1.5,
        "avg_packet_size": 1420, "bytes_per_second": 9466, "packets_per_second": 6.67,
    }
    try:
        prediction, confidence, attack_type = model_loader.predict(sample_features)
    except Exception as exc:
        import traceback
        return {
            "ok": False,
            "err": f"{type(exc).__name__}: {exc}",
            "traceback": traceback.format_exc(limit=10),
            "model_loaded": model_loaded,
            "features": sample_features,
            "model_info": model_loader.model_info(),
            "n_features_expected_scaler": (
                int(model_loader.scaler.n_features_in_)
                if model_loader.scaler is not None and hasattr(model_loader.scaler, "n_features_in_")
                else None
            ),
        }
    return {
        "ok": True,
        "prediction":      int(prediction),
        "confidence":      confidence,
        "attack_type":     attack_type,
        "risk_level":      get_risk_level(prediction, confidence),
        "attack_display":  get_attack_display(attack_type),
        "features":        sample_features,
        "model_loaded":    model_loaded,
        "model_info":      model_loader.model_info(),
        "scaler_loaded":   model_loader.scaler is not None,
        "n_features_expected_scaler": (
            int(model_loader.scaler.n_features_in_)
            if model_loader.scaler is not None and hasattr(model_loader.scaler, "n_features_in_")
            else None
        ),
        "feature_cols": model_loader.feature_cols,
    }


# ── DEBUG: packet-store state ─────────────────────────────────────────────────
@router.get("/store-debug")
async def store_debug():
    from .packet_store import (
        STORE_PATH, buffer_size, read_tail, MAX_PACKETS, GC_EVERY_SEC,
    )
    info: dict = {
        "store_path":        str(STORE_PATH),
        "store_exists":      STORE_PATH.exists(),
        "store_size_bytes":  STORE_PATH.stat().st_size if STORE_PATH.exists() else 0,
        "buffer_lines":      buffer_size(),
        "max_packets":       MAX_PACKETS,
        "gc_every_sec":      GC_EVERY_SEC,
        "pid":               __import__("os").getpid(),
        "server_time":       datetime.now().isoformat(),
    }
    try:
        pkts, newest = read_tail(limit=3)
        info["tail_3_timestamps"] = [p.get("timestamp") for p in pkts]
        info["newest_timestamp"]  = newest
        info["tail_3_pred"]       = [p.get("prediction") for p in pkts]
        info["tail_3_src"]        = [p.get("src_ip") for p in pkts]
    except Exception as exc:
        info["tail_error"] = f"{type(exc).__name__}: {exc}"
    return info


@router.get("/recent")
async def get_recent_packets(
    limit: int = Query(default=100, ge=1, le=500),
    since: str | None = Query(default=None, description="ISO timestamp — only return packets newer than this"),
):
    """
    HTTP fallback for live packet delivery.

    READS FROM THE SHARED DISK STORE — all Render worker processes see the
    same packet history regardless of which process accepted the agent's
    /ingest POST.

    The response includes a `next_since` cursor so clients can poll incrementally
    without re-processing the same flows.
    """
    records, newest_ts = manager.snapshot(limit=limit, since=since)
    # snapshot returns records already filtered by `since` and capped to `limit`
    total_on_disk = 0
    try:
        from .packet_store import buffer_size as disk_buffer_size
        total_on_disk = disk_buffer_size()
    except Exception:
        pass
    _log(
        f"GET /recent  limit={limit}  since={since!r}  "
        f"returned={len(records)}  disk_buffer_size={total_on_disk}  "
        f"next_since={newest_ts}"
    )
    return {
        "packets": records,
        "returned": len(records),
        "buffer_size": total_on_disk,
        "next_since": newest_ts,
        "server_time": datetime.now().isoformat(),
    }


@router.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    if not model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")
    try:
        features = {
            "src_port": request.features.src_port,
            "dst_port": request.features.dst_port,
            "protocol": request.features.protocol,
            "length":   request.features.length,
        }
        prediction, confidence, attack_type = model_loader.predict(features)
        risk_level  = get_risk_level(prediction, confidence)
        return PredictionResponse(
            prediction=int(prediction),
            attack_type=get_attack_display(attack_type),
            confidence=confidence,
            risk_level=risk_level,
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@router.post("/analyze", response_model=Dict[str, Any])
async def analyze_traffic(features: Dict[str, Any]):
    if not model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")
    try:
        feature_data = {
            "src_port": features.get("src_port", 0),
            "dst_port": features.get("dst_port", 0),
            "protocol": features.get("protocol", 0),
            "length":   features.get("length",   0),
        }
        prediction, confidence, attack_type = model_loader.predict(feature_data)
        risk_level  = get_risk_level(prediction, confidence)
        typed = {"type": "analysis"}
        result = {
            **typed,
            "prediction":      int(prediction),
            "attack_type":     get_attack_display(attack_type),
            "confidence":      confidence,
            "risk_level":      risk_level,
            "features":        feature_data,
            "timestamp":       datetime.now().isoformat(),
            "recommendations": _recommendations(prediction, risk_level),
        }
        await manager.publish(result)
        # Strip the internal `type` tag from the HTTP response (keeps schema identical).
        response_payload = {k: v for k, v in result.items() if k != "type"}
        return response_payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


# ── NEW: ingest endpoint (called by argus-agent every 2 s) ───────────────────
@router.post("/ingest")
async def ingest_packets(body: IngestRequest):
    """
    Receives a batch of raw packets from the local capture agent,
    runs ML inference on each, and broadcasts results to all
    connected WebSocket frontends.
    """
    if not model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")

    received_n = len(body.packets) if body.packets else 0
    results: List[dict] = []
    errors: List[dict] = []
    for idx, pkt in enumerate(body.packets or []):
        try:
            # ── Coerce every field defensively — any type mismatch shouldn't ─
            #    discard the whole packet (the agent sends JSON, types vary).
            def _coerce_int(v, default=0):
                try:
                    if v is None or v == "": return default
                    return int(v)
                except Exception:
                    return default
            def _coerce_float(v, default=0.0):
                try:
                    if v is None or v == "": return default
                    return float(v)
                except Exception:
                    return default

            features = {
                "src_port":           _coerce_int(getattr(pkt, "src_port", 0)),
                "dst_port":           _coerce_int(getattr(pkt, "dst_port", 0)),
                "protocol":           _coerce_int(getattr(pkt, "protocol", 0)),
                "length":             _coerce_int(getattr(pkt, "length",   0)),
                "packet_count":       _coerce_float(getattr(pkt, "packet_count", 1)),
                "byte_count":         _coerce_float(getattr(pkt, "byte_count",   getattr(pkt, "length", 0))),
                "duration":           _coerce_float(getattr(pkt, "duration",     1.0)),
                "avg_packet_size":    _coerce_float(getattr(pkt, "avg_packet_size",    getattr(pkt, "length", 0))),
                "bytes_per_second":   _coerce_float(getattr(pkt, "bytes_per_second",   0.0)),
                "packets_per_second": _coerce_float(getattr(pkt, "packets_per_second", 0.0)),
            }

            try:
                prediction, confidence, attack_type = model_loader.predict(features)
            except Exception as pred_exc:
                # NEVER discard a packet because predict crashed — log, and still
                # emit it into the stream as UNKNOWN classification so the user
                # sees flow volume in the dashboard even if the model is broken.
                _log(
                    f"INGEST pkt#{idx} predict() FAILED  exc={type(pred_exc).__name__}: {pred_exc}  "
                    f"features={features}  -> EMITTING AS UNKNOWN BENIGN"
                )
                prediction = 0
                confidence = 0.5
                attack_type = "benign"

            risk_level = get_risk_level(prediction, confidence)

            result = {
                "type":            "live_packet",
                "prediction":      int(prediction),
                "attack_type":     get_attack_display(attack_type),
                "confidence":      confidence,
                "risk_level":      risk_level,
                "features":        features,
                "src_ip":          str(getattr(pkt, "src_ip", "0.0.0.0")),
                "dst_ip":          str(getattr(pkt, "dst_ip", "0.0.0.0")),
                "timestamp":       (str(getattr(pkt, "timestamp", None))
                                    if getattr(pkt, "timestamp", None)
                                    else datetime.now().isoformat()),
                "recommendations": _recommendations(prediction, risk_level),
            }
            results.append(result)

        except Exception as exc:
            import traceback
            tb = traceback.format_exc(limit=6)
            _log(
                f"INGEST pkt#{idx} DROPPED  exc={type(exc).__name__}: {exc}\n{tb}"
            )
            errors.append({"idx": idx, "err": f"{type(exc).__name__}: {exc}"})
            continue

    # ── BULK persist + broadcast (one fsync per POST instead of per packet) ─
    if results:
        await manager.publish_batch(results)
    threats = sum(1 for r in results if r.get("prediction") == 1)
    disk_count = 0
    try:
        from .packet_store import buffer_size as disk_buffer_size
        disk_count = disk_buffer_size()
    except Exception:
        pass
    _log(
        f"POST /ingest  received={received_n}  processed={len(results)}  "
        f"errors={len(errors)}  threats={threats}  disk_buffer={disk_count}  "
        f"active_ws_this_proc={len(manager.active)}"
    )
    resp = {
        "processed": len(results),
        "errors":    len(errors),
        "timestamp": datetime.now().isoformat(),
        "disk_buffer_size": disk_count,
    }
    if errors:
        resp["error_detail"] = errors[:10]
    return resp


# ── NEW: WebSocket endpoint (consumed by Next.js frontend) ───────────────────
@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """
    Frontend connects here.  Every analysed packet from the agent
    is pushed as JSON over this socket in real time.
    Also accepts { type: 'ping' } from the client to keep alive.
    """
    await manager.connect(ws)
    _log(f"WS /ws upgrade accepted — client={ws.client}  headers={dict(ws.headers)[:80] if False else ''}")
    try:
        # Replay any flows received shortly before this browser connected.
        # This also makes a transient WebSocket reconnect recover gracefully.
        await manager.replay(ws)
        # Send connection confirmation
        await ws.send_text(json.dumps({
            "type":    "connected",
            "message": "ARGUS live stream active",
            "timestamp": datetime.now().isoformat(),
        }))
        _log("WS handshake complete — sent 'connected' frame to client")
        # Keep socket open, handle any client messages (ping / close)
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                continue
            if msg.get("type") == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        _log("WS clean WebSocketDisconnect")
        await manager.disconnect(ws)
    except Exception as exc:
        _log(f"WS exception: {type(exc).__name__}: {exc}")
        await manager.disconnect(ws)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _recommendations(prediction: int, risk_level: str) -> List[str]:
    if prediction == 0:
        return ["Traffic appears normal. Continue monitoring."]
    if risk_level == "CRITICAL":
        return [
            "🚨 CRITICAL: Immediate action required!",
            "Investigate the source IP immediately.",
            "Consider blocking the suspicious traffic.",
            "Alert the security team.",
        ]
    if risk_level == "HIGH":
        return [
            "⚠️ HIGH RISK: Suspicious traffic detected.",
            "Analyse the traffic patterns.",
            "Monitor for escalation.",
            "Review security logs.",
        ]
    return [
        "⚠️ MEDIUM RISK: Unusual traffic detected.",
        "Monitor the traffic for 5 minutes.",
        "Check if pattern repeats.",
        "Document for future reference.",
    ]
