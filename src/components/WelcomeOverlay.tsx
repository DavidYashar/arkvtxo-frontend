'use client';

import { useEffect } from 'react';
import { ArrowRight, Zap, Coins, Shield, Lock, Link as LinkIcon } from 'lucide-react';

export default function WelcomeOverlay({
  open,
  onGoToApp,
}: {
  open: boolean;
  onGoToApp: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 text-white">
      <div className="h-full overflow-y-auto">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-20 pb-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block mb-6 px-4 py-2 bg-blue-800/50 rounded-full border border-blue-600/30">
              <p className="text-sm font-medium text-blue-200">built on Bitcoin Layer 2 (Arkade)</p>
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-200 to-white bg-clip-text text-transparent leading-tight">
              ARKVTXO Platform
            </h1>

            <p className="text-xl sm:text-2xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">
              Create, transfer, and manage tokens on Arkade with instant finality and zero transaction fees
            </p>

            <button
              onClick={onGoToApp}
              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 rounded-lg font-semibold text-lg shadow-xl shadow-blue-900/50 transition-all duration-200 hover:scale-105"
            >
              Go to the App
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <p className="mt-4 text-sm text-blue-300">
              You can connect/unlock your wallet inside the app. use a secure password, and no need to use your private key or seed phrases directly again.
            </p>
          </div>
        </section>

        {/* Bitcoin Stack Visualization */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">Built on Arkade</h2>
            <p className="text-center text-blue-200 mb-10 text-lg">
              Three layers working together for instant, secure token transfers
            </p>

            <div className="space-y-4">
              {/* Layer 3 */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                <div className="relative bg-gradient-to-r from-purple-600 to-blue-600 p-6 sm:p-8 rounded-lg border border-purple-400/30 hover:border-purple-400/50 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white/10 rounded-lg">
                      <Coins className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold">Token Layer (coming soon)</h3>
                        <span className="px-3 py-1 bg-purple-500/30 rounded-full text-xs font-medium">Layer 3</span>
                      </div>
                      <p className="text-blue-100 mb-3">
                        Token creation, transfers, and management with instant finality
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-white/10 rounded-full text-sm">OP_RETURN Registry</span>
                        <span className="px-3 py-1 bg-white/10 rounded-full text-sm">ASP verification</span>
                        <span className="px-3 py-1 bg-white/10 rounded-full text-sm">Zero Fees</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Layer 2 */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-lg blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                <div className="relative bg-gradient-to-r from-blue-600 to-cyan-600 p-6 sm:p-8 rounded-lg border border-blue-400/30 hover:border-blue-400/50 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white/10 rounded-lg">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold">Ark Protocol</h3>
                        <span className="px-3 py-1 bg-blue-500/30 rounded-full text-xs font-medium">Layer 2</span>
                      </div>
                      <p className="text-blue-100 mb-3">
                        Virtual UTXOs (vTXOs) enable instant, off-chain Bitcoin transfers
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-white/10 rounded-full text-sm">vTXO Management</span>
                        <span className="px-3 py-1 bg-white/10 rounded-full text-sm">Board/Withdraw</span>
                        <span className="px-3 py-1 bg-white/10 rounded-full text-sm">Instant Settlement</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Layer 1 */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-lg blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                <div className="relative bg-gradient-to-r from-orange-600 to-yellow-600 p-6 sm:p-8 rounded-lg border border-orange-400/30 hover:border-orange-400/50 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white/10 rounded-lg">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold">Bitcoin</h3>
                        <span className="px-3 py-1 bg-orange-500/30 rounded-full text-xs font-medium">Layer 1</span>
                      </div>
                      <p className="text-orange-100 mb-3">
                        The most secure blockchain providing final settlement and data availability
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-white/10 rounded-full text-sm">Final Settlement</span>
                        <span className="px-3 py-1 bg-white/10 rounded-full text-sm">Data Anchoring</span>
                        <span className="px-3 py-1 bg-white/10 rounded-full text-sm">Security</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-10">Why We Build on Arkade?</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-blue-900/30 backdrop-blur-sm p-6 rounded-lg border border-blue-700/30 hover:border-blue-600/50 transition-all duration-300">
                <div className="p-3 bg-blue-600/30 rounded-lg w-fit mb-4">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Instant Finality</h3>
                <p className="text-blue-200">Token transfers settle immediately with no waiting for confirmations</p>
              </div>

              <div className="bg-blue-900/30 backdrop-blur-sm p-6 rounded-lg border border-blue-700/30 hover:border-blue-600/50 transition-all duration-300">
                <div className="p-3 bg-blue-600/30 rounded-lg w-fit mb-4">
                  <Coins className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Zero Transfer Fees</h3>
                <p className="text-blue-200">Move assets between users without paying transaction fees</p>
              </div>

              <div className="bg-blue-900/30 backdrop-blur-sm p-6 rounded-lg border border-blue-700/30 hover:border-blue-600/50 transition-all duration-300">
                <div className="p-3 bg-blue-600/30 rounded-lg w-fit mb-4">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Bitcoin Security</h3>
                <p className="text-blue-200">All token data anchored on Bitcoin blockchain for immutability</p>
              </div>

              <div className="bg-blue-900/30 backdrop-blur-sm p-6 rounded-lg border border-blue-700/30 hover:border-blue-600/50 transition-all duration-300">
                <div className="p-3 bg-blue-600/30 rounded-lg w-fit mb-4">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Non-Custodial</h3>
                <p className="text-blue-200">You control your private keys. Your tokens, your custody.</p>
              </div>

              <div className="bg-blue-900/30 backdrop-blur-sm p-6 rounded-lg border border-blue-700/30 hover:border-blue-600/50 transition-all duration-300">
                <div className="p-3 bg-blue-600/30 rounded-lg w-fit mb-4">
                  <LinkIcon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">OP_RETURN Registry</h3>
                <p className="text-blue-200">Transparent token registry stored on Bitcoin via OP_RETURN</p>
              </div>

              <div className="bg-blue-900/30 backdrop-blur-sm p-6 rounded-lg border border-blue-700/30 hover:border-blue-600/50 transition-all duration-300">
                <div className="p-3 bg-blue-600/30 rounded-lg w-fit mb-4">
                  <LinkIcon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Will be implemented on taproot tree</h3>
                <p className="text-blue-200">Token registration and transactions will be confirmed by ASP (Arkade service provider)</p>
              </div>

              {/* <div className="bg-blue-900/30 backdrop-blur-sm p-6 rounded-lg border border-blue-700/30 hover:border-blue-600/50 transition-all duration-300">
                <div className="p-3 bg-blue-600/30 rounded-lg w-fit mb-4">
                  <Coins className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Flexible Tokens</h3>
                <p className="text-blue-200">Create tokens with custom supply, symbols, and decimal precision</p>
              </div> */}
            </div>
          </div>
        </section>

        {/* CTA + Footer */}
        <section className="container mx-auto px-4 py-12 pb-16">
          <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-blue-800/50 to-blue-900/50 backdrop-blur-sm p-10 rounded-2xl border border-blue-600/30">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-xl text-blue-200 mb-8 max-w-2xl mx-auto">
              Go to the app to connect your wallet and start using Arkade.
            </p>
            <button
              onClick={onGoToApp}
              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 rounded-lg font-semibold text-lg shadow-xl shadow-blue-900/50 transition-all duration-200 hover:scale-105"
            >
              Go to the App
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <footer className="border-t border-blue-800 mt-12 bg-blue-950/50 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-8">
              <div className="text-center text-blue-300 text-sm">
                <p className="mb-2 font-medium">Arkade Token Platform - Bitcoin Layer 2 Token Protocol</p>
                <p className="text-xs text-blue-400">Tokens are tracked via OP_RETURN outputs on Bitcoin blockchain</p>
                <div className="mt-4 flex items-center justify-center gap-6">
                  <a
                    href="https://arkvtxo.com/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-100 transition-colors font-medium"
                  >
                    read our doc
                  </a>
                  <span>•</span>
                  <a
                    href="https://docs.arkadeos.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-100 transition-colors font-medium"
                  >
                   official Arkade Documentation
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
