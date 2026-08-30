# Argus Cyber Defense Platform - Architecture Document

## 1. Overview

Argus is a unified cyber defense platform that combines VPN security assessment with AI-powered attack forecasting.

### Key Components
1. **VPN Traffic Analyzer** (Phase 1-2): Captures and parses IPsec VPN traffic
2. **Feature Engineering** (Phase 3): Converts raw data to ML-ready features
3. **ML Models** (Phase 4): Trains models for attack prediction
4. **Backend API** (Phase 5): REST API for predictions
5. **Frontend Dashboard** (Phase 6): User interface
6. **Docker Deployment** (Phase 7): Containerized deployment

## 2. System Architecture
┌─────────────────────────────────────────────────────────────┐
│ Frontend (Next.js) │
│ Port: 3000 │
└─────────────────────┬───────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ Backend API (FastAPI) │
│ Port: 8000 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ /api/v1/health - Health check │ │
│ │ /api/v1/predict - Prediction endpoint │ │
│ │ /api/v1/analyze - Analysis endpoint │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ ML Model (Phase 4) │
│ Decision Tree Classifier │
│ Accuracy: 60% │
└─────────────────────────────────────────────────────────────┘

text

## 3. Data Flow

1. **Input**: User provides traffic features (src_port, dst_port, protocol, length)
2. **Processing**: Features are scaled and passed to ML model
3. **Output**: Prediction (0=normal, 1=attack) + confidence + risk level
4. **Response**: JSON with prediction, recommendations, timestamp

## 4. Security Considerations

- CORS enabled for frontend communication
- Input validation on all endpoints
- Model loaded from secure pickle files
- All dependencies reviewed for vulnerabilities

## 5. Scalability

- Stateless API design
- Docker containerization for horizontal scaling
- Model can be updated without downtime
- Frontend can be served via CDN

## 6. Monitoring

- Health check endpoint for monitoring
- Logging for debugging
- Error handling throughout the stack
