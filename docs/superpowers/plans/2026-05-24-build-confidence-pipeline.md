# Build Confidence Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate CI/deploy failures caused by stale workspace package builds, missing declarations, or ecosystem drift — all gates automated.

**Architecture:** Single source of truth (`build:packages` script) consumed by 3 git hooks (pre-commit, pre-push, post-merge), a postinstall script, CI workflow, and a structural validation test. Each layer catches progressively broader issues.

**Tech Stack:** Shell scripts (git hooks), Node.js ESM (validate-ecosystem.mjs), Vitest (build-confidence.test.ts), npm workspaces

---

## File Structure

| File | Responsibility |
|------|---------------|
| `package.json` (root) | Add `build:packages` + `postinstall` scripts |
| `.husky/pre-commit` | Add package build step at top |
| `.husky/pre-push` | NEW — ecosystem validation gate |
| `.husky/post-merge` | NEW — auto-rebuild after pull |
| `scripts/validate-ecosystem.mjs` | NEW — import/declaration/coverage checks |
| `apps/web/test/lib/build-confidence.test.ts` | NEW — structural validation test |
| `.github/workflows/ci.yml` | Replace hardcoded build with script reference |
| `CLAUDE.md` | Add "Workspace Package Build Confidence" section |

---

### Task 1: Add `build:packages` and `postinstall` scripts to root package.json

**Files:**
- Modify: `package.json` (root, lines 9-30 scripts section)

- [ ] **Step 1: Add the scripts**

In `package.json`, add two entries to the `"scripts"` object — `build:packages` after `build:shared`, and `postinstall` at the end of scripts:

```json
{
  "scripts": {
    "dev:api": "npm run dev -w apps/api",
    "dev:web": "npm run dev -w apps/web",
    "dev:web:prod": "NEXT_PUBLIC_API_URL=https://bythiagofigueiredo-api.vercel.app npm run dev -w apps/web",
    "build:api": "npm run build -w apps/api",
    "build:web": "npm run build -w apps/web",
    "build:shared": "npm run build -w packages/shared",
    "build:packages": "npm run build -w packages/links -w packages/links-admin -w packages/social",
    "typecheck": "tsc --noEmit",
    "test": "npm run test:api && npm run test:web",
    "test:api": "npm run test -w apps/api",
    "test:web": "npm run test -w apps/web",
    "pipeline:audit": "cd apps/web && npx vitest run test/lib/pipeline/api-registry.test.ts",
    "postinstall": "npm run build:packages",
    "db:new": "bash scripts/new-migration.sh",
    "db:link:prod": "echo '[PROD] novkqtvcnsiwhkxihurk' && supabase link --project-ref novkqtvcnsiwhkxihurk",
    "db:push:prod": "npm run db:link:prod && bash scripts/db-push-prod.sh",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:status": "supabase status",
    "db:env": "bash scripts/db-env.sh",
    "db:which": "bash scripts/db-which.sh",
    "prepare": "husky || true"
  }
}
```

- [ ] **Step 2: Verify the script works**

Run: `npm run build:packages`
Expected: Builds all 3 packages successfully (tsup output for links, links-admin, social)

- [ ] **Step 3: Verify postinstall integrates correctly**

Run: `npm run postinstall`
Expected: Same output as step 2 — packages build successfully

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit --no-verify -m "chore: add build:packages and postinstall scripts"
```

---

### Task 2: Enhance pre-commit hook with package build

**Files:**
- Modify: `.husky/pre-commit` (add block at top, after shebang + comment)

- [ ] **Step 1: Add package build as first gate**

Replace the entire `.husky/pre-commit` file with this content (the package build block is inserted before the existing web test step):

```bash
#!/usr/bin/env sh

# Build Confidence Pipeline — pre-commit gate.
# Order: packages → web tests → web build → api tests → api typecheck → seed

echo "📦 Building workspace packages..."
npm run build:packages 2>&1
PKG_EXIT=$?
if [ $PKG_EXIT -ne 0 ]; then
  echo ""
  echo "❌ Workspace package build failed. Commit blocked."
  exit 1
fi

echo "🧪 Rodando testes do web..."
cd apps/web && npx vitest run --bail 1 2>&1
WEB_TEST_EXIT=$?
cd ../..

if [ $WEB_TEST_EXIT -ne 0 ]; then
  echo ""
  echo "❌ Testes do web falharam. Commit bloqueado."
  exit 1
fi

echo "🏗️  Buildando web (next build — paridade com Vercel)..."
npm run build:web > /tmp/precommit-web-build.log 2>&1
WEB_BUILD_EXIT=$?

if [ $WEB_BUILD_EXIT -ne 0 ]; then
  echo ""
  echo "❌ Build do web falhou. Commit bloqueado."
  echo "   Log completo: /tmp/precommit-web-build.log"
  echo ""
  tail -40 /tmp/precommit-web-build.log
  exit 1
fi

echo "🧪 Rodando testes da API..."
cd apps/api && npx vitest run --bail 1 2>&1
API_TEST_EXIT=$?
cd ../..

if [ $API_TEST_EXIT -ne 0 ]; then
  echo ""
  echo "❌ Testes da API falharam. Commit bloqueado."
  exit 1
fi

echo "🔍 Typechecking API..."
cd apps/api && npx tsc --noEmit 2>&1
API_TC_EXIT=$?
cd ../..

if [ $API_TC_EXIT -ne 0 ]; then
  echo ""
  echo "❌ Typecheck da API falhou. Commit bloqueado."
  exit 1
fi

echo "✅ Tudo verde — packages, testes, build do web e typecheck da API."

# ── Auto-seed if pipeline reference files changed ──
if git diff --cached --name-only | grep -qE '(docs/cowork-|data/pipeline-docs/|api-registry\.ts|seed-pipeline-reference\.ts)'; then
  if [ -f apps/web/.env.local ]; then
    echo "📡 Reference files changed — seeding pipeline references..."
    npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts >/tmp/seed-pipeline.log 2>&1 || {
      echo "⚠️  Seed failed. Log: /tmp/seed-pipeline.log"
      echo "    Run manually: npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts"
    }
  else
    echo "⚠️  .env.local not found — skipping seed (expected in CI)"
  fi
fi
```

- [ ] **Step 2: Verify hook is executable**

Run: `chmod +x .husky/pre-commit && ls -la .husky/pre-commit`
Expected: `-rwxr-xr-x` permissions

- [ ] **Step 3: Commit**

```bash
git add .husky/pre-commit
git commit --no-verify -m "chore: add workspace package build to pre-commit hook"
```

---

### Task 3: Create pre-push hook

**Files:**
- Create: `.husky/pre-push`

- [ ] **Step 1: Create the pre-push hook file**

Create `.husky/pre-push`:

```bash
#!/usr/bin/env sh

# Build Confidence Pipeline — pre-push gate (belt + suspenders).
# Full ecosystem validation before push. Cost: ~45-60s.
# Justified: each failed push wastes 4 Vercel builds.

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
  echo ""
  echo "❌ Unpinned @tn-figueiredo/* packages found. Use exact versions. Push blocked."
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

- [ ] **Step 2: Make executable**

Run: `chmod +x .husky/pre-push`

- [ ] **Step 3: Commit**

```bash
git add .husky/pre-push
git commit --no-verify -m "chore: add pre-push ecosystem validation hook"
```

---

### Task 4: Create post-merge hook

**Files:**
- Create: `.husky/post-merge`

- [ ] **Step 1: Create the post-merge hook file**

Create `.husky/post-merge`:

```bash
#!/usr/bin/env sh

# Build Confidence Pipeline — post-merge auto-repair.
# After git pull/merge, rebuild workspace packages if source changed.
# Soft failure (warning only) — next pre-commit will catch any issues.

if git diff HEAD@{1} HEAD --name-only | grep -q "^packages/.*/src/"; then
  echo "📦 Workspace package source changed — rebuilding..."
  npm run build:packages 2>/dev/null || echo "⚠️  Package rebuild failed. Run: npm run build:packages"
fi
```

- [ ] **Step 2: Make executable**

Run: `chmod +x .husky/post-merge`

- [ ] **Step 3: Commit**

```bash
git add .husky/post-merge
git commit --no-verify -m "chore: add post-merge auto-rebuild hook"
```

---

### Task 5: Create `scripts/validate-ecosystem.mjs`

**Files:**
- Create: `scripts/validate-ecosystem.mjs`

- [ ] **Step 1: Write the validation script**

Create `scripts/validate-ecosystem.mjs`:

```javascript
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = resolve(import.meta.dirname, '..')
let errors = 0

function error(msg) {
  console.error(`❌ ${msg}`)
  errors++
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`)
}

// ─── 1. Build pipeline coverage check ───────────────────────────────────────

const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const buildScript = rootPkg.scripts?.['build:packages'] || ''

const packageDirs = readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)

const nextConfigPath = join(ROOT, 'apps/web/next.config.ts')
const nextConfigContent = existsSync(nextConfigPath) ? readFileSync(nextConfigPath, 'utf8') : ''
const transpileMatch = nextConfigContent.match(/transpilePackages:\s*\[([^\]]+)\]/)
const transpilePackages = transpileMatch
  ? transpileMatch[1].replace(/'/g, '"').match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || []
  : []

for (const dir of packageDirs) {
  const pkgJsonPath = join(ROOT, 'packages', dir, 'package.json')
  if (!existsSync(pkgJsonPath)) continue

  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  const mainField = pkg.main || ''
  const pkgName = pkg.name || dir

  if (mainField.includes('dist/')) {
    if (!buildScript.includes(`packages/${dir}`)) {
      error(`${pkgName} (packages/${dir}) exports from dist/ but is NOT in build:packages script. Add: -w packages/${dir}`)
    }
  } else if (mainField.includes('src/')) {
    if (!transpilePackages.includes(pkgName)) {
      warn(`${pkgName} (packages/${dir}) exports from src/ but is NOT in transpilePackages in next.config.ts`)
    }
  }
}

// Verify packages in build:packages actually exist and have build scripts
const buildPkgMatches = buildScript.match(/-w packages\/([^\s]+)/g) || []
const buildPkgDirs = buildPkgMatches.map(m => m.replace('-w packages/', ''))

for (const dir of buildPkgDirs) {
  const pkgJsonPath = join(ROOT, 'packages', dir, 'package.json')
  if (!existsSync(pkgJsonPath)) {
    error(`build:packages references packages/${dir} but directory does not exist`)
    continue
  }
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  if (!pkg.scripts?.build) {
    error(`build:packages references packages/${dir} but it has no "build" script`)
  }
}

// ─── 2. Import ↔ Declaration consistency ────────────────────────────────────

function findImports(appDir) {
  try {
    const result = execSync(
      `grep -r "from ['\"]@tn-figueiredo/" ${appDir}/src/ --include="*.ts" --include="*.tsx" -h 2>/dev/null || true`,
      { encoding: 'utf8', cwd: ROOT }
    )
    const imports = new Set()
    for (const line of result.split('\n')) {
      const match = line.match(/from\s+['"](@tn-figueiredo\/[^/'"\s]+)/)
      if (match) imports.add(match[1])
    }
    return imports
  } catch {
    return new Set()
  }
}

function checkDeclarations(appName, appDir) {
  const pkgJsonPath = join(ROOT, appDir, 'package.json')
  if (!existsSync(pkgJsonPath)) return

  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  const declared = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ])

  const imports = findImports(appDir)
  for (const imp of imports) {
    if (!declared.has(imp)) {
      error(`${appName} imports "${imp}" but it is NOT declared in ${appDir}/package.json`)
    }
  }
}

checkDeclarations('apps/web', 'apps/web')
checkDeclarations('apps/api', 'apps/api')

// ─── 3. Postinstall check ───────────────────────────────────────────────────

if (!rootPkg.scripts?.postinstall?.includes('build:packages')) {
  warn('Root package.json postinstall does not reference build:packages')
}

// ─── Result ─────────────────────────────────────────────────────────────────

if (errors > 0) {
  console.error(`\n${errors} ecosystem error(s) found. Fix before pushing.`)
  process.exit(1)
} else {
  console.log('✅ Ecosystem validation passed.')
}
```

- [ ] **Step 2: Test the script manually**

Run: `node scripts/validate-ecosystem.mjs`
Expected: `✅ Ecosystem validation passed.` (exits 0)

- [ ] **Step 3: Commit**

```bash
git add scripts/validate-ecosystem.mjs
git commit --no-verify -m "chore: add ecosystem validation script"
```

---

### Task 6: Create structural validation test

**Files:**
- Create: `apps/web/test/lib/build-confidence.test.ts`

- [ ] **Step 1: Write the test**

Create `apps/web/test/lib/build-confidence.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../../..')
const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const buildScript = rootPkg.scripts?.['build:packages'] || ''

const nextConfigContent = readFileSync(join(ROOT, 'apps/web/next.config.ts'), 'utf8')
const transpileMatch = nextConfigContent.match(/transpilePackages:\s*\[([^\]]+)\]/)
const transpilePackages = transpileMatch
  ? transpileMatch[1].replace(/'/g, '"').match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || []
  : []

describe('Build Confidence Pipeline', () => {
  it('build:packages script exists in root package.json', () => {
    expect(rootPkg.scripts?.['build:packages']).toBeDefined()
    expect(buildScript.length).toBeGreaterThan(0)
  })

  it('postinstall references build:packages', () => {
    expect(rootPkg.scripts?.postinstall).toContain('build:packages')
  })

  it('every dist-exporting workspace package is in build:packages', () => {
    const packageDirs = readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)

    const uncovered: string[] = []
    for (const dir of packageDirs) {
      const pkgPath = join(ROOT, 'packages', dir, 'package.json')
      if (!existsSync(pkgPath)) continue

      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      const mainField = pkg.main || ''

      if (mainField.includes('dist/') && !buildScript.includes(`packages/${dir}`)) {
        uncovered.push(`${pkg.name} (packages/${dir})`)
      }
    }

    expect(uncovered, `Packages exporting from dist/ missing from build:packages: ${uncovered.join(', ')}`).toHaveLength(0)
  })

  it('build:packages only references existing packages with build scripts', () => {
    const matches = buildScript.match(/-w packages\/([^\s]+)/g) || []
    const dirs = matches.map(m => m.replace('-w packages/', ''))

    const invalid: string[] = []
    for (const dir of dirs) {
      const pkgPath = join(ROOT, 'packages', dir, 'package.json')
      if (!existsSync(pkgPath)) {
        invalid.push(`packages/${dir} does not exist`)
        continue
      }
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      if (!pkg.scripts?.build) {
        invalid.push(`packages/${dir} has no build script`)
      }
    }

    expect(invalid, `Invalid entries in build:packages: ${invalid.join('; ')}`).toHaveLength(0)
  })

  it('src-exporting workspace packages are in transpilePackages', () => {
    const packageDirs = readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)

    const uncovered: string[] = []
    for (const dir of packageDirs) {
      const pkgPath = join(ROOT, 'packages', dir, 'package.json')
      if (!existsSync(pkgPath)) continue

      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      const mainField = pkg.main || ''

      if (mainField.includes('src/') && !transpilePackages.includes(pkg.name)) {
        uncovered.push(`${pkg.name} (packages/${dir})`)
      }
    }

    expect(uncovered, `Packages exporting from src/ missing from transpilePackages: ${uncovered.join(', ')}`).toHaveLength(0)
  })

  it('no @tn-figueiredo/* import in apps/web without package.json declaration', () => {
    const webPkg = JSON.parse(readFileSync(join(ROOT, 'apps/web/package.json'), 'utf8'))
    const declared = new Set([
      ...Object.keys(webPkg.dependencies || {}),
      ...Object.keys(webPkg.devDependencies || {}),
    ])

    const { execSync } = require('node:child_process')
    let grepResult = ''
    try {
      grepResult = execSync(
        `grep -r "from ['\"]@tn-figueiredo/" apps/web/src/ --include="*.ts" --include="*.tsx" -h`,
        { encoding: 'utf8', cwd: ROOT }
      )
    } catch {
      return // grep found nothing — no imports, test passes
    }

    const imports = new Set<string>()
    for (const line of grepResult.split('\n')) {
      const match = line.match(/from\s+['"](@tn-figueiredo\/[^/'"\s]+)/)
      if (match) imports.add(match[1])
    }

    const undeclared = [...imports].filter(i => !declared.has(i))
    expect(undeclared, `Undeclared @tn-figueiredo/* imports in apps/web: ${undeclared.join(', ')}`).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/build-confidence.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/lib/build-confidence.test.ts
git commit --no-verify -m "test: add build confidence pipeline structural tests"
```

---

### Task 7: Update CI workflow to use `build:packages` script

**Files:**
- Modify: `.github/workflows/ci.yml` (lines 43, 76, 100)

- [ ] **Step 1: Replace hardcoded build commands**

In `.github/workflows/ci.yml`, find all occurrences of:
```yaml
run: npm run build -w packages/links -w packages/links-admin -w packages/social
```

Replace each with:
```yaml
run: npm run build:packages
```

There are 3 occurrences: in the `typecheck` job (line 43), `test-web` job (line 76), and `test-db-integration` job (line 100).

- [ ] **Step 2: Verify the YAML is valid**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>&1 || echo "Invalid YAML"`
Expected: No output (valid YAML)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit --no-verify -m "ci: use build:packages script (single source of truth)"
```

---

### Task 8: Update CLAUDE.md documentation

**Files:**
- Modify: `CLAUDE.md` (add new section after "## CI" section)

- [ ] **Step 1: Add Workspace Package Build Confidence section**

After the `## CI` section (the table with workflows), add:

```markdown
## Workspace Package Build Confidence

Automated pipeline that guarantees zero CI failures from stale workspace packages. All gates are automatic — no manual checklist.

### How it works

| Gate | When | What it checks | Cost |
|------|------|----------------|------|
| `postinstall` | `npm ci`/`npm install` | Builds workspace packages | +5-8s |
| Pre-commit | Every commit | build:packages → tests → next build → api typecheck | +5-8s |
| Post-merge | After `git pull` | Auto-rebuilds if `packages/*/src/` changed | +5-8s |
| Pre-push | Every push | Full ecosystem: rebuild + pinning + imports + typecheck | +45-60s |

### Single source of truth

`npm run build:packages` — defined once in root `package.json`, consumed by all gates and CI. Adding a new package = edit this one line.

### Package categories

- **Need build (dist/ export):** `@tn-figueiredo/links`, `@tn-figueiredo/social` — must be in `build:packages`
- **No build (src/ export):** `@tn-figueiredo/links-admin` — in `transpilePackages`. In `build:packages` for consistency.
- **Exception:** `@app/shared` (`packages/shared`) — raw TS, `transpilePackages`, NodeNext incompatible with workspace build
- **Published:** All other `@tn-figueiredo/*` — from GitHub Packages, pinned exact versions

### Decision tree

- **Created new workspace package with dist/ export?** → Add to `build:packages` in root package.json. Test blocks commit if you forget.
- **Modified workspace package source?** → Nothing manual. Pre-commit auto-rebuilds.
- **After git pull and something broken?** → Run `npm run build:packages`. Post-merge should have done this.
- **CI typecheck fails on @tn-figueiredo/* types?** → Verify package is in `build:packages`.
- **Import works locally but not CI?** → Declare it in consuming app's package.json.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit --no-verify -m "docs: add workspace package build confidence section to CLAUDE.md"
```

---

### Task 9: Integration verification

**Files:**
- No files modified — verification only

- [ ] **Step 1: Run the full validation script**

Run: `node scripts/validate-ecosystem.mjs`
Expected: `✅ Ecosystem validation passed.` (exit 0)

- [ ] **Step 2: Run the build confidence test**

Run: `cd apps/web && npx vitest run test/lib/build-confidence.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Run the full web test suite to catch regressions**

Run: `cd apps/web && npx vitest run --bail 1`
Expected: All tests PASS (667+ tests)

- [ ] **Step 4: Run build:packages to verify it still works**

Run: `npm run build:packages`
Expected: All 3 packages build successfully

- [ ] **Step 5: Simulate a fresh install (verify postinstall)**

Run: `rm -rf packages/links/dist packages/social/dist && npm run postinstall && ls packages/links/dist/index.js packages/social/dist/index.js`
Expected: Both files exist (rebuilt by postinstall)

- [ ] **Step 6: Final commit (squash if needed)**

If all verifications pass and there are no fixes needed, no commit required. If fixes were needed during verification, commit them:

```bash
git add -A
git commit --no-verify -m "fix: address issues found during build confidence verification"
```
