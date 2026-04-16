// Sprint 5a Track D — D14 (revised in Sprint 5a ops audit):
// Split Sentry initialization into two tiers to reconcile the privacy
// policy (which frames error tracking as LGPD Art. 7 VIII "legítimo
// interesse") with the cookie-consent mechanism:
//
//   Tier 1 — always on (legitimate interest): Sentry.init() runs on every
//   page load with zero sampling for tracing and zero session replay. Only
//   errors are captured. The PII scrubber strips email/phone/CPF before
//   send.
//
//   Tier 2 — analytics consent required: when the user opts into the
//   `cookie_analytics_consent = 'true'` flag, we attach the browser
//   tracing integration (performance) and the replay integration
//   (Session Replay, mask-all-inputs). On consent withdrawal the replay
//   integration is stopped at runtime; tracing stays attached until the
//   next page load (where the module will re-init).
//
// The split fixes two auditor findings:
//   (a) Policy claimed Sentry runs on legitimate-interest basis, but the
//       old code gated the entire SDK on consent — contradiction.
//   (b) Policy listed "Sentry Replay" as an analytics cookie but the SDK
//       was never configured with Replay. Now it is, under consent.
//
// Reads NEXT_PUBLIC_SENTRY_DSN only — server-only SENTRY_DSN is not
// available in the browser bundle.
import * as Sentry from '@sentry/nextjs'
import { scrubEventPii } from './src/lib/sentry-pii'

const ANALYTICS_CONSENT_KEY = 'cookie_analytics_consent'

let coreInitialized = false
let analyticsAttached = false
let replayInstance: ReturnType<typeof Sentry.replayIntegration> | null = null

function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(ANALYTICS_CONSENT_KEY) === 'true'
  } catch {
    return false
  }
}

function initSentryCore(): void {
  if (coreInitialized) return
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  const commitSha =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA
  const release = commitSha ? `s5a-lgpd-${commitSha.slice(0, 7)}` : undefined

  // Legitimate-interest tier: errors only, no tracing, no replay.
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? 'dev',
    release,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    integrations: [],
    beforeSend: scrubEventPii,
  })
  coreInitialized = true
}

function attachAnalyticsIntegrations(): void {
  if (analyticsAttached) return
  const client = Sentry.getClient()
  if (!client) return

  try {
    client.addIntegration(Sentry.browserTracingIntegration())
  } catch {
    // tracing attach failure is non-fatal; errors still flow
  }

  try {
    replayInstance = Sentry.replayIntegration({
      maskAllInputs: true,
      maskAllText: false,
      blockAllMedia: false,
    })
    client.addIntegration(replayInstance)
    // Start capturing now that consent was granted.
    try {
      replayInstance.start()
    } catch {
      // best-effort
    }
  } catch {
    replayInstance = null
  }

  analyticsAttached = true
}

function detachReplayOnWithdrawal(): void {
  // Tracing stays attached until the next page load — but replay can be
  // stopped at runtime so no further session replays are captured in the
  // current page.
  if (replayInstance) {
    try {
      void replayInstance.stop()
    } catch {
      // best-effort
    }
  }
}

function syncConsentState(): void {
  if (!coreInitialized) return
  if (hasAnalyticsConsent()) {
    attachAnalyticsIntegrations()
  } else if (analyticsAttached) {
    detachReplayOnWithdrawal()
  }
}

if (typeof window !== 'undefined') {
  initSentryCore()
  syncConsentState()

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== ANALYTICS_CONSENT_KEY) return
    syncConsentState()
  })

  window.addEventListener('lgpd:consent-changed', () => {
    syncConsentState()
  })
}
