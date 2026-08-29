#!/usr/bin/env python3
"""
Feature Engineer - Creates new features from existing data
"""

import pandas as pd
import numpy as np
from pathlib import Path

class FeatureEngineer:
    def __init__(self, df):
        self.df = df.copy()
        
    def create_time_features(self):
        """Create time-based features (if timestamp exists)"""
        # Placeholder - will be used when timestamp data is available
        return self
        
    def create_ratio_features(self):
        """Create ratio-based features"""
        # Byte to packet ratio (avg packet size)
        if 'byte_count' in self.df.columns and 'packet_count' in self.df.columns:
            self.df['avg_packet_size'] = self.df['byte_count'] / self.df['packet_count']
            self.df['avg_packet_size'] = self.df['avg_packet_size'].replace([np.inf, -np.inf], 0)
            
        # Bytes per second
        if 'byte_count' in self.df.columns and 'duration' in self.df.columns:
            self.df['bytes_per_second'] = self.df['byte_count'] / self.df['duration']
            self.df['bytes_per_second'] = self.df['bytes_per_second'].replace([np.inf, -np.inf], 0)
            
        # Packets per second
        if 'packet_count' in self.df.columns and 'duration' in self.df.columns:
            self.df['packets_per_second'] = self.df['packet_count'] / self.df['duration']
            self.df['packets_per_second'] = self.df['packets_per_second'].replace([np.inf, -np.inf], 0)
            
        return self
        
    def create_categorical_features(self):
        """Create categorical features from IPs and ports"""
        # IP categories (private vs public)
        def is_private_ip(ip):
            if ip.startswith('10.') or ip.startswith('192.168.') or ip.startswith('172.'):
                return 'private'
            return 'public'
            
        if 'src_ip' in self.df.columns:
            self.df['src_ip_type'] = self.df['src_ip'].apply(is_private_ip)
        if 'dst_ip' in self.df.columns:
            self.df['dst_ip_type'] = self.df['dst_ip'].apply(is_private_ip)
            
        # Port categories
        def port_category(port):
            if port == 80 or port == 443:
                return 'web'
            elif port == 53:
                return 'dns'
            elif port == 500 or port == 4500:
                return 'vpn'
            elif port > 1024:
                return 'ephemeral'
            else:
                return 'well_known'
                
        if 'src_port' in self.df.columns:
            self.df['src_port_category'] = self.df['src_port'].apply(port_category)
        if 'dst_port' in self.df.columns:
            self.df['dst_port_category'] = self.df['dst_port'].apply(port_category)
            
        return self
        
    def get_engineered_data(self):
        """Return the engineered features"""
        return self.df

if __name__ == "__main__":
    from data_loader import DataLoader
    from data_cleaner import DataCleaner
    
    loader = DataLoader()
    df = loader.load_all_csv()
    
    if df is not None:
        cleaner = DataCleaner(df)
        cleaner.remove_duplicates()
        cleaner.handle_missing_values()
        clean_df = cleaner.get_clean_data()
        
        engineer = FeatureEngineer(clean_df)
        engineer.create_ratio_features()
        engineer.create_categorical_features()
        
        engineered_df = engineer.get_engineered_data()
        print(f"\n✅ Engineered data: {len(engineered_df)} rows, {len(engineered_df.columns)} columns")
        print(engineered_df.head())
