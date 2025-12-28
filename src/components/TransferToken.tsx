'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { getArkadeWallet, getWalletAsync } from '@/lib/wallet';
import { apiFetch } from '@/lib/api';
import { getPublicIndexerUrl } from '@/lib/indexerUrl';
import { formatTokenAmount, parseTokenAmount } from '@/lib/tokenAmount';
import { useToast } from '@/lib/toast';

interface TokenDetails {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
}

export default function TransferToken() {
  const toast = useToast();
  const [formData, setFormData] = useState({
    tokenId: '',
    to: '',
    amount: '',
  });
  const [loading, setLoading] = useState(false);
  const [txid, setTxid] = useState<string>('');

  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);

  const [showApproval, setShowApproval] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<{
    tokenId: string;
    to: string;
    amountRaw: bigint;
    amountInput: string;
    decimals: number;
    symbol: string;
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
      // modern browsers
      return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    } catch {
      return `${Date.now()}-${Math.random()}`;
    }
  };

  const closeApproval = () => {
    if (loading) return;
    setShowApproval(false);
    setPendingTransfer(null);
  };

  const normalizeAmountIfPossible = () => {
    if (!tokenDetails) return;
    const input = formData.amount.trim();
    if (!input) return;
    try {
      const raw = parseTokenAmount(input, tokenDetails.decimals);
      setFormData({ ...formData, amount: formatTokenAmount(raw, tokenDetails.decimals, { trimTrailingZeros: false, alwaysShowDecimals: true }) });
    } catch {
      // keep user's text; validation happens on submit
    }
  };

  const confirmAndTransfer = async () => {
    if (!pendingTransfer) return;

    try {
      const arkadeWallet = getArkadeWallet();
      if (!arkadeWallet) throw new Error('Please connect your wallet first');

      const wallet = await getWalletAsync();
      if (!wallet) throw new Error('Please connect your wallet first');

      setLoading(true);
      setTxid('');

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
      setTxid(transferId);
      toast.show(`Token transferred successfully${transferId ? ` (Transfer ID: ${transferId.slice(0, 12)}…)` : ''}`, 'success', 4500);

      setFormData({ tokenId: '', to: '', amount: '' });
      setTokenDetails(null);
      setShowApproval(false);
      setPendingTransfer(null);
    } catch (error) {
      console.error('Failed to transfer token:', error);
      const msg = (error as Error)?.message || String(error);
      toast.show(`Failed to transfer token: ${msg}`, 'error', 7000);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const wallet = await getWalletAsync();
    if (!wallet) {
      toast.show('Please connect your wallet first', 'warning', 4000);
      return;
    }

    try {
      const tokenId = formData.tokenId.trim();
      const to = formData.to.trim();
      const amountInput = formData.amount.trim();

      if (!tokenId || tokenId.length !== 64) {
        throw new Error('Token ID must be a 64-character hex string');
      }

      if (!to.startsWith('tark') && !to.startsWith('ark')) {
        throw new Error('Recipient must be an Arkade address (starts with "tark" or "ark")');
      }

      const indexerUrl = getPublicIndexerUrl();
      const response = await fetch(`${indexerUrl}/api/tokens/${tokenId}`);
      if (!response.ok) throw new Error('Failed to fetch token metadata');
      const details = (await response.json()) as TokenDetails;
      setTokenDetails(details);

      const amountRaw = parseTokenAmount(amountInput, details.decimals);
      if (amountRaw <= BigInt(0)) throw new Error('Amount must be greater than 0');

      setPendingTransfer({
        tokenId,
        to,
        amountRaw,
        amountInput,
        decimals: details.decimals,
        symbol: details.symbol,
      });
      setShowApproval(true);
    } catch (error) {
      console.error('Failed to transfer token:', error);
      toast.show('Failed to transfer token: ' + (error as Error).message, 'error', 6000);
    }
  };

  return (
    <div className="p-6 border border-blue-200 rounded-lg bg-white shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Send className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-semibold text-gray-900">Transfer Token</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Token ID
          </label>
          <input
            type="text"
            value={formData.tokenId}
            onChange={(e) => setFormData({ ...formData, tokenId: e.target.value })}
            onBlur={async () => {
              const tokenId = formData.tokenId.trim();
              if (tokenId.length !== 64) return;
              try {
                const indexerUrl = getPublicIndexerUrl();
                const response = await fetch(`${indexerUrl}/api/tokens/${tokenId}`);
                if (!response.ok) return;
                const details = (await response.json()) as TokenDetails;
                setTokenDetails(details);
              } catch {
                // ignore
              }
            }}
            placeholder="Paste token ID here..."
            required
            className="w-full px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            value={formData.to}
            onChange={(e) => setFormData({ ...formData, to: e.target.value })}
            placeholder="bc1q... or tark1..."
            required
            className="w-full px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount
          </label>
          <input
            type="text"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            onBlur={normalizeAmountIfPossible}
            placeholder={tokenDetails ? `e.g. 1000 or 1000.${'0'.repeat(Math.min(3, tokenDetails.decimals))}` : 'e.g. 1000'}
            required
            inputMode="decimal"
            className="w-full px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
          />
          {tokenDetails && (
            <p className="mt-1 text-xs text-gray-600">
              Decimals: {tokenDetails.decimals}
              {(() => {
                try {
                  const raw = parseTokenAmount(formData.amount.trim() || '0', tokenDetails.decimals);
                  return ` • Interpreted as: ${formatTokenAmount(raw, tokenDetails.decimals, { trimTrailingZeros: false, alwaysShowDecimals: true })} ${tokenDetails.symbol}`;
                } catch {
                  return '';
                }
              })()}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || showApproval}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
        >
          {loading ? 'Transferring...' : 'Transfer Token'}
        </button>
      </form>

      {txid && (
        <div className="mt-4 p-4 bg-green-50 border-2 border-green-500 rounded-lg shadow-md">
          <p className="text-sm text-green-700 font-semibold mb-1">Transfer ID:</p>
          <p className="text-xs font-mono text-gray-900 break-all">{txid}</p>
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
                  <span className="font-mono">{formatTokenAmount(pendingTransfer.amountRaw, pendingTransfer.decimals)} {pendingTransfer.symbol}</span>
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
                disabled={loading}
                className="flex-1 border border-blue-300 text-gray-900 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAndTransfer}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Transferring...' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
