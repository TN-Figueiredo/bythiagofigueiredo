// Sprint 4 Epic 9 T67 — Sentry init for Fastify.
// No-op when SENTRY_DSN is empty so dev/test environments don't emit events.
import * as Sentry from '@sentry/node'

let initialized = false

export function initSentry(): boolean {
  if (initialized) return true
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return false
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'dev',
    tracesSampleRate: 0.1,
  })
  initialized = true
  return true
}

export function isSentryInitialized(): boolean {
  return initialized
}

export { Sentry }
