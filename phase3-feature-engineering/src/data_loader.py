#!/usr/bin/env python3
"""
Data Loader - Loads CSV files from Phase 1
"""

import pandas as pd
import os
from pathlib import Path

class DataLoader:
    def __init__(self, input_dir="../input"):
        self.input_dir = Path(input_dir)
        
    def load_all_csv(self):
        """Load all CSV files from input directory"""
        csv_files = list(self.input_dir.glob("*.csv"))
        
        if not csv_files:
            print("❌ No CSV files found!")
            return None
            
        print(f"📁 Found {len(csv_files)} CSV files:")
        for f in csv_files:
            print(f"   - {f.name}")
            
        # Load each CSV and combine
        all_data = []
        for csv_file in csv_files:
            df = pd.read_csv(csv_file)
            df['source_file'] = csv_file.name  # Add source file column
            all_data.append(df)
            print(f"   📊 {csv_file.name}: {len(df)} rows, {len(df.columns)} columns")
            
        # Combine all data
        combined = pd.concat(all_data, ignore_index=True)
        print(f"\n📊 Total combined: {len(combined)} rows, {len(combined.columns)} columns")
        
        return combined
    
    def get_feature_summary(self, df):
        """Get summary of features"""
        print("\n" + "="*60)
        print("  FEATURE SUMMARY")
        print("="*60)
        print(f"Total rows: {len(df)}")
        print(f"Total columns: {len(df.columns)}")
        print("\nColumns:")
        for col in df.columns:
            print(f"   - {col}: {df[col].dtype}")
        print("\nMissing values:")
        for col in df.columns:
            missing = df[col].isna().sum()
            if missing > 0:
                print(f"   - {col}: {missing} missing values")
                
        return df

if __name__ == "__main__":
    loader = DataLoader()
    df = loader.load_all_csv()
    if df is not None:
        loader.get_feature_summary(df)
