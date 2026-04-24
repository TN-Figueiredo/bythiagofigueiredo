import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import createMDX from '@next/mdx'

const nextConfig: NextConfig = {
  // @tn-figueiredo/cms v0.1.x ships ESM with `import.meta.url` (MDX renderer)
  // and preserved JSX. Next requires `transpilePackages` to parse both.
  // Contract: https://github.com/TN-Figueiredo/cms/blob/main/README.md#nextjs-configuration
  // The `/ring` subpath (used by middleware) is Edge-safe and does not need
  // transpilation — only the root `.` subpath (server components using
  // compileMdx, PostEditor, etc.) goes through here.
  // Since `@tn-figueiredo/admin@0.6.2`, the client primitives (SiteSwitcher,
  // SiteSwitcherProvider, useSiteSwitcher) live under `./site-switcher` with an
  // explicit `'use client'` banner in the published bundle — the consumer no
  // longer needs to add admin to `transpilePackages`.
  transpilePackages: ['@tn-figueiredo/cms', '@tn-figueiredo/cms-reader', '@tn-figueiredo/newsletter', '@tn-figueiredo/newsletter-admin', '@tn-figueiredo/cms-admin'],

  // Sprint 5a Track E — enable .mdx as page/module file extensions so that
  // `import('@/content/legal/privacy.pt-BR.mdx')` works for the /privacy and
  // /terms legal pages. The MDX loader compiles MDX → React at build time,
  // same flow as @next/mdx default.
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'mdx'],

  async headers() {
    const loginPaths = [
      '/admin/login',
      '/admin/forgot',
      '/admin/reset',
      '/cms/login',
      '/cms/forgot',
      '/cms/reset',
    ]
    const loginHeaders = loginPaths.map((source) => ({
      source,
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      ],
    }))
    // Sprint 4.75 Track B/B5 — global CSP. Next.js matches the FIRST header
    // block whose `source` matches; to guarantee the CSP rides on every route
    // (including the rewrite targets /site-not-configured, /site-error,
    // /cms/disabled) we register it under `/:path*` alongside the existing
    // baseline headers.
    const globalCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in https://o*.ingest.sentry.io",
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join('; ')
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
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: globalCsp,
          },
        ],
      },
      ...loginHeaders,
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

// Sprint 5a Track E — MDX wrapper for /privacy and /terms legal content.
// `withMDX` registers `.mdx` compilation via `@mdx-js/loader`. It must wrap
// before Sentry because Sentry's plugin also wraps the config.
const withMDX = createMDX({
  extension: /\.mdx?$/,
})

const finalConfig = withMDX(nextConfig)

export default sentryUploadEnabled
  ? withSentryConfig(finalConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disableLogger: true,
    })
  : finalConfig
