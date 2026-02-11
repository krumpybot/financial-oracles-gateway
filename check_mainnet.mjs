import { createPublicClient, http, formatEther } from 'viem';
import { mainnet } from 'viem/chains';
import { readFileSync } from 'fs';

const wallet = JSON.parse(readFileSync('/root/clawd/secrets/ethereum/wallet.json', 'utf-8'));

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://cloudflare-eth.com'),
});

const balance = await client.getBalance({ address: wallet.address });
console.log(`Mainnet ETH: ${formatEther(balance)}`);
