/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Frame-Options', value: 'DENY' },

  // Reduce content-type confusion attacks
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Control referrer leakage
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Permissions hardening (keep conservative; enable as needed)
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
    ].join(', '),
  },

  // A CSP that blocks third-party scripts by default.
  // Note: Next.js uses some inline scripts/styles for hydration; disallowing all inline scripts
  // typically requires a nonce-based CSP integrated with Next internals.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // No remote scripts allowed. Keep 'unsafe-inline' due to Next runtime/hydration.
      "script-src 'self' 'unsafe-inline'",
      // Tailwind/Next may inject styles; keep unsafe-inline.
      "style-src 'self' 'unsafe-inline'",
      // Images: allow self, data/blob for inline assets, and https for external explorers if ever used.
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // Allow API calls to your backend, Arkade server, and mempool explorers/APIs.
      // Include ws/wss for Socket.IO (restricted to known hosts; avoid blanket ws:/wss: in prod).
      [
        "connect-src 'self'",
        'https://arkade.computer',
        'https://www.arkvtxo.com',
        'https://arkvtxo.com',
        // Backend / indexer (Socket.IO uses wss:// in production)
        'https://arkvtxo.onrender.com',
        'wss://arkvtxo.onrender.com',
        'https://mempool.space',
        'https://mutinynet.com',
        ...(isDev ? ['http://localhost:3010', 'ws://localhost:3010'] : []),
      ].join(' '),
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(isDev ? [] : ['upgrade-insecure-requests']),
    ].join('; '),
  },
];

const nextConfig = {
  transpilePackages: ['@arkade-token/sdk'],
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
