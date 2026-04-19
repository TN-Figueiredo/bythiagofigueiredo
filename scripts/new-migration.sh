#!/bin/bash
# Creates a new migration file with the next sequential number.
# Usage: ./scripts/new-migration.sh "description_here"
#
# This prevents the "out of order" issue by always using
# a timestamp after the latest existing migration.

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: ./scripts/new-migration.sh <description>"
  echo "Example: ./scripts/new-migration.sh add_user_preferences"
  exit 1
fi

DESCRIPTION="$1"
MIGRATIONS_DIR="supabase/migrations"

# Find the latest migration number
LATEST=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort | tail -1 | sed 's|.*/||' | cut -c1-16)

if [ -z "$LATEST" ]; then
  # No migrations yet, start fresh
  NEXT="$(date +%Y%m%d)000001"
else
  # Extract date and sequence parts
  DATE_PART="${LATEST:0:8}"
  SEQ_PART="${LATEST:8:6}"
  TODAY=$(date +%Y%m%d)

  if [ "$DATE_PART" = "$TODAY" ] || [ "$DATE_PART" -ge "$TODAY" ]; then
    # Same day or future date: increment sequence
    NEXT_SEQ=$((10#$SEQ_PART + 1))
    NEXT="${DATE_PART}$(printf '%06d' $NEXT_SEQ)"
  else
    # New day: use today with sequence 1
    NEXT="${TODAY}000001"
  fi
fi

FILENAME="${NEXT}_${DESCRIPTION}.sql"
FILEPATH="${MIGRATIONS_DIR}/${FILENAME}"

cat > "$FILEPATH" << 'HEADER'
-- =============================================================================
-- MIGRATION:
-- =============================================================================

HEADER

echo "Created: $FILEPATH"
