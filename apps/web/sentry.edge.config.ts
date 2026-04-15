// Sprint 4 Epic 9 T66 — Sentry Edge runtime SDK config (middleware, edge routes).
// Initialized only when NEXT_PUBLIC_SENTRY_DSN is set (empty string → no-op).
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'dev',
    tracesSampleRate: 0.1,
  })
}
