# CMS Ring Subpath Export — Edge-Safe Middleware Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Edge-runtime-safe `@tn-figueiredo/cms/ring` subpath export so Next.js middleware can import `SupabaseRingContext` without pulling in the full barrel (MDX compiler, React editors, etc.).

**Architecture:** Create `src/ring.ts` as a lightweight entry point exporting only `SupabaseRingContext`, `IRingContext`, `Organization`, and `Site`. Add a matching `./ring` subpath in `package.json` exports. Bump to `0.1.0-beta.2`, publish, then update `bythiagofigueiredo` middleware to use the new import path.

**Tech Stack:** TypeScript, npm (GitHub Packages), Next.js 15 middleware (Edge runtime)

**Repos:**
- cms package: `/Users/figueiredo/Workspace/tn-cms`
- consumer app: `/Users/figueiredo/Workspace/bythiagofigueiredo`

---

## File Structure

### cms repo (`/Users/figueiredo/Workspace/tn-cms`)

| File | Action | Responsibility |
|------|--------|---------------|
| `src/ring.ts` | **Create** | Lightweight entry point: re-exports `SupabaseRingContext`, `IRingContext`, `Organization`, `Site` |
| `package.json` | **Modify** | Add `./ring` subpath to `exports` map, bump version to `0.1.0-beta.2` |
| `CHANGELOG.md` | **Modify** | Document the new subpath export |
| `test/consumer-smoke/ring-import.test.ts` | **Create** | Verify `@tn-figueiredo/cms/ring` resolves and exports expected symbols |

### consumer repo (`/Users/figueiredo/Workspace/bythiagofigueiredo`)

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/middleware.ts` | **Modify** | Switch import from `@tn-figueiredo/cms` to `@tn-figueiredo/cms/ring` |
| `apps/web/package.json` | **Modify** | Pin `@tn-figueiredo/cms` to `0.1.0-beta.2` |

---

### Task 1: Create the `ring` entry point in cms repo

**Files:**
- Create: `src/ring.ts`

- [ ] **Step 1: Create `src/ring.ts`**

```typescript
export type { IRingContext } from './interfaces/ring-context'
export type { Organization, Site } from './types/organization'
export { SupabaseRingContext } from './supabase/ring-context'
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/figueiredo/Workspace/tn-cms && npx tsc -p tsconfig.build.json --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/figueiredo/Workspace/tn-cms
git add src/ring.ts
git commit -m "feat: add ring.ts entry point for Edge-safe subpath export"
```

---

### Task 2: Add `./ring` subpath export to package.json

**Files:**
- Modify: `package.json` (exports map + version)

- [ ] **Step 1: Add `./ring` to exports and bump version**

In `package.json`, add the `./ring` entry after `./code` in the `exports` map, and bump `version` to `0.1.0-beta.2`:

```jsonc
{
  "version": "0.1.0-beta.2",
  // ...
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./code": {
      "types": "./dist/code.d.ts",
      "import": "./dist/code.js"
    },
    "./ring": {
      "types": "./dist/ring.d.ts",
      "import": "./dist/ring.js"
    }
  }
}
```

- [ ] **Step 2: Build and verify `dist/ring.js` + `dist/ring.d.ts` exist**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm run build
ls dist/ring.js dist/ring.d.ts
```

Expected: both files exist, no errors.

- [ ] **Step 3: Verify the subpath resolves without pulling MDX/React deps**

```bash
cd /Users/figueiredo/Workspace/tn-cms
node -e "
import('./dist/ring.js').then(m => {
  const keys = Object.keys(m)
  console.log('exports:', keys)
  if (!keys.includes('SupabaseRingContext')) throw new Error('missing SupabaseRingContext')
  console.log('OK')
}).catch(e => { console.error('FAIL:', e.message); process.exit(1) })
"
```

Expected: `exports: [ 'SupabaseRingContext' ]` then `OK`.

- [ ] **Step 4: Commit**

```bash
cd /Users/figueiredo/Workspace/tn-cms
git add package.json
git commit -m "feat: add ./ring subpath export + bump to 0.1.0-beta.2"
```

---

### Task 3: Add smoke test for ring import

**Files:**
- Create: `test/consumer-smoke/ring-import.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest'

describe('@tn-figueiredo/cms/ring subpath', () => {
  it('exports SupabaseRingContext without pulling barrel', async () => {
    const ring = await import('../../src/ring')
    expect(ring.SupabaseRingContext).toBeDefined()
    expect(typeof ring.SupabaseRingContext).toBe('function')
  })

  it('does NOT re-export barrel symbols (compileMdx, PostEditor)', async () => {
    const ring = await import('../../src/ring')
    const keys = Object.keys(ring)
    expect(keys).not.toContain('compileMdx')
    expect(keys).not.toContain('PostEditor')
    expect(keys).not.toContain('MdxRunner')
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/tn-cms && npx vitest run test/consumer-smoke/ring-import.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/figueiredo/Workspace/tn-cms
git add test/consumer-smoke/ring-import.test.ts
git commit -m "test: smoke test for ring subpath export"
```

---

### Task 4: Update CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add entry under `[Unreleased]`**

Add after `## [Unreleased]`:

```markdown
## [0.1.0-beta.2] - 2026-04-15

### Added

- `@tn-figueiredo/cms/ring` subpath export — Edge-runtime-safe entry point exposing only `SupabaseRingContext`, `IRingContext`, `Organization`, and `Site`. Use this in Next.js middleware instead of the main barrel to avoid pulling in MDX compiler and React editor components.
```

Update the link references at the bottom:

```markdown
[unreleased]: https://github.com/TN-Figueiredo/cms/compare/v0.1.0-beta.2...HEAD
[0.1.0-beta.2]: https://github.com/TN-Figueiredo/cms/compare/v0.1.0-beta.1...v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/TN-Figueiredo/cms/releases/tag/v0.1.0-beta.1
```

- [ ] **Step 2: Commit**

```bash
cd /Users/figueiredo/Workspace/tn-cms
git add CHANGELOG.md
git commit -m "docs: changelog for 0.1.0-beta.2 ring subpath"
```

---

### Task 5: Tag and publish `0.1.0-beta.2`

- [ ] **Step 1: Run full test suite before publishing**

```bash
cd /Users/figueiredo/Workspace/tn-cms && npm test
```

Expected: all tests pass.

- [ ] **Step 2: Push commits and tag**

```bash
cd /Users/figueiredo/Workspace/tn-cms
git push origin main
git tag v0.1.0-beta.2
git push origin v0.1.0-beta.2
```

The `publish.yml` workflow triggers on `v*` tags and publishes to GitHub Packages automatically.

- [ ] **Step 3: Wait for GH Actions publish to complete, then verify**

```bash
npm view @tn-figueiredo/cms@0.1.0-beta.2 version --registry=https://npm.pkg.github.com
```

Expected: `0.1.0-beta.2`

---

### Task 6: Update consumer middleware to use `./ring` subpath

**Files:**
- Modify: `apps/web/middleware.ts:3`
- Modify: `apps/web/package.json` (pin version)

- [ ] **Step 1: Install the new version**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm install @tn-figueiredo/cms@0.1.0-beta.2 -w apps/web --save-exact
```

- [ ] **Step 2: Update middleware import**

In `apps/web/middleware.ts`, change line 3:

```typescript
// Before:
import { SupabaseRingContext } from '@tn-figueiredo/cms'

// After:
import { SupabaseRingContext } from '@tn-figueiredo/cms/ring'
```

- [ ] **Step 3: Verify middleware compiles and auth gating works**

Start the dev server:
```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run dev -w apps/web
```

Visit `http://localhost:3001/admin` — expect redirect to `/signin?next=/admin`.
Visit `http://localhost:3001/cms` — expect redirect to `/signin?next=/cms`.
Visit `http://localhost:3001/` — expect 200 (public route).

- [ ] **Step 4: Run existing middleware test suite**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web
```

Expected: all tests pass (existing `test/middleware-site-resolution.test.ts` mocks the barrel, so it should still work since import path changed only in the real middleware).

- [ ] **Step 5: Update middleware test mock to use ring subpath**

If `test/middleware-site-resolution.test.ts` mocks `@tn-figueiredo/cms`, update the mock to `@tn-figueiredo/cms/ring` to match the new import. The mock shape stays identical — only the module specifier changes.

- [ ] **Step 6: Run tests again to verify mock update**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/middleware.ts apps/web/package.json apps/web/package-lock.json test/middleware-site-resolution.test.ts
git commit -m "fix: use @tn-figueiredo/cms/ring in middleware for Edge compat"
```
