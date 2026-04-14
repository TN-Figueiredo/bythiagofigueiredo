#!/bin/bash
# Gera .env.local-db para API e Web a partir das keys do Supabase local.
# Uso: npm run db:env (após npm run db:start)

set -e

# Verificar se Supabase local está rodando
if ! npx supabase status &>/dev/null; then
  echo "❌ Supabase local não está rodando. Rode: npm run db:start"
  exit 1
fi

# Extrair keys do supabase status
ANON_KEY=$(npx supabase status -o env 2>/dev/null | grep ANON_KEY | cut -d'=' -f2- | tr -d '"')
SERVICE_KEY=$(npx supabase status -o env 2>/dev/null | grep SERVICE_ROLE_KEY | cut -d'=' -f2- | tr -d '"')

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_KEY" ]; then
  echo "❌ Não consegui extrair as keys. Verifique: npm run db:status"
  exit 1
fi

# API
API_ENV="apps/api/.env.local-db"
cat > "$API_ENV" << EOF
# bythiagofigueiredo API — Supabase LOCAL
# Gerado automaticamente por: npm run db:env
# Requer: npm run db:start (Docker rodando)

PORT=3333
WEB_URL=http://localhost:3001

# Supabase LOCAL
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}

# Sentry (vazio em local dev — integra no Sprint 4)
SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
EOF

# Web
WEB_ENV="apps/web/.env.local-db"
cat > "$WEB_ENV" << EOF
# bythiagofigueiredo Web — Supabase LOCAL
# Gerado automaticamente por: npm run db:env
# Requer: npm run db:start (Docker rodando)

# Supabase LOCAL
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}

# App
NEXT_PUBLIC_API_URL=http://localhost:3333
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Sentry (vazio em local dev)
SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=

# Cron
CRON_SECRET=
EOF

echo "✅ Gerado:"
echo "   $API_ENV (SUPABASE_URL=http://127.0.0.1:54321)"
echo "   $WEB_ENV (NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321)"
echo ""
echo "Para usar local DB em dev, copiar conteúdo pro .env.local correspondente."
