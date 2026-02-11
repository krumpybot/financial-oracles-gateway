import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://rpc.ankr.com/eth'),
});

const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const AGENT_ID = 22802n;

try {
  const tokenURI = await client.readContract({
    address: REGISTRY,
    abi: [{
      name: 'tokenURI',
      type: 'function',
      inputs: [{ name: 'tokenId', type: 'uint256' }],
      outputs: [{ type: 'string' }],
      stateMutability: 'view',
    }],
    functionName: 'tokenURI',
    args: [AGENT_ID],
  });

  console.log('Agent #22802 tokenURI (first 300 chars):');
  console.log(tokenURI.substring(0, 300));

  if (tokenURI.startsWith('data:application/json;base64,')) {
    const base64 = tokenURI.replace('data:application/json;base64,', '');
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    console.log('\nDecoded metadata:');
    console.log(json);
  }
} catch (e) {
  console.error('Error:', e.message);
}
