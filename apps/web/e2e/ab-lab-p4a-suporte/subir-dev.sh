#!/usr/bin/env bash
# Sobe o `next dev` (porta 3097 por padrão; a 3099 é de outras trilhas) para a suíte e2e do A/B Lab P4a, contra o Supabase local PADRÃO (54321/54322),
# com credenciais FALSAS (SES, Social, YouTube) e o desvio de fetch para o YouTube falso (porta 3098).
# Uso (da pasta apps/web): bash e2e/ab-lab-p4a-suporte/subir-dev.sh <arquivo-de-log> [porta]
set -euo pipefail
LOG="${1:?arquivo de log}"
PORTA="${2:-3097}"
set -a
# shellcheck disable=SC1091
source .env.test
# shellcheck disable=SC1091
source .env.local-db
set +a
unset NEXT_PUBLIC_SENTRY_DSN SENTRY_DSN
export NODE_ENV=test HAS_LOCAL_DB=1
export AWS_SES_ACCESS_KEY_ID=LOCALDUMMY AWS_SES_SECRET_ACCESS_KEY=localdummy NTFY_URL=http://127.0.0.1:9
export NEXT_PUBLIC_APP_URL=http://localhost:${PORTA} PLAYWRIGHT_BASE_URL=http://localhost:${PORTA}
export NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
export SOCIAL_MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
export YOUTUBE_API_KEY=falso BLOB_READ_WRITE_TOKEN=falso GOOGLE_CLIENT_ID=falso GOOGLE_CLIENT_SECRET=falso
export YT_MOCK_URL=http://127.0.0.1:3098
export NODE_OPTIONS="--require $(pwd)/e2e/ab-lab-p4a-suporte/yt-preload.cjs"
exec npx next dev -p ${PORTA} > "$LOG" 2>&1
