import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://sepolia.drpc.org'),
});

const REGISTRY = '0x8004a6090cd10a7288092483047b097295fb8847';

// Try to get contract ABI/methods
try {
  // Check if there's a setTokenURI or setAgentURI function
  const abi = parseAbi([
    'function setTokenURI(uint256 tokenId, string uri) external',
    'function setAgentURI(uint256 agentId, string uri) external',
    'function updateURI(uint256 tokenId, string uri) external',
  ]);
  
  console.log('Checking if update functions exist...');
  // This will fail if the function doesn't exist
  const code = await client.getCode({ address: REGISTRY });
  console.log(`Contract has ${code.length} bytes of code`);
  console.log('Note: Would need to check ABI for available update functions');
} catch (e) {
  console.log('Error:', e.message);
}
