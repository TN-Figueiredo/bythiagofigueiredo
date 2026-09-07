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
#   # Optional second channel, used ONLY when the ntfy delivery above fails.
#   # MUST NOT point at ntfy.sh nor at the same host as NTFY_URL — use a
#   # DIFFERENT PROVIDER (Telegram bot, Pushover, Gotify, your own webhook).
#   # A second ntfy.sh topic survives a refusal but NOT an ntfy.sh outage,
#   # which is half the reason this variable exists.
#   # WATCHDOG_FALLBACK_URL=https://api.telegram.org/bot<token>/sendMessage?chat_id=<id>&text=
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

# Marcador de versão: o runbook compara este valor com o de
# /opt/cron-watchdog/check.sh. Antes de C2 não havia NENHUMA checagem de que o
# arquivo do repo e o que roda no home-lab eram o mesmo.
CHECK_SH_VERSION="c2-2026-09-06"
echo "cron-watchdog: CHECK_SH_VERSION=${CHECK_SH_VERSION}"

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
  # Portable empty-array expansion under `set -u` (bash 3.2 e bash 5.x).
  if curl -fsS --max-time "$TIMEOUT_SECONDS" \
    "${auth_args[@]+"${auth_args[@]}"}" \
    -H "Title: ${title}" \
    -H "Priority: ${priority}" \
    -H "Tags: warning" \
    -d "${message} [${CHECK_SH_VERSION}]" \
    "$NTFY_URL" >/dev/null; then
    return 0
  fi
  echo "cron-watchdog: failed to deliver ntfy alert" >&2
  # Segundo canal, fora do ntfy.sh. `${VAR:-}` e nunca `${VAR:?}`: a ausência
  # do fallback não pode derrubar o watchdog.
  if [ -n "${WATCHDOG_FALLBACK_URL:-}" ]; then
    curl -fsS --max-time "$TIMEOUT_SECONDS" \
      --data-urlencode "text=${title}: ${message} [${CHECK_SH_VERSION}]" \
      "${WATCHDOG_FALLBACK_URL}" >/dev/null \
      || echo "cron-watchdog: fallback delivery also failed" >&2
  fi
  return 1
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

# Status HTTP inesperado (502/503 da borda, 404 de rota removida): o endpoint
# respondeu, mas não com algo que se possa interpretar.
if [ "$http_code" != "200" ] && [ "$http_code" != "503" ]; then
  send_alert "urgent" "cron-watchdog: /api/health HTTP ${http_code}" \
    "Endpoint answered with an unexpected status. Check the Vercel deployment."
  echo "http_${http_code}" > "$STATE_FILE"
  echo 0 > "$COUNT_FILE"
  exit 1
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
  : > "$STATE_DIR/late_names"
  exit 0
fi

# --- status == degraded | down ----------------------------------------------
# MUST: o conjunto persistido é `select(.status == "late")`, NUNCA o filtro
# "qualquer coisa que não seja ok" usado antes de C2 — `unknown` é o estado de
# todo cron recém-implantado até o primeiro run, e paginar nele reabre o
# alarme-desde-o-dia-1 que health/route.ts:295-306 argumenta contra. `unknown`
# continua ROTULADO (linha abaixo), só não entra no cálculo de "novo".
late_names="$(jq -r '[.crons[]? | select(.status == "late") | .name] | join(", ")' "$body_file" 2>/dev/null || echo "?")"
unknown_names="$(jq -r '(.unknownNames // []) | join(", ")' "$body_file" 2>/dev/null || echo "")"
message="late: ${late_names:-none} · unknown: ${unknown_names:-none}"
priority="high"
[ "$status" = "down" ] && priority="urgent"

LATE_FILE="$STATE_DIR/late_names"
new_names=""
if [ -f "$LATE_FILE" ]; then
  for name in $(echo "$late_names" | tr ',' ' '); do
    [ -z "$name" ] && continue
    grep -qxF "$name" "$LATE_FILE" || new_names="${new_names}${name} "
  done
else
  # PRIMEIRO RUN após C2: o arquivo não existe e TODO nome é "novo". Semear em
  # silêncio e só alertar a partir da execução seguinte.
  new_names=""
fi
echo "$late_names" | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep -v '^$' > "$LATE_FILE" || true

if [ -n "$new_names" ]; then
  # Alerta IMEDIATO, com título próprio, independentemente de
  # REALERT_EVERY_N_RUNS: durante um episódio de canal (que a spec estaciona em
  # `degraded` de propósito, possivelmente por dias) um cron novo caindo virava
  # só uma string mais longa no mesmo alerta de sempre.
  send_alert "$priority" "cron-watchdog: new cron failing" "new: ${new_names}· ${message}"
  echo 0 > "$COUNT_FILE"
elif [ "$previous_status" != "$status" ]; then
  send_alert "$priority" "cron-watchdog: status=${status}" "$message"
  echo 0 > "$COUNT_FILE"
else
  count="$(cat "$COUNT_FILE" 2>/dev/null || echo 0)"
  count=$((count + 1))
  if [ "$count" -ge "$REALERT_EVERY_N_RUNS" ]; then
    send_alert "$priority" "cron-watchdog: still ${status}" "$message"
    count=0
  fi
  echo "$count" > "$COUNT_FILE"
fi

echo "$status" > "$STATE_FILE"
# MUST: exit 1 quando não-ok — segundo sinal para o systemd (o unit é oneshot e
# propaga o código) e para o `journalctl` do runbook.
exit 1
