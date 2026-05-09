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
  format TEXT NOT NULL,                        -- 'video', 'blog_post', 'newsletter', 'course', 'campaign'
  stage TEXT NOT NULL DEFAULT 'idea',          -- validated against pipeline_workflows
  language TEXT NOT NULL DEFAULT 'pt-br' CHECK (language IN ('pt-br', 'en', 'both')),
  priority INTEGER DEFAULT 0 CHECK (priority BETWEEN 0 AND 5),
  parent_id UUID REFERENCES content_pipeline(id),  -- for course modules

  -- Content
  hook TEXT,                                   -- one-line hook/teaser
  synopsis TEXT,                               -- short description
  body_content TEXT,                           -- full markdown (script, draft, etc.)
  body_compiled TEXT,                          -- MDX compiled output

  -- Metadata
  format_metadata JSONB DEFAULT '{}',          -- format-specific (duration, episode_number, etc.)
  production_checklist JSONB DEFAULT '[]',     -- [{label, done, toggled_at}]
  validation_score JSONB,                      -- computed readiness metrics
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
  event_type TEXT NOT NULL,    -- 'stage_change', 'field_update', 'checklist_toggle', 'graduated'
  from_value TEXT,
  to_value TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Inter-item dependencies (soft: UI warning only, does not block stage advance)
CREATE TABLE pipeline_dependencies (
  blocker_id UUID NOT NULL REFERENCES content_pipeline(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES content_pipeline(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'soft' CHECK (dependency_type IN ('soft', 'hard')),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

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
CREATE INDEX idx_collections_site_type ON content_collections(site_id, type);
CREATE INDEX idx_memberships_collection ON content_pipeline_memberships(collection_id);
CREATE INDEX idx_history_pipeline ON content_pipeline_history(pipeline_id, changed_at DESC);
CREATE INDEX idx_api_keys_hash ON pipeline_api_keys(key_hash) WHERE revoked_at IS NULL;
```

### 1.3 Triggers & Functions

```sql
-- Auto-update search_vector (bilingual, weighted)
CREATE FUNCTION pipeline_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.title_pt, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.title_en, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.hook, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.hook, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.synopsis, '')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(NEW.tags, ' ')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.body_content, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- History recording on stage change
CREATE FUNCTION pipeline_record_stage_change() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO content_pipeline_history (pipeline_id, event_type, from_value, to_value, changed_by)
    VALUES (NEW.id, 'stage_change', OLD.stage, NEW.stage, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 1.4 RLS Policies

```sql
ALTER TABLE content_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pipeline_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pipeline_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_content ENABLE ROW LEVEL SECURITY;

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

-- content_pipeline_memberships (via join to parent tables)
CREATE POLICY memberships_staff_read ON content_pipeline_memberships FOR SELECT
  USING (EXISTS (SELECT 1 FROM content_pipeline p WHERE p.id = pipeline_id AND public.can_view_site(p.site_id)));
CREATE POLICY memberships_staff_write ON content_pipeline_memberships FOR ALL
  USING (EXISTS (SELECT 1 FROM content_pipeline p WHERE p.id = pipeline_id AND public.can_edit_site(p.site_id)));

-- content_pipeline_history (read-only for staff, auto-written by triggers)
CREATE POLICY history_staff_read ON content_pipeline_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM content_pipeline p WHERE p.id = pipeline_id AND public.can_view_site(p.site_id)));

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

| Format | Stages (in order) |
|--------|-------------------|
| video | idea → roteiro → gravacao → edicao → pos_producao → scheduled → published |
| blog_post | idea → draft → ready → scheduled → published |
| newsletter | idea → draft → ready → scheduled → published |
| course | idea → outline → modulos → review → published |
| campaign | idea → draft → approved → scheduled → sent |

---

## 2. REST API

### 2.1 Authentication

All endpoints under `/api/pipeline/*` authenticate via:
1. **Session cookie** (CMS UI users) — standard Supabase auth
2. **X-Pipeline-Key header** (Claude Cowork) — hashed against `pipeline_api_keys`

### 2.2 Endpoints

#### Context (Reference Content)
```
GET    /api/pipeline/context              → all reference docs (compact JSON by default)
GET    /api/pipeline/context/:key         → specific reference doc
PUT    /api/pipeline/context/:key         → create/update reference doc
DELETE /api/pipeline/context/:key         → delete reference doc
```

#### Collections
```
GET    /api/pipeline/collections          → list (?type=playlist|category|series|arc|launch)
GET    /api/pipeline/collections/:id      → detail + members (ordered)
POST   /api/pipeline/collections          → create collection
PUT    /api/pipeline/collections/:id      → update collection
DELETE /api/pipeline/collections/:id      → archive collection
```

#### Topics (Cross-Format Aggregation)
```
GET    /api/pipeline/topics/:code         → everything about a topic across all formats + published entities
```

Response includes: pipeline items (all formats), published blog posts, newsletter editions, videos, campaigns — anything tagged or in a collection matching the topic code.

#### Items (Pipeline Entries)
```
GET    /api/pipeline/items                → list (?format=&stage=&collection=&lang=&search=&archived=)
GET    /api/pipeline/items/:id            → detail (includes history, memberships, dependencies)
POST   /api/pipeline/items                → create (accepts array for batch)
PATCH  /api/pipeline/items/:id            → update (requires If-Match: <version> header)
DELETE /api/pipeline/items/:id            → soft archive
POST   /api/pipeline/items/:id/advance    → move to next stage
POST   /api/pipeline/items/:id/checklist  → toggle checklist item {index, done}
POST   /api/pipeline/items/:id/graduate   → create linked entity (blog_post, newsletter, campaign)
POST   /api/pipeline/items/bulk           → batch operations [{op, id, data}]
```

#### Workflows
```
GET    /api/pipeline/workflows            → all format definitions + stages + labels
```

#### Search
```
GET    /api/pipeline/search?q=&scope=&lang=&format=
```

Scope: `pipeline` (default), `published`, `all`. Uses tsvector for pipeline items, queries entity tables for published scope.

#### Stats
```
GET    /api/pipeline/stats                → counts by format/stage, velocity metrics, stale items
```

### 2.3 Optimistic Locking

All PATCH requests require `If-Match: <version>` header. Server returns `409 Conflict` if version mismatch, with current item state in response body for client-side merge.

### 2.4 Response Format

```json
{
  "data": { ... },
  "meta": {
    "version": 3,
    "etag": "3",
    "updated_at": "2026-05-09T14:30:00Z"
  }
}
```

Batch responses use `{ "data": [...], "meta": { "total": N, "page": 1, "per_page": 50 } }`.

---

## 3. Graduation Flow

When a pipeline item is ready for production, the `/graduate` endpoint:

1. Creates the target entity (e.g., `blog_posts` row with `status = 'draft'`)
2. Links it back: sets `content_pipeline.blog_post_id` (or equivalent FK)
3. Copies relevant fields (title, synopsis → excerpt, body_content → content)
4. Records history event `{ event_type: 'graduated', to_value: 'blog_post:uuid' }`
5. Item stays in pipeline for continued tracking (stage can still advance)

The pipeline item and graduated entity remain linked — UI shows cross-reference badges.

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
- Priority indicator (color-coded)
- Collection membership badges
- Checklist progress bar
- Assigned avatar
- Days-in-stage indicator

Drag-and-drop advances stage (with optimistic UI + version check).

### 4.4 Item Detail

Split layout:
- **Left panel:** Script/body editor (Monaco-style markdown)
- **Right panel:** Metadata sidebar (format, stage, priority, language, tags, collections, checklist, dependencies, graduated entities)

Checklist items are toggleable inline. Stage advancement via dropdown or "Advance" button.

---

## 5. Blog Taxonomy Migration

Migrate existing blog categories in the same migration:

| Old | New |
|-----|-----|
| tech, code | Building |
| vida, viagem | Stories |
| negocio | Money |
| crescimento | BTS |

```sql
UPDATE blog_posts SET category = 'building' WHERE category IN ('tech', 'code');
UPDATE blog_posts SET category = 'stories' WHERE category IN ('vida', 'viagem');
UPDATE blog_posts SET category = 'money' WHERE category = 'negocio';
UPDATE blog_posts SET category = 'bts' WHERE category = 'crescimento';

ALTER TABLE blog_posts DROP CONSTRAINT blog_posts_category_check;
ALTER TABLE blog_posts ADD CONSTRAINT blog_posts_category_check
  CHECK (category IN ('stories', 'building', 'money', 'bts'));
```

Create corresponding `content_collections` entries with `type = 'category'`.

---

## 6. Data Seed

Source: `~/Workspace/Youtube/dashboard.html` (78 videos across 6 playlists).

Seed creates:
- 6 `content_collections` (type = 'playlist'): Life Chapters (14), Gaming→Life (13), Taking Control (6), AI Empire (30), Languages (6), Body&Mind (8)
- 3 `content_collections` (type = 'arc', parent = AI Empire): Fundamentals, Hands-on, Vision
- 78 `content_pipeline` items (format = 'video') with appropriate stages based on WRITTEN_SCRIPTS status
- Memberships linking items to their playlists/arcs

Items with scripts in WRITTEN_SCRIPTS get stage = 'roteiro' (or 'gravacao' if marked recorded). All others start at 'idea'.

---

## 7. Realtime & Subscriptions

Supabase Realtime channels for live board updates:

```typescript
const channel = supabase
  .channel('pipeline-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'content_pipeline',
    filter: `site_id=eq.${siteId}`
  }, handleChange)
  .subscribe();
```

Board UI applies optimistic updates on drag, reconciles with realtime events. Version conflicts show toast with "Reload" action.

---

## 8. Search Implementation

### 8.1 Pipeline Search

Uses `search_vector` tsvector column with bilingual support:
- Portuguese dictionary for pt-br content
- English dictionary for en content
- Simple dictionary for tags and code

Query: `plainto_tsquery('portuguese', $q) || plainto_tsquery('english', $q)`

### 8.2 Cross-Entity Search (scope = 'all')

Queries in parallel:
1. `content_pipeline` (tsvector)
2. `blog_posts` (title + content ILIKE or existing search)
3. `newsletter_editions` (subject + preview_text)
4. `youtube_videos` (title + description)

Results merged, ranked by relevance, grouped by type in UI.

### 8.3 Language Filtering

When `lang` param is set:
- `pt-br`: filter items where `language IN ('pt-br', 'both')`
- `en`: filter items where `language IN ('en', 'both')`

---

## 9. Topic Aggregation

`GET /api/pipeline/topics/:code` returns everything related to a theme:

```json
{
  "topic": { "code": "ai-agents", "name": "AI Agents" },
  "pipeline": {
    "video": [...],
    "blog_post": [...],
    "newsletter": [...],
    "course": [...],
    "campaign": [...]
  },
  "published": {
    "blog_posts": [...],
    "newsletter_editions": [...],
    "youtube_videos": [...],
    "campaigns": [...]
  },
  "collections": [...]
}
```

Resolution strategy:
1. Find collection with matching code → get all members
2. Find pipeline items with matching tag
3. Find published entities with matching tags/categories
4. Deduplicate by entity reference

---

## 10. Launch Coordination

Collections with `type = 'launch'` have:
- `metadata.target_date` — launch date
- `metadata.description` — launch goal
- Members are pipeline items that must reach certain stages before launch

Launch View shows:
- Timeline with target date
- Member items with current stage + status dot:
  - **Green:** item is at or past the expected stage for the time remaining
  - **Yellow:** item is 1 stage behind expected pace (needs attention)
  - **Red:** item is 2+ stages behind or has unresolved hard dependencies
- Blockers from `pipeline_dependencies` (hard deps shown as red lines)
- Readiness percentage (items at or past expected stage / total items)

---

## 11. Security

- API keys stored as SHA-256 hashes only
- Permission levels: `read`, `write`, `admin`
- Rate limiting: 100 req/min for API key auth
- All write endpoints validate `can_edit_site(site_id)` via RLS
- API key management restricted to `can_admin_site_users(site_id)`
- `requireSiteAdmin()` guard on all server actions
- Optimistic locking prevents lost updates

---

## 12. Non-Goals (Explicitly Out of Scope)

- Scheduling/publishing automation (handled by existing entity tables)
- Video upload or transcoding
- Email sending (handled by newsletter module)
- Social media posting
- Analytics dashboards (future sprint)
- Mobile app
- Multi-user collaboration (single-user MVP)
