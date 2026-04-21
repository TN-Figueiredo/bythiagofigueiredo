# Newsletter CMS Engine + Brevo Removal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete newsletter sending system with content queue, remove all Brevo dependencies, and replace with Resend as the sole email provider.

**Architecture:** Adapter-pattern email service (`IEmailService` → `ResendEmailAdapter`), React Email for template rendering, Svix-verified webhooks for delivery tracking, cadence-driven content queue with computed slots, and CMS admin UI following existing `@tn-figueiredo/admin` shell patterns.

**Tech Stack:** Resend SDK + React Email + Svix, Supabase PostgreSQL (RLS, RPCs, advisory locks), Next.js 15 App Router (server actions + API routes), Vitest + Playwright, PQueue for rate limiting.

**Spec:** `docs/superpowers/specs/2026-04-20-newsletter-cms-engine-design.md`

---

## Phase 1: Brevo Removal + Resend Adapter (Tasks 1–5)

> Unblocks all downstream work. Remove every Brevo reference from code, tests, migrations, and docs. Wire up ResendEmailAdapter.

---

### Task 1: Migration — Remove Brevo columns + add Resend support

**Files:**
- Create: `supabase/migrations/20260421000001_remove_brevo_add_resend.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 20260421000001_remove_brevo_add_resend.sql
-- Phase 1: Remove all Brevo columns, indexes, constraints
-- Phase 2: Add Resend email_provider enum value + welcome_sent + tracking_consent

BEGIN;

-- ============================================================
-- 1. newsletter_subscriptions: drop brevo, add welcome_sent + tracking_consent
-- ============================================================

-- Drop the CHECK constraint that required brevo_contact_id for confirmed status
-- The constraint name comes from: check (status <> 'confirmed' or brevo_contact_id is not null or status = 'pending_confirmation')
ALTER TABLE public.newsletter_subscriptions
  DROP CONSTRAINT IF EXISTS newsletter_subscriptions_check;

ALTER TABLE public.newsletter_subscriptions
  DROP COLUMN IF EXISTS brevo_contact_id;

-- Drop the Brevo sync index
DROP INDEX IF EXISTS newsletter_pending_brevo_sync;

-- Re-add status CHECK without brevo_contact_id requirement + new statuses
ALTER TABLE public.newsletter_subscriptions
  DROP CONSTRAINT IF EXISTS newsletter_subscriptions_status_check;
ALTER TABLE public.newsletter_subscriptions
  ADD CONSTRAINT newsletter_subscriptions_status_check
  CHECK (status IN ('pending_confirmation','confirmed','unsubscribed','bounced','complained'));

-- Add welcome_sent for post-Brevo welcome email flow
ALTER TABLE public.newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS welcome_sent boolean NOT NULL DEFAULT false;

-- Add tracking_consent for LGPD analytics opt-out
ALTER TABLE public.newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS tracking_consent boolean NOT NULL DEFAULT true;

-- Index for welcome email cron
CREATE INDEX IF NOT EXISTS newsletter_pending_welcome
  ON public.newsletter_subscriptions (site_id)
  WHERE status = 'confirmed' AND welcome_sent = false;

-- ============================================================
-- 2. campaigns: drop brevo columns
-- ============================================================
ALTER TABLE public.campaigns
  DROP COLUMN IF EXISTS brevo_list_id,
  DROP COLUMN IF EXISTS brevo_template_id;

-- ============================================================
-- 3. campaign_submissions: drop brevo columns + constraint + index
-- ============================================================
ALTER TABLE public.campaign_submissions
  DROP CONSTRAINT IF EXISTS campaign_submissions_sync_status_check;

DROP INDEX IF EXISTS campaign_submissions_brevo_sync_status_idx;

ALTER TABLE public.campaign_submissions
  DROP COLUMN IF EXISTS brevo_contact_id,
  DROP COLUMN IF EXISTS brevo_sync_status,
  DROP COLUMN IF EXISTS brevo_sync_error,
  DROP COLUMN IF EXISTS brevo_synced_at;

-- ============================================================
-- 4. sites: drop brevo_newsletter_list_id
-- ============================================================
ALTER TABLE public.sites
  DROP COLUMN IF EXISTS brevo_newsletter_list_id;

-- ============================================================
-- 5. sent_emails: add 'resend' to email_provider enum
-- ============================================================
ALTER TYPE public.email_provider ADD VALUE IF NOT EXISTS 'resend';

-- ============================================================
-- 6. update_campaign_atomic RPC: remove brevo fields from patch whitelist
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_campaign_atomic(
  p_campaign_id uuid,
  p_patch jsonb DEFAULT '{}'::jsonb,
  p_translations jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign record;
  v_result jsonb;
  v_key text;
  v_allowed_keys text[] := ARRAY[
    'interest', 'status', 'pdf_storage_path',
    'form_fields', 'scheduled_for', 'published_at',
    'owner_user_id'
  ];
  v_set_parts text[] := '{}';
  v_trans jsonb;
  v_trans_allowed text[] := ARRAY[
    'locale','slug','meta_title','meta_description',
    'content_mdx','content_compiled','cover_image_url',
    'pdf_storage_path','seo_extras'
  ];
BEGIN
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Build dynamic SET clause from allowed keys only
  FOR v_key IN SELECT jsonb_object_keys(p_patch)
  LOOP
    IF v_key = ANY(v_allowed_keys) THEN
      v_set_parts := array_append(v_set_parts,
        format('%I = %L', v_key, p_patch->>v_key));
    END IF;
  END LOOP;

  IF array_length(v_set_parts, 1) > 0 THEN
    EXECUTE format(
      'UPDATE campaigns SET %s, updated_at = now() WHERE id = %L',
      array_to_string(v_set_parts, ', '), p_campaign_id
    );
  END IF;

  -- Upsert translations
  FOR v_trans IN SELECT * FROM jsonb_array_elements(p_translations)
  LOOP
    INSERT INTO campaign_translations (campaign_id, locale, slug, meta_title, meta_description,
      content_mdx, content_compiled, cover_image_url, pdf_storage_path, seo_extras)
    VALUES (
      p_campaign_id,
      v_trans->>'locale',
      v_trans->>'slug',
      v_trans->>'meta_title',
      v_trans->>'meta_description',
      v_trans->>'content_mdx',
      v_trans->>'content_compiled',
      v_trans->>'cover_image_url',
      v_trans->>'pdf_storage_path',
      CASE WHEN v_trans ? 'seo_extras' THEN v_trans->'seo_extras' ELSE NULL END
    )
    ON CONFLICT (campaign_id, locale) DO UPDATE SET
      slug = EXCLUDED.slug,
      meta_title = EXCLUDED.meta_title,
      meta_description = EXCLUDED.meta_description,
      content_mdx = EXCLUDED.content_mdx,
      content_compiled = EXCLUDED.content_compiled,
      cover_image_url = EXCLUDED.cover_image_url,
      pdf_storage_path = EXCLUDED.pdf_storage_path,
      seo_extras = COALESCE(EXCLUDED.seo_extras, campaign_translations.seo_extras);
  END LOOP;

  SELECT row_to_json(c.*) INTO v_result FROM campaigns c WHERE c.id = p_campaign_id;
  RETURN jsonb_build_object('ok', true, 'campaign', v_result);
END;
$$;

COMMIT;
```

- [ ] **Step 2: Validate migration locally**

Run: `npm run db:start && npm run db:reset`
Expected: migration applies cleanly, no errors.

- [ ] **Step 3: Push to prod**

Run: `npm run db:push:prod`
Expected: confirms YES prompt, migration applied.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260421000001_remove_brevo_add_resend.sql
git commit -m "feat(db): remove all Brevo columns, add Resend enum + welcome_sent + tracking_consent"
```

---

### Task 2: Delete Brevo code + rewrite email service factory

**Files:**
- Delete: `apps/web/lib/brevo.ts`
- Modify: `apps/web/lib/email/service.ts`
- Modify: `apps/web/lib/email/resend.ts`
- Modify: `apps/web/src/lib/lgpd/email-service.ts`
- Modify: `apps/web/src/lib/lgpd/container.ts`

- [ ] **Step 1: Delete `apps/web/lib/brevo.ts`**

```bash
rm apps/web/lib/brevo.ts
```

- [ ] **Step 2: Rewrite `apps/web/lib/email/service.ts`**

Replace entire file:

```typescript
import { ResendEmailAdapter, type IEmailService } from '@tn-figueiredo/email'

let cached: IEmailService | null = null

export function getEmailService(): IEmailService {
  if (cached) return cached
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')
  cached = new ResendEmailAdapter(apiKey)
  return cached
}
```

> **Note:** This will fail to compile until `@tn-figueiredo/email@0.2.0` is published with `ResendEmailAdapter`. For now, use the existing `apps/web/lib/email/resend.ts` inline adapter as a bridge. See Task 3 for the full adapter. Until then, wire it as:

```typescript
import type { IEmailService } from '@tn-figueiredo/email'
import { createResendEmailService } from './resend'

let cached: IEmailService | null = null

export function getEmailService(): IEmailService {
  if (cached) return cached
  cached = createResendEmailService()
  return cached
}
```

- [ ] **Step 3: Expand `apps/web/lib/email/resend.ts` into a full IEmailService bridge**

Replace entire file:

```typescript
import { Resend } from 'resend'
import type {
  IEmailService,
  EmailMessage,
  EmailResult,
  IEmailTemplate,
  EmailSender,
} from '@tn-figueiredo/email'

export function createResendEmailService(): IEmailService {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')
  const client = new Resend(apiKey)

  return {
    async send(msg: EmailMessage): Promise<EmailResult> {
      const { data, error } = await client.emails.send({
        from: `${msg.from.name} <${msg.from.email}>`,
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        reply_to: msg.replyTo,
        headers: msg.metadata?.headers as Record<string, string> | undefined,
      })
      if (error) throw new Error(error.message)
      return { messageId: data!.id, provider: 'resend' as const }
    },

    async sendTemplate<V extends Record<string, unknown>>(
      template: IEmailTemplate<V>,
      sender: EmailSender,
      to: string,
      variables: V,
      locale?: string,
    ): Promise<EmailResult> {
      const rendered = template.render(variables, locale)
      return this.send({
        from: sender,
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      })
    },
  }
}
```

- [ ] **Step 4: Rename `BrevoLgpdEmailService` → `LgpdEmailService` in `apps/web/src/lib/lgpd/email-service.ts`**

Find and replace all occurrences of `BrevoLgpdEmailService` with `LgpdEmailService` in the file. Also rename the options type:

```
BrevoLgpdEmailService → LgpdEmailService
BrevoLgpdEmailServiceOptions → LgpdEmailServiceOptions
```

- [ ] **Step 5: Update container.ts imports**

In `apps/web/src/lib/lgpd/container.ts`:

Replace:
```typescript
import { BrevoLgpdEmailService } from './email-service'
```
With:
```typescript
import { LgpdEmailService } from './email-service'
```

Replace all instances of `new BrevoLgpdEmailService(` with `new LgpdEmailService(`.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: 0 errors (if `@tn-figueiredo/email` types need updating, the bridge adapter hides the mismatch)

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/brevo.ts apps/web/lib/email/service.ts apps/web/lib/email/resend.ts apps/web/src/lib/lgpd/email-service.ts apps/web/src/lib/lgpd/container.ts
git commit -m "feat: remove Brevo, wire Resend as sole email provider via IEmailService bridge"
```

---

### Task 3: Remove Brevo from app code (routes, actions, pages)

**Files:**
- Modify: `apps/web/src/app/api/cron/sync-newsletter-pending/route.ts`
- Modify: `apps/web/src/app/api/campaigns/[slug]/submit/route.ts`
- Modify: `apps/web/src/app/contact/actions.ts`
- Modify: `apps/web/src/app/cms/(authed)/campaigns/[id]/edit/actions.ts`
- Modify: `apps/web/src/app/cms/(authed)/campaigns/[id]/edit/page.tsx`
- Modify: `apps/web/src/app/campaigns/[locale]/[slug]/page.tsx`
- Modify: `apps/web/src/app/admin/(authed)/users/actions.ts`

- [ ] **Step 1: Rewrite sync-newsletter-pending cron**

Replace the entire body of the `handler` function inside `withCronLock` in `apps/web/src/app/api/cron/sync-newsletter-pending/route.ts`. Delete all `createBrevoContact` imports and the entire Brevo sync logic. The new handler:

```typescript
import { getEmailService } from '@/lib/email/service'

// Inside withCronLock callback:
const { data: pending } = await supabase
  .from('newsletter_subscriptions')
  .select('id, site_id, email, consent_text_version')
  .eq('status', 'confirmed')
  .eq('welcome_sent', false)
  .limit(50)

if (!pending?.length) return { status: 'ok' as const, sent: 0 }

const emailService = getEmailService()
let sent = 0

for (const sub of pending) {
  try {
    await emailService.send({
      from: { name: 'Thiago Figueiredo', email: 'newsletter@bythiagofigueiredo.com' },
      to: sub.email,
      subject: 'Welcome to the newsletter!',
      html: `<p>Thanks for confirming your subscription.</p>`,
    })
    await supabase
      .from('newsletter_subscriptions')
      .update({ welcome_sent: true })
      .eq('id', sub.id)
    sent++
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'cron', job: JOB, subId: sub.id } })
  }
}

return { status: 'ok' as const, sent }
```

Remove: `import { createBrevoContact }`, `brevo_contact_id` updates, `syncing:RANDOM` sentinel, unsubscribed user cleanup. Keep `withCronLock` wrapper + `Sentry` import + structured logging.

- [ ] **Step 2: Remove Brevo from campaign submit route**

In `apps/web/src/app/api/campaigns/[slug]/submit/route.ts`:

Remove `import { createBrevoContact } from '@/lib/brevo'` and all `createBrevoContact()` calls. Remove `brevo_list_id` from the query select. Remove the Brevo sync logic block. Keep the rest of the submission flow (insert campaign_submission, send confirmation email).

- [ ] **Step 3: Update provider in contact actions**

In `apps/web/src/app/contact/actions.ts`:

Replace `provider: 'brevo'` with `provider: 'resend'` on all `sent_emails` insert calls (approximately lines 169 and 218).

- [ ] **Step 4: Update provider in admin users actions**

In `apps/web/src/app/admin/(authed)/users/actions.ts`:

Replace `provider: 'brevo'` with `provider: 'resend'` on all `sent_emails` insert calls (approximately lines 166 and 371).

- [ ] **Step 5: Remove brevo fields from campaign edit actions**

In `apps/web/src/app/cms/(authed)/campaigns/[id]/edit/actions.ts`:

Remove `brevo_list_id` and `brevo_template_id` from the patch type definition and from any object spreads.

- [ ] **Step 6: Remove brevo fields from campaign edit page**

In `apps/web/src/app/cms/(authed)/campaigns/[id]/edit/page.tsx`:

Remove any `brevo_list_id` or `brevo_template_id` from component state, form fields, or select queries.

- [ ] **Step 7: Remove brevo_list_id from public campaign page**

In `apps/web/src/app/campaigns/[locale]/[slug]/page.tsx`:

Remove `brevo_list_id` from the interface type and from the Supabase select query.

- [ ] **Step 8: Run tests**

Run: `npm run test:web`
Expected: Some tests will fail (Brevo mocks now reference deleted code). That's expected — Task 4 fixes tests.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/api/cron/sync-newsletter-pending/route.ts \
       apps/web/src/app/api/campaigns/\[slug\]/submit/route.ts \
       apps/web/src/app/contact/actions.ts \
       apps/web/src/app/admin/\(authed\)/users/actions.ts \
       apps/web/src/app/cms/\(authed\)/campaigns/\[id\]/edit/actions.ts \
       apps/web/src/app/cms/\(authed\)/campaigns/\[id\]/edit/page.tsx \
       apps/web/src/app/campaigns/\[locale\]/\[slug\]/page.tsx
git commit -m "feat: remove Brevo from all app routes, actions, and pages"
```

---

### Task 4: Fix all tests after Brevo removal

**Files:**
- Delete: `apps/web/test/lib/brevo.test.ts`
- Modify: `apps/web/test/api/campaigns-submit.test.ts`
- Modify: `apps/web/test/api/cron/sync-newsletter-pending.test.ts` (or `apps/web/test/api/cron-sync-newsletter.test.ts`)
- Modify: `apps/web/test/app/admin-users-actions.test.ts`
- Modify: `apps/web/test/helpers/db-seed.ts`
- Modify: `apps/web/src/lib/lgpd/email-service.test.ts`

- [ ] **Step 1: Delete brevo test file**

```bash
rm apps/web/test/lib/brevo.test.ts
```

- [ ] **Step 2: Fix campaigns-submit test**

In `apps/web/test/api/campaigns-submit.test.ts`:

Remove `vi.mock` for `createBrevoContact`. Remove all Brevo sync assertions (`expect(createBrevoContact).toHaveBeenCalled()`). Remove `brevo_list_id` from mock data. Keep submission flow assertions.

- [ ] **Step 3: Rewrite sync-newsletter-pending test**

In the sync-newsletter test file:

Remove all `createBrevoContact` mocks. Update the fake client to return data matching the new query shape (no `brevo_contact_id`). Test the new welcome-email-only flow: confirmed + `welcome_sent=false` → send welcome → set `welcome_sent=true`.

- [ ] **Step 4: Fix admin users actions test**

Replace `BrevoEmailAdapter` mock references with the new Resend service mock. Update `provider: 'brevo'` assertions to `provider: 'resend'`.

- [ ] **Step 5: Fix LGPD email-service test**

In `apps/web/src/lib/lgpd/email-service.test.ts`:

Replace `BrevoLgpdEmailService` with `LgpdEmailService` in all imports and instantiation.

- [ ] **Step 6: Update db-seed.ts**

In `apps/web/test/helpers/db-seed.ts`:

Remove `brevoNewsletterListId` from `seedSite()` params and the insert object. Remove `brevoContactId` from `seedPendingNewsletterSub()`. Remove `brevoListId`, `brevoTemplateId` from `seedCampaign()`. Remove `brevo_sync_status` etc from any seed helpers.

- [ ] **Step 7: Run all tests to verify green**

Run: `npm test`
Expected: All tests pass (both api and web suites).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test: fix all tests after Brevo removal — delete brevo.test.ts, update mocks"
```

---

### Task 5: Update config, env, docs, CSP

**Files:**
- Modify: `apps/web/.env.example`
- Modify: `apps/web/.env.local.example`
- Modify: `apps/web/next.config.ts` (CSP header)
- Modify: `CLAUDE.md`
- Modify: `supabase/seeds/dev.sql`

- [ ] **Step 1: Update env example files**

In both `.env.example` and `.env.local.example`:

Remove: `BREVO_API_KEY=`
Add:
```
RESEND_API_KEY=re_xxx
RESEND_WEBHOOK_SECRET=whsec_xxx
NEWSLETTER_FROM_DOMAIN=bythiagofigueiredo.com
```

- [ ] **Step 2: Update CSP in next.config.ts**

In `apps/web/next.config.ts`, find the `connect-src` CSP directive and remove `https://api.brevo.com`. The Resend SDK uses standard HTTPS — no special CSP needed.

- [ ] **Step 3: Update dev seed**

In `supabase/seeds/dev.sql`:

Remove all `brevo_newsletter_list_id`, `brevo_list_id`, `brevo_sync_status`, `brevo_contact_id`, `brevo_sync_error` values from INSERT statements. Add `welcome_sent: true` for confirmed newsletter subscriptions in seed data.

- [ ] **Step 4: Update CLAUDE.md**

In `CLAUDE.md`, update the following sections:
- Environment Variables: remove `BREVO_API_KEY`, add `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `NEWSLETTER_FROM_DOMAIN`
- LGPD adapter description: rename `BrevoLgpdEmailService` → `LgpdEmailService`
- Remove any active instructions referencing Brevo (keep historical sprint notes with "(removed)" annotation)

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/.env.example apps/web/.env.local.example apps/web/next.config.ts CLAUDE.md supabase/seeds/dev.sql
git commit -m "chore: update env/config/docs/CSP after Brevo removal"
```

---

### Task 5b: Install new npm dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install Svix + React Email**

Note: `resend@6.12.0` is already installed. Only add the new deps:

Run: `npm install svix @react-email/render @react-email/components --workspace=apps/web`

These are needed for:
- `svix` — Resend webhook signature verification (Task 9)
- `@react-email/render` — compile React Email templates to HTML (Task 15b)
- `@react-email/components` — email-safe React components (Task 15b)

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore: add svix + react-email dependencies for newsletter engine"
```

---

## Phase 2: Newsletter Schema + Core Infrastructure (Tasks 6–10)

> Create the database tables, webhook endpoint, and content queue pure functions.

---

### Task 6: Migration — Newsletter editions, sends, clicks, webhooks, blog_cadence

**Files:**
- Create: `supabase/migrations/20260421000002_newsletter_editions_and_sends.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 20260421000002_newsletter_editions_and_sends.sql
-- Newsletter sending tables: editions, sends, click_events, webhook_events, blog_cadence

BEGIN;

-- ============================================================
-- 1. newsletter_editions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.newsletter_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  newsletter_type_id text NOT NULL REFERENCES public.newsletter_types(id) ON DELETE RESTRICT,
  paired_edition_id uuid REFERENCES public.newsletter_editions(id) ON DELETE SET NULL,
  source_blog_post_id uuid REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  subject text NOT NULL,
  preheader text,
  content_mdx text,
  content_html text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','ready','queued','scheduled','sending','sent','failed','cancelled')),
  segment text NOT NULL DEFAULT 'all'
    CHECK (segment IN ('all','high_engagement','re_engagement','new_subscribers')),
  queue_position int,
  slot_date date,
  scheduled_at timestamptz,
  sent_at timestamptz,
  send_count int NOT NULL DEFAULT 0,
  stats_delivered int NOT NULL DEFAULT 0,
  stats_opens int NOT NULL DEFAULT 0,
  stats_clicks int NOT NULL DEFAULT 0,
  stats_bounces int NOT NULL DEFAULT 0,
  stats_complaints int NOT NULL DEFAULT 0,
  stats_unsubs int NOT NULL DEFAULT 0,
  stats_stale boolean NOT NULL DEFAULT false,
  ab_variant text CHECK (ab_variant IN ('a','b')),
  ab_parent_id uuid REFERENCES public.newsletter_editions(id) ON DELETE SET NULL,
  ab_sample_pct int NOT NULL DEFAULT 10,
  ab_wait_hours int NOT NULL DEFAULT 4,
  ab_winner_decided_at timestamptz,
  test_sent_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_editions_site_type_status
  ON public.newsletter_editions (site_id, newsletter_type_id, status);
CREATE INDEX IF NOT EXISTS newsletter_editions_scheduled
  ON public.newsletter_editions (status, scheduled_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS newsletter_editions_slot
  ON public.newsletter_editions (newsletter_type_id, slot_date)
  WHERE slot_date IS NOT NULL;

CREATE TRIGGER newsletter_editions_set_updated_at
  BEFORE UPDATE ON public.newsletter_editions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.newsletter_editions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_editions_staff_read" ON public.newsletter_editions;
CREATE POLICY "newsletter_editions_staff_read"
  ON public.newsletter_editions FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "newsletter_editions_staff_write" ON public.newsletter_editions;
CREATE POLICY "newsletter_editions_staff_write"
  ON public.newsletter_editions FOR ALL TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "newsletter_editions_public_read" ON public.newsletter_editions;
CREATE POLICY "newsletter_editions_public_read"
  ON public.newsletter_editions FOR SELECT TO anon
  USING (status = 'sent');

-- ============================================================
-- 2. newsletter_sends
-- ============================================================
CREATE TABLE IF NOT EXISTS public.newsletter_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.newsletter_editions(id) ON DELETE CASCADE,
  subscriber_email citext NOT NULL,
  resend_message_id text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sent','delivered','opened','clicked','bounced','complained')),
  delivered_at timestamptz,
  opened_at timestamptz,
  open_ip inet,
  open_user_agent text,
  clicked_at timestamptz,
  bounce_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, subscriber_email)
);

CREATE INDEX IF NOT EXISTS newsletter_sends_edition_status
  ON public.newsletter_sends (edition_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_sends_resend_msg
  ON public.newsletter_sends (resend_message_id)
  WHERE resend_message_id IS NOT NULL;

ALTER TABLE public.newsletter_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_sends_staff_read" ON public.newsletter_sends;
CREATE POLICY "newsletter_sends_staff_read"
  ON public.newsletter_sends FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.newsletter_editions e
    WHERE e.id = edition_id AND public.can_view_site(e.site_id)
  ));

-- ============================================================
-- 3. newsletter_click_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.newsletter_click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid NOT NULL REFERENCES public.newsletter_sends(id) ON DELETE CASCADE,
  url text NOT NULL,
  ip inet,
  user_agent text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_click_events_send
  ON public.newsletter_click_events (send_id);
CREATE INDEX IF NOT EXISTS newsletter_click_events_url
  ON public.newsletter_click_events (url);

ALTER TABLE public.newsletter_click_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_click_events_staff_read" ON public.newsletter_click_events;
CREATE POLICY "newsletter_click_events_staff_read"
  ON public.newsletter_click_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.newsletter_sends s
    JOIN public.newsletter_editions e ON e.id = s.edition_id
    WHERE s.id = send_id AND public.can_view_site(e.site_id)
  ));

-- ============================================================
-- 4. webhook_events (idempotency dedup)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  svix_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- No RLS needed — only accessed via service-role from webhook handler

-- ============================================================
-- 5. blog_cadence
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blog_cadence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  locale text NOT NULL,
  cadence_days int NOT NULL DEFAULT 7,
  preferred_send_time time NOT NULL DEFAULT '09:00',
  cadence_start_date date,
  cadence_paused boolean NOT NULL DEFAULT false,
  last_published_at timestamptz,
  UNIQUE (site_id, locale)
);

ALTER TABLE public.blog_cadence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_cadence_staff_rw" ON public.blog_cadence;
CREATE POLICY "blog_cadence_staff_rw"
  ON public.blog_cadence FOR ALL TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

COMMIT;
```

- [ ] **Step 2: Validate locally**

Run: `npm run db:start && npm run db:reset`
Expected: clean apply.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260421000002_newsletter_editions_and_sends.sql
git commit -m "feat(db): create newsletter_editions, sends, click_events, webhook_events, blog_cadence"
```

---

### Task 7: Migration — Content queue columns + newsletter_types cadence

**Files:**
- Create: `supabase/migrations/20260421000003_content_queue_columns.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 20260421000003_content_queue_columns.sql
-- Add content queue support: post_status enum extension, queue columns on blog_posts,
-- cadence + sender columns on newsletter_types

BEGIN;

-- ============================================================
-- 1. Extend post_status enum with 'ready' and 'queued'
-- ============================================================
-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction in older PG,
-- but Supabase (PG 15+) supports it.
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'ready' AFTER 'draft';
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'queued' AFTER 'ready';
-- Also add 'pending_review' if not already present (Sprint 4.75)
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'pending_review' AFTER 'draft';

COMMIT;

-- Cannot be in same transaction as ADD VALUE
BEGIN;

-- ============================================================
-- 2. blog_posts: add queue columns
-- ============================================================
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS queue_position int,
  ADD COLUMN IF NOT EXISTS slot_date date;

-- ============================================================
-- 3. newsletter_types: cadence + sender columns
-- ============================================================

-- Replace text 'cadence' with int 'cadence_days'
-- First add new column, backfill, then drop old
ALTER TABLE public.newsletter_types
  ADD COLUMN IF NOT EXISTS cadence_days int NOT NULL DEFAULT 7;

-- Backfill from existing text cadence (e.g., 'weekly' → 7, 'biweekly' → 14)
UPDATE public.newsletter_types SET cadence_days = CASE
  WHEN cadence = 'weekly' THEN 7
  WHEN cadence = 'biweekly' THEN 14
  WHEN cadence = 'monthly' THEN 30
  ELSE 7
END WHERE cadence IS NOT NULL;

ALTER TABLE public.newsletter_types
  DROP COLUMN IF EXISTS cadence;

ALTER TABLE public.newsletter_types
  ADD COLUMN IF NOT EXISTS preferred_send_time time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS cadence_start_date date,
  ADD COLUMN IF NOT EXISTS cadence_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sender_name text DEFAULT 'Thiago Figueiredo',
  ADD COLUMN IF NOT EXISTS sender_email text DEFAULT 'newsletter@bythiagofigueiredo.com',
  ADD COLUMN IF NOT EXISTS reply_to text,
  ADD COLUMN IF NOT EXISTS max_bounce_rate_pct int NOT NULL DEFAULT 5;

COMMIT;
```

- [ ] **Step 2: Validate locally**

Run: `npm run db:reset`
Expected: clean apply.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260421000003_content_queue_columns.sql
git commit -m "feat(db): add content queue columns + newsletter_types cadence/sender"
```

---

### Task 8: Content queue slot generation — pure functions + tests

**Files:**
- Create: `apps/web/lib/content-queue/slots.ts`
- Create: `apps/web/test/lib/content-queue/slots.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/content-queue/slots.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateSlots, type CadenceConfig } from '@/lib/content-queue/slots'

describe('generateSlots', () => {
  const base: CadenceConfig = {
    cadenceDays: 7,
    startDate: '2026-04-01',
    lastSentAt: null,
    paused: false,
  }

  it('generates N future slots from start date', () => {
    const slots = generateSlots(base, { today: '2026-04-10', count: 4 })
    expect(slots).toEqual([
      '2026-04-15',
      '2026-04-22',
      '2026-04-29',
      '2026-05-06',
    ])
  })

  it('uses lastSentAt as anchor when available', () => {
    const config = { ...base, lastSentAt: '2026-04-08T09:00:00Z' }
    const slots = generateSlots(config, { today: '2026-04-10', count: 3 })
    expect(slots).toEqual([
      '2026-04-15',
      '2026-04-22',
      '2026-04-29',
    ])
  })

  it('returns empty array when paused', () => {
    const config = { ...base, paused: true }
    const slots = generateSlots(config, { today: '2026-04-10', count: 4 })
    expect(slots).toEqual([])
  })

  it('skips past slots', () => {
    const slots = generateSlots(base, { today: '2026-04-20', count: 3 })
    expect(slots).toEqual([
      '2026-04-22',
      '2026-04-29',
      '2026-05-06',
    ])
  })

  it('handles custom cadence (9 days)', () => {
    const config = { ...base, cadenceDays: 9 }
    const slots = generateSlots(config, { today: '2026-04-01', count: 3 })
    expect(slots).toEqual([
      '2026-04-10',
      '2026-04-19',
      '2026-04-28',
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/lib/content-queue/slots.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/content-queue/slots.ts`:

```typescript
export interface CadenceConfig {
  cadenceDays: number
  startDate: string // ISO date 'YYYY-MM-DD'
  lastSentAt: string | null // ISO datetime
  paused: boolean
}

interface SlotOptions {
  today: string // ISO date 'YYYY-MM-DD'
  count: number
}

export function generateSlots(config: CadenceConfig, opts: SlotOptions): string[] {
  if (config.paused) return []

  const { cadenceDays, startDate, lastSentAt } = config
  const anchor = lastSentAt ? lastSentAt.slice(0, 10) : startDate
  const todayMs = new Date(opts.today + 'T00:00:00Z').getTime()
  const anchorMs = new Date(anchor + 'T00:00:00Z').getTime()
  const dayMs = 86_400_000

  const slots: string[] = []
  let i = 1
  while (slots.length < opts.count) {
    const slotMs = anchorMs + i * cadenceDays * dayMs
    if (slotMs > todayMs) {
      slots.push(new Date(slotMs).toISOString().slice(0, 10))
    }
    i++
    if (i > 1000) break
  }
  return slots
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/test/lib/content-queue/slots.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/content-queue/slots.ts apps/web/test/lib/content-queue/slots.test.ts
git commit -m "feat: content queue slot generation — pure function with full test coverage"
```

---

### Task 9: Webhook endpoint — `/api/webhooks/resend`

**Files:**
- Create: `apps/web/src/app/api/webhooks/resend/route.ts`
- Create: `apps/web/test/api/webhooks/resend.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/api/webhooks/resend.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.RESEND_WEBHOOK_SECRET = 'whsec_test123'

const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ data: null, error: null }) })
const insertMock = vi.fn().mockReturnValue({ data: null, error: null })
const selectMock = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
})

vi.mock('../../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: vi.fn((table: string) => {
      if (table === 'webhook_events') return { select: selectMock, insert: insertMock }
      if (table === 'newsletter_sends') return { update: updateMock, select: selectMock }
      if (table === 'newsletter_editions') return { update: updateMock }
      return { select: selectMock, update: updateMock, insert: insertMock }
    }),
  }),
}))

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockReturnValue({
      type: 'email.delivered',
      data: { email_id: 'msg_123', created_at: '2026-04-20T10:00:00Z' },
    }),
  })),
}))

import { POST } from '../../../../src/app/api/webhooks/resend/route'

function req(body: unknown = {}) {
  return new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': 'svix_123',
      'svix-timestamp': '1234567890',
      'svix-signature': 'v1,test',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/webhooks/resend', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 200 on valid webhook', async () => {
    const res = await POST(req({ type: 'email.delivered', data: { email_id: 'msg_123' } }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when RESEND_WEBHOOK_SECRET is not set', async () => {
    const saved = process.env.RESEND_WEBHOOK_SECRET
    delete process.env.RESEND_WEBHOOK_SECRET
    const res = await POST(req())
    process.env.RESEND_WEBHOOK_SECRET = saved
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/api/webhooks/resend.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/api/webhooks/resend/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 400 })

  const body = await req.text()
  const headers = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  }

  let event: { type: string; data: Record<string, unknown> }
  try {
    const wh = new Webhook(secret)
    event = wh.verify(body, headers) as typeof event
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  const svixId = headers['svix-id']
  const supabase = getSupabaseServiceClient()

  // Idempotency check
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('svix_id', svixId)
    .maybeSingle()

  if (existing) return NextResponse.json({ ok: true, dedup: true })

  try {
    await processEvent(supabase, event)
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'webhook', provider: 'resend' } })
  }

  // Record for idempotency (best-effort)
  await supabase.from('webhook_events').insert({
    svix_id: svixId,
    event_type: event.type,
  }).then(() => {}, () => {})

  return NextResponse.json({ ok: true })
}

async function processEvent(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  event: { type: string; data: Record<string, unknown> },
) {
  const messageId = event.data.email_id as string | undefined
  if (!messageId) return

  // Look up the send row
  const { data: send } = await supabase
    .from('newsletter_sends')
    .select('id, edition_id, subscriber_email')
    .eq('resend_message_id', messageId)
    .maybeSingle()

  if (!send) return // Not a newsletter email (transactional), ignore

  // Check tracking consent
  const { data: sub } = await supabase
    .from('newsletter_subscriptions')
    .select('tracking_consent')
    .eq('email', send.subscriber_email)
    .maybeSingle()

  const trackPii = sub?.tracking_consent !== false

  switch (event.type) {
    case 'email.delivered':
      await supabase.from('newsletter_sends').update({
        status: 'delivered',
        delivered_at: event.data.created_at as string,
      }).eq('id', send.id)
      break

    case 'email.opened':
      await supabase.from('newsletter_sends').update({
        status: 'opened',
        opened_at: event.data.created_at as string,
        ...(trackPii ? {
          open_ip: event.data.ipAddress as string ?? null,
          open_user_agent: event.data.userAgent as string ?? null,
        } : {}),
      }).eq('id', send.id).is('opened_at', null) // first open only
      break

    case 'email.clicked': {
      await supabase.from('newsletter_sends').update({
        status: 'clicked',
        clicked_at: event.data.created_at as string,
      }).eq('id', send.id)
      await supabase.from('newsletter_click_events').insert({
        send_id: send.id,
        url: event.data.link as string,
        ...(trackPii ? {
          ip: event.data.ipAddress as string ?? null,
          user_agent: event.data.userAgent as string ?? null,
        } : {}),
      })
      break
    }

    case 'email.bounced':
      await supabase.from('newsletter_sends').update({
        status: 'bounced',
        bounce_type: event.data.type as string,
      }).eq('id', send.id)
      if (event.data.type === 'Permanent') {
        await supabase.from('newsletter_subscriptions').update({
          status: 'bounced',
        }).eq('email', send.subscriber_email)
      }
      break

    case 'email.complained':
      await supabase.from('newsletter_sends').update({
        status: 'complained',
      }).eq('id', send.id)
      await supabase.from('newsletter_subscriptions').update({
        status: 'complained',
      }).eq('email', send.subscriber_email)
      break
  }

  // Mark edition stats as stale
  await supabase.from('newsletter_editions').update({
    stats_stale: true,
  }).eq('id', send.edition_id)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/test/api/webhooks/resend.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/webhooks/resend/route.ts apps/web/test/api/webhooks/resend.test.ts
git commit -m "feat: Resend webhook endpoint with Svix verification + idempotency dedup"
```

---

### Task 10: Newsletter unsubscribe endpoint (RFC 8058)

**Files:**
- Create: `apps/web/src/app/api/newsletters/unsubscribe/route.ts`
- Create: `apps/web/test/api/newsletters/unsubscribe.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/api/newsletters/unsubscribe.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpcMock = vi.fn()
vi.mock('../../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ rpc: rpcMock }),
}))

import { GET, POST } from '../../../../src/app/api/newsletters/unsubscribe/route'

describe('newsletter unsubscribe endpoint', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('POST (RFC 8058 one-click) calls unsubscribe RPC', async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null })
    const req = new Request('http://localhost/api/newsletters/unsubscribe?token=abc123', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(rpcMock).toHaveBeenCalledWith('unsubscribe_via_token', expect.objectContaining({
      p_token_hash: expect.any(String),
    }))
  })

  it('GET redirects to unsubscribe page', async () => {
    const req = new Request('http://localhost/api/newsletters/unsubscribe?token=abc123')
    const res = await GET(req)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/unsubscribe/abc123')
  })

  it('returns 400 without token', async () => {
    const req = new Request('http://localhost/api/newsletters/unsubscribe', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/api/newsletters/unsubscribe.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/api/newsletters/unsubscribe/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase.rpc('unsubscribe_via_token', {
    p_token_hash: hashToken(token),
  })

  if (error) return NextResponse.json({ error: 'rpc_failed' }, { status: 500 })
  return NextResponse.json({ ok: data?.ok ?? false })
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 })
  return NextResponse.redirect(new URL(`/unsubscribe/${token}`, url.origin), 302)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/test/api/newsletters/unsubscribe.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/newsletters/unsubscribe/route.ts apps/web/test/api/newsletters/unsubscribe.test.ts
git commit -m "feat: RFC 8058 one-click unsubscribe endpoint — POST + GET fallback"
```

---

## Phase 3: CMS Newsletter UI (Tasks 11–17)

> Build the CMS admin interface: nav config, dashboard, editor, preview, server actions.

---

### Task 11: CMS nav config update

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/layout.tsx`

- [ ] **Step 1: Add Newsletter and Queue sections to CMS_CONFIG**

In `apps/web/src/app/cms/(authed)/layout.tsx`, find the `CMS_CONFIG` object and add two new section entries after the existing sections:

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

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/layout.tsx
git commit -m "feat(cms): add Newsletter + Queue nav sections to CMS sidebar"
```

---

### Task 12: Newsletter server actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`
- Create: `apps/web/test/app/cms-newsletter-actions.test.ts`

- [ ] **Step 1: Write the test**

Create `apps/web/test/app/cms-newsletter-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: vi.fn().mockResolvedValue({ siteId: 's1' }),
}))

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({
    siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR', primaryDomain: 'localhost',
  }),
}))

const fromMock = vi.fn()
const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null })

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('../../lib/email/service', () => ({
  getEmailService: () => ({
    send: vi.fn().mockResolvedValue({ messageId: 'msg_1', provider: 'resend' }),
  }),
}))

import {
  saveEdition,
  sendTestEmail,
  cancelEdition,
} from '../../src/app/cms/(authed)/newsletters/actions'

describe('newsletter actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'ed1', site_id: 's1', status: 'draft', newsletter_type_id: 'main-pt' },
            error: null,
          }),
          single: vi.fn().mockResolvedValue({
            data: { id: 'ed1', site_id: 's1', status: 'draft' },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ data: null, error: null }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'ed1' },
            error: null,
          }),
        }),
      }),
    })
  })

  it('saveEdition returns ok for valid input', async () => {
    const result = await saveEdition('ed1', {
      subject: 'Test Newsletter',
      content_mdx: '# Hello',
    })
    expect(result.ok).toBe(true)
  })

  it('cancelEdition sets status to cancelled', async () => {
    const result = await cancelEdition('ed1')
    expect(result.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/app/cms-newsletter-actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/cms/(authed)/newsletters/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteAdminForRow } from '@/lib/cms/auth-guards'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs'
import { getEmailService } from '../../../../lib/email/service'

type ActionResult =
  | { ok: true; editionId?: string }
  | { ok: false; error: string }

async function requireEditionAdmin(editionId: string) {
  // Same pattern as blog/campaign actions: look up row → check site permission
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('newsletter_editions')
    .select('site_id')
    .eq('id', editionId)
    .maybeSingle()
  if (!data) throw new Error('not_found')
  await requireSiteScope({ area: 'cms', siteId: data.site_id, mode: 'edit' })
  return { siteId: data.site_id, supabase }
}

export async function saveEdition(
  editionId: string,
  patch: { subject?: string; preheader?: string; content_mdx?: string; segment?: string },
): Promise<ActionResult> {
  const { siteId, supabase } = await requireEditionAdmin(editionId)
  const { error } = await supabase
    .from('newsletter_editions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}

export async function createEdition(
  newsletterTypeId: string,
  subject: string,
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()
  // Get authenticated user from cookie-based client (not service-role)
  const { createServerClient } = await import('@/lib/supabase/server')
  const userClient = await createServerClient()
  const { data: { user } } = await userClient.auth.getUser()
  const { data, error } = await supabase
    .from('newsletter_editions')
    .insert({
      site_id: ctx.siteId,
      newsletter_type_id: newsletterTypeId,
      subject,
      status: 'draft',
      created_by: user?.id,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true, editionId: data.id }
}

export async function scheduleEdition(
  editionId: string,
  scheduledAt: string,
): Promise<ActionResult> {
  const { supabase } = await requireEditionAdmin(editionId)
  const { error } = await supabase
    .from('newsletter_editions')
    .update({ status: 'scheduled', scheduled_at: scheduledAt })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}

export async function cancelEdition(editionId: string): Promise<ActionResult> {
  const { supabase } = await requireEditionAdmin(editionId)
  const { error } = await supabase
    .from('newsletter_editions')
    .update({ status: 'cancelled' })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  return { ok: true }
}

export async function sendTestEmail(editionId: string): Promise<ActionResult> {
  const { supabase } = await requireEditionAdmin(editionId)
  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('subject, content_html, content_mdx, newsletter_type_id')
    .eq('id', editionId)
    .single()
  if (!edition) return { ok: false, error: 'not_found' }

  const { data: type } = await supabase
    .from('newsletter_types')
    .select('sender_name, sender_email')
    .eq('id', edition.newsletter_type_id)
    .single()

  const senderName = type?.sender_name ?? 'Thiago Figueiredo'
  const senderEmail = type?.sender_email ?? 'newsletter@bythiagofigueiredo.com'

  // Get user email from cookie-based client (not service-role)
  const { createServerClient } = await import('@/lib/supabase/server')
  const userClient = await createServerClient()
  const { data: { user } } = await userClient.auth.getUser()
  const toEmail = user?.email
  if (!toEmail) return { ok: false, error: 'no_user_email' }

  const html = edition.content_html ?? `<p>${edition.content_mdx ?? ''}</p>`

  const emailService = getEmailService()
  await emailService.send({
    from: { name: senderName, email: senderEmail },
    to: toEmail,
    subject: `[TEST] ${edition.subject}`,
    html,
  })

  await supabase
    .from('newsletter_editions')
    .update({ test_sent_at: new Date().toISOString() })
    .eq('id', editionId)

  return { ok: true }
}

export async function assignToSlot(
  editionId: string,
  slotDate: string,
): Promise<ActionResult> {
  const { supabase } = await requireEditionAdmin(editionId)
  const { error } = await supabase
    .from('newsletter_editions')
    .update({
      status: 'queued',
      slot_date: slotDate,
      queue_position: null,
    })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  revalidatePath('/cms/content-queue')
  return { ok: true }
}

export async function unslotEdition(editionId: string): Promise<ActionResult> {
  const { supabase } = await requireEditionAdmin(editionId)
  const { error } = await supabase
    .from('newsletter_editions')
    .update({
      status: 'ready',
      slot_date: null,
      scheduled_at: null,
    })
    .eq('id', editionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters')
  revalidatePath('/cms/content-queue')
  return { ok: true }
}

export async function updateCadence(
  typeId: string,
  patch: { cadence_days?: number; preferred_send_time?: string; cadence_paused?: boolean },
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('newsletter_types')
    .update(patch)
    .eq('id', typeId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/newsletters/settings')
  revalidatePath('/cms/content-queue')
  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/test/app/cms-newsletter-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/actions.ts apps/web/test/app/cms-newsletter-actions.test.ts
git commit -m "feat(cms): newsletter server actions — save, create, schedule, cancel, test, slot"
```

---

### Task 13: Newsletter dashboard page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/page.tsx`

- [ ] **Step 1: Create the dashboard page**

Create `apps/web/src/app/cms/(authed)/newsletters/page.tsx`:

```tsx
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function NewsletterDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>
}) {
  const ctx = await getSiteContext()
  const params = await searchParams
  const supabase = getSupabaseServiceClient()

  const { data: types } = await supabase
    .from('newsletter_types')
    .select('id, name, locale, color, cadence_days, last_sent_at, cadence_paused')
    .eq('active', true)
    .order('sort_order')

  let editionsQuery = supabase
    .from('newsletter_editions')
    .select('id, subject, status, newsletter_type_id, slot_date, scheduled_at, sent_at, send_count, stats_opens, stats_delivered, created_at')
    .eq('site_id', ctx.siteId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (params.type) editionsQuery = editionsQuery.eq('newsletter_type_id', params.type)
  if (params.status) editionsQuery = editionsQuery.eq('status', params.status)

  const { data: editions } = await editionsQuery

  const statuses = ['draft', 'ready', 'queued', 'scheduled', 'sending', 'sent', 'failed', 'cancelled']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Newsletter Editions</h1>
        <Link
          href="/cms/newsletters/new"
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          data-testid="new-edition-btn"
        >
          New Edition
        </Link>
      </div>

      {/* Type cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(types ?? []).map((t) => (
          <Link
            key={t.id}
            href={`/cms/newsletters?type=${t.id}`}
            className="rounded-lg border p-4 hover:border-orange-400 transition-colors"
            style={{ borderLeftColor: t.color, borderLeftWidth: 4 }}
          >
            <div className="font-medium">{t.name}</div>
            <div className="text-sm text-gray-500">
              {t.cadence_paused ? 'Paused' : `Every ${t.cadence_days}d`}
              {' · '}
              {t.locale}
            </div>
          </Link>
        ))}
      </div>

      {/* Filters */}
      <form className="flex gap-3">
        <select name="type" defaultValue={params.type ?? ''} className="rounded border px-3 py-1.5 text-sm">
          <option value="">All types</option>
          {(types ?? []).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ''} className="rounded border px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="rounded bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200">
          Filter
        </button>
      </form>

      {/* Editions table */}
      <table className="w-full text-sm">
        <thead className="border-b text-left text-gray-500">
          <tr>
            <th className="pb-2">Subject</th>
            <th className="pb-2">Type</th>
            <th className="pb-2">Status</th>
            <th className="pb-2">Slot</th>
            <th className="pb-2">Sent</th>
            <th className="pb-2">Opens</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(editions ?? []).map((e) => {
            const openRate = e.stats_delivered > 0
              ? Math.round((e.stats_opens / e.stats_delivered) * 100)
              : 0
            return (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="py-2">
                  <Link href={`/cms/newsletters/${e.id}/edit`} className="text-orange-600 hover:underline">
                    {e.subject}
                  </Link>
                </td>
                <td className="py-2">{e.newsletter_type_id}</td>
                <td className="py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.status === 'sent' ? 'bg-green-100 text-green-700' :
                    e.status === 'failed' ? 'bg-red-100 text-red-700' :
                    e.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {e.status}
                  </span>
                </td>
                <td className="py-2">{e.slot_date ?? '—'}</td>
                <td className="py-2">{e.send_count > 0 ? e.send_count : '—'}</td>
                <td className="py-2">{e.stats_delivered > 0 ? `${openRate}%` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {(editions ?? []).length === 0 && (
        <p className="text-center text-gray-400 py-8">No editions yet. Create your first one!</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/page.tsx
git commit -m "feat(cms): newsletter dashboard page — type cards, filters, editions table"
```

---

### Task 14: Newsletter edition editor page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/[id]/edit/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/newsletters/new/page.tsx`

- [ ] **Step 1: Create new edition page (redirect to editor)**

Create `apps/web/src/app/cms/(authed)/newsletters/new/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export default async function NewEditionPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const ctx = await getSiteContext()
  const params = await searchParams
  const typeId = params.type ?? 'main-pt'
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('newsletter_editions')
    .insert({
      site_id: ctx.siteId,
      newsletter_type_id: typeId,
      subject: 'Untitled Edition',
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  redirect(`/cms/newsletters/${data.id}/edit`)
}
```

- [ ] **Step 2: Create editor page**

Create `apps/web/src/app/cms/(authed)/newsletters/[id]/edit/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { saveEdition, sendTestEmail, scheduleEdition, cancelEdition } from '../../actions'

export const dynamic = 'force-dynamic'

export default async function EditEditionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('*, newsletter_types(name, color, sender_name, sender_email)')
    .eq('id', id)
    .maybeSingle()

  if (!edition || edition.site_id !== ctx.siteId) return notFound()

  const { data: subscriberCount } = await supabase
    .from('newsletter_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_id', edition.newsletter_type_id)
    .eq('status', 'confirmed')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{edition.subject || 'Untitled'}</h1>
          <p className="text-sm text-gray-500">
            {edition.newsletter_types?.name} ·{' '}
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              edition.status === 'sent' ? 'bg-green-100 text-green-700' :
              edition.status === 'draft' ? 'bg-gray-100 text-gray-600' :
              'bg-blue-100 text-blue-700'
            }`}>
              {edition.status}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {edition.status === 'draft' && (
            <form action={async () => {
              'use server'
              await sendTestEmail(id)
            }}>
              <button className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
                Send Test
              </button>
            </form>
          )}
          {['draft', 'ready'].includes(edition.status) && (
            <form action={async () => {
              'use server'
              await scheduleEdition(id, new Date(Date.now() + 3600_000).toISOString())
            }}>
              <button className="rounded bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700">
                Schedule
              </button>
            </form>
          )}
          {!['sent', 'cancelled'].includes(edition.status) && (
            <form action={async () => {
              'use server'
              await cancelEdition(id)
            }}>
              <button className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Editor form */}
      <form action={async (formData: FormData) => {
        'use server'
        await saveEdition(id, {
          subject: formData.get('subject') as string,
          preheader: formData.get('preheader') as string,
          content_mdx: formData.get('content_mdx') as string,
        })
      }}>
        <div className="space-y-4">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium mb-1">Subject</label>
            <input
              id="subject"
              name="subject"
              defaultValue={edition.subject}
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="preheader" className="block text-sm font-medium mb-1">Preheader</label>
            <input
              id="preheader"
              name="preheader"
              defaultValue={edition.preheader ?? ''}
              placeholder="Preview text shown in inbox..."
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="content_mdx" className="block text-sm font-medium mb-1">Content (MDX)</label>
            <textarea
              id="content_mdx"
              name="content_mdx"
              defaultValue={edition.content_mdx ?? ''}
              rows={20}
              className="w-full rounded border px-3 py-2 font-mono text-sm"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Audience: ~{subscriberCount ?? 0} subscribers
            </span>
            <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
              Save Draft
            </button>
          </div>
        </div>
      </form>

      {/* Preview iframe */}
      {edition.content_html && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Preview</h2>
          <iframe
            src={`/api/newsletters/${id}/preview`}
            className="w-full rounded border"
            style={{ height: 600 }}
            title="Newsletter Preview"
          />
        </div>
      )}

      {/* Test send gate */}
      {edition.test_sent_at && (
        <p className="text-xs text-green-600">
          Test sent: {new Date(edition.test_sent_at).toLocaleString()}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/new/page.tsx \
       apps/web/src/app/cms/\(authed\)/newsletters/\[id\]/edit/page.tsx
git commit -m "feat(cms): newsletter new + editor pages — subject/preheader/content MDX + preview"
```

---

### Task 15: Preview API endpoint

**Files:**
- Create: `apps/web/src/app/api/newsletters/[id]/preview/route.ts`

- [ ] **Step 1: Create the preview route**

Create `apps/web/src/app/api/newsletters/[id]/preview/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('content_html, content_mdx, subject, site_id')
    .eq('id', id)
    .maybeSingle()

  if (!edition) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Auth gate: only staff who can view this site's content
  const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs')
  try {
    await requireSiteScope({ area: 'cms', siteId: edition.site_id, mode: 'view' })
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const html = edition.content_html ?? wrapBasicHtml(edition.content_mdx ?? '', edition.subject)

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function wrapBasicHtml(mdx: string, subject: string): string {
  const escaped = mdx
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${subject}</title>
<style>body{font-family:system-ui;max-width:640px;margin:2rem auto;padding:0 1rem;}</style>
</head><body><pre style="white-space:pre-wrap;">${escaped}</pre></body></html>`
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/newsletters/\[id\]/preview/route.ts
git commit -m "feat: newsletter preview API — renders edition HTML for CMS iframe"
```

---

### Task 15b: React Email newsletter template

**Files:**
- Create: `apps/web/src/emails/newsletter.tsx`
- Create: `apps/web/src/emails/components/email-header.tsx`
- Create: `apps/web/src/emails/components/email-footer.tsx`

- [ ] **Step 1: Create email header component**

Create `apps/web/src/emails/components/email-header.tsx`:

```tsx
import { Section, Text } from '@react-email/components'

interface EmailHeaderProps {
  typeName: string
  typeColor: string
}

export function EmailHeader({ typeName, typeColor }: EmailHeaderProps) {
  return (
    <Section style={{ borderBottom: `3px solid ${typeColor}`, paddingBottom: 16, marginBottom: 24 }}>
      <Text style={{ fontSize: 14, color: '#666', margin: 0 }}>{typeName}</Text>
    </Section>
  )
}
```

- [ ] **Step 2: Create email footer component**

Create `apps/web/src/emails/components/email-footer.tsx`:

```tsx
import { Section, Text, Link } from '@react-email/components'

interface EmailFooterProps {
  unsubscribeUrl: string
  archiveUrl: string
}

export function EmailFooter({ unsubscribeUrl, archiveUrl }: EmailFooterProps) {
  return (
    <Section style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #eee' }}>
      <Text style={{ fontSize: 12, color: '#999', margin: 0 }}>
        <Link href={archiveUrl} style={{ color: '#999' }}>View in browser</Link>
        {' · '}
        <Link href={unsubscribeUrl} style={{ color: '#999' }}>Unsubscribe</Link>
      </Text>
    </Section>
  )
}
```

- [ ] **Step 3: Create main newsletter template**

Create `apps/web/src/emails/newsletter.tsx`:

```tsx
import { Html, Head, Body, Container, Preview, Section, Text } from '@react-email/components'
import { EmailHeader } from './components/email-header'
import { EmailFooter } from './components/email-footer'

interface NewsletterProps {
  subject: string
  preheader?: string
  contentHtml: string
  typeName: string
  typeColor: string
  unsubscribeUrl: string
  archiveUrl: string
}

export function Newsletter({
  subject,
  preheader,
  contentHtml,
  typeName,
  typeColor,
  unsubscribeUrl,
  archiveUrl,
}: NewsletterProps) {
  return (
    <Html>
      <Head />
      {preheader && <Preview>{preheader}</Preview>}
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px', backgroundColor: '#fff' }}>
          <EmailHeader typeName={typeName} typeColor={typeColor} />
          <Section dangerouslySetInnerHTML={{ __html: contentHtml }} />
          <EmailFooter unsubscribeUrl={unsubscribeUrl} archiveUrl={archiveUrl} />
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/emails/newsletter.tsx \
       apps/web/src/emails/components/email-header.tsx \
       apps/web/src/emails/components/email-footer.tsx
git commit -m "feat: React Email newsletter template — header, footer, main layout"
```

---

### Task 15c: Stats refresh RPC migration

**Files:**
- Create: `supabase/migrations/20260421000004_newsletter_stats_refresh_rpc.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260421000004_newsletter_stats_refresh_rpc.sql
-- RPC to batch-refresh stale newsletter edition stats from newsletter_sends

CREATE OR REPLACE FUNCTION public.refresh_newsletter_stats()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE newsletter_editions e
  SET
    stats_delivered = COALESCE(s.delivered, 0),
    stats_opens = COALESCE(s.opens, 0),
    stats_clicks = COALESCE(s.clicks, 0),
    stats_bounces = COALESCE(s.bounces, 0),
    stats_complaints = COALESCE(s.complaints, 0),
    stats_stale = false
  FROM (
    SELECT edition_id,
      COUNT(*) FILTER (WHERE status IN ('delivered','opened','clicked')) as delivered,
      COUNT(*) FILTER (WHERE status IN ('opened','clicked')) as opens,
      COUNT(*) FILTER (WHERE status = 'clicked') as clicks,
      COUNT(*) FILTER (WHERE status = 'bounced') as bounces,
      COUNT(*) FILTER (WHERE status = 'complained') as complaints
    FROM newsletter_sends
    WHERE edition_id IN (SELECT id FROM newsletter_editions WHERE stats_stale = true)
    GROUP BY edition_id
  ) s
  WHERE e.id = s.edition_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
```

- [ ] **Step 2: Validate locally**

Run: `npm run db:reset`
Expected: clean apply.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260421000004_newsletter_stats_refresh_rpc.sql
git commit -m "feat(db): add refresh_newsletter_stats RPC for debounced stats recalc"
```

---

### Task 16: Newsletter send cron route

**Files:**
- Create: `apps/web/src/app/api/cron/send-scheduled-newsletters/route.ts`
- Create: `apps/web/test/api/cron/send-scheduled-newsletters.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/api/cron/send-scheduled-newsletters.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setLogger, resetLogger } from '../../../lib/logger'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

const fromMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}))

vi.mock('../../../lib/email/service', () => ({
  getEmailService: () => ({
    send: vi.fn().mockResolvedValue({ messageId: 'msg_1', provider: 'resend' }),
  }),
}))

import { POST } from '../../../src/app/api/cron/send-scheduled-newsletters/route'

function req(secret?: string) {
  return new Request('http://localhost/api/cron/send-scheduled-newsletters', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

describe('POST /api/cron/send-scheduled-newsletters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setLogger({ info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never)
    rpcMock.mockResolvedValue({ data: true, error: null })
  })
  afterEach(() => { resetLogger() })

  it('returns 401 without auth', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it('returns 200 with no scheduled editions', async () => {
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            data: [],
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [{ id: 'ed1' }], error: null }),
        }),
      }),
    })
    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/api/cron/send-scheduled-newsletters.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/app/api/cron/send-scheduled-newsletters/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock } from '@/lib/logger'
import { getEmailService } from '../../../../../lib/email/service'
import * as Sentry from '@sentry/nextjs'

const JOB = 'send-scheduled-newsletters'
const LOCK_KEY = 'cron:send-newsletters'
const BATCH_SIZE = 100

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = crypto.randomUUID()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const { data: editions } = await supabase
      .from('newsletter_editions')
      .select('id, newsletter_type_id, subject, content_html, segment, site_id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())

    if (!editions?.length) return { status: 'ok' as const, sent: 0 }

    let totalSent = 0

    for (const edition of editions) {
      try {
        const sent = await sendEdition(supabase, edition)
        totalSent += sent
      } catch (err) {
        Sentry.captureException(err, {
          tags: { component: 'cron', job: JOB, editionId: edition.id },
        })
      }
    }

    return { status: 'ok' as const, sent: totalSent, editions: editions.length }
  })
}

async function sendEdition(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  edition: { id: string; newsletter_type_id: string; subject: string; content_html: string | null; segment: string; site_id: string },
): Promise<number> {
  // CAS: claim the edition
  const { data: claimed } = await supabase
    .from('newsletter_editions')
    .update({ status: 'sending' })
    .eq('id', edition.id)
    .eq('status', 'scheduled')
    .select('id')

  if (!claimed?.length) return 0

  // Resolve audience
  let subQuery = supabase
    .from('newsletter_subscriptions')
    .select('email')
    .eq('newsletter_id', edition.newsletter_type_id)
    .eq('status', 'confirmed')

  const { data: subscribers } = await subQuery

  if (!subscribers?.length) {
    await supabase.from('newsletter_editions').update({ status: 'sent', sent_at: new Date().toISOString(), send_count: 0 }).eq('id', edition.id)
    return 0
  }

  // Seed send rows (idempotent)
  const sendRows = subscribers.map((s) => ({
    edition_id: edition.id,
    subscriber_email: s.email,
    status: 'queued',
  }))

  await supabase.from('newsletter_sends').upsert(sendRows, {
    onConflict: 'edition_id,subscriber_email',
    ignoreDuplicates: true,
  })

  // Get unsent sends
  const { data: unsent } = await supabase
    .from('newsletter_sends')
    .select('id, subscriber_email')
    .eq('edition_id', edition.id)
    .is('resend_message_id', null)

  if (!unsent?.length) {
    await supabase.from('newsletter_editions').update({ status: 'sent', sent_at: new Date().toISOString(), send_count: subscribers.length }).eq('id', edition.id)
    return subscribers.length
  }

  // Get sender config
  const { data: type } = await supabase
    .from('newsletter_types')
    .select('sender_name, sender_email, max_bounce_rate_pct')
    .eq('id', edition.newsletter_type_id)
    .single()

  const senderName = type?.sender_name ?? 'Thiago Figueiredo'
  const senderEmail = type?.sender_email ?? 'newsletter@bythiagofigueiredo.com'
  const maxBounceRate = type?.max_bounce_rate_pct ?? 5
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

  // Render HTML once via React Email (same for all recipients)
  const { render } = await import('@react-email/render')
  const { Newsletter } = await import('@/emails/newsletter')
  const html = edition.content_html ?? await render(Newsletter({
    subject: edition.subject,
    preheader: '',
    contentHtml: `<p>${edition.subject}</p>`,
    typeName: edition.newsletter_type_id,
    typeColor: '#e97316',
    unsubscribeUrl: `${appUrl}/api/newsletters/unsubscribe?token=PLACEHOLDER`,
    archiveUrl: `${appUrl}/newsletter/archive/${edition.id}`,
  }))

  // Pre-generate unsubscribe tokens for all subscribers
  // Uses existing unsubscribe_tokens table (same as newsletter confirm flow)
  const tokenMap = new Map<string, string>()
  for (const send of unsent) {
    const rawToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '')
    const tokenHash = (await import('crypto')).createHash('sha256').update(rawToken).digest('hex')
    await supabase.from('unsubscribe_tokens').insert({
      site_id: edition.site_id,
      email: send.subscriber_email,
      token: tokenHash,
    }).then(() => {}, () => {})
    tokenMap.set(send.subscriber_email, rawToken)
  }

  const emailService = getEmailService()
  let sentCount = 0
  let bounceCount = 0

  // Send in batches (100/batch matching Resend batch.send limit)
  for (let i = 0; i < unsent.length; i += BATCH_SIZE) {
    const batch = unsent.slice(i, i + BATCH_SIZE)

    for (const send of batch) {
      try {
        const unsubToken = tokenMap.get(send.subscriber_email) ?? ''
        const result = await emailService.send({
          from: { name: senderName, email: senderEmail },
          to: send.subscriber_email,
          subject: edition.subject,
          html,
          metadata: {
            headers: {
              'List-Unsubscribe': `<${appUrl}/api/newsletters/unsubscribe?token=${unsubToken}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          },
        })

        await supabase.from('newsletter_sends').update({
          resend_message_id: result.messageId,
          status: 'sent',
        }).eq('id', send.id)

        sentCount++
      } catch {
        bounceCount++
      }
    }

    // Check bounce rate after each batch
    if (sentCount > 0 && (bounceCount / sentCount) * 100 > maxBounceRate) {
      await supabase.from('newsletter_editions').update({ status: 'failed' }).eq('id', edition.id)
      return sentCount
    }
  }

  // Finalize
  await supabase.from('newsletter_editions').update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    send_count: sentCount,
  }).eq('id', edition.id)

  // Update last_sent_at on newsletter_type
  await supabase.from('newsletter_types').update({
    last_sent_at: new Date().toISOString(),
  }).eq('id', edition.newsletter_type_id)

  return sentCount
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/test/api/cron/send-scheduled-newsletters.test.ts`
Expected: PASS.

- [ ] **Step 5: Add to vercel.json**

In `apps/web/vercel.json`, add to the crons array:

```json
{ "path": "/api/cron/send-scheduled-newsletters", "schedule": "0 8 * * *" }
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/cron/send-scheduled-newsletters/route.ts \
       apps/web/test/api/cron/send-scheduled-newsletters.test.ts \
       apps/web/vercel.json
git commit -m "feat: newsletter send cron — batch send with CAS, crash recovery, bounce auto-pause"
```

---

### Task 17: Content queue server actions + page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/content-queue/actions.ts`
- Create: `apps/web/src/app/cms/(authed)/content-queue/page.tsx`

- [ ] **Step 1: Create content queue actions**

Create `apps/web/src/app/cms/(authed)/content-queue/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function assignBlogToSlot(postId: string, slotDate: string): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_posts')
    .update({ status: 'queued', slot_date: slotDate, queue_position: null })
    .eq('id', postId)
    .eq('site_id', ctx.siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/content-queue')
  revalidatePath('/cms/blog')
  return { ok: true }
}

export async function unslotBlogPost(postId: string): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_posts')
    .update({ status: 'ready', slot_date: null })
    .eq('id', postId)
    .eq('site_id', ctx.siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/content-queue')
  revalidatePath('/cms/blog')
  return { ok: true }
}

export async function publishBlogNow(postId: string): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('site_id', ctx.siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/content-queue')
  revalidatePath('/cms/blog')
  return { ok: true }
}

export async function markBlogReady(postId: string): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_posts')
    .update({ status: 'ready' })
    .eq('id', postId)
    .eq('site_id', ctx.siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/content-queue')
  revalidatePath('/cms/blog')
  return { ok: true }
}

export async function reorderBacklog(
  items: { id: string; position: number }[],
): Promise<ActionResult> {
  const supabase = getSupabaseServiceClient()
  for (const item of items) {
    await supabase
      .from('blog_posts')
      .update({ queue_position: item.position })
      .eq('id', item.id)
  }
  revalidatePath('/cms/content-queue')
  return { ok: true }
}

export async function updateBlogCadence(
  locale: string,
  patch: { cadence_days?: number; preferred_send_time?: string; cadence_paused?: boolean },
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_cadence')
    .upsert({
      site_id: ctx.siteId,
      locale,
      ...patch,
    }, { onConflict: 'site_id,locale' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/content-queue')
  return { ok: true }
}
```

- [ ] **Step 2: Create content queue page**

Create `apps/web/src/app/cms/(authed)/content-queue/page.tsx`:

```tsx
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { generateSlots } from '@/lib/content-queue/slots'
import Link from 'next/link'
import { assignBlogToSlot, publishBlogNow, unslotBlogPost } from './actions'

export const dynamic = 'force-dynamic'

export default async function ContentQueuePage() {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  // Fetch blog backlog (ready, not slotted)
  const { data: backlog } = await supabase
    .from('blog_posts')
    .select('id, status, queue_position, created_at, blog_translations(title, locale)')
    .eq('site_id', ctx.siteId)
    .in('status', ['ready', 'draft'])
    .is('slot_date', null)
    .order('queue_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(50)

  // Fetch queued/scheduled blog posts
  const { data: slotted } = await supabase
    .from('blog_posts')
    .select('id, status, slot_date, queue_position, blog_translations(title, locale)')
    .eq('site_id', ctx.siteId)
    .in('status', ['queued', 'scheduled'])
    .not('slot_date', 'is', null)
    .order('slot_date', { ascending: true })
    .limit(50)

  // Fetch newsletter editions in queue
  const { data: nlEditions } = await supabase
    .from('newsletter_editions')
    .select('id, subject, status, slot_date, newsletter_type_id')
    .eq('site_id', ctx.siteId)
    .in('status', ['ready', 'queued', 'scheduled'])
    .order('slot_date', { ascending: true, nullsFirst: false })
    .limit(50)

  // Fetch cadence configs
  const { data: blogCadences } = await supabase
    .from('blog_cadence')
    .select('*')
    .eq('site_id', ctx.siteId)

  const { data: nlTypes } = await supabase
    .from('newsletter_types')
    .select('id, name, locale, cadence_days, cadence_start_date, cadence_paused, last_sent_at')
    .eq('active', true)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Content Queue</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Backlog */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Backlog</h2>
          {(backlog ?? []).length === 0 ? (
            <p className="text-gray-400 text-sm">No items in backlog. Mark posts as &quot;Ready&quot; to add them here.</p>
          ) : (
            <ul className="space-y-2">
              {(backlog ?? []).map((post) => {
                const title = post.blog_translations?.[0]?.title ?? 'Untitled'
                return (
                  <li key={post.id} className="flex items-center justify-between rounded border p-3">
                    <div>
                      <Link href={`/cms/blog/${post.id}/edit`} className="font-medium text-orange-600 hover:underline text-sm">
                        {title}
                      </Link>
                      <span className="ml-2 text-xs text-gray-400">{post.status}</span>
                    </div>
                    <form action={async () => {
                      'use server'
                      await publishBlogNow(post.id)
                    }}>
                      <button className="text-xs text-gray-500 hover:text-orange-600">Publish now</button>
                    </form>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Timeline */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Scheduled</h2>
          <ul className="space-y-2">
            {(slotted ?? []).map((post) => {
              const title = post.blog_translations?.[0]?.title ?? 'Untitled'
              return (
                <li key={post.id} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <span className="text-xs font-mono text-gray-400 mr-2">{post.slot_date}</span>
                    <Link href={`/cms/blog/${post.id}/edit`} className="font-medium text-sm">
                      {title}
                    </Link>
                  </div>
                  <form action={async () => {
                    'use server'
                    await unslotBlogPost(post.id)
                  }}>
                    <button className="text-xs text-gray-500 hover:text-red-600">Unslot</button>
                  </form>
                </li>
              )
            })}
            {(nlEditions ?? []).filter(e => e.slot_date).map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded border border-blue-100 p-3">
                <div>
                  <span className="text-xs font-mono text-gray-400 mr-2">{e.slot_date}</span>
                  <Link href={`/cms/newsletters/${e.id}/edit`} className="font-medium text-sm text-blue-600">
                    {e.subject}
                  </Link>
                  <span className="ml-2 text-xs text-blue-400">{e.newsletter_type_id}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/content-queue/actions.ts \
       apps/web/src/app/cms/\(authed\)/content-queue/page.tsx
git commit -m "feat(cms): content queue page + actions — backlog, slot timeline, blog cadence"
```

---

## Phase 4: Analytics + Subscribers + Settings + Crons (Tasks 18–23)

> Build remaining CMS pages and operational cron jobs.

---

### Task 18: Newsletter analytics page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/[id]/analytics/page.tsx`
- Create: `apps/web/lib/newsletter/stats.ts`

- [ ] **Step 1: Create stats refresh helper**

Create `apps/web/lib/newsletter/stats.ts`:

```typescript
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function refreshStaleStats(): Promise<number> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase.rpc('refresh_newsletter_stats')
  return data ?? 0
}

export function parseUserAgent(ua: string): { client: string; device: string } {
  const lc = ua.toLowerCase()
  const client =
    lc.includes('gmail') ? 'Gmail' :
    lc.includes('apple') || lc.includes('webkit') ? 'Apple Mail' :
    lc.includes('outlook') || lc.includes('microsoft') ? 'Outlook' :
    lc.includes('thunderbird') ? 'Thunderbird' :
    'Other'
  const device =
    lc.includes('mobile') || lc.includes('android') || lc.includes('iphone') ? 'Mobile' :
    lc.includes('tablet') || lc.includes('ipad') ? 'Tablet' :
    'Desktop'
  return { client, device }
}
```

- [ ] **Step 2: Create analytics page**

Create `apps/web/src/app/cms/(authed)/newsletters/[id]/analytics/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { parseUserAgent } from '@/lib/newsletter/stats'

export const dynamic = 'force-dynamic'

export default async function EditionAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!edition || edition.site_id !== ctx.siteId) return notFound()
  if (edition.status !== 'sent') return notFound()

  // Refresh stats if stale (calls the RPC from Task 15c migration)
  if (edition.stats_stale) {
    await supabase.rpc('refresh_newsletter_stats')
    // Re-fetch edition with fresh stats
    const { data: refreshed } = await supabase
      .from('newsletter_editions')
      .select('stats_delivered, stats_opens, stats_clicks, stats_bounces, stats_complaints')
      .eq('id', id)
      .single()
    if (refreshed) Object.assign(edition, refreshed)
  }

  // Fetch clicks via join (no N+1 — single query)
  const { data: clicks } = await supabase
    .from('newsletter_click_events')
    .select('url, send_id!inner(edition_id)')
    .eq('send_id.edition_id', id)

  // Aggregate click URLs
  const clickMap = new Map<string, number>()
  for (const c of clicks ?? []) {
    clickMap.set(c.url, (clickMap.get(c.url) ?? 0) + 1)
  }
  const topLinks = [...clickMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // User agent breakdown
  const { data: opens } = await supabase
    .from('newsletter_sends')
    .select('open_user_agent')
    .eq('edition_id', id)
    .not('open_user_agent', 'is', null)
    .limit(1000)

  const clientCounts = new Map<string, number>()
  const deviceCounts = new Map<string, number>()
  for (const o of opens ?? []) {
    if (!o.open_user_agent) continue
    const parsed = parseUserAgent(o.open_user_agent)
    clientCounts.set(parsed.client, (clientCounts.get(parsed.client) ?? 0) + 1)
    deviceCounts.set(parsed.device, (deviceCounts.get(parsed.device) ?? 0) + 1)
  }

  const d = edition.stats_delivered || 1
  const openRate = Math.round((edition.stats_opens / d) * 100)
  const clickRate = Math.round((edition.stats_clicks / d) * 100)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{edition.subject}</h1>
      <p className="text-sm text-gray-500">Sent {new Date(edition.sent_at!).toLocaleString()} · {edition.send_count} recipients</p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Delivered" value={edition.stats_delivered} />
        <KpiCard label="Opened" value={edition.stats_opens} pct={openRate} />
        <KpiCard label="Clicked" value={edition.stats_clicks} pct={clickRate} />
        <KpiCard label="Bounced" value={edition.stats_bounces} />
      </div>

      {/* Click heatmap */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Top Links</h2>
        {topLinks.length === 0 ? (
          <p className="text-gray-400 text-sm">No clicks yet.</p>
        ) : (
          <ul className="space-y-1">
            {topLinks.map(([url, count]) => (
              <li key={url} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-gray-400 w-8 text-right">{count}</span>
                <span className="truncate text-gray-700">{url}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Email client breakdown */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Email Clients</h2>
        <div className="flex gap-4">
          {[...clientCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => (
            <span key={name} className="text-sm">
              {name}: <strong>{count}</strong>
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}

function KpiCard({ label, value, pct }: { label: string; value: number; pct?: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-sm text-gray-500">
        {label}
        {pct !== undefined && <span className="ml-1 text-gray-400">({pct}%)</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/newsletter/stats.ts \
       apps/web/src/app/cms/\(authed\)/newsletters/\[id\]/analytics/page.tsx
git commit -m "feat(cms): newsletter analytics page — KPIs, click heatmap, email client breakdown"
```

---

### Task 19: Subscribers page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/subscribers/page.tsx`

- [ ] **Step 1: Create subscribers page**

Create `apps/web/src/app/cms/(authed)/newsletters/subscribers/page.tsx`:

```tsx
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'

export const dynamic = 'force-dynamic'

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; page?: string }>
}) {
  const ctx = await getSiteContext()
  const params = await searchParams
  const page = parseInt(params.page ?? '1', 10)
  const perPage = 50
  const offset = (page - 1) * perPage
  const supabase = getSupabaseServiceClient()

  let query = supabase
    .from('newsletter_subscriptions')
    .select('id, email, status, newsletter_id, subscribed_at, confirmed_at, tracking_consent, welcome_sent', { count: 'exact' })
    .eq('site_id', ctx.siteId)
    .order('subscribed_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (params.type) query = query.eq('newsletter_id', params.type)
  if (params.status) query = query.eq('status', params.status)

  const { data: subs, count } = await query

  const totalPages = Math.ceil((count ?? 0) / perPage)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Subscribers</h1>
      <p className="text-sm text-gray-500">{count ?? 0} total</p>

      {/* Filters */}
      <form className="flex gap-3">
        <select name="status" defaultValue={params.status ?? ''} className="rounded border px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending_confirmation">Pending</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="bounced">Bounced</option>
          <option value="complained">Complained</option>
        </select>
        <button type="submit" className="rounded bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200">Filter</button>
      </form>

      <table className="w-full text-sm">
        <thead className="border-b text-left text-gray-500">
          <tr>
            <th className="pb-2">Email</th>
            <th className="pb-2">Newsletter</th>
            <th className="pb-2">Status</th>
            <th className="pb-2">Tracking</th>
            <th className="pb-2">Subscribed</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(subs ?? []).map((s) => (
            <tr key={s.id}>
              <td className="py-2 font-mono text-xs">{s.email}</td>
              <td className="py-2">{s.newsletter_id}</td>
              <td className="py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${
                  s.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  s.status === 'bounced' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {s.status}
                </span>
              </td>
              <td className="py-2">{s.tracking_consent ? 'On' : 'Off'}</td>
              <td className="py-2 text-gray-500">{new Date(s.subscribed_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => (
            <a
              key={i}
              href={`/cms/newsletters/subscribers?page=${i + 1}${params.status ? `&status=${params.status}` : ''}`}
              className={`rounded px-3 py-1 text-sm ${page === i + 1 ? 'bg-orange-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {i + 1}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/subscribers/page.tsx
git commit -m "feat(cms): subscribers page — filterable list with pagination + tracking consent"
```

---

### Task 20: Newsletter settings page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/settings/page.tsx`

- [ ] **Step 1: Create settings page**

Create `apps/web/src/app/cms/(authed)/newsletters/settings/page.tsx`:

```tsx
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { updateCadence } from '../actions'

export const dynamic = 'force-dynamic'

export default async function NewsletterSettingsPage() {
  const supabase = getSupabaseServiceClient()
  const { data: types } = await supabase
    .from('newsletter_types')
    .select('*')
    .eq('active', true)
    .order('sort_order')

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Newsletter Settings</h1>

      {(types ?? []).map((t) => (
        <section key={t.id} className="rounded-lg border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
            <h2 className="text-lg font-semibold">{t.name}</h2>
            <span className="text-sm text-gray-400">{t.locale}</span>
            {t.cadence_paused && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Paused</span>
            )}
          </div>

          <form action={async (formData: FormData) => {
            'use server'
            await updateCadence(t.id, {
              cadence_days: parseInt(formData.get('cadence_days') as string, 10),
              preferred_send_time: formData.get('preferred_send_time') as string,
              cadence_paused: formData.get('cadence_paused') === 'true',
            })
          }} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Cadence (days)</label>
              <input
                name="cadence_days"
                type="number"
                min={1}
                max={365}
                defaultValue={t.cadence_days}
                className="w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Send time</label>
              <input
                name="preferred_send_time"
                type="time"
                defaultValue={t.preferred_send_time ?? '09:00'}
                className="w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Paused</label>
              <select name="cadence_paused" defaultValue={String(t.cadence_paused)} className="w-full rounded border px-3 py-2">
                <option value="false">Active</option>
                <option value="true">Paused</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <p className="text-xs text-gray-400 mb-2">
                Sender: {t.sender_name ?? 'Thiago Figueiredo'} &lt;{t.sender_email ?? 'newsletter@bythiagofigueiredo.com'}&gt;
                {t.reply_to && ` · Reply-to: ${t.reply_to}`}
              </p>
              <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
                Save
              </button>
            </div>
          </form>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/settings/page.tsx
git commit -m "feat(cms): newsletter settings page — per-type cadence, send time, pause control"
```

---

### Task 21: Web archive page

**Files:**
- Create: `apps/web/src/app/newsletter/archive/[id]/page.tsx`

- [ ] **Step 1: Create archive page**

Create `apps/web/src/app/newsletter/archive/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('newsletter_editions')
    .select('subject')
    .eq('id', id)
    .eq('status', 'sent')
    .maybeSingle()
  return { title: data?.subject ?? 'Newsletter' }
}

export default async function NewsletterArchivePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('subject, content_html, sent_at, newsletter_types(name, color)')
    .eq('id', id)
    .eq('status', 'sent')
    .maybeSingle()

  if (!edition) return notFound()

  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8">
        <p className="text-sm text-gray-500 mb-1">
          {edition.newsletter_types?.name} · {new Date(edition.sent_at!).toLocaleDateString()}
        </p>
        <h1 className="text-3xl font-bold">{edition.subject}</h1>
      </header>
      {/* Safe: content_html is generated server-side by React Email render
         from admin-authored MDX — never from user input */}
      {edition.content_html ? (
        <div dangerouslySetInnerHTML={{ __html: edition.content_html }} />
      ) : (
        <p className="text-gray-400">Content not available.</p>
      )}
    </article>
  )
}
```

- [ ] **Step 2: Extend sitemap enumerator**

In `apps/web/lib/seo/enumerator.ts`, add newsletter archive pages to `enumerateSiteRoutes`:

After the blog/campaign loops, add:

```typescript
// Newsletter archive (sent editions)
const { data: sentEditions } = await supabase
  .from('newsletter_editions')
  .select('id, sent_at')
  .eq('site_id', siteId)
  .eq('status', 'sent')
  .order('sent_at', { ascending: false })
  .limit(200)

for (const edition of sentEditions ?? []) {
  routes.push({
    url: `/newsletter/archive/${edition.id}`,
    lastModified: edition.sent_at ?? undefined,
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/newsletter/archive/\[id\]/page.tsx \
       apps/web/lib/seo/enumerator.ts
git commit -m "feat: newsletter web archive — public page + sitemap extension for sent editions"
```

---

### Task 22: LGPD tracking anonymization cron

**Files:**
- Create: `apps/web/src/app/api/cron/anonymize-newsletter-tracking/route.ts`
- Create: `apps/web/test/api/cron/anonymize-newsletter-tracking.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/api/cron/anonymize-newsletter-tracking.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setLogger, resetLogger } from '../../../lib/logger'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

const rpcMock = vi.fn()
vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ rpc: rpcMock, from: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnValue({
      lt: vi.fn().mockReturnValue({
        not: vi.fn().mockResolvedValue({ data: null, error: null, count: 5 }),
      }),
    }),
  }) }),
}))

import { POST } from '../../../src/app/api/cron/anonymize-newsletter-tracking/route'

function req(secret?: string) {
  return new Request('http://localhost/api/cron/anonymize-newsletter-tracking', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

describe('POST /api/cron/anonymize-newsletter-tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setLogger({ info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never)
    rpcMock.mockResolvedValue({ data: true, error: null })
  })
  afterEach(() => { resetLogger() })

  it('returns 401 without auth', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it('returns 200 on success', async () => {
    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Write the implementation**

Create `apps/web/src/app/api/cron/anonymize-newsletter-tracking/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock } from '@/lib/logger'

const JOB = 'anonymize-newsletter-tracking'
const LOCK_KEY = 'cron:anonymize-tracking'
const RETENTION_DAYS = 90

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = crypto.randomUUID()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString()

    const { count: sendsAnon } = await supabase
      .from('newsletter_sends')
      .update({ open_ip: null, open_user_agent: null })
      .lt('opened_at', cutoff)
      .not('open_ip', 'is', null)

    const { count: clicksAnon } = await supabase
      .from('newsletter_click_events')
      .update({ ip: null, user_agent: null })
      .lt('clicked_at', cutoff)
      .not('ip', 'is', null)

    return {
      status: 'ok' as const,
      sends_anonymized: sendsAnon ?? 0,
      clicks_anonymized: clicksAnon ?? 0,
    }
  })
}
```

- [ ] **Step 3: Add to vercel.json**

Add to crons array:

```json
{ "path": "/api/cron/anonymize-newsletter-tracking", "schedule": "0 4 * * *" }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run apps/web/test/api/cron/anonymize-newsletter-tracking.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/cron/anonymize-newsletter-tracking/route.ts \
       apps/web/test/api/cron/anonymize-newsletter-tracking.test.ts \
       apps/web/vercel.json
git commit -m "feat: LGPD tracking anonymization cron — 90-day PII retention for newsletter analytics"
```

---

### Task 23: Webhook purge cron

**Files:**
- Create: `apps/web/src/app/api/cron/purge-webhook-events/route.ts`

- [ ] **Step 1: Create the cron route**

Create `apps/web/src/app/api/cron/purge-webhook-events/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock } from '@/lib/logger'

const JOB = 'purge-webhook-events'
const LOCK_KEY = 'cron:purge-webhooks'

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = crypto.randomUUID()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString()

    const { count } = await supabase
      .from('webhook_events')
      .delete()
      .lt('processed_at', cutoff)

    return { status: 'ok' as const, purged: count ?? 0 }
  })
}
```

- [ ] **Step 2: Add to vercel.json**

Add to crons array:

```json
{ "path": "/api/cron/purge-webhook-events", "schedule": "0 5 * * 0" }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/cron/purge-webhook-events/route.ts apps/web/vercel.json
git commit -m "feat: webhook events purge cron — 30-day retention, weekly cleanup"
```

---

## Phase 5: Final Integration (Tasks 24–26)

> Run full test suite, update CLAUDE.md with new architecture, push migrations to prod.

---

### Task 24: Run full test suite + fix any failures

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Fix any TypeScript errors**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 3: Fix any lint/format issues**

If any test failures occur, fix them and commit:

```bash
git add -A
git commit -m "fix: resolve test failures after newsletter engine integration"
```

---

### Task 25: Update CLAUDE.md with newsletter architecture

- [ ] **Step 1: Add Newsletter CMS Engine section to CLAUDE.md**

Add a new section after the SEO section documenting the newsletter architecture:
- New tables (newsletter_editions, sends, click_events, webhook_events, blog_cadence)
- Modified tables (newsletter_types cadence columns, newsletter_subscriptions welcome_sent + tracking_consent)
- Content queue model (slot generation, status lifecycle)
- Cron jobs (send-scheduled-newsletters, anonymize-newsletter-tracking, purge-webhook-events)
- Feature flags (3 new)
- Environment variables (RESEND_API_KEY, RESEND_WEBHOOK_SECRET, NEWSLETTER_FROM_DOMAIN)

- [ ] **Step 2: Update roadmap reference**

In the Roadmap section, add this sprint as completed with date and summary.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with newsletter CMS engine architecture"
```

---

### Task 26: Push migrations to prod + verify

- [ ] **Step 1: Push all new migrations**

Run: `npm run db:push:prod`
Expected: All 3 migrations apply cleanly.

- [ ] **Step 2: Verify tables exist**

Via Supabase dashboard or CLI, verify:
- `newsletter_editions` table exists with correct columns
- `newsletter_sends` table exists with UNIQUE constraint
- `newsletter_click_events` table exists
- `webhook_events` table exists
- `blog_cadence` table exists
- `newsletter_types` has new cadence columns
- `newsletter_subscriptions` has `welcome_sent`, `tracking_consent`, no `brevo_contact_id`
- `campaigns` has no `brevo_list_id`, `brevo_template_id`

- [ ] **Step 3: Verify Resend env var**

Ensure `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET` are set in Vercel environment variables.

- [ ] **Step 4: Final commit tag**

```bash
git tag newsletter-engine-v1
```
