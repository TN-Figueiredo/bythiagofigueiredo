#!/usr/bin/env bash
# F2 · T1: mede o custo do gravador de sinais (SÓ LEITURA, chave de serviço). Rode: bash scripts/f2-medir-gravador.sh
set -euo pipefail
cd "$(dirname "$0")/.."
exec npx tsx --tsconfig apps/web/tsconfig.json --require ./apps/web/scripts/_sem-server-only.cjs --env-file apps/web/.env.local apps/web/scripts/f2-medir-gravador.ts "$@"
