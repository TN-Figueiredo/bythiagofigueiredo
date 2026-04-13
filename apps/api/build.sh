#!/usr/bin/env bash
set -e

echo "🔨 Building API..."
npx tsc -p tsconfig.build.json

# Vercel needs an outputDirectory even though the function lives in api/
mkdir -p public && echo '{}' > public/.keep

echo "✅ Build complete"
