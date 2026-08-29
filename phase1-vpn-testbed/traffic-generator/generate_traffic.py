#!/usr/bin/env python3
"""
Traffic Generator for SIH26160 IPsec VPN Assessment
Generates multiple types of traffic over VPN connections
"""

import subprocess
import time
import threading
import sys
import argparse

class VPNTrafficGenerator:
    def __init__(self, vpn_server_ip="192.168.14.1"):
        self.vpn_server_ip = vpn_server_ip
        self.running = True
        self.traffic_counts = {"web": 0, "voip": 0, "email": 0, "video": 0}

    def _web_traffic(self):
        """Simulate web browsing traffic"""
        print("[Web] Starting web traffic simulation...")
        while self.running:
            try:
                subprocess.run(["curl", "-s", "-m", "2", "https://www.google.com"],
                             capture_output=True, timeout=2)
                self.traffic_counts["web"] += 1
                subprocess.run(["curl", "-s", "-m", "2", "https://github.com"],
                             capture_output=True, timeout=2)
                self.traffic_counts["web"] += 1
                time.sleep(2)
            except Exception as e:
                print(f"[Web] Error: {e}")
                time.sleep(5)

    def _voip_traffic(self):
        """Simulate VoIP/voice traffic using small ICMP packets"""
        print("[VoIP] Starting VoIP traffic simulation...")
        while self.running:
            try:
                subprocess.run(
                    ["ping", "-c", "1", "-s", "200", self.vpn_server_ip],
                    capture_output=True,
                    timeout=2
                )
                self.traffic_counts["voip"] += 1
                time.sleep(0.5)
            except Exception as e:
                print(f"[VoIP] Error: {e}")
                time.sleep(1)

    def start_all(self, duration_seconds=60):
        """Start all traffic generators for specified duration"""
        print(f"[+] Starting traffic generation for {duration_seconds} seconds...")
        print(f"[+] Target VPN Server: {self.vpn_server_ip}")

        threads = [
            threading.Thread(target=self._web_traffic),
            threading.Thread(target=self._voip_traffic),
        ]

        for t in threads:
            t.daemon = True
            t.start()

        time.sleep(duration_seconds)
        self.running = False

        for t in threads:
            t.join(timeout=2)

        print("\n[+] Traffic generation complete!")
        print(f"[+] Summary:")
        print(f"    Web requests: {self.traffic_counts['web']}")
        print(f"    VoIP packets: {self.traffic_counts['voip']}")

def main():
    parser = argparse.ArgumentParser(description='Generate VPN traffic for SIH26160')
    parser.add_argument('--duration', type=int, default=60,
                        help='Duration of traffic generation in seconds')
    parser.add_argument('--server', type=str, default='192.168.14.1',
                        help='VPN server IP address')

    args = parser.parse_args()

    print("=" * 60)
    print("  SIH26160 VPN Traffic Generator")
    print("=" * 60)

    generator = VPNTrafficGenerator(vpn_server_ip=args.server)
    generator.start_all(duration_seconds=args.duration)

if __name__ == "__main__":
    main()