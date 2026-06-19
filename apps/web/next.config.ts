import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import createMDX from '@next/mdx'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: '*.ggpht.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: [
    '@aws-sdk/client-sesv2', 'sharp', 'canvas', '@napi-rs/canvas',
    'konva', '@atproto/api', '@opentelemetry/api',
    '@react-email/components', '@react-email/render',
  ],
  outputFileTracingIncludes: {
    '/api/mcp': ['./data/pipeline-docs/**/*'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    staleTimes: {
      dynamic: 15,
    },
    webpackMemoryOptimizations: true,
  },
  // Only packages that ship raw TypeScript or preserved JSX need transpilation.
  // @app/shared: raw TS (no build step). @tn-figueiredo/cms: ships .jsx in dist/.
  // @tn-figueiredo/links-admin: sub-path exports (qr-card-builder/*) reference src/.
  // All other @tn-figueiredo/* packages ship compiled JS from dist/ — no transpile needed.
  transpilePackages: ['@app/shared', '@tn-figueiredo/cms', '@tn-figueiredo/links-admin'],

  webpack(config) {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    }
    return config
  },

  // Sprint 5a Track E — enable .mdx as page/module file extensions so that
  // `import('@/content/legal/privacy.pt-BR.mdx')` works for the /privacy and
  // /terms legal pages. The MDX loader compiles MDX → React at build time,
  // same flow as @next/mdx default.
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'mdx'],

  async redirects() {
    return [
      { source: '/cms/posts', destination: '/cms/blog', permanent: true },
      { source: '/cms/posts/:id', destination: '/cms/blog/:id/edit', permanent: true },
      { source: '/cms/pipeline/blog_post', destination: '/cms/blog', permanent: true },
      { source: '/cms/pipeline', destination: '/cms/up-next', permanent: true },
      { source: '/cms/pipeline/video', destination: '/cms/video', permanent: true },
      { source: '/cms/pipeline/course', destination: '/cms/courses', permanent: true },
      { source: '/cms/pipeline/research', destination: '/cms/library/research', permanent: true },
      { source: '/cms/pipeline/reference', destination: '/cms/library/reference', permanent: true },
      { source: '/cms/pipeline/audio', destination: '/cms/library/audio', permanent: true },
      { source: '/cms/link-in-bio', destination: '/cms/links?tab=tree', permanent: true },
      { source: '/cms/linktree', destination: '/cms/links?tab=tree', permanent: true },
      { source: '/cms/linktree/analytics', destination: '/cms/links?tab=analytics', permanent: true },
    ]
  },

  async rewrites() {
    return {
      beforeFiles: [
        { source: '/cms/up-next', destination: '/cms/pipeline' },
        { source: '/cms/courses', destination: '/cms/pipeline/course' },
        { source: '/cms/library/research', destination: '/cms/pipeline/research' },
        { source: '/cms/library/reference', destination: '/cms/pipeline/reference' },
        { source: '/cms/library/audio', destination: '/cms/pipeline/audio' },
      ],
    }
  },

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
    // unsafe-eval is required by Next.js in development (hot-reload / source
    // maps) but MUST NOT ship to production builds.
    const isDev = process.env.NODE_ENV !== 'production'
    // BTF-089 (CSP hardening) — KNOWN TRADEOFF / TECH DEBT.
    // `script-src` keeps `'unsafe-inline'` in production. This weakens the
    // inline-XSS defense, but it is *deliberate and currently required*:
    // Next.js App Router emits inline bootstrap/hydration <script> tags
    // (flight payload, `self.__next_f`, route announcer) on every server
    // render. Without `'unsafe-inline'` the browser blocks them and the page
    // fails to hydrate.
    //
    // The correct fix is nonce-based CSP (per the official Next.js guide:
    // https://nextjs.org/docs/app/guides/content-security-policy — generate a
    // per-request nonce in middleware, set it on the *request* header so Next
    // injects it into its own scripts, and emit the CSP response header with
    // `'nonce-{value}'`). We are NOT doing that here because this project's
    // `src/middleware.ts` has ~13 distinct `NextResponse` return paths (dev
    // subdomain rewrite, go.* short-link rewrites, i18n `/pt/` rewrite, site
    // resolution, auth gating via `mergeSiteHeaders` which copies only a
    // whitelist of `x-*` headers). Threading a nonce reliably through *every*
    // one of those paths is required for correctness — miss one and that route
    // ships a CSP whose nonce doesn't match the injected scripts, breaking
    // hydration in production. That migration needs its own task with a real
    // `next build` + browser hydration verification gate (we can't run
    // `next build` cheaply here and a deploy freeze is active), so it is
    // tracked as dedicated debt rather than attempted blind.
    //
    // What IS hardened safely here (no hydration risk): `object-src 'none'`,
    // plus the pre-existing `base-uri 'self'`, `frame-ancestors 'none'`,
    // `form-action 'self'`.
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com"
      : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com"
    const globalCsp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://i.ytimg.com https://*.ggpht.com https://*.googleusercontent.com https://*.public.blob.vercel-storage.com https://*.giphy.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://challenges.cloudflare.com https://cloudflareinsights.com https://*.public.blob.vercel-storage.com https://*.giphy.com",
      "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
      "frame-src https://challenges.cloudflare.com https://www.youtube.com",
      // object-src 'none' blocks <object>/<embed>/<applet> — a classic XSS /
      // plugin vector. Zero hydration impact: Next never emits these.
      "object-src 'none'",
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
  extension: /\.mdx$/,
})

const finalConfig = withMDX(nextConfig)

export default sentryUploadEnabled
  ? withSentryConfig(finalConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disableLogger: true,
      sourcemaps: {
        disable: true,
      },
      autoInstrumentServerFunctions: false,
      autoInstrumentAppDirectory: false,
      autoInstrumentMiddleware: false,
    })
  : finalConfig
