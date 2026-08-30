#!/usr/bin/env python3
"""
API Tests
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    """Test health check endpoint"""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "model_loaded" in data

def test_predict():
    """Test prediction endpoint"""
    payload = {
        "features": {
            "src_port": 500,
            "dst_port": 4500,
            "protocol": 17,
            "length": 100
        }
    }
    response = client.post("/api/v1/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert "confidence" in data
    assert "risk_level" in data

def test_analyze():
    """Test analyze endpoint"""
    payload = {
        "src_port": 500,
        "dst_port": 4500,
        "protocol": 17,
        "length": 100
    }
    response = client.post("/api/v1/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert "recommendations" in data
