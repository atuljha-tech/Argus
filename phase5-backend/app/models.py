#!/usr/bin/env python3
"""
Pydantic models for API requests and responses
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class TrafficFeatures(BaseModel):
    """Traffic features for prediction"""
    src_port: int = 0
    dst_port: int = 0
    protocol: int = 0
    length: int = 0

class PredictionRequest(BaseModel):
    """Request for prediction"""
    features: TrafficFeatures

class PredictionResponse(BaseModel):
    """Prediction response"""
    prediction: int
    attack_type: str
    confidence: float
    risk_level: str
    timestamp: str

class SecurityReport(BaseModel):
    """Security assessment report"""
    file_name: str
    total_packets: int
    ike_packets: int
    esp_packets: int
    security_score: int
    issues: List[str]
    recommendations: List[str]
    ml_prediction: Dict[str, Any]

class HealthResponse(BaseModel):
    """Health check response"""
    model_config = {"protected_namespaces": ()}
    status: str
    model_loaded: bool
    version: str

