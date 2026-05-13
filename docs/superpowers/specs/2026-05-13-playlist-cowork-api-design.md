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
- Existing playlist routes use inconsistent error format (`{ error: string }`) — must be standardized to `{ error: { code, message } }` matching all other pipeline routes

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

---

## API Design Standards

### Error format

All playlist pipeline endpoints (new AND existing) use the standard pipeline error format:

```json
{ "error": { "code": "ERROR_CODE", "message": "Human-readable description" } }
```

This matches `/api/pipeline/context/`, `/api/pipeline/items/`, and `/api/pipeline/search/`. The 2 existing read-only playlist routes currently return `{ error: string }` — they MUST be migrated to `{ error: { code, message } }` as part of this work.

### Auth and permissions

All endpoints call `authenticatePipeline(req)` for auth. **Mutation endpoints** (POST, PATCH, DELETE) additionally call `requirePermission(authResult.auth, 'write')` — returning 403 `FORBIDDEN` if the key lacks write access. Read endpoints (GET) only require the `read` permission (implicit via `authenticatePipeline`).

The existing read-only routes do NOT check `requirePermission` for read — this is acceptable because `authenticatePipeline` already validates the key exists.

### Rate limit headers

All responses include rate limit headers when authenticated via API key:
```
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 42
```

Generated via `buildRateLimitHeaders(authResult.auth)` (returns `undefined` for session auth, which is correct).

---

## New API Endpoints

All endpoints live under `/api/pipeline/playlists/`. All return `{ data: T }` on success, `{ error: { code: string, message: string } }` on failure.

### 1. POST `/api/pipeline/playlists` — Create playlist

**Auth:** `write` permission required.

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
- Collision resolution: query `getPlaylistBySlug()`, if exists append `-2`, retry up to `-99`. If all 99 collide, return `ALREADY_EXISTS` error (practically impossible — would mean 99 playlists with near-identical names).

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

**Auth:** `write` permission required.

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

Slug is NOT updatable via API — slug changes break external links and TipTap embeds. CMS-only operation with explicit confirmation. Omitted fields are preserved (not nullified).

**Response (200):** Same shape as create.
**404:** If playlist doesn't exist or belongs to another site.

### 3. DELETE `/api/pipeline/playlists/:id` — Delete playlist

**Auth:** `write` permission required.

Cascading delete — removes all items and edges (via DB `ON DELETE CASCADE`).

**Response (200):**
```json
{ "data": { "deleted": true } }
```

**404:** If playlist doesn't exist or belongs to another site.

### 4. POST `/api/pipeline/playlists/:id/items` — Add single item

**Auth:** `write` permission required.

**Request body:**
```json
{
  "blog_post_id": "uuid",
  "sort_order": 3000,
  "position_x": 400,
  "position_y": 200
}
```

Exactly one of `blog_post_id`, `newsletter_edition_id`, or `pipeline_id` is required. Providing zero or multiple returns `VALIDATION_ERROR`.

**Optional:** `sort_order` (default: auto-increment — queries max existing `sort_order` + 1000), `position_x` (default: 0), `position_y` (default: 0).

**Idempotent:** If the content is already in the playlist, returns the existing item ID with `already_existed: true` and status 200 (not an error).

**FK error:** If the referenced content ID doesn't exist in `blog_posts`/`newsletter_editions`/`content_pipeline`, the DB FK constraint fails. Return `VALIDATION_ERROR` with message `"Referenced content does not exist"`.

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

**Auth:** `write` permission required.

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

**Sort order auto-assignment for bulk:** Items without explicit `sort_order` are assigned sequentially starting from `(max_existing_sort_order + 1000)`, incrementing by 1000 for each item. Items with explicit `sort_order` use their specified value. Processing order matches array order.

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

**Auth:** `write` permission required.

Cascading — also removes edges connected to this item (via DB `ON DELETE CASCADE` on `playlist_edges.source_item_id` and `playlist_edges.target_item_id`).

Validates item belongs to the specified playlist. Returns `NOT_FOUND` if the item doesn't exist or belongs to a different playlist.

**Response (200):**
```json
{ "data": { "deleted": true } }
```

### 7. POST `/api/pipeline/playlists/:id/edges` — Create single edge

**Auth:** `write` permission required.

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

| Type | Meaning | Visual | Cycle-safe |
|------|---------|--------|-----------|
| `sequence` | Linear reading order | Blue solid arrow | No cycles (DB trigger rejects) |
| `related` | "See also" | Gray dashed line | Cycles allowed |
| `prerequisite` | "Read first" | Yellow dashed arrow | Cycles allowed |
| `continuation` | Direct continuation | Green solid arrow | Cycles allowed |

**Constraints:**
- `source_item_id !== target_item_id` (no self-loops — DB constraint `playlist_edges_no_self`)
- Sequence edges cannot create cycles (DB trigger `prevent_sequence_cycle` — raises `P0001`)
- Both items must belong to the same playlist (verified by `playlist_id` match)
- Duplicate edge (same source + target + playlist) returns existing ID with `already_existed: true` (idempotent)

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

**Auth:** `write` permission required.

**Request body:**
```json
{
  "edges": [
    { "source_item_id": "uuid-a", "target_item_id": "uuid-b", "edge_type": "sequence" },
    { "source_item_id": "uuid-b", "target_item_id": "uuid-c", "edge_type": "sequence" }
  ]
}
```

Max 100 edges per request. Processed **sequentially** (not parallel) to respect cycle detection — each edge insertion triggers the `prevent_sequence_cycle` DB trigger, which must see previously inserted edges to correctly detect cycles.

**Partial success:** If edge 3 of 5 causes a cycle, edges 1-2 are kept, edge 3 is reported in `errors`, edges 4-5 continue processing.

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
    "errors": [
      { "index": 2, "source_item_id": "uuid-x", "target_item_id": "uuid-y", "code": "CYCLE_DETECTED", "message": "Sequence edge would create a cycle" }
    ]
  }
}
```

### 9. DELETE `/api/pipeline/playlists/:id/edges/:edgeId` — Delete edge

**Auth:** `write` permission required.

Validates edge belongs to the specified playlist. Returns `NOT_FOUND` if the edge doesn't exist or belongs to a different playlist.

**Response (200):**
```json
{ "data": { "deleted": true } }
```

### 10. POST `/api/pipeline/playlists/:id/reorder` — Reorder items

**Auth:** `write` permission required.

**Request body:**
```json
{
  "item_ids": ["uuid-first", "uuid-second", "uuid-third"]
}
```

`item_ids` is a **partial or full** list. Only the listed items get new sort orders (1000, 2000, 3000, etc.). Items NOT in the list keep their current `sort_order` unchanged. This allows reordering a subset without affecting the rest.

All listed item IDs must belong to the specified playlist — returns `VALIDATION_ERROR` if any ID is foreign.

**Response (200):**
```json
{ "data": { "reordered": true, "count": 3 } }
```

### 11. POST `/api/pipeline/playlists/:id/auto-layout` — Auto-layout graph

**Auth:** `write` permission required.

Applies topological sort (Kahn's algorithm) using sequence edges to compute node positions. Items without sequence edges go to layer 0. Items within the same layer are sorted by `sort_order`.

**Layout parameters (constants from `auto-layout.ts`):**
- Horizontal gap: 200px between layers (`LAYER_GAP_X`)
- Vertical gap: 120px between nodes in same layer (`NODE_GAP_Y`)

No request body required.

**Empty playlist:** Returns `{ data: { positions: [], layers: 0 } }` with status 200.

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

Positions are saved to the database via batch `UPDATE playlist_items SET position_x, position_y`. The CMS canvas will reflect the new layout on next load.

---

## Existing Endpoints (standardization required)

### GET `/api/pipeline/playlists` — List all playlists

**Current:** Returns `{ data: [...] }` — no filters.
**After:** Adds query parameters:

| Parameter | Type | Behavior |
|-----------|------|----------|
| `?status=draft` | string | Exact match on `playlists.status` |
| `?category=typescript` | string | Case-insensitive match on `playlists.category` |
| `?search=keyword` | string | `ilike` on `name_en` OR `name_pt` (min 2 chars) |

All filters are optional, combinable, and AND-joined.

**Error format migration:** Change `{ error: authResult.error }` → `{ error: { code: 'UNAUTHORIZED', message: authResult.error } }`.

**Response:** Array of playlist summaries with `item_count`.

### GET `/api/pipeline/playlists/:id` — Get playlist with full graph

**Error format migration:** Change `{ error: 'not_found' }` → `{ error: { code: 'NOT_FOUND', message: 'Playlist not found' } }`.

**Response:** `{ playlist, items[], edges[] }` — complete graph data including enriched item titles, content types, statuses, and cross-playlist counts.

---

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `UNAUTHORIZED` | 401 | Invalid or missing `X-Pipeline-Key` |
| `FORBIDDEN` | 403 | Key lacks `write` permission |
| `NOT_FOUND` | 404 | Playlist, item, or edge not found (or belongs to different site) |
| `VALIDATION_ERROR` | 400 | Invalid JSON, Zod validation failure, or FK constraint violation |
| `ALREADY_EXISTS` | 409 | Slug collision after 99 suffix attempts (create only) |
| `CYCLE_DETECTED` | 422 | Sequence edge would create a cycle (Postgres `P0001`) |
| `LIMIT_EXCEEDED` | 400 | Bulk items > 50 or bulk edges > 100 |

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

### Workflow 1: Graduação — Adicionar conteúdo publicado à playlist

Quando um pipeline item é graduado (ex: blog post publicado):

1. `GET /api/pipeline/playlists?category={category}` — buscar playlist compatível
2. Se não encontrar: `POST /api/pipeline/playlists` — criar nova playlist
3. `GET /api/pipeline/playlists/:id` — ler grafo atual para saber último item
4. `POST /api/pipeline/playlists/:id/items` — adicionar conteúdo graduado
5. `POST /api/pipeline/playlists/:id/edges` — conectar ao último item existente (edge type `sequence`)
6. `POST /api/pipeline/playlists/:id/auto-layout` — reorganizar o grafo

### Workflow 2: Construir learning path completo

1. `POST /api/pipeline/playlists` — criar playlist com nome descritivo
2. `POST /api/pipeline/playlists/:id/items/bulk` — adicionar todos os items de uma vez
3. `POST /api/pipeline/playlists/:id/edges/bulk` — conectar items em sequência
4. `POST /api/pipeline/playlists/:id/auto-layout` — organizar o grafo automaticamente
5. `PATCH /api/pipeline/playlists/:id` — definir status como `published`

### Workflow 3: Cross-reference entre playlists

1. `GET /api/pipeline/playlists` — encontrar duas playlists relacionadas
2. Para cada: `POST /playlists/:id/items` — adicionar item do tópico da outra playlist
3. `POST /playlists/:id/edges` — usar edge type `related` (não `sequence`)

### Workflow 4: Limpeza de ghosts

1. `GET /api/pipeline/playlists/:id` — ler grafo
2. Filtrar items onde `is_ghost === true` (conteúdo fonte foi deletado)
3. Para cada ghost: `DELETE /api/pipeline/playlists/:id/items/:itemId`
4. `POST /api/pipeline/playlists/:id/auto-layout` — reorganizar após remoções

---

## Naming Conventions

| Conceito | Convenção | Exemplo |
|----------|-----------|---------|
| Nome playlist (EN) | Descritivo, title case | "Getting Started with TypeScript" |
| Nome playlist (PT) | Tradução em português | "Começando com TypeScript" |
| Category | Lowercase, palavra única ou hyphenated | "typescript", "react-native" |
| Slug | Auto-gerado, nunca definir manualmente | "getting-started-with-typescript" |
| Edge labels | Frase curta de ação ou null | "Leia antes", null |

---

## Constraints and Edge Cases

1. **Unique items:** Cada conteúdo aparece no máximo uma vez por playlist (DB unique index parcial). Tentar adicionar duplicata retorna o item existente (idempotente).
2. **No self-loops:** `source_item_id !== target_item_id` — DB constraint `playlist_edges_no_self`.
3. **No sequence cycles:** DB trigger `prevent_sequence_cycle` rejeita sequence edges que criariam ciclos. Outros edge types (related, prerequisite, continuation) permitem referências circulares.
4. **Sort order gaps:** Usar incrementos de 1000 (1000, 2000, 3000) para permitir inserções intermediárias sem reordenar tudo.
5. **Ghost items:** Quando conteúdo referenciado é deletado (ex: blog post removido), o playlist item se torna "ghost" (`is_ghost: true`, `title: "Content removed"`). Cowork deve limpar ghosts quando detectar (Workflow 4).
6. **Cascading deletes:** Deletar playlist remove todos items e edges. Deletar item remove edges conectadas.
7. **Viewport state:** Não exposto via Pipeline API (apenas CMS). Auto-layout cuida do posicionamento.
8. **Slug collisions:** Na criação, se slug colide, API tenta sufixos `-2` até `-99`. Se todos colidem (praticamente impossível), retorna `ALREADY_EXISTS`.
9. **FK violations:** Se `blog_post_id`/`newsletter_edition_id`/`pipeline_id` referencia conteúdo inexistente, DB rejeita com FK violation → API retorna `VALIDATION_ERROR`.
10. **Partial reorder:** `item_ids` no endpoint reorder pode ser subconjunto — só os listados recebem novo `sort_order`.
11. **Empty auto-layout:** Playlist vazia retorna `{ positions: [], layers: 0 }`.

---

## File Changes Summary

| File | Change |
|------|--------|
| `apps/web/src/app/api/pipeline/playlists/route.ts` | Add POST handler, add query filters to GET, standardize error format |
| `apps/web/src/app/api/pipeline/playlists/[id]/route.ts` | Add PATCH and DELETE handlers, standardize error format |
| `apps/web/src/app/api/pipeline/playlists/[id]/items/route.ts` | **New** — POST single item |
| `apps/web/src/app/api/pipeline/playlists/[id]/items/bulk/route.ts` | **New** — POST bulk items |
| `apps/web/src/app/api/pipeline/playlists/[id]/items/[itemId]/route.ts` | **New** — DELETE item |
| `apps/web/src/app/api/pipeline/playlists/[id]/edges/route.ts` | **New** — POST single edge |
| `apps/web/src/app/api/pipeline/playlists/[id]/edges/bulk/route.ts` | **New** — POST bulk edges |
| `apps/web/src/app/api/pipeline/playlists/[id]/edges/[edgeId]/route.ts` | **New** — DELETE edge |
| `apps/web/src/app/api/pipeline/playlists/[id]/reorder/route.ts` | **New** — POST reorder |
| `apps/web/src/app/api/pipeline/playlists/[id]/auto-layout/route.ts` | **New** — POST auto-layout |
| `apps/web/src/lib/pipeline/schemas.ts` | Add Pipeline playlist Zod schemas |
| `apps/web/src/lib/pipeline/reference-groups.ts` | Add `'playlist-graph-api'` to `REFERENCE_USAGE` |
| `apps/web/src/lib/playlists/queries.ts` | Extend `listPlaylists` with category, search filters |
| `scripts/seed-pipeline-reference.ts` | Add `playlist-graph-api` entry seeding with content_md |
| `docs/cowork-pipeline-reference.md` | Replace playlist section with cross-reference pointer |

---

## Pipeline API Zod Schemas

All new schemas go in `apps/web/src/lib/pipeline/schemas.ts` alongside the existing `ReferenceContentUpsertSchema`:

```typescript
import { EDGE_TYPES, PLAYLIST_STATUSES } from '@/lib/playlists/types'

export const PipelineCreatePlaylistSchema = z.object({
  name_en: z.string().min(1).max(200),
  name_pt: z.string().max(200).default(''),
  description_en: z.string().max(1000).optional(),
  description_pt: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  status: z.enum(PLAYLIST_STATUSES).default('draft'),
})

export const PipelineUpdatePlaylistSchema = z.object({
  name_en: z.string().min(1).max(200).optional(),
  name_pt: z.string().max(200).optional(),
  description_en: z.string().max(1000).nullable().optional(),
  description_pt: z.string().max(1000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  status: z.enum(PLAYLIST_STATUSES).optional(),
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
  items: z.array(z.object({
    blog_post_id: z.string().uuid().optional(),
    newsletter_edition_id: z.string().uuid().optional(),
    pipeline_id: z.string().uuid().optional(),
    sort_order: z.number().int().min(0).optional(),
    position_x: z.number().optional(),
    position_y: z.number().optional(),
  })).min(1).max(50),
})

export const PipelineCreateEdgeSchema = z.object({
  source_item_id: z.string().uuid(),
  target_item_id: z.string().uuid(),
  edge_type: z.enum(EDGE_TYPES),
  label: z.string().max(100).optional(),
})

export const PipelineBulkCreateEdgesSchema = z.object({
  edges: z.array(PipelineCreateEdgeSchema).min(1).max(100),
})

export const PipelineReorderSchema = z.object({
  item_ids: z.array(z.string().uuid()).min(1),
})
```

Note: `PipelineBulkAddItemsSchema` uses inline object schema instead of `PipelineAddItemSchema` because `.refine()` produces `ZodEffects` which cannot be nested in `z.array()` cleanly. The refine validation is applied per-item in the route handler loop instead.

---

## Reference Content (content_md)

The following is the exact markdown content to be stored in the `playlist-graph-api` reference entry. It is written in Portuguese (Cowork's operating language) and optimized for agent consumption — concise, scannable, with concrete examples.

````markdown
# Playlist Graph API — Referência Completa

API para criar, gerenciar e organizar playlists programaticamente.
Base: `/api/pipeline/playlists`. Auth: `X-Pipeline-Key` (write permission para mutações).

---

## Árvore de Decisão

```
Tarefa envolve conteúdo em série/sequência?
├─ SIM → Playlist existe? → GET /playlists?category={cat}
│   ├─ SIM → GET /playlists/:id → ver grafo → adicionar/conectar/reorganizar
│   └─ NÃO → POST /playlists → criar → adicionar items + edges + auto-layout
├─ NÃO → Não usar playlists
└─ DÚVIDA → GET /playlists → listar existentes
```

---

## Endpoints

### Leitura

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/playlists` | Lista playlists. Filtros: `?status=`, `?category=`, `?search=` |
| GET | `/playlists/:id` | Grafo completo: playlist + items[] + edges[] |

### Criação/Atualização

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/playlists` | Criar playlist. Slug auto-gerado de `name_en` |
| PATCH | `/playlists/:id` | Atualizar campos (slug não editável via API) |
| DELETE | `/playlists/:id` | Deletar playlist + items + edges (cascata) |

### Items

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/playlists/:id/items` | Adicionar 1 item. Idempotente (retorna existing se duplicata) |
| POST | `/playlists/:id/items/bulk` | Adicionar até 50 items. Idempotente por item |
| DELETE | `/playlists/:id/items/:itemId` | Remover item + edges conectadas (cascata) |

### Edges (conexões entre items)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/playlists/:id/edges` | Criar 1 edge. Idempotente |
| POST | `/playlists/:id/edges/bulk` | Criar até 100 edges. Sequencial (ciclo-safe) |
| DELETE | `/playlists/:id/edges/:edgeId` | Remover edge |

### Organização

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/playlists/:id/reorder` | Reordenar items por sort_order |
| POST | `/playlists/:id/auto-layout` | Auto-posicionar nós (topological sort) |

---

## Criar Playlist

```json
POST /api/pipeline/playlists
{
  "name_en": "Getting Started with TypeScript",    // OBRIGATÓRIO
  "name_pt": "Começando com TypeScript",            // opcional, default ""
  "description_en": "Series for TS beginners",      // opcional
  "description_pt": "Série para iniciantes em TS",  // opcional
  "category": "typescript",                          // opcional
  "status": "draft"                                  // opcional, default "draft"
}
→ 201 { "data": { "id": "uuid", "slug": "getting-started-with-typescript", ... } }
```

Slug: auto-gerado de `name_en`. Colisão: sufixo `-2`, `-3`... até `-99`.

## Adicionar Item

```json
POST /api/pipeline/playlists/:id/items
{
  "blog_post_id": "uuid"          // OU newsletter_edition_id OU pipeline_id (exatamente 1)
  // "sort_order": 3000,           // opcional, default: auto-increment +1000
  // "position_x": 400,            // opcional, default: 0
  // "position_y": 200             // opcional, default: 0
}
→ 201 { "data": { "id": "item-uuid", "already_existed": false } }
→ 200 { "data": { "id": "existing-uuid", "already_existed": true } }  // se já existia
```

## Adicionar Items em Lote

```json
POST /api/pipeline/playlists/:id/items/bulk
{
  "items": [
    { "blog_post_id": "uuid-1" },
    { "pipeline_id": "uuid-2", "sort_order": 2000 },
    { "newsletter_edition_id": "uuid-3" }
  ]
}
→ 200 { "data": { "items": [...], "added": 2, "skipped": 1 } }
```

Máximo 50 items. Sort order auto-atribuído sequencialmente (+1000) quando omitido.

## Criar Edge

```json
POST /api/pipeline/playlists/:id/edges
{
  "source_item_id": "uuid-a",
  "target_item_id": "uuid-b",
  "edge_type": "sequence",      // sequence | related | prerequisite | continuation
  "label": null                  // opcional
}
→ 201 { "data": { "id": "edge-uuid", "already_existed": false } }
```

### Edge Types

| Type | Significado | Regra de ciclo |
|------|-------------|---------------|
| `sequence` | Ordem de leitura linear | Ciclos PROIBIDOS (DB rejeita) |
| `related` | "Veja também" | Ciclos permitidos |
| `prerequisite` | "Leia antes" | Ciclos permitidos |
| `continuation` | Continuação direta | Ciclos permitidos |

## Criar Edges em Lote

```json
POST /api/pipeline/playlists/:id/edges/bulk
{
  "edges": [
    { "source_item_id": "a", "target_item_id": "b", "edge_type": "sequence" },
    { "source_item_id": "b", "target_item_id": "c", "edge_type": "sequence" }
  ]
}
→ 200 { "data": { "edges": [...], "created": 2, "skipped": 0, "errors": [] } }
```

Máximo 100 edges. Processamento sequencial (respeita detecção de ciclos). Sucesso parcial possível.

## Auto-Layout

```json
POST /api/pipeline/playlists/:id/auto-layout
// sem body
→ 200 { "data": { "positions": [{ "item_id": "uuid", "position_x": 0, "position_y": 0 }, ...], "layers": 3 } }
```

Algoritmo: Kahn (topological sort) usando sequence edges. Gap horizontal: 200px, vertical: 120px.

## Reorder

```json
POST /api/pipeline/playlists/:id/reorder
{ "item_ids": ["uuid-1", "uuid-2", "uuid-3"] }
→ 200 { "data": { "reordered": true, "count": 3 } }
```

Sort orders: 1000, 2000, 3000... Items não listados mantêm sort_order atual.

---

## Workflows

### Graduação → Adicionar à Playlist

1. `GET /playlists?category={cat}` → encontrar playlist
2. Se não existe: `POST /playlists` → criar
3. `GET /playlists/:id` → ler grafo atual
4. `POST /playlists/:id/items` → adicionar conteúdo graduado
5. `POST /playlists/:id/edges` → edge `sequence` conectando ao último item
6. `POST /playlists/:id/auto-layout` → reorganizar

### Construir Learning Path

1. `POST /playlists` → criar
2. `POST /playlists/:id/items/bulk` → adicionar todos items
3. `POST /playlists/:id/edges/bulk` → conectar em sequência
4. `POST /playlists/:id/auto-layout` → organizar
5. `PATCH /playlists/:id` → `{ "status": "published" }`

### Limpeza de Ghosts

1. `GET /playlists/:id` → ler grafo
2. Filtrar items com `is_ghost === true`
3. `DELETE /playlists/:id/items/:itemId` para cada ghost
4. `POST /playlists/:id/auto-layout` → reorganizar

---

## Regras

1. Cada conteúdo aparece **no máximo 1x** por playlist (idempotente)
2. Self-loop proibido: `source_item_id !== target_item_id`
3. Sequence edges: ciclos proibidos (DB trigger)
4. Sort order: incrementos de 1000 para inserções intermediárias
5. Posições (x, y): default (0,0). Use auto-layout para organizar
6. `name_en` obrigatório. `name_pt` pode ser vazio. Slug gerado de `name_en`
7. Erros: formato `{ "error": { "code": "...", "message": "..." } }`
````

---

## Cross-Reference Update (docs/cowork-pipeline-reference.md)

The current Playlists section (lines 613-729) should be replaced with:

```markdown
## Playlists

Para referência completa da API de playlists (CRUD, edges, auto-layout, workflows), consulte a referência `playlist-graph-api` no contexto do pipeline:

```
GET /api/pipeline/context/playlist-graph-api
```

Resumo dos endpoints disponíveis:
- `GET/POST /api/pipeline/playlists` — listar / criar
- `GET/PATCH/DELETE /api/pipeline/playlists/:id` — detalhe / atualizar / deletar
- `POST /playlists/:id/items`, `/items/bulk`, `DELETE /items/:itemId` — gerenciar items
- `POST /playlists/:id/edges`, `/edges/bulk`, `DELETE /edges/:edgeId` — gerenciar edges
- `POST /playlists/:id/reorder` — reordenar items
- `POST /playlists/:id/auto-layout` — auto-posicionar nós
```

---

## Verification Checklist

- [ ] All 11 new endpoints respond correctly with pipeline auth + write permission
- [ ] Existing GET endpoints standardized to `{ error: { code, message } }` format
- [ ] Rate limit headers present in all responses (API key auth only)
- [ ] Slug auto-generation with collision resolution (up to `-99`)
- [ ] Idempotent add item returns existing ID with `already_existed: true`
- [ ] Idempotent create edge returns existing ID with `already_existed: true`
- [ ] FK violation on non-existent content returns `VALIDATION_ERROR`
- [ ] Bulk items: max 50, sort_order auto-assigned sequentially
- [ ] Bulk edges: max 100, processed sequentially, partial success with `errors` array
- [ ] Cycle detection rejects cyclic sequence edges with `CYCLE_DETECTED`
- [ ] Auto-layout computes correct positions; empty playlist returns `layers: 0`
- [ ] Reorder accepts partial item list; non-listed items unchanged
- [ ] Query filters (status, category, search) work on GET list
- [ ] `playlist-graph-api` reference entry exists in `reference_content` with full content_md
- [ ] `REFERENCE_USAGE` includes `'playlist-graph-api': ['Writer', 'Producer']`
- [ ] `docs/cowork-pipeline-reference.md` playlist section replaced with cross-reference
- [ ] All existing tests pass + new endpoint tests added
