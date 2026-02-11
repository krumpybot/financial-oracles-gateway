# Financial Oracles Gateway

A unified gateway for SEC filings and perpetual DEX data with x402 micropayments.

## Features

- **SEC Oracle**: Company profiles, XBRL financials, insider trading, 8-K events
- **Perp DEX Oracle**: Funding rates, open interest, arbitrage detection
- **Combined Analysis**: Earnings-arbitrage signals, insider sentiment
- **x402 Payments**: Micropayments via Base/USDC
- **ERC-8004 Identity**: Onchain agent registration

## Quick Start

```bash
# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start backends first
# SEC Oracle on :8001
# Perp DEX on :8000

# Start gateway
bun run start
```

## Endpoints

### Free (No Payment)

| Endpoint | Description |
|----------|-------------|
| `GET /` | Gateway info |
| `GET /health` | Health check |
| `GET /pricing` | Pricing info |
| `GET /.well-known/agent.json` | A2A/ERC-8004 agent card |

### Paid (x402)

| Endpoint | Price (USDC) | Description |
|----------|--------------|-------------|
| `GET /sec/company/:ticker` | $0.005 | Company profile |
| `GET /sec/financials/:ticker` | $0.020 | XBRL financials |
| `GET /sec/insiders/:ticker` | $0.030 | Insider trading |
| `GET /sec/events/:ticker` | $0.020 | 8-K events |
| `GET /sec/batch` | $0.050 | Batch query |
| `GET /perp/funding` | $0.005 | Funding rates |
| `GET /perp/openinterest` | $0.005 | Open interest |
| `GET /perp/arbitrage` | $0.010 | Arbitrage opportunities |
| `GET /analysis/earnings-arbitrage/:ticker` | $0.030 | Combined analysis |
| `GET /analysis/insider-signal/:ticker` | $0.030 | Insider sentiment |

## x402 Payment Flow

1. Request without payment → 402 response with payment details
2. Send USDC to receiver address on Base
3. Retry request with `X-Payment: <tx_hash>` header

```bash
# Without payment
curl http://localhost:3000/sec/company/AAPL
# Returns 402 with payment instructions

# With payment
curl -H "X-Payment: 0x..." http://localhost:3000/sec/company/AAPL
# Returns data
```

## Agent Card

Available at `/.well-known/agent.json`:

```json
{
  "name": "financial-oracles",
  "version": "1.0.0",
  "identity": {
    "registry": "0x8004...",
    "chainId": 8453
  },
  "x402": {
    "enabled": true,
    "network": "base",
    "receiver": "0x71A2...",
    "currency": "USDC"
  },
  "entrypoints": [...]
}
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Gateway port | 3000 |
| `SEC_ORACLE_URL` | SEC Oracle backend | http://localhost:8001 |
| `PERP_DEX_URL` | Perp DEX backend | http://localhost:8000 |
| `RECEIVER_ADDRESS` | Payment receiver | Required |
| `NETWORK` | Payment network | base |
| `CHAIN_ID` | ERC-8004 chain | 8453 |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Financial Oracles Gateway           │
│                    (Hono + x402)                    │
├─────────────────────────────────────────────────────┤
│  /.well-known/agent.json  │  ERC-8004 Identity     │
│  /health, /pricing        │  Free endpoints        │
│  /sec/*                   │  SEC Oracle proxy      │
│  /perp/*                  │  Perp DEX proxy        │
│  /analysis/*              │  Combined analysis     │
└───────────────┬───────────────────┬─────────────────┘
                │                   │
        ┌───────▼───────┐   ┌───────▼───────┐
        │  SEC Oracle   │   │   Perp DEX    │
        │    :8001      │   │    :8000      │
        └───────────────┘   └───────────────┘
```

## License

MIT
