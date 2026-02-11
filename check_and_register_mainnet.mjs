import { createPublicClient, createWalletClient, http, parseAbi, formatEther, decodeEventLog } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';

const REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const AGENT_URI = 'https://agents.krumpybot.com/.well-known/agent-registration.json';

// Load wallet
const wallet = JSON.parse(readFileSync('/root/clawd/secrets/ethereum/wallet.json', 'utf-8'));
let privateKey = wallet.private_key;
if (!privateKey.startsWith('0x')) privateKey = `0x${privateKey}`;

const account = privateKeyToAccount(privateKey);
console.log(`Wallet: ${account.address}`);

// Use a reliable RPC
const RPC_URL = 'https://eth.drpc.org';

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(RPC_URL),
});

const registryAbi = parseAbi([
  'function register(string agentURI) external returns (uint256 agentId)',
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
]);

async function main() {
  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Mainnet ETH: ${formatEther(balance)}`);
  
  if (balance < 0.001e18) {
    console.log('\n❌ Insufficient mainnet ETH. Need to bridge funds first.');
    process.exit(1);
  }
  
  console.log('\n=== Registering on Mainnet ===');
  console.log(`Registry: ${REGISTRY_ADDRESS}`);
  console.log(`Agent URI: ${AGENT_URI}`);
  
  // Send transaction
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
  
  // Parse event
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
      console.log(`\nView on xgate.run:`);
      console.log(`https://xgate.run/agents?chain_id=1&agent_id=${decoded.args.agentId}`);
      break;
    } catch (e) {}
  }
}

main().catch(console.error);
