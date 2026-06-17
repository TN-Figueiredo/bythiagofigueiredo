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
- **DB-gated test client setup (VERIFIED — use this exact pattern everywhere):** `apps/web/test/helpers/db-seed.ts` exports **constants** `SUPABASE_URL`, `SERVICE_KEY`, `ANON_KEY` (NOT functions). There is NO `getServiceClient`/`getAnonClient`/`createServiceClient`. Every existing integration test (e.g. `ab-tests.test.ts`, `lgpd-consents-merge.test.ts`) builds clients inline:
  ```ts
  import { createClient } from '@supabase/supabase-js'
  import { SUPABASE_URL, SERVICE_KEY, ANON_KEY, seedSite } from '../helpers/db-seed'
  const db   = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const anon = createClient(SUPABASE_URL, ANON_KEY,    { auth: { persistSession: false } })
  ```
  For a site, prefer `await seedSite(db, ...)` over `db.from('sites').select().limit(1).single()` (fresh-DB CI has no pre-seeded sites). **VERIFIED — `seedSite(db, opts?)` returns `{ siteId, orgId }` and its `SeedSiteOpts` (db-seed.ts:71) accepts `siteSlug`/`siteName`/`orgSlug`/`orgName`/`domains`/`defaultLocale`/`parentOrgId` — there is NO `slug` key (passing `{ slug: ... }` is an excess-property type error under strict TS; the tasks below use `{ siteSlug: ... }`). **PREFER `await seedSite(db)` with NO `siteSlug` — it auto-generates a unique `seed-site-${suffix}` slug (db-seed.ts:147), so tests are re-run-idempotent WITHOUT `db:reset`. Do NOT pass a fixed literal `siteSlug`: the helper reuses the single shared master org and sites are unique on `(org_id, slug)`, so a fixed literal raises `sites_org_id_slug_key` (23505) inside `seedSite` on the second run (a confusing failure). Tests only need the returned `{ siteId }`, never the slug. (Verified the hard way in Task 1 — every DB-gated test below uses bare `seedSite(db)`.)** For an **authenticated** (JWT) client, use the exported `signUserJwt(userId, role)` (returns `{ userId, jwt }`) / `seedStaffUser(...)` / `seedRbacScenario(admin)` helpers and attach the JWT: `createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: \`Bearer ${jwt}\` } } })`.
- **Setting the `app.site_id` GUC inside a test (only where a test must exercise GUC-dependent SQL):** the PostgREST `db.rpc('set_config', …)` approach does NOT work — `set_config` is not exposed via PostgREST and PostgREST pools connections so a non-local GUC does not persist to the next `rpc()` call. Use a direct `pg` Client. **`PG_URL` is NOT exported from `db-seed.ts` (it is a non-exported `const` at line 19) — define it inline in the test file mirroring `cron-locks.test.ts:19`:** `const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'`. Then: `import { Client } from 'pg'; const c = new Client({ connectionString: PG_URL }); await c.connect(); await c.query("select set_config('app.site_id',$1,false)",[siteId]); await c.query('select public.<fn>($1,…)',[…]); await c.end()`. (The waitlist signup RPC does NOT use this GUC — site is an explicit parameter — so most tests never need it.)
- **Commits:** `tipo: descrição curta` (`feat`/`fix`/`chore`/`refactor`/`docs`). Work directly on `staging` (per project convention). Use `--no-verify` only for plan/spec commits or when the pre-commit hook fails on another terminal's in-progress files; otherwise let the hook run.
- **After touching `packages/*/src/`:** run `npm run build:packages` immediately. (Fase 1 does not touch packages; if a step does, this applies.)
- **Strict TS:** no `any`, Zod for all external input, interfaces prefixed `I` only where the codebase already does so (follow local file conventions — these feature files use plain `type`/`interface` without the `I` prefix, matching `campaigns`/`contacts`).

---

## ⚠️ Round-3 fresh-eyes corrections (VERIFIED against the repo — apply each when executing the referenced task; these SUPERSEDE the inline text below where they conflict)

> A 14-dimension fresh-eyes review verified these against the live codebase. The two CRITICALs are prod-breaking and must be applied.

**C1 — CRITICAL — Seed `consent_texts` via a MIGRATION, not `seed.sql` (Task 6 Step 2 + File Structure):** VERIFIED `supabase/seed.sql` contains zero `consent_texts` rows and is dev-only (gitignored from prod; `db:push:prod` applies migrations ONLY). The structural-seed precedent is the MIGRATION `20260507000003_seed.sql` (seeds `consent_texts`). **Replace Task 6 Step 2 "Modify `supabase/seed.sql`" with: Create via `npm run db:new waitlist_consent_seed` a migration containing the idempotent insert** (`insert into public.consent_texts (id, category, locale, version, text_md) values ('launch_notification:en:launch-notification-v1-2026-06','launch_notification','en','launch-notification-v1-2026-06','Notify me by email when {name} launches. I can unsubscribe anytime.'),('launch_notification:pt-BR:launch-notification-v1-2026-06','launch_notification','pt-BR','launch-notification-v1-2026-06','Quero ser avisado(a) por email quando {name} for lançado. Posso cancelar quando quiser.') on conflict (id) do nothing;` — add `effective_at`/`superseded_at` columns if `20260507000003_seed.sql` includes them; grep to confirm). Update the File Structure DB list accordingly. Task 6 Step 3b's rationale becomes "db:reset applies migrations" and the test then guards PROD parity, not just local.

**C2 — CRITICAL — Add the keyset index for the signups list (Task 1 migration):** the signups list (Task 18) keysets on `(created_at desc, id)` within a `waitlist_id` (+ optional status), but no proposed index covers it → full per-waitlist sort at the stated 100k-row target. **Add to the Task 1 migration:**
```sql
create index if not exists waitlist_signups_list
  on public.waitlist_signups (waitlist_id, created_at desc, id) where anonymized_at is null;
```
and **replace** `waitlist_signups_by_waitlist_status (waitlist_id, status)` with `(waitlist_id, status, created_at desc, id) where anonymized_at is null` so the status-filtered keyset is also index-ordered.

**C3 — CRITICAL — Fix the impossible count claims (Task 14 + Task 18):** Supabase JS has no "approximate count()"; `count:'exact'` on 100k rows is a full COUNT per page; PostgREST has no GROUP BY so "single grouped count query" is impossible. **Task 18:** use `{ count: 'estimated' }` for the paged list (O(1), index-stats-based) OR drop the total and derive `hasNextPage` by fetching `PAGE_SIZE + 1` rows. **Task 14 per-waitlist counts:** do NOT fetch-all-and-count-in-JS; add a `SECURITY DEFINER` RPC `waitlist_signup_counts(p_site_id uuid)` returning `(waitlist_id, pending int, suppressed int)` via `select waitlist_id, count(*) filter (where status='pending') as pending, count(*) filter (where status='suppressed') as suppressed from public.waitlist_signups where site_id=$1 and anonymized_at is null group by waitlist_id` (one round-trip, `search_path=''`, grant execute to authenticated/service_role) — OR a `Promise.all` of per-row `head:true` count queries. Add this RPC as a Task-1/Task-5 migration addition + a DB-gated test.

**M1 — Handoff components are DESIGN-ONLY (top of FASE 1E):** the handoff's `components.jsx`/`waitlists.css`/`pushToast`/`Card`/`EmptyState`/`Badge`/`.wl-*` classes do NOT exist as shared production primitives. The real CMS is Tailwind-utility-based with `cms-*` tokens. **Add at the top of FASE 1E:** "Build with Tailwind `cms-*` utilities (grep `campaigns/page.tsx` + `campaigns/*-connected.tsx` for exact classes); copy a per-feature empty-state from the nearest feature; map the six `WlBadge` statuses to inline Tailwind classes keyed off the existing CSS vars (`--ok`,`--warn`,`--c-pipeline`,`--c-newsletter`,`--danger`,`--text-muted`) — NOT a `.wl-*` stylesheet or a shared `Badge`/`pushToast` import." Replace File-Structure `waitlists.css (six badge styles)` with "badge styles via inline Tailwind using existing cms CSS vars."

**M2 — Add the client orchestration islands (new task in FASE 1E, before Task 14 wiring):** the list/detail pages are server components, but row clicks, drawer/dialog open-state, and threading the server actions as callback props (project rule: NO server-action imports in client components) need a `'use client'` host. **Create `_components/waitlists-connected.tsx` and `_components/waitlist-detail-connected.tsx`** (mirror `campaigns/campaigns-connected.tsx`): they own `drawer`/`dialog`/open-state, render the table/detail + portalled overlays, and receive `createWaitlist`/`updateWaitlist`/`transitionWaitlistStatus`/`exportWaitlistSignups`/`launchWaitlist` as props from the server page (which imports the actions and passes them down). Rows use `useRouter().push`; transition buttons wrap the prop in `useTransition` + a local toast.

**M3 — Surface `slug_taken` in the drawer (Task 15 Step 3 + test):** on `{ok:false,error:'slug_taken'}`, keep the drawer OPEN, render an inline slug-field error ("This slug is already taken on this site."), and focus the Slug input. Mirror the same for the sender-email field error. Add the corresponding drawer-test assertion.

**M4 — Shared form must own the mount-GET lifecycle + Turnstile no-key branch + reduced-motion (Task 12 Step 3):**
- For `variant !== 'landing'` (embed/TipTap have no server-resolved status), on mount `fetch('/api/waitlists/${slug}')` and set a `lifecycle` ∈ `loading|open|closed|launched|unavailable|transient-error` (`aria-busy` while loading; GET 404 → `unavailable`; 5xx/network → `transient-error` + retry; never render-then-yank). For `variant === 'landing'`, skip the fetch and trust `initialStatus`. Add `unavailable` to the lifecycle type.
- **Turnstile no-key branch (real bug):** `const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY; const needsToken = Boolean(siteKey);` then `disabled={loading || !consent || !email.includes('@') || (needsToken && !token)}`. Only render the widget when `siteKey` is set — otherwise the button is permanently bricked in dev. Add a test: empty site key → submit enabled once email+consent valid.
- **Reduced motion:** put `motion-reduce:animate-none` on every spinner (the `aria-busy` + `buttonLoading` text keeps the loading state perceivable without motion).

**M5 — Snapshot the ACTUAL rendered consent text, not a label (Task 8, LGPD):** VERIFIED `consent_texts` has no write-immutability (service_role can edit `text_md` in place), so the spec's §2.1 tamper-evidence REQUIRES the audit row to store the exact displayed string. **Before the `waitlist_signup` RPC call, fetch `consent_texts.text_md` for `(category='launch_notification', locale, version=WAITLIST_CONSENT_VERSION)`, interpolate `{name}`, and pass that resolved string as `p_consent_text_snapshot`** (keep the version pointer too). Delete the "label, NOT the evidentiary basis" redefinition.

**M6 — LGPD Fase-1 rights gate (Operational + Task 13 + DPO note):** in Fase 1 the DSAR endpoint is inert and unsubscribe/withdrawal is Fase 2, so a LIVE public landing would collect anonymous signups with NO working Art. 16/18 path. **LOCK: waitlists stay `draft` (RLS-invisible, non-public) and NO `status='open'` is permitted until Fase 2 ships the live DSAR + unsubscribe.** Amend the DPO note to state the DSAR endpoint is INERT in Fase 1 and no public signups are accepted until Fase 2. (The landing page + form still ship and are testable via seeded `open` rows in DB-gated tests; production simply keeps lists in `draft`.)

**M7 — Reorder Tasks 1, 7, 8, 13 to TRUE test-first:** several tasks write the implementation in Step 1 then say "run fail-first before Step 1" (unreachable). Reorder each to: Step 1 = write the failing test + RUN (must FAIL with module-not-found for the route/page, or — for Task 1 — a missing-constraint assertion against a table-only migration, NOT a helper error); Step 2 = implement; Step 3 = RUN green + commit. For Task 1 specifically: generate a table-only migration first (no CHECKs/partial index), see the constraint assertions go RED, THEN add constraints + indexes.

**M8 — `captureServerActionError` signature + PII (Tasks 8 & 21):** VERIFIED signature is `captureServerActionError(err, ctx)` where `ctx.action` is REQUIRED (`sentry-wrap.ts:14,35`), and it forwards the RAW `err` to Sentry (does NOT redact `err.message`). **Never pass a raw caught Postgres error** (its message can echo email/ip). In every waitlist catch block: `getLogger().error(tag, { code })` + `Sentry.captureException(new Error(\`${actionTag} ${code}: ${redactMessage(err?.message ?? '')}\`), { tags: { component: 'waitlist', action: actionTag } })` — mirror the Task 8 signup route. If using `captureServerActionError`, it MUST be `captureServerActionError(err, { action: '<name>', site_id: siteId, component: 'waitlist' })` (two args, `action` required).

**M9 — Cite only `contacts` for the local `requireEditAccess` shape (Task 14 conventions block):** VERIFIED `campaigns/bulk-actions.ts:13` returns `Promise<string>` (call sites do `const siteId = await requireEditAccess()`), NOT the object shape. Only `contacts/actions.ts:22-31` returns `{ siteId, timezone }`. Drop the bulk-actions co-citation; mirror `contacts` exactly so `const { siteId } = await requireEditAccess()` holds.

**M10 — Retention sweep enumerates active sites + fix prose (Task 10 + §2.4):** filter the enumeration to `from('sites').select('id').eq('cms_enabled', true)` (grep to confirm the column name) so dead/disabled sites aren't swept; correct the §2.4 prose that claims a shared "active-site enumeration the cron infra provides" — there is no such helper; the route enumerates `cms_enabled` sites directly and the per-site loop is bounded by the (small) site count.

**M11 — Task 10 test assertion (case c):** `withCronLock` returns `Response.json({ ...fnResultMinusStatus }, { status: 200 })`; the fn returns `{ status:'ok', sites }`, so the body is `{ sites: N }` with NO `ok` key. Assert `res.status === 200` AND `body.sites >= 1` — do NOT assert `body.ok`.

**M12 — `consentLabel` must carry `{name}` (Task 12 Step 1, LGPD consistency):** the visible consent text MUST match the ledgered `consent_texts.text_md` after `{name}` substitution. Make `consentLabel` a function `(name: string) => '…${name}…'` (both locales) and render the name as the bolded span the prototype uses (`waitlist-public.jsx:257`), so the displayed text equals the audited text verbatim.

**M13 — Email-prefix search escaping (Task 18):** there is no verified `escapeIlike` helper — escape inline before `.ilike`: `const safe = q.replace(/[\\%_]/g, (m) => '\\' + m); …ilike('email', safe + '%')` so a user typing `%`/`_` cannot inject wildcards. Document that the prefix search is a per-`waitlist_id` partition scan (acceptable; the leading `waitlist_id` already narrows it) unless a `text_pattern_ops` index is added.

---

## File Structure (Prep + Fase 1)

**Database (one migration per logical unit, via `npm run db:new`):**
- `supabase/migrations/<ts>_waitlist_tables.sql` — `waitlists`, `waitlist_signups`, `waitlist_translations` + constraints + indexes + `updated_at` trigger.
- `supabase/migrations/<ts>_waitlist_rls.sql` — RLS policies (public read; staff read; NO anon-insert policy).
- `supabase/migrations/<ts>_waitlist_signup_rpc.sql` — `waitlist_signup(...)` DEFINER RPC (FOR UPDATE branching + audit insert).
- `supabase/migrations/<ts>_waitlist_rate_check_rpc.sql` — `waitlist_rate_check(...)`.
- `supabase/migrations/<ts>_waitlist_lgpd.sql` — `lgpd_phase1_cleanup` waitlist branch + `waitlist_retention_sweep(p_site_id)` helper RPC.
- `supabase/migrations/<ts>_waitlist_consent_seed.sql` (via `npm run db:new`) — `consent_texts` rows for `launch_notification` (idempotent `on conflict (id) do nothing`). **NOT `seed.sql`** — that file is dev-only/gitignored from prod; `db:push:prod` applies migrations only (C1).
- `supabase/migrations/<ts>_waitlist_signup_counts_rpc.sql` (via `npm run db:new`) — `waitlist_signup_counts(p_site_id uuid)` DEFINER RPC returning `(waitlist_id, pending int, suppressed int)` for the CMS list KPIs (C3). (May be folded into the Task 5 migration.)

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
- `_components/` — `waitlists-table.tsx`, `wl-badge.tsx`, `edit-drawer.tsx`, `status-strip.tsx`, `launch-cta.tsx`, `signups-tab.tsx`, `export-dialog.tsx`, `broadcast-dialog.tsx` *(broadcast dialog UI ships in Fase 1 but its `launchWaitlist` action is stubbed to `not_implemented` until Fase 2; the detail page renders the **Edit** button only — Embed is Fase 3)*.
- `waitlists.css` (or Tailwind) — six status-badge styles.

**Shared/lib:**
- `apps/web/lib/cms/csv.ts` — extracted `escapeCsv` (Prep).
- `apps/web/lib/waitlists/scrub.ts` — PII scrub + message redactor (Task 0b — Prep, lands BEFORE Task 8 so the signup route imports `redactMessage` from creation).
- `apps/web/src/lib/lgpd/domain-adapter.ts` (modify) — `collectUserData` + pre-capture.
- `apps/web/lib/cms/layout-counts.ts` (modify) — nav badge counts (`fetchLayoutCountsInner` at line 4).

**Operational (out-of-repo, tracked as checklist):**
- Vercel WAF rule for `POST /api/waitlists/:slug/signup`.
- `apps/web/vercel.json` cron entry for the retention sweep (there is NO root `vercel.json`).

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
    expect(escapeCsv('\rX')).toBe(`"'\rX"`)   // CR branch (FORMULA_PREFIXES includes '\r')
    expect(escapeCsv('=')).toBe(`"'="`)         // value that is ONLY a prefix char
    expect(escapeCsv('')).toBe('')              // empty string boundary (s.length>0 guard)
  })
})
```

**File placement (VERIFIED):** `apps/web/tsconfig.json` maps `@/lib/cms/*` → `./lib/cms/*`, i.e. `apps/web/lib/cms` (NOT `apps/web/src/lib`). The catch-all `@/*` → `./src/*` does not apply because the explicit `@/lib/cms/*` prefix mapping wins. **Place the file at `apps/web/lib/cms/csv.ts`** so `@/lib/cms/csv` resolves correctly and it sits next to the other cms libs (`site-context.ts`, `auth-guards.ts`, `layout-counts.ts`). The File Structure entry already says `apps/web/lib/cms/csv.ts` — keep it.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w apps/web -- csv.test.ts`
Expected: FAIL — `Cannot find module '@/lib/cms/csv'`.

- [ ] **Step 3: Write the implementation**

> **Do NOT add a `'use server'` directive to `apps/web/lib/cms/csv.ts`** — it is a plain sync helper imported by `'use server'` action files. Marking it `'use server'` would force every export to be an async server action and break the sync `escapeCsv` signature.

```ts
// apps/web/lib/cms/csv.ts  (plain module — NO 'use server')
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

In `apps/web/src/app/cms/(authed)/contacts/actions.ts`: add `import { escapeCsv } from '@/lib/cms/csv'` at the top and DELETE the local `const escapeCsv = (v: unknown) => { ... }` closure. **VERIFIED:** that closure is at `contacts/actions.ts:275-280`, defined INSIDE the `rows.map((r) => { ... })` callback (so it is re-created per-row). After deleting it and adding the top-level import, the map body's `escapeCsv(...)` call sites resolve to the imported function unchanged.

> **Behavior change (intentional):** the shared helper ALSO neutralizes formula-injection, so contacts CSV cells starting with `=`,`+`,`-`,`@`,TAB,CR will now be quote-prefixed. This is a deliberate security hardening, NOT a no-op. Adjust any existing contacts CSV test that asserted the old plain-`escapeCsv` output for such cells.

- [ ] **Step 6: Verify contacts typecheck + existing tests still pass**

Run: `npm run typecheck -w apps/web && npm test -w apps/web -- contacts`
Expected: PASS. If a pre-existing contacts test asserts non-hardened CSV output for a `=`/`+`/`-`/`@` cell, update that assertion (the only intended behavior change).

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/cms/csv.ts apps/web/test/lib/cms/csv.test.ts apps/web/src/app/cms/\(authed\)/contacts/actions.ts
git commit -m "refactor: extract shared escapeCsv with formula-injection hardening"
```

---

### Task 0b: PII scrub + message redactor (PREP — must land BEFORE Task 8)

> **Why a Prep task (not Task 21):** the signup route (Task 8) is the primary PII surface. Landing `scrub.ts` first lets Task 8 import `redactMessage` from day one (route born scrubbed, not retrofitted) — same prep-before-consumer discipline as Task 0 before Task 19a. Only the cross-file Sentry-tag WIRING stays at Task 21 (Step 3); the helper + its test move here.

**Files:**
- Create: `apps/web/lib/waitlists/scrub.ts`
- Create: `apps/web/test/lib/waitlists/scrub.test.ts`

- [ ] **Step 1: Write the failing scrub test** — `apps/web/test/lib/waitlists/scrub.test.ts`: assert `scrub({ email, ip, user_agent, foo })` deep-equals `{ foo }` (drops `email`/`ip`/`user_agent`); AND assert the message-redactor replaces an email and an inet inside a free-text string (e.g. `redactMessage('dup key (a@b.com) 203.0.113.5')` contains neither `a@b.com` nor `203.0.113.5`). **RUN: `npm test -w apps/web -- scrub` → must FAIL (`Cannot find module '.../scrub'`).**
- [ ] **Step 2: Implement `scrub.ts`** — `scrub(ctx)` strips the `email`/`ip`/`user_agent` keys; `redactMessage(s)` regex-redacts anything matching an email or IPv4/IPv6 literal. Plain sync module (NO `'use server'`), placed at `apps/web/lib/waitlists/scrub.ts` (reached from the signup route via deep-relative `../../../../../../lib/waitlists/scrub`, same depth as `lib/turnstile`). **RUN: same test → must PASS.**
- [ ] **Step 3: Commit** `feat(waitlists): PII scrub + message redactor`.

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
-- C2: keyset index for the signups list (unfiltered Next/Prev on (created_at desc, id))
create index if not exists waitlist_signups_list
  on public.waitlist_signups (waitlist_id, created_at desc, id) where anonymized_at is null;
-- C2: status-filtered keyset is ALSO index-ordered (created_at/id trail the status key)
create index if not exists waitlist_signups_by_waitlist_status
  on public.waitlist_signups (waitlist_id, status, created_at desc, id) where anonymized_at is null;
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
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('waitlist schema', () => {
  it('rejects a signup row with consent_launch_notification=false (only that field invalid)', async () => {
    const { siteId } = await seedSite(db, { siteSlug: 'wl-schema' })
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'schema-test', name: 'Schema Test', status: 'open' })
      .select('id, site_id').single()
    // Row valid in EVERY other respect — flip ONLY consent to false.
    const bad = await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'valid@b.com',
      consent_launch_notification: false, consent_text_version: 'v1',
    })
    expect(bad.error?.code).toBe('23514') // check_violation
    expect(bad.error?.message ?? '').toContain('consent_required') // the NAMED constraint, not a different violation
    await db.from('waitlists').delete().eq('id', wl!.id)
  })

  it('enforces the partial unique index on (waitlist_id, email) where not anonymized', async () => {
    const { siteId } = await seedSite(db, { siteSlug: 'wl-dup' })
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'dup-test', name: 'Dup', status: 'open' })
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

> `seedSite(db, opts)` is the verified helper (`db-seed.ts:85`); confirm its return shape (it returns the created site id) and adjust the destructure name if needed.

- [ ] **Step 5: Run the test to verify it FAILS for the right reason, then passes**

First, with the migration NOT yet applied (or before adding the constraints), run and confirm the failure is the intended assertion failure (e.g. `relation "waitlist_signups" does not exist` if run before Step 3, or a missing-constraint assertion mismatch) — NOT a module/import error.
Run: `npm run db:start && HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-schema`
Expected after Step 3 applied: PASS (both cases).

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

-- waitlists: insert/update for editors+ (NOT 'for all' — delete is gated separately per spec §1)
drop policy if exists waitlists_insert on public.waitlists;
create policy waitlists_insert on public.waitlists for insert to authenticated
  with check (public.can_edit_site(site_id));
drop policy if exists waitlists_update on public.waitlists;
create policy waitlists_update on public.waitlists for update to authenticated
  using (public.can_edit_site(site_id)) with check (public.can_edit_site(site_id));
-- waitlists: DELETE only for site-user admins (spec §1 mandates can_admin_site_users for hard-delete)
drop policy if exists waitlists_delete on public.waitlists;
create policy waitlists_delete on public.waitlists for delete to authenticated
  using (public.can_admin_site_users(site_id));

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

> Verify `site_visible`, `can_view_site`, `can_edit_site`, `can_admin_site_users` signatures by grepping `supabase/migrations` (CLAUDE.md lists them). All take a single `uuid` site id (VERIFIED: schema.sql:3751/3760/3778/4803).

- [ ] **Step 2: Apply + write the RLS test**

```ts
// apps/web/test/integration/waitlist-rls.test.ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, ANON_KEY, seedRbacScenario, signUserJwt } from '../helpers/db-seed'

const svc  = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const anon = createClient(SUPABASE_URL, ANON_KEY,    { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('waitlist RLS', () => {
  it('anon cannot SELECT a REAL waitlist_signups row (RLS denial, not empty table)', async () => {
    // Seed a row via the service client first, so a pass PROVES RLS denial — not that
    // the table happens to be empty (which would pass even if the staff-read policy were
    // wrongly granted to anon).
    const scenario = await seedRbacScenario(svc)
    const { data: wl } = await svc.from('waitlists')
      .insert({ site_id: scenario.siteAId, slug: 'rls-leak', name: 'Leak', status: 'open' })
      .select('id, site_id').single()
    await svc.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'seeded@x.com',
      consent_launch_notification: true, consent_text_version: 'v1',
    })
    const { data } = await anon.from('waitlist_signups').select('id').eq('waitlist_id', wl!.id)
    expect((data ?? []).length).toBe(0) // row exists but is invisible to anon
    await svc.from('waitlists').delete().eq('id', wl!.id)
  })

  it('anon cannot INSERT waitlist_signups directly AND no row is created', async () => {
    const scenario = await seedRbacScenario(svc) // creates site A + site B + staff
    const siteId = scenario.siteAId
    const { data: wl } = await svc.from('waitlists')
      .insert({ site_id: siteId, slug: 'rls-test', name: 'RLS', status: 'open' })
      .select('id, site_id').single()
    const res = await anon.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'x@y.com',
      consent_launch_notification: true, consent_text_version: 'v1',
    })
    expect(res.error).not.toBeNull() // RLS denied
    // Prove the row was NOT silently created.
    const { count } = await svc.from('waitlist_signups')
      .select('*', { count: 'exact', head: true }).eq('waitlist_id', wl!.id)
    expect(count).toBe(0)
    await svc.from('waitlists').delete().eq('id', wl!.id)
  })

  it('cross-site: editor of site A cannot SELECT site B signups (multi-ring isolation)', async () => {
    const scenario = await seedRbacScenario(svc)
    // RbacScenario fields are FLAT strings: `editorAId` IS the user id (not `editorA.userId`).
    const { jwt } = signUserJwt(scenario.editorAId, 'editor')
    const editorA = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    // Seed a signup on site B (the OTHER ring).
    const { data: wlB } = await svc.from('waitlists')
      .insert({ site_id: scenario.siteBId, slug: 'wl-b', name: 'B', status: 'open' })
      .select('id, site_id').single()
    await svc.from('waitlist_signups').insert({
      waitlist_id: wlB!.id, site_id: wlB!.site_id, email: 'b@x.com',
      consent_launch_notification: true, consent_text_version: 'v1',
    })
    const { data } = await editorA.from('waitlist_signups').select('id').eq('waitlist_id', wlB!.id)
    expect((data ?? []).length).toBe(0)
    await svc.from('waitlists').delete().eq('id', wlB!.id)
  })

  it('anon cannot read draft waitlists', async () => {
    const scenario = await seedRbacScenario(svc)
    const { data: wl } = await svc.from('waitlists')
      .insert({ site_id: scenario.siteAId, slug: 'draft-test', name: 'Draft', status: 'draft' })
      .select('id').single()
    const { data } = await anon.from('waitlists').select('id').eq('id', wl!.id)
    expect((data ?? []).length).toBe(0)
    await svc.from('waitlists').delete().eq('id', wl!.id)
  })
})
```

> `seedRbacScenario(svc)` (db-seed.ts:400) returns two sites + staff users. **VERIFIED — the `RbacScenario` interface (db-seed.ts:379) uses FLAT string fields, NOT nested objects:** `siteAId`, `siteBId`, `editorAId`, `orgAdminId`, `superAdminId`, `reporterAId`, `randomId` (each is the id string directly). There is NO `scenario.siteA.id` / `scenario.editorA.userId` — use `scenario.siteAId` and pass `scenario.editorAId` straight into `signUserJwt`. `signUserJwt(userId, role)` (db-seed.ts:231) returns `{ userId, jwt }`.

- [ ] **Step 3: Run + fail-first check**

Run before the RLS migration is applied → expect the cross-site test to FAIL because the `waitlist_signups_staff_read` policy (or RLS-enable) is missing, NOT an import error. Then apply and run:
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

**Step 1a (REQUIRED first — verify schema):** before writing the INSERT, confirm the real `audit_log` columns. VERIFIED at `supabase/migrations/20260507000001_schema.sql:721-734`: `id, actor_user_id, action (text NOT NULL), resource_type (text NOT NULL), resource_id (uuid, nullable), org_id, site_id, before_data, after_data, ip, user_agent, created_at`. There is **NO `event_type` column**, and `action` is **NOT NULL**. The canonical audit INSERT is at schema.sql:5068. The event string maps to the **`action`** column.

```sql
-- =============================================================================
-- MIGRATION: waitlist_signup_rpc
-- Single entry point for public signups. SECURITY DEFINER, search_path=''.
-- site_id is an EXPLICIT parameter (the route passes the trusted x-site-id);
-- re-validates list is 'open'; FOR UPDATE branching for idempotent
-- resurrect/duplicate; direct append-only audit insert.
-- NOTE: we do NOT read current_setting('app.site_id') — that GUC is never set
-- on the service client (verified: service.ts sets no GUC, middleware only sets
-- the x-site-id HTTP header). Relying on it would resolve the slug across ALL
-- sites (cross-tenant write). Site is passed explicitly, exactly like
-- contact_rate_check in app/(public)/contact/actions.ts:74-75 (which passes
-- p_site_id: ctx.siteId from getSiteContext()).
-- NOTE (do NOT copy the campaign route): the campaign submit route resolves the
-- campaign by SLUG ALONE (campaigns/[slug]/submit/route.ts:50-53, no x-site-id) —
-- that is single-site legacy and is intentionally NOT the precedent here.
-- Waitlists are stricter: always resolve by (slug, explicit site_id).
--
-- PARAMETER TYPE NOTE (load-bearing): p_email is `text`, NOT `public.citext`.
-- PostgREST resolves an RPC by argument types from the JSON it sends as text;
-- text->citext is only an assignment cast and PostgREST will fail to locate a
-- citext-param overload (PGRST202 "Could not find the function ..."), 500-ing
-- the whole public signup path in prod. Every existing RPC (contact_rate_check
-- schema.sql:3950) takes p_email TEXT and casts internally — mirror that: declare
-- a local public.citext and cast once, use it everywhere email is compared/inserted.
-- =============================================================================
drop function if exists public.waitlist_signup(uuid, text, text, text, text, text, text, inet, text);

create or replace function public.waitlist_signup(
  p_site_id              uuid,
  p_slug                 text,
  p_email                text,
  p_locale               text,
  p_consent_version      text,
  p_consent_text_snapshot text,
  p_source_surface       text,
  p_ip                   inet,
  p_user_agent           text
) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare
  v_email       public.citext := p_email::public.citext; -- cast ONCE; use everywhere
  v_site_id     uuid;
  v_org_id      uuid;
  v_waitlist_id uuid;
  v_status      text;
  v_existing    public.waitlist_signups;
  v_signup_id   uuid;
  v_event       text;
begin
  if p_site_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  -- Resolve waitlist by (slug, explicit site_id). Never by slug alone.
  select w.id, w.site_id, w.status
    into v_waitlist_id, v_site_id, v_status
    from public.waitlists w
   where w.slug = p_slug and w.site_id = p_site_id
   limit 1;

  if v_waitlist_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_status <> 'open' then
    return jsonb_build_object('error', 'waitlist_not_open', 'status', v_status);
  end if;

  select org_id into v_org_id from public.sites where id = v_site_id;

  -- Lock the live (non-anonymized) row for this (waitlist, email), if any.
  select * into v_existing
    from public.waitlist_signups s
   where s.waitlist_id = v_waitlist_id and s.email = v_email and s.anonymized_at is null
   for update;

  if not found then
    insert into public.waitlist_signups (
      waitlist_id, site_id, email, locale, consent_launch_notification,
      consent_text_version, consent_grant_at, status, source_surface, ip, user_agent
    ) values (
      v_waitlist_id, v_site_id, v_email, p_locale, true,
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

  -- Append-only audit row (REAL columns: action is NOT NULL; no event_type).
  -- Hash via core sha256(...::bytea) — pgcrypto's digest() is NOT installed in
  -- this project (verified: no `create extension pgcrypto`; existing fns use sha256).
  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
  values (null, v_event, 'waitlist_signup', v_signup_id, v_org_id, v_site_id,
          jsonb_build_object(
            'email_hash', encode(sha256(v_email::text::bytea), 'hex'),
            'source_surface', p_source_surface,
            'consent_text_version', p_consent_version,
            'consent_text_snapshot', p_consent_text_snapshot),
          p_ip, p_user_agent);

  return jsonb_build_object('duplicate', false);
end
$fn$;

-- SECURITY (load-bearing): the route calls this RPC via getSupabaseServiceClient()
-- (service_role), which ALREADY has execute (ALTER DEFAULT PRIVILEGES ... GRANT ALL ON
-- FUNCTIONS TO service_role, schema.sql:7450). Do NOT grant to anon — a direct anon
-- PostgREST call to /rest/v1/rpc/waitlist_signup with the public NEXT_PUBLIC_SUPABASE_ANON_KEY
-- would BYPASS Turnstile + the app-layer rate-limit + the UUID-shape guard entirely
-- (waitlist_signup does NOT call waitlist_rate_check internally), contradicting the
-- "signups funnel exclusively through the RPC/route" goal.
-- Because schema.sql:7446/7448/7450 default-privilege-grant EVERY new public function to
-- anon AND authenticated AND service_role, `revoke ... from public` alone is INSUFFICIENT
-- (PUBLIC and role-specific grants are distinct) — revoke from public, anon, AND
-- authenticated explicitly, then grant to service_role only.
-- CITATION NOTE (do NOT copy verbatim): update_campaign_atomic (20260611000001:197-200) is
-- the nearest revoke/grant precedent, but it is a DIFFERENT posture — it revokes from
-- public+anon ONLY (NOT authenticated) and grants to BOTH authenticated AND service_role,
-- because that RPC is an authenticated-staff write. waitlist_signup is the OPPOSITE: it must
-- be reachable by NOBODY except the service-role route, so it ALSO revokes from authenticated
-- and grants to service_role alone. Use the exact two lines below, not the campaign pattern.
revoke all on function public.waitlist_signup(uuid, text, text, text, text, text, text, inet, text) from public, anon, authenticated;
grant execute on function public.waitlist_signup(uuid, text, text, text, text, text, text, inet, text) to service_role;
```

> **Consent-event scope (spec §8 reconciliation):** Fase 1 writes only `consent_granted` (fresh) and `consent_regranted` (resurrect). Spec §8 also lists `consent_withdrawn` as a Fase-1 audit event, but withdrawal is driven by `unsubscribe_via_token`, which is **Fase 2** (see Out of scope). This is a known internal-spec inconsistency, resolved in favor of the §8 phase boundary: `consent_withdrawn` is deferred to Fase 2 with the unsubscribe wiring.

> **Consent-evidence basis (LGPD proof-of-consent — LOCKED):** the audit row stores `consent_text_version` (= `WAITLIST_CONSENT_VERSION`) as an **immutable pointer into the append-only `consent_texts` ledger** (`consent_texts` is supersession-tracked via `effective_at`/`superseded_at` — schema.sql:957). The verbatim text the data subject agreed to is therefore always recoverable by joining `(category='launch_notification', locale, version)` → `consent_texts.text_md`. We deliberately do NOT denormalize the full `text_md` into every audit row. The route's `p_consent_text_snapshot` (Task 8) is a human-readable label (`[locale] version`), NOT the evidentiary basis — the version pointer is. **This is the locked consent-ledger design; Task 6 Step 3 adds the DB-gated test that `WAITLIST_CONSENT_VERSION` resolves a `consent_texts` row for BOTH `en` and `pt-BR` so a version bump that forgets the seed fails CI (linking the runtime constant to the ledger).**

- [ ] **Step 2: Apply + write the test**

```ts
// apps/web/test/integration/waitlist-signup-rpc.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('waitlist_signup RPC', () => {
  let siteId: string, slug: string
  beforeAll(async () => {
    const s = await seedSite(db, { siteSlug: 'wl-rpc' })
    siteId = s.siteId
    slug = 'rpc-test-' + Math.floor(Date.now() % 100000)
    await db.from('waitlists').insert({ site_id: siteId, slug, name: 'RPC', status: 'open' })
  })
  // site_id is an EXPLICIT param — the route passes the trusted x-site-id value.
  const call = (email: string) => db.rpc('waitlist_signup', {
    p_site_id: siteId, p_slug: slug, p_email: email, p_locale: 'pt-BR',
    p_consent_version: 'launch-notification-v1-2026-06',
    p_consent_text_snapshot: 'Quero ser avisado…', p_source_surface: 'landing',
    p_ip: '203.0.113.5', p_user_agent: 'vitest',
  })

  it('fresh signup returns duplicate:false and writes a consent_granted audit row WITHOUT raw email', async () => {
    const { data, error } = await call('fresh@x.com')
    expect(error).toBeNull()
    expect((data as { duplicate: boolean }).duplicate).toBe(false)
    const { data: sup } = await db.from('waitlist_signups').select('id')
      .eq('waitlist_id', (await db.from('waitlists').select('id').eq('slug', slug).eq('site_id', siteId).single()).data!.id)
      .eq('email', 'fresh@x.com').single()
    const { data: aud } = await db.from('audit_log').select('action, after_data')
      .eq('resource_type', 'waitlist_signup').eq('resource_id', sup!.id).single()
    expect(aud!.action).toBe('consent_granted')
    // PII-free: the raw email must NOT appear; the sha256 hash MUST.
    expect(JSON.stringify(aud!.after_data)).not.toContain('fresh@x.com')
    expect((aud!.after_data as { email_hash?: string }).email_hash).toMatch(/^[a-f0-9]{64}$/)
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
  it('resolves the waitlist ONLY within the passed site_id (cross-site isolation)', async () => {
    // Seed the SAME slug on a second site; calling with site A must not touch site B.
    const b = await seedSite(db, { siteSlug: 'wl-rpc-b' })
    await db.from('waitlists').insert({ site_id: b.siteId, slug, name: 'RPC-B', status: 'open' })
    const { data } = await db.rpc('waitlist_signup', {
      p_site_id: siteId, p_slug: slug, p_email: 'iso@x.com', p_locale: 'en',
      p_consent_version: 'launch-notification-v1-2026-06', p_consent_text_snapshot: 'x',
      p_source_surface: 'landing', p_ip: null, p_user_agent: 'vitest',
    })
    expect((data as { duplicate: boolean }).duplicate).toBe(false)
    // The signup landed on site A's list, NOT site B's.
    const { count: onB } = await db.from('waitlist_signups')
      .select('*', { count: 'exact', head: true }).eq('site_id', b.siteId).eq('email', 'iso@x.com')
    expect(onB).toBe(0)
    const { count: onA } = await db.from('waitlist_signups')
      .select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('email', 'iso@x.com')
    expect(onA).toBe(1)
  })
})
```

- [ ] **Step 3: Run + fail-first check**

Run against the DB BEFORE applying the RPC migration → expect failure `Could not find the function public.waitlist_signup` (intended), NOT an import/module error. Then apply and run:
Run: `npm run db:reset && HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-signup-rpc`
Expected: PASS (all cases, including the audit-row PII assertion and cross-site isolation).

- [ ] **Step 4: Add the audit-immutability REGRESSION-GUARD test (separate file + commit — independently bisectable)**

> **This is a regression-guard, NOT a fail-first TDD cycle:** `audit_log` already has no UPDATE/DELETE policy (schema.sql:6228/6233/6238), so there is no meaningful red phase — the test passes on the current tree and exists to catch a future stray policy. Do NOT waste time hunting for a red that cannot occur; commit it separately for bisectability.

Create `apps/web/test/integration/audit-log-append-only.test.ts`. (1) Assert an **authenticated** client cannot UPDATE or DELETE an `audit_log` row (RLS exposes only SELECT policies — schema.sql:6228/6233/6238). Build the authenticated client via `signUserJwt(userId,'editor')` + `Authorization` header (per the conventions block); seed any audit row via the service client; attempt `update`/`delete` and assert the operation errors OR affects 0 rows. (`signUserJwt()` may be called with no args — it generates a userId and returns `{ userId, jwt }`; the JWT does not need a real DB user for this RLS-denial assertion.):
```ts
const { jwt } = signUserJwt(undefined, 'editor') // returns { userId, jwt }; no DB user needed for the denial check
const authed = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${jwt}` } } })
// Seed an audit row first via the service client (svc), capturing its id as someAuditId.
const upd = await authed.from('audit_log').update({ action: 'tampered' }).eq('id', someAuditId).select('id')
expect((upd.data ?? []).length).toBe(0) // RLS: no UPDATE policy → 0 rows
```
(2) Run it → PASS (it would only fail if a stray UPDATE/DELETE policy were ever added). (3) Commit separately: `test(waitlists): audit_log append-only RLS regression guard`.

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
-- SECURITY: same as waitlist_signup — the route calls this via the service client only.
-- Granting anon would let an attacker probe the per-IP/per-email count oracle directly.
-- `revoke ... from public` does NOT undo the default-privilege grants to anon/authenticated
-- (schema.sql:7446/7448), so revoke all three roles, then grant service_role only.
revoke all on function public.waitlist_rate_check(uuid, text, text) from public, anon, authenticated;
grant execute on function public.waitlist_rate_check(uuid, text, text) to service_role;
```

- [ ] **Step 2: Write the failing test** — append to `apps/web/test/integration/waitlist-signup-rpc.test.ts`:

```ts
it('waitlist_rate_check returns false after 5 signups in the window', async () => {
  const r = await seedSite(db, { siteSlug: 'wl-rate' })
  const { data: wl } = await db.from('waitlists')
    .insert({ site_id: r.siteId, slug: 'rate-wl', name: 'Rate', status: 'open' })
    .select('id, site_id').single()
  for (let i = 0; i < 5; i++) {
    await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: `flood${i}@x.com`,
      consent_launch_notification: true, consent_text_version: 'v1', ip: '203.0.113.50',
    })
  }
  // Same IP, 6th attempt → over the limit (5 in 10 min).
  const { data } = await db.rpc('waitlist_rate_check', { p_site_id: wl!.site_id, p_ip: '203.0.113.50', p_email: 'new@x.com' })
  expect(data).toBe(false)
})
```

- [ ] **Step 2b: Add the anon-denial test (locks the no-direct-anon posture against a future stray grant)** — append to `apps/web/test/integration/waitlist-signup-rpc.test.ts`. An ANON-key client calling EITHER RPC must be DENIED (permission error / PGRST), because both are `service_role`-only:

```ts
it('anon client is DENIED direct rpc to waitlist_signup AND waitlist_rate_check', async () => {
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const s1 = await anon.rpc('waitlist_signup', {
    p_site_id: siteId, p_slug: slug, p_email: 'anon@x.com', p_locale: 'en',
    p_consent_version: 'v1', p_consent_text_snapshot: 'x', p_source_surface: 'landing',
    p_ip: null, p_user_agent: 'vitest',
  })
  expect(s1.error).not.toBeNull() // permission denied / PGRST function-not-found
  const s2 = await anon.rpc('waitlist_rate_check', { p_site_id: siteId, p_ip: null, p_email: 'anon@x.com' })
  expect(s2.error).not.toBeNull()
})
```

> Import `ANON_KEY` from `../helpers/db-seed` at the top of the file. This test would PASS today (the grants exclude anon) and exists to fail CI if a future migration re-adds `grant ... to anon`.

- [ ] **Step 3: Run fail-first then pass** — before applying this migration: `HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-signup-rpc` → expect `Could not find the function public.waitlist_rate_check` (intended), NOT an import error. Then `npm run db:reset && HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-signup-rpc`. Expected: PASS (including the anon-denial test).

- [ ] **Step 4: Commit** `feat(waitlists): waitlist_rate_check RPC + anon-denial guard`.

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
--     COPY THE ENTIRE CURRENT BODY UNCHANGED from the latest defining migration
--     (VERIFIED latest: supabase/migrations/20260602000003_lgpd_phase1_unique_collision_fix.sql),
--     preserving `SECURITY DEFINER SET search_path TO 'public'` and the EXACT caller
--     guard verbatim (do NOT rewrite it — `IS DISTINCT FROM` vs `=` differ on NULL):
--       IF auth.role() NOT IN ('service_role','supabase_admin')
--          AND auth.uid() IS DISTINCT FROM p_user_id THEN
--         RAISE EXCEPTION 'forbidden: can only clean up own account' USING ERRCODE = 'P0001';
--       END IF;
--
--     p_pre_capture is a JSONB OBJECT keyed by category (verified: the existing
--     branches read `p_pre_capture ? 'newsletter_emails'` +
--     `jsonb_array_elements_text(p_pre_capture->'newsletter_emails')`). It is NOT a
--     flat array — `email = any(p_pre_capture)` would be a type error.
--
--     ADD this block (Task 11 populates the new 'waitlist_emails' key in phase1Cleanup):
--       IF p_pre_capture ? 'waitlist_emails' THEN
--         UPDATE public.waitlist_signups
--            SET email = encode(sha256(email::text::bytea),'hex'),
--                ip = NULL, user_agent = NULL, locale = NULL, anonymized_at = now()
--          WHERE email = ANY (
--                  SELECT (jsonb_array_elements_text(p_pre_capture->'waitlist_emails'))::public.citext)
--            AND anonymized_at IS NULL;
--       END IF;
--     CONSENT-PROVENANCE RETENTION (DECIDED — option (a), document verbatim in the migration):
--       The SET clause deliberately does NOT touch `consent_grant_at` or `consent_text_version`.
--       Both are RETAINED on the anonymized row as LGPD Art. 15 proof-of-consent (the immutable
--       pointer into the append-only consent_texts ledger + the timestamp the subject consented).
--       The email is hashed and ip/ua/locale are nulled, so the row is no longer linkable to a
--       natural person; the retained consent timestamp is accepted residual, not an omission.
--       (Same posture applied in the retention sweep's PASS-1 SET clause below.)
--     (CITEXT-NATIVE comparison is load-bearing: waitlist_signups.email is public.citext.
--      Casting the column to ::text and the array to text[] (`email::text = ANY(text[])`,
--      as the contact_submissions branch at 20260602000003:57-67 does) is CASE-SENSITIVE —
--      a pre-captured email whose case differs from the stored signup would NOT be
--      anonymized, an LGPD erasure gap. Cast the array elements to public.citext so the
--      comparison is case-insensitive, matching the newsletter_subscriptions branch which
--      compares in citext space (20260602000003:53 `email = v_email`).
--      The dedicated 'waitlist_emails' key — populated by Task 11 — covers the user's
--      auth/newsletter/contact emails; truly anonymous waitlist-only emails are NOT
--      linkable to a user_id and are covered by the retention sweep + DSAR, not here.)

-- (2) Net-new sweep helper. Returns the PASS-2 affected-row count so tests can
--     assert idempotency (second run touches 0 ip/ua rows) without a tautology.
drop function if exists public.waitlist_retention_sweep(uuid);
create or replace function public.waitlist_retention_sweep(p_site_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_pass2 integer;
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

  -- PASS 2: network-PII minimization; the `ip is not null or user_agent is not null`
  -- guard makes it idempotent — a second run matches 0 rows (returned count = 0).
  update public.waitlist_signups s set ip=null, user_agent=null
  where s.site_id = p_site_id
    and (s.ip is not null or s.user_agent is not null)
    and s.created_at < now() - interval '30 days';
  get diagnostics v_pass2 = row_count;
  return v_pass2;
end; $$;
revoke all on function public.waitlist_retention_sweep(uuid) from public, anon, authenticated;
grant execute on function public.waitlist_retention_sweep(uuid) to service_role;
```

> The retention-window numbers (30/7/90/30) match spec §2.4 constants. Keep them inline here; the cron route (Task 10) wraps the per-site iteration in `withCronLock` and calls this RPC per site.

> **Window provenance decision (LOCKED — `created_at`, EXCEPT the withdrawal branch):** the closed/launched (7d) and orphan-pending (90d) windows key on `s.created_at` (storage-age), NOT `consent_grant_at` (consent-recency). A signup that was suppressed-then-resurrected keeps its ORIGINAL `created_at`, so a re-consented row is swept on storage-age. This is intentional and accepted: the closed/launched (7d) window is purpose-consummation (status-driven, not consent-driven), and the orphan-pending (90d) window is long enough that resurrect does not need to extend it. **Resurrect does NOT extend the orphan/spent windows.** **EXCEPTION — the unsubscribe-withdrawal branch (PASS-1) deliberately keys on `s.suppressed_at`, NOT `created_at`** (it is a post-withdrawal dispute/audit grace measured from the moment of withdrawal). Do NOT "fix" the withdrawal branch to `created_at` — that would anonymize a just-withdrawn old signup immediately and destroy the grace semantics. Document this exception verbatim in the migration comment, and do NOT generalize either to `greatest(created_at, consent_grant_at)`.

- [ ] **Step 2: Write the failing tests** — `apps/web/test/integration/waitlist-retention.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('waitlist retention + lgpd phase1 branch', () => {
  it('PASS 2 is idempotent — first sweep returns the PASS-2 row count, second returns 0', async () => {
    // The returned count is PASS-2-ONLY (network-PII minimization). Use a row that is
    // eligible for PASS 2 (>30d old, has ip/ua) but NOT PASS 1 (status='pending' on an
    // 'open' list needs >90d for PASS 1; 31d is too recent), so PASS 1 affects 0 and
    // PASS 2 is the only thing nulling ip/ua. This makes c1>=1 deterministic.
    const { siteId } = await seedSite(db, { siteSlug: 'wl-ret' })
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'ret-test', name: 'Ret', status: 'open' }).select('id, site_id').single()
    const aged = new Date(Date.now() - 31 * 86_400_000).toISOString() // 31d: > PASS-2 30d, < PASS-1 90d pending
    await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'aged@x.com', consent_launch_notification: true,
      consent_text_version: 'v1', status: 'pending', ip: '203.0.113.9', user_agent: 'old', created_at: aged,
    })
    const { data: c1 } = await db.rpc('waitlist_retention_sweep', { p_site_id: wl!.site_id })
    expect(c1).toBeGreaterThanOrEqual(1) // PASS 2 nulled the aged row's ip/ua
    const { data: after1 } = await db.from('waitlist_signups').select('ip, user_agent, anonymized_at').eq('email', 'aged@x.com').single()
    expect(after1!.ip).toBeNull(); expect(after1!.user_agent).toBeNull()
    expect(after1!.anonymized_at).toBeNull() // PASS 1 did NOT fire (too recent) — row not fully anonymized
    // Non-tautological idempotency: the SECOND run must affect exactly 0 rows.
    const { data: c2 } = await db.rpc('waitlist_retention_sweep', { p_site_id: wl!.site_id })
    expect(c2).toBe(0)
    await db.from('waitlists').delete().eq('id', wl!.id)
  })

  it('two anonymized rows on the same waitlist (distinct emails) do not violate the partial unique index', async () => {
    const { siteId } = await seedSite(db, { siteSlug: 'wl-ret2' })
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'ret-test2', name: 'Ret2', status: 'closed' }).select('id, site_id').single()
    // Two sweep-eligible rows (closed list, >7d old), DIFFERENT emails → distinct hashes.
    for (const e of ['one@x.com', 'two@x.com']) {
      await db.from('waitlist_signups').insert({
        waitlist_id: wl!.id, site_id: wl!.site_id, email: e, consent_launch_notification: true,
        consent_text_version: 'v1', created_at: '2020-01-01T00:00:00Z',
      })
    }
    const { error } = await db.rpc('waitlist_retention_sweep', { p_site_id: wl!.site_id })
    expect(error).toBeNull() // no 23505 — partial index excludes anonymized rows
    const { count } = await db.from('waitlist_signups')
      .select('*', { count: 'exact', head: true }).eq('waitlist_id', wl!.id).not('anonymized_at', 'is', null)
    expect(count).toBe(2)
    await db.from('waitlists').delete().eq('id', wl!.id)
  })

  it('lgpd_phase1_cleanup anonymizes waitlist rows via the waitlist_emails pre-capture key', async () => {
    const { siteId } = await seedSite(db, { siteSlug: 'wl-phase1' })
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'p1', name: 'P1', status: 'open' }).select('id, site_id').single()
    await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'erase@x.com', consent_launch_notification: true,
      consent_text_version: 'v1', ip: '203.0.113.7', user_agent: 'ua',
    })
    // Call with a synthetic user id + the new waitlist_emails key (service_role bypasses the guard).
    const { error } = await db.rpc('lgpd_phase1_cleanup', {
      p_user_id: '00000000-0000-0000-0000-000000000001',
      p_pre_capture: { waitlist_emails: ['erase@x.com'] },
    })
    expect(error).toBeNull()
    const { data: row } = await db.from('waitlist_signups').select('email, ip, anonymized_at')
      .eq('waitlist_id', wl!.id).not('anonymized_at', 'is', null).single()
    expect(row!.ip).toBeNull()
    expect(row!.email).toMatch(/^[a-f0-9]{64}$/) // hashed, raw email gone
    await db.from('waitlists').delete().eq('id', wl!.id)
  })
})
```

- [ ] **Step 3: Run fail-first then pass** — before applying: expect `Could not find the function public.waitlist_retention_sweep` (intended). Then `npm run db:reset && HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-retention`. Expected: PASS.

- [ ] **Step 4: Commit** `feat(waitlists): LGPD phase1 branch + per-site retention sweep RPC`.

---

### Task 6: Consent constant + `consent_texts` seed + CI invariant

**Files:**
- Create: `apps/web/src/app/api/waitlists/consent.ts`
- Create (via `npm run db:new waitlist_consent_seed`): `supabase/migrations/<ts>_waitlist_consent_seed.sql`
- Test: `apps/web/test/unit/waitlist-consent.test.ts`

- [ ] **Step 1: Write the constant**

```ts
// apps/web/src/app/api/waitlists/consent.ts  (server-only)
export const WAITLIST_CONSENT_VERSION = 'launch-notification-v1-2026-06'
```

- [ ] **Step 2: Seed `consent_texts` via a MIGRATION (C1 — NOT `seed.sql`)** — run `npm run db:new waitlist_consent_seed`, then put the idempotent insert below in that migration (mirrors the structural-seed precedent `20260507000003_seed.sql`, which IS applied to prod; `seed.sql` is dev-only and never reaches prod). Add `effective_at`/`superseded_at` columns to the INSERT if `20260507000003_seed.sql` includes them (grep to confirm — they exist in the `consent_texts` table at `20260507000001_schema.sql`, so include `effective_at = now(), superseded_at = null`). The Step 3b DB-gated test then guards PROD parity, not just local. (id convention `launch_notification:{locale}:{version}`):

```sql
insert into public.consent_texts (id, category, locale, version, text_md) values
 ('launch_notification:en:launch-notification-v1-2026-06','launch_notification','en','launch-notification-v1-2026-06',
  'Notify me by email when {name} launches. I can unsubscribe anytime.'),
 ('launch_notification:pt-BR:launch-notification-v1-2026-06','launch_notification','pt-BR','launch-notification-v1-2026-06',
  'Quero ser avisado(a) por email quando {name} for lançado. Posso cancelar quando quiser.')
on conflict (id) do nothing;
```

> **VERIFIED:** `consent_texts` columns are `id text NOT NULL` (PK — `consent_texts_pkey` at schema.sql:2130), `category`, `locale` (default `pt-BR`), `version`, `text_md`, `effective_at`, `superseded_at` (schema.sql:957). The seed columns match. Because `id` IS the primary key, `on conflict (id)` is a valid conflict target. (There is also a UNIQUE on `(category, locale, version)` at schema.sql:2124 — either target works; `id` is used here for the deterministic `launch_notification:{locale}:{version}` convention.) `consent_texts.category` has **NO** check constraint, so `category='launch_notification'` is allowed without a migration. **NOTE (do not conflate tables):** the separate `public.consents` LEDGER table DOES have `consents_category_check` (schema.sql:260) which excludes `launch_notification` — this is intentionally avoided because the design writes NO `consents` ledger rows (inline-consent + audit-snapshot model only). If a future phase needs a `consents` ledger row, that check must be extended via migration first.

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

- [ ] **Step 3b: Write the DB-gated consent-ledger resolution test** (links the runtime constant to the seeded rows so a version bump that forgets the seed fails CI). `db:reset` runs `seed.sql`, so after reset both rows exist. Add to `apps/web/test/integration/waitlist-consent-seed.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/db-seed'
import { WAITLIST_CONSENT_VERSION as V } from '@/app/api/waitlists/consent'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('consent_texts seed resolves for both locales', () => {
  it('has a row for en AND pt-BR at WAITLIST_CONSENT_VERSION', async () => {
    const { data } = await db.from('consent_texts').select('id').in('id', [
      `launch_notification:en:${V}`, `launch_notification:pt-BR:${V}`,
    ])
    expect((data ?? []).length).toBe(2) // both locales seeded for the current version
  })
})
```

- [ ] **Step 4: Run** `npm test -w apps/web -- waitlist-consent` (unit) and `npm run db:reset && HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-consent-seed` (DB-gated). Expected: PASS.

- [ ] **Step 5: Commit** `feat(waitlists): consent version constant + consent_texts seed + ledger resolution test`.

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
  // Prefer x-default-locale: it is the REQUEST-side locale header middleware always
  // sets (middleware.ts:388,428). x-locale is set on requests only via the merge path
  // (middleware.ts:429) and is primarily a RESPONSE header — it can be null on the
  // request inside this route. So x-default-locale is the primary branch, not a fallback.
  const locale = h.get('x-default-locale') ?? h.get('x-locale') ?? 'en'
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

> **VERIFIED (locale headers):** middleware sets `x-default-locale` on the REQUEST headers it forwards (apps/web/src/middleware.ts:388 in the site block, and :428 in the merge path) — this is the canonical request-side locale header (`getSiteContext` reads it at site-context.ts:31). `x-locale` is set on the *response* (middleware.ts:201/307/319) and only conditionally re-applied to the request in the merge path (:429), so inside this route handler `h.get('x-locale')` may be null. Therefore the chain `x-default-locale ?? x-locale ?? 'en'` deliberately puts `x-default-locale` FIRST (the value actually set). The select embeds translations via the FK relationship name `waitlist_translations` (derived from the FK); confirm the alias against the generated types and adjust if PostgREST disambiguates it.

> **Service-client import (consistency with Task 8):** use the alias `@/lib/supabase/service` here (it IS mapped at tsconfig:35 → `apps/web/lib/supabase`). Task 8 below uses the same alias for the service client. Only `@/lib/turnstile` and `@/lib/logger` are NOT mapped and MUST be deep-relative (six `../`). Rule: **service = alias OK; turnstile + logger = deep-relative required.**

- [ ] **Step 2: Write the failing test** — `apps/web/test/integration/waitlist-status-endpoint.test.ts`. Mock `next/headers` to inject `x-site-id`/`x-locale`. Use the verified client pattern (`createClient(SUPABASE_URL, SERVICE_KEY)` + `seedSite`). Seed two sites + a waitlist on each with the SAME slug; call `GET` with each `x-site-id` and assert each returns ITS OWN list (cross-site isolation, 404 when the slug is not on that site). Assert draft/launching/failed → 404. Run fail-first: expect the route module not to resolve (file not yet created) before Step 1, NOT an import-helper error.

- [ ] **Step 3: Run** `HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-status-endpoint` → PASS. **Commit** `feat(waitlists): public GET status endpoint (site-scoped)`.

---

### Task 8: `POST /api/waitlists/[slug]/signup`

**Files:**
- Create: `apps/web/src/app/api/waitlists/[slug]/signup/route.ts`
- Test: `apps/web/test/integration/waitlist-signup-endpoint.test.ts`

- [ ] **Step 1: Write the route** (Turnstile/rate-limit shape borrowed from the campaign submit route, but site-scoped like the CONTACT flow — see the site-scoping note below; spec §3 flow):

```ts
// apps/web/src/app/api/waitlists/[slug]/signup/route.ts
// Import depth VERIFIED against the sibling route campaigns/[slug]/submit/route.ts:3-5
// (six `../` up to apps/web/lib). `@/lib/turnstile` and `@/lib/logger` are NOT in
// tsconfig paths (`@/*`→src, and src/lib/logger lacks getLogger) — use deep-relative.
// From apps/web/src/app/api/waitlists/[slug]/signup/route.ts the depth to apps/web/lib is six `../`.
import { headers } from 'next/headers'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { verifyTurnstileToken } from '../../../../../../lib/turnstile'
import { getLogger } from '../../../../../../lib/logger'
import { redactMessage } from '../../../../../../lib/waitlists/scrub' // Task 0b — already landed
import { getSupabaseServiceClient } from '@/lib/supabase/service' // alias mapped at tsconfig:35 (Task 7 uses the same)
import { WAITLIST_CONSENT_VERSION } from '../../consent'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  // VERIFIED (turnstile.ts:27-31): verifyTurnstileToken returns FALSE when the secret
  // is unset — it does NOT dev-bypass. So in local `next dev` (NODE_ENV='development',
  // VERCEL_ENV unset → isDev=true) we skip the 503 BUT must ALSO skip the verify call,
  // otherwise every dev signup 400s on turnstile_failed. The verify below is guarded by
  // `!isDev || hasSecret`.
  const isDev = process.env.VERCEL_ENV !== 'production' && process.env.VERCEL_ENV !== 'preview' && process.env.NODE_ENV === 'development'
  const hasTurnstileSecret = Boolean(process.env.TURNSTILE_SECRET_KEY)
  if (!hasTurnstileSecret && !isDev) {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }

  let body: z.infer<typeof Body>
  try { body = Body.parse(await req.json()) } catch { return Response.json({ error: 'invalid_body' }, { status: 400 }) }

  const h = await headers()
  const siteId = h.get('x-site-id')
  // x-site-id is set by trusted middleware from a DB lookup, so it is always a real
  // uuid in practice; this shape guard is defense-in-depth (rejects a garbage header
  // before burning a DB round-trip) and keeps the RPC's p_site_id uuid coercion safe.
  if (!siteId || !UUID_RE.test(siteId)) return Response.json({ error: 'no_site' }, { status: 404 })
  // Trusted IP = the Vercel edge-set header ONLY. x-forwarded-for is client-spoofable
  // off-proxy (an attacker rotates fake values to defeat the per-IP rate-limit arm), so
  // it is used as a fallback in dev only. In prod the Vercel WAF edge rule (Operational
  // deliverables: 20/IP/60s) is the authoritative IP throttle; the per-IP DB arm is
  // best-effort and the per-email arm is the spoofing-resistant one.
  const ip = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    ?? (isDev ? (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null) : null)
  const ua = req.headers.get('user-agent') ?? null

  const supabase = getSupabaseServiceClient()
  // Rate-limit FIRST (cheap DB check) — fail CLOSED on RPC error — so abusive IPs
  // are rejected with 429 WITHOUT a Cloudflare siteverify round-trip. The WAF edge
  // rule is the primary attempt-flood throttle; this app-layer check is
  // signup-COUNT-based (it reads waitlist_signups), not attempt-based. siteId
  // (header string) is passed as p_site_id uuid; PostgREST coerces; invalid uuid →
  // RPC errors → fail closed (503).
  const rate = await supabase.rpc('waitlist_rate_check', { p_site_id: siteId, p_ip: ip, p_email: body.email })
  // Log ONLY error.code — never error.message/details (Postgres messages can echo back
  // the email/ip param, leaking PII into logs/Sentry despite the Task 21 scrub helper).
  if (rate.error) { getLogger().error('[waitlist_rate_check]', { code: rate.error.code }); return Response.json({ error: 'unavailable' }, { status: 503 }) }
  if (rate.data === false) return Response.json({ error: 'rate_limited' }, { status: 429 })

  // Then verify Turnstile — but only when a secret is configured. In local dev with no
  // secret (isDev=true, hasTurnstileSecret=false) we skip the verify so dev signups work;
  // verifyTurnstileToken would otherwise return false → 400 (turnstile.ts:27-31).
  if (hasTurnstileSecret) {
    const ok = await verifyTurnstileToken(body.turnstile_token, ip ?? undefined)
    if (!ok) return Response.json({ error: 'turnstile_failed' }, { status: 400 })
  }

  // M5: snapshot the EXACT displayed consent text into the (append-only) audit row —
  // consent_texts.text_md is editable in place by service_role, so the version pointer
  // alone is NOT tamper-evident (spec §2.1). Fetch the ledger text + the waitlist name and
  // interpolate {name} so the stored snapshot equals what the user actually saw.
  const [{ data: wlRow }, { data: ct }] = await Promise.all([
    supabase.from('waitlists').select('name').eq('site_id', siteId).eq('slug', slug).maybeSingle(),
    supabase.from('consent_texts').select('text_md')
      .eq('category', 'launch_notification').eq('locale', body.locale)
      .eq('version', WAITLIST_CONSENT_VERSION).maybeSingle(),
  ])
  if (!wlRow) return Response.json({ error: 'not_found' }, { status: 404 })
  if (!ct) return Response.json({ error: 'unavailable' }, { status: 503 }) // consent text not seeded
  const snapshot = ct.text_md.replaceAll('{name}', wlRow.name)
  const res = await supabase.rpc('waitlist_signup', {
    p_site_id: siteId, // trusted x-site-id — site is an explicit RPC param (no GUC)
    p_slug: slug, p_email: body.email, p_locale: body.locale,
    p_consent_version: WAITLIST_CONSENT_VERSION, p_consent_text_snapshot: snapshot,
    p_source_surface: 'landing', p_ip: ip, p_user_agent: ua,
  })
  if (res.error) {
    // Primary PII surface: log ONLY error.code; route any free-text through redactMessage
    // (Task 0b) before Sentry; tag component so incident response works from Task 8 onward
    // (do NOT wait for the Task 21 wiring on this one endpoint).
    getLogger().error('[waitlist_signup]', { code: res.error.code })
    Sentry.captureException(new Error(`waitlist_signup ${res.error.code}: ${redactMessage(res.error.message ?? '')}`), { tags: { component: 'waitlist' } })
    return Response.json({ error: 'insert_failed' }, { status: 500 })
  }
  const out = res.data as { error?: string; status?: string; duplicate?: boolean }
  if (out.error === 'not_found') return Response.json({ error: 'not_found' }, { status: 404 })
  if (out.error === 'waitlist_not_open') return Response.json({ error: 'waitlist_not_open', status: out.status }, { status: 409 })
  return Response.json({ success: true, duplicate: out.duplicate === true })
}
```

> **Import paths (VERIFIED):** `verifyTurnstileToken` and `getLogger` are NOT in tsconfig paths (`@/*`→`src`, and `src/lib/logger.ts` exports only `newRunId`/`withCronLock`, NOT `getLogger`) — import them via six `../` into `apps/web/lib` (same depth as the sibling `campaigns/[slug]/submit/route.ts:3-5`). `getSupabaseServiceClient` uses the alias `@/lib/supabase/service` (mapped at tsconfig:35 → `apps/web/lib/supabase`), matching Task 7. **Rule: service = alias; turnstile + logger = deep-relative.**
>
> **Site scoping (do NOT copy the campaign route):** the campaign submit route (`campaigns/[slug]/submit/route.ts:50-53`) resolves the campaign by SLUG ALONE, reads no `x-site-id`, and passes no site_id — that is single-site legacy and is intentionally NOT the precedent. Waitlists DELIBERATELY pass the middleware-trusted `x-site-id` as the explicit `p_site_id` RPC param AND always combine `.eq('site_id', siteId)` with `.eq('slug', slug)`. The cross-tenant guard depends entirely on this — do not reintroduce slug-only resolution. The matching precedent is the CONTACT flow (`app/(public)/contact/actions.ts:74-75`, which passes `p_site_id: ctx.siteId`), not the campaign flow.
>
> **YAGNI:** `p_source_surface` is `'landing'`; embed/TipTap surfaces (Fase 3) add a `source_surface` body field — leave a TODO comment, do NOT add it now.

- [ ] **Step 2: Write the failing endpoint test** (DB-gated) — `apps/web/test/integration/waitlist-signup-endpoint.test.ts`. Mock `next/headers` to inject `x-site-id`, and mock the turnstile module. **`vi.mock` SPECIFIER (gotcha):** vitest resolves a `vi.mock` path RELATIVE TO THE TEST FILE, but the route imports turnstile via `'../../../../../../lib/turnstile'` (relative to the ROUTE). Those two relative strings do NOT point at the same module. Vitest dedupes by the RESOLVED absolute module, so the mock only takes effect if both resolve to `apps/web/lib/turnstile.ts`. The route here uses a deep-relative import, so mock it by an absolute-from-root path that vitest will resolve to the same file — use `vi.mock(new URL('../../lib/turnstile', import.meta.url).pathname, ...)` from the test file (which sits at `apps/web/test/integration/`, i.e. two `../` to `apps/web/lib`), OR import `verifyTurnstileToken` into the test via the SAME `'../../lib/turnstile'` specifier and assert vitest resolves it to the route's module. Simplest robust option: `vi.mock('../../lib/turnstile', () => ({ verifyTurnstileToken: vi.fn().mockResolvedValue(true) }))` (two `../` from `apps/web/test/integration/` → `apps/web/lib`). Confirm the mock fires by asserting `verifyTurnstileToken` was called. **Env interplay (important):** vitest runs with `NODE_ENV='test'`, so `isDev` is false → the 503-no-secret branch fires by default. Therefore:
>   - success/duplicate/closed cases: `vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')`.
>   - 503 case: `vi.stubEnv('TURNSTILE_SECRET_KEY', '')` (and leave `NODE_ENV='test'`); assert 503.
>
> Assertions: success → 200 `{success:true,duplicate:false}`; second identical call → `{duplicate:true}`; closed list → 409; missing secret in non-dev → 503; over-rate → 429. Run fail-first (route not yet created) → module-not-found for the route, NOT for a test helper.

- [ ] **Step 3: Run** `HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-signup-endpoint` → PASS. **Commit** `feat(waitlists): public POST signup endpoint (Turnstile, fail-closed rate-limit)`.

---

### Task 9: `GET /api/waitlists/dsar/[token]` (per-email export)

**Files:**
- Create: `apps/web/src/app/api/waitlists/dsar/[token]/route.ts`
- Test: `apps/web/test/integration/waitlist-dsar.test.ts`

- [ ] **Step 1: Write the route** (reuses the unsubscribe-token hash lookup; no-oracle response):

```ts
// apps/web/src/app/api/waitlists/dsar/[token]/route.ts
// FASE 1: inert no-oracle stub. NO imports of crypto / the service client yet —
// the Fase-1 body never uses them, so importing now leaves dead imports (and the
// previous "keep crypto warm" `void _phase2_token_hash` hack). Cleaner to add them
// back in Fase 2 with the live wiring. (Note: `tsc --noEmit` does NOT set
// `noUnusedLocals`, so an unused import would not hard-fail typecheck — this is a
// cleanliness choice, not a gate workaround.)

interface Ctx { params: Promise<{ token: string }> }
const NEUTRAL = () => Response.json({ data: [] }, { status: 200 }) // no oracle

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { token } = await ctx.params
  if (!token || token.length < 16) return NEUTRAL()
  // FASE 2: source-namespaced waitlist tokens (unsubscribe_tokens.source) do NOT
  // exist yet — that column lands in the Fase-2 token migration, and no waitlist
  // tokens are issued in Fase 1 (no broadcast). Resolving a token here could only
  // match a NEWSLETTER token, which is out of scope, so we short-circuit. This is
  // an intentional inert no-oracle response, not an accidental error path.
  return NEUTRAL()
}

// ── Fase 2 wiring (paste into GET above when the source column + token issuance ship). ──
// Fase 2: add `export const dynamic = 'force-dynamic'` — once this route reads a
// per-request token and returns per-email data it must NEVER be cached (a stale cache
// would become a token/data oracle).
// Re-add the imports at the top of the file at that time:
//   import crypto from 'node:crypto'
//   import { getSupabaseServiceClient } from '../../../../../../lib/supabase/service'
// then:
//   const hash = crypto.createHash('sha256').update(token).digest('hex')
//   const supabase = getSupabaseServiceClient()
//   const { data: tok, error: tokErr } = await supabase
//     .from('unsubscribe_tokens')
//     .select('site_id, email, source')          // 'source' added in Fase 2
//     .eq('token_hash', hash).eq('source', 'waitlist').maybeSingle()
//   if (tokErr || !tok) return NEUTRAL()
//   const { data } = await supabase
//     .from('waitlist_signups')
//     .select('email, consent_launch_notification, consent_text_version, status, source_surface, created_at')
//     .eq('site_id', tok.site_id).eq('email', tok.email).is('anonymized_at', null)
//   return new Response(JSON.stringify({ data: data ?? [] }, null, 2), {
//     status: 200,
//     headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="waitlist-data.json"' },
//   })
```

> **Dependency (VERIFIED):** `unsubscribe_tokens` columns are `site_id, email, created_at, used_at, token_hash` only (schema.sql:1785-1792) — there is **NO `source` column** until Fase 2. A `.select('…, source')` / `.eq('source','waitlist')` against the real schema is a PostgREST **error**, NOT an empty match — so the original "matches nothing" reasoning was wrong. **Decision (Fase 1): short-circuit to `NEUTRAL()` immediately** with a `// FASE 2` comment; do not query a non-existent column. The full token lookup is committed as dead commented code (BELOW the function, not inside it) and enabled in Fase 2 alongside the migration. **Do NOT import `crypto` or `getSupabaseServiceClient` in Fase 1** — the Fase-1 body never uses them, so they would be dead imports; re-add them (six-`../` deep-relative, like the sibling routes) only when the Fase-2 body is pasted in. (`tsc --noEmit` here does not set `noUnusedLocals`, so this is cleanliness, not a hard gate — but avoid the unused import regardless.)

- [ ] **Step 2: Test** — unknown/short/any token → `{data:[]}` 200; **explicitly assert status is 200 (never 404/500)** so the no-oracle + no-error guarantee is locked, not incidental. (Populated-token case is a Fase-2 test.)

- [ ] **Step 3: Commit** `feat(waitlists): token-gated DSAR export endpoint (inert until Fase 2)`.

---

### Task 10: Retention sweep cron route (`GET`+`POST`)

**Files:**
- Create: `apps/web/src/app/api/cron/waitlist-retention-sweep/route.ts`
- Modify: `apps/web/vercel.json` (cron entry — operational; NO root `vercel.json` exists)
- Test: `apps/web/test/integration/waitlist-sweep-route.test.ts`

- [ ] **Step 1: Write the route** (GET=POST alias, CRON_SECRET-gated, per-site iteration, `WAITLIST_RETENTION_SWEEP_ENABLED` flag):

```ts
// apps/web/src/app/api/cron/waitlist-retention-sweep/route.ts
// Import depths VERIFIED against sibling crons (e.g. anonymize-newsletter-tracking:4,
// lgpd-cleanup-sweep). From this route to apps/web/lib is five `../`
// (api/cron/<x>/route.ts → apps/web/lib).
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { logCron, newRunId, withCronLock } from '../../../../../lib/logger'

const JOB = 'waitlist-retention-sweep'
const LOCK_KEY = 'cron:waitlist-retention-sweep'

async function handle(req: Request): Promise<Response> {
  // Auth guard mirrors lgpd-cleanup-sweep/route.ts (verified: `const auth = headers...; const
  // secret = process.env.CRON_SECRET; if (!secret || auth !== ...) 401`) — INCLUDES the
  // !secret null-check so an unset CRON_SECRET cannot be matched by `Bearer undefined`.
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (process.env.WAITLIST_RETENTION_SWEEP_ENABLED !== 'true') {
    // Observe the disabled run too via the CronLogEvent 'skipped' status (logger.ts:43 —
    // CronLogEvent.status includes 'skipped'). NOTE: this is a deliberate enhancement over
    // lgpd-cleanup-sweep, which returns a bare 204 with NO logCron on its disabled branch —
    // we emit the skipped event so the activation checklist (Operational deliverables) can
    // VERIFY in prod logs that the path is registered + inert before flipping the flag.
    logCron({ job: JOB, status: 'skipped' })
    return Response.json({ skipped: 'disabled' }, { status: 200 })
  }

  const supabase = getSupabaseServiceClient()
  // withCronLock (logger.ts:103) acquires an advisory lock, emits a logCron event for
  // EVERY outcome (ok/error/locked) — THIS is the project's last-run observability
  // mechanism — and prevents overlapping Vercel+pg_cron double-runs. Returns a Response.
  return withCronLock(supabase, LOCK_KEY, newRunId(), JOB, async () => {
    const { data: sites, error } = await supabase.from('sites').select('id')
    if (error) throw error // withCronLock logs status:'error'
    let swept = 0
    for (const s of sites ?? []) {
      const r = await supabase.rpc('waitlist_retention_sweep', { p_site_id: s.id })
      if (r.error) logCron({ job: JOB, status: 'error', site_id: s.id, err_code: r.error.code })
      else swept++
    }
    // Persist last-run observability for the irreversible-deletion sweep: a Sentry
    // breadcrumb (operators can see it actually ran) in addition to the logCron line.
    Sentry.addBreadcrumb({ category: 'cron', message: JOB, level: 'info', data: { sites: swept } })
    // STUCK-LAUNCHING WATCHDOG — deferred to Fase 2 (see reconciliation note below).
    return { status: 'ok' as const, sites: swept }
  })
}
export const GET = handle
export const POST = handle
```

> **VERIFIED:** the `Logger` interface (`apps/web/lib/logger.ts:7-10`) exposes ONLY `warn`/`error` — there is **NO `.info()`** (`getLogger().info(...)` is a strict-TS typecheck failure). The cron-event API is `logCron(event: CronLogEvent)` (logger.ts:53; shape `{ job, status: 'ok'|'error'|'locked'|'skipped', err_code?, site_id?, … }` with a `[key:string]:unknown` index signature so an extra `sites` key typechecks). `withCronLock(supabase, lockKey, runId, job, fn)` (logger.ts:103) is the canonical wrapper used by `anonymize-newsletter-tracking/route.ts:24` — it logs every outcome (the last-run observability) and serializes against overlapping invocations. `newRunId` is also exported from `apps/web/lib/logger`. The split-brain GET=POST alias is mandated by the project's cron architecture (Vercel cron = GET; pg_cron = POST).

> **Stuck-launching watchdog — §8 reconciliation (mirrors the Task 3 `consent_withdrawn` pattern):** spec §8 lists a "stuck-launching watchdog" as a Fase-1 sweep deliverable, but the watchdog acts only on waitlists with an associated `newsletter_editions` row, and editions are a Fase-2 migration (**Fase-1 invariant: no `newsletter_editions` waitlist row can exist** — there is no broadcast/launch in Fase 1, and `(open|closed)→launching` is intentionally absent from Task 16's transition graph). The watchdog UPDATE is therefore a STRUCTURAL no-op in Fase 1 and ships with the lifecycle trigger in Fase 2 (Out of scope). The nav-badge stuck-launching count (Task 20) is likewise dormant-but-harmless until then. This converts the §8 divergence into a flagged, defensible deferral — it is NOT a silent drop.

- [ ] **Step 2: Write the failing test** — `apps/web/test/integration/waitlist-sweep-route.test.ts` (explicit fail-first: run BEFORE the route file exists → expect module-not-found for the ROUTE, NOT a helper import error). Cases: (a) no/empty `CRON_SECRET` header → 401; (b) `vi.stubEnv('CRON_SECRET','s')` + correct Bearer but flag off → 200 `{skipped:'disabled'}` AND assert a `logCron({status:'skipped'})` fires (spy/mock `logCron` or assert the JSON line); (c) flag on + correct Bearer → 200 `{ok:true,...}` (DB-gated; seed a site) AND assert `Sentry.addBreadcrumb` was called with `category:'cron'` and `data.sites` set (mock `@sentry/nextjs`'s `addBreadcrumb`); (d) the `!secret` guard: with `CRON_SECRET` unset and header `Bearer undefined`, expect 401. Run → PASS after Step 1.

- [ ] **Step 3: Pre-check the Vercel cron quota, THEN add the cron entry to `apps/web/vercel.json`** (VERIFIED: there is NO root `vercel.json`; the crons array — 38 existing entries — is at `apps/web/vercel.json`). Adding this makes 39 total.
  - **Cron-quota pre-check (do FIRST):** confirm the Vercel project plan permits ≥39 cron jobs (check the dashboard Crons tab / `vercel project ls`). Vercel cron counts are plan-tier-gated; if the tier caps crons, a silently-dropped entry means the irreversible-deletion sweep NEVER fires in prod — an undetected LGPD retention gap that still passes CI/build. **If the tier caps crons, do NOT add a 39th entry — instead fold `waitlist_retention_sweep` into the existing `lgpd-cleanup-sweep` cron's site loop** (call the RPC there), and skip the vercel.json append. Document the chosen path in the DPO note.
  - If quota allows, append to the EXISTING `crons` array (do not overwrite):

```json
{ "path": "/api/cron/waitlist-retention-sweep", "schedule": "15 4 * * *" }
```
Use `15 4` (not `0 4`) to avoid colliding with the existing `0 4` crons (anonymize-newsletter-tracking, ab-draft-cleanup). Leave `WAITLIST_RETENTION_SWEEP_ENABLED` unset/false until DPO sign-off (see the ordered activation checklist in Operational deliverables).

- [ ] **Step 4: Commit** `feat(waitlists): retention-sweep cron route + vercel.json entry`.

---

## FASE 1C — LGPD adapter wiring

### Task 11: `collectUserData` + pre-capture for waitlist memberships

**Files:**
- Modify: `apps/web/src/lib/lgpd/domain-adapter.ts`
- Test: `apps/web/test/unit/lgpd-domain-adapter.test.ts` (extend existing)

> **VERIFIED method shapes (domain-adapter.ts):** `collectUserData(userId: string)` takes a UUID (line 212) and derives the user's email INTERNALLY via `getUserById(userId)` (it does NOT take an email). `phase1Cleanup(userId: string)` (line 45) is the SEPARATE method that calls `rpc('lgpd_phase1_cleanup', { p_pre_capture })` — it builds `emails` from auth + `newsletter_subscriptions` + `contact_submissions` (lines 97-101) and sets `preCapture = { newsletter_emails: emails }` (line 103). `collectUserData` does NOT call the cleanup RPC. So the export query goes in `collectUserData`; the pre-capture change goes in `phase1Cleanup`.

- [ ] **Step 1: Read the current adapter** — confirm the two method signatures above and the `newsletter_sends` export projection (line 298: `id, edition_id, subscriber_email, status, delivered_at, opened_at, clicked_at, created_at` — note it EXCLUDES `open_ip`/`open_user_agent`; the waitlist projection's exclusion of `ip`/`user_agent` is parity with this).

- [ ] **Step 2: Write the failing test** (extend `apps/web/test/unit/lgpd-domain-adapter.test.ts`) — two assertions:
>   - `collectUserData(userId)` returns a `waitlists` section with the narrowed projection `email, consent_launch_notification, consent_text_version, status, source_surface, created_at` and EXCLUDES `ip`/`user_agent`. (Seed a signup keyed off the user's email; assert it appears WITHOUT network PII.)
>   - `phase1Cleanup(userId)` anonymizes the user's `waitlist_signups` rows. (Seed a signup for the user's email + a matching auth user; run `phase1Cleanup`; assert the row's `anonymized_at` is set and `email` is the sha256 hash.) **Seed the auth user via the exported `insertAuthUser(email, userId)` helper (`db-seed.ts:26`, signature `(email: string, id?: string)`) so `collectUserData`/`phase1Cleanup`'s internal `getUserById(userId)` resolves the email — do NOT pass an unseeded synthetic uuid (the adapter derives the email internally and would find nothing).**

- [ ] **Step 3: Implement** —
>   - In `collectUserData`: after the user's email(s) are resolved (same way the existing `newsletter_subscriptions`/`newsletter_sends` branches resolve them — by `userEmail`), add a `waitlist_signups` query with the narrowed projection `.eq('email', userEmail)` and add a `waitlists` key to the returned bundle. Mirror the existing `newsletter_sends` branch exactly (which deliberately omits network PII).
>   - In `phase1Cleanup`: after `emails` is built (line ~97-101), set `preCapture.waitlist_emails = emails` — **reuse the SAME auth-derived `emails` array; do NOT query `waitlist_signups.select('email').in('email', emails)`.** That query is logically impossible: `.in('email', emails)` can only return rows whose email is ALREADY in `emails`, so it can never discover a NEW waitlist-only email. `waitlist_signups` has **no `user_id` column** (Task 1) — the only email tying a signup to the authenticated user IS the auth/newsletter/contact email, which `emails` already contains. The Task 5 SQL branch reads exactly `p_pre_capture->'waitlist_emails'` and anonymizes the matching signups.
>   - **Honest erasure-coverage rationale (do NOT claim it closes the gap for anonymous emails):** `phase1Cleanup` anonymizes only waitlist signups whose email equals the deleting user's auth/newsletter/contact email. A truly anonymous waitlist-only email (one never used for newsletter/contact) is NOT linkable to a `user_id` and is therefore NOT erased by phase1 — it is covered solely by the retention sweep (`ORPHAN_PENDING_DAYS`) + the per-email DSAR/unsubscribe self-service path (spec §2.3 states this; Task 11 must not contradict it).

- [ ] **Step 4: Run + Commit** `feat(waitlists): LGPD export + pre-capture for waitlist memberships`.

---

## FASE 1D — Public surface

### Task 12: `<WaitlistSignupForm>` shared client component + `FORM_STRINGS`

**Files:**
- Create: `apps/web/src/components/waitlists/form-strings.ts`
- Create: `apps/web/src/components/waitlists/waitlist-signup-form.tsx`
- Test: `apps/web/test/components/waitlist-signup-form.test.tsx`

**Port source:** `design_handoff_waitlists/design_files/waitlist-public.jsx` (`WaitlistForm`) — recreate as a production React 19 client component using the live Pinboard kit. Do NOT copy the Babel/localStorage prototype scaffolding.

- [x] **Step 1: Write `FORM_STRINGS`** (pt-BR + en) covering every state in spec §7 (idle/submitting/success/duplicate/closed/launched/error/rateLimited/raceClosed/unavailable). The `409-race` state (spec §7 line 516) is DISTINCT from `closed`: `closed`/`launched` come from the mount-GET (the form never opened), while `raceClosed` is the live POST returning 409 `waitlist_not_open` (the list closed mid-flight, after the user submitted). Use the copy table from the spec and the handoff. Shape:

```ts
// apps/web/src/components/waitlists/form-strings.ts
export type WaitlistLocale = 'pt-BR' | 'en'
export interface WaitlistStrings {
  // M12: consentLabel is a FUNCTION taking the waitlist name so the rendered text matches
  // the consent_texts ledger string verbatim after {name} substitution (LGPD proof-of-consent).
  // Render the name as a bolded <strong> span between the two halves (waitlist-public.jsx:257).
  emailPlaceholder: string; consentLabel: (name: string) => string; button: string; buttonLoading: string
  successHeadline: string; successBody: string; duplicateHeadline: string; duplicateBody: string
  closed: string; launched: string; raceClosed: string; error: string; rateLimited: string; unavailable: string
  reassurance: string
}
export const FORM_STRINGS: Record<WaitlistLocale, WaitlistStrings> = {
  'pt-BR': {
    emailPlaceholder: 'seu@email.com',
    consentLabel: (name: string) => `Quero ser avisado(a) por email quando ${name} for lançado. Posso cancelar quando quiser.`,
    button: 'Quero ser avisado', buttonLoading: 'Enviando…',
    successHeadline: 'Pronto!', successBody: 'Te avisamos quando lançar.',
    duplicateHeadline: 'Você já está na lista', duplicateBody: 'Avisaremos quando lançar.',
    closed: 'As inscrições estão encerradas.', launched: 'Já lançou!',
    raceClosed: 'Esta lista acabou de fechar.',
    error: 'Algo deu errado. Tente novamente.', rateLimited: 'Muitas tentativas. Aguarde um instante.',
    unavailable: 'Temporariamente indisponível, tente em instantes.',
    reassurance: 'Enviaremos um único email — cancele quando quiser.',
  },
  en: {
    emailPlaceholder: 'you@email.com',
    button: 'Notify me', buttonLoading: 'Sending…',
    successHeadline: 'Done!', successBody: "We'll email you when it launches.",
    duplicateHeadline: "You're already on the list", duplicateBody: "We'll email you when it launches.",
    consentLabel: (name: string) => `Notify me by email when ${name} launches. I can unsubscribe anytime.`,
    closed: 'Signups are closed.', launched: 'It launched!',
    raceClosed: 'This waitlist just closed.',
    error: 'Something went wrong. Please try again.', rateLimited: 'Too many attempts. Please wait a moment.',
    unavailable: 'Temporarily unavailable, please try again shortly.',
    reassurance: "We'll send one email only — unsubscribe anytime.",
  },
}
```

- [x] **Step 2: Write a failing component test** (Vitest + Testing Library) — renders the form in `idle`, asserts the email input + consent checkbox + disabled submit until both consent checked and (in non-dev) a turnstile token present; on a mocked successful POST it renders the success block in place (no email field) with `role="status"`.

- [x] **Step 3: Implement the component** — a `'use client'` component with props `{ slug: string; locale: WaitlistLocale; variant?: 'landing' | 'embed' | 'inline'; initialStatus?: 'open'|'closed'|'launched' }`. State machine per spec §7. POSTs to `/api/waitlists/${slug}/signup`. **Response→state mapping (spec §7):** 200 `{success:true,duplicate:false}` → `success`; 200 `{duplicate:true}` → `duplicate`; **409 `waitlist_not_open` → `raceClosed`** (render `strings.raceClosed`, DISTINCT from the mount-GET `closed`/`launched` blocks); 429 → `rateLimited`; 503 → `unavailable`; other non-2xx → `error`. **Both the `success` AND `duplicate` result blocks append the `reassurance` line (spec §7 line 510) — render `{strings.reassurance}` under both `successBody` and `duplicateBody`.** Accessibility per §7 (focus to result `role=status` after submit; error `role=alert`; email input attributes; Turnstile disabled-until-token; reduced motion). Recreate the Pinboard visual treatment via the live kit (`makePinboardKit`/`Paper`/`Tape`) used elsewhere in the public site — grep `apps/web/src` for the real import path of the Pinboard components (the prototype's `shared.jsx` maps to the real site kit).

- [x] **Step 4: Run + Commit** `feat(waitlists): shared WaitlistSignupForm + FORM_STRINGS`.

---

### Task 13: Hosted landing page `/waitlists/[slug]`

**Files:**
- Create: `apps/web/src/app/(public)/waitlists/[slug]/page.tsx`
- Test: `apps/web/test/integration/waitlist-landing.test.tsx` (or an e2e smoke if the project has one)

**Port source:** `design_handoff_waitlists/design_files/waitlist-surfaces.jsx` (hosted landing composition).

- [x] **Step 1: Implement the server component** — add `export const dynamic = 'force-dynamic'` (the page reads request headers; static prerender is impossible for slugs unknown at build time and would break multi-site routing). **Site resolution — use the SAME mechanism as Task 7 (`x-site-id` from `headers()`), NOT `resolveSiteByHost`.** The `resolveSiteByHost` host-lookup pattern (`apps/web/lib/seo/host.ts:20`, used by `app/sitemap.ts`/`app/robots.ts`) exists ONLY because `x-site-id` is STRIPPED from `MetadataRoute` invocations (Next.js #58436) — that stripping does NOT apply to an ordinary `(public)` server component, which DOES receive the middleware-set `x-site-id`. Using two different resolution strategies for the same feature is a latent host-normalization drift risk; read `x-site-id` (and `x-default-locale`) via `headers()` exactly like the Task 7 route and the contact-flow precedent. Resolve `(slug, site_id, locale)` with `.eq('site_id', siteId).eq('slug', slug)`; if status ∉ public set → `notFound()`. Render the two-column landing (pitch + sticky form card) with `<WaitlistSignupForm slug locale variant="landing" initialStatus={status} />`. Respect status server-side (closed/launched render the message block; open renders the form). Pull headline/description from the resolved translation, falling back to `FORM_STRINGS` + the waitlist `name`/`description`. (No `loading.tsx` needed for the public route.)

- [x] **Step 2: Write the failing test** — `apps/web/test/integration/waitlist-landing.test.tsx`. Mock `next/headers` to inject `x-site-id`/`x-default-locale` (same as Task 7). Render the server component for: status=`open` (assert the email input is present); status=`closed` (assert the closed-message block AND NO email input); a non-existent slug (assert `notFound()` is thrown — wrap in `expect(...).rejects` or assert the `next/navigation` `notFound` mock was called). Run fail-first BEFORE Step 1 (route module not found), then PASS after.

- [x] **Step 3: Commit** `feat(waitlists): hosted landing page /waitlists/[slug]`.

---

## FASE 1E — CMS module

> All CMS server actions follow the verified guard chain. **`requireEditAccess` is NOT a shared exported helper** — it is a LOCAL function defined per feature's `actions.ts`, and the shape differs between features (`contacts/actions.ts:22-31` returns `{ siteId, timezone }` (object); `settings/actions.ts` returns a plain string). **Define your own local `requireEditAccess()` in `waitlists/actions.ts` mirroring `contacts/actions.ts:22-31`** — it calls `getSiteContext()` (from `@/lib/cms/site-context`, which maps to `apps/web/lib/cms`) + `requireSiteScope({ area:'cms', siteId, mode:'edit' })` (from `@tn-figueiredo/auth-nextjs/server`) and returns `{ siteId }` so `const { siteId } = await requireEditAccess()` holds. Then `getSupabaseServiceClient()`, every query `.eq('site_id', siteId)`, `captureServerActionError` (from `@/lib/sentry-wrap`) on failure + `revalidatePath`/`revalidateTag('layout-counts')`. **The same-shape precedents to mirror are `contacts/actions.ts:22-31` and `campaigns/bulk-actions.ts:13-24` (local-`requireEditAccess`+`requireSiteScope`). Do NOT mirror `campaigns/[id]/edit/actions.ts` for this — it uses `requireSiteAdminForRow` (a row-level guard from `@/lib/cms/auth-guards`), NOT a local `requireEditAccess`.** (`requireSiteAdminForRow` is NOT usable for waitlists anyway — its `AuthorizableTable` union is `'blog_posts'|'campaigns'|'newsletter_editions'`, not `'waitlists'`.)

### Task 14: CMS list page + KPIs + `WlBadge`

**Files:**
- Create: `apps/web/src/app/cms/(authed)/waitlists/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/waitlists-table.tsx`
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/wl-badge.tsx`
- Create: `apps/web/src/app/cms/(authed)/waitlists/waitlists.css` (six badge styles; reuse existing tokens — no new colors)
- Test: `apps/web/test/components/wl-badge.test.tsx`

**Port source:** `design_files/views-waitlists-main.jsx` (list + KPI strip) and `views-waitlists.jsx` (`WlBadge`). `waitlists.css` maps to existing CMS tokens per the handoff (draft→muted, open→`--ok`, closed→`--warn`, launching→`--c-pipeline` pulsing, launched→`--c-newsletter`, failed→`--danger`).

- [x] **Step 1: Write the failing `WlBadge` test** — `apps/web/test/components/wl-badge.test.tsx` asserting the correct label + token class for ALL SIX statuses (draft/open/closed/launching/launched/failed), and that `launching` renders the pulsing dot. **RUN: `npm test -w apps/web -- wl-badge` → must FAIL with `Cannot find module '.../wl-badge'` (NOT a helper import error).**
- [x] **Step 2: Implement `wl-badge.tsx`** — the six-status badge with token classes (draft→muted, open→`--ok`, closed→`--warn`, launching→`--c-pipeline` pulsing dot, launched→`--c-newsletter`, failed→`--danger`). **RUN: `npm test -w apps/web -- wl-badge` → must PASS.** Commit `feat(waitlists): WlBadge status badge`.
- [x] **Step 2a: Write the failing list-query test (DB-gated)** — `apps/web/test/integration/waitlist-list-page.test.ts`. Extract the list query into a testable function (e.g. `listWaitlistsForSite(siteId)` in `waitlists/actions.ts` or the page module) so it is callable directly. Seed site A with an `open` waitlist (2 signups, 1 of them `suppressed`) + a `closed` waitlist on a SECOND site B. Call the query scoped to site A and assert: it returns ONLY site A rows (cross-site scoping via `.eq('site_id', siteId)`), the open-waitlist KPI = 1, total-signups KPI = 2, and the suppressed sub-count = 1. **RUN before Step 3 → must FAIL (the list query/function does not exist), NOT a helper import error.**
- [x] **Step 3: List page** — `force-dynamic` + `loading.tsx` skeleton; server component reads via `getSiteContext()` + service client `.eq('site_id', siteId)`; KPI strip (Waitlists + open count, Total signups, Linked campaigns, Needs attention = failed + stuck-launching); table columns (Name + `/waitlists/{slug}`, Status `WlBadge`, Signups count with `−N` suppressed sub, Linked campaign, Updated relative); empty state (`EmptyState` icon `gift`) + "New waitlist" CTA. Signup counts via a single grouped count query. **RUN: same test → must PASS.**
- [x] **Step 4: Run + Commit** (test + page together) `feat(waitlists): CMS list page + KPIs`.

### Task 15: Create/edit drawer + create/update actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/edit-drawer.tsx`
- Modify: `apps/web/src/app/cms/(authed)/waitlists/actions.ts`
- Test: `apps/web/test/integration/waitlist-cms-actions.test.ts`

**Port source:** `views-waitlists.jsx` (`EditDrawer`, portalled to `document.body`; intro is an UNCONTROLLED `contentEditable` read on save — keep this to avoid the React `removeChild` crash documented in the handoff).

> **Verified precedents (handoff note, 2026-06-17 — research done, no code written yet):**
> - **Action skeleton:** mirror `apps/web/src/app/cms/(authed)/campaigns/new/actions.ts` — `'use server'`, read site via `getSiteContext()` (`@/lib/cms/site-context`), guard with `requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })` (`@tn-figueiredo/auth-nextjs/server`), then service-client insert; result union `{ ok:true, ... } | { ok:false, error, message? }`; `catch` wraps the INSERT.
> - **`waitlists` columns (live DB):** `id, site_id, slug, name, description, status(default), campaign_id, sender_name, sender_email, reply_to, intro_mdx, launched_at, created_at, updated_at`.
> - **`waitlist_translations` columns:** `waitlist_id, locale, headline, subheadline, consent_label(NOT NULL default), button_label, button_loading_label, success_headline, success_body, duplicate_headline, duplicate_body, closed_message, launched_message` — Step 1(c) persists this row.
> - **Sender-email validation:** `ringContext()` (`@/lib/cms/repositories`) → `.getSite(siteId): Promise<Site | null>`; `Site.domains: string[]`. Extract the domain from `sender_email`, reject (field error) if not ∈ `site.domains`.
> - **slugify:** `@/lib/blog/slugify` (`slugify(text)`); slug auto-slugify is client-side per Step 2, server normalizes/trusts.
> - **DB-gated action test mocks:** copy the hoisted-mock pattern from `apps/web/test/integration/ab-brainstorm.test.ts` — `vi.mock('@/lib/cms/site-context')` with a mutable `_mockSiteId`; `vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: {...} })) }))`; also stub `@vercel/blob` + `@sentry/nextjs` if transitively imported. Seed with `seedSite(db, { domains: ['x.test'] })` to exercise sender validation; local DB confirmed up.

- [x] **Step 1: Write the failing actions test (DB-gated)** — `apps/web/test/integration/waitlist-cms-actions.test.ts`. Cases: (a) **concurrent create of the same slug → exactly one success + one `slug_taken`** (real race via two parallel calls); (b) sender-email on a non-owned domain → field error; (c) create persists the translations row. Concurrency test code (PostgREST pools a single connection, so fire two TRULY parallel calls and rely on the DB unique constraint surfacing as `23505` in exactly one):

```ts
const fd = (slug: string) => { const f = new FormData(); f.set('slug', slug); f.set('name', 'Race'); return f }
const slug = 'race-' + Math.floor(Date.now() % 100000)
const [a, b] = await Promise.allSettled([createWaitlist(fd(slug)), createWaitlist(fd(slug))])
const val = (r: PromiseSettledResult<{ ok: boolean; error?: string }>) => r.status === 'fulfilled' ? r.value : null
const oks   = [a, b].filter((r) => val(r)?.ok === true)
const taken = [a, b].filter((r) => val(r)?.error === 'slug_taken')
expect(oks).toHaveLength(1)
expect(taken).toHaveLength(1) // the loser's INSERT hits 23505 → slug_taken (catch wraps INSERT, not a pre-SELECT)
```

> If the harness cannot produce a true overlap through the action's pooled service client, assert the equivalent invariant directly: a second `createWaitlist` with the same slug after the first committed returns `{ ok:false, error:'slug_taken' }` AND the DB still has exactly one row for that `(site_id, slug)`. The load-bearing guarantee is "the unique constraint, not a pre-SELECT, decides the winner."

**RUN: `npm run db:reset && HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-cms-actions` BEFORE writing the actions → must FAIL with the action module not found (NOT a helper error).**
- [x] **Step 2: Implement `createWaitlist`/`updateWaitlist` actions** — slug auto-slugify (client), `23505` → `{ ok:false, error:'slug_taken' }` (catch wraps the INSERT/UPDATE, NOT a pre-SELECT), sender-email validated against `ringContext().getSite(siteId).domains` at save (field error), status mutation rejected here (discrete transition actions, Task 16). Return typed results mirroring `SaveCampaignResult`. **RUN: same test → must PASS.** Commit `feat(waitlists): create/update actions (slug-collision, sender validation)`.
- [x] **Step 2a: Write the failing drawer component test** — `apps/web/test/components/waitlist-edit-drawer.test.tsx` (Vitest + Testing Library). The intro is an UNCONTROLLED `contentEditable` read-on-save (flagged crash-prone in the handoff), so its save behavior is load-bearing and MUST be covered. Pass a `createWaitlist` callback as a prop (do NOT import the server action into the client component — props-only per project convention). Assert: (a) Esc closes the drawer; (b) Save reads the uncontrolled `contentEditable` intro into the submitted payload (set the node's text, click Save, assert the payload carries it); (c) submit calls the `createWaitlist` callback prop with `slug`/`name`/`intro`. **RUN → must FAIL (`Cannot find module '.../edit-drawer'`).**
- [x] **Step 3: Drawer component** — right-side drawer portalled to body; fields per handoff §2 (Name, Slug, Description, Intro rich-text UNCONTROLLED `contentEditable` read-on-save, Linked campaign searchable picker, Sender name/email/reply-to, consent preview line); Esc closes; Cancel/Save; takes create/update as callback props. **RUN: same test → must PASS.** Commit `feat(waitlists): create/edit drawer UI`.

> **Task 15 status (2026-06-17, this session — code-only run):** all 4 steps committed (`833dc930` actions+test, `d34e4289` drawer). Typecheck green; the 4 drawer component tests (jsdom) PASS. **The DB-gated `waitlist-cms-actions` test was NOT run with HAS_LOCAL_DB this session** — the local Supabase ports were held by another project. It imports/collects cleanly; run `npm run db:reset && HAS_LOCAL_DB=1 npm test -w apps/web -- waitlist-cms-actions` once Docker is free. **Deferred to the connected island (M2, not yet built):** wiring the `New waitlist` CTA + row-click to open `<WaitlistEditDrawer>` and bridging its `onSubmit` payload → FormData → `createWaitlist`/`updateWaitlist`. The drawer's `campaigns` searchable-picker is a native `<select>` for now (enhance to a combobox when the island passes the campaign list).

### Task 16: Status-transition actions (CAS) + status strip

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/waitlists/actions.ts`
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/status-strip.tsx`
- Test: extend `waitlist-cms-actions.test.ts`

- [ ] **Step 1: Write the failing transition test** — extend `waitlist-cms-actions.test.ts`: illegal transition (e.g. `draft→launched`) rejected with `{ok:false}`; CAS 0-row (stale `from`) returns `status_changed`; a legal transition (`draft→open`) succeeds. **RUN before writing the action → must FAIL (transition action undefined / not exported), NOT a helper error.**
- [ ] **Step 2: Implement `transitionWaitlistStatus(id, to)`** enforcing the Fase-1 legal graph (`draft→open`; `open↔closed`; `failed→closed`) via CAS: `update waitlists set status=$to where id=$id and site_id=$siteId and status=$from` → 0 rows ⇒ `{ ok:false, error:'status_changed' }`. `launched` terminal (no transitions out). **The `(open|closed)→launching` transition is intentionally ABSENT from this action's legal graph in Fase 1** — it is owned exclusively by the real `launchWaitlist` broadcast action in Fase 2 (Task 19 ships only the dialog UI + a stub). Do not add `launching` as a target here. **M6 LGPD Fase-1 gate (code, not just a note):** at the top of the action, BEFORE the CAS, reject any transition to `open` while the rights paths (DSAR + unsubscribe) are Fase-2: `if (to === 'open' && process.env.WAITLIST_ACCEPT_PUBLIC_SIGNUPS !== 'true') return { ok: false, error: 'fase1_only_draft' }` (env unset by default → no public `open` in prod until Fase 2 flips it). Add a test asserting `draft→open` returns `fase1_only_draft` when the env is unset, and succeeds when it is `'true'`. **RUN: same test → must PASS.** Commit `feat(waitlists): guarded status transitions (CAS) + Fase-1 open gate`.
- [ ] **Step 3: Status strip component** — renders only the legal buttons for the current status with one-line hints (per handoff §3); Launch is the accent CTA (wired to the broadcast dialog, Task 19); Resume/Retry uses the recover style. Commit `feat(waitlists): status strip`.

### Task 17: Detail page (Overview + Signups tabs)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/waitlists/[id]/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/signups-tab.tsx`
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/launch-cta.tsx` (extract the CTA card so its gating predicate is unit-testable)
- Test: `apps/web/test/components/waitlist-detail-cta.test.tsx`

**Port source:** `views-waitlists-main.jsx` (`WaitlistDetail`): back link, title + `WlBadge`, public URL, **Edit button only** (see note), status-specific banner, status strip, Overview tab (What's coming, Signups by source, Launch CTA card disabled when `pending===0` or status not open/closed, Details card), Signups tab.

> **OMIT the Embed button in Fase 1.** The handoff puts an "Embed" button on the detail page wired to a CMS `EmbedDialog`, but that dialog + the `/embed/waitlists/[slug]` route are **Fase 3** (spec §8). Rendering a button whose target does not exist is a UX dead-end. Render only the **Edit** button; the Embed button + EmbedDialog are added in the Fase-3 plan. Drop "Embed" from the port list above.

> **`source_surface` labels (Signups-by-source):** DB values are `landing|embed|tiptap` (Task 1, matching the spec). The handoff prototype label `"post"` maps to `"tiptap"` — the bars/pills MUST use the three DB values, not `"post"`. In Fase 1 only `"landing"` is ever written, so the `embed`/`tiptap` buckets render zero.

- [ ] **Step 0: Write the failing Launch-CTA gating test** — `apps/web/test/components/waitlist-detail-cta.test.tsx`. Render the `<LaunchCta>` card and assert the Launch button is **disabled when `pending===0`**, **disabled when `status` not in (`open`,`closed`)**, and **enabled** when `pending>0 AND status in (open,closed)`. **RUN: `npm test -w apps/web -- waitlist-detail-cta` → must FAIL (`Cannot find module '.../launch-cta'`).**
- [ ] **Step 1: Implement `launch-cta.tsx`** with the gating predicate above; the button opens the broadcast dialog (Task 19) but the action returns `not_implemented` until Fase 2 — state this clearly in the card hint. **RUN: same test → must PASS.** Commit `feat(waitlists): Launch CTA card with gating predicate`.
- [ ] **Step 1a: Write the failing detail-page test (DB-gated)** — `apps/web/test/integration/waitlist-detail-page.test.tsx`. Mock `next/headers` to inject `x-site-id` (same as Task 7/13) and `next/navigation`'s `notFound`. Extract the detail query/data-load into a testable unit if the server component is awkward to render directly. Seed a waitlist on site B; render/load the detail scoped to site A for that id and assert `notFound()` is thrown (cross-site IDOR closed via `.eq('id',id).eq('site_id',siteId)`). For an OWNED id (site A) with ≥1 `landing` signup, assert the source-count buckets: `landing > 0`, `embed === 0`, `tiptap === 0`. **RUN before Step 2 → must FAIL (detail module/data-load not found), NOT a helper import error.**
- [ ] **Step 2: Implement the detail server component** reading the waitlist `.eq('id',id).eq('site_id',siteId)` (404 if not owned), grouped signup counts by source/status (using the `landing|embed|tiptap` values), mounting `<LaunchCta>` + the two tabs. **RUN: same test → must PASS.** Commit (test + page together) `feat(waitlists): waitlist detail page (overview + signups tabs)`.

### Task 18: Signups list — server-side keyset query + filters

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/waitlists/_components/signups-tab.tsx`
- Modify: `apps/web/src/app/cms/(authed)/waitlists/actions.ts` (a `listSignups` action or server-component query)
- Test: `apps/web/test/integration/waitlist-signups-query.test.ts`

- [ ] **Step 1: Write the failing test** — `apps/web/test/integration/waitlist-signups-query.test.ts`. Keyset on `(created_at desc, id)` is easy to get subtly wrong (rows sharing the same `created_at`; or a naive `created_at.lt` cursor that skips/dupes). Seed **≥2 signups with an IDENTICAL `created_at`** (force a collision) plus ~28 others, page through ALL rows with the real cursor collecting ids into a `Set`, and assert: `Set.size === totalCount` (NO gap) and `collected.length === Set.size` (NO overlap). **This behavioral Set-invariant ALREADY distinguishes a correct row-value keyset from a bare `created_at.lt` cursor** — a bare cursor will either skip or duplicate the two identical-`created_at` rows, breaking exactly these invariants. Do NOT also try to assert the literal PostgREST `or(...)` cursor STRING the implementation uses (source-coupling with no feasible mechanism from a DB-integration test). Finally assert that an email-prefix filter applied WHILE ON PAGE 2 returns a row whose `created_at` sorts onto page 1 — proving `.ilike` is in the SQL (server-side), not client-side.

```ts
// collision fixture sketch
const ts = '2026-06-10T12:00:00Z'
await db.from('waitlist_signups').insert([
  { waitlist_id, site_id, email: 'collide-a@x.com', consent_launch_notification: true, consent_text_version: 'v1', created_at: ts },
  { waitlist_id, site_id, email: 'collide-b@x.com', consent_launch_notification: true, consent_text_version: 'v1', created_at: ts },
])
// ...seed ~28 more with distinct timestamps, then page through and assert the Set invariants.
```

**RUN before Step 2 → must FAIL (the `listSignups` query/action does not exist), NOT a helper error.**
- [ ] **Step 2: Implement** the server-side query: `.eq('waitlist_id',id).eq('site_id',siteId)` + optional `.eq('status',filter)` + optional `.ilike('email', q + '%')` + a row-value keyset cursor on `(created_at, id)` (`or(created_at.lt.${c},and(created_at.eq.${c},id.lt.${id}))`) with Next/Prev + approximate `count()`. Columns: email, status, suppression_reason, source_surface (display `landing|embed|tiptap`), created_at. **RUN: same test → must PASS.**
- [ ] **Step 3: Commit** `feat(waitlists): server-side keyset signups list with filters`.

### Task 19a: CSV export action (IDOR-guarded + formula-injection)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/waitlists/actions.ts`
- Test: `apps/web/test/integration/waitlist-export.test.ts`

- [ ] **Step 1: Write the failing test (DB-gated)** — `apps/web/test/integration/waitlist-export.test.ts`. Cases: (a) cross-site export request → 404 (IDOR closed: the waitlist belongs to site B, the caller is scoped to site A); (b) export OMITS anonymized rows; (c) a formula-injection cell is neutralized (`=HYPERLINK(...)` → cell begins `'=HYPERLINK`, via the shared `escapeCsv` from Task 0). **RUN before Step 2 → must FAIL (the `exportWaitlistSignups` action does not exist), NOT a helper error.**
- [ ] **Step 2: Implement `exportWaitlistSignups(waitlistId, opts)`** — `requireSiteScope({mode:'view'})`; IDOR guard: resolve `.eq('id',waitlistId).eq('site_id',siteId).maybeSingle()` → 404 if not owned, THEN query signups with BOTH `.eq('site_id',siteId)` AND `.eq('waitlist_id',waitlistId)`. Build CSV with the shared `escapeCsv` (Task 0). Columns: `email, status, suppression_reason, source_surface, locale, created_at`. Anonymized rows omitted. Filename `waitlist-{slug}-{YYYY-MM-DD}.csv`. Honor the export dialog options (status filter, date range, exclude-suppressed default on). **RUN: same test → must PASS.**
- [ ] **Step 3: Commit** `feat(waitlists): CSV export action (IDOR-guarded, formula-injection-safe)`.

### Task 19b: Export dialog + broadcast dialog (UI) + `launchWaitlist` stub

**Files:**
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/export-dialog.tsx`
- Create: `apps/web/src/app/cms/(authed)/waitlists/_components/broadcast-dialog.tsx`
- Modify: `apps/web/src/app/cms/(authed)/waitlists/actions.ts` (add the `launchWaitlist` stub)
- Test: `apps/web/test/components/waitlist-broadcast-stub.test.ts` (+ a dialog render test)

**Port source:** `views-waitlists.jsx` (`ExportDialog`, `BroadcastDialog` — both portalled).

- [ ] **Step 1: Write the failing `launchWaitlist` stub test** — assert the stub returns exactly `{ ok: false, error: 'not_implemented' }`. **RUN → must FAIL (`launchWaitlist` not exported).**
- [ ] **Step 2: Implement the `launchWaitlist` stub** returning `{ ok: false, error: 'not_implemented' }` (the real publish-guarded action is Fase 2). **RUN → must PASS.** Commit `feat(waitlists): launchWaitlist stub (not_implemented until Fase 2)`.
- [ ] **Step 3: Export dialog (own fail-first cycle)** — write a failing render test `apps/web/test/components/waitlist-export-dialog.test.tsx` asserting the status filter + the exclude-suppressed toggle (default on) are present and Esc closes. **RUN → must FAIL (`Cannot find module '.../export-dialog'`).** Then implement `export-dialog.tsx` per handoff §5. **RUN → must PASS.** Commit `feat(waitlists): export dialog UI`.
- [ ] **Step 4: Broadcast dialog (own fail-first cycle)** — write a failing render test `apps/web/test/components/waitlist-broadcast-dialog.test.tsx` asserting: the confirm is disabled at 0 recipients; the type-the-**slug** gate is present; and a "Broadcast ships in the next phase" `not_implemented` notice appears after a stubbed confirm (the confirm calls the `launchWaitlist` stub from Step 2). **RUN → must FAIL (`Cannot find module '.../broadcast-dialog'`).** Then implement `broadcast-dialog.tsx` per handoff §4 (type-the-slug to confirm, live recipient count, 0-recipient disables confirm, Esc closes). **RUN → must PASS.** Commit `feat(waitlists): broadcast dialog UI (send stubbed)`.

### Task 20: Nav item + nav badge counts

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts` (VERIFIED nav registration: the "Content" group lists Newsletters at line 36 and Campaigns at line 37 — `{ icon: icon(<Lucide>), label, href, minRole }`)
- Modify: `apps/web/lib/cms/layout-counts.ts` (`fetchLayoutCountsInner` at line 4 — runs N count queries via `Promise.all`, returns a flat object; `fetchLayoutCounts = unstable_cache(..., { tags:['layout-counts'], revalidate:60 })` at line 23)
- Test: `apps/web/test/integration/waitlist-layout-counts.test.ts` (NEW — no layout-counts test exists today)

- [ ] **Step 1: Add the `waitlists` nav item** to `cms-sections.ts` in the "Content" group immediately AFTER the Campaigns entry (re-grep the exact line — the group contains Blog/Vídeos/Courses/Newsletters/Campaigns/Playlists and line numbers drift): `{ icon: icon(Gift), label: 'Waitlists', href: '/cms/waitlists', minRole: 'editor' }` (import `Gift` from the same lucide source the file already uses). Label is EN per spec §6 CMS-EN-first; the surrounding PT labels (`Vídeos`) are migrated separately. Commit `feat(waitlists): CMS nav item`.
- [ ] **Step 2: Write the failing, UNCONDITIONAL layout-counts test** — `apps/web/test/integration/waitlist-layout-counts.test.ts` (DB-gated). Seed on ONE site: a `failed` waitlist + a `launching` waitlist whose `updated_at` is 7h ago + a `launching` waitlist whose `updated_at` is 1h ago. Call `fetchLayoutCountsInner(siteId)` and assert the actionable waitlist count is **2** (the failed one + the 7h-stuck one), **NOT 3** — the fresh 1h `launching` is inside the 6h watchdog window and must be excluded. **RUN before Step 3 → must FAIL** (`fetchLayoutCountsInner` does not yet return the waitlist count). Time-predicate note: compute the threshold as `new Date(Date.now() - 6*3600*1000).toISOString()` and key the query on `updated_at < threshold` to avoid off-by-one/timezone drift.
- [ ] **Step 3: Extend `fetchLayoutCountsInner` (and EXPORT it)** — **VERIFIED: `fetchLayoutCountsInner` at `apps/web/lib/cms/layout-counts.ts:4` is currently NOT exported (only the `unstable_cache` wrapper `fetchLayoutCounts` is, line 23). Add the `export` keyword to `async function fetchLayoutCountsInner(siteId: string)` so the Step 2 DB-gated test can import it directly** — without this, the test fails on module resolution, not on the intended missing-count assertion (the cache wrapper makes per-test assertions flaky, so exporting Inner is the correct fix). Then add to the `Promise.all` a count of `failed` waitlists + `launching` waitlists with `updated_at < now()-6h`, returned as a new key (e.g. `waitlistsNeedAttention`). Write actions call `revalidateTag('layout-counts')`. **RUN: same test → must PASS.** Commit `feat(waitlists): actionable nav badge counts (failed + stuck-launching)`.

> **Watchdog dormancy note:** in Fase 1 nothing can produce a `launching` waitlist (no broadcast; `(open|closed)→launching` is absent from Task 16) — so the stuck-launching count is structurally always 0 until Fase 2 wires the lifecycle. The query is harmless and correct; it simply has no inputs yet. (Same reconciliation as Task 10.)

---

## FASE 1F — Observability

### Task 21: Sentry tags + funnel (cross-file wiring — `scrub.ts` already landed in Task 0b)

**Files:**
- Modify: the signup route + server actions (add `Sentry` tag `component:'waitlist'` + the count-only funnel breadcrumb)

> **Ordering:** the scrub helper (`apps/web/lib/waitlists/scrub.ts` + its test) lands in **Task 0b** (Prep, before Task 8), so the signup route imports `redactMessage` from creation — already wired into Task 8's 500 branch. This task is ONLY the remaining cross-file wiring (Sentry component tag on every other waitlist route/action + the funnel breadcrumb), kept separate so the broad tag edit does not re-open already-green files in one untested commit.

- [ ] **Step 1: Wire the cross-file Sentry tags + funnel (single commit)** — on all REMAINING waitlist server actions + routes (i.e. everything except Task 8's signup route, which already calls `captureServerActionError({ component:'waitlist', code })` + `redactMessage` from Task 8): add `Sentry.setTag('component','waitlist')` (or the tag arg of `captureServerActionError` from `@/lib/sentry-wrap`), pass any free-text through `redactMessage` (Task 0b) before `captureException`, and add the `source_surface` count-only funnel breadcrumb (no PII). Commit `feat(waitlists): observability — Sentry component tag + count-only funnel`.

---

## Operational deliverables (checklist — not code, must be done before public launch)

- [ ] **Vercel WAF rule:** rate-limit `POST /api/waitlists/:slug/signup` at the edge — **20 req/IP/60s** + **100 req/IP/1h**, action = rate-limit (429), not block. Configure via Vercel WAF / `vercel firewall`. (Spec §3.1.)
- [ ] **`vercel.json` cron** entry for `/api/cron/waitlist-retention-sweep` (Task 10) merged into the existing `crons` array — **only after the cron-quota pre-check passes** (≥39 crons allowed on the project tier; otherwise fold the sweep into the `lgpd-cleanup-sweep` loop instead of adding an entry — see Task 10 Step 3). A silently-capped cron = an undetected LGPD retention gap.
- [ ] **Ordered, fail-safe retention-sweep activation** (mirrors the `LGPD_CRON_SWEEP_ENABLED` irreversible-data safety-valve precedent — `WAITLIST_RETENTION_SWEEP_ENABLED` default = disabled = safety valve):
  1. Deploy with `WAITLIST_RETENTION_SWEEP_ENABLED` unset (the route fail-safes to `{skipped:'disabled'}` 200 and logs `logCron({status:'skipped'})`) and the cron entry present.
  2. Verify in prod logs the cron fires and logs `skipped:'disabled'` (proves the path is registered and inert).
  3. Obtain DPO sign-off.
  4. ONLY THEN set `WAITLIST_RETENTION_SWEEP_ENABLED=true`.
- [ ] **Env:** `TURNSTILE_SECRET_KEY` present in preview/prod (route returns 503 otherwise — by design).
- [ ] **DPO/legal sign-off note** committed under `content/legal/` or `docs/ops/`: documents the single-opt-in posture, the retention schedule (30/7/90/30 days), and the anonymous-member DSAR endpoint as the Art. 18 path.

---

## Out of scope for this plan (separate plans)

- **Fase 2 (`docs/superpowers/plans/<date>-waitlists-phase2.md`):** the `RecipientSource` seam refactor of `send-scheduled-newsletters/route.ts` (golden-snapshot + STATIC grep guard FIRST), `newsletter_editions` extension, source-namespaced `generateUnsubscribeToken` + `unsubscribe_tokens` migration + hardened `unsubscribe_via_token` branch, SES webhook recipient-source awareness, the real `launchWaitlist` broadcast action (typed-slug confirm + `requireSiteScope({mode:'publish'})`), `launching`/`failed` lifecycle trigger + watchdog reachability + delete guard + FK-cascade-safe recovery, `SES_WAITLIST_CONFIG_SET` env + tracking disabled.
- **Fase 3 (`docs/superpowers/plans/<date>-waitlists-phase3.md`):** embed route (`/embed/waitlists/[slug]` + FULL CSP re-emit + postMessage/ResizeObserver sizing + accent validation) and the TipTap/MDX node (MDX-path registration in `blogRegistry` + `<WaitlistForm slug="…" />` JSX-reference serialization + round-trip test gate).

---

## Self-review notes (run before execution)

- **Spec coverage (Fase 1 scope):** tables/RLS/RPCs (Tasks 1–5) ✓; consent (6) ✓ (incl. DB-gated ledger-resolution test); public GET/POST/DSAR (7–9) ✓; sweep (10) ✓ — ships per-site iteration under `withCronLock` + PASS-2 idempotency guard + last-run observability (logCron-per-outcome + Sentry breadcrumb); the §8 stuck-launching watchdog is **structurally deferred to Fase 2** (no `newsletter_editions` waitlist row can exist in Fase 1), explicitly flagged in Task 10. LGPD adapter (11) ✓; public form+landing (12–13) ✓; CMS list/drawer/status/detail/signups/export/nav (14–20, incl. split 19a/19b) ✓; observability (21) ✓; operational deliverables tracked ✓. Broadcast SEND is correctly deferred to Fase 2 (dialog UI ships, `launchWaitlist` stubbed). Embed dialog/button is Fase 3 (omitted from the detail page, not dead-ended).
- **Path alias caveat:** `@/` → `apps/web/src`; `lib/` (e.g. `lib/turnstile`, `lib/supabase/service`, `lib/logger`, `lib/cms/layout-counts`) lives at `apps/web/lib` and is reached via the relative depth the sibling routes use. Every route/action step flags this — confirm the exact relative path by grepping a sibling file before writing imports.
- **Verify-before-write items** (flagged inline): exact `audit_log` columns; `consent_texts` columns; `site_visible`/`can_view_site`/`can_edit_site` signatures; the seed-helper export names in `db-seed.ts`; the Pinboard kit import path; `tg_set_updated_at` name. **CMS nav registration is now PRE-VERIFIED:** `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts` "Content" group (Newsletters line 36, Campaigns line 37) — add the `waitlists` item there. These are reads, not guesses.
- **PostgREST RPC param types:** `waitlist_signup.p_email` is `text` (cast to `public.citext` internally), NOT `public.citext` — a citext param breaks PostgREST function resolution (PGRST202). `waitlist_rate_check` already uses `p_email text`. The audit hash uses the internal `v_email` cast, not `p_email`.
- **Locale header:** routes/pages prefer `x-default-locale` (the request-side header middleware always sets at middleware.ts:388/428); `x-locale` is response-side and may be null on the request.
- **Type consistency:** signup RPC returns `jsonb` decoded as `{ error?, status?, duplicate? }` consistently across Tasks 3/8; `escapeCsv` signature identical in Tasks 0/19; status enum values identical across SQL (Task 1) and TS (Tasks 14/16).
