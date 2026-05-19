# Pipeline API Intelligence v5 — Design Spec

**Goal:** Transform the pipeline reference system from a disorganized 46-entry dump into a self-evolving 3-tier API intelligence layer where the Cowork AI bootstraps in 1 call, loads only what it needs, and can evolve system rules without deploys.

**Rating target:** 101/110 — less surface area, more capability.

---

## Architecture: 3 Tiers

| Tier | Endpoint | Source | Mutable by Cowork |
|------|----------|--------|--------------------|
| **Catalog** | `GET /api/pipeline/` | Code (registry) + DB (directives) | No (code) / Yes (directives) |
| **Docs** | `GET /api/pipeline/docs/[domain]` | Git markdown files | No |
| **References** | `GET /api/pipeline/context` | DB (reference_content) | Yes |

### Tier 1: Catalog (enhanced existing endpoint)

Returns static endpoint registry + dynamic directives from DB in ONE call:

```json
{
  "name": "Content Pipeline API",
  "version": "2.0.0",
  "auth": { "methods": ["api_key","session_cookie"], "header": "X-Pipeline-Key", "rate_limit": "100/min", "version_header": "X-Expected-Version" },
  "capabilities": [
    { "domain": "items-and-sections", "name": "Pipeline Items & Content Sections", "suggest_when": "Creating/editing/advancing pipeline content", "docs": "/api/pipeline/docs/items-and-sections", "endpoint_count": 17, "endpoints": [...] },
    { "domain": "playlists", ... },
    { "domain": "libraries", ... },
    { "domain": "research", ... },
    { "domain": "youtube", ... },
    { "domain": "utilities", ... }
  ],
  "directives": {
    "groups": { "version": 1, "value": {...} },
    "skill_mappings": { "version": 1, "value": {...} },
    "onboarding": { "version": 1, "value": {...} },
    "memory_policy": { "version": 1, "value": {...} }
  },
  "cross_domain_workflows": [...],
  "context": { "endpoint": "/api/pipeline/context", "filters": { "group": "?group={group}", "skill": "?skill={skill}" } },
  "formats": [...],
  "workflows": {...}
}
```

### Tier 2: Domain Docs (new endpoint)

`GET /api/pipeline/docs/[domain]` serves markdown from `docs/cowork-docs-*.md` files.

6 domains:
- `items-and-sections` — Items CRUD + all section schemas + Tiptap (split from 76KB doc)
- `playlists` — Graph CRUD + edges + layout (from existing cowork-playlist-reference.md)
- `libraries` — Audio + B-roll CRUD + resolver (split from 76KB doc)
- `research` — Items + topics + links (split from 76KB doc)
- `youtube` — Intelligence + A/B tests (from existing cowork-youtube-intelligence-reference.md)
- `utilities` — Search + context + social + stats (new, ~100 lines)

### Tier 3: References (existing, with filters)

Enhanced `GET /api/pipeline/context` with new query params:
- `?group={group}` — filter by ref_group
- `?skill={skill}` — filter by skill-mappings directive
- `_system/*` entries excluded from normal calls (they're embedded in catalog)

---

## System Directives (in reference_content, group `sistema`)

Keys prefixed `_system/`:
- `_system/groups` — available reference categories (id, label, color, scope)
- `_system/skill-mappings` — which references each skill loads
- `_system/onboarding` — session protocol + rules + system prompt template
- `_system/memory-policy` — memory limits and rotation rules

The Cowork reads directives via the catalog (embedded). Updates them via existing `PUT /api/pipeline/context/:key`.

---

## Reference Reorganization

**Remove `api` group.** API docs move to Tier 2.

**Moves from Pessoal:**
- `content-calendar-taxonomy` → estrategia
- `featured-convention` → craft
- (8 manually-created refs to be verified and moved at implementation)

**Moves from API:**
- `cowork-section-schemas` → DELETE (content migrated to Tier 2 docs)
- `playlist-graph-api` → DELETE (content migrated to Tier 2 docs)
- `product-eval-catalog` → craft
- `product-eval-experience` → pessoal
- `product-eval-reference` → craft

**New group:** `sistema` for `_system/*` directive entries.

**Final groups (6):** pessoal, estrategia, craft, producao, memoria, sistema

---

## DB Changes

1. Replace rigid CHECK constraint with permissive regex: `ref_group ~ '^[a-z][a-z0-9_]{0,29}$'`
2. Add `sistema` group entries via seed script
3. Move misplaced references between groups

---

## Files Created

- `apps/web/src/lib/pipeline/api-registry.ts`
- `apps/web/src/app/api/pipeline/docs/[domain]/route.ts`
- `docs/cowork-docs-items-and-sections.md`
- `docs/cowork-docs-playlists.md`
- `docs/cowork-docs-libraries.md`
- `docs/cowork-docs-research.md`
- `docs/cowork-docs-youtube.md`
- `docs/cowork-docs-utilities.md`
- Migration SQL
- Tests

## Files Modified

- `apps/web/src/app/api/pipeline/route.ts`
- `apps/web/src/app/api/pipeline/context/route.ts`
- `apps/web/src/lib/pipeline/reference-groups.ts`
- `apps/web/src/lib/pipeline/schemas.ts`
- `apps/web/src/app/cms/(authed)/pipeline/_components/reference-editor.tsx`
- `scripts/seed-pipeline-reference.ts`

## Estimates

~20.5 hours total across 12 tasks.
