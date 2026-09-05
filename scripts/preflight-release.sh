#!/usr/bin/env bash
# =============================================================================
# preflight-release.sh — verificacao antes de pushar/deployar
# =============================================================================
# Criado depois da leva de correcao das "falhas silenciosas" (2026-09-03), onde
# 25 defeitos passaram meses invisiveis porque nada checava as pre-condicoes.
#
# Roda o que da para checar sozinho e DECLARA o que exige acao humana. Nunca
# afirma que esta tudo bem sobre coisa que nao olhou — foi exatamente esse o
# defeito que originou a leva.
#
# Uso:  bash scripts/preflight-release.sh
# Saida: 0 = liberado para push  |  1 = bloqueado  |  2 = liberado com pendencia
# =============================================================================
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

RED=$'\033[31m'; GRN=$'\033[32m'; YLW=$'\033[33m'; DIM=$'\033[2m'; RST=$'\033[0m'
BLOCKERS=0
PENDING=0

ok()      { printf '  %s✓%s %s\n' "$GRN" "$RST" "$1"; }
fail()    { printf '  %s✗%s %s\n' "$RED" "$RST" "$1"; BLOCKERS=$((BLOCKERS+1)); }
pend()    { printf '  %s?%s %s\n' "$YLW" "$RST" "$1"; PENDING=$((PENDING+1)); }
section() { printf '\n%s\n' "$1"; }

# -----------------------------------------------------------------------------
section "1. Typecheck"
# -----------------------------------------------------------------------------
if (cd apps/web && npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1); then
  ok "apps/web typecheck limpo"
else
  fail "apps/web typecheck FALHOU — rode: cd apps/web && npx tsc --noEmit -p tsconfig.json"
fi

if (cd apps/api && npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1); then
  ok "apps/api typecheck limpo"
else
  fail "apps/api typecheck FALHOU"
fi

# -----------------------------------------------------------------------------
section "2. Crons: vercel.json x metodos exportados"
# -----------------------------------------------------------------------------
# O cron da Vercel dispara GET. Rota agendada que so exporta POST devolve 405 e
# nunca executa — foi assim que 8 rotas ficaram mortas sem ninguem notar.
if (cd apps/web && npx vitest run test/api/cron/vercel-get-export-guard.test.ts >/dev/null 2>&1); then
  ok "teste-guarda passou: toda rota agendada exporta GET"
else
  fail "teste-guarda FALHOU — alguma rota agendada nao exporta GET e nunca vai rodar"
fi

CRON_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('apps/web/vercel.json','utf8')).crons.length)" 2>/dev/null || echo "?")
if [ "$CRON_COUNT" = "?" ]; then
  fail "vercel.json ilegivel ou sem array de crons"
else
  pend "vercel.json declara ${CRON_COUNT} crons — confirme o teto do tier no dashboard da Vercel"
  printf '    %sSe o build recusar: consolidar rotas de baixa frequencia, nunca remover instrumentacao.%s\n' "$DIM" "$RST"
fi

# -----------------------------------------------------------------------------
section "3. Suite completa de testes"
# -----------------------------------------------------------------------------
# Medido em 2026-09-03: 1078 arquivos, 13.780 testes, 160s. Ela NAO trava —
# a crenca de que travava e obsoleta e vinha do CLAUDE.md.
printf '  %s...rodando a suite completa (~3min)%s\n' "$DIM" "$RST"
if (cd apps/web && npx vitest run --reporter=basic >/tmp/preflight-suite.log 2>&1); then
  SUITE_LINE=$(grep -E "^ *Tests " /tmp/preflight-suite.log | tail -1 | sed 's/^ *//')
  ok "suite completa passou — ${SUITE_LINE:-sem sumario}"
else
  fail "suite completa FALHOU — veja /tmp/preflight-suite.log"
  grep -E "FAIL|✗" /tmp/preflight-suite.log | head -10 | sed 's/^/      /'
fi

# -----------------------------------------------------------------------------
section "4. Migrations pendentes em producao"
# -----------------------------------------------------------------------------
# Nao da para checar daqui: supabase_migrations.schema_migrations nao e exposta
# pelo PostgREST e o script nao tem a senha do banco. Declaramos em vez de
# fingir que checamos.
LOCAL_MIGRATIONS=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
pend "${LOCAL_MIGRATIONS} migrations no repo — confirme quais estao em producao"
cat <<'SQL'
    Rode no SQL Editor do Supabase (read-only):

      select version, name from supabase_migrations.schema_migrations
      order by version desc limit 10;

    Devem aparecer, no minimo:
      20260703000001  fix_definer_search_path_btf097     (9 funcoes SECURITY DEFINER)
      20260703000002  lgpd_phase1_anonymize_password_reset_attempts
      20260703000003  purge_used_dsar_tokens
      20260903000001  pipeline_history_key_identity      (OBRIGATORIA antes do deploy)

    A ultima e bloqueante: o codigo ja grava changed_by_key_id. Sem a coluna,
    todo graduate/publish/restore lanca DB_ERROR.
SQL

# -----------------------------------------------------------------------------
section "5. Variaveis de ambiente"
# -----------------------------------------------------------------------------
check_env_local() {
  local var="$1" file="apps/web/.env.local"
  if [ -f "$file" ] && grep -q "^${var}=" "$file" 2>/dev/null; then
    ok "${var} presente em .env.local"
  else
    fail "${var} AUSENTE em .env.local"
  fi
}

check_env_local PIPELINE_MCP_HMAC_SECRET
pend "PIPELINE_MCP_HMAC_SECRET tambem precisa estar na Vercel ANTES do deploy"
printf '    %sInvertido, getHmacSecret() lanca e derruba as tools MCP. Gerar: openssl rand -hex 32%s\n' "$DIM" "$RST"

# -----------------------------------------------------------------------------
section "6. Estado do repositorio"
# -----------------------------------------------------------------------------
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "main" ]; then
  fail "voce esta em main — o fluxo do projeto e staging -> main"
else
  ok "branch: ${BRANCH}"
fi

if [ -z "$(git status --porcelain)" ]; then
  ok "worktree limpo"
else
  pend "worktree tem mudancas nao commitadas:"
  git status --short | sed 's/^/      /'
fi

AHEAD=$(git rev-list --count "@{upstream}..HEAD" 2>/dev/null || echo "?")
[ "$AHEAD" != "?" ] && ok "${AHEAD} commit(s) a frente do remoto"

# -----------------------------------------------------------------------------
section "7. Depois do deploy — o que so da para verificar la"
# -----------------------------------------------------------------------------
cat <<'POST'
    A saude do sistema so e observavel depois que o deploy subir:

      curl -s -H "Authorization: Bearer $CRON_SECRET" \
        https://bythiagofigueiredo.com/api/health | jq '.status, .unknownCount'

    E o sync de analytics, que alimenta 4 dos 6 eixos do score:

      curl -s -H "Authorization: Bearer $CRON_SECRET" \
        https://bythiagofigueiredo.com/api/cron/sync-analytics-metrics | jq

    Depois confirme que a tabela saiu de zero:

      select count(*) from youtube_video_analytics;

    E em 24h, que os crons ressuscitados registraram execucao:

      select cron_name, last_success_at from cron_health order by last_success_at;
POST

# -----------------------------------------------------------------------------
printf '\n%s\n' "-----------------------------------------------------------"
if [ "$BLOCKERS" -gt 0 ]; then
  printf '%sBLOQUEADO%s — %d verificacao(oes) falharam.\n' "$RED" "$RST" "$BLOCKERS"
  exit 1
elif [ "$PENDING" -gt 0 ]; then
  printf '%sLIBERADO COM PENDENCIA%s — %d item(ns) exigem confirmacao humana.\n' "$YLW" "$RST" "$PENDING"
  printf 'Nenhum bloqueio automatico. Os itens acima nao podem ser checados daqui.\n'
  exit 2
else
  printf '%sLIBERADO%s\n' "$GRN" "$RST"
  exit 0
fi
