# Waitlists — Launch & Operations Runbook

Operational source of truth for Waitlists Phase-1. Code is complete and verified
(DB-gated suite green); this covers the dashboard-bound steps and the irreversible
job that must not be flipped casually.

## 1. LGPD public signups — ENABLED 2026-06-18 (Fase-2 rights shipped)

`WAITLIST_ACCEPT_PUBLIC_SIGNUPS=true` in Vercel **Production + Preview**. Public signups
are now allowed because the Fase-2 data-subject rights paths shipped (LGPD Art. 18):

- **Access:** `/waitlists/rights` (request a link) → `/waitlists/manage/[token]` (view) +
  `GET /api/waitlists/dsar/[token]` (machine-readable download).
- **Erasure:** the manage page's delete action → `waitlist_erase_by_email` RPC (hashes
  email, nullifies ip/ua/locale, stamps anonymized_at; retains proof-of-consent).
- **Token table:** `waitlist_dsar_tokens` (migration `20260618000001`), applied to prod.
- The flag remains the operational on/off switch — unset → fail-closed (draft-only).
- **Hardening follow-up:** add a Vercel WAF rate-limit on `POST /api/waitlists/rights`
  (no-oracle + registered-only-send today, but rate-limiting is the next layer).

## 2. Turnstile (anti-abuse on the public POST) — ✅ CONFIGURED 2026-06-18

The public signup route fails closed to **HTTP 503 `unavailable`** in prod/preview when
`TURNSTILE_SECRET_KEY` is unset.

- **Done:** Cloudflare Turnstile widget `bythiagofigueiredo-waitlists` (Managed mode;
  hostnames `bythiagofigueiredo.com` + `www.bythiagofigueiredo.com`). `TURNSTILE_SECRET_KEY`
  + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` set in Vercel **Production + Preview**. Site key
  `0x4AAAAAADnT1_q8z7V-EvLY` (public). Secret stored encrypted in Vercel + local `.env.local`.
- The keys take effect on the **next deployment** (NEXT_PUBLIC_ is build-time embedded).
- Smoke test after a deploy: an empty POST to `/api/waitlists/<slug>/signup` returns
  **400 `invalid_body`** (route ran past the secret gate), NOT **503**.
- If signups ever 503 in prod, confirm the widget's hostname allowlist covers the live domain.

## 3. WAF rate-limit + remaining dashboard items (Fase-2 hardening)

**In-app already done (2026-06-18):** `/api/waitlists/rights` now has Turnstile (fail-neutral)
+ a per-site `waitlist_rate_check` call (fail-neutral) — so it can't be used to email-bomb a
registered address. Erasure links now expire (7-day TTL) and burn on use.

Remaining items are **dashboard/account actions** (no repo change possible):

- **A — Vercel WAF rate-limit.** Vercel → Project `bythiagofigueiredo-web` → Firewall → Rate
  Limiting → Add rule. Match `^/api/waitlists/([^/]+/signup|rights)$`, method `POST`,
  ~10 req/600s per IP → Challenge/Deny. Record: Rule ID `____` Threshold `____` (date ____).
- **F — preview Turnstile.** The Cloudflare widget `bythiagofigueiredo-waitlists` is allowlisted
  to `bythiagofigueiredo.com` (+ subdomains). To make forms work on `*.vercel.app` preview
  deploys, add hostname `thiago-figueiredos-projects.vercel.app` in Cloudflare → Turnstile →
  the widget (the MCP OAuth lacks Turnstile-edit scope, so this is manual). Production is
  unaffected without it.
- **E — transactional SES config set.** `SES_TRANSACTIONAL_CONFIG_SET` is unset → transactional
  mail (confirm/rights) uses `SES_DEFAULT_CONFIG_SET` (works). For deliverability isolation,
  create a dedicated config set in AWS SES and set the env. Optional.
- **H — Sentry alert.** Alert on `component:waitlist` + `action IN (rights_request, erasure,
  retention_sweep)` at `level:warning` (the code emits these tags; rights captures also carry
  `error_type:lookup|token_creation|email_send`). Dashboard rule (Sentry API needs alert scope).

## 4. Retention sweep — ordered activation (IRREVERSIBLE)

The cron `/api/cron/waitlist-retention-sweep` (registered, `15 4 * * *`) performs
**irreversible anonymization** of expired signups. It is double-gated: `CRON_SECRET`
(auth) + `WAITLIST_RETENTION_SWEEP_ENABLED` (must equal the literal string `true`).

**Do NOT enable on launch.** Activate only in this order:

1. **Soak (default):** leave `WAITLIST_RETENTION_SWEEP_ENABLED` unset. Confirm the Vercel
   Cron tab lists the job and prod logs show `{"skipped":"disabled"}` on each fire.
2. **DPO/legal sign-off** on the retention window + anonymization behavior.
3. **Enable:** set `WAITLIST_RETENTION_SWEEP_ENABLED=true` in Vercel Production. Redeploy
   (env change takes effect on next deploy).
4. **Verify first run:** grep Sentry + `vercel logs` for the `waitlist-retention-sweep`
   breadcrumb/`logCron` line and confirm `failed: 0`. The route returns HTTP 200 even on
   per-site failures (soft), so the aggregate count is the real signal.

To pause: unset the flag (next deploy) — the route reverts to the `{"skipped":"disabled"}`
fast-path immediately.

## 5. Sentry alert (non-blocking, recommended)

Per-site sweep failures keep HTTP 200 by design, so status monitoring won't catch a
systemic failure. Add an alert:

- **Where:** Sentry → Alerts → Create → Issues (or Metric on the cron breadcrumb).
- **Condition:** events tagged `component:waitlist` + `action:retention_sweep` at
  `level:warning` (the route raises the breadcrumb to `warning` when `failed > 0`), or
  any `waitlist_retention_sweep …` captured exception.
- **Action:** notify the on-call channel.
- The code already emits `logCron({job:'waitlist-retention-sweep', failed})` so the count
  is also queryable in structured logs independent of Sentry.

## 6. Migrations applied (prod)

The 8 Phase-1 migrations (apply in ascending order — tables → RLS → RPCs → LGPD → seed →
the two new RPCs `create_waitlist_with_translation`, `waitlist_detail_counts`):

```
20260616000001_waitlist_tables          20260616000006_waitlist_consent_seed
20260616000002_waitlist_rls             20260617000001_waitlist_create_with_translation_rpc
20260616000003_waitlist_signup_rpc      20260617000002_waitlist_detail_counts_rpc
20260616000004_waitlist_rate_check_rpc  20260618000001_waitlist_dsar_rights_fase2
20260616000005_waitlist_lgpd            20260618000002_waitlist_erase_audit_log   (4-arg erase + audit; applied 2026-06-18)
```

Verify: `npx supabase migration list` shows all 10 applied on the remote column. `…000002`
defines the 4-arg `waitlist_erase_by_email` (audit-logged) that the manage-page erase action
calls — it MUST be applied before/with the Fase-2 hardening deploy (it keeps a 2-arg back-compat
wrapper, so it is safe to apply ahead of the code).

The rights ACCESS-link issuance is also audit-logged (`action='waitlist_access_requested'`,
hashed email) from `/api/waitlists/rights`.
