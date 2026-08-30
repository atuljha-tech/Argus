#!/usr/bin/env python3
"""
FastAPI Main Application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .routes import router

# Initialize app
app = FastAPI(
    title="Unified Cyber Defense Platform API",
    description="AI-powered security intelligence system",
    version="1.0.0"
)

# CORS middleware (allow frontend to talk to backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router, prefix="/api/v1")

import asyncio
import random
from datetime import datetime
from .ws_manager import manager
from .routes import model_loader, model_loaded, get_risk_level, get_attack_display, _recommendations

async def background_traffic_simulator():
    """
    Simulates background network telemetry traffic whenever anyone opens the deployed dashboard.
    If a real local agent (argus-agent) is running, it streams alongside or fills in when inactive.
    """
    await asyncio.sleep(2)
    sample_ips = [
        ("192.168.1.104", "142.250.190.46"),
        ("192.168.1.104", "104.16.132.229"),
        ("192.168.1.104", "13.227.74.91"),
        ("192.168.1.104", "1.1.1.1"),
        ("192.168.1.105", "140.82.121.4"),
        ("10.0.0.15",     "185.199.108.153"),
        ("192.168.1.188", "192.168.1.1"),
    ]
    attack_samples = [
        {"src_port": 54210, "dst_port": 80,   "protocol": 6,  "length": 64,   "packet_count": 850, "byte_count": 54400, "duration": 2.0, "attack_hint": "DDoS"},
        {"src_port": 49152, "dst_port": 443,  "protocol": 6,  "length": 1420, "packet_count": 12,  "byte_count": 17040, "duration": 5.0, "attack_hint": "benign"},
        {"src_port": 61200, "dst_port": 22,   "protocol": 6,  "length": 54,   "packet_count": 140, "byte_count": 7560,  "duration": 1.5, "attack_hint": "Port Scan"},
        {"src_port": 500,   "dst_port": 4500, "protocol": 17, "length": 320,  "packet_count": 45,  "byte_count": 14400, "duration": 4.0, "attack_hint": "VPN Exploit Attempt"},
    ]

    while True:
        try:
            # Only generate background telemetry if there are connected WebSocket clients
            if len(manager.active) > 0:
                is_attack = random.random() < 0.25
                if is_attack:
                    sample = random.choice([a for a in attack_samples if a["attack_hint"] != "benign"])
                else:
                    sample = attack_samples[1]  # benign HTTPS traffic

                src_ip, dst_ip = random.choice(sample_ips)
                features = {
                    "src_port":           sample["src_port"] + random.randint(0, 100),
                    "dst_port":           sample["dst_port"],
                    "protocol":           sample["protocol"],
                    "length":             sample["length"] + random.randint(-10, 10),
                    "packet_count":       float(sample["packet_count"]),
                    "byte_count":         float(sample["byte_count"]),
                    "duration":           float(sample["duration"]),
                    "avg_packet_size":    float(sample["byte_count"] / max(sample["packet_count"], 1)),
                    "bytes_per_second":   float(sample["byte_count"] / max(sample["duration"], 0.001)),
                    "packets_per_second": float(sample["packet_count"] / max(sample["duration"], 0.001)),
                }

                if model_loaded:
                    prediction, confidence, attack_type = model_loader.predict(features)
                    risk_level = get_risk_level(prediction, confidence)
                    payload = {
                        "type":            "live_packet",
                        "prediction":      int(prediction),
                        "attack_type":     get_attack_display(attack_type),
                        "confidence":      confidence,
                        "risk_level":      risk_level,
                        "features":        features,
                        "src_ip":          src_ip,
                        "dst_ip":          dst_ip,
                        "timestamp":       datetime.now().isoformat(),
                        "recommendations": _recommendations(prediction, risk_level),
                    }
                    await manager.broadcast(payload)
            await asyncio.sleep(3.5)
        except Exception:
            await asyncio.sleep(4.0)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(background_traffic_simulator())

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Unified Cyber Defense Platform API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/api/v1/health",
            "predict": "/api/v1/predict (POST)",
            "analyze": "/api/v1/analyze (POST)"
        }
    }

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
