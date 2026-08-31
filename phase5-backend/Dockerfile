FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies first (cached unless requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/    ./app/
COPY models/ ./models/

EXPOSE 8000

# ── CRITICAL: single worker ──────────────────────────────────────────────────
# The WebSocket ConnectionManager + recent-packet buffer are IN-MEMORY
# SINGLETONS per Python process.  With --workers > 1, an agent POST routed
# to worker A cannot broadcast to a browser WebSocket on worker B, which
# results in the "0 packets" symptom on the dashboard.
#
# For Render free-tier deployments (the current target) a single worker is
# sufficient and guarantees the in-memory broadcast reaches every WS client.
CMD [                                           \
  "uvicorn",  "app.main:app",                  \
  "--host",   "0.0.0.0",                       \
  "--port",   "8000",                          \
  "--workers", "1",                            \
  "--timeout-keep-alive", "75",                \
  "--proxy-headers",                           \
  "--forwarded-allow-ips", "*"                 \
]
