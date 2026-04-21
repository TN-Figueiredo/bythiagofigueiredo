# Newsletter Ecosystem Extraction + Dual Email Provider Design

## Goal

Extract the Newsletter CMS Engine (built in Sprint 5e on `bythiagofigueiredo`) into reusable `@tn-figueiredo/*` packages in the `tnf-ecosystem` monorepo, add dual email provider support (Resend + SMTP/SES), and make the entire newsletter stack installable in any new project with `npm install` + <11 minutes of wiring.

## Architecture

Three new/updated packages in `~/Workspace/tnf-ecosystem/packages/`:

| Package | Version | Purpose |
|---|---|---|
| `@tn-figueiredo/email` | 0.2.0 | Multi-provider email service: Resend + SMTP + Brevo (legacy). Factory, adapters, webhook processors |
| `@tn-figueiredo/newsletter` | 0.1.0 | Core newsletter engine: types, interfaces, use cases (batch send, subscribe, webhooks, stats), content queue, migrations |
| `@tn-figueiredo/newsletter-admin` | 0.1.0 | CMS UI components: dashboard, editor, subscribers, settings, analytics, content queue. Default theme. |

### Why 3 packages

- **email** is cross-cutting infrastructure (used by newsletter, notifications, lgpd, contact forms). Adding providers here benefits all consumers.
- **newsletter** is domain logic (batch send, subscriber lifecycle, webhook processing, LGPD tracking). Server-only, zero React deps in the main entry.
- **newsletter-admin** is UI (React components with props). Follows the ecosystem pattern: `affiliate` / `affiliate-admin`, `billing` / `billing-admin`.

Mixing newsletter + UI into one package would force React + @react-email/components as dependencies for server-only consumers. Splitting follows established conventions.

### Dependency graph

```
newsletter-admin
  └── newsletter (peer)
        └── email (peer)
              └── (resend | nodemailer — optional peer deps per provider)
```

Consumers wire dependencies via constructor injection. No package imports another's concrete implementation.

---

## 1. `@tn-figueiredo/email@0.2.0` — Multi-Provider Email

### Migration context

The current `@tn-figueiredo/email@0.1.0` lives in a separate GitHub repo (`TN-Figueiredo/email`), not cloned locally. It exports only `BrevoEmailAdapter`. The in-app Resend adapter at `apps/web/lib/email/resend.ts` works around the package's `EmailResult.provider: 'brevo'` literal type with an unsafe cast.

This version migrates the package source into `tnf-ecosystem/packages/email`, adds Resend + SMTP adapters, widens the provider type, and adds webhook processors.

### File structure

```
packages/email/
  src/
    types.ts               — EmailMessage, EmailSender, EmailBranding, EmailProvider
    result.ts              — EmailResult { messageId: string; provider: EmailProvider }
    interfaces.ts          — IEmailService, IEmailTemplate, IWebhookProcessor
    errors.ts              — EmailSendError, EmailConfigError, WebhookVerificationError
    adapters/
      resend.ts            — ResendEmailAdapter implements IEmailService
      smtp.ts              — SmtpEmailAdapter implements IEmailService (nodemailer)
      brevo.ts             — BrevoEmailAdapter (preserved from 0.1.0, no changes)
    webhooks/
      resend-processor.ts  — ResendWebhookProcessor implements IWebhookProcessor (Svix)
      ses-processor.ts     — SesWebhookProcessor implements IWebhookProcessor (SNS)
    factory.ts             — createEmailService(config), createEmailServiceWithFallback(primary, fallback, opts?)
    templates/
      welcome.ts           — welcomeTemplate (preserved from 0.1.0)
      invite.ts            — inviteTemplate
      confirm-subscription.ts — confirmSubscriptionTemplate
      contact-received.ts  — contactReceivedTemplate
      contact-admin-alert.ts — contactAdminAlertTemplate
    registry.ts            — TemplateRegistry (preserved from 0.1.0)
    utils.ts               — emailLayout, emailButton, formatDatePtBR, escapeHtml
    token.ts               — ensureUnsubscribeToken
    index.ts               — barrel: all exports
    webhooks.ts            — barrel: webhook processors only (separate entry point)
  migrations/
    001_site_email_config.sql
  __tests__/
    resend-adapter.test.ts
    smtp-adapter.test.ts
    factory.test.ts
    resend-webhook.test.ts
    ses-webhook.test.ts
  tsup.config.ts
  vitest.config.ts
  package.json
  README.md
  CHANGELOG.md
```

### Types

```typescript
// types.ts
type EmailProvider = 'resend' | 'smtp' | 'brevo'

interface EmailSender { email: string; name: string }

interface EmailMessage {
  from: EmailSender
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  headers?: Record<string, string>
  metadata?: Record<string, unknown>
}

interface EmailBranding {
  brandName: string
  logoUrl?: string
  primaryColor?: string
  footerText?: string
  unsubscribeUrl?: string
}

// result.ts
interface EmailResult {
  messageId: string
  provider: EmailProvider
}
```

### Interfaces

```typescript
// interfaces.ts
interface IEmailService {
  send(msg: EmailMessage): Promise<EmailResult>
  sendTemplate<V extends Record<string, unknown>>(
    template: IEmailTemplate<V>,
    sender: EmailMessage['from'],
    to: string,
    variables: V,
    locale?: string,
    options?: { replyTo?: string; metadata?: Record<string, unknown> }
  ): Promise<EmailResult>
  handleWebhook?(payload: unknown, signature: string): Promise<EmailWebhookEvent[]>
}

interface IEmailTemplate<V> {
  name: string
  render(variables: V, locale: string): Promise<{ subject: string; html: string; text?: string }>
}

interface NormalizedWebhookEvent {
  messageId: string
  type: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'
  timestamp: string
  metadata?: {
    ip?: string
    userAgent?: string
    url?: string
    bounceType?: 'hard' | 'soft'
  }
}

interface IWebhookProcessor {
  verify(payload: unknown, headers: Record<string, string>): Promise<boolean>
  process(payload: unknown): Promise<NormalizedWebhookEvent[]>
}
```

### Provider configs and factory

```typescript
// factory.ts
type EmailProviderConfig =
  | { provider: 'resend'; apiKey: string }
  | { provider: 'smtp'; host: string; port: number; auth: { user: string; pass: string }; tls?: boolean; pool?: boolean; maxConnections?: number }
  | { provider: 'brevo'; apiKey: string }

function createEmailService(config: EmailProviderConfig): IEmailService

interface FallbackOptions {
  shouldFallback?: (error: Error) => boolean  // default: any error triggers fallback
  onFallback?: (error: Error, fromProvider: string, toProvider: string) => void
}

function createEmailServiceWithFallback(
  primary: EmailProviderConfig,
  fallback: EmailProviderConfig,
  opts?: FallbackOptions
): IEmailService
```

The fallback wrapper: calls `primary.send()`, if it throws and `shouldFallback(err)` returns true, calls `fallback.send()`. The `onFallback` hook enables observability (Sentry/metrics).

### ResendEmailAdapter

```typescript
class ResendEmailAdapter implements IEmailService {
  constructor(apiKey: string)
  
  async send(msg: EmailMessage): Promise<EmailResult>
  // Wraps `resend` npm package (v6.x)
  // Maps msg.headers to Resend headers param
  // Returns { messageId: data.id, provider: 'resend' }
  
  async sendTemplate<V>(template, sender, to, variables, locale?, options?): Promise<EmailResult>
  // Renders template, then calls send()
}
```

Peer dependency: `resend@^6.0.0`

### SmtpEmailAdapter

```typescript
class SmtpEmailAdapter implements IEmailService {
  constructor(config: SmtpConfig)
  // Uses nodemailer createTransport with pool mode:
  // { pool: true, maxConnections: config.maxConnections ?? 5, maxMessages: 100 }
  // TLS default true
  
  async send(msg: EmailMessage): Promise<EmailResult>
  // Returns { messageId: info.messageId, provider: 'smtp' }
  
  async sendTemplate<V>(template, sender, to, variables, locale?, options?): Promise<EmailResult>
  
  async close(): Promise<void>
  // Closes the connection pool. Consumer should call on shutdown.
}
```

Peer dependency: `nodemailer@^6.0.0`

### Webhook processors

**ResendWebhookProcessor:**
```typescript
class ResendWebhookProcessor implements IWebhookProcessor {
  constructor(signingSecret: string)
  // Uses svix@1.x for HMAC signature verification
  
  async verify(payload, headers): Promise<boolean>
  // Verifies svix-id, svix-timestamp, svix-signature headers
  
  async process(payload): Promise<NormalizedWebhookEvent[]>
  // Maps Resend event types:
  //   email.delivered → delivered
  //   email.opened → opened (with ip, userAgent from metadata)
  //   email.clicked → clicked (with url)
  //   email.bounced → bounced (bounceType from payload)
  //   email.complained → complained
  //   email.delivery_delayed → ignored (returns [])
}
```

Peer dependency: `svix@^1.0.0`

**SesWebhookProcessor:**
```typescript
class SesWebhookProcessor implements IWebhookProcessor {
  constructor()
  // No signing secret needed — SNS uses X.509 certificate verification
  
  async verify(payload, headers): Promise<boolean>
  // Verifies SNS message signature via SigningCertURL certificate chain
  // Validates TopicArn matches expected pattern
  // Checks message age (reject messages older than 1 hour)
  
  async handleSubscriptionConfirmation(payload: unknown): Promise<void>
  // Auto-confirms SNS topic subscription by fetching SubscribeURL
  
  async process(payload): Promise<NormalizedWebhookEvent[]>
  // SNS wraps SES events in Notification messages
  // Maps SES event types:
  //   Delivery → delivered
  //   Open → opened (with ip, userAgent)
  //   Click → clicked (with url)
  //   Bounce (Permanent) → bounced { bounceType: 'hard' }
  //   Bounce (Transient) → bounced { bounceType: 'soft' }
  //   Complaint → complained
}
```

No additional peer deps (uses native `crypto` for signature verification + `fetch` for cert retrieval).

### Provider-specific webhook degradation

| Provider | Webhooks | Tracking |
|---|---|---|
| Resend | Svix (full) | delivered, opened, clicked, bounced, complained |
| SMTP via SES | SNS (full) | delivered, opened, clicked, bounced, complained |
| SMTP generic | None | Only `sent` status — no delivery confirmation |

When a consumer uses generic SMTP (not SES), the analytics page should show "Delivery tracking unavailable — your SMTP provider does not support webhooks." The `newsletter-admin` analytics component handles this via a `trackingAvailable` prop.

### Migration: `001_site_email_config.sql`

```sql
CREATE TABLE IF NOT EXISTS site_email_config (
  site_id        uuid PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  active_provider text NOT NULL DEFAULT 'resend'
    CHECK (active_provider IN ('resend', 'smtp', 'brevo')),
  fallback_provider text
    CHECK (fallback_provider IS NULL OR fallback_provider IN ('resend', 'smtp', 'brevo')),
  smtp_from_domain  text,
  monthly_sends     int NOT NULL DEFAULT 0,
  monthly_limit     int,
  reset_at          timestamptz NOT NULL DEFAULT date_trunc('month', now()) + interval '1 month',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Atomic increment for monthly counter
CREATE OR REPLACE FUNCTION increment_monthly_sends(p_site_id uuid, p_count int DEFAULT 1)
RETURNS int
LANGUAGE sql
AS $$
  UPDATE site_email_config
  SET monthly_sends = CASE
    WHEN reset_at <= now() THEN p_count
    ELSE monthly_sends + p_count
  END,
  reset_at = CASE
    WHEN reset_at <= now() THEN date_trunc('month', now()) + interval '1 month'
    ELSE reset_at
  END,
  updated_at = now()
  WHERE site_id = p_site_id
  RETURNING monthly_sends;
$$;

-- RLS: staff can read/write their site's config
ALTER TABLE site_email_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_email_config" ON site_email_config;
CREATE POLICY "staff_manage_email_config" ON site_email_config
  FOR ALL USING (public.can_edit_site(site_id));
```

No secrets in DB. Provider selection + usage tracking only. Credentials live in env vars.

### Backward compatibility (0.1.0 → 0.2.0)

| Export | Status |
|---|---|
| `BrevoEmailAdapter` | Preserved, no changes |
| `IEmailService` | Preserved, `handleWebhook` stays optional |
| `IEmailTemplate` | Preserved |
| `EmailResult.provider` | `'brevo'` → `'resend' \| 'smtp' \| 'brevo'` — BREAKING for type narrowing |
| `TemplateRegistry` | Preserved |
| All 5 templates | Preserved |
| `ensureUnsubscribeToken` | Preserved |
| `emailLayout`, `emailButton`, utils | Preserved |

Breaking change rationale: pre-1.0 minor bump (0.1→0.2) is semver-legal for breaking changes. All existing consumers of `EmailResult.provider === 'brevo'` need to handle the wider union. In practice, only `bythiagofigueiredo` consumes this package, and it already uses `'resend' as unknown as 'brevo'` cast — the fix is to remove the cast.

### package.json

```json
{
  "name": "@tn-figueiredo/email",
  "version": "0.2.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./webhooks": {
      "import": { "types": "./dist/webhooks.d.ts", "default": "./dist/webhooks.js" },
      "require": { "types": "./dist/webhooks.d.cts", "default": "./dist/webhooks.cjs" }
    }
  },
  "files": ["dist", "migrations"],
  "publishConfig": { "registry": "https://npm.pkg.github.com", "access": "public" },
  "dependencies": {
    "debug": "^4.3.0",
    "p-queue": "^8.0.0",
    "zod": "^3.23.0"
  },
  "peerDependencies": {
    "@supabase/supabase-js": "^2.103.0",
    "resend": "^6.0.0",
    "nodemailer": "^6.0.0",
    "svix": "^1.0.0"
  },
  "peerDependenciesMeta": {
    "resend": { "optional": true },
    "nodemailer": { "optional": true },
    "svix": { "optional": true }
  },
  "devDependencies": {
    "tsup": "*",
    "typescript": "^5.3.0",
    "vitest": "^4.0.0",
    "@types/nodemailer": "^6.0.0"
  }
}
```

All provider-specific deps are optional peers. Consumer only installs what they use.

### tsup.config.ts

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    webhooks: 'src/webhooks.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['resend', 'nodemailer', 'svix', '@supabase/supabase-js'],
})
```

---

## 2. `@tn-figueiredo/newsletter@0.1.0` — Core Engine

### File structure

```
packages/newsletter/
  src/
    types.ts
    interfaces.ts
    errors.ts
    config.ts
    use-cases/
      send-edition.ts
      schedule-edition.ts
      process-webhook.ts
      subscribe.ts
      confirm-subscription.ts
      unsubscribe.ts
      refresh-stats.ts
      anonymize-tracking.ts
    content-queue/
      slots.ts
      types.ts
    templates/
      newsletter.tsx
      components/
        email-header.tsx
        email-footer.tsx
    utils/
      parse-user-agent.ts
    supabase/
      newsletter-repo.ts
      subscriber-repo.ts
    index.ts
    templates.ts           — separate entry for React Email templates
  migrations/
    001_newsletter_types_extend.sql
    002_newsletter_editions.sql
    003_newsletter_sends_clicks_webhooks.sql
    004_newsletter_rpcs.sql
    005_newsletter_rls.sql
    006_blog_cadence.sql
    007_consent_texts_seed.sql
  __tests__/
    helpers/
      in-memory-newsletter-repo.ts
      in-memory-subscriber-repo.ts
      mock-email-service.ts
    send-edition.test.ts
    subscribe.test.ts
    confirm-subscription.test.ts
    unsubscribe.test.ts
    process-webhook.test.ts
    slots.test.ts
    parse-user-agent.test.ts
  tsup.config.ts
  vitest.config.ts
  package.json
  README.md
  CHANGELOG.md
```

### Types

```typescript
// types.ts
type EditionStatus = 'draft' | 'ready' | 'queued' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled'
type SubscriptionStatus = 'pending_confirmation' | 'confirmed' | 'unsubscribed' | 'bounced' | 'complained'
type SendStatus = 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'
type Segment = 'all' | 'high_engagement' | 're_engagement' | 'new_subscribers'

interface NewsletterType {
  id: string
  locale: string
  name: string
  tagline?: string
  cadence_days: number
  color: string
  active: boolean
  sort_order: number
  preferred_send_time: string
  cadence_start_date?: string
  cadence_paused: boolean
  last_sent_at?: string
  sender_name: string
  sender_email: string
  reply_to?: string
  max_bounce_rate_pct: number
}

interface Edition {
  id: string
  site_id: string
  newsletter_type_id: string
  subject: string
  preheader?: string
  content_mdx?: string
  content_html?: string
  status: EditionStatus
  segment: Segment
  slot_date?: string
  scheduled_at?: string
  sent_at?: string
  send_count: number
  stats_delivered: number
  stats_opens: number
  stats_clicks: number
  stats_bounces: number
  stats_complaints: number
  stats_unsubs: number
  stats_stale: boolean
  test_sent_at?: string
  created_by?: string
  created_at: string
  updated_at: string
}

interface Subscriber {
  id: string
  site_id: string
  email: string
  status: SubscriptionStatus
  newsletter_id?: string
  locale?: string
  tracking_consent: boolean
  confirmed_at?: string
  unsubscribed_at?: string
}

interface Send {
  id: string
  edition_id: string
  subscriber_email: string
  resend_message_id?: string
  status: SendStatus
  delivered_at?: string
  opened_at?: string
  open_ip?: string
  open_user_agent?: string
  clicked_at?: string
  bounce_type?: string
  created_at: string
}

interface ClickEvent {
  id: string
  send_id: string
  url: string
  ip?: string
  user_agent?: string
  clicked_at: string
}

interface SendReport {
  editionId: string
  total: number
  sent: number
  skipped: number
  errors: number
  bounceRate: number
  aborted: boolean
  abortReason?: string
}
```

### Interfaces

```typescript
// interfaces.ts
interface INewsletterRepository {
  getEdition(id: string): Promise<Edition | null>
  claimEditionForSend(id: string): Promise<Edition | null>
  // CAS: UPDATE SET status='sending' WHERE status='scheduled' RETURNING *
  
  updateEditionStatus(id: string, status: EditionStatus, extra?: Partial<Edition>): Promise<void>
  
  upsertSend(editionId: string, email: string): Promise<Send>
  // ON CONFLICT (edition_id, subscriber_email) DO NOTHING
  
  markSendDelivered(messageId: string, deliveredAt: string): Promise<void>
  markSendOpened(messageId: string, ip?: string, userAgent?: string): Promise<void>
  markSendClicked(messageId: string, url: string, ip?: string, userAgent?: string): Promise<void>
  markSendBounced(messageId: string, bounceType: string): Promise<void>
  markSendComplained(messageId: string): Promise<void>
  
  insertClickEvent(sendId: string, url: string, ip?: string, userAgent?: string): Promise<void>
  
  getStaleEditions(): Promise<Edition[]>
  refreshStats(editionId: string): Promise<void>
  
  recordWebhookEvent(svixId: string, eventType: string): Promise<boolean>
  // Returns true if inserted (new), false if duplicate
  
  anonymizeTrackingOlderThan(days: number): Promise<{ sends: number; clicks: number }>
  purgeWebhookEventsOlderThan(days: number): Promise<number>
}

interface ISubscriberRepository {
  getActiveSubscribers(siteId: string, typeId: string, opts?: {
    segment?: Segment
    limit?: number
    offset?: number
  }): Promise<Subscriber[]>
  
  getSubscriberCount(siteId: string, typeId: string): Promise<number>
  
  findByEmail(siteId: string, email: string): Promise<Subscriber | null>
  findByEmailHash(siteId: string, emailHash: string): Promise<Subscriber | null>
  
  subscribe(input: {
    siteId: string
    email: string
    newsletterId?: string
    locale?: string
    ip?: string
    userAgent?: string
    consentVersion: string
    tokenHash: string
    expiresAt: string
  }): Promise<{ id: string; isNew: boolean }>
  
  confirmSubscription(tokenHash: string): Promise<
    | { ok: true; subscriberId: string; already?: boolean }
    | { ok: false; reason: 'not_found' | 'expired' }
  >
  
  unsubscribe(tokenHash: string): Promise<
    | { ok: true; siteId: string; subscriberId: string; already?: boolean }
    | { ok: false; reason: 'not_found' }
  >
  
  updateStatus(siteId: string, email: string, status: SubscriptionStatus, newsletterId?: string): Promise<void>
  
  checkRateLimit(siteId: string, ip: string, email: string): Promise<boolean>
  // true = allowed, false = rate-limited
  
  ensureUnsubscribeToken(siteId: string, email: string): Promise<{ rawToken: string; tokenHash: string }>
  // Generates crypto.randomUUID(), stores sha256(rawToken) in unsubscribe_tokens table
  // If row already exists for (site_id, email), reads existing hash and generates new raw token
  // (token is re-generated each call — only the hash is persisted; caller builds the unsubscribe URL)
}

interface NewsletterConfig {
  fromDomain: string
  batchSize?: number           // default 100
  throttleMs?: number          // default 50
  maxBounceRatePct?: number    // default 5
  appUrl?: string              // for unsubscribe/archive links
}

interface NewsletterContainer {
  config: NewsletterConfig
  emailService: IEmailService
  repository: INewsletterRepository
  subscriberRepo: ISubscriberRepository
  onError?: (err: Error, ctx: Record<string, unknown>) => void
  onMetric?: (name: string, value: number, tags: Record<string, string>) => void
}
```

### Use cases

**SendEditionUseCase** — the core batch send engine:

```typescript
class SendEditionUseCase {
  constructor(private container: NewsletterContainer)
  
  async execute(editionId: string, opts?: { dryRun?: boolean }): Promise<SendReport>
  // 1. claimEditionForSend (CAS: scheduled→sending)
  // 2. Fetch newsletter type (sender info, bounce threshold)
  // 3. Fetch active subscribers for type + segment
  // 4. For each subscriber batch (batchSize):
  //    a. Ensure unsubscribe token exists
  //    b. Render React Email template with Newsletter component
  //    c. Upsert send row (crash recovery: skip if resend_message_id exists)
  //    d. Call emailService.send() with RFC 8058 headers:
  //       List-Unsubscribe: <mailto:unsub@{fromDomain}?subject=unsubscribe>, <{appUrl}/api/newsletters/unsubscribe?token={hash}>
  //       List-Unsubscribe-Post: List-Unsubscribe=One-Click
  //    e. Update send row with messageId
  //    f. Throttle (throttleMs)
  //    g. Check bounce rate mid-batch — abort if > maxBounceRatePct
  // 5. Update edition: status='sent', sent_at, send_count
  // 6. Update newsletter type: last_sent_at
  // 7. Return SendReport
  // Error handling: onError callback, individual send failures don't abort batch
}
```

**SubscribeUseCase:**
```typescript
class SubscribeUseCase {
  constructor(private container: NewsletterContainer)
  
  async execute(input: {
    siteId: string
    email: string
    newsletterId?: string
    locale?: string
    ip?: string
    userAgent?: string
    consentVersion: string
  }): Promise<{ status: 'ok' | 'rate_limited' | 'error'; message?: string }>
  // 1. Validate email format
  // 2. Rate limit check
  // 3. Check existing (raw email + sha256 hash for anonymized re-subscribe)
  // 4. Insert or rotate token (24h expiry)
  // 5. Send confirmation email via emailService
  // 6. Return status (always 'ok' for existing confirmed — no oracle)
}
```

**ProcessWebhookUseCase:**
```typescript
class ProcessWebhookUseCase {
  constructor(private container: NewsletterContainer)
  
  async execute(events: NormalizedWebhookEvent[]): Promise<void>
  // For each event:
  // 1. Dedup via recordWebhookEvent (svixId or messageId)
  // 2. Route by type:
  //    delivered → markSendDelivered
  //    opened → markSendOpened (respects tracking_consent)
  //    clicked → markSendClicked + insertClickEvent
  //    bounced → markSendBounced + updateSubscriberStatus (if hard bounce)
  //    complained → markSendComplained + updateSubscriberStatus
  // 3. Mark edition stats_stale=true
}
```

Other use cases (`ScheduleEditionUseCase`, `ConfirmSubscriptionUseCase`, `UnsubscribeUseCase`, `RefreshStatsUseCase`, `AnonymizeTrackingUseCase`) follow the same pattern: constructor DI, single `execute()` method, uses repository interface.

### Content queue — pure functions

```typescript
// content-queue/types.ts
interface CadenceConfig {
  cadenceDays: number
  startDate: string        // ISO date
  lastSentAt: string | null
  paused: boolean
}

interface SlotOptions {
  today: string            // ISO date
  count: number            // how many slots to generate
}

// content-queue/slots.ts
function generateSlots(config: CadenceConfig, opts: SlotOptions): string[]
// Pure function. Zero deps. Computes next N slot dates from cadence config.
// If paused, returns [].
// If lastSentAt exists, next slot = lastSentAt + cadenceDays.
// If no lastSentAt, next slot = max(startDate, today).
// Skips slots in the past.
```

### React Email templates (separate entry point)

```typescript
// templates/newsletter.tsx
import { Html, Head, Body, Container, Preview, Section } from '@react-email/components'
import { EmailHeader } from './components/email-header'
import { EmailFooter } from './components/email-footer'

interface NewsletterTemplateProps {
  subject: string
  preheader?: string
  contentHtml: string
  typeName: string
  typeColor: string
  unsubscribeUrl: string
  archiveUrl?: string
  trackingPixelUrl?: string
}

export function Newsletter(props: NewsletterTemplateProps): React.ReactElement
```

Exported via `./templates` subpath so consumers not using React Email don't pull in the dependency.

### Supabase implementations

```typescript
// supabase/newsletter-repo.ts
class SupabaseNewsletterRepository implements INewsletterRepository {
  constructor(private supabase: SupabaseClient)
  // All methods map to Supabase queries against the tables defined in migrations
}

// supabase/subscriber-repo.ts
class SupabaseSubscriberRepository implements ISubscriberRepository {
  constructor(private supabase: SupabaseClient)
}
```

### Utils

```typescript
// utils/parse-user-agent.ts
function parseUserAgent(ua: string): { client: string; device: 'desktop' | 'mobile' | 'tablet' | 'unknown' }
// Lightweight regex-based parser for email client identification
// Apple Mail, Gmail, Outlook, Thunderbird, Yahoo, Samsung, etc.
```

### Testing strategy

In-memory repository implementations for pure unit testing:

```typescript
// __tests__/helpers/in-memory-newsletter-repo.ts
class InMemoryNewsletterRepository implements INewsletterRepository {
  private editions = new Map<string, Edition>()
  private sends = new Map<string, Send>()
  // Full in-memory implementation — no DB needed
}

// __tests__/helpers/mock-email-service.ts
class MockEmailService implements IEmailService {
  sent: EmailMessage[] = []
  async send(msg: EmailMessage) {
    this.sent.push(msg)
    return { messageId: `mock-${this.sent.length}`, provider: 'resend' as const }
  }
}
```

Tests cover:
- `SendEditionUseCase`: happy path, crash recovery (skip sent), bounce threshold abort, dry run
- `SubscribeUseCase`: new sub, re-subscribe after anonymization, rate limit, duplicate
- `ProcessWebhookUseCase`: each event type, dedup, tracking consent gating
- `generateSlots`: cadence math, paused, past slots, no lastSentAt
- `parseUserAgent`: client identification matrix

### Migrations

The 7 migration files contain the complete SQL schema. All are idempotent (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`). The migrations in this package cover:

1. `newsletter_types` column additions (cadence, sender, color, etc.)
2. `newsletter_editions` table + indexes
3. `newsletter_sends`, `newsletter_click_events`, `webhook_events` tables + indexes
4. RPCs: `confirm_newsletter_subscription`, `unsubscribe_via_token`, `newsletter_rate_check`, `refresh_newsletter_stats`
5. RLS policies for all tables
6. `blog_cadence` table for content queue
7. `consent_texts` seed entries (examples — consumer customizes)

Consumer copies these to `supabase/migrations/` with appropriate sequential numbering.

### package.json

```json
{
  "name": "@tn-figueiredo/newsletter",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./templates": {
      "import": { "types": "./dist/templates.d.ts", "default": "./dist/templates.js" },
      "require": { "types": "./dist/templates.d.cts", "default": "./dist/templates.cjs" }
    }
  },
  "files": ["dist", "migrations"],
  "publishConfig": { "registry": "https://npm.pkg.github.com", "access": "public" },
  "dependencies": {
    "debug": "^4.3.0",
    "zod": "^3.23.0"
  },
  "peerDependencies": {
    "@supabase/supabase-js": "^2.103.0",
    "@tn-figueiredo/email": "^0.2.0",
    "@react-email/components": ">=0.0.30",
    "@react-email/render": ">=1.0.0"
  },
  "peerDependenciesMeta": {
    "@react-email/components": { "optional": true },
    "@react-email/render": { "optional": true }
  }
}
```

---

## 3. `@tn-figueiredo/newsletter-admin@0.1.0` — CMS UI

### File structure

```
packages/newsletter-admin/
  src/
    index.ts               — server-safe barrel (types only)
    client.ts              — 'use client' barrel (all React components)
    components/
      newsletter-dashboard.tsx
      edition-editor.tsx
      edition-analytics.tsx
      subscriber-list.tsx
      newsletter-settings.tsx
      content-queue.tsx
      email-provider-settings.tsx
    hooks/
      use-autosave-edition.ts
    theme/
      default.ts
      types.ts
    types.ts               — component prop types
  __tests__/
    newsletter-dashboard.test.tsx
    theme.test.ts
  tsup.config.ts
  vitest.config.ts
  package.json
  README.md
  CHANGELOG.md
```

### Component prop types

All components receive data and actions via props — no direct data fetching. The consumer (Next.js page) fetches data and passes it down.

```typescript
// types.ts
interface NewsletterDashboardProps {
  types: NewsletterType[]
  editions: Edition[]
  filters: { type?: string; status?: string }
  onNewEdition: () => void
  theme?: Partial<NewsletterTheme>
}

interface EditionEditorProps {
  edition: Edition
  newsletterType: NewsletterType
  previewUrl: string
  onSave: (patch: Partial<Edition>) => Promise<{ ok: boolean; error?: string }>
  onSchedule: (scheduledAt: string) => Promise<{ ok: boolean; error?: string }>
  onCancel: () => Promise<{ ok: boolean; error?: string }>
  onSendTest: () => Promise<{ ok: boolean; error?: string }>
  onAssignSlot: (slotDate: string) => Promise<{ ok: boolean; error?: string }>
  theme?: Partial<NewsletterTheme>
}

interface EditionAnalyticsProps {
  edition: Edition
  sends: Send[]
  clickEvents: ClickEvent[]
  trackingAvailable: boolean    // false for generic SMTP
  theme?: Partial<NewsletterTheme>
}

interface SubscriberListProps {
  subscribers: Subscriber[]
  total: number
  page: number
  pageSize: number
  statusFilter?: SubscriptionStatus
  onPageChange: (page: number) => void
  onStatusFilter: (status?: SubscriptionStatus) => void
  theme?: Partial<NewsletterTheme>
}

interface NewsletterSettingsProps {
  types: NewsletterType[]
  emailConfig?: SiteEmailConfig
  onUpdateCadence: (typeId: string, patch: Partial<NewsletterType>) => Promise<{ ok: boolean }>
  onUpdateEmailProvider: (config: Partial<SiteEmailConfig>) => Promise<{ ok: boolean }>
  onTestConnection: () => Promise<{ ok: boolean; latencyMs?: number; error?: string }>
  theme?: Partial<NewsletterTheme>
}

interface ContentQueueProps {
  backlog: Array<{ id: string; title: string; status: string; locale?: string }>
  scheduled: Array<{ id: string; title: string; slotDate: string; type: 'blog' | 'newsletter' }>
  cadences: Array<{ locale: string; cadenceDays: number; paused: boolean }>
  onAssignSlot: (id: string, slotDate: string) => Promise<void>
  onUnslot: (id: string) => Promise<void>
  onPublishNow: (id: string) => Promise<void>
  theme?: Partial<NewsletterTheme>
}
```

### Default theme

```typescript
// theme/types.ts
interface NewsletterTheme {
  colors: {
    primary: string
    primaryHover: string
    surface: string
    border: string
    text: string
    textMuted: string
    success: string
    error: string
    warning: string
    info: string
  }
  radius: string
  classes: {
    card: string
    badge: string
    buttonPrimary: string
    buttonSecondary: string
    buttonDanger: string
    table: string
    tableHeader: string
    input: string
    select: string
  }
}

// theme/default.ts
const defaultNewsletterTheme: NewsletterTheme = {
  colors: {
    primary: '#ea580c',
    primaryHover: '#c2410c',
    surface: '#ffffff',
    border: '#e5e7eb',
    text: '#111827',
    textMuted: '#6b7280',
    success: '#16a34a',
    error: '#dc2626',
    warning: '#d97706',
    info: '#2563eb',
  },
  radius: '0.5rem',
  classes: {
    card: 'rounded-lg border p-4 hover:border-orange-400 transition-colors',
    badge: 'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
    buttonPrimary: 'rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700',
    buttonSecondary: 'rounded-md bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200',
    buttonDanger: 'rounded-md bg-red-100 px-3 py-1.5 text-sm text-red-700 hover:bg-red-200',
    table: 'w-full text-sm',
    tableHeader: 'border-b text-left text-gray-500',
    input: 'rounded border px-3 py-2 text-sm w-full',
    select: 'rounded border px-3 py-1.5 text-sm',
  },
}
```

Consumer overrides any theme value:
```typescript
<NewsletterDashboard
  types={types}
  editions={editions}
  filters={filters}
  onNewEdition={handleNew}
  theme={{ colors: { primary: '#2563eb' } }}  // blue instead of orange
/>
```

### package.json

```json
{
  "name": "@tn-figueiredo/newsletter-admin",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./client": {
      "import": { "types": "./dist/client.d.ts", "default": "./dist/client.js" },
      "require": { "types": "./dist/client.d.cts", "default": "./dist/client.cjs" }
    }
  },
  "files": ["dist"],
  "publishConfig": { "registry": "https://npm.pkg.github.com", "access": "public" },
  "peerDependencies": {
    "react": "^19.0.0",
    "@tn-figueiredo/newsletter": "^0.1.0"
  }
}
```

---

## 4. Provider Toggle — Admin Settings

### Design

Provider selection stored in `site_email_config` table (from email package migration). No secrets in DB — only which provider is active and the monthly usage counter.

**CMS Settings UI flow:**

1. Admin goes to `/cms/newsletters/settings`
2. "Email Provider" section shows:
   - Active: `Resend` / `SMTP` radio buttons
   - Fallback: `None` / `Resend` / `SMTP` dropdown
   - Monthly limit (optional, for auto-switch)
   - "Test Connection" button (calls `emailService.send()` with a test message to admin's own email)
3. Save updates `site_email_config` row
4. No redeploy needed — next send reads the DB config

**Consumer wiring (in Next.js app):**

```typescript
// apps/web/lib/email/service.ts
import { createEmailService, createEmailServiceWithFallback } from '@tn-figueiredo/email'

const providers = {
  resend: () => createEmailService({ provider: 'resend', apiKey: process.env.RESEND_API_KEY! }),
  smtp: () => createEmailService({
    provider: 'smtp',
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  }),
}

export async function getEmailServiceForSite(siteId: string): Promise<IEmailService> {
  const config = await getSiteEmailConfig(siteId)
  
  // Auto-switch: if monthly limit reached and fallback configured
  if (config.monthly_limit && config.monthly_sends >= config.monthly_limit && config.fallback_provider) {
    const fb = providers[config.fallback_provider]
    if (fb) return fb()
  }
  
  const primary = providers[config.active_provider]
  if (!primary) throw new Error(`Email provider '${config.active_provider}' not configured`)
  
  if (config.fallback_provider) {
    const fallback = providers[config.fallback_provider]
    if (fallback) {
      return createEmailServiceWithFallback(
        { provider: config.active_provider, ...getProviderCredentials(config.active_provider) },
        { provider: config.fallback_provider, ...getProviderCredentials(config.fallback_provider) },
        { onFallback: (err, from, to) => Sentry.captureMessage(`Email fallback: ${from}→${to}`, { extra: { err } }) }
      )
    }
  }
  
  return primary()
}
```

### Auto-switch flow

```
0-3000 emails/month: Resend (free)
         │
         │ monthly_sends >= monthly_limit (3000)
         ▼
3001+: Auto-switch to SMTP (SES, ~$0.10/1k)
         │
         │ 1st of next month: reset_at triggers counter reset
         ▼
0: Back to Resend
```

The `increment_monthly_sends` RPC atomically increments the counter and auto-resets when `reset_at` has passed — no external cron needed.

---

## 5. Consumer Setup Experience

### For bythiagofigueiredo (existing, post-extraction)

1. `npm install @tn-figueiredo/email@0.2.0 @tn-figueiredo/newsletter@0.1.0 @tn-figueiredo/newsletter-admin@0.1.0`
2. Delete local files replaced by packages (lib/email/resend.ts, lib/content-queue/slots.ts, lib/newsletter/stats.ts, src/emails/*)
3. Update imports to point to packages
4. Refactor cron routes to use `SendEditionUseCase`, `AnonymizeTrackingUseCase`, etc.
5. Refactor CMS pages to use `newsletter-admin` components
6. Refactor webhook route to use `ResendWebhookProcessor` + `ProcessWebhookUseCase`

### For a new project (fresh install)

| Step | Time | Action |
|---|---|---|
| Install packages | 30s | `npm install @tn-figueiredo/email @tn-figueiredo/newsletter @tn-figueiredo/newsletter-admin` |
| Copy migrations | 2min | Copy 8 SQL files from `node_modules/*/migrations/` to `supabase/migrations/` |
| Apply migrations | 1min | `npx supabase db push` |
| Create cron routes | 3min | 3 files: send-scheduled, anonymize-tracking, purge-webhooks (copy from README examples) |
| Create webhook route | 1min | 1 file (copy from README example) |
| Wire CMS pages | 3min | Import components from newsletter-admin/client, wrap in server components |
| Set env vars | 30s | `RESEND_API_KEY` or `SMTP_*` |
| Create newsletter type | 30s | Via CMS admin UI |
| **Total** | **~11min** | |

### README quickstart pattern

Each package README includes a "Quick Start" section with complete copy-paste code blocks. The newsletter README includes a "Next.js Wiring Guide" section showing exactly how to create the cron routes, webhook handler, and CMS pages.

---

## 6. Migration Path: email package source

The current `@tn-figueiredo/email@0.1.0` lives in `TN-Figueiredo/email` repo (not cloned locally). Plan:

1. Clone `TN-Figueiredo/email` to `~/Workspace/`
2. Copy `src/` contents into `tnf-ecosystem/packages/email/src/`
3. Restructure: move `BrevoEmailAdapter` to `adapters/brevo.ts`, keep all other files
4. Add new files: `adapters/resend.ts`, `adapters/smtp.ts`, `webhooks/`, `factory.ts`
5. Update `package.json` to v0.2.0 with new exports and peer deps
6. Build + test + publish from tnf-ecosystem
7. Archive the old `TN-Figueiredo/email` repo (add deprecation notice pointing to tnf-ecosystem)
8. Update all consumers (`bythiagofigueiredo`, `tonagarantia`) to `@tn-figueiredo/email@0.2.0`

---

## 7. Open Decisions

1. **CMS package migration** — `@tn-figueiredo/cms` currently in separate repo. Should it migrate to tnf-ecosystem in a future sprint? Recommended: yes, Sprint 7+.

2. **SMTP DKIM signing** — nodemailer supports DKIM via config. Should the SmtpEmailAdapter support it? Recommended: yes, optional config field `dkim?: { domainName, keySelector, privateKey }`.

3. **CLI scaffolder** — `npx @tn-figueiredo/newsletter init` to auto-generate routes/pages. Recommended: defer to v0.2.0, README examples sufficient for v0.1.0.

---

## 8. Non-Goals

- Email template visual editor (Unlayer, etc.) — out of scope, content stays as MDX
- A/B testing extraction — stays in bythiagofigueiredo until proven needed by second consumer
- Push notification integration — that's `@tn-figueiredo/notifications`, different domain
- Self-hosted SMTP server (Postfix/Haraka) — SES via SMTP is sufficient
