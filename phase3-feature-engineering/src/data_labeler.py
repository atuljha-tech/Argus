#!/usr/bin/env python3
"""
Data Labeler - Labels data as normal or attack with synthetic attack generation
"""

import pandas as pd
import numpy as np
from pathlib import Path

class DataLabeler:
    def __init__(self, df):
        self.df = df.copy()
        
    def label_by_rules(self):
        """Label data using rule-based approach"""
        self.df['label'] = 0  # 0 = normal by default
        self.df['attack_type'] = 'normal'
        
        # Rule 1: High packet rate = possible DDoS attack
        if 'packets_per_second' in self.df.columns:
            threshold = self.df['packets_per_second'].quantile(0.90)
            mask = (self.df['packets_per_second'] > threshold) & (self.df['packets_per_second'] > 0)
            self.df.loc[mask, 'label'] = 1
            self.df.loc[mask, 'attack_type'] = 'ddos'
            
        # Rule 2: High byte rate = possible data exfiltration
        if 'bytes_per_second' in self.df.columns:
            threshold = self.df['bytes_per_second'].quantile(0.90)
            mask = (self.df['bytes_per_second'] > threshold) & (self.df['bytes_per_second'] > 0)
            self.df.loc[mask, 'label'] = 1
            self.df.loc[mask, 'attack_type'] = 'exfiltration'
            
        # Rule 3: VPN ports = suspicious
        if 'dst_port' in self.df.columns:
            mask = self.df['dst_port'].isin([500, 4500])
            self.df.loc[mask, 'label'] = 1
            self.df.loc[mask, 'attack_type'] = 'vpn_attack'
            
        # Rule 4: Unusual protocol = suspicious
        if 'protocol' in self.df.columns:
            mask = (self.df['protocol'] == 50)  # ESP = VPN traffic
            self.df.loc[mask, 'label'] = 1
            self.df.loc[mask, 'attack_type'] = 'vpn_attack'
            
        # Rule 5: Multiple connections from same IP = possible scanning
        if 'src_ip' in self.df.columns:
            ip_counts = self.df['src_ip'].value_counts()
            high_freq_ips = ip_counts[ip_counts > ip_counts.quantile(0.90)].index
            mask = self.df['src_ip'].isin(high_freq_ips)
            # Only mark as scan if not already marked
            self.df.loc[mask & (self.df['label'] == 0), 'label'] = 1
            self.df.loc[mask & (self.df['attack_type'] == 'normal'), 'attack_type'] = 'scanning'
            
        return self
        
    def generate_synthetic_attacks(self):
        """Generate synthetic attack patterns to balance dataset"""
        print("Generating synthetic attack data...")
        
        # Create copies of some normal rows and modify them
        normal_df = self.df[self.df['label'] == 0].copy()
        
        if len(normal_df) < 2:
            print("Not enough data to generate synthetic attacks")
            return self
            
        # Attack 1: DDoS (high packet rate)
        ddos_samples = normal_df.sample(min(5, len(normal_df)//2))
        ddos_samples = ddos_samples.copy()
        if 'packets_per_second' in ddos_samples.columns:
            ddos_samples['packets_per_second'] = ddos_samples['packets_per_second'] * np.random.uniform(5, 10)
        if 'bytes_per_second' in ddos_samples.columns:
            ddos_samples['bytes_per_second'] = ddos_samples['bytes_per_second'] * np.random.uniform(3, 5)
        ddos_samples['label'] = 1
        ddos_samples['attack_type'] = 'ddos_synthetic'
        
        # Attack 2: Data Exfiltration (high byte count)
        exfil_samples = normal_df.sample(min(5, len(normal_df)//2))
        exfil_samples = exfil_samples.copy()
        if 'byte_count' in exfil_samples.columns:
            exfil_samples['byte_count'] = exfil_samples['byte_count'] * np.random.uniform(10, 20)
        if 'packet_count' in exfil_samples.columns:
            exfil_samples['packet_count'] = exfil_samples['packet_count'] * np.random.uniform(2, 4)
        exfil_samples['label'] = 1
        exfil_samples['attack_type'] = 'exfiltration_synthetic'
        
        # Attack 3: VPN Attack (VPN ports)
        vpn_samples = normal_df.sample(min(5, len(normal_df)//2))
        vpn_samples = vpn_samples.copy()
        if 'dst_port' in vpn_samples.columns:
            vpn_samples['dst_port'] = np.random.choice([500, 4500], len(vpn_samples))
        if 'protocol' in vpn_samples.columns:
            vpn_samples['protocol'] = 50  # ESP
        vpn_samples['label'] = 1
        vpn_samples['attack_type'] = 'vpn_attack_synthetic'
        
        # Combine all data
        attack_df = pd.concat([ddos_samples, exfil_samples, vpn_samples])
        
        # Add to main dataframe
        self.df = pd.concat([self.df, attack_df], ignore_index=True)
        
        print(f"✅ Added {len(attack_df)} synthetic attack samples")
        return self
        
    def add_attack_types(self):
        """Add attack type labels"""
        return self
        
    def get_labeled_data(self):
        """Return labeled data"""
        return self.df

if __name__ == "__main__":
    from data_loader import DataLoader
    from data_cleaner import DataCleaner
    from feature_engineer import FeatureEngineer
    
    loader = DataLoader()
    df = loader.load_all_csv()
    
    if df is not None:
        cleaner = DataCleaner(df)
        cleaner.remove_duplicates()
        cleaner.handle_missing_values()
        clean_df = cleaner.get_clean_data()
        
        engineer = FeatureEngineer(clean_df)
        engineer.create_ratio_features()
        engineered_df = engineer.get_engineered_data()
        
        labeler = DataLabeler(engineered_df)
        labeler.label_by_rules()
        labeler.generate_synthetic_attacks()
        labeler.add_attack_types()
        
        labeled_df = labeler.get_labeled_data()
        print(f"\n✅ Labeled data: {len(labeled_df)} rows, {len(labeled_df.columns)} columns")
        print(labeled_df.head())
        
        print("\n📊 Label Distribution:")
        print(labeled_df['label'].value_counts())
        print("\n📊 Attack Type Distribution:")
        print(labeled_df['attack_type'].value_counts())
