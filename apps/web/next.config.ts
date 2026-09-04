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
    // Next 16 sobe o default para 4h; o YouTube reusa a mesma URL ao trocar thumbnail e o A/B Lab atribuiria a nota à variante errada. Preserva o comportamento do Next 15.
    minimumCacheTTL: 60,
  },
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

  turbopack: {
    resolveAlias: {
      // @tn-figueiredo/email@0.2.0 re-exporta adapters Resend/Svix/SMTP com import
      // estatico; os modulos nao existem (migramos para SES) e o Turbopack recusa
      // modulo ausente. Nenhum caminho vivo os executa. Conserto duravel: deps
      // opcionais/lazy no proprio pacote (achado do WP-6).
      resend: './src/stubs/absent-module.ts',
      svix: './src/stubs/absent-module.ts',
      nodemailer: './src/stubs/absent-module.ts',
    },
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
    // BTF-089b — the global CSP no longer lives here. It moved to
    // `src/lib/security/csp.ts` and is emitted by `src/middleware.ts` on every
    // response (rewrite targets like /site-not-configured, /site-error and
    // /cms/disabled included — the middleware produces those rewrites itself).
    // The middleware is what makes the nonce-based policy possible: it
    // generates a per-request nonce, sets it on the *request* headers so Next
    // tags its own inline scripts, and mirrors the policy on the response.
    // Rollout is staged via CSP_NONCE_ENABLED / CSP_NONCE_REPORT_ONLY (default
    // = legacy policy, byte-identical to the one that used to live here).
    //
    // IMPORTANT: do NOT re-add a global Content-Security-Policy header here.
    // Two enforced CSPs are applied as an intersection by browsers, which
    // would silently re-tighten (and likely break) the nonce policy.
    // The login-page `frame-ancestors 'none'` block below is safe: it is a
    // single-directive policy whose intersection with the global one is a
    // no-op (both already deny framing).
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
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // X-Frame-Options rides on every path EXCEPT /embed/waitlists/* (negative
      // lookahead). XFO has no "allow anyone" value, so the embed path must OMIT
      // the header entirely and rely on its CSP frame-ancestors (which, per the
      // CSP2 spec, obsoletes/overrides XFO anyway in every modern browser).
      {
        source: '/((?!embed/waitlists/).*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
      // The embed path's frame policy (frame-ancestors *) now lives in the
      // middleware CSP (src/lib/security/csp.ts — path-aware frameAncestors),
      // NOT here: a second CSP header would intersect with the middleware one.
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
