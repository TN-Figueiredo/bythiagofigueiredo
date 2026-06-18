# Waitlists Fase-2 Hardening & Completeness — Design Spec

**Status:** validated by an 8-dimension adversarial review (score 79 → target 98+; shipped code release-safe, this closes the planned hardening).

**Goal:** harden + complete the LIVE Fase-2 LGPD rights path (access + erasure) so public waitlist signups are not just compliant but accountable, abuse-resistant, and discoverable.

## Global constraints
- No-oracle MUST be preserved: `/rights` and the DSAR/manage lookups return constant/neutral responses regardless of whether an email/token exists.
- Service client bypasses RLS → every read/write stays `.eq('site_id')`-scoped.
- New/changed SQL goes in a NEW migration (`npm run db:new`) — `20260618000001` is already applied to prod; never edit an applied migration.
- DB-gated tests gate behind `skipIfNoLocalDb()`.

## Work items (validated)

**G + used_at — access-link freshness & replay guard (major).** Add `created_at, used_at` to the token selects in `api/waitlists/dsar/[token]/route.ts` and `(public)/waitlists/manage/[token]/page.tsx`. Reject (→ NEUTRAL / `rows=null`) when `used_at != null` OR `created_at` older than `WAITLIST_DSAR_TOKEN_TTL_DAYS` (7). `/rights` re-request refreshes `created_at` (upsert payload sets it) so a fresh request re-arms the link. Test: 8-day-old token → empty; used token → empty; refreshed → works.

**C — audit-log erasure (major).** New migration `CREATE OR REPLACE waitlist_erase_by_email` inserting one `audit_log` row after the UPDATE (`action='waitlist_erasure'`, `resource_type='waitlist_signups'`, `site_id`, payload `{rows_affected, reason:'data_subject_request'}`, ip/ua from `app.client_ip`/`app.user_agent` GUCs). Server action calls `set_audit_context(ip, ua)` (read from headers) before the RPC; audit INSERT happens before the token burn. Test: audit row appears with the right action + count.

**B + F — Turnstile on /rights + preview coverage (major).** `rights-form.tsx` renders the Cloudflare widget (same pattern as the signup form), `Body` gains `turnstile_token`, route verifies via `verifyTurnstileToken` when `hasTurnstileSecret` — fail to `OK()` (neutral), never 400, to keep no-oracle. Add `thiago-figueiredos-projects.vercel.app` to the Cloudflare widget hostnames (covers `*.vercel.app` previews).

**A + rate-limit — /rights throttling (major).** Call `waitlist_rate_check(siteId, ip, email)` in the rights route (after body parse, before lookup); on `false` return `OK()` (neutral). Validate the boolean result fail-closed (mirror signup). Plus a Vercel WAF rate-limit rule (~10/10min/IP) on `POST /api/waitlists/rights` + `/signup`; record rule ID in the runbook.

**EMAIL-FAIL-VISIBILITY + H — observability (minor).** Distinct `error_type` Sentry tags (`lookup|token_creation|email_send`) on the three rights-route captures. Sentry alert on `component:waitlist` + `action IN (rights_request, erasure)` at `level:warning` — via API if alert-scoped token, else documented.

**D — discoverability (minor).** Link `/waitlists/rights` from the privacy-policy data-rights section + public footer.

**TOKEN-BOUNDS-CONST (nit).** Export `WAITLIST_DSAR_TOKEN_MIN_LEN/MAX_LEN` from `lib/waitlists/dsar-token.ts`; use in all three call sites.

**RETENTION-DISCLOSURE (nit, design/DPO).** Add retention/deletion-schedule copy near signup consent + privacy policy; confirm with DPO. (Copy only; DPO sign-off out of code scope.)

## Explicitly rejected (from the review, fabricated/overstated)
Hash-collision "critical", timing-safe token compare, cache-control-on-POST, token-in-redirect-URL "leak", SES env "unvalidated" (already declared + fallback correct), onConflict hash-collision, cross-site IDOR (structurally impossible — HMAC binds siteId + queries filter `tok.site_id`). Cross-site remains a test-coverage add only.
