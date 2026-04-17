#!/usr/bin/env bash
# scripts/check-license.sh — CI guard: ensure all non-private packages have correct proprietary LICENSE
set -euo pipefail

REQUIRED_LICENSE="LicenseRef-Proprietary-FigueiredoTech-v1"
LICENSE_CANONICAL="licensing/templates/LICENSE-v1.txt"
EXIT=0

if [ ! -f "$LICENSE_CANONICAL" ]; then
  echo "❌ Canonical LICENSE not found: $LICENSE_CANONICAL"
  exit 1
fi

expected_hash=$(shasum -a 256 "$LICENSE_CANONICAL" | awk '{print $1}')

for pkg_dir in packages/*/; do
  pkg_name=$(basename "$pkg_dir")

  is_private=$(node -p "JSON.parse(require('fs').readFileSync('$pkg_dir/package.json','utf8')).private === true" 2>/dev/null || echo false)
  if [ "$is_private" = "true" ]; then continue; fi

  if [ ! -f "$pkg_dir/LICENSE" ]; then
    echo "❌ $pkg_name: missing LICENSE file"
    EXIT=1
    continue
  fi

  actual_license=$(node -p "JSON.parse(require('fs').readFileSync('$pkg_dir/package.json','utf8')).license" 2>/dev/null)
  if [ "$actual_license" != "$REQUIRED_LICENSE" ]; then
    echo "❌ $pkg_name: license='$actual_license' (expected '$REQUIRED_LICENSE')"
    EXIT=1
  fi

  actual_hash=$(shasum -a 256 "$pkg_dir/LICENSE" | awk '{print $1}')
  if [ "$expected_hash" != "$actual_hash" ]; then
    echo "❌ $pkg_name: LICENSE drift (hash mismatch vs canonical)"
    EXIT=1
  fi

  has_license_in_files=$(node -p "JSON.parse(require('fs').readFileSync('$pkg_dir/package.json','utf8')).files?.includes('LICENSE')" 2>/dev/null)
  if [ "$has_license_in_files" != "true" ]; then
    echo "❌ $pkg_name: package.json 'files' must include 'LICENSE'"
    EXIT=1
  fi
done

if [ $EXIT -eq 0 ]; then
  echo "✅ All non-private packages have correct proprietary LICENSE v1"
fi
exit $EXIT
