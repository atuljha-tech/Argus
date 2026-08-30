#!/usr/bin/env python3
"""
API Routes
"""

import asyncio
import json
from datetime import datetime
from typing import Dict, Any, List

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from .models import (
    PredictionRequest,
    PredictionResponse,
    HealthResponse,
)
from .utils import ModelLoader, get_risk_level, get_attack_display
from .ws_manager import manager

# ── Router & model ────────────────────────────────────────────────────────────
router = APIRouter()
model_loader = ModelLoader()
model_loaded = model_loader.load_models()


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
        result = {
            "prediction":      int(prediction),
            "attack_type":     get_attack_display(attack_type),
            "confidence":      confidence,
            "risk_level":      risk_level,
            "features":        feature_data,
            "timestamp":       datetime.now().isoformat(),
            "recommendations": _recommendations(prediction, risk_level),
        }
        await manager.publish({"type": "analysis", **result})
        return result
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

    results = []
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
            # Broadcast each packet result immediately
            await manager.publish(result)

        except Exception:
            continue  # skip malformed packets silently

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
        # Keep socket open, handle any client messages (ping / close)
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        await manager.disconnect(ws)
    except Exception:
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
