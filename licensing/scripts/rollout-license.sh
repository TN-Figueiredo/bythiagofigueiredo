#!/usr/bin/env bash
# scripts/rollout-license.sh — Apply proprietary LICENSE v1 to all non-private packages
# DO NOT RUN before advogado approves licensing/templates/LICENSE-v1.txt
set -euo pipefail

LICENSE_SRC="licensing/templates/LICENSE-v1.txt"
PACKAGES_DIR="packages"
LICENSE_REF="LicenseRef-Proprietary-FigueiredoTech-v1"

if [ ! -f "$LICENSE_SRC" ]; then
  echo "ERROR: $LICENSE_SRC not found. Run from repo root."
  exit 1
fi

for pkg_dir in "$PACKAGES_DIR"/*/; do
  pkg_name=$(basename "$pkg_dir")

  # Skip private workspace packages
  is_private=$(node -p "JSON.parse(require('fs').readFileSync('$pkg_dir/package.json','utf8')).private === true" 2>/dev/null || echo false)
  if [ "$is_private" = "true" ]; then
    echo "⏭  Skipping private package: $pkg_name"
    continue
  fi

  echo "🔧 Processing $pkg_name..."

  # Copy LICENSE
  cp "$LICENSE_SRC" "$pkg_dir/LICENSE"

  # Update package.json
  node -e "
    const fs = require('fs');
    const path = '$pkg_dir/package.json';
    const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
    pkg.license = '$LICENSE_REF';
    pkg.files = Array.from(new Set([...(pkg.files || []), 'LICENSE', 'README.md']));
    fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  "

  # Inject SPDX header into README if missing
  readme="$pkg_dir/README.md"
  if [ -f "$readme" ]; then
    if ! grep -q 'SPDX-License-Identifier' "$readme"; then
      header="<!-- SPDX-License-Identifier: $LICENSE_REF -->
> **⚠️ Proprietary Software.** Uso mediante autorização escrita. Ver [LICENSE](./LICENSE).

"
      printf '%s%s' "$header" "$(cat "$readme")" > "$readme.tmp"
      mv "$readme.tmp" "$readme"
    fi
  else
    printf '<!-- SPDX-License-Identifier: %s -->\n> **⚠️ Proprietary Software.**\n\n# %s\n' "$LICENSE_REF" "$pkg_name" > "$readme"
  fi
done

echo "✅ Done. Review with: git diff"
