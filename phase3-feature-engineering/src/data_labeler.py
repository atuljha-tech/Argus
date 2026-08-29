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
            threshold = self.df['packets_per_second'].quantile(0.80)
            mask = (self.df['packets_per_second'] > threshold) & (self.df['packets_per_second'] > 0)
            self.df.loc[mask, 'label'] = 1
            self.df.loc[mask, 'attack_type'] = 'ddos'
            
        # Rule 2: High byte rate = possible data exfiltration
        if 'bytes_per_second' in self.df.columns:
            threshold = self.df['bytes_per_second'].quantile(0.80)
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
            mask = (self.df['protocol'] == 50)
            self.df.loc[mask, 'label'] = 1
            self.df.loc[mask, 'attack_type'] = 'vpn_attack'
            
        # Rule 5: Large packet count = scanning
        if 'packet_count' in self.df.columns:
            threshold = self.df['packet_count'].quantile(0.80)
            mask = (self.df['packet_count'] > threshold) & (self.df['label'] == 0)
            self.df.loc[mask, 'label'] = 1
            self.df.loc[mask, 'attack_type'] = 'scanning'
            
        return self
        
    def generate_synthetic_attacks(self):
        """Generate synthetic attack patterns to balance dataset"""
        print("Generating synthetic attack data...")
        
        normal_df = self.df[self.df['label'] == 0].copy()
        
        if len(normal_df) < 2:
            print("Not enough data to generate synthetic attacks")
            return self
            
        attack_samples = []
        
        # Attack 1: DDoS (high packet rate)
        ddos_samples = normal_df.sample(min(8, len(normal_df)//2), replace=True)
        ddos_samples = ddos_samples.copy()
        if 'packets_per_second' in ddos_samples.columns:
            ddos_samples['packets_per_second'] = ddos_samples['packets_per_second'] * np.random.uniform(10, 30)
        if 'packet_count' in ddos_samples.columns:
            ddos_samples['packet_count'] = ddos_samples['packet_count'] * np.random.uniform(5, 15)
        ddos_samples['label'] = 1
        ddos_samples['attack_type'] = 'ddos_synthetic'
        attack_samples.append(ddos_samples)
        
        # Attack 2: Data Exfiltration (high byte count)
        exfil_samples = normal_df.sample(min(8, len(normal_df)//2), replace=True)
        exfil_samples = exfil_samples.copy()
        if 'byte_count' in exfil_samples.columns:
            exfil_samples['byte_count'] = exfil_samples['byte_count'] * np.random.uniform(10, 30)
        if 'packet_count' in exfil_samples.columns:
            exfil_samples['packet_count'] = exfil_samples['packet_count'] * np.random.uniform(2, 5)
        exfil_samples['label'] = 1
        exfil_samples['attack_type'] = 'exfiltration_synthetic'
        attack_samples.append(exfil_samples)
        
        # Attack 3: VPN Attack (VPN ports)
        vpn_samples = normal_df.sample(min(8, len(normal_df)//2), replace=True)
        vpn_samples = vpn_samples.copy()
        if 'dst_port' in vpn_samples.columns:
            vpn_samples['dst_port'] = np.random.choice([500, 4500], len(vpn_samples))
        if 'protocol' in vpn_samples.columns:
            vpn_samples['protocol'] = 50
        vpn_samples['label'] = 1
        vpn_samples['attack_type'] = 'vpn_attack_synthetic'
        attack_samples.append(vpn_samples)
        
        # Attack 4: Scanning (many packets) - FIXED IP generation
        scan_samples = normal_df.sample(min(6, len(normal_df)//2), replace=True)
        scan_samples = scan_samples.copy()
        if 'packet_count' in scan_samples.columns:
            scan_samples['packet_count'] = scan_samples['packet_count'] * np.random.uniform(50, 100)
        if 'src_ip' in scan_samples.columns:
            # Generate random IPs as strings
            ip_list = []
            for _ in range(len(scan_samples)):
                ip = f"192.168.{np.random.randint(1, 255)}.{np.random.randint(1, 255)}"
                ip_list.append(ip)
            scan_samples['src_ip'] = ip_list
        scan_samples['label'] = 1
        scan_samples['attack_type'] = 'scanning_synthetic'
        attack_samples.append(scan_samples)
        
        # Combine all attack samples
        if attack_samples:
            attack_df = pd.concat(attack_samples, ignore_index=True)
            self.df = pd.concat([self.df, attack_df], ignore_index=True)
            print(f"✅ Added {len(attack_df)} synthetic attack samples")
        else:
            print("⚠️ No synthetic samples generated")
            
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
        engineer.create_categorical_features()
        engineer.add_interaction_features()
        engineered_df = engineer.get_engineered_data()
        
        labeler = DataLabeler(engineered_df)
        labeler.label_by_rules()
        labeler.generate_synthetic_attacks()
        labeler.add_attack_types()
        
        labeled_df = labeler.get_labeled_data()
        print(f"\n✅ Labeled data: {len(labeled_df)} rows, {len(labeled_df.columns)} columns")
        print("\n�� Label Distribution:")
        print(labeled_df['label'].value_counts())
        print("\n📊 Attack Type Distribution:")
        print(labeled_df['attack_type'].value_counts())
