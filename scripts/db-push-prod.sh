#!/bin/bash
# Push pending migrations to PROD via psql (bypasses Supabase CLI 2.90 parser bug
# which conflates dollar-quoted function bodies with subsequent statements and sends
# multi-statement text through Extended Query Protocol — rejected with SQLSTATE 42601).
#
# psql uses Simple Query Protocol for -f, which accepts multi-statement files.
# This script keeps supabase_migrations.schema_migrations in sync so `supabase
# migration list --linked` still works.

set -euo pipefail

PROJECT_REF="novkqtvcnsiwhkxihurk"
URL_CACHE="$HOME/.supabase-bythiagofigueiredo-prod-db-url"

echo ""
echo "⚠️  PROD [$PROJECT_REF] — tem certeza?"
read -r -p "Digite YES para confirmar: " c
if [ "$c" != "YES" ]; then
  echo "Cancelado."
  exit 1
fi

# Resolve DB URL (env var → cache file → prompt)
DB_URL="${SUPABASE_DB_URL:-}"
if [ -z "$DB_URL" ] && [ -f "$URL_CACHE" ]; then
  DB_URL="$(cat "$URL_CACHE")"
fi
if [ -z "$DB_URL" ]; then
  echo ""
  echo "DB URL não cacheada. Pega em:"
  echo "  https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database"
  echo "  → Connection string → URI (Session mode, porta 5432)"
  echo "  → Substitui [YOUR-PASSWORD] pela senha do banco"
  echo ""
  read -r -p "Cola o URI completo: " DB_URL
  if [ -z "$DB_URL" ]; then
    echo "URL vazia; abortando."
    exit 1
  fi
  umask 077
  printf '%s\n' "$DB_URL" > "$URL_CACHE"
  chmod 600 "$URL_CACHE"
  echo "URL cacheada em $URL_CACHE (permissão 600)."
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "❌ psql não encontrado. Instala com: brew install libpq && brew link --force libpq"
  exit 1
fi

if ! psql "$DB_URL" -Atc 'select 1' >/dev/null 2>&1; then
  echo "❌ Falha na conexão. Verifica senha e URL."
  echo "   Deleta $URL_CACHE e roda de novo pra re-prompt."
  exit 1
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
SQL

APPLIED="$(psql "$DB_URL" -Atc 'select version from supabase_migrations.schema_migrations')"

PENDING_COUNT=0
for f in supabase/migrations/*.sql; do
  base="$(basename "$f" .sql)"
  [ "$base" = ".gitkeep" ] && continue
  if [[ ! "$base" =~ ^([0-9]{14})_(.+)$ ]]; then continue; fi
  version="${BASH_REMATCH[1]}"
  if echo "$APPLIED" | grep -qx "$version"; then continue; fi
  PENDING_COUNT=$((PENDING_COUNT + 1))
done

if [ "$PENDING_COUNT" -eq 0 ]; then
  echo ""
  echo "✅ Nenhuma migration pendente."
  exit 0
fi

echo ""
echo "Aplicando $PENDING_COUNT migration(s) pendente(s) via psql..."

for f in supabase/migrations/*.sql; do
  base="$(basename "$f" .sql)"
  [ "$base" = ".gitkeep" ] && continue
  if [[ ! "$base" =~ ^([0-9]{14})_(.+)$ ]]; then continue; fi
  version="${BASH_REMATCH[1]}"
  name="${BASH_REMATCH[2]}"
  if echo "$APPLIED" | grep -qx "$version"; then continue; fi
  echo ""
  echo "→ $base"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -1 -f "$f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 \
    -c "insert into supabase_migrations.schema_migrations (version, name, statements) values ('${version}', '${name}', array[]::text[]) on conflict do nothing;" >/dev/null
  echo "  ✓ aplicada e registrada"
done

echo ""
echo "✅ Todas as migrations aplicadas."
echo "   Verifica: supabase migration list --linked"
