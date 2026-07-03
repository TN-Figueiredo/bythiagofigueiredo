#!/usr/bin/env bash
# BTF-059 / BTF-083 — type-debt ratchet.
# Conta ocorrências de `as unknown as` em TODO o código-fonte de primeira parte
# (apps/web/src, apps/web/lib, apps/api/src, packages/*/src) e falha se a contagem
# SUBIR além do baseline (scripts/type-debt-baseline.txt). A dívida só pode
# descer: ao remover casts, atualize o baseline no MESMO commit:
#   bash scripts/check-type-debt.sh --update
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASELINE_FILE="$ROOT/scripts/type-debt-baseline.txt"
PATTERN='as unknown as'

# Diretórios de código-fonte de primeira parte cobertos pelo ratchet.
# `packages/*/src` é expandido via glob (cada package publica de src/).
TARGET_DIRS=(
  "$ROOT/apps/web/src"
  "$ROOT/apps/web/lib"
  "$ROOT/apps/api/src"
)
for pkg_src in "$ROOT"/packages/*/src; do
  [[ -d "$pkg_src" ]] && TARGET_DIRS+=("$pkg_src")
done

count=0
for dir in "${TARGET_DIRS[@]}"; do
  [[ -d "$dir" ]] || continue
  # grep exits 1 quando não há match — não deixe o `set -e` matar o loop.
  n="$( { grep -roh "$PATTERN" "$dir" --include='*.ts' --include='*.tsx' --exclude='*.test.ts' --exclude='*.test.tsx' --exclude='*.spec.ts' --exclude='*.spec.tsx' || true; } | wc -l | tr -d '[:space:]')"
  count=$(( count + n ))
done

SCOPE_LABEL='apps/web/src + apps/web/lib + apps/api/src + packages/*/src'

if [[ "${1:-}" == "--update" ]]; then
  echo "$count" > "$BASELINE_FILE"
  echo "✅ Baseline atualizado: $count ocorrências de '$PATTERN' em $SCOPE_LABEL."
  exit 0
fi

if [[ ! -f "$BASELINE_FILE" ]]; then
  echo "❌ Baseline não encontrado: $BASELINE_FILE"
  echo "   Rode: bash scripts/check-type-debt.sh --update"
  exit 1
fi

baseline="$(tr -d '[:space:]' < "$BASELINE_FILE")"

if (( count > baseline )); then
  echo "❌ Type debt aumentou: $count ocorrências de '$PATTERN' em $SCOPE_LABEL (baseline: $baseline)."
  echo "   Não adicione novos 'as unknown as' — use TypedClient (lib/supabase/typed.ts) ou tipos gerados (@/types/database.types)."
  exit 1
fi

if (( count < baseline )); then
  echo "🎉 Type debt caiu: $count < baseline $baseline. Atualize o ratchet no mesmo commit:"
  echo "   bash scripts/check-type-debt.sh --update"
  exit 1
fi

echo "✅ Type debt estável: $count ocorrências de '$PATTERN' em $SCOPE_LABEL (baseline: $baseline)."
