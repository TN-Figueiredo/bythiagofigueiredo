#!/usr/bin/env bash
# scripts/media-smoke.sh — 5-check smoke test for the media system
# Usage: CRON_SECRET=xxx ./scripts/media-smoke.sh https://bythiagofigueiredo.com
set -euo pipefail

HOST="${1:?Usage: media-smoke.sh <HOST>}"
PASS=0
FAIL=0

check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✓ $name"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name"
    FAIL=$((FAIL + 1))
  fi
}

echo "Media smoke test → $HOST"

# 1. Health endpoint returns ok: true
check "Health endpoint ok" bash -c "
  curl -sf -H 'Authorization: Bearer ${CRON_SECRET}' '${HOST}/api/health/media' | grep -q '\"ok\":true'
"

# 2. Health fields completeness
check "Health fields present" bash -c "
  curl -sf -H 'Authorization: Bearer ${CRON_SECRET}' '${HOST}/api/health/media' | grep -q 'totalAssets'
"

# 3. CSP includes blob.vercel-storage.com
check "CSP includes blob.vercel-storage.com" bash -c "
  curl -sf -I '${HOST}/' | grep -i 'content-security-policy' | grep -q 'blob.vercel-storage.com'
"

# 4. next/image serves optimized format
check "next/image WebP optimization" bash -c "
  curl -sf -H 'Accept: image/webp' -o /dev/null -w '%{content_type}' '${HOST}/_next/image?url=%2Fog-default.png&w=640&q=75' | grep -q 'webp'
"

# 5. Blob storage reachable (HEAD check on known Blob domain)
check "Blob storage domain reachable" bash -c "
  curl -sf -o /dev/null -w '%{http_code}' 'https://novkqtvcnsiwhkxihurk.public.blob.vercel-storage.com/' | grep -qE '200|403|404'
"

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ] || exit 1
