'use client';

import { useState, useEffect } from 'react';
import { PlusCircle, Lock } from 'lucide-react';
import { getWallet, getWalletAsync, canCreateToken, getArkadeWallet } from '@/lib/wallet';
import { useToast } from '@/lib/toast';
import { apiFetch } from '@/lib/api';
import { getMempoolUrl, getNetworkName } from '@/lib/mempool';
import { debugLog } from '@/lib/debug';
import { getPublicIndexerUrl } from '@/lib/indexerUrl';
import FeeSelection from './FeeSelection';

export default function CreateToken() {
  const toast = useToast();
  const SELF_SEND_SATS = 1000;
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    totalSupply: '',
    decimals: '8',
    presaleBatchAmount: '',
    priceInSats: '',
    maxPurchasesPerWallet: '',
  });

  // Validation helpers
  const validateTokenName = (value: string): string => {
    // Only uppercase letters, 6-8 characters
    const filtered = value.toUpperCase().replace(/[^A-Z]/g, '');
    return filtered.slice(0, 8);
  };

  const validateSymbol = (value: string): string => {
    // Only uppercase letters, exactly 4 characters
    const filtered = value.toUpperCase().replace(/[^A-Z]/g, '');
    return filtered.slice(0, 4);
  };

  const validateNumericInput = (value: string, allowLeadingZero: boolean = false): string => {
    // Only numbers, optionally prevent leading zero
    let filtered = value.replace(/[^0-9]/g, '');
    if (!allowLeadingZero && filtered.length > 1 && filtered.startsWith('0')) {
      filtered = filtered.replace(/^0+/, '');
    }
    if (!allowLeadingZero && filtered === '0') {
      return '';
    }
    return filtered;
  };
  const [loading, setLoading] = useState(false);
  const [txid, setTxid] = useState<string>('');
  const [balanceCheck, setBalanceCheck] = useState<{
    canCreate: boolean;
    segwitBalance: number;
    arkadeBalance: number;
    errors: string[];
  } | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [userAddress, setUserAddress] = useState<string>('');
  const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null); // null = not checked yet
  const [checkingWhitelist, setCheckingWhitelist] = useState(true);
  const [selectedFeeRate, setSelectedFeeRate] = useState<number>(31); // Default medium priority

  // --- Per-action approval signing (schnorr), same UX as SendBitcoin ---
  const [showApproval, setShowApproval] = useState(false);
  const [approvalSigning, setApprovalSigning] = useState(false);
  const [approvalPayload, setApprovalPayload] = useState<Record<string, unknown> | null>(null);
  const [approvalSignatureHex, setApprovalSignatureHex] = useState<string | null>(null);
  const [approvalPubkeyHex, setApprovalPubkeyHex] = useState<string | null>(null);

  type PendingAction =
    | { type: 'create'; params: any }
    | { type: 'finalize'; tokenId: string; issuerAddress?: string };
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

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

    // If the user cancels finalization, keep a way to re-open.
    if (pendingAction?.type === 'finalize') {
      toast.show('Finalization pending. You can finalize when ready.', 'info', 12000, {
        action: {
          label: 'Finalize now',
          onClick: () => setShowApproval(true),
        },
      });
    } else {
      setPendingAction(null);
      setApprovalPayload(null);
    }

    setShowApproval(false);
  };

  const signApprovalPayload = async () => {
    const arkadeWallet = getArkadeWallet();
    if (!arkadeWallet) throw new Error('Arkade wallet not ready');
    if (!approvalPayload) throw new Error('Missing approval payload');

    const message = JSON.stringify(approvalPayload);
    const messageBytes = new TextEncoder().encode(message);
    const [sig, pubkey] = await Promise.all([
      arkadeWallet.identity.signMessage(messageBytes, 'schnorr'),
      arkadeWallet.identity.xOnlyPublicKey(),
    ]);

    const sigHex = toHex(sig);
    const pubHex = toHex(pubkey);
    setApprovalSignatureHex(sigHex);
    setApprovalPubkeyHex(pubHex);
    return { sigHex, pubHex };
  };

  const handleApprovalConfirm = async () => {
    if (!pendingAction) return;

    try {
      setApprovalSigning(true);
      await signApprovalPayload();

      if (pendingAction.type === 'create') {
        setLoading(true);
        setTxid('');

        const wallet = await getWalletAsync();
        if (!wallet) throw new Error('Wallet not connected');

        debugLog('CreateToken: approval signed; calling wallet.createToken()');
        const tokenId = await wallet.createToken(pendingAction.params);

        debugLog('CreateToken: OP_RETURN submitted (txid prefix)', tokenId?.slice?.(0, 10));
        setTxid(tokenId);

        if (!tokenId || tokenId.length !== 64) {
          throw new Error('Invalid transaction ID received from SDK');
        }

        toast.show(
          ` Token ${pendingAction.params.symbol} submitted! TX: ${tokenId.slice(0, 8)}...${tokenId.slice(-8)}. Backend monitoring for confirmation.`,
          'success',
          15000,
          {
            action: {
              label: 'View on Mempool',
              onClick: () => window.open(getMempoolUrl(tokenId), '_blank', 'noopener,noreferrer'),
            },
          }
        );

        await checkBalances();

        setFormData({
          name: '',
          symbol: '',
          totalSupply: '',
          decimals: '8',
          presaleBatchAmount: '',
          priceInSats: '',
          maxPurchasesPerWallet: '',
        });

        setPendingAction(null);
        setApprovalPayload(null);
        setShowApproval(false);
      }

      if (pendingAction.type === 'finalize') {
        setLoading(true);

        const wallet = await getWalletAsync();
        if (!wallet) throw new Error('Wallet not connected');

        const currentAddress = await wallet.getAddress();
        if (pendingAction.issuerAddress && pendingAction.issuerAddress !== currentAddress) {
          debugLog('Finalize: ignoring for different wallet', { tokenId: pendingAction.tokenId });
          setPendingAction(null);
          setApprovalPayload(null);
          setShowApproval(false);
          return;
        }

        const arkadeWallet = getArkadeWallet();
        if (!arkadeWallet) throw new Error('Arkade wallet not ready');

        debugLog('Finalize: sending self-send for finalization', { sats: SELF_SEND_SATS });
        const txid = await arkadeWallet.sendBitcoin({
          address: currentAddress,
          amount: SELF_SEND_SATS,
        });

        await apiFetch(`/api/tokens/${pendingAction.tokenId}/settle`, {
          method: 'POST',
          body: JSON.stringify({ txid }),
        });

        debugLog('Token finalization completed with backend');
        toast.show(' Token finalization submitted.', 'success', 6000);

        setPendingAction(null);
        setApprovalPayload(null);
        setShowApproval(false);
      }
    } catch (error: any) {
      console.error('Approval flow failed', error);
      toast.show(`Approval failed: ${error?.message || 'Unknown error'}`, 'error', 8000);
    } finally {
      setApprovalSigning(false);
      setLoading(false);
    }
  };

  // WebSocket listener for token confirmation
  useEffect(() => {
    let socket: any = null;
    const handledSettlements = new Set<string>();

    const waitForWalletReady = async (maxRetries: number, delayMs: number) => {
      for (let i = 0; i < maxRetries; i++) {
        const wallet = await getWalletAsync();
        if (wallet) return wallet;
        await new Promise((r) => setTimeout(r, delayMs));
      }
      return null;
    };

    const setupWebSocket = async () => {
      try {
        const wallet = await getWalletAsync();
        if (!wallet) {
          debugLog('WebSocket: wallet not ready');
          return;
        }

        const address = await wallet.getAddress();
        const indexerUrl = getPublicIndexerUrl();
        debugLog('WebSocket: setting up', { indexerUrl });
        
        // Dynamic import to avoid SSR issues
        const { io } = await import('socket.io-client');
        socket = io(indexerUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
        });

        socket.on('connect', () => {
          debugLog('WebSocket connected');
          socket.emit('join-wallet', address);
          debugLog('WebSocket joined wallet room');
        });

        socket.on('connect_error', (error: any) => {
          debugLog('WebSocket connection error', {
            message: error instanceof Error ? error.message : String(error),
            indexerUrl,
          });
        });

        socket.on('token-confirmed', (data: any) => {
          debugLog('WebSocket token-confirmed received');
          toast.show(
            `🎉 ${data.message}`,
            'success',
            10000,
            {
              action: {
                label: 'View Token',
                onClick: () => window.location.href = '/'
              }
            }
          );
        });

        // Bitcoin confirmed -> user signs an approval message, then client performs an ASP-side tx (1000 sats to self), then finalize with backend.
        socket.on('token-bitcoin-confirmed', async (data: any) => {
          debugLog('WebSocket token-bitcoin-confirmed received');

          if (!data?.tokenId) return;
          if (handledSettlements.has(data.tokenId)) {
            debugLog('Settlement already handled for token');
            return;
          }

          handledSettlements.add(data.tokenId);

          try {
            toast.show(data.message || 'Bitcoin confirmed. Awaiting approval to finalize...', 'info', 8000);

            // Always compute the current wallet address at the time of the event.
            // This guarantees sender/receiver correctness even if the wallet changes after socket setup.
            const wallet = await waitForWalletReady(20, 500);
            if (!wallet) {
              throw new Error('Wallet not ready (timed out)');
            }

            const currentAddress = await wallet.getAddress();
            const issuerAddress = (data?.issuerAddress as string | undefined) || address;

            // Safety guard: event should be for the connected wallet.
            // If it doesn't match, do nothing (prevents accidental sends to a third-party address).
            if (issuerAddress && issuerAddress !== currentAddress) {
              debugLog('Ignoring token-bitcoin-confirmed for different wallet', {
                tokenId: data?.tokenId,
              });
              handledSettlements.delete(data.tokenId);
              return;
            }

            const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random()}`;
            const expiresAt = Date.now() + 2 * 60 * 1000;
            const payload: Record<string, unknown> = {
              domain: typeof window !== 'undefined' ? window.location.host : 'unknown',
              action: 'token_finalize',
              tokenId: data.tokenId,
              issuerAddress,
              selfSendSats: SELF_SEND_SATS,
              nonce,
              expiresAt,
            };

            setApprovalPayload(payload);
            setApprovalSignatureHex(null);
            setApprovalPubkeyHex(null);
            setPendingAction({ type: 'finalize', tokenId: data.tokenId, issuerAddress });
            setShowApproval(true);
          } catch (error: any) {
            console.error('Finalization step failed');
            toast.show(`Finalization failed: ${error?.message || 'Unknown error'}`, 'error', 8000);
          }
        });

        socket.on('disconnect', () => {
          debugLog('WebSocket disconnected');
        });

      } catch (error) {
        console.error('Failed to setup WebSocket');
      }
    };

    setupWebSocket();

    return () => {
      if (socket) {
        debugLog('Cleaning up WebSocket connection');
        socket.disconnect();
      }
    };
  }, [toast]);

  // Check whitelist when component mounts and retry until wallet is available
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 10;
    const retryInterval = 500; // 500ms between retries
    
    const checkWithRetry = async () => {
      const wallet = await getWalletAsync();
      
      if (wallet) {
        // Wallet found, proceed with whitelist check
        await checkWhitelistAndBalances();
      } else if (retryCount < maxRetries) {
        // Wallet not ready yet, retry
        retryCount++;
        debugLog('Wallet not ready, retrying', { retryCount, maxRetries });
        setTimeout(checkWithRetry, retryInterval);
      } else {
        // Max retries reached, wallet not available
        debugLog('Wallet not available after retries', { maxRetries });
        setCheckingWhitelist(false);
        setIsWhitelisted(false);
      }
    };
    
    checkWithRetry();
  }, []);

  const checkWhitelistAndBalances = async () => {
    setCheckingWhitelist(true);
    debugLog('CreateToken: starting whitelist check');
    
    // Check if address is whitelisted
    const wallet = await getWalletAsync();
    if (wallet) {
      try {
        debugLog('Wallet found, getting address');
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Wallet address fetch timeout')), 5000)
        );
        
        const address = await Promise.race([
          wallet.getAddress(),
          timeoutPromise
        ]) as string;
        
        debugLog('Address retrieved');
        setUserAddress(address);
        
        // Check whitelist via backend API (more secure than env variable)
        const indexerUrl = getPublicIndexerUrl();
        debugLog('Calling whitelist API', { indexerUrl });
        
        const whitelistResponse = await fetch(`${indexerUrl}/api/whitelist/check/${address}`);
        debugLog('Whitelist response status', { status: whitelistResponse.status });
        
        const whitelistData = await whitelistResponse.json();
        debugLog('Whitelist response received', {
          isWhitelisted: !!whitelistData?.isWhitelisted,
          hasMessage: typeof whitelistData?.message === 'string',
        });
        
        const isAllowed = whitelistData.isWhitelisted;

        debugLog('Whitelist check result', { isAllowed: !!isAllowed });
        
        setIsWhitelisted(isAllowed);
        
        // Only check balances if whitelisted
        if (isAllowed) {
          debugLog('User is whitelisted; checking balances');
          await checkBalances();
        } else {
          debugLog('User is not whitelisted');
        }
      } catch (error) {
        console.error('Failed to check whitelist');
        setIsWhitelisted(false);
      }
    } else {
      debugLog('No wallet found for whitelist check');
      setIsWhitelisted(false);
    }
    setCheckingWhitelist(false);
    debugLog('Whitelist check complete', { isWhitelisted });
  };

  const checkBalances = async () => {
    setCheckingBalance(true);
    try {
      debugLog('CreateToken: calling canCreateToken');
      const check = await canCreateToken();
      debugLog('CreateToken: canCreateToken returned', {
        canCreate: !!check?.canCreate,
        segwitBalance: check?.segwitBalance,
        arkadeBalance: check?.arkadeBalance,
        errorsCount: Array.isArray(check?.errors) ? check.errors.length : 0,
      });
      setBalanceCheck(check);
    } catch (error) {
      console.error('Failed to check balances');
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const wallet = await getWalletAsync();
    if (!wallet) {
      toast.show('Please connect your wallet first', 'warning', 4000);
      return;
    }

    // Validate token name (6-8 uppercase letters)
    if (formData.name.length < 6 || formData.name.length > 8 || !/^[A-Z]+$/.test(formData.name)) {
      toast.show('Token name must be 6-8 uppercase letters only', 'error', 4000);
      return;
    }

    // Validate symbol (exactly 4 uppercase letters)
    if (formData.symbol.length !== 4 || !/^[A-Z]+$/.test(formData.symbol)) {
      toast.show('Symbol must be exactly 4 uppercase letters', 'error', 4000);
      return;
    }

    // Validate supply (must be a number, no leading zero)
    if (!formData.totalSupply || formData.totalSupply === '0' || /^0/.test(formData.totalSupply)) {
      toast.show('Total supply must be a valid number (no leading zeros)', 'error', 4000);
      return;
    }

    // Validate presale fields if any are filled
    const hasPresale = formData.presaleBatchAmount || formData.priceInSats || formData.maxPurchasesPerWallet;
    if (hasPresale) {
      if (!formData.presaleBatchAmount || formData.presaleBatchAmount === '0') {
        toast.show('Pre-sale batch amount must be a valid number', 'error', 4000);
        return;
      }
      if (!formData.priceInSats || formData.priceInSats === '0') {
        toast.show('Price per batch must be a valid number', 'error', 4000);
        return;
      }
      if (!formData.maxPurchasesPerWallet || formData.maxPurchasesPerWallet === '0') {
        toast.show('Max purchases must be a valid number', 'error', 4000);
        return;
      }
    }

    // Use the already-displayed balance check (no need to re-check, user already sees the status)
    if (!balanceCheck || !balanceCheck.canCreate) {
      const errorMessage = 'Cannot create token: Insufficient balance. Please fund your addresses and refresh.';
      toast.show(errorMessage, 'error', 6000);
      return;
    }

    try {
      debugLog('CreateToken: about to create token', {
        symbol: formData.symbol,
        decimals: formData.decimals,
        hasPresale: Boolean(formData.presaleBatchAmount || formData.priceInSats || formData.maxPurchasesPerWallet),
      });
      
      // Convert total supply from display value to raw value with decimals
      // e.g., 10 tokens with 2 decimals = 10 * 10^2 = 1000
      const totalSupplyRaw = BigInt(formData.totalSupply) * BigInt(10 ** parseInt(formData.decimals));
      
      debugLog('CreateToken: selectedFeeRate', selectedFeeRate);
      
      const params: any = {
        name: formData.name,
        symbol: formData.symbol.toUpperCase(),
        totalSupply: totalSupplyRaw,
        decimals: parseInt(formData.decimals),
        feeRate: selectedFeeRate, // User-selected fee rate
      };
      
      debugLog('CreateToken: token params prepared');
      
      // Add pre-sale parameters if provided
      if (formData.presaleBatchAmount && formData.priceInSats && formData.maxPurchasesPerWallet) {
        // Convert batch amount from display value to raw value with decimals
        // e.g., 1000 tokens with 6 decimals = 1000 * 10^6 = 1000000000
        const batchAmountRaw = BigInt(formData.presaleBatchAmount) * BigInt(10 ** parseInt(formData.decimals));
        params.presaleBatchAmount = batchAmountRaw;
        params.priceInSats = BigInt(formData.priceInSats);
        params.maxPurchasesPerWallet = parseInt(formData.maxPurchasesPerWallet);
        debugLog('CreateToken: presale params prepared');
      }

      debugLog('CreateToken: calling wallet.createToken()');

      const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random()}`;
      const expiresAt = Date.now() + 2 * 60 * 1000;
      const payload: Record<string, unknown> = {
        domain: typeof window !== 'undefined' ? window.location.host : 'unknown',
        action: 'token_create_opreturn',
        name: params.name,
        symbol: params.symbol,
        totalSupplyRaw: params.totalSupply.toString(),
        decimals: params.decimals,
        feeRate: params.feeRate,
        presaleBatchAmountRaw: params.presaleBatchAmount ? String(params.presaleBatchAmount) : null,
        priceInSats: params.priceInSats ? String(params.priceInSats) : null,
        maxPurchasesPerWallet: params.maxPurchasesPerWallet ?? null,
        nonce,
        expiresAt,
      };

      setApprovalPayload(payload);
      setApprovalSignatureHex(null);
      setApprovalPubkeyHex(null);
      setPendingAction({ type: 'create', params });
      setShowApproval(true);
    } catch (error) {
      console.error('Token creation failed');
      debugLog('Token creation error details', {
        message: (error as Error).message,
      });
      
      // Show detailed error message
      const errorMsg = (error as Error).message;
      if (errorMsg.includes('Insufficient')) {
        toast.show(` ${errorMsg}. Refreshing balance...`, 'error', 6000);
        // Refresh balance to show current state
        await checkBalances();
      } else if (errorMsg.includes('UTXO')) {
        toast.show(' No funds available in SegWit address. Please fund bc1q... address first.', 'error', 6000);
        await checkBalances();
      } else if (errorMsg.includes('register')) {
        toast.show(` TX broadcast but registration failed: ${errorMsg}. Backend will detect from blockchain.`, 'warning', 8000);
      } else {
        toast.show(' Token creation failed: ' + errorMsg, 'error', 5000);
      }
    } finally {
      // loading is managed by the approval confirm handler
    }
  };

  // Show loading state while checking whitelist
  if (checkingWhitelist || isWhitelisted === null) {
    return (
      <div className="p-6 border border-blue-200 rounded-lg bg-white shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <PlusCircle className="w-6 h-6 text-green-500" />
          <h3 className="text-xl font-semibold text-gray-900">Create Token</h3>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Checking access...</p>
        </div>
      </div>
    );
  }

  // If not whitelisted, just blur the content
  if (isWhitelisted === false) {
    return (
      <div className="p-6 border border-blue-200 rounded-lg bg-white shadow-lg filter blur-sm pointer-events-none select-none opacity-60">
        <div className="flex items-center gap-3 mb-6">
          <PlusCircle className="w-6 h-6 text-green-500" />
          <h3 className="text-xl font-semibold text-gray-900">Create Token</h3>
        </div>
        <div className="mb-4 p-4 rounded-lg border-2 bg-gray-50 border-gray-300">
          <div className="h-4 bg-gray-300 rounded mb-2"></div>
          <div className="h-3 bg-gray-200 rounded"></div>
        </div>
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 border border-blue-200 rounded-lg bg-white shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <PlusCircle className="w-6 h-6 text-green-500" />
        <h3 className="text-xl font-semibold text-gray-900">Create Token</h3>
      </div>

      {/* Balance Status */}
      <div className={`mb-4 p-4 rounded-lg border-2 ${balanceCheck?.canCreate ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-gray-900">Balance Status</h4>
          <button
            type="button"
            onClick={checkBalances}
            disabled={checkingBalance}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {checkingBalance ? 'Checking...' : 'Refresh'}
          </button>
        </div>
        {balanceCheck ? (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-700">SegWit (Token Creation):</span>
                <span className={`font-bold ${balanceCheck.segwitBalance >= 1000 ? 'text-green-700' : 'text-red-600'}`}>
                  {balanceCheck.segwitBalance.toLocaleString()} sats {balanceCheck.segwitBalance >= 1000 ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-700">Arkade L2 (Settlement):</span>
                <span className={`font-bold ${balanceCheck.arkadeBalance >= 1000 ? 'text-green-700' : 'text-red-600'}`}>
                  {balanceCheck.arkadeBalance.toLocaleString()} sats {balanceCheck.arkadeBalance >= 1000 ? '✓' : '✗'}
                </span>
              </div>
            </div>
            {!balanceCheck.canCreate && (
              <div className="mt-3 space-y-1">
                {balanceCheck.errors.map((error, idx) => (
                  <p key={idx} className="text-xs text-red-700 font-semibold">
                    ⚠️ {error}
                  </p>
                ))}
              </div>
            )}
            {balanceCheck.canCreate && (
              <p className="mt-2 text-xs text-green-700 font-semibold">
                ✓ Ready to create tokens!
              </p>
            )}
          </>
        ) : (
          <div className="text-xs text-gray-600">
            {checkingBalance ? 'Checking balances...' : 'Connect wallet to check balances'}
          </div>
        )}
      </div>



      <form onSubmit={handleSubmit} onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
          e.preventDefault();
        }
      }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Token Name
            <span className="text-xs text-gray-500 ml-2">(6-8 uppercase letters only)</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: validateTokenName(e.target.value) })}
            placeholder="MYTOKEN"
            required
            minLength={6}
            maxLength={8}
            className="w-full px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm uppercase"
          />
          {formData.name && (formData.name.length < 6 || formData.name.length > 8) && (
            <p className="text-xs text-red-600 mt-1">Must be 6-8 characters</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Symbol
            <span className="text-xs text-gray-500 ml-2">(Exactly 4 uppercase letters)</span>
          </label>
          <input
            type="text"
            value={formData.symbol}
            onChange={(e) => setFormData({ ...formData, symbol: validateSymbol(e.target.value) })}
            placeholder="MTKN"
            required
            minLength={4}
            maxLength={4}
            className="w-full px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm uppercase"
          />
          {formData.symbol && formData.symbol.length !== 4 && (
            <p className="text-xs text-red-600 mt-1">Must be exactly 4 letters</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Supply
            <span className="text-xs text-gray-500 ml-2">(Numbers only, no leading zero)</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={formData.totalSupply}
            onChange={(e) => setFormData({ ...formData, totalSupply: validateNumericInput(e.target.value, false) })}
            placeholder="1000000"
            required
            className="w-full px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Decimals
          </label>
          <select
            value={formData.decimals}
            onChange={(e) => setFormData({ ...formData, decimals: e.target.value })}
            className="w-full px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
          >
            <option value="0">0</option>
            <option value="2">2</option>
            <option value="6">6</option>
            <option value="8">8</option>
            <option value="18">18</option>
          </select>
        </div>

        {/* Pre-sale Section */}
        <div className="border-t-2 border-blue-200 pt-4 mt-4">
          <h4 className="text-md font-semibold text-blue-700 mb-3">Pre-sale Settings</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pre-sale Batch Amount
              <span className="text-xs text-gray-500 ml-2">(Numbers only, e.g., 1000)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.presaleBatchAmount}
              onChange={(e) => setFormData({ ...formData, presaleBatchAmount: validateNumericInput(e.target.value, false) })}
              placeholder="1000"
              className="w-full px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
            />
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price per Batch (in sats)
              <span className="text-xs text-gray-500 ml-2">(Numbers only, e.g., 2000)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.priceInSats}
              onChange={(e) => setFormData({ ...formData, priceInSats: validateNumericInput(e.target.value, false) })}
              placeholder="2000"
              className="w-full px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
            />
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Purchases per Wallet
              <span className="text-xs text-gray-500 ml-2">(Numbers only, e.g., 5)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.maxPurchasesPerWallet}
              onChange={(e) => setFormData({ ...formData, maxPurchasesPerWallet: validateNumericInput(e.target.value, false) })}
              placeholder="5"
              className="w-full px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
            />
          </div>

          {formData.presaleBatchAmount && formData.priceInSats && (
            <div className="mt-3 p-3 bg-blue-100 border border-blue-200 rounded-lg">
              <p className="text-xs text-gray-700">
                <strong>Pre-sale Preview:</strong> Each batch of {formData.presaleBatchAmount} tokens costs {formData.priceInSats} sats
                {formData.maxPurchasesPerWallet && ` (max ${formData.maxPurchasesPerWallet} batches per wallet)`}
              </p>
            </div>
          )}
        </div>

        {/* Fee Selection */}
        <div className="mt-6">
          <FeeSelection
            onFeeSelect={setSelectedFeeRate}
            estimatedVbytes={140}
            selectedFee={selectedFeeRate}
          />
          <div className="mt-2 text-xs text-gray-600">
            Note: Actual transaction size may vary slightly based on token data size
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || approvalSigning || showApproval || (balanceCheck !== null && !balanceCheck.canCreate)}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg mt-6"
        >
          {loading ? 'Creating Token...' : (balanceCheck && !balanceCheck.canCreate ? 'Insufficient Balance' : 'Create Token')}
        </button>
        
        {balanceCheck && !balanceCheck.canCreate && (
          <p className="text-xs text-center text-gray-600">
            Fund your SegWit address (bc1q...) with at least 1000 sats to create tokens
          </p>
        )}
        
        {balanceCheck && balanceCheck.canCreate && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-300 rounded-lg">
            <p className="text-xs text-gray-700 text-center">
              <strong>Note:</strong> After clicking "Create Token", an OP_RETURN transaction will be submitted to the mempool. 
              Your token will be created once the transaction confirms (~10 min). Track the confirmation via the mempool link provided.
            </p>
          </div>
        )}
      </form>

      {txid && (
        <div className="mt-4 p-4 bg-green-50 border-2 border-green-500 rounded-lg">
          <p className="text-sm text-green-700 font-semibold mb-2"> OP_RETURN Transaction Submitted!</p>
          <p className="text-xs text-gray-700 mb-2">Token will be created after confirmation (~10 min)</p>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono text-gray-900 break-all flex-1">{txid}</p>
            <a
              href={getMempoolUrl(txid)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition-colors whitespace-nowrap"
            >
              Track on Mempool →
            </a>
          </div>
        </div>
      )}

      {showApproval && approvalPayload && pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-blue-200 bg-white shadow-xl">
            <div className="p-5 border-b border-blue-200">
              <div className="text-lg font-semibold text-gray-900">Confirm & Sign</div>
              <div className="text-xs text-gray-700 mt-1">
                {pendingAction.type === 'finalize' ? 'Finalizing requires one schnorr approval signature.' : 'Token creation requires one schnorr approval signature.'}
              </div>
            </div>

            <div className="p-5 space-y-3">
              {pendingAction.type === 'create' ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-gray-900">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-700">Symbol</span>
                    <span className="font-mono">{String((pendingAction as any).params?.symbol || '')}</span>
                  </div>
                  <div className="flex justify-between gap-3 mt-2">
                    <span className="text-gray-700">Supply (raw)</span>
                    <span className="font-mono">{String((pendingAction as any).params?.totalSupply?.toString?.() || '')}</span>
                  </div>
                  <div className="flex justify-between gap-3 mt-2">
                    <span className="text-gray-700">Fee Rate</span>
                    <span className="font-mono">{String((pendingAction as any).params?.feeRate ?? '')} sat/vB</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-gray-900">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-700">Token</span>
                    <span className="font-mono">{short((pendingAction as any).tokenId)}</span>
                  </div>
                  <div className="flex justify-between gap-3 mt-2">
                    <span className="text-gray-700">Self-send</span>
                    <span className="font-mono">{SELF_SEND_SATS.toLocaleString()} sats</span>
                  </div>
                </div>
              )}

              <div className="text-[11px] text-gray-700">
                This will sign an approval message with your Arkade wallet key, then proceed.
              </div>

              {(approvalSignatureHex || approvalPubkeyHex) && (
                <div className="rounded-lg border border-blue-200 bg-white p-3 text-[11px] text-gray-900">
                  {approvalPubkeyHex && (
                    <div className="break-all">
                      <span className="text-gray-700">x-only pubkey:</span> <span className="font-mono">{approvalPubkeyHex}</span>
                    </div>
                  )}
                  {approvalSignatureHex && (
                    <div className="break-all mt-2">
                      <span className="text-gray-700">signature:</span> <span className="font-mono">{approvalSignatureHex}</span>
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
                className="flex-1 border border-blue-300 text-gray-900 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprovalConfirm}
                disabled={loading || approvalSigning}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {approvalSigning || loading ? 'Signing...' : 'Sign & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
