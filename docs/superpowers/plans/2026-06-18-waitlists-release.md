# Waitlists Phase-1 Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This is a **release/ops** plan, not a code-feature plan — "verification" steps are real commands with expected output, not unit tests.

**Goal:** Take Waitlists Phase-1 from "code-complete, 65 unpushed commits" to "verified, deployed to a green Vercel build, with all 8 migrations live in prod and the LGPD Fase-1 gate confirmed" — resolving every blocking and non-blocking item from the release-readiness panel autonomously.

**Architecture:** Verify-locally-first, then mutate prod. Phase A proves the migrations + RPCs against a real local Postgres (de-risks the irreversible prod push). Phase B closes config/doc gaps and commits them. Phase C sets Vercel env (reversible). Phase D pushes the 8 migrations to prod (irreversible — gated on Phase A passing). Phase E pushes `staging` → one Vercel build. Phase F is post-deploy hardening (WAF, Sentry alert, soak).

**Tech Stack:** Supabase CLI (local Docker + prod link), Vitest (`HAS_LOCAL_DB=1`), Vercel CLI, Next.js 15, Sentry.

## Global Constraints

- **NEVER run DB-gated tests against prod.** Phase A uses the **local** Docker DB only (default ports 54321-54324, confirmed free).
- **`WAITLIST_ACCEPT_PUBLIC_SIGNUPS` MUST stay UNSET in prod** (Fase-1 LGPD lock — no public open-list signups until Fase-2 DSAR/erasure paths ship).
- **`WAITLIST_RETENTION_SWEEP_ENABLED` stays UNSET** through an initial soak (irreversible anonymization job).
- **Minimize Vercel builds** — budget. Exactly **one** push to `staging` (Phase E). No force-push to `main`/`staging`.
- **`db:push:prod` is irreversible** — only run it after Phase A is fully green.
- **Work on `staging`** directly; commit footer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Migrations are created only via `npm run db:new` — all 8 already exist; do NOT hand-edit timestamps.
- Production go-live (merge `staging` → `main`) is **out of scope** for this plan — the Fase-1 gate keeps public signups off regardless, and the merge is the user's explicit final call.

---

## File Structure

- `apps/web/src/lib/env.ts` — add the two waitlist flags to the env schema (parity with `LGPD_CRON_SWEEP_ENABLED`).
- `docs/ops/waitlists-launch-runbook.md` (create) — Fase-1 lock rationale, WAF rule spec, retention-sweep activation sequence, Sentry alert spec. The single source of truth for the operational steps that are dashboard-bound.
- No application logic changes — the code passed the panel with zero open critical/major defects (commit `fbcfeaf7`).

---

### Task 1: Prove migrations + RPCs against local Postgres (Blocker #2)

**Files:**
- Verify: `supabase/migrations/20260616000001…20260617000002` (all 8 waitlist migrations)
- Test: `apps/web/test/integration/waitlist-*.test.ts` (DB-gated suite)

**Interfaces:**
- Produces: confidence that `db reset` applies all 8 migrations in order and the DB-gated suite passes — the precondition for Task 7 (`db:push:prod`).

- [ ] **Step 1: Confirm default ports are free and start local Supabase**

Run: `npm run db:start`
Expected: containers come up; `supabase local development setup is running` with API at `http://127.0.0.1:54321`. (If a port conflict appears, STOP — do not fall back to prod.)

- [ ] **Step 2: Reset local schema — applies ALL migrations from scratch (ordering proof)**

Run: `npm run db:reset`
Expected: every migration applies with no "out of order" / no SQL error; the two new RPC migrations (`…617000001`, `…617000002`) apply cleanly after the tables. This is the local rehearsal of `db:push:prod`.

- [ ] **Step 3: Run the full DB-gated waitlist suite**

Run: `cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/waitlist-signup-endpoint.test.ts test/integration/waitlist-create-rpc.test.ts test/integration/waitlist-export.test.ts test/integration/waitlist-cms-actions.test.ts test/integration/waitlist-detail-counts*.test.ts test/integration/waitlist-rls*.test.ts test/integration/waitlist-retention*.test.ts test/integration/waitlist-signups-query*.test.ts test/integration/waitlist-lgpd*.test.ts`
Expected: all previously-skipped tests now **run and pass** (RLS column revokes, SECURITY DEFINER RPCs, keyset pagination, retention sweep, atomic create, non-boolean rate-check fail-closed). 0 failed.

- [ ] **Step 4: Run the full web suite once with the local DB (catch any cross-suite regression)**

Run: `cd apps/web && HAS_LOCAL_DB=1 npx vitest run 2>&1 | tail -15`
Expected: 0 failed (the ~13002 jsdom tests + the now-active DB-gated tests).

- [ ] **Step 5: Tear down (release Docker for the other terminal)**

Run: `npm run db:stop`
Expected: containers stopped. (No commit — this task produces verification, not code.)

---

### Task 2: Close the env-schema parity gap (config completeness)

**Files:**
- Modify: `apps/web/src/lib/env.ts` (add the two waitlist flags next to `LGPD_CRON_SWEEP_ENABLED`)

**Interfaces:**
- Consumes: nothing.
- Produces: `WAITLIST_RETENTION_SWEEP_ENABLED` and `WAITLIST_ACCEPT_PUBLIC_SIGNUPS` declared as `z.string().optional()` so they're documented in the schema like every other operational flag (routes still read `process.env.*` directly — behaviour unchanged).

- [ ] **Step 1: Read the current flag block**

Run: `grep -n "LGPD_CRON_SWEEP_ENABLED\|GEO_PROVIDER\|SEO_AI_CRAWLERS" apps/web/src/lib/env.ts`
Expected: locate the optional operational-flag declarations.

- [ ] **Step 2: Add the two waitlist flags (mirror `LGPD_CRON_SWEEP_ENABLED`)**

Add, adjacent to `LGPD_CRON_SWEEP_ENABLED: z.string().optional(),`:
```ts
  WAITLIST_RETENTION_SWEEP_ENABLED: z.string().optional(),
  WAITLIST_ACCEPT_PUBLIC_SIGNUPS: z.string().optional(),
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/env.ts
git commit -m "chore(waitlists): declare retention-sweep + public-signups flags in env schema

Parity with LGPD_CRON_SWEEP_ENABLED — both are read via process.env directly in
their routes, so behaviour is unchanged; this documents them in the validated
schema like every other operational flag.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Ops runbook for the dashboard-bound steps (Non-blockers #6, #8, #9 documentation)

**Files:**
- Create: `docs/ops/waitlists-launch-runbook.md`

**Interfaces:**
- Produces: the single source of truth for the steps that live in the Vercel/Sentry dashboards (WAF rule, retention activation sequence, Sentry alert), referenced by Tasks 8-10.

- [ ] **Step 1: Write the runbook**

Create `docs/ops/waitlists-launch-runbook.md` with these sections, each with exact values:
- **Fase-1 LGPD lock:** `WAITLIST_ACCEPT_PUBLIC_SIGNUPS` MUST stay unset until Fase-2 (DSAR + unsubscribe). Verification query: `select count(*) from waitlists where status='open';` must be `0`.
- **WAF rate-limit rule:** target `POST /api/waitlists/:slug/signup`; suggested per-IP threshold (e.g. 10 req / 10 min → challenge/deny); record rule ID + threshold after creation. Note the in-app `waitlist_rate_check` is per-site, so the WAF is the edge/account-wide first line.
- **Retention-sweep activation sequence:** (1) soak with flag unset, confirm logs `{"skipped":"disabled"}`; (2) DPO/legal sign-off; (3) `WAITLIST_RETENTION_SWEEP_ENABLED=true` in Vercel Production; (4) after first run grep Sentry/logs for the `level=warning` breadcrumb + `logCron` aggregate to confirm `failed=0`.
- **Sentry alert:** alert on the `waitlist-retention-sweep` breadcrumb / cron error at `level=warning` (`failed>0`), because per-site failures keep HTTP 200 by design and are otherwise invisible to status monitoring.

- [ ] **Step 2: Commit**

```bash
git add docs/ops/waitlists-launch-runbook.md
git commit -m "docs(ops): waitlists launch runbook — Fase-1 lock, WAF rule, retention activation, Sentry alert

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Set Turnstile env in Vercel (Blocker #4) + confirm Fase-1 gate (Blocker #5)

**Files:** none (Vercel env state).

**Interfaces:**
- Consumes: the real Turnstile values from `apps/web/.env.local`.
- Produces: `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` present in Vercel **Production AND Preview** (so the Phase-E preview deploy can be smoke-tested and prod works on main-merge); `WAITLIST_ACCEPT_PUBLIC_SIGNUPS` confirmed absent.

- [ ] **Step 1: Extract the two values from .env.local (do not print them)**

Run: `cd apps/web && grep -E '^(TURNSTILE_SECRET_KEY|NEXT_PUBLIC_TURNSTILE_SITE_KEY)=' .env.local | sed 's/=.*/=<present>/'`
Expected: both names show `<present>`.

- [ ] **Step 2: Add `TURNSTILE_SECRET_KEY` to Production and Preview**

Run (value piped from .env.local, never echoed):
```bash
cd apps/web
V=$(grep -E '^TURNSTILE_SECRET_KEY=' .env.local | cut -d= -f2-)
printf '%s' "$V" | vercel env add TURNSTILE_SECRET_KEY production
printf '%s' "$V" | vercel env add TURNSTILE_SECRET_KEY preview
```
Expected: `Added Environment Variable TURNSTILE_SECRET_KEY` for each.

- [ ] **Step 3: Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to Production and Preview**

Run:
```bash
cd apps/web
V=$(grep -E '^NEXT_PUBLIC_TURNSTILE_SITE_KEY=' .env.local | cut -d= -f2-)
printf '%s' "$V" | vercel env add NEXT_PUBLIC_TURNSTILE_SITE_KEY production
printf '%s' "$V" | vercel env add NEXT_PUBLIC_TURNSTILE_SITE_KEY preview
```
Expected: `Added Environment Variable` for each.

- [ ] **Step 4: Verify presence + Fase-1 gate absence**

Run: `cd apps/web && vercel env ls production | grep -iE 'TURNSTILE|WAITLIST'`
Expected: both Turnstile vars listed for Production; **no** `WAITLIST_ACCEPT_PUBLIC_SIGNUPS` and **no** `WAITLIST_RETENTION_SWEEP_ENABLED` (both must be absent → fail-closed defaults).

---

### Task 5: Push the 8 migrations to prod (Blocker #3 — irreversible, gated on Task 1)

**Files:** none (prod DB schema).

**Interfaces:**
- Consumes: Task 1 green (migrations proven locally).
- Produces: all 8 waitlist migrations live in prod `novkqtvcnsiwhkxihurk`, including the two SECURITY DEFINER RPCs the deployed code depends on.

- [ ] **Step 1: Confirm link + dry view of pending migrations**

Run: `npm run db:which && npx supabase migration list`
Expected: linked to `novkqtvcnsiwhkxihurk`; the 8 waitlist migrations show as local-only (not yet applied remote).

- [ ] **Step 2: Push to prod**

Run: `npm run db:push:prod`
Expected: prompts confirmation, applies the 8 migrations in ascending order (tables → RPCs), reports success.

- [ ] **Step 3: Verify remote now has all 8**

Run: `npx supabase migration list`
Expected: the 8 waitlist migrations now show applied on the remote column.

---

### Task 6: Verify prod LGPD posture (Blocker #5 runtime proof)

**Files:** none.

**Interfaces:**
- Consumes: Task 5 (tables exist in prod).
- Produces: runtime confirmation that no prod waitlist is `open` (Fase-1 lock holds at the data layer).

- [ ] **Step 1: Query open-list count in prod**

Run: `npx supabase db query "select count(*) as open_waitlists from public.waitlists where status='open';" 2>/dev/null || echo "(use Supabase SQL editor: select count(*) from waitlists where status='open')"`
Expected: `0`. (If the CLI subcommand isn't available, run the query in the Supabase SQL editor and record `0`.)

---

### Task 7: One push to `staging` → Vercel build + CI (Blocker #1)

**Files:** none (deploy).

**Interfaces:**
- Consumes: Tasks 2-6 committed/applied.
- Produces: a green Vercel preview build (real `next build` parity) + green CI on `staging`.

- [ ] **Step 1: Final local typecheck + confirm clean tree**

Run: `cd apps/web && npm run typecheck && cd .. && git status -sb | head -3`
Expected: EXIT 0; `staging` ahead of origin by the full commit count, working tree clean of tracked changes.

- [ ] **Step 2: Push once**

Run: `git push origin staging`
Expected: push succeeds; triggers Vercel build + `ci.yml`.

- [ ] **Step 3: Monitor the Vercel build to completion**

Run: `cd apps/web && vercel ls bythiagofigueiredo-web 2>&1 | head -5` (then `vercel inspect <latest-url> --logs` if needed)
Expected: latest deployment reaches **Ready** (not Error). If it errors, read logs, fix locally, and amend before any further push.

- [ ] **Step 4: Smoke-test the public signup on the preview URL (Turnstile not 503)**

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST "<preview-url>/api/waitlists/<known-slug>/signup" -H 'content-type: application/json' -d '{}'`
Expected: a **400 `invalid_body`** (empty body) or **404** — crucially NOT **503 `unavailable`**, which would mean Turnstile env didn't take. (A 400 proves the route ran past the Turnstile-secret gate.)

---

### Task 8: Vercel WAF rate-limit rule (Non-blocker #6)

**Files:** none (Vercel Firewall config).

**Interfaces:**
- Consumes: project linked.
- Produces: a per-IP rate-limit rule on `POST /api/waitlists/*/signup`, or — if the API/CLI can't express it — the exact rule documented in the runbook for one dashboard click.

- [ ] **Step 1: Attempt the firewall rule via the Vercel REST API**

Run: `cd apps/web && curl -s -X GET "https://api.vercel.com/v1/security/firewall/config/active?projectId=prj_rAnVPZl5u1BZs2sXjmUZ0VMUeUsq&teamId=team_TAGgFNqDhoNJJhC7N0eX1GsY" -H "Authorization: Bearer $(cat ~/.local/share/com.vercel.cli/auth.json 2>/dev/null | grep -o '"token":"[^"]*"' | cut -d'"' -f4)" 2>&1 | head -c 400`
Expected: either the current firewall config JSON (→ proceed to PATCH a rate-limit rule for the signup path) or an auth/permission error (→ fall back to Step 2).

- [ ] **Step 2: If the API path isn't available, record the exact rule in the runbook**

Confirm `docs/ops/waitlists-launch-runbook.md` (Task 3) contains the precise rule (path `POST /api/waitlists/:slug/signup`, threshold, action). Mark it as "apply in Vercel → Firewall → Rate Limiting". No commit if already present.

---

### Task 9: Sentry alert on the retention-sweep breadcrumb (Non-blocker #9)

**Files:** none (Sentry alert config).

**Interfaces:**
- Produces: an alert on the `waitlist-retention-sweep` cron error / `level=warning` breadcrumb, or the documented spec if no Sentry API token with alert scope is available.

- [ ] **Step 1: Check for a Sentry token with alert-creation scope**

Run: `grep -E '^SENTRY_(ORG|PROJECT|AUTH_TOKEN)=' apps/web/.env.local | sed 's/=.*/=<present>/'`
Expected: if `SENTRY_AUTH_TOKEN` is present, attempt creating an issue-alert rule via the Sentry API for the `waitlist-retention-sweep` tag at `level=warning`. (This token is documented as build-only/source-map scope, so it likely lacks alert scope.)

- [ ] **Step 2: If no alert-scoped token, the runbook spec stands**

Confirm the Sentry alert spec is in `docs/ops/waitlists-launch-runbook.md` (Task 3). The alert is non-blocking and dashboard-bound; the code already emits the `logCron` aggregate + warning breadcrumb so the signal exists. No commit if already present.

---

### Task 10: Retention sweep soak posture (Non-blocker #7)

**Files:** none.

**Interfaces:**
- Produces: confirmation the irreversible sweep is in its safe disabled state.

- [ ] **Step 1: Confirm the flag is unset in Vercel (from Task 4 Step 4) and the cron is registered**

Run: `grep -n "waitlist-retention-sweep" apps/web/vercel.json && cd apps/web && vercel env ls production | grep -i WAITLIST_RETENTION || echo "WAITLIST_RETENTION_SWEEP_ENABLED unset (correct — soak)"`
Expected: cron registered (`15 4 * * *`); flag **absent** → route fast-paths `{"skipped":"disabled"}`. Activation is the runbook's gated sequence — not done now.

---

## Self-Review

**1. Coverage of the 9 checklist items:**
- #1 push staging + green build → Task 7 ✓
- #2 DB-gated suite under Docker → Task 1 ✓ (ports free, confirmed)
- #3 db:push:prod 8 migrations in order → Task 5 ✓ (gated on Task 1)
- #4 Turnstile env in Vercel → Task 4 ✓ (Prod + Preview)
- #5 Fase-1 lock (flag unset + open count 0) → Task 4 Step 4 + Task 6 ✓
- #6 WAF rate-limit → Task 8 ✓ (API attempt + documented fallback)
- #7 retention soak → Task 10 ✓
- #8 ordered retention activation → Task 3 runbook ✓
- #9 Sentry alert → Task 9 ✓ (API attempt + documented fallback)

**2. Placeholder scan:** WAF/Sentry steps are honestly conditional (API token availability) with a concrete documented fallback — not hand-waving. All env-set steps show the exact piped command.

**3. Ordering integrity:** Local proof (Task 1) BEFORE irreversible prod push (Task 5). Migrations in prod (Task 5) BEFORE the deploy goes live so the deployed code's RPC calls (`create_waitlist_with_translation`, `waitlist_detail_counts`) resolve. Env vars (Task 4) before the push so the preview build has Turnstile. Exactly one `staging` push (Task 7).

**4. Irreducible external dependencies (flagged, not hidden):** WAF rule and Sentry alert may require dashboard actions if no scoped API token exists — both are non-blockers, both fully specified in the runbook.
