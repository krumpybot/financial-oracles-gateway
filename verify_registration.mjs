import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia, mainnet } from 'viem/chains';

const registryAbi = parseAbi([
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
]);

async function checkRegistration(chain, registryAddress, agentId) {
  const client = createPublicClient({
    chain,
    transport: http(chain.id === 1 ? 'https://eth.drpc.org' : 'https://sepolia.drpc.org'),
  });
  
  try {
    const [tokenURI, owner] = await Promise.all([
      client.readContract({
        address: registryAddress,
        abi: registryAbi,
        functionName: 'tokenURI',
        args: [BigInt(agentId)],
      }),
      client.readContract({
        address: registryAddress,
        abi: registryAbi,
        functionName: 'ownerOf',
        args: [BigInt(agentId)],
      }),
    ]);
    
    console.log(`Chain: ${chain.name}`);
    console.log(`Agent ID: ${agentId}`);
    console.log(`Owner: ${owner}`);
    console.log(`Token URI: ${tokenURI.substring(0, 150)}${tokenURI.length > 150 ? '...' : ''}`);
    console.log('');
  } catch (e) {
    console.log(`Error checking ${chain.name} #${agentId}: ${e.message}`);
  }
}

// Check Sepolia #7519
await checkRegistration(sepolia, '0x8004a6090cd10a7288092483047b097295fb8847', 7519);

// Check Mainnet #22821
await checkRegistration(mainnet, '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', 22821);
