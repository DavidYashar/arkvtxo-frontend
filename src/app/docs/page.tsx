'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

type DocSection = {
  id: string;
  title: string;
  content: React.ReactNode;
};

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl shadow-lg border border-blue-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 text-left hover:bg-blue-50 transition-colors"
        aria-expanded={open}
      >
        <h2 className="text-lg sm:text-xl font-semibold text-blue-950">{title}</h2>
        <ChevronDown className={`w-5 h-5 text-blue-700 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-blue-950">
          <div className="prose prose-blue max-w-none prose-a:no-underline hover:prose-a:no-underline">
            {children}
          </div>
        </div>
      )}
    </section>
  );
}

export default function DocsPage() {
  const sections: DocSection[] = useMemo(
    () => [
      {
        id: 'about',
        title: 'About Arkade',
        content: (
          <>
            <p className="text-base sm:text-lg text-blue-900 leading-relaxed">
                Arkade is a Bitcoin Layer 2 experience designed to make sending and receiving Bitcoin feel fast and simple,
                while still staying connected to Bitcoin. Arkade is a programmable execution layer for Bitcoin. It enables fast, self-custodial financial applications on Bitcoin—including escrows, synthetic assets, lending protocols,
                and prediction markets—without requiring changes to the Bitcoin protocol. Built on{' '}
                <a
                    href="https://docs.arkadeos.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                      className="text-blue-700 hover:text-blue-800"
                >
                    Ark protocol
                </a>
                , Arkade extends the{' '}
                <a
                    href="https://docs.arkadeos.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                      className="text-blue-700 hover:text-blue-800"
                >
                    Ark protocol
                </a>{' '}
                beyond simple payments into a complete execution environment.
            </p> <br />
            <p className="text-blue-900 leading-relaxed">
              In this app that is created on Arkade system, you can manage your wallet, view activity, and interact with tokens in a user-friendly way.
              Everything is built to feel familiar: connect a wallet, fund it, and then use the features from the top
              navigation.
            </p>
          </>
        ),
      },
      {
        id: 'wallet',
        title: 'Wallet: What You Can Do',
        content: (
          <>
            <h3 className="text-lg font-semibold text-blue-950">Connect / Create / Restore</h3>
            <p className="text-blue-900 leading-relaxed">
              You can create a new wallet or restore an existing one. after clicking  <strong> Create new Wallet</strong> a pop up window shows your private key and seed phrases. Copy and store them somewhere safe, as those are your only way to restore. 
              Once connected, the header shows your addresses
              and balances, and the main wallet page becomes your dashboard.
            </p>

            <h3 className="text-lg font-semibold text-blue-950">Deposit</h3>
            <p className="text-blue-900 leading-relaxed">
              To deposit, you can use your receiving address (taproot) and send funds to it from any other wallet or exchange.
              Remember that in order to board (deposit) in your Arkade address, you need the BTC to be in your <strong>taproot</strong> address, not segwit. After the funds arrive in your taproot address,
              just click on refresh button and you see your BTC in your <strong>taproot</strong> address. Then, you can click on <strong>Board</strong> button, which opens a pop up page, and you see your available sats to board (deposit) to Arkade L2.
              be careful that you can only Board your full BTC amount you have in your taproot, not part of it.
            </p>

            <h3 className="text-lg font-semibold text-blue-950">Send / Transfer</h3>
            <p className="text-blue-900 leading-relaxed">
              You can send Bitcoin in your Arkade address to any other Arkade addresses, which arrives in maximum 10 seconds.
              To do the transfer, just find the <strong>Send Bitcoin (Arkade L2)</strong> section under the <strong>Wallet</strong> page, excatly below the <strong>Wallet</strong> header of yours, paste the Arkade address, enter the amount in sats, and click send.
            </p>
          </>
        ),
      },
      {
        id: 'withdraw',
        title: 'Withdraw: VTXOs, Recovery, and Renew',
        content: (
          <>
            <p className="text-blue-900 leading-relaxed">
              Transactions on Arkade are tracked using{' '}
              <a
                href="https://docs.arkadeos.com/learn/faq/what-are-vtxos#what-are-vtxos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 hover:text-blue-800"
              >
                <strong>VTXOs</strong>
            </a>. Think of these as
              “pieces” of your balance that can be used to pay or moved out. These are the same as UTXO on Bitcoin, with amount of sats and other details in them.
            </p>

            <h3 className="text-lg font-semibold text-blue-950">Choosing What to Withdraw</h3>
            <p className="text-blue-900 leading-relaxed">
              You can withdraw a specific amount or choose to withdraw all. The UI shows your available balance and helps
              you choose a destination address. 
              For Withdraw, your VTXO/s should be at least one to two days shorter to expire than the creation time. It means that you can withdraw roughly 48 hours after you deposited (Board) your BTC from Taproot to arkade.
              In Withdraw pop up, you see that there are two options available for withdraw, eitehr Collaborative Exit, or Unilateral Exit. 
              Collaborative exit is faster, and requre just one confirmation and its cheaper, while Unilateral exit is slower (up to 7 days) and more expensive, but it does not require any cooperation from the ASP (Arkade Service provider).
            </p>

            <h3 className="text-lg font-semibold text-blue-950">Renew (Keep Things Healthy)</h3>
            <p className="text-blue-900 leading-relaxed">
              Some VTXOs can approach an expiry window. The app can automatically renew them when needed, so your wallet stays
              in a good state while you keep using it. However, a good practice is to check your wallet and let the platform to check and identify the expiration dates of your VTXO/s and if needed, do the renew for you.
              You can always check your VTXO/s info and details in <strong>Withdraw</strong> page when you click on Withdraw button in your <strong>Wallet</strong> dashboard. 
              By clicking the check up button for renew, you make your VTXO/s checked for expiration and make the system to renew them.
            </p>

            <h3 className="text-lg font-semibold text-blue-950">Recovery</h3>
            <p className="text-blue-900 leading-relaxed">
             As explained, VTXO/s have expiration date, and they need to be renewed before reaching that date. Despite the fact that the platform checks your VTXO/s when you restore your wallet and renew them if they need to be renewed (at least 10 days remained to Expired),
              if the app detects a recoverable balance, which might happen if you do not restore your wallet for over a month or so, you’ll see an option to recover in <strong>Withdraw</strong> pop up after you click on <strong>Withdraw</strong> button in your wallet dashboard.
               This helps bring funds back into a usable state, and the app will show progress and a result when the recovery is submitted. Pay attention that recovered VTXO/s can not be used for <i>Unilateral exit</i> , just on <i>collaborative exit</i>.
            </p>
          </>
        ),
      },
      {
        id: 'history',
        title: 'Activity & History (VTXO Transactions)',
        content: (
          <>
            <p className="text-blue-900 leading-relaxed">
              The wallet page includes a transaction history section near the bottom. This is where you can review recent
              activity, including VTXO-related transactions and other wallet events. You can also copy and paste the TX ID on <strong>VTXO Lookup</strong> section below the Transaction History section.
            </p>
            <p className="text-blue-900 leading-relaxed">
              Use this to double-check what happened, copy transaction identifiers when you need them, and keep track of your
              wallet’s activity over time. Pay attention that the result you see after pasting your TX ID in VTXO look up is the latest update of that partcular VTXO.
            </p>
          </>
        ),
      },
      {
        id: 'presale',
        title: 'Pre-sale: Purchasing Tokens',
        content: (
          <>
            <p className="text-blue-900 leading-relaxed">
              The Pre-sale section is where you can purchase tokens when a token creator is running a sale.
            </p>
            <h3 className="text-lg font-semibold text-blue-950">How it Works (High Level)</h3>
            <p className="text-blue-900 leading-relaxed">
              You pick how many batches you want, review the price, and submit your request. If it’s your turn, you’ll be prompted
              to send payment. After payment is sent, the app confirms the result and updates your view.
            </p>
            <p className="text-blue-900 leading-relaxed">
              If a sale is busy, you may see a queue position while waiting. The app keeps you informed and shows success or a clear
              message if you can’t be fulfilled. Rest assured that your sats are safe in pre-sale section.
            </p>
          </>
        ),
      },
    ],
    []
  );

  const [openIds, setOpenIds] = useState<Record<string, boolean>>(() => ({
    about: true,
  }));

  const toggle = (id: string) => {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-blue-900 mb-2">Docs</h1>
          <p className="text-blue-800 text-base sm:text-lg mb-6">
            Quick, non-technical help for using the Arkade Token Platform.
          </p>

          <div className="space-y-4">
            {sections.map((s) => (
              <Section key={s.id} title={s.title} open={Boolean(openIds[s.id])} onToggle={() => toggle(s.id)}>
                {s.content}
              </Section>
            ))}
          </div>

          <section className="mt-6 bg-white rounded-2xl shadow-lg border border-blue-200 overflow-hidden">
            <div className="px-5 sm:px-6 py-4 bg-blue-50">
              <h2 className="text-lg sm:text-xl font-semibold text-blue-950">Tokens</h2>
              <p className="text-sm sm:text-base text-blue-800 mt-1">
                Create, view, and transfer tokens in a simple way. (coming soon)
              </p>
            </div>
            <div className="px-5 sm:px-6 py-5 sm:py-6">
              <div className="prose prose-blue max-w-none prose-a:no-underline hover:prose-a:no-underline">
                <p className="text-blue-900 leading-relaxed">
                  Tokens are a way to represent digital assets inside the Arkade experience. In this app, token tools will be available
                  directly from your wallet dashboard (right now they are blurred).
                </p>

                <h3 className="text-lg font-semibold text-blue-950">Create a Token</h3>
                <p className="text-blue-900 leading-relaxed">
                  In the Wallet page you will have the ability to create a new token by filling out the token details and submitting the creation.
                  After that, the token will appear in your token list.
                </p>

                <h3 className="text-lg font-semibold text-blue-950">View Your Tokens</h3>
                <p className="text-blue-900 leading-relaxed">
                  The wallet page will include a token list so you will quickly see what you own and track balances over time.
                </p>

                <h3 className="text-lg font-semibold text-blue-950">Transfer Tokens</h3>
                <p className="text-blue-900 leading-relaxed">
                  You will be able to transfer tokens to another user by entering their Arkade address and the amount you want to send.
                  The app will show confirmations and updates your view after a transfer.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6 bg-white rounded-2xl shadow-lg border border-blue-200 overflow-hidden">
            <div className="px-5 sm:px-6 py-4 bg-blue-50">
              <h2 className="text-lg sm:text-xl font-semibold text-blue-950">Marketplace (coming soon)</h2>
              <p className="text-sm sm:text-base text-blue-800 mt-1">
                Discover and trade tokens in one place. (coming soon)
              </p>
            </div>
            <div className="px-5 sm:px-6 py-5 sm:py-6">
              <div className="prose prose-blue max-w-none prose-a:no-underline hover:prose-a:no-underline">
                <p className="text-blue-900 leading-relaxed">
                  The Marketplace section is where you’ll be able to browse tokens, follow new projects, and participate in token activity as it becomes available.
                </p>

                <h3 className="text-lg font-semibold text-blue-950">What to Expect</h3>
                <p className="text-blue-900 leading-relaxed">
                  You’ll see featured and trending tokens, basic token information, and easy ways to navigate between projects.
                  As the Marketplace grows, it will focus on a clean experience and simple actions without needing deep technical knowledge.
                </p>

                <h3 className="text-lg font-semibold text-blue-950">Safety Tips</h3>
                <p className="text-blue-900 leading-relaxed">
                  Always double-check token names and symbols, and be careful when interacting with anything you don’t recognize.
                  If something looks unusual, take your time and verify before making decisions.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
