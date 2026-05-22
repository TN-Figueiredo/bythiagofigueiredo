# Pipeline Integrity System — Implementation Plan

## Overview

Extend the existing test suite and pre-commit hook to enforce pipeline documentation sync. Zero new infrastructure — only extend existing files.

## Prerequisites

- Current branch: staging
- Existing test: `apps/web/test/lib/pipeline/api-registry.test.ts`
- Existing hook: `.husky/pre-commit`
- api-registry: `apps/web/src/lib/pipeline/api-registry.ts`
- Pipeline docs: `apps/web/data/pipeline-docs/cowork-docs-{domain}.md`
- Seed script: `scripts/seed-pipeline-reference.ts`

## Tasks (ordered by dependency)

### Task 1: Registry Completeness Tests (INDEPENDENT)
**File:** `apps/web/test/lib/pipeline/api-registry.test.ts`
**Action:** Add ~80 lines to existing test file

Add a new `describe('registry completeness')` block with 4 tests after the existing `describe('API_REGISTRY')` block.

**Imports to add** at the top of the file (after existing imports):
```typescript
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, relative } from 'path'
```

**Code to append** before the file's final newline:

```typescript
describe('registry completeness', () => {
  const webRoot = join(__dirname, '..', '..', '..', 'src')
  const routeDir = join(webRoot, 'app', 'api', 'pipeline')

  /** Recursively find all route.ts files under a directory */
  function findRouteFiles(dir: string): string[] {
    const results: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
      if (entry.name === 'route.ts' && entry.parentPath) {
        results.push(join(entry.parentPath, entry.name))
      }
    }
    return results
  }

  /** Convert filesystem path to API path: [id] -> :id, strip /route.ts */
  function toApiPath(filePath: string): string {
    const rel = relative(routeDir, filePath)
      .replace(/\/route\.ts$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1')
    return `/api/pipeline/${rel}`
  }

  /** Convert API path back to filesystem path: :id -> [id] */
  function toFsPath(apiPath: string): string {
    const rel = apiPath
      .replace(/^\/api\/pipeline\//, '')
      .replace(/:([^/]+)/g, '[$1]')
    return join(routeDir, rel, 'route.ts')
  }

  const HTTP_METHOD_RE = /export\s+(?:async\s+)?(?:function\s+)?(GET|POST|PUT|PATCH|DELETE)/g

  it('every route file has a registry entry', () => {
    const routeFiles = findRouteFiles(routeDir)
    const registryPaths = new Map<string, Set<string>>()

    for (const cap of API_REGISTRY.capabilities) {
      for (const ep of cap.endpoints) {
        if (!registryPaths.has(ep.path)) registryPaths.set(ep.path, new Set())
        registryPaths.get(ep.path)!.add(ep.method)
      }
    }

    const missing: string[] = []
    for (const file of routeFiles) {
      const apiPath = toApiPath(file)
      // Exclude root /api/pipeline — infrastructure endpoint (serves the registry itself)
      if (apiPath === '/api/pipeline/') continue

      const content = readFileSync(file, 'utf8')
      const methods: string[] = []
      let match: RegExpExecArray | null
      while ((match = HTTP_METHOD_RE.exec(content)) !== null) {
        methods.push(match[1])
      }

      for (const method of methods) {
        if (!registryPaths.has(apiPath) || !registryPaths.get(apiPath)!.has(method)) {
          missing.push(
            `${method} ${apiPath} — add to api-registry.ts:\n` +
            `  { method: '${method}', path: '${apiPath}', summary: '...', auth: 'read' }`
          )
        }
      }
    }

    expect(missing, `Route files without registry entries:\n${missing.join('\n')}`).toHaveLength(0)
  })

  it('every registry entry has a route file', () => {
    const stale: string[] = []
    for (const cap of API_REGISTRY.capabilities) {
      for (const ep of cap.endpoints) {
        const fsPath = toFsPath(ep.path)
        if (!existsSync(fsPath)) {
          stale.push(`${ep.method} ${ep.path} — file not found: ${fsPath}. Remove stale entry from api-registry.ts`)
        }
      }
    }
    expect(stale, `Registry entries without route files:\n${stale.join('\n')}`).toHaveLength(0)
  })

  it('every domain has a Tier 2 doc file', () => {
    const docsDir = join(webRoot, '..', 'data', 'pipeline-docs')
    const missing: string[] = []
    for (const cap of API_REGISTRY.capabilities) {
      const docPath = join(docsDir, `cowork-docs-${cap.domain}.md`)
      if (!existsSync(docPath)) {
        missing.push(`Domain "${cap.domain}" — create ${docPath}`)
      }
    }
    expect(missing, `Domains without Tier 2 docs:\n${missing.join('\n')}`).toHaveLength(0)
  })

  it('seed file references are valid', () => {
    const seedPath = join(__dirname, '..', '..', '..', '..', '..', 'scripts', 'seed-pipeline-reference.ts')
    if (!existsSync(seedPath)) return // skip if seed script doesn't exist

    const content = readFileSync(seedPath, 'utf8')
    const filePathRe = /filePath:\s*'([^']+)'/g
    const scriptsDir = join(seedPath, '..')
    const broken: string[] = []

    let match: RegExpExecArray | null
    while ((match = filePathRe.exec(content)) !== null) {
      const refPath = join(scriptsDir, match[1])
      if (!existsSync(refPath)) {
        broken.push(`filePath: '${match[1]}' — resolved to ${refPath} (not found)`)
      }
    }
    expect(broken, `Broken file references in seed script:\n${broken.join('\n')}`).toHaveLength(0)
  })
})
```

**Verification:**
```bash
cd apps/web && npx vitest run test/lib/pipeline/api-registry.test.ts
```

---

### Task 2: CLAUDE.md Pipeline Section (INDEPENDENT)
**File:** `CLAUDE.md`
**Action:** Add Pipeline Integrity section after the "Feature modules" section

Insert the following block after the "Remaining operational flags" subsection (after line ~120, before the `## Environment Variables` heading at line 122):

```markdown

## Pipeline Integrity

Ao criar/deletar routes em `apps/web/src/app/api/pipeline/`:
1. Atualizar `apps/web/src/lib/pipeline/api-registry.ts` (add/remove endpoint entry)
2. Atualizar `apps/web/data/pipeline-docs/cowork-docs-{domain}.md` com documentação do endpoint
3. Se schema de section mudou, atualizar `docs/cowork-pipeline-reference.md`
O test suite valida completude automaticamente — `npm test` falha se algo faltou.
Chave permanente: `PIPELINE_COWORK_KEY` em `.env.local`. **Nunca criar/revogar keys.**
```

**Exact edit:** Find the line `## Environment Variables` and prepend the section before it.

**Verification:** Read the file and confirm the section appears between "Remaining operational flags" and "Environment Variables".

---

### Task 3: Claude Hook Configuration (INDEPENDENT)
**File:** `.claude/settings.json`
**Action:** Create new file (settings.json does NOT currently exist — only settings.local.json exists)

**IMPORTANT:** Only settings.local.json exists today. The new settings.json should ONLY contain the hooks config — do NOT duplicate the permissions from settings.local.json.

Write this file:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "cd apps/web && npx vitest run --reporter=verbose --bail 1 test/lib/pipeline/api-registry.test.ts 2>&1 | tail -30; test ${PIPESTATUS[0]} -eq 0 || exit 2"
          }
        ],
        "if": "Bash(git commit *)"
      }
    ]
  }
}
```

**Verification:** Confirm file exists and is valid JSON:
```bash
cat .claude/settings.json | python3 -m json.tool > /dev/null && echo "valid JSON"
```

---

### Task 4: Husky Pre-commit Extension (INDEPENDENT)
**File:** `.husky/pre-commit`
**Action:** Append auto-seed block at the END of the existing file (after the final `echo "..."` line)

The current file ends at line 53 with:
```bash
echo "✅ Tudo verde — testes, build do web e typecheck da API."
```

Append after that line:

```bash

# ── Auto-seed if pipeline reference files changed ──
if git diff --cached --name-only | grep -qE '(docs/cowork-|data/pipeline-docs/|api-registry\.ts)'; then
  echo "📡 Reference files changed — seeding pipeline references..."
  npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts 2>/tmp/seed-pipeline.log || {
    echo "⚠️  Seed failed (network?). Run manually later:"
    echo "    npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts"
  }
fi
```

**Verification:** Read the file and confirm the block is appended correctly after the existing checks.

---

### Task 5: Package.json Script (INDEPENDENT)
**File:** `package.json` (root)
**Action:** Add `pipeline:audit` to the scripts section

Add this entry to the `"scripts"` object in the root package.json:
```json
"pipeline:audit": "cd apps/web && npx vitest run test/lib/pipeline/api-registry.test.ts"
```

Place it after the `"test:web"` line.

**Verification:**
```bash
npm run pipeline:audit
```

---

## Execution Order

All 5 tasks are INDEPENDENT and can execute in parallel. No dependencies between them.

After all tasks complete:
1. Run `npm run pipeline:audit` to verify tests pass
2. Run full `npm test` to ensure no regressions
3. Commit all changes together

## Known Edge Cases

1. **Root route exclusion:** `GET /api/pipeline` serves the registry itself — the test excludes it to avoid circular self-documentation. The path converts to `/api/pipeline/` (trailing slash) which is checked explicitly.
2. **Docs route:** `GET /api/pipeline/docs/[domain]` serves Tier 2 docs — it IS an endpoint in the `utilities` domain registry and should be included.
3. **Re-export patterns:** Some routes may use `export { GET } from './handler'`. The regex `export\s+(?:async\s+)?(?:function\s+)?(GET|...)` handles direct function exports. Named re-exports like `export { GET }` are also valid — the regex catches the method name after `export`. If a route uses `export { GET }` without `function`, the regex will NOT match — but this pattern is not used in this codebase (all routes use `export async function GET`).
4. **`glob` not available:** The `glob` npm package is not installed. Tests use `readdirSync` with `{ recursive: true }` (Node 18+) instead.
5. **Seed script paths:** The seed script uses relative paths from `scripts/` (e.g., `'../docs/cowork-content-curator-skill.md'`). The test resolves these relative to the scripts directory.
6. **Pipeline docs location:** Files are in `apps/web/data/pipeline-docs/`, NOT `data/pipeline-docs/` at the repo root.
