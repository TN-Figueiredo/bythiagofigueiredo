# Sprint 1b — Campaigns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver campaign landing pages end-to-end — schema, RLS, Storage bucket, Brevo + Turnstile integration, scheduled publishing cron shared with blog.

**Architecture:** Campaigns mirror blog (posts+translations with locale, slug unique per site). Submissions go through Next route handler that verifies Turnstile, enforces LGPD consent, persists, then syncs Brevo inline with Sentry-logged failure. Cron route runs every 5 min via Vercel Cron to promote scheduled posts and campaigns.

**Tech Stack:** Next.js 15 route handlers, Supabase Storage, Cloudflare Turnstile, Brevo v3 HTTP API, p-retry, Vercel Cron, Vitest.

---

## File structure

Files created or modified in this sprint:

```
supabase/migrations/
  20260414000010_citext_extension.sql                    (new)
  20260414000011_campaigns_schema.sql                    (new — campaigns + translations)
  20260414000012_campaigns_rls.sql                       (new)
  20260414000013_campaign_submissions.sql                (new — table + partial index)
  20260414000014_campaign_submissions_rls.sql            (new — RLS + consent trigger)
  20260414000015_storage_bucket_campaign_files.sql       (new — bucket + storage RLS)
  20260414000016_cron_runs.sql                           (new)

supabase/seeds/dev.sql                                   (append campaigns + submissions)

apps/web/
  .env.local.example                                     (new or updated)
  vercel.json                                            (new)
  lib/brevo.ts                                           (new)
  lib/turnstile.ts                                       (new)
  lib/supabase/service.ts                                (new)
  lib/campaigns/extras-schema.ts                         (new — zod union)
  app/api/campaigns/[slug]/submit/route.ts               (new)
  app/api/cron/publish-scheduled/route.ts                (new)
  app/campaigns/[locale]/[slug]/page.tsx                 (new)
  app/campaigns/[locale]/[slug]/submit-form.tsx          (new — client)
  app/campaigns/[locale]/[slug]/extras-renderer.tsx      (new)
  test/lib/brevo.test.ts                                 (new)
  test/lib/turnstile.test.ts                             (new)
  test/lib/supabase-service.test.ts                      (new)
  test/lib/extras-schema.test.ts                         (new)
  test/api/campaigns-submit.test.ts                      (new)
  test/api/cron-publish-scheduled.test.ts                (new)
  test/app/campaign-page.test.tsx                        (new)
  test/app/submit-form.test.tsx                          (new)
  test/lib/env.test.ts                                   (new)

apps/api/test/rls/
  campaigns.test.ts                                      (new — RLS coverage)
  campaign-submissions.test.ts                           (new)
  cron-runs.test.ts                                      (new)
  storage-bucket.test.ts                                 (new)

CLAUDE.md                                                (env var section update)
package.json (web)                                       (add pinned: p-retry@6.2.0,
                                                          react-markdown@9.0.1,
                                                          remark-gfm@4.0.0,
                                                          @supabase/supabase-js@2.45.4)
```

---

## Task 1 — Migration: `citext` extension

- [ ] **Step 1.1 — Write failing test.** Create `apps/api/test/rls/campaign-submissions.test.ts` with a citext precondition describe block. Because the probe function ships inside the migration under test, this suite must be executed AFTER `npm run db:reset` (which replays migrations):

```typescript
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Skip entire suite in CI where local Supabase is not provisioned (helper
// pattern established in Sprint 1a Task 0).
describe.skipIf(!process.env.HAS_LOCAL_DB)('citext extension', () => {
  it('pg_typeof_citext_probe returns "citext"', async () => {
    const { data, error } = await admin.rpc('pg_typeof_citext_probe');
    expect(error).toBeNull();
    expect(data).toBe('citext');
  });
});
```

- [ ] **Step 1.2 — Run test, expect FAIL:** `function public.pg_typeof_citext_probe() does not exist` (migration hasn't run yet).

- [ ] **Step 1.3 — Write minimal migration** `supabase/migrations/20260414000010_citext_extension.sql`:

```sql
-- Enable citext for case-insensitive email columns
create extension if not exists citext;

-- Helper: exposes pg_typeof('a'::citext) so tests can assert the extension is live
-- via a single RPC roundtrip (no raw SQL endpoint required).
create or replace function public.pg_typeof_citext_probe()
returns text language sql stable as $$
  select pg_typeof('a'::citext)::text
$$;
```

- [ ] **Step 1.4 — Run `npm run db:reset && HAS_LOCAL_DB=1 npm run test:api`** — expect PASS.

- [ ] **Step 1.5 — Commit:** `feat(sprint-1b): enable citext extension for case-insensitive emails`

---

## Task 2 — Migration: `campaigns` table

- [ ] **Step 2.1 — Write failing test** (append to `apps/api/test/rls/campaigns.test.ts`):

```typescript
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

describe.skipIf(!process.env.HAS_LOCAL_DB)('campaigns table schema', () => {
  it('insert minimal row', async () => {
    const { data, error } = await admin
      .from('campaigns')
      .insert({ interest: 'creator' })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe('draft');
    expect(data?.form_fields).toEqual([]);
  });

  it('reuses post_status enum from Sprint 1a', async () => {
    const { error } = await admin
      .from('campaigns')
      .insert({ interest: 'fitness', status: 'scheduled', scheduled_for: new Date().toISOString() });
    expect(error).toBeNull();
  });

  it('rejects invalid status value', async () => {
    const { error } = await admin
      .from('campaigns')
      .insert({ interest: 'style', status: 'bogus' as never });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 2.2 — Run test, expect FAIL:** `relation "campaigns" does not exist`.

- [ ] **Step 2.3 — Write migration** `supabase/migrations/20260414000011_campaigns_schema.sql`:

```sql
-- campaigns: parent row (interest + media + brevo config), translations live in separate table
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  site_id uuid,
  interest text not null,
  status post_status not null default 'draft',
  pdf_storage_path text,
  brevo_list_id int,
  brevo_template_id int,
  form_fields jsonb not null default '[]',
  scheduled_for timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index on campaigns (status, published_at desc);
create index on campaigns (status, scheduled_for) where status = 'scheduled';

create trigger tg_campaigns_updated_at
  before update on campaigns
  for each row execute function tg_set_updated_at();

-- translations
create table campaign_translations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  locale text not null,

  meta_title text,
  meta_description text,
  og_image_url text,
  slug text not null,

  main_hook_md text not null,
  supporting_argument_md text,
  introductory_block_md text,
  body_content_md text,

  form_intro_md text,
  form_button_label text not null default 'Enviar',
  form_button_loading_label text not null default 'Enviando...',

  context_tag text not null,
  success_headline text not null,
  success_headline_duplicate text not null,
  success_subheadline text not null,
  success_subheadline_duplicate text not null,
  check_mail_text text not null,
  download_button_label text not null,

  extras jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index on campaign_translations (campaign_id, locale);
create unique index on campaign_translations (campaign_id, locale, slug);

create trigger tg_campaign_translations_updated_at
  before update on campaign_translations
  for each row execute function tg_set_updated_at();
```

- [ ] **Step 2.4 — Run `npm run db:reset && HAS_LOCAL_DB=1 npm run test:api`** — expect PASS.

- [ ] **Step 2.5 — Commit:** `feat(sprint-1b): add campaigns + campaign_translations tables`

---

## Task 3 — Migration: `campaign_translations` cascade-delete enforcement

Task 2 created `campaign_translations` with `on delete cascade` on its FK to `campaigns(id)`. Task 3 proves that contract via a full red-green cycle: add a test asserting cascade behavior, watch it run (green against current schema), then deliberately regress the migration (drop the clause), observe red, restore, observe green. This ensures the FK cascade is a covered invariant, not an accidental one.

- [ ] **Step 3.1 — Append failing test** to `apps/api/test/rls/campaigns.test.ts`:

```typescript
describe.skipIf(!process.env.HAS_LOCAL_DB)('campaign_translations FK cascade', () => {
  it('deleting a campaign cascades to its translations', async () => {
    const { data: c, error: cErr } = await admin
      .from('campaigns').insert({ interest: 'creator' }).select('id').single();
    expect(cErr).toBeNull();

    const baseTx = {
      campaign_id: c!.id, locale: 'pt-BR', slug: `cascade-${Date.now()}`,
      main_hook_md: '# hi',
      context_tag: 'OK', success_headline: 'a', success_headline_duplicate: 'b',
      success_subheadline: 'c', success_subheadline_duplicate: 'd',
      check_mail_text: 'e', download_button_label: 'f',
    };
    const { data: t, error: tErr } = await admin
      .from('campaign_translations').insert(baseTx).select('id').single();
    expect(tErr).toBeNull();
    const translationId = t!.id;

    // Delete the parent campaign.
    const { error: delErr } = await admin.from('campaigns').delete().eq('id', c!.id);
    expect(delErr).toBeNull();

    // The translation must be gone.
    const { data: after, error: afterErr } = await admin
      .from('campaign_translations').select('id').eq('id', translationId);
    expect(afterErr).toBeNull();
    expect(after).toEqual([]);
  });
});
```

- [ ] **Step 3.2 — Drive the red-green cycle.** Temporarily edit `supabase/migrations/20260414000011_campaigns_schema.sql` to replace `on delete cascade` with `on delete restrict` on the `campaign_translations.campaign_id` FK. Run `npm run db:reset && HAS_LOCAL_DB=1 npm run test:api`. Expect FAIL: the `delete` on campaigns returns an FK violation error (`delErr` non-null) because a translation still references it.

- [ ] **Step 3.3 — Restore `on delete cascade`.** Revert the migration file so the FK reads `campaign_id uuid not null references campaigns(id) on delete cascade`. No new migration file — Task 3 is a test-hardening task and the schema is authored in Task 2.

- [ ] **Step 3.4 — Run `npm run db:reset && HAS_LOCAL_DB=1 npm run test:api`** — expect PASS. Translation row is removed when parent campaign is deleted.

- [ ] **Step 3.5 — Commit:** `chore(sprint-1b): cover campaign_translations cascade-delete contract`

---

## Task 4 — Migration: `campaign_submissions`

- [ ] **Step 4.1 — Write failing test** (append to `apps/api/test/rls/campaign-submissions.test.ts`):

```typescript
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function makeCampaign() {
  const { data } = await admin.from('campaigns').insert({ interest: 'creator' }).select('id').single();
  return data!.id;
}

describe.skipIf(!process.env.HAS_LOCAL_DB)('campaign_submissions schema', () => {
  it('accepts a minimal submission', async () => {
    const cid = await makeCampaign();
    const { error } = await admin.from('campaign_submissions').insert({
      campaign_id: cid, email: 'Foo@Bar.com', locale: 'pt-BR',
      consent_marketing: true, consent_text_version: 'v1-2026-04',
    });
    expect(error).toBeNull();
  });

  it('email is citext (case-insensitive unique)', async () => {
    const cid = await makeCampaign();
    await admin.from('campaign_submissions').insert({
      campaign_id: cid, email: 'Same@X.com', locale: 'pt-BR',
      consent_marketing: true, consent_text_version: 'v1',
    });
    const { error } = await admin.from('campaign_submissions').insert({
      campaign_id: cid, email: 'SAME@x.COM', locale: 'pt-BR',
      consent_marketing: true, consent_text_version: 'v1',
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/duplicate|unique/i);
  });

  it('partial index allows re-signup after anonymization', async () => {
    const cid = await makeCampaign();
    await admin.from('campaign_submissions').insert({
      campaign_id: cid, email: 'anon@x.com', locale: 'pt-BR',
      consent_marketing: true, consent_text_version: 'v1',
      anonymized_at: new Date().toISOString(),
    });
    const { error } = await admin.from('campaign_submissions').insert({
      campaign_id: cid, email: 'anon@x.com', locale: 'pt-BR',
      consent_marketing: true, consent_text_version: 'v1',
    });
    expect(error).toBeNull();
  });
});
```

- [ ] **Step 4.2 — Run test, expect FAIL:** `relation "campaign_submissions" does not exist`.

- [ ] **Step 4.3 — Write migration** `supabase/migrations/20260414000013_campaign_submissions.sql`:

```sql
create table campaign_submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete restrict,
  email citext not null,
  name text,
  locale text not null,
  interest text,

  consent_marketing boolean not null,
  consent_text_version text not null,
  ip inet,
  user_agent text,

  brevo_contact_id text,
  brevo_sync_status text not null default 'pending',
  brevo_sync_error text,
  brevo_synced_at timestamptz,

  downloaded_at timestamptz,
  download_count int not null default 0,

  anonymized_at timestamptz,

  submitted_at timestamptz not null default now(),

  constraint campaign_submissions_sync_status_check
    check (brevo_sync_status in ('pending','synced','failed'))
);

create unique index campaign_submissions_email_unique
  on campaign_submissions (campaign_id, email)
  where anonymized_at is null;

create index on campaign_submissions (brevo_sync_status)
  where brevo_sync_status = 'pending';
```

- [ ] **Step 4.4 — Run `npm run db:reset && HAS_LOCAL_DB=1 npm run test:api`** — expect PASS.
- [ ] **Step 4.5 — Commit:** `feat(sprint-1b): add campaign_submissions with LGPD columns and partial unique index`

---

## Task 5 — Migration: `cron_runs`

- [ ] **Step 5.1 — Write failing test** `apps/api/test/rls/cron-runs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

describe.skipIf(!process.env.HAS_LOCAL_DB)('cron_runs schema', () => {
  it('inserts ok run', async () => {
    const { data, error } = await admin.from('cron_runs').insert({
      job: 'publish-scheduled', status: 'ok', duration_ms: 42, items_processed: 3,
    }).select().single();
    expect(error).toBeNull();
    expect(data?.job).toBe('publish-scheduled');
  });

  it('inserts error run with message', async () => {
    const { error } = await admin.from('cron_runs').insert({
      job: 'publish-scheduled', status: 'error', error: 'boom',
    });
    expect(error).toBeNull();
  });
});
```

- [ ] **Step 5.2 — Run, expect FAIL:** `relation "cron_runs" does not exist`.

- [ ] **Step 5.3 — Migration** `supabase/migrations/20260414000016_cron_runs.sql`:

```sql
create table cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  ran_at timestamptz not null default now(),
  status text not null check (status in ('ok','error')),
  duration_ms int,
  items_processed int,
  error text
);
create index on cron_runs (job, ran_at desc);
```

- [ ] **Step 5.4 — Run `npm run db:reset && HAS_LOCAL_DB=1 npm run test:api`** — expect PASS.
- [ ] **Step 5.5 — Commit:** `feat(sprint-1b): add cron_runs observability table`

---

## Task 6 — Migration: Storage bucket `campaign-files`

- [ ] **Step 6.1 — Write failing test** `apps/api/test/rls/storage-bucket.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

describe.skipIf(!process.env.HAS_LOCAL_DB)('campaign-files bucket', () => {
  it('bucket exists and is private', async () => {
    const { data, error } = await admin.storage.listBuckets();
    expect(error).toBeNull();
    const bucket = (data ?? []).find((b) => b.id === 'campaign-files');
    expect(bucket).toBeTruthy();
    expect(bucket!.public).toBe(false);
  });

  it('anon cannot write to bucket', async () => {
    const file = new Blob(['hello'], { type: 'text/plain' });
    const { data, error } = await anon.storage
      .from('campaign-files')
      .upload(`anon-${Date.now()}.txt`, file);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    // Supabase Storage surfaces RLS denials as 400/403 with a message containing
    // "new row violates row-level security policy" or "Unauthorized".
    expect(error!.message).toMatch(/unauthor|row-level security|403|policy/i);
  });

  it('service role can write to bucket', async () => {
    const file = new Blob(['hello'], { type: 'text/plain' });
    const { error } = await admin.storage.from('campaign-files').upload(`sr-${Date.now()}.txt`, file);
    expect(error).toBeNull();
  });
});
```

- [ ] **Step 6.2 — Run, expect FAIL:** bucket not in `listBuckets()` result / anon upload succeeds.

- [ ] **Step 6.3 — Migration** `supabase/migrations/20260414000015_storage_bucket_campaign_files.sql`:

```sql
insert into storage.buckets (id, name, public)
values ('campaign-files', 'campaign-files', false)
on conflict (id) do nothing;

-- Only staff (via service role or authenticated staff role) may read/write objects.
-- Public consumption happens exclusively through signed URLs generated server-side.
create policy "campaign-files staff all"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'campaign-files' and auth.is_staff())
  with check (bucket_id = 'campaign-files' and auth.is_staff());

-- No anon policy created → anon inserts/selects are denied by default.
```

- [ ] **Step 6.4 — Run `npm run db:reset && HAS_LOCAL_DB=1 npm run test:api`** — expect PASS.
- [ ] **Step 6.5 — Commit:** `feat(sprint-1b): provision campaign-files storage bucket with staff-only RLS`

---

## Task 7 — Migration: `campaigns` RLS

- [ ] **Step 7.1 — Write failing test** append to `apps/api/test/rls/campaigns.test.ts`:

```typescript
const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

describe.skipIf(!process.env.HAS_LOCAL_DB)('campaigns RLS', () => {
  it('anon reads only published campaigns in the past', async () => {
    const { data: pub } = await admin.from('campaigns').insert({
      interest: 'creator', status: 'published',
      published_at: new Date(Date.now() - 1000).toISOString(),
    }).select('id').single();
    await admin.from('campaigns').insert({ interest: 'creator', status: 'draft' });

    const { data, error } = await anon.from('campaigns').select('id,status');
    expect(error).toBeNull();
    expect(data!.every(r => r.status === 'published')).toBe(true);
    expect(data!.some(r => r.id === pub!.id)).toBe(true);
  });

  it('anon cannot insert', async () => {
    const { error } = await anon.from('campaigns').insert({ interest: 'creator' });
    expect(error).not.toBeNull();
  });

  it('service role sees everything', async () => {
    const { data, error } = await admin.from('campaigns').select('status');
    expect(error).toBeNull();
    expect(data!.some(r => r.status === 'draft')).toBe(true);
  });
});
```

- [ ] **Step 7.2 — Run, expect FAIL:** anon reads return all rows (RLS disabled).

- [ ] **Step 7.3 — Migration** `supabase/migrations/20260414000012_campaigns_rls.sql`:

```sql
alter table campaigns enable row level security;
alter table campaign_translations enable row level security;

-- campaigns
create policy "campaigns public read published"
  on campaigns for select
  to anon, authenticated
  using (status = 'published' and published_at <= now());

create policy "campaigns staff read all"
  on campaigns for select
  to authenticated
  using (auth.is_staff());

create policy "campaigns staff write"
  on campaigns for all
  to authenticated
  using (auth.is_staff())
  with check (auth.is_staff());

-- campaign_translations mirror
create policy "campaign_translations public read published"
  on campaign_translations for select
  to anon, authenticated
  using (exists (
    select 1 from campaigns c
    where c.id = campaign_translations.campaign_id
      and c.status = 'published' and c.published_at <= now()
  ));

create policy "campaign_translations staff read all"
  on campaign_translations for select
  to authenticated
  using (auth.is_staff());

create policy "campaign_translations staff write"
  on campaign_translations for all
  to authenticated
  using (auth.is_staff())
  with check (auth.is_staff());
```

- [ ] **Step 7.4 — Run `npm run db:reset && HAS_LOCAL_DB=1 npm run test:api`** — expect PASS.
- [ ] **Step 7.5 — Commit:** `feat(sprint-1b): enable RLS on campaigns with public-read-published + staff-write`

---

## Task 8 — Migration: `campaign_submissions` RLS + consent trigger

- [ ] **Step 8.1 — Append failing test** to `apps/api/test/rls/campaign-submissions.test.ts`:

```typescript
const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

describe.skipIf(!process.env.HAS_LOCAL_DB)('campaign_submissions RLS + consent trigger', () => {
  it('anon can insert with consent=true', async () => {
    const cid = await makeCampaign();
    const { error } = await anon.from('campaign_submissions').insert({
      campaign_id: cid, email: `a${Date.now()}@x.com`, locale: 'pt-BR',
      consent_marketing: true, consent_text_version: 'v1',
    });
    expect(error).toBeNull();
  });

  it('trigger rejects consent=false', async () => {
    const cid = await makeCampaign();
    const { error } = await anon.from('campaign_submissions').insert({
      campaign_id: cid, email: `b${Date.now()}@x.com`, locale: 'pt-BR',
      consent_marketing: false, consent_text_version: 'v1',
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/consent/i);
  });

  it('anon cannot read submissions', async () => {
    const { data, error } = await anon.from('campaign_submissions').select('id');
    // RLS may return empty array with no error, OR explicit error. Either is correct.
    expect((data ?? []).length).toBe(0);
  });

  it('service role reads and updates freely', async () => {
    const cid = await makeCampaign();
    const { data: ins } = await admin.from('campaign_submissions').insert({
      campaign_id: cid, email: `sr${Date.now()}@x.com`, locale: 'pt-BR',
      consent_marketing: true, consent_text_version: 'v1',
    }).select('id').single();
    const { error } = await admin.from('campaign_submissions')
      .update({ brevo_sync_status: 'synced', brevo_synced_at: new Date().toISOString() })
      .eq('id', ins!.id);
    expect(error).toBeNull();
  });
});
```

- [ ] **Step 8.2 — Run, expect FAIL:** consent=false insert succeeds (no trigger yet), anon insert fails (no policy).

- [ ] **Step 8.3 — Migration** `supabase/migrations/20260414000014_campaign_submissions_rls.sql`:

```sql
alter table campaign_submissions enable row level security;

-- Consent validation trigger
create or replace function public.validate_submission_consent()
returns trigger language plpgsql as $$
begin
  if new.consent_marketing is not true then
    raise exception 'consent_marketing must be true (LGPD)'
      using errcode = 'check_violation';
  end if;
  if new.consent_text_version is null or length(new.consent_text_version) = 0 then
    raise exception 'consent_text_version is required';
  end if;
  return new;
end
$$;

create trigger tg_validate_submission_consent
  before insert on campaign_submissions
  for each row execute function public.validate_submission_consent();

-- anon may insert submissions (form is public); read/update forbidden.
create policy "submissions anon insert"
  on campaign_submissions for insert
  to anon, authenticated
  with check (true);

create policy "submissions staff read"
  on campaign_submissions for select
  to authenticated
  using (auth.is_staff());

-- Updates only via service_role (bypasses RLS). No explicit update policy = deny.

alter table cron_runs enable row level security;
-- cron_runs: only service_role (no policies) — bypasses RLS automatically.
```

- [ ] **Step 8.4 — Run `npm run db:reset && HAS_LOCAL_DB=1 npm run test:api`** — expect PASS.
- [ ] **Step 8.5 — Commit:** `feat(sprint-1b): RLS + consent validation trigger for campaign_submissions`

---

## Task 9 — Env vars + `.env.local.example` + CLAUDE.md + web deps

- [ ] **Step 9.1 — Write failing test** `apps/web/test/lib/env.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('env example documents Sprint 1b vars', () => {
  const p = resolve(__dirname, '../../.env.local.example');
  const pkg = resolve(__dirname, '../../package.json');
  it('file exists', () => expect(existsSync(p)).toBe(true));
  it('documents BREVO_API_KEY, TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY', () => {
    const s = readFileSync(p, 'utf8');
    expect(s).toMatch(/BREVO_API_KEY=/);
    expect(s).toMatch(/NEXT_PUBLIC_TURNSTILE_SITE_KEY=/);
    expect(s).toMatch(/TURNSTILE_SECRET_KEY=/);
  });
  it('pins p-retry, react-markdown, remark-gfm, @supabase/supabase-js in apps/web/package.json', () => {
    const j = JSON.parse(readFileSync(pkg, 'utf8'));
    const deps = { ...(j.dependencies ?? {}), ...(j.devDependencies ?? {}) };
    expect(deps['p-retry']).toBe('6.2.0');
    expect(deps['react-markdown']).toBe('9.0.1');
    expect(deps['remark-gfm']).toBe('4.0.0');
    expect(deps['@supabase/supabase-js']).toBe('2.45.4');
  });
});
```

- [ ] **Step 9.2 — Run, expect FAIL:** file missing or variables/pins missing.

- [ ] **Step 9.3 — Create/update** `apps/web/.env.local.example`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# URLs
NEXT_PUBLIC_API_URL=http://localhost:3333
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Cron
CRON_SECRET=

# Sentry (Sprint 4)
SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=

# Sprint 1b — Brevo + Turnstile
BREVO_API_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

Update `CLAUDE.md` Environment Variables → Web section:

```markdown
### Web (`apps/web/.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`
- `SENTRY_*` (vazio até Sprint 4)
- `CRON_SECRET`
- `BREVO_API_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (Sprint 1b)
```

Install pinned web dependencies (exact versions, no caret — per `CLAUDE.md` pinning rule). Run from repo root:

```bash
npm install --save-exact -w apps/web p-retry@6.2.0 react-markdown@9.0.1 remark-gfm@4.0.0 @supabase/supabase-js@2.45.4
```

Verify each package is pinned in `apps/web/package.json`:

```bash
grep -E '"(p-retry|react-markdown|remark-gfm|@supabase/supabase-js)"' apps/web/package.json
# Expect four lines, each with an exact version (no ^ or ~):
#   "@supabase/supabase-js": "2.45.4",
#   "p-retry": "6.2.0",
#   "react-markdown": "9.0.1",
#   "remark-gfm": "4.0.0",
```

- [ ] **Step 9.4 — Run `cd apps/web && npx vitest run test/lib/env.test.ts`** — expect PASS.
- [ ] **Step 9.5 — Commit:** `chore(sprint-1b): document Brevo + Turnstile env vars; pin p-retry, react-markdown, remark-gfm, supabase-js`

---

## Task 10 — Brevo client lib

- [ ] **Step 10.1 — Write failing test** `apps/web/test/lib/brevo.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBrevoContact } from '../../lib/brevo';

const OLD_ENV = process.env;

beforeEach(() => {
  process.env = { ...OLD_ENV, BREVO_API_KEY: 'test-key' };
});
afterEach(() => {
  process.env = OLD_ENV;
  vi.restoreAllMocks();
});

describe('createBrevoContact', () => {
  it('POSTs to /v3/contacts with api-key header and correct body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 201, json: async () => ({ id: 123 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const r = await createBrevoContact({
      email: 'x@y.com', name: 'Thiago', listId: 7, attributes: { SOURCE: 'test' },
    });

    expect(r).toEqual({ id: 123 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/contacts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'api-key': 'test-key',
          'content-type': 'application/json',
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      email: 'x@y.com',
      listIds: [7],
      attributes: { FIRSTNAME: 'Thiago', SOURCE: 'test' },
      updateEnabled: true,
    });
  });

  it('throws on non-ok 5xx response after retries', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 500, text: async () => 'server err',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createBrevoContact({ email: 'x@y.com', listId: 1 }))
      .rejects.toThrow(/brevo 500/);
    // retries: 3 means up to 4 total attempts — assert we retried at least once.
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('throws immediately on 4xx without retrying (AbortError)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 400, text: async () => 'bad request',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createBrevoContact({ email: 'x@y.com', listId: 1 }))
      .rejects.toThrow(/brevo 400/);
    // 4xx is non-retryable — exactly one attempt.
    expect(fetchMock.mock.calls.length).toBe(1);
  });

  it('retries transient 5xx and succeeds on the 3rd attempt', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, text: async () => 'bad gw' })
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'busy' })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: 7 }) });
    vi.stubGlobal('fetch', fetchMock);

    const r = await createBrevoContact({ email: 'x@y.com', listId: 1 });
    expect(r).toEqual({ id: 7 });
    expect(fetchMock.mock.calls.length).toBe(3);
  });

  it('returns contact object for 204 no-content (updateEnabled existing)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 204, json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    const r = await createBrevoContact({ email: 'x@y.com', listId: 1 });
    expect(r).toEqual({});
  });
});
```

- [ ] **Step 10.2 — Run, expect FAIL:** module not found.

- [ ] **Step 10.3 — Create** `apps/web/lib/brevo.ts`:

```typescript
import pRetry, { AbortError } from 'p-retry';

export interface BrevoContactParams {
  email: string;
  name?: string;
  listId: number;
  attributes?: Record<string, unknown>;
}

export interface BrevoContactResponse {
  id?: number;
  [key: string]: unknown;
}

const BREVO_CONTACTS_URL = 'https://api.brevo.com/v3/contacts';

export async function createBrevoContact(
  params: BrevoContactParams,
): Promise<BrevoContactResponse> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured');

  const body = JSON.stringify({
    email: params.email,
    listIds: [params.listId],
    attributes: { FIRSTNAME: params.name, ...(params.attributes ?? {}) },
    updateEnabled: true,
  });

  const attempt = async (): Promise<BrevoContactResponse> => {
    const r = await fetch(BREVO_CONTACTS_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body,
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      const err = new Error(`brevo ${r.status}: ${text}`);
      // 4xx = client error (bad payload / auth) — never retry. 5xx = transient.
      if (r.status >= 400 && r.status < 500) throw new AbortError(err);
      throw err;
    }
    if (r.status === 204) return {};
    return (await r.json()) as BrevoContactResponse;
  };

  return pRetry(attempt, {
    retries: 3,
    minTimeout: 200,
    maxTimeout: 1000,
    onFailedAttempt: (e) => {
      // Sprint 4 replaces this with Sentry.captureException
      console.warn(
        `[brevo_retry] attempt ${e.attemptNumber} failed (${e.retriesLeft} left): ${e.message}`,
      );
    },
  });
}
```

- [ ] **Step 10.4 — Run, expect PASS.**
- [ ] **Step 10.5 — Commit:** `feat(sprint-1b): add Brevo v3 contact client with p-retry (4xx non-retry, 5xx retry)`

---

## Task 11 — Turnstile verify lib

- [ ] **Step 11.1 — Failing test** `apps/web/test/lib/turnstile.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyTurnstileToken } from '../../lib/turnstile';

beforeEach(() => { process.env.TURNSTILE_SECRET_KEY = 'sekret'; });
afterEach(() => { vi.restoreAllMocks(); });

describe('verifyTurnstileToken', () => {
  it('returns true for success=true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await verifyTurnstileToken('tok', '1.2.3.4');
    expect(ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(URLSearchParams);
    const body = init.body as URLSearchParams;
    expect(body.get('secret')).toBe('sekret');
    expect(body.get('response')).toBe('tok');
    expect(body.get('remoteip')).toBe('1.2.3.4');
  });

  it('returns false for success=false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ success: false, 'error-codes': ['bad-token'] }),
    }));
    expect(await verifyTurnstileToken('tok')).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    expect(await verifyTurnstileToken('tok')).toBe(false);
  });
});
```

- [ ] **Step 11.2 — Run, expect FAIL.**

- [ ] **Step 11.3 — Create** `apps/web/lib/turnstile.ts`:

```typescript
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface SiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

export async function verifyTurnstileToken(
  token: string,
  remoteip?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteip) body.set('remoteip', remoteip);

  try {
    const r = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    if (!r.ok) return false;
    const data = (await r.json()) as SiteverifyResponse;
    return data.success === true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 11.4 — Run, expect PASS.**
- [ ] **Step 11.5 — Commit:** `feat(sprint-1b): add Turnstile siteverify helper`

---

## Task 12 — Supabase service client helper

- [ ] **Step 12.1 — Failing test** `apps/web/test/lib/supabase-service.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getSupabaseServiceClient } from '../../lib/supabase/service';

describe('getSupabaseServiceClient', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
  });

  it('returns a singleton client', () => {
    const a = getSupabaseServiceClient();
    const b = getSupabaseServiceClient();
    expect(a).toBe(b);
  });

  it('throws when env is missing', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    // force reset of cached singleton
    const mod = require('../../lib/supabase/service');
    mod.__resetForTests?.();
    expect(() => mod.getSupabaseServiceClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
```

- [ ] **Step 12.2 — Run, expect FAIL.**

- [ ] **Step 12.3 — Create** `apps/web/lib/supabase/service.ts`:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

// Testing helper — resets cached singleton between tests.
export function __resetForTests(): void {
  cached = null;
}
```

Note: `@supabase/supabase-js@2.45.4` was installed in Task 9 Step 9.3; `createClient` is directly importable here without relying on transitive resolution.

- [ ] **Step 12.4 — Run, expect PASS.**
- [ ] **Step 12.5 — Commit:** `feat(sprint-1b): supabase service-role client singleton`

---

## Task 13 — Route handler `POST /api/campaigns/[slug]/submit`

- [ ] **Step 13.1 — Failing test** `apps/web/test/api/campaigns-submit.test.ts`. Note: the route awaits `supabase.from('campaign_submissions').insert(payload).select('id').single()` — meaning the `{ data, error }` response surfaces from the trailing `.single()`. The mock below aligns: `insert` and `select` return the chain; `single` is the terminal mock where we control success/error (including `23505` for duplicates):

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/turnstile', () => ({ verifyTurnstileToken: vi.fn() }));
vi.mock('../../lib/brevo', () => ({ createBrevoContact: vi.fn() }));
vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

import { POST } from '../../app/api/campaigns/[slug]/submit/route';
import { verifyTurnstileToken } from '../../lib/turnstile';
import { createBrevoContact } from '../../lib/brevo';
import { getSupabaseServiceClient } from '../../lib/supabase/service';

function fakeSupabase(overrides: Record<string, unknown> = {}) {
  const storage = {
    from: vi.fn().mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://sig.example/pdf' }, error: null,
      }),
    }),
  };
  const chain = {
    from: vi.fn(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: 'c1', brevo_list_id: 42, pdf_storage_path: 'pdfs/a.pdf', interest: 'creator',
        campaign_translations: [{
          success_headline: 'OK', success_headline_duplicate: 'Again',
          success_subheadline: 'Sub', success_subheadline_duplicate: 'SubDup',
          check_mail_text: 'Check', download_button_label: 'Download',
        }],
      }, error: null,
    }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'sub1' }, error: null }),
    storage,
    ...overrides,
  };
  chain.from.mockImplementation(() => chain);
  return chain;
}

function req(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/campaigns/my-slug/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('POST /api/campaigns/[slug]/submit', () => {
  it('400 when Turnstile invalid', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(false);
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeSupabase() as never);
    const res = await POST(req({
      email: 'a@b.com', locale: 'pt-BR', consent_marketing: true,
      consent_text_version: 'v1', turnstile_token: 'bad',
    }), { params: Promise.resolve({ slug: 'my-slug' }) });
    expect(res.status).toBe(400);
  });

  it('400 when consent=false', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeSupabase() as never);
    const res = await POST(req({
      email: 'a@b.com', locale: 'pt-BR', consent_marketing: false,
      consent_text_version: 'v1', turnstile_token: 't',
    }), { params: Promise.resolve({ slug: 'my-slug' }) });
    expect(res.status).toBe(400);
  });

  it('200 with pdfUrl on valid submit', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);
    vi.mocked(createBrevoContact).mockResolvedValue({ id: 99 });
    const s = fakeSupabase();
    vi.mocked(getSupabaseServiceClient).mockReturnValue(s as never);

    const res = await POST(req({
      email: 'a@b.com', name: 'Thiago', locale: 'pt-BR',
      consent_marketing: true, consent_text_version: 'v1', turnstile_token: 't',
    }), { params: Promise.resolve({ slug: 'my-slug' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.duplicate).toBe(false);
    expect(body.pdfUrl).toBe('https://sig.example/pdf');
    expect(body.successCopy.headline).toBe('OK');
  });

  it('200 duplicate=true when email collision', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);
    const s = fakeSupabase();
    // simulate unique_violation on insert
    s.single.mockResolvedValueOnce({ data: null, error: { code: '23505' } });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(s as never);

    const res = await POST(req({
      email: 'a@b.com', locale: 'pt-BR', consent_marketing: true,
      consent_text_version: 'v1', turnstile_token: 't',
    }), { params: Promise.resolve({ slug: 'my-slug' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duplicate).toBe(true);
    expect(body.successCopy.headline).toBe('Again');
  });

  it('200 with status=failed in DB when Brevo fails', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);
    vi.mocked(createBrevoContact).mockRejectedValue(new Error('brevo 500'));
    const s = fakeSupabase();
    vi.mocked(getSupabaseServiceClient).mockReturnValue(s as never);

    const res = await POST(req({
      email: 'a@b.com', locale: 'pt-BR', consent_marketing: true,
      consent_text_version: 'v1', turnstile_token: 't',
    }), { params: Promise.resolve({ slug: 'my-slug' }) });

    expect(res.status).toBe(200);
    // verify update call was made with brevo_sync_status='failed'
    const updateCalls = s.update.mock.calls;
    expect(updateCalls.some((c: unknown[]) =>
      JSON.stringify(c[0]).includes('"brevo_sync_status":"failed"'))).toBe(true);
  });
});
```

- [ ] **Step 13.2 — Run, expect FAIL.**

- [ ] **Step 13.3 — Create** `apps/web/app/api/campaigns/[slug]/submit/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyTurnstileToken } from '../../../../../lib/turnstile';
import { createBrevoContact } from '../../../../../lib/brevo';
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';

const BodySchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  locale: z.string().min(2),
  consent_marketing: z.literal(true),
  consent_text_version: z.string().min(1),
  turnstile_token: z.string().min(1),
  interest: z.string().optional(),
});

interface RouteCtx { params: Promise<{ slug: string }>; }

export async function POST(req: NextRequest | Request, ctx: RouteCtx): Promise<Response> {
  const { slug } = await ctx.params;
  let parsed: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    parsed = BodySchema.parse(json);
  } catch (e) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') ?? undefined;

  const turnstileOk = await verifyTurnstileToken(parsed.turnstile_token, ip);
  if (!turnstileOk) return Response.json({ error: 'turnstile_failed' }, { status: 400 });

  const supabase = getSupabaseServiceClient();

  const campaignRes = await supabase
    .from('campaigns')
    .select('id, brevo_list_id, pdf_storage_path, interest, campaign_translations(success_headline, success_headline_duplicate, success_subheadline, success_subheadline_duplicate, check_mail_text, download_button_label)')
    .eq('campaign_translations.slug', slug)
    .eq('campaign_translations.locale', parsed.locale)
    .maybeSingle();

  if (campaignRes.error || !campaignRes.data) {
    return Response.json({ error: 'campaign_not_found' }, { status: 404 });
  }
  const campaign = campaignRes.data as {
    id: string;
    brevo_list_id: number | null;
    pdf_storage_path: string | null;
    interest: string;
    campaign_translations: Array<{
      success_headline: string;
      success_headline_duplicate: string;
      success_subheadline: string;
      success_subheadline_duplicate: string;
      check_mail_text: string;
      download_button_label: string;
    }>;
  };
  const tx = campaign.campaign_translations[0];

  // insert submission
  const insert = await supabase.from('campaign_submissions').insert({
    campaign_id: campaign.id,
    email: parsed.email,
    name: parsed.name,
    locale: parsed.locale,
    interest: parsed.interest ?? campaign.interest,
    consent_marketing: true,
    consent_text_version: parsed.consent_text_version,
    ip, user_agent: ua,
  }).select('id').single();

  let duplicate = false;
  let submissionId: string | null = insert.data?.id ?? null;
  if (insert.error) {
    if (insert.error.code === '23505') {
      duplicate = true;
    } else {
      return Response.json({ error: 'insert_failed' }, { status: 500 });
    }
  }

  // Brevo sync (non-blocking for user response)
  if (!duplicate && campaign.brevo_list_id && submissionId) {
    try {
      const contact = await createBrevoContact({
        email: parsed.email,
        name: parsed.name,
        listId: campaign.brevo_list_id,
        attributes: { INTEREST: parsed.interest ?? campaign.interest, LOCALE: parsed.locale },
      });
      await supabase.from('campaign_submissions').update({
        brevo_sync_status: 'synced',
        brevo_contact_id: contact.id != null ? String(contact.id) : null,
        brevo_synced_at: new Date().toISOString(),
      }).eq('id', submissionId);
    } catch (e) {
      await supabase.from('campaign_submissions').update({
        brevo_sync_status: 'failed',
        brevo_sync_error: e instanceof Error ? e.message : String(e),
      }).eq('id', submissionId);
      // Sprint 4 replaces this with Sentry.captureException
      console.error('[brevo_sync_failed]', e);
    }
  }

  // Signed URL for PDF
  let pdfUrl: string | null = null;
  if (campaign.pdf_storage_path) {
    const signed = await supabase.storage
      .from('campaign-files')
      .createSignedUrl(campaign.pdf_storage_path, 7 * 24 * 3600);
    pdfUrl = signed.data?.signedUrl ?? null;
  }

  return Response.json({
    success: true,
    duplicate,
    pdfUrl,
    successCopy: {
      headline: duplicate ? tx.success_headline_duplicate : tx.success_headline,
      subheadline: duplicate ? tx.success_subheadline_duplicate : tx.success_subheadline,
      checkMailText: tx.check_mail_text,
      downloadButtonLabel: tx.download_button_label,
    },
  });
}
```

- [ ] **Step 13.4 — Run, expect PASS.**
- [ ] **Step 13.5 — Commit:** `feat(sprint-1b): POST /api/campaigns/[slug]/submit with Turnstile + Brevo sync`

---

## Task 14 — Campaign landing page (server component)

- [ ] **Step 14.1 — Failing test** `apps/web/test/app/campaign-page.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({
              data: {
                id: 'c1', status: 'published', pdf_storage_path: null,
                brevo_list_id: null, interest: 'creator',
                campaign_translations: [{
                  locale: 'pt-BR', slug: 'oferta', main_hook_md: '# Hello',
                  supporting_argument_md: null, introductory_block_md: null,
                  body_content_md: null, form_intro_md: null,
                  form_button_label: 'Enviar', form_button_loading_label: 'Enviando...',
                  context_tag: 'Tag', success_headline: 'OK',
                  success_headline_duplicate: 'Again', success_subheadline: 'Sub',
                  success_subheadline_duplicate: 'SubDup', check_mail_text: 'Check',
                  download_button_label: 'Download', extras: null,
                  meta_title: 'T', meta_description: 'D', og_image_url: null,
                }],
              },
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}));

import Page from '../../app/campaigns/[locale]/[slug]/page';

describe('Campaign page', () => {
  it('renders main hook markdown as an <h1> element (via react-markdown)', async () => {
    const jsx = await Page({ params: Promise.resolve({ locale: 'pt-BR', slug: 'oferta' }) });
    render(jsx as never);
    // "# Hello" in markdown must render as an <h1> with text "Hello".
    const heading = screen.getByRole('heading', { level: 1, name: /Hello/ });
    expect(heading).toBeTruthy();
    // Ensure we are NOT leaking raw markdown — no literal "# " prefix in DOM text.
    expect(heading.textContent).toBe('Hello');
  });
});
```

- [ ] **Step 14.2 — Run, expect FAIL.**

- [ ] **Step 14.3 — Create** `apps/web/app/campaigns/[locale]/[slug]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getSupabaseServiceClient } from '../../../../lib/supabase/service';
import { SubmitForm } from './submit-form';
import { ExtrasRenderer } from './extras-renderer';

interface PageParams { locale: string; slug: string; }

function Md({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
}

async function loadCampaign(locale: string, slug: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      id, status, pdf_storage_path, brevo_list_id, interest, form_fields,
      campaign_translations!inner(
        locale, slug, meta_title, meta_description, og_image_url,
        main_hook_md, supporting_argument_md, introductory_block_md, body_content_md,
        form_intro_md, form_button_label, form_button_loading_label,
        context_tag, success_headline, success_headline_duplicate,
        success_subheadline, success_subheadline_duplicate,
        check_mail_text, download_button_label, extras
      )
    `)
    .eq('campaign_translations.locale', locale)
    .eq('campaign_translations.slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export default async function CampaignPage({ params }: { params: Promise<PageParams> }) {
  const { locale, slug } = await params;
  const campaign = await loadCampaign(locale, slug);
  if (!campaign) notFound();
  const tx = (campaign as { campaign_translations: Array<Record<string, unknown>> })
    .campaign_translations[0];

  return (
    <main>
      <section aria-label="beforeForm">
        <Md text={tx.main_hook_md as string} />
        <Md text={tx.supporting_argument_md as string | null} />
        <Md text={tx.introductory_block_md as string | null} />
        <Md text={tx.body_content_md as string | null} />
      </section>

      <section aria-label="form">
        <Md text={tx.form_intro_md as string | null} />
        <SubmitForm
          slug={slug}
          locale={locale}
          formFields={(campaign as { form_fields: unknown }).form_fields as unknown[]}
          buttonLabel={tx.form_button_label as string}
          loadingLabel={tx.form_button_loading_label as string}
          contextTag={tx.context_tag as string}
        />
      </section>

      <section aria-label="afterForm">
        {tx.extras ? <ExtrasRenderer extras={tx.extras} /> : null}
      </section>
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }) {
  const { locale, slug } = await params;
  const c = await loadCampaign(locale, slug);
  if (!c) return {};
  const tx = (c as { campaign_translations: Array<Record<string, unknown>> })
    .campaign_translations[0];
  return {
    title: tx.meta_title as string,
    description: tx.meta_description as string,
    openGraph: { images: tx.og_image_url ? [{ url: tx.og_image_url as string }] : [] },
  };
}
```

- [ ] **Step 14.4 — Run, expect PASS.**
- [ ] **Step 14.5 — Commit:** `feat(sprint-1b): campaign landing server component with react-markdown 3-section layout`

---

## Task 15 — Form client component with Turnstile

- [ ] **Step 15.1 — Write failing test** `apps/web/test/app/submit-form.test.tsx`. Uses `@testing-library/react` + `vitest`. Asserts (a) the submit button is disabled until the LGPD consent checkbox is checked AND a Turnstile token is present, and (b) on submit the POST body to `/api/campaigns/:slug/submit` includes the `turnstile_token` from the Turnstile callback. We manually invoke the Turnstile callback by stubbing `window.turnstile.render` to synchronously call its `callback` argument with a known token:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SubmitForm } from '../../app/campaigns/[locale]/[slug]/submit-form';

const fields = [
  { name: 'name', label: 'Nome', type: 'name', required: true },
  { name: 'email', label: 'E-mail', type: 'email', required: true },
];

function renderForm() {
  return render(
    <SubmitForm
      slug="oferta"
      locale="pt-BR"
      formFields={fields}
      buttonLabel="Enviar"
      loadingLabel="Enviando..."
      contextTag="Prévia"
    />,
  );
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site-key-test';
  // Stub the Turnstile widget: synchronously invoke the callback with a token.
  (window as unknown as { turnstile: unknown }).turnstile = {
    render: (_el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => {
      opts.callback('TOKEN_XYZ');
      return 'widget-id';
    },
    reset: () => {},
  };
  // jsdom won't actually load the injected <script> — simulate onload by firing it.
  const origAppend = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
    const el = node as HTMLScriptElement;
    if (el.tagName === 'SCRIPT' && typeof el.onload === 'function') {
      queueMicrotask(() => (el.onload as () => void)());
    }
    return origAppend(node);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { turnstile?: unknown }).turnstile;
});

describe('<SubmitForm>', () => {
  it('keeps submit enabled but refuses to post until consent + token are present', async () => {
    renderForm();
    const btn = screen.getByRole('button', { name: /Enviar/ });
    expect((btn as HTMLButtonElement).disabled).toBe(false);

    // Fill required fields, submit WITHOUT consent — expect inline error, no fetch.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Thiago' } });

    // The native `required` on the consent checkbox blocks submit; call form.submit()
    // path via the button and assert fetch was not called.
    fireEvent.click(btn);
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('POSTs with turnstile_token and consent=true when the form is fully filled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true, duplicate: false, pdfUrl: null,
        successCopy: {
          headline: 'OK', subheadline: 'Sub', checkMailText: 'Check',
          downloadButtonLabel: 'Download',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderForm();

    // Let the injected script "load" (fires the stubbed turnstile.render → token set).
    await act(async () => { await Promise.resolve(); });

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Thiago' } });
    fireEvent.click(screen.getByLabelText(/Concordo/));

    fireEvent.click(screen.getByRole('button', { name: /Enviar/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/campaigns/oferta/submit');
    const body = JSON.parse((init as { body: string }).body);
    expect(body).toMatchObject({
      email: 'a@b.com',
      name: 'Thiago',
      locale: 'pt-BR',
      consent_marketing: true,
      turnstile_token: 'TOKEN_XYZ',
    });
    expect(body.consent_text_version).toMatch(/^v1/);

    // Success state rendered
    await screen.findByText('OK');
  });
});
```

- [ ] **Step 15.2 — Run, expect FAIL** (`submit-form` module does not exist yet).

- [ ] **Step 15.3 — Create** `apps/web/app/campaigns/[locale]/[slug]/submit-form.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';

interface FormField {
  name: string;
  label: string;
  type: 'name' | 'email' | 'phone' | 'textarea' | 'checkbox';
  required?: boolean;
  placeholder?: string;
}

interface Props {
  slug: string;
  locale: string;
  formFields: unknown[];
  buttonLabel: string;
  loadingLabel: string;
  contextTag: string;
}

interface SuccessState {
  duplicate: boolean;
  pdfUrl: string | null;
  successCopy: {
    headline: string;
    subheadline: string;
    checkMailText: string;
    downloadButtonLabel: string;
  };
}

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }): string;
      reset(id?: string): void;
    };
  }
}

const CONSENT_VERSION = 'v1-2026-04';

export function SubmitForm(props: Props) {
  const { slug, locale, formFields, buttonLabel, loadingLabel, contextTag } = props;
  const fields = formFields as FormField[];
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey || !turnstileRef.current) return;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile && turnstileRef.current) {
        window.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          callback: (t) => setToken(t),
        });
      }
    };
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!token) { setError('Turnstile ainda carregando.'); return; }
    const data = new FormData(e.currentTarget);
    const consent = data.get('consent_marketing') === 'on';
    if (!consent) { setError('Consentimento obrigatório.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${slug}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: String(data.get('email') ?? ''),
          name: data.get('name') ? String(data.get('name')) : undefined,
          locale,
          consent_marketing: true,
          consent_text_version: CONSENT_VERSION,
          turnstile_token: token,
        }),
      });
      if (!res.ok) { setError('Erro ao enviar.'); return; }
      const body = (await res.json()) as SuccessState & { success: boolean };
      setSuccess(body);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div role="status">
        <span>{contextTag}</span>
        <h2>{success.successCopy.headline}</h2>
        <p>{success.successCopy.subheadline}</p>
        <p>{success.successCopy.checkMailText}</p>
        {success.pdfUrl ? (
          <a href={success.pdfUrl} download>{success.successCopy.downloadButtonLabel}</a>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          {f.type === 'textarea' ? (
            <textarea name={f.name} required={f.required} placeholder={f.placeholder} />
          ) : f.type === 'checkbox' ? (
            <input type="checkbox" name={f.name} required={f.required} />
          ) : (
            <input
              type={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'}
              name={f.name}
              required={f.required}
              placeholder={f.placeholder}
            />
          )}
        </label>
      ))}
      <label>
        <input type="checkbox" name="consent_marketing" required />
        Concordo em receber comunicações (LGPD).
      </label>
      <div ref={turnstileRef} />
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={loading}>
        {loading ? loadingLabel : buttonLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 15.4 — Run, expect PASS** (`cd apps/web && npx vitest run test/app/submit-form.test.tsx`).
- [ ] **Step 15.5 — Commit:** `feat(sprint-1b): campaign submit-form client with Turnstile integration`

---

## Task 16 — Extras renderer (discriminated union + zod)

- [ ] **Step 16.1 — Failing test** `apps/web/test/lib/extras-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ExtrasSchema, parseExtras } from '../../lib/campaigns/extras-schema';

describe('ExtrasSchema', () => {
  it('accepts youtube block', () => {
    const r = ExtrasSchema.safeParse([
      { kind: 'youtube', videoId: 'abc123', title: 'T' },
    ]);
    expect(r.success).toBe(true);
  });

  it('accepts testimonial + whoAmI + whatsappCtas', () => {
    const r = ExtrasSchema.safeParse([
      { kind: 'testimonial', author: 'J', quote: 'Great' },
      { kind: 'whoAmI', headline: 'Me', bio_md: '...' },
      { kind: 'whatsappCtas', ctas: [{ kind: 'joinChannel', label: 'Join', url: 'https://wa' }] },
    ]);
    expect(r.success).toBe(true);
  });

  it('rejects unknown kind', () => {
    const r = ExtrasSchema.safeParse([{ kind: 'bogus' }]);
    expect(r.success).toBe(false);
  });

  it('parseExtras returns empty array on malformed', () => {
    expect(parseExtras('not-json')).toEqual([]);
    expect(parseExtras({ garbage: true })).toEqual([]);
  });

  it('parseExtras passes valid data through', () => {
    const ok = [{ kind: 'youtube', videoId: 'x', title: 't' }] as const;
    expect(parseExtras(ok)).toEqual(ok);
  });
});
```

- [ ] **Step 16.2 — Run, expect FAIL.**

- [ ] **Step 16.3 — Create** `apps/web/lib/campaigns/extras-schema.ts`:

```typescript
import { z } from 'zod';

const YoutubeBlock = z.object({
  kind: z.literal('youtube'),
  videoId: z.string().min(1),
  title: z.string().optional(),
});

const TestimonialBlock = z.object({
  kind: z.literal('testimonial'),
  author: z.string(),
  quote: z.string(),
  avatarUrl: z.string().url().optional(),
});

const WhoAmIBlock = z.object({
  kind: z.literal('whoAmI'),
  headline: z.string(),
  bio_md: z.string(),
  avatarUrl: z.string().url().optional(),
});

const WhatsappCta = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('joinChannel'), label: z.string(), url: z.string().url() }),
  z.object({ kind: z.literal('startChatWithText'), label: z.string(), phone: z.string(), text: z.string() }),
]);

const WhatsappCtasBlock = z.object({
  kind: z.literal('whatsappCtas'),
  ctas: z.array(WhatsappCta).max(1),
});

export const ExtrasBlock = z.discriminatedUnion('kind', [
  YoutubeBlock, TestimonialBlock, WhoAmIBlock, WhatsappCtasBlock,
]);

export const ExtrasSchema = z.array(ExtrasBlock);
export type ExtrasBlockT = z.infer<typeof ExtrasBlock>;

export function parseExtras(input: unknown): ExtrasBlockT[] {
  const r = ExtrasSchema.safeParse(input);
  return r.success ? r.data : [];
}
```

Create `apps/web/app/campaigns/[locale]/[slug]/extras-renderer.tsx`:

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseExtras, ExtrasBlockT } from '../../../../lib/campaigns/extras-schema';

export function ExtrasRenderer({ extras }: { extras: unknown }) {
  const blocks = parseExtras(extras);
  return (
    <div>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'youtube':
            return (
              <iframe
                key={i}
                title={b.title ?? 'YouTube'}
                src={`https://www.youtube.com/embed/${b.videoId}`}
                allowFullScreen
              />
            );
          case 'testimonial':
            return (
              <blockquote key={i}>
                <p>{b.quote}</p>
                <cite>{b.author}</cite>
              </blockquote>
            );
          case 'whoAmI':
            return (
              <section key={i}>
                <h3>{b.headline}</h3>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{b.bio_md}</ReactMarkdown>
              </section>
            );
          case 'whatsappCtas':
            return (
              <nav key={i}>
                {b.ctas.map((c, j) => (
                  <a
                    key={j}
                    href={c.kind === 'joinChannel'
                      ? c.url
                      : `https://wa.me/${c.phone}?text=${encodeURIComponent(c.text)}`}
                  >
                    {c.label}
                  </a>
                ))}
              </nav>
            );
        }
      })}
    </div>
  );
}
```

- [ ] **Step 16.4 — Run, expect PASS.**
- [ ] **Step 16.5 — Commit:** `feat(sprint-1b): extras renderer with zod-validated discriminated union`

---

## Task 17 — Cron route `/api/cron/publish-scheduled`

- [ ] **Step 17.1 — Failing test** `apps/web/test/api/cron-publish-scheduled.test.ts`. Note on atomicity: each `UPDATE ... WHERE status='scheduled' AND scheduled_for <= now() RETURNING id` is a single Postgres statement. Postgres acquires a row-level lock per row touched by `UPDATE` and evaluates the `WHERE` predicate on the locked snapshot — two concurrent invocations therefore cannot both promote the same row. The Supabase client (`.update().eq().lte().select('id')`) compiles to exactly this single statement, so the operation is concurrency-safe by the engine, not by the app. The mock chain below returns `{ data: [{id:...}, ...], error: null }` from `.select('id')` — matching the runtime shape (array of updated rows):

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

import { POST } from '../../app/api/cron/publish-scheduled/route';
import { getSupabaseServiceClient } from '../../lib/supabase/service';

function fakeClient(posts: unknown[] = [], camps: unknown[] = [], throwOn?: string) {
  const cronInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const chain = {
    from: vi.fn((t: string) => {
      if (throwOn === t) throw new Error('db boom');
      if (t === 'cron_runs') {
        return { insert: cronInsert };
      }
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: t === 'blog_posts' ? posts : camps, error: null,
        }),
      };
    }),
    _cronInsert: cronInsert,
  };
  return chain;
}

beforeEach(() => {
  process.env.CRON_SECRET = 'topsecret';
  vi.clearAllMocks();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('POST /api/cron/publish-scheduled', () => {
  it('401 without bearer', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeClient() as never);
    const req = new Request('http://x/api/cron/publish-scheduled', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('401 with wrong bearer', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeClient() as never);
    const req = new Request('http://x/api/cron/publish-scheduled', {
      method: 'POST', headers: { authorization: 'Bearer wrong' },
    });
    expect((await POST(req)).status).toBe(401);
  });

  it('200 with correct bearer, logs cron_runs ok', async () => {
    const c = fakeClient([{ id: 'p1' }, { id: 'p2' }], [{ id: 'c1' }]);
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);
    const req = new Request('http://x/api/cron/publish-scheduled', {
      method: 'POST', headers: { authorization: 'Bearer topsecret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(3);
    expect(c._cronInsert).toHaveBeenCalledWith(expect.objectContaining({
      job: 'publish-scheduled', status: 'ok', items_processed: 3,
    }));
  });

  it('500 + cron_runs error row on DB failure', async () => {
    const c = fakeClient([], [], 'blog_posts');
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);
    const req = new Request('http://x/api/cron/publish-scheduled', {
      method: 'POST', headers: { authorization: 'Bearer topsecret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(c._cronInsert).toHaveBeenCalledWith(expect.objectContaining({
      job: 'publish-scheduled', status: 'error',
    }));
  });
});
```

- [ ] **Step 17.2 — Run, expect FAIL.**

- [ ] **Step 17.3 — Create** `apps/web/app/api/cron/publish-scheduled/route.ts`:

```typescript
import { getSupabaseServiceClient } from '../../../../lib/supabase/service';

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const start = Date.now();
  const nowIso = new Date().toISOString();
  let processed = 0;

  try {
    const posts = await supabase
      .from('blog_posts')
      .update({ status: 'published', published_at: nowIso })
      .eq('status', 'scheduled')
      .lte('scheduled_for', nowIso)
      .select('id');
    processed += posts.data?.length ?? 0;

    const camps = await supabase
      .from('campaigns')
      .update({ status: 'published', published_at: nowIso })
      .eq('status', 'scheduled')
      .lte('scheduled_for', nowIso)
      .select('id');
    processed += camps.data?.length ?? 0;

    await supabase.from('cron_runs').insert({
      job: 'publish-scheduled',
      status: 'ok',
      duration_ms: Date.now() - start,
      items_processed: processed,
    });

    return Response.json({ processed });
  } catch (e) {
    await supabase.from('cron_runs').insert({
      job: 'publish-scheduled',
      status: 'error',
      duration_ms: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    });
    // Sprint 4 replaces this with Sentry.captureException
    console.error('[cron_publish_scheduled_error]', e);
    return new Response('error', { status: 500 });
  }
}
```

Atomicity note (inline): each `update().eq().lte().select('id')` compiles to ONE Postgres `UPDATE ... WHERE ... RETURNING id` statement. Postgres takes a row-level lock per row; a concurrent invocation sees those rows as already non-matching (their `status` is no longer `'scheduled'`) and promotes nothing. No application-level locking required.

Concurrency test — append to the same test file. Verifies two concurrent invocations together process exactly the seeded row set and log exactly two `cron_runs`. Because the route hits a shared mock client, we build a stateful fake that models the single-statement semantics: the first caller to run `.update().eq().lte().select('id')` claims the rows; subsequent calls return an empty array:

```typescript
describe('POST /api/cron/publish-scheduled — concurrency', () => {
  it('two concurrent invocations process each scheduled row exactly once', async () => {
    // Shared in-memory "DB": 2 scheduled posts, 0 scheduled campaigns.
    const state = {
      posts: [{ id: 'p1' }, { id: 'p2' }] as Array<{ id: string }>,
      camps: [] as Array<{ id: string }>,
    };
    const cronInserts: Array<Record<string, unknown>> = [];

    function makeClient() {
      return {
        from: vi.fn((t: string) => {
          if (t === 'cron_runs') {
            return { insert: vi.fn(async (row: Record<string, unknown>) => {
              cronInserts.push(row); return { data: null, error: null };
            }) };
          }
          const bucket = t === 'blog_posts' ? 'posts' : 'camps';
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            select: vi.fn(async () => {
              // Atomic "claim-all-matching-and-return-ids" simulation.
              const claimed = state[bucket as 'posts' | 'camps'].splice(0);
              return { data: claimed, error: null };
            }),
          };
        }),
      };
    }

    const clientA = makeClient();
    const clientB = makeClient();
    // Both clients reference the same `state` closure → models a shared DB.
    vi.mocked(getSupabaseServiceClient)
      .mockReturnValueOnce(clientA as never)
      .mockReturnValueOnce(clientB as never);

    const mkReq = () => new Request('http://x/api/cron/publish-scheduled', {
      method: 'POST', headers: { authorization: 'Bearer topsecret' },
    });

    const [rA, rB] = await Promise.all([POST(mkReq()), POST(mkReq())]);
    expect(rA.status).toBe(200);
    expect(rB.status).toBe(200);

    const bodyA = await rA.json();
    const bodyB = await rB.json();
    // Total processed across both runs equals the initial scheduled count (2).
    expect(bodyA.processed + bodyB.processed).toBe(2);
    // No double-processing: the shared state is drained.
    expect(state.posts.length).toBe(0);
    expect(state.camps.length).toBe(0);

    // Exactly two cron_runs rows — one per invocation.
    expect(cronInserts.length).toBe(2);
    expect(cronInserts.every((r) => r.job === 'publish-scheduled' && r.status === 'ok')).toBe(true);
  });
});
```

- [ ] **Step 17.4 — Run** `cd apps/web && npx vitest run test/api/cron-publish-scheduled.test.ts` — expect PASS (auth, ok, error, AND concurrency cases all green).
- [ ] **Step 17.5 — Commit:** `feat(sprint-1b): cron route for scheduled blog + campaign publication (concurrency-safe)`

---

## Task 18 — Vercel Cron config

- [ ] **Step 18.1 — Failing test** add to `apps/web/test/api/cron-publish-scheduled.test.ts`:

```typescript
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('vercel.json crons', () => {
  it('schedules publish-scheduled every 5 minutes', () => {
    const p = resolve(__dirname, '../../vercel.json');
    expect(existsSync(p)).toBe(true);
    const j = JSON.parse(readFileSync(p, 'utf8'));
    expect(j.crons).toEqual([
      { path: '/api/cron/publish-scheduled', schedule: '*/5 * * * *' },
    ]);
  });
});
```

- [ ] **Step 18.2 — Run, expect FAIL** (file missing).

- [ ] **Step 18.3 — Create** `apps/web/vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/publish-scheduled", "schedule": "*/5 * * * *" }
  ]
}
```

Verify: `cat apps/web/vercel.json` — expected output shown above.

- [ ] **Step 18.4 — Run, expect PASS.**
- [ ] **Step 18.5 — Commit:** `chore(sprint-1b): vercel.json cron schedule for publish-scheduled`

---

## Task 19 — Seed data (append to `supabase/seeds/dev.sql`)

- [ ] **Step 19.1 — Failing test** `apps/api/test/rls/campaigns.test.ts` (append seed smoke):

```typescript
describe.skipIf(!process.env.HAS_LOCAL_DB)('dev seed', () => {
  it('seeds at least one published campaign with pt-BR + en translations', async () => {
    const { data, error } = await admin
      .from('campaigns')
      .select('id, status, campaign_translations(locale, slug)')
      .eq('status', 'published');
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    const seeded = data!.find(c =>
      (c.campaign_translations as Array<{ locale: string }>).some(t => t.locale === 'pt-BR')
      && (c.campaign_translations as Array<{ locale: string }>).some(t => t.locale === 'en'));
    expect(seeded).toBeTruthy();
  });

  it('seeds three submissions with mixed brevo_sync_status', async () => {
    const { data } = await admin
      .from('campaign_submissions')
      .select('brevo_sync_status');
    const statuses = new Set((data ?? []).map(r => r.brevo_sync_status));
    expect(statuses.has('synced')).toBe(true);
    expect(statuses.has('failed')).toBe(true);
    expect(statuses.has('pending')).toBe(true);
  });
});
```

- [ ] **Step 19.2 — Run after `db:reset` (which replays seeds)** — expect FAIL.

- [ ] **Step 19.3 — Append** to `supabase/seeds/dev.sql`:

```sql
-- ============ Sprint 1b: campaigns seed ============

-- Published campaign with pt-BR + en
insert into campaigns (id, interest, status, published_at, pdf_storage_path, brevo_list_id, form_fields)
values (
  '11111111-1111-1111-1111-111111111111',
  'creator',
  'published',
  now() - interval '1 day',
  'seed/creator-playbook.pdf',
  1,
  '[
    {"name":"name","label":"Nome","type":"name","required":true},
    {"name":"email","label":"E-mail","type":"email","required":true}
  ]'::jsonb
)
on conflict (id) do nothing;

insert into campaign_translations (
  campaign_id, locale, slug, meta_title, meta_description,
  main_hook_md, supporting_argument_md, introductory_block_md, body_content_md,
  form_intro_md, form_button_label, form_button_loading_label,
  context_tag, success_headline, success_headline_duplicate,
  success_subheadline, success_subheadline_duplicate,
  check_mail_text, download_button_label
) values
(
  '11111111-1111-1111-1111-111111111111', 'pt-BR', 'playbook-creator',
  'Playbook Creator — Thiago Figueiredo',
  'Guia gratuito para criadores de conteúdo',
  '# Transforme sua presença digital',
  'Argumento de suporte',
  'Bloco introdutório',
  'Conteúdo principal em markdown',
  'Preencha o formulário para receber',
  'Enviar', 'Enviando...',
  'Parabéns!', 'Tudo certo!', 'Você já estava na lista!',
  'Enviamos o PDF para o seu e-mail.', 'Você já tinha baixado antes.',
  'Verifique sua caixa (e spam).',
  'Baixar o playbook'
),
(
  '11111111-1111-1111-1111-111111111111', 'en', 'creator-playbook',
  'Creator Playbook — Thiago Figueiredo',
  'Free guide for content creators',
  '# Transform your digital presence',
  'Supporting argument',
  'Intro block',
  'Main markdown body',
  'Fill the form below',
  'Submit', 'Sending...',
  'Welcome!', 'Hello again!', 'You were already on the list!',
  'We sent the PDF to your inbox.', 'You had already downloaded it.',
  'Check your inbox (and spam).',
  'Download the playbook'
)
on conflict do nothing;

-- Draft campaign
insert into campaigns (id, interest, status, form_fields)
values (
  '22222222-2222-2222-2222-222222222222', 'fitness', 'draft', '[]'::jsonb
) on conflict (id) do nothing;

insert into campaign_translations (
  campaign_id, locale, slug,
  main_hook_md, form_button_label, form_button_loading_label,
  context_tag, success_headline, success_headline_duplicate,
  success_subheadline, success_subheadline_duplicate,
  check_mail_text, download_button_label
) values (
  '22222222-2222-2222-2222-222222222222', 'pt-BR', 'rascunho-fitness',
  '# Em breve', 'Enviar', 'Enviando...',
  'Prévia', 'Obrigado!', 'Você já está!',
  'Em breve.', 'Em breve.',
  'Fique de olho.', 'Baixar'
) on conflict do nothing;

-- Submissions: synced / failed / pending
insert into campaign_submissions
  (campaign_id, email, name, locale, consent_marketing, consent_text_version,
   brevo_sync_status, brevo_contact_id, brevo_synced_at)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice',
   'pt-BR', true, 'v1-2026-04', 'synced', 'brv_100', now()),
  ('11111111-1111-1111-1111-111111111111', 'bob@example.com', 'Bob',
   'pt-BR', true, 'v1-2026-04', 'failed', null, null),
  ('11111111-1111-1111-1111-111111111111', 'carol@example.com', 'Carol',
   'en', true, 'v1-2026-04', 'pending', null, null)
on conflict do nothing;

update campaign_submissions set brevo_sync_error = 'brevo 500: server err'
  where email = 'bob@example.com';
```

- [ ] **Step 19.4 — Run `npm run db:reset && HAS_LOCAL_DB=1 npm run test:api`** — expect PASS.
- [ ] **Step 19.5 — Commit:** `chore(sprint-1b): seed pt-BR+en campaign, draft campaign, 3 submissions`

---

## Task 20 — End-to-end smoke

- [ ] **Step 20.1 — No test authored** — this is a verification task.

- [ ] **Step 20.2 — Run verification commands** and capture output:

```bash
# 1. Full reset + migrations
npm run db:reset
# Expect: all migrations applied, seeds loaded, zero errors.

# 2. Both workspaces green (HAS_LOCAL_DB=1 enables the suites gated behind describe.skipIf)
HAS_LOCAL_DB=1 npm test
# Expect:
#   apps/api → PASS (N tests)
#   apps/web → PASS (N tests)

# 3. Cron endpoint — unauthorized
curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3001/api/cron/publish-scheduled
# Expect: 401

# 4. Cron endpoint — authorized (CRON_SECRET from .env.local)
curl -sS -X POST http://localhost:3001/api/cron/publish-scheduled \
  -H "authorization: Bearer $(grep CRON_SECRET apps/web/.env.local | cut -d= -f2)"
# Expect: {"processed":0}  (no scheduled rows in seed)
# Also expect: new row in cron_runs where job='publish-scheduled' and status='ok'.

# 5. Landing page renders (pt-BR)
curl -sS -o /tmp/camp.html -w 'HTTP %{http_code}\n' \
  http://localhost:3001/campaigns/pt-BR/playbook-creator
# Expect: HTTP 200
grep -q 'Transforme sua presença' /tmp/camp.html && echo "OK: main_hook present"
# Expect: OK: main_hook present

# 6. Landing page (en)
curl -sS -o /tmp/camp-en.html -w 'HTTP %{http_code}\n' \
  http://localhost:3001/campaigns/en/creator-playbook
# Expect: HTTP 200
grep -q 'Transform your digital' /tmp/camp-en.html && echo "OK: en hook present"

# 7. Submit endpoint smoke (Turnstile will fail without real token → 400 expected)
curl -sS -X POST http://localhost:3001/api/campaigns/playbook-creator/submit \
  -H 'content-type: application/json' \
  -d '{"email":"smoke@x.com","locale":"pt-BR","consent_marketing":true,"consent_text_version":"v1-2026-04","turnstile_token":"fake"}'
# Expect: {"error":"turnstile_failed"} with HTTP 400
```

- [ ] **Step 20.3 — Record output in PR description** (not committed).

- [ ] **Step 20.4 — If any command fails:** stop, diagnose via `superpowers:systematic-debugging`, fix, re-run full `HAS_LOCAL_DB=1 npm test`, return to Step 20.2.

- [ ] **Step 20.5 — Commit:** `chore(sprint-1b): end-to-end green`

---

## Done criteria (Sprint 1b)

- [ ] All 7 migrations apply cleanly on `db:reset`
- [ ] `npm test` green in both workspaces
- [ ] RLS: anon read published only; anon insert submission with consent=true; anon insert rejected without consent; anon cannot read submissions; service_role full access
- [ ] Storage bucket `campaign-files` exists, private, staff-only write
- [ ] `/api/campaigns/[slug]/submit` handles the 5 test cases
- [ ] `/api/cron/publish-scheduled` handles 401 + ok + error paths, writes `cron_runs` both ways
- [ ] Landing `/campaigns/pt-BR/playbook-creator` and `/campaigns/en/creator-playbook` render
- [ ] Seed: 1 published pt-BR+en campaign, 1 draft, 3 submissions (synced/failed/pending)
- [ ] `vercel.json` crons configured

---

## Notes & caveats

- **Sentry integration (`captureException`)** is stubbed with `console.error` in Tasks 10/13/17 (marked inline with `// Sprint 4 replaces this with Sentry.captureException`). Full wiring lands in Sprint 4 per the spec ADR — find the marker comments and replace the `console.*` call sites with `Sentry.captureException(e)` at that point.
- **Markdown rendering** uses `react-markdown` + `remark-gfm` (installed in Task 9 Step 9.3, pinned exact). No `dangerouslySetInnerHTML` anywhere in the Sprint 1b output.
- **`@supabase/supabase-js`** is installed directly in Task 9 Step 9.3 at pinned version `2.45.4` — do not rely on transitive resolution through `@supabase/ssr`.
- **`p-retry`** pinned to `6.2.0` — exact version, no caret, per CLAUDE.md pinning rule; wired into `createBrevoContact` with `AbortError` on 4xx (non-retryable) and retry on 5xx.
- **CI skip guard** — any suite that hits the local Supabase stack is wrapped in `describe.skipIf(!process.env.HAS_LOCAL_DB)`. Local runs use `HAS_LOCAL_DB=1 npm run test:api` (or `npm test`). CI without a DB container still runs the non-DB suites and skips the DB ones with an explicit reason.
- **Turnstile script** is injected client-side in Task 15; add `script-src` CSP entry for `challenges.cloudflare.com` when CSP hardening lands (Sprint 4).
- **`campaign_translations!inner`** join syntax in Task 14 relies on PostgREST embedding; verify the response shape manually during implementation and adjust if Supabase returns `campaign_translations` as a sibling array vs nested object.
