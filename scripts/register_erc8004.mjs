#!/usr/bin/env node
/**
 * ERC-8004 Registration Script
 * Registers Financial Oracles Gateway on Identity Registry
 */

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, mainnet } from 'viem/chains';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Registry addresses
const REGISTRIES = {
  // Sepolia (working registry - our registration is #7518)
  sepolia: {
    identity: '0x8004a6090cd10a7288092483047b097295fb8847',
    chainId: 11155111,
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
  },
  // Ethereum mainnet (official addresses from ERC-8004)
  mainnet: {
    identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
    chainId: 1,
    rpc: 'https://eth.drpc.org',
  },
};

// Identity Registry ABI (ERC-721 + registration)
const IDENTITY_ABI = parseAbi([
  'function register(string agentURI) external returns (uint256)',
  'function setAgentURI(uint256 agentId, string newURI) external',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function balanceOf(address owner) external view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]);

// Agent metadata
const AGENT_METADATA = {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
  name: 'Financial Oracles Gateway',
  description: 'Integrated SEC filings + Perpetual DEX data oracle with x402 micropayments. Provides company financials, insider trading, 8-K events, and cross-exchange funding rates.',
  image: 'https://openclaw.ai/oracles/logo.png',
  endpoints: [
    {
      name: 'A2A',
      endpoint: 'https://oracles.openclaw.ai/.well-known/agent.json',
      version: '0.3.0',
    },
    {
      name: 'HTTP',
      endpoint: 'https://oracles.openclaw.ai/',
      version: '1.0.0',
    },
  ],
  x402Support: true,
  x402: {
    network: 'base',
    currency: 'USDC',
    receiver: '0x71A2CED2074F418f4e68a0A196FF3C1e59Beb32E',
  },
  capabilities: [
    'sec_filings',
    'xbrl_financials', 
    'insider_trading',
    '8k_events',
    'funding_rates',
    'arbitrage_detection',
  ],
  supportedTrust: ['reputation'],
};

async function checkRegistryDeployed(publicClient, address) {
  try {
    const code = await publicClient.getBytecode({ address });
    return code && code !== '0x';
  } catch {
    return false;
  }
}

async function register(network) {
  const config = REGISTRIES[network];
  if (!config) {
    throw new Error(`Unknown network: ${network}`);
  }

  console.log(`\n🔗 Registering on ${network} (chainId: ${config.chainId})`);

  // Load private key from wallet.json
  const wallet = JSON.parse(readFileSync('/root/clawd/secrets/ethereum/wallet.json', 'utf8'));
  const privateKey = wallet.private_key;
  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
  
  console.log(`   Wallet: ${account.address}`);

  // Create clients
  const chain = network === 'mainnet' ? mainnet : sepolia;
  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpc),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpc),
  });

  // Check if registry is deployed
  const isDeployed = await checkRegistryDeployed(publicClient, config.identity);
  if (!isDeployed) {
    console.log(`   ❌ Identity Registry not deployed on ${network}`);
    return null;
  }
  console.log(`   ✅ Identity Registry deployed at ${config.identity}`);

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  const ethBalance = Number(balance) / 1e18;
  console.log(`   Balance: ${ethBalance.toFixed(6)} ETH`);

  if (ethBalance < 0.001) {
    console.log(`   ❌ Insufficient ETH for gas`);
    return null;
  }

  // Upload metadata to data URI (for now, ideally IPFS)
  const metadataJson = JSON.stringify(AGENT_METADATA, null, 2);
  const agentURI = `data:application/json;base64,${Buffer.from(metadataJson).toString('base64')}`;

  console.log(`   📝 Registering agent...`);

  // Register
  const hash = await walletClient.writeContract({
    address: config.identity,
    abi: IDENTITY_ABI,
    functionName: 'register',
    args: [agentURI],
  });

  console.log(`   📤 Tx: ${hash}`);

  // Wait for receipt
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`   ⛽ Gas used: ${receipt.gasUsed}`);

  // Get agent ID from Transfer event
  const transferLog = receipt.logs.find(log => 
    log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
  );
  
  let agentId = null;
  if (transferLog && transferLog.topics[3]) {
    agentId = BigInt(transferLog.topics[3]).toString();
    console.log(`   🎉 Agent ID: ${agentId}`);
  }

  const result = {
    network,
    chainId: config.chainId,
    agentId,
    txHash: hash,
    identityRegistry: config.identity,
    wallet: account.address,
    timestamp: new Date().toISOString(),
  };

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const networks = args.length > 0 ? args : ['sepolia'];

  console.log('🚀 ERC-8004 Financial Oracles Registration');
  console.log('==========================================');

  const results = [];

  for (const network of networks) {
    try {
      const result = await register(network);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.log(`   ❌ Error on ${network}: ${error.message}`);
    }
  }

  // Save results
  if (results.length > 0) {
    const outputPath = '/root/clawd/secrets/erc8004/financial_oracles_agents.json';
    writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n📁 Results saved to ${outputPath}`);
  }

  console.log('\n✅ Registration complete!');
}

main().catch(console.error);
