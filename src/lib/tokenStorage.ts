/**
 * Temporary local storage for token metadata
 * Until we have the indexer API ready, we'll store token metadata in localStorage
 */

import { debugLog } from './debug';

export interface StoredTokenMetadata {
  tokenId: string;
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  creator: string;
  createdAt: number;
  vtxoId?: string;
}

const STORAGE_KEY = 'arkade_tokens';

export function saveToken(metadata: StoredTokenMetadata): void {
  try {
    const tokens = getTokens();
    tokens.push(metadata);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    debugLog('Token metadata saved to localStorage', {
      tokenId: metadata?.tokenId ? `${metadata.tokenId.slice(0, 8)}…${metadata.tokenId.slice(-6)}` : undefined,
    });
  } catch (error) {
    console.error('Failed to save token metadata:', error);
  }
}

export function getTokens(): StoredTokenMetadata[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load tokens:', error);
    return [];
  }
}

export function getToken(tokenId: string): StoredTokenMetadata | undefined {
  const tokens = getTokens();
  return tokens.find(t => t.tokenId === tokenId);
}

export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEY);
}
