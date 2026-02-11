import { createPublicClient, createWalletClient, http, parseAbi, decodeEventLog } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';

const REGISTRY = '0x8004a6090cd10a7288092483047b097295fb8847';
const AGENT_URI = 'https://agents.krumpybot.com/.well-known/agent-registration-sepolia.json';

// Load wallet
const wallet = JSON.parse(readFileSync('/root/clawd/secrets/ethereum/wallet.json', 'utf-8'));
let privateKey = wallet.private_key;
if (!privateKey.startsWith('0x')) privateKey = `0x${privateKey}`;

const account = privateKeyToAccount(privateKey);

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://sepolia.drpc.org'),
});

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http('https://sepolia.drpc.org'),
});

const registryAbi = parseAbi([
  'function register(string agentURI) external returns (uint256 agentId)',
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
]);

console.log('Re-registering on Sepolia with Sepolia-specific URL...');
console.log(`URI: ${AGENT_URI}`);

const hash = await walletClient.writeContract({
  address: REGISTRY,
  abi: registryAbi,
  functionName: 'register',
  args: [AGENT_URI],
});

console.log(`Tx: ${hash}`);
console.log('Waiting for confirmation...');

const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(`Status: ${receipt.status}`);

for (const log of receipt.logs) {
  try {
    const decoded = decodeEventLog({
      abi: registryAbi,
      data: log.data,
      topics: log.topics,
    });
    console.log(`\n✅ New Sepolia Agent ID: ${decoded.args.agentId}`);
    console.log(`Agent Key: eip155:11155111:${REGISTRY}:${decoded.args.agentId}`);
  } catch (e) {}
}
