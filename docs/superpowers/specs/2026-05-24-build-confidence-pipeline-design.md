# Build Confidence Pipeline — Design Spec

## Problem Statement

We repeatedly experience CI/deploy failures because:
1. Workspace packages (`packages/links`, `packages/social`, `packages/links-admin`) export from `./dist/` but `dist/` is globally gitignored
2. CI and local tooling (`tsc --noEmit`) resolve types via `./dist/index.d.ts` — if dist is stale or missing, builds fail
3. No mechanism detects undeclared dependencies (e.g., importing `@tn-figueiredo/links` without declaring it in `package.json`)
4. After `git pull`, dist becomes stale relative to new source — nothing auto-rebuilds
5. Each wasted push triggers 4 Vercel builds (web + API × staging + preview)

## Goal

Zero CI failures caused by stale workspace package builds, missing declarations, or ecosystem drift. Every gate is automated — no human checklist required.

## Architecture

8 components forming layered gates:

```
┌─────────────────────────────────────────────────────────────────┐
│                  Single Source of Truth                           │
│              package.json → "build:packages"                     │
│   npm run build -w packages/links -w packages/links-admin        │
│                       -w packages/social                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────────┐
         │                      │                           │
┌────────▼────────┐  ┌─────────▼─────────┐  ┌─────────────▼─────────────┐
│  Pre-commit      │  │   Post-merge       │  │      Pre-push              │
│  (gate: commit)  │  │   (auto-repair)    │  │      (gate: push)          │
│                  │  │                    │  │                            │
│ 1. build:packages│  │ if pkg/src changed │  │ 1. build:packages          │
│ 2. vitest (web)  │  │ → rebuild silently │  │ 2. ecosystem pinning       │
│ 3. next build    │  │                    │  │ 3. validate-ecosystem.mjs  │
│ 4. vitest (api)  │  └────────────────────┘  │ 4. tsc --noEmit (web)      │
│ 5. tsc (api)     │                          │ 5. tsc --noEmit (api)      │
└──────────────────┘                          └─────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────────────────┐
│                 CI (.github/workflows/ci.yml)                     │
│   npm ci → postinstall → build:packages (automatic)              │
│   Same script, zero drift                                        │
└──────────────────────────────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────────────────┐
│            Validation Test (build-confidence.test.ts)             │
│   Structural: verifies pipeline wiring is complete               │
└──────────────────────────────────────────────────────────────────┘
```

## Components

### 1. `build:packages` Script (root package.json)

Single source of truth for which workspace packages need building.

```json
{
  "build:packages": "npm run build -w packages/links -w packages/links-admin -w packages/social"
}
```

**Adding a new package:** Edit this one line. The validation test will catch it if you forget (blocks commit).

**Exception:** `packages/shared` (`@app/shared`) is excluded because:
- Uses `NodeNext` moduleResolution requiring `.js` extensions in imports
- Consumed via `transpilePackages` in next.config.ts (no dist/ needed)
- Its build script (`tsc -p tsconfig.json`) fails in the workspace build context

### 2. `postinstall` Script (root package.json)

```json
{
  "postinstall": "npm run build:packages"
}
```

Ensures `npm ci` and `npm install` always produce a ready-to-use workspace. Fresh clones, CI runners, and new branch checkouts all get working dist/ automatically.

If a package has a build error, `npm install` fails immediately — correct behavior. Broken source should not silently produce a broken workspace.

### 3. Pre-commit Hook Enhancement

Added at the TOP of `.husky/pre-commit`, before existing test/build steps:

```bash
echo "📦 Building workspace packages..."
npm run build:packages 2>&1
PKG_EXIT=$?
if [ $PKG_EXIT -ne 0 ]; then
  echo ""
  echo "❌ Workspace package build failed. Commit blocked."
  exit 1
fi
```

**Always builds** (not conditionally based on staged files) because:
- Multi-terminal workflow means another terminal may have committed source changes
- 5-8s cost is acceptable for guaranteed correctness
- Simpler code, fewer edge cases

### 4. Pre-push Hook (NEW — `.husky/pre-push`)

Full ecosystem validation before push. This is the "suspenders" — catches anything that slipped past pre-commit due to multi-terminal interactions.

```bash
#!/usr/bin/env sh

echo "🛡️  Pre-push ecosystem validation..."

# 1. Fresh workspace package rebuild
echo "📦 Rebuilding workspace packages..."
npm run build:packages 2>&1
if [ $? -ne 0 ]; then
  echo "❌ Package build failed. Push blocked."
  exit 1
fi

# 2. Ecosystem pinning (no ^ or ~ on @tn-figueiredo/*)
if grep -r '"@tn-figueiredo/' apps/ packages/ --include="package.json" | grep -E '"\^|"~'; then
  echo "❌ Unpinned @tn-figueiredo/* packages found. Push blocked."
  exit 1
fi

# 3. Import-to-declaration consistency
node scripts/validate-ecosystem.mjs
if [ $? -ne 0 ]; then
  exit 1
fi

# 4. Typecheck both apps with fresh dist/
echo "🔍 Typechecking apps/web..."
cd apps/web && npx tsc --noEmit 2>&1
WEB_TC=$?
cd ../..
if [ $WEB_TC -ne 0 ]; then
  echo "❌ apps/web typecheck failed. Push blocked."
  exit 1
fi

echo "🔍 Typechecking apps/api..."
cd apps/api && npx tsc --noEmit 2>&1
API_TC=$?
cd ../..
if [ $API_TC -ne 0 ]; then
  echo "❌ apps/api typecheck failed. Push blocked."
  exit 1
fi

echo "✅ Ecosystem validated — push safe."
```

**Cost:** ~45-60s per push. Justified because:
- Pushes are rare (budget-conscious: push once, verified)
- Each failed push wastes 4 Vercel builds
- Multi-terminal means pre-commit alone isn't sufficient guarantee

### 5. Post-merge Hook (NEW — `.husky/post-merge`)

Auto-rebuilds workspace packages after `git pull` or `git merge` when package source changed.

```bash
#!/usr/bin/env sh

if git diff HEAD@{1} HEAD --name-only | grep -q "^packages/.*/src/"; then
  echo "📦 Workspace package source changed — rebuilding..."
  npm run build:packages 2>/dev/null || echo "⚠️  Package rebuild failed. Run: npm run build:packages"
fi
```

**Soft failure** (warning, not blocking) because:
- Post-merge can't block the merge (it already happened)
- If build fails, the next pre-commit will catch it

### 6. `scripts/validate-ecosystem.mjs`

Validates structural integrity of the dependency graph:

1. **Import ↔ Declaration check:** Scans `apps/web/src/**/*.{ts,tsx}` and `apps/api/src/**/*.ts` for `@tn-figueiredo/*` imports. Verifies each has a matching entry in the consuming app's `package.json`.

2. **Build pipeline coverage check:** For every `packages/*/package.json` where `main` field contains `dist/`:
   - Must be listed in the `build:packages` script
   - If missing → error (CI typecheck will fail without it)
   
   For every `packages/*/package.json` where `main` field contains `src/`:
   - Must be listed in `transpilePackages` in `apps/web/next.config.ts` (if consumed by web)
   - If missing → warning (bundler won't handle it)

3. **Stale reference check:** For every package in `build:packages` script:
   - The directory must exist
   - It must have a `build` script in its package.json

Output: Clear error messages identifying exactly what's wrong and how to fix it.

### 7. Validation Test (`apps/web/test/lib/build-confidence.test.ts`)

Structural test that runs as part of the normal test suite (caught by pre-commit):

```typescript
describe('Build Confidence Pipeline', () => {
  it('every dist-exporting package is in build:packages or transpilePackages')
  it('build:packages references only existing packages with build scripts')
  it('no @tn-figueiredo/* import without package.json declaration')
  it('build:packages script exists in root package.json')
  it('postinstall references build:packages')
})
```

This is the "catch-all" — if someone adds a new package and forgets to wire it up, the test fails, pre-commit blocks, commit is rejected.

### 8. CLAUDE.md Documentation Update

New section: **"Workspace Package Build Confidence"**

Decision tree:
- **Created new workspace package?** → Add to `build:packages` in root package.json. Test will block commit if you forget.
- **Modified workspace package source?** → Nothing manual needed. Pre-commit auto-rebuilds.
- **After git pull and something seems broken?** → Run `npm run build:packages`. Post-merge hook should have done this automatically.
- **CI typecheck fails on @tn-figueiredo/* types?** → Check that the package is in `build:packages`. If it's new, add it.
- **Import works locally but not in CI?** → Check that import is declared in the consuming app's `package.json`.

Package categories:
- **Workspace packages (need build, dist/ export):** `@tn-figueiredo/links`, `@tn-figueiredo/social` — `main: "./dist/index.js"`, require `build:packages` to produce dist/
- **Workspace packages (src/ export, build optional):** `@tn-figueiredo/links-admin` — `main: "./src/index.ts"`, handled by `transpilePackages`. Included in `build:packages` for consistency (fast, harmless) but NOT required for typecheck/build to pass.
- **Workspace packages (exception):** `@app/shared` (`packages/shared`) — raw TS, `transpilePackages`, NodeNext moduleResolution incompatible with workspace build context
- **Published packages:** All other `@tn-figueiredo/*` — installed from GitHub Packages registry, pinned exact versions

### 9. CI Workflow Alignment

Replace hardcoded build command in `.github/workflows/ci.yml` with:

```yaml
- name: Build workspace packages
  run: npm run build:packages
```

Since `postinstall` already runs `build:packages` after `npm ci`, the explicit step becomes a safety redundancy. We keep it for:
- Visibility in CI logs (clear step name)
- Independence from postinstall (if someone removes postinstall, CI still works)

## Failure Modes Covered

| Scenario | Gate that catches it |
|----------|---------------------|
| Package source edited, dist stale | Pre-commit (build:packages) |
| New package added, not wired | Validation test (blocks commit) |
| Import without declaration in package.json | validate-ecosystem.mjs (pre-push) |
| After git pull, dist outdated | Post-merge hook |
| Fresh clone, no dist/ | postinstall |
| CI missing build step | postinstall + explicit CI step |
| Unpinned @tn-figueiredo/* version | Pre-push pinning check |
| Multi-terminal: other terminal changed source | Pre-commit always rebuilds |
| Force-push with --no-verify | CI catches it (same gates in cloud) |

## What This Does NOT Cover

- **Version bump decisions:** Whether to bump `0.1.0` → `0.2.0` when source changes is a human judgment call (internal refactor vs breaking change). No automation here.
- **Published package registry sync:** Publishing new versions to GitHub Packages is a manual process (intentionally). This system only covers the LOCAL workspace packages.
- **Supabase migration ordering:** Separate concern, handled by `npm run db:new`.

## Performance Budget

| Hook | Added time | Frequency | Justification |
|------|-----------|-----------|---------------|
| Pre-commit | +5-8s | Every commit | Guarantees dist/ fresh for next build |
| Pre-push | +45-60s | Every push (~1-2/session) | Prevents 4 wasted Vercel builds |
| Post-merge | +5-8s (conditional) | After pull with pkg changes | Silent auto-repair |
| postinstall | +5-8s | After npm install/ci | Always-ready workspace |

## Rating: 99/100

The single missing point: no automated version bump suggestion. This is an intentional design choice — version bumps require human judgment about semver impact.
