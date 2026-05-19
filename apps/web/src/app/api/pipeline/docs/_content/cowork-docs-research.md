## Research Library

Auth: `X-Pipeline-Key` header (write permission para mutações). **NÃO use `Authorization: Bearer`.**

### POST /api/pipeline/research — Create/upsert research item

Claude pushes research via this endpoint. Duplicate title+topic = upsert (updates content, resets status to 'new').

```bash
curl -X POST https://bythiagofigueiredo.com/api/pipeline/research \
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
curl -X PATCH https://bythiagofigueiredo.com/api/pipeline/research/<uuid> \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -H "X-Expected-Version: 1" \
  -d '{ "status": "archived" }'
```

Updatable fields: `title`, `content_md`, `summary`, `sources`, `status` (`new`, `reviewed`, `starred`, `archived`).
Returns 409 on version conflict.

### DELETE /api/pipeline/research/:id — Delete research item

```bash
curl -X DELETE https://bythiagofigueiredo.com/api/pipeline/research/<uuid> \
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
