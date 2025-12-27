'use client';

import { useState } from 'react';
import { getArkadeWallet } from '@/lib/wallet';
import { Send, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { debugLog } from '@/lib/debug';

export default function SendBitcoin() {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [approvalSigning, setApprovalSigning] = useState(false);
  const [pendingSend, setPendingSend] = useState<{ recipient: string; amountSats: number } | null>(null);
  const [approvalPayload, setApprovalPayload] = useState<Record<string, unknown> | null>(null);
  const [approvalSignatureHex, setApprovalSignatureHex] = useState<string | null>(null);
  const [approvalPubkeyHex, setApprovalPubkeyHex] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);

  const toHex = (bytes: Uint8Array): string =>
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  const short = (s: string) => {
    const v = String(s || '');
    if (v.length <= 20) return v;
    return `${v.slice(0, 10)}…${v.slice(-8)}`;
  };

  const closeApproval = () => {
    if (approvalSigning || loading) return;
    setShowApproval(false);
    setPendingSend(null);
    setApprovalPayload(null);
    setApprovalSignatureHex(null);
    setApprovalPubkeyHex(null);
  };

  const signAndSend = async () => {
    setError(null);
    setSuccess(null);
    setTxid(null);

    if (!pendingSend) {
      setError('Nothing to send');
      return;
    }

    try {
      const wallet = getArkadeWallet();
      if (!wallet) throw new Error('Wallet not connected');

      setApprovalSigning(true);

      const payload = approvalPayload;
      if (!payload) throw new Error('Missing approval payload');

      const message = JSON.stringify(payload);
      const messageBytes = new TextEncoder().encode(message);

      const [sig, pubkey] = await Promise.all([
        wallet.identity.signMessage(messageBytes, 'schnorr'),
        wallet.identity.xOnlyPublicKey(),
      ]);

      const sigHex = toHex(sig);
      const pubHex = toHex(pubkey);
      setApprovalSignatureHex(sigHex);
      setApprovalPubkeyHex(pubHex);

      debugLog('Arkade send approval signed', {
        pubkey: pubHex.slice(0, 12) + '…',
        sigLen: sigHex.length,
      });

      setLoading(true);
      const txid = await wallet.sendBitcoin({
        address: pendingSend.recipient,
        amount: pendingSend.amountSats,
      });

      debugLog('Send successful', {
        txid: typeof txid === 'string' ? `${txid.slice(0, 8)}…${txid.slice(-6)}` : String(txid),
      });

      setTxid(txid);
      setSuccess(
        `Successfully sent ${pendingSend.amountSats.toLocaleString()} sats to ${pendingSend.recipient.slice(0, 12)}...${pendingSend.recipient.slice(-8)}`
      );

      setRecipientAddress('');
      setAmount('');
      setShowApproval(false);
      setPendingSend(null);
    } catch (err: any) {
      console.error('Send error:', err);
      setError(err?.message || 'Failed to send Bitcoin');
    } finally {
      setApprovalSigning(false);
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setTxid(null);

    try {
      const wallet = getArkadeWallet();
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      if (!recipientAddress) {
        throw new Error('Please enter a recipient address');
      }

      if (!amount || parseFloat(amount) <= 0) {
        throw new Error('Please enter a valid amount');
      }

      // Validate Arkade address format (should start with 'tark' for testnet or 'ark' for mainnet)
      if (!recipientAddress.startsWith('tark') && !recipientAddress.startsWith('ark')) {
        throw new Error('Invalid Arkade address. Address should start with "tark" or "ark"');
      }

      const amountSats = Math.floor(parseFloat(amount));
      
      // Check balance
      const balance = await wallet.getBalance();
      const availableBalance = balance.available || 0;
      
      if (!availableBalance || amountSats > availableBalance) {
        throw new Error(`Insufficient balance. Available: ${availableBalance.toLocaleString()} sats`);
      }

      // Prepare a short-lived, per-action approval payload.
      // This does not replace tx signing; it adds explicit user intent confirmation.
      const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random()}`;
      const expiresAt = Date.now() + 2 * 60 * 1000;
      const payload: Record<string, unknown> = {
        domain: typeof window !== 'undefined' ? window.location.host : 'unknown',
        action: 'arkade_send',
        recipient: recipientAddress,
        amountSats,
        nonce,
        expiresAt,
      };

      setPendingSend({ recipient: recipientAddress, amountSats });
      setApprovalPayload(payload);
      setApprovalSignatureHex(null);
      setApprovalPubkeyHex(null);
      setShowApproval(true);

    } catch (err: any) {
      console.error('Send error:', err);
      setError(err.message || 'Failed to send Bitcoin');
    }
  };

  return (
    <div className="p-6 border border-blue-300 rounded-lg bg-white shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Send className="w-6 h-6 text-blue-700" />
        <h3 className="text-xl font-semibold text-blue-900">Send Bitcoin (Arkade L2)</h3>
      </div>

      {/* Info Banner */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-300 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>Instant transfers:</strong> Send Bitcoin to other Arkade wallets instantly with no on-chain fees. 
          Transactions are settled offchain with instant confirmation.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-800">{success}</div>
          </div>
          {txid && txid !== 'pending' && (
            <div className="mt-2 pt-2 border-t border-green-200">
              <p className="text-xs text-green-700">
                <strong>Transaction ID:</strong>
              </p>
              <p className="text-xs text-green-900 font-mono break-all mt-1">{txid}</p>
            </div>
          )}
        </div>
      )}

      {/* Send Form */}
      <form onSubmit={handleSend} className="space-y-4">
        {/* Recipient Address */}
        <div>
          <label className="block text-sm font-medium text-blue-800 mb-2">
            Recipient Arkade Address
          </label>
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="tark1q..."
            className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            disabled={loading}
          />
          <p className="text-xs text-blue-600 mt-1">
            Enter the recipient's Arkade address (starts with "tark" or "ark")
          </p>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-blue-800 mb-2">
            Amount (satoshis)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10000"
            min="1"
            step="1"
            className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <p className="text-xs text-blue-600 mt-1">
            {amount && parseFloat(amount) > 0 
              ? `≈ ${(parseFloat(amount) / 100000000).toFixed(8)} BTC`
              : 'Enter amount in satoshis (1 BTC = 100,000,000 sats)'}
          </p>
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={loading || approvalSigning || showApproval || !recipientAddress || !amount}
          className="w-full bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Send Bitcoin
            </>
          )}
        </button>
      </form>

      {/* Approval Modal */}
      {showApproval && pendingSend && approvalPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-blue-300 bg-white shadow-xl">
            <div className="p-5 border-b border-blue-200">
              <div className="text-lg font-semibold text-blue-900">Confirm & Sign</div>
              <div className="text-xs text-blue-700 mt-1">One signature for this send only.</div>
            </div>

            <div className="p-5 space-y-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <div className="flex justify-between gap-3">
                  <span className="text-blue-800">Recipient</span>
                  <span className="font-mono">{short(pendingSend.recipient)}</span>
                </div>
                <div className="flex justify-between gap-3 mt-2">
                  <span className="text-blue-800">Amount</span>
                  <span className="font-mono">{pendingSend.amountSats.toLocaleString()} sats</span>
                </div>
              </div>

              <div className="text-[11px] text-blue-700">
                This will sign a schnorr approval message with your Arkade wallet key, then submit the transfer.
              </div>

              {(approvalSignatureHex || approvalPubkeyHex) && (
                <div className="rounded-lg border border-blue-200 bg-white p-3 text-[11px] text-blue-900">
                  {approvalPubkeyHex && (
                    <div className="break-all">
                      <span className="text-blue-800">x-only pubkey:</span> <span className="font-mono">{approvalPubkeyHex}</span>
                    </div>
                  )}
                  {approvalSignatureHex && (
                    <div className="break-all mt-2">
                      <span className="text-blue-800">signature:</span> <span className="font-mono">{approvalSignatureHex}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-blue-200 flex gap-3">
              <button
                type="button"
                onClick={closeApproval}
                disabled={loading || approvalSigning}
                className="flex-1 border border-blue-300 text-blue-900 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={signAndSend}
                disabled={loading || approvalSigning}
                className="flex-1 bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {approvalSigning || loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing...
                  </>
                ) : (
                  'Sign & Send'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-300 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>How it works:</strong> Arkade L2 transfers are instant and free. Your Bitcoin stays secure 
          while being transferred as Virtual Transaction Outputs (VTXOs) between Arkade addresses. 
          The recipient can spend immediately or withdraw to Layer 1 anytime.
        </p>
      </div>
    </div>
  );
}
