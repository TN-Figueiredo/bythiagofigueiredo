import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // Transpile workspace package source directly so dev loop doesn't require
  // `npm run build` in packages/cms on every change. When the package is
  // extracted and published (Sprint 2 T14), this entry can be removed — the
  // published tarball ships pre-built dist/.
  transpilePackages: ['@tn-figueiredo/cms', '@tn-figueiredo/email'],

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

// Sprint 4 Epic 9 T66 — wrap with Sentry. No-op when SENTRY_AUTH_TOKEN/DSN are
// unset (dev/test); source map upload only happens on CI/Vercel builds.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Skip uploading source maps when no auth token is present (local dev).
  disableLogger: true,
})
