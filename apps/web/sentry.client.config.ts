// Sprint 5a Track D — D14: Consent-aware Sentry client init.
//
// Sentry only initializes when the user has opted into analytics cookies.
// The authoritative flag is `localStorage['cookie_analytics_consent'] ===
// 'true'`, mirrored by <CookieBannerProvider /> from the richer
// `lgpd_consent_v1` payload so this file stays dependency-free and safe
// to execute in the early Next.js boot path.
//
// A `storage` listener re-runs the init flow when consent flips in
// another tab. De-duplication is handled via a module-level guard so we
// never wire the SDK twice in a single page session.
//
// Legal basis: error tracking could also be argued under LGPD Art. 7 VIII
// (legitimate interest) with a balancing test, but product chose the
// stricter opt-in path — see spec Section 4 v2 + privacy policy entry.
//
// Reads NEXT_PUBLIC_SENTRY_DSN only — server-only SENTRY_DSN is not
// available in the browser bundle.
import * as Sentry from '@sentry/nextjs'
import { scrubEventPii } from './src/lib/sentry-pii'

const ANALYTICS_CONSENT_KEY = 'cookie_analytics_consent'
let initialized = false

function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(ANALYTICS_CONSENT_KEY) === 'true'
  } catch {
    return false
  }
}

function initSentryIfConsented() {
  if (initialized) return
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return
  if (!hasAnalyticsConsent()) return

  const commitSha =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA
  const release = commitSha ? `s5a-lgpd-${commitSha.slice(0, 7)}` : undefined

  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? 'dev',
    release,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: scrubEventPii,
  })
  initialized = true
}

// First-run attempt on module load (runs in browser only).
if (typeof window !== 'undefined') {
  initSentryIfConsented()

  // Multi-tab sync — if another tab flips consent, re-run the init.
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== ANALYTICS_CONSENT_KEY) return
    initSentryIfConsented()
  })

  // Same-tab sync — <CookieBannerProvider /> dispatches a CustomEvent
  // after writing to localStorage so we don't rely exclusively on the
  // cross-tab storage event (which does not fire in the writing tab).
  window.addEventListener('lgpd:consent-changed', () => {
    initSentryIfConsented()
  })
}
