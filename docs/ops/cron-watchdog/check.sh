#!/usr/bin/env bash
#
# cron-watchdog/check.sh — dead-man-switch for GET /api/health, run from a
# home-lab machine (the "forja") that has no public IP and only outbound
# HTTPS. Part of WP-H (docs/superpowers/plans/2026-09-02-falhas-silenciosas.md).
#
# Why this exists: the repo owner lives outside the country for 1+ year and
# will not be reading Vercel logs or Sentry. GET /api/health tells us which
# scheduled crons are ok/degraded/down/unknown — but that endpoint is only
# useful if SOMETHING outside Vercel calls it and screams when it doesn't
# answer "ok". That's this script.
#
# The case that matters most is NOT "status != ok" — it's the endpoint not
# responding at all, because that's what happens when the whole Vercel
# deployment is down (the exact failure mode cron_health can't see, since
# nothing can write to it). Both cases are handled below.
#
# ---------------------------------------------------------------------------
# Install (on the home-lab machine, as root):
#
#   sudo useradd --system --no-create-home --shell /usr/sbin/nologin cron-watchdog
#   sudo mkdir -p /opt/cron-watchdog /etc/cron-watchdog
#   sudo cp check.sh /opt/cron-watchdog/check.sh
#   sudo chmod 755 /opt/cron-watchdog/check.sh
#   sudo chown cron-watchdog:cron-watchdog /opt/cron-watchdog/check.sh
#
#   sudo tee /etc/cron-watchdog/watchdog.env <<'EOF'
#   HEALTH_URL=https://bythiagofigueiredo.com/api/health
#   CRON_SECRET=<same value as CRON_SECRET in apps/web/.env / Vercel prod>
#   NTFY_URL=https://ntfy.sh/<pick-a-private-unguessable-topic-name>
#   # Optional, only if self-hosting ntfy behind auth:
#   # NTFY_AUTH_TOKEN=tk_xxxxx
#   EOF
#   sudo chmod 600 /etc/cron-watchdog/watchdog.env
#   sudo chown cron-watchdog:cron-watchdog /etc/cron-watchdog/watchdog.env
#
#   sudo cp cron-watchdog.service cron-watchdog.timer /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now cron-watchdog.timer
#
#   # Validate immediately (see plan gate — a dead-man switch that never
#   # fired is not validated):
#   sudo systemctl start cron-watchdog.service
#   journalctl -u cron-watchdog -n 20 --no-pager
#
# No new listening port is opened anywhere — this script only makes
# outbound HTTPS requests (curl). Ports already in use on the forja (22,
# 443, 1883, 1884, 3003, 5000, 8080-8082, 8090, 8443-8445, 8554, 8555, 8971,
# 41543) are irrelevant here.
# ---------------------------------------------------------------------------

set -euo pipefail

command -v curl >/dev/null 2>&1 || { echo "cron-watchdog: curl not found" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "cron-watchdog: jq not found" >&2; exit 1; }

: "${HEALTH_URL:?HEALTH_URL not set — see header of this script for /etc/cron-watchdog/watchdog.env}"
: "${CRON_SECRET:?CRON_SECRET not set}"
: "${NTFY_URL:?NTFY_URL not set}"

TIMEOUT_SECONDS="${WATCHDOG_TIMEOUT_SECONDS:-15}"
# How many consecutive 10-minute runs of the SAME non-ok status to wait
# before re-sending an alert. Keeps a real, ongoing outage from paging every
# 10 minutes while guaranteeing it's re-surfaced periodically (default: 6
# runs ≈ 1h) instead of going silent until it's fixed.
REALERT_EVERY_N_RUNS="${WATCHDOG_REALERT_EVERY_N_RUNS:-6}"

# systemd sets STATE_DIRECTORY when the unit declares StateDirectory=
# (see cron-watchdog.service). Falls back to a fixed path for manual runs.
STATE_DIR="${STATE_DIRECTORY:-/var/lib/cron-watchdog}"
mkdir -p "$STATE_DIR" 2>/dev/null || true
STATE_FILE="$STATE_DIR/last_status"
COUNT_FILE="$STATE_DIR/run_count_since_alert"

body_file="$(mktemp)"
err_file="$(mktemp)"
trap 'rm -f "$body_file" "$err_file"' EXIT

send_alert() {
  # $1 = ntfy priority (min|low|default|high|urgent), $2 = title, $3 = message
  local priority="$1" title="$2" message="$3"
  local auth_args=()
  if [ -n "${NTFY_AUTH_TOKEN:-}" ]; then
    auth_args=(-H "Authorization: Bearer ${NTFY_AUTH_TOKEN}")
  fi
  # Portable empty-array expansion under `set -u` (bash 3.2, as shipped on
  # macOS, errors on a plain "${arr[@]}" when arr is empty — this idiom
  # works on both bash 3.2 and the bash 5.x that ships with Ubuntu 24.04).
  curl -sS --max-time "$TIMEOUT_SECONDS" \
    "${auth_args[@]+"${auth_args[@]}"}" \
    -H "Title: ${title}" \
    -H "Priority: ${priority}" \
    -H "Tags: warning" \
    -d "$message" \
    "$NTFY_URL" >/dev/null || echo "cron-watchdog: failed to deliver ntfy alert" >&2
}

previous_status="$(cat "$STATE_FILE" 2>/dev/null || echo "")"

# --- Call GET /api/health --------------------------------------------------
http_code=""
if ! http_code=$(curl -sS --max-time "$TIMEOUT_SECONDS" \
  -o "$body_file" -w '%{http_code}' \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "$HEALTH_URL" 2>"$err_file"); then
  # curl itself failed — DNS, TLS, connection refused, timeout. The endpoint
  # did not answer at all. THIS is the case that matters most: it's what a
  # dead Vercel deployment looks like, and no cron_health row can catch it.
  curl_err="$(cat "$err_file" 2>/dev/null || echo 'unknown curl error')"
  send_alert "urgent" "cron-watchdog: /api/health UNREACHABLE" \
    "curl failed against ${HEALTH_URL}: ${curl_err}"
  echo "unreachable" > "$STATE_FILE"
  echo 0 > "$COUNT_FILE"
  exit 0
fi

if [ "$http_code" = "401" ]; then
  send_alert "urgent" "cron-watchdog: /api/health returned 401" \
    "Endpoint is up but rejected our CRON_SECRET — check /etc/cron-watchdog/watchdog.env against the value in Vercel prod."
  echo "auth_error" > "$STATE_FILE"
  echo 0 > "$COUNT_FILE"
  exit 0
fi

status="$(jq -r '.status // empty' "$body_file" 2>/dev/null || true)"
if [ -z "$status" ]; then
  body_snippet="$(head -c 300 "$body_file" 2>/dev/null || echo '<unreadable>')"
  send_alert "urgent" "cron-watchdog: /api/health returned unexpected body" \
    "HTTP ${http_code}. Body did not parse as expected JSON: ${body_snippet}"
  echo "parse_error" > "$STATE_FILE"
  echo 0 > "$COUNT_FILE"
  exit 0
fi

# --- status == ok -----------------------------------------------------------
if [ "$status" = "ok" ]; then
  if [ -n "$previous_status" ] && [ "$previous_status" != "ok" ]; then
    send_alert "default" "cron-watchdog: recovered" \
      "GET /api/health is back to status=ok (was: ${previous_status})."
  fi
  echo "ok" > "$STATE_FILE"
  echo 0 > "$COUNT_FILE"
  exit 0
fi

# --- status == degraded | down ----------------------------------------------
late_names="$(jq -r '[.crons[]? | select(.status != "ok") | .name] | join(", ")' "$body_file" 2>/dev/null || echo "?")"
priority="high"
[ "$status" = "down" ] && priority="urgent"

if [ "$previous_status" != "$status" ]; then
  # Status just changed (e.g. ok -> degraded, or degraded -> down) — always
  # alert immediately on a transition.
  send_alert "$priority" "cron-watchdog: status=${status}" "Crons not ok: ${late_names}"
  echo 0 > "$COUNT_FILE"
else
  count="$(cat "$COUNT_FILE" 2>/dev/null || echo 0)"
  count=$((count + 1))
  if [ "$count" -ge "$REALERT_EVERY_N_RUNS" ]; then
    send_alert "$priority" "cron-watchdog: still ${status}" "Crons not ok: ${late_names}"
    count=0
  fi
  echo "$count" > "$COUNT_FILE"
fi

echo "$status" > "$STATE_FILE"
exit 0
