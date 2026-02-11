#!/bin/bash
# Financial Oracles Gateway - Health Check Script
# Runs periodic checks and logs uptime metrics
# Usage: Add to cron or call from heartbeat

GATEWAY_URL="${GATEWAY_URL:-http://localhost:3000}"
LOG_FILE="${LOG_FILE:-/home/krump/clawd/data/uptime.log}"
STATUS_FILE="${STATUS_FILE:-/home/krump/clawd/data/uptime-status.json}"

# Ensure data dir exists
mkdir -p "$(dirname "$LOG_FILE")"

timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Check health endpoint
health_response=$(curl -s -o /tmp/health_body -w "%{http_code}|%{time_total}" "$GATEWAY_URL/health" 2>/dev/null)
http_code=$(echo "$health_response" | cut -d'|' -f1)
response_time=$(echo "$health_response" | cut -d'|' -f2)

# Check public endpoint (via Cloudflare)
public_response=$(curl -s -o /dev/null -w "%{http_code}|%{time_total}" "https://agents.krumpybot.com/health" 2>/dev/null)
public_code=$(echo "$public_response" | cut -d'|' -f1)
public_time=$(echo "$public_response" | cut -d'|' -f2)

# Check x402 response (should return 402)
x402_response=$(curl -s -o /dev/null -w "%{http_code}" "https://agents.krumpybot.com/stocks/quote/AAPL" 2>/dev/null)

# Check backend services
sec_ok=$(curl -s "$GATEWAY_URL/health" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('sec_oracle','unknown'))" 2>/dev/null || echo "error")
perp_ok=$(curl -s "$GATEWAY_URL/health" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('perp_dex','unknown'))" 2>/dev/null || echo "error")
sanctions_ok=$(curl -s "$GATEWAY_URL/health" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('sanctions_oracle','unknown'))" 2>/dev/null || echo "error")

# Determine overall status
if [[ "$http_code" == "200" && "$public_code" == "200" && "$x402_response" == "402" ]]; then
  status="healthy"
elif [[ "$http_code" == "200" ]]; then
  status="degraded"
else
  status="down"
fi

# Log entry
echo "$timestamp | status=$status | local=$http_code/${response_time}s | public=$public_code/${public_time}s | x402=$x402_response | sec=$sec_ok | perp=$perp_ok | sanctions=$sanctions_ok" >> "$LOG_FILE"

# Write status JSON
cat > "$STATUS_FILE" << EOF
{
  "status": "$status",
  "timestamp": "$timestamp",
  "local": { "code": $http_code, "responseMs": $(echo "$response_time * 1000" | bc 2>/dev/null || echo 0) },
  "public": { "code": $public_code, "responseMs": $(echo "$public_time * 1000" | bc 2>/dev/null || echo 0) },
  "x402": { "code": $x402_response },
  "backends": { "sec": "$sec_ok", "perp": "$perp_ok", "sanctions": "$sanctions_ok" }
}
EOF

# Output for cron/caller
echo "$status"
