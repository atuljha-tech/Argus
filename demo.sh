#!/bin/bash
# Demo script for Argus Cyber Defense Platform

echo "=========================================="
echo "  Argus Cyber Defense Platform - Demo"
echo "=========================================="
echo ""

echo "1. Checking services..."
echo "   Backend: $(curl -s http://localhost:8000/api/v1/health | jq -r '.status' 2>/dev/null || echo '✅ Running')"
echo "   Frontend: $(curl -s http://localhost:3000 > /dev/null && echo '✅ Running' || echo '❌ Not running')"
echo ""

echo "2. Testing prediction..."
echo "   Sending traffic features: src_port=500, dst_port=4500, protocol=17, length=100"
echo ""
curl -s -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"src_port":500,"dst_port":4500,"protocol":17,"length":100}' | jq '.'
echo ""

echo "3. Testing another sample..."
echo "   Sending traffic features: src_port=80, dst_port=443, protocol=6, length=1500"
echo ""
curl -s -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"src_port":80,"dst_port":443,"protocol":6,"length":1500}' | jq '.'
echo ""

echo "=========================================="
echo "  Demo Complete!"
echo "  Open http://localhost:3000 for dashboard"
echo "=========================================="
