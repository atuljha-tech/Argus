#!/usr/bin/env python3
import os
from pathlib import Path
import csv

def extract_simple(pcap_path, output_csv):
    """Simple feature extraction using Python"""
    print(f"[+] Processing: {pcap_path}")
    
    # Read the file as binary and extract basic info
    try:
        with open(pcap_path, 'rb') as f:
            data = f.read()
        
        print(f"[+] File size: {len(data)} bytes")
        
        # Simple packet detection - look for IP packets (0x45-0x4F)
        packets = []
        i = 0
        pkt_count = 0
        while i < len(data) - 20:
            # Look for IP header start (0x45-0x4F)
            if data[i] in range(0x45, 0x50):
                pkt_count += 1
                if pkt_count <= 10:  # Only process first 10 packets for demo
                    # Extract basic IP info
                    proto = data[i+9]
                    src_ip = f"{data[i+12]}.{data[i+13]}.{data[i+14]}.{data[i+15]}"
                    dst_ip = f"{data[i+16]}.{data[i+17]}.{data[i+18]}.{data[i+19]}"
                    
                    # Get ports if TCP/UDP (offset 20)
                    if i + 24 < len(data):
                        src_port = (data[i+20] << 8) + data[i+21]
                        dst_port = (data[i+22] << 8) + data[i+23]
                    else:
                        src_port = 0
                        dst_port = 0
                    
                    packets.append({
                        'src_ip': src_ip,
                        'dst_ip': dst_ip,
                        'protocol': proto,
                        'src_port': src_port,
                        'dst_port': dst_port,
                        'length': 64
                    })
            i += 1
        
        print(f"[+] Found {pkt_count} potential IP packets")
        
        if packets:
            with open(output_csv, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=packets[0].keys())
                writer.writeheader()
                writer.writerows(packets)
            print(f"[+] Saved {len(packets)} packets to {output_csv}")
            return True
        return False
        
    except Exception as e:
        print(f"[!] Error: {e}")
        return False

def main():
    pcap_dir = Path("../capture/pcap_store")
    output_dir = Path("./output")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    pcap_files = list(pcap_dir.glob("*.pcap"))
    if not pcap_files:
        print("[!] No PCAP files found in", pcap_dir)
        return
    
    for pcap_file in pcap_files:
        print(f"\n{'='*60}\nProcessing: {pcap_file.name}\n{'='*60}")
        output_csv = output_dir / f"{pcap_file.stem}_features.csv"
        
        if extract_simple(str(pcap_file), str(output_csv)):
            print(f"[+] Success! Features saved to: {output_csv}")
        else:
            print("[!] Failed to extract features")

if __name__ == "__main__":
    main()
