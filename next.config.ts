import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

// Content-Security-Policy: no third-party scripts; images from self + https (admin-provided item art).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self' https://steamcommunity.com",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

// Hosts allowed to use the DEV server besides localhost: Radmin VPN (26.x / 25.x), typical LAN ranges,
// plus DEV_ALLOWED_ORIGINS (comma-separated hostnames/IPs, no scheme/port).
const devOrigins = ['26.*.*.*', '25.*.*.*', '192.168.*.*', '10.*.*.*', '172.*.*.*', ...(process.env.DEV_ALLOWED_ORIGINS ?? '').split(',')]
  .map((s) => s.trim())
  .filter(Boolean)

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // Local art is SVG; CS2 skin images come pre-sized from Steam's CDN (…/360fx360f),
    // so server-side optimisation would only add latency and outbound traffic.
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          ...((process.env.APP_URL ?? '').startsWith('https://') ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
        ],
      },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
}

export default nextConfig
