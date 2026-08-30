#!/usr/bin/env python3
"""
Utility functions for the API
"""

import json
import joblib
import numpy as np
from pathlib import Path

class ModelLoader:
    """Load and manage ML models"""
    
    def __init__(self, model_path=None, scaler_path=None):
        base_dir = Path(__file__).parent.parent
        self.model_path = model_path or (base_dir / "models" / "decision_tree.pkl" if (base_dir / "models" / "decision_tree.pkl").exists() else "models/decision_tree.pkl")
        self.scaler_path = scaler_path or (base_dir / "models" / "scaler.pkl" if (base_dir / "models" / "scaler.pkl").exists() else "models/scaler.pkl")
        self.model = None
        self.scaler = None
        
    def load_models(self):
        """Load model and scaler"""
        try:
            if Path(self.model_path).exists():
                self.model = joblib.load(self.model_path)
                print(f"✅ Model loaded from: {self.model_path}")
            else:
                print(f"❌ Model not found: {self.model_path}")
                return False
                
            if Path(self.scaler_path).exists():
                self.scaler = joblib.load(self.scaler_path)
                print(f"✅ Scaler loaded from: {self.scaler_path}")
            else:
                print(f"⚠️ Scaler not found: {self.scaler_path}")
                
            return True
            
        except Exception as e:
            print(f"❌ Error loading models: {e}")
            return False
            
    def predict(self, features):
        """Make prediction"""
        if self.model is None:
            raise ValueError("Model not loaded")
            
        # Prepare features
        feature_list = [
            features.get('src_port', 0),
            features.get('dst_port', 0),
            features.get('protocol', 0),
            features.get('length', 0)
        ]
        X = np.array(feature_list).reshape(1, -1)
        
        # Scale if scaler is available
        if self.scaler is not None:
            X = self.scaler.transform(X)
            
        # Predict
        prediction = self.model.predict(X)[0]
        
        # Get confidence (probability)
        try:
            proba = self.model.predict_proba(X)[0]
            confidence = float(max(proba))
        except:
            confidence = 0.5
            
        return prediction, confidence

def get_risk_level(prediction, confidence):
    """Get risk level based on prediction and confidence"""
    if prediction == 0:
        return "LOW" if confidence > 0.7 else "LOW"
    else:
        if confidence > 0.8:
            return "CRITICAL"
        elif confidence > 0.6:
            return "HIGH"
        elif confidence > 0.4:
            return "MEDIUM"
        else:
            return "LOW"

def get_attack_type(prediction):
    """Get attack type based on prediction"""
    if prediction == 0:
        return "normal"
    else:
        return "suspicious"
