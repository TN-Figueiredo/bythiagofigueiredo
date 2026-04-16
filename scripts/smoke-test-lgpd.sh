#!/usr/bin/env bash
#
# smoke-test-lgpd.sh — Post-deploy smoke tests for Sprint 5a LGPD rollout.
#
# Usage: PROD_URL=https://... PROD_DB_URL=postgres://... bash scripts/smoke-test-lgpd.sh
# Run after: npm run db:push:prod + Vercel deploy
#
# Validates:
#   - Public routes (/, /privacy, /terms) respond 200
#   - Cookie banner markup present on public routes, absent from /cms/login
#   - 15 LGPD migrations (prefix 20260430*) applied
#   - 7 new RPCs exist in pg_proc
#   - New tables (lgpd_requests, consents, consent_texts) have expected shape
#   - storage.buckets has private 'lgpd-exports' bucket + 3 RLS policies
#   - /api/cron/lgpd-cleanup-sweep returns 401 without CRON_SECRET
#   - Home HTML hints feature flags are on (soft check)
#
# Exits 0 on full success, non-zero on first failure.

set -euo pipefail
trap 'echo "FAIL at line $LINENO" >&2; exit 1' ERR

PROD_URL="${PROD_URL:-https://bythiagofigueiredo.com}"
PROD_DB_URL="${PROD_DB_URL:-}"

if [[ -z "$PROD_DB_URL" ]]; then
  echo "ERROR: PROD_DB_URL (Postgres connection string) is required for SQL checks." >&2
  echo "Usage: PROD_URL=https://... PROD_DB_URL=postgres://... bash scripts/smoke-test-lgpd.sh" >&2
  exit 2
fi

command -v curl >/dev/null 2>&1 || { echo "ERROR: curl not found in PATH" >&2; exit 2; }
command -v psql >/dev/null 2>&1 || { echo "ERROR: psql not found in PATH" >&2; exit 2; }

echo ""
echo "▶ LGPD smoke tests against: $PROD_URL"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 1/8: HTTP public routes respond 200
# ──────────────────────────────────────────────────────────────────────────────
echo "=== 1/8: Public routes respond 200 (/, /privacy, /terms) ==="
for path in "/" "/privacy" "/terms"; do
  if ! curl -sf -o /dev/null "$PROD_URL$path"; then
    echo "FAIL: $PROD_URL$path did not return 2xx" >&2
    exit 1
  fi
  echo "  ok: $path"
done

# ──────────────────────────────────────────────────────────────────────────────
# 2/8: Cookie banner markup present on public routes
# Expected selector: data-testid="cookie-banner"  OR  id="cookie-banner"
# (either form is accepted — components may render one or both)
# ──────────────────────────────────────────────────────────────────────────────
echo "=== 2/8: Cookie banner present on / and absent from /cms/login ==="
HOME_HTML="$(curl -sf "$PROD_URL/")"
if ! echo "$HOME_HTML" | grep -qE 'data-testid="cookie-banner"|id="cookie-banner"'; then
  echo "FAIL: cookie banner markup not found on $PROD_URL/ (expected data-testid=\"cookie-banner\" or id=\"cookie-banner\")" >&2
  exit 1
fi
echo "  ok: banner present on /"

LOGIN_HTML="$(curl -sf "$PROD_URL/cms/login" || true)"
if echo "$LOGIN_HTML" | grep -qE 'data-testid="cookie-banner"|id="cookie-banner"'; then
  echo "FAIL: cookie banner should NOT render on /cms/login (confine to public routes)" >&2
  exit 1
fi
echo "  ok: banner absent from /cms/login"

# ──────────────────────────────────────────────────────────────────────────────
# 3/8: 15 LGPD migrations applied (prefix 20260430*)
# Tolerant: >= 15 (the backup migration 000000 makes total 16)
# ──────────────────────────────────────────────────────────────────────────────
echo "=== 3/8: LGPD migrations (20260430*) applied in supabase_migrations ==="
MIG_COUNT="$(psql "$PROD_DB_URL" -t -A -c \
  "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version LIKE '20260430%';" \
  | xargs)"
if [[ -z "$MIG_COUNT" || "$MIG_COUNT" -lt 15 ]]; then
  echo "FAIL: expected >= 15 LGPD migrations, found: ${MIG_COUNT:-<empty>}" >&2
  exit 1
fi
echo "  ok: $MIG_COUNT migrations applied"

# ──────────────────────────────────────────────────────────────────────────────
# 4/8: New RPCs exist in pg_proc
# ──────────────────────────────────────────────────────────────────────────────
echo "=== 4/8: New RPCs exist in pg_proc ==="
EXPECTED_RPCS=(
  check_deletion_safety
  purge_deleted_user_audit
  reassign_authors
  cancel_account_deletion_in_grace
  lgpd_phase1_cleanup
  merge_anonymous_consents
  get_anonymous_consents
)
RPC_LIST="$(printf "'%s'," "${EXPECTED_RPCS[@]}")"
RPC_LIST="${RPC_LIST%,}"
RPC_FOUND="$(psql "$PROD_DB_URL" -t -A -c \
  "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ($RPC_LIST);" \
  | xargs)"
if [[ "$RPC_FOUND" -lt "${#EXPECTED_RPCS[@]}" ]]; then
  echo "FAIL: expected ${#EXPECTED_RPCS[@]} RPCs, found $RPC_FOUND" >&2
  echo "Missing RPCs:" >&2
  psql "$PROD_DB_URL" -c \
    "SELECT unnest FROM unnest(ARRAY[$RPC_LIST]) WHERE unnest NOT IN
     (SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public');" >&2
  exit 1
fi
echo "  ok: ${#EXPECTED_RPCS[@]}/${#EXPECTED_RPCS[@]} RPCs present"

# ──────────────────────────────────────────────────────────────────────────────
# 5/8: New tables exist with expected columns + seed rows
# ──────────────────────────────────────────────────────────────────────────────
echo "=== 5/8: lgpd_requests, consents, consent_texts shape + seed ==="

check_columns() {
  local table="$1"; shift
  local cols=("$@")
  for col in "${cols[@]}"; do
    local exists
    exists="$(psql "$PROD_DB_URL" -t -A -c \
      "SELECT count(*) FROM information_schema.columns
       WHERE table_schema='public' AND table_name='$table' AND column_name='$col';" \
      | xargs)"
    if [[ "$exists" != "1" ]]; then
      echo "FAIL: column public.$table.$col missing" >&2
      exit 1
    fi
  done
  echo "  ok: public.$table has [${cols[*]}]"
}

check_columns lgpd_requests id user_id type status phase scheduled_purge_at blob_path
check_columns consents     user_id anonymous_id category granted withdrawn_at

CONSENT_TEXT_COUNT="$(psql "$PROD_DB_URL" -t -A -c \
  "SELECT count(*) FROM public.consent_texts;" \
  | xargs)"
if [[ -z "$CONSENT_TEXT_COUNT" || "$CONSENT_TEXT_COUNT" -lt 6 ]]; then
  echo "FAIL: consent_texts has $CONSENT_TEXT_COUNT rows, expected >= 6 (pt-BR+en × 3+ categories)" >&2
  exit 1
fi
echo "  ok: consent_texts has $CONSENT_TEXT_COUNT seed rows"

# ──────────────────────────────────────────────────────────────────────────────
# 6/8: Storage bucket 'lgpd-exports' exists + correct RLS
# ──────────────────────────────────────────────────────────────────────────────
echo "=== 6/8: storage.buckets lgpd-exports + 3 RLS policies ==="
BUCKET_ROW="$(psql "$PROD_DB_URL" -t -A -F'|' -c \
  "SELECT id, public FROM storage.buckets WHERE id = 'lgpd-exports';" \
  | xargs)"
if [[ -z "$BUCKET_ROW" ]]; then
  echo "FAIL: storage.buckets row id='lgpd-exports' not found" >&2
  exit 1
fi
BUCKET_PUBLIC="${BUCKET_ROW##*|}"
if [[ "$BUCKET_PUBLIC" != "f" && "$BUCKET_PUBLIC" != "false" ]]; then
  echo "FAIL: lgpd-exports bucket is public=$BUCKET_PUBLIC, expected false" >&2
  exit 1
fi
echo "  ok: bucket lgpd-exports exists, public=false"

POLICY_COUNT="$(psql "$PROD_DB_URL" -t -A -c \
  "SELECT count(*) FROM pg_policies
   WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'lgpd_exports%';" \
  | xargs)"
if [[ "$POLICY_COUNT" -lt 3 ]]; then
  echo "FAIL: expected 3 lgpd_exports* RLS policies on storage.objects, found $POLICY_COUNT" >&2
  exit 1
fi
echo "  ok: $POLICY_COUNT RLS policies on storage.objects (lgpd_exports*)"

# ──────────────────────────────────────────────────────────────────────────────
# 7/8: Cron route returns 401 without CRON_SECRET
# ──────────────────────────────────────────────────────────────────────────────
echo "=== 7/8: /api/cron/lgpd-cleanup-sweep returns 401 without token ==="
CRON_STATUS="$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/api/cron/lgpd-cleanup-sweep")"
if [[ "$CRON_STATUS" != "401" ]]; then
  echo "FAIL: cron route returned $CRON_STATUS, expected 401 (authz check)" >&2
  exit 1
fi
echo "  ok: unauthenticated GET returns 401"

# ──────────────────────────────────────────────────────────────────────────────
# 8/8: Feature flags readable from build (soft check)
# Greps home HTML for any LGPD-feature indicator. If automation fails here,
# treat as MANUAL VERIFICATION — the build-time NEXT_PUBLIC_* flags are harder
# to introspect without parsing __NEXT_DATA__.
# ──────────────────────────────────────────────────────────────────────────────
echo "=== 8/8: Feature flags reflected in build (soft check) ==="
if echo "$HOME_HTML" | grep -qiE 'cookie-banner|lgpd|consent|/privacy|/terms'; then
  echo "  ok: HTML contains LGPD/consent indicators"
else
  echo "  WARN: no LGPD indicators found in HTML — MANUAL VERIFICATION REQUIRED:" >&2
  echo "        confirm NEXT_PUBLIC_LGPD_BANNER_ENABLED / NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED /" >&2
  echo "        NEXT_PUBLIC_ACCOUNT_EXPORT_ENABLED are set in Vercel and redeploy was triggered." >&2
  # Do not fail — this is the documented soft-check path.
fi

echo ""
echo "✓ All 8 smoke tests passed"
exit 0
