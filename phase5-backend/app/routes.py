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
    for pkt in body.packets:
        try:
            features = {
                "src_port":  pkt.src_port,
                "dst_port":  pkt.dst_port,
                "protocol":  pkt.protocol,
                "length":    pkt.length,
                "packet_count":       getattr(pkt, "packet_count", 1),
                "byte_count":         getattr(pkt, "byte_count",   pkt.length),
                "duration":           getattr(pkt, "duration",     1.0),
                "avg_packet_size":    getattr(pkt, "avg_packet_size",    pkt.length),
                "bytes_per_second":   getattr(pkt, "bytes_per_second",   0.0),
                "packets_per_second": getattr(pkt, "packets_per_second", 0.0),
            }
            prediction, confidence, attack_type = model_loader.predict(features)
            risk_level  = get_risk_level(prediction, confidence)

            result = {
                "type":            "live_packet",
                "prediction":      int(prediction),
                "attack_type":     get_attack_display(attack_type),
                "confidence":      confidence,
                "risk_level":      risk_level,
                "features":        features,
                "src_ip":          pkt.src_ip,
                "dst_ip":          pkt.dst_ip,
                "timestamp":       pkt.timestamp or datetime.now().isoformat(),
                "recommendations": _recommendations(prediction, risk_level),
            }
            results.append(result)

        except Exception as exc:
            _log(f"INGEST: skipping malformed packet: {exc}")
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
        f"threats={threats}  disk_buffer={disk_count}  "
        f"active_ws_this_proc={len(manager.active)}"
    )
    return {"processed": len(results), "timestamp": datetime.now().isoformat()}


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
