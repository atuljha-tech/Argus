# 🛡️ Argus - Unified Cyber Defense Platform

An AI-powered security intelligence system combining VPN assessment and attack forecasting.

## 📋 Quick Links

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/argus.git
cd argus

# 2. Deploy all services
./deploy.sh

# 3. Run demo
./demo.sh
🏗️ Architecture
Phase	Component	Technology
1-2	VPN Analyzer	Rust, Docker
3-4	ML Models	Python, scikit-learn
5	Backend API	FastAPI
6	Frontend	Next.js, Tailwind
7	Deployment	Docker Compose
📊 Features
✅ IPsec VPN traffic analysis

✅ AI-based attack prediction

✅ Security scoring (0-100)

✅ Actionable recommendations

✅ Interactive dashboard

✅ Docker deployment

🔧 Tech Stack
Backend: FastAPI, Python

Frontend: Next.js, TypeScript, Tailwind

ML: scikit-learn, XGBoost

Infrastructure: Docker, Docker Compose

📈 ML Performance
Metric	Value
Best Model	Decision Tree
Accuracy	60%
Features	4
Training Samples	37
🌐 API Endpoints
Endpoint	Method	Description
/api/v1/health	GET	Health check
/api/v1/predict	POST	Get prediction
/api/v1/analyze	POST	Full analysis
📝 License
MIT