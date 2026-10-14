#!/usr/bin/env bash
# scripts/portao-dhash.sh: portão do dHash (P4-0 do A/B Lab). caffeinate impede o Mac de dormir durante a medida.
set -euo pipefail
cd "$(dirname "$0")/.."
exec caffeinate -i -s npx tsx --tsconfig apps/web/tsconfig.json --require ./apps/web/scripts/_sem-server-only.cjs \
  --env-file "${PORTAO_ENV_FILE:-apps/web/.env.local}" apps/web/scripts/portao-dhash.ts "$@"
