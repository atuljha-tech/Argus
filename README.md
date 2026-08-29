# Unified Cyber Defense Platform


### Phase 1: VPN Testbed Setup

#### Setup Commands

```bash
cd phase1-vpn-testbed/docker
docker compose build strongswan-server
docker compose up -d strongswan-server
docker exec strongswan-vpn-server ipsec statusall
