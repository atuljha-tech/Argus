#!/usr/bin/env python3
"""
API Routes
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import Dict, Any
import json

from .models import (
    PredictionRequest, 
    PredictionResponse, 
    HealthResponse,
    SecurityReport
)
from .utils import ModelLoader, get_risk_level, get_attack_type

# Initialize router
router = APIRouter()

# Initialize model loader
model_loader = ModelLoader()
model_loaded = model_loader.load_models()

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy" if model_loaded else "degraded",
        model_loaded=model_loaded,
        version="1.0.0"
    )

@router.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Predict if traffic is normal or attack"""
    if not model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Extract features
        features = {
            'src_port': request.features.src_port,
            'dst_port': request.features.dst_port,
            'protocol': request.features.protocol,
            'length': request.features.length
        }
        
        # Make prediction
        prediction, confidence = model_loader.predict(features)
        
        # Get risk level and attack type
        risk_level = get_risk_level(prediction, confidence)
        attack_type = get_attack_type(prediction)
        
        return PredictionResponse(
            prediction=int(prediction),
            attack_type=attack_type,
            confidence=confidence,
            risk_level=risk_level,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@router.post("/analyze", response_model=Dict[str, Any])
async def analyze_traffic(features: Dict[str, Any]):
    """Analyze traffic features and provide security assessment"""
    if not model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Extract features
        feature_data = {
            'src_port': features.get('src_port', 0),
            'dst_port': features.get('dst_port', 0),
            'protocol': features.get('protocol', 0),
            'length': features.get('length', 0)
        }
        
        # Make prediction
        prediction, confidence = model_loader.predict(feature_data)
        
        # Generate assessment
        risk_level = get_risk_level(prediction, confidence)
        attack_type = get_attack_type(prediction)
        
        return {
            "prediction": int(prediction),
            "attack_type": attack_type,
            "confidence": confidence,
            "risk_level": risk_level,
            "features": feature_data,
            "timestamp": datetime.now().isoformat(),
            "recommendations": generate_recommendations(prediction, risk_level)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

def generate_recommendations(prediction, risk_level):
    """Generate recommendations based on prediction"""
    if prediction == 0:
        return ["Traffic appears normal. Continue monitoring."]
    else:
        if risk_level == "CRITICAL":
            return [
                "🚨 CRITICAL: Immediate action required!",
                "Investigate the source IP immediately.",
                "Consider blocking the suspicious traffic.",
                "Alert the security team."
            ]
        elif risk_level == "HIGH":
            return [
                "⚠️ HIGH RISK: Suspicious traffic detected.",
                "Analyze the traffic patterns.",
                "Monitor for escalation.",
                "Review security logs."
            ]
        else:
            return [
                "⚠️ MEDIUM RISK: Unusual traffic detected.",
                "Monitor the traffic for 5 minutes.",
                "Check if pattern repeats.",
                "Document for future reference."
            ]
