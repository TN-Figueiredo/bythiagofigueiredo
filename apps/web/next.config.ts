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
        hostname: 'yt3.ggpht.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
  serverExternalPackages: ['@aws-sdk/client-sesv2', 'sharp', 'canvas', '@napi-rs/canvas'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
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
    ]
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
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com"
      : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com"
    const globalCsp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://i.ytimg.com https://yt3.ggpht.com https://*.public.blob.vercel-storage.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://challenges.cloudflare.com https://cloudflareinsights.com https://*.public.blob.vercel-storage.com",
      "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
      "frame-src https://challenges.cloudflare.com https://www.youtube.com",
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
    })
  : finalConfig
