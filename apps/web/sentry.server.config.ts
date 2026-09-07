// Sprint 4 Epic 9 T66 — Sentry Node (Next.js server) SDK config.
// Reads NEXT_PUBLIC_SENTRY_DSN then falls back to SENTRY_DSN (server-only
// var). Init is no-op when neither is set.
import * as Sentry from '@sentry/nextjs'
import { scrubBreadcrumbPii, scrubEventPii } from './src/lib/sentry-pii'
import { registerSecretLiteral } from './src/lib/redact-secrets'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN

const commitSha = process.env.VERCEL_GIT_COMMIT_SHA
const release = commitSha ? `s4.75-rbac-${commitSha.slice(0, 7)}` : undefined

// C2 (§4): segredos estáticos que podem ecoar em exceções — parseSchema do
// env.ts imprime o valor, createDecipheriv imprime a chave. redact-secrets não
// lê process.env por si (é folha e testado como tal); o registro é aqui.
registerSecretLiteral(process.env.INSTAGRAM_APP_SECRET)
registerSecretLiteral(process.env.META_APP_SECRET)
registerSecretLiteral(process.env.SOCIAL_MASTER_KEY)

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'dev',
    release,
    tracesSampleRate: 0.1,
    // H1 — never ship IP / cookies / headers unless explicitly opted in.
    sendDefaultPii: false,
    // H1 — strip email/phone/CPF substrings from messages, exceptions,
    // breadcrumbs, and request headers/data.
    beforeSend: scrubEventPii,
    // C2: transaction events (10% of tracesSampleRate) carry http.client
    // spans with the full URL in description/data — without this, those
    // spans skip the scrubber entirely.
    beforeSendTransaction: scrubEventPii,
    beforeBreadcrumb: scrubBreadcrumbPii,
  })
}
