# Playlist Graph — Cowork API Reference Design Spec

**Date:** 2026-05-13
**Status:** Approved
**Scope:** New pipeline reference entry + 11 new API endpoints enabling Cowork to create, manage, and organize playlists programmatically

---

## Context

The Cowork pipeline agent (Claude) manages content through the Pipeline API, using `reference_content` entries as instruction context. Currently, playlists are only manageable through the CMS UI. The existing pipeline reference (`docs/cowork-pipeline-reference.md`) documents read-only playlist endpoints.

**Goal:** Enable Cowork to fully manage playlists — create playlists, add items, connect edges, reorder, and auto-layout — via new Pipeline API endpoints, documented in a dedicated reference entry.

**Current state:**
- 2 read-only endpoints: `GET /api/pipeline/playlists` (list) and `GET /api/pipeline/playlists/:id` (detail with graph)
- 30 reference entries in `reference_content` table across 6 groups
- `REFERENCE_USAGE` mapping in `reference-groups.ts` links keys to skills
- Pipeline auth via `X-Pipeline-Key` header, rate limit 100 req/min

---

## New Reference Entry

### Registration

| Field | Value |
|-------|-------|
| **key** | `playlist-graph-api` |
| **title** | `Playlist Graph — CRUD, Edges, Auto-Layout & Workflows [API Completa]` |
| **ref_group** | `api` |
| **sort_order** | `40` |

### REFERENCE_USAGE mapping

```typescript
'playlist-graph-api': ['Writer', 'Producer']
```

Writer and Producer are the skills that graduate pipeline items into published content and may need to add them to playlists.

### Content format

The reference content is stored as `content_md` (markdown). It documents all 11 new endpoints plus the 2 existing read-only ones, decision trees, workflows, edge cases, and naming conventions.

---

## New API Endpoints

All endpoints live under `/api/pipeline/playlists/`. All use pipeline authentication (`X-Pipeline-Key` header). All return `{ data: T }` on success, `{ error: { code: string, message: string } }` on failure.

### 1. POST `/api/pipeline/playlists` — Create playlist

**Request body:**
```json
{
  "name_en": "Getting Started with TypeScript",
  "name_pt": "Começando com TypeScript",
  "description_en": "A series for TypeScript beginners",
  "description_pt": "Uma série para iniciantes em TypeScript",
  "category": "typescript",
  "status": "draft"
}
```

**Required fields:** `name_en` (string, 1-200 chars)
**Optional fields:** `name_pt` (default `""`), `description_en`, `description_pt`, `category`, `status` (default `"draft"`)

**Slug generation:** Auto-generated from `name_en` via `slugifyPlaylist()`:
- NFD normalize → lowercase → replace non-alphanumeric with `-` → trim → max 80 chars
- Collision resolution: appends `-2`, `-3`, etc. if slug exists

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "name_en": "Getting Started with TypeScript",
    "name_pt": "Começando com TypeScript",
    "slug": "getting-started-with-typescript",
    "status": "draft",
    "category": "typescript",
    "description_en": "...",
    "description_pt": "...",
    "cover_image_url": null,
    "created_at": "2026-05-13T...",
    "updated_at": "2026-05-13T..."
  }
}
```

### 2. PATCH `/api/pipeline/playlists/:id` — Update playlist

**Request body (all fields optional):**
```json
{
  "name_en": "Updated Name",
  "name_pt": "Nome Atualizado",
  "description_en": "New description",
  "description_pt": "Nova descrição",
  "category": "react",
  "status": "published",
  "cover_image_url": "https://..."
}
```

Slug is NOT updatable via API (only via CMS). Omitted fields are preserved.

**Response (200):** Same shape as create.

### 3. DELETE `/api/pipeline/playlists/:id` — Delete playlist

Cascading delete — removes all items and edges.

**Response (200):**
```json
{ "data": { "deleted": true } }
```

### 4. POST `/api/pipeline/playlists/:id/items` — Add single item

**Request body:**
```json
{
  "blog_post_id": "uuid",
  "sort_order": 3000,
  "position_x": 400,
  "position_y": 200
}
```

Exactly one of `blog_post_id`, `newsletter_edition_id`, or `pipeline_id` is required.

**Optional:** `sort_order` (default: auto-increment by 1000), `position_x` (default: 0), `position_y` (default: 0).

**Idempotent:** If the content is already in the playlist, returns `{ data: { id: "existing-item-uuid", already_existed: true } }` with status 200 (not an error).

**Response (201 or 200):**
```json
{
  "data": {
    "id": "uuid",
    "already_existed": false
  }
}
```

### 5. POST `/api/pipeline/playlists/:id/items/bulk` — Add multiple items

**Request body:**
```json
{
  "items": [
    { "blog_post_id": "uuid-1" },
    { "pipeline_id": "uuid-2", "sort_order": 2000 },
    { "newsletter_edition_id": "uuid-3" }
  ]
}
```

Max 50 items per request. Each item follows the same schema as single add.

**Response (200):**
```json
{
  "data": {
    "items": [
      { "id": "uuid", "already_existed": false },
      { "id": "uuid", "already_existed": true },
      { "id": "uuid", "already_existed": false }
    ],
    "added": 2,
    "skipped": 1
  }
}
```

### 6. DELETE `/api/pipeline/playlists/:id/items/:itemId` — Remove item

Cascading — also removes edges connected to this item.

**Response (200):**
```json
{ "data": { "deleted": true } }
```

### 7. POST `/api/pipeline/playlists/:id/edges` — Create single edge

**Request body:**
```json
{
  "source_item_id": "uuid",
  "target_item_id": "uuid",
  "edge_type": "sequence",
  "label": "optional label"
}
```

**Edge types:**

| Type | Meaning | Visual |
|------|---------|--------|
| `sequence` | Linear reading order | Blue solid arrow |
| `related` | "See also" | Gray dashed line |
| `prerequisite` | "Read first" | Yellow dashed arrow |
| `continuation` | Direct continuation | Green solid arrow |

**Constraints:**
- `source_item_id !== target_item_id` (no self-loops — DB constraint)
- Sequence edges cannot create cycles (DB trigger `prevent_sequence_cycle`)
- Duplicate edge returns existing ID (idempotent)

**Response (201 or 200):**
```json
{
  "data": {
    "id": "uuid",
    "already_existed": false
  }
}
```

### 8. POST `/api/pipeline/playlists/:id/edges/bulk` — Create multiple edges

**Request body:**
```json
{
  "edges": [
    { "source_item_id": "uuid-a", "target_item_id": "uuid-b", "edge_type": "sequence" },
    { "source_item_id": "uuid-b", "target_item_id": "uuid-c", "edge_type": "sequence" }
  ]
}
```

Max 100 edges per request. Processed sequentially to respect cycle detection.

**Response (200):**
```json
{
  "data": {
    "edges": [
      { "id": "uuid", "already_existed": false },
      { "id": "uuid", "already_existed": false }
    ],
    "created": 2,
    "skipped": 0,
    "errors": []
  }
}
```

Partial success is possible — `errors` array contains failed edges with reasons (e.g., cycle detected).

### 9. DELETE `/api/pipeline/playlists/:id/edges/:edgeId` — Delete edge

**Response (200):**
```json
{ "data": { "deleted": true } }
```

### 10. POST `/api/pipeline/playlists/:id/reorder` — Reorder items

**Request body:**
```json
{
  "item_ids": ["uuid-first", "uuid-second", "uuid-third"]
}
```

All item IDs must belong to the playlist. Sort orders are reassigned as 1000, 2000, 3000, etc.

**Response (200):**
```json
{ "data": { "reordered": true, "count": 3 } }
```

### 11. POST `/api/pipeline/playlists/:id/auto-layout` — Auto-layout graph

Applies topological sort (Kahn's algorithm) using sequence edges to compute node positions. Items without sequence edges go to layer 0.

**Layout parameters:**
- Horizontal gap: 200px between layers
- Vertical gap: 120px between nodes in same layer

No request body required.

**Response (200):**
```json
{
  "data": {
    "positions": [
      { "item_id": "uuid", "position_x": 0, "position_y": 0 },
      { "item_id": "uuid", "position_x": 200, "position_y": 0 },
      { "item_id": "uuid", "position_x": 400, "position_y": 0 }
    ],
    "layers": 3
  }
}
```

Positions are saved to the database. The CMS canvas will reflect the new layout.

---

## Existing Read-Only Endpoints (already implemented)

### GET `/api/pipeline/playlists` — List all playlists

Supports query parameters:
- `?status=draft|published|archived` — filter by status
- `?category=typescript` — filter by category
- `?search=keyword` — search in name_en, name_pt

**Response:** Array of playlist summaries with `item_count`.

### GET `/api/pipeline/playlists/:id` — Get playlist with full graph

**Response:** `{ playlist, items[], edges[] }` — complete graph data including enriched item titles, content types, statuses, and cross-playlist counts.

---

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Invalid or missing `X-Pipeline-Key` |
| `FORBIDDEN` | 403 | Key lacks `write` permission |
| `NOT_FOUND` | 404 | Playlist or item not found |
| `VALIDATION_ERROR` | 400 | Invalid request body (Zod validation) |
| `ALREADY_EXISTS` | 409 | Slug collision (create only) |
| `CYCLE_DETECTED` | 422 | Sequence edge would create a cycle |
| `LIMIT_EXCEEDED` | 400 | Bulk operation exceeds max items |

---

## Decision Tree for Cowork

```
Tarefa envolve conteúdo organizado em série/sequência?
├─ SIM → Playlist existe para esse tema?
│   ├─ SIM → GET /playlists/:id para ver grafo atual
│   │   ├─ Adicionar item → POST /playlists/:id/items
│   │   ├─ Conectar items → POST /playlists/:id/edges
│   │   ├─ Reorganizar → POST /playlists/:id/reorder
│   │   └─ Auto-organizar visual → POST /playlists/:id/auto-layout
│   └─ NÃO → POST /playlists para criar nova
│       └─ Depois: adicionar items + edges + auto-layout
├─ NÃO → Não usar playlists
└─ DÚVIDA → GET /playlists para ver playlists existentes
```

---

## Workflows

### Workflow 1: Graduation — Add published content to playlist

When a pipeline item graduates (e.g., blog post published):

1. `GET /api/pipeline/playlists?category={category}` — find matching playlist
2. If no match: `POST /api/pipeline/playlists` — create new playlist
3. `POST /api/pipeline/playlists/:id/items` — add the graduated content
4. `GET /api/pipeline/playlists/:id` — check existing items
5. `POST /api/pipeline/playlists/:id/edges` — connect to last item (sequence edge)
6. `POST /api/pipeline/playlists/:id/auto-layout` — reorganize the graph

### Workflow 2: Build a complete learning path

1. `POST /api/pipeline/playlists` — create playlist with descriptive name
2. `POST /api/pipeline/playlists/:id/items/bulk` — add all items at once
3. `POST /api/pipeline/playlists/:id/edges/bulk` — connect items in sequence
4. `POST /api/pipeline/playlists/:id/auto-layout` — arrange the graph
5. `PATCH /api/pipeline/playlists/:id` — set status to `published`

### Workflow 3: Cross-reference related content

1. `GET /api/pipeline/playlists` — find two related playlists
2. For each: `POST /playlists/:id/items` — add item from the other playlist's topic
3. `POST /playlists/:id/edges` — use `related` edge type (not sequence)

---

## Naming Conventions

| Concept | Convention | Example |
|---------|-----------|---------|
| Playlist name | Descriptive, title case | "Getting Started with TypeScript" |
| Playlist name_pt | Portuguese translation | "Começando com TypeScript" |
| Category | Lowercase, single word or hyphenated | "typescript", "react-native" |
| Slug | Auto-generated, do not set manually | "getting-started-with-typescript" |
| Edge labels | Short action phrase or null | "Read first", null |

---

## Constraints and Edge Cases

1. **Unique items:** Each content piece appears at most once per playlist (DB constraint). Attempting to add a duplicate returns the existing item ID.
2. **No self-loops:** `source_item_id !== target_item_id` enforced by DB constraint.
3. **No sequence cycles:** DB trigger `prevent_sequence_cycle` rejects sequence edges that would create cycles. Other edge types (related, prerequisite, continuation) allow cycles.
4. **Sort order gaps:** Use increments of 1000 (1000, 2000, 3000) to allow future insertions without reordering.
5. **Ghost items:** When referenced content is deleted (e.g., blog post removed), the playlist item becomes a "ghost" (`is_ghost: true`, `title: "Content removed"`). Cowork should clean up ghosts when detected.
6. **Cascading deletes:** Deleting a playlist removes all items and edges. Deleting an item removes its connected edges.
7. **Viewport state:** Not exposed via Pipeline API (CMS-only). Auto-layout handles positioning.
8. **Slug collisions:** On create, if the generated slug collides, the API appends `-2`, `-3`, etc.

---

## File Changes Summary

| File | Change |
|------|--------|
| `apps/web/src/app/api/pipeline/playlists/route.ts` | Add POST handler (create playlist), add query filters to GET |
| `apps/web/src/app/api/pipeline/playlists/[id]/route.ts` | Add PATCH and DELETE handlers |
| `apps/web/src/app/api/pipeline/playlists/[id]/items/route.ts` | **New** — POST single item |
| `apps/web/src/app/api/pipeline/playlists/[id]/items/bulk/route.ts` | **New** — POST bulk items |
| `apps/web/src/app/api/pipeline/playlists/[id]/items/[itemId]/route.ts` | **New** — DELETE item |
| `apps/web/src/app/api/pipeline/playlists/[id]/edges/route.ts` | **New** — POST single edge |
| `apps/web/src/app/api/pipeline/playlists/[id]/edges/bulk/route.ts` | **New** — POST bulk edges |
| `apps/web/src/app/api/pipeline/playlists/[id]/edges/[edgeId]/route.ts` | **New** — DELETE edge |
| `apps/web/src/app/api/pipeline/playlists/[id]/reorder/route.ts` | **New** — POST reorder |
| `apps/web/src/app/api/pipeline/playlists/[id]/auto-layout/route.ts` | **New** — POST auto-layout |
| `apps/web/src/lib/pipeline/reference-groups.ts` | Add `'playlist-graph-api'` to `REFERENCE_USAGE` |
| `apps/web/src/lib/playlists/queries.ts` | Add query filters (status, category, search) to `listPlaylists` |
| `scripts/seed-pipeline-reference.ts` | Add `playlist-graph-api` entry seeding |
| `docs/cowork-pipeline-reference.md` | Reduce playlist section to cross-reference pointer |

---

## Pipeline API Zod Schemas (new)

```typescript
// In a new file or extending existing schemas

export const PipelineCreatePlaylistSchema = z.object({
  name_en: z.string().min(1).max(200),
  name_pt: z.string().max(200).default(''),
  description_en: z.string().max(1000).optional(),
  description_pt: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
})

export const PipelineUpdatePlaylistSchema = z.object({
  name_en: z.string().min(1).max(200).optional(),
  name_pt: z.string().max(200).optional(),
  description_en: z.string().max(1000).nullable().optional(),
  description_pt: z.string().max(1000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  cover_image_url: z.string().url().nullable().optional(),
})

export const PipelineAddItemSchema = z.object({
  blog_post_id: z.string().uuid().optional(),
  newsletter_edition_id: z.string().uuid().optional(),
  pipeline_id: z.string().uuid().optional(),
  sort_order: z.number().int().min(0).optional(),
  position_x: z.number().optional(),
  position_y: z.number().optional(),
}).refine(
  d => [d.blog_post_id, d.newsletter_edition_id, d.pipeline_id].filter(Boolean).length === 1,
  { message: 'Exactly one content reference is required' },
)

export const PipelineBulkAddItemsSchema = z.object({
  items: z.array(PipelineAddItemSchema).min(1).max(50),
})

export const PipelineCreateEdgeSchema = z.object({
  source_item_id: z.string().uuid(),
  target_item_id: z.string().uuid(),
  edge_type: z.enum(['sequence', 'related', 'prerequisite', 'continuation']),
  label: z.string().max(100).optional(),
})

export const PipelineBulkCreateEdgesSchema = z.object({
  edges: z.array(PipelineCreateEdgeSchema).min(1).max(100),
})

export const PipelineReorderSchema = z.object({
  item_ids: z.array(z.string().uuid()).min(1),
})
```

---

## Reference Content (content_md)

The actual markdown content stored in `reference_content` will be a condensed, agent-optimized version of this spec — focusing on endpoint signatures, request/response examples, the decision tree, and workflows. It will follow the same documentation style as the existing `cowork-section-schemas` reference.

---

## Verification Checklist

- [ ] All 11 new endpoints respond correctly with pipeline auth
- [ ] Slug auto-generation with collision resolution works
- [ ] Idempotent add item returns existing ID
- [ ] Idempotent create edge returns existing ID
- [ ] Bulk operations respect limits (50 items, 100 edges)
- [ ] Cycle detection rejects cyclic sequence edges
- [ ] Auto-layout computes correct positions via topological sort
- [ ] Query filters (status, category, search) work on GET list
- [ ] `playlist-graph-api` reference entry exists in `reference_content`
- [ ] `REFERENCE_USAGE` includes `'playlist-graph-api'`
- [ ] Existing read-only endpoints still work
- [ ] All tests pass
