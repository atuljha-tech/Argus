# ARGUS — Unified Cyber Defense Platform

> **Real-time network packet capture → ML threat classification → live WebSocket dashboard**

A full-stack security intelligence system that captures actual WiFi packets from any machine's NIC, classifies them with a trained Random Forest model, and streams results live to a Next.js dashboard — with AI-powered security analysis via Groq.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        YOUR MACHINE (NIC)                           │
│                                                                     │
│  WiFi en0/en1  ──►  scapy sniff()  ──►  FlowAggregator            │
│                         raw packets       (8s windows)             │
│                                              │                     │
│                          10 features per flow:                     │
│                          src_port, dst_port, protocol, length,     │
│                          packet_count, byte_count, duration,       │
│                          avg_packet_size, bytes_per_second,        │
│                          packets_per_second                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  POST /api/v1/ingest  (every 8s)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│               BACKEND  (FastAPI on Render)                          │
│                                                                     │
│  /ingest ──► ModelLoader.predict()                                 │
│                   │                                                 │
│              Random Forest (200 trees)                             │
│              trained on real captured traffic                      │
│                   │                                                 │
│         Post-processing sanity gate                                │
│         (overrides ML if features aren't actually anomalous)       │
│                   │                                                 │
│  prediction + confidence + attack_type + risk_level                │
│                   │                                                 │
│  ConnectionManager.broadcast() ──► all WebSocket clients          │
│                                                                     │
│  /ws  ──►  WebSocket endpoint (persistent, ping/pong keepalive)   │
│  /health, /predict, /analyze, /model-info  (REST endpoints)       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  wss://  WebSocket push
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│               FRONTEND  (Next.js 14 on Vercel)                      │
│                                                                     │
│  LiveStream.tsx                                                     │
│    ├─ WebSocket auto-connects on page load                         │
│    ├─ Scrolling packet log (time · src→dst · proto · size · label) │
│    ├─ Source Stats table (IP · packets · bytes · threat% · protos) │
│    └─ Summary cards (total pkts · bytes · unique IPs · threat rate)│
│                                                                     │
│  ThreatAnalytics.tsx  (4 live charts, Recharts)                    │
│    ├─ Graph 1: Packet Flow Stream (area chart, benign vs threat)   │
│    ├─ Graph 2: Attack Class Distribution (bar chart)               │
│    ├─ Graph 3: Protocol Breakdown (donut — TCP/UDP/ESP)            │
│    └─ Graph 4: Confidence & Latency (dual line chart)              │
│    └─ Insight panels beneath each graph (update every 60s)        │
│                                                                     │
│  SecurityScore.tsx                                                  │
│    └─ SVG ring gauge, driven by weighted threat rate               │
│       Fetches real model metadata from /model-info                 │
│                                                                     │
│  AISecurityAnalyst.tsx  (floating bottom-right)                    │
│    └─ Groq LLaMA/GPT-OSS streaming analysis of session stats      │
│       Sections: posture · threats · protocols · IPs · VPN · recs  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## How Ingoing/Outgoing Packets Are Captured and Understood

### What is a Packet?

Every time your Mac communicates over WiFi — loading a webpage, a background app syncing, DNS lookups, streaming video — your WiFi NIC (network interface card) sends and receives small units of data called **IP packets**. Each packet has a header containing:

- **Source IP** — who sent it (your machine or a remote server)
- **Destination IP** — who receives it
- **Protocol** — TCP (6) for reliable connections, UDP (17) for fast/lossy, ESP (50) for encrypted VPN tunnels
- **Source/Destination Port** — which service (port 443 = HTTPS, port 53 = DNS, port 22 = SSH, etc.)
- **Length** — how many bytes

### What ARGUS Does Step by Step

**Step 1 — Raw Capture** (`argus-agent/agent.py`)

`scapy` opens a raw socket on your NIC (`en0` for WiFi on macOS) and intercepts every IP packet passing through. This requires `sudo` because reading raw network frames is a privileged OS operation. The agent runs locally on your machine — it doesn't proxy or modify any traffic, only reads headers.

**Step 2 — Flow Aggregation** (`FlowAggregator`)

Individual packets are grouped into **flow windows** — 8-second buckets identified by the 5-tuple: `(src_ip, dst_ip, src_port, dst_port, protocol)`. Within each window, the agent computes:

- `packet_count` — how many packets in this flow
- `byte_count` — total bytes transferred
- `duration` — time span of the flow
- `avg_packet_size` — byte_count / packet_count
- `bytes_per_second` — throughput
- `packets_per_second` — rate

This converts millions of raw packets into meaningful **flow-level features** — the same representation used by professional network security tools like Zeek and Suricata.

**Step 3 — ML Inference** (FastAPI backend, `utils.py`)

The 10 flow features are fed to a **Random Forest classifier** (200 decision trees) trained on real captured traffic from the same system. The model outputs:

- `prediction`: 0 (benign) or 1 (threat)
- `confidence`: probability 0–1
- `attack_type`: benign / ddos / exfiltration / port_scan / vpn_exploit / suspicious

A **sanity gate** post-processes the ML output — if the model says "threat" but the actual feature values don't cross realistic anomaly thresholds (pps > 200 for DDoS, bps > 1 MB/s for exfiltration, etc.), it overrides to benign. This prevents a model trained on synthetic data from over-flagging normal home/office traffic.

**Step 4 — WebSocket Broadcast** (`ws_manager.py`)

Every classified flow is immediately pushed via WebSocket to all connected browser clients. No polling — pure push-based real-time streaming.

**Step 5 — Live Dashboard** (Next.js frontend)

The browser receives each flow result as a JSON message and:
- Appends it to the scrolling packet log
- Updates source IP statistics
- Feeds the 4 Recharts graphs
- Recalculates the security score (exponentially weighted threat rate)

**Step 6 — AI Analysis** (Groq API)

When you click "AI SECURITY ANALYSIS", the full session statistics (total flows, threat %, attack types, top source IPs, protocol mix, avg confidence) are sent to Groq's `openai/gpt-oss-20b` model which streams back a structured security report with 7 sections: posture score, threat analysis, protocol security, IP analysis, VPN assessment, recommendations, and a plain-English conclusion.

---

## Project Structure

```
unified-cyber-platform/
├── argus-agent/                  # Local packet capture agent (runs on your Mac)
│   ├── agent.py                  # scapy capture → flow aggregation → POST to backend
│   ├── capture_and_train.py      # Capture real traffic + train/save ML model
│   └── requirements.txt
│
├── phase1-vpn-testbed/           # Original Docker StrongSwan VPN testbed
│   ├── docker/                   # strongswan + client containers
│   └── capture/                  # pcap capture scripts
│
├── phase2-ipsec-parser/          # Rust IPsec packet parser
│   └── src/                      # parser.rs, crypto_analyzer.rs, types.rs
│
├── phase3-feature-engineering/   # Python feature extraction pipeline
│   └── src/                      # data_loader, feature_engineer, data_labeler
│
├── phase4-ml-model/              # ML model training (scikit-learn)
│   └── src/                      # model_trainer.py, data_loader.py
│
├── phase5-backend/               # FastAPI inference server
│   ├── app/
│   │   ├── main.py               # FastAPI app, CORS setup
│   │   ├── routes.py             # /health /predict /analyze /ingest /ws /model-info
│   │   ├── utils.py              # ModelLoader, predict(), sanity gate, attack labels
│   │   ├── ws_manager.py         # WebSocket ConnectionManager (broadcast to all clients)
│   │   └── models.py             # Pydantic request/response schemas
│   ├── models/                   # Trained .pkl files (baked into Docker image)
│   ├── Dockerfile
│   └── requirements.txt
│
└── phase6-frontend/              # Next.js 14 dashboard (deployed on Vercel)
    ├── app/
    │   ├── page.tsx              # Main page, state management, mode toggle
    │   └── components/
    │       ├── LiveStream.tsx    # WebSocket consumer, packet log, source stats
    │       ├── ThreatAnalytics.tsx # 4 live Recharts graphs + insight panels
    │       ├── SecurityScore.tsx # SVG gauge + real model metadata
    │       ├── AISecurityAnalyst.tsx # Groq streaming analysis drawer
    │       ├── Navbar.tsx        # Live clock + real model name from /model-info
    │       ├── ResultsDisplay.tsx # Last inference detail panel
    │       └── PredictionForm.tsx # Manual packet entry form
    ├── lib/api.ts                # axios client, API calls
    └── types/index.ts            # TypeScript interfaces
```

---

## ML Model Training

The model is trained on **your own real traffic** using `capture_and_train.py`:

```bash
sudo python3 argus-agent/capture_and_train.py --iface en0 --duration 120
```

This:
1. Captures 120 seconds of real packets from en0
2. Aggregates into flow windows with 10 features
3. Labels with smart heuristics (no synthetic data by default):
   - DDoS: `packets_per_second > 2× 90th percentile`
   - Exfiltration: `bytes_per_second > 2× 90th percentile AND avg_packet_size > 80th percentile`
   - Port scan: `packet_count > 90th percentile AND avg_packet_size < 100 bytes`
   - VPN exploit: IPsec ports (500/4500) with elevated rate
   - C2 beacon: trickle traffic on high ports during long-duration flows
4. Trains `RandomForestClassifier(n_estimators=200, class_weight='balanced')`
5. Saves `random_forest.pkl + scaler.pkl + model_meta.pkl + attack_labels.pkl` directly to `phase5-backend/models/`

Then commit and push the models to trigger a Render redeploy.

---

## Running the Agent

```bash
# Install dependencies (one-time)
pip install scapy requests

# Find your WiFi interface
networksetup -listallhardwareports  # macOS

# Start streaming (auto-detects interface)
sudo python3 argus-agent/agent.py

# Or explicitly
sudo python3 argus-agent/agent.py --iface en0

# Custom BPF filter (only HTTP/HTTPS)
sudo python3 argus-agent/agent.py --iface en0 --filter "tcp port 80 or tcp port 443"
```

The agent:
1. Wakes up the Render backend (sends a health ping, retries up to 6×)
2. Starts capturing all IP traffic on the interface
3. Every 8 seconds: aggregates flows, POSTs to `/api/v1/ingest`
4. Backend runs ML inference and broadcasts results via WebSocket
5. Dashboard updates automatically — no manual refresh needed

---

## Deployment

### Backend (Render)

- **Service type**: Web Service
- **Root directory**: `phase5-backend`
- **Build command**: `pip install -r requirements.txt`
- **Start command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **No environment variables needed**

After training a new model, commit the `.pkl` files and push — Render rebuilds automatically.

### Frontend (Vercel)

- **Root directory**: `phase6-frontend`
- **Framework**: Next.js
- **Environment variable**:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_API_URL` | `https://argus-backend-kbg6.onrender.com/api/v1` |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/health` | Backend + model status |
| `GET` | `api/v1/model-info` | Real model name, accuracy, features, training date |
| `POST` | `/api/v1/predict` | Single packet ML classification |
| `POST` | `/api/v1/analyze` | Full analysis with recommendations |
| `POST` | `/api/v1/ingest` | Batch ingest from argus-agent (10 flow features each) |
| `WS` | `/api/v1/ws` | WebSocket — frontend subscribes here for live results |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Packet capture | Python · scapy 2.7 |
| ML model | scikit-learn · RandomForestClassifier |
| Backend | Python · FastAPI · uvicorn · WebSockets |
| Frontend | Next.js 14 · TypeScript · Recharts · Tailwind CSS |
| AI analysis | Groq API · openai/gpt-oss-20b |
| Deployment | Render (backend) · Vercel (frontend) |
| VPN testbed | Docker · StrongSwan 5.9 |
| IPsec parser | Rust · nom |

---

## What the 4 Dashboard Graphs Show

**1. Packet Flow Stream** — Rolling area chart. Each point = one 8-second flow window. Green area = benign bytes, red area = threat bytes. X-axis scrolls with real timestamps. Updates on every new batch from the agent.

**2. Attack Class Distribution** — Bar chart. Cumulative count of each ML-classified attack type since session start. Bars only appear when the model actually detects something. Categories: Normal, DDoS, Port Scan, VPN Exploit.

**3. Protocol Breakdown** — Donut chart. Real proportion of TCP vs UDP vs ESP/Other flows. Only protocols with actual traffic appear. `protocol=0` (unknown/non-IP) is excluded. Updates with each new flow.

**4. Confidence & Latency** — Dual line chart. Green = ML model's confidence score per flow (from backend). Yellow dashed = actual API round-trip latency measured client-side. Both are real — no fake values.

---

## Security Note

The capture agent reads packet **headers only** — it does not intercept payload content. It captures: source/dest IPs, ports, protocol numbers, and packet sizes. No passwords, no browsing history, no encrypted content. Raw socket capture requires `sudo` because it bypasses the OS network stack's per-application filtering — this is standard for any network monitoring tool (Wireshark, tcpdump, etc.).
