/**
 * Financial Oracles Gateway
 * Hono-based gateway for Perp DEX + SEC Oracle + Sanctions + Prediction Markets + FDIC + FRED
 * 
 * Features:
 * - Unified API for all oracles
 * - x402 payment handling
 * - ERC-8004 identity metadata
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { html } from 'hono/html';

// Configuration
const CONFIG = {
  name: 'Financial Oracles Gateway',
  version: '1.5.0',  // Competitive pricing + Technical Indicators, Analyst Ratings, News
  description: 'The most comprehensive x402-native financial data gateway: SEC filings, Treasury, Forex, Stocks, Crypto, Commodities, Technical Indicators, Analyst Ratings, News, Sanctions Screening, and more',
  
  // Backend services
  perpDexUrl: process.env.PERP_DEX_URL || 'http://localhost:8000',
  secOracleUrl: process.env.SEC_ORACLE_URL || 'http://localhost:8001',
  sanctionsUrl: process.env.SANCTIONS_URL || 'http://localhost:8002',
  
  // External APIs - Existing
  polymarketUrl: 'https://gamma-api.polymarket.com',
  kalshiUrl: 'https://api.elections.kalshi.com/v1',
  fdicUrl: 'https://api.fdic.gov/banks',
  fredUrl: 'https://api.stlouisfed.org/fred',
  fredApiKey: process.env.FRED_API_KEY || '',
  
  // External APIs - NEW (100% Free, no API key)
  treasuryUrl: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service',
  forexUrl: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1',
  coingeckoUrl: 'https://api.coingecko.com/api/v3',
  secEdgarUrl: 'https://data.sec.gov',
  
  // External APIs - NEW (Need API keys)
  finnhubApiKey: process.env.FINNHUB_API_KEY || '',
  finnhubUrl: 'https://finnhub.io/api/v1',
  alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY || '',
  alphaVantageUrl: 'https://www.alphavantage.co/query',
  blsApiKey: process.env.BLS_API_KEY || '',  // Optional - works without key at lower rate
  blsUrl: 'https://api.bls.gov/publicAPI/v2',
  fmpApiKey: process.env.FMP_API_KEY || '',
  fmpUrl: 'https://financialmodelingprep.com/stable',
  goldApiKey: process.env.GOLDAPI_API_KEY || '',
  goldApiUrl: 'https://www.goldapi.io/api',
  
  // Payment config
  receiverAddress: process.env.RECEIVER_ADDRESS || '0x71A2CED2074F418f4e68a0A196FF3C1e59Beb32E',
  network: process.env.NETWORK || 'base',
  
  // ERC-8004 identity
  identityRegistry: process.env.IDENTITY_REGISTRY || '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
  chainId: parseInt(process.env.CHAIN_ID || '8453'), // Base mainnet
};

// Pricing in USDC (6 decimals) - v1.5.0 Competitive Pricing
const PRICING = {
  // SEC Oracle endpoints (UNIQUE VALUE - maintain pricing)
  'sec/company': 0.005,
  'sec/financials': 0.02,
  'sec/insiders': 0.03,
  'sec/events': 0.02,
  'sec/batch': 0.05,
  'sec/13f': 0.02,
  
  // Perp DEX endpoints (UNIQUE VALUE)
  'perp/funding': 0.005,
  'perp/openinterest': 0.005,
  'perp/arbitrage': 0.01,
  
  // Sanctions endpoints (UNIQUE VALUE - maintain pricing)
  'sanctions/address': 0.01,
  'sanctions/name': 0.01,
  'sanctions/batch': 0.05,
  'sanctions/country': 0.005,
  
  // Analysis endpoints (COMPUTED VALUE)
  'analysis/earnings-arbitrage': 0.03,
  'analysis/insider-signal': 0.03,
  'analysis/wallet-compliance': 0.02,
  
  // Prediction Market endpoints
  'prediction/markets': 0.005,
  'prediction/prices': 0.005,
  'prediction/arbitrage': 0.02,
  'prediction/event': 0.01,
  
  // Bank Health endpoints (UNIQUE VALUE)
  'banks/search': 0.005,
  'banks/institution': 0.01,
  'banks/financials': 0.02,
  'banks/health': 0.02,
  'banks/failures': 0.005,
  'banks/at-risk': 0.03,
  
  // FRED Economic Indicators (REDUCED - free upstream)
  'fred/series': 0.003,
  'fred/indicators': 0.005,
  'fred/dashboard': 0.01,
  'fred/search': 0.003,
  
  // US Treasury Fiscal Data (REDUCED - 100% free upstream)
  'treasury/debt': 0.002,
  'treasury/spending': 0.002,
  'treasury/revenue': 0.002,
  'treasury/auctions': 0.005,
  'treasury/dashboard': 0.01,
  
  // Forex/Currency Exchange (REDUCED - 100% free upstream)
  'forex/rates': 0.002,
  'forex/convert': 0.002,
  'forex/historical': 0.005,
  
  // Crypto Prices (REDUCED - CoinGecko free)
  'crypto/prices': 0.002,
  'crypto/markets': 0.002,
  'crypto/historical': 0.005,
  
  // Stock Prices (REDUCED to drive volume)
  'stocks/quote': 0.005,
  'stocks/historical': 0.01,
  'stocks/indices': 0.005,
  
  // BLS Employment/CPI Data (REDUCED - free upstream)
  'bls/employment': 0.005,
  'bls/cpi': 0.005,
  'bls/series': 0.005,
  
  // Commodities (REDUCED to drive volume)
  'commodities/prices': 0.005,
  'commodities/metals': 0.005,
  
  // Company Fundamentals (maintain - value-add)
  'fundamentals/profile': 0.01,
  'fundamentals/ratios': 0.02,
  'fundamentals/metrics': 0.02,
  
  // Calendars (REDUCED)
  'calendar/earnings': 0.005,
  'calendar/dividends': 0.005,
  'calendar/ipo': 0.005,
  'calendar/economic': 0.005,
  
  // NEW: Technical Indicators (computed from price data)
  'indicators/sma': 0.003,
  'indicators/ema': 0.003,
  'indicators/rsi': 0.003,
  'indicators/macd': 0.005,
  'indicators/bbands': 0.005,
  'indicators/batch': 0.01,
  
  // NEW: Analyst Ratings
  'analyst/ratings': 0.01,
  'analyst/targets': 0.01,
  
  // NEW: News Headlines
  'news/market': 0.005,
  'news/company': 0.005,

  // BUNDLE: Task-oriented multi-source responses
  'bundle/market_snapshot': 0.02,
  'bundle/sanctions_screen': 0.02,
  'bundle/sec_snapshot': 0.04,
};

const app = new Hono();

// =============================================================================
// HARDENING: Simple in-memory cache
// =============================================================================
interface CacheEntry {
  data: any;
  expiry: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = {
  short: 60 * 1000,        // 1 minute (for real-time data)
  medium: 5 * 60 * 1000,   // 5 minutes (for semi-static data)
  long: 30 * 60 * 1000,    // 30 minutes (for static data)
};

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any, ttl: number): void {
  // Limit cache size to prevent memory issues
  if (cache.size > 1000) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, expiry: Date.now() + ttl });
}

// =============================================================================
// HARDENING: Request timeout wrapper
// =============================================================================
const DEFAULT_TIMEOUT = 15000; // 15 seconds

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = DEFAULT_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// Middleware
// =============================================================================
app.use('*', cors());
app.use('*', logger());

// Security headers
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Request-Id', crypto.randomUUID().slice(0, 8));
});

// Global error handler
app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);
  
  if (err.name === 'AbortError') {
    return c.json({ error: 'Request timeout', message: 'External service took too long to respond' }, 504);
  }
  
  return c.json({ 
    error: 'Internal server error', 
    message: err.message,
    requestId: c.res.headers.get('X-Request-Id'),
  }, 500);
});

// =============================================================================
// Helper to proxy requests (with timeout)
// =============================================================================
async function proxyRequest(baseUrl: string, path: string, headers?: Record<string, string>): Promise<any> {
  const url = `${baseUrl}${path}`;
  const response = await fetchWithTimeout(url, { headers }, DEFAULT_TIMEOUT);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Backend error: ${response.status} - ${error}`);
  }
  return response.json();
}

// Perp DEX API key for internal calls
const PERP_DEX_API_KEY = process.env.PERP_DEX_API_KEY || 'gateway-internal-key';

// Endpoint display names for xgate.run discovery
const ENDPOINT_NAMES: Record<string, string> = {
  'sec/company': 'SEC Company Profile',
  'sec/financials': 'SEC XBRL Financials',
  'sec/insiders': 'SEC Insider Trading',
  'sec/events': 'SEC 8-K Events',
  'sec/batch': 'SEC Batch Query',
  'sec/13f': 'SEC 13F Holdings',
  'perp/funding': 'Perp Funding Rates',
  'perp/openinterest': 'Perp Open Interest',
  'perp/arbitrage': 'Perp Arbitrage Scanner',
  'sanctions/address': 'OFAC Address Screen',
  'sanctions/name': 'OFAC Name Screen',
  'sanctions/batch': 'OFAC Batch Screen',
  'sanctions/country': 'Sanctions by Country',
  'analysis/earnings-arbitrage': 'Earnings Arbitrage',
  'analysis/insider-signal': 'Insider Signal',
  'analysis/wallet-compliance': 'Wallet Compliance',
  'prediction/markets': 'Prediction Markets',
  'prediction/prices': 'Prediction Prices',
  'prediction/arbitrage': 'Prediction Arbitrage',
  'prediction/event': 'Prediction Event',
  'banks/search': 'FDIC Bank Search',
  'banks/institution': 'Bank Details',
  'banks/financials': 'Bank Financials',
  'banks/health': 'Bank Health Score',
  'banks/failures': 'Bank Failures',
  'banks/at-risk': 'At-Risk Banks',
  'fred/series': 'FRED Data Series',
  'fred/indicators': 'Economic Indicators',
  'fred/dashboard': 'FRED Dashboard',
  'fred/search': 'FRED Search',
  'treasury/debt': 'US National Debt',
  'treasury/spending': 'Federal Spending',
  'treasury/revenue': 'Federal Revenue',
  'treasury/auctions': 'Treasury Auctions',
  'treasury/dashboard': 'Treasury Dashboard',
  'forex/rates': 'Forex Rates',
  'forex/convert': 'Currency Convert',
  'forex/historical': 'Forex Historical',
  'crypto/prices': 'Crypto Prices',
  'crypto/markets': 'Crypto Markets',
  'crypto/historical': 'Crypto Historical',
  'stocks/quote': 'Stock Quote',
  'stocks/historical': 'Stock Historical',
  'stocks/indices': 'Market Indices',
  'bls/employment': 'BLS Employment',
  'bls/cpi': 'Consumer Price Index',
  'bls/series': 'BLS Data Series',
  'commodities/prices': 'Commodity Prices',
  'commodities/metals': 'Precious Metals',
  'fundamentals/profile': 'Company Profile',
  'fundamentals/ratios': 'Financial Ratios',
  'fundamentals/metrics': 'Key Metrics',
  'calendar/earnings': 'Earnings Calendar',
  'calendar/dividends': 'Dividends Calendar',
  'calendar/ipo': 'IPO Calendar',
  'calendar/economic': 'Economic Calendar',
  'indicators/sma': 'SMA Indicator',
  'indicators/ema': 'EMA Indicator',
  'indicators/rsi': 'RSI Indicator',
  'indicators/macd': 'MACD Indicator',
  'indicators/bbands': 'Bollinger Bands',
  'indicators/batch': 'Technical Batch',
  'analyst/ratings': 'Analyst Ratings',
  'analyst/targets': 'Price Targets',
  'news/market': 'Market News',
  'news/company': 'Company News',

  // Bundles
  'bundle/market_snapshot': 'Market Snapshot Bundle',
  'bundle/sanctions_screen': 'Sanctions Screen Bundle',
  'bundle/sec_snapshot': 'SEC Company Snapshot',
};

// Generic x402 payment middleware factory - returns proper x402 manifest for discovery
function createPaymentMiddleware(pathPrefix: string) {
  return async (c: any, next: any) => {
    const payment = c.req.header('X-Payment');
    const pathParts = c.req.path.split('/');
    const endpointKey = pathParts.length >= 3 ? `${pathPrefix}/${pathParts[2]}` : '';
    const price = PRICING[endpointKey as keyof typeof PRICING];
    
    if (price && !payment) {
      // Return full x402 manifest for xgate.run discovery
      const priceInWei = Math.round(price * 1_000_000);
      const endpointUrl = `${PUBLIC_URL}/${endpointKey}`;
      const displayName = ENDPOINT_NAMES[endpointKey] || endpointKey;
      
      return c.json({
        x402Version: 1,
        error: 'X-PAYMENT header is required',
        accepts: [{
          scheme: 'exact',
          network: 'base',
          maxAmountRequired: priceInWei.toString(),
          resource: endpointUrl,
          description: `${displayName} - ${getEndpointDescription(endpointKey)}`,
          mimeType: 'application/json',
          payTo: CONFIG.receiverAddress,
          maxTimeoutSeconds: 300,
          asset: BASE_USDC,
          outputSchema: {
            input: {
              type: 'http',
              method: endpointKey.includes('sanctions') && !endpointKey.includes('country') ? 'POST' : 'GET',
              discoverable: true,
            },
          },
          extra: {
            name: 'USD Coin',
            version: '2',
          },
        }],
        metadata: {
          gateway: PUBLIC_URL,
          name: displayName,
          category: pathPrefix,
        },
      }, 402);
    }
    
    await next();
  };
}

// Apply payment middleware to all paid endpoints
app.use('/sec/*', createPaymentMiddleware('sec'));
app.use('/perp/*', createPaymentMiddleware('perp'));
app.use('/analysis/*', createPaymentMiddleware('analysis'));
app.use('/sanctions/*', createPaymentMiddleware('sanctions'));
app.use('/prediction/*', createPaymentMiddleware('prediction'));
app.use('/banks/*', createPaymentMiddleware('banks'));
app.use('/fred/*', createPaymentMiddleware('fred'));
// NEW endpoints
app.use('/treasury/*', createPaymentMiddleware('treasury'));
app.use('/forex/*', createPaymentMiddleware('forex'));
app.use('/crypto/*', createPaymentMiddleware('crypto'));
app.use('/stocks/*', createPaymentMiddleware('stocks'));
app.use('/bls/*', createPaymentMiddleware('bls'));
app.use('/commodities/*', createPaymentMiddleware('commodities'));
app.use('/fundamentals/*', createPaymentMiddleware('fundamentals'));
app.use('/calendar/*', createPaymentMiddleware('calendar'));
// v1.5.0 additions
app.use('/indicators/*', createPaymentMiddleware('indicators'));
app.use('/analyst/*', createPaymentMiddleware('analyst'));
app.use('/news/*', createPaymentMiddleware('news'));

// =============================================================================
// Agent Card (ERC-8004 / A2A compatible)
// =============================================================================

// Base USDC contract address
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://agents.krumpybot.com';

// Generate x402 manifest for a specific endpoint
function generateAcceptEntry(endpointKey: string, price: number) {
  const priceInWei = Math.round(price * 1_000_000);
  return {
    asset: BASE_USDC,
    description: getEndpointDescription(endpointKey),
    extra: {
      name: 'USD Coin',
      version: '2',
    },
    maxAmountRequired: priceInWei.toString(),
    maxTimeoutSeconds: 300,
    mimeType: 'application/json',
    network: 'base',
    outputSchema: {
      input: {
        discoverable: true,
        method: endpointKey.includes('sanctions') && !endpointKey.includes('country') ? 'POST' : 'GET',
        type: 'http',
      },
      output: {
        type: 'json',
      },
    },
    payTo: CONFIG.receiverAddress,
    resource: `${PUBLIC_URL}/${endpointKey.replace('/', '/')}`,
    scheme: 'exact',
  };
}

// x402 Discovery Document (for x402scan auto-discovery)
app.get('/.well-known/x402', (c) => {
  // Generate list of all x402-enabled resource URLs
  const resources = Object.keys(PRICING).map(key => `${PUBLIC_URL}/${key}`);
  
  return c.json({
    version: 1,
    resources,
    ownershipProofs: [
      '0x9ae15b17d491cfb2775f07f6f43ec4a44f15a14e67594903719d98771c9da51010bfb030b2c62ea3de973bfaa1ecdf622f898561da2f04b727ea88025723a50a1c'
    ],
    manifest: `${PUBLIC_URL}/.well-known/x402-manifest.json`,
    instructions: `# Financial Oracles Gateway\n\n${CONFIG.description}\n\n## Quick Start\n\n1. Send a GET request to any endpoint without X-Payment header to see pricing\n2. Pay with USDC on Base network\n3. Include the tx hash in X-Payment header\n\n## Free Demo\n\nTest without payment: \`GET ${PUBLIC_URL}/demo/quote\`\n\n## Bundles (recommended)\n\n- Market Snapshot: \`GET /bundle/market_snapshot/{symbol}\` ($0.02)\n- Sanctions Screen: \`POST /bundle/sanctions_screen\` ($0.02)\n- SEC Snapshot: \`GET /bundle/sec_snapshot/{ticker}\` ($0.04)\n\n## Documentation\n\n- Pricing: ${PUBLIC_URL}/pricing\n- Agent Card: ${PUBLIC_URL}/.well-known/agent.json\n- Website: https://krumpybot.com\n- OpenAPI: ${PUBLIC_URL}/openapi.yaml`,
    metadata: {
      name: CONFIG.name,
      description: CONFIG.description,
      version: CONFIG.version,
      endpoints: resources.length,
      network: CONFIG.network,
      payTo: CONFIG.receiverAddress,
    }
  });
});

// Main x402 manifest
app.get('/.well-known/x402-manifest.json', (c) => {
  const accepts = Object.entries(PRICING).map(([key, price]) => 
    generateAcceptEntry(key, price)
  );
  
  return c.json({
    accepts,
    lastUpdated: new Date().toISOString(),
    metadata: {
      name: CONFIG.name,
      description: CONFIG.description,
      version: CONFIG.version,
      identity: {
        registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
        chainId: 1,
        agentId: 22821,
      },
    },
    resource: PUBLIC_URL,
    type: 'http',
    x402Version: 2,
  });
});

// Individual endpoint manifests
Object.entries(PRICING).forEach(([endpointKey, price]) => {
  const manifestPath = `/.well-known/x402/${endpointKey}.json`;
  app.get(manifestPath, (c) => {
    return c.json({
      accepts: [generateAcceptEntry(endpointKey, price)],
      lastUpdated: new Date().toISOString(),
      resource: `${PUBLIC_URL}/${endpointKey}`,
      type: 'http',
      x402Version: 2,
    });
  });
});

// ERC-8004 Registration File
app.get('/.well-known/agent-registration.json', (c) => {
  return c.json({
    "@context": "https://www.w3.org/ns/did/v1",
    "id": `did:erc8004:1:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:22821`,
    "name": "Financial Oracles Gateway",
    "description": CONFIG.description,
    "image": "https://openclaw.ai/oracles-logo.png",
    "agentId": 22821,
    "chainId": 1,
    "registry": "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    "sepoliaAgentId": 7519,
    "sepoliaRegistry": "0x8004a6090cd10a7288092483047b097295fb8847",
    "services": [
      {
        "id": "a2a",
        "type": "a2a", 
        "serviceEndpoint": `${PUBLIC_URL}/.well-known/agent.json`
      },
      {
        "id": "x402",
        "type": "x402",
        "serviceEndpoint": `${PUBLIC_URL}/`
      }
    ],
    "x402": {
      "enabled": true,
      "network": CONFIG.network,
      "receiver": CONFIG.receiverAddress,
      "currency": "USDC"
    },
    "capabilities": [
      "sec_filings",
      "xbrl_financials",
      "insider_trading",
      "sanctions_screening",
      "funding_rates",
      "arbitrage_detection",
      "prediction_markets",
      "bank_health_monitoring",
      "economic_indicators"
    ]
  });
});

// Sepolia-specific registration
app.get('/.well-known/agent-registration-sepolia.json', (c) => {
  return c.json({
    "@context": "https://www.w3.org/ns/did/v1",
    "id": `did:erc8004:11155111:0x8004a6090cd10a7288092483047b097295fb8847:7520`,
    "name": "Financial Oracles Gateway (Sepolia)",
    "description": CONFIG.description,
    "image": "https://openclaw.ai/oracles-logo.png",
    "agentId": 7520,
    "chainId": 11155111,
    "registry": "0x8004a6090cd10a7288092483047b097295fb8847",
    "services": [
      {
        "id": "a2a",
        "type": "a2a", 
        "serviceEndpoint": `${PUBLIC_URL}/.well-known/agent.json`
      },
      {
        "id": "x402",
        "type": "x402",
        "serviceEndpoint": `${PUBLIC_URL}/`
      }
    ],
    "x402": {
      "enabled": true,
      "network": CONFIG.network,
      "receiver": CONFIG.receiverAddress,
      "currency": "USDC"
    },
    "capabilities": [
      "sec_filings",
      "xbrl_financials",
      "insider_trading",
      "sanctions_screening",
      "funding_rates",
      "arbitrage_detection",
      "prediction_markets",
      "bank_health_monitoring",
      "economic_indicators"
    ]
  });
});

app.get('/.well-known/agent.json', (c) => {
  return c.json({
    name: CONFIG.name,
    version: CONFIG.version,
    description: CONFIG.description,
    homepage: 'https://openclaw.ai/oracles',
    
    identity: {
      registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
      chainId: 1,
      agentId: 22821,
      sepoliaRegistry: "0x8004a6090cd10a7288092483047b097295fb8847",
      sepoliaAgentId: 7520,
    },
    
    x402: {
      enabled: true,
      network: CONFIG.network,
      receiver: CONFIG.receiverAddress,
      currency: 'USDC',
    },
    
    entrypoints: Object.entries(PRICING).map(([key, price]) => ({
      key,
      price,
      description: getEndpointDescription(key),
    })),
    
    capabilities: [
      'sec_filings',
      'xbrl_financials',
      'insider_trading',
      '8k_events',
      'funding_rates',
      'open_interest',
      'arbitrage_detection',
      'sanctions_screening',
      'crypto_address_screening',
      'compliance_check',
      'prediction_markets',
      'polymarket',
      'kalshi',
      'prediction_arbitrage',
      'bank_health',
      'fdic_data',
      'bank_failures',
      'economic_indicators',
      'fred_data',
      'gdp',
      'inflation',
      'unemployment',
    ],
  });
});

function getEndpointDescription(key: string): string {
  const descriptions: Record<string, string> = {
    // SEC
    'sec/company': 'Get company profile from SEC EDGAR',
    'sec/financials': 'Get XBRL financial metrics with computed ratios',
    'sec/insiders': 'Get Form 4 insider trading with sentiment analysis',
    'sec/events': 'Get 8-K material events with classification',
    'sec/batch': 'Batch query multiple tickers',
    // Perp
    'perp/funding': 'Get cross-exchange funding rates',
    'perp/openinterest': 'Get open interest across exchanges',
    'perp/arbitrage': 'Get funding rate arbitrage opportunities',
    // Sanctions
    'sanctions/address': 'Screen crypto address against OFAC sanctions list',
    'sanctions/name': 'Screen entity name against sanctions databases',
    'sanctions/batch': 'Batch screen multiple addresses or names',
    'sanctions/country': 'Get sanctioned entities by country code',
    // Analysis
    'analysis/earnings-arbitrage': 'Analyze 8-K events for funding rate arbitrage',
    'analysis/insider-signal': 'Get insider sentiment for perp positions',
    'analysis/wallet-compliance': 'Check wallet address for sanctions compliance',
    // Prediction Markets
    'prediction/markets': 'List active prediction markets (Polymarket + Kalshi)',
    'prediction/prices': 'Get current market prices and odds',
    'prediction/arbitrage': 'Find cross-platform arbitrage opportunities',
    'prediction/event': 'Get detailed event/market info',
    // Banks
    'banks/search': 'Search FDIC-insured institutions',
    'banks/institution': 'Get bank details by FDIC certificate',
    'banks/financials': 'Get bank financial metrics (call reports)',
    'banks/health': 'Computed bank health score and risk indicators',
    'banks/failures': 'Recent bank failures and causes',
    'banks/at-risk': 'Banks showing stress signals',
    // FRED
    'fred/series': 'Get FRED economic series data',
    'fred/indicators': 'Key economic indicators summary',
    'fred/dashboard': 'Economic dashboard with multiple indicators',
    'fred/search': 'Search FRED series database',
    // Treasury (NEW - 100% Free)
    'treasury/debt': 'US national debt levels and trends',
    'treasury/spending': 'Federal spending by category',
    'treasury/revenue': 'Federal revenue collections',
    'treasury/auctions': 'Treasury auction results and schedules',
    'treasury/dashboard': 'Fiscal health dashboard',
    // Forex (NEW - 100% Free)
    'forex/rates': 'Current exchange rates for 200+ currencies',
    'forex/convert': 'Convert between currencies',
    'forex/historical': 'Historical exchange rates',
    // Crypto (NEW - 100% Free)
    'crypto/prices': 'Current prices for top cryptocurrencies',
    'crypto/markets': 'Crypto market data and rankings',
    'crypto/historical': 'Historical crypto prices',
    // Stocks (requires FINNHUB_API_KEY)
    'stocks/quote': 'Real-time stock quotes',
    'stocks/historical': 'Historical stock prices',
    'stocks/indices': 'Major market indices (S&P 500, Dow, Nasdaq)',
    // BLS (free, optional key)
    'bls/employment': 'US employment data (jobs, unemployment)',
    'bls/cpi': 'Consumer Price Index (inflation)',
    'bls/series': 'Query specific BLS data series',
    // Commodities (requires GOLDAPI_API_KEY)
    'commodities/prices': 'Commodity prices (gold, silver, oil)',
    'commodities/metals': 'Precious metals prices and trends',
    // Fundamentals (requires FMP_API_KEY)
    'fundamentals/profile': 'Company profile and overview',
    'fundamentals/ratios': 'Financial ratios (P/E, P/B, etc.)',
    'fundamentals/metrics': 'Key financial metrics',
    // SEC 13F
    'sec/13f': 'Institutional holdings from 13F filings',
    // Calendars (requires FINNHUB_API_KEY)
    'calendar/earnings': 'Earnings calendar and estimates',
    'calendar/dividends': 'Dividend calendar (ex-dates, yields)',
    'calendar/ipo': 'IPO calendar',
    'calendar/economic': 'Economic event calendar',
    // Technical Indicators (NEW v1.5.0)
    'indicators/sma': 'Simple Moving Average calculation',
    'indicators/ema': 'Exponential Moving Average calculation',
    'indicators/rsi': 'Relative Strength Index',
    'indicators/macd': 'MACD indicator with signal line',
    'indicators/bbands': 'Bollinger Bands',
    'indicators/batch': 'Multiple indicators in one call',
    // Analyst Ratings (NEW v1.5.0)
    'analyst/ratings': 'Buy/Hold/Sell consensus ratings',
    'analyst/targets': 'Analyst price targets',
    // News (NEW v1.5.0)
    'news/market': 'Market-wide news headlines',
    'news/company': 'Company-specific news',
  };
  return descriptions[key] || key;
}

// =============================================================================
// Free Endpoints
// =============================================================================

// Landing Page HTML Template
function getLandingPageHtml() {
  const categories = [
    { icon: '📈', name: 'Market Data', tag: 'Finance', endpoints: 12, description: 'Real-time stock quotes, crypto prices, forex rates, and market indices from multiple sources.', price: '$0.002-0.01', apis: 'Finnhub + CoinGecko + ExchangeRate' },
    { icon: '📊', name: 'Technical Analysis', tag: 'Finance', endpoints: 6, description: 'Technical indicators including SMA, EMA, RSI, MACD, and Bollinger Bands with buy/sell signals.', price: '$0.003-0.01', apis: 'Alpha Vantage' },
    { icon: '📋', name: 'SEC Filings', tag: 'Regulatory', endpoints: 6, description: 'Company profiles, XBRL financials, insider trading (Form 4), 8-K events, and 13F institutional holdings.', price: '$0.005-0.05', apis: 'SEC EDGAR' },
    { icon: '🏛️', name: 'Government Data', tag: 'Economics', endpoints: 12, description: 'US Treasury debt/spending, FRED economic indicators, BLS employment data, and fiscal dashboards.', price: '$0.002-0.01', apis: 'Treasury + FRED + BLS' },
    { icon: '💹', name: 'Analyst Intel', tag: 'Finance', endpoints: 4, description: 'Wall Street analyst ratings, price targets, and consensus recommendations for any stock.', price: '$0.01', apis: 'Finnhub' },
    { icon: '📰', name: 'News & Events', tag: 'Finance', endpoints: 6, description: 'Market headlines, company-specific news, and economic/earnings calendars.', price: '$0.005', apis: 'Finnhub + FMP' },
    { icon: '🏦', name: 'Bank Health', tag: 'Regulatory', endpoints: 6, description: 'FDIC bank search, financial health scores, failure history, and at-risk institution monitoring.', price: '$0.005-0.03', apis: 'FDIC' },
    { icon: '🔮', name: 'Prediction Markets', tag: 'Markets', endpoints: 4, description: 'Polymarket and Kalshi event data, market prices, and cross-platform arbitrage opportunities.', price: '$0.005-0.02', apis: 'Polymarket + Kalshi' },
    { icon: '⚖️', name: 'Sanctions Screening', tag: 'Compliance', endpoints: 4, description: 'OFAC sanctions checks for crypto addresses, entity names, and batch screening.', price: '$0.005-0.05', apis: 'OFAC SDN' },
    { icon: '📉', name: 'DeFi / Perps', tag: 'Crypto', endpoints: 3, description: 'Cross-exchange perpetual funding rates, open interest data, and arbitrage scanner.', price: '$0.005-0.01', apis: 'Multi-DEX' },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KrumpyBot Agents | AI Powered Information Services</title>
    <meta name="description" content="Specialized x402 enabled agents for real-world financial data, onchain gaming markets and more.">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='2' width='8' height='2' fill='%2322c55e'/><rect x='2' y='4' width='12' height='2' fill='%2322c55e'/><rect x='2' y='6' width='12' height='6' fill='%2322c55e'/><rect x='4' y='6' width='2' height='2' fill='%23000'/><rect x='10' y='6' width='2' height='2' fill='%23000'/><rect x='4' y='12' width='2' height='2' fill='%2322c55e'/><rect x='10' y='12' width='2' height='2' fill='%2322c55e'/><rect x='6' y='10' width='4' height='2' fill='%23166534'/></svg>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --green-primary: #22c55e;
            --green-dark: #166534;
            --green-light: #4ade80;
            --green-glow: rgba(34, 197, 94, 0.3);
            --bg-dark: #0f0f0f;
            --bg-card: #1a1a1a;
            --bg-card-hover: #252525;
            --text-primary: #ffffff;
            --text-secondary: #a3a3a3;
            --border-color: #2a2a2a;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'JetBrains Mono', monospace;
            background: var(--bg-dark);
            color: var(--text-primary);
            min-height: 100vh;
            line-height: 1.6;
        }
        nav {
            position: fixed; top: 0; left: 0; right: 0;
            background: rgba(15, 15, 15, 0.95);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border-color);
            z-index: 1000; padding: 1rem 2rem;
        }
        .nav-container {
            max-width: 1200px; margin: 0 auto;
            display: flex; justify-content: space-between; align-items: center;
        }
        .nav-logo {
            display: flex; align-items: center; gap: 0.75rem;
            text-decoration: none; color: var(--text-primary);
            font-weight: 700; font-size: 1.25rem;
        }
        .goblin-icon { width: 32px; height: 32px; image-rendering: pixelated; }
        .nav-links { display: flex; gap: 2rem; align-items: center; }
        .nav-links a {
            color: var(--text-secondary); text-decoration: none;
            font-size: 0.875rem; transition: color 0.2s;
        }
        .nav-links a:hover, .nav-links a.active { color: var(--green-primary); }
        .hero {
            padding: 7rem 2rem 3rem; text-align: center;
            background: radial-gradient(ellipse at center top, var(--green-glow) 0%, transparent 50%);
        }
        .hero h1 {
            font-size: 2.5rem; font-weight: 700; margin-bottom: 0.5rem;
            background: linear-gradient(135deg, var(--text-primary) 0%, var(--green-primary) 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .hero p { color: var(--text-secondary); font-size: 1rem; max-width: 600px; margin: 0 auto 1.5rem; }
        .stats {
            display: flex; justify-content: center; gap: 2rem; flex-wrap: wrap;
            background: var(--bg-card); border: 1px solid var(--border-color);
            border-radius: 12px; padding: 1.5rem; max-width: 600px; margin: 0 auto;
        }
        .stat { text-align: center; }
        .stat-value { font-size: 1.75rem; font-weight: 700; color: var(--green-primary); }
        .stat-label { font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.1em; }
        .section { max-width: 1200px; margin: 0 auto; padding: 3rem 2rem; }
        .section-title {
            font-size: 1.25rem; font-weight: 600; margin-bottom: 1.5rem;
            display: flex; align-items: center; gap: 0.75rem;
        }
        .section-title::before {
            content: ''; width: 4px; height: 20px;
            background: var(--green-primary); border-radius: 2px;
        }
        .agents-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
            gap: 1rem;
        }
        .agent-card {
            background: var(--bg-card); border: 1px solid var(--border-color);
            border-radius: 12px; padding: 1.25rem; transition: all 0.3s ease;
        }
        .agent-card:hover {
            background: var(--bg-card-hover); border-color: var(--green-dark);
            transform: translateY(-2px);
        }
        .agent-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
        .agent-icon { font-size: 1.75rem; }
        .agent-tag {
            font-size: 0.65rem; padding: 0.2rem 0.5rem; border-radius: 4px;
            background: rgba(34, 197, 94, 0.15); color: var(--green-primary);
        }
        .agent-title { font-size: 1rem; font-weight: 600; margin-bottom: 0.25rem; }
        .agent-endpoints { font-size: 0.7rem; color: var(--green-primary); margin-bottom: 0.5rem; }
        .agent-desc { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem; line-height: 1.5; }
        .agent-meta {
            display: flex; justify-content: space-between; align-items: center;
            padding-top: 0.75rem; border-top: 1px solid var(--border-color);
            font-size: 0.7rem;
        }
        .agent-price { color: var(--green-primary); font-weight: 600; }
        .agent-api { color: var(--text-secondary); }
        footer {
            border-top: 1px solid var(--border-color);
            padding: 2rem; text-align: center;
            color: var(--text-secondary); font-size: 0.8rem;
        }
        .footer-links { display: flex; justify-content: center; gap: 1.5rem; margin-bottom: 1rem; }
        .footer-links a { color: var(--text-secondary); text-decoration: none; }
        .footer-links a:hover { color: var(--green-primary); }
        .powered-by { display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }
        .powered-badge { background: var(--bg-card); padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.7rem; }
        .subheader { 
            position: fixed; top: 58px; left: 0; right: 0; 
            background: var(--bg-card); border-bottom: 1px solid var(--border-color); 
            z-index: 999; padding: 0.35rem 2rem;
        }
        .subheader-container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: flex-end; align-items: center; gap: 1.5rem; }
        .subheader a { color: var(--text-secondary); text-decoration: none; font-size: 0.8rem; padding: 0.25rem 0; transition: color 0.2s; }
        .subheader a:hover, .subheader a.active { color: var(--green-primary); }
        .github-icon { width: 20px; height: 20px; vertical-align: middle; }
        @media (max-width: 768px) {
            .agents-grid { grid-template-columns: 1fr; }
            .hero h1 { font-size: 2rem; }
            .stats { flex-direction: column; gap: 1rem; }
        }
    </style>
</head>
<body>
    <nav>
        <div class="nav-container">
            <a href="https://krumpybot.com" class="nav-logo">
                <svg class="goblin-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="1" width="8" height="1" fill="#22c55e"/>
                    <rect x="3" y="2" width="10" height="1" fill="#22c55e"/>
                    <rect x="2" y="3" width="2" height="2" fill="#22c55e"/>
                    <rect x="12" y="3" width="2" height="2" fill="#22c55e"/>
                    <rect x="4" y="3" width="8" height="1" fill="#166534"/>
                    <rect x="2" y="5" width="12" height="6" fill="#22c55e"/>
                    <rect x="4" y="5" width="2" height="2" fill="#000"/>
                    <rect x="5" y="5" width="1" height="1" fill="#fff"/>
                    <rect x="10" y="5" width="2" height="2" fill="#000"/>
                    <rect x="11" y="5" width="1" height="1" fill="#fff"/>
                    <rect x="6" y="8" width="4" height="2" fill="#166534"/>
                    <rect x="7" y="9" width="1" height="1" fill="#fff"/>
                    <rect x="9" y="9" width="1" height="1" fill="#fff"/>
                    <rect x="3" y="11" width="3" height="2" fill="#22c55e"/>
                    <rect x="10" y="11" width="3" height="2" fill="#22c55e"/>
                </svg>
                KrumpyBot
            </a>
            <div class="nav-links">
                <a href="https://krumpybot.com">Home</a>
                <a href="/" class="active">Agents</a>
                <a href="#" class="disabled" style="opacity: 0.5; cursor: not-allowed;">Gaming</a>
                <a href="https://github.com/krumpybot" target="_blank" title="GitHub">
                    <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                </a>
            </div>
        </div>
    </nav>
    <div class="subheader">
        <div class="subheader-container">
            <a href="/status">Status</a>
            <a href="/manifest">Manifest</a>
        </div>
    </div>

    <section class="hero" style="padding-top: 8rem;">
        <h1>AI Powered Information Services</h1>
        <p>Specialized x402 enabled agents for real-world financial data, onchain gaming markets and more.</p>
        <div class="stats">
            <div class="stat">
                <div class="stat-value">${Object.keys(PRICING).length}</div>
                <div class="stat-label">Endpoints</div>
            </div>
            <div class="stat">
                <div class="stat-value">10</div>
                <div class="stat-label">Categories</div>
            </div>
            <div class="stat">
                <div class="stat-value">$0.002</div>
                <div class="stat-label">Min Price</div>
            </div>
            <div class="stat">
                <div class="stat-value">Base</div>
                <div class="stat-label">Network</div>
            </div>
        </div>
    </section>

    <section class="section">
        <h2 class="section-title">Available Agents</h2>
        <div class="agents-grid">
            ${categories.map(cat => `
            <div class="agent-card">
                <div class="agent-header">
                    <span class="agent-icon">${cat.icon}</span>
                    <span class="agent-tag">${cat.tag}</span>
                </div>
                <div class="agent-title">${cat.name}</div>
                <div class="agent-endpoints">${cat.endpoints} endpoints</div>
                <div class="agent-desc">${cat.description}</div>
                <div class="agent-meta">
                    <span class="agent-price">${cat.price}</span>
                    <span class="agent-api">${cat.apis}</span>
                </div>
            </div>
            `).join('')}
        </div>
    </section>

    <footer>
        <div class="footer-links">
            <a href="https://krumpybot.com">Home</a>
            <a href="/status">Status</a>
            <a href="/manifest">Manifest</a>
            <a href="/pricing">Pricing</a>
            <a href="https://github.com/krumpybot" target="_blank" title="GitHub">
                <svg style="width: 16px; height: 16px; vertical-align: middle;" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
            </a>
        </div>
        <div class="powered-by">
            <span class="powered-badge">x402 Protocol</span>
            <span class="powered-badge">USDC on Base</span>
            <span class="powered-badge">v${CONFIG.version}</span>
        </div>
        <p style="margin-top: 1rem;">© 2026 KrumpyBot. All rights reserved.</p>
    </footer>
</body>
</html>`;
}

app.get('/', (c) => {
  // Serve HTML for browsers, return 402 with payment info for API clients/x402scan
  const accept = c.req.header('Accept') || '';
  if (accept.includes('text/html') && !c.req.header('User-Agent')?.includes('x402')) {
    return c.html(getLandingPageHtml());
  }
  
  // Return 402 Payment Required for x402 compatibility
  // This allows x402scan to recognize this as a paid resource
  // Use X-Forwarded headers for proper HTTPS URL behind Cloudflare
  const proto = c.req.header('X-Forwarded-Proto') || 'https';
  const host = c.req.header('X-Forwarded-Host') || c.req.header('Host') || 'agents.krumpybot.com';
  const baseUrl = `${proto}://${host}`;
  const paymentInfo = {
    x402Version: 1,
    accepts: [{
      scheme: 'exact',
      network: CONFIG.network,
      maxAmountRequired: '5000', // Minimum price in USDC (6 decimals) = $0.005
      resource: baseUrl,
      description: CONFIG.description,
      payTo: CONFIG.receiverAddress,
      maxTimeoutSeconds: 300,
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
      extra: { name: 'USD Coin', version: '2' },
    }],
    gateway: {
      name: CONFIG.name,
      version: CONFIG.version,
      endpoints: Object.keys(PRICING).length,
      docs: '/.well-known/agent.json',
      manifest: '/.well-known/x402-manifest.json',
      health: '/health',
      pricing: '/pricing',
    },
    categories: {
      sec: 'SEC filings, XBRL financials, insider trading, 13F holdings',
      perp: 'Perpetual DEX funding rates and arbitrage',
      sanctions: 'OFAC sanctions screening',
      prediction: 'Polymarket + Kalshi prediction markets',
      banks: 'FDIC bank health monitoring',
      fred: 'Federal Reserve economic indicators',
      treasury: 'US Treasury fiscal data (debt, spending, revenue)',
      forex: 'Currency exchange rates (200+ currencies)',
      crypto: 'Cryptocurrency prices and market data',
      stocks: 'Stock prices and market indices',
      bls: 'Bureau of Labor Statistics (employment, CPI)',
      commodities: 'Gold, silver, oil, and other commodities',
      fundamentals: 'Company fundamentals and ratios',
      calendar: 'Earnings, dividends, IPO, economic events',
      indicators: 'Technical indicators (SMA, EMA, RSI, MACD, Bollinger)',
      analyst: 'Analyst ratings and price targets',
      news: 'Market and company news headlines',
    },
  };
  
  return c.json(paymentInfo, 402);
});

const perpHeaders = { 'X-API-Key': PERP_DEX_API_KEY };

app.get('/health', async (c) => {
  const [
    secHealth, perpHealth, sanctionsHealth, polyHealth, fdicHealth, fredHealth,
    treasuryHealth, forexHealth, coingeckoHealth, finnhubHealth, blsHealth
  ] = await Promise.allSettled([
    proxyRequest(CONFIG.secOracleUrl, '/health'),
    proxyRequest(CONFIG.perpDexUrl, '/health', perpHeaders),
    proxyRequest(CONFIG.sanctionsUrl, '/health'),
    fetchWithTimeout(`${CONFIG.polymarketUrl}/events?limit=1&active=true`, {}, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()),
    fetchWithTimeout(`${CONFIG.fdicUrl}/institutions?limit=1`, {}, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()),
    CONFIG.fredApiKey ? fetchWithTimeout(`${CONFIG.fredUrl}/series?series_id=GDP&api_key=${CONFIG.fredApiKey}&file_type=json`, {}, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()) : Promise.resolve({ status: 'no_api_key' }),
    // NEW health checks
    fetchWithTimeout(`${CONFIG.treasuryUrl}/v2/accounting/od/debt_to_penny?page%5Bsize%5D=1`, {}, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()),
    fetchWithTimeout(`${CONFIG.forexUrl}/currencies/usd.json`, {}, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()),
    fetchWithTimeout(`${CONFIG.coingeckoUrl}/ping`, {}, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()),
    CONFIG.finnhubApiKey ? fetchWithTimeout(`${CONFIG.finnhubUrl}/quote?symbol=AAPL&token=${CONFIG.finnhubApiKey}`, {}, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()) : Promise.resolve({ status: 'no_api_key' }),
    fetchWithTimeout(`${CONFIG.blsUrl}/timeseries/data/LNS14000000`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seriesid: ['LNS14000000'] }) }, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()),
  ]);
  
  return c.json({
    gateway: 'healthy',
    version: CONFIG.version,
    // Internal services
    sec_oracle: secHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy',
    perp_dex: perpHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy',
    sanctions_oracle: sanctionsHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy',
    // External (existing)
    polymarket: polyHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy',
    fdic: fdicHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy',
    fred: fredHealth.status === 'fulfilled' ? (CONFIG.fredApiKey ? 'healthy' : 'no_api_key') : 'unhealthy',
    // External (NEW - free)
    treasury: treasuryHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy',
    forex: forexHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy',
    coingecko: coingeckoHealth.status === 'fulfilled' ? 'healthy' : 'rate-limited',
    bls: blsHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy',
    // External (NEW - need API keys)
    finnhub: finnhubHealth.status === 'fulfilled' ? (CONFIG.finnhubApiKey ? 'healthy' : 'no_api_key') : 'unhealthy',
    fmp: CONFIG.fmpApiKey ? 'configured' : 'no_api_key',
    goldapi: CONFIG.goldApiKey ? 'configured' : 'no_api_key',
    alphavantage: CONFIG.alphaVantageApiKey ? 'configured' : 'no_api_key',
    cache_entries: cache.size,
    timestamp: new Date().toISOString(),
  });
});

// Status page with HTML rendering
app.get('/status', async (c) => {
  const [
    secHealth, perpHealth, sanctionsHealth, polyHealth, fdicHealth, fredHealth,
    treasuryHealth, forexHealth, coingeckoHealth, finnhubHealth, blsHealth
  ] = await Promise.allSettled([
    proxyRequest(CONFIG.secOracleUrl, '/health'),
    proxyRequest(CONFIG.perpDexUrl, '/health', perpHeaders),
    proxyRequest(CONFIG.sanctionsUrl, '/health'),
    fetchWithTimeout(`${CONFIG.polymarketUrl}/events?limit=1&active=true`, {}, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()),
    fetchWithTimeout(`${CONFIG.fdicUrl}/institutions?limit=1`, {}, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()),
    CONFIG.fredApiKey ? fetchWithTimeout(`${CONFIG.fredUrl}/series?series_id=GDP&api_key=${CONFIG.fredApiKey}&file_type=json`, {}, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()) : Promise.resolve({ status: 'no_api_key' }),
    fetchWithTimeout(`${CONFIG.treasuryUrl}/v2/accounting/od/debt_to_penny?page%5Bsize%5D=1`, {}, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()),
    fetchWithTimeout(`${CONFIG.forexUrl}/currencies/usd.json`, {}, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()),
    fetchWithTimeout(`${CONFIG.coingeckoUrl}/ping`, {}, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()),
    CONFIG.finnhubApiKey ? fetchWithTimeout(`${CONFIG.finnhubUrl}/quote?symbol=AAPL&token=${CONFIG.finnhubApiKey}`, {}, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()) : Promise.resolve({ status: 'no_api_key' }),
    fetchWithTimeout(`${CONFIG.blsUrl}/timeseries/data/LNS14000000`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seriesid: ['LNS14000000'] }) }, 5000).then(r => r.ok ? { status: 'ok' } : Promise.reject()),
  ]);
  
  const services = [
    { name: 'SEC Oracle', status: secHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy', type: 'Internal' },
    { name: 'Perp DEX', status: perpHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy', type: 'Internal' },
    { name: 'Sanctions', status: sanctionsHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy', type: 'Internal' },
    { name: 'Polymarket', status: polyHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy', type: 'External' },
    { name: 'FDIC', status: fdicHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy', type: 'External' },
    { name: 'FRED', status: fredHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy', type: 'External' },
    { name: 'Treasury', status: treasuryHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy', type: 'External' },
    { name: 'Forex', status: forexHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy', type: 'External' },
    { name: 'CoinGecko', status: coingeckoHealth.status === 'fulfilled' ? 'healthy' : 'rate-limited', type: 'External' },
    { name: 'Finnhub', status: finnhubHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy', type: 'External' },
    { name: 'BLS', status: blsHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy', type: 'External' },
    { name: 'FMP', status: CONFIG.fmpApiKey ? 'configured' : 'no_api_key', type: 'External' },
    { name: 'GoldAPI', status: CONFIG.goldApiKey ? 'configured' : 'no_api_key', type: 'External' },
    { name: 'Alpha Vantage', status: CONFIG.alphaVantageApiKey ? 'configured' : 'no_api_key', type: 'External' },
  ];
  
  const healthyCount = services.filter(s => s.status === 'healthy' || s.status === 'configured' || s.status === 'rate-limited').length;
  const totalCount = services.length;
  const overallStatus = healthyCount === totalCount ? 'Operational' : healthyCount > totalCount * 0.7 ? 'Degraded' : 'Outage';
  
  const accept = c.req.header('Accept') || '';
  if (accept.includes('text/html')) {
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Status | KrumpyBot Agents</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='2' width='8' height='2' fill='%2322c55e'/><rect x='2' y='4' width='12' height='2' fill='%2322c55e'/><rect x='2' y='6' width='12' height='6' fill='%2322c55e'/><rect x='4' y='6' width='2' height='2' fill='%23000'/><rect x='10' y='6' width='2' height='2' fill='%23000'/><rect x='4' y='12' width='2' height='2' fill='%2322c55e'/><rect x='10' y='12' width='2' height='2' fill='%2322c55e'/><rect x='6' y='10' width='4' height='2' fill='%23166534'/></svg>">
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root { --green-primary: #22c55e; --green-dark: #166534; --bg-dark: #0f0f0f; --bg-card: #1a1a1a; --text-primary: #fff; --text-secondary: #a3a3a3; --border-color: #2a2a2a; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'JetBrains Mono', monospace; background: var(--bg-dark); color: var(--text-primary); min-height: 100vh; }
        nav { position: fixed; top: 0; left: 0; right: 0; background: rgba(15, 15, 15, 0.95); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border-color); z-index: 1000; padding: 1rem 2rem; }
        .nav-container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        .nav-logo { display: flex; align-items: center; gap: 0.75rem; text-decoration: none; color: var(--text-primary); font-weight: 700; font-size: 1.25rem; }
        .goblin-icon { width: 32px; height: 32px; }
        .nav-links { display: flex; gap: 2rem; align-items: center; }
        .nav-links a { color: var(--text-secondary); text-decoration: none; font-size: 0.875rem; transition: color 0.2s; }
        .nav-links a:hover, .nav-links a.active { color: var(--green-primary); }
        .nav-links a.disabled { opacity: 0.5; cursor: not-allowed; }
        .github-icon { width: 20px; height: 20px; }
        .subheader { position: fixed; top: 58px; left: 0; right: 0; background: var(--bg-card); border-bottom: 1px solid var(--border-color); z-index: 999; padding: 0.35rem 2rem; }
        .subheader-container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: flex-end; align-items: center; gap: 1.5rem; }
        .subheader a { color: var(--text-secondary); text-decoration: none; font-size: 0.8rem; padding: 0.25rem 0; transition: color 0.2s; }
        .subheader a:hover, .subheader a.active { color: var(--green-primary); }
        .container { max-width: 900px; margin: 0 auto; padding: 7rem 2rem 2rem; }
        h1 { font-size: 2rem; margin-bottom: 0.5rem; }
        .subtitle { color: var(--text-secondary); margin-bottom: 2rem; }
        .overall { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
        .status-badge { display: flex; align-items: center; gap: 0.5rem; font-size: 1.25rem; font-weight: 600; }
        .status-dot { width: 12px; height: 12px; border-radius: 50%; }
        .status-dot.healthy { background: var(--green-primary); }
        .status-dot.degraded { background: #eab308; }
        .status-dot.outage { background: #ef4444; }
        .meta { display: flex; gap: 2rem; font-size: 0.875rem; color: var(--text-secondary); flex-wrap: wrap; }
        .services { display: grid; gap: 0.75rem; }
        .service { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; }
        .service-name { font-weight: 500; }
        .service-type { font-size: 0.75rem; color: var(--text-secondary); }
        .service-status { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
        .service-status.healthy { color: var(--green-primary); }
        .service-status.configured, .service-status.rate-limited { color: #eab308; }
        .service-status.unhealthy, .service-status.no_api_key { color: #ef4444; }
        footer { margin-top: 3rem; text-align: center; color: var(--text-secondary); font-size: 0.75rem; padding-bottom: 2rem; }
    </style>
</head>
<body>
    <nav>
        <div class="nav-container">
            <a href="https://krumpybot.com" class="nav-logo">
                <svg class="goblin-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="1" width="8" height="1" fill="#22c55e"/>
                    <rect x="3" y="2" width="10" height="1" fill="#22c55e"/>
                    <rect x="2" y="3" width="2" height="2" fill="#22c55e"/>
                    <rect x="12" y="3" width="2" height="2" fill="#22c55e"/>
                    <rect x="4" y="3" width="8" height="1" fill="#166534"/>
                    <rect x="2" y="5" width="12" height="6" fill="#22c55e"/>
                    <rect x="4" y="5" width="2" height="2" fill="#000"/>
                    <rect x="5" y="5" width="1" height="1" fill="#fff"/>
                    <rect x="10" y="5" width="2" height="2" fill="#000"/>
                    <rect x="11" y="5" width="1" height="1" fill="#fff"/>
                    <rect x="6" y="8" width="4" height="2" fill="#166534"/>
                    <rect x="7" y="9" width="1" height="1" fill="#fff"/>
                    <rect x="9" y="9" width="1" height="1" fill="#fff"/>
                    <rect x="3" y="11" width="3" height="2" fill="#22c55e"/>
                    <rect x="10" y="11" width="3" height="2" fill="#22c55e"/>
                </svg>
                KrumpyBot
            </a>
            <div class="nav-links">
                <a href="https://krumpybot.com">Home</a>
                <a href="/" class="active">Agents</a>
                <a href="#" class="disabled">Gaming</a>
                <a href="https://github.com/krumpybot" target="_blank">
                    <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                </a>
            </div>
        </div>
    </nav>
    <div class="subheader">
        <div class="subheader-container">
            <a href="/status" class="active">Status</a>
            <a href="/manifest">Manifest</a>
        </div>
    </div>
    <div class="container">
        <h1>System Status</h1>
        <p class="subtitle">Real-time health of all services</p>
        <div class="overall">
            <div class="status-badge">
                <span class="status-dot ${overallStatus === 'Operational' ? 'healthy' : overallStatus === 'Degraded' ? 'degraded' : 'outage'}"></span>
                ${overallStatus}
            </div>
            <div class="meta">
                <span>Version: v${CONFIG.version}</span>
                <span>${healthyCount}/${totalCount} services healthy</span>
                <span>Cache: ${cache.size} entries</span>
            </div>
        </div>
        <div class="services">
            ${services.map(s => `
            <div class="service">
                <div>
                    <div class="service-name">${s.name}</div>
                    <div class="service-type">${s.type}</div>
                </div>
                <div class="service-status ${s.status}">
                    <span class="status-dot ${s.status === 'healthy' || s.status === 'configured' || s.status === 'rate-limited' ? 'healthy' : 'outage'}"></span>
                    ${s.status === 'healthy' ? 'Healthy' : s.status === 'configured' ? 'Configured' : s.status === 'rate-limited' ? 'Rate Limited' : s.status === 'no_api_key' ? 'No API Key' : 'Unhealthy'}
                </div>
            </div>
            `).join('')}
        </div>
        <footer>Last updated: ${new Date().toISOString()}</footer>
    </div>
</body>
</html>`);
  }
  
  // Return JSON for API clients
  return c.json({
    status: overallStatus.toLowerCase(),
    version: CONFIG.version,
    services: Object.fromEntries(services.map(s => [s.name.toLowerCase().replace(/\s+/g, '_'), s.status])),
    cache_entries: cache.size,
    timestamp: new Date().toISOString(),
  });
});

// Manifest page with HTML rendering
app.get('/manifest', async (c) => {
  const manifest = {
    x402Version: 1,
    name: CONFIG.name,
    description: CONFIG.description,
    version: CONFIG.version,
    network: CONFIG.network,
    receiver: CONFIG.receiverAddress,
    endpoints: Object.keys(PRICING).length,
    pricing: PRICING,
    categories: Object.keys(PRICING).reduce((acc, endpoint) => {
      const category = endpoint.split('/')[0];
      if (!acc[category]) acc[category] = [];
      acc[category].push(endpoint);
      return acc;
    }, {} as Record<string, string[]>),
  };

  const accept = c.req.header('Accept') || '';
  if (accept.includes('text/html')) {
    const categories = Object.entries(manifest.categories).map(([name, endpoints]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      endpoints: (endpoints as string[]).map(ep => ({
        path: '/' + ep,
        name: ENDPOINT_NAMES[ep] || ep,
        price: PRICING[ep] || 0,
        description: getEndpointDescription(ep),
      })),
    }));

    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>x402 Manifest | KrumpyBot Agents</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='2' width='8' height='2' fill='%2322c55e'/><rect x='2' y='4' width='12' height='2' fill='%2322c55e'/><rect x='2' y='6' width='12' height='6' fill='%2322c55e'/><rect x='4' y='6' width='2' height='2' fill='%23000'/><rect x='10' y='6' width='2' height='2' fill='%23000'/><rect x='4' y='12' width='2' height='2' fill='%2322c55e'/><rect x='10' y='12' width='2' height='2' fill='%2322c55e'/><rect x='6' y='10' width='4' height='2' fill='%23166534'/></svg>">
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root { --green-primary: #22c55e; --green-dark: #166534; --bg-dark: #0f0f0f; --bg-card: #1a1a1a; --text-primary: #fff; --text-secondary: #a3a3a3; --border-color: #2a2a2a; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'JetBrains Mono', monospace; background: var(--bg-dark); color: var(--text-primary); min-height: 100vh; }
        nav { position: fixed; top: 0; left: 0; right: 0; background: rgba(15, 15, 15, 0.95); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border-color); z-index: 1000; padding: 1rem 2rem; }
        .nav-container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        .nav-logo { display: flex; align-items: center; gap: 0.75rem; text-decoration: none; color: var(--text-primary); font-weight: 700; font-size: 1.25rem; }
        .goblin-icon { width: 32px; height: 32px; }
        .nav-links { display: flex; gap: 2rem; align-items: center; }
        .nav-links a { color: var(--text-secondary); text-decoration: none; font-size: 0.875rem; transition: color 0.2s; }
        .nav-links a:hover, .nav-links a.active { color: var(--green-primary); }
        .nav-links a.disabled { opacity: 0.5; cursor: not-allowed; }
        .github-icon { width: 20px; height: 20px; vertical-align: middle; }
        .subheader { position: fixed; top: 58px; left: 0; right: 0; background: var(--bg-card); border-bottom: 1px solid var(--border-color); z-index: 999; padding: 0.35rem 2rem; }
        .subheader-container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: flex-end; align-items: center; gap: 1.5rem; }
        .subheader a { color: var(--text-secondary); text-decoration: none; font-size: 0.8rem; padding: 0.25rem 0; transition: color 0.2s; }
        .subheader a:hover, .subheader a.active { color: var(--green-primary); }
        .container { max-width: 1000px; margin: 0 auto; padding: 7rem 2rem 2rem; }
        h1 { font-size: 2rem; margin-bottom: 0.5rem; }
        .subtitle { color: var(--text-secondary); margin-bottom: 2rem; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .info-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; }
        .info-label { font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.25rem; }
        .info-value { font-size: 1rem; color: var(--green-primary); word-break: break-all; }
        .category { margin-bottom: 2rem; }
        .category-title { font-size: 1.25rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
        .category-title::before { content: ''; width: 3px; height: 18px; background: var(--green-primary); border-radius: 2px; }
        .endpoints { display: grid; gap: 0.5rem; }
        .endpoint { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.75rem 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
        .endpoint-path { font-size: 0.875rem; color: var(--green-primary); }
        .endpoint-name { font-size: 0.75rem; color: var(--text-secondary); }
        .endpoint-price { font-size: 0.875rem; font-weight: 600; }
        footer { margin-top: 3rem; text-align: center; color: var(--text-secondary); font-size: 0.75rem; padding-bottom: 2rem; }
        .json-link { display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-secondary); text-decoration: none; font-size: 0.875rem; }
        .json-link:hover { border-color: var(--green-primary); color: var(--green-primary); }
    </style>
</head>
<body>
    <nav>
        <div class="nav-container">
            <a href="https://krumpybot.com" class="nav-logo">
                <svg class="goblin-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="1" width="8" height="1" fill="#22c55e"/>
                    <rect x="3" y="2" width="10" height="1" fill="#22c55e"/>
                    <rect x="2" y="3" width="2" height="2" fill="#22c55e"/>
                    <rect x="12" y="3" width="2" height="2" fill="#22c55e"/>
                    <rect x="4" y="3" width="8" height="1" fill="#166534"/>
                    <rect x="2" y="5" width="12" height="6" fill="#22c55e"/>
                    <rect x="4" y="5" width="2" height="2" fill="#000"/>
                    <rect x="5" y="5" width="1" height="1" fill="#fff"/>
                    <rect x="10" y="5" width="2" height="2" fill="#000"/>
                    <rect x="11" y="5" width="1" height="1" fill="#fff"/>
                    <rect x="6" y="8" width="4" height="2" fill="#166534"/>
                    <rect x="7" y="9" width="1" height="1" fill="#fff"/>
                    <rect x="9" y="9" width="1" height="1" fill="#fff"/>
                    <rect x="3" y="11" width="3" height="2" fill="#22c55e"/>
                    <rect x="10" y="11" width="3" height="2" fill="#22c55e"/>
                </svg>
                KrumpyBot
            </a>
            <div class="nav-links">
                <a href="https://krumpybot.com">Home</a>
                <a href="/" class="active">Agents</a>
                <a href="#" class="disabled">Gaming</a>
                <a href="https://github.com/krumpybot" target="_blank" title="GitHub">
                    <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                </a>
            </div>
        </div>
    </nav>
    <div class="subheader">
        <div class="subheader-container">
            <a href="/status">Status</a>
            <a href="/manifest" class="active">Manifest</a>
        </div>
    </div>
    <div class="container">
        <h1>x402 Manifest</h1>
        <p class="subtitle">Payment protocol configuration for AI agents</p>
        <div class="info-grid">
            <div class="info-card">
                <div class="info-label">Protocol Version</div>
                <div class="info-value">x402 v${manifest.x402Version}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Network</div>
                <div class="info-value">${manifest.network}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Total Endpoints</div>
                <div class="info-value">${manifest.endpoints}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Receiver Address</div>
                <div class="info-value" style="font-size: 0.7rem;">${manifest.receiver}</div>
            </div>
        </div>
        <a href="/.well-known/x402-manifest.json" class="json-link">📄 Download JSON Manifest</a>
        <h2 style="margin: 2rem 0 1rem; font-size: 1.5rem;">Endpoints by Category</h2>
        ${categories.map(cat => `
        <div class="category">
            <h3 class="category-title">${cat.name}</h3>
            <div class="endpoints">
                ${cat.endpoints.map(ep => `
                <div class="endpoint">
                    <div>
                        <div class="endpoint-path">${ep.path}</div>
                        <div class="endpoint-name">${ep.name}</div>
                    </div>
                    <div class="endpoint-price">$${ep.price.toFixed(3)}</div>
                </div>
                `).join('')}
            </div>
        </div>
        `).join('')}
        <footer>Version ${manifest.version} • Last updated: ${new Date().toISOString()}</footer>
    </div>
</body>
</html>`);
  }
  
  // Return JSON for API clients
  return c.json(manifest);
});

// Stats endpoint for monitoring
app.get('/stats', (c) => {
  return c.json({
    version: CONFIG.version,
    uptime: process.uptime(),
    cache: {
      entries: cache.size,
      max_entries: 1000,
    },
    endpoints: Object.keys(PRICING).length,
    timestamp: new Date().toISOString(),
  });
});

app.get('/pricing', (c) => {
  return c.json({
    currency: 'USDC',
    network: CONFIG.network,
    receiver: CONFIG.receiverAddress,
    endpoints: PRICING,
    payment_header: 'X-Payment: <tx_hash>',
  });
});

// =============================================================================
// SEC Oracle Proxy Endpoints
// =============================================================================

app.get('/sec/company/:ticker', async (c) => {
  const ticker = c.req.param('ticker');
  const data = await proxyRequest(CONFIG.secOracleUrl, `/company/${ticker}`);
  return c.json(data);
});

app.get('/sec/financials/:ticker', async (c) => {
  const ticker = c.req.param('ticker');
  const metrics = c.req.query('metrics') || 'Revenues,NetIncomeLoss';
  const periods = c.req.query('periods') || '4';
  const data = await proxyRequest(CONFIG.secOracleUrl, `/financials/${ticker}?metrics=${metrics}&periods=${periods}`);
  return c.json(data);
});

app.get('/sec/insiders/:ticker', async (c) => {
  const ticker = c.req.param('ticker');
  const days = c.req.query('days') || '90';
  const data = await proxyRequest(CONFIG.secOracleUrl, `/insiders/${ticker}?days=${days}`);
  return c.json(data);
});

app.get('/sec/events/:ticker', async (c) => {
  const ticker = c.req.param('ticker');
  const days = c.req.query('days') || '365';
  const data = await proxyRequest(CONFIG.secOracleUrl, `/events/${ticker}?days=${days}`);
  return c.json(data);
});

app.get('/sec/batch', async (c) => {
  const tickers = c.req.query('tickers');
  const metrics = c.req.query('metrics') || 'Revenues,NetIncomeLoss';
  const data = await proxyRequest(CONFIG.secOracleUrl, `/batch/financials?tickers=${tickers}&metrics=${metrics}`);
  return c.json(data);
});

// =============================================================================
// Perp DEX Proxy Endpoints
// =============================================================================

app.get('/perp/funding', async (c) => {
  const symbol = c.req.query('symbol');
  const path = symbol ? `/funding/${symbol}` : '/funding';
  const data = await proxyRequest(CONFIG.perpDexUrl, path, perpHeaders);
  return c.json(data);
});

app.get('/perp/prices/:symbol', async (c) => {
  const symbol = c.req.param('symbol');
  const data = await proxyRequest(CONFIG.perpDexUrl, `/prices/${symbol}`, perpHeaders);
  return c.json(data);
});

app.get('/perp/arbitrage', async (c) => {
  const minSpread = c.req.query('min_spread') || '0.01';
  const data = await proxyRequest(CONFIG.perpDexUrl, `/arbitrage?min_spread=${minSpread}`, perpHeaders);
  return c.json(data);
});

app.get('/perp/platforms', async (c) => {
  const data = await proxyRequest(CONFIG.perpDexUrl, '/platforms', perpHeaders);
  return c.json(data);
});

// =============================================================================
// Sanctions Oracle Proxy Endpoints
// =============================================================================

app.post('/sanctions/address', async (c) => {
  const body = await c.req.json();
  const response = await fetch(`${CONFIG.sanctionsUrl}/screen/address`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return c.json(await response.json());
});

app.post('/sanctions/name', async (c) => {
  const body = await c.req.json();
  const response = await fetch(`${CONFIG.sanctionsUrl}/screen/name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return c.json(await response.json());
});

app.post('/sanctions/batch', async (c) => {
  const body = await c.req.json();
  const response = await fetch(`${CONFIG.sanctionsUrl}/screen/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return c.json(await response.json());
});

app.get('/sanctions/country/:code', async (c) => {
  const code = c.req.param('code');
  const data = await proxyRequest(CONFIG.sanctionsUrl, `/screen/country/${code}`);
  return c.json(data);
});

app.get('/sanctions/stats', async (c) => {
  const data = await proxyRequest(CONFIG.sanctionsUrl, '/stats');
  return c.json(data);
});

// =============================================================================
// PREDICTION MARKETS ENDPOINTS (NEW)
// =============================================================================

interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  active: boolean;
  closed: boolean;
  end_date_iso: string;
  markets: PolymarketMarket[];
}

interface PolymarketMarket {
  id: string;
  question: string;
  condition_id: string;
  outcomes: string[];
  outcome_prices: string[];
  volume: string;
  active: boolean;
}

interface KalshiEvent {
  event_ticker: string;
  title: string;
  category: string;
  mutually_exclusive: boolean;
  markets: KalshiMarket[];
}

interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  open_interest: number;
  status: string;
}

// Fetch Polymarket events (Gamma API) - with caching
async function fetchPolymarketEvents(limit = 50): Promise<PolymarketEvent[]> {
  const cacheKey = `polymarket:events:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  try {
    const response = await fetchWithTimeout(
      `${CONFIG.polymarketUrl}/events?limit=${limit}&active=true&closed=false`,
      {},
      10000
    );
    if (!response.ok) throw new Error(`Polymarket API error: ${response.status}`);
    const data = await response.json();
    
    // Transform Gamma API format to our expected format
    const events = (data || []).map((event: any) => ({
      id: event.id,
      title: event.title,
      slug: event.slug,
      description: event.description,
      active: event.active,
      closed: event.closed,
      end_date_iso: event.endDate,
      markets: (event.markets || []).map((m: any) => {
        // outcomePrices is a JSON string like '["0.45", "0.55"]'
        let prices = ['0', '0'];
        try {
          if (typeof m.outcomePrices === 'string') {
            prices = JSON.parse(m.outcomePrices);
          } else if (Array.isArray(m.outcomePrices)) {
            prices = m.outcomePrices;
          }
        } catch {}
        return {
          id: m.id,
          question: m.question,
          condition_id: m.conditionId,
          outcomes: ['Yes', 'No'],
          outcome_prices: prices,
          volume: m.volume || '0',
          active: event.active && !event.closed,
        };
      }),
    }));
    
    // Cache for 1 minute (prediction markets are dynamic)
    setCache(cacheKey, events, CACHE_TTL.short);
    return events;
  } catch (error) {
    console.error('Polymarket fetch error:', error);
    return [];
  }
}

// Fetch Kalshi events - with caching
async function fetchKalshiEvents(limit = 50): Promise<KalshiEvent[]> {
  const cacheKey = `kalshi:events:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  try {
    const response = await fetchWithTimeout(
      `${CONFIG.kalshiUrl}/events?limit=${limit}&status=open`,
      {},
      10000
    );
    if (!response.ok) throw new Error(`Kalshi API error: ${response.status}`);
    const data = await response.json();
    const events = data.events || [];
    
    // Cache for 1 minute
    setCache(cacheKey, events, CACHE_TTL.short);
    return events;
  } catch (error) {
    console.error('Kalshi fetch error:', error);
    return [];
  }
}

// Fetch specific Kalshi market - with caching
async function fetchKalshiMarket(ticker: string): Promise<KalshiMarket | null> {
  const cacheKey = `kalshi:market:${ticker}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  try {
    const response = await fetchWithTimeout(
      `${CONFIG.kalshiUrl}/markets/${ticker}`,
      {},
      10000
    );
    if (!response.ok) return null;
    const data = await response.json();
    const market = data.market || null;
    
    if (market) {
      setCache(cacheKey, market, CACHE_TTL.short);
    }
    return market;
  } catch {
    return null;
  }
}

// Normalize market data for comparison
interface NormalizedMarket {
  source: 'polymarket' | 'kalshi';
  id: string;
  title: string;
  question: string;
  category?: string;
  yesPrice: number;  // 0-1
  noPrice: number;   // 0-1
  volume: number;
  openInterest?: number;
  active: boolean;
  keywords: string[];
}

function normalizePolymarketMarket(event: PolymarketEvent, market: PolymarketMarket): NormalizedMarket {
  const yesPrice = parseFloat(market.outcome_prices?.[0] || '0');
  const noPrice = parseFloat(market.outcome_prices?.[1] || '0');
  
  return {
    source: 'polymarket',
    id: market.id,
    title: event.title,
    question: market.question,
    yesPrice,
    noPrice: noPrice || (1 - yesPrice),
    volume: parseFloat(market.volume || '0'),
    active: market.active && !event.closed,
    keywords: extractKeywords(event.title + ' ' + market.question),
  };
}

function normalizeKalshiMarket(event: KalshiEvent, market: KalshiMarket): NormalizedMarket {
  return {
    source: 'kalshi',
    id: market.ticker,
    title: event.title,
    question: market.title,
    category: event.category,
    yesPrice: market.yes_ask / 100,
    noPrice: market.no_ask / 100,
    volume: market.volume,
    openInterest: market.open_interest,
    active: market.status === 'active',
    keywords: extractKeywords(event.title + ' ' + market.title),
  };
}

function extractKeywords(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !['will', 'what', 'when', 'where', 'which', 'that', 'this', 'the', 'and', 'for', 'with'].includes(w));
}

// Find potential arbitrage between platforms
interface ArbitrageOpportunity {
  polymarket: NormalizedMarket;
  kalshi: NormalizedMarket;
  matchScore: number;
  yesSpread: number;  // positive = buy Poly yes, sell Kalshi yes
  noSpread: number;
  potentialProfit: number;
  recommendation: string;
  matchedKeywords: string[];
}

// Important distinguishing terms that must match if present
const DISTINGUISHING_TERMS = [
  'us', 'usa', 'america', 'american', 'united states',
  'uk', 'britain', 'british', 'england',
  'germany', 'german', 'france', 'french', 'netherlands', 'dutch',
  'china', 'chinese', 'russia', 'russian', 'ukraine', 'ukrainian',
  'bitcoin', 'ethereum', 'crypto',
  'trump', 'biden', 'harris', 'desantis', 'newsom',
  '2024', '2025', '2026', '2027', '2028',
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function findArbitrageOpportunities(
  polymarkets: NormalizedMarket[],
  kalshiMarkets: NormalizedMarket[]
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  
  for (const poly of polymarkets) {
    if (!poly.active) continue;
    
    for (const kalshi of kalshiMarkets) {
      if (!kalshi.active) continue;
      
      // Calculate keyword overlap
      const overlap = poly.keywords.filter(k => kalshi.keywords.includes(k));
      const unionSize = new Set([...poly.keywords, ...kalshi.keywords]).size;
      const matchScore = overlap.length / unionSize; // Jaccard similarity
      
      // Require higher match threshold (50% Jaccard similarity)
      if (matchScore < 0.5) continue;
      
      // Check for distinguishing terms - if one has a country/person and other doesn't match, skip
      const polyDistinguishing = poly.keywords.filter(k => DISTINGUISHING_TERMS.includes(k));
      const kalshiDistinguishing = kalshi.keywords.filter(k => DISTINGUISHING_TERMS.includes(k));
      
      // If both have distinguishing terms, they must overlap
      if (polyDistinguishing.length > 0 && kalshiDistinguishing.length > 0) {
        const distinguishingOverlap = polyDistinguishing.filter(k => kalshiDistinguishing.includes(k));
        if (distinguishingOverlap.length === 0) continue; // Different countries/entities
      }
      
      // Calculate price differences
      const yesSpread = kalshi.yesPrice - poly.yesPrice;
      const noSpread = kalshi.noPrice - poly.noPrice;
      
      // Only report if there's meaningful spread (>3%)
      const maxSpread = Math.max(Math.abs(yesSpread), Math.abs(noSpread));
      if (maxSpread < 0.03) continue;
      
      let recommendation = '';
      let potentialProfit = 0;
      
      if (yesSpread > 0.03) {
        recommendation = `Buy YES on Polymarket ($${poly.yesPrice.toFixed(2)}), sell YES on Kalshi ($${kalshi.yesPrice.toFixed(2)})`;
        potentialProfit = yesSpread;
      } else if (yesSpread < -0.03) {
        recommendation = `Buy YES on Kalshi ($${kalshi.yesPrice.toFixed(2)}), sell YES on Polymarket ($${poly.yesPrice.toFixed(2)})`;
        potentialProfit = -yesSpread;
      } else if (noSpread > 0.03) {
        recommendation = `Buy NO on Polymarket ($${poly.noPrice.toFixed(2)}), sell NO on Kalshi ($${kalshi.noPrice.toFixed(2)})`;
        potentialProfit = noSpread;
      } else if (noSpread < -0.03) {
        recommendation = `Buy NO on Kalshi ($${kalshi.noPrice.toFixed(2)}), sell NO on Polymarket ($${poly.noPrice.toFixed(2)})`;
        potentialProfit = -noSpread;
      }
      
      if (recommendation) {
        opportunities.push({
          polymarket: poly,
          kalshi: kalshi,
          matchScore,
          yesSpread,
          noSpread,
          potentialProfit,
          recommendation,
          matchedKeywords: overlap,
        });
      }
    }
  }
  
  // Sort by match score first (quality), then potential profit
  return opportunities.sort((a, b) => {
    if (Math.abs(a.matchScore - b.matchScore) > 0.1) return b.matchScore - a.matchScore;
    return b.potentialProfit - a.potentialProfit;
  });
}

// List prediction markets
app.get('/prediction/markets', async (c) => {
  const source = c.req.query('source'); // polymarket, kalshi, or all
  const category = c.req.query('category');
  const limit = parseInt(c.req.query('limit') || '50');
  
  const results: NormalizedMarket[] = [];
  
  if (!source || source === 'all' || source === 'polymarket') {
    const polyEvents = await fetchPolymarketEvents(limit);
    for (const event of polyEvents) {
      for (const market of event.markets || []) {
        results.push(normalizePolymarketMarket(event, market));
      }
    }
  }
  
  if (!source || source === 'all' || source === 'kalshi') {
    const kalshiEvents = await fetchKalshiEvents(limit);
    for (const event of kalshiEvents) {
      if (category && event.category !== category) continue;
      for (const market of event.markets || []) {
        results.push(normalizeKalshiMarket(event, market));
      }
    }
  }
  
  return c.json({
    count: results.length,
    markets: results,
    timestamp: new Date().toISOString(),
  });
});

// Get market prices
app.get('/prediction/prices/:marketId', async (c) => {
  const marketId = c.req.param('marketId');
  const source = c.req.query('source') || 'auto';
  
  // Try to determine source from ID format
  let result: NormalizedMarket | null = null;
  
  if (source === 'kalshi' || (source === 'auto' && marketId.match(/^[A-Z0-9-]+$/))) {
    const market = await fetchKalshiMarket(marketId);
    if (market) {
      result = normalizeKalshiMarket({ event_ticker: market.event_ticker, title: '', category: '', mutually_exclusive: false, markets: [] }, market);
    }
  }
  
  if (!result && (source === 'polymarket' || source === 'auto')) {
    // For Polymarket, we'd need to fetch by condition_id - simplified here
    const events = await fetchPolymarketEvents(100);
    for (const event of events) {
      for (const market of event.markets || []) {
        if (market.id === marketId || market.condition_id === marketId) {
          result = normalizePolymarketMarket(event, market);
          break;
        }
      }
      if (result) break;
    }
  }
  
  if (!result) {
    return c.json({ error: 'Market not found', marketId }, 404);
  }
  
  return c.json({
    market: result,
    timestamp: new Date().toISOString(),
  });
});

// Find arbitrage opportunities
app.get('/prediction/arbitrage', async (c) => {
  const minSpread = parseFloat(c.req.query('min_spread') || '0.02');
  const limit = parseInt(c.req.query('limit') || '20');
  
  // Fetch markets from both platforms
  const [polyEvents, kalshiEvents] = await Promise.all([
    fetchPolymarketEvents(100),
    fetchKalshiEvents(100),
  ]);
  
  // Normalize all markets
  const polymarkets: NormalizedMarket[] = [];
  for (const event of polyEvents) {
    for (const market of event.markets || []) {
      polymarkets.push(normalizePolymarketMarket(event, market));
    }
  }
  
  const kalshiMarkets: NormalizedMarket[] = [];
  for (const event of kalshiEvents) {
    for (const market of event.markets || []) {
      kalshiMarkets.push(normalizeKalshiMarket(event, market));
    }
  }
  
  // Find arbitrage opportunities
  let opportunities = findArbitrageOpportunities(polymarkets, kalshiMarkets);
  
  // Filter by minimum spread
  opportunities = opportunities.filter(o => o.potentialProfit >= minSpread);
  
  return c.json({
    count: opportunities.length,
    opportunities: opportunities.slice(0, limit),
    markets_analyzed: {
      polymarket: polymarkets.length,
      kalshi: kalshiMarkets.length,
    },
    timestamp: new Date().toISOString(),
  });
});

// Get specific event details
app.get('/prediction/event/:eventId', async (c) => {
  const eventId = c.req.param('eventId');
  const source = c.req.query('source') || 'auto';
  
  let result: any = null;
  
  if (source === 'kalshi' || source === 'auto') {
    try {
      const response = await fetch(`${CONFIG.kalshiUrl}/events/${eventId}`);
      if (response.ok) {
        const data = await response.json();
        result = { source: 'kalshi', event: data.event };
      }
    } catch {}
  }
  
  if (!result && (source === 'polymarket' || source === 'auto')) {
    try {
      const response = await fetch(`${CONFIG.polymarketUrl}/live-activity/events/${eventId}`);
      if (response.ok) {
        result = { source: 'polymarket', event: await response.json() };
      }
    } catch {}
  }
  
  if (!result) {
    return c.json({ error: 'Event not found', eventId }, 404);
  }
  
  return c.json({
    ...result,
    timestamp: new Date().toISOString(),
  });
});

// =============================================================================
// FDIC BANK HEALTH ENDPOINTS (NEW)
// =============================================================================

interface FDICInstitution {
  data: {
    CERT: string;
    NAME: string;
    CITY: string;
    STNAME: string;
    ASSET: string;
    DEP: string;
    DEPDOM: string;
    NETINC: string;
    ROA: string;
    ROE: string;
    EQUITY: string;
    OFFDOM: string;
    ACTIVE: string;
    DATEUPDT: string;
    WEBADDR: string;
    STALP: string;
    ZIP: string;
    ADDRESS: string;
    CHARTER: string;
    CHRTAGNT: string;
    INSFDIC: string;
    RISDATE: string;
    CB: string;
    SPECGRP: string;
  };
}

interface FDICFinancials {
  CERT: string;
  REPDTE: string;
  ASSET: number;
  DEP: number;
  NETINC: number;
  ROA: number;
  ROE: number;
  EQTOT: number;
  LNLSGR: number;
  LNLSNET: number;
  NCLNLS: number;
  P3ASSET: number;
  P9ASSET: number;
  NIMY: number;
  ERTEFNS: number;
  NPERFV: number;
}

interface BankHealthScore {
  cert: string;
  name: string;
  overall_score: number;  // 0-100
  risk_level: 'low' | 'moderate' | 'elevated' | 'high';
  factors: {
    capital_adequacy: number;
    asset_quality: number;
    profitability: number;
    liquidity: number;
  };
  red_flags: string[];
  last_updated: string;
}

// Search FDIC institutions
app.get('/banks/search', async (c) => {
  const name = c.req.query('name');
  const state = c.req.query('state');
  const city = c.req.query('city');
  const activeOnly = c.req.query('active') !== 'false';
  const limit = parseInt(c.req.query('limit') || '25');
  
  // Build URL - FDIC search doesn't combine well with filters
  // So we fetch more and filter in code
  const params = new URLSearchParams();
  params.set('limit', String(Math.min(limit * 3, 100))); // Fetch extra for filtering
  params.set('fields', 'CERT,NAME,CITY,STNAME,STALP,ASSET,DEP,NETINC,ROA,ROE,WEBADDR,DATEUPDT,ACTIVE');
  
  // Use search for name (primary), or filters for state/city only
  // Note: FDIC search requires field prefix like NAME:query
  if (name) {
    params.set('search', `NAME:${name}`);
  } else {
    // Without name search, we can use filters
    const filters: string[] = [];
    if (activeOnly) filters.push('ACTIVE:1');
    if (state) filters.push(`STALP:${state.toUpperCase()}`);
    if (city) filters.push(`CITY:${encodeURIComponent(city)}`);
    if (filters.length > 0) {
      params.set('filters', filters.join(','));
    }
  }
  
  const url = `${CONFIG.fdicUrl}/institutions?${params.toString()}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`FDIC API error: ${response.status}`);
    const data = await response.json();
    
    // Filter results in code
    let results = (data.data || []).map((item: any) => item.data);
    
    // Apply additional filters
    if (activeOnly) {
      results = results.filter((inst: any) => inst.ACTIVE === 1);
    }
    if (state && name) { // State filter when combined with name search
      results = results.filter((inst: any) => inst.STALP?.toUpperCase() === state.toUpperCase());
    }
    if (city && name) {
      results = results.filter((inst: any) => inst.CITY?.toLowerCase().includes(city.toLowerCase()));
    }
    
    // Limit final results
    results = results.slice(0, limit);
    
    return c.json({
      count: results.length,
      institutions: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get institution by certificate number
app.get('/banks/institution/:cert', async (c) => {
  const cert = c.req.param('cert');
  
  const url = `${CONFIG.fdicUrl}/institutions?filters=CERT:${cert}&fields=CERT,NAME,CITY,STNAME,STALP,ADDRESS,ZIP,ASSET,DEP,DEPDOM,NETINC,ROA,ROE,EQUITY,DATEUPDT,WEBADDR,CHARTER,CHRTAGNT,INSFDIC,RISDATE,CB,SPECGRP,ACTIVE`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`FDIC API error: ${response.status}`);
    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      return c.json({ error: 'Institution not found', cert }, 404);
    }
    
    return c.json({
      institution: data.data[0].data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get bank financials (call report data)
app.get('/banks/financials/:cert', async (c) => {
  const cert = c.req.param('cert');
  const periods = c.req.query('periods') || '4';
  
  const url = `${CONFIG.fdicUrl}/financials?filters=CERT:${cert}&limit=${periods}&sort_by=REPDTE&sort_order=DESC&fields=CERT,REPDTE,ASSET,DEP,NETINC,ROA,ROE,EQTOT,LNLSGR,LNLSNET,NCLNLS,P3ASSET,P9ASSET,NIMY,ERTEFNS,NPERFV`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`FDIC API error: ${response.status}`);
    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      return c.json({ error: 'Financials not found', cert }, 404);
    }
    
    // Calculate trends if we have multiple periods
    const financials = data.data.map((item: any) => item.data);
    let trends: any = null;
    
    if (financials.length >= 2) {
      const latest = financials[0];
      const previous = financials[1];
      trends = {
        asset_growth: ((latest.ASSET - previous.ASSET) / previous.ASSET * 100).toFixed(2) + '%',
        deposit_growth: ((latest.DEP - previous.DEP) / previous.DEP * 100).toFixed(2) + '%',
        income_change: ((latest.NETINC - previous.NETINC) / Math.abs(previous.NETINC) * 100).toFixed(2) + '%',
        roa_change: (latest.ROA - previous.ROA).toFixed(4),
        roe_change: (latest.ROE - previous.ROE).toFixed(4),
      };
    }
    
    return c.json({
      cert,
      periods: financials.length,
      financials,
      trends,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Compute bank health score
app.get('/banks/health/:cert', async (c) => {
  const cert = c.req.param('cert');
  
  try {
    // Fetch institution info and financials
    const [instResponse, finResponse] = await Promise.all([
      fetch(`${CONFIG.fdicUrl}/institutions?filters=CERT:${cert}&fields=CERT,NAME,ASSET,DEP,ROA,ROE,EQUITY,DATEUPDT`),
      fetch(`${CONFIG.fdicUrl}/financials?filters=CERT:${cert}&limit=4&sort_by=REPDTE&sort_order=DESC&fields=CERT,REPDTE,ASSET,DEP,NETINC,ROA,ROE,EQTOT,LNLSNET,NCLNLS,P3ASSET,P9ASSET,NIMY`),
    ]);
    
    const instData = await instResponse.json();
    const finData = await finResponse.json();
    
    if (!instData.data || instData.data.length === 0) {
      return c.json({ error: 'Institution not found', cert }, 404);
    }
    
    const inst = instData.data[0].data;
    const financials = finData.data?.map((item: any) => item.data) || [];
    const latest = financials[0] || {};
    
    // Calculate health factors
    const redFlags: string[] = [];
    
    // Capital Adequacy (equity to assets ratio)
    const equityRatio = latest.EQTOT && latest.ASSET ? (latest.EQTOT / latest.ASSET) * 100 : 0;
    let capitalScore = Math.min(100, equityRatio * 10); // 10% equity = 100 score
    if (equityRatio < 5) redFlags.push('Low equity-to-asset ratio (<5%)');
    if (equityRatio < 3) redFlags.push('CRITICAL: Equity ratio below 3%');
    
    // Asset Quality (non-current loans to total loans)
    const nclRatio = latest.LNLSNET && latest.NCLNLS ? (latest.NCLNLS / latest.LNLSNET) * 100 : 0;
    let assetScore = Math.max(0, 100 - (nclRatio * 20)); // 5% NCL = 0 score
    if (nclRatio > 2) redFlags.push('Elevated non-current loan ratio (>2%)');
    if (nclRatio > 5) redFlags.push('CRITICAL: Very high non-current loans (>5%)');
    
    // Profitability (ROA)
    const roa = latest.ROA || 0;
    let profitScore = Math.min(100, (roa + 0.5) * 100); // -0.5% = 0, 0.5% = 100
    if (roa < 0) redFlags.push('Negative return on assets');
    if (roa < -0.5) redFlags.push('CRITICAL: Severe losses (ROA < -0.5%)');
    
    // Liquidity (net interest margin as proxy)
    const nim = latest.NIMY || 0;
    let liquidityScore = Math.min(100, nim * 30); // 3.3% NIM = 100 score
    if (nim < 2) redFlags.push('Low net interest margin (<2%)');
    
    // Check for declining trends
    if (financials.length >= 2) {
      const prev = financials[1];
      if (latest.ASSET < prev.ASSET * 0.95) redFlags.push('Significant asset decline (>5% QoQ)');
      if (latest.DEP < prev.DEP * 0.9) redFlags.push('Major deposit outflow (>10% QoQ)');
      if (latest.NETINC < 0 && prev.NETINC > 0) redFlags.push('Turned unprofitable');
    }
    
    // Calculate overall score
    const overallScore = Math.round(
      (capitalScore * 0.30) +
      (assetScore * 0.30) +
      (profitScore * 0.25) +
      (liquidityScore * 0.15)
    );
    
    // Determine risk level
    let riskLevel: 'low' | 'moderate' | 'elevated' | 'high';
    if (overallScore >= 75) riskLevel = 'low';
    else if (overallScore >= 50) riskLevel = 'moderate';
    else if (overallScore >= 25) riskLevel = 'elevated';
    else riskLevel = 'high';
    
    // Adjust for critical red flags
    if (redFlags.some(f => f.startsWith('CRITICAL'))) {
      riskLevel = 'high';
    }
    
    const healthScore: BankHealthScore = {
      cert,
      name: inst.NAME,
      overall_score: overallScore,
      risk_level: riskLevel,
      factors: {
        capital_adequacy: Math.round(capitalScore),
        asset_quality: Math.round(assetScore),
        profitability: Math.round(profitScore),
        liquidity: Math.round(liquidityScore),
      },
      red_flags: redFlags,
      last_updated: inst.DATEUPDT || latest.REPDTE,
    };
    
    return c.json({
      health: healthScore,
      metrics: {
        equity_ratio: equityRatio.toFixed(2) + '%',
        ncl_ratio: nclRatio.toFixed(2) + '%',
        roa: roa.toFixed(2) + '%',
        nim: nim.toFixed(2) + '%',
        total_assets: `$${(latest.ASSET / 1000).toFixed(1)}B`,
        total_deposits: `$${(latest.DEP / 1000).toFixed(1)}B`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get recent bank failures
app.get('/banks/failures', async (c) => {
  const limit = c.req.query('limit') || '25';
  const year = c.req.query('year');
  
  let url = `${CONFIG.fdicUrl}/failures?limit=${limit}&sort_by=FAILDATE&sort_order=DESC`;
  if (year) url += `&filters=FAILYR:${year}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`FDIC API error: ${response.status}`);
    const data = await response.json();
    
    return c.json({
      count: data.data?.length || 0,
      failures: data.data?.map((item: any) => ({
        cert: item.data.CERT,
        name: item.data.NAME,
        city: item.data.CITYST,
        state: item.data.STALP,
        fail_date: item.data.FAILDATE,
        closing_date: item.data.CLDATE,
        total_assets: item.data.QBFASSET,
        total_deposits: item.data.QBFDEP,
        estimated_loss: item.data.COST,
        acquiring_institution: item.data.ACQUIRER,
        failure_reason: item.data.RESTYPE,
      })) || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Find banks showing stress signals (at-risk)
app.get('/banks/at-risk', async (c) => {
  const minAssets = parseInt(c.req.query('min_assets') || '100') * 1000; // Convert to thousands (FDIC uses thousands)
  const limit = parseInt(c.req.query('limit') || '50');
  
  try {
    // Get recent report date cutoff (1 year ago)
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
    const cutoffYYYYMMDD = cutoffDate.toISOString().slice(0, 10).replace(/-/g, '');
    
    // FDIC API doesn't support combining range filters well, so we:
    // 1. Filter by recent date only
    // 2. Filter by asset size in code
    // 3. Sort by ROA to find distressed banks
    const dateFilter = `REPDTE%3A%5B${cutoffYYYYMMDD}%20TO%20*%5D`;
    const url = `${CONFIG.fdicUrl}/financials?filters=${dateFilter}&sort_by=ROA&sort_order=ASC&limit=500&fields=CERT,REPDTE,ASSET,DEP,NETINC,ROA,ROE,EQTOT,NCLNLS,LNLSNET`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`FDIC API error: ${response.status}`);
    const data = await response.json();
    
    const atRisk: any[] = [];
    const seenCerts = new Set<string>(); // Avoid duplicates (same bank multiple quarters)
    
    for (const item of data.data || []) {
      const fin = item.data;
      
      // Filter by asset size in code
      if (fin.ASSET < minAssets) continue;
      
      // Skip if we've already seen this bank (keep most recent)
      if (seenCerts.has(fin.CERT)) continue;
      seenCerts.add(fin.CERT);
      
      const equityRatio = fin.EQTOT && fin.ASSET ? (fin.EQTOT / fin.ASSET) * 100 : 0;
      const nclRatio = fin.LNLSNET && fin.NCLNLS ? (fin.NCLNLS / fin.LNLSNET) * 100 : 0;
      
      const stressSignals: string[] = [];
      if (fin.ROA < 0) stressSignals.push('Negative ROA');
      if (fin.NETINC < 0) stressSignals.push('Net loss');
      if (equityRatio < 5) stressSignals.push('Low capital');
      if (nclRatio > 3) stressSignals.push('High NCL ratio');
      
      if (stressSignals.length >= 2) {
        atRisk.push({
          cert: fin.CERT,
          report_date: fin.REPDTE,
          total_assets: `$${(fin.ASSET / 1000).toFixed(1)}B`,
          roa: fin.ROA?.toFixed(2) + '%',
          equity_ratio: equityRatio.toFixed(2) + '%',
          ncl_ratio: nclRatio.toFixed(2) + '%',
          stress_signals: stressSignals,
          signal_count: stressSignals.length,
        });
      }
    }
    
    // Sort by number of stress signals, then by ROA
    atRisk.sort((a, b) => {
      if (b.signal_count !== a.signal_count) return b.signal_count - a.signal_count;
      return parseFloat(a.roa) - parseFloat(b.roa);
    });
    
    return c.json({
      count: atRisk.length,
      note: 'Banks showing 2+ stress indicators (last 12 months). This is not investment advice.',
      filters: { min_assets_millions: minAssets / 1000, report_date_after: cutoffYYYYMMDD },
      at_risk_banks: atRisk.slice(0, limit),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================================
// FRED ECONOMIC INDICATORS ENDPOINTS (NEW)
// =============================================================================

// Key economic series
const FRED_KEY_SERIES = {
  // GDP & Growth
  'GDP': { name: 'Gross Domestic Product', frequency: 'quarterly', category: 'gdp' },
  'GDPC1': { name: 'Real GDP', frequency: 'quarterly', category: 'gdp' },
  'A191RL1Q225SBEA': { name: 'Real GDP Growth Rate', frequency: 'quarterly', category: 'gdp' },
  
  // Inflation
  'CPIAUCSL': { name: 'Consumer Price Index', frequency: 'monthly', category: 'inflation' },
  'CPILFESL': { name: 'Core CPI (ex Food & Energy)', frequency: 'monthly', category: 'inflation' },
  'PCEPI': { name: 'PCE Price Index', frequency: 'monthly', category: 'inflation' },
  'T5YIE': { name: '5-Year Breakeven Inflation', frequency: 'daily', category: 'inflation' },
  
  // Employment
  'UNRATE': { name: 'Unemployment Rate', frequency: 'monthly', category: 'employment' },
  'PAYEMS': { name: 'Nonfarm Payrolls', frequency: 'monthly', category: 'employment' },
  'ICSA': { name: 'Initial Jobless Claims', frequency: 'weekly', category: 'employment' },
  'JTSJOL': { name: 'Job Openings (JOLTS)', frequency: 'monthly', category: 'employment' },
  
  // Interest Rates
  'FEDFUNDS': { name: 'Federal Funds Rate', frequency: 'monthly', category: 'rates' },
  'DFF': { name: 'Fed Funds Effective Rate (Daily)', frequency: 'daily', category: 'rates' },
  'DGS10': { name: '10-Year Treasury Yield', frequency: 'daily', category: 'rates' },
  'DGS2': { name: '2-Year Treasury Yield', frequency: 'daily', category: 'rates' },
  'T10Y2Y': { name: '10Y-2Y Yield Spread', frequency: 'daily', category: 'rates' },
  'T10Y3M': { name: '10Y-3M Yield Spread', frequency: 'daily', category: 'rates' },
  
  // Money Supply
  'M2SL': { name: 'M2 Money Supply', frequency: 'monthly', category: 'money' },
  'WALCL': { name: 'Fed Balance Sheet', frequency: 'weekly', category: 'money' },
  
  // Consumer & Sentiment
  'UMCSENT': { name: 'Consumer Sentiment (UMich)', frequency: 'monthly', category: 'sentiment' },
  'RSAFS': { name: 'Retail Sales', frequency: 'monthly', category: 'consumer' },
  'PCE': { name: 'Personal Consumption Expenditures', frequency: 'monthly', category: 'consumer' },
  
  // Housing
  'HOUST': { name: 'Housing Starts', frequency: 'monthly', category: 'housing' },
  'CSUSHPINSA': { name: 'Case-Shiller Home Price Index', frequency: 'monthly', category: 'housing' },
  'MORTGAGE30US': { name: '30-Year Mortgage Rate', frequency: 'weekly', category: 'housing' },
  
  // Manufacturing & Trade
  'INDPRO': { name: 'Industrial Production', frequency: 'monthly', category: 'manufacturing' },
  'DGORDER': { name: 'Durable Goods Orders', frequency: 'monthly', category: 'manufacturing' },
  'BOPGSTB': { name: 'Trade Balance', frequency: 'monthly', category: 'trade' },
};

async function fetchFredSeries(seriesId: string, limit = 10): Promise<any> {
  if (!CONFIG.fredApiKey) {
    throw new Error('FRED_API_KEY not configured');
  }
  
  // Check cache first
  const cacheKey = `fred:${seriesId}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  const url = `${CONFIG.fredUrl}/series/observations?series_id=${seriesId}&api_key=${CONFIG.fredApiKey}&file_type=json&sort_order=desc&limit=${limit}`;
  
  const response = await fetchWithTimeout(url, {}, 10000);
  if (!response.ok) throw new Error(`FRED API error: ${response.status}`);
  const data = await response.json();
  
  // Cache for 5 minutes (economic data doesn't change frequently)
  setCache(cacheKey, data, CACHE_TTL.medium);
  return data;
}

async function fetchFredSeriesInfo(seriesId: string): Promise<any> {
  if (!CONFIG.fredApiKey) {
    throw new Error('FRED_API_KEY not configured');
  }
  
  // Check cache first
  const cacheKey = `fred:info:${seriesId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  const url = `${CONFIG.fredUrl}/series?series_id=${seriesId}&api_key=${CONFIG.fredApiKey}&file_type=json`;
  
  const response = await fetchWithTimeout(url, {}, 10000);
  if (!response.ok) throw new Error(`FRED API error: ${response.status}`);
  const data = await response.json();
  
  // Cache for 30 minutes (series info is static)
  setCache(cacheKey, data, CACHE_TTL.long);
  return data;
}

// Get single FRED series
app.get('/fred/series/:seriesId', async (c) => {
  const seriesId = c.req.param('seriesId').toUpperCase();
  const limit = c.req.query('limit') || '20';
  const startDate = c.req.query('start');
  const endDate = c.req.query('end');
  
  try {
    let url = `${CONFIG.fredUrl}/series/observations?series_id=${seriesId}&api_key=${CONFIG.fredApiKey}&file_type=json&sort_order=desc&limit=${limit}`;
    if (startDate) url += `&observation_start=${startDate}`;
    if (endDate) url += `&observation_end=${endDate}`;
    
    const [dataResponse, infoResponse] = await Promise.all([
      fetch(url),
      fetchFredSeriesInfo(seriesId),
    ]);
    
    if (!dataResponse.ok) throw new Error(`FRED API error: ${dataResponse.status}`);
    const data = await dataResponse.json();
    
    const seriesMeta = FRED_KEY_SERIES[seriesId as keyof typeof FRED_KEY_SERIES];
    const seriesInfo = infoResponse.seriess?.[0];
    
    return c.json({
      series_id: seriesId,
      name: seriesMeta?.name || seriesInfo?.title || seriesId,
      category: seriesMeta?.category || 'other',
      frequency: seriesMeta?.frequency || seriesInfo?.frequency_short,
      units: seriesInfo?.units_short,
      observations: data.observations?.map((obs: any) => ({
        date: obs.date,
        value: obs.value === '.' ? null : parseFloat(obs.value),
      })) || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get key economic indicators summary
app.get('/fred/indicators', async (c) => {
  const category = c.req.query('category'); // gdp, inflation, employment, rates, etc.
  
  if (!CONFIG.fredApiKey) {
    return c.json({ error: 'FRED_API_KEY not configured' }, 500);
  }
  
  try {
    // Filter series by category if specified
    let seriesToFetch = Object.entries(FRED_KEY_SERIES);
    if (category) {
      seriesToFetch = seriesToFetch.filter(([_, meta]) => meta.category === category);
    }
    
    // Limit to avoid too many parallel requests
    seriesToFetch = seriesToFetch.slice(0, 15);
    
    const results = await Promise.allSettled(
      seriesToFetch.map(async ([seriesId, meta]) => {
        const data = await fetchFredSeries(seriesId, 2);
        const observations = data.observations || [];
        const latest = observations[0];
        const previous = observations[1];
        
        return {
          series_id: seriesId,
          name: meta.name,
          category: meta.category,
          frequency: meta.frequency,
          latest_value: latest?.value === '.' ? null : parseFloat(latest?.value),
          latest_date: latest?.date,
          previous_value: previous?.value === '.' ? null : parseFloat(previous?.value),
          change: latest && previous && latest.value !== '.' && previous.value !== '.'
            ? parseFloat(latest.value) - parseFloat(previous.value)
            : null,
        };
      })
    );
    
    const indicators = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);
    
    // Group by category
    const byCategory: Record<string, any[]> = {};
    for (const ind of indicators) {
      if (!byCategory[ind.category]) byCategory[ind.category] = [];
      byCategory[ind.category].push(ind);
    }
    
    return c.json({
      count: indicators.length,
      categories: Object.keys(byCategory),
      indicators: category ? indicators : byCategory,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Economic dashboard - comprehensive view
app.get('/fred/dashboard', async (c) => {
  if (!CONFIG.fredApiKey) {
    return c.json({ error: 'FRED_API_KEY not configured' }, 500);
  }
  
  // Core dashboard series
  const dashboardSeries = [
    'GDPC1',      // Real GDP
    'CPIAUCSL',   // CPI
    'UNRATE',     // Unemployment
    'FEDFUNDS',   // Fed Funds
    'DGS10',      // 10Y Treasury
    'T10Y2Y',     // Yield curve
    'M2SL',       // Money supply
    'UMCSENT',    // Consumer sentiment
  ];
  
  try {
    const results = await Promise.allSettled(
      dashboardSeries.map(async (seriesId) => {
        const data = await fetchFredSeries(seriesId, 5);
        const meta = FRED_KEY_SERIES[seriesId as keyof typeof FRED_KEY_SERIES];
        const observations = data.observations || [];
        
        return {
          series_id: seriesId,
          name: meta?.name || seriesId,
          category: meta?.category,
          observations: observations.map((obs: any) => ({
            date: obs.date,
            value: obs.value === '.' ? null : parseFloat(obs.value),
          })),
        };
      })
    );
    
    const dashboard: Record<string, any> = {};
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const data = result.value;
        const latest = data.observations[0];
        const oldest = data.observations[data.observations.length - 1];
        
        dashboard[data.series_id] = {
          name: data.name,
          category: data.category,
          current: latest?.value,
          current_date: latest?.date,
          trend: data.observations,
          change_period: oldest && latest && latest.value && oldest.value
            ? ((latest.value - oldest.value) / oldest.value * 100).toFixed(2) + '%'
            : null,
        };
      }
    }
    
    // Generate summary insights
    const insights: string[] = [];
    
    if (dashboard.T10Y2Y?.current < 0) {
      insights.push('⚠️ Yield curve inverted (recession signal)');
    }
    if (dashboard.UNRATE?.current > 5) {
      insights.push('📈 Elevated unemployment rate (>5%)');
    }
    if (dashboard.CPIAUCSL?.change_period && parseFloat(dashboard.CPIAUCSL.change_period) > 3) {
      insights.push('🔥 Inflation running above 3% annualized');
    }
    if (dashboard.UMCSENT?.current < 70) {
      insights.push('😟 Consumer sentiment below historical average');
    }
    
    return c.json({
      dashboard,
      insights,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Search FRED series
app.get('/fred/search', async (c) => {
  const query = c.req.query('q');
  const limit = c.req.query('limit') || '25';
  
  if (!query) {
    return c.json({ error: 'Query parameter q is required' }, 400);
  }
  
  if (!CONFIG.fredApiKey) {
    return c.json({ error: 'FRED_API_KEY not configured' }, 500);
  }
  
  try {
    const url = `${CONFIG.fredUrl}/series/search?search_text=${encodeURIComponent(query)}&api_key=${CONFIG.fredApiKey}&file_type=json&limit=${limit}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`FRED API error: ${response.status}`);
    const data = await response.json();
    
    return c.json({
      count: data.seriess?.length || 0,
      series: data.seriess?.map((s: any) => ({
        id: s.id,
        title: s.title,
        frequency: s.frequency_short,
        units: s.units_short,
        seasonal_adjustment: s.seasonal_adjustment_short,
        last_updated: s.last_updated,
        popularity: s.popularity,
      })) || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================================
// US Treasury Fiscal Data (100% Free - fiscaldata.treasury.gov)
// =============================================================================

// National debt levels
app.get('/treasury/debt', async (c) => {
  const cacheKey = 'treasury:debt';
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.treasuryUrl}/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=30`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Treasury API error: ${response.status}`);
    const data = await response.json();
    
    const records = data.data || [];
    const latest = records[0];
    const monthAgo = records.find((r: any) => {
      const d = new Date(r.record_date);
      const now = new Date(latest.record_date);
      return (now.getTime() - d.getTime()) >= 25 * 24 * 60 * 60 * 1000;
    });
    
    const result = {
      total_debt: parseFloat(latest?.tot_pub_debt_out_amt || 0),
      debt_held_public: parseFloat(latest?.debt_held_public_amt || 0),
      intragovernmental: parseFloat(latest?.intragov_hold_amt || 0),
      record_date: latest?.record_date,
      change_30d: monthAgo ? parseFloat(latest.tot_pub_debt_out_amt) - parseFloat(monthAgo.tot_pub_debt_out_amt) : null,
      trend: records.slice(0, 10).map((r: any) => ({
        date: r.record_date,
        total: parseFloat(r.tot_pub_debt_out_amt),
      })),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Federal spending by category
app.get('/treasury/spending', async (c) => {
  const fiscalYear = c.req.query('year') || new Date().getFullYear().toString();
  const cacheKey = `treasury:spending:${fiscalYear}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    // Use v1 API and filter for top-level categories only
    const url = `${CONFIG.treasuryUrl}/v1/accounting/mts/mts_table_5?filter=record_fiscal_year:eq:${fiscalYear},sequence_level_nbr:eq:2&sort=-current_fytd_net_outly_amt&page[size]=50`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Treasury API error: ${response.status}`);
    const data = await response.json();
    
    const records = (data.data || []).filter((r: any) => 
      r.current_fytd_net_outly_amt && r.current_fytd_net_outly_amt !== 'null'
    );
    const result = {
      fiscal_year: fiscalYear,
      categories: records.slice(0, 20).map((r: any) => ({
        category: r.classification_desc,
        ytd_spending: parseFloat(r.current_fytd_net_outly_amt || 0),
        prior_ytd: parseFloat(r.prior_fytd_net_outly_amt || 0),
      })),
      total_ytd: records.reduce((sum: number, r: any) => sum + parseFloat(r.current_fytd_net_outly_amt || 0), 0),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.long);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Federal revenue
app.get('/treasury/revenue', async (c) => {
  const fiscalYear = c.req.query('year') || new Date().getFullYear().toString();
  const cacheKey = `treasury:revenue:${fiscalYear}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    // Use v1 API and filter for top-level categories
    const url = `${CONFIG.treasuryUrl}/v1/accounting/mts/mts_table_4?filter=record_fiscal_year:eq:${fiscalYear},sequence_level_nbr:eq:2&sort=-current_fytd_net_rcpt_amt&page[size]=50`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Treasury API error: ${response.status}`);
    const data = await response.json();
    
    const records = (data.data || []).filter((r: any) => 
      r.current_fytd_net_rcpt_amt && r.current_fytd_net_rcpt_amt !== 'null'
    );
    const result = {
      fiscal_year: fiscalYear,
      sources: records.slice(0, 20).map((r: any) => ({
        source: r.classification_desc,
        ytd_revenue: parseFloat(r.current_fytd_net_rcpt_amt || 0),
        prior_ytd: parseFloat(r.prior_fytd_net_rcpt_amt || 0),
      })),
      total_ytd: records.reduce((sum: number, r: any) => sum + parseFloat(r.current_fytd_net_rcpt_amt || 0), 0),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.long);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Treasury auction results
app.get('/treasury/auctions', async (c) => {
  const securityType = c.req.query('type') || 'all';
  const cacheKey = `treasury:auctions:${securityType}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    // Use v1 API with auctions_query endpoint
    let url = `${CONFIG.treasuryUrl}/v1/accounting/od/auctions_query?sort=-auction_date&page[size]=20`;
    if (securityType !== 'all') {
      url += `&filter=security_type:eq:${securityType}`;
    }
    
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Treasury API error: ${response.status}`);
    const data = await response.json();
    
    const result = {
      auctions: (data.data || []).map((r: any) => ({
        cusip: r.cusip,
        security_type: r.security_type,
        security_term: r.security_term,
        auction_date: r.auction_date,
        issue_date: r.issue_date,
        maturity_date: r.maturity_date,
        offering_amt: r.offering_amt ? parseFloat(r.offering_amt) : null,
        high_yield: r.high_yield && r.high_yield !== 'null' ? parseFloat(r.high_yield) : null,
        high_rate: r.high_investment_rate && r.high_investment_rate !== 'null' ? parseFloat(r.high_investment_rate) : null,
        total_accepted: r.total_accepted && r.total_accepted !== 'null' ? parseFloat(r.total_accepted) : null,
        bid_to_cover: r.bid_to_cover_ratio && r.bid_to_cover_ratio !== 'null' ? parseFloat(r.bid_to_cover_ratio) : null,
      })),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Treasury fiscal dashboard
app.get('/treasury/dashboard', async (c) => {
  const cacheKey = 'treasury:dashboard';
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    // Get debt and spending data
    const [debtRes, spendingRes] = await Promise.all([
      fetchWithTimeout(`${CONFIG.treasuryUrl}/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=30`, {}, DEFAULT_TIMEOUT),
      fetchWithTimeout(`${CONFIG.treasuryUrl}/v1/accounting/mts/mts_table_5?filter=classification_desc:eq:Total--Loss on disposition of assets&sort=-record_date&page[size]=12`, {}, DEFAULT_TIMEOUT).catch(() => ({ ok: false })),
    ]);
    
    const debtData = await debtRes.json();
    const debtRecords = debtData.data || [];
    const latestDebt = debtRecords[0];
    const monthAgo = debtRecords.find((r: any) => {
      const d = new Date(r.record_date);
      const now = new Date(latestDebt.record_date);
      return (now.getTime() - d.getTime()) >= 25 * 24 * 60 * 60 * 1000;
    });
    
    const result = {
      national_debt: {
        total: parseFloat(latestDebt?.tot_pub_debt_out_amt || 0),
        debt_held_public: parseFloat(latestDebt?.debt_held_public_amt || 0),
        intragovernmental: parseFloat(latestDebt?.intragov_hold_amt || 0),
        date: latestDebt?.record_date,
        change_30d: monthAgo ? parseFloat(latestDebt.tot_pub_debt_out_amt) - parseFloat(monthAgo.tot_pub_debt_out_amt) : null,
      },
      debt_trend: debtRecords.slice(0, 10).map((r: any) => ({
        date: r.record_date,
        total: parseFloat(r.tot_pub_debt_out_amt),
      })),
      insights: [] as string[],
      timestamp: new Date().toISOString(),
    };
    
    // Add insights
    if (result.national_debt.total > 35_000_000_000_000) {
      result.insights.push('⚠️ National debt exceeds $35 trillion');
    }
    if (result.national_debt.total > 36_000_000_000_000) {
      result.insights.push('🔴 National debt exceeds $36 trillion');
    }
    if (result.national_debt.change_30d && result.national_debt.change_30d > 200_000_000_000) {
      result.insights.push('📈 Debt increased >$200B in past 30 days');
    }
    
    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================================
// Forex/Currency Exchange (100% Free - fawazahmed0/exchange-api)
// =============================================================================

// Current exchange rates
app.get('/forex/rates', async (c) => {
  const base = (c.req.query('base') || 'usd').toLowerCase();
  const cacheKey = `forex:rates:${base}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.forexUrl}/currencies/${base}.json`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Forex API error: ${response.status}`);
    const data = await response.json();
    
    const rates = data[base] || {};
    const majorCurrencies = ['eur', 'gbp', 'jpy', 'cad', 'aud', 'chf', 'cny', 'inr', 'krw', 'mxn', 'brl', 'sgd', 'hkd'];
    
    const result = {
      base: base.toUpperCase(),
      date: data.date,
      rates: Object.entries(rates)
        .filter(([k]) => k !== base)
        .reduce((acc, [k, v]) => ({ ...acc, [k.toUpperCase()]: v }), {}),
      major_pairs: majorCurrencies.reduce((acc, curr) => {
        if (rates[curr]) acc[`${base.toUpperCase()}/${curr.toUpperCase()}`] = rates[curr];
        return acc;
      }, {} as Record<string, number>),
      total_currencies: Object.keys(rates).length,
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.short);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Currency conversion
app.get('/forex/convert', async (c) => {
  const from = (c.req.query('from') || 'usd').toLowerCase();
  const to = (c.req.query('to') || 'eur').toLowerCase();
  const amount = parseFloat(c.req.query('amount') || '1');
  
  try {
    const url = `${CONFIG.forexUrl}/currencies/${from}.json`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Forex API error: ${response.status}`);
    const data = await response.json();
    
    const rate = data[from]?.[to];
    if (!rate) {
      return c.json({ error: `Rate not found for ${from.toUpperCase()}/${to.toUpperCase()}` }, 404);
    }
    
    return c.json({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      amount,
      rate,
      converted: amount * rate,
      date: data.date,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Historical forex rates
app.get('/forex/historical', async (c) => {
  const base = (c.req.query('base') || 'usd').toLowerCase();
  const date = c.req.query('date');
  
  if (!date) {
    return c.json({ error: 'Date parameter required (format: YYYY-MM-DD)' }, 400);
  }
  
  try {
    // The API uses a different structure for historical data
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${base}.json`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Forex API error: ${response.status} - Date may not be available`);
    const data = await response.json();
    
    return c.json({
      base: base.toUpperCase(),
      date: data.date || date,
      rates: data[base] || {},
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================================
// Crypto Prices (100% Free - CoinGecko)
// =============================================================================

// Current crypto prices
app.get('/crypto/prices', async (c) => {
  const ids = c.req.query('ids') || 'bitcoin,ethereum,solana,cardano,polkadot';
  const currency = (c.req.query('currency') || 'usd').toLowerCase();
  const cacheKey = `crypto:prices:${ids}:${currency}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.coingeckoUrl}/simple/price?ids=${ids}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
    const data = await response.json();
    
    const result = {
      currency: currency.toUpperCase(),
      prices: Object.entries(data).map(([id, values]: [string, any]) => ({
        id,
        price: values[currency],
        change_24h: values[`${currency}_24h_change`],
        market_cap: values[`${currency}_market_cap`],
        volume_24h: values[`${currency}_24h_vol`],
      })),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.short);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Crypto market data
app.get('/crypto/markets', async (c) => {
  const currency = (c.req.query('currency') || 'usd').toLowerCase();
  const limit = c.req.query('limit') || '50';
  const cacheKey = `crypto:markets:${currency}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.coingeckoUrl}/coins/markets?vs_currency=${currency}&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=1h,24h,7d`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
    const data = await response.json();
    
    const result = {
      currency: currency.toUpperCase(),
      count: data.length,
      markets: data.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol?.toUpperCase(),
        name: coin.name,
        price: coin.current_price,
        market_cap: coin.market_cap,
        market_cap_rank: coin.market_cap_rank,
        volume_24h: coin.total_volume,
        change_1h: coin.price_change_percentage_1h_in_currency,
        change_24h: coin.price_change_percentage_24h,
        change_7d: coin.price_change_percentage_7d_in_currency,
        ath: coin.ath,
        ath_change: coin.ath_change_percentage,
      })),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.short);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Historical crypto prices
app.get('/crypto/historical', async (c) => {
  const id = c.req.query('id') || 'bitcoin';
  const currency = (c.req.query('currency') || 'usd').toLowerCase();
  const days = c.req.query('days') || '30';
  const cacheKey = `crypto:historical:${id}:${currency}:${days}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.coingeckoUrl}/coins/${id}/market_chart?vs_currency=${currency}&days=${days}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
    const data = await response.json();
    
    const result = {
      id,
      currency: currency.toUpperCase(),
      days: parseInt(days),
      prices: data.prices?.map(([ts, price]: [number, number]) => ({
        date: new Date(ts).toISOString(),
        price,
      })) || [],
      market_caps: data.market_caps?.slice(-10).map(([ts, cap]: [number, number]) => ({
        date: new Date(ts).toISOString(),
        market_cap: cap,
      })) || [],
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================================
// SEC 13F Holdings (100% Free - EDGAR)
// =============================================================================

app.get('/sec/13f/:cik', async (c) => {
  const cik = c.req.param('cik').padStart(10, '0');
  const cacheKey = `sec:13f:${cik}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    // Get company info and recent filings
    const submissionsUrl = `${CONFIG.secEdgarUrl}/submissions/CIK${cik}.json`;
    const response = await fetchWithTimeout(submissionsUrl, {
      headers: { 'User-Agent': 'FinancialOracles/1.4.0 (contact@openclaw.ai)' }
    }, DEFAULT_TIMEOUT);
    
    if (!response.ok) throw new Error(`SEC EDGAR error: ${response.status}`);
    const data = await response.json();
    
    // Find recent 13F filings
    const filings = data.filings?.recent || {};
    const forms = filings.form || [];
    const dates = filings.filingDate || [];
    const accessionNumbers = filings.accessionNumber || [];
    
    const thirteenFs = forms.map((form: string, i: number) => ({
      form,
      date: dates[i],
      accessionNumber: accessionNumbers[i],
    })).filter((f: any) => f.form === '13F-HR' || f.form === '13F-HR/A').slice(0, 5);
    
    const result = {
      cik,
      name: data.name,
      entity_type: data.entityType,
      recent_13f_filings: thirteenFs,
      filing_count: thirteenFs.length,
      instruction: 'Use accession number to fetch full holdings data',
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.long);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================================
// Stock Prices (Requires FINNHUB_API_KEY)
// =============================================================================

app.get('/stocks/quote/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  if (!CONFIG.finnhubApiKey) {
    return c.json({ 
      error: 'FINNHUB_API_KEY not configured',
      setup: 'Get free API key at https://finnhub.io/register'
    }, 503);
  }
  
  const cacheKey = `stocks:quote:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.finnhubUrl}/quote?symbol=${symbol}&token=${CONFIG.finnhubApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Finnhub API error: ${response.status}`);
    const data = await response.json();
    
    if (data.c === 0 && data.h === 0) {
      return c.json({ error: `No data found for symbol ${symbol}` }, 404);
    }
    
    const result = {
      symbol,
      price: data.c,
      change: data.d,
      change_percent: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      previous_close: data.pc,
      timestamp: new Date(data.t * 1000).toISOString(),
      updated: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.short);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Historical stock prices (candles)
app.get('/stocks/historical/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const resolution = c.req.query('resolution') || 'D'; // D=daily, W=weekly, M=monthly
  const days = parseInt(c.req.query('days') || '30');
  
  if (!CONFIG.finnhubApiKey) {
    return c.json({ 
      error: 'FINNHUB_API_KEY not configured',
      setup: 'Get free API key at https://finnhub.io/register'
    }, 503);
  }
  
  const to = Math.floor(Date.now() / 1000);
  const from = to - (days * 24 * 60 * 60);
  
  const cacheKey = `stocks:historical:${symbol}:${resolution}:${days}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.finnhubUrl}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${CONFIG.finnhubApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Finnhub API error: ${response.status}`);
    const data = await response.json();
    
    if (data.s === 'no_data') {
      return c.json({ error: `No data found for symbol ${symbol}` }, 404);
    }
    
    const candles = data.t?.map((t: number, i: number) => ({
      date: new Date(t * 1000).toISOString().split('T')[0],
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i],
    })) || [];
    
    const result = {
      symbol,
      resolution,
      count: candles.length,
      candles,
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Market indices
app.get('/stocks/indices', async (c) => {
  if (!CONFIG.finnhubApiKey) {
    return c.json({ 
      error: 'FINNHUB_API_KEY not configured',
      setup: 'Get free API key at https://finnhub.io/register'
    }, 503);
  }
  
  const cacheKey = 'stocks:indices';
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  const indices = [
    { symbol: 'SPY', name: 'S&P 500 ETF' },
    { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
    { symbol: 'DIA', name: 'Dow Jones ETF' },
    { symbol: 'IWM', name: 'Russell 2000 ETF' },
    { symbol: 'VIX', name: 'Volatility Index' },
  ];
  
  try {
    const results = await Promise.all(
      indices.map(async (idx) => {
        const url = `${CONFIG.finnhubUrl}/quote?symbol=${idx.symbol}&token=${CONFIG.finnhubApiKey}`;
        const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
        const data = await response.json();
        return {
          symbol: idx.symbol,
          name: idx.name,
          price: data.c,
          change: data.d,
          change_percent: data.dp,
        };
      })
    );
    
    const result = {
      indices: results,
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.short);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================================
// BLS Employment/CPI Data (Free - optional key for higher limits)
// =============================================================================

// Employment data
app.get('/bls/employment', async (c) => {
  const cacheKey = 'bls:employment';
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  // Key BLS series for employment
  const series = [
    'LNS14000000', // Unemployment Rate
    'CES0000000001', // Total Nonfarm Payrolls
    'LNS11300000', // Labor Force Participation Rate
    'CES0500000003', // Average Hourly Earnings
  ];
  
  try {
    const body: any = { seriesid: series, startyear: (new Date().getFullYear() - 1).toString(), endyear: new Date().getFullYear().toString() };
    if (CONFIG.blsApiKey) body.registrationkey = CONFIG.blsApiKey;
    
    const response = await fetchWithTimeout(`${CONFIG.blsUrl}/timeseries/data/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, DEFAULT_TIMEOUT);
    
    if (!response.ok) throw new Error(`BLS API error: ${response.status}`);
    const data = await response.json();
    
    const seriesNames: Record<string, string> = {
      'LNS14000000': 'Unemployment Rate',
      'CES0000000001': 'Total Nonfarm Payrolls (thousands)',
      'LNS11300000': 'Labor Force Participation Rate',
      'CES0500000003': 'Average Hourly Earnings ($)',
    };
    
    const result = {
      employment_data: data.Results?.series?.map((s: any) => ({
        series_id: s.seriesID,
        name: seriesNames[s.seriesID] || s.seriesID,
        latest: s.data?.[0],
        trend: s.data?.slice(0, 6),
      })) || [],
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.long);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// CPI/Inflation data
app.get('/bls/cpi', async (c) => {
  const cacheKey = 'bls:cpi';
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  // CPI series
  const series = [
    'CUUR0000SA0', // CPI All Urban Consumers
    'CUUR0000SA0L1E', // Core CPI (less food and energy)
    'CUUR0000SAF1', // Food CPI
    'CUUR0000SETB01', // Gasoline CPI
  ];
  
  try {
    const body: any = { seriesid: series, startyear: (new Date().getFullYear() - 1).toString(), endyear: new Date().getFullYear().toString() };
    if (CONFIG.blsApiKey) body.registrationkey = CONFIG.blsApiKey;
    
    const response = await fetchWithTimeout(`${CONFIG.blsUrl}/timeseries/data/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, DEFAULT_TIMEOUT);
    
    if (!response.ok) throw new Error(`BLS API error: ${response.status}`);
    const data = await response.json();
    
    const seriesNames: Record<string, string> = {
      'CUUR0000SA0': 'CPI All Items',
      'CUUR0000SA0L1E': 'Core CPI (less food & energy)',
      'CUUR0000SAF1': 'Food CPI',
      'CUUR0000SETB01': 'Gasoline CPI',
    };
    
    // Calculate YoY change
    const seriesData = data.Results?.series?.map((s: any) => {
      const latest = s.data?.[0];
      const yearAgo = s.data?.find((d: any) => 
        d.year === (parseInt(latest?.year) - 1).toString() && d.period === latest?.period
      );
      
      return {
        series_id: s.seriesID,
        name: seriesNames[s.seriesID] || s.seriesID,
        latest_value: parseFloat(latest?.value || 0),
        latest_period: `${latest?.year}-${latest?.periodName}`,
        yoy_change: yearAgo ? ((parseFloat(latest.value) - parseFloat(yearAgo.value)) / parseFloat(yearAgo.value) * 100).toFixed(2) + '%' : null,
        trend: s.data?.slice(0, 6),
      };
    }) || [];
    
    const result = {
      cpi_data: seriesData,
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.long);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Query specific BLS series
app.get('/bls/series/:seriesId', async (c) => {
  const seriesId = c.req.param('seriesId');
  const years = parseInt(c.req.query('years') || '2');
  
  const cacheKey = `bls:series:${seriesId}:${years}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const endYear = new Date().getFullYear();
    const startYear = endYear - years;
    
    const body: any = { seriesid: [seriesId], startyear: startYear.toString(), endyear: endYear.toString() };
    if (CONFIG.blsApiKey) body.registrationkey = CONFIG.blsApiKey;
    
    const response = await fetchWithTimeout(`${CONFIG.blsUrl}/timeseries/data/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, DEFAULT_TIMEOUT);
    
    if (!response.ok) throw new Error(`BLS API error: ${response.status}`);
    const data = await response.json();
    
    const series = data.Results?.series?.[0];
    
    const result = {
      series_id: seriesId,
      data: series?.data || [],
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.long);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================================
// Commodities (Requires GOLDAPI_API_KEY)
// =============================================================================

app.get('/commodities/prices', async (c) => {
  if (!CONFIG.goldApiKey) {
    return c.json({ 
      error: 'GOLDAPI_API_KEY not configured',
      setup: 'Get free API key at https://www.goldapi.io/signup'
    }, 503);
  }
  
  const cacheKey = 'commodities:prices';
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  const metals = ['XAU', 'XAG', 'XPT', 'XPD']; // Gold, Silver, Platinum, Palladium
  
  try {
    const results = await Promise.all(
      metals.map(async (metal) => {
        const url = `${CONFIG.goldApiUrl}/${metal}/USD`;
        const response = await fetchWithTimeout(url, {
          headers: { 'x-access-token': CONFIG.goldApiKey }
        }, DEFAULT_TIMEOUT);
        if (!response.ok) return null;
        return response.json();
      })
    );
    
    const metalNames: Record<string, string> = {
      'XAU': 'Gold',
      'XAG': 'Silver',
      'XPT': 'Platinum',
      'XPD': 'Palladium',
    };
    
    const result = {
      prices: results.filter(Boolean).map((r: any) => ({
        symbol: r.metal,
        name: metalNames[r.metal] || r.metal,
        price_usd: r.price,
        price_per_gram: r.price_gram_24k,
        change: r.ch,
        change_percent: r.chp,
      })),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.short);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get('/commodities/metals', async (c) => {
  // Alias for /commodities/prices
  return c.redirect('/commodities/prices');
});

// =============================================================================
// Company Fundamentals (Requires FMP_API_KEY)
// =============================================================================

app.get('/fundamentals/profile/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  if (!CONFIG.fmpApiKey) {
    return c.json({ 
      error: 'FMP_API_KEY not configured',
      setup: 'Get free API key at https://site.financialmodelingprep.com/developer/docs'
    }, 503);
  }
  
  const cacheKey = `fundamentals:profile:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    // Use new stable API format
    const url = `${CONFIG.fmpUrl}/profile?symbol=${symbol}&apikey=${CONFIG.fmpApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`FMP API error: ${response.status}`);
    const data = await response.json();
    
    if (!data || data.length === 0) {
      return c.json({ error: `No data found for symbol ${symbol}` }, 404);
    }
    
    const profile = data[0];
    const result = {
      symbol: profile.symbol,
      name: profile.companyName,
      exchange: profile.exchange,
      sector: profile.sector,
      industry: profile.industry,
      market_cap: profile.marketCap,
      price: profile.price,
      beta: profile.beta,
      volume: profile.volume,
      avg_volume: profile.averageVolume,
      description: profile.description?.slice(0, 500),
      ceo: profile.ceo,
      website: profile.website,
      employees: profile.fullTimeEmployees,
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.long);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get('/fundamentals/ratios/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  if (!CONFIG.fmpApiKey) {
    return c.json({ 
      error: 'FMP_API_KEY not configured',
      setup: 'Get free API key at https://site.financialmodelingprep.com/developer/docs'
    }, 503);
  }
  
  const cacheKey = `fundamentals:ratios:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    // Use new stable API format
    const url = `${CONFIG.fmpUrl}/ratios?symbol=${symbol}&apikey=${CONFIG.fmpApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`FMP API error: ${response.status}`);
    const data = await response.json();
    
    if (!data || data.length === 0) {
      return c.json({ error: `No data found for symbol ${symbol}` }, 404);
    }
    
    const latest = data[0];
    const result = {
      symbol: latest.symbol,
      period: latest.period,
      fiscal_year: latest.fiscalYear,
      date: latest.date,
      ratios: {
        // Valuation
        pe_ratio: latest.priceToEarningsRatio,
        pb_ratio: latest.priceToBookRatio,
        ps_ratio: latest.priceToSalesRatio,
        peg_ratio: latest.priceToEarningsGrowthRatio,
        ev_to_ebitda: latest.enterpriseValueMultiple,
        // Profitability
        gross_margin: latest.grossProfitMargin,
        operating_margin: latest.operatingProfitMargin,
        net_margin: latest.netProfitMargin,
        // Liquidity
        current_ratio: latest.currentRatio,
        quick_ratio: latest.quickRatio,
        // Leverage
        debt_to_equity: latest.debtToEquityRatio,
        debt_to_assets: latest.debtToAssetsRatio,
        // Per share
        eps: latest.netIncomePerShare,
        book_value_per_share: latest.bookValuePerShare,
        dividend_yield: latest.dividendYieldPercentage,
      },
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.long);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get('/fundamentals/metrics/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  if (!CONFIG.fmpApiKey) {
    return c.json({ 
      error: 'FMP_API_KEY not configured',
      setup: 'Get free API key at https://site.financialmodelingprep.com/developer/docs'
    }, 503);
  }
  
  const cacheKey = `fundamentals:metrics:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    // Use new stable API format
    const url = `${CONFIG.fmpUrl}/key-metrics?symbol=${symbol}&apikey=${CONFIG.fmpApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`FMP API error: ${response.status}`);
    const data = await response.json();
    
    if (!data || data.length === 0) {
      return c.json({ error: `No data found for symbol ${symbol}` }, 404);
    }
    
    const latest = data[0];
    const result = {
      symbol: latest.symbol,
      period: latest.period,
      fiscal_year: latest.fiscalYear,
      date: latest.date,
      metrics: {
        market_cap: latest.marketCap,
        enterprise_value: latest.enterpriseValue,
        ev_to_sales: latest.evToSales,
        ev_to_ebitda: latest.evToEBITDA,
        ev_to_fcf: latest.evToFreeCashFlow,
        // Returns
        roe: latest.returnOnEquity,
        roa: latest.returnOnAssets,
        roic: latest.returnOnInvestedCapital,
        // Yields
        earnings_yield: latest.earningsYield,
        fcf_yield: latest.freeCashFlowYield,
        // Liquidity
        current_ratio: latest.currentRatio,
        working_capital: latest.workingCapital,
        // Cash
        tangible_asset_value: latest.tangibleAssetValue,
        invested_capital: latest.investedCapital,
      },
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.long);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================================
// Calendars (Requires FINNHUB_API_KEY)
// =============================================================================

// Earnings calendar
app.get('/calendar/earnings', async (c) => {
  if (!CONFIG.finnhubApiKey) {
    return c.json({ 
      error: 'FINNHUB_API_KEY not configured',
      setup: 'Get free API key at https://finnhub.io/register'
    }, 503);
  }
  
  const from = c.req.query('from') || new Date().toISOString().split('T')[0];
  const to = c.req.query('to') || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const symbol = c.req.query('symbol');
  
  const cacheKey = `calendar:earnings:${from}:${to}:${symbol || 'all'}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    let url = `${CONFIG.finnhubUrl}/calendar/earnings?from=${from}&to=${to}&token=${CONFIG.finnhubApiKey}`;
    if (symbol) url += `&symbol=${symbol.toUpperCase()}`;
    
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Finnhub API error: ${response.status}`);
    const data = await response.json();
    
    const result = {
      from,
      to,
      count: data.earningsCalendar?.length || 0,
      earnings: (data.earningsCalendar || []).slice(0, 100).map((e: any) => ({
        symbol: e.symbol,
        date: e.date,
        hour: e.hour,
        eps_estimate: e.epsEstimate,
        eps_actual: e.epsActual,
        revenue_estimate: e.revenueEstimate,
        revenue_actual: e.revenueActual,
        quarter: e.quarter,
        year: e.year,
      })),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Dividend calendar
app.get('/calendar/dividends', async (c) => {
  if (!CONFIG.finnhubApiKey) {
    return c.json({ 
      error: 'FINNHUB_API_KEY not configured',
      setup: 'Get free API key at https://finnhub.io/register'
    }, 503);
  }
  
  const symbol = c.req.query('symbol');
  if (!symbol) {
    return c.json({ error: 'Symbol parameter required' }, 400);
  }
  
  const cacheKey = `calendar:dividends:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const url = `${CONFIG.finnhubUrl}/stock/dividend?symbol=${symbol.toUpperCase()}&from=${from}&to=${to}&token=${CONFIG.finnhubApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Finnhub API error: ${response.status}`);
    const data = await response.json();
    
    const result = {
      symbol: symbol.toUpperCase(),
      count: data.length || 0,
      dividends: (data || []).map((d: any) => ({
        ex_date: d.exDate,
        pay_date: d.payDate,
        record_date: d.recordDate,
        declaration_date: d.declarationDate,
        amount: d.amount,
        currency: d.currency,
      })),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.long);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// IPO calendar
app.get('/calendar/ipo', async (c) => {
  if (!CONFIG.finnhubApiKey) {
    return c.json({ 
      error: 'FINNHUB_API_KEY not configured',
      setup: 'Get free API key at https://finnhub.io/register'
    }, 503);
  }
  
  const from = c.req.query('from') || new Date().toISOString().split('T')[0];
  const to = c.req.query('to') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const cacheKey = `calendar:ipo:${from}:${to}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.finnhubUrl}/calendar/ipo?from=${from}&to=${to}&token=${CONFIG.finnhubApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Finnhub API error: ${response.status}`);
    const data = await response.json();
    
    const result = {
      from,
      to,
      count: data.ipoCalendar?.length || 0,
      ipos: (data.ipoCalendar || []).map((ipo: any) => ({
        symbol: ipo.symbol,
        name: ipo.name,
        date: ipo.date,
        exchange: ipo.exchange,
        price_range: ipo.price,
        shares: ipo.numberOfShares,
        total_value: ipo.totalSharesValue,
        status: ipo.status,
      })),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Economic calendar
app.get('/calendar/economic', async (c) => {
  if (!CONFIG.finnhubApiKey) {
    return c.json({ 
      error: 'FINNHUB_API_KEY not configured',
      setup: 'Get free API key at https://finnhub.io/register'
    }, 503);
  }
  
  const from = c.req.query('from') || new Date().toISOString().split('T')[0];
  const to = c.req.query('to') || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const cacheKey = `calendar:economic:${from}:${to}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.finnhubUrl}/calendar/economic?from=${from}&to=${to}&token=${CONFIG.finnhubApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Finnhub API error: ${response.status}`);
    const data = await response.json();
    
    const result = {
      from,
      to,
      count: data.economicCalendar?.length || 0,
      events: (data.economicCalendar || []).slice(0, 100).map((e: any) => ({
        country: e.country,
        event: e.event,
        time: e.time,
        impact: e.impact,
        actual: e.actual,
        estimate: e.estimate,
        previous: e.prev,
        unit: e.unit,
      })),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================================
// Technical Indicators (NEW v1.5.0 - computed from price data)
// =============================================================================

// Helper function to calculate SMA
function calculateSMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

// Helper function to calculate EMA
function calculateEMA(prices: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const result: number[] = [];
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
    result.push(ema);
  }
  return result;
}

// Helper function to calculate RSI
function calculateRSI(prices: number[], period: number = 14): number[] {
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  
  const result: number[] = [];
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - (100 / (1 + rs)));
  }
  return result;
}

// SMA endpoint (using Alpha Vantage)
app.get('/indicators/sma/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const period = parseInt(c.req.query('period') || '20');
  
  if (!CONFIG.alphaVantageApiKey) {
    return c.json({ error: 'ALPHA_VANTAGE_API_KEY not configured' }, 503);
  }
  
  const cacheKey = `indicators:sma:${symbol}:${period}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.alphaVantageUrl}?function=SMA&symbol=${symbol}&interval=daily&time_period=${period}&series_type=close&apikey=${CONFIG.alphaVantageApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    const data = await response.json();
    
    if (data['Error Message'] || data['Note']) {
      return c.json({ error: data['Error Message'] || 'API rate limit reached' }, 429);
    }
    
    const smaData = data['Technical Analysis: SMA'];
    if (!smaData) return c.json({ error: 'No data found' }, 404);
    
    const dates = Object.keys(smaData).slice(0, 10);
    const values = dates.map(d => ({ date: d, sma: parseFloat(smaData[d].SMA) }));
    const currentSma = values[0].sma;
    
    // Get current price from quote
    const quoteUrl = `${CONFIG.finnhubUrl}/quote?symbol=${symbol}&token=${CONFIG.finnhubApiKey}`;
    const quoteRes = await fetchWithTimeout(quoteUrl, {}, DEFAULT_TIMEOUT);
    const quote = await quoteRes.json();
    const currentPrice = quote.c || 0;
    
    const result = {
      symbol,
      indicator: 'SMA',
      period,
      current_price: currentPrice,
      current_sma: currentSma,
      signal: currentPrice > currentSma ? 'BULLISH' : 'BEARISH',
      values: values.slice(0, 5),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// EMA endpoint (using Alpha Vantage)
app.get('/indicators/ema/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const period = parseInt(c.req.query('period') || '20');
  
  if (!CONFIG.alphaVantageApiKey) {
    return c.json({ error: 'ALPHA_VANTAGE_API_KEY not configured' }, 503);
  }
  
  const cacheKey = `indicators:ema:${symbol}:${period}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.alphaVantageUrl}?function=EMA&symbol=${symbol}&interval=daily&time_period=${period}&series_type=close&apikey=${CONFIG.alphaVantageApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    const data = await response.json();
    
    if (data['Error Message'] || data['Note']) {
      return c.json({ error: data['Error Message'] || 'API rate limit reached' }, 429);
    }
    
    const emaData = data['Technical Analysis: EMA'];
    if (!emaData) return c.json({ error: 'No data found' }, 404);
    
    const dates = Object.keys(emaData).slice(0, 10);
    const values = dates.map(d => ({ date: d, ema: parseFloat(emaData[d].EMA) }));
    const currentEma = values[0].ema;
    
    const quoteUrl = `${CONFIG.finnhubUrl}/quote?symbol=${symbol}&token=${CONFIG.finnhubApiKey}`;
    const quoteRes = await fetchWithTimeout(quoteUrl, {}, DEFAULT_TIMEOUT);
    const quote = await quoteRes.json();
    const currentPrice = quote.c || 0;
    
    const result = {
      symbol,
      indicator: 'EMA',
      period,
      current_price: currentPrice,
      current_ema: currentEma,
      signal: currentPrice > currentEma ? 'BULLISH' : 'BEARISH',
      values: values.slice(0, 5),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// RSI endpoint (using Alpha Vantage)
app.get('/indicators/rsi/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const period = parseInt(c.req.query('period') || '14');
  
  if (!CONFIG.alphaVantageApiKey) {
    return c.json({ error: 'ALPHA_VANTAGE_API_KEY not configured' }, 503);
  }
  
  const cacheKey = `indicators:rsi:${symbol}:${period}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.alphaVantageUrl}?function=RSI&symbol=${symbol}&interval=daily&time_period=${period}&series_type=close&apikey=${CONFIG.alphaVantageApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    const data = await response.json();
    
    if (data['Error Message'] || data['Note']) {
      return c.json({ error: data['Error Message'] || 'API rate limit reached' }, 429);
    }
    
    const rsiData = data['Technical Analysis: RSI'];
    if (!rsiData) return c.json({ error: 'No data found' }, 404);
    
    const dates = Object.keys(rsiData).slice(0, 10);
    const values = dates.map(d => ({ date: d, rsi: parseFloat(rsiData[d].RSI) }));
    const currentRsi = values[0].rsi;
    
    let signal = 'NEUTRAL';
    if (currentRsi > 70) signal = 'OVERBOUGHT';
    else if (currentRsi < 30) signal = 'OVERSOLD';
    
    const result = {
      symbol,
      indicator: 'RSI',
      period,
      current_rsi: currentRsi,
      signal,
      values: values.slice(0, 5),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// MACD endpoint (using Alpha Vantage)
app.get('/indicators/macd/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  if (!CONFIG.alphaVantageApiKey) {
    return c.json({ error: 'ALPHA_VANTAGE_API_KEY not configured' }, 503);
  }
  
  const cacheKey = `indicators:macd:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.alphaVantageUrl}?function=MACD&symbol=${symbol}&interval=daily&series_type=close&apikey=${CONFIG.alphaVantageApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    const data = await response.json();
    
    if (data['Error Message'] || data['Note']) {
      return c.json({ error: data['Error Message'] || 'API rate limit reached' }, 429);
    }
    
    const macdData = data['Technical Analysis: MACD'];
    if (!macdData) return c.json({ error: 'No data found' }, 404);
    
    const dates = Object.keys(macdData).slice(0, 5);
    const latest = macdData[dates[0]];
    
    const macdLine = parseFloat(latest.MACD);
    const signalLine = parseFloat(latest.MACD_Signal);
    const histogram = parseFloat(latest.MACD_Hist);
    
    const result = {
      symbol,
      indicator: 'MACD',
      date: dates[0],
      macd_line: macdLine,
      signal_line: signalLine,
      histogram: histogram,
      signal: macdLine > signalLine ? 'BULLISH' : 'BEARISH',
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Bollinger Bands endpoint (using Alpha Vantage)
app.get('/indicators/bbands/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const period = parseInt(c.req.query('period') || '20');
  
  if (!CONFIG.alphaVantageApiKey) {
    return c.json({ error: 'ALPHA_VANTAGE_API_KEY not configured' }, 503);
  }
  
  const cacheKey = `indicators:bbands:${symbol}:${period}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.alphaVantageUrl}?function=BBANDS&symbol=${symbol}&interval=daily&time_period=${period}&series_type=close&apikey=${CONFIG.alphaVantageApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    const data = await response.json();
    
    if (data['Error Message'] || data['Note']) {
      return c.json({ error: data['Error Message'] || 'API rate limit reached' }, 429);
    }
    
    const bbandsData = data['Technical Analysis: BBANDS'];
    if (!bbandsData) return c.json({ error: 'No data found' }, 404);
    
    const dates = Object.keys(bbandsData).slice(0, 5);
    const latest = bbandsData[dates[0]];
    
    const upperBand = parseFloat(latest['Real Upper Band']);
    const middleBand = parseFloat(latest['Real Middle Band']);
    const lowerBand = parseFloat(latest['Real Lower Band']);
    
    const quoteUrl = `${CONFIG.finnhubUrl}/quote?symbol=${symbol}&token=${CONFIG.finnhubApiKey}`;
    const quoteRes = await fetchWithTimeout(quoteUrl, {}, DEFAULT_TIMEOUT);
    const quote = await quoteRes.json();
    const currentPrice = quote.c || 0;
    
    let signal = 'NEUTRAL';
    if (currentPrice > upperBand) signal = 'OVERBOUGHT';
    else if (currentPrice < lowerBand) signal = 'OVERSOLD';
    
    const result = {
      symbol,
      indicator: 'BBANDS',
      period,
      date: dates[0],
      current_price: currentPrice,
      upper_band: upperBand,
      middle_band: middleBand,
      lower_band: lowerBand,
      signal,
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Batch indicators endpoint (multiple calls to Alpha Vantage)
app.get('/indicators/batch/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  if (!CONFIG.alphaVantageApiKey || !CONFIG.finnhubApiKey) {
    return c.json({ error: 'API keys not configured' }, 503);
  }
  
  const cacheKey = `indicators:batch:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    // Get current price
    const quoteUrl = `${CONFIG.finnhubUrl}/quote?symbol=${symbol}&token=${CONFIG.finnhubApiKey}`;
    const quoteRes = await fetchWithTimeout(quoteUrl, {}, DEFAULT_TIMEOUT);
    const quote = await quoteRes.json();
    const currentPrice = quote.c || 0;
    
    // Get SMA
    const smaUrl = `${CONFIG.alphaVantageUrl}?function=SMA&symbol=${symbol}&interval=daily&time_period=20&series_type=close&apikey=${CONFIG.alphaVantageApiKey}`;
    const smaRes = await fetchWithTimeout(smaUrl, {}, DEFAULT_TIMEOUT);
    const smaData = await smaRes.json();
    const smaValues = smaData['Technical Analysis: SMA'];
    const currentSma = smaValues ? parseFloat(smaValues[Object.keys(smaValues)[0]].SMA) : null;
    
    // Get RSI
    const rsiUrl = `${CONFIG.alphaVantageUrl}?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${CONFIG.alphaVantageApiKey}`;
    const rsiRes = await fetchWithTimeout(rsiUrl, {}, DEFAULT_TIMEOUT);
    const rsiData = await rsiRes.json();
    const rsiValues = rsiData['Technical Analysis: RSI'];
    const currentRsi = rsiValues ? parseFloat(rsiValues[Object.keys(rsiValues)[0]].RSI) : null;
    
    const result = {
      symbol,
      current_price: currentPrice,
      indicators: {
        sma_20: { value: currentSma, signal: currentSma && currentPrice > currentSma ? 'BULLISH' : 'BEARISH' },
        rsi_14: { value: currentRsi, signal: currentRsi ? (currentRsi > 70 ? 'OVERBOUGHT' : currentRsi < 30 ? 'OVERSOLD' : 'NEUTRAL') : 'UNKNOWN' },
      },
      overall_signal: currentSma && currentRsi ? (
        currentPrice > currentSma && currentRsi < 70 ? 'BULLISH' : 
        currentPrice < currentSma && currentRsi > 30 ? 'BEARISH' : 'NEUTRAL'
      ) : 'UNKNOWN',
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================================
// Analyst Ratings (NEW v1.5.0)
// =============================================================================

app.get('/analyst/ratings/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  if (!CONFIG.finnhubApiKey) {
    return c.json({ error: 'FINNHUB_API_KEY not configured' }, 503);
  }
  
  const cacheKey = `analyst:ratings:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.finnhubUrl}/stock/recommendation?symbol=${symbol}&token=${CONFIG.finnhubApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Finnhub API error: ${response.status}`);
    const data = await response.json();
    
    if (!data || data.length === 0) {
      return c.json({ error: 'No analyst ratings found' }, 404);
    }
    
    const latest = data[0];
    const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
    
    const result = {
      symbol,
      period: latest.period,
      ratings: {
        strong_buy: latest.strongBuy,
        buy: latest.buy,
        hold: latest.hold,
        sell: latest.sell,
        strong_sell: latest.strongSell,
        total: total,
      },
      consensus: total > 0 ? (
        (latest.strongBuy * 5 + latest.buy * 4 + latest.hold * 3 + latest.sell * 2 + latest.strongSell * 1) / total
      ).toFixed(2) : null,
      recommendation: latest.strongBuy + latest.buy > latest.sell + latest.strongSell ? 'BUY' :
                      latest.sell + latest.strongSell > latest.strongBuy + latest.buy ? 'SELL' : 'HOLD',
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.long);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get('/analyst/targets/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  if (!CONFIG.finnhubApiKey) {
    return c.json({ error: 'FINNHUB_API_KEY not configured' }, 503);
  }
  
  const cacheKey = `analyst:targets:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.finnhubUrl}/stock/price-target?symbol=${symbol}&token=${CONFIG.finnhubApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Finnhub API error: ${response.status}`);
    const data = await response.json();
    
    // Also get current price
    const quoteUrl = `${CONFIG.finnhubUrl}/quote?symbol=${symbol}&token=${CONFIG.finnhubApiKey}`;
    const quoteResponse = await fetchWithTimeout(quoteUrl, {}, DEFAULT_TIMEOUT);
    const quote = await quoteResponse.json();
    
    const currentPrice = quote.c || 0;
    const targetMean = data.targetMean || 0;
    
    const result = {
      symbol,
      current_price: currentPrice,
      target_high: data.targetHigh,
      target_low: data.targetLow,
      target_mean: targetMean,
      target_median: data.targetMedian,
      number_of_analysts: data.numberOfAnalysts,
      upside_percent: currentPrice > 0 ? ((targetMean - currentPrice) / currentPrice * 100).toFixed(2) : null,
      last_updated: data.lastUpdated,
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.long);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================================
// News Headlines (NEW v1.5.0)
// =============================================================================

app.get('/news/market', async (c) => {
  if (!CONFIG.finnhubApiKey) {
    return c.json({ error: 'FINNHUB_API_KEY not configured' }, 503);
  }
  
  const category = c.req.query('category') || 'general';
  const limit = parseInt(c.req.query('limit') || '20');
  
  const cacheKey = `news:market:${category}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.finnhubUrl}/news?category=${category}&token=${CONFIG.finnhubApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Finnhub API error: ${response.status}`);
    const data = await response.json();
    
    const result = {
      category,
      count: Math.min(data.length, limit),
      news: data.slice(0, limit).map((n: any) => ({
        headline: n.headline,
        summary: n.summary?.slice(0, 200),
        source: n.source,
        url: n.url,
        datetime: new Date(n.datetime * 1000).toISOString(),
        related: n.related,
      })),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.short);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get('/news/company/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  if (!CONFIG.finnhubApiKey) {
    return c.json({ error: 'FINNHUB_API_KEY not configured' }, 503);
  }
  
  const limit = parseInt(c.req.query('limit') || '20');
  const from = c.req.query('from') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const to = c.req.query('to') || new Date().toISOString().split('T')[0];
  
  const cacheKey = `news:company:${symbol}:${from}:${to}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);
  
  try {
    const url = `${CONFIG.finnhubUrl}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${CONFIG.finnhubApiKey}`;
    const response = await fetchWithTimeout(url, {}, DEFAULT_TIMEOUT);
    if (!response.ok) throw new Error(`Finnhub API error: ${response.status}`);
    const data = await response.json();
    
    const result = {
      symbol,
      from,
      to,
      count: Math.min(data.length, limit),
      news: data.slice(0, limit).map((n: any) => ({
        headline: n.headline,
        summary: n.summary?.slice(0, 200),
        source: n.source,
        url: n.url,
        datetime: new Date(n.datetime * 1000).toISOString(),
      })),
      timestamp: new Date().toISOString(),
    };
    
    setCache(cacheKey, result, CACHE_TTL.short);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================================
// Combined Analysis Endpoints
// =============================================================================

app.get('/analysis/wallet-compliance/:address', async (c) => {
  const address = c.req.param('address');
  
  const sanctionsResponse = await fetch(`${CONFIG.sanctionsUrl}/screen/address`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });
  const sanctions = await sanctionsResponse.json();
  
  return c.json({
    address,
    sanctioned: sanctions.sanctioned,
    risk_score: sanctions.risk_score,
    sanctions_matches: sanctions.matches,
    checked_at: new Date().toISOString(),
    recommendation: sanctions.sanctioned 
      ? 'DO NOT TRANSACT - Address is on sanctions list'
      : 'Address not found on sanctions lists',
  });
});

app.get('/analysis/earnings-arbitrage/:ticker', async (c) => {
  const ticker = c.req.param('ticker');
  
  const events = await proxyRequest(CONFIG.secOracleUrl, `/events/${ticker}?days=30`);
  const funding = await proxyRequest(CONFIG.perpDexUrl, '/funding', perpHeaders);
  
  const earningsEvents = Array.isArray(events) 
    ? events.filter((e: any) => e.classifications?.includes('earnings_results'))
    : [];
  
  return c.json({
    ticker,
    recent_earnings_events: earningsEvents.length,
    events: earningsEvents,
    current_funding_rates: funding,
    recommendation: earningsEvents.length > 0 
      ? 'Recent earnings may cause funding rate volatility' 
      : 'No recent earnings events',
  });
});

app.get('/analysis/insider-signal/:ticker', async (c) => {
  const ticker = c.req.param('ticker');
  const insiders = await proxyRequest(CONFIG.secOracleUrl, `/insiders/${ticker}?days=30`);
  
  return c.json({
    ticker,
    sentiment: insiders.sentiment,
    total_transactions: insiders.total_transactions,
    net_shares_traded: insiders.net_shares_traded,
    total_buy_value: insiders.total_buy_value,
    total_sell_value: insiders.total_sell_value,
    signal: insiders.sentiment === 'bullish' 
      ? 'Consider long bias' 
      : insiders.sentiment === 'bearish' 
        ? 'Consider short bias' 
        : 'Neutral - no clear signal',
  });
});

// =============================================================================
// Start Server
// =============================================================================

// =============================================================================
// FREE DEMO ENDPOINT - Test x402 integration without payment
// =============================================================================
app.get('/demo/quote', async (c) => {
  // Free endpoint - no payment required
  // Returns a sample stock quote to let agents test the x402 flow
  try {
    const cached = getCached('demo:quote:AAPL');
    if (cached) return c.json(cached);

    const url = `${CONFIG.finnhubUrl}/quote?symbol=AAPL&token=${CONFIG.finnhubApiKey}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      return c.json({
        symbol: 'AAPL',
        price: null,
        note: 'Demo endpoint - live data temporarily unavailable',
        x402_info: {
          message: 'This is a free demo endpoint. Paid endpoints return richer data.',
          pricing_url: `${PUBLIC_URL}/pricing`,
          docs_url: `${PUBLIC_URL}/.well-known/agent.json`,
        },
      });
    }
    const data = await response.json();
    const result = {
      symbol: 'AAPL',
      price: data.c,
      change: data.d,
      changePercent: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      timestamp: new Date().toISOString(),
      demo: true,
      x402_info: {
        message: 'This is a free demo endpoint. Paid endpoints return richer data with more symbols.',
        pricing_url: `${PUBLIC_URL}/pricing`,
        docs_url: `${PUBLIC_URL}/.well-known/agent.json`,
        example_paid: `${PUBLIC_URL}/stocks/quote/MSFT`,
      },
    };
    setCache('demo:quote:AAPL', result, CACHE_TTL.short);
    return c.json(result);
  } catch (err: any) {
    return c.json(
      {
        symbol: 'AAPL',
        price: null,
        note: 'Demo endpoint - service temporarily unavailable',
        error: err.message,
      },
      503,
    );
  }
});

// =============================================================================
// BUNDLE ENDPOINTS - Task-oriented multi-source responses
// =============================================================================
app.use('/bundle/*', createPaymentMiddleware('bundle'));

app.get('/bundle/market_snapshot/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const cacheKey = `bundle:market:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);

  try {
    const [quote, ratings, news] = await Promise.allSettled([
      fetchWithTimeout(`${CONFIG.finnhubUrl}/quote?symbol=${symbol}&token=${CONFIG.finnhubApiKey}`).then((r) => r.json()),
      fetchWithTimeout(`${CONFIG.fmpUrl}/analyst-estimates?symbol=${symbol}&apikey=${CONFIG.fmpApiKey}`).then((r) => r.json()),
      fetchWithTimeout(
        `${CONFIG.finnhubUrl}/company-news?symbol=${symbol}&from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}&token=${CONFIG.finnhubApiKey}`,
      ).then((r) => r.json()),
    ]);

    const result = {
      symbol,
      timestamp: new Date().toISOString(),
      quote:
        quote.status === 'fulfilled'
          ? {
              price: quote.value.c,
              change: quote.value.d,
              changePercent: quote.value.dp,
              high: quote.value.h,
              low: quote.value.l,
              open: quote.value.o,
              previousClose: quote.value.pc,
            }
          : null,
      analystEstimates:
        ratings.status === 'fulfilled' ? (Array.isArray(ratings.value) ? ratings.value.slice(0, 3) : null) : null,
      recentNews:
        news.status === 'fulfilled'
          ? Array.isArray(news.value)
            ? news.value.slice(0, 5).map((n: any) => ({
                headline: n.headline,
                source: n.source,
                datetime: n.datetime,
                summary: n.summary?.slice(0, 200),
                url: n.url,
              }))
            : null
          : null,
      bundle: 'market_snapshot',
      endpointsUsed: ['stocks/quote', 'analyst/ratings', 'news/company'],
    };

    setCache(cacheKey, result, CACHE_TTL.short);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: 'Bundle fetch failed', message: err.message }, 500);
  }
});

app.post('/bundle/sanctions_screen', async (c) => {
  try {
    const body = await c.req.json();
    const { name, address, country } = body;

    const results: any = { timestamp: new Date().toISOString(), bundle: 'sanctions_screen' };
    const promises: Promise<any>[] = [];

    if (name) {
      promises.push(
        fetchWithTimeout(`${CONFIG.sanctionsUrl}/screen/name`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
          .then((r) => r.json())
          .then((d) => {
            results.nameScreen = d;
          })
          .catch(() => {
            results.nameScreen = { error: 'unavailable' };
          }),
      );
    }

    if (address) {
      promises.push(
        fetchWithTimeout(`${CONFIG.sanctionsUrl}/screen/address`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        })
          .then((r) => r.json())
          .then((d) => {
            results.addressScreen = d;
          })
          .catch(() => {
            results.addressScreen = { error: 'unavailable' };
          }),
      );
    }

    if (country) {
      promises.push(
        fetchWithTimeout(`${CONFIG.sanctionsUrl}/country/${country}`)
          .then((r) => r.json())
          .then((d) => {
            results.countryInfo = d;
          })
          .catch(() => {
            results.countryInfo = { error: 'unavailable' };
          }),
      );
    }

    await Promise.all(promises);

    results.riskSummary = {
      inputsChecked: { name: !!name, address: !!address, country: !!country },
      anyMatch: !!(results.nameScreen?.matches?.length || results.addressScreen?.matches?.length),
    };

    return c.json(results);
  } catch (err: any) {
    return c.json({ error: 'Sanctions screen failed', message: err.message }, 500);
  }
});

app.get('/bundle/sec_snapshot/:ticker', async (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const cacheKey = `bundle:sec:${ticker}`;
  const cached = getCached(cacheKey);
  if (cached) return c.json(cached);

  try {
    const [company, financials, insiders, events] = await Promise.allSettled([
      proxyRequest(CONFIG.secOracleUrl, `/company/${ticker}`),
      proxyRequest(CONFIG.secOracleUrl, `/financials/${ticker}`),
      proxyRequest(CONFIG.secOracleUrl, `/insiders/${ticker}?limit=5`),
      proxyRequest(CONFIG.secOracleUrl, `/events/${ticker}?limit=5`),
    ]);

    const result = {
      ticker,
      timestamp: new Date().toISOString(),
      company: company.status === 'fulfilled' ? company.value : null,
      financials: financials.status === 'fulfilled' ? financials.value : null,
      recentInsiderTrades: insiders.status === 'fulfilled' ? insiders.value : null,
      materialEvents: events.status === 'fulfilled' ? events.value : null,
      bundle: 'sec_snapshot',
      endpointsUsed: ['sec/company', 'sec/financials', 'sec/insiders', 'sec/events'],
    };

    setCache(cacheKey, result, CACHE_TTL.medium);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: 'SEC snapshot failed', message: err.message }, 500);
  }
});


const port = parseInt(process.env.PORT || '3000');

const apiStatus = (key: string | undefined, name: string) => key ? `✓ ${name}` : `✗ ${name} (no key)`;

console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║            Financial Oracles Gateway v${CONFIG.version}                           ║
╠═══════════════════════════════════════════════════════════════════════╣
║  Total Endpoints: ${String(Object.keys(PRICING).length).padEnd(52)}║
║  Network: ${CONFIG.network.padEnd(60)}║
║  Receiver: ${CONFIG.receiverAddress.slice(0, 30)}...                  ║
╠═══════════════════════════════════════════════════════════════════════╣
║  INTERNAL SERVICES                                                    ║
║    SEC Oracle:       ${CONFIG.secOracleUrl.padEnd(49)}║
║    Perp DEX:         ${CONFIG.perpDexUrl.padEnd(49)}║
║    Sanctions:        ${CONFIG.sanctionsUrl.padEnd(49)}║
╠═══════════════════════════════════════════════════════════════════════╣
║  FREE EXTERNAL APIs (no key needed)                                   ║
║    Treasury:         ✓ fiscaldata.treasury.gov                        ║
║    Forex:            ✓ fawazahmed0/exchange-api                       ║
║    Crypto:           ✓ CoinGecko                                      ║
║    FDIC:             ✓ api.fdic.gov                                   ║
║    Polymarket:       ✓ gamma-api.polymarket.com                       ║
║    BLS:              ✓ api.bls.gov (optional key for higher limits)   ║
╠═══════════════════════════════════════════════════════════════════════╣
║  API KEY STATUS                                                       ║
║    FRED:             ${apiStatus(CONFIG.fredApiKey, 'configured').padEnd(49)}║
║    Finnhub:          ${apiStatus(CONFIG.finnhubApiKey, 'configured').padEnd(49)}║
║    Alpha Vantage:    ${apiStatus(CONFIG.alphaVantageApiKey, 'configured').padEnd(49)}║
║    FMP:              ${apiStatus(CONFIG.fmpApiKey, 'configured').padEnd(49)}║
║    GoldAPI:          ${apiStatus(CONFIG.goldApiKey, 'configured').padEnd(49)}║
║    BLS:              ${apiStatus(CONFIG.blsApiKey, 'configured (optional)').padEnd(49)}║
╠═══════════════════════════════════════════════════════════════════════╣
║  Server: http://localhost:${port}                                          ║
╚═══════════════════════════════════════════════════════════════════════╝
`);

export default {
  port,
  fetch: app.fetch,
};
