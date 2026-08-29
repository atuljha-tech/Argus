# Use official strongSwan Alpine image
FROM alpine:3.19

# Install strongSwan and needed packages
RUN apk add --no-cache \
    strongswan \
    iptables \
    iproute2 \
    iperf3 \
    curl \
    && rm -rf /var/cache/apk/*

# Create directory for configuration
WORKDIR /etc/strongswan

# Copy configuration files
COPY ipsec.conf /etc/strongswan/ipsec.conf
COPY ipsec.secrets /etc/strongswan/ipsec.secrets
COPY strongswan.conf /etc/strongswan/strongswan.conf

# Expose VPN ports
EXPOSE 500/udp 4500/udp

# Start StrongSwan
CMD ["/usr/sbin/ipsec", "start", "--nofork"]