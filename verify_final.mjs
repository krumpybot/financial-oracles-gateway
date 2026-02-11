import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia, mainnet } from 'viem/chains';

const abi = parseAbi(['function tokenURI(uint256) view returns (string)']);

// Check Sepolia #7520
const sepoliaClient = createPublicClient({ chain: sepolia, transport: http('https://sepolia.drpc.org') });
const sepoliaURI = await sepoliaClient.readContract({
  address: '0x8004a6090cd10a7288092483047b097295fb8847',
  abi, functionName: 'tokenURI', args: [7520n]
});
console.log(`Sepolia #7520 → ${sepoliaURI}`);

// Check Mainnet #22821
const mainnetClient = createPublicClient({ chain: mainnet, transport: http('https://eth.drpc.org') });
const mainnetURI = await mainnetClient.readContract({
  address: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  abi, functionName: 'tokenURI', args: [22821n]
});
console.log(`Mainnet #22821 → ${mainnetURI}`);
