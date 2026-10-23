#!/usr/bin/env bash
# Sobe o `next dev` da suíte do Gio (F1a-tela-2) contra o Supabase local PADRÃO (54321/54322), com credenciais FALSAS
# (runbook-cms-e2e-local: SES/NTFY falsos, chaves de teste do Turnstile), YouTube falso (3095) e Blob falso (3096).
# Uso (da pasta apps/web): bash e2e/ab-lab-f1a-tela-1-suporte/subir-dev.sh <arquivo-de-log> [porta]
set -euo pipefail
LOG="${1:?arquivo de log}"
PORTA="${2:-3094}"
set -a
# shellcheck disable=SC1091
source .env.test
# shellcheck disable=SC1091
source .env.local-db
set +a
unset NEXT_PUBLIC_SENTRY_DSN SENTRY_DSN
export NODE_ENV=test HAS_LOCAL_DB=1
export AWS_SES_ACCESS_KEY_ID=LOCALDUMMY AWS_SES_SECRET_ACCESS_KEY=localdummy NTFY_URL=http://127.0.0.1:9
export NEXT_PUBLIC_APP_URL=http://f1a.localhost:${PORTA} PLAYWRIGHT_BASE_URL=http://f1a.localhost:${PORTA}
export NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
export SOCIAL_MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
export YOUTUBE_API_KEY=falso GOOGLE_CLIENT_ID=falso GOOGLE_CLIENT_SECRET=falso
export BLOB_READ_WRITE_TOKEN=vercel_blob_rw_giostore_falso VERCEL_BLOB_API_URL=http://127.0.0.1:${BLOB_MOCK_PORT:-3096}
export YT_MOCK_URL=http://127.0.0.1:${YT_MOCK_PORT:-3095}
export NODE_OPTIONS="--require $(pwd)/e2e/ab-lab-p4a-suporte/yt-preload.cjs"
exec npx next dev --webpack -p ${PORTA} > "$LOG" 2>&1
