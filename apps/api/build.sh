#!/usr/bin/env bash
set -e

echo "🔨 Building API..."
npx tsc -p tsconfig.build.json
echo "✅ Build complete"
