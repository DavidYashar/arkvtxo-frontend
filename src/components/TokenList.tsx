'use client';

import { useState, useEffect } from 'react';
import { Coins, RefreshCw, X, Send as SendIcon, Info } from 'lucide-react';
import { getArkadeWallet, getWalletAsync } from '@/lib/wallet';
import { getTokens as getStoredTokens } from '@/lib/tokenStorage';
import { debugLog } from '@/lib/debug';
import { getPublicIndexerUrl } from '@/lib/indexerUrl';
import { apiFetch } from '@/lib/api';
import { formatTokenAmount, parseTokenAmount } from '@/lib/tokenAmount';
import { useToast } from '@/lib/toast';
import type { TokenBalance } from '@arkade-token/sdk';

interface TokenDetails {
  id: string;
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  creator: string;
  status?: string;
  createdAt: string;
  createdInTx: string;
}

export default function TokenList() {
  const toast = useToast();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({ to: '', amount: '' });
  const [sending, setSending] = useState(false);
  const [userAddress, setUserAddress] = useState<string>('');

  const [tokenDecimalsById, setTokenDecimalsById] = useState<Record<string, number>>({});

  const [showApproval, setShowApproval] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<{
    tokenId: string;
    to: string;
    amountRaw: bigint;
    amountInput: string;
  } | null>(null);

  const short = (s: string) => {
    const v = String(s || '');
    if (v.length <= 20) return v;
    return `${v.slice(0, 10)}…${v.slice(-8)}`;
  };

  const toHex = (bytes: Uint8Array): string =>
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  const makeNonce = (): string => {
    try {
      return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    } catch {
      return `${Date.now()}-${Math.random()}`;
    }
  };

  const closeApproval = () => {
    if (sending) return;
    setShowApproval(false);
    setPendingTransfer(null);
  };

  const signAndTransfer = async () => {
    if (!pendingTransfer) return;

    try {
      const arkadeWallet = getArkadeWallet();
      if (!arkadeWallet) throw new Error('Wallet not connected');

      const wallet = await getWalletAsync();
      if (!wallet) throw new Error('Wallet not connected');

      setSending(true);

      const fromAddress = await wallet.getAddress();

      const nonce = makeNonce();
      const expiresAt = Date.now() + 5 * 60 * 1000;
      const intentPayload = {
        intentType: 'ARKADE_TOKEN_TRANSFER_V1',
        tokenId: pendingTransfer.tokenId,
        fromAddress,
        toAddress: pendingTransfer.to,
        amount: pendingTransfer.amountRaw.toString(),
        nonce,
        expiresAt,
      };

      const message = JSON.stringify(intentPayload);
      const messageBytes = new TextEncoder().encode(message);
      const [sig, pubkey] = await Promise.all([
        arkadeWallet.identity.signMessage(messageBytes, 'schnorr'),
        arkadeWallet.identity.xOnlyPublicKey(),
      ]);

      const signatureHex = toHex(sig);
      const pubkeyHex = toHex(pubkey);

      const result = await apiFetch<{ success: boolean; transferId?: string }>('/api/transfers', {
        method: 'POST',
        body: JSON.stringify({
          tokenId: pendingTransfer.tokenId,
          fromAddress,
          toAddress: pendingTransfer.to,
          amount: pendingTransfer.amountRaw.toString(),
          intentType: 'ARKADE_TOKEN_TRANSFER_V1',
          nonce,
          expiresAt,
          signatureHex,
          pubkeyHex,
        }),
      });

      const transferId = result?.transferId || '';
      toast.show(`Token sent successfully${transferId ? ` (Transfer ID: ${transferId.slice(0, 12)}…)` : ''}`, 'success', 4500);
      setShowSendModal(false);
      setSendForm({ to: '', amount: '' });
      loadTokens();
      setShowApproval(false);
      setPendingTransfer(null);
    } catch (error) {
      console.error('Failed to send token:', error);
      const msg = (error as Error)?.message || String(error);
      toast.show('Failed to send token: ' + msg, 'error', 7000);
    } finally {
      setSending(false);
    }
  };

  const mergeWithLocallyCreatedTokens = (balances: TokenBalance[], walletAddr: string): TokenBalance[] => {
    if (!walletAddr) return balances;

    // LocalStorage is used as a temporary UX cache for newly created tokens.
    // We merge them into the balances list so the creator sees the full supply immediately.
    const stored = getStoredTokens().filter((t) => t.creator === walletAddr);
    if (stored.length === 0) return balances;

    const byTokenId = new Map<string, TokenBalance>();
    for (const bal of balances) byTokenId.set(bal.tokenId, bal);

    for (const t of stored) {
      if (byTokenId.has(t.tokenId)) continue; // Prefer real indexer balances
      try {
        byTokenId.set(t.tokenId, {
          address: walletAddr,
          tokenId: t.tokenId,
          balance: BigInt(t.totalSupply),
          symbol: t.symbol,
        });
      } catch {
        // Ignore malformed entries
      }
    }

    return Array.from(byTokenId.values());
  };

  const formatTokenStatus = (status?: string): string => {
    if (!status) return 'Unknown';
    switch (status) {
      case 'pending':
        return 'Pending (Bitcoin confirmations)';
      case 'awaiting_settlement':
        return 'Awaiting settlement (ASP)';
      case 'confirmed':
        return 'Confirmed';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  const loadTokens = async () => {
    const wallet = await getWalletAsync();
    if (!wallet) return;

    try {
      setLoading(true);

      // Determine current wallet address (used for local created-token merge).
      const addr = await wallet.getAddress();
      setUserAddress(addr);
      
      // Load balances from indexer API (this is address-specific)
      const balances = await wallet.getTokenBalances();
      setTokens(mergeWithLocallyCreatedTokens(balances, addr));
      debugLog('Loaded token balances from indexer', { tokenCount: balances.length });

      // Seed decimals cache from locally-stored metadata (fast path for newly created tokens)
      try {
        const stored = getStoredTokens();
        setTokenDecimalsById((prev) => {
          const next = { ...prev };
          for (const t of stored) next[t.tokenId] = t.decimals;
          return next;
        });
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Failed to load tokens from indexer:', error);
      // Still show locally-created tokens for this wallet, if available.
      try {
        const wallet = await getWalletAsync();
        const addr = wallet ? await wallet.getAddress() : '';
        setUserAddress(addr);
        setTokens(mergeWithLocallyCreatedTokens([], addr));
      } catch {
        setTokens([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch decimals for any tokens not cached yet.
    if (tokens.length === 0) return;

    const missing = tokens.map((t) => t.tokenId).filter((id) => tokenDecimalsById[id] === undefined);
    if (missing.length === 0) return;

    let cancelled = false;
    const indexerUrl = getPublicIndexerUrl();

    (async () => {
      const results = await Promise.all(
        missing.map(async (tokenId) => {
          try {
            const res = await fetch(`${indexerUrl}/api/tokens/${tokenId}`);
            if (!res.ok) return null;
            const details = (await res.json()) as TokenDetails;
            return [tokenId, details.decimals] as const;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;
      setTokenDecimalsById((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (!r) continue;
          next[r[0]] = r[1];
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [tokens, tokenDecimalsById]);

  useEffect(() => {
    loadTokens();
    
    // Refresh every 10 seconds
    const interval = setInterval(loadTokens, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // If a token is created in another tab, refresh My Tokens list.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'arkade_tokens') {
        loadTokens();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleShowDetails = async (token: TokenBalance) => {
    setSelectedToken(token);
    setShowDetailsModal(true);
    
    // Fetch full token details from indexer
    try {
      const indexerUrl = getPublicIndexerUrl();
      const response = await fetch(`${indexerUrl}/api/tokens/${token.tokenId}`);
      if (response.ok) {
        const details = await response.json();
        setTokenDetails(details);
      }
    } catch (error) {
      console.error('Failed to fetch token details:', error);
    }
  };

  const handleShowSend = async (token: TokenBalance) => {
    setSelectedToken(token);
    setShowSendModal(true);
    setSendForm({ to: '', amount: '' });

    // Ensure we have decimals for parsing.
    try {
      const indexerUrl = getPublicIndexerUrl();
      const response = await fetch(`${indexerUrl}/api/tokens/${token.tokenId}`);
      if (response.ok) {
        const details = await response.json();
        setTokenDetails(details);
        setTokenDecimalsById((prev) => ({ ...prev, [token.tokenId]: details.decimals }));
      }
    } catch {
      // ignore
    }
  };

  const handleSend = async () => {
    if (!selectedToken || !sendForm.to || !sendForm.amount) {
      toast.show('Please fill in all fields', 'warning', 4000);
      return;
    }

    const wallet = await getWalletAsync();
    if (!wallet) {
      toast.show('Wallet not connected', 'warning', 4000);
      return;
    }

    try {
      const tokenId = selectedToken.tokenId;
      const to = sendForm.to.trim();
      const decimals = tokenDetails?.decimals ?? tokenDecimalsById[tokenId] ?? 0;
      const amountRaw = parseTokenAmount(sendForm.amount.trim(), decimals);

      if (amountRaw <= BigInt(0)) throw new Error('Amount must be greater than 0');

      if (!to.startsWith('tark') && !to.startsWith('ark')) {
        throw new Error('Recipient must be an Arkade address (starts with "tark" or "ark")');
      }

      setPendingTransfer({ tokenId, to, amountRaw, amountInput: sendForm.amount.trim() });
      setShowApproval(true);
    } catch (error) {
      console.error('Failed to send token:', error);
      toast.show('Failed to send token: ' + (error as Error).message, 'error', 6000);
    }
  };

  return (
    <div className="p-6 border border-blue-200 rounded-lg bg-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Coins className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-semibold text-gray-900">My Tokens</h3>
        </div>
        <button
          onClick={loadTokens}
          disabled={loading}
          className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {tokens.length === 0 ? (
        <div className="text-center py-12">
          <Coins className="w-16 h-16 mx-auto mb-4 text-blue-300" />
          <p className="text-gray-600">No tokens found</p>
          <p className="text-sm text-gray-600 mt-2">Create your first token to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tokens.map((token) => (
            <div
              key={token.tokenId}
              className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-gray-900 font-semibold">{token.symbol || 'Unknown'}</h4>
                  <p className="text-xs text-gray-600 font-mono">{token.tokenId.slice(0, 16)}...</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatTokenAmount(token.balance, tokenDecimalsById[token.tokenId] ?? 0)}
                  </p>
                  <p className="text-xs text-gray-600">Balance</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button 
                  onClick={() => handleShowSend(token)}
                  className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors shadow-lg flex items-center justify-center gap-1"
                >
                  <SendIcon className="w-4 h-4" />
                  Send
                </button>
                <button 
                  onClick={() => handleShowDetails(token)}
                  className="flex-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 text-sm rounded transition-colors shadow-lg flex items-center justify-center gap-1"
                >
                  <Info className="w-4 h-4" />
                  Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedToken && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-blue-500 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Token Details</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setTokenDetails(null);
                }}
                className="text-gray-600 hover:text-gray-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {tokenDetails ? (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Status</p>
                  <p className="text-gray-900 font-semibold">{formatTokenStatus(tokenDetails.status)}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Name</p>
                  <p className="text-gray-900 font-semibold">{tokenDetails.name}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Symbol</p>
                  <p className="text-gray-900 font-semibold">{tokenDetails.symbol}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Total Supply</p>
                  <p className="text-gray-900 font-semibold">
                    {formatTokenAmount(tokenDetails.totalSupply, tokenDetails.decimals)} {tokenDetails.symbol}
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Decimals</p>
                  <p className="text-gray-900 font-semibold">{tokenDetails.decimals}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Your Balance</p>
                  <p className="text-gray-900 font-semibold">
                    {formatTokenAmount(selectedToken.balance.toString(), tokenDetails.decimals)} {tokenDetails.symbol}
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Creator Address</p>
                  <p className="text-gray-900 font-mono text-xs break-all">{tokenDetails.creator}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Token ID</p>
                  <p className="text-gray-900 font-mono text-xs break-all">{tokenDetails.id}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Created In Transaction</p>
                  <p className="text-gray-900 font-mono text-xs break-all">{tokenDetails.createdInTx}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Created At</p>
                  <p className="text-gray-900 text-sm">{new Date(tokenDetails.createdAt).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  })}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading details...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && selectedToken && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-blue-500 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Send {selectedToken.symbol}</h2>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4 bg-blue-50 p-4 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Available Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatTokenAmount(selectedToken.balance, tokenDetails?.decimals ?? tokenDecimalsById[selectedToken.tokenId] ?? 0)}
              </p>
              {(tokenDetails?.decimals ?? tokenDecimalsById[selectedToken.tokenId]) !== undefined && (
                <p className="text-xs text-gray-600 mt-1">Decimals: {tokenDetails?.decimals ?? tokenDecimalsById[selectedToken.tokenId]}</p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={sendForm.to}
                  onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
                  placeholder="tark1q..."
                  className="w-full px-4 py-2 bg-white border border-blue-300 rounded-lg text-gray-900 placeholder-gray-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount
                </label>
                <input
                  type="text"
                  value={sendForm.amount}
                  onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })}
                  onBlur={() => {
                    const tokenId = selectedToken.tokenId;
                    const decimals = tokenDetails?.decimals ?? tokenDecimalsById[tokenId] ?? 0;
                    const input = sendForm.amount.trim();
                    if (!input) return;
                    try {
                      const raw = parseTokenAmount(input, decimals);
                      setSendForm({ ...sendForm, amount: formatTokenAmount(raw, decimals, { trimTrailingZeros: false, alwaysShowDecimals: true }) });
                    } catch {
                      // keep user's text
                    }
                  }}
                  placeholder="100"
                  inputMode="decimal"
                  className="w-full px-4 py-2 bg-white border border-blue-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                />
                <p className="mt-1 text-xs text-gray-600">
                  {(() => {
                    const tokenId = selectedToken.tokenId;
                    const decimals = tokenDetails?.decimals ?? tokenDecimalsById[tokenId] ?? 0;
                    const symbol = tokenDetails?.symbol ?? selectedToken.symbol ?? '';
                    try {
                      const raw = parseTokenAmount(sendForm.amount.trim() || '0', decimals);
                      return `Interpreted as: ${formatTokenAmount(raw, decimals, { trimTrailingZeros: false, alwaysShowDecimals: true })}${symbol ? ` ${symbol}` : ''}`;
                    } catch {
                      return '';
                    }
                  })()}
                </p>
              </div>

              <button
                onClick={handleSend}
                disabled={sending || showApproval || !sendForm.to || !sendForm.amount}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
              >
                {sending ? 'Sending...' : 'Send Token'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApproval && pendingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-blue-200 bg-white shadow-xl">
            <div className="p-5 border-b border-blue-200">
              <div className="text-lg font-semibold text-gray-900">Confirm Transfer</div>
              <div className="text-xs text-gray-700 mt-1">This will ask your Arkade wallet to sign a transfer intent, then submit it.</div>
            </div>

            <div className="p-5 space-y-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-gray-900">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-700">To</span>
                  <span className="font-mono">{short(pendingTransfer.to)}</span>
                </div>
                <div className="flex justify-between gap-3 mt-2">
                  <span className="text-gray-700">Amount</span>
                  <span className="font-mono">
                    {formatTokenAmount(
                      pendingTransfer.amountRaw,
                      tokenDetails?.decimals ?? tokenDecimalsById[pendingTransfer.tokenId] ?? 0
                    )}
                    {tokenDetails?.symbol ? ` ${tokenDetails.symbol}` : ''}
                  </span>
                </div>
                <div className="flex justify-between gap-3 mt-2">
                  <span className="text-gray-700">Token</span>
                  <span className="font-mono">{short(pendingTransfer.tokenId)}</span>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-blue-200 flex gap-3">
              <button
                type="button"
                onClick={closeApproval}
                disabled={sending}
                className="flex-1 border border-blue-300 text-gray-900 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={signAndTransfer}
                disabled={sending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
