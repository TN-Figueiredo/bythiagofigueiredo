#!/bin/bash
echo ""
echo "⚠️  PROD [novkqtvcnsiwhkxihurk] — tem certeza?"
read -p "Digite YES para confirmar: " c
if [ "$c" = "YES" ]; then
  npx supabase db push
else
  echo "Cancelado."
  exit 1
fi
