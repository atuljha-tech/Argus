#!/bin/bash
# Unified Cyber Defense Platform - Deployment Script

echo "=========================================="
echo "  Argus Cyber Defense Platform"
echo "  Deployment Script"
echo "=========================================="

# Step 1: Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker."
    exit 1
fi

echo "✅ Docker found"

# Step 2: Build and start services
echo ""
echo "📦 Building and starting services..."
docker compose build
docker compose up -d

# Step 3: Wait for services
echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Step 4: Check services
echo ""
echo "🔍 Checking services..."
curl -s http://localhost:8000/api/v1/health | head -20
echo ""

# Step 5: Show status
echo ""
echo "=========================================="
echo "  ✅ Deployment Complete!"
echo "=========================================="
echo "🌐 Frontend: http://localhost:3000"
echo "🔗 Backend API: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "To stop all services: docker compose down"
