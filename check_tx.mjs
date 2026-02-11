import { createPublicClient, http, decodeEventLog, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';

const TX_HASH = '0x44e3d03b8f17df11536936eece71daa2485040f12e5fbbbc05295a420e6498a4';

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://sepolia.drpc.org'),
});

const registryAbi = parseAbi([
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
]);

const receipt = await client.getTransactionReceipt({ hash: TX_HASH });
console.log('Transaction status:', receipt.status);
console.log('Logs:', receipt.logs.length);

for (const log of receipt.logs) {
  try {
    const decoded = decodeEventLog({
      abi: registryAbi,
      data: log.data,
      topics: log.topics,
    });
    console.log('\nDecoded Registered event:');
    console.log('  Agent ID:', decoded.args.agentId.toString());
    console.log('  Agent URI:', decoded.args.agentURI);
    console.log('  Owner:', decoded.args.owner);
    console.log('\nAgent Key: eip155:11155111:0x8004a6090cd10a7288092483047b097295fb8847:' + decoded.args.agentId);
  } catch (e) {
    // Not our event
  }
}
