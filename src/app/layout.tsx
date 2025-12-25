'use client';

import { useState } from 'react';
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import WalletHeader from "@/components/WalletHeader";
import WelcomeOverlay from "@/components/WelcomeOverlay";
import { ToastProvider } from "@/lib/toast";
import "@/lib/api"; // Initialize authenticated fetch globally
import { installConsoleLogGate } from "@/lib/debug";

installConsoleLogGate();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(true);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          <WelcomeOverlay
            open={showWelcomeOverlay}
            onGoToApp={() => setShowWelcomeOverlay(false)}
          />
          <WalletHeader />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
