# Waitlists — Launch & Operations Runbook

Operational source of truth for Waitlists Phase-1. Code is complete and verified
(DB-gated suite green); this covers the dashboard-bound steps and the irreversible
job that must not be flipped casually.

## 1. LGPD Fase-1 lock (MANDATORY)

`WAITLIST_ACCEPT_PUBLIC_SIGNUPS` **must remain UNSET** in Vercel Production until
Fase-2 ships the DSAR (data-subject access request) + unsubscribe/erasure paths.

- **Why:** accepting public signups before the rights/erasure flows exist creates an
  LGPD exposure that contradicts the signed DPO note. With the flag unset, the signup
  RPC refuses any `open` public list (fail-closed default).
- **Runtime verification (prod):**
  ```sql
  select count(*) as open_waitlists from public.waitlists where status = 'open';
  ```
  Expected: `0`. If non-zero, investigate before any public exposure.
- **Vercel verification:** `vercel env ls production | grep WAITLIST_ACCEPT_PUBLIC_SIGNUPS`
  → must return nothing (absent).

## 2. Turnstile (anti-abuse on the public POST)

The public signup route fails closed to **HTTP 503 `unavailable`** in prod/preview when
`TURNSTILE_SECRET_KEY` is unset.

- Required env (Production **and** Preview): `TURNSTILE_SECRET_KEY`,
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- The Cloudflare Turnstile widget is domain-bound — ensure `bythiagofigueiredo.com`
  (and preview domains, if smoke-testing there) are in the Turnstile site allowlist.
- Smoke test (preview): an empty POST to `/api/waitlists/<slug>/signup` must return
  **400 `invalid_body`** (route ran past the secret gate), NOT **503**.

## 3. WAF rate-limit rule (non-blocking, recommended)

The in-app `waitlist_rate_check` RPC is **per-site** (per IP+email within a site). Add an
edge/account-wide line of defense in Vercel Firewall.

- **Where:** Vercel → Project `bythiagofigueiredo-web` → Firewall → Rate Limiting → Add rule.
- **Match:** request path `^/api/waitlists/[^/]+/signup$`, method `POST`.
- **Threshold (suggested):** 10 requests / 600s per client IP → action `Challenge` (or `Deny`).
- **After creating:** record the rule ID + final threshold here:
  - Rule ID: `__________`  Threshold: `__________`  Action: `__________`  (date: ____)

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
20260616000001_waitlist_tables          20260616000005_waitlist_lgpd
20260616000002_waitlist_rls             20260616000006_waitlist_consent_seed
20260616000003_waitlist_signup_rpc      20260617000001_waitlist_create_with_translation_rpc
20260616000004_waitlist_rate_check_rpc  20260617000002_waitlist_detail_counts_rpc
```

Verify: `npx supabase migration list` shows all 8 applied on the remote column.
