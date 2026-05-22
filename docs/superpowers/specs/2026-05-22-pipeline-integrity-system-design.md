# Pipeline Integrity System — Design Spec

**Date:** 2026-05-22
**Status:** Draft

## Problem Statement

The Cowork AI system consumes pipeline documentation (API catalog, references, Tier 2 docs) served by the web app. The app evolves constantly with multiple Claude Code terminals working in parallel. When pipeline routes, schemas, or sections change, the corresponding documentation (api-registry.ts, pipeline-docs/*.md, cowork-pipeline-reference.md) often isn't updated, causing Cowork to waste tokens and produce incorrect output.

## Goals

1. 100% detection of route↔registry drift at commit time
2. Clear, actionable fix templates in error output
3. Auto-seed pipeline references to DB when reference files change
4. Zero new infrastructure — extend existing test suite and pre-commit hook
5. All Claude terminals informed via CLAUDE.md

## Non-Goals

- Auto-generating API documentation content (summaries are semantic)
- Validating editorial content in cowork-pipeline-reference.md
- Schema formalization (Phase 2, separate concern)

## Architecture

Three enforcement layers, all using existing infrastructure:

### Layer 1: Claude Code Hook (fast feedback, <1s)

- `.claude/settings.json` PreToolUse hook
- Matcher: `Bash`, condition: `Bash(git commit *)`
- Runs ONLY `api-registry.test.ts` via Vitest
- Exit 2 on failure = blocks the commit tool
- Claude sees the test failure with fix template, corrects, retries

### Layer 2: Husky Pre-commit (comprehensive, existing)

- `.husky/pre-commit` already runs `npm run test:web` which includes registry tests
- Extension: add auto-seed when reference files change in commit
- Auto-seed uses `git diff --cached --name-only` to detect changes in:
  - `docs/cowork-*`
  - `data/pipeline-docs/`
  - `api-registry.ts`
- Seed failure = warning (not blocking) — network dependency

### Layer 3: CI (safety net)

- `ci.yml` already runs `npm test` which includes registry tests
- No changes needed — existing CI catches everything

## Detailed Design

### 1. Test Extensions (`api-registry.test.ts`)

Add `describe('registry completeness')` block with 4 tests (~80 lines):

**Test 1: Every route file has a registry entry**

- Glob `**/route.ts` under `src/app/api/pipeline/`
- For each file, extract exported HTTP methods via regex: `export (async )?function (GET|POST|PATCH|PUT|DELETE)`
- Convert filesystem path to API path: `items/[id]/route.ts` → `/api/pipeline/items/:id`
- Compare each (method, path) pair against `API_REGISTRY.capabilities[*].endpoints`
- On failure: output fix template with exact TypeScript to add to api-registry.ts

**Test 2: Every registry entry has a route file**

- Reverse of test 1
- For each registry endpoint, verify a corresponding route.ts exists at the expected path
- On failure: suggest removing stale entry from api-registry.ts

**Test 3: Every domain has a Tier 2 doc file**

- For each domain in API_REGISTRY.capabilities, check `data/pipeline-docs/cowork-docs-{domain}.md` exists
- On failure: suggest creating the doc file

**Test 4: Seed script file references are valid**

- Read `scripts/seed-pipeline-reference.ts` as text
- Extract all `filePath: '...'` references via regex
- Verify each referenced file exists on disk
- On failure: suggest updating seed script

Each test produces actionable fix templates in the failure message:

```
Missing registry entry:
  POST /api/pipeline/playlists/:id/notes
  File: playlists/[id]/notes/route.ts

  Add to PLAYLISTS.endpoints in api-registry.ts:
    { method: 'POST', path: '/api/pipeline/playlists/:id/notes', summary: '<describe>', auth: 'write' }
  Also increment endpoint_count in PLAYLISTS domain.
```

### 2. CLAUDE.md Addition (5 lines)

Add after existing feature modules section:

```markdown
## Pipeline Integrity

Ao criar/deletar routes em `apps/web/src/app/api/pipeline/`:
1. Atualizar `apps/web/src/lib/pipeline/api-registry.ts` (add/remove endpoint entry)
2. Atualizar `data/pipeline-docs/cowork-docs-{domain}.md` com documentação do endpoint
3. Se schema de section mudou, atualizar `docs/cowork-pipeline-reference.md`
O test suite valida completude automaticamente — `npm test` falha se algo faltou.
Chave permanente: `PIPELINE_COWORK_KEY` em `.env.local`. **Nunca criar/revogar keys.**
```

### 3. Claude Hook Configuration

Add to `.claude/settings.json`:

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

Note: Exit code 2 blocks the tool execution in Claude Code. Exit code 1 is non-blocking.

### 4. Husky Pre-commit Extension

Add to end of `.husky/pre-commit`:

```bash
# ── Auto-seed if reference files changed ──
if git diff --cached --name-only | grep -qE '(docs/cowork-|data/pipeline-docs/|api-registry\.ts)'; then
  echo "📡 Reference files changed — seeding pipeline..."
  npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts 2>/tmp/seed-pipeline.log || {
    echo "⚠️  Seed failed (network?). Run manually later:"
    echo "    npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts"
  }
fi
```

### 5. package.json Script

Add convenience script to root package.json:

```json
{
  "scripts": {
    "pipeline:audit": "cd apps/web && npx vitest run test/lib/pipeline/api-registry.test.ts"
  }
}
```

## Phase 2: Schema Formalization (separate scope)

Not part of this implementation. When ready:

1. Create `section-schema-registry.ts` mapping section types → Zod schemas
2. Create formal Zod schemas for: ideia, draft, seo, images, publish, brolls
3. Add test: "every section in SECTION_DEFINITIONS has formal schema in registry"
4. Enable content validation in section PATCH handler

Field specifications (from renderer analysis):

- **ideia**: `premise?`, `body?`, `angle?`, `vvs?(0-100)`, `validated_at?`, `cross_refs?[{code, title, note}]`
- **draft**: `body?`, `title?`, `slug?`, `excerpt?`, `key_points?[]`, `pull_quote?`, `notes?[]`, `colophon?`, `tag_id?`, `hashtag_ids?[]`, `cover_image_url?`
- **seo**: `meta_title`, `meta_description`, `slug?`, `keywords?[]`
- **images**: `cover?{prompts[], chosen?, image_url?, fallback_search?, status?}`, `body_images?[...]`
- **publish**: `title?{chosen, alternatives?[]}`, `description?`, `tags?[]`, `cards?[{timestamp, text, type?}]`, `end_screen?`, `strategy?[]`
- **brolls**: `items?[{description, clip_name?, beat?, type?, timestamp?, priority?, note?, effect?, captured}]`, `thumbnail_concepts?[]`, `style_guide?`, `source_docs?`

## Files Changed

| File | Action | Lines | Purpose |
|------|--------|-------|---------|
| `apps/web/test/lib/pipeline/api-registry.test.ts` | Edit | +80 | Registry completeness tests |
| `CLAUDE.md` | Edit | +5 | Pipeline integrity rules |
| `.claude/settings.json` | Create | ~15 | PreToolUse hook |
| `.husky/pre-commit` | Edit | +8 | Auto-seed on reference changes |
| `package.json` | Edit | +1 | pipeline:audit script |

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Route scanning regex misses unconventional exports | Test will catch — if a route exists but export regex doesn't match, test 2 (registry entry without route) will flag it |
| Seed failure blocks commit | Seed is non-blocking (warning only) |
| False positive on infrastructure routes (root GET /) | Exclude known infrastructure paths in test config |
| tsx startup adds latency to seed | Only runs when reference files actually changed |
| CLAUDE.md token cost | 5 lines = ~40 tokens, negligible |

## Success Criteria

1. `npm test` fails when a new pipeline route.ts exists without api-registry.ts entry
2. `npm test` fails when a registry entry points to a non-existent route
3. Claude Code commit is blocked (exit 2) when registry test fails
4. Seed runs automatically when reference files change in commit
5. All Claude terminals see Pipeline Integrity instructions via CLAUDE.md
