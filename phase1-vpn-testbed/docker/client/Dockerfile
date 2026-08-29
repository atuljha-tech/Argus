FROM ubuntu:22.04

# Install tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    iputils-ping \
    curl \
    iperf3 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from the same directory
COPY requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir -r /tmp/requirements.txt 2>/dev/null || true

WORKDIR /app
