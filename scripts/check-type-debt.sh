#!/usr/bin/env bash
# BTF-059 — type-debt ratchet.
# Conta ocorrências de `as unknown as` em apps/web/src e falha se a contagem
# SUBIR além do baseline (scripts/type-debt-baseline.txt). A dívida só pode
# descer: ao remover casts, atualize o baseline no MESMO commit:
#   bash scripts/check-type-debt.sh --update
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASELINE_FILE="$ROOT/scripts/type-debt-baseline.txt"
TARGET_DIR="$ROOT/apps/web/src"
PATTERN='as unknown as'

count="$(grep -roh "$PATTERN" "$TARGET_DIR" --include='*.ts' --include='*.tsx' | wc -l | tr -d '[:space:]')"

if [[ "${1:-}" == "--update" ]]; then
  echo "$count" > "$BASELINE_FILE"
  echo "✅ Baseline atualizado: $count ocorrências de '$PATTERN' em apps/web/src."
  exit 0
fi

if [[ ! -f "$BASELINE_FILE" ]]; then
  echo "❌ Baseline não encontrado: $BASELINE_FILE"
  echo "   Rode: bash scripts/check-type-debt.sh --update"
  exit 1
fi

baseline="$(tr -d '[:space:]' < "$BASELINE_FILE")"

if (( count > baseline )); then
  echo "❌ Type debt aumentou: $count ocorrências de '$PATTERN' em apps/web/src (baseline: $baseline)."
  echo "   Não adicione novos 'as unknown as' — use TypedClient (lib/supabase/typed.ts) ou tipos gerados (@/types/database.types)."
  exit 1
fi

if (( count < baseline )); then
  echo "🎉 Type debt caiu: $count < baseline $baseline. Atualize o ratchet no mesmo commit:"
  echo "   bash scripts/check-type-debt.sh --update"
  exit 1
fi

echo "✅ Type debt estável: $count ocorrências de '$PATTERN' (baseline: $baseline)."
