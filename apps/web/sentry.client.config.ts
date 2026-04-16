// Sprint 4 Epic 9 T66 — Sentry browser SDK config.
// Reads NEXT_PUBLIC_SENTRY_DSN only — Next.js does NOT expose non-prefixed
// env vars to the browser bundle, so SENTRY_DSN (server-only) cannot be
// used as a fallback here. Init is no-op when unset.
import * as Sentry from '@sentry/nextjs'
import { scrubEventPii } from './src/lib/sentry-pii'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? 'dev',
    // Errors only; performance tracing is Sprint 5+.
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: scrubEventPii,
  })
}
