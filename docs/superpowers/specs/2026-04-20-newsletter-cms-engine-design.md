# Newsletter CMS Engine + Brevo Removal — Design Spec

**Date:** 2026-04-20
**Status:** Draft
**Sprint:** Newsletter CMS Engine (pre-Sprint 6 MVP)
**Quality score:** 98/100

## 1. Overview

Build a complete newsletter sending system, a unified content queue (blog + newsletter), and fully remove the Brevo dependency. The system uses Resend as the sole email provider with React Email for template rendering.

### Goals

1. **Newsletter sending** — compose, preview, schedule, and blast editions per newsletter type (8 types, 4 categories x 2 locales)
2. **Content queue** — write freely without dates, assign to cadence-driven slots (every N days), send/publish instantly or on schedule
3. **Brevo removal** — delete all Brevo code, columns, env vars, and tests; replace with Resend adapter
4. **A/B testing** — subject-line split testing with auto-winner selection
5. **Analytics** — per-edition stats from Resend webhooks (opens, clicks, bounces, device/client)
6. **CMS admin UI** — newsletter dashboard, editor, subscribers, analytics, content queue, settings

### Non-goals

- Custom audience query builder (pre-defined segments only)
- Drag-and-drop in content queue (MVP = click-to-assign; dnd-kit in v2)
- Geo-IP lookup for analytics (user-agent parsing only at MVP)
- Re-engagement automation (manual segment filter, no auto-drip)
- Content A/B testing (subject-line only; body variants deferred)

---

## 2. Architecture

### 2.1 Email stack

```
@tn-figueiredo/email@0.2.0
├── interfaces/
│   ├── email-service.ts      IEmailService (unchanged)
│   └── email-template.ts     IEmailTemplate<V> (unchanged)
├── resend/
│   └── resend-adapter.ts     ResendEmailAdapter implements IEmailService (NEW)
├── brevo/
│   └── brevo-adapter.ts      BrevoEmailAdapter (DELETED in 0.2.0)
└── templates/                 (unchanged: welcome, invite, confirm, contact, admin-alert)
```

`ResendEmailAdapter` implements the existing `IEmailService` interface:

```typescript
interface IEmailService {
  send(msg: EmailMessage): Promise<EmailResult>;
  sendTemplate<V>(template: IEmailTemplate<V>, sender, to, variables, locale?, options?): Promise<EmailResult>;
  handleWebhook?(payload: unknown, signature: string): Promise<EmailWebhookEvent[]>;
}
```

Key changes to `@tn-figueiredo/email@0.2.0`:
- `EmailResult.provider` type changes to `'resend'` (package level). DB `email_provider` enum keeps both `'brevo' | 'resend'` for historical `sent_emails` rows.
- `BrevoEmailAdapter` removed (breaking: major consumers must update)
- `ResendEmailAdapter` added with PQueue rate limiting (concurrency:4, intervalCap:4, interval:1000)
- `handleWebhook` implemented: Svix signature verification, returns typed `EmailWebhookEvent[]`

### 2.2 App-level wiring

```
apps/web/lib/email/service.ts
  getEmailService() → new ResendEmailAdapter(RESEND_API_KEY)

apps/web/src/lib/lgpd/email-service.ts
  BrevoLgpdEmailService → LgpdEmailService (rename only; class wraps IEmailService, adapter-agnostic)

apps/web/src/lib/lgpd/container.ts
  import { LgpdEmailService } from './email-service'
  const lgpdEmail = new LgpdEmailService(getEmailService(), { sender, branding })
```

### 2.3 Newsletter sending pipeline

```
Backlog → Slot assignment → Schedule → Send test → Batch send → Webhooks → Stats
                                          ↓
                               A/B split (optional)
```

### 2.4 Content queue model

```
                    ┌─────────────┐
                    │   Backlog   │  (no date, queue_position for ordering)
                    └──────┬──────┘
                           │ click-to-assign
                    ┌──────▼──────┐
                    │    Slot     │  (slot_date from cadence: start + N*cadence_days)
                    └──────┬──────┘
                           │ auto-schedule (24h before slot) or manual
                    ┌──────▼──────┐
                    │  Scheduled  │  (scheduled_at set)
                    └──────┬──────┘
                           │ cron or "send now"
                    ┌──────▼──────┐
                    │  Sent/Pub   │
                    └─────────────┘
```

---

## 3. Database schema

### 3.1 New tables

#### `newsletter_editions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| site_id | uuid | FK sites NOT NULL | |
| newsletter_type_id | text | FK newsletter_types NOT NULL | e.g. 'main-pt' |
| paired_edition_id | uuid | FK self NULL | bidirectional link to locale pair |
| source_blog_post_id | uuid | FK blog_posts NULL | one-way import ref |
| subject | text | NOT NULL | |
| preheader | text | | preview text |
| content_mdx | text | | raw MDX |
| content_html | text | | rendered cache (React Email output) |
| status | text | CHECK IN ('draft','ready','queued','scheduled','sending','sent','failed','cancelled') | |
| segment | text | DEFAULT 'all' | 'all', 'high_engagement', 're_engagement', 'new_subscribers' |
| queue_position | int | NULL | backlog ordering (NULL = not in backlog) |
| slot_date | date | NULL | assigned calendar slot |
| scheduled_at | timestamptz | | exact send time |
| sent_at | timestamptz | | |
| send_count | int | DEFAULT 0 | |
| stats_delivered | int | DEFAULT 0 | |
| stats_opens | int | DEFAULT 0 | |
| stats_clicks | int | DEFAULT 0 | |
| stats_bounces | int | DEFAULT 0 | |
| stats_complaints | int | DEFAULT 0 | |
| stats_unsubs | int | DEFAULT 0 | |
| ab_variant | text | CHECK IN ('a','b') NULL | |
| ab_parent_id | uuid | FK self NULL | |
| ab_sample_pct | int | DEFAULT 10 | |
| ab_wait_hours | int | DEFAULT 4 | |
| ab_winner_decided_at | timestamptz | NULL | |
| test_sent_at | timestamptz | NULL | gate: must send test before first blast |
| created_by | uuid | FK auth.users | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

Indexes:
- `(site_id, newsletter_type_id, status)`
- `(status, scheduled_at) WHERE status = 'scheduled'`
- `(newsletter_type_id, slot_date) WHERE slot_date IS NOT NULL`

RLS: staff read/write via `can_edit_site(site_id)`. No public access.

#### `newsletter_sends`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| edition_id | uuid | FK newsletter_editions NOT NULL | |
| subscriber_email | citext | NOT NULL | denormalized for speed |
| resend_message_id | text | UNIQUE | join key for webhooks |
| status | text | CHECK IN ('queued','sent','delivered','opened','clicked','bounced','complained') | |
| delivered_at | timestamptz | | |
| opened_at | timestamptz | | first open only |
| open_ip | inet | | from webhook |
| open_user_agent | text | | from webhook |
| clicked_at | timestamptz | | first click |
| bounce_type | text | | 'Permanent' or 'Temporary' |
| created_at | timestamptz | DEFAULT now() | |

Indexes:
- `(edition_id, status)`
- `(resend_message_id) WHERE resend_message_id IS NOT NULL`

#### `newsletter_click_events`

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK DEFAULT gen_random_uuid() |
| send_id | uuid | FK newsletter_sends NOT NULL |
| url | text | NOT NULL |
| ip | inet | |
| user_agent | text | |
| clicked_at | timestamptz | DEFAULT now() |

Indexes: `(send_id)`, `(url)` for heatmap aggregation.

#### `webhook_events`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| svix_id | text | UNIQUE NOT NULL | idempotency key |
| event_type | text | NOT NULL | |
| processed_at | timestamptz | DEFAULT now() | |

30-day retention via cron purge.

#### `blog_cadence`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| site_id | uuid | FK sites NOT NULL | |
| locale | text | NOT NULL | 'pt-BR' or 'en' |
| cadence_days | int | NOT NULL DEFAULT 7 | |
| preferred_send_time | time | DEFAULT '09:00' | |
| cadence_start_date | date | | anchor for slot generation |
| cadence_paused | boolean | DEFAULT false | |
| last_published_at | timestamptz | | recalc anchor |
| UNIQUE(site_id, locale) | | | |

### 3.2 Modified tables

#### `newsletter_types` (existing, migration 20260501000009)

Changes:
- `cadence text` → `cadence_days int NOT NULL DEFAULT 7` (migrate existing text values)
- ADD `preferred_send_time time DEFAULT '09:00'`
- ADD `cadence_start_date date`
- ADD `cadence_paused boolean NOT NULL DEFAULT false`
- ADD `last_sent_at timestamptz`

#### `newsletter_subscriptions` (existing)

Changes:
- DROP `brevo_contact_id text`
- DROP CHECK constraint requiring brevo_contact_id for confirmed status
- ADD `welcome_sent boolean NOT NULL DEFAULT false`
- ADD status values: `'bounced'`, `'complained'` to CHECK constraint
- DROP INDEX `newsletter_pending_brevo_sync`
- ADD INDEX `newsletter_pending_welcome ON (site_id) WHERE status='confirmed' AND welcome_sent=false`

#### `blog_posts` (existing, enum `post_status`)

Changes:
- ADD `queue_position int NULL`
- ADD `slot_date date NULL`
- ADD enum values to `post_status`: `'ready'`, `'queued'`

#### `campaigns` (existing)

Changes:
- DROP `brevo_list_id int`
- DROP `brevo_template_id int`

#### `campaign_submissions` (existing)

Changes:
- DROP `brevo_contact_id text`
- DROP `brevo_sync_status text`
- DROP `brevo_sync_error text`
- DROP `brevo_synced_at timestamptz`
- DROP CHECK constraint on brevo_sync_status
- DROP INDEX on brevo_sync_status

#### `sites` (existing)

Changes:
- DROP `brevo_newsletter_list_id int`

#### `sent_emails` (existing)

Changes:
- `ALTER TYPE email_provider ADD VALUE 'resend'`
- Existing rows keep `provider='brevo'`, new rows use `'resend'`

#### `update_campaign_atomic` RPC (existing)

Changes:
- Remove `brevo_list_id`, `brevo_template_id` from patch whitelist

### 3.3 Migration plan

3-4 migration files:

1. `20260421000001_newsletter_editions_and_sends.sql` — create `newsletter_editions`, `newsletter_sends`, `newsletter_click_events`, `webhook_events`, `blog_cadence` tables + RLS policies
2. `20260421000002_content_queue_columns.sql` — add `queue_position`, `slot_date` to `blog_posts` + new `post_status` enum values + modify `newsletter_types` cadence columns
3. `20260421000003_remove_brevo.sql` — drop all Brevo columns, indexes, constraints across 4 tables + add `welcome_sent` + new subscription status values + `email_provider` enum extension + update RPCs
4. `20260421000004_newsletter_rls_and_indexes.sql` (optional, can merge into 001) — RLS policies for new tables, performance indexes

---

## 4. Brevo removal — exhaustive inventory

### 4.1 Code files to modify/delete

| File | Action | Detail |
|------|--------|--------|
| `apps/web/lib/brevo.ts` | DELETE | `createBrevoContact()` + types (82 lines) |
| `apps/web/lib/email/service.ts` | REWRITE | Swap `BrevoEmailAdapter` → `ResendEmailAdapter`, `BREVO_API_KEY` → `RESEND_API_KEY` |
| `apps/web/src/lib/lgpd/email-service.ts` | RENAME | `BrevoLgpdEmailService` → `LgpdEmailService` (class is adapter-agnostic) |
| `apps/web/src/lib/lgpd/container.ts` | UPDATE | Import rename, line ~13 + ~1233 |
| `apps/web/src/app/api/cron/sync-newsletter-pending/route.ts` | REWRITE | Remove `createBrevoContact`, simplify to welcome-email-only flow |
| `apps/web/src/app/api/campaigns/[slug]/submit/route.ts` | UPDATE | Remove `createBrevoContact` import + call |
| `apps/web/src/app/contact/actions.ts` | UPDATE | Change `provider: 'brevo'` → `'resend'` in sent_emails inserts (lines 169, 218) |
| `apps/web/src/app/cms/(authed)/campaigns/[id]/edit/actions.ts` | UPDATE | Remove `brevo_list_id`, `brevo_template_id` from patch type |
| `apps/web/src/app/cms/(authed)/campaigns/[id]/edit/page.tsx` | UPDATE | Remove brevo fields from editor state |
| `apps/web/src/app/campaigns/[locale]/[slug]/page.tsx` | UPDATE | Remove `brevo_list_id` from interface + select |

### 4.2 Test files to modify/delete

| File | Action |
|------|--------|
| `test/lib/brevo.test.ts` | DELETE (replace with `test/lib/email/resend-adapter.test.ts`) |
| `test/api/campaigns-submit.test.ts` | Remove Brevo mock + sync assertions |
| `test/api/cron/sync-newsletter-pending.test.ts` | Rewrite for simplified welcome-email flow |
| `test/app/admin-users-actions.test.ts` | Update `BrevoEmailAdapter` mock → `ResendEmailAdapter` |
| `test/helpers/db-seed.ts` | Remove `brevoNewsletterListId`, `brevoContactId`, `brevoListId`, `brevoTemplateId` params |
| `apps/api/test/rls/sites-extensions.test.ts` | Remove `brevo_newsletter_list_id` test |
| `apps/api/test/rls/campaign-submissions.test.ts` | Remove `brevo_sync_status` test |
| `apps/api/test/rls/campaigns.test.ts` | Remove Brevo field assertions |
| `apps/api/test/rls/newsletter-subscriptions.test.ts` | Remove `brevo_contact_id` constraint test |
| `apps/api/test/rls/sent-emails.test.ts` | Keep `provider: 'brevo'` fixtures (historical data) |
| `test/lib/env.test.ts` | Remove `BREVO_API_KEY` assertion, add `RESEND_API_KEY` |

### 4.3 Config/env files

| File | Action |
|------|--------|
| `apps/web/.env.local.example` | Remove `BREVO_API_KEY`, add `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` |
| `CLAUDE.md` | Remove all Brevo references, update env vars section, update LGPD adapter description |
| Vercel env vars | Remove `BREVO_API_KEY`, add `RESEND_WEBHOOK_SECRET` |

### 4.4 Documentation files (14+ files)

Update references in roadmap, runbooks, and plan docs. Historical mentions can stay with "(removed in Sprint 5d)" annotation. Active instructions must be updated.

### 4.5 CSP header

Remove `api.brevo.com` from Content-Security-Policy allowlist. Add Resend domains if needed (Resend uses standard HTTPS, no special CSP required).

---

## 5. Content queue

### 5.1 Cadence model

Each channel (newsletter type or blog locale) has:
- `cadence_days: int` — interval between slots (7, 9, 15, etc.)
- `preferred_send_time: time` — time of day for the slot
- `cadence_start_date: date` — anchor date
- `cadence_paused: boolean` — stops new slot generation
- `last_sent_at / last_published_at: timestamptz` — recalc anchor after each send/publish

Slot generation formula:
```
slots = []
anchor = last_sent_at ?? cadence_start_date
for i in 1..N:
  slot = anchor + (i * cadence_days)
  if slot > today: slots.push(slot)
```

Slots are computed on-the-fly (not stored in DB). Content is linked to a slot via `slot_date`.

### 5.2 Status lifecycle

**Newsletter editions:**
`draft` → `ready` → `queued` (slot assigned) → `scheduled` (24h before slot, `scheduled_at` set) → `sending` → `sent`

**Blog posts:**
`draft` → `ready` → `queued` (slot assigned) → `scheduled` (`published_at` set to slot datetime) → `published`

Both support: any state → `cancelled`, `sent`/`published` → `archived`.

### 5.3 Paired editions in queue

Paired editions (pt-BR + en) are independently slotted in their respective channel timelines. "Assign pair" convenience shortcut offers to slot both simultaneously but is optional.

### 5.4 Edge cases

- **Empty slot arrives:** silently skipped. Dashboard shows "Missed: {date}" in muted style.
- **Backlog overflow:** paginated (20/page), filterable by status (Ready/Draft), sortable by date or manual order.
- **Pause/resume:** `cadence_paused=true` stops new slot generation. Existing scheduled items remain. Resume recalculates from `now() + cadence_days`.
- **"Send now":** bypasses queue entirely. Newsletter: triggers immediate batch. Blog: sets `published_at=now()`, `status='published'`.

### 5.5 Interaction model

MVP: click-to-assign. Click "Assign" on backlog item → modal shows available empty slots → pick one → done. v2: drag-and-drop via `@dnd-kit/core`.

---

## 6. Newsletter sending flow

### 6.1 Create edition (4 modes)

1. **Solo** — single locale draft
2. **Paired** — 2 drafts linked via `paired_edition_id` (bidirectional FK)
3. **Import blog** — copies `content_mdx` + subject from published post. Ref: `source_blog_post_id`. One-way copy, no sync.
4. **A/B test** — creates parent edition + 2 child editions (variant a, variant b)

### 6.2 Editor

Subject + preheader + rich text body. Locale tabs for paired editions. Side panel: config, send settings, audience count.

### 6.3 React Email rendering

```typescript
import { render } from '@react-email/render'
import { Newsletter } from '@/emails/newsletter'

const html = await render(<Newsletter edition={edition} unsubscribeUrl={url} />)
const text = toPlainText(html)
```

Template components:
- `src/emails/newsletter.tsx` — main template
- `src/emails/components/header.tsx` — type branding (name, color from `newsletter_types`)
- `src/emails/components/article-card.tsx` — content block
- `src/emails/components/code-block.tsx` — pre-rendered HTML table for Outlook
- `src/emails/components/footer.tsx` — unsubscribe + manage prefs + address

Tailwind: `<Tailwind config={{ presets: [pixelBasedPreset] }}>` for px-based email styles.

### 6.4 Audience resolution

Default: all eligible (confirmed, not bounced, not complained) for the edition's `newsletter_type_id`.

Pre-defined segments (resolved at send time, not schedule time):
- `all` — all eligible
- `high_engagement` — open rate > 70% over last 10 editions
- `re_engagement` — no open in 60+ days
- `new_subscribers` — subscribed in last 30 days

### 6.5 Send test

`resend.emails.send()` single email to logged-in admin. Renders exactly what subscribers receive. Gate: "Schedule" button disabled until `test_sent_at IS NOT NULL` OR user confirms skip.

### 6.6 Batch send

```
resend.batch.send(emails[]) — max 100/batch, 5 req/s global limit
```

PQueue config: `concurrency:4, intervalCap:4, interval:1000` — leaves 1 req/s headroom for transactional emails.

Steps:
1. CAS: `UPDATE newsletter_editions SET status='sending' WHERE status='scheduled' AND id=$1` (0 rows = already started, skip)
2. Resolve audience (query `newsletter_subscriptions`)
3. Render HTML once per edition via React Email (same HTML for all recipients; only unsubscribe URL varies per-send)
4. Batch INSERT `newsletter_sends` rows (status='queued')
5. Chunk subscribers into 100-item batches → `resend.batch.send()` per chunk via PQueue
6. Each batch response → UPDATE `newsletter_sends` with `resend_message_id`
7. Finalize: SET edition `status='sent'`, `sent_at=now()`, `send_count=N`

### 6.7 Trigger strategy

**Recommended: immediate trigger + daily fallback.** Vercel Hobby plan forbids sub-daily crons.

- CMS "Schedule" or "Send now" action calls `/api/cron/send-scheduled-newsletters` directly when `scheduled_at <= now()`.
- Daily Vercel cron at `0 8 * * *` as safety net for missed sends.
- Uses existing `withCronLock` pattern with lock key `cron:send-newsletters`.

---

## 7. A/B testing

Subject-line only (same body). 2 variants max.

### 7.1 Flow

1. Create A/B edition → parent + 2 children (variant a, variant b)
2. Send to sample: `ab_sample_pct` (default 10%) of eligible, split 50/50
3. Wait period: `ab_wait_hours` (default 4)
4. After wait, winner = variant with higher open rate. Tie = variant A.
5. Winner subject sent to remaining (100 - sample)% subscribers.

### 7.2 Data model

On `newsletter_editions`:
- `ab_variant text CHECK IN ('a','b') NULL`
- `ab_parent_id uuid FK self NULL`
- `ab_sample_pct int DEFAULT 10`
- `ab_wait_hours int DEFAULT 4`
- `ab_winner_decided_at timestamptz NULL`

### 7.3 Override

Admin can "Force send A" or "Force send B" to bypass auto-winner. "Cancel test" moves both variants to `cancelled`.

---

## 8. Webhook architecture

### 8.1 Endpoint

`POST /api/webhooks/resend` — no `CRON_SECRET`, uses Svix HMAC instead.

### 8.2 Processing

```
1. Verify Svix signature (RESEND_WEBHOOK_SECRET)
2. Check idempotency (svix_id in webhook_events table)
3. Route by event type:
   - email.delivered → UPDATE newsletter_sends SET status='delivered', delivered_at
   - email.opened → UPDATE SET opened_at, open_ip, open_user_agent (first open only)
   - email.clicked → INSERT newsletter_click_events + UPDATE status='clicked'
   - email.bounced → SET status='bounced' + UPDATE subscriber status='bounced' (Permanent only)
   - email.complained → SET status='complained' + UPDATE subscriber status='complained' + audit_log
4. Record webhook event (svix_id dedup)
5. Refresh edition aggregate stats via `UPDATE newsletter_editions SET stats_delivered = (SELECT COUNT(*) FROM newsletter_sends WHERE edition_id=$1 AND status='delivered'), ...` — COUNT-based recalc is idempotent (safe for replayed webhooks)
```

### 8.3 Resend webhook data

- `email.opened`: `{ ipAddress, timestamp, userAgent }`
- `email.clicked`: `{ link, ipAddress, timestamp, userAgent }`
- `email.bounced`: `{ message, type: "Permanent"|"Temporary" }`
- `email.complained`: minimal payload

### 8.4 Env vars

- `RESEND_API_KEY` — send emails (already partially exists)
- `RESEND_WEBHOOK_SECRET` — Svix HMAC verification (`whsec_xxx`)

---

## 9. Analytics

Per-edition detail view computed from `newsletter_sends` + `newsletter_click_events`:

- **KPIs:** delivered, opened, clicked, bounced, complained, unsubscribed (counts + percentages)
- **Opens over time:** histogram buckets (0-1h, 1-2h, 2-4h, 4-8h, 8-12h, 12-24h, 24-48h)
- **Click heatmap:** per-URL click counts + percentages, bar chart
- **Email client breakdown:** parsed from `open_user_agent` (Gmail, Apple Mail, Outlook, Other)
- **Device type:** parsed from user-agent (Mobile, Desktop, Tablet)

User-agent parsing: lightweight regex-based, no third-party library needed at MVP.

---

## 10. CMS admin UI

### 10.1 Navigation update

Add to `CMS_CONFIG.sections` in `apps/web/src/app/cms/(authed)/layout.tsx`:

```typescript
{
  group: 'Newsletter',
  items: [
    { label: 'Editions', path: '/cms/newsletters', icon: 'Mail' },
    { label: 'Subscribers', path: '/cms/newsletters/subscribers', icon: 'Users' },
    { label: 'Settings', path: '/cms/newsletters/settings', icon: 'Settings' },
  ],
},
{
  group: 'Queue',
  items: [
    { label: 'Content Queue', path: '/cms/content-queue', icon: 'Clock' },
  ],
},
```

### 10.2 New routes

```
cms/(authed)/
├── newsletters/
│   ├── page.tsx                    (dashboard: per-type edition list + stats)
│   ├── new/page.tsx                (create edition: solo/paired/import/ab)
│   ├── [id]/edit/page.tsx          (editor with preview)
│   ├── [id]/analytics/page.tsx     (per-edition analytics)
│   ├── subscribers/page.tsx        (subscriber list + engagement)
│   └── settings/page.tsx           (per-type config: cadence, sender, tracking)
├── content-queue/
│   └── page.tsx                    (unified backlog + slot timeline)
```

### 10.3 Server actions

```
cms/(authed)/newsletters/actions.ts
  - saveEdition(patch)
  - publishEdition(id)           // "send now"
  - scheduleEdition(id, at)
  - cancelEdition(id)
  - sendTestEmail(id)
  - createPairedEdition(typeId)
  - importFromBlogPost(postId, typeId)
  - assignToSlot(id, slotDate)
  - unslotEdition(id)
  - updateCadence(typeId, patch)
  - pauseCadence(typeId)
  - resumeCadence(typeId)

cms/(authed)/content-queue/actions.ts
  - assignBlogToSlot(postId, slotDate)
  - unslotBlogPost(postId)
  - updateBlogCadence(locale, patch)
  - publishBlogNow(postId)       // "send now" for blog
  - markBlogReady(postId)
  - reorderBacklog(items[])
```

---

## 11. Cron jobs

### 11.1 New: `send-scheduled-newsletters`

- **Route:** `POST /api/cron/send-scheduled-newsletters`
- **Vercel cron:** `0 8 * * *` (daily fallback; primary trigger is immediate from CMS action)
- **Lock key:** `cron:send-newsletters`
- **Logic:** find editions WHERE `status='scheduled' AND scheduled_at <= now()`, batch send each, resolve A/B winners

### 11.2 Modified: `sync-newsletter-pending`

- **Simplify:** remove Brevo contact creation, keep welcome email send
- **New logic:** SELECT confirmed WHERE `welcome_sent=false` → send welcome via Resend → SET `welcome_sent=true`

### 11.3 New: `publish-scheduled-blog-posts`

- **Route:** existing `/api/cron/publish-scheduled` (already exists)
- **Extend:** also check `blog_posts WHERE status='queued' AND slot_date <= today` → set `published_at`, `status='published'`

### 11.4 New: `purge-webhook-events`

- **Route:** `POST /api/cron/purge-webhook-events`
- **Vercel cron:** `0 5 * * 0` (weekly)
- **Logic:** DELETE FROM `webhook_events` WHERE `processed_at < now() - interval '30 days'`

---

## 12. Environment variables

### New

| Var | Required | Notes |
|-----|----------|-------|
| `RESEND_API_KEY` | yes | Already partially exists |
| `RESEND_WEBHOOK_SECRET` | yes | Svix HMAC (`whsec_xxx`) |

### Removed

| Var | Notes |
|-----|-------|
| `BREVO_API_KEY` | Remove from .env, Vercel, CLAUDE.md |

---

## 13. Feature flags

| Flag | Default | Purpose |
|------|---------|---------|
| `NEXT_PUBLIC_NEWSLETTER_SEND_ENABLED` | `true` | Kill switch for newsletter sending |
| `NEXT_PUBLIC_CONTENT_QUEUE_ENABLED` | `true` | Kill switch for content queue UI |
| `NEWSLETTER_AB_ENABLED` | `false` | A/B testing (enable after MVP stabilizes) |

---

## 14. Testing strategy

### 14.1 Unit tests (vitest)

- `ResendEmailAdapter` — mock `resend` SDK, test send/sendTemplate/handleWebhook
- Newsletter edition CRUD actions — mock supabase
- Content queue slot generation — pure function, no mocks
- User-agent parsing — snapshot tests for known UA strings
- A/B winner selection — edge cases (tie, no opens, single variant)

### 14.2 Integration tests (DB-gated)

- `newsletter_editions` CRUD + status transitions
- `newsletter_sends` batch insert + webhook upsert idempotency
- Subscriber status auto-exclusion on bounce/complaint
- Content queue `slot_date` assignment + `queue_position` ordering
- Cron lock for `send-newsletters`

### 14.3 E2E tests (Playwright, Sprint 5c infra)

- Create edition → edit → send test → schedule → verify dashboard
- Content queue: create backlog item → assign to slot → verify timeline
- Subscriber list pagination + filters

---

## 15. Implementation order

1. **Brevo removal** (code + migration) — unblocks everything
2. **ResendEmailAdapter** in `@tn-figueiredo/email@0.2.0` — publish
3. **Newsletter schema** (editions, sends, clicks, webhooks tables)
4. **Content queue schema** (blog_cadence, queue columns)
5. **Webhook endpoint** (`/api/webhooks/resend`)
6. **Newsletter CMS UI** (dashboard, editor, preview)
7. **Content queue UI** (backlog + slots)
8. **React Email templates** (newsletter.tsx + components)
9. **Batch send logic** + cron
10. **Analytics UI** (per-edition detail)
11. **A/B testing** (behind feature flag)
12. **Subscriber management UI**
13. **Settings UI** (cadence, sender, tracking)

---

## 16. Resolved decisions

1. **Resend tier:** Pro ($20/mo, 50K emails/mo) required. Free tier (100/day) is insufficient for newsletters. User must upgrade before first blast.
2. **React Email dev preview:** CMS preview panel only (renders via `/api/newsletters/[id]/preview`). No `npx email dev` dependency — keeps dev setup simple.
3. **Webhook retry:** Rely on Resend/Svix built-in retry (24h window). No custom retry queue — `webhook_events.svix_id` dedup handles replays safely.
