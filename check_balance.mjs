import { createPublicClient, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';
import { readFileSync } from 'fs';

const wallet = JSON.parse(readFileSync('/root/clawd/secrets/ethereum/wallet.json', 'utf-8'));
const address = wallet.address;

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://sepolia.drpc.org'),
});

const balance = await client.getBalance({ address });
console.log(`Wallet: ${address}`);
console.log(`Sepolia ETH: ${formatEther(balance)}`);
