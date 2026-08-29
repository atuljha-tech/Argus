#!/usr/bin/env python3
"""
Main Pipeline - Run the complete Phase 3
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from pathlib import Path
import pickle

from data_loader import DataLoader
from data_cleaner import DataCleaner
from feature_engineer import FeatureEngineer
from data_labeler import DataLabeler

class Phase3Pipeline:
    def __init__(self, input_dir="../input", output_dir="../output"):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def run(self):
        print("="*60)
        print("  PHASE 3: Feature Engineering Pipeline")
        print("="*60)
        
        # Step 1: Load data
        print("\n[1/5] Loading data...")
        loader = DataLoader(str(self.input_dir))
        df = loader.load_all_csv()
        if df is None:
            print("❌ No data loaded!")
            return
            
        # Step 2: Clean data
        print("\n[2/5] Cleaning data...")
        cleaner = DataCleaner(df)
        cleaner.remove_duplicates()
        cleaner.handle_missing_values()
        cleaner.convert_types()
        clean_df = cleaner.get_clean_data()
        
        # Step 3: Feature engineering
        print("\n[3/5] Engineering features...")
        engineer = FeatureEngineer(clean_df)
        engineer.create_ratio_features()
        engineer.create_categorical_features()
        engineered_df = engineer.get_engineered_data()
        
        # Step 4: Label data
        print("\n[4/5] Labeling data...")
        labeler = DataLabeler(engineered_df)
        labeler.label_by_rules()
        labeler.generate_synthetic_attacks()
        labeler.add_attack_types()
        labeled_df = labeler.get_labeled_data()
        
        # Save labeled data
        labeled_path = self.output_dir / "labeled_data.csv"
        labeled_df.to_csv(labeled_path, index=False)
        print(f"✅ Labeled data saved to: {labeled_path}")
        
        # Step 5: Prepare for ML (encode categorical, scale numeric)
        print("\n[5/5] Preparing for ML...")
        
        # Select features for ML
        feature_cols = [
            'src_port', 'dst_port', 'protocol', 'length',
            'packet_count', 'byte_count', 'duration',
            'avg_packet_size', 'bytes_per_second', 'packets_per_second'
        ]
        
        # Only use columns that exist
        available_cols = [col for col in feature_cols if col in labeled_df.columns]
        X = labeled_df[available_cols].copy()
        y = labeled_df['label'].copy()
        
        # Handle missing values
        X = X.fillna(0)
        
        # Scale numeric features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Save train/test sets
        train_df = pd.DataFrame(X_train, columns=available_cols)
        train_df['label'] = y_train.values
        train_path = self.output_dir / "train_data.csv"
        train_df.to_csv(train_path, index=False)
        
        test_df = pd.DataFrame(X_test, columns=available_cols)
        test_df['label'] = y_test.values
        test_path = self.output_dir / "test_data.csv"
        test_df.to_csv(test_path, index=False)
        
        # Save scaler for later use
        scaler_path = self.output_dir / "scaler.pkl"
        with open(scaler_path, 'wb') as f:
            pickle.dump(scaler, f)
        
        print(f"✅ Training data saved to: {train_path}")
        print(f"✅ Test data saved to: {test_path}")
        print(f"✅ Scaler saved to: {scaler_path}")
        
        # Summary
        print("\n" + "="*60)
        print("  PHASE 3 COMPLETE!")
        print("="*60)
        print(f"Total samples: {len(labeled_df)}")
        print(f"Training samples: {len(train_df)}")
        print(f"Test samples: {len(test_df)}")
        print(f"Features: {len(available_cols)}")
        print("\nLabel distribution:")
        print(y.value_counts())
        print("\nAttack type distribution:")
        print(labeled_df['attack_type'].value_counts())

if __name__ == "__main__":
    pipeline = Phase3Pipeline()
    pipeline.run()
