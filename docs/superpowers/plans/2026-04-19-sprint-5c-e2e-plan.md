# Sprint 5c — E2E Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing 13-spec Playwright E2E suite green in CI. All spec files are already written; the work is environment wiring, testid audit, and CI hardening.

**Spec:** `docs/superpowers/specs/2026-04-19-sprint-5c-e2e-design.md`

**Playwright version:** `@playwright/test@1.44.0` (already in `devDependencies`)

**Port:** Next.js dev server for E2E runs on `3099` (not 3001 — see `playwright.config.ts` `webServer.command`). `PLAYWRIGHT_BASE_URL` must match.

---

## Current State (2026-04-19)

| Artifact | Status |
|---|---|
| `apps/web/playwright.config.ts` | Done — `testDir: ./e2e/tests`, port 3099, `storageState`, `globalSetup/Teardown` |
| `e2e/fixtures/global-setup.ts` | Done — wait-for-Supabase, clear Inbucket, create 4 test users, assign RBAC roles |
| `e2e/fixtures/global-teardown.ts` | Done — deletes test content (slug `test-%`) + test users |
| `e2e/fixtures/auth.setup.ts` | Done — 4 `storageState` files (admin/editor/reporter/public) |
| `e2e/fixtures/index.ts` | Done — extended `test()` with `supabaseAdmin`, `testId`, `siteId`, `editorUserId`, `acceptedCookies` |
| `e2e/pages/*.ts` | Done — `LoginPage`, `BlogEditorPage`, `CampaignEditorPage`, `AdminShellPage`, `CmsShellPage`, `PublicPage` |
| `e2e/tests/auth/admin-login.spec.ts` | Done (5 tests including a11y) |
| `e2e/tests/auth/cms-login.spec.ts` | Done (5 tests including a11y and `?next=` redirect) |
| `e2e/tests/auth/invite-acceptance.spec.ts` | Done (7 tests covering public + editor states) |
| `e2e/tests/cms/blog.spec.ts` | Done (11 tests including reporter restriction, schedule, archive, `test.fixme` locale) |
| `e2e/tests/cms/campaigns.spec.ts` | Done (9 tests including PDF upload, reporter restriction) |
| `e2e/tests/cms/contacts.spec.ts` | Done (4 tests including LGPD anonymize) |
| `e2e/tests/admin/users.spec.ts` | Done (8 tests including reporter redirect) |
| `e2e/tests/admin/audit.spec.ts` | Done (3 tests) |
| `e2e/tests/admin/sites.spec.ts` | Done (4 tests including `cms_enabled` toggle) |
| `e2e/tests/public/homepage.spec.ts` | Done (3 tests + `test.fixme` for unknown host) |
| `e2e/tests/public/newsletter.spec.ts` | Done (4 tests including Inbucket confirm + unsubscribe) |
| `e2e/tests/public/contact-form.spec.ts` | Done (3 tests including Turnstile bypass) |
| `e2e/tests/lgpd/cookie-banner.spec.ts` | Done (4 tests including version-bump re-prompt) |
| `apps/web/.env.test.example` | Done |
| `.github/workflows/e2e.yml` | Done |
| `e2e/fixtures/assets/test.pdf` | Done |
| `e2e/fixtures/assets/test-image.jpg` | Done |
| `e2e/.auth/*.json` | Generated at runtime (gitignored) |
| LGPD account deletion E2E spec | **Not yet written** (P5 backlog) |

---

## Phases

### Phase 1 — Environment + First Green Run (P0)

**Goal:** `npm run test:e2e` passes locally end-to-end with 0 failures.

- [ ] **T1: Copy `.env.test.example` to `.env.test`** and fill in local Supabase keys.
  ```bash
  cp apps/web/.env.test.example apps/web/.env.test
  # Then run: npm run db:start && npm run db:status
  # Copy NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from output
  ```
  Verify port: `playwright.config.ts` `webServer.url` is `http://localhost:3099` — set `PLAYWRIGHT_BASE_URL=http://localhost:3099` in `.env.test`.

- [ ] **T2: Install Playwright browsers**
  ```bash
  cd apps/web && npx playwright install chromium --with-deps
  ```

- [ ] **T3: Start Supabase local and apply migrations**
  ```bash
  npm run db:start   # from monorepo root
  npm run db:reset   # applies all migrations + seed
  npm run db:status  # confirm Studio at http://127.0.0.1:54323
  ```

- [ ] **T4: Run setup project in isolation** to verify global-setup + auth.setup work:
  ```bash
  cd apps/web && npx playwright test --project=setup --reporter=list
  ```
  Expected: 4 storage-state files written to `e2e/.auth/`. If this fails, all other tests will also fail — fix here first.

- [ ] **T5: Run `no-db` project** (homepage — no auth dependency):
  ```bash
  cd apps/web && npx playwright test --project=no-db --reporter=list
  ```
  Expected: 3 tests green (the `test.fixme` host-unknown is skipped by design).

- [ ] **T6: Run full suite locally**:
  ```bash
  cd apps/web && npm run test:e2e
  ```
  Target: ≤ 3 failures on first run (environment noise). Document any failures.

---

### Phase 2 — Testid Audit (P1 — unblocks flaky selectors)

**Goal:** All specs that use `getByTestId()` have corresponding `data-testid` attributes in the app.

The POM files use testids from this list — each must be present in the rendered HTML:

- [ ] **T7: Audit `PostEditor` component** (`@tn-figueiredo/cms`) for missing testids:
  - `cms-blog-publish-button` — publish action
  - `cms-blog-unpublish-button` — unpublish action
  - `cms-blog-archive-button` — archive action
  - `cms-blog-delete-button` — delete + confirm
  - `cms-blog-title-input` — title field (fallback label selector already in specs)
  - `cms-blog-locale-selector` — locale switcher (only needed when locale tabs are implemented)

  If `PostEditor` is consumed from the published `@tn-figueiredo/cms` package (not workspace), testids must be added to the wrapper in `apps/web/src/app/cms/(authed)/blog/[id]/edit/page.tsx` or via `data-testid` props forwarded to the package component.

- [ ] **T8: Audit campaign editor** for:
  - `cms-campaign-upload-pdf-input` — or confirm `CampaignEditorPage.uploadPdf()` uses `input[type=file]` locator directly
  - `cms-campaign-publish-button` / `cms-campaign-unpublish-button`

- [ ] **T9: Audit admin pages** for:
  - `admin-users-invite-button` — opens invite modal
  - `admin-users-revoke-button` — per-row revoke (in `AdminShellPage.revokeInvite()`)
  - `admin-sites-cms-enabled-toggle` — toggle switch in sites form
  - `admin-sites-save-button` — save button in sites form

- [ ] **T10: Audit public pages** for:
  - `public-newsletter-subscribe-input` — email input
  - `public-newsletter-subscribe-button` — submit
  - `public-contact-form-submit-button` — already referenced in `contact-form.spec.ts`
  - `newsletter-feedback` — confirmation feedback area

- [ ] **T11: Audit LGPD cookie banner** for:
  - `lgpd-cookie-banner-accept-button` — already in `cookie-banner.spec.ts`
  - `lgpd-cookie-banner-reject-button` — already in `cookie-banner.spec.ts`

  These are in `@tn-figueiredo/lgpd@0.1.0` — check if the package already emits them. If not, add wrapper in `apps/web/src/lib/lgpd/` or request a patch release.

- [ ] **T12: Audit contact submission detail view** for:
  - `contact-email` — email field in contact detail
  - `anonymized-at` — anonymized timestamp display

---

### Phase 3 — Fix Failing Tests (P2)

**Goal:** Address any spec-level failures discovered in Phase 1, fix one by one.

- [ ] **T13: Fix `invite-acceptance.spec.ts` flakiness** if Inbucket is not delivering emails within timeout. The spec uses `test.slow()` — if emails arrive after 90s, increase via `test.setTimeout(150_000)` on the affected test.

- [ ] **T14: Fix `newsletter.spec.ts` Inbucket timeout** — `getConfirmUrl()` polls for 10s with 1s delay. If Supabase local SMTP is slow, increase `maxAttempts` from 10 to 20.

- [ ] **T15: Verify `blog.spec.ts` "publicar post" assertion** — the spec checks `published_at` via DB after publish action. Confirm the publish server action sets `published_at` atomically (not deferred). If there's a race, add `page.waitForResponse()` before the DB check.

- [ ] **T16: Verify `sites.spec.ts` `cms_enabled` toggle** — the `afterEach` must restore `cms_enabled=true`. If a test crashes before `afterEach`, subsequent tests in the same worker will fail because `/cms` redirects to `/cms/disabled`. Confirm the `afterEach` guard is robust.

- [ ] **T17: Verify `audit.spec.ts` filter test** — the `invitation.created` action value must match exactly what the `audit_log.action` column stores. If the trigger stores `invitation_created` (underscore), the `selectOption` in the test will find no match. Verify via `supabase.from('audit_log').select('action').limit(5)`.

- [ ] **T18: Verify PDF upload path in `campaigns.spec.ts`** — `CampaignEditorPage.uploadPdf()` calls `page.setInputFiles()`. Confirm the file input is not hidden behind a styled button that requires a click first. If so, update the POM.

---

### Phase 4 — CI Integration (P3)

**Goal:** `e2e.yml` workflow passes in CI on first run against `staging` PRs.

- [ ] **T19: Add GitHub Secrets** required by `e2e.yml`:
  - `SUPABASE_ANON_KEY_LOCAL` — default local anon key (public, safe to store as secret)
  - `SUPABASE_SERVICE_ROLE_KEY_LOCAL` — default local service role key (public, safe)
  - `E2E_ADMIN_PASSWORD` — same as `.env.test` default (`E2e@Admin2026!`)
  - `E2E_EDITOR_PASSWORD` — `E2e@Editor2026!`
  - `E2E_REPORTER_PASSWORD` — `E2e@Reporter2026!`

  The Supabase local keys have published defaults — check `supabase status` output or the Supabase CLI docs.

- [ ] **T20: Verify `npx supabase db reset --local` in CI** — the workflow uses `db reset` (not `db start` + `db push`). Confirm this is the correct command for the monorepo setup. Note: `CLAUDE.md` warns that Supabase CLI v2.90.0 has a migration runner bug — if CI uses a pinned version, `db reset` may fail on specific migrations. Mitigation: pin `supabase@2.89.0` in the workflow or apply failing migrations via `psql` workaround documented in memory.

- [ ] **T21: Validate `PLAYWRIGHT_BASE_URL` in CI** — the workflow sets `PLAYWRIGHT_BASE_URL=http://localhost:3001` but `playwright.config.ts` starts Next.js on port `3099` (webServer). These must match. Either:
  - Change workflow env to `PLAYWRIGHT_BASE_URL=http://localhost:3099`, or
  - Add `PLAYWRIGHT_BASE_URL` to the `webServer.env` block in config
  
  **This is a confirmed mismatch — fix before first CI run.**

- [ ] **T22: Add Playwright cache to CI** to avoid downloading Chromium on every run:
  ```yaml
  - name: Cache Playwright browsers
    uses: actions/cache@v4
    with:
      path: ~/.cache/ms-playwright
      key: playwright-${{ runner.os }}-${{ hashFiles('apps/web/package-lock.json') }}
  ```

- [ ] **T23: Set `CRON_SECRET` in workflow** if any test hits `/api/health/seo` or cron endpoints. Currently no E2E spec tests cron endpoints directly — skip if not needed.

---

### Phase 5 — LGPD Account Deletion Flows (P4 — optional)

**Goal:** E2E coverage of the 3-phase LGPD deletion model (Phase 1 + cancel in grace period).

- [ ] **T24: Write `e2e/tests/lgpd/account-deletion.spec.ts`**

  Spec structure:
  ```ts
  test.describe('LGPD / Account Deletion', () => {
    test.use({ storageState: 'e2e/.auth/editor.json' })
    test.describe.configure({ mode: 'serial' })

    test('solicitar exclusão inicia grace period', async ({ page }) => {
      await page.goto('/account/delete')
      await page.getByTestId('lgpd-account-delete-request-button').click()
      await page.getByTestId('lgpd-account-delete-confirm-button').click()
      // Phase 1: user is banned, session still exists temporarily
      await expect(page.getByText(/[Gg]race|[Pp]razo|[Ee]xclusão.*[Aa]gendada/i)).toBeVisible()
    })

    test('cancelar exclusão no grace period restaura conta', async ({ page, supabaseAdmin }) => {
      // ... cancel via /account/delete/cancel + verify ban lifted
    })
  })
  ```

  Pre-condition: `NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED=true` (already in `.env.test.example`).

  Constraint: this spec requires a **dedicated test user** for deletion (cannot reuse `e2e-editor@test.local` — that user is needed for other specs). Add `e2e-deletion@test.local` to `global-setup.ts` and create a matching `deletion.json` storageState in `auth.setup.ts`.

- [ ] **T25: Add `e2e-deletion@test.local` to global-setup and teardown**

---

## Key Decisions Made During Implementation

| Decision | Rationale |
|---|---|
| Port 3099 for E2E webServer (not 3001) | Avoids collision with normal `npm run dev` on 3001. `reuseExistingServer: false` in CI always starts a fresh server. |
| `db reset` in CI (not `db start` + migrations) | Faster — reset applies all migrations + seed atomically. Risk: CLI migration runner bug (see T20 mitigation). |
| Chromium only in CI | Firefox + WebKit: Sprint 6+ dívida técnica consciente. |
| No visual regression | Too flaky across environments. |
| `test.fixme` for unknown-host test | Chromium blocks `Host` header modification — not a Playwright limitation to fix now. |
| LGPD deletion E2E in Phase 5 (optional) | Requires dedicated test user + complex grace-period timing. Not blocking Sprint 6 launch. |

---

## First 3 Concrete Actions

1. **Fix the port mismatch (T21):** `playwright.config.ts` starts Next.js on `3099` but `.env.test.example` sets `PLAYWRIGHT_BASE_URL=http://localhost:3001`. Update `.env.test.example` to `PLAYWRIGHT_BASE_URL=http://localhost:3099` and fix the `e2e.yml` env var to match. This is the single most likely cause of all tests failing with "connection refused" in CI.

2. **Create `.env.test` locally and run `--project=setup` (T1 + T4):** Before touching any test code, verify the entire bootstrap chain works: Supabase up → global-setup seeds users → auth.setup writes 4 `.auth/*.json` files. If this step fails, diagnose before writing any new code.

3. **Run the testid audit (T7–T12):** The POMs use specific `data-testid` values. Run the suite, note which assertions fail with "element not found", and add the missing testids to the app components. This is the most common source of E2E failures in new suites — specs are correct but the HTML doesn't have the anchors yet.
