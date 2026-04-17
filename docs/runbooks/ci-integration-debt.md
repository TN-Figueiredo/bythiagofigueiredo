# CI Integration (DB-gated) debt tracker

Last updated: 2026-04-17

## Current state

**RESOLVED.** The `Integration (DB-gated)` job is **hard-gated** — `continue-on-error: true`
was removed after all 123 integration tests pass against a fresh local DB.

## History

The job was soft-gated from 2026-04-17 (PR `chore/ci-hardening-env-and-migration-order`)
while 18 tests carried fixture drift from Sprint 4.75 (RBAC v3) and Sprint 5a (LGPD).
All 18 failures were resolved in the follow-up fixture migration work:

### Fixes applied

1. **RBAC v3 role mismatch** — `seedStaffUser` updated to insert `'org_admin'` in
   `organization_members` for admin/owner roles; editors/reporters skip the org-level
   insert (they live in `site_memberships` under RBAC v3).

2. **LGPD fixture drift** — `seedPendingNewsletterSub` always sets `brevo_contact_id`
   (required by `newsletter_subscriptions_check`); `consent_text_id` values in
   `lgpd-consents-merge.test.ts` and related tests use live string keys.

3. **`form_button_label` NOT NULL** — `rpc-update-campaign.test.ts` pt-BR partial
   update now includes all required NOT NULL columns.

4. **`lgpd_phase1_cleanup` caller guard** — guard used `current_user` which in a
   `SECURITY DEFINER` function always returns the function owner (`postgres`). Fixed
   via migration `20260501000006_fix_phase1_cleanup_guard.sql` to use `auth.role()`
   (JWT claim) instead.

5. **`blog_posts` INSERT** — removed non-existent `slug` column from the test INSERT;
   slug lives on `blog_translations`, not `blog_posts`.

6. **Middleware tests [7][8][9]** — added `vi.mock('@tn-figueiredo/cms/ring', …)` to
   `area-authorization.test.ts` (matching the pattern in `middleware.test.ts`) so
   site resolution uses a stub localhost site rather than hitting the DB.

7. **`can_admin_site_for_user` RBAC v3** — migration
   `20260501000005_fix_can_admin_site_for_user_rbac_v3.sql` updated
   `is_org_staff_for_user` and `can_admin_site_for_user` to use only `'org_admin'`
   role (RBAC v3 constraint).

8. **`check_deletion_safety` sole-admin test** — temporarily removes other master ring
   admins (dev seed user) for the test duration so the sole-admin check fires.

9. **`reassign_authors` unique violation** — nulls `editorAId` authors.user_id before
   calling the RPC so the UPDATE doesn't hit a unique constraint.

10. **`lgpd_phase1_cleanup is restricted` assertion** — fixed to pass a different
    `p_user_id` (reporterAId) vs the caller's JWT sub (editorAId) so the guard fires.

11. **`nullifies authors.user_id` test ordering** — switched from reporterAId (already
    cleaned by earlier tests in the same file) to randomId.

12. **`reassigns blog_posts` authorId** — use `scenario.authorsByUser[editorAId]` (the
    stored author DB ID) instead of a runtime query that could return null after phase1.

## Verification

```bash
# Clean local DB:
npm run db:stop
# Stop any conflicting projects first:
npx supabase stop --project-id monorepo-migration
npm run db:start

# Apply all migrations via psql (Supabase CLI has a known bug on migration
# 20260416000009 with its Go/pgx runner — psql applies them correctly):
bash scripts/apply-migrations-local.sh  # or use supabase db reset if CLI is fixed

# Run integration suite:
cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/
# Expected: Test Files 16 passed (16), Tests 123 passed (123)
```

## Related PRs

- `chore/ci-hardening-env-and-migration-order` (2026-04-17) — fixed setup failures
- `chore/integration-fixture-migration` (2026-04-17) — drained all 18 + 3 failures,
  removed `continue-on-error: true`
