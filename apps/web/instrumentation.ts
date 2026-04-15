// Sprint 4 Epic 9 T66 — Next.js 15 instrumentation hook.
// `register()` runs once per runtime boot and dynamically imports the matching
// Sentry config. No-op in runtimes where NEXT_PUBLIC_SENTRY_DSN is empty because
// the config files themselves guard on DSN presence.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Next 15 looks up `onRequestError` from instrumentation.ts; Sentry ships
// `captureRequestError` with the exact expected signature.
export { captureRequestError as onRequestError } from '@sentry/nextjs'
