#!/usr/bin/env python3
"""
Data Loader for Phase 4 - Loads training and test data with all features
"""

import pandas as pd
import pickle
from pathlib import Path

class DataLoader:
    def __init__(self, data_dir=".."):
        self.data_dir = Path(data_dir)
        
    def load_data(self):
        """Load training and test data with all features"""
        print("📊 Loading data...")
        
        # Load training data
        train_path = self.data_dir / "train_data.csv"
        if not train_path.exists():
            print(f"❌ Training data not found: {train_path}")
            return None, None, None, None, None
            
        train_df = pd.read_csv(train_path)
        
        # Load test data
        test_path = self.data_dir / "test_data.csv"
        if not test_path.exists():
            print(f"❌ Test data not found: {test_path}")
            return None, None, None, None, None
            
        test_df = pd.read_csv(test_path)
        
        # Load scaler
        scaler_path = self.data_dir / "scaler.pkl"
        scaler = None
        if scaler_path.exists():
            with open(scaler_path, 'rb') as f:
                scaler = pickle.load(f)
        
        # Use ALL available features
        feature_cols = [
            'src_port', 'dst_port', 'protocol', 'length',
            'packet_count', 'byte_count', 'duration',
            'avg_packet_size', 'bytes_per_second', 'packets_per_second'
        ]
        
        # Only use columns that exist
        available_cols = [col for col in feature_cols if col in train_df.columns]
        
        # If not enough features, use what's available
        if len(available_cols) < 2:
            available_cols = ['src_port', 'dst_port', 'protocol', 'length']
            available_cols = [col for col in available_cols if col in train_df.columns]
        
        X_train = train_df[available_cols].values
        y_train = train_df['label'].values
        
        X_test = test_df[available_cols].values
        y_test = test_df['label'].values
        
        print(f"✅ Training data: {len(X_train)} samples, {len(available_cols)} features")
        print(f"✅ Test data: {len(X_test)} samples")
        print(f"✅ Features used: {available_cols}")
        print(f"✅ Label distribution - Train: {pd.Series(y_train).value_counts().to_dict()}")
        print(f"✅ Label distribution - Test: {pd.Series(y_test).value_counts().to_dict()}")
        
        return X_train, X_test, y_train, y_test, scaler

if __name__ == "__main__":
    loader = DataLoader()
    X_train, X_test, y_train, y_test, scaler = loader.load_data()
    if X_train is not None:
        print(f"X_train shape: {X_train.shape}")
        print(f"X_test shape: {X_test.shape}")
        print(f"y_train shape: {y_train.shape}")
        print(f"y_test shape: {y_test.shape}")
