import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // TODO: [APP_NAME] Add Sentry integration when DSN is configured
  // import { withSentryConfig } from '@sentry/nextjs'

  // Transpile workspace package source directly so dev loop doesn't require
  // `npm run build` in packages/cms on every change. When the package is
  // extracted and published (Sprint 2 T14), this entry can be removed — the
  // published tarball ships pre-built dist/.
  transpilePackages: ['@tn-figueiredo/cms'],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
