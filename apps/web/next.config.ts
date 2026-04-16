import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // @tn-figueiredo/cms ships ESM with `import.meta.url` (MDX renderer) +
  // preserved JSX — Next requires `transpilePackages` to parse both. This is
  // a permanent contract of cms v0.1.x (see packages docs). email is pure
  // Node and does not need the transform.
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

// Sprint 4 Epic 9 T66 — wrap with Sentry ONLY when the full source-map upload
// trifecta is configured (org + project + auth token). Without all three the
// `@sentry/nextjs` build plugin either no-ops loudly or attempts an upload
// that fails — neither is acceptable for local dev or branch builds without
// the secret. The runtime SDK (instrumentation.ts + sentry.*.config.ts) still
// initializes from NEXT_PUBLIC_SENTRY_DSN, so errors flow to Sentry in prod
// regardless; only source-map upload is gated here.
const sentryUploadEnabled =
  !!process.env.SENTRY_AUTH_TOKEN &&
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT

export default sentryUploadEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disableLogger: true,
    })
  : nextConfig
