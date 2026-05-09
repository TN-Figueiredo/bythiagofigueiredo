# Content Pipeline — Design Spec

**Date:** 2026-05-09
**Sprint:** 5h (Content Pipeline)
**Estimate:** 27-35h

## Summary

A planning-layer module for the CMS that replaces scattered .md files and Notion boards with a structured, API-driven content pipeline. Manages multi-format content (videos, blog posts, newsletters, courses, campaigns) through format-specific workflows, provides full REST API access for Claude Cowork integration, and unifies topic aggregation across all published entities.

**Key principle:** Pipeline = Planning. Entity tables (blog_posts, newsletter_editions, etc.) = Production/Published. Items "graduate" from pipeline to entity tables when production begins.

---

## 1. Database Schema

### 1.1 Core Tables

```sql
-- Format-specific workflow definitions
CREATE TABLE pipeline_workflows (
  format TEXT NOT NULL,        -- 'video', 'blog_post', 'newsletter', 'course', 'campaign'
  stage TEXT NOT NULL,         -- e.g. 'idea', 'roteiro', 'gravacao'
  position INTEGER NOT NULL,
  label_pt TEXT NOT NULL,
  label_en TEXT NOT NULL,
  PRIMARY KEY (format, stage)
);

-- Main pipeline items
CREATE TABLE content_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id),
  code TEXT NOT NULL,                          -- unique human-readable slug (e.g. "G14-ai-agents-tools")
  title_pt TEXT,
  title_en TEXT,
  slug TEXT,
  format TEXT NOT NULL,                        -- immutable after creation
  stage TEXT NOT NULL DEFAULT 'idea',          -- validated via FK to pipeline_workflows
  language TEXT NOT NULL DEFAULT 'pt-br' CHECK (language IN ('pt-br', 'en', 'both')),
  priority INTEGER DEFAULT 0 CHECK (priority BETWEEN 0 AND 5),
  parent_id UUID REFERENCES content_pipeline(id),  -- for course modules

  -- Content
  hook TEXT,                                   -- one-line hook/teaser
  synopsis TEXT,                               -- short description
  body_content TEXT,                           -- full markdown (script, draft, etc.)
  body_compiled TEXT,                          -- MDX compiled on save (same pattern as blog_posts)

  -- Metadata
  format_metadata JSONB DEFAULT '{}',          -- validated per format (see §1.6)
  production_checklist JSONB DEFAULT '[]',     -- [{label, done, toggled_at}]
  validation_score JSONB,                      -- computed on stage change (see §1.7)
  tags TEXT[] DEFAULT '{}',

  -- Cross-references to entity tables (nullable, set on graduation)
  youtube_video_id UUID REFERENCES youtube_videos(id),
  blog_post_id UUID REFERENCES blog_posts(id),
  newsletter_edition_id UUID REFERENCES newsletter_editions(id),
  campaign_id UUID REFERENCES campaigns(id),

  -- Archive
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  archive_reason TEXT,

  -- Optimistic locking
  version INTEGER NOT NULL DEFAULT 1,

  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ,

  -- Search
  search_vector TSVECTOR,

  UNIQUE (site_id, code),
  CONSTRAINT valid_stage FOREIGN KEY (format, stage) REFERENCES pipeline_workflows(format, stage)
);

-- Unified collections (playlists, categories, series, arcs, launches)
CREATE TABLE content_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('playlist', 'category', 'series', 'arc', 'launch')),
  parent_id UUID REFERENCES content_collections(id),  -- arcs within playlists
  metadata JSONB DEFAULT '{}',  -- target_date for launches, etc.
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (site_id, code)
);

-- Many-to-many items ↔ collections
CREATE TABLE content_pipeline_memberships (
  pipeline_id UUID NOT NULL REFERENCES content_pipeline(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES content_collections(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  role TEXT DEFAULT 'member',  -- 'member', 'featured', 'teaser'
  PRIMARY KEY (pipeline_id, collection_id)
);

-- Audit history
CREATE TABLE content_pipeline_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES content_pipeline(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,    -- 'stage_change', 'field_update', 'checklist_toggle', 'graduated', 'restored'
  from_value TEXT,
  to_value TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Inter-item dependencies
CREATE TABLE pipeline_dependencies (
  blocker_id UUID NOT NULL REFERENCES content_pipeline(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES content_pipeline(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'soft' CHECK (dependency_type IN ('soft', 'hard')),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);
-- soft = UI warning only; hard = /advance endpoint rejects if blocker not at/past target stage

-- API keys for Claude Cowork access
CREATE TABLE pipeline_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id),
  label TEXT NOT NULL,
  key_hash TEXT NOT NULL,           -- SHA-256 of the actual key
  permissions TEXT[] DEFAULT '{read}',  -- ['read', 'write', 'admin']
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reference content (personal context, guidelines, audience profiles)
CREATE TABLE reference_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id),
  key TEXT NOT NULL,                -- e.g. 'audience-profile', 'content-guidelines'
  title TEXT NOT NULL,
  content_md TEXT,                  -- human-readable markdown
  content_compact JSONB,           -- token-efficient JSON for Claude
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE (site_id, key)
);
```

### 1.2 Indexes

```sql
CREATE INDEX idx_pipeline_site_format ON content_pipeline(site_id, format) WHERE NOT is_archived;
CREATE INDEX idx_pipeline_site_stage ON content_pipeline(site_id, format, stage) WHERE NOT is_archived;
CREATE INDEX idx_pipeline_search ON content_pipeline USING GIN(search_vector);
CREATE INDEX idx_pipeline_tags ON content_pipeline USING GIN(tags);
CREATE INDEX idx_pipeline_parent ON content_pipeline(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_pipeline_graduated ON content_pipeline(blog_post_id) WHERE blog_post_id IS NOT NULL;
CREATE INDEX idx_collections_site_type ON content_collections(site_id, type);
CREATE INDEX idx_memberships_collection ON content_pipeline_memberships(collection_id);
CREATE INDEX idx_memberships_pipeline ON content_pipeline_memberships(pipeline_id);
CREATE INDEX idx_history_pipeline ON content_pipeline_history(pipeline_id, changed_at DESC);
CREATE INDEX idx_api_keys_hash ON pipeline_api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_reference_site_key ON reference_content(site_id, key);
```

### 1.3 Triggers & Functions

```sql
-- Auto-update search_vector (bilingual, weighted)
-- body_content capped at 10000 chars to prevent oversized vectors
CREATE FUNCTION pipeline_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.title_pt, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.title_en, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.hook, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.hook, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.synopsis, '')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(NEW.tags, ' ')), 'C') ||
    setweight(to_tsvector('simple', left(coalesce(NEW.body_content, ''), 10000)), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pipeline_search
  BEFORE INSERT OR UPDATE OF title_pt, title_en, hook, synopsis, tags, body_content
  ON content_pipeline FOR EACH ROW EXECUTE FUNCTION pipeline_search_vector_update();

-- Auto-update updated_at + increment version
CREATE FUNCTION pipeline_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pipeline_updated
  BEFORE UPDATE ON content_pipeline FOR EACH ROW EXECUTE FUNCTION pipeline_updated_at();

-- Auto-record stage changes in history
CREATE FUNCTION pipeline_record_stage_change() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO content_pipeline_history (pipeline_id, event_type, from_value, to_value, changed_by)
    VALUES (NEW.id, 'stage_change', OLD.stage, NEW.stage, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pipeline_stage_history
  AFTER UPDATE OF stage ON content_pipeline FOR EACH ROW EXECUTE FUNCTION pipeline_record_stage_change();

-- Prevent format change after creation
CREATE FUNCTION pipeline_immutable_format() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.format IS DISTINCT FROM NEW.format THEN
    RAISE EXCEPTION 'Cannot change format after creation. Create a new item instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pipeline_immutable_format
  BEFORE UPDATE OF format ON content_pipeline FOR EACH ROW EXECUTE FUNCTION pipeline_immutable_format();
```

### 1.4 RLS Policies

```sql
ALTER TABLE content_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pipeline_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pipeline_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_dependencies ENABLE ROW LEVEL SECURITY;

-- content_pipeline
CREATE POLICY pipeline_staff_read ON content_pipeline FOR SELECT
  USING (public.can_view_site(site_id));
CREATE POLICY pipeline_staff_write ON content_pipeline FOR ALL
  USING (public.can_edit_site(site_id));

-- content_collections
CREATE POLICY collections_staff_read ON content_collections FOR SELECT
  USING (public.can_view_site(site_id));
CREATE POLICY collections_staff_write ON content_collections FOR ALL
  USING (public.can_edit_site(site_id));

-- content_pipeline_memberships (via join to parent)
CREATE POLICY memberships_staff_read ON content_pipeline_memberships FOR SELECT
  USING (EXISTS (SELECT 1 FROM content_pipeline p WHERE p.id = pipeline_id AND public.can_view_site(p.site_id)));
CREATE POLICY memberships_staff_write ON content_pipeline_memberships FOR ALL
  USING (EXISTS (SELECT 1 FROM content_pipeline p WHERE p.id = pipeline_id AND public.can_edit_site(p.site_id)));

-- content_pipeline_history (read-only for staff)
CREATE POLICY history_staff_read ON content_pipeline_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM content_pipeline p WHERE p.id = pipeline_id AND public.can_view_site(p.site_id)));

-- pipeline_dependencies
CREATE POLICY deps_staff_read ON pipeline_dependencies FOR SELECT
  USING (EXISTS (SELECT 1 FROM content_pipeline p WHERE p.id = blocker_id AND public.can_view_site(p.site_id)));
CREATE POLICY deps_staff_write ON pipeline_dependencies FOR ALL
  USING (EXISTS (SELECT 1 FROM content_pipeline p WHERE p.id = blocker_id AND public.can_edit_site(p.site_id)));

-- reference_content
CREATE POLICY reference_staff_read ON reference_content FOR SELECT
  USING (public.can_view_site(site_id));
CREATE POLICY reference_staff_write ON reference_content FOR ALL
  USING (public.can_edit_site(site_id));

-- pipeline_api_keys (admin only)
CREATE POLICY api_keys_admin ON pipeline_api_keys FOR ALL
  USING (public.can_admin_site_users(site_id));
```

### 1.5 Workflow Seed Data

| Format | Stages (in order) | Default Checklist |
|--------|-------------------|-------------------|
| video | idea → roteiro → gravacao → edicao → pos_producao → scheduled → published | See §1.8 |
| blog_post | idea → draft → ready → scheduled → published | See §1.8 |
| newsletter | idea → draft → ready → scheduled → published | See §1.8 |
| course | idea → outline → modulos → review → published | See §1.8 |
| campaign | idea → draft → approved → scheduled → sent | See §1.8 |

### 1.6 Format Metadata Schemas (Zod validation in API layer)

```typescript
const VideoMetadata = z.object({
  playlist_letter: z.string().optional(),       // e.g. "G", "A"
  episode_number: z.number().int().optional(),  // e.g. 14
  duration_estimate_min: z.number().optional(), // estimated minutes
  thumbnail_concept: z.string().optional(),
  recording_location: z.string().optional(),
  equipment_notes: z.string().optional(),
});

const BlogPostMetadata = z.object({
  word_count_target: z.number().int().optional(),
  seo_keyword: z.string().optional(),
  cover_image_concept: z.string().optional(),
  series_position: z.number().int().optional(), // if part of a series
});

const NewsletterMetadata = z.object({
  edition_number: z.number().int().optional(),
  newsletter_type_id: z.string().uuid().optional(), // FK to newsletter_types
  cadence: z.enum(['weekly', 'biweekly', 'monthly', 'one-off']).optional(),
  target_send_date: z.string().datetime().optional(),
});

const CourseMetadata = z.object({
  module_count: z.number().int().optional(),
  platform: z.enum(['self-hosted', 'youtube', 'udemy', 'other']).optional(),
  price_model: z.enum(['free', 'paid', 'freemium']).optional(),
  prerequisite_courses: z.array(z.string()).optional(), // codes of prerequisite items
});

const CampaignMetadata = z.object({
  campaign_type: z.enum(['email', 'social', 'cross-platform']).optional(),
  target_audience: z.string().optional(),
  budget: z.number().optional(),
  kpi_target: z.string().optional(),
});
```

### 1.7 Validation Score Computation

Recomputed on every stage change via server action. Result stored in `validation_score` JSONB:

```typescript
interface ValidationScore {
  overall: number;          // 0-100, weighted average
  breakdown: {
    has_title: boolean;     // title_pt OR title_en filled
    has_hook: boolean;      // hook is non-empty
    has_synopsis: boolean;  // synopsis is non-empty
    has_body: boolean;      // body_content is non-empty
    has_tags: boolean;      // tags array non-empty
    checklist_pct: number;  // % of checklist items done
    in_collection: boolean; // belongs to at least 1 collection
    metadata_complete: boolean; // format_metadata passes schema validation
  };
  computed_at: string;      // ISO timestamp
}
```

Weights: title (20), hook (15), synopsis (10), body (20), tags (5), checklist (15), collection (5), metadata (10).

### 1.8 Default Checklists Per Format

Stored as constant in code (not DB). Applied when creating items if no custom checklist is provided:

```typescript
const DEFAULT_CHECKLISTS: Record<Format, ChecklistItem[]> = {
  video: [
    { label: 'Roteiro finalizado' },
    { label: 'Thumbnail conceituada' },
    { label: 'B-roll listado' },
    { label: 'Equipamento verificado' },
    { label: 'Gravação concluída' },
    { label: 'Edição concluída' },
    { label: 'Título + descrição SEO' },
    { label: 'Cards e end screen' },
  ],
  blog_post: [
    { label: 'Outline aprovado' },
    { label: 'Rascunho escrito' },
    { label: 'Revisão gramatical' },
    { label: 'Imagens/mídia inseridos' },
    { label: 'SEO meta preenchido' },
    { label: 'CTA definido' },
  ],
  newsletter: [
    { label: 'Tema definido' },
    { label: 'Rascunho escrito' },
    { label: 'Links verificados' },
    { label: 'Preview testado' },
    { label: 'Segmentação confirmada' },
  ],
  course: [
    { label: 'Módulos definidos' },
    { label: 'Material de cada módulo criado' },
    { label: 'Exercícios/quizzes prontos' },
    { label: 'Revisão de conteúdo' },
    { label: 'Landing page criada' },
  ],
  campaign: [
    { label: 'Objetivo definido' },
    { label: 'Criativos prontos' },
    { label: 'Segmentação definida' },
    { label: 'Budget aprovado' },
    { label: 'Tracking configurado' },
  ],
};
```

---

## 2. REST API

### 2.1 Authentication

All endpoints under `/api/pipeline/*` authenticate via:
1. **Session cookie** (CMS UI users) — standard Supabase auth
2. **X-Pipeline-Key header** (Claude Cowork) — SHA-256 hashed, matched against `pipeline_api_keys`. The key's `site_id` implicitly scopes all queries — no separate site parameter needed.

Middleware resolution order: check `X-Pipeline-Key` first → if absent, fall back to session cookie + site context from request headers.

### 2.2 Endpoints

#### Context (Reference Content)
```
GET    /api/pipeline/context              → all reference docs (compact JSON by default, ?format=md for markdown)
GET    /api/pipeline/context/:key         → specific reference doc
PUT    /api/pipeline/context/:key         → upsert reference doc
DELETE /api/pipeline/context/:key         → delete reference doc
```

#### Collections
```
GET    /api/pipeline/collections          → list (?type=playlist|category|series|arc|launch&parent_id=)
GET    /api/pipeline/collections/:id      → detail + members (ordered by position)
POST   /api/pipeline/collections          → create collection
PUT    /api/pipeline/collections/:id      → update collection
DELETE /api/pipeline/collections/:id      → soft-delete (sets metadata.archived_at)
```

#### Topics (Cross-Format Aggregation)
```
GET    /api/pipeline/topics/:code         → everything about a topic (see §9)
```

#### Items (Pipeline Entries)
```
GET    /api/pipeline/items                → list (see §2.4 for filtering/pagination)
GET    /api/pipeline/items/:id            → detail (includes history, memberships, dependencies)
POST   /api/pipeline/items                → create (single object or array for batch, max 50)
PATCH  /api/pipeline/items/:id            → update (requires If-Match: <version> header)
DELETE /api/pipeline/items/:id            → soft archive (sets is_archived=true)
POST   /api/pipeline/items/:id/restore    → unarchive (clears is_archived, archived_at, archive_reason)
POST   /api/pipeline/items/:id/advance    → move to next stage (see §2.5)
POST   /api/pipeline/items/:id/retreat    → move to previous stage (see §2.5)
POST   /api/pipeline/items/:id/checklist  → toggle checklist item {index, done}
POST   /api/pipeline/items/:id/graduate   → create linked entity (see §3)
POST   /api/pipeline/items/bulk           → batch operations (see §2.6)
```

#### Workflows
```
GET    /api/pipeline/workflows            → all format definitions + stages + labels + default checklists
```

#### Search
```
GET    /api/pipeline/search?q=&scope=pipeline|published|all&lang=&format=
```

#### Stats
```
GET    /api/pipeline/stats                → see §2.7
```

#### API Discovery
```
GET    /api/pipeline                      → API manifest (endpoints, auth methods, rate limits)
```

### 2.3 Pagination

**Cursor-based** for items list (stable under concurrent writes):

```
GET /api/pipeline/items?cursor=<opaque>&limit=50&sort=updated_at:desc
```

Cursor encodes `(sort_value, id)` tuple, base64-encoded. Default limit: 50, max: 200.

Response:
```json
{
  "data": [...],
  "meta": {
    "total": 78,
    "has_next": true,
    "next_cursor": "eyJ1cGRhdGVkX2F0IjoiMjAy...",
    "limit": 50
  }
}
```

Sort options: `updated_at:desc` (default), `created_at:desc`, `priority:desc`, `title_pt:asc`, `stage:asc` (by position).

### 2.4 Filtering

Query params for `GET /api/pipeline/items`:
- `format` — filter by format (comma-separated for multiple)
- `stage` — filter by stage (comma-separated)
- `collection` — filter by collection ID
- `lang` — `pt-br`, `en`, or `both`
- `search` — full-text search (uses tsvector)
- `archived` — `true` to include archived, `only` for only archived (default: exclude)
- `priority_min` / `priority_max` — priority range
- `tag` — filter by tag (comma-separated, AND logic)
- `parent_id` — filter course modules by parent
- `graduated` — `true`/`false` to filter by graduation status
- `assigned_to` — filter by user ID
- `stale_days` — items unchanged for N+ days

### 2.5 Stage Advancement Rules

**`POST /items/:id/advance`** — moves to next stage by position:
- Looks up current `(format, stage)` in `pipeline_workflows`, finds `position + 1`
- If no next stage → returns `422` "Already at final stage"
- If item has **hard** dependencies with blocker not at/past its own final stage → returns `409` with blocker details
- Soft dependencies: advance succeeds but response includes `warnings: [...]`
- On success: updates stage, records history, recomputes validation_score
- Advancing to the final stage (published/sent) auto-sets `published_at` if null

**`POST /items/:id/retreat`** — moves to previous stage by position:
- Same lookup, finds `position - 1`
- If already at first stage → returns `422` "Already at first stage"
- No dependency checks on retreat
- Records history with `event_type: 'stage_change'`

**Both require `If-Match: <version>` header** (same optimistic locking as PATCH).

**Drag-and-drop** in the board UI calls `/advance` or `/retreat` as needed (may call multiple times for multi-stage jumps). UI shows confirmation dialog for jumps > 1 stage.

### 2.6 Bulk Operations

```
POST /api/pipeline/items/bulk
```

Body:
```json
{
  "operations": [
    { "op": "advance", "id": "uuid-1" },
    { "op": "retreat", "id": "uuid-2" },
    { "op": "update", "id": "uuid-3", "data": { "priority": 3 }, "version": 5 },
    { "op": "archive", "id": "uuid-4" },
    { "op": "tag", "id": "uuid-5", "data": { "add": ["ai"], "remove": ["draft"] } },
    { "op": "move_collection", "id": "uuid-6", "data": { "collection_id": "uuid-c", "position": 3 } }
  ]
}
```

Rules:
- Max 50 operations per request
- **Atomic execution**: all operations run in a single transaction
- If ANY operation fails → entire batch rolls back, response shows which failed:
  ```json
  {
    "error": { "code": "BATCH_FAILED", "message": "2 of 6 operations failed" },
    "results": [
      { "id": "uuid-1", "ok": true },
      { "id": "uuid-3", "ok": false, "error": "VERSION_CONFLICT", "details": { "current_version": 7 } }
    ]
  }
  ```
- Client can retry with corrected operations (fresh versions)

### 2.7 Stats Endpoint Response

```json
{
  "by_format": {
    "video": { "total": 78, "by_stage": { "idea": 45, "roteiro": 12, ... }, "graduated": 3 },
    "blog_post": { "total": 20, "by_stage": { ... }, "graduated": 8 }
  },
  "velocity": {
    "advanced_last_7d": 12,
    "advanced_last_30d": 34,
    "graduated_last_30d": 5
  },
  "stale": {
    "unchanged_14d": [{ "id": "...", "code": "...", "title_pt": "...", "days_stale": 21 }]
  },
  "launches": {
    "upcoming": [{ "id": "...", "name": "...", "target_date": "...", "readiness_pct": 67 }]
  }
}
```

### 2.8 Error Response Format

All errors follow a consistent envelope:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Item was modified by another request. Current version: 7",
    "details": { "current_version": 7, "your_version": 5, "current_state": { ... } }
  }
}
```

Error codes:
| HTTP | Code | When |
|------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid input (Zod failure) |
| 401 | `UNAUTHORIZED` | Missing/invalid auth |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Item/collection doesn't exist |
| 409 | `VERSION_CONFLICT` | Optimistic lock failure |
| 409 | `DEPENDENCY_BLOCKED` | Hard dependency prevents advance |
| 422 | `INVALID_OPERATION` | e.g. advance past final stage, graduate without required fields |
| 429 | `RATE_LIMITED` | Exceeded 100 req/min |

### 2.9 Rate Limiting

API key auth: **100 requests/minute** per key. Implementation: on each request, update `last_used_at` and check request count via `content_pipeline_history`-style approach — but simpler: use Next.js in-memory Map (resets on cold start, which is acceptable for single-user). Map key = api_key_hash, value = `{ count, window_start }`. Response includes `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers.

Session auth (CMS UI): no explicit rate limit (covered by Vercel's default function invocation limits).

---

## 3. Graduation Flow

When a pipeline item is ready for production, `POST /items/:id/graduate`:

**Request body:**
```json
{
  "target": "blog_post",  // | "newsletter" | "campaign"
  "data": {}              // optional overrides for the created entity
}
```

**Process:**
1. Validates item has minimum required fields for target (title, body_content)
2. Creates the target entity (e.g., `blog_posts` row with `status = 'draft'`)
3. Links back: sets `content_pipeline.blog_post_id` (or equivalent FK)
4. Copies: `title_pt → title`, `synopsis → excerpt`, `body_content → content`, `tags → tags`
5. Records history: `{ event_type: 'graduated', to_value: 'blog_post:<uuid>' }`
6. Item stays in pipeline for continued tracking (stage can still advance)

**Graduation targets:**
| Target | Created Entity | Key Mappings |
|--------|---------------|--------------|
| blog_post | `blog_posts` (status='draft') | title, excerpt, content, tags, category (from collection) |
| newsletter | `newsletter_editions` (status='draft') | subject=title, content, newsletter_type (from metadata) |
| campaign | `campaigns` (status='draft') | name=title, content |

**Videos don't graduate** — they link to existing `youtube_videos` entries (already created by the YouTube CMS module). Set `youtube_video_id` via a standard PATCH instead.

**Re-graduation:** An item can graduate to multiple targets (e.g., same topic → blog post + newsletter). Each sets a different FK.

---

## 4. CMS UI Integration

### 4.1 Navigation

New "Pipeline" section in CMS sidebar (between "Content" and "Links"):

```
Pipeline
├── Overview        /cms/pipeline
├── Video           /cms/pipeline/video
├── Blog            /cms/pipeline/blog
├── Newsletter      /cms/pipeline/newsletter
├── Course          /cms/pipeline/course
├── Campaign        /cms/pipeline/campaign
├── Collections     /cms/pipeline/collections
├── Search          /cms/pipeline/search
└── Reference       /cms/pipeline/reference
```

Implementation: add `buildPipelineSections()` to `cms-sections.ts`, render as collapsible group.

### 4.2 Views (13 total)

| # | View | Route | Purpose |
|---|------|-------|---------|
| 1 | Overview | `/cms/pipeline` | KPI cards, format summaries, launches, recent activity |
| 2 | Board: All | `/cms/pipeline/all` | Overview cards per format (counts by stage) |
| 3 | Board: Video | `/cms/pipeline/video` | 7-column kanban (idea→published) |
| 4 | Board: Blog | `/cms/pipeline/blog` | 5-column kanban |
| 5 | Board: Newsletter | `/cms/pipeline/newsletter` | 5-column kanban + cadence badge |
| 6 | Board: Course | `/cms/pipeline/course` | 5-column kanban + module progress |
| 7 | Board: Campaign | `/cms/pipeline/campaign` | 5-column kanban |
| 8 | List | `/cms/pipeline/list` | Table view with sorting, filters, bulk actions |
| 9 | Collections | `/cms/pipeline/collections` | Playlists, categories, launches management |
| 10 | Item Detail | `/cms/pipeline/items/[id]` | Full editor: script, checklist, metadata, cross-refs |
| 11 | Reference Editor | `/cms/pipeline/reference` | Split-pane: list + markdown editor |
| 12 | Search | `/cms/pipeline/search` | Global cross-entity search with highlights |
| 13 | Topic View | `/cms/pipeline/topics/[code]` | Cross-format aggregation for a theme |

### 4.3 Board UX

Each format tab shows a **kanban board** with columns matching that format's workflow stages. Cards show:
- Title (bilingual badge if `both`)
- Priority indicator (P0-P5 colored dot: red/orange/yellow/blue/gray/none)
- Collection membership badges (first 2, +N overflow)
- Checklist progress bar (filled/total)
- Assigned avatar (or unassigned placeholder)
- Days-in-stage indicator (gray < 7d, yellow 7-14d, red > 14d)

**Drag-and-drop behavior:**
- Single column forward/back → calls `/advance` or `/retreat`
- Multi-column jump → confirmation dialog ("Move from X to Y? This skips N stages")
- On `409 VERSION_CONFLICT` → toast "Item was modified elsewhere" + auto-refresh card
- On `409 DEPENDENCY_BLOCKED` → toast showing which blocker and its current stage
- Soft dependency warnings → yellow banner on card for 5 seconds after drop

### 4.4 Item Detail

Split layout:
- **Left panel (70%):** Body editor (textarea with markdown preview toggle, not Monaco — simpler for scripts). MDX compilation on save via existing `compile()` pattern.
- **Right panel (30%):** Metadata sidebar:
  - Stage selector (dropdown showing allowed transitions)
  - Format badge (read-only)
  - Priority selector
  - Language toggle
  - Tags input (autocomplete from existing tags)
  - Collections list (add/remove)
  - Checklist (toggleable, drag-reorderable)
  - Dependencies section (blockers + blocks)
  - Graduated entities (linked badges with "Open" action)
  - Validation score bar
  - History timeline (collapsible, last 10 events)

### 4.5 Conflict Resolution UX

When a user's PATCH returns `409`:
1. UI shows diff panel: "Your changes" vs "Current version"
2. User picks: "Keep mine" (re-submits with current version) or "Discard mine" (reloads)
3. For board drag-and-drop: auto-reload card position, show toast

---

## 5. Blog Taxonomy Migration

Runs as part of the pipeline migration (same file, sequential statements):

```sql
-- Migrate existing categories
UPDATE blog_posts SET category = 'building' WHERE category IN ('tech', 'code');
UPDATE blog_posts SET category = 'stories' WHERE category IN ('vida', 'viagem');
UPDATE blog_posts SET category = 'money' WHERE category = 'negocio';
UPDATE blog_posts SET category = 'bts' WHERE category = 'crescimento';

ALTER TABLE blog_posts DROP CONSTRAINT blog_posts_category_check;
ALTER TABLE blog_posts ADD CONSTRAINT blog_posts_category_check
  CHECK (category IN ('stories', 'building', 'money', 'bts'));
```

Also creates 4 `content_collections` entries:
```sql
INSERT INTO content_collections (site_id, code, name, type, position) VALUES
  ((SELECT id FROM sites LIMIT 1), 'stories', 'Stories', 'category', 1),
  ((SELECT id FROM sites LIMIT 1), 'building', 'Building', 'category', 2),
  ((SELECT id FROM sites LIMIT 1), 'money', 'Money', 'category', 3),
  ((SELECT id FROM sites LIMIT 1), 'bts', 'BTS', 'category', 4);
```

---

## 6. Data Seed

**Format:** Separate seed script (not migration) at `scripts/seed-pipeline.ts`. Run manually post-migration:
```bash
npx tsx scripts/seed-pipeline.ts
```

Source: `~/Workspace/Youtube/dashboard.html` (78 videos across 6 playlists).

Seed creates:
- 6 `content_collections` (type = 'playlist'): Life Chapters (A, 14), Gaming→Life (B, 13), Taking Control (C, 6), AI Empire (G, 30), Languages (E, 6), Body&Mind (F, 8)
- 3 `content_collections` (type = 'arc', parent = AI Empire): Fundamentals, Hands-on, Vision
- 78 `content_pipeline` items (format = 'video') with:
  - `code`: `{letter}{number}-{slugified-title}` (e.g. "G14-ai-agents-tools")
  - `stage`: based on WRITTEN_SCRIPTS data:
    - `recorded: true` → `'gravacao'`
    - `written: true` → `'roteiro'`
    - default → `'idea'`
  - Default video checklist applied
- Memberships linking items to their playlists + arcs (for G items)

Script is **idempotent** (uses `ON CONFLICT (site_id, code) DO NOTHING`).

---

## 7. Realtime & Subscriptions

Supabase Realtime channels for live board updates:

```typescript
const channel = supabase
  .channel(`pipeline:${siteId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'content_pipeline',
    filter: `site_id=eq.${siteId}`
  }, handlePipelineChange)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'content_pipeline_memberships'
  }, handleMembershipChange)
  .subscribe();
```

Security: Supabase Realtime respects RLS — only events for accessible rows are delivered. Channel name includes `siteId` for efficient filtering.

Board UI applies optimistic updates on drag, reconciles with realtime events. On version mismatch between local optimistic state and incoming realtime event: revert optimistic update, apply server state, show toast "Updated by another session".

---

## 8. Search Implementation

### 8.1 Pipeline Search

Uses `search_vector` tsvector column with bilingual support:
- Portuguese dictionary for pt-br content
- English dictionary for en content
- Simple dictionary for tags, code, and synopsis

Query construction:
```sql
WHERE search_vector @@ (
  plainto_tsquery('portuguese', $q) ||
  plainto_tsquery('english', $q)
)
ORDER BY ts_rank(search_vector, plainto_tsquery('portuguese', $q) || plainto_tsquery('english', $q)) DESC
```

### 8.2 Cross-Entity Search (scope = 'all')

Queries in parallel via `Promise.all`:
1. `content_pipeline` — tsvector match
2. `blog_posts` — `title ILIKE '%q%' OR search_vector @@ ...` (if blog has tsvector, else ILIKE)
3. `newsletter_editions` — `subject ILIKE '%q%' OR preview_text ILIKE '%q%'`
4. `youtube_videos` — `title ILIKE '%q%' OR description ILIKE '%q%'`

Results merged with normalized scores (pipeline tsvector rank → 0-1 float, ILIKE → 0.5 fixed), sorted by score descending, grouped by type in UI.

### 8.3 Language Filtering

When `lang` param is set:
- `pt-br`: filter items where `language IN ('pt-br', 'both')`
- `en`: filter items where `language IN ('en', 'both')`
- Omitted: no language filter

---

## 9. Topic Aggregation

`GET /api/pipeline/topics/:code` returns everything related to a theme.

**Resolution strategy (in order, deduplicated):**
1. Find `content_collections` with matching code → get all pipeline members via memberships
2. Find `content_pipeline` items where `$code = ANY(tags)`
3. Find `blog_posts` where `$code = ANY(tags)` OR category matches code
4. Find `newsletter_editions` linked to pipeline items from steps 1-2
5. Find `youtube_videos` linked to pipeline items from steps 1-2
6. Deduplicate: if a pipeline item is found via both collection and tag, include once

**Response shape:**
```json
{
  "topic": {
    "code": "ai-agents",
    "name": "AI Agents",
    "collection": { "id": "...", "type": "playlist", "description": "..." }
  },
  "pipeline": {
    "video": [{ "id": "...", "code": "G14-...", "title_pt": "...", "stage": "roteiro", ... }],
    "blog_post": [...],
    "newsletter": [...],
    "course": [...],
    "campaign": [...]
  },
  "published": {
    "blog_posts": [{ "id": "...", "title": "...", "status": "published", "published_at": "..." }],
    "newsletter_editions": [...],
    "youtube_videos": [...]
  },
  "stats": {
    "total_items": 12,
    "published": 4,
    "in_progress": 6,
    "planned": 2
  }
}
```

---

## 10. Launch Coordination

Collections with `type = 'launch'` have extended metadata:
```typescript
interface LaunchMetadata {
  target_date: string;        // ISO date
  description: string;
  min_stage_per_format: Record<string, string>;  // e.g. { video: 'edicao', blog_post: 'ready' }
}
```

**Expected stage calculation:**
```
days_total = target_date - collection.created_at
days_elapsed = now - collection.created_at
progress_pct = days_elapsed / days_total
expected_position = floor(progress_pct * total_stages_for_format)
```

**Status dots:**
- **Green:** item's current position >= expected_position
- **Yellow:** item is exactly 1 position behind expected
- **Red:** item is 2+ positions behind OR has unresolved hard dependencies

**Launch View shows:**
- Header with target date + countdown
- Progress bar (items meeting min_stage / total items)
- Member items grouped by format, each with stage badge + status dot
- Blockers section (hard deps with red connector lines)
- Readiness percentage (items at or past `min_stage_per_format[item.format]` / total items)

---

## 11. Security

- API keys stored as SHA-256 hashes only (plaintext shown once on creation, never stored)
- Permission levels: `read` (GET only), `write` (GET + POST/PATCH/DELETE), `admin` (+ key management)
- Rate limiting: 100 req/min per API key (sliding window, in-DB counter)
- All write endpoints validate `can_edit_site(site_id)` via RLS
- API key management restricted to `can_admin_site_users(site_id)`
- `requireSiteAdmin()` guard on all server actions (CMS UI path)
- Optimistic locking (`version` field) prevents lost updates on concurrent edits
- `format` is immutable after creation (trigger-enforced) — prevents orphaned FK references

---

## 12. Body Content & MDX Compilation

Follows the same pattern as `blog_posts`:
- **On save:** server action calls `compile(body_content)` → stores result in `body_compiled`
- **On render:** `run(body_compiled)` to produce React output
- **Fallback:** if `body_compiled IS NULL`, runtime compile on read (first-time or legacy items)
- Body editor in Item Detail is a textarea (not full Monaco) — scripts and drafts don't need syntax highlighting, and textarea loads instantly

---

## 13. Code Generation Strategy

The `code` field is the item's unique human-readable identifier. Generation rules:

- **Video:** `{playlist_letter}{episode_number}-{slugified-title}` → e.g. `G14-ai-agents-tools`
- **Blog post:** `blog-{slugified-title}` → e.g. `blog-building-cms-from-scratch`
- **Newsletter:** `nl-{type_code}-{edition_number}` → e.g. `nl-weekly-042`
- **Course:** `course-{slugified-title}` → e.g. `course-ai-automation-fundamentals`
- **Campaign:** `camp-{slugified-title}` → e.g. `camp-q2-launch`

Auto-generated on creation from title (first non-null of title_pt, title_en) + format metadata. User can override via explicit `code` in POST body. Must be unique per site — collision appends `-2`, `-3`, etc.

---

## 14. API Discovery for Claude Cowork

`GET /api/pipeline` returns a machine-readable manifest:

```json
{
  "name": "Content Pipeline API",
  "version": "1.0.0",
  "auth": {
    "methods": ["api_key"],
    "header": "X-Pipeline-Key",
    "rate_limit": "100/min"
  },
  "endpoints": [
    { "method": "GET", "path": "/api/pipeline/context", "description": "Get all reference content" },
    { "method": "GET", "path": "/api/pipeline/items", "description": "List pipeline items", "params": [...] }
  ],
  "formats": ["video", "blog_post", "newsletter", "course", "campaign"],
  "workflows": { ... }
}
```

Claude Cowork calls this endpoint first to understand available operations, then uses the structured API. No separate OpenAPI file needed — the manifest IS the discovery mechanism.

---

## 15. Non-Goals (Explicitly Out of Scope)

- Scheduling/publishing automation (handled by existing entity tables)
- Video upload or transcoding
- Email sending (handled by newsletter module)
- Social media posting
- Analytics dashboards (future sprint)
- Mobile app
- Multi-user real-time collaboration (single-user MVP, realtime is for multi-tab/device sync)
- Custom workflow editor (formats/stages are code-defined, not user-configurable in v1)
