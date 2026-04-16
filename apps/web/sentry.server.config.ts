// Sprint 4 Epic 9 T66 — Sentry Node (Next.js server) SDK config.
// Reads NEXT_PUBLIC_SENTRY_DSN then falls back to SENTRY_DSN (server-only
// var). Init is no-op when neither is set.
import * as Sentry from '@sentry/nextjs'
import { scrubEventPii } from './src/lib/sentry-pii'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN

const commitSha = process.env.VERCEL_GIT_COMMIT_SHA
const release = commitSha ? `s4.75-rbac-${commitSha.slice(0, 7)}` : undefined

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'dev',
    release,
    tracesSampleRate: 0.1,
    // H1 — never ship IP / cookies / headers unless explicitly opted in.
    sendDefaultPii: false,
    // H1 — strip email-shaped substrings from messages, exceptions, breadcrumbs.
    beforeSend: scrubEventPii,
  })
}
