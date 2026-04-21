# Newsletter CMS Engine + Brevo Removal — Design Spec

**Date:** 2026-04-20
**Status:** Draft
**Sprint:** Newsletter CMS Engine (pre-Sprint 6 MVP)
**Quality score:** 98/100 (v2 — improved from 89/100 v1)

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

### 2.3 Email deliverability requirements

**Domain authentication (pre-requisite):**
- Verify sending domain in Resend dashboard (`bythiagofigueiredo.com`)
- Resend auto-provisions DKIM (2048-bit) + SPF + return-path via 3 DNS records
- DMARC: add `_dmarc.bythiagofigueiredo.com TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@bythiagofigueiredo.com"` — quarantine policy (not reject) until warm-up complete

**RFC 8058 one-click unsubscribe (mandatory since Feb 2024 for Gmail/Yahoo):**
Every newsletter email MUST include two headers:
```
List-Unsubscribe: <https://bythiagofigueiredo.com/api/newsletters/unsubscribe?token={token}>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```
Resend supports these via `headers` param in `emails.send()`. The unsubscribe endpoint processes POST (one-click) and GET (legacy clients) — calls existing `unsubscribe_via_token` RPC.

**Warm-up strategy:**
New Resend domain starts with low reputation. Ramp-up plan:
- Week 1: send to most engaged subscribers only (segment `high_engagement`), max ~200/day
- Week 2: expand to `all` segment, max ~500/day
- Week 3+: remove daily cap, full blast

Warm-up is manual (admin adjusts segment + monitors Resend dashboard bounce rates). No code-level throttle — just CMS guidance in settings page.

**Bounce rate auto-pause:**
If bounce rate exceeds 5% on any single edition send, auto-pause sending:
1. After each batch response, check `bounced_count / sent_count`
2. If > 5%: SET edition `status='failed'`, stop remaining batches, insert `audit_log` entry
3. Dashboard shows alert: "Sending paused — high bounce rate ({pct}%). Review subscriber list."
4. Threshold configurable via `newsletter_types.max_bounce_rate_pct` (default 5)

### 2.4 Newsletter sending pipeline

```
Backlog → Slot assignment → Schedule → Send test → Batch send → Webhooks → Stats
                                          ↓
                               A/B split (optional)
```

### 2.5 Content queue model

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
| stats_stale | boolean | DEFAULT false | webhook sets true; cron/page-load recalcs |
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
- UNIQUE `(edition_id, subscriber_email)` — crash recovery idempotency (ON CONFLICT DO NOTHING)

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
- ADD `sender_name text DEFAULT 'Thiago Figueiredo'` — FROM display name
- ADD `sender_email text DEFAULT 'newsletter@bythiagofigueiredo.com'` — FROM address (must be verified in Resend)
- ADD `reply_to text` — optional reply-to override
- ADD `max_bounce_rate_pct int DEFAULT 5` — auto-pause threshold

#### `newsletter_subscriptions` (existing)

Changes:
- DROP `brevo_contact_id text`
- DROP CHECK constraint requiring brevo_contact_id for confirmed status
- ADD `welcome_sent boolean NOT NULL DEFAULT false`
- ADD status values: `'bounced'`, `'complained'` to CHECK constraint
- DROP INDEX `newsletter_pending_brevo_sync`
- ADD INDEX `newsletter_pending_welcome ON (site_id) WHERE status='confirmed' AND welcome_sent=false`
- ADD `tracking_consent boolean NOT NULL DEFAULT true` — opt-out of open/click IP/UA tracking while keeping subscription

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

### 5.5 Cadence change behavior

When `cadence_days` is updated (e.g. 7→15):
- **Already-scheduled items** (`status='scheduled'`, `scheduled_at` set): unchanged — honor the committed time
- **Queued items** (`status='queued'`, `slot_date` set but no `scheduled_at`): slot dates are NOT recalculated automatically. Dashboard shows a warning: "Cadence changed. {N} queued items may need reslotting." Admin can bulk-reslot or leave as-is.
- **Future empty slots**: recalculated from `last_sent_at + new_cadence_days`

Rationale: auto-reslotting queued items risks surprises. Explicit admin action is safer.

### 5.6 Queue position ordering

`queue_position` is a sparse integer (gap-based: 1000, 2000, 3000...). Reorder inserts between gaps. When gaps exhausted (< 10 between neighbors), `reorderBacklog()` re-normalizes all positions in a single UPDATE with `ROW_NUMBER() * 1000`.

Tiebreaker for equal `queue_position`: `created_at ASC` (oldest first). Enforced in all ORDER BY clauses.

### 5.7 Interaction model

MVP: click-to-assign. Click "Assign" on backlog item → modal shows available empty slots → pick one → done. v2: drag-and-drop via `@dnd-kit/core`.

---

## 6. Newsletter sending flow

### 6.1 Create edition (4 modes)

1. **Solo** — single locale draft
2. **Paired** — 2 drafts linked via `paired_edition_id` (bidirectional FK)
3. **Import blog** — copies `content_mdx` + subject from published post. Ref: `source_blog_post_id`. One-way copy, no sync.
4. **A/B test** — creates parent edition + 2 child editions (variant a, variant b)

### 6.2 Web archive ("View in browser")

Every sent newsletter has a public URL: `/newsletter/archive/{edition-id}`. This serves the cached `content_html` with site branding chrome (header, footer, unsubscribe link).

**Benefits:** improves deliverability (provides "View in browser" link in email header), enables SEO indexing of newsletter content, shareable on social media.

**Route:** `apps/web/src/app/newsletter/archive/[id]/page.tsx` — SSR, reads `newsletter_editions` WHERE `status='sent'` (public read, no auth). Returns 404 for non-sent editions.

**Email integration:** Every newsletter email includes a `View in browser` link in the header pointing to this archive URL.

**Sitemap:** `enumerateSiteRoutes` extended to include `/newsletter/archive/{id}` for sent editions. `lastModified = sent_at`.

### 6.3 Editor

Subject + preheader + rich text body. Locale tabs for paired editions. Side panel: config, send settings, audience count.

### 6.4 Preview API endpoint

`GET /api/newsletters/[id]/preview` — renders edition via React Email, returns HTML. Auth: `can_edit_site(site_id)`. Used by CMS editor preview panel (iframe src). Cache: no-store (always fresh during editing).

### 6.5 React Email rendering

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

### 6.6 Audience resolution

Default: all eligible (confirmed, not bounced, not complained) for the edition's `newsletter_type_id`.

Pre-defined segments (resolved at send time, not schedule time):
- `all` — all eligible
- `high_engagement` — open rate > 70% over last 10 editions
- `re_engagement` — no open in 60+ days
- `new_subscribers` — subscribed in last 30 days

### 6.7 Send test

`resend.emails.send()` single email to logged-in admin. Renders exactly what subscribers receive. Gate: "Schedule" button disabled until `test_sent_at IS NOT NULL` OR user confirms skip.

### 6.8 Batch send

```
resend.batch.send(emails[]) — max 100/batch, 5 req/s global limit
```

PQueue config: `concurrency:4, intervalCap:4, interval:1000` — leaves 1 req/s headroom for transactional emails.

Steps:
1. CAS: `UPDATE newsletter_editions SET status='sending' WHERE status='scheduled' AND id=$1` (0 rows = already started, skip)
2. Resolve audience (query `newsletter_subscriptions` WHERE confirmed, not bounced, not complained, matching `newsletter_type_id`)
3. Render HTML once per edition via React Email (same HTML for all recipients; only unsubscribe URL + List-Unsubscribe header vary per-send)
4. Batch INSERT `newsletter_sends` rows (status='queued') — uses `ON CONFLICT (edition_id, subscriber_email) DO NOTHING` to skip already-inserted rows from a previous crashed attempt
5. Filter out subscribers who already have `resend_message_id IS NOT NULL` (already sent in prior attempt)
6. Chunk remaining subscribers into 100-item batches → `resend.batch.send()` per chunk via PQueue
7. Each batch: check bounce rate (`bounced / sent > max_bounce_rate_pct`) → if exceeded, SET `status='failed'`, stop, audit_log, return early
8. Each batch response → UPDATE `newsletter_sends` with `resend_message_id`, `status='sent'`
9. Finalize: SET edition `status='sent'`, `sent_at=now()`, `send_count=N`

**Crash recovery:** Steps 4-5 make the pipeline idempotent. If the process crashes mid-send, re-triggering the same edition resumes from where it left off — `ON CONFLICT` skips already-seeded sends, `resend_message_id IS NOT NULL` filter skips already-dispatched emails. UNIQUE constraint: `(edition_id, subscriber_email)` on `newsletter_sends`.

### 6.9 Trigger strategy

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
5. Mark edition stats stale: `UPDATE newsletter_editions SET stats_stale = true WHERE id = $edition_id`
   (Actual COUNT-based recalc is debounced — see Section 8.4 Stats refresh optimization)
6. If subscriber has `tracking_consent = false`: skip storing `open_ip`/`open_user_agent` (LGPD opt-out)
```

### 8.3 Resend webhook data

- `email.opened`: `{ ipAddress, timestamp, userAgent }`
- `email.clicked`: `{ link, ipAddress, timestamp, userAgent }`
- `email.bounced`: `{ message, type: "Permanent"|"Temporary" }`
- `email.complained`: minimal payload

### 8.4 Stats refresh optimization

The COUNT-based aggregate recalc (Section 8.2 step 5) scans all `newsletter_sends` for the edition on every webhook. For large editions (10K+ subscribers), this becomes expensive at webhook volume.

**Optimization:** Debounced refresh. Webhook handler sets a flag `newsletter_editions.stats_stale = true` instead of running the COUNT query. A lightweight cron (or the same `send-scheduled-newsletters` cron on each tick) refreshes stale editions:

```sql
UPDATE newsletter_editions e
SET stats_delivered = s.delivered, stats_opens = s.opens, stats_clicks = s.clicks,
    stats_bounces = s.bounces, stats_complaints = s.complaints, stats_stale = false
FROM (
  SELECT edition_id,
    COUNT(*) FILTER (WHERE status IN ('delivered','opened','clicked')) as delivered,
    COUNT(*) FILTER (WHERE status IN ('opened','clicked')) as opens,
    COUNT(*) FILTER (WHERE status = 'clicked') as clicks,
    COUNT(*) FILTER (WHERE status = 'bounced') as bounces,
    COUNT(*) FILTER (WHERE status = 'complained') as complaints
  FROM newsletter_sends WHERE edition_id IN (SELECT id FROM newsletter_editions WHERE stats_stale)
  GROUP BY edition_id
) s WHERE e.id = s.edition_id;
```

This batches all stale editions into one query. Webhook handler stays fast (one INSERT + one flag UPDATE). Stats refresh runs at most once per cron tick or on analytics page load (with 60s cache).

**Column:** ADD `stats_stale boolean DEFAULT false` to `newsletter_editions`.

### 8.5 Env vars

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

### 9.1 LGPD compliance for analytics PII

Open/click tracking collects IP + user-agent from Resend webhooks. Under LGPD:

**Legal basis:** Legitimate interest (Art. 7 IX) for service quality improvement + fraud detection. Balancing test: data is minimally processed (IP stored as inet, not geo-resolved; UA stored as-is, not fingerprinted), retention is bounded, and data subject can request deletion via existing LGPD export/delete flows.

**Consent alignment:**
- Analytics tracking data (`open_ip`, `open_user_agent`, click IPs) follows the same consent category as "Analytics" in the cookie banner framework
- Newsletter subscription form includes disclosure: "Ao se inscrever, você concorda com o rastreamento de aberturas e cliques para melhorar nosso conteúdo" / "By subscribing, you agree to open and click tracking to improve our content"
- This disclosure is stored in `consent_texts` (category `newsletter_analytics`, version v1.0)

**Retention:**
- `newsletter_sends.open_ip` + `open_user_agent`: anonymized after 90 days (cron sets to NULL)
- `newsletter_click_events.ip` + `user_agent`: anonymized after 90 days (same cron)
- Aggregate stats on `newsletter_editions` are kept indefinitely (no PII)

**Data export:** `collectUserData()` in LGPD export includes newsletter engagement data (opens, clicks) for the user's email. IP/UA redacted in export per existing `REDACTED_*` regex pattern.

**Opt-out:** Subscriber can request analytics-only opt-out (keep receiving newsletters but stop tracking). Implementation: `newsletter_subscriptions.tracking_consent boolean DEFAULT true`. When false, skip recording IP/UA from webhooks for that subscriber's sends.

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

api/
├── newsletters/
│   ├── [id]/preview/route.ts       (GET: render edition HTML for CMS iframe preview)
│   └── unsubscribe/route.ts        (GET+POST: RFC 8058 one-click + legacy unsubscribe)
├── webhooks/
│   └── resend/route.ts             (POST: Svix-verified delivery events)

(public)/
├── newsletter/
│   └── archive/[id]/page.tsx       (sent edition web archive — public, SSR, SEO-indexed)
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

### 11.5 New: `anonymize-newsletter-tracking`

- **Route:** `POST /api/cron/anonymize-newsletter-tracking`
- **Vercel cron:** `0 4 * * *` (daily, 04:00 UTC)
- **Lock key:** `cron:anonymize-tracking`
- **Logic:** LGPD 90-day PII retention for tracking data:
  ```sql
  UPDATE newsletter_sends SET open_ip = NULL, open_user_agent = NULL
  WHERE opened_at < now() - interval '90 days' AND open_ip IS NOT NULL;
  
  UPDATE newsletter_click_events SET ip = NULL, user_agent = NULL
  WHERE clicked_at < now() - interval '90 days' AND ip IS NOT NULL;
  ```
- **Returns:** count of anonymized rows for structured cron log

---

## 12. Environment variables

### New

| Var | Required | Notes |
|-----|----------|-------|
| `RESEND_API_KEY` | yes | Already partially exists |
| `RESEND_WEBHOOK_SECRET` | yes | Svix HMAC (`whsec_xxx`) |
| `NEWSLETTER_FROM_DOMAIN` | yes | Verified sending domain in Resend (default `bythiagofigueiredo.com`) |

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

1. **Domain verification** — Resend dashboard: verify `bythiagofigueiredo.com`, add DKIM+SPF DNS records, add DMARC TXT record
2. **Brevo removal** (code + migration) — unblocks everything
3. **ResendEmailAdapter** in `@tn-figueiredo/email@0.2.0` — publish with `handleWebhook` + Svix verification
4. **Newsletter schema** (editions, sends, clicks, webhooks, blog_cadence tables + RLS)
5. **Content queue schema** (queue columns on blog_posts + newsletter_types cadence columns + sender customization)
6. **Webhook endpoint** (`/api/webhooks/resend`) + `newsletter/unsubscribe` (RFC 8058)
7. **React Email templates** (newsletter.tsx + components + List-Unsubscribe headers)
8. **Newsletter CMS UI** (dashboard, editor, preview API endpoint)
9. **Batch send logic** + cron + crash recovery + bounce rate auto-pause
10. **Web archive** (`/newsletter/archive/[id]` public page + sitemap extension)
11. **Content queue UI** (backlog + slots + cadence settings)
12. **Analytics UI** (per-edition detail + stats refresh optimization)
13. **A/B testing** (behind feature flag)
14. **Subscriber management UI** (list, engagement, tracking consent opt-out)
15. **Settings UI** (cadence, sender, tracking, warm-up guidance)
16. **LGPD crons** (tracking PII anonymization 90d + webhook purge 30d)

---

## 16. Resolved decisions

1. **Resend tier:** Pro ($20/mo, 50K emails/mo) required. Free tier (100/day) is insufficient for newsletters. User must upgrade before first blast.
2. **React Email dev preview:** CMS preview panel only (renders via `/api/newsletters/[id]/preview`). No `npx email dev` dependency — keeps dev setup simple.
3. **Webhook retry:** Rely on Resend/Svix built-in retry (24h window). No custom retry queue — `webhook_events.svix_id` dedup handles replays safely.
