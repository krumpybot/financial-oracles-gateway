# Financial Oracles Gateway

The most comprehensive x402-native financial data gateway. 69 endpoints across SEC filings, Treasury, Forex, Stocks, Crypto, Commodities, Technical Indicators, Analyst Ratings, News, Sanctions Screening, and more.

**Pay per call with USDC on Base. No API keys. No subscriptions.**

🌐 **Live**: [agents.krumpybot.com](https://agents.krumpybot.com)  
📖 **Docs**: [krumpybot.com](https://krumpybot.com)  
🔍 **Discovery**: `GET /.well-known/x402` | `GET /.well-known/agent.json`

## Quick Start

### 1. Test (free)
```bash
# Free demo endpoint - no payment needed
curl https://agents.krumpybot.com/demo/quote
```

### 2. See pricing
```bash
# Any endpoint without X-Payment returns 402 with pricing
curl https://agents.krumpybot.com/stocks/quote/AAPL
# Returns: { x402Version: 1, accepts: [{ maxAmountRequired: "5000", ... }] }
```

### 3. Pay & get data
```bash
# After paying via x402 (USDC on Base), include tx hash
curl -H "X-Payment: 0x<tx_hash>" https://agents.krumpybot.com/stocks/quote/AAPL
```

## Endpoints (69)

### 🆓 Free
| Endpoint | Description |
|----------|-------------|
| `GET /demo/quote` | Free AAPL stock quote (test x402 flow) |
| `GET /health` | Gateway + backend health status |
| `GET /pricing` | All endpoint prices |
| `GET /stats` | Uptime, cache, endpoint count |

### 📦 Bundles (task-oriented, recommended)
| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /bundle/market_snapshot/:symbol` | $0.02 | Quote + analyst ratings + news |
| `POST /bundle/sanctions_screen` | $0.02 | Name + address + country screening |
| `GET /bundle/sec_snapshot/:ticker` | $0.04 | Company + financials + insiders + events |

### 📈 Stocks ($0.005-0.01)
`GET /stocks/quote/:symbol` · `GET /stocks/historical/:symbol` · `GET /stocks/indices`

### 🪙 Crypto ($0.002-0.005)
`GET /crypto/prices` · `GET /crypto/markets` · `GET /crypto/historical`

### 💱 Forex ($0.002-0.005)
`GET /forex/rates` · `GET /forex/convert` · `GET /forex/historical`

### 📊 SEC Filings ($0.005-0.05)
`GET /sec/company/:ticker` · `GET /sec/financials/:ticker` · `GET /sec/insiders/:ticker` · `GET /sec/events/:ticker` · `GET /sec/batch` · `GET /sec/13f/:cik`

### 🛡️ Sanctions ($0.005-0.05)
`POST /sanctions/address` · `POST /sanctions/name` · `POST /sanctions/batch` · `GET /sanctions/country/:code`

### 📉 Perp DEX ($0.005-0.01)
`GET /perp/funding` · `GET /perp/openinterest` · `GET /perp/arbitrage`

### 🏛️ Treasury ($0.002-0.01)
`GET /treasury/debt` · `GET /treasury/spending` · `GET /treasury/revenue` · `GET /treasury/auctions` · `GET /treasury/dashboard`

### 📈 FRED Economics ($0.003-0.01)
`GET /fred/series/:id` · `GET /fred/indicators` · `GET /fred/dashboard` · `GET /fred/search`

### 🏦 Bank Health ($0.005-0.03)
`GET /banks/search` · `GET /banks/institution/:cert` · `GET /banks/financials/:cert` · `GET /banks/health/:cert` · `GET /banks/failures` · `GET /banks/at-risk`

### 🔮 Prediction Markets ($0.005-0.02)
`GET /prediction/markets` · `GET /prediction/prices/:id` · `GET /prediction/arbitrage` · `GET /prediction/event/:id`

### 📐 Technical Indicators ($0.003-0.01)
`GET /indicators/sma/:symbol` · `GET /indicators/ema/:symbol` · `GET /indicators/rsi/:symbol` · `GET /indicators/macd/:symbol` · `GET /indicators/bbands/:symbol` · `GET /indicators/batch/:symbol`

### 🏢 Fundamentals ($0.01-0.02)
`GET /fundamentals/profile/:symbol` · `GET /fundamentals/ratios/:symbol` · `GET /fundamentals/metrics/:symbol`

### 📰 News & Analyst ($0.005-0.01)
`GET /news/market` · `GET /news/company/:symbol` · `GET /analyst/ratings/:symbol` · `GET /analyst/targets/:symbol`

### 📅 Calendars ($0.005)
`GET /calendar/earnings` · `GET /calendar/dividends` · `GET /calendar/ipo` · `GET /calendar/economic`

### 🏭 Commodities ($0.005)
`GET /commodities/prices` · `GET /commodities/metals`

### 📊 BLS Labor ($0.005)
`GET /bls/employment` · `GET /bls/cpi` · `GET /bls/series/:id`

### 🔬 Analysis ($0.02-0.03)
`GET /analysis/earnings-arbitrage/:ticker` · `GET /analysis/insider-signal/:ticker` · `GET /analysis/wallet-compliance/:address`

## MCP Server

An auto-generated MCP (Model Context Protocol) server is included for AI agent tool discovery:

```bash
cd mcp-server
npm install && npm run build
npm start  # stdio transport
```

## x402 Discovery

This gateway implements the x402 discovery standard:

- **Well-Known URL**: `GET /.well-known/x402` — lists all 69 endpoints
- **Agent Card**: `GET /.well-known/agent.json` — ERC-8004 compatible agent manifest
- **Per-Endpoint Manifests**: `GET /.well-known/x402/<endpoint>.json`

## Tech Stack

- **Runtime**: [Bun](https://bun.sh) + [Hono](https://hono.dev)
- **Payments**: [Lucid Agents SDK](https://github.com/daydreamsai/lucid-agents) (x402 + ERC-8004)
- **Network**: Base (USDC)
- **Identity**: ERC-8004 (Agent ID: 22821)

## Development

```bash
bun install
cp .env.example .env  # configure API keys
bun run dev           # hot-reload
bun run build         # production build
```

## License

Proprietary — [KrumpyBot](https://krumpybot.com)
