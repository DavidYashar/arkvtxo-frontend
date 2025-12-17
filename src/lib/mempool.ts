/**
 * Mempool utility functions for generating transaction and address links
 * Supports both testnet (mutinynet) and mainnet (mempool.space)
 */

export function getMempoolUrl(txid: string): string {
  const network = process.env.NEXT_PUBLIC_NETWORK || 'mainnet'; // Default to mainnet

export function getAddressUrl(address: string): string {
  const network = process.env.NEXT_PUBLIC_NETWORK || 'mainnet'; // Default to mainnet
    ? 'https://mempool.space'
    : 'https://mutinynet.com';
  
  return `${baseUrl}/address/${address}`;
}

export function getNetworkName(): string {
  return process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? 'Bitcoin Mainnet' : 'Bitcoin Testnet';
}

export function openMempoolTx(txid: string): void {
  window.open(getMempoolUrl(txid), '_blank', 'noopener,noreferrer');
}
