import { z } from 'zod'

// ---------------------------------------------------------------------------
// Server-side env vars (never exposed to client bundles)
// ---------------------------------------------------------------------------
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  NEWSLETTER_FROM_DOMAIN: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  CAMPAIGN_PDF_SIGNED_URL_TTL: z.coerce.number().optional(),
  YOUTUBE_API_KEY: z.string().min(1).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  SENTRY_ORG: z.string().min(1).optional(),
  SENTRY_PROJECT: z.string().min(1).optional(),
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  LGPD_VERIFY_SECRET: z.string().min(1).optional(),
  // Dedicated HMAC key for unsubscribe links; falls back to CRON_SECRET when unset.
  UNSUBSCRIBE_TOKEN_SECRET: z.string().optional(),
  LGPD_CRON_SWEEP_ENABLED: z.string().optional(),
  // Waitlists operational flags (read via process.env directly in their routes; declared
  // here for schema parity). Both MUST stay unset in prod through Fase-1 — the retention
  // sweep is irreversible anonymization, and public signups are LGPD-gated until Fase-2.
  WAITLIST_RETENTION_SWEEP_ENABLED: z.string().optional(),
  WAITLIST_ACCEPT_PUBLIC_SIGNUPS: z.string().optional(),
  SEO_AI_CRAWLERS_BLOCKED: z.string().optional(),
  LINKS_SHORT_DOMAIN: z.string().optional(),
  GEO_PROVIDER: z.string().optional(),
  AD_GOOGLE_ENABLED: z.string().optional(),
  AD_TRACKING_ENABLED: z.string().optional(),
  AD_REVENUE_SYNC_ENABLED: z.string().optional(),
  AWS_SES_REGION: z.string().min(1),
  AWS_SES_ACCESS_KEY_ID: z.string().min(1),
  AWS_SES_SECRET_ACCESS_KEY: z.string().min(1),
  SES_DEFAULT_CONFIG_SET: z.string().optional(),
  SES_MARKETING_CONFIG_SET: z.string().optional(),
  // Transactional config-set for welcome/confirm mail — kept separate from the
  // marketing set so a bulk complaint spike can't degrade opt-in deliverability.
  SES_TRANSACTIONAL_CONFIG_SET: z.string().optional(),
  SNS_EXPECTED_TOPIC_ARN: z.string().optional(),
  // Real registered mailing address rendered in the email footer (CAN-SPAM).
  // When unset the footer omits the address line rather than showing a fake one.
  NEWSLETTER_POSTAL_ADDRESS: z.string().optional(),
  // Safety override: the newsletter send/welcome crons only send from the
  // production Vercel deployment. Set to '1' to permit a deliberate local send
  // (e.g. testing against a throwaway list). Leave unset everywhere else.
  ALLOW_LOCAL_NEWSLETTER_SEND: z.string().optional(),
  // Opt-in: enable the post-send delivery reconciliation alert. Only turn on
  // once the SES 'Delivery' event is wired to the SNS topic, else it false-alarms.
  NEWSLETTER_DELIVERY_RECONCILE: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Client-side env vars (NEXT_PUBLIC_* — available in both server and client)
// ---------------------------------------------------------------------------
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().min(1).optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
})

// ---------------------------------------------------------------------------
// Lazy initialization — parse on first access so build-time / codegen steps
// that import transitive modules don't blow up before env is populated.
// ---------------------------------------------------------------------------
let _serverEnv: z.infer<typeof serverSchema> | null = null
let _clientEnv: z.infer<typeof clientSchema> | null = null

function parseSchema<T>(schema: z.ZodType<T>, label: string): T {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`[env] invalid ${label} environment:\n${issues}`)
  }
  return parsed.data
}

/**
 * Validated server-side environment variables.
 * Parsed lazily on first access — throws if required vars are missing.
 */
export function getServerEnv(): z.infer<typeof serverSchema> {
  if (!_serverEnv) {
    _serverEnv = parseSchema(serverSchema, 'server')
  }
  return _serverEnv
}

/**
 * Validated client-side (NEXT_PUBLIC_*) environment variables.
 * Safe to call from both server and client code.
 */
export function getClientEnv(): z.infer<typeof clientSchema> {
  if (!_clientEnv) {
    _clientEnv = parseSchema(clientSchema, 'client')
  }
  return _clientEnv
}

// Re-export schemas for testing / type-narrowing
export { serverSchema, clientSchema }
