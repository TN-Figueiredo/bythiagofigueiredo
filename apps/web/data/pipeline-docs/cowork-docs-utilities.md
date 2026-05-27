# Utilities — Search, Context, Stats, Topics & Catalog

Cross-cutting endpoints for discovery, reference management, and pipeline intelligence.

---

## Catalog — `GET /api/pipeline/`

The root endpoint. Returns the full API catalog: capabilities, system directives, workflow definitions, and context filters.

**Response shape:**
```json
{
  "data": {
    "name": "Content Pipeline API",
    "version": "2.0.0",
    "auth": { "header": "X-Pipeline-Key", "rateLimit": "100/min" },
    "capabilities": [ /* 6 domain objects with endpoints */ ],
    "directives": {
      "groups": { "version": 3, "value": { "groups": [...] } },
      "skill-mappings": { "version": 2, "value": { "ideator": [...], "writer": [...], ... } },
      "onboarding": { "version": 1, "value": { "system_prompt_template": "..." } },
      "memory-policy": { "version": 1, "value": { "max_size_kb": 100, ... } }
    },
    "cross_domain_workflows": [...],
    "context": {
      "endpoint": "/api/pipeline/context",
      "filters": { "group": "?group={id}", "skill": "?skill={name}", "format": "?format=md" }
    },
    "formats": ["video", "blog_post", "newsletter", "course", "campaign"],
    "workflows": { /* stage definitions per format */ }
  }
}
```

**Usage:** Call this first in any Cowork session. It provides everything needed to discover the API surface and load the right context for a skill.

---

## Search — `GET /api/pipeline/search`

Cross-entity full-text search across pipeline items, blog posts, and newsletters.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | *required* | Search term (min 2 chars, max 200) |
| `limit` | number | 20 | Max pipeline results (capped at 50). Blog/newsletter always max 10 |

**Search behavior:**
- Pipeline items: PostgreSQL `tsvector` full-text search on `search_vector` column
- Blog posts: ILIKE match on `title` and `slug`
- Newsletters: ILIKE match on `subject`

**Response:**
```json
{
  "data": {
    "pipeline": [{ "id": "...", "code": "...", "title_pt": "...", "format": "video", "stage": "roteiro", "priority": 3, "tags": [...] }],
    "blog_posts": [{ "id": "...", "title": "...", "slug": "...", "status": "published", "category": "tech" }],
    "newsletters": [{ "id": "...", "subject": "...", "status": "sent" }]
  },
  "meta": { "query": "...", "limit": 20 }
}
```

---

## Context (References) — `/api/pipeline/context`

### List references — `GET /api/pipeline/context`

Returns reference content entries filtered by group, skill, or format.

| Param | Type | Description |
|-------|------|-------------|
| `group` | string | Filter by ref_group (e.g., `pessoal`, `estrategia`, `craft`, `producao`, `memoria`, `sistema`) |
| `skill` | string | Filter by skill mapping (e.g., `ideator`, `writer`, `producer`, `product_eval`, `perf_review`, `curator`, `architect`). Resolves keys from `_system/skill-mappings` |
| `format` | `md` or `compact` | `md` = full markdown content. Default = compact JSON if available, falls back to markdown |

**Behavior:**
- Without `group` param: excludes `_system/*` entries automatically
- With `skill` param: returns only the references mapped to that skill (via `_system/skill-mappings`)
- Sorted by `ref_group → sort_order → key`

**Response:**
```json
{
  "data": [{
    "key": "personal-profile",
    "title": "Personal Profile",
    "content": "# eu sou Thiago...",
    "ref_group": "pessoal",
    "sort_order": 0,
    "version": 3,
    "updated_at": "2026-05-19T..."
  }]
}
```

### Get single reference — `GET /api/pipeline/context/:key`

Returns the full reference entry for a specific key (e.g., `personal-profile`, `writer-voice-guide`).

### Upsert reference — `PUT /api/pipeline/context/:key`

Create or update a reference entry. Uses `X-Expected-Version` for optimistic concurrency.

**Body:**
```json
{
  "title": "Reference Title",
  "content_md": "# Markdown content...",
  "content_compact": { "structured": "data" },
  "ref_group": "memoria",
  "sort_order": 10
}
```

### Delete reference — `DELETE /api/pipeline/context/:key`

Permanently removes a reference entry. **Requires explicit operator approval per system directives.**

---

## Stats — `GET /api/pipeline/stats`

Aggregate pipeline statistics. No parameters.

**Response:**
```json
{
  "data": {
    "total": 142,
    "archived": 18,
    "by_format": {
      "video": { "total": 45, "byStage": { "idea": 12, "roteiro": 8, "gravacao": 5, ... } },
      "blog_post": { "total": 30, "byStage": { ... } }
    },
    "recently_updated_7d": 23,
    "by_priority": { "critical": 3, "high": 15, "medium": 40, "low": 84 }
  }
}
```

**Formats tracked:** video, blog_post, newsletter, course, campaign. Each format has its own workflow stages.

---

## Topics — `GET /api/pipeline/topics/:code`

Aggregates pipeline items and blog posts for a given tag/topic code.

**Response:**
```json
{
  "data": {
    "topic": "ai-tools",
    "pipeline_items": [{ "id": "...", "code": "...", "title_pt": "...", "format": "video", "stage": "edicao", "priority": 4, "tags": ["ai-tools", "review"] }],
    "blog_posts": [{ "id": "...", "title": "...", "slug": "...", "status": "published", "category": "ai-tools" }]
  }
}
```

**Matching:** Pipeline items matched via `tags` array containment; blog posts matched via `category` field.

---

## Workflows — `GET /api/pipeline/` (included in catalog)

Workflow stage definitions for each content format, included in the catalog response. Each format defines ordered stages:

- **video:** idea → roteiro → gravacao → edicao → pos_producao → scheduled → published
- **blog_post:** idea → draft → ready → scheduled → published
- **newsletter:** idea → draft → ready → scheduled → published
- **course:** idea → outline → modulos → review → published
- **campaign:** idea → draft → approved → scheduled → sent

Items advance/retreat through stages via `POST /api/pipeline/items/:id/advance` and `POST /api/pipeline/items/:id/retreat`.

---

## Common Patterns

**Authentication:** All endpoints require `X-Pipeline-Key` header. Rate limit: 100 req/min.

**Error format:**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Query must be at least 2 characters" } }
```

**Typical Cowork session flow:**
1. `GET /api/pipeline/` — discover capabilities + directives
2. `GET /api/pipeline/context?skill={skill}` — load references for the current task
3. `GET /api/pipeline/docs/{domain}` — load detailed docs if needed
4. Execute task using domain endpoints
5. `PUT /api/pipeline/context/{skill}-memory` — persist session learnings

## GET /api/pipeline/up-next

Command center endpoint. Returns today's prioritized actions, weekly slot grid, streak, stage counts, playlist summaries, candidates for slot assignment, and contextual suggestion. Each section is computed independently with per-section error isolation.

**Query params:**
- `maxCards` (number, default 5) — max action cards to return
- `tz` (string, default "America/Sao_Paulo") — IANA timezone for date calculations

**Response 200:** `{ data: UpNextApiResponse }`

## POST /api/pipeline/up-next

Assign or swap a pipeline item in a week slot. Sets `scheduled_at` on the target item. When swapping, clears `scheduled_at` on the previous item first.

**Body (JSON):**
- `itemId` (uuid, required) — pipeline item to assign
- `slotDay` (string "YYYY-MM-DD", required) — target day
- `slotHour` (string or null, default null) — target hour (e.g. "14:00")
- `previousItemId` (uuid, optional) — item to unschedule when swapping

**Response 200:** `{ data: { id, scheduled_at } }`
**Errors:** 400 validation, 404 item not found or wrong site
