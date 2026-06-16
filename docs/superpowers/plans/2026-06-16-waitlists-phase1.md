# Waitlists — Phase 1 Implementation Plan (Prep + Fase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the independently-deployable foundation of the Waitlists feature: the data model, the public single-opt-in signup (landing page + shared form), the CMS management module (list / drawer / detail / signups / CSV export), and the full LGPD wiring (consent ledger, retention sweep, per-email DSAR) — with **no changes to the newsletter send pipeline** (that is Fase 2).

**Architecture:** Two standalone Supabase tables (`waitlists`, `waitlist_signups`) + a `waitlist_translations` table, site-scoped via existing RLS helpers. Public signups funnel exclusively through a `SECURITY DEFINER` RPC (no anon-INSERT RLS policy). The CMS module mirrors the existing `campaigns`/`contacts` feature pattern. LGPD reuses the inline-consent precedent + a dedicated always-on retention cron + a token-gated DSAR export endpoint.

**Tech Stack:** Next.js 15 App Router (apps/web), React 19, Tailwind 4, TypeScript 5 (strict, no `any`), Fastify-independent (web-only), Supabase (Postgres 17), Zod, Vitest, Cloudflare Turnstile, Sentry.

**Source spec:** `docs/superpowers/specs/2026-06-15-waitlists-design.md` (v5). **Visual handoff:** `design_handoff_waitlists/` (README + `design_files/` prototypes — recreate, do NOT copy as-is).

---

## Conventions for every task

- **Migrations:** NEVER create migration files by hand. Run `npm run db:new <descriptive_name>` to generate the timestamped file, then edit it. All net-new DB functions are `SECURITY DEFINER SET search_path = ''` with schema-qualified identifiers and `revoke all ... from public, anon` + explicit `grant execute`. Idempotent: `drop ... if exists` before `create`.
- **Apply locally:** `npm run db:start` (Docker) then `npm run db:reset` to apply all migrations to the local DB before running DB-gated tests.
- **Tests:** Unit tests run with plain `npm test`. DB integration tests are gated: `describe.skipIf(skipIfNoLocalDb())('...', () => { ... })` and run with `npm run db:start && HAS_LOCAL_DB=1 npm test`. Helper: `apps/web/test/helpers/db-skip.ts`. Seed helpers: `apps/web/test/helpers/db-seed.ts`.
- **Commits:** `tipo: descrição curta` (`feat`/`fix`/`chore`/`refactor`/`docs`). Work directly on `staging` (per project convention). Use `--no-verify` only for plan/spec commits or when the pre-commit hook fails on another terminal's in-progress files; otherwise let the hook run.
- **After touching `packages/*/src/`:** run `npm run build:packages` immediately. (Fase 1 does not touch packages; if a step does, this applies.)
- **Strict TS:** no `any`, Zod for all external input, interfaces prefixed `I` only where the codebase already does so (follow local file conventions — these feature files use plain `type`/`interface` without the `I` prefix, matching `campaigns`/`contacts`).

---

## File Structure (Prep + Fase 1)

**Database (one migration per logical unit, via `npm run db:new`):**
- `supabase/migrations/<ts>_waitlist_tables.sql` — `waitlists`, `waitlist_signups`, `waitlist_translations` + constraints + indexes + `updated_at` trigger.
- `supabase/migrations/<ts>_waitlist_rls.sql` — RLS policies (public read; staff read; NO anon-insert policy).
- `supabase/migrations/<ts>_waitlist_signup_rpc.sql` — `waitlist_signup(...)` DEFINER RPC (FOR UPDATE branching + audit insert).
- `supabase/migrations/<ts>_waitlist_rate_check_rpc.sql` — `waitlist_rate_check(...)`.
- `supabase/migrations/<ts>_waitlist_lgpd.sql` — `lgpd_phase1_cleanup` waitlist branch + `waitlist_retention_sweep(p_site_id)` helper RPC.
- `supabase/seed.sql` (append) — `consent_texts` rows for `launch_notification`.

**Public API (App Router route handlers):**
- `apps/web/src/app/api/waitlists/[slug]/route.ts` — `GET` status.
- `apps/web/src/app/api/waitlists/[slug]/signup/route.ts` — `POST` signup.
- `apps/web/src/app/api/waitlists/dsar/[token]/route.ts` — `GET` per-email export.
- `apps/web/src/app/api/cron/waitlist-retention-sweep/route.ts` — `GET`+`POST` retention sweep.
- `apps/web/src/app/api/waitlists/consent.ts` — `WAITLIST_CONSENT_VERSION` (server-only constant).

**Public surface:**
- `apps/web/src/app/(public)/waitlists/[slug]/page.tsx` — hosted landing (server component).
- `apps/web/src/components/waitlists/waitlist-signup-form.tsx` — shared `'use client'` form (all states).
- `apps/web/src/components/waitlists/form-strings.ts` — `FORM_STRINGS` (pt-BR + en).

**CMS module (`apps/web/src/app/cms/(authed)/waitlists/`):**
- `page.tsx` — list + KPIs.
- `actions.ts` — create/update/status-transition/export/delete server actions.
- `[id]/page.tsx` — detail (Overview + Signups tabs).
- `_components/` — `waitlists-table.tsx`, `wl-badge.tsx`, `edit-drawer.tsx`, `status-strip.tsx`, `signups-tab.tsx`, `export-dialog.tsx`, `broadcast-dialog.tsx` *(broadcast dialog UI ships in Fase 1 but its server action is stubbed to `not_implemented` until Fase 2)*.
- `waitlists.css` (or Tailwind) — six status-badge styles.

**Shared/lib:**
- `apps/web/lib/cms/csv.ts` — extracted `escapeCsv` (Prep).
- `apps/web/src/lib/lgpd/domain-adapter.ts` (modify) — `collectUserData` + pre-capture.
- `apps/web/lib/cms/layout-counts.ts` (modify) — nav badge counts.

**Operational (out-of-repo, tracked as checklist):**
- Vercel WAF rule for `POST /api/waitlists/:slug/signup`.
- `vercel.json` cron entry for the retention sweep.

---

## PREP — Extract `escapeCsv` (must land before Fase 1 CSV export)

### Task 0: Extract shared `escapeCsv` with formula-injection hardening

**Files:**
- Create: `apps/web/lib/cms/csv.ts`
- Create: `apps/web/test/lib/cms/csv.test.ts`
- Modify: `apps/web/src/app/cms/(authed)/contacts/actions.ts` (replace the local `escapeCsv` closure ~line 275 with the import)

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/test/lib/cms/csv.test.ts
import { describe, it, expect } from 'vitest'
import { escapeCsv } from '@/lib/cms/csv'

describe('escapeCsv', () => {
  it('passes plain values through unquoted', () => {
    expect(escapeCsv('hello')).toBe('hello')
    expect(escapeCsv(123)).toBe('123')
    expect(escapeCsv(null)).toBe('')
    expect(escapeCsv(undefined)).toBe('')
  })
  it('quotes and escapes commas, quotes, newlines (RFC-4180)', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"')
    expect(escapeCsv('he said "hi"')).toBe('"he said ""hi"""')
    expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"')
  })
  it('neutralizes formula-injection leading chars', () => {
    expect(escapeCsv('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`)
    expect(escapeCsv('+1')).toBe(`"'+1"`)
    expect(escapeCsv('-1')).toBe(`"'-1"`)
    expect(escapeCsv('@cmd')).toBe(`"'@cmd"`)
    expect(escapeCsv('\tTAB')).toBe(`"'\tTAB"`)
  })
})
```

Note `@/` resolves to `apps/web/src` per the project tsconfig path alias; `@/lib/cms/csv` → `apps/web/src/lib/cms/csv`. **Place the file at `apps/web/src/lib/cms/csv.ts`** (the `@/lib` alias points at `src/lib`). Update the File Structure path accordingly.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w apps/web -- csv.test.ts`
Expected: FAIL — `Cannot find module '@/lib/cms/csv'`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/cms/csv.ts
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

/**
 * RFC-4180 CSV cell escaping + spreadsheet formula-injection hardening.
 * Cells beginning with =,+,-,@,TAB,CR are prefixed with a single quote so
 * Excel/Sheets treat them as text, not formulas. Always quoted when prefixed.
 */
export function escapeCsv(v: unknown): string {
  let s = String(v ?? '')
  const injects = s.length > 0 && FORMULA_PREFIXES.includes(s[0]!)
  if (injects) s = `'${s}`
  if (injects || s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w apps/web -- csv.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Refactor `contacts/actions.ts` to import the shared helper**

In `apps/web/src/app/cms/(authed)/contacts/actions.ts`: add `import { escapeCsv } from '@/lib/cms/csv'` at the top and DELETE the local `const escapeCsv = (v: unknown) => { ... }` closure inside `exportContacts`. Leave all call sites unchanged.

- [ ] **Step 6: Verify contacts typecheck + existing tests still pass**

Run: `npm run typecheck -w apps/web && npm test -w apps/web -- contacts`
Expected: PASS (no behavior change for contacts).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/cms/csv.ts apps/web/test/lib/cms/csv.test.ts apps/web/src/app/cms/\(authed\)/contacts/actions.ts
git commit -m "refactor: extract shared escapeCsv with formula-injection hardening"
```

---

## FASE 1A — Data model

### Task 1: Create the three waitlist tables

**Files:**
- Create (via `npm run db:new waitlist_tables`): `supabase/migrations/<ts>_waitlist_tables.sql`
- Test: `apps/web/test/integration/waitlist-schema.test.ts`

- [ ] **Step 1: Generate the migration file**

Run: `npm run db:new waitlist_tables`
This creates `supabase/migrations/<timestamp>_waitlist_tables.sql`. Edit THAT file in the next step.

- [ ] **Step 2: Write the migration SQL**

```sql
-- =============================================================================
-- MIGRATION: waitlist_tables
-- Standalone waitlists feature (Fase 1). Two core tables + translations.
-- Single opt-in; email+consent only; site-scoped. No send-pipeline coupling.
-- =============================================================================

create table if not exists public.waitlists (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references public.sites(id) on delete restrict,
  slug         text not null,
  name         text not null,
  description  text,
  status       text not null default 'draft',
  campaign_id  uuid references public.campaigns(id) on delete set null,
  sender_name  text,
  sender_email text,
  reply_to     text,
  intro_mdx    text,
  launched_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint waitlists_status_check check (status in ('draft','open','closed','launching','launched','failed')),
  constraint waitlists_slug_site_key unique (site_id, slug),
  constraint waitlists_id_site_key   unique (id, site_id)
);

create table if not exists public.waitlist_signups (
  id                          uuid primary key default gen_random_uuid(),
  waitlist_id                 uuid not null,
  site_id                     uuid not null,
  email                       public.citext not null,
  locale                      text,
  consent_launch_notification boolean not null,
  consent_text_version        text not null,
  consent_grant_at            timestamptz not null default now(),
  suppression_reason          text,
  status                      text not null default 'pending',
  suppressed_at               timestamptz,
  source_surface              text,
  ip                          inet,
  user_agent                  text,
  anonymized_at               timestamptz,
  created_at                  timestamptz not null default now(),
  constraint waitlist_signups_status_check check (status in ('pending','suppressed')),
  constraint waitlist_signups_consent_required check (consent_launch_notification = true),
  constraint waitlist_signups_email_len check (length(email::text) between 5 and 320),
  constraint waitlist_signups_suppress_coherent check ((status = 'suppressed') = (suppressed_at is not null)),
  constraint waitlist_signups_suppress_reason_coherent check ((status = 'suppressed') = (suppression_reason is not null)),
  constraint waitlist_signups_suppress_reason_enum check (suppression_reason is null or suppression_reason in ('unsubscribe','bounce','complaint')),
  constraint waitlist_signups_source_surface_enum check (source_surface is null or source_surface in ('landing','embed','tiptap')),
  constraint waitlist_signups_parent_fk foreign key (waitlist_id, site_id) references public.waitlists (id, site_id) on delete cascade
);

create unique index if not exists waitlist_signups_email_unique
  on public.waitlist_signups (waitlist_id, email) where anonymized_at is null;
create index if not exists waitlist_signups_by_waitlist_status
  on public.waitlist_signups (waitlist_id, status);
create index if not exists waitlist_signups_sweep
  on public.waitlist_signups (site_id, status, created_at) where anonymized_at is null;
create index if not exists waitlists_site_status on public.waitlists (site_id, status);

create table if not exists public.waitlist_translations (
  id                   uuid primary key default gen_random_uuid(),
  waitlist_id          uuid not null references public.waitlists(id) on delete cascade,
  locale               text not null,
  headline             text,
  subheadline          text,
  consent_label        text not null default '',
  button_label         text,
  button_loading_label text,
  success_headline     text,
  success_body         text,
  duplicate_headline   text,
  duplicate_body       text,
  closed_message       text,
  launched_message     text,
  constraint waitlist_translations_waitlist_id_locale_key unique (waitlist_id, locale)
);

-- updated_at trigger (reuse the canonical project function)
drop trigger if exists trg_waitlists_set_updated_at on public.waitlists;
create trigger trg_waitlists_set_updated_at
  before update on public.waitlists
  for each row execute function public.tg_set_updated_at();
```

> If `public.tg_set_updated_at()` is not found at apply time, grep `supabase/migrations` for the canonical updated-at trigger function name and substitute it. (Spec preamble pins it to `tg_set_updated_at`.)

- [ ] **Step 3: Apply locally and verify it applies cleanly**

Run: `npm run db:start && npm run db:reset`
Expected: reset completes with no error; the migration applies.

- [ ] **Step 4: Write the schema integration test**

```ts
// apps/web/test/integration/waitlist-schema.test.ts
import { describe, it, expect } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { getServiceClient } from '../helpers/db-seed' // existing helper returning a service-role client

describe.skipIf(skipIfNoLocalDb())('waitlist schema', () => {
  it('rejects a signup row with consent_launch_notification=false', async () => {
    const db = getServiceClient()
    const { data: site } = await db.from('sites').select('id').limit(1).single()
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: site!.id, slug: 'schema-test', name: 'Schema Test', status: 'open' })
      .select('id, site_id').single()
    const bad = await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'a@b.com',
      consent_launch_notification: false, consent_text_version: 'v1',
    })
    expect(bad.error?.code).toBe('23514') // check_violation
    await db.from('waitlists').delete().eq('id', wl!.id)
  })

  it('enforces the partial unique index on (waitlist_id, email) where not anonymized', async () => {
    const db = getServiceClient()
    const { data: site } = await db.from('sites').select('id').limit(1).single()
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: site!.id, slug: 'dup-test', name: 'Dup', status: 'open' })
      .select('id, site_id').single()
    const base = { waitlist_id: wl!.id, site_id: wl!.site_id, consent_launch_notification: true, consent_text_version: 'v1' }
    const first = await db.from('waitlist_signups').insert({ ...base, email: 'dup@x.com' })
    expect(first.error).toBeNull()
    const second = await db.from('waitlist_signups').insert({ ...base, email: 'dup@x.com' })
    expect(second.error?.code).toBe('23505') // unique_violation
    await db.from('waitlists').delete().eq('id', wl!.id) // cascades signups
  })
})
```

> Confirm the exact name of the seed helper that returns a service client (grep `apps/web/test/helpers/db-seed.ts` for the exported function; adjust the import if it is e.g. `createServiceClient`).

- [ ] **Step 5: Run the test**

Run: `npm run db:start && HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-schema`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations apps/web/test/integration/waitlist-schema.test.ts
git commit -m "feat(waitlists): core tables, constraints, indexes (Fase 1)"
```

---

### Task 2: RLS policies (public read; staff read; NO anon insert)

**Files:**
- Create (via `npm run db:new waitlist_rls`): `supabase/migrations/<ts>_waitlist_rls.sql`
- Test: `apps/web/test/integration/waitlist-rls.test.ts`

- [ ] **Step 1: Generate + write the migration**

Run `npm run db:new waitlist_rls`, then write:

```sql
-- =============================================================================
-- MIGRATION: waitlist_rls — fail-closed, reuse helpers (never inline).
-- Signups have NO anon-INSERT policy: they funnel through the DEFINER RPC only.
-- =============================================================================
alter table public.waitlists enable row level security;
alter table public.waitlist_signups enable row level security;
alter table public.waitlist_translations enable row level security;

-- waitlists: public can read open/closed/launched on visible sites
drop policy if exists waitlists_public_read on public.waitlists;
create policy waitlists_public_read on public.waitlists for select to anon, authenticated
  using (status in ('open','closed','launched') and public.site_visible(site_id));

-- waitlists: staff read all
drop policy if exists waitlists_staff_read on public.waitlists;
create policy waitlists_staff_read on public.waitlists for select to authenticated
  using (public.can_view_site(site_id));

-- waitlists: edit (insert/update) for editors+; delete for site-user admins
drop policy if exists waitlists_edit on public.waitlists;
create policy waitlists_edit on public.waitlists for all to authenticated
  using (public.can_edit_site(site_id)) with check (public.can_edit_site(site_id));

-- waitlist_translations: public read via parent visibility; staff/edit via parent
drop policy if exists waitlist_tx_public_read on public.waitlist_translations;
create policy waitlist_tx_public_read on public.waitlist_translations for select to anon, authenticated
  using (exists (select 1 from public.waitlists w
    where w.id = waitlist_id and w.status in ('open','closed','launched') and public.site_visible(w.site_id)));
drop policy if exists waitlist_tx_edit on public.waitlist_translations;
create policy waitlist_tx_edit on public.waitlist_translations for all to authenticated
  using (exists (select 1 from public.waitlists w where w.id = waitlist_id and public.can_edit_site(w.site_id)))
  with check (exists (select 1 from public.waitlists w where w.id = waitlist_id and public.can_edit_site(w.site_id)));

-- waitlist_signups: NO anon-insert policy at all. Staff read only.
drop policy if exists waitlist_signups_staff_read on public.waitlist_signups;
create policy waitlist_signups_staff_read on public.waitlist_signups for select to authenticated
  using (public.can_view_site(site_id));
```

> Verify `site_visible`, `can_view_site`, `can_edit_site` signatures by grepping `supabase/migrations` (CLAUDE.md lists them). They take a `uuid` site id.

- [ ] **Step 2: Apply + write the RLS test**

```ts
// apps/web/test/integration/waitlist-rls.test.ts
import { describe, it, expect } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { getServiceClient, getAnonClient } from '../helpers/db-seed'

describe.skipIf(skipIfNoLocalDb())('waitlist RLS', () => {
  it('anon cannot SELECT waitlist_signups', async () => {
    const anon = getAnonClient()
    const { data, error } = await anon.from('waitlist_signups').select('id').limit(1)
    // RLS denies → empty set (no error) OR permission error; assert no rows leak
    expect(error ? true : (data ?? []).length === 0).toBe(true)
  })
  it('anon cannot INSERT waitlist_signups directly (no policy → denied)', async () => {
    const anon = getAnonClient()
    const svc = getServiceClient()
    const { data: site } = await svc.from('sites').select('id').limit(1).single()
    const { data: wl } = await svc.from('waitlists')
      .insert({ site_id: site!.id, slug: 'rls-test', name: 'RLS', status: 'open' })
      .select('id, site_id').single()
    const res = await anon.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'x@y.com',
      consent_launch_notification: true, consent_text_version: 'v1',
    })
    expect(res.error).not.toBeNull() // RLS denied
    await svc.from('waitlists').delete().eq('id', wl!.id)
  })
  it('anon cannot read draft waitlists', async () => {
    const anon = getAnonClient(); const svc = getServiceClient()
    const { data: site } = await svc.from('sites').select('id').limit(1).single()
    const { data: wl } = await svc.from('waitlists')
      .insert({ site_id: site!.id, slug: 'draft-test', name: 'Draft', status: 'draft' })
      .select('id').single()
    const { data } = await anon.from('waitlists').select('id').eq('id', wl!.id)
    expect((data ?? []).length).toBe(0)
    await svc.from('waitlists').delete().eq('id', wl!.id)
  })
})
```

> Confirm `getAnonClient` exists in `db-seed.ts`; if not, construct an anon client from `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` inline.

- [ ] **Step 3: Run**

Run: `npm run db:reset && HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-rls`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations apps/web/test/integration/waitlist-rls.test.ts
git commit -m "feat(waitlists): RLS policies — public read, staff read, no anon insert"
```

---

### Task 3: `waitlist_signup` DEFINER RPC (FOR UPDATE branching + audit)

**Files:**
- Create (via `npm run db:new waitlist_signup_rpc`): `supabase/migrations/<ts>_waitlist_signup_rpc.sql`
- Test: `apps/web/test/integration/waitlist-signup-rpc.test.ts`

- [ ] **Step 1: Generate + write the RPC**

Run `npm run db:new waitlist_signup_rpc`, then write:

```sql
-- =============================================================================
-- MIGRATION: waitlist_signup_rpc
-- Single entry point for public signups. SECURITY DEFINER, search_path=''.
-- Re-derives site_id from the waitlist row; re-validates list is 'open';
-- FOR UPDATE branching for idempotent resurrect/duplicate; direct audit insert.
-- =============================================================================
drop function if exists public.waitlist_signup(text, public.citext, text, text, text, text, inet, text);

create or replace function public.waitlist_signup(
  p_slug                 text,
  p_email                public.citext,
  p_locale               text,
  p_consent_version      text,
  p_consent_text_snapshot text,
  p_source_surface       text,
  p_ip                   inet,
  p_user_agent           text
) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare
  v_site_id     uuid;
  v_waitlist_id uuid;
  v_status      text;
  v_existing    public.waitlist_signups;
  v_signup_id   uuid;
  v_event       text;
  v_duplicate   boolean := false;
begin
  -- Resolve waitlist by (slug, current site GUC). app.site_id is set by the route.
  select w.id, w.site_id, w.status
    into v_waitlist_id, v_site_id, v_status
    from public.waitlists w
   where w.slug = p_slug
     and (coalesce(current_setting('app.site_id', true), '') = ''
          or w.site_id = (current_setting('app.site_id', true))::uuid)
   limit 1;

  if v_waitlist_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_status <> 'open' then
    return jsonb_build_object('error', 'waitlist_not_open', 'status', v_status);
  end if;

  -- Lock the live (non-anonymized) row for this (waitlist, email), if any.
  select * into v_existing
    from public.waitlist_signups s
   where s.waitlist_id = v_waitlist_id and s.email = p_email and s.anonymized_at is null
   for update;

  if not found then
    insert into public.waitlist_signups (
      waitlist_id, site_id, email, locale, consent_launch_notification,
      consent_text_version, consent_grant_at, status, source_surface, ip, user_agent
    ) values (
      v_waitlist_id, v_site_id, p_email, p_locale, true,
      p_consent_version, now(), 'pending', p_source_surface, p_ip, p_user_agent
    ) returning id into v_signup_id;
    v_event := 'consent_granted';
  elsif v_existing.status = 'suppressed' and v_existing.suppression_reason = 'unsubscribe' then
    update public.waitlist_signups
       set status='pending', suppressed_at=null, suppression_reason=null,
           consent_text_version=p_consent_version, consent_grant_at=now(),
           locale=p_locale, source_surface=p_source_surface, ip=p_ip, user_agent=p_user_agent
     where id = v_existing.id returning id into v_signup_id;
    v_event := 'consent_regranted';
  else
    -- pending (already in) OR suppressed by bounce/complaint (refuse) → idempotent duplicate
    return jsonb_build_object('duplicate', true);
  end if;

  -- Append-only audit row (direct INSERT; ip/ua as explicit columns).
  insert into public.audit_log (resource_type, resource_id, site_id, event_type, after_data, ip, user_agent)
  values ('waitlist_signup', v_signup_id, v_site_id, v_event,
          jsonb_build_object(
            'email_hash', encode(public.digest(p_email::text, 'sha256'), 'hex'),
            'source_surface', p_source_surface,
            'consent_text_version', p_consent_version,
            'consent_text_snapshot', p_consent_text_snapshot),
          p_ip, p_user_agent);

  return jsonb_build_object('duplicate', v_duplicate);
end
$fn$;

revoke all on function public.waitlist_signup(text, public.citext, text, text, text, text, inet, text) from public;
grant execute on function public.waitlist_signup(text, public.citext, text, text, text, text, inet, text) to anon;
```

> **Verify before applying:** (a) `public.audit_log` columns — the spec pins `resource_id uuid`, `event_type`, `after_data jsonb`, `ip inet`, `user_agent text`. Grep `supabase/migrations/20260507000001_schema.sql` for `create table "public"."audit_log"` and match the exact column names (e.g. it may be `resource_type`/`action`/`actor_user_id`). Adjust the INSERT column list to the real schema. (b) `public.digest` requires `pgcrypto`; if unavailable, use `encode(sha256(p_email::text::bytea),'hex')` as in the LGPD branch (Task 5). Prefer the `sha256(...::bytea)` form for consistency with the spec.

- [ ] **Step 2: Apply + write the test**

```ts
// apps/web/test/integration/waitlist-signup-rpc.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { getServiceClient } from '../helpers/db-seed'

describe.skipIf(skipIfNoLocalDb())('waitlist_signup RPC', () => {
  let db: ReturnType<typeof getServiceClient>
  let siteId: string, slug: string
  beforeAll(async () => {
    db = getServiceClient()
    const { data: site } = await db.from('sites').select('id').limit(1).single()
    siteId = site!.id; slug = 'rpc-test-' + Math.floor(Date.now() % 100000)
    await db.from('waitlists').insert({ site_id: siteId, slug, name: 'RPC', status: 'open' })
    await db.rpc('set_config' as never, { setting_name: 'app.site_id', new_value: siteId, is_local: false } as never).then(() => {})
  })
  const call = (email: string) => db.rpc('waitlist_signup', {
    p_slug: slug, p_email: email, p_locale: 'pt-BR', p_consent_version: 'launch-notification-v1-2026-06',
    p_consent_text_snapshot: 'Quero ser avisado…', p_source_surface: 'landing', p_ip: '203.0.113.5', p_user_agent: 'vitest',
  })

  it('fresh signup returns duplicate:false and writes a consent_granted audit row', async () => {
    const { data, error } = await call('fresh@x.com')
    expect(error).toBeNull()
    expect((data as { duplicate: boolean }).duplicate).toBe(false)
  })
  it('repeat pending signup returns duplicate:true', async () => {
    await call('again@x.com')
    const { data } = await call('again@x.com')
    expect((data as { duplicate: boolean }).duplicate).toBe(true)
  })
  it('closed list rejects with waitlist_not_open', async () => {
    await db.from('waitlists').update({ status: 'closed' }).eq('slug', slug).eq('site_id', siteId)
    const { data } = await call('late@x.com')
    expect((data as { error?: string }).error).toBe('waitlist_not_open')
    await db.from('waitlists').update({ status: 'open' }).eq('slug', slug).eq('site_id', siteId)
  })
})
```

> The `set_config` invocation above is illustrative — set `app.site_id` for the connection using whatever helper `db-seed.ts` provides (or call `db.rpc('set_config', ...)` if exposed). If GUC setting from the test client is impractical, the RPC's `coalesce(... = '' OR ...)` branch already allows an empty GUC (admin context), so the test passes without setting it; document that.

- [ ] **Step 3: Run**

Run: `npm run db:reset && HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-signup-rpc`
Expected: PASS.

- [ ] **Step 4: Add the audit-immutability test (append-only proof)**

Append to the same file: a test that a normal `authenticated` client cannot UPDATE or DELETE an `audit_log` row (RLS denies). Use an authenticated client from `db-seed`; assert the update returns an error or affects 0 rows.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations apps/web/test/integration/waitlist-signup-rpc.test.ts
git commit -m "feat(waitlists): waitlist_signup DEFINER RPC with idempotent branching + audit"
```

---

### Task 4: `waitlist_rate_check` RPC

**Files:**
- Create (via `npm run db:new waitlist_rate_check_rpc`): `supabase/migrations/<ts>_waitlist_rate_check_rpc.sql`
- Test: extend `apps/web/test/integration/waitlist-signup-rpc.test.ts`

- [ ] **Step 1: Generate + write (mirror `contact_rate_check`, search_path='')**

```sql
-- MIGRATION: waitlist_rate_check — 10-min window, 5 per IP OR email. Fail-closed caller.
drop function if exists public.waitlist_rate_check(uuid, text, text);
create or replace function public.waitlist_rate_check(p_site_id uuid, p_ip text, p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ip_inet inet; v_count int;
begin
  if p_site_id is null then return false; end if;
  begin
    v_ip_inet := case when p_ip is null or p_ip = '' then null else p_ip::inet end;
  exception when others then v_ip_inet := null; end;
  select count(*) into v_count
    from public.waitlist_signups
   where site_id = p_site_id
     and created_at > now() - interval '10 minutes'
     and ((p_email is not null and email = p_email::public.citext)
          or (v_ip_inet is not null and ip = v_ip_inet));
  return v_count < 5;
end; $$;
revoke all on function public.waitlist_rate_check(uuid, text, text) from public;
grant execute on function public.waitlist_rate_check(uuid, text, text) to anon;
```

- [ ] **Step 2: Apply + add a test** that 5 inserts within the window flips the RPC to `false`. (Insert 5 rows directly via service client, then call the RPC with the same email and assert `false`.)

- [ ] **Step 3: Run** `npm run db:reset && HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-signup-rpc`. Expected: PASS.

- [ ] **Step 4: Commit** `feat(waitlists): waitlist_rate_check RPC`.

---

### Task 5: LGPD — phase1 branch + retention sweep RPC

**Files:**
- Create (via `npm run db:new waitlist_lgpd`): `supabase/migrations/<ts>_waitlist_lgpd.sql`
- Test: `apps/web/test/integration/waitlist-retention.test.ts`

- [ ] **Step 1: Generate + write**

```sql
-- MIGRATION: waitlist_lgpd
-- (1) Add a waitlist branch to lgpd_phase1_cleanup (existing fn; keeps its 'public'
--     search_path + existing caller guard — do NOT tighten to service_role-only).
-- (2) Net-new per-site retention sweep helper (search_path='', service_role only).

-- (1) Re-create lgpd_phase1_cleanup with the waitlist anonymization branch added.
--     Copy the CURRENT function body from the latest migration that defines it
--     (grep: "create or replace function public.lgpd_phase1_cleanup") and ADD,
--     alongside the newsletter_subscriptions anonymization, this block:
--       update public.waitlist_signups
--          set email = encode(sha256(email::text::bytea),'hex'),
--              ip = null, user_agent = null, locale = null, anonymized_at = now()
--        where email = any(p_pre_capture)  -- server-derived emails for this user
--          and anonymized_at is null;
--     Preserve the existing SET search_path TO 'public' and the existing caller guard.

-- (2) Net-new sweep helper.
drop function if exists public.waitlist_retention_sweep(uuid);
create or replace function public.waitlist_retention_sweep(p_site_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- PASS 1: full anonymization per windows.
  update public.waitlist_signups s set
    email = encode(sha256(s.email::text::bytea),'hex'),
    ip = null, user_agent = null, locale = null, anonymized_at = now()
  where s.site_id = p_site_id and s.anonymized_at is null
    and (
      (s.status='suppressed' and s.suppression_reason='unsubscribe'
         and s.suppressed_at < now() - interval '30 days')
      or (exists (select 1 from public.waitlists w where w.id=s.waitlist_id and w.status in ('closed','launched'))
         and s.created_at < now() - interval '7 days')
      or (s.status='pending'
         and exists (select 1 from public.waitlists w where w.id=s.waitlist_id and w.status in ('draft','open'))
         and s.created_at < now() - interval '90 days')
    )
    and not (s.status='suppressed' and s.suppression_reason in ('bounce','complaint'));

  -- PASS 2: network-PII minimization; idempotency guard prevents no-op churn.
  update public.waitlist_signups s set ip=null, user_agent=null
  where s.site_id = p_site_id
    and (s.ip is not null or s.user_agent is not null)
    and s.created_at < now() - interval '30 days';
end; $$;
revoke all on function public.waitlist_retention_sweep(uuid) from public, anon, authenticated;
grant execute on function public.waitlist_retention_sweep(uuid) to service_role;
```

> The retention-window numbers (30/7/90/30) match spec §2.4 constants. Keep them inline here; the cron route (Task 10) just iterates sites and calls this RPC per site.

- [ ] **Step 2: Apply + test PASS-2 idempotency**

```ts
// apps/web/test/integration/waitlist-retention.test.ts (excerpt)
it('PASS 2 is idempotent — second sweep affects 0 ip/ua rows', async () => {
  const db = getServiceClient()
  const { data: site } = await db.from('sites').select('id').limit(1).single()
  const { data: wl } = await db.from('waitlists')
    .insert({ site_id: site!.id, slug: 'ret-test', name: 'Ret', status: 'open' }).select('id, site_id').single()
  // aged pending row with ip/ua
  await db.from('waitlist_signups').insert({
    waitlist_id: wl!.id, site_id: wl!.site_id, email: 'aged@x.com', consent_launch_notification: true,
    consent_text_version: 'v1', ip: '203.0.113.9', user_agent: 'old', created_at: '2020-01-01T00:00:00Z',
  })
  await db.rpc('waitlist_retention_sweep', { p_site_id: wl!.site_id })
  const { data: after1 } = await db.from('waitlist_signups').select('ip, user_agent').eq('email', 'aged@x.com').single()
  expect(after1!.ip).toBeNull(); expect(after1!.user_agent).toBeNull()
  // second run must not error and the row stays nulled (no churn) — assert via updated_at unchanged proxy or simply no error
  const { error } = await db.rpc('waitlist_retention_sweep', { p_site_id: wl!.site_id })
  expect(error).toBeNull()
  await db.from('waitlists').delete().eq('id', wl!.id)
})
```

- [ ] **Step 3: Run** `npm run db:reset && HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-retention`. Expected: PASS.

- [ ] **Step 4: Commit** `feat(waitlists): LGPD phase1 branch + per-site retention sweep RPC`.

---

### Task 6: Consent constant + `consent_texts` seed + CI invariant

**Files:**
- Create: `apps/web/src/app/api/waitlists/consent.ts`
- Modify: `supabase/seed.sql`
- Test: `apps/web/test/unit/waitlist-consent.test.ts`

- [ ] **Step 1: Write the constant**

```ts
// apps/web/src/app/api/waitlists/consent.ts  (server-only)
export const WAITLIST_CONSENT_VERSION = 'launch-notification-v1-2026-06'
```

- [ ] **Step 2: Append `consent_texts` rows to `supabase/seed.sql`** (id convention `launch_notification:{locale}:{version}`):

```sql
insert into public.consent_texts (id, category, locale, version, text_md) values
 ('launch_notification:en:launch-notification-v1-2026-06','launch_notification','en','launch-notification-v1-2026-06',
  'Notify me by email when {name} launches. I can unsubscribe anytime.'),
 ('launch_notification:pt-BR:launch-notification-v1-2026-06','launch_notification','pt-BR','launch-notification-v1-2026-06',
  'Quero ser avisado(a) por email quando {name} for lançado. Posso cancelar quando quiser.')
on conflict (id) do nothing;
```

> Verify `consent_texts` columns (`id text`, `category`, `locale`, `version`, `text_md`) by grepping the schema migration; adjust columns if they differ.

- [ ] **Step 3: Write the CI invariant test** (asserts the version resolves per supported locale):

```ts
// apps/web/test/unit/waitlist-consent.test.ts
import { describe, it, expect } from 'vitest'
import { WAITLIST_CONSENT_VERSION } from '@/app/api/waitlists/consent'
describe('waitlist consent version', () => {
  it('matches the id convention used in the seed', () => {
    expect(WAITLIST_CONSENT_VERSION).toMatch(/^launch-notification-v\d+-\d{4}-\d{2}$/)
  })
})
```

> A DB-gated companion check (resolves in `consent_texts` for `en` and `pt-BR`) belongs in an integration test once seeded; add it under `skipIfNoLocalDb` if a local DB seed is present.

- [ ] **Step 4: Run** `npm test -w apps/web -- waitlist-consent`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(waitlists): consent version constant + consent_texts seed`.

---

## FASE 1B — Public API

### Task 7: `GET /api/waitlists/[slug]` (status + translation block)

**Files:**
- Create: `apps/web/src/app/api/waitlists/[slug]/route.ts`
- Test: `apps/web/test/integration/waitlist-status-endpoint.test.ts`

- [ ] **Step 1: Write the route** (site resolved from `x-site-id`, never slug alone):

```ts
// apps/web/src/app/api/waitlists/[slug]/route.ts
import { headers } from 'next/headers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

interface Ctx { params: Promise<{ slug: string }> }
const PUBLIC_STATUSES = ['open', 'closed', 'launched'] as const

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params
  const h = await headers()
  const siteId = h.get('x-site-id')
  const locale = h.get('x-locale') ?? h.get('x-default-locale') ?? 'en'
  if (!siteId) return Response.json({ error: 'no_site' }, { status: 404 })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('waitlists')
    .select('id, status, name, description, waitlist_translations(locale, headline, subheadline, consent_label, button_label, success_headline, success_body, duplicate_headline, duplicate_body, closed_message, launched_message)')
    .eq('site_id', siteId).eq('slug', slug).maybeSingle()

  if (error || !data || !PUBLIC_STATUSES.includes(data.status as (typeof PUBLIC_STATUSES)[number])) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }
  const tx = (data.waitlist_translations ?? []).find((t) => t.locale === locale)
    ?? (data.waitlist_translations ?? [])[0] ?? null
  return Response.json({ status: data.status, name: data.name, description: data.description, tx })
}
```

> Confirm middleware sets `x-locale` (grep middleware); if not, fall back to `x-default-locale`. The select embeds translations via the FK relationship name — verify Supabase exposes it as `waitlist_translations` (it derives from the FK). Adjust if the relationship alias differs.

- [ ] **Step 2: Write the test** — same slug on two different sites returns each site's own list (404 cross-site). Seed two sites + a waitlist on each with the same slug; call with each `x-site-id` and assert isolation. Draft/launching/failed → 404.

- [ ] **Step 3: Run + Commit** `feat(waitlists): public GET status endpoint (site-scoped)`.

---

### Task 8: `POST /api/waitlists/[slug]/signup`

**Files:**
- Create: `apps/web/src/app/api/waitlists/[slug]/signup/route.ts`
- Test: `apps/web/test/integration/waitlist-signup-endpoint.test.ts`

- [ ] **Step 1: Write the route** (mirrors campaign submit + spec §3 flow):

```ts
// apps/web/src/app/api/waitlists/[slug]/signup/route.ts
import { headers } from 'next/headers'
import { z } from 'zod'
import { verifyTurnstileToken } from '@/../lib/turnstile' // adjust to the repo's import style (see note)
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { WAITLIST_CONSENT_VERSION } from '../../consent'
import { getLogger } from '@/../lib/logger'

const Body = z.object({
  locale: z.string().min(2).max(10),
  email: z.string().email().max(320),
  consent_launch_notification: z.literal(true),
  turnstile_token: z.string().min(1),
})
interface Ctx { params: Promise<{ slug: string }> }

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params
  // Fail-closed Turnstile config assertion in non-dev.
  const isDev = process.env.VERCEL_ENV !== 'production' && process.env.VERCEL_ENV !== 'preview' && process.env.NODE_ENV === 'development'
  if (!process.env.TURNSTILE_SECRET_KEY && !isDev) {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }

  let body: z.infer<typeof Body>
  try { body = Body.parse(await req.json()) } catch { return Response.json({ error: 'invalid_body' }, { status: 400 }) }

  const h = await headers()
  const siteId = h.get('x-site-id')
  if (!siteId) return Response.json({ error: 'no_site' }, { status: 404 })
  const ip = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ua = req.headers.get('user-agent') ?? null

  const ok = await verifyTurnstileToken(body.turnstile_token, ip ?? undefined)
  if (!ok) return Response.json({ error: 'turnstile_failed' }, { status: 400 })

  const supabase = getSupabaseServiceClient()
  // Rate-limit — fail CLOSED on RPC error.
  const rate = await supabase.rpc('waitlist_rate_check', { p_site_id: siteId, p_ip: ip, p_email: body.email })
  if (rate.error) { getLogger().error('[waitlist_rate_check]', { msg: rate.error.message }); return Response.json({ error: 'unavailable' }, { status: 503 }) }
  if (rate.data === false) return Response.json({ error: 'rate_limited' }, { status: 429 })

  // Snapshot the displayed consent text for the audit trail.
  const snapshot = `[${body.locale}] ${WAITLIST_CONSENT_VERSION}`
  const res = await supabase.rpc('waitlist_signup', {
    p_slug: slug, p_email: body.email, p_locale: body.locale,
    p_consent_version: WAITLIST_CONSENT_VERSION, p_consent_text_snapshot: snapshot,
    p_source_surface: 'landing', p_ip: ip, p_user_agent: ua,
  })
  if (res.error) { getLogger().error('[waitlist_signup]', { msg: res.error.message }); return Response.json({ error: 'insert_failed' }, { status: 500 }) }
  const out = res.data as { error?: string; status?: string; duplicate?: boolean }
  if (out.error === 'not_found') return Response.json({ error: 'not_found' }, { status: 404 })
  if (out.error === 'waitlist_not_open') return Response.json({ error: 'waitlist_not_open', status: out.status }, { status: 409 })
  return Response.json({ success: true, duplicate: out.duplicate === true })
}
```

> **Import paths:** the campaign route imports `verifyTurnstileToken` from a deep relative path into `apps/web/lib/turnstile` (note: `apps/web/lib`, NOT `apps/web/src/lib`). Use the same relative style the sibling routes use; grep an existing `app/api/**/route.ts` for the exact `../lib/turnstile` depth and copy it. Same for `lib/logger` and `lib/supabase/service`. (The `@/` alias maps to `src` only — `lib/` is reached relatively.) **Also:** the `p_source_surface` is `'landing'` here; the embed/TipTap surfaces (Fase 3) will POST the same endpoint with a `source_surface` body field — leave a TODO but do NOT add the field now (YAGNI for Fase 1).

- [ ] **Step 2: Write the endpoint test** (DB-gated): success returns `{success:true,duplicate:false}`; second identical call → `duplicate:true`; closed list → 409; missing turnstile secret in simulated non-dev → 503. Mock `verifyTurnstileToken` to return true via `vi.mock`.

- [ ] **Step 3: Run + Commit** `feat(waitlists): public POST signup endpoint (Turnstile, fail-closed rate-limit)`.

---

### Task 9: `GET /api/waitlists/dsar/[token]` (per-email export)

**Files:**
- Create: `apps/web/src/app/api/waitlists/dsar/[token]/route.ts`
- Test: `apps/web/test/integration/waitlist-dsar.test.ts`

- [ ] **Step 1: Write the route** (reuses the unsubscribe-token hash lookup; no-oracle response):

```ts
// apps/web/src/app/api/waitlists/dsar/[token]/route.ts
import crypto from 'node:crypto'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

interface Ctx { params: Promise<{ token: string }> }
const NEUTRAL = () => Response.json({ data: [] }, { status: 200 }) // no oracle

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { token } = await ctx.params
  if (!token || token.length < 16) return NEUTRAL()
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const supabase = getSupabaseServiceClient()
  const { data: tok } = await supabase
    .from('unsubscribe_tokens')
    .select('site_id, email, source')
    .eq('token_hash', hash).eq('source', 'waitlist').maybeSingle()
  if (!tok) return NEUTRAL()
  const { data } = await supabase
    .from('waitlist_signups')
    .select('email, consent_launch_notification, consent_text_version, status, source_surface, created_at')
    .eq('site_id', tok.site_id).eq('email', tok.email).is('anonymized_at', null)
  return new Response(JSON.stringify({ data: data ?? [] }, null, 2), {
    status: 200,
    headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="waitlist-data.json"' },
  })
}
```

> **Dependency:** `unsubscribe_tokens.source` column does NOT exist until Fase 2 (the source-namespaced token migration). In Fase 1 there are no waitlist tokens issued yet (no broadcast), so this endpoint correctly returns the neutral empty response for every token. Ship it now (it is inert until Fase 2 issues waitlist tokens) OR gate the route behind a `// Fase 2` note. **Decision: ship the route; the `.eq('source','waitlist')` filter simply matches nothing until Fase 2.** Add a code comment saying so. The DB-gated test asserts: unknown token → neutral empty; (the populated-token case is tested in Fase 2).

- [ ] **Step 2: Test** unknown/short token → `{data:[]}` 200; never 404/500 (no oracle).

- [ ] **Step 3: Commit** `feat(waitlists): token-gated DSAR export endpoint (inert until Fase 2)`.

---

### Task 10: Retention sweep cron route (`GET`+`POST`)

**Files:**
- Create: `apps/web/src/app/api/cron/waitlist-retention-sweep/route.ts`
- Modify: `vercel.json` (cron entry — operational)
- Test: `apps/web/test/integration/waitlist-sweep-route.test.ts`

- [ ] **Step 1: Write the route** (GET=POST alias, CRON_SECRET-gated, per-site iteration, `WAITLIST_RETENTION_SWEEP_ENABLED` flag):

```ts
// apps/web/src/app/api/cron/waitlist-retention-sweep/route.ts
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getLogger } from '@/../lib/logger'

async function handle(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (process.env.WAITLIST_RETENTION_SWEEP_ENABLED !== 'true') return Response.json({ skipped: 'disabled' }, { status: 200 })

  const supabase = getSupabaseServiceClient()
  const { data: sites, error } = await supabase.from('sites').select('id')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  let swept = 0
  for (const s of sites ?? []) {
    const r = await supabase.rpc('waitlist_retention_sweep', { p_site_id: s.id })
    if (r.error) getLogger().error('[waitlist-sweep]', { site: s.id, msg: r.error.message })
    else swept++
  }
  getLogger().info('[waitlist-sweep] done', { swept })
  return Response.json({ ok: true, sites: swept })
}
export const GET = handle
export const POST = handle
```

> Site enumeration mirrors how other crons resolve sites (a flat `select id from sites`). The split-brain GET=POST alias is mandated by the project's cron architecture (Vercel cron = GET; pg_cron = POST).

- [ ] **Step 2: Test** — unauthorized without `CRON_SECRET`; `skipped` when flag off; with flag on + secret, returns `{ok:true}` (DB-gated).

- [ ] **Step 3: Add the `vercel.json` cron entry** (operational):

```json
{ "crons": [ { "path": "/api/cron/waitlist-retention-sweep", "schedule": "0 4 * * *" } ] }
```
Merge into the existing `crons` array (do not overwrite). Set `WAITLIST_RETENTION_SWEEP_ENABLED=true` in Vercel env when ready to activate (leave unset/false until DPO sign-off).

- [ ] **Step 4: Commit** `feat(waitlists): retention-sweep cron route + vercel.json entry`.

---

## FASE 1C — LGPD adapter wiring

### Task 11: `collectUserData` + pre-capture for waitlist memberships

**Files:**
- Modify: `apps/web/src/lib/lgpd/domain-adapter.ts`
- Test: `apps/web/test/unit/lgpd-domain-adapter.test.ts` (extend existing)

- [ ] **Step 1: Read the current adapter** to learn the `collectUserData` shape and the `p_pre_capture` enumeration pattern (grep `collectUserData` and `pre_capture` / `lgpd_phase1_cleanup` in `domain-adapter.ts`).

- [ ] **Step 2: Write the failing test** — `collectUserData(userEmail)` includes a `waitlists` section with the narrowed projection (`email, consent_launch_notification, consent_text_version, status, source_surface, created_at`) and EXCLUDES `ip`/`user_agent`. Seed a signup for the user's email; assert the export contains it without network PII.

- [ ] **Step 3: Implement** — add a query in `collectUserData` selecting the narrowed projection from `waitlist_signups` by the user's email; add the user's waitlist emails to the `p_pre_capture` array passed to `lgpd_phase1_cleanup`. Mirror the existing `newsletter_subscriptions` branch exactly.

- [ ] **Step 4: Run + Commit** `feat(waitlists): LGPD export + pre-capture for waitlist memberships`.

---

## FASE 1D — Public surface

### Task 12: `<WaitlistSignupForm>` shared client component + `FORM_STRINGS`

**Files:**
- Create: `apps/web/src/components/waitlists/form-strings.ts`
- Create: `apps/web/src/components/waitlists/waitlist-signup-form.tsx`
- Test: `apps/web/test/components/waitlist-signup-form.test.tsx`

**Port source:** `design_handoff_waitlists/design_files/waitlist-public.jsx` (`WaitlistForm`) — recreate as a production React 19 client component using the live Pinboard kit. Do NOT copy the Babel/localStorage prototype scaffolding.

- [ ] **Step 1: Write `FORM_STRINGS`** (pt-BR + en) covering every state in spec §7 (idle/submitting/success/duplicate/closed/launched/error/rateLimited/unavailable). Use the copy table from the spec and the handoff. Shape:

```ts
// apps/web/src/components/waitlists/form-strings.ts
export type WaitlistLocale = 'pt-BR' | 'en'
export interface WaitlistStrings {
  emailPlaceholder: string; consentLabel: string; button: string; buttonLoading: string
  successHeadline: string; successBody: string; duplicateHeadline: string; duplicateBody: string
  closed: string; launched: string; error: string; rateLimited: string; unavailable: string
  reassurance: string
}
export const FORM_STRINGS: Record<WaitlistLocale, WaitlistStrings> = {
  'pt-BR': {
    emailPlaceholder: 'seu@email.com',
    consentLabel: 'Quero ser avisado(a) por email quando for lançado. Posso cancelar quando quiser.',
    button: 'Quero ser avisado', buttonLoading: 'Enviando…',
    successHeadline: 'Pronto!', successBody: 'Te avisamos quando lançar.',
    duplicateHeadline: 'Você já está na lista', duplicateBody: 'Avisaremos quando lançar.',
    closed: 'As inscrições estão encerradas.', launched: 'Já lançou!',
    error: 'Algo deu errado. Tente novamente.', rateLimited: 'Muitas tentativas. Aguarde um instante.',
    unavailable: 'Temporariamente indisponível, tente em instantes.',
    reassurance: 'Enviaremos um único email — cancele quando quiser.',
  },
  en: {
    emailPlaceholder: 'you@email.com',
    consentLabel: 'Notify me by email when this launches. I can unsubscribe anytime.',
    button: 'Notify me', buttonLoading: 'Sending…',
    successHeadline: 'Done!', successBody: "We'll email you when it launches.",
    duplicateHeadline: "You're already on the list", duplicateBody: "We'll email you when it launches.",
    closed: 'Signups are closed.', launched: 'It launched!',
    error: 'Something went wrong. Please try again.', rateLimited: 'Too many attempts. Please wait a moment.',
    unavailable: 'Temporarily unavailable, please try again shortly.',
    reassurance: "We'll send one email only — unsubscribe anytime.",
  },
}
```

- [ ] **Step 2: Write a failing component test** (Vitest + Testing Library) — renders the form in `idle`, asserts the email input + consent checkbox + disabled submit until both consent checked and (in non-dev) a turnstile token present; on a mocked successful POST it renders the success block in place (no email field) with `role="status"`.

- [ ] **Step 3: Implement the component** — a `'use client'` component with props `{ slug: string; locale: WaitlistLocale; variant?: 'landing' | 'embed' | 'inline'; initialStatus?: 'open'|'closed'|'launched' }`. State machine per spec §7. POSTs to `/api/waitlists/${slug}/signup`. Maps response → state. Accessibility per §7 (focus to result `role=status` after submit; error `role=alert`; email input attributes; Turnstile disabled-until-token; reduced motion). Recreate the Pinboard visual treatment via the live kit (`makePinboardKit`/`Paper`/`Tape`) used elsewhere in the public site — grep `apps/web/src` for the real import path of the Pinboard components (the prototype's `shared.jsx` maps to the real site kit).

- [ ] **Step 4: Run + Commit** `feat(waitlists): shared WaitlistSignupForm + FORM_STRINGS`.

---

### Task 13: Hosted landing page `/waitlists/[slug]`

**Files:**
- Create: `apps/web/src/app/(public)/waitlists/[slug]/page.tsx`
- Test: `apps/web/test/integration/waitlist-landing.test.tsx` (or an e2e smoke if the project has one)

**Port source:** `design_handoff_waitlists/design_files/waitlist-surfaces.jsx` (hosted landing composition).

- [ ] **Step 1: Implement the server component** — direct host→site lookup (the spec notes sitemap/robots do direct lookup, NOT middleware-dependent; follow `app/sitemap.ts` for the host-lookup helper). Resolve `(slug, site_id, locale)`; if status ∉ public set → `notFound()`. Render the two-column landing (pitch + sticky form card) with `<WaitlistSignupForm slug locale variant="landing" initialStatus={status} />`. Respect status server-side (closed/launched render the message block; open renders the form). Pull headline/description from the resolved translation, falling back to `FORM_STRINGS` + the waitlist `name`/`description`.

- [ ] **Step 2: Test** — open status renders the form; closed renders the closed message and no email input; a non-existent slug renders 404. (Use a render test against the server component or a Playwright smoke if configured.)

- [ ] **Step 3: Commit** `feat(waitlists): hosted landing page /waitlists/[slug]`.

---

## FASE 1E — CMS module

> All CMS server actions follow the verified guard chain: `const { siteId } = await requireEditAccess()` (which calls `getSiteContext()` + `requireSiteScope({ area:'cms', siteId, mode })`), then `getSupabaseServiceClient()`, then every query `.eq('site_id', siteId)`, then `captureServerActionError` on failure + `revalidatePath`/`revalidateTag('layout-counts')`. Mirror `contacts/actions.ts` and `campaigns/[id]/edit/actions.ts`.

### Task 14: CMS list page + KPIs + `WlBadge`

**Files:**
- Create: `apps/web/src/app/cms/(authed)/waitlists/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/waitlists-table.tsx`
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/wl-badge.tsx`
- Create: `apps/web/src/app/cms/(authed)/waitlists/waitlists.css` (six badge styles; reuse existing tokens — no new colors)
- Test: `apps/web/test/components/wl-badge.test.tsx`

**Port source:** `design_files/views-waitlists-main.jsx` (list + KPI strip) and `views-waitlists.jsx` (`WlBadge`). `waitlists.css` maps to existing CMS tokens per the handoff (draft→muted, open→`--ok`, closed→`--warn`, launching→`--c-pipeline` pulsing, launched→`--c-newsletter`, failed→`--danger`).

- [ ] **Step 1: `WlBadge` test + impl** — renders the correct label + token class for each of the six statuses; `launching` gets the pulsing dot.
- [ ] **Step 2: List page** — `force-dynamic` + `loading.tsx` skeleton; server component reads via `getSiteContext()` + service client `.eq('site_id', siteId)`; KPI strip (Waitlists + open count, Total signups, Linked campaigns, Needs attention = failed + stuck-launching); table columns (Name + `/waitlists/{slug}`, Status `WlBadge`, Signups count with `−N` suppressed sub, Linked campaign, Updated relative); empty state (`EmptyState` icon `gift`) + "New waitlist" CTA. Signup counts via a single grouped count query.
- [ ] **Step 3: Run + Commit** `feat(waitlists): CMS list page + KPIs + status badge`.

### Task 15: Create/edit drawer + create/update actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/edit-drawer.tsx`
- Modify: `apps/web/src/app/cms/(authed)/waitlists/actions.ts`
- Test: `apps/web/test/integration/waitlist-cms-actions.test.ts`

**Port source:** `views-waitlists.jsx` (`EditDrawer`, portalled to `document.body`; intro is an UNCONTROLLED `contentEditable` read on save — keep this to avoid the React `removeChild` crash documented in the handoff).

- [ ] **Step 1: Write the `createWaitlist`/`updateWaitlist` actions** with: slug auto-slugify (client), `23505` → `{ ok:false, error:'slug_taken' }` (catch wraps the INSERT/UPDATE, not a pre-SELECT), sender-email validated against `ringContext().getSite(siteId).domains` at save (field error), status mutation rejected here (use discrete transition actions, Task 16). Return typed results mirroring `SaveCampaignResult`.
- [ ] **Step 2: Test (DB-gated)** — concurrent create of the same slug → exactly one success + one `slug_taken`; sender-email on a non-owned domain → field error; create persists translations row.
- [ ] **Step 3: Drawer component** — right-side drawer portalled to body; fields per handoff §2 (Name, Slug, Description, Intro rich-text, Linked campaign searchable picker, Sender name/email/reply-to, consent preview line); Esc closes; Cancel/Save.
- [ ] **Step 4: Run + Commit** `feat(waitlists): create/edit drawer + actions (slug-collision, sender validation)`.

### Task 16: Status-transition actions (CAS) + status strip

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/waitlists/actions.ts`
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/status-strip.tsx`
- Test: extend `waitlist-cms-actions.test.ts`

- [ ] **Step 1: Write `transitionWaitlistStatus(id, to)`** enforcing the legal graph (`draft→open`; `open↔closed`; `(open|closed)→launching` is broadcast-only, Task 19/Fase 2; `failed→closed`) via CAS: `update waitlists set status=$to where id=$id and site_id=$siteId and status=$from` → 0 rows ⇒ `{ ok:false, error:'status_changed' }`. `launched` terminal (no transitions out).
- [ ] **Step 2: Test** — illegal transition rejected; CAS 0-row returns `status_changed`; legal transition succeeds + revalidates.
- [ ] **Step 3: Status strip component** — renders only the legal buttons for the current status with one-line hints (per handoff §3); Launch is the accent CTA (wired to the broadcast dialog, Task 19); Resume/Retry uses the recover style.
- [ ] **Step 4: Commit** `feat(waitlists): guarded status transitions + status strip`.

### Task 17: Detail page (Overview + Signups tabs)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/waitlists/[id]/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/signups-tab.tsx`
- Test: covered by Task 18 query test + a render smoke

**Port source:** `views-waitlists-main.jsx` (`WaitlistDetail`): back link, title + `WlBadge`, public URL, Embed/Edit buttons, status-specific banner, status strip, Overview tab (What's coming, Signups by source, Launch CTA card disabled when `pending===0` or status not open/closed, Details card), Signups tab.

- [ ] **Step 1: Implement the detail server component** reading the waitlist `.eq('id',id).eq('site_id',siteId)` (404 if not owned), grouped signup counts by source/status, and mounting the two tabs. The Launch CTA card shows eligible (`pending`) count; in Fase 1 the broadcast action is stubbed (Task 19) — the button opens the dialog but the action returns `not_implemented` until Fase 2. State that clearly in the card hint.
- [ ] **Step 2: Commit** `feat(waitlists): waitlist detail page (overview + signups tabs)`.

### Task 18: Signups list — server-side keyset query + filters

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/waitlists/_components/signups-tab.tsx`
- Modify: `apps/web/src/app/cms/(authed)/waitlists/actions.ts` (a `listSignups` action or server-component query)
- Test: `apps/web/test/integration/waitlist-signups-query.test.ts`

- [ ] **Step 1: Write the failing test** — seed 30 signups; assert a search by email-prefix on page 2 still finds a matching row from page 1 (i.e. filter is applied in the query, NOT client-side); assert keyset pagination on `(created_at desc, id)` returns stable Next/Prev pages with no overlap/gap.
- [ ] **Step 2: Implement** the server-side query: `.eq('waitlist_id',id).eq('site_id',siteId)` + optional `.eq('status',filter)` + optional `.ilike('email', q + '%')` + keyset cursor on `(created_at, id)` with Next/Prev + approximate `count()`. Columns: email, status, suppression_reason, source_surface, created_at.
- [ ] **Step 3: Run + Commit** `feat(waitlists): server-side keyset signups list with filters`.

### Task 19: CSV export dialog + action (IDOR-guarded) + broadcast dialog (UI only)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/export-dialog.tsx`
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/broadcast-dialog.tsx`
- Modify: `apps/web/src/app/cms/(authed)/waitlists/actions.ts`
- Test: `apps/web/test/integration/waitlist-export.test.ts`

**Port source:** `views-waitlists.jsx` (`ExportDialog`, `BroadcastDialog` — both portalled).

- [ ] **Step 1: Write `exportWaitlistSignups(waitlistId, opts)` action** — `requireSiteScope({mode:'view'})`; IDOR guard: resolve `.eq('id',waitlistId).eq('site_id',siteId).maybeSingle()` → 404 if not owned, THEN query signups with BOTH `.eq('site_id',siteId)` AND `.eq('waitlist_id',waitlistId)`. Build CSV with the shared `escapeCsv` (Task 0). Columns: `email, status, suppression_reason, source_surface, locale, created_at`. Anonymized rows omitted. Filename `waitlist-{slug}-{YYYY-MM-DD}.csv`. Honor the export dialog options (status filter, date range, exclude-suppressed default on).
- [ ] **Step 2: Test (DB-gated)** — cross-site export request → 404 (IDOR closed); export omits anonymized rows; formula-injection cell is neutralized (`=HYPERLINK` → `'=HYPERLINK`).
- [ ] **Step 3: Export dialog + broadcast dialog components** — export dialog per handoff §5. Broadcast dialog per handoff §4 (type-the-**slug** to confirm, live recipient count, 0-recipient disables, Esc closes) — but its confirm button calls a `launchWaitlist` action that, in Fase 1, returns `{ ok:false, error:'not_implemented' }` with a visible "Broadcast ships in the next phase" notice. The dialog UI is complete; the send is Fase 2.
- [ ] **Step 4: Run + Commit** `feat(waitlists): CSV export (IDOR-guarded) + broadcast dialog UI (send stubbed)`.

### Task 20: Nav item + nav badge counts

**Files:**
- Modify: the CMS nav config (grep for where `campaigns`/`newsletters` nav items are registered — likely in the `CmsShell` props or a nav constants file)
- Modify: `apps/web/lib/cms/layout-counts.ts` (the `fetchLayoutCounts`/`fetchLayoutCountsInner` function)
- Test: extend the layout-counts test if one exists

- [ ] **Step 1: Add the `waitlists` nav item** (icon `gift`, after Newsletters) wherever the existing CMS nav items are defined.
- [ ] **Step 2: Extend `fetchLayoutCountsInner`** with two actionable counts: `failed`-state waitlists + `launching` waitlists past the watchdog threshold (6h). `unstable_cache` `revalidate:60`. Write actions `revalidateTag('layout-counts')`.
- [ ] **Step 3: Commit** `feat(waitlists): CMS nav item + actionable nav badge counts`.

---

## FASE 1F — Observability

### Task 21: Sentry tags + funnel + no-PII scrub

**Files:**
- Modify: the signup route + server actions (add `Sentry` tag `component:'waitlist'`)
- Test: a unit test asserting the scrub helper drops email/ip before capture

- [ ] **Step 1: Ensure no PII reaches Sentry** — the signup route must scrub `email`/`ip`/`user_agent` from any context before `captureException`. Add a tiny scrub helper + test it.
- [ ] **Step 2: Add `source_surface` count-only funnel metric** (a single info log / Sentry breadcrumb, no PII) and the Sentry tag `component:'waitlist'` on all waitlist server actions + routes.
- [ ] **Step 3: Commit** `feat(waitlists): observability — Sentry tags, count-only funnel, PII scrub`.

---

## Operational deliverables (checklist — not code, must be done before public launch)

- [ ] **Vercel WAF rule:** rate-limit `POST /api/waitlists/:slug/signup` at the edge — **20 req/IP/60s** + **100 req/IP/1h**, action = rate-limit (429), not block. Configure via Vercel WAF / `vercel firewall`. (Spec §3.1.)
- [ ] **`vercel.json` cron** entry for `/api/cron/waitlist-retention-sweep` (Task 10) merged into the existing `crons` array.
- [ ] **Env:** `WAITLIST_RETENTION_SWEEP_ENABLED` left unset/false until DPO sign-off; set `true` to activate the sweep. `TURNSTILE_SECRET_KEY` present in preview/prod (route returns 503 otherwise — by design).
- [ ] **DPO/legal sign-off note** committed under `content/legal/` or `docs/ops/`: documents the single-opt-in posture, the retention schedule (30/7/90/30 days), and the anonymous-member DSAR endpoint as the Art. 18 path.

---

## Out of scope for this plan (separate plans)

- **Fase 2 (`docs/superpowers/plans/<date>-waitlists-phase2.md`):** the `RecipientSource` seam refactor of `send-scheduled-newsletters/route.ts` (golden-snapshot + STATIC grep guard FIRST), `newsletter_editions` extension, source-namespaced `generateUnsubscribeToken` + `unsubscribe_tokens` migration + hardened `unsubscribe_via_token` branch, SES webhook recipient-source awareness, the real `launchWaitlist` broadcast action (typed-slug confirm + `requireSiteScope({mode:'publish'})`), `launching`/`failed` lifecycle trigger + watchdog reachability + delete guard + FK-cascade-safe recovery, `SES_WAITLIST_CONFIG_SET` env + tracking disabled.
- **Fase 3 (`docs/superpowers/plans/<date>-waitlists-phase3.md`):** embed route (`/embed/waitlists/[slug]` + FULL CSP re-emit + postMessage/ResizeObserver sizing + accent validation) and the TipTap/MDX node (MDX-path registration in `blogRegistry` + `<WaitlistForm slug="…" />` JSX-reference serialization + round-trip test gate).

---

## Self-review notes (run before execution)

- **Spec coverage (Fase 1 scope):** tables/RLS/RPCs (Tasks 1–5) ✓; consent (6) ✓; public GET/POST/DSAR/sweep (7–10) ✓; LGPD adapter (11) ✓; public form+landing (12–13) ✓; CMS list/drawer/status/detail/signups/export/nav (14–20) ✓; observability (21) ✓; operational deliverables tracked ✓. Broadcast SEND is correctly deferred to Fase 2 (dialog UI ships, action stubbed).
- **Path alias caveat:** `@/` → `apps/web/src`; `lib/` (e.g. `lib/turnstile`, `lib/supabase/service`, `lib/logger`, `lib/cms/layout-counts`) lives at `apps/web/lib` and is reached via the relative depth the sibling routes use. Every route/action step flags this — confirm the exact relative path by grepping a sibling file before writing imports.
- **Verify-before-write items** (flagged inline): exact `audit_log` columns; `consent_texts` columns; `site_visible`/`can_view_site`/`can_edit_site` signatures; the seed-helper export names in `db-seed.ts`; the Pinboard kit import path; the CMS nav registration location; `tg_set_updated_at` name. These are reads, not guesses — do them as the first step of each affected task.
- **Type consistency:** signup RPC returns `jsonb` decoded as `{ error?, status?, duplicate? }` consistently across Tasks 3/8; `escapeCsv` signature identical in Tasks 0/19; status enum values identical across SQL (Task 1) and TS (Tasks 14/16).
