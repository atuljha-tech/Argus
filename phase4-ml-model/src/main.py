#!/usr/bin/env python3
"""
Phase 4 Main Pipeline - Train and evaluate ML models
"""

import sys
import json
from pathlib import Path
import pandas as pd
import numpy as np

from data_loader import DataLoader
from model_trainer import ModelTrainer

class Phase4Pipeline:
    def __init__(self):
        self.output_dir = Path("../output")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def run(self):
        print("="*60)
        print("  PHASE 4: ML Model Development")
        print("="*60)
        
        # Step 1: Load data
        print("\n[1/3] Loading data...")
        loader = DataLoader()
        X_train, X_test, y_train, y_test, scaler = loader.load_data()
        
        if X_train is None:
            print("❌ Failed to load data!")
            return
        
        # Step 2: Train models
        print("\n[2/3] Training models...")
        trainer = ModelTrainer()
        results = trainer.train_models(X_train, y_train, X_test, y_test)
        
        # Step 3: Save results
        print("\n[3/3] Saving results...")
        
        # Save results as JSON
        results_json = {}
        for name, res in results.items():
            results_json[name] = {
                'accuracy': float(res['accuracy']),
                'precision': float(res['precision']),
                'recall': float(res['recall']),
                'f1_score': float(res['f1_score']),
                'train_time': float(res['train_time'])
            }
        
        results_path = self.output_dir / "evaluation_results.json"
        with open(results_path, 'w') as f:
            json.dump(results_json, f, indent=2)
        print(f"✅ Results saved to: {results_path}")
        
        # Print summary
        print("\n" + "="*60)
        print("  PHASE 4 COMPLETE!")
        print("="*60)
        print(f"✅ Training samples: {len(X_train)}")
        print(f"✅ Test samples: {len(X_test)}")
        print(f"✅ Models trained: {len(results)}")
        
        # Find best model
        if results:
            best_model = max(results, key=lambda x: results[x]['accuracy'])
            print(f"🏆 Best model: {best_model} (Accuracy: {results[best_model]['accuracy']:.4f})")

if __name__ == "__main__":
    pipeline = Phase4Pipeline()
    pipeline.run()
