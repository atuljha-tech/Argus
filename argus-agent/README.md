# ARGUS Live Capture Agent

Lightweight background agent that sniffs real packets off your Mac's NIC and streams them to the deployed backend.

## Setup (one-time)

```bash
pip install scapy requests
```

## Run

```bash
# auto-detect your active WiFi interface
sudo python3 agent.py

# explicit interface (check yours with: networksetup -listallhardwareports)
sudo python3 agent.py --iface en0

# filter only HTTP/HTTPS traffic
sudo python3 agent.py --iface en0 --filter "tcp port 80 or tcp port 443"
```

## How it works

```
Your NIC  →  scapy sniff()  →  extract features  →  POST /api/v1/ingest
                                                          ↓
                                              FastAPI broadcasts via WebSocket
                                                          ↓
                                              Frontend dashboard live graphs
```

## Find your interface

```bash
networksetup -listallhardwareports
# Wi-Fi is usually en0
# Ethernet is usually en1 or en2
```

## Permissions note

Raw packet capture requires `sudo` on macOS. The agent never modifies or
injects traffic — read-only sniff only.
