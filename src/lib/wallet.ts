/**
 * Wallet management for Arkade Token Platform
 */

import { Wallet, SingleKey } from '@arkade-os/sdk';
import { TokenWallet, TokenProvider, BitcoinClient, initECC } from '@arkade-token/sdk';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import { ECPairFactory, ECPairAPI } from 'ecpair';
import * as ecc from '@bitcoinerlab/secp256k1';

// Initialize crypto factories synchronously with @bitcoinerlab/secp256k1
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

// Initialize bitcoinjs-lib with ECC library (required for p2tr/Taproot)
bitcoin.initEccLib(ecc);

export interface WalletConfig {
  arkServerUrl: string;
  tokenIndexerUrl: string;
  apiKey?: string;
  privateKey?: string;
  mnemonic?: string;
}

export interface WalletCredentials {
  privateKey: string;
  mnemonic: string;
}

let walletInstance: TokenWallet | null = null;
let arkadeWallet: any | null = null;
let activePrivateKey: string | null = null;
let activeMnemonic: string | null = null;

const WALLET_CHANGED_EVENT = 'arkade_wallet_changed';

function notifyWalletChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WALLET_CHANGED_EVENT));
}

export function onWalletChanged(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = () => handler();
  window.addEventListener(WALLET_CHANGED_EVENT, listener);
  return () => window.removeEventListener(WALLET_CHANGED_EVENT, listener);
}

export function getActivePrivateKey(): string | null {
  return activePrivateKey;
}

export function getActiveMnemonic(): string | null {
  return activeMnemonic;
}

/**
 * Generate new wallet credentials (private key and mnemonic)
 */
export function generateWalletCredentials(): WalletCredentials {
  // Generate 12-word mnemonic (128 bits of entropy)
  const mnemonic = bip39.generateMnemonic(128);
  
  // Derive private key from mnemonic using BIP32/BIP44 path
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed);
  
  // Use Bitcoin's BIP44 path: m/44'/0'/0'/0/0
  const path = "m/44'/0'/0'/0/0";
  const child = root.derivePath(path);
  
  if (!child.privateKey) {
    throw new Error('Failed to derive private key from mnemonic');
  }
  
  // Ensure we get exactly 32 bytes
  const keyBuffer = Buffer.from(child.privateKey);
  if (keyBuffer.length !== 32) {
    throw new Error(`Invalid private key buffer length: ${keyBuffer.length}`);
  }
  
  const privateKey = keyBuffer.toString('hex');
  
  // Validate that we have a proper 64-character hex string (32 bytes)
  if (privateKey.length !== 64) {
    throw new Error(`Invalid private key length: ${privateKey.length} (expected 64)`);
  }
  
  return { privateKey, mnemonic };
}

/**
 * Derive private key from mnemonic
 */
export function mnemonicToPrivateKey(mnemonic: string): string {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid seed phrase');
  }
  
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed);
  const path = "m/44'/0'/0'/0/0";
  const child = root.derivePath(path);
  
  if (!child.privateKey) {
    throw new Error('Failed to derive private key from mnemonic');
  }
  
  // Ensure we get exactly 32 bytes
  const keyBuffer = Buffer.from(child.privateKey);
  if (keyBuffer.length !== 32) {
    throw new Error(`Invalid private key buffer length: ${keyBuffer.length}`);
  }
  
  const privateKey = keyBuffer.toString('hex');
  
  if (privateKey.length !== 64) {
    throw new Error(`Invalid private key length: ${privateKey.length}`);
  }
  
  return privateKey;
}

/**
 * Initialize wallet from private key, mnemonic, or create new one.
 * Note: credentials are kept in-memory only. Persisted login is handled by the encrypted vault.
 */
export async function initializeWallet(config: WalletConfig): Promise<TokenWallet> {
  let privateKey = config.privateKey;
  let mnemonic = config.mnemonic;
  
  // If mnemonic provided, derive private key from it
  if (mnemonic && !privateKey) {
    privateKey = await mnemonicToPrivateKey(mnemonic);
  }
  
  // If still no private key, generate a brand new wallet (in-memory).
  if (!privateKey) {
    const credentials = generateWalletCredentials();
    privateKey = credentials.privateKey;
    mnemonic = credentials.mnemonic;
  }

  activePrivateKey = privateKey;
  activeMnemonic = mnemonic || null;
  
  // Create Arkade wallet
  const identity = SingleKey.fromHex(privateKey);
  console.log('🔧 Creating Arkade wallet with config:', {
    arkServerUrl: config.arkServerUrl,
    tokenIndexerUrl: config.tokenIndexerUrl,
    network: 'bitcoin (mainnet)'
  });
  arkadeWallet = await Wallet.create({
    identity,
    arkServerUrl: config.arkServerUrl,
    // esploraUrl: 'https://mutinynet.com/api', // For testnet
  });
  
  const arkadeAddress = await arkadeWallet.getAddress();
  console.log('🏦 Arkade wallet created with address:', arkadeAddress);
  console.log('🌐 Network check:', {
    isMainnet: arkadeAddress.startsWith('ark1'),
    isTestnet: arkadeAddress.startsWith('tark1')
  });
  
  // Create token provider
  const tokenProvider = new TokenProvider(config.tokenIndexerUrl, config.apiKey);
  
  // Create token wallet with Bitcoin private key for OP_RETURN
  walletInstance = new TokenWallet(
    arkadeWallet, 
    tokenProvider,
    bitcoin.networks.bitcoin,
    privateKey  // ← Pass private key for Bitcoin L1 OP_RETURN
  );

  notifyWalletChanged();
  
  return walletInstance;
}

/**
 * Get current wallet instance (synchronous - returns null if not in memory)
 * Use getWalletAsync() for auto-restore functionality
 */
export function getWallet(): TokenWallet | null {
  return walletInstance;
}

/**
 * Get current wallet instance with auto-restore from sessionStorage
 * Automatically restores wallet if it exists in sessionStorage but not in memory
 */
export async function getWalletAsync(): Promise<TokenWallet | null> {
  return walletInstance;
}

/**
 * Get Arkade wallet instance
 */
export function getArkadeWallet(): any | null {
  return arkadeWallet;
}

/**
 * Disconnect wallet (clears only this tab's session)
 */
export function disconnectWallet() {
  walletInstance = null;
  arkadeWallet = null;
  activePrivateKey = null;
  activeMnemonic = null;
  notifyWalletChanged();
}

/**
 * Export credentials (private key and mnemonic) from current session
 */
export function exportCredentials(): WalletCredentials | null {
  // Deprecated: secret export is no longer supported in the UI.
  if (!activePrivateKey || !activeMnemonic) return null;
  return { privateKey: activePrivateKey, mnemonic: activeMnemonic };
}

/**
 * Export private key from current session (legacy)
 */
export function exportPrivateKey(): string | null {
  // Deprecated: secret export is no longer supported in the UI.
  return activePrivateKey;
}

/**
 * Export mnemonic from current session
 */
export function exportMnemonic(): string | null {
  // Deprecated: secret export is no longer supported in the UI.
  return activeMnemonic;
}

/**
 * Check if wallet exists in current session
 */
export function hasStoredWallet(): boolean {
  return Boolean(activePrivateKey);
}

/**
 * Get all three addresses (Arkade L2, SegWit P2WPKH, Taproot P2TR)
 */
export async function getAllAddresses(): Promise<{
  arkade: string;
  segwit: string;
  taproot: string;
} | null> {
  console.log('getAllAddresses called');
  console.log('arkadeWallet:', arkadeWallet ? 'exists' : 'null');
  
  if (!arkadeWallet) {
    console.error('getAllAddresses: arkadeWallet is null');
    return null;
  }
  
  const privateKey = activePrivateKey;
  
  console.log('privateKey from sessionStorage:', privateKey ? 'exists (length ' + privateKey.length + ')' : 'null');
    
  if (!privateKey) {
    console.error('getAllAddresses: privateKey is null');
    return null;
  }
  
  try {
    console.log('Starting address generation...');
    // 1. Arkade L2 address
    const arkadeAddress = await arkadeWallet.getAddress();
    
    // 2. SegWit P2WPKH (for token creation OP_RETURN)
    const bitcoinClient = new BitcoinClient(bitcoin.networks.bitcoin);
    const segwitAddress = await bitcoinClient.createAddressFromHex(privateKey);
    
    // 3. Taproot P2TR - Generate mainnet Taproot address from private key
    const taprootAddress = createTaprootAddress(privateKey);
    console.log('Taproot address (mainnet):', taprootAddress);
    
    const result = {
      arkade: arkadeAddress,
      segwit: segwitAddress,
      taproot: taprootAddress,
    };
    console.log('getAllAddresses result:', result);
    return result;
  } catch (error) {
    console.error('Failed to get addresses:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'no stack');
    return null;
  }
}

/**
 * Create Taproot (P2TR) address from private key
 */
function createTaprootAddress(privateKeyHex: string): string {
  const keyPair = ECPair.fromPrivateKey(
    Buffer.from(privateKeyHex, 'hex'),
    { network: bitcoin.networks.bitcoin }
  );

  const { address } = bitcoin.payments.p2tr({
    internalPubkey: keyPair.publicKey.slice(1, 33), // Remove first byte (02/03)
    network: bitcoin.networks.bitcoin,
  });

  if (!address) {
    throw new Error('Failed to create Taproot address');
  }

  return address;
}

/**
 * Get balances for all three addresses
 */
export async function getAllBalances(): Promise<{
  arkade: number;
  segwit: number;
  taproot: number;
  boarding: number;
  total: number;
} | null> {
  console.log('getAllBalances called');
  console.log('arkadeWallet:', arkadeWallet ? 'exists' : 'null');
  
  if (!arkadeWallet) {
    console.error('getAllBalances: arkadeWallet is null');
    return null;
  }
  
  const privateKey = activePrivateKey;
  
  console.log('privateKey from sessionStorage:', privateKey ? 'exists (length ' + privateKey.length + ')' : 'null');
    
  if (!privateKey) {
    console.error('getAllBalances: privateKey is null');
    return null;
  }
  
  try {
    console.log('Starting balance fetch...');
    // 1. Arkade L2 balance
    const arkadeBalance = await arkadeWallet.getBalance();
    const arkadeSats = arkadeBalance.available || 0;
    
    // 2. SegWit balance
    const bitcoinClient = new BitcoinClient(bitcoin.networks.bitcoin);
    const segwitAddress = await bitcoinClient.createAddressFromHex(privateKey);
    const segwitUtxos = await bitcoinClient.getUTXOs(segwitAddress);
    const segwitSats = segwitUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    
    // 3. Taproot balance - Generate mainnet Taproot address from private key
    const taprootAddress = createTaprootAddress(privateKey);
    console.log('Checking balance for Taproot address:', taprootAddress);
    const taprootUtxos = await bitcoinClient.getUTXOs(taprootAddress);
    const taprootSats = taprootUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    
    // 4. Boarding address balance - Get from Arkade wallet
    let boardingSats = 0;
    try {
      const boardingAddress = await arkadeWallet.getBoardingAddress();
      console.log('Checking balance for Boarding address:', boardingAddress);
      const boardingUtxos = await bitcoinClient.getUTXOs(boardingAddress);
      boardingSats = boardingUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
      console.log('Boarding UTXOs:', boardingUtxos, 'Total:', boardingSats);
    } catch (error) {
      console.error('Failed to get boarding balance:', error);
    }
    
    const result = {
      arkade: arkadeSats,
      segwit: segwitSats,
      taproot: taprootSats,
      boarding: boardingSats,
      total: arkadeSats + segwitSats + taprootSats + boardingSats,
    };
    console.log('getAllBalances result:', result);
    return result;
  } catch (error) {
    console.error('Failed to get balances:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'no stack');
    return null;
  }
}

/**
 * Check if user has sufficient balance to create token
 */
export async function canCreateToken(): Promise<{
  canCreate: boolean;
  segwitBalance: number;
  arkadeBalance: number;
  errors: string[];
}> {
  console.log('canCreateToken called');
  console.log('Calling getAllBalances...');
  const balances = await getAllBalances();
  console.log('getAllBalances returned:', balances);
  
  if (!balances) {
    console.error('canCreateToken: balances is null, wallet not initialized');
    return {
      canCreate: false,
      segwitBalance: 0,
      arkadeBalance: 0,
      errors: ['Wallet not initialized'],
    };
  }
  
  const errors: string[] = [];
  const MIN_SEGWIT = 1000; // Need at least 1000 sats for OP_RETURN
  const MIN_ARKADE = 1000; // Need at least 1000 sats for ASP settlement
  
  if (balances.segwit < MIN_SEGWIT) {
    errors.push(
      `Insufficient SegWit balance. Need ${MIN_SEGWIT} sats, have ${balances.segwit} sats. ` +
      `Fund your SegWit address (bc1q...) to create tokens.`
    );
  }
  
  if (balances.arkade < MIN_ARKADE) {
    errors.push(
      `Insufficient Arkade balance. Need ${MIN_ARKADE} sats, have ${balances.arkade} sats.`
    );
  }
  
  return {
    canCreate: errors.length === 0,
    segwitBalance: balances.segwit,
    arkadeBalance: balances.arkade,
    errors,
  };
}
