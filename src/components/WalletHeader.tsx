'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Store, Coins, Home, Copy, RefreshCw, ArrowDownToLine, ArrowUpFromLine, X, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { initializeWallet, getWallet, disconnectWallet, getAllBalances, getAllAddresses, getArkadeWallet, mnemonicToPrivateKey, getActivePrivateKey } from '@/lib/wallet';
import { createVault, hasVault, unlockVault } from '@/lib/walletVault';
import { Ramps, VtxoManager } from '@arkade-os/sdk';
import { useToast } from '@/lib/toast';
import { getMempoolUrl, getNetworkName } from '@/lib/mempool';
import FeeSelection from './FeeSelection';

import logoArkvtxo from '../../images/logo-arkvtxo.png';
import tweeterIcon from '../../images/tweeter-icon.png';

interface AddressInfo {
  offchain: string;
  onchain: string;
  boarding: string;
  segwit?: string;
  taproot?: string;
}

interface BalanceInfo {
  arkade: number;
  segwit: number;
  taproot: number;
  boarding: number;
}

export default function WalletHeader() {
  const pathname = usePathname();
  const toast = useToast();
  const [connected, setConnected] = useState(false);
  const [addresses, setAddresses] = useState<AddressInfo | null>(null);
  const [balances, setBalances] = useState<BalanceInfo>({ arkade: 0, segwit: 0, taproot: 0, boarding: 0 });
  const [connecting, setConnecting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [restorePrivateKey, setRestorePrivateKey] = useState('');
  const [restoreMnemonic, setRestoreMnemonic] = useState('');
  const [showBoardModal, setShowBoardModal] = useState(false);
  const [boarding, setBoarding] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boardSuccess, setBoardSuccess] = useState<string | null>(null);
  const [boardProgress, setBoardProgress] = useState<string>('');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawDestination, setWithdrawDestination] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAll, setWithdrawAll] = useState(false);
  const [withdrawToBoardingAddress, setWithdrawToBoardingAddress] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  const [withdrawProgress, setWithdrawProgress] = useState<string>('');
  const [showNewWalletModal, setShowNewWalletModal] = useState(false);
  const [withdrawFeeRate, setWithdrawFeeRate] = useState<number>(31);
  const [newWalletCreds, setNewWalletCreds] = useState<{ privateKey: string; mnemonic: string } | null>(null);
  const [credsConfirmed, setCredsConfirmed] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState<'collaborative' | 'unilateral'>('collaborative');
  const [unrollProgress, setUnrollProgress] = useState<string>('');
  const [showUnrollInfo, setShowUnrollInfo] = useState(false);

  const [vaultExists, setVaultExists] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [pendingPrivateKey, setPendingPrivateKey] = useState<string | null>(null);
  const [setPasswordMessage, setSetPasswordMessage] = useState('');
  const [setPassword, setSetPassword] = useState('');
  const [setPasswordConfirm, setSetPasswordConfirm] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);

  const [newWalletPassword, setNewWalletPassword] = useState('');
  const [newWalletPasswordConfirm, setNewWalletPasswordConfirm] = useState('');

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [changePasswordNew, setChangePasswordNew] = useState('');
  const [changePasswordConfirm, setChangePasswordConfirm] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [withdrawVtxos, setWithdrawVtxos] = useState<any[]>([]);
  const [withdrawVtxosLoading, setWithdrawVtxosLoading] = useState(false);
  const [withdrawVtxosError, setWithdrawVtxosError] = useState<string | null>(null);

  // Arkade SDK v0.3.7 uses a millisecond threshold for renewal checks.
  // Default is 24h; we keep the same semantics: "about to expire".
  const VTXO_RENEW_THRESHOLD_MS = 24 * 60 * 60 * 1000;
  const VTXO_AUTO_RENEW_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily (while app is open)

  const vtxoManagerRef = useRef<any | null>(null);
  const autoRenewIntervalRef = useRef<number | null>(null);
  const autoRenewRunningRef = useRef(false);

  const [autoRenewEnabled] = useState(true);
  const [autoRenewChecking, setAutoRenewChecking] = useState(false);
  const [autoRenewLastCheckedAt, setAutoRenewLastCheckedAt] = useState<number | null>(null);
  const [autoRenewLastRenewTxid, setAutoRenewLastRenewTxid] = useState<string | null>(null);
  const [autoRenewLastExpiringCount, setAutoRenewLastExpiringCount] = useState<number | null>(null);
  const [autoRenewError, setAutoRenewError] = useState<string | null>(null);

  const [recoverableChecking, setRecoverableChecking] = useState(false);
  const [recoverableRecovering, setRecoverableRecovering] = useState(false);
  const [recoverableError, setRecoverableError] = useState<string | null>(null);
  const [recoverableBalance, setRecoverableBalance] = useState<{
    recoverable: bigint;
    subdust: bigint;
    includesSubdust: boolean;
    vtxoCount: number;
  } | null>(null);
  const [recoverableProgress, setRecoverableProgress] = useState<string>('');
  const [recoverableTxid, setRecoverableTxid] = useState<string | null>(null);

  const COLLAB_EXIT_MAX_DAYS_REMAINING = 29;
  const COLLAB_EXIT_MAX_MS_REMAINING = COLLAB_EXIT_MAX_DAYS_REMAINING * 24 * 60 * 60 * 1000;

  const formatNumberLike = (v: bigint | number | null | undefined): string => {
    if (v === null || v === undefined) return '0';
    const s = typeof v === 'bigint' ? v.toString() : Math.floor(v).toString();
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const formatDateTime = (ms: number | null): string => {
    if (!ms) return 'Never';
    try {
      return new Date(ms).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  const passwordRules = (password: string) => {
    const hasMinLength = password.length >= 10;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    const checks = [
      { label: 'At least 10 characters', ok: hasMinLength },
      { label: 'At least 1 uppercase letter (A-Z)', ok: hasUpper },
      { label: 'At least 1 lowercase letter (a-z)', ok: hasLower },
      { label: 'At least 1 special character (e.g. <>./,&*^)', ok: hasSpecial },
    ];

    return {
      checks,
      isStrong: checks.every((c) => c.ok),
    };
  };

  const renderPasswordStrength = (password: string) => {
    const { checks, isStrong } = passwordRules(password);
    return (
      <div className="mt-2 text-left">
        <div className={`text-sm font-semibold ${isStrong ? 'text-green-700' : 'text-gray-700'}`}>
          Password strength: {isStrong ? 'Strong' : 'Weak'}
        </div>
        <ul className="mt-2 space-y-1 text-xs">
          {checks.map((c) => (
            <li key={c.label} className={c.ok ? 'text-green-700' : 'text-gray-600'}>
              {c.ok ? '✓' : '•'} {c.label}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const getOrCreateVtxoManager = (): any => {
    if (vtxoManagerRef.current) return vtxoManagerRef.current;
    const arkadeWallet = getArkadeWallet();
    if (!arkadeWallet) {
      throw new Error('Wallet not connected');
    }
    vtxoManagerRef.current = new VtxoManager(arkadeWallet, {
      enabled: true,
      thresholdMs: VTXO_RENEW_THRESHOLD_MS,
    });
    return vtxoManagerRef.current;
  };

  const checkAndAutoRenewVtxos = async (source: 'login' | 'interval' | 'manual') => {
    if (!autoRenewEnabled) return;
    if (autoRenewRunningRef.current) return;

    autoRenewRunningRef.current = true;
    setAutoRenewError(null);
    setAutoRenewChecking(true);
    try {
      const manager = getOrCreateVtxoManager();
      const expiring = await manager.getExpiringVtxos();

      setAutoRenewLastCheckedAt(Date.now());
      setAutoRenewLastExpiringCount(Array.isArray(expiring) ? expiring.length : 0);

      if (Array.isArray(expiring) && expiring.length > 0) {
        const txid = await manager.renewVtxos();
        setAutoRenewLastRenewTxid(txid || null);

        toast.show(
          `Auto-renew submitted (${expiring.length} VTXO(s))${txid ? `: ${txid.slice(0, 10)}...` : ''}`,
          'info',
          7000
        );

        // Refresh UI state after renewal.
        await handleRefresh();
        if (showWithdrawModal) {
          void loadWithdrawVtxos();
          void checkRecoverableBalance();
        }
      } else if (source === 'manual') {
        toast.show('No expiring VTXOs detected', 'success', 2500);
      }
    } catch (e: any) {
      const message = e?.message || 'Failed to check/renew VTXOs';
      setAutoRenewError(message);
      if (source === 'manual' || source === 'login') {
        toast.show(message, 'warning', 6000);
      }
    } finally {
      setAutoRenewChecking(false);
      autoRenewRunningRef.current = false;
    }
  };

  const checkRecoverableBalance = async () => {
    setRecoverableError(null);
    setRecoverableChecking(true);
    try {
      const manager = getOrCreateVtxoManager();
      const balance = await manager.getRecoverableBalance();

      const normalized = {
        recoverable: BigInt(balance?.recoverable ?? 0),
        subdust: BigInt(balance?.subdust ?? 0),
        includesSubdust: Boolean(balance?.includesSubdust),
        vtxoCount: Number(balance?.vtxoCount ?? 0),
      };

      setRecoverableBalance(normalized);

      if (normalized.recoverable > 0n) {
        toast.show(
          `Recoverable balance detected: ${formatNumberLike(normalized.recoverable)} sats`,
          'info',
          6000
        );
      }
    } catch (e: any) {
      setRecoverableBalance(null);
      setRecoverableError(e?.message || 'Failed to check recoverable balance');
    } finally {
      setRecoverableChecking(false);
    }
  };

  const recoverVtxosNow = async () => {
    setRecoverableError(null);
    setRecoverableProgress('');
    setRecoverableTxid(null);
    setRecoverableRecovering(true);
    try {
      const manager = getOrCreateVtxoManager();

      setRecoverableProgress('Starting recovery...');
      const txid = await manager.recoverVtxos((event: any) => {
        const type = event?.type ? String(event.type) : 'EVENT';
        setRecoverableProgress(type);
      });

      setRecoverableTxid(txid || null);
      toast.show('Recovery submitted successfully', 'success', 6000);

      await handleRefresh();
      if (showWithdrawModal) {
        void loadWithdrawVtxos();
      }
      void checkRecoverableBalance();
    } catch (e: any) {
      setRecoverableError(e?.message || 'Recovery failed');
    } finally {
      setRecoverableRecovering(false);
    }
  };

  const getVtxoExpiryMs = (vtxo: any): number | null => {
    const virtualStatus = vtxo?.virtualStatus || {};
    const candidate =
      virtualStatus?.batchExpiry ??
      virtualStatus?.expiry ??
      vtxo?.batchExpiry ??
      vtxo?.expiry;

    if (candidate === null || candidate === undefined) return null;
    if (typeof candidate === 'number') return Number.isFinite(candidate) ? candidate : null;
    if (typeof candidate === 'bigint') return Number(candidate);
    if (typeof candidate === 'string') {
      const n = Number(candidate);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const formatTimeLeft = (expiryMs: number): string => {
    const msLeft = expiryMs - Date.now();
    if (!Number.isFinite(msLeft)) return 'Unknown';
    if (msLeft <= 0) return 'Expired';

    const hours = Math.floor(msLeft / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;

    if (days <= 0) return `${hours}h`;
    if (days < 3) return `${days}d ${remHours}h`;
    return `${days}d`;
  };

  const isSpendableVtxo = (vtxo: any): boolean => {
    return vtxo?.virtualStatus?.state === 'settled' && !vtxo?.isSpent;
  };

  const isCollaborativeExitEligibleByExpiry = (vtxo: any): { eligible: boolean; reason: string } => {
    if (!isSpendableVtxo(vtxo)) {
      return { eligible: false, reason: 'Not settled/spendable' };
    }

    const expiryMs = getVtxoExpiryMs(vtxo);
    if (!expiryMs) {
      return { eligible: false, reason: 'Expiry unknown' };
    }

    const msLeft = expiryMs - Date.now();
    if (msLeft <= 0) {
      return { eligible: false, reason: 'Expired' };
    }

    if (msLeft <= COLLAB_EXIT_MAX_MS_REMAINING) {
      return { eligible: true, reason: `≤ ${COLLAB_EXIT_MAX_DAYS_REMAINING} days remaining` };
    }

    return { eligible: false, reason: `> ${COLLAB_EXIT_MAX_DAYS_REMAINING} days remaining` };
  };

  const loadWithdrawVtxos = async () => {
    setWithdrawVtxosError(null);
    setWithdrawVtxosLoading(true);
    try {
      const arkadeWallet = getArkadeWallet();
      if (!arkadeWallet) {
        throw new Error('Wallet not connected');
      }

      const vtxos = await arkadeWallet.getVtxos({
        withRecoverable: false,
        withUnrolled: false,
      });

      const sorted = [...(vtxos || [])].sort((a: any, b: any) => {
        const ea = getVtxoExpiryMs(a);
        const eb = getVtxoExpiryMs(b);
        if (ea === null && eb === null) return 0;
        if (ea === null) return 1;
        if (eb === null) return -1;
        return ea - eb;
      });

      setWithdrawVtxos(sorted);
    } catch (e: any) {
      setWithdrawVtxos([]);
      setWithdrawVtxosError(e?.message || 'Failed to load VTXOs');
    } finally {
      setWithdrawVtxosLoading(false);
    }
  };

  useEffect(() => {
    checkWallet();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const exists = hasVault();
    setVaultExists(exists);

    // Legacy migration: if an old tab still has plaintext session credentials,
    // prompt the user to set a password so future logins use the vault.
    if (!exists) {
      const legacyPk = window.sessionStorage.getItem('arkade_private_key');
      if (legacyPk) {
        setPendingPrivateKey(legacyPk);
        setSetPasswordMessage(
          'Security update: set a password now. From now on, you will log in using this password (like a Chrome extension wallet).'
        );
        setShowSetPasswordModal(true);
      }
    }
  }, []);

  // Automatic VTXO maintenance (renewal) for connected wallets.
  // Note: This only runs while the app is open in the browser.
  useEffect(() => {
    if (!connected) {
      vtxoManagerRef.current = null;
      setAutoRenewLastCheckedAt(null);
      setAutoRenewLastExpiringCount(null);
      setAutoRenewLastRenewTxid(null);
      setAutoRenewError(null);
      setRecoverableBalance(null);
      setRecoverableError(null);
      setRecoverableProgress('');
      setRecoverableTxid(null);
      if (autoRenewIntervalRef.current) {
        window.clearInterval(autoRenewIntervalRef.current);
        autoRenewIntervalRef.current = null;
      }
      return;
    }

    // Lazily create manager and run an immediate check.
    try {
      void getOrCreateVtxoManager();
      void checkAndAutoRenewVtxos('login');
      void checkRecoverableBalance();
    } catch {
      // Wallet might not be fully ready yet; a manual run will work later.
    }

    if (!autoRenewIntervalRef.current) {
      autoRenewIntervalRef.current = window.setInterval(() => {
        void checkAndAutoRenewVtxos('interval');
      }, VTXO_AUTO_RENEW_INTERVAL_MS);
    }

    return () => {
      if (autoRenewIntervalRef.current) {
        window.clearInterval(autoRenewIntervalRef.current);
        autoRenewIntervalRef.current = null;
      }
    };
  }, [connected]);

  const checkWallet = async () => {
    const wallet = getWallet();
    if (wallet) {
      setConnected(true);
      const addrs = await getAllAddresses();
      
      // Get the actual boarding address from the Arkade wallet
      let boardingAddr = '';
      try {
        const arkade = getArkadeWallet();
        if (arkade) {
          boardingAddr = await arkade.getBoardingAddress();
          console.log('🎯 Boarding address fetched:', boardingAddr);
        }
      } catch (error) {
        console.error('Failed to get boarding address:', error);
      }
      
      if (addrs) {
        setAddresses({
          offchain: addrs.arkade,
          onchain: addrs.taproot,
          boarding: boardingAddr || addrs.taproot, // Use actual boarding address
          segwit: addrs.segwit,
          taproot: addrs.taproot,
        });
      }
      const bals = await getAllBalances();
      if (bals) {
        setBalances({ arkade: bals.arkade, segwit: bals.segwit, taproot: bals.taproot, boarding: bals.boarding || 0 });
      }
    }
  };

  const handleCreateWallet = async () => {
    setConnecting(true);
    try {
      // Generate new wallet credentials
      const { generateWalletCredentials } = await import('@/lib/wallet');
      const credentials = generateWalletCredentials();
      
      // Store credentials and show modal
      setNewWalletCreds({ 
        privateKey: credentials.privateKey, 
        mnemonic: credentials.mnemonic 
      });
      setShowNewWalletModal(true);
      setCredsConfirmed(false);
    } catch (error) {
      console.error('Failed to generate wallet:', error);
      alert('Failed to generate wallet credentials');
    } finally {
      setConnecting(false);
    }
  };

  const handleConfirmCreateWallet = async () => {
    if (!newWalletCreds || !credsConfirmed) {
      alert('Please confirm you have saved your recovery phrase');
      return;
    }

    const strength = passwordRules(newWalletPassword);
    if (!strength.isStrong) {
      alert('Please choose a stronger password');
      return;
    }

    if (!newWalletPassword || newWalletPassword !== newWalletPasswordConfirm) {
      alert('Passwords do not match');
      return;
    }

    setConnecting(true);
    try {
      await createVault(newWalletPassword, { privateKey: newWalletCreds.privateKey });
      setVaultExists(true);

      await initializeWallet({
        arkServerUrl: process.env.NEXT_PUBLIC_ARK_SERVER_URL || 'https://arkade.computer',
        tokenIndexerUrl: process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:3010',
        apiKey: process.env.NEXT_PUBLIC_API_KEY,
        privateKey: newWalletCreds.privateKey,
      });
      await checkWallet();
      setShowNewWalletModal(false);
      setNewWalletCreds(null);
      setCredsConfirmed(false);
      setNewWalletPassword('');
      setNewWalletPasswordConfirm('');
    } catch (error) {
      console.error('Failed to create wallet:', error);
      alert('Failed to create wallet');
    } finally {
      setConnecting(false);
    }
  };

  const handleRestoreWallet = async () => {
    if (!restorePrivateKey.trim() && !restoreMnemonic.trim()) {
      alert('Please enter either a private key or a mnemonic phrase');
      return;
    }
    setConnecting(true);
    try {
      const pk = restorePrivateKey.trim()
        ? restorePrivateKey.trim()
        : mnemonicToPrivateKey(restoreMnemonic.trim());

      setPendingPrivateKey(pk);
      setSetPasswordMessage(
        'Set a password to finish restoring. From now on, you will log in using this password.'
      );
      setShowSetPasswordModal(true);
      setShowRestore(false);
    } catch (error) {
      console.error('Failed to start restore:', error);
      alert('Failed to restore wallet. Please check your credentials.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    toast.confirm(
      'Are you sure you want to disconnect your wallet?',
      () => {
        disconnectWallet();
        setConnected(false);
        setAddresses(null);
        setBalances({ arkade: 0, segwit: 0, taproot: 0, boarding: 0 });
        toast.show('Wallet disconnected successfully', 'info', 3000);
      }
    );
  };

  const handleRefresh = async () => {
    console.log('Refreshing balances...');
    const wallet = getWallet();
    if (wallet) {
      try {
        // Force a fresh balance fetch
        const arkadeWallet = getArkadeWallet();
        if (arkadeWallet) {
          // Sync the wallet state first
          console.log('Syncing Arkade wallet...');
          try {
            await arkadeWallet.sync();
          } catch (syncErr) {
            console.warn('Wallet sync warning (non-critical):', syncErr);
          }
        }
        
        const bals = await getAllBalances();
        console.log('Fresh balances:', bals);
        if (bals) {
          setBalances({ arkade: bals.arkade, segwit: bals.segwit, taproot: bals.taproot, boarding: bals.boarding || 0 });
        }
      } catch (error) {
        console.error('Error refreshing balances:', error);
      }
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.show('Address copied to clipboard!', 'success', 2000);
  };

  const handleUnlock = async () => {
    if (!unlockPassword) return;
    setUnlocking(true);
    try {
      const payload = await unlockVault(unlockPassword);
      await initializeWallet({
        arkServerUrl: process.env.NEXT_PUBLIC_ARK_SERVER_URL || 'https://arkade.computer',
        tokenIndexerUrl: process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:3010',
        apiKey: process.env.NEXT_PUBLIC_API_KEY,
        privateKey: payload.privateKey,
      });
      await checkWallet();
      setShowUnlockModal(false);
      setUnlockPassword('');
      toast.show('Wallet unlocked', 'success', 2500);
    } catch (e: any) {
      toast.show(e?.message || 'Failed to unlock wallet', 'warning', 6000);
    } finally {
      setUnlocking(false);
    }
  };

  const handleSetPasswordAndConnect = async () => {
    if (!pendingPrivateKey) return;
    const strength = passwordRules(setPassword);
    if (!strength.isStrong) {
      toast.show('Please choose a stronger password', 'warning', 5000);
      return;
    }

    if (!setPassword || setPassword !== setPasswordConfirm) {
      toast.show('Passwords do not match', 'warning', 4000);
      return;
    }

    setSettingPassword(true);
    try {
      await createVault(setPassword, { privateKey: pendingPrivateKey });
      setVaultExists(true);

      // Clear any legacy plaintext storage immediately.
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('arkade_private_key');
        window.sessionStorage.removeItem('arkade_mnemonic');
        window.sessionStorage.removeItem('wallet_key_shown');
      }

      await initializeWallet({
        arkServerUrl: process.env.NEXT_PUBLIC_ARK_SERVER_URL || 'https://arkade.computer',
        tokenIndexerUrl: process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:3010',
        apiKey: process.env.NEXT_PUBLIC_API_KEY,
        privateKey: pendingPrivateKey,
      });
      await checkWallet();

      setShowSetPasswordModal(false);
      setPendingPrivateKey(null);
      setSetPassword('');
      setSetPasswordConfirm('');
      setRestorePrivateKey('');
      setRestoreMnemonic('');
      toast.show('Password set. Next time, unlock with your password.', 'success', 4500);
    } catch (e: any) {
      toast.show(e?.message || 'Failed to set password', 'warning', 6000);
    } finally {
      setSettingPassword(false);
    }
  };

  const handleChangePassword = async () => {
    if (!vaultExists) {
      toast.show('No password vault found on this device.', 'warning', 5000);
      return;
    }

    const activePk = getActivePrivateKey();
    if (!activePk) {
      toast.show('Wallet is not unlocked', 'warning', 4000);
      return;
    }

    if (!currentPassword) {
      toast.show('Enter your current password', 'warning', 4000);
      return;
    }

    const strength = passwordRules(changePasswordNew);
    if (!strength.isStrong) {
      toast.show('Please choose a stronger new password', 'warning', 5000);
      return;
    }

    if (!changePasswordNew || changePasswordNew !== changePasswordConfirm) {
      toast.show('New passwords do not match', 'warning', 4000);
      return;
    }

    setChangingPassword(true);
    try {
      const payload = await unlockVault(currentPassword);
      if (payload.privateKey !== activePk) {
        throw new Error('Current password does not match the active wallet');
      }

      await createVault(changePasswordNew, { privateKey: payload.privateKey });

      setShowChangePasswordModal(false);
      setCurrentPassword('');
      setChangePasswordNew('');
      setChangePasswordConfirm('');
      toast.show('Password changed successfully', 'success', 3500);
    } catch (e: any) {
      toast.show(e?.message || 'Failed to change password', 'warning', 6000);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleBoardClick = () => {
    setShowBoardModal(true);
    setBoardError(null);
    setBoardSuccess(null);
    setBoardProgress('');
  };

  const handleBoardSubmit = async () => {
    setBoardError(null);
    setBoardSuccess(null);
    setBoardProgress('');
    setBoarding(true);

    try {
      // Use getWalletAsync to ensure wallet is properly loaded
      const { getWalletAsync } = await import('@/lib/wallet');
      const wallet = await getWalletAsync();
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      // Check if there's balance to board
      if (balances.boarding === 0) {
        throw new Error('No Bitcoin in boarding address available to board');
      }

      setBoardProgress('Checking for boarding UTXOs...');
      console.log('🔍 Starting automated boarding process...');
      console.log('Boarding balance:', balances.boarding, 'sats');
      
      // Import Ramps for onboarding
      const { Ramps } = await import('@arkade-os/sdk');
      const ramps = new Ramps(wallet.wallet);
      
      // Get boarding UTXOs to check if any exist
      let boardingUtxos;
      let boardingAddress;
      
      try {
        boardingUtxos = await wallet.wallet.getBoardingUtxos();
        boardingAddress = await wallet.wallet.getBoardingAddress();
        console.log('📦 Boarding UTXos:', boardingUtxos);
        console.log('📍 Boarding address:', boardingAddress);
      } catch (error) {
        console.error('Failed to get boarding info:', error);
        throw new Error(`Failed to get boarding information: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Check if no boarding UTXOs
      if (!boardingUtxos || boardingUtxos.length === 0) {
        throw new Error(
          `❌ No Bitcoin in boarding address yet.\n\n` +
          `Your boarding address is:\n${boardingAddress}\n\n` +
          `📋 To board to Arkade:\n` +
          `1. Send Bitcoin to your boarding address (shown above)\n` +
          `2. Wait for confirmation (~10-60 minutes)\n` +
          `3. Click "Board to Arkade" again to complete\n\n` +
          `💡 TIP: Use the "Withdraw to Boarding Address" option when withdrawing from Arkade for easy re-boarding!`
        );
      }
      
      console.log(`✅ Found ${boardingUtxos.length} boarding UTXO(s), proceeding with onboard...`);
      
      // Call onboard() to board ALL boarding UTXOs into Arkade VTXOs
      setBoardProgress('Finalizing: Creating Arkade VTXOs...');
      const txid = await ramps.onboard();
      
      console.log('Boarding transaction sent:', txid);
      setBoardSuccess(`Boarding successful! Transaction ID: ${txid}\n\nAll ${balances.boarding.toLocaleString()} sats are being moved to Arkade L2.\n\nWait ~10 minutes for confirmation. The balance will update automatically.`);
      setBoardProgress('Complete! Waiting for confirmation...');
      
      // Show mempool link toast
      toast.show(
        `Board transaction submitted to ${getNetworkName()}! Track confirmation on mempool.`,
        'info',
        8000,
        {
          action: {
            label: 'View TX',
            onClick: () => window.open(getMempoolUrl(txid), '_blank', 'noopener,noreferrer')
          }
        }
      );
      
      // Refresh balances multiple times with increasing delays
      // First check after 5 seconds
      setTimeout(async () => {
        console.log('First balance check...');
        await handleRefresh();
      }, 5000);
      
      // Second check after 15 seconds
      setTimeout(async () => {
        console.log('Second balance check...');
        await handleRefresh();
      }, 15000);
      
      // Third check after 30 seconds
      setTimeout(async () => {
        console.log('Third balance check...');
        await handleRefresh();
      }, 30000);
      
      // Fourth check after 1 minute
      setTimeout(async () => {
        console.log('Fourth balance check...');
        await handleRefresh();
      }, 60000);
    } catch (error) {
      console.error('Boarding failed:', error);
      setBoardError((error as Error).message || 'Boarding failed');
    } finally {
      setBoarding(false);
    }
  };

  const handleWithdrawClick = () => {
    setShowWithdrawModal(true);
    setWithdrawError(null);
    setWithdrawSuccess(null);
    setWithdrawProgress('');
    setWithdrawMethod('collaborative');
    setUnrollProgress('');
    setShowUnrollInfo(false);
    void loadWithdrawVtxos();
    void checkRecoverableBalance();
  };

  const handleWithdrawSubmit = async () => {
    setWithdrawError(null);
    setWithdrawSuccess(null);
    setWithdrawProgress('');
    setUnrollProgress('');
    setWithdrawing(true);

    try {
      const arkadeWallet = getArkadeWallet();
      if (!arkadeWallet) {
        throw new Error('Wallet not connected');
      }

      // Determine destination address: boarding address or user input
      let destinationAddress = withdrawDestination;
      
      if (withdrawToBoardingAddress) {
        if (!addresses?.boarding) {
          throw new Error('Boarding address not available');
        }
        destinationAddress = addresses.boarding;
        console.log('🔄 Withdrawing to boarding address for easy re-boarding:', destinationAddress);
      }

      if (!destinationAddress) {
        throw new Error('Please enter a destination address or enable "Withdraw to Boarding Address"');
      }

      if (withdrawMethod === 'unilateral') {
        return await handleUnilateralExit();
      }

      setWithdrawProgress('Requesting collaborative exit...');

      const ramps = new Ramps(arkadeWallet);
      
      // Get server info
      setWithdrawProgress('Getting server info...');
      const info = await arkadeWallet.arkProvider.getInfo();
      console.log('Server info received:', info);
      
      // Prepare fee info - ALWAYS use user's selected fee rate
      let feeInfo;
      if (info?.fees) {
        feeInfo = {
          ...info.fees,
          txFeeRate: withdrawFeeRate.toString(), // Override with user's selected fee
        };
      } else {
        feeInfo = {
          intentFee: {
            offchainInput: '0',
            offchainOutput: '0',
            onchainInput: BigInt(0),
            onchainOutput: BigInt(200),
          },
          txFeeRate: withdrawFeeRate.toString(), // Use user's selected fee
        };
      }
      
      console.log('Using fee info with user-selected fee rate:', {
        ...feeInfo,
        userSelectedFeeRate: withdrawFeeRate
      });

      // Prepare withdrawal amount
      let amount: bigint | undefined;
      if (withdrawAll) {
        amount = undefined;
        console.log('Withdrawing all available balance');
      } else {
        if (!withdrawAmount || withdrawAmount === '0') {
          throw new Error('Please enter an amount');
        }
        amount = BigInt(withdrawAmount);
        console.log('Withdrawing amount:', amount.toString(), 'sats');
      }

      setWithdrawProgress('Submitting withdrawal request...');
      console.log('Calling offboard with:', {
        destinationAddress,
        feeInfo,
        amount: amount?.toString()
      });

      const txid = await ramps.offboard(
        destinationAddress,
        feeInfo,
        amount,
        (event: any) => {
          console.log('Settlement event:', event);
          switch (event.type) {
            case 'BATCH_STARTED':
              setWithdrawProgress('Batch processing started...');
              break;
            case 'TREE_SIGNING_STARTED':
              setWithdrawProgress('Signing transaction tree...');
              break;
            case 'TREE_NONCES':
              setWithdrawProgress('Exchanging nonces...');
              break;
            case 'BATCH_FINALIZED':
              setWithdrawProgress('Batch finalized!');
              break;
            case 'BATCH_FAILED':
              setWithdrawProgress('Batch failed');
              throw new Error('Batch processing failed');
          }
        }
      );

      const successMessage = withdrawToBoardingAddress
        ? `✅ Withdrawal successful! Transaction ID: ${txid}\n\n` +
          `🔄 Your funds are being sent to your boarding address.\n\n` +
          `💡 Once confirmed, click "Board to Arkade" to complete one-step re-boarding!`
        : `Withdrawal successful! Transaction ID: ${txid}`;
      
      setWithdrawSuccess(successMessage);
      setWithdrawProgress('Complete!');
      
      // Show mempool link toast
      toast.show(
        `Withdraw transaction submitted to ${getNetworkName()}! Track confirmation on mempool.`,
        'info',
        8000,
        {
          action: {
            label: 'View TX',
            onClick: () => window.open(getMempoolUrl(txid), '_blank', 'noopener,noreferrer')
          }
        }
      );
      
      // Reset form
      setWithdrawDestination('');
      setWithdrawAmount('');
      setWithdrawAll(false);
      setWithdrawToBoardingAddress(false);
      
      // Refresh balances after delay
      setTimeout(async () => {
        await handleRefresh();
      }, 2000);
    } catch (err: any) {
      console.error('Withdrawal error:', err);
      
      if (err.message && err.message.includes('not enough intent confirmations')) {
        setWithdrawError(
          'Batch round timeout - not enough participants.\n\n' +
          'This happens when there aren\'t enough users in the current round. ' +
          'The Arkade server batches multiple transactions together for efficiency.\n\n' +
          'Solutions:\n' +
          '• Wait a few minutes and try again\n' +
          '• Try during peak hours when more users are active\n' +
          '• Try Unilateral Exit if ASP is unresponsive\n\n' +
          'Your funds are safe and were not withdrawn.'
        );
      } else if (err.message && err.message.includes('INVALID_PSBT_INPUT') && err.message.includes('expires after')) {
        setWithdrawError(
          'VTXO Expiry Validation Error\n\n' +
          'Your VTXO was just boarded and needs to age before collaborative exit is allowed.\n\n' +
          'Wait Time: 1-24 hours (usually works after a few hours)\n' +
          'Reason: ASP requires VTXOs to have less than 29 days remaining before expiry\n\n' +
          'Solutions:\n' +
          '• Wait a few hours and try again (Recommended - much cheaper)\n' +
          '• Use Unilateral Exit if urgent (More expensive, ~24 hour timelock)\n\n' +
          'This is a normal security mechanism. Your funds are safe.'
        );
      } else {
        setWithdrawError(err.message || 'Withdrawal failed');
      }
    } finally {
      setWithdrawing(false);
    }
  };

  const handleUnilateralExit = async () => {
    try {
      const arkadeWallet = getArkadeWallet();
      if (!arkadeWallet) {
        throw new Error('Wallet not connected');
      }

      setWithdrawProgress('⚠️ Starting Unilateral Exit (Trustless)');
      setUnrollProgress('Initializing unilateral exit...');

      // Import required classes
      const { Unroll, OnchainWallet } = await import('@arkade-os/sdk');

      // Step 1: Create onchain wallet to pay miner fees
      setUnrollProgress('Step 1/5: Creating onchain wallet for miner fees...');
      // Note: OnchainWallet may need to be created differently - check SDK version
      // Using wallet's built-in provider for now
      console.log('Using wallet provider for unroll fees');

      // Get user's VTXOs
      setUnrollProgress('Step 2/5: Fetching your VTXOs...');
      const vtxos = await arkadeWallet.getVtxos();
      console.log('Available VTXOs:', vtxos);

      if (!vtxos || vtxos.length === 0) {
        throw new Error('No VTXOs available to exit');
      }

      // Select VTXOs to unroll (all if withdrawAll, otherwise calculate)
      let vtxosToUnroll = vtxos;
      if (!withdrawAll && withdrawAmount) {
        const targetAmount = BigInt(withdrawAmount);
        let accumulated = BigInt(0);
        vtxosToUnroll = [];
        
        for (const vtxo of vtxos) {
          vtxosToUnroll.push(vtxo);
          accumulated += BigInt(vtxo.value);
          if (accumulated >= targetAmount) break;
        }
      }

      setUnrollProgress(`Step 3/5: Unrolling ${vtxosToUnroll.length} VTXO(s)...`);
      
      // Process each VTXO
      for (let i = 0; i < vtxosToUnroll.length; i++) {
        const vtxo = vtxosToUnroll[i];
        const outpoint = { txid: vtxo.txid, vout: vtxo.vout };
        
        setUnrollProgress(`Step 3/5: Unrolling VTXO ${i + 1}/${vtxosToUnroll.length}...`);
        console.log(`Creating unroll session for VTXO: ${outpoint.txid}:${outpoint.vout}`);

        // Create unroll session
        // Note: Unroll.Session.create may require different parameters based on SDK version
        // This is a placeholder - needs testing with actual SDK
        const session = await Unroll.Session.create(
          outpoint,
          arkadeWallet,
          arkadeWallet.arkProvider,
          arkadeWallet.indexerProvider
        );

        // Execute unroll steps
        for await (const step of session) {
          switch (step.type) {
            case Unroll.StepType.WAIT:
              setUnrollProgress(`Waiting for tx ${step.txid.substring(0, 8)}... to confirm`);
              console.log(`Waiting for ${step.txid} to confirm`);
              break;
            case Unroll.StepType.UNROLL:
              setUnrollProgress(`Broadcasting unroll transaction...`);
              console.log(`Broadcasting ${step.tx.id}`);
              break;
            case Unroll.StepType.DONE:
              setUnrollProgress(`Unroll complete for VTXO ${i + 1}/${vtxosToUnroll.length}`);
              console.log(`Unroll complete for ${step.vtxoTxid}`);
              break;
          }
        }
      }

      // Step 4: Wait for CSV timelock
      setUnrollProgress('Step 4/5: Waiting for CSV timelock to expire (~24 hours)...');
      setWithdrawProgress('⏳ Timelock Wait Required');
      
      setWithdrawError(
        '⏳ UNROLL PHASE COMPLETE - TIMELOCK WAIT REQUIRED\n\n' +
        'Your VTXOs have been successfully unrolled to the Bitcoin blockchain.\n\n' +
        '⚠️ You must now wait ~24 hours (144 blocks) for the CSV timelock to expire.\n\n' +
        'After the timelock:\n' +
        '• Come back to this Withdraw section\n' +
        '• Select "Unilateral Exit" again\n' +
        '• The system will detect completed unrolls and finalize your exit\n\n' +
        'Your funds are safe and locked on-chain. No one can access them except you after the timelock.'
      );

      // Save state for later completion (in real app, store in localStorage or backend)
      console.log('VTXOs unrolled. User must wait for timelock and complete exit later.');

    } catch (err: any) {
      console.error('Unilateral exit error:', err);
      setWithdrawError(
        'Unilateral Exit Failed\n\n' +
        err.message + '\n\n' +
        'This is a complex process requiring:\n' +
        '• Onchain Bitcoin to pay miner fees\n' +
        '• Multiple sequential transactions\n' +
        '• ~24 hour timelock wait\n\n' +
        'If you\'re seeing wallet/provider errors, the SDK may not fully support unilateral exits in the browser yet. ' +
        'Consider waiting 12-24 hours and trying collaborative exit instead.'
      );
    } finally {
      setWithdrawing(false);
    }
  };

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
  };

  return (
    <>
      {/* Simple Navigation Bar */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold">ARKVTXO platform</h1>
            <a
              href="https://x.com/arkvtxo"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="ARKVTXO on X"
              className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg transition-all hover:bg-white/10 text-sm sm:text-base"
            >
              <Image
                src={tweeterIcon}
                alt="X"
                width={16}
                height={16}
                className="w-4 h-4"
              />
              <span className="hidden sm:inline">@arkvtxo</span>
            </a>
          </div>
          
          {/* Navigation - Always visible, responsive sizing */}
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg transition-all text-sm sm:text-base ${
                pathname === '/' ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Wallet</span>
            </Link>
            <Link
              href="/marketplace"
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg transition-all text-sm sm:text-base ${
                pathname === '/marketplace' ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">Marketplace</span>
            </Link>
            <Link
              href="/docs"
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg transition-all text-sm sm:text-base ${
                pathname === '/docs' ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">Docs</span>
            </Link>
            <Link
              href="/presale"
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg transition-all text-sm sm:text-base ${
                pathname === '/presale' ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span className="hidden sm:inline">Pre-sale</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* Wallet Header Card */}
      <div className="bg-gradient-to-br from-blue-50 to-white border-b border-blue-200 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-white rounded-2xl shadow-lg border border-blue-200 p-8">
            {!connected ? (
              /* Not Connected State */
              <div className="text-center">
                <div className="mb-3 flex justify-center">
                  <Image
                    src={logoArkvtxo}
                    alt="ARKVTXO"
                    priority
                    className="h-auto w-28 sm:w-32 md:w-36"
                  />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Arkade Wallet</h2>
                <p className="text-gray-600 mb-8">Create a new wallet or restore an existing one</p>
                
                {!showRestore ? (
                  <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
                    {vaultExists && (
                      <button
                        onClick={() => setShowUnlockModal(true)}
                        className="w-full px-6 py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-all"
                      >
                        Unlock with Password
                      </button>
                    )}
                    <button
                      onClick={handleCreateWallet}
                      disabled={connecting}
                      className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                    >
                      {connecting ? 'Creating...' : 'Create New Wallet'}
                    </button>
                    <button
                      onClick={() => setShowRestore(true)}
                      className="w-full px-6 py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-all"
                    >
                      Restore Existing Wallet
                    </button>
                  </div>
                ) : (
                  <div className="max-w-lg mx-auto">
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2 text-left">
                        Private Key - Optional
                      </label>
                      <input
                        type="text"
                        value={restorePrivateKey}
                        onChange={(e) => setRestorePrivateKey(e.target.value)}
                        placeholder="Enter your private key..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2 text-left">
                        Recovery Phrase (12 words) - Optional
                      </label>
                      <textarea
                        value={restoreMnemonic}
                        onChange={(e) => setRestoreMnemonic(e.target.value)}
                        placeholder="Enter your 12-word recovery phrase..."
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mb-4 text-left">
                      You can provide either a private key OR a recovery phrase (not both required)
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleRestoreWallet}
                        disabled={connecting || (!restorePrivateKey.trim() && !restoreMnemonic.trim())}
                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50"
                      >
                        {connecting ? 'Restoring...' : 'Restore Wallet'}
                      </button>
                      <button
                        onClick={() => { 
                          setShowRestore(false); 
                          setRestorePrivateKey(''); 
                          setRestoreMnemonic('');
                        }}
                        className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Connected State */
              <div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <h2 className="text-xl md:text-2xl font-bold text-gray-900">Wallet Connected</h2>
                    </div>
                    
                    {/* Mobile Menu Button */}
                    <button
                      onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                      className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      aria-label="Toggle wallet menu"
                    >
                      <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {mobileMenuOpen ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        )}
                      </svg>
                    </button>
                  </div>
                  
                  {/* Desktop Action Buttons - Hidden on Mobile */}
                  <div className="hidden md:flex items-center gap-2">
                    <button
                      onClick={handleBoardClick}
                      disabled={boarding}
                      className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                      title="Move funds from Taproot (L1) to Arkade (L2)"
                    >
                      <ArrowUpFromLine className="w-4 h-4" />
                      Board
                    </button>
                    <button
                      onClick={handleWithdrawClick}
                      disabled={withdrawing}
                      className="px-4 py-2 bg-blue-200 text-blue-800 rounded-lg hover:bg-blue-300 transition-colors flex items-center gap-2 disabled:opacity-50"
                      title="Move funds from Arkade (L2) back to Taproot (L1)"
                    >
                      <ArrowDownToLine className="w-4 h-4" />
                      Withdraw
                    </button>
                    <button
                      onClick={handleRefresh}
                      className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </button>
                    {vaultExists && (
                      <button
                        onClick={() => setShowChangePasswordModal(true)}
                        className="px-4 py-2 bg-blue-200 text-blue-800 rounded-lg hover:bg-blue-300 transition-colors"
                      >
                        Change Password
                      </button>
                    )}
                    <button
                      onClick={handleDisconnect}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* Mobile Action Buttons - Shown when menu is open */}
                {mobileMenuOpen && (
                  <div className="md:hidden flex flex-col gap-2 mb-6 pb-4 border-b border-gray-200">
                    <button
                      onClick={() => {
                        handleBoardClick();
                        setMobileMenuOpen(false);
                      }}
                      disabled={boarding}
                      className="w-full px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                      title="Move funds from Taproot (L1) to Arkade (L2)"
                    >
                      <ArrowUpFromLine className="w-4 h-4" />
                      Board
                    </button>
                    <button
                      onClick={() => {
                        handleWithdrawClick();
                        setMobileMenuOpen(false);
                      }}
                      disabled={withdrawing}
                      className="w-full px-4 py-3 bg-blue-200 text-blue-800 rounded-lg hover:bg-blue-300 transition-colors flex items-center gap-2 disabled:opacity-50"
                      title="Move funds from Arkade (L2) back to Taproot (L1)"
                    >
                      <ArrowDownToLine className="w-4 h-4" />
                      Withdraw
                    </button>
                    <button
                      onClick={() => {
                        handleRefresh();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </button>
                    {vaultExists && (
                      <button
                        onClick={() => {
                          setShowChangePasswordModal(true);
                          setMobileMenuOpen(false);
                        }}
                        className="w-full px-4 py-3 bg-blue-200 text-blue-800 rounded-lg hover:bg-blue-300 transition-colors"
                      >
                        Change Password
                      </button>
                    )}
                    <button
                      onClick={() => {
                        handleDisconnect();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                )}

                {/* Balances */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-300 rounded-xl p-4">
                    <div className="text-xs sm:text-sm text-blue-800 font-medium mb-1">Arkade L2</div>
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                      <div className="text-2xl sm:text-3xl font-bold text-blue-900 break-all">{balances.arkade.toLocaleString()}</div>
                      <div className="text-xs text-blue-700">sats</div>
                    </div>
                    <div className="text-xs text-blue-600 mt-1 font-mono">
                      ≈ {(balances.arkade / 100_000_000).toFixed(8)} BTC
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-100 to-blue-200 border border-blue-400 rounded-xl p-4">
                    <div className="text-xs sm:text-sm text-blue-900 font-medium mb-1">SegWit (L1)</div>
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                      <div className="text-2xl sm:text-3xl font-bold text-blue-950 break-all">{balances.segwit.toLocaleString()}</div>
                      <div className="text-xs text-blue-800">sats</div>
                    </div>
                    <div className="text-xs text-blue-700 mt-1 font-mono">
                      ≈ {(balances.segwit / 100_000_000).toFixed(8)} BTC
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-200 to-blue-300 border border-blue-500 rounded-xl p-4">
                    <div className="text-xs sm:text-sm text-blue-950 font-medium mb-1">Taproot (L1)</div>
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                      <div className="text-2xl sm:text-3xl font-bold text-blue-950 break-all">{balances.boarding.toLocaleString()}</div>
                      <div className="text-xs text-blue-900">sats</div>
                    </div>
                    <div className="text-xs text-blue-800 mt-1 font-mono">
                      ≈ {(balances.boarding / 100_000_000).toFixed(8)} BTC
                    </div>
                  </div>
                </div>

                {/* Addresses */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-300 rounded-lg">
                    <div>
                      <div className="text-xs text-blue-700 mb-1">Arkade Address (Off-chain)</div>
                      <div className="font-mono text-sm text-blue-900">{formatAddress(addresses?.offchain || '')}</div>
                    </div>
                    <button
                      onClick={() => handleCopy(addresses?.offchain || '')}
                      className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  {addresses?.segwit && (
                    <div className="flex items-center justify-between p-3 bg-blue-100 border border-blue-400 rounded-lg">
                      <div>
                        <div className="text-xs text-blue-800 mb-1">SegWit Address (For tokens)</div>
                        <div className="font-mono text-sm text-blue-950">{formatAddress(addresses.segwit)}</div>
                      </div>
                      <button
                        onClick={() => handleCopy(addresses.segwit!)}
                        className="p-2 bg-blue-200 text-blue-800 rounded-lg hover:bg-blue-300 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3 bg-blue-200 border border-blue-500 rounded-lg">
                    <div>
                      <div className="text-xs text-blue-900 mb-1">Taproot / Boarding Address</div>
                      <div className="font-mono text-sm text-blue-950">{formatAddress(addresses?.boarding || '')}</div>
                      <div className="text-xs text-blue-700 mt-1">💡 Send Bitcoin here to board to Arkade L2</div>
                    </div>
                    <button
                      onClick={() => handleCopy(addresses?.boarding || '')}
                      className="p-2 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Wallet Credentials Modal */}
      {showNewWalletModal && newWalletCreds && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-blue-600 shadow-2xl">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-blue-600 bg-gradient-to-r from-blue-700 to-blue-900">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-blue-100" size={28} />
                <div>
                  <h2 className="text-2xl font-bold text-white">Back Up Your Recovery Phrase</h2>
                  <p className="text-sm text-blue-200 mt-1">⚠️ This will only be shown once!</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Warning Box */}
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={24} />
                  <div className="text-red-800 text-sm space-y-2">
                    <p className="font-bold text-base">⚠️ CRITICAL - READ CAREFULLY</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>Save this recovery phrase NOW</strong> - it will NOT be shown again</li>
                      <li>Anyone with this recovery phrase can access your wallet</li>
                      <li>NEVER share these with anyone</li>
                      <li>Store them in a SECURE location (password manager, encrypted file, or paper)</li>
                      <li>Losing these means PERMANENT loss of access to your funds</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Recovery Phrase */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-gray-900 font-bold text-lg">
                    Recovery Phrase (12 words)
                  </label>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-400 rounded-lg p-4">
                  <p className="font-mono text-sm text-gray-900 break-all leading-relaxed">
                    {newWalletCreds.mnemonic}
                  </p>
                </div>
                <p className="text-xs text-blue-700 mt-2 font-medium">
                   Write these 12 words down in order. You can use them to restore your wallet on any device.
                </p>
              </div>

              {/* Password */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-4">
                  Set a password to encrypt your wallet on this device. From now on, you will log in using this password.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                    <input
                      type="password"
                      value={newWalletPassword}
                      onChange={(e) => setNewWalletPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="Enter a password"
                    />
                    {renderPasswordStrength(newWalletPassword)}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                    <input
                      type="password"
                      value={newWalletPasswordConfirm}
                      onChange={(e) => setNewWalletPasswordConfirm(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="Confirm password"
                    />
                  </div>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <div className="bg-gradient-to-br from-blue-700 to-blue-900 border-2 border-blue-800 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={credsConfirmed}
                    onChange={(e) => setCredsConfirmed(e.target.checked)}
                    className="w-5 h-5 mt-0.5 cursor-pointer"
                  />
                  <span className="text-white font-semibold">
                     I have saved my Recovery Phrase in a secure location.
                    I understand that losing it means permanent loss of access to my wallet.
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmCreateWallet}
                  disabled={!credsConfirmed || connecting || !passwordRules(newWalletPassword).isStrong || newWalletPassword !== newWalletPasswordConfirm}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-4 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Creating Wallet...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={20} />
                      Set Password & Create Wallet
                    </>
                  )}
                </button>
              </div>

              {/* Cancel Option */}
              <div className="text-center">
                <button
                  onClick={() => {
                    if (confirm('Are you sure? Your credentials will be lost and you\'ll need to generate new ones.')) {
                      setShowNewWalletModal(false);
                      setNewWalletCreds(null);
                      setCredsConfirmed(false);
                      setNewWalletPassword('');
                      setNewWalletPasswordConfirm('');
                    }
                  }}
                  className="text-gray-500 hover:text-gray-700 text-sm underline"
                >
                  Cancel (credentials will be lost)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full border border-blue-200 shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-blue-200">
              <h2 className="text-2xl font-bold text-gray-900">Unlock Wallet</h2>
              <button
                onClick={() => {
                  setShowUnlockModal(false);
                  setUnlockPassword('');
                }}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Enter your password to unlock your wallet on this device.
              </p>
              <input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Password"
              />
              <button
                onClick={handleUnlock}
                disabled={!unlockPassword || unlocking}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {unlocking ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Unlocking...
                  </>
                ) : (
                  'Unlock'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal (restore/migration) */}
      {showSetPasswordModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full border border-blue-200 shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-blue-200">
              <h2 className="text-2xl font-bold text-gray-900">Set Password</h2>
              <button
                onClick={() => {
                  setShowSetPasswordModal(false);
                  setPendingPrivateKey(null);
                  setSetPassword('');
                  setSetPasswordConfirm('');
                }}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700">{setPasswordMessage}</p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={setPassword}
                  onChange={(e) => setSetPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter a password"
                />
                {renderPasswordStrength(setPassword)}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={setPasswordConfirm}
                  onChange={(e) => setSetPasswordConfirm(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Confirm password"
                />
              </div>
              <button
                onClick={handleSetPasswordAndConnect}
                disabled={!setPassword || !setPasswordConfirm || settingPassword || !passwordRules(setPassword).isStrong || setPassword !== setPasswordConfirm}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {settingPassword ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Saving...
                  </>
                ) : (
                  'Save Password & Continue'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full border border-blue-200 shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-blue-200">
              <h2 className="text-2xl font-bold text-gray-900">Change Password</h2>
              <button
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setCurrentPassword('');
                  setChangePasswordNew('');
                  setChangePasswordConfirm('');
                }}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Enter your current password, then choose a new one.
              </p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Current password"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                <input
                  type="password"
                  value={changePasswordNew}
                  onChange={(e) => setChangePasswordNew(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="New password"
                />
                {renderPasswordStrength(changePasswordNew)}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={changePasswordConfirm}
                  onChange={(e) => setChangePasswordConfirm(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Confirm new password"
                />
              </div>
              <button
                onClick={handleChangePassword}
                disabled={
                  changingPassword ||
                  !currentPassword ||
                  !changePasswordNew ||
                  !changePasswordConfirm ||
                  !passwordRules(changePasswordNew).isStrong ||
                  changePasswordNew !== changePasswordConfirm
                }
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Board Modal */}
      {showBoardModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-green-200">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-green-200">
              <h2 className="text-2xl font-bold text-gray-900">Board to Arkade L2</h2>
              <button
                onClick={() => setShowBoardModal(false)}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Balance Display */}
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-gray-600 text-sm mb-1">Bitcoin in Boarding Address</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(balances.boarding / 100_000_000).toFixed(8)} BTC
                </p>
                <p className="text-gray-600 text-sm mt-1">
                  {balances.boarding.toLocaleString()} sats
                </p>
              </div>

              {/* Info about boarding */}
              <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">💡 Info:</span> Boarding will convert <span className="font-bold text-blue-700">all Bitcoin in your boarding address</span> into Arkade L2 VTXOs. The ASP handles transaction fees automatically.
                </p>
              </div>

              {/* Board Progress */}
              {boardProgress && (
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="animate-spin text-green-600" size={20} />
                    <p className="text-gray-900">{boardProgress}</p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {boardError && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                    <p className="text-red-700 text-sm whitespace-pre-line">{boardError}</p>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {boardSuccess && (
                <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                    <p className="text-green-700 text-sm break-all">{boardSuccess}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleBoardSubmit}
                  disabled={boarding || balances.boarding === 0}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {boarding ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowUpFromLine size={20} />
                      Board All {balances.boarding > 0 ? `(${balances.boarding.toLocaleString()} sats)` : ''}
                    </>
                  )}
                </button>
              </div>

              {/* Info Box */}
              <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                  <div className="text-gray-700 text-sm space-y-1">
                    <p className="font-semibold">Important Notes:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Boarding moves <strong>ALL</strong> your Bitcoin from L1 (Taproot) to Arkade L2</li>
                      <li>Transactions on L2 are instant and have near-zero fees</li>
                      <li>Wait ~10 minutes for confirmation after boarding</li>
                      <li>You can withdraw back to L1 anytime (and choose amount) using the Withdraw button</li>
                      <li>Network fees will be deducted from the boarding amount</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-blue-200">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-blue-200">
              <h2 className="text-2xl font-bold text-gray-900">Withdraw to Bitcoin L1</h2>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Balance Display */}
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-gray-600 text-sm mb-1">Available Balance (Arkade L2)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(balances.arkade / 100_000_000).toFixed(8)} BTC
                </p>
                <p className="text-gray-600 text-sm mt-1">
                  {balances.arkade.toLocaleString()} sats
                </p>
              </div>

              {/* VTXO List */}
              <div className="border border-blue-200 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-gray-900 font-semibold">Your VTXOs (UTXO-like outputs)</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Some collaborative exits are rejected when a VTXO has more than {COLLAB_EXIT_MAX_DAYS_REMAINING} days remaining before expiry.
                      VTXOs are sorted by soonest expiry.
                    </p>
                  </div>
                  <button
                    onClick={loadWithdrawVtxos}
                    disabled={withdrawVtxosLoading}
                    className="text-sm px-3 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {withdrawVtxosLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {withdrawVtxosError && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                    {withdrawVtxosError}
                  </div>
                )}

                {!withdrawVtxosError && (
                  <div className="mt-3">
                    {withdrawVtxosLoading ? (
                      <div className="text-sm text-gray-700 flex items-center gap-2">
                        <Loader2 className="animate-spin" size={16} />
                        Loading VTXOs...
                      </div>
                    ) : withdrawVtxos.length === 0 ? (
                      <div className="text-sm text-gray-700">No VTXOs found for this wallet.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 border-b">
                              <th className="py-2 pr-4">Outpoint</th>
                              <th className="py-2 pr-4">Sats</th>
                              <th className="py-2 pr-4">State</th>
                              <th className="py-2 pr-4">Expiry left</th>
                              <th className="py-2">Collaborative</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {withdrawVtxos.map((v: any) => {
                              const outpoint = `${v.txid}:${v.vout}`;
                              const expiryMs = getVtxoExpiryMs(v);
                              const eligibility = isCollaborativeExitEligibleByExpiry(v);
                              const state = v?.virtualStatus?.state || v?.status || 'unknown';

                              return (
                                <tr key={outpoint} className="text-gray-900">
                                  <td className="py-2 pr-4 font-mono text-xs break-all">{outpoint}</td>
                                  <td className="py-2 pr-4">{Number(v.value).toLocaleString()}</td>
                                  <td className="py-2 pr-4">{state}{v?.isSpent ? ' (spent)' : ''}</td>
                                  <td className="py-2 pr-4">{expiryMs ? formatTimeLeft(expiryMs) : 'Unknown'}</td>
                                  <td className="py-2">
                                    {eligibility.eligible ? (
                                      <span className="text-green-700 font-semibold">Yes</span>
                                    ) : (
                                      <span className="text-gray-600">No</span>
                                    )}
                                    <div className="text-xs text-gray-500">{eligibility.reason}</div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* VTXO Renewal & Recovery */}
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-gray-900 font-semibold">VTXO Renewal & Recovery</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Auto-renew is enabled for this wallet. It renews VTXOs when they are within ~{Math.round(VTXO_RENEW_THRESHOLD_MS / (60 * 60 * 1000))} hours of expiry (runs on login and daily while this app is open).
                    </p>
                  </div>
                  <button
                    onClick={() => void checkAndAutoRenewVtxos('manual')}
                    disabled={autoRenewChecking}
                    className="text-sm px-3 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {autoRenewChecking ? 'Checking...' : 'Run Check'}
                  </button>
                </div>

                {autoRenewError && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                    {autoRenewError}
                  </div>
                )}

                <div className="mt-3 text-sm text-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs text-gray-500">Last checked</div>
                    <div className="font-medium">{formatDateTime(autoRenewLastCheckedAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Expiring found</div>
                    <div className="font-medium">{autoRenewLastExpiringCount === null ? '—' : autoRenewLastExpiringCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Last renew txid</div>
                    <div className="font-mono text-xs break-all">{autoRenewLastRenewTxid ? autoRenewLastRenewTxid : '—'}</div>
                  </div>
                </div>

                <div className="mt-4 border-t border-blue-200 pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-gray-900 font-semibold">Recovery</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Checks for swept/expired VTXOs and preconfirmed sub-dust that can be recovered back into your wallet.
                      </p>
                    </div>
                    <button
                      onClick={() => void checkRecoverableBalance()}
                      disabled={recoverableChecking}
                      className="text-sm px-3 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                      {recoverableChecking ? 'Checking...' : 'Check'}
                    </button>
                  </div>

                  {recoverableError && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                      {recoverableError}
                    </div>
                  )}

                  <div className="mt-3 text-sm text-gray-700 grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div>
                      <div className="text-xs text-gray-500">Recoverable</div>
                      <div className="font-medium">{formatNumberLike(recoverableBalance?.recoverable)} sats</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Sub-dust</div>
                      <div className="font-medium">{formatNumberLike(recoverableBalance?.subdust)} sats</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Sub-dust included</div>
                      <div className="font-medium">{recoverableBalance ? (recoverableBalance.includesSubdust ? 'Yes' : 'No') : '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">VTXO count</div>
                      <div className="font-medium">{recoverableBalance ? recoverableBalance.vtxoCount : '—'}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-4">
                    <div className="text-xs text-gray-600">
                      {recoverableTxid ? (
                        <span className="font-mono break-all">Recovered txid: {recoverableTxid}</span>
                      ) : recoverableProgress ? (
                        <span>Progress: {recoverableProgress}</span>
                      ) : (
                        <span />
                      )}
                    </div>
                    <button
                      onClick={() => void recoverVtxosNow()}
                      disabled={recoverableRecovering || !recoverableBalance || recoverableBalance.recoverable <= 0n}
                      className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {recoverableRecovering ? 'Recovering...' : 'Recover Now'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Withdrawal Method Selection */}
              <div>
                <label className="block text-gray-900 font-medium mb-3">Withdrawal Method</label>
                <div className="space-y-3">
                  {/* Collaborative Exit */}
                  <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    withdrawMethod === 'collaborative' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-blue-300'
                  }`}>
                    <input
                      type="radio"
                      name="withdrawMethod"
                      value="collaborative"
                      checked={withdrawMethod === 'collaborative'}
                      onChange={(e) => setWithdrawMethod(e.target.value as 'collaborative')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Collaborative Exit (Recommended)</div>
                      <div className="text-sm text-gray-600 mt-1">
                        ✓ Fast (~60 seconds)<br/>
                        ✓ Low fees (batched with others)<br/>
                        ✓ Requires ASP cooperation<br/>
                        ⚠️ May fail if VTXO just boarded (wait 1-6 hours)
                      </div>
                    </div>
                  </label>

                  {/* Unilateral Exit */}
                  <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    withdrawMethod === 'unilateral' 
                      ? 'border-orange-500 bg-orange-50' 
                      : 'border-gray-300 hover:border-orange-300'
                  }`}>
                    <input
                      type="radio"
                      name="withdrawMethod"
                      value="unilateral"
                      checked={withdrawMethod === 'unilateral'}
                      onChange={(e) => setWithdrawMethod(e.target.value as 'unilateral')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Unilateral Exit (Trustless)</div>
                      <div className="text-sm text-gray-600 mt-1">
                        ✓ Works without ASP<br/>
                        ✓ Trustless - guaranteed<br/>
                        ⚠️ Expensive (multiple onchain txs)<br/>
                        ⚠️ Slow (~24 hour timelock)<br/>
                        ⚠️ Requires onchain BTC for fees
                      </div>
                    </div>
                  </label>
                </div>
                
                {/* Info link for unilateral exit */}
                {withdrawMethod === 'unilateral' && (
                  <button
                    onClick={() => setShowUnrollInfo(!showUnrollInfo)}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    {showUnrollInfo ? '▼' : '▶'} How does Unilateral Exit work?
                  </button>
                )}
              </div>

              {/* Unilateral Exit Info */}
              {withdrawMethod === 'unilateral' && showUnrollInfo && (
                <div className="bg-orange-50 border border-orange-300 rounded-lg p-4">
                  <div className="text-sm text-gray-700 space-y-2">
                    <p className="font-semibold text-orange-900">Unilateral Exit Process:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li><strong>Unroll Phase:</strong> Your VTXOs are "unrolled" - the virtual transaction tree is published to Bitcoin blockchain (multiple sequential txs, each requiring miner fees)</li>
                      <li><strong>Timelock Wait:</strong> You must wait ~24 hours (144 blocks) for the CSV (CHECKSEQUENCEVERIFY) timelock to expire</li>
                      <li><strong>Completion Phase:</strong> After timelock, return here and complete the exit to claim your Bitcoin</li>
                    </ol>
                    <p className="text-xs text-orange-800 mt-2">
                      <strong>Cost:</strong> Each level in the VTXO tree = 1 Bitcoin transaction fee. Deeper VTXOs (from many offchain txs) cost more to exit.
                    </p>
                    <p className="text-xs text-orange-800">
                      <strong>When to use:</strong> Only if collaborative exit fails repeatedly or ASP is permanently unavailable.
                    </p>
                  </div>
                </div>
              )}

              {/* Destination Address */}
              <div>
                <label className="block text-gray-900 font-medium mb-2">
                  Destination Address (Bitcoin L1)
                </label>
                <input
                  type="text"
                  value={withdrawDestination}
                  onChange={(e) => setWithdrawDestination(e.target.value)}
                  placeholder="bc1q... or bc1p..."
                  disabled={withdrawToBoardingAddress}
                  className="w-full bg-white text-gray-900 px-4 py-3 rounded-lg border border-blue-300 focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
                />
                
                {/* Withdraw to Boarding Address Option */}
                <label className="flex items-start gap-3 mt-3 p-3 bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={withdrawToBoardingAddress}
                    onChange={(e) => setWithdrawToBoardingAddress(e.target.checked)}
                    className="mt-1 w-4 h-4"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-green-900">🔄 Withdraw to my Boarding Address</span>
                    <p className="text-xs text-green-700 mt-1">
                      Enable <strong>one-step re-boarding!</strong> Your funds will go to the boarding address, ready to be boarded back to Arkade L2 with just one click (no manual transfer needed).
                    </p>
                    {withdrawToBoardingAddress && addresses?.boarding && (
                      <p className="text-xs text-green-800 mt-2 font-mono break-all bg-white/50 p-2 rounded">
                        📍 {addresses.boarding}
                      </p>
                    )}
                  </div>
                </label>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-gray-900 font-medium mb-2">Amount (satoshis)</label>
                <div className="space-y-2">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => {
                      setWithdrawAmount(e.target.value);
                      setWithdrawAll(false);
                    }}
                    placeholder="Amount in satoshis"
                    disabled={withdrawAll}
                    className="w-full bg-white text-gray-900 px-4 py-3 rounded-lg border border-blue-300 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  />
                  <label className="flex items-center gap-2 text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={withdrawAll}
                      onChange={(e) => {
                        setWithdrawAll(e.target.checked);
                        if (e.target.checked) {
                          setWithdrawAmount(balances.arkade.toString());
                        } else {
                          setWithdrawAmount('');
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Withdraw all available balance</span>
                  </label>
                </div>
              </div>

              {/* Settlement Progress */}
              {withdrawProgress && (
                <div className={`rounded-lg p-4 ${
                  withdrawMethod === 'unilateral' ? 'bg-orange-50' : 'bg-blue-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <Loader2 className={`animate-spin ${
                      withdrawMethod === 'unilateral' ? 'text-orange-600' : 'text-blue-600'
                    }`} size={20} />
                    <p className="text-gray-900">{withdrawProgress}</p>
                  </div>
                </div>
              )}

              {/* Unroll Progress */}
              {unrollProgress && withdrawMethod === 'unilateral' && (
                <div className="bg-orange-100 border border-orange-300 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="animate-spin text-orange-700" size={20} />
                    <p className="text-gray-900 text-sm">{unrollProgress}</p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {withdrawError && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                    <p className="text-red-700 text-sm whitespace-pre-line">{withdrawError}</p>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {withdrawSuccess && (
                <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                    <p className="text-green-700 text-sm break-all">{withdrawSuccess}</p>
                  </div>
                </div>
              )}

              {/* Fee Selection (only for collaborative) */}
              {withdrawMethod === 'collaborative' && (
                <div>
                  <FeeSelection
                    onFeeSelect={setWithdrawFeeRate}
                    estimatedVbytes={160}
                    selectedFee={withdrawFeeRate}
                  />
                  <div className="mt-2 text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2">
                    ⚠️ <strong>Note:</strong> Collaborative withdrawal fees are handled by the Arkade ASP server. The fee rate shown is the current recommended minimum (+1 sat/vbyte above mempool block).
                  </div>
                </div>
              )}

              {/* Unilateral Exit Warning */}
              {withdrawMethod === 'unilateral' && (
                <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={24} />
                    <div className="text-sm text-gray-700 space-y-2">
                      <p className="font-bold text-orange-900">⚠️ UNILATERAL EXIT - READ CAREFULLY</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>This is a <strong>2-phase process</strong>: Unroll now → Wait 24 hours → Complete exit</li>
                        <li>Costs <strong>multiple Bitcoin transaction fees</strong> (could be 300-1000+ sats depending on VTXO depth)</li>
                        <li>Requires <strong>onchain Bitcoin</strong> in a separate wallet to pay miner fees</li>
                        <li>Takes <strong>~24 hours</strong> due to CSV timelock security mechanism</li>
                        <li><strong>Only use if</strong>: ASP unresponsive or collaborative exit repeatedly fails</li>
                      </ul>
                      <p className="text-xs text-orange-800 font-semibold mt-2">
                        💡 Tip: If you just boarded, wait 1-6 hours and try collaborative exit - it's much cheaper!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleWithdrawSubmit}
                  disabled={withdrawing || !withdrawDestination || (!withdrawAmount && !withdrawAll)}
                  className={`flex-1 px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${
                    withdrawMethod === 'unilateral'
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {withdrawing ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine size={20} />
                      {withdrawMethod === 'unilateral' ? 'Start Unilateral Exit' : 'Withdraw Now'}
                    </>
                  )}
                </button>
              </div>

              {/* Info Box */}
              <div className={`border rounded-lg p-4 ${
                withdrawMethod === 'unilateral' 
                  ? 'bg-orange-50 border-orange-300' 
                  : 'bg-blue-50 border-blue-300'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertCircle className={`flex-shrink-0 mt-0.5 ${
                    withdrawMethod === 'unilateral' ? 'text-orange-600' : 'text-blue-600'
                  }`} size={20} />
                  <div className="text-gray-700 text-sm space-y-1">
                    <p className="font-semibold">
                      {withdrawMethod === 'unilateral' ? 'Unilateral Exit Process:' : 'Collaborative Exit Notes:'}
                    </p>
                    {withdrawMethod === 'unilateral' ? (
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li><strong>Phase 1 (Now):</strong> Unroll VTXOs to Bitcoin blockchain</li>
                        <li><strong>Wait Period:</strong> ~24 hours (144 blocks) for CSV timelock</li>
                        <li><strong>Phase 2 (Later):</strong> Complete exit and claim your Bitcoin</li>
                        <li>Multiple onchain transactions = higher total fees</li>
                        <li>Your funds remain safe on-chain during timelock</li>
                        <li>No ASP cooperation needed - fully trustless</li>
                      </ul>
                    ) : (
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Processed in next batch round (~60 seconds)</li>
                        <li>Batched with other users for efficiency</li>
                        <li>If VTXO just boarded: Wait 1-6 hours or use Unilateral Exit</li>
                        <li>If timeout: Try again or switch to peak hours</li>
                        <li>Network fees deducted from withdrawal amount</li>
                        <li>Ensure destination address is correct - irreversible</li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
