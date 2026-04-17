# CI Integration (DB-gated) debt tracker

Last updated: 2026-04-17

## Current state

The `Integration (DB-gated)` job in `.github/workflows/ci.yml` is **soft-gated**
(`continue-on-error: true`). Setup succeeds (`supabase start` + `supabase db
reset --local` apply all migrations cleanly) but 18 integration tests under
`apps/web/test/integration/` fail because their fixtures predate Sprint 4.75
(RBAC v3) and Sprint 5a (LGPD) schema changes.

These tests never ran to completion in CI before — the job used to die at
container startup because of a migration ordering bug, masking the fixture
debt. Once the setup was fixed, the underlying debt surfaced. Rather than
rewrite fixtures under time pressure during the CI hardening work, the job
was soft-gated so the rest of CI (typecheck, test-api, test-web, lighthouse,
seo-smoke, ecosystem-pinning, secret-scan) can hard-gate PRs while this debt
is drained separately.

## What needs to happen to un-gate

Remove `continue-on-error: true` from the `test-db-integration` job after the
failure classes below are resolved and `HAS_LOCAL_DB=1 npm test --workspace=apps/web -- integration/`
passes end-to-end against a fresh `supabase db reset`.

## Failure classes

### 1. RBAC v3 role mismatch (7 tests in `area-authorization.test.ts`)

Tests call `seedStaffUser(db, orgId, 'author' | 'editor' | 'admin')` but
`organization_members.role` has a CHECK constraint that only accepts
`'org_admin'` (since migration `20260420000001_rbac_v3_schema.sql`). The old
`editor` / `reporter` roles live in `site_memberships`, not `organization_members`.

**Fix sketch:**
- Retire `seedStaffUser` in favour of two helpers:
  - `seedOrgAdmin(db, orgId, opts)` → inserts into `organization_members` with
    `role='org_admin'`.
  - `seedSiteRole(db, siteId, 'editor' | 'reporter', opts)` → inserts into
    `site_memberships`.
- `author` isn't an RBAC v3 role. Tests that exercised "author can't access
  /admin" need to be rewritten against a "user with zero memberships" case —
  that's what the `randomId` in `seedRbacScenario` already represents.
- Layout-level requireArea tests (`area-authorization.test.ts`) need to use
  the `seedRbacScenario` matrix (`superAdmin`, `orgAdmin`, `editorA`,
  `reporterA`, `random`) rather than ad-hoc `freshUser(orgId, role)`.

### 2. LGPD fixture drift (8 tests across `lgpd-*.test.ts`)

- `consent_text_id` values use pre-v2 naming (e.g. `cookie_functional_v1_pt-BR`
  rather than the FK-backed UUIDs now stored in `consent_texts` after
  `20260430000022_consent_texts_v2_seed.sql`).
- RPC signatures shifted between Sprint 5a drafts — `lgpd_phase1_cleanup` took
  different args at test-write time.
- `lgpd_requests` unique-partial-index tests need the v2 seed variants.

**Fix sketch:** pull live `consent_text_id` UUIDs from the seed tables (or
expose a helper in `db-seed.ts` that looks them up by category + locale), and
regenerate the test fixtures against the current RPC contracts in
`supabase/migrations/202604300000{02,04,05,06,07,09,18,21}_*.sql`.

### 3. `campaign_translations` NOT NULL columns (1 test in `rpc-update-campaign.test.ts`)

A column (`form_button_label`) became NOT NULL after the Sprint 3 hardening
pass. The test fixture doesn't supply it.

**Fix:** list every NOT NULL column of `campaign_translations` and either
backfill defaults in the helper or update the test to set explicit values.

### 4. `rpc-confirm-newsletter.test.ts` (2 tests)

Likely a contract shift on `confirm_newsletter_subscription` — error keys or
response shape changed. Needs a diff between the test's `expect` calls and
the current RPC return JSON (migrations `…000009_epic2_hardening.sql` and the
LGPD v2 consent rework).

### 5. `rbac-invite-scope.test.ts` (~3 tests)

`accept_invitation_atomic` now signals errors via raised exceptions with
SQLSTATE `P0002` (not_found), `P0001` (forbidden), etc., rather than the
`{ok:false,error:<string>}` JSON the tests still assert on.

## Verification loop

```bash
# Ensure a clean local DB:
npm run db:stop
npm run db:start
npx supabase@2.92.1 db reset --local

# Run integration suite:
cd apps/web && HAS_LOCAL_DB=1 npx vitest run integration/

# Target suite:
cd apps/web && HAS_LOCAL_DB=1 npx vitest run integration/area-authorization.test.ts
```

Use `grep 'integration/' -r .github/workflows/` to confirm only `test-db-integration`
references `integration/`; no other job runs these tests.

## Related PRs

- `chore/ci-hardening-env-and-migration-order` (2026-04-17) — fixed the setup
  failure (migration order + dev seed) and introduced this soft-gate. See
  commits:
  - `fix(api): inject placeholder SUPABASE_SERVICE_ROLE_KEY in test setup`
  - `fix(db): move seed_master_site after primary_domain NOT NULL migration`
  - `fix(db): update dev seed for Sprint 4.75 + 5a schema`
  - `ci(integration): soft-gate DB integration job pending fixture migration`
