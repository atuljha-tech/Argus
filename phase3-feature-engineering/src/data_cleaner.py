#!/usr/bin/env python3
"""
Data Cleaner - Cleans and preprocesses data
"""

import pandas as pd
import numpy as np
from pathlib import Path

class DataCleaner:
    def __init__(self, df):
        self.df = df.copy()
        
    def remove_duplicates(self):
        """Remove duplicate rows"""
        before = len(self.df)
        self.df = self.df.drop_duplicates()
        after = len(self.df)
        print(f"Removed {before - after} duplicate rows")
        return self
        
    def handle_missing_values(self):
        """Handle missing values"""
        before = len(self.df)
        self.df = self.df.dropna()
        after = len(self.df)
        print(f"Removed {before - after} rows with missing values")
        return self
        
    def convert_types(self):
        """Convert columns to correct types"""
        # Convert IP addresses to categorical
        if 'src_ip' in self.df.columns:
            self.df['src_ip'] = self.df['src_ip'].astype('category')
        if 'dst_ip' in self.df.columns:
            self.df['dst_ip'] = self.df['dst_ip'].astype('category')
            
        # Ensure numeric columns are numeric
        numeric_cols = ['src_port', 'dst_port', 'protocol', 'length']
        for col in numeric_cols:
            if col in self.df.columns:
                self.df[col] = pd.to_numeric(self.df[col], errors='coerce')
                
        return self
        
    def normalize_ips(self):
        """Normalize IP addresses (remove .0 etc)"""
        # This is a placeholder - actual IP normalization would be more complex
        return self
        
    def get_clean_data(self):
        """Return cleaned data"""
        return self.df

if __name__ == "__main__":
    # Test the cleaner
    from data_loader import DataLoader
    
    loader = DataLoader()
    df = loader.load_all_csv()
    
    if df is not None:
        cleaner = DataCleaner(df)
        cleaner.remove_duplicates()
        cleaner.handle_missing_values()
        cleaner.convert_types()
        
        clean_df = cleaner.get_clean_data()
        print(f"\n✅ Cleaned data: {len(clean_df)} rows, {len(clean_df.columns)} columns")
        print(clean_df.head())
