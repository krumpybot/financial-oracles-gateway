#!/usr/bin/env bun
/**
 * Register Financial Oracles on Mainnet with https: agentURI
 * This fixes the data: URI issue and allows xgate.run to discover our agent
 */
import { createPublicClient, createWalletClient, http, parseAbi, formatEther } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';

// Configuration
const REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'; // Mainnet registry
const AGENT_URI = 'https://agents.krumpybot.com/.well-known/agent-registration.json';

// Load wallet
const wallet = JSON.parse(readFileSync('/root/clawd/secrets/ethereum/wallet.json', 'utf-8'));
let privateKey = wallet.private_key;
if (!privateKey.startsWith('0x')) privateKey = `0x${privateKey}`;

const account = privateKeyToAccount(privateKey);
console.log(`Wallet: ${account.address}`);

// Create clients
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http('https://cloudflare-eth.com'),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http('https://cloudflare-eth.com'),
});

// ERC-8004 Registry ABI
const registryAbi = parseAbi([
  'function register(string agentURI) external returns (uint256 agentId)',
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
]);

async function main() {
  console.log('\n=== Registering Financial Oracles on Mainnet ===');
  console.log(`Registry: ${REGISTRY_ADDRESS}`);
  console.log(`Agent URI: ${AGENT_URI}`);
  
  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${formatEther(balance)} ETH`);
  
  if (balance < 0.002e18) {
    console.error('Insufficient balance for mainnet gas (need ~0.002 ETH)');
    console.log('Please bridge ETH to mainnet first.');
    process.exit(1);
  }
  
  // Estimate gas
  const gasEstimate = await publicClient.estimateContractGas({
    address: REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: 'register',
    args: [AGENT_URI],
    account: account.address,
  });
  console.log(`Estimated gas: ${gasEstimate}`);
  
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
  
  // Parse the Registered event
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: registryAbi,
        data: log.data,
        topics: log.topics,
      });
      console.log(`\n✅ Agent registered successfully!`);
      console.log(`Agent ID: ${decoded.args.agentId}`);
      console.log(`Agent Key: eip155:1:${REGISTRY_ADDRESS}:${decoded.args.agentId}`);
      break;
    } catch (e) {}
  }
}

main().catch(console.error);
