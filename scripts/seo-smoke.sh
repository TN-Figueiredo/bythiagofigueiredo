#!/usr/bin/env bash
set -euo pipefail

# SEO post-deploy smoke checks.
# Usage: scripts/seo-smoke.sh [HOST]
#   HOST defaults to https://bythiagofigueiredo.com
# Env: SKIP_HEALTH=1 to skip check #8 (pre-PR-E); CRON_SECRET required unless skipped

HOST="${1:-https://bythiagofigueiredo.com}"
HOST="${HOST%/}"

echo "=========================================="
echo "SEO smoke checks against: $HOST"
echo "=========================================="

echo; echo "[1/8] Sitemap valid XML"
SITEMAP=$(curl -sf "$HOST/sitemap.xml") || { echo "  FAIL: sitemap.xml not reachable"; exit 1; }
echo "$SITEMAP" | xmllint --noout - || { echo "  FAIL: sitemap.xml is not valid XML"; exit 1; }
echo "  OK"

echo; echo "[2/8] Robots has Sitemap: line"
ROBOTS=$(curl -sf "$HOST/robots.txt") || { echo "  FAIL: robots.txt not reachable"; exit 1; }
echo "$ROBOTS" | grep -qE "^Sitemap: $HOST/sitemap\.xml$" || { echo "  FAIL"; exit 1; }
echo "  OK"

echo; echo "[3/8] Robots disallows protected paths"
for path in /admin /cms /account /api; do
  echo "$ROBOTS" | grep -qE "^Disallow: ${path}(/|$)" || { echo "  FAIL: $path"; exit 1; }
done
echo "  OK"

echo; echo "[4/8] Blog post emits JSON-LD with @graph"
SLUG=$(echo "$SITEMAP" | grep -oE '<loc>[^<]+/blog/[^<]+</loc>' | head -1 | sed -E 's#</?loc>##g' || true)
if [ -z "$SLUG" ]; then
  echo "  SKIP: no blog post URLs in sitemap (fresh deploy)"
else
  HTML=$(curl -sf "$SLUG") || { echo "  FAIL"; exit 1; }
  echo "$HTML" | grep -q 'type="application/ld+json"' || { echo "  FAIL: no JSON-LD"; exit 1; }
  echo "$HTML" | grep -q '"@graph"' || { echo "  FAIL: no @graph"; exit 1; }
  echo "  OK"
fi

echo; echo "[5/8] OG image Content-Type image/*"
if [ -z "${HTML:-}" ]; then
  echo "  SKIP"
else
  OG_URL=$(echo "$HTML" | grep -oE 'property="og:image"[^>]*content="[^"]+"' | head -1 | sed -E 's/.*content="([^"]+)".*/\1/' || true)
  [ -z "$OG_URL" ] && OG_URL=$(echo "$HTML" | grep -oE 'content="[^"]+"[^>]*property="og:image"' | head -1 | sed -E 's/.*content="([^"]+)".*/\1/' || true)
  [ -z "$OG_URL" ] && { echo "  FAIL: no og:image"; exit 1; }
  case "$OG_URL" in http*) ;; /*) OG_URL="$HOST$OG_URL" ;; esac
  TYPE=$(curl -sfI -L "$OG_URL" | grep -i '^content-type:' | tr -d '\r' | tail -1)
  echo "$TYPE" | grep -qiE 'image/(png|jpeg|jpg|webp)' || { echo "  FAIL: $OG_URL → $TYPE"; exit 1; }
  echo "  OK"
fi

echo; echo "[6/8] Hreflang alternates"
if [ -z "${HTML:-}" ]; then echo "  SKIP"
else
  echo "$HTML" | grep -qE 'rel="alternate"[^>]*hreflang="(pt-BR|en|x-default)"' || { echo "  FAIL"; exit 1; }
  echo "  OK"
fi

echo; echo "[7/8] Dev subdomain robots Disallow: /"
DEV_ROBOTS=$(curl -sf "https://dev.bythiagofigueiredo.com/robots.txt" 2>/dev/null || true)
if [ -z "$DEV_ROBOTS" ]; then echo "  SKIP: unreachable"
else
  echo "$DEV_ROBOTS" | grep -qE '^Disallow: /$' || { echo "  FAIL"; exit 1; }
  echo "  OK"
fi

echo; echo "[8/8] /api/health/seo ok"
if [ "${SKIP_HEALTH:-0}" = "1" ]; then echo "  SKIP (SKIP_HEALTH=1)"
else
  [ -z "${CRON_SECRET:-}" ] && { echo "  FAIL: CRON_SECRET not set"; exit 1; }
  HEALTH=$(curl -sf -H "Authorization: Bearer $CRON_SECRET" "$HOST/api/health/seo") || { echo "  FAIL"; exit 1; }
  echo "$HEALTH" | grep -q '"ok":true' || { echo "  FAIL: $HEALTH"; exit 1; }
  echo "  OK"
fi

echo; echo "=========================================="
echo "All SEO smoke checks passed against $HOST"
echo "=========================================="
