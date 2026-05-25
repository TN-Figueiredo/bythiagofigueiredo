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

### Query Parameters Reference

| Parameter | Endpoint | Values | Default |
|-----------|----------|--------|---------|
| `status` | GET /playlists | `draft`, `published`, `archived` | all |
| `category` | GET /playlists | Any string | — |
| `search` | GET /playlists | Free text (name search) | — |

### Response Shapes

**List response (GET /playlists):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name_en": "...",
      "name_pt": "...",
      "slug": "...",
      "category": "...",
      "status": "draft",
      "item_count": 5,
      "edge_count": 4,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

**Graph response (GET /playlists/:id):**
```json
{
  "data": {
    "id": "uuid",
    "name_en": "...",
    "name_pt": "...",
    "slug": "...",
    "category": "...",
    "status": "draft",
    "version": 1,
    "description_en": "...",
    "description_pt": "...",
    "items": [
      {
        "id": "item-uuid",
        "blog_post_id": "uuid | null",
        "pipeline_id": "uuid | null",
        "newsletter_edition_id": "uuid | null",
        "sort_order": 1000,
        "position_x": 0,
        "position_y": 0,
        "is_ghost": false,
        "title": "Resolved title from linked content"
      }
    ],
    "edges": [
      {
        "id": "edge-uuid",
        "source_item_id": "uuid",
        "target_item_id": "uuid",
        "edge_type": "sequence",
        "label": null
      }
    ]
  }
}
```

### Versioning

Playlists use `X-Expected-Version` header for PATCH operations. Get the current version from the GET response and pass it in the header. On 412 conflict, re-GET and retry with the fresh version.

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Invalid request body or parameters | Check field types and required fields |
| 401 | Missing or invalid X-Pipeline-Key | Verify header is present in request |
| 404 | Resource not found | Verify the ID exists |
| 409 | Revision conflict (rev mismatch) | Re-GET the resource, use current rev, retry |
| 412 | Version conflict (X-Expected-Version mismatch) | Re-GET the item to refresh version, retry |
| 429 | Rate limit exceeded (100/min) | Wait and retry |

**Note on DELETE cascade:** Deleting a playlist (`DELETE /playlists/:id`) cascades to all items and edges belonging to that playlist. This operation is irreversible — there is no soft delete. Similarly, deleting a playlist item (`DELETE /playlists/:id/items/:itemId`) removes all edges connected to that item.
