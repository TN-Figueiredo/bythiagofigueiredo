#!/usr/bin/env bash
# F2 · T6b: amostra de precisão do lugar (SÓ LEITURA, chave de serviço). Rode: bash scripts/f2-amostra-lugar.sh [--site <uuid>] [--alvo 60|100]
# Grava .superpowers/sdd/ab-lab/f2/amostra-lugar-<data>.csv; o controlador rotula a coluna chaves_corretas.
set -euo pipefail
cd "$(dirname "$0")/.."
exec npx tsx --tsconfig apps/web/tsconfig.json --require ./apps/web/scripts/_sem-server-only.cjs --env-file apps/web/.env.local apps/web/scripts/f2-amostra-lugar.ts "$@"
