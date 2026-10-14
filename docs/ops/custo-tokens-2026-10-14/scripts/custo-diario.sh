#!/bin/bash
# Roda diariamente (launchd 23:30): mede 24 h; a partir de 21/10 gera a avaliação uma vez.
PY=/usr/bin/python3
[ -x "$PY" ] || PY=$(command -v python3)
S="$HOME/.claude/hooks/custo-aceite.py"
D="$HOME/Workspace/handoff/custo"
mkdir -p "$D"
"$PY" -I "$S" diario
HOJE=$(date +%Y-%m-%d)
if [[ "$HOJE" > "2026-10-20" ]]; then
  if ! ls "$D"/*-avaliacao.md >/dev/null 2>&1; then
    ARQ=$("$PY" -I "$S" relatorio --base "$D/base-2026-10-14.json" --desde 2026-10-14T11:00 | tail -1)
    osascript -e "display notification \"Avaliação de custo pronta: $ARQ\" with title \"Custo do Claude Code\""
  fi
fi
