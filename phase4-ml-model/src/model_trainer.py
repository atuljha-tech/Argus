#!/usr/bin/env python3
"""
Model Trainer - Trains multiple ML models with all features
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
import pickle
import time
from pathlib import Path
import json

class ModelTrainer:
    def __init__(self, output_dir="../models"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.models = {}
        self.results = {}
        
    def train_models(self, X_train, y_train, X_test, y_test):
        """Train multiple models"""
        print("\n" + "="*60)
        print("  TRAINING MODELS (All Features)")
        print("="*60)
        
        # Define models to train
        model_configs = {
            'Random Forest': RandomForestClassifier(n_estimators=100, random_state=42),
            'Decision Tree': DecisionTreeClassifier(max_depth=5, random_state=42),
            'Logistic Regression': LogisticRegression(max_iter=1000, random_state=42),
            'SVM': SVC(kernel='rbf', random_state=42, probability=True),
            'K-Nearest Neighbors': KNeighborsClassifier(n_neighbors=5),
            'Gradient Boosting': GradientBoostingClassifier(n_estimators=100, random_state=42),
        }
        
        for name, model in model_configs.items():
            print(f"\n🔧 Training {name}...")
            start_time = time.time()
            
            try:
                model.fit(X_train, y_train)
                train_time = time.time() - start_time
                
                # Predict
                y_pred = model.predict(X_test)
                
                # Evaluate
                accuracy = accuracy_score(y_test, y_pred)
                precision = precision_score(y_test, y_pred, average='weighted')
                recall = recall_score(y_test, y_pred, average='weighted')
                f1 = f1_score(y_test, y_pred, average='weighted')
                
                # Store results
                self.models[name] = model
                self.results[name] = {
                    'accuracy': accuracy,
                    'precision': precision,
                    'recall': recall,
                    'f1_score': f1,
                    'train_time': train_time,
                    'y_pred': y_pred.tolist()
                }
                
                print(f"   ✅ Accuracy: {accuracy:.4f}")
                print(f"   ✅ Precision: {precision:.4f}")
                print(f"   ✅ Recall: {recall:.4f}")
                print(f"   ✅ F1 Score: {f1:.4f}")
                print(f"   ⏱️  Training time: {train_time:.2f}s")
                
                # Save model
                model_path = self.output_dir / f"{name.lower().replace(' ', '_')}.pkl"
                with open(model_path, 'wb') as f:
                    pickle.dump(model, f)
                print(f"   💾 Saved to: {model_path}")
                
            except Exception as e:
                print(f"   ❌ Error training {name}: {e}")
        
        return self.results

if __name__ == "__main__":
    from data_loader import DataLoader
    
    loader = DataLoader()
    X_train, X_test, y_train, y_test, scaler = loader.load_data()
    
    if X_train is not None:
        trainer = ModelTrainer()
        results = trainer.train_models(X_train, y_train, X_test, y_test)
        
        # Print summary
        print("\n" + "="*60)
        print("  MODEL COMPARISON")
        print("="*60)
        print(f"{'Model':<25} {'Accuracy':<12} {'F1 Score':<12} {'Time (s)':<10}")
        print("-"*60)
        for name, res in results.items():
            print(f"{name:<25} {res['accuracy']:.4f}       {res['f1_score']:.4f}       {res['train_time']:.2f}")
        
        # Save comparison to JSON
        results_json = {}
        for name, res in results.items():
            results_json[name] = {
                'accuracy': float(res['accuracy']),
                'precision': float(res['precision']),
                'recall': float(res['recall']),
                'f1_score': float(res['f1_score']),
                'train_time': float(res['train_time'])
            }
        
        with open('../output/model_comparison.json', 'w') as f:
            json.dump(results_json, f, indent=2)
        print("\n✅ Comparison saved to: ../output/model_comparison.json")
