# Financial Oracles - Cheap Public Deployment Guide

## Option A: Cloudflare Tunnel (Recommended - $0/month)
**Best for**: Quick setup, free SSL, DDoS protection

### Prerequisites
- Cloudflare account (free)
- Domain (optional, can use *.cfargotunnel.com subdomain)

### Steps

1. **Install cloudflared**
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

2. **Authenticate**
```bash
cloudflared tunnel login
```

3. **Create tunnel**
```bash
cloudflared tunnel create financial-oracles
```

4. **Configure tunnel** (`~/.cloudflared/config.yml`)
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: oracles.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

5. **Route DNS** (if using custom domain)
```bash
cloudflared tunnel route dns financial-oracles oracles.yourdomain.com
```

6. **Run as service**
```bash
cloudflared service install
systemctl start cloudflared
systemctl enable cloudflared
```

### Cost: $0/month
- Free tier includes unlimited bandwidth
- Free SSL/TLS
- Free DDoS protection

---

## Option B: Caddy Reverse Proxy ($0 with existing VPS)
**Best for**: If you already have this VPS exposed

### Steps

1. **Install Caddy**
```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy
```

2. **Configure Caddy** (`/etc/caddy/Caddyfile`)
```
oracles.yourdomain.com {
    reverse_proxy localhost:3000
    
    # Rate limiting (optional)
    @ratelimited {
        path /sanctions/* /sec/* /perp/*
    }
    rate_limit @ratelimited {
        zone api_limit {
            key {remote_host}
            events 100
            window 1m
        }
    }
}
```

3. **Point DNS A record** to VPS IP

4. **Start Caddy**
```bash
systemctl enable caddy
systemctl start caddy
```

### Cost: $0 additional (uses existing VPS)
- Auto SSL via Let's Encrypt
- HTTP/2 & HTTP/3 support

---

## Option C: Fly.io (Low-cost scaling)
**Best for**: Auto-scaling, multi-region

### Steps

1. **Install flyctl**
```bash
curl -L https://fly.io/install.sh | sh
```

2. **Create `fly.toml`**
```toml
app = "financial-oracles"
primary_region = "fra"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

3. **Create Dockerfile**
```dockerfile
FROM oven/bun:1 as base

# Install Python
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv

WORKDIR /app
COPY . .

# Install dependencies
RUN bun install
RUN cd skills/sanctions-oracle && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
```

4. **Deploy**
```bash
fly launch
fly deploy
```

### Cost: ~$0-5/month
- Free tier: 3 shared VMs
- Scales to zero when idle
- Pay only for compute used

---

## Option D: Railway.app (Simplest)
**Best for**: Git push deploys, no config

### Steps

1. Push code to GitHub
2. Connect Railway to repo
3. Set environment variables
4. Deploy

### Cost: ~$5/month
- $5 credit/month on Hobby plan
- Simple GitHub integration

---

## Recommended: Cloudflare Tunnel

For this VPS, Cloudflare Tunnel is ideal because:
- **$0 cost** - completely free
- **No ports to open** - tunnel initiates outbound
- **Built-in security** - DDoS protection, bot filtering
- **Simple setup** - 10 minutes
- **Works with systemd** - just add cloudflared service

### Quick Install Script
```bash
#!/bin/bash
# Run after cloudflared login

DOMAIN="oracles.yourdomain.com"  # Change this

# Create tunnel
TUNNEL_ID=$(cloudflared tunnel create financial-oracles 2>&1 | grep -oP 'Created tunnel.*with id \K[a-f0-9-]+')

# Create config
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: /root/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $DOMAIN
    service: http://localhost:3000
  - service: http_status:404
EOF

# Route DNS (if using Cloudflare DNS)
cloudflared tunnel route dns financial-oracles $DOMAIN

# Install as service
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared

echo "Tunnel active at https://$DOMAIN"
```

---

## Post-Deployment Checklist

- [ ] Verify health: `curl https://yourdomain.com/health`
- [ ] Test x402: `curl https://yourdomain.com/sanctions/address -X POST -d '{"address":"0x123"}'`
- [ ] Register with xgate.run discovery
- [ ] Update agent card homepage URL
- [ ] Monitor with uptime service (e.g., UptimeRobot - free)
