#!/bin/bash
ref=$(cat supabase/.temp/project-ref 2>/dev/null)
if [ "$ref" = "novkqtvcnsiwhkxihurk" ]; then
  echo "[PROD] $ref"
elif [ -n "$ref" ]; then
  echo "[UNKNOWN] $ref"
else
  echo "[NÃO LINKADO] rode: npm run db:link:prod"
fi
