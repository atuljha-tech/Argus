#!/usr/bin/env python3
"""
Traffic Capture for SIH26160 IPsec VPN Assessment
Captures packets to PCAP files for later analysis
"""

import subprocess
import time
import os
from datetime import datetime
import argparse

class TrafficCapture:
    def __init__(self, interface="en0", output_dir="./pcap_store"):
        self.interface = interface
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def capture(self, duration=120, filter_string="port 500 or port 4500 or port 5201"):
        """Capture traffic for specified duration"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        pcap_file = os.path.join(self.output_dir, f"vpn_traffic_{timestamp}.pcap")

        print("=" * 60)
        print("  SIH26160 Traffic Capture")
        print("=" * 60)
        print(f"[+] Interface: {self.interface}")
        print(f"[+] Duration: {duration} seconds")
        print(f"[+] Filter: {filter_string}")
        print(f"[+] Output: {pcap_file}")
        print("-" * 60)

        cmd = [
            "tshark",
            "-i", self.interface,
            "-a", f"duration:{duration}",
            "-w", pcap_file,
            "-f", filter_string
        ]

        try:
            print(f"[+] Starting capture... (Press Ctrl+C to stop early)")
            subprocess.run(cmd, check=True, timeout=duration+10)
            print(f"\n[+] Capture complete!")
            print(f"[+] File saved: {pcap_file}")

            size_bytes = os.path.getsize(pcap_file)
            size_mb = size_bytes / (1024 * 1024)
            print(f"[+] File size: {size_mb:.2f} MB")
            return pcap_file

        except subprocess.TimeoutExpired:
            print(f"\n[+] Capture completed (duration reached)")
            return pcap_file
        except KeyboardInterrupt:
            print(f"\n[+] Capture stopped by user")
            return pcap_file
        except Exception as e:
            print(f"[!] Error: {e}")
            return None

def main():
    parser = argparse.ArgumentParser(description='Capture VPN traffic for SIH26160')
    parser.add_argument('--interface', type=str, default='en0',
                        help='Network interface to capture on')
    parser.add_argument('--duration', type=int, default=60,
                        help='Capture duration in seconds')
    parser.add_argument('--output', type=str, default='./pcap_store',
                        help='Output directory for PCAP files')

    args = parser.parse_args()

    capture = TrafficCapture(interface=args.interface, output_dir=args.output)
    capture.capture(duration=args.duration)

if __name__ == "__main__":
    main()