# Research Library

## Research Library

Auth: `X-Pipeline-Key` header (write permission para mutações). **NÃO use `Authorization: Bearer`.**

### POST /api/pipeline/research — Create/upsert research item

Claude pushes research via this endpoint. Duplicate title+topic = upsert (updates content, resets status to 'new').

```bash
curl -X POST $BASE_URL/api/pipeline/research \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "WYD Ongame Era — Early MMORPG History",
    "topic_slug": "gaming-history/wyd",
    "content_md": "# WYD Research\n\n...",
    "summary": "Research about WYD Online during the Ongame era (2003-2008)",
    "sources": [
      { "url": "https://example.com/article", "title": "Source Article" }
    ]
  }'
```

Response includes `version` (use in PATCH). Status `201` = created, `200` = upserted.

**topic_slug convention:** Use kebab-case path segments. Auto-creates missing topics.
- `"estrategia"` → root topic (depth 0)
- `"gaming-history/wyd"` → parent + child (depth 0 + 1)
- `"cursos/ai-dev/prompt"` → 3 levels (depth 0 + 1 + 2)
- Max 3 levels. `"a/b/c/d"` → 400 error.

### GET /api/pipeline/research — List research items

Default: lightweight (no body content). Use `?include=content` for full content_md.

```
GET /api/pipeline/research?topic_slug=gaming-history&include=content
GET /api/pipeline/research?pipeline_item_id=<uuid>&include=content
GET /api/pipeline/research?status=new,reviewed&search=wyd
```

### GET /api/pipeline/research/:id — Full item detail

Returns both `content_md` and `content_json`, plus `linked_items` array.

### PATCH /api/pipeline/research/:id — Update research item

Requires `X-Expected-Version` header (use `version` from POST/GET response). Supports partial updates.

```bash
curl -X PATCH $BASE_URL/api/pipeline/research/<uuid> \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -H "X-Expected-Version: 1" \
  -d '{ "status": "archived" }'
```

Updatable fields: `title`, `content_md`, `summary`, `sources`, `status` (`new`, `reviewed`, `starred`, `archived`).
Returns 409 on version conflict.

### DELETE /api/pipeline/research/:id — Delete research item

```bash
curl -X DELETE $BASE_URL/api/pipeline/research/<uuid> \
  -H "X-Pipeline-Key: $KEY"
```

### POST /api/pipeline/research/import — Bulk import

```json
{
  "items": [
    { "title": "...", "topic_slug": "...", "content_md": "..." },
    { "title": "...", "topic_slug": "...", "content_md": "..." }
  ]
}
```

Max 50 items. Each processed independently; partial failures don't block others.

### Topics

**GET /api/pipeline/research/topics** — List all research topics with item counts.

Returns hierarchical topic tree with `slug`, `name`, `depth`, `parent_slug`, and `item_count`.

**POST /api/pipeline/research/topics** — Create a new topic manually.

```json
{ "name": "Gaming History", "slug": "gaming-history", "parent_slug": null }
```

**PATCH /api/pipeline/research/topics/:id** — Update topic name.

**DELETE /api/pipeline/research/topics/:id** — Delete a topic (must have no items).

### Links — Connect research to pipeline items

**POST /api/pipeline/research/:id/links** — Link a research item to a pipeline item.

```json
{ "pipeline_item_id": "<uuid>", "relationship": "informs" }
```

Relationships: `informs`, `supports`, `contradicts`, `expands`.

**DELETE /api/pipeline/research/:id/links/:linkId** — Remove a link.

### Workflow: Research-to-Pipeline Pipeline

```
1. POST /api/pipeline/research — create research item with content_md
2. GET /api/pipeline/research/:id — verify creation, note version
3. POST /api/pipeline/research/:id/links — link to existing pipeline item
   { "pipeline_item_id": "<uuid>", "relationship": "informs" }
4. GET /api/pipeline/research/:id — confirm linked_items includes the link
```

### Workflow: Bulk Research Import

```
1. POST /api/pipeline/research/import
   { "items": [{ "title": "...", "topic_slug": "...", "content_md": "..." }, ...] }
2. Response: { "data": { "created": N, "updated": M, "errors": [...] } }
3. For items with errors, fix and retry individually via POST /api/pipeline/research
```

### Query Parameters Reference

| Parameter | Endpoint | Values | Default |
|-----------|----------|--------|---------|
| `topic_slug` | GET /research | Any valid slug | — (all topics) |
| `pipeline_item_id` | GET /research | UUID | — |
| `status` | GET /research | `new,reviewed,starred,archived` (comma-separated) | all |
| `search` | GET /research | Free text | — |
| `include` | GET /research | `content` | — (lightweight) |
| `cursor` | GET /research | Opaque cursor string | — (first page) |
| `limit` | GET /research | 1-100 | 20 |

### Response Shapes

**List response (GET /research):**
```json
{
  "data": [...items],
  "meta": { "cursor": "next-cursor-or-null", "has_more": true, "total": 42 }
}
```

**Item detail (GET /research/:id):**
```json
{
  "data": {
    "id": "uuid",
    "title": "...",
    "topic_slug": "gaming-history/wyd",
    "content_md": "# Full content...",
    "summary": "...",
    "sources": [{ "url": "...", "title": "..." }],
    "status": "new",
    "version": 1,
    "linked_items": [
      { "link_id": "uuid", "pipeline_item_id": "uuid", "relationship": "informs", "item_code": "tg-42", "item_title": "..." }
    ],
    "created_at": "...",
    "updated_at": "..."
  }
}
```

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Invalid request body or parameters | Check field types and required fields |
| 401 | Missing or invalid X-Pipeline-Key | Verify header is present in request |
| 404 | Resource not found | Verify the ID exists |
| 409 | Revision conflict (rev mismatch) | Re-GET the resource, use current rev, retry |
| 412 | Version conflict (X-Expected-Version mismatch) | Re-GET the item to refresh version, retry |
| 429 | Rate limit exceeded (100/min) | Wait and retry |
