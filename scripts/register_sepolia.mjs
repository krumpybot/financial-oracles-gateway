#!/usr/bin/env bun
/**
 * Register Financial Oracles on Sepolia with https: agentURI
 * This allows xgate.run to discover and index our agent
 */
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';

// Configuration
const REGISTRY_ADDRESS = '0x8004a6090cd10a7288092483047b097295fb8847'; // Sepolia registry
const AGENT_URI = 'https://agents.krumpybot.com/.well-known/agent-registration.json';

// Load wallet
const wallet = JSON.parse(readFileSync('/root/clawd/secrets/ethereum/wallet.json', 'utf-8'));
let privateKey = wallet.private_key;
if (!privateKey.startsWith('0x')) privateKey = `0x${privateKey}`;

const account = privateKeyToAccount(privateKey);
console.log(`Wallet: ${account.address}`);

// Create clients
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://sepolia.drpc.org'),
});

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http('https://sepolia.drpc.org'),
});

// ERC-8004 Registry ABI (just what we need)
const registryAbi = parseAbi([
  'function register(string agentURI) external returns (uint256 agentId)',
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
]);

async function main() {
  console.log('\n=== Registering Financial Oracles on Sepolia ===');
  console.log(`Registry: ${REGISTRY_ADDRESS}`);
  console.log(`Agent URI: ${AGENT_URI}`);
  
  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${Number(balance) / 1e18} ETH`);
  
  if (balance < 0.001e18) {
    console.error('Insufficient balance for gas');
    process.exit(1);
  }
  
  // Register
  console.log('\nSending registration transaction...');
  
  const hash = await walletClient.writeContract({
    address: REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: 'register',
    args: [AGENT_URI],
  });
  
  console.log(`Transaction hash: ${hash}`);
  console.log('Waiting for confirmation...');
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Status: ${receipt.status}`);
  console.log(`Gas used: ${receipt.gasUsed}`);
  
  // Parse the Registered event to get the agentId
  const logs = receipt.logs;
  for (const log of logs) {
    // The first topic is the event signature, second is the indexed agentId
    if (log.topics.length >= 2) {
      const agentId = BigInt(log.topics[1]);
      console.log(`\n✅ Agent registered successfully!`);
      console.log(`Agent ID: ${agentId}`);
      console.log(`Agent Key: eip155:11155111:${REGISTRY_ADDRESS}:${agentId}`);
      console.log(`\nView on xgate.run:`);
      console.log(`https://xgate.run/agents?chain_id=11155111&agent_id=${agentId}`);
      break;
    }
  }
}

main().catch(console.error);
