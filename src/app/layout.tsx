'use client';

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import WalletHeader from "@/components/WalletHeader";
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
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          <WalletHeader />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
