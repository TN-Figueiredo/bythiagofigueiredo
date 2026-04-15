#!/bin/bash
# Bypass Supabase CLI parser bug by applying remaining migrations via psql.
# Each migration is applied in its own transaction; on success, the row is
# inserted into supabase_migrations.schema_migrations so future `supabase db push`
# sees it as applied.

set -euo pipefail

PROJECT_REF="novkqtvcnsiwhkxihurk"

echo "Get the Postgres connection string from:"
echo "  https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database"
echo "  → Section 'Connection string' → 'URI' (Session mode, port 5432)"
echo "  Replace [YOUR-PASSWORD] with the DB password."
echo ""
read -r -p "Paste full connection URI (postgres://...): " DB_URL

if [[ -z "$DB_URL" ]]; then
  echo "No URL; aborting."
  exit 1
fi

# Migrations remaining after what prod already has
REMAINING=(
  20260416000008_epic2_review_fixes
  20260416000009_epic2_hardening
  20260416000010_epic2_polish
  20260416000011_user_exists_rpc
  20260416000012_forgot_password_rate_limit
  20260416000013_resend_cooldown
  20260416000014_contact_rate_limit_and_cron_locks
  20260416000016_update_campaign_atomic
  20260416000017_campaign_status_guards
  20260416000019_consolidated_grants
)

for m in "${REMAINING[@]}"; do
  FILE="supabase/migrations/${m}.sql"
  VERSION="${m%%_*}"
  NAME="${m#*_}"
  echo ""
  echo "→ Applying $FILE"
  # Run migration in one transaction; abort on error.
  psql "$DB_URL" -v ON_ERROR_STOP=1 -1 -f "$FILE"
  # Mark as applied.
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c \
    "insert into supabase_migrations.schema_migrations (version, name) values ('${VERSION}', '${NAME}') on conflict do nothing;"
  echo "  ✓ marked as applied"
done

echo ""
echo "✅ All remaining migrations applied. Verify with: supabase migration list --linked"
