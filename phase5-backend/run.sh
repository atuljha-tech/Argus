#!/bin/bash
# Run the FastAPI server

cd "$(dirname "$0")"

# Install dependencies if needed
pip3 install -r requirements.txt > /dev/null 2>&1

# Run the server
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
