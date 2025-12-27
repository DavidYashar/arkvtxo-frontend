/**
 * Centralized Indexer base URL selection.
 *
 * - Use NEXT_PUBLIC_INDEXER_URL if explicitly set.
 * - Otherwise, default by network:
 *   - mainnet -> production indexer host
 *   - anything else (e.g. testnet/regtest) -> local dev indexer
 */

function trimTrailingSlashes(url: string): string {
  return url.replace(/\/+$/g, '');
}

export function getPublicIndexerUrl(): string {
  const explicit = (process.env.NEXT_PUBLIC_INDEXER_URL || '').trim();
  if (explicit) return trimTrailingSlashes(explicit);

  const network = (process.env.NEXT_PUBLIC_NETWORK || '').trim().toLowerCase();
  if (network && network !== 'mainnet') {
    return 'http://localhost:3010';
  }

  // Default production indexer host (backend). Keep the frontend domain separate.
  return 'https://arkvtxo.onrender.com';
}
