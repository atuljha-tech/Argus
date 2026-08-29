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
        
    def create_ratio_features(self):
        """Create ratio-based features"""
        # Byte to packet ratio (avg packet size)
        if 'byte_count' in self.df.columns and 'packet_count' in self.df.columns:
            self.df['avg_packet_size'] = self.df['byte_count'] / self.df['packet_count']
            self.df['avg_packet_size'] = self.df['avg_packet_size'].replace([np.inf, -np.inf], 0)
            self.df['avg_packet_size'] = self.df['avg_packet_size'].fillna(0)
            
        # Bytes per second
        if 'byte_count' in self.df.columns and 'duration' in self.df.columns:
            self.df['bytes_per_second'] = self.df['byte_count'] / self.df['duration']
            self.df['bytes_per_second'] = self.df['bytes_per_second'].replace([np.inf, -np.inf], 0)
            self.df['bytes_per_second'] = self.df['bytes_per_second'].fillna(0)
            
        # Packets per second
        if 'packet_count' in self.df.columns and 'duration' in self.df.columns:
            self.df['packets_per_second'] = self.df['packet_count'] / self.df['duration']
            self.df['packets_per_second'] = self.df['packets_per_second'].replace([np.inf, -np.inf], 0)
            self.df['packets_per_second'] = self.df['packets_per_second'].fillna(0)
            
        # Bytes per packet (same as avg_packet_size) - already created
        # Packet size category (small/medium/large)
        if 'avg_packet_size' in self.df.columns:
            self.df['packet_size_category'] = pd.cut(
                self.df['avg_packet_size'],
                bins=[0, 100, 500, 1000, 10000],
                labels=['tiny', 'small', 'medium', 'large']
            )
            
        # Duration category (short/medium/long)
        if 'duration' in self.df.columns:
            self.df['duration_category'] = pd.cut(
                self.df['duration'],
                bins=[0, 1, 10, 60, 1000],
                labels=['short', 'medium', 'long', 'very_long']
            )
            
        return self
        
    def create_categorical_features(self):
        """Create categorical features from IPs and ports"""
        # IP categories (private vs public)
        def is_private_ip(ip):
            try:
                if ip.startswith('10.') or ip.startswith('192.168.') or ip.startswith('172.'):
                    return 'private'
                return 'public'
            except:
                return 'unknown'
            
        if 'src_ip' in self.df.columns:
            self.df['src_ip_type'] = self.df['src_ip'].apply(is_private_ip)
        if 'dst_ip' in self.df.columns:
            self.df['dst_ip_type'] = self.df['dst_ip'].apply(is_private_ip)
            
        # Port categories
        def port_category(port):
            try:
                if port == 80 or port == 443:
                    return 'web'
                elif port == 53:
                    return 'dns'
                elif port == 500 or port == 4500:
                    return 'vpn'
                elif port == 22:
                    return 'ssh'
                elif port == 25:
                    return 'email'
                elif port == 21:
                    return 'ftp'
                elif port > 1024:
                    return 'ephemeral'
                else:
                    return 'well_known'
            except:
                return 'unknown'
                
        if 'src_port' in self.df.columns:
            self.df['src_port_category'] = self.df['src_port'].apply(port_category)
        if 'dst_port' in self.df.columns:
            self.df['dst_port_category'] = self.df['dst_port'].apply(port_category)
            
        # Protocol name
        def protocol_name(proto):
            if proto == 6:
                return 'tcp'
            elif proto == 17:
                return 'udp'
            elif proto == 50:
                return 'esp'
            else:
                return f'proto_{proto}'
                
        if 'protocol' in self.df.columns:
            self.df['protocol_name'] = self.df['protocol'].apply(protocol_name)
            
        return self
        
    def add_interaction_features(self):
        """Add interaction features"""
        # Protocol x Port interaction
        if 'protocol' in self.df.columns and 'dst_port' in self.df.columns:
            self.df['protocol_port_interaction'] = (
                self.df['protocol'].astype(str) + '_' + 
                self.df['dst_port'].astype(str)
            )
            
        # Byte per packet (already created as avg_packet_size)
        # Packet count x average packet size
        if 'packet_count' in self.df.columns and 'avg_packet_size' in self.df.columns:
            self.df['total_data_volume'] = self.df['packet_count'] * self.df['avg_packet_size']
            
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
        engineer.add_interaction_features()
        
        engineered_df = engineer.get_engineered_data()
        print(f"\n✅ Engineered data: {len(engineered_df)} rows, {len(engineered_df.columns)} columns")
        print("New features created:")
        new_features = ['avg_packet_size', 'bytes_per_second', 'packets_per_second', 
                       'packet_size_category', 'duration_category', 'src_ip_type', 'dst_ip_type',
                       'src_port_category', 'dst_port_category', 'protocol_name', 
                       'protocol_port_interaction', 'total_data_volume']
        for feat in new_features:
            if feat in engineered_df.columns:
                print(f"   - {feat}")
        print(engineered_df.head())
