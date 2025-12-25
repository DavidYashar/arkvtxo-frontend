export type WalletVaultPayload = {
  privateKey: string;
};

type WalletVaultRecordV1 = {
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
  createdAtMs: number;
};

const VAULT_STORAGE_KEY = 'arkade_wallet_vault_v1';
const PBKDF2_ITERATIONS = 250_000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // Ensure we hand WebCrypto an ArrayBuffer (not ArrayBufferLike).
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function ensureBrowserCrypto() {
  if (typeof window === 'undefined') {
    throw new Error('Vault is only available in the browser');
  }
  if (!window.crypto?.subtle) {
    throw new Error('WebCrypto is not available in this browser');
  }
}

async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  ensureBrowserCrypto();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function normalizePassword(password: string): string {
  return password.normalize('NFKC');
}

export function hasVault(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.localStorage.getItem(VAULT_STORAGE_KEY));
}

export function clearVault(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(VAULT_STORAGE_KEY);
}

export async function createVault(password: string, payload: WalletVaultPayload): Promise<void> {
  ensureBrowserCrypto();

  const normalizedPassword = normalizePassword(password);
  if (!normalizedPassword) throw new Error('Password is required');

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKeyFromPassword(normalizedPassword, salt);
  const plaintext = textEncoder.encode(JSON.stringify(payload));

  const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  const record: WalletVaultRecordV1 = {
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    saltB64: toBase64(salt),
    ivB64: toBase64(iv),
    ciphertextB64: toBase64(new Uint8Array(ciphertext)),
    createdAtMs: Date.now(),
  };

  window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(record));
}

export async function unlockVault(password: string): Promise<WalletVaultPayload> {
  ensureBrowserCrypto();

  const raw = window.localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) throw new Error('No vault found');

  let record: WalletVaultRecordV1;
  try {
    record = JSON.parse(raw) as WalletVaultRecordV1;
  } catch {
    throw new Error('Vault data is corrupted');
  }

  if (record?.version !== 1) {
    throw new Error('Unsupported vault version');
  }

  const normalizedPassword = normalizePassword(password);
  const salt = fromBase64(record.saltB64);
  const iv = fromBase64(record.ivB64);
  const ciphertext = fromBase64(record.ciphertextB64);

  try {
    const key = await deriveKeyFromPassword(normalizedPassword, salt);
    const plaintext = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext)
    );
    const decoded = textDecoder.decode(new Uint8Array(plaintext));
    const payload = JSON.parse(decoded) as WalletVaultPayload;

    if (!payload?.privateKey || typeof payload.privateKey !== 'string') {
      throw new Error('Vault payload is invalid');
    }

    return payload;
  } catch (e: any) {
    // Wrong password typically throws a DOMException from subtle.decrypt.
    const msg = String(e?.message || 'Invalid password');
    if (msg.toLowerCase().includes('operation') || msg.toLowerCase().includes('decrypt')) {
      throw new Error('Invalid password');
    }
    throw new Error(msg);
  }
}
