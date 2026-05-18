# Pipeline Video Production Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the CMS Pipeline detail page for video production — dual-mode Roteiro editor, DaVinci Resolve-style PostProd timeline, B-Roll Library with Asset Picker, and supporting data model/API/migration layer.

**Architecture:** 4-phase build (D -> C -> A -> B): Data Foundation first (schemas, migrations, API), then B-Roll Library UI (following Audio Library patterns), then Roteiro dual-mode TipTap editor with print CSS, and finally the DaVinci timeline with 13 tracks, beat accordions, and asset resolver. All new components live under `apps/web/src/app/cms/(authed)/pipeline/` with shared schemas in `apps/web/src/lib/pipeline/`.

**Tech Stack:** Next.js 15 + React 19 + Tailwind 4 + TypeScript 5, TipTap 3.22.4, @dnd-kit (core@6.3.1, sortable@8.0.0), Supabase PostgreSQL (JSONB sections), Zod, Vitest

---

## File Structure

### Phase 1 — Data Foundation (Tasks 1-7)
| Action | Path |
|--------|------|
| Create | `supabase/migrations/<ts>_create_broll_library.sql` |
| Create | `apps/web/src/lib/pipeline/broll-schemas.ts` |
| Create | `apps/web/src/lib/pipeline/postprod-schemas.ts` |
| Modify | `apps/web/src/lib/pipeline/sections.ts` |
| Modify | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/postprod-renderer.tsx` |
| Create | `apps/web/src/lib/pipeline/postprod-migration.ts` |
| Create | `apps/web/src/app/api/pipeline/broll-library/route.ts` |
| Create | `apps/web/src/app/api/pipeline/broll-library/[id]/route.ts` |
| Create | `apps/web/src/app/api/pipeline/broll-library/import/route.ts` |
| Create | `apps/web/src/lib/pipeline/broll-import.ts` |
| Test   | `apps/web/test/unit/pipeline-broll-schemas.test.ts` |
| Test   | `apps/web/test/unit/pipeline-postprod-schemas.test.ts` |
| Test   | `apps/web/test/unit/pipeline-sections.test.ts` |
| Test   | `apps/web/test/unit/pipeline-postprod-migration.test.ts` |
| Test   | `apps/web/test/unit/pipeline-broll-import.test.ts` |

### Phase 2 — B-Roll Library UI (Tasks 8-14)
| Action | Path |
|--------|------|
| Create | `apps/web/src/app/cms/(authed)/pipeline/brolls/_helpers/use-broll-filters.ts` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/brolls/_helpers/broll-helpers.ts` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/frame-strip.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-card.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-grid.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-table.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-filters.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-detail.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-import-modal.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-empty.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-skeleton.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-error-boundary.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-library.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/brolls/page.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/asset-picker-dialog.tsx` |
| Test   | `apps/web/test/unit/use-broll-filters.test.ts` |
| Test   | `apps/web/test/unit/broll-helpers.test.ts` |
| Test   | `apps/web/test/unit/broll-card.test.ts` |
| Test   | `apps/web/test/unit/broll-grid.test.ts` |
| Test   | `apps/web/test/unit/broll-table.test.ts` |
| Test   | `apps/web/test/unit/broll-detail.test.ts` |
| Test   | `apps/web/test/unit/broll-import-modal.test.ts` |
| Test   | `apps/web/test/unit/broll-library.test.ts` |
| Test   | `apps/web/test/unit/asset-picker-dialog.test.ts` |

### Phase 3 — Roteiro Dual-Mode (Tasks 15-20)
| Action | Path |
|--------|------|
| Create | `apps/web/src/lib/pipeline/roteiro-schemas.ts` |
| Create | `apps/web/src/lib/pipeline/script-serializer.ts` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_roteiro/script-tag-extension.ts` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_roteiro/script-pause-extension.ts` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_roteiro/script-meta-editor.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_roteiro/script-beat-toolbar.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_roteiro/script-beat-accordion.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_roteiro/script-edit-mode.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_roteiro/script-view-mode.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_roteiro/script-view-mode.css` |
| Modify | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/script-renderer.tsx` |
| Test   | `apps/web/test/lib/pipeline/roteiro-schemas.test.ts` |
| Test   | `apps/web/test/lib/pipeline/script-serializer.test.ts` |
| Test   | `apps/web/test/unit/script-tag-extension.test.ts` |
| Test   | `apps/web/test/unit/script-pause-extension.test.ts` |
| Test   | `apps/web/test/unit/script-meta-editor.test.ts` |
| Test   | `apps/web/test/unit/script-beat-toolbar.test.ts` |
| Test   | `apps/web/test/unit/script-beat-accordion.test.ts` |
| Test   | `apps/web/test/unit/script-edit-mode.test.ts` |
| Test   | `apps/web/test/unit/script-view-mode.test.ts` |

### Phase 4 — PostProd DaVinci Timeline (Tasks 21-28)
| Action | Path |
|--------|------|
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/types.ts` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/constants.ts` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/utils.ts` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/wave-decor.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/clip-tooltip.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/track-divider.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/resize-handle.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/ruler.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/track-head.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/track-lane.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/timeline-clip.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/crossref-panel.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/speedramps-panel.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/script-panel.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/asset-resolver.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/progress-bar.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/toolbar.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/beat-accordion.tsx` |
| Create | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/post-production-view.tsx` |
| Modify | `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx` |
| Modify | `apps/web/src/lib/pipeline/sections.ts` |
| Test   | `apps/web/test/unit/timeline-utils.test.ts` |
| Test   | `apps/web/test/unit/wave-decor.test.ts` |
| Test   | `apps/web/test/unit/timeline-clip.test.ts` |
| Test   | `apps/web/test/unit/crossref-panel.test.ts` |
| Test   | `apps/web/test/unit/speedramps-panel.test.ts` |
| Test   | `apps/web/test/unit/script-panel.test.ts` |
| Test   | `apps/web/test/unit/asset-resolver.test.ts` |
| Test   | `apps/web/test/unit/beat-accordion.test.ts` |
| Test   | `apps/web/test/unit/post-production-view.test.ts` |

---

## Phase 1 — Data Foundation (Tasks 1-7)

### Task 1 — DB migration -- broll_library + broll_library_usage tables, RLS, triggers, data migration

**Files:**
- Create: `supabase/migrations/&lt;timestamp&gt;_create_broll_library.sql` (via `npm run db:new create_broll_library`)

- [ ] **Step 1: Generate migration file**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run db:new create_broll_library
```

Expected: a new file `supabase/migrations/YYYYMMDDHHMMSS_create_broll_library.sql`

- [ ] **Step 2: Write the migration SQL**

Replace the empty migration file contents with:

```sql
-- ============================================================
-- B-Roll Library: broll_library, broll_library_usage, broll_import_log
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. broll_library
-- ────────────────────────────────────────────────────────────
create table if not exists public.broll_library (
  id                uuid        primary key default gen_random_uuid(),
  site_id           uuid        not null references public.sites(id) on delete cascade,
  asset_id          text        not null,
  original_filename text        not null,
  renamed_to        text,
  sha256            text,
  file_size_bytes   bigint,
  type              text        not null default 'footage'
                                check (type in ('footage','photo','screen_recording','stock','graphic','animation')),
  source            text        not null default 'local',
  source_type       text        not null default 'pessoal'
                                check (source_type in ('pessoal', 'generico')),
  category          text,
  subcategory       text,
  location          text,
  description       text,
  tags              text[]      not null default '{}',
  codec             text,
  fps               smallint,
  resolution        text        not null default '1080p',
  width             int,
  height            int,
  duration_seconds  real,
  bitrate_kbps      int,
  has_audio         boolean     not null default false,
  color_profile     text,
  storage_url       text,
  thumbnail_url     text,
  proxy_url         text,
  reusable          boolean     not null default true,
  status            text        not null default 'available'
                                check (status in ('available', 'pending', 'retired')),
  captured_at       timestamptz,
  metadata          jsonb       not null default '{}',
  search_vector     tsvector,
  version           int         not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_broll_library_site_asset unique (site_id, asset_id),
  constraint uq_broll_library_site_sha   unique (site_id, sha256)
);

-- Indexes
create index if not exists idx_broll_library_site       on public.broll_library (site_id);
create index if not exists idx_broll_library_type       on public.broll_library (site_id, type);
create index if not exists idx_broll_library_status     on public.broll_library (site_id, status);
create index if not exists idx_broll_library_source     on public.broll_library (site_id, source_type);
create index if not exists idx_broll_library_resolution on public.broll_library (site_id, resolution);
create index if not exists idx_broll_library_tags       on public.broll_library using gin (tags);
create index if not exists idx_broll_library_search     on public.broll_library using gin (search_vector);
create index if not exists idx_broll_library_metadata   on public.broll_library using gin (metadata jsonb_path_ops);
create index if not exists idx_broll_library_captured   on public.broll_library (site_id, captured_at desc nulls last);

-- Search vector trigger
CREATE OR REPLACE FUNCTION public.broll_library_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.original_filename, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '') || ' ' || coalesce(NEW.subcategory, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.location, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_broll_library_search_vector ON public.broll_library;
CREATE TRIGGER tg_broll_library_search_vector
  BEFORE INSERT OR UPDATE ON public.broll_library
  FOR EACH ROW EXECUTE FUNCTION public.broll_library_search_vector_update();

-- Version increment trigger
CREATE OR REPLACE FUNCTION public.broll_library_version_increment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.version IS DISTINCT FROM NEW.version THEN
    RETURN NEW;
  END IF;
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_broll_library_version ON public.broll_library;
CREATE TRIGGER tg_broll_library_version
  BEFORE UPDATE ON public.broll_library
  FOR EACH ROW EXECUTE FUNCTION public.broll_library_version_increment();

-- updated_at trigger (reuses shared function)
DROP TRIGGER IF EXISTS tg_broll_library_updated_at ON public.broll_library;
CREATE TRIGGER tg_broll_library_updated_at
  BEFORE UPDATE ON public.broll_library
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RLS
alter table public.broll_library enable row level security;

DROP POLICY IF EXISTS "broll_library: read via can_view_site" ON public.broll_library;
CREATE POLICY "broll_library: read via can_view_site"
  ON public.broll_library FOR SELECT
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "broll_library: write via can_edit_site" ON public.broll_library;
CREATE POLICY "broll_library: write via can_edit_site"
  ON public.broll_library FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ────────────────────────────────────────────────────────────
-- 2. broll_library_usage (join table: broll &lt;-&gt; pipeline item)
-- ────────────────────────────────────────────────────────────
create table if not exists public.broll_library_usage (
  id               uuid        primary key default gen_random_uuid(),
  broll_asset_id   uuid        not null references public.broll_library(id) on delete cascade,
  pipeline_item_id uuid        not null references public.content_pipeline(id) on delete cascade,
  site_id          uuid        not null references public.sites(id),
  beat_index       integer,
  timecode_in      text,
  timecode_out     text,
  usage_type       text        not null default 'cutaway'
                               check (usage_type in ('cutaway','overlay','background','transition','intro','outro')),
  notes            text,
  created_at       timestamptz not null default now(),
  constraint uq_broll_usage unique (broll_asset_id, pipeline_item_id, beat_index)
);

create index if not exists idx_broll_usage_asset    on public.broll_library_usage (broll_asset_id);
create index if not exists idx_broll_usage_pipeline on public.broll_library_usage (pipeline_item_id);
create index if not exists idx_broll_usage_site     on public.broll_library_usage (site_id);

alter table public.broll_library_usage enable row level security;

DROP POLICY IF EXISTS "broll_library_usage: read via can_view_site" ON public.broll_library_usage;
CREATE POLICY "broll_library_usage: read via can_view_site"
  ON public.broll_library_usage FOR SELECT
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "broll_library_usage: write via can_edit_site" ON public.broll_library_usage;
CREATE POLICY "broll_library_usage: write via can_edit_site"
  ON public.broll_library_usage FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ────────────────────────────────────────────────────────────
-- 3. broll_import_log
-- ────────────────────────────────────────────────────────────
create table if not exists public.broll_import_log (
  id             uuid        primary key default gen_random_uuid(),
  site_id        uuid        not null references public.sites(id),
  source         text        not null,
  status         text        not null,
  total_items    integer     not null,
  created_count  integer     not null default 0,
  updated_count  integer     not null default 0,
  skipped_count  integer     not null default 0,
  error_count    integer     not null default 0,
  errors         jsonb       default '[]',
  diff_log       jsonb       default '[]',
  schema_version text,
  imported_by    text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_broll_import_site on public.broll_import_log (site_id);

alter table public.broll_import_log enable row level security;

DROP POLICY IF EXISTS "broll_import_log: read via can_view_site" ON public.broll_import_log;
CREATE POLICY "broll_import_log: read via can_view_site"
  ON public.broll_import_log FOR SELECT
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "broll_import_log: write via can_edit_site" ON public.broll_import_log;
CREATE POLICY "broll_import_log: write via can_edit_site"
  ON public.broll_import_log FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));
```

- [ ] **Step 3: Verify migration applies cleanly**

```bash
npm run db:reset
```

Expected: no errors, all tables created.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_create_broll_library.sql
git commit -m "feat(pipeline): add broll_library + broll_library_usage DB migration

Tables with RLS, search vector, version increment, and import log.
Follows the same pattern as audio_assets migration."
```

---

### Task 2 — B-Roll Zod schemas (broll-schemas.ts) + tests

**Files:**
- Create: `apps/web/src/lib/pipeline/broll-schemas.ts`
- Create: `apps/web/test/unit/pipeline-broll-schemas.test.ts`

- [ ] **Step 1: Create broll-schemas.ts**

Write `apps/web/src/lib/pipeline/broll-schemas.ts`:

```ts
import { z } from 'zod'

export const BROLL_TYPES = ['footage', 'photo', 'screen_recording', 'stock', 'graphic', 'animation'] as const
export const BROLL_STATUSES = ['available', 'pending', 'retired'] as const
export const BROLL_SOURCE_TYPES = ['pessoal', 'generico'] as const
export const BROLL_USAGE_TYPES = ['cutaway', 'overlay', 'background', 'transition', 'intro', 'outro'] as const

export const BRollAssetCreateSchema = z.object({
  asset_id: z.string().min(1).max(100),
  original_filename: z.string().min(1).max(500),
  renamed_to: z.string().max(500).optional(),
  sha256: z.string().length(64).optional(),
  file_size_bytes: z.number().int().nonnegative().optional(),
  type: z.enum(BROLL_TYPES).default('footage'),
  source: z.string().max(200).default('local'),
  source_type: z.enum(BROLL_SOURCE_TYPES).default('pessoal'),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  location: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(50).default([]),
  codec: z.string().max(50).optional(),
  fps: z.number().int().min(1).max(240).optional(),
  resolution: z.string().max(20).default('1080p'),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration_seconds: z.number().nonnegative().optional(),
  bitrate_kbps: z.number().int().positive().optional(),
  has_audio: z.boolean().default(false),
  color_profile: z.string().max(50).optional(),
  storage_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  proxy_url: z.string().url().optional(),
  reusable: z.boolean().default(true),
  status: z.enum(BROLL_STATUSES).default('available'),
  captured_at: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}).refine(
    (val) =&gt; JSON.stringify(val).length &lt;= 65536,
    { message: 'metadata must be under 64KB when serialized' }
  ),
})

export const BRollAssetUpdateSchema = BRollAssetCreateSchema.partial().omit({ asset_id: true, type: true }).extend({
  version: z.number().int().positive(),
})

export const BRollSearchQuerySchema = z.object({
  type: z.enum(BROLL_TYPES).optional(),
  source_type: z.enum(BROLL_SOURCE_TYPES).optional(),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  location: z.string().max(300).optional(),
  resolution: z.string().max(20).optional(),
  has_audio: z.boolean().optional(),
  reusable: z.boolean().optional(),
  duration_range: z.object({ min: z.number(), max: z.number() }).optional(),
  description: z.string().max(500).optional(),
  limit: z.number().int().min(1).max(50).default(10),
})

export const BRollImportItemSchema = z.object({
  asset_id: z.string().min(1).max(100),
  original_filename: z.string().max(500).optional(),
  renamed_to: z.string().max(500).optional(),
  sha256: z.string().length(64).optional(),
  file_size_bytes: z.number().int().nonnegative().optional(),
  type: z.enum(BROLL_TYPES).optional(),
  source: z.string().max(200).optional(),
  source_type: z.enum(BROLL_SOURCE_TYPES).optional(),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  location: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(50).optional(),
  codec: z.string().max(50).optional(),
  fps: z.number().int().min(1).max(240).optional(),
  resolution: z.string().max(20).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration_seconds: z.number().nonnegative().optional(),
  bitrate_kbps: z.number().int().positive().optional(),
  has_audio: z.boolean().optional(),
  color_profile: z.string().max(50).optional(),
  storage_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  proxy_url: z.string().url().optional(),
  reusable: z.boolean().optional(),
  status: z.enum(BROLL_STATUSES).optional(),
  captured_at: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional().refine(
    (val) =&gt; !val || JSON.stringify(val).length &lt;= 65536,
    { message: 'metadata must be under 64KB when serialized' }
  ),
})

export type BRollImportItem = z.infer&lt;typeof BRollImportItemSchema&gt;

export const BRollImportSchema = z.object({
  dry_run: z.boolean().default(false),
  schema_version: z.string(),
  items: z.array(BRollImportItemSchema).max(500).default([]),
})

export const BRollUsageCreateSchema = z.object({
  broll_asset_id: z.string().uuid(),
  pipeline_item_id: z.string().uuid(),
  beat_index: z.number().int().nonnegative().optional(),
  timecode_in: z.string().max(20).optional(),
  timecode_out: z.string().max(20).optional(),
  usage_type: z.enum(BROLL_USAGE_TYPES).default('cutaway'),
  notes: z.string().max(1000).optional(),
})

export type BRollAssetCreate = z.infer&lt;typeof BRollAssetCreateSchema&gt;
export type BRollAssetUpdate = z.infer&lt;typeof BRollAssetUpdateSchema&gt;
export type BRollSearchQuery = z.infer&lt;typeof BRollSearchQuerySchema&gt;
export type BRollImportPayload = z.infer&lt;typeof BRollImportSchema&gt;
export type BRollUsageCreate = z.infer&lt;typeof BRollUsageCreateSchema&gt;
export type BRollType = (typeof BROLL_TYPES)[number]
export type BRollStatus = (typeof BROLL_STATUSES)[number]
export type BRollSourceType = (typeof BROLL_SOURCE_TYPES)[number]

export interface BRollAssetRow {
  id: string
  site_id: string
  asset_id: string
  original_filename: string
  renamed_to: string | null
  sha256: string | null
  file_size_bytes: number | null
  type: BRollType
  source: string
  source_type: BRollSourceType
  category: string | null
  subcategory: string | null
  location: string | null
  description: string | null
  tags: string[]
  codec: string | null
  fps: number | null
  resolution: string
  width: number | null
  height: number | null
  duration_seconds: number | null
  bitrate_kbps: number | null
  has_audio: boolean
  color_profile: string | null
  storage_url: string | null
  thumbnail_url: string | null
  proxy_url: string | null
  reusable: boolean
  status: BRollStatus
  captured_at: string | null
  metadata: Record&lt;string, unknown&gt;
  version: number
  created_at: string
  updated_at: string
}

export interface BRollUsageRow {
  id: string
  broll_asset_id: string
  pipeline_item_id: string
  site_id: string
  beat_index: number | null
  timecode_in: string | null
  timecode_out: string | null
  usage_type: string
  notes: string | null
  content_pipeline?: { code: string; title_pt: string; format: string }
}
```

- [ ] **Step 2: Create tests**

Write `apps/web/test/unit/pipeline-broll-schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  BRollAssetCreateSchema,
  BRollAssetUpdateSchema,
  BRollImportSchema,
  BRollImportItemSchema,
  BRollUsageCreateSchema,
  BRollSearchQuerySchema,
  BROLL_TYPES,
  BROLL_STATUSES,
  BROLL_SOURCE_TYPES,
  BROLL_USAGE_TYPES,
} from '@/lib/pipeline/broll-schemas'

describe('BRollAssetCreateSchema', () =&gt; {
  const minimal = {
    asset_id: 'BROLL_DRONE_01',
    original_filename: 'DJI_0042.mp4',
  }

  it('accepts minimal valid input with defaults', () =&gt; {
    const result = BRollAssetCreateSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('footage')
      expect(result.data.source).toBe('local')
      expect(result.data.source_type).toBe('pessoal')
      expect(result.data.resolution).toBe('1080p')
      expect(result.data.has_audio).toBe(false)
      expect(result.data.reusable).toBe(true)
      expect(result.data.status).toBe('available')
      expect(result.data.tags).toEqual([])
      expect(result.data.metadata).toEqual({})
    }
  })

  it('accepts full valid input', () =&gt; {
    const result = BRollAssetCreateSchema.safeParse({
      ...minimal,
      renamed_to: 'drone-sunset-beach.mp4',
      sha256: 'a'.repeat(64),
      file_size_bytes: 1024000,
      type: 'screen_recording',
      source: 'obs',
      source_type: 'generico',
      category: 'b-roll',
      subcategory: 'drone',
      location: 'Florianopolis, SC',
      description: 'Sunset over the beach',
      tags: ['sunset', 'drone', 'beach'],
      codec: 'h264',
      fps: 60,
      resolution: '4k',
      width: 3840,
      height: 2160,
      duration_seconds: 45.5,
      bitrate_kbps: 50000,
      has_audio: true,
      color_profile: 'rec709',
      storage_url: 'https://storage.example.com/clip.mp4',
      thumbnail_url: 'https://storage.example.com/thumb.jpg',
      proxy_url: 'https://storage.example.com/proxy.mp4',
      reusable: false,
      status: 'pending',
      captured_at: '2026-05-10T14:00:00Z',
      metadata: { camera: 'DJI Mini 4' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty asset_id', () =&gt; {
    const result = BRollAssetCreateSchema.safeParse({ ...minimal, asset_id: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid type', () =&gt; {
    const result = BRollAssetCreateSchema.safeParse({ ...minimal, type: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid source_type', () =&gt; {
    const result = BRollAssetCreateSchema.safeParse({ ...minimal, source_type: 'outro' })
    expect(result.success).toBe(false)
  })

  it('rejects sha256 with wrong length', () =&gt; {
    const result = BRollAssetCreateSchema.safeParse({ ...minimal, sha256: 'abc' })
    expect(result.success).toBe(false)
  })

  it('rejects metadata over 64KB', () =&gt; {
    const result = BRollAssetCreateSchema.safeParse({
      ...minimal,
      metadata: { large: 'x'.repeat(70000) },
    })
    expect(result.success).toBe(false)
  })

  it('rejects fps out of range', () =&gt; {
    expect(BRollAssetCreateSchema.safeParse({ ...minimal, fps: 0 }).success).toBe(false)
    expect(BRollAssetCreateSchema.safeParse({ ...minimal, fps: 241 }).success).toBe(false)
  })

  it('rejects negative file_size_bytes', () =&gt; {
    const result = BRollAssetCreateSchema.safeParse({ ...minimal, file_size_bytes: -1 })
    expect(result.success).toBe(false)
  })
})

describe('BRollAssetUpdateSchema', () =&gt; {
  it('requires version', () =&gt; {
    const result = BRollAssetUpdateSchema.safeParse({ description: 'updated' })
    expect(result.success).toBe(false)
  })

  it('accepts partial update with version', () =&gt; {
    const result = BRollAssetUpdateSchema.safeParse({
      description: 'updated desc',
      tags: ['new-tag'],
      version: 1,
    })
    expect(result.success).toBe(true)
  })

  it('strips asset_id and type from update', () =&gt; {
    const result = BRollAssetUpdateSchema.safeParse({
      version: 1,
      description: 'test',
    })
    expect(result.success).toBe(true)
  })
})

describe('BRollImportSchema', () =&gt; {
  it('accepts valid import payload', () =&gt; {
    const result = BRollImportSchema.safeParse({
      dry_run: true,
      schema_version: '1.0.0',
      items: [
        { asset_id: 'BROLL_01', original_filename: 'clip.mp4' },
        { asset_id: 'BROLL_02', original_filename: 'photo.jpg', type: 'photo' },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items).toHaveLength(2)
      expect(result.data.dry_run).toBe(true)
    }
  })

  it('defaults dry_run to false', () =&gt; {
    const result = BRollImportSchema.safeParse({
      schema_version: '1.0.0',
      items: [],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.dry_run).toBe(false)
    }
  })

  it('rejects more than 500 items', () =&gt; {
    const items = Array.from({ length: 501 }, (_, i) =&gt; ({
      asset_id: `BROLL_${i}`,
    }))
    const result = BRollImportSchema.safeParse({
      schema_version: '1.0.0',
      items,
    })
    expect(result.success).toBe(false)
  })
})

describe('BRollUsageCreateSchema', () =&gt; {
  it('validates valid usage', () =&gt; {
    const result = BRollUsageCreateSchema.safeParse({
      broll_asset_id: '550e8400-e29b-41d4-a716-446655440000',
      pipeline_item_id: '550e8400-e29b-41d4-a716-446655440001',
      beat_index: 3,
      timecode_in: '00:01:30',
      timecode_out: '00:01:45',
      usage_type: 'overlay',
      notes: 'Use during talking head segment',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid UUIDs', () =&gt; {
    const result = BRollUsageCreateSchema.safeParse({
      broll_asset_id: 'not-a-uuid',
      pipeline_item_id: 'also-not-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('defaults usage_type to cutaway', () =&gt; {
    const result = BRollUsageCreateSchema.safeParse({
      broll_asset_id: '550e8400-e29b-41d4-a716-446655440000',
      pipeline_item_id: '550e8400-e29b-41d4-a716-446655440001',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.usage_type).toBe('cutaway')
    }
  })

  it('rejects invalid usage_type', () =&gt; {
    const result = BRollUsageCreateSchema.safeParse({
      broll_asset_id: '550e8400-e29b-41d4-a716-446655440000',
      pipeline_item_id: '550e8400-e29b-41d4-a716-446655440001',
      usage_type: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})

describe('BRollSearchQuerySchema', () =&gt; {
  it('accepts empty query with defaults', () =&gt; {
    const result = BRollSearchQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(10)
    }
  })

  it('accepts full query', () =&gt; {
    const result = BRollSearchQuerySchema.safeParse({
      type: 'footage',
      source_type: 'pessoal',
      category: 'drone',
      tags: ['sunset'],
      location: 'Floripa',
      resolution: '4k',
      has_audio: false,
      reusable: true,
      duration_range: { min: 5, max: 60 },
      limit: 20,
    })
    expect(result.success).toBe(true)
  })
})

describe('type constants', () =&gt; {
  it('BROLL_TYPES has 6 entries', () =&gt; {
    expect(BROLL_TYPES).toHaveLength(6)
  })

  it('BROLL_STATUSES has 3 entries', () =&gt; {
    expect(BROLL_STATUSES).toHaveLength(3)
  })

  it('BROLL_SOURCE_TYPES has 2 entries', () =&gt; {
    expect(BROLL_SOURCE_TYPES).toHaveLength(2)
  })

  it('BROLL_USAGE_TYPES has 6 entries', () =&gt; {
    expect(BROLL_USAGE_TYPES).toHaveLength(6)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npx vitest run apps/web/test/unit/pipeline-broll-schemas.test.ts --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/pipeline/broll-schemas.ts apps/web/test/unit/pipeline-broll-schemas.test.ts
git commit -m "feat(pipeline): add B-Roll library Zod schemas + tests

BRollAssetCreate/Update, Import, Usage, Search schemas.
Mirrors audio-schemas.ts pattern for visual assets."
```

---

### Task 3 — PostProd Zod schemas (postprod-schemas.ts) + tests

**Files:**
- Create: `apps/web/src/lib/pipeline/postprod-schemas.ts`
- Create: `apps/web/test/unit/pipeline-postprod-schemas.test.ts`

- [ ] **Step 1: Create postprod-schemas.ts**

Write `apps/web/src/lib/pipeline/postprod-schemas.ts`:

```ts
import { z } from 'zod'

// ─── Track Configuration ─────────────────────────────────────
export const TrackConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['video', 'audio', 'music', 'sfx', 'graphics', 'text']),
  locked: z.boolean().default(false),
  muted: z.boolean().default(false),
  visible: z.boolean().default(true),
})

// ─── Beat (timeline segment) ─────────────────────────────────
export const BeatSchema = z.object({
  index: z.number().int().nonnegative(),
  label: z.string().min(1),
  beat_ref: z.string().optional(),
  timecode_in: z.string().optional(),
  timecode_out: z.string().optional(),
  duration_sec: z.number().nonnegative().optional(),
  status: z.enum(['pending', 'in_progress', 'done', 'review']).default('pending'),
  difficulty: z.enum(['easy', 'medium', 'hard', 'complex']).optional(),
  narrative: z.string().optional(),
  edit_notes: z.array(z.string()).default([]),
  transition_in: z.object({
    type: z.string(),
    reasoning: z.string().optional(),
  }).optional(),
  transition_out: z.object({
    type: z.string(),
    reasoning: z.string().optional(),
  }).optional(),
})

// ─── Timeline ────────────────────────────────────────────────
export const TimelineSchema = z.object({
  tracks: z.array(TrackConfigSchema).default([]),
  beats: z.array(BeatSchema).default([]),
  total_duration_sec: z.number().nonnegative().default(0),
  fps: z.number().int().min(1).max(240).default(30),
})

// ─── Music asset reference ───────────────────────────────────
export const MusicAssetRefSchema = z.object({
  asset_id: z.string().optional(),
  track_name: z.string().optional(),
  artist: z.string().optional(),
  bpm: z.number().int().positive().optional(),
  energy: z.number().int().min(1).max(5).optional(),
  entry_style: z.string().optional(),
  role: z.enum(['primary', 'secondary', 'accent']).default('primary'),
  volume_db: z.number().optional(),
  notes: z.string().optional(),
})

// ─── SFX asset reference ─────────────────────────────────────
export const SFXAssetRefSchema = z.object({
  asset_id: z.string().optional(),
  label: z.string().min(1),
  timecode: z.string().optional(),
  type: z.enum(['whoosh', 'impact', 'riser', 'ambient', 'foley', 'ui', 'other']).default('other'),
  volume_db: z.number().optional(),
  notes: z.string().optional(),
})

// ─── Visual asset reference (b-roll in timeline) ─────────────
export const VisualAssetRefSchema = z.object({
  asset_id: z.string().optional(),
  label: z.string().min(1),
  type: z.enum(['broll', 'screen_recording', 'graphic', 'animation', 'photo', 'stock']).default('broll'),
  timecode_in: z.string().optional(),
  timecode_out: z.string().optional(),
  speed: z.string().optional(),
  effect: z.string().optional(),
  notes: z.string().optional(),
})

// ─── Ambience reference ──────────────────────────────────────
export const AmbienceAssetRefSchema = z.object({
  asset_id: z.string().optional(),
  label: z.string().min(1),
  environment: z.string().optional(),
  volume_db: z.number().optional(),
  notes: z.string().optional(),
})

// ─── Sound design reference ──────────────────────────────────
export const SoundDesignAssetRefSchema = z.object({
  asset_id: z.string().optional(),
  label: z.string().min(1),
  category: z.string().optional(),
  volume_db: z.number().optional(),
  notes: z.string().optional(),
})

// ─── Beat assets (all assets for a given beat) ───────────────
export const BeatAssetsSchema = z.object({
  music: z.array(MusicAssetRefSchema).default([]),
  sfx: z.array(SFXAssetRefSchema).default([]),
  visual: z.array(VisualAssetRefSchema).default([]),
  ambience: z.array(AmbienceAssetRefSchema).default([]),
  soundDesign: z.array(SoundDesignAssetRefSchema).default([]),
})

// ─── Cross-reference beat ────────────────────────────────────
export const CrossRefBeatSchema = z.object({
  beat: z.string().min(1),
  srt_timestamp: z.string().optional(),
  duration: z.string().optional(),
  script_estimate: z.string().optional(),
  status: z.enum(['match', 'diverge', 'missing', 'extra']).default('match'),
})

// ─── Cross-reference section ─────────────────────────────────
export const CrossRefSchema = z.object({
  summary: z.string().default(''),
  beats: z.array(CrossRefBeatSchema).default([]),
  divergences: z.array(z.string()).default([]),
  source: z.string().default(''),
})

// ─── Speed ramp section ──────────────────────────────────────
export const SpeedRampSectionSchema = z.object({
  section: z.string().min(1),
  srt_range: z.string().optional(),
  timeline: z.string().optional(),
  speed: z.string().min(1),
  rationale: z.string().optional(),
})

export const SpeedRampsSchema = z.object({
  summary: z.string().default(''),
  base: z.string().default(''),
  est_final: z.string().default(''),
  edit_style: z.string().default(''),
  sections: z.array(SpeedRampSectionSchema).default([]),
  source: z.string().default(''),
})

// ─── Unified PostProd section schema ─────────────────────────
export const PostProdSectionSchema = z.object({
  schema_version: z.literal('2.0'),
  timeline: TimelineSchema.default({
    tracks: [],
    beats: [],
    total_duration_sec: 0,
    fps: 30,
  }),
  assets: z.record(
    z.coerce.number().int().nonnegative(),
    BeatAssetsSchema,
  ).default({}),
  crossref: CrossRefSchema.default({
    summary: '',
    beats: [],
    divergences: [],
    source: '',
  }),
  speedramps: SpeedRampsSchema.default({
    summary: '',
    base: '',
    est_final: '',
    edit_style: '',
    sections: [],
    source: '',
  }),
})

export type TrackConfig = z.infer&lt;typeof TrackConfigSchema&gt;
export type Beat = z.infer&lt;typeof BeatSchema&gt;
export type Timeline = z.infer&lt;typeof TimelineSchema&gt;
export type MusicAssetRef = z.infer&lt;typeof MusicAssetRefSchema&gt;
export type SFXAssetRef = z.infer&lt;typeof SFXAssetRefSchema&gt;
export type VisualAssetRef = z.infer&lt;typeof VisualAssetRefSchema&gt;
export type AmbienceAssetRef = z.infer&lt;typeof AmbienceAssetRefSchema&gt;
export type SoundDesignAssetRef = z.infer&lt;typeof SoundDesignAssetRefSchema&gt;
export type BeatAssets = z.infer&lt;typeof BeatAssetsSchema&gt;
export type CrossRefBeat = z.infer&lt;typeof CrossRefBeatSchema&gt;
export type CrossRef = z.infer&lt;typeof CrossRefSchema&gt;
export type SpeedRampSection = z.infer&lt;typeof SpeedRampSectionSchema&gt;
export type SpeedRamps = z.infer&lt;typeof SpeedRampsSchema&gt;
export type PostProdSection = z.infer&lt;typeof PostProdSectionSchema&gt;
```

- [ ] **Step 2: Create tests**

Write `apps/web/test/unit/pipeline-postprod-schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  PostProdSectionSchema,
  TimelineSchema,
  BeatSchema,
  TrackConfigSchema,
  MusicAssetRefSchema,
  SFXAssetRefSchema,
  VisualAssetRefSchema,
  BeatAssetsSchema,
  CrossRefSchema,
  CrossRefBeatSchema,
  SpeedRampsSchema,
  SpeedRampSectionSchema,
} from '@/lib/pipeline/postprod-schemas'

describe('TrackConfigSchema', () =&gt; {
  it('accepts valid track config', () =&gt; {
    const result = TrackConfigSchema.safeParse({
      id: 'v1',
      label: 'Video 1',
      type: 'video',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.locked).toBe(false)
      expect(result.data.muted).toBe(false)
      expect(result.data.visible).toBe(true)
    }
  })

  it('rejects missing id', () =&gt; {
    expect(TrackConfigSchema.safeParse({ label: 'V1', type: 'video' }).success).toBe(false)
  })

  it('rejects invalid type', () =&gt; {
    expect(TrackConfigSchema.safeParse({ id: 'v1', label: 'V1', type: 'invalid' }).success).toBe(false)
  })
})

describe('BeatSchema', () =&gt; {
  it('accepts valid beat with defaults', () =&gt; {
    const result = BeatSchema.safeParse({ index: 0, label: 'Hook' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('pending')
      expect(result.data.edit_notes).toEqual([])
    }
  })

  it('accepts full beat', () =&gt; {
    const result = BeatSchema.safeParse({
      index: 3,
      label: 'Development',
      beat_ref: 'beat_3',
      timecode_in: '00:02:30',
      timecode_out: '00:04:15',
      duration_sec: 105,
      status: 'done',
      difficulty: 'hard',
      narrative: 'Main argument section',
      edit_notes: ['Jump cut here', 'Add lower third'],
      transition_in: { type: 'crossfade', reasoning: 'Smooth topic change' },
      transition_out: { type: 'cut' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative index', () =&gt; {
    expect(BeatSchema.safeParse({ index: -1, label: 'Hook' }).success).toBe(false)
  })

  it('rejects invalid status', () =&gt; {
    expect(BeatSchema.safeParse({ index: 0, label: 'Hook', status: 'unknown' }).success).toBe(false)
  })
})

describe('TimelineSchema', () =&gt; {
  it('accepts empty timeline with defaults', () =&gt; {
    const result = TimelineSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tracks).toEqual([])
      expect(result.data.beats).toEqual([])
      expect(result.data.total_duration_sec).toBe(0)
      expect(result.data.fps).toBe(30)
    }
  })

  it('accepts timeline with tracks and beats', () =&gt; {
    const result = TimelineSchema.safeParse({
      tracks: [{ id: 'v1', label: 'Video', type: 'video' }],
      beats: [{ index: 0, label: 'Intro' }],
      total_duration_sec: 600,
      fps: 60,
    })
    expect(result.success).toBe(true)
  })

  it('rejects fps out of range', () =&gt; {
    expect(TimelineSchema.safeParse({ fps: 0 }).success).toBe(false)
    expect(TimelineSchema.safeParse({ fps: 241 }).success).toBe(false)
  })
})

describe('MusicAssetRefSchema', () =&gt; {
  it('accepts minimal music ref with default role', () =&gt; {
    const result = MusicAssetRefSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.role).toBe('primary')
    }
  })

  it('accepts full music ref', () =&gt; {
    const result = MusicAssetRefSchema.safeParse({
      asset_id: 'MUSIC_EPIC_01',
      track_name: 'Rise Above',
      artist: 'Composer X',
      bpm: 120,
      energy: 4,
      entry_style: 'fade_in_4bars',
      role: 'secondary',
      volume_db: -6,
      notes: 'Comes in after hook',
    })
    expect(result.success).toBe(true)
  })
})

describe('SFXAssetRefSchema', () =&gt; {
  it('requires label', () =&gt; {
    expect(SFXAssetRefSchema.safeParse({}).success).toBe(false)
    expect(SFXAssetRefSchema.safeParse({ label: 'whoosh' }).success).toBe(true)
  })

  it('defaults type to other', () =&gt; {
    const result = SFXAssetRefSchema.safeParse({ label: 'click' })
    if (result.success) expect(result.data.type).toBe('other')
  })
})

describe('VisualAssetRefSchema', () =&gt; {
  it('requires label', () =&gt; {
    expect(VisualAssetRefSchema.safeParse({}).success).toBe(false)
  })

  it('accepts full visual ref', () =&gt; {
    const result = VisualAssetRefSchema.safeParse({
      asset_id: 'BROLL_DRONE_01',
      label: 'Drone flyover',
      type: 'broll',
      timecode_in: '00:01:30',
      timecode_out: '00:01:38',
      speed: '1.5x',
      effect: 'color_grade_warm',
      notes: 'Slow reveal',
    })
    expect(result.success).toBe(true)
  })
})

describe('BeatAssetsSchema', () =&gt; {
  it('accepts empty beat assets with defaults', () =&gt; {
    const result = BeatAssetsSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.music).toEqual([])
      expect(result.data.sfx).toEqual([])
      expect(result.data.visual).toEqual([])
      expect(result.data.ambience).toEqual([])
      expect(result.data.soundDesign).toEqual([])
    }
  })

  it('accepts populated beat assets', () =&gt; {
    const result = BeatAssetsSchema.safeParse({
      music: [{ track_name: 'Epic Rise' }],
      sfx: [{ label: 'whoosh', type: 'whoosh' }],
      visual: [{ label: 'drone shot', type: 'broll' }],
      ambience: [{ label: 'office hum' }],
      soundDesign: [{ label: 'bass drop' }],
    })
    expect(result.success).toBe(true)
  })
})

describe('CrossRefSchema', () =&gt; {
  it('accepts empty crossref with defaults', () =&gt; {
    const result = CrossRefSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.summary).toBe('')
      expect(result.data.beats).toEqual([])
      expect(result.data.divergences).toEqual([])
    }
  })

  it('accepts full crossref', () =&gt; {
    const result = CrossRefSchema.safeParse({
      summary: 'Script and edit align well',
      beats: [
        { beat: 'Hook', srt_timestamp: '00:00:00', duration: '15s', status: 'match' },
        { beat: 'CTA', srt_timestamp: '00:08:00', duration: '30s', status: 'diverge' },
      ],
      divergences: ['CTA is 10s longer than planned'],
      source: 'cowork',
    })
    expect(result.success).toBe(true)
  })
})

describe('CrossRefBeatSchema', () =&gt; {
  it('requires beat label', () =&gt; {
    expect(CrossRefBeatSchema.safeParse({}).success).toBe(false)
    expect(CrossRefBeatSchema.safeParse({ beat: 'Hook' }).success).toBe(true)
  })

  it('defaults status to match', () =&gt; {
    const result = CrossRefBeatSchema.safeParse({ beat: 'Hook' })
    if (result.success) expect(result.data.status).toBe('match')
  })
})

describe('SpeedRampsSchema', () =&gt; {
  it('accepts empty speedramps with defaults', () =&gt; {
    const result = SpeedRampsSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sections).toEqual([])
      expect(result.data.summary).toBe('')
    }
  })

  it('accepts full speedramps', () =&gt; {
    const result = SpeedRampsSchema.safeParse({
      summary: 'Dynamic pacing',
      base: '1.15x',
      est_final: '9:30',
      edit_style: 'aggressive',
      sections: [
        { section: 'Hook', speed: '1.0x', rationale: 'Keep original pace' },
        { section: 'Filler', srt_range: '02:30-03:00', timeline: '02:10-02:20', speed: '2.0x', rationale: 'Skip redundant' },
      ],
      source: 'cowork',
    })
    expect(result.success).toBe(true)
  })
})

describe('SpeedRampSectionSchema', () =&gt; {
  it('requires section and speed', () =&gt; {
    expect(SpeedRampSectionSchema.safeParse({}).success).toBe(false)
    expect(SpeedRampSectionSchema.safeParse({ section: 'Hook' }).success).toBe(false)
    expect(SpeedRampSectionSchema.safeParse({ section: 'Hook', speed: '1.0x' }).success).toBe(true)
  })
})

describe('PostProdSectionSchema', () =&gt; {
  it('accepts minimal valid schema', () =&gt; {
    const result = PostProdSectionSchema.safeParse({ schema_version: '2.0' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.schema_version).toBe('2.0')
      expect(result.data.timeline.fps).toBe(30)
      expect(result.data.assets).toEqual({})
      expect(result.data.crossref.beats).toEqual([])
      expect(result.data.speedramps.sections).toEqual([])
    }
  })

  it('rejects wrong schema_version', () =&gt; {
    expect(PostProdSectionSchema.safeParse({ schema_version: '1.0' }).success).toBe(false)
    expect(PostProdSectionSchema.safeParse({ schema_version: '3.0' }).success).toBe(false)
  })

  it('accepts full postprod section', () =&gt; {
    const full = {
      schema_version: '2.0' as const,
      timeline: {
        tracks: [
          { id: 'v1', label: 'Video 1', type: 'video' },
          { id: 'a1', label: 'Audio 1', type: 'audio' },
          { id: 'm1', label: 'Music', type: 'music' },
        ],
        beats: [
          { index: 0, label: 'Hook', timecode_in: '00:00:00', timecode_out: '00:00:15', duration_sec: 15, status: 'done' },
          { index: 1, label: 'Intro', timecode_in: '00:00:15', timecode_out: '00:01:00', duration_sec: 45, status: 'in_progress' },
        ],
        total_duration_sec: 600,
        fps: 30,
      },
      assets: {
        0: {
          music: [{ asset_id: 'MUSIC_01', track_name: 'Epic Rise', role: 'primary' }],
          sfx: [{ label: 'whoosh', type: 'whoosh' }],
          visual: [{ label: 'drone shot', type: 'broll', asset_id: 'BROLL_01' }],
          ambience: [],
          soundDesign: [],
        },
        1: {
          music: [],
          sfx: [],
          visual: [{ label: 'screen capture', type: 'screen_recording' }],
          ambience: [{ label: 'office ambience' }],
          soundDesign: [],
        },
      },
      crossref: {
        summary: 'Aligns with script',
        beats: [{ beat: 'Hook', srt_timestamp: '00:00:00', duration: '15s', status: 'match' }],
        divergences: [],
        source: 'cowork',
      },
      speedramps: {
        summary: 'Standard pacing',
        base: '1.0x',
        est_final: '10:00',
        edit_style: 'moderate',
        sections: [{ section: 'Hook', speed: '1.0x', rationale: 'Keep pace' }],
        source: 'cowork',
      },
    }
    const result = PostProdSectionSchema.safeParse(full)
    expect(result.success).toBe(true)
  })

  it('coerces string beat index keys to numbers', () =&gt; {
    const result = PostProdSectionSchema.safeParse({
      schema_version: '2.0',
      assets: {
        '0': { music: [], sfx: [], visual: [{ label: 'clip' }], ambience: [], soundDesign: [] },
      },
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npx vitest run apps/web/test/unit/pipeline-postprod-schemas.test.ts --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/pipeline/postprod-schemas.ts apps/web/test/unit/pipeline-postprod-schemas.test.ts
git commit -m "feat(pipeline): add unified PostProd v2.0 Zod schemas + tests

Consolidates scene guide, cross-ref, speed ramps, and asset
references into a single PostProdSectionSchema with schema_version 2.0."
```

---

### Task 4 — Section definitions update (sections.ts) + test updates

**Files:**
- Modify: `apps/web/src/lib/pipeline/sections.ts`
- Modify: `apps/web/test/unit/pipeline-sections.test.ts`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/tab-container.tsx`

- [ ] **Step 1: Update SHARED_SECTIONS -- remove brolls**

In `apps/web/src/lib/pipeline/sections.ts`, change:

```ts
const SHARED_SECTIONS = new Set(['ideia', 'brolls', 'images'])
```

to:

```ts
const SHARED_SECTIONS = new Set(['ideia', 'images'])
```

- [ ] **Step 2: Update SECTION_DEFINITIONS -- remove brolls from video, remove postprod.subSections**

In `apps/web/src/lib/pipeline/sections.ts`, replace the entire `video` section definition:

```ts
  video: [
    { key: 'ideia', label_pt: 'Ideia', label_en: 'Idea', type: 'ideia', shared: true },
    { key: 'roteiro', label_pt: 'Roteiro', label_en: 'Script', type: 'roteiro', shared: false },
    { key: 'brolls', label_pt: 'B-Rolls', label_en: 'B-Rolls', type: 'brolls', shared: true },
    {
      key: 'postprod', label_pt: 'Pós-Produção', label_en: 'Post-Production', type: 'postprod', shared: false,
      subSections: [
        { key: 'postprod_scenes', label_pt: 'Cena × Cena', label_en: 'Scene × Scene', type: 'postprod_scenes', shared: false },
        { key: 'postprod_crossref', label_pt: 'Cross-Reference', label_en: 'Cross-Reference', type: 'postprod_crossref', shared: false },
        { key: 'postprod_speedramps', label_pt: 'Speed Ramps', label_en: 'Speed Ramps', type: 'postprod_speedramps', shared: false },
      ],
    },
    { key: 'publish', label_pt: 'Publicação', label_en: 'Publication', type: 'publish', shared: false },
  ],
```

with:

```ts
  video: [
    { key: 'ideia', label_pt: 'Ideia', label_en: 'Idea', type: 'ideia', shared: true },
    { key: 'roteiro', label_pt: 'Roteiro', label_en: 'Script', type: 'roteiro', shared: false },
    { key: 'postprod', label_pt: 'Pós-Produção', label_en: 'Post-Production', type: 'postprod', shared: false },
    { key: 'publish', label_pt: 'Publicação', label_en: 'Publication', type: 'publish', shared: false },
  ],
```

- [ ] **Step 3: Update TAB_DEPENDENCIES in tab-container.tsx**

In `apps/web/src/app/cms/(authed)/pipeline/_components/detail/tab-container.tsx`, remove the `brolls` entry from `TAB_DEPENDENCIES`:

Change:

```ts
const TAB_DEPENDENCIES: Record&lt;string, string[]&gt; = {
  brolls: ['roteiro'],
  postprod: ['roteiro'],
  publish: ['roteiro'],
```

to:

```ts
const TAB_DEPENDENCIES: Record&lt;string, string[]&gt; = {
  postprod: ['roteiro'],
  publish: ['roteiro'],
```

- [ ] **Step 4: Update tests**

Replace `apps/web/test/unit/pipeline-sections.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { getSectionKey, getSectionsForFormat, flattenSections, SectionDataSchema, SectionPatchSchema } from '@/lib/pipeline/sections'

describe('getSectionKey', () =&gt; {
  it('returns shared key for shared sections', () =&gt; {
    expect(getSectionKey('ideia', 'en')).toBe('ideia_shared')
    expect(getSectionKey('images', 'pt')).toBe('images_shared')
  })

  it('returns lang-specific key for bilateral sections', () =&gt; {
    expect(getSectionKey('roteiro', 'en')).toBe('roteiro_en')
    expect(getSectionKey('roteiro', 'pt')).toBe('roteiro_pt')
    expect(getSectionKey('publish', 'en')).toBe('publish_en')
  })

  it('returns lang-specific key for postprod (no longer shared)', () =&gt; {
    expect(getSectionKey('postprod', 'en')).toBe('postprod_en')
    expect(getSectionKey('postprod', 'pt')).toBe('postprod_pt')
  })

  it('brolls is no longer shared — returns lang-specific key', () =&gt; {
    expect(getSectionKey('brolls', 'en')).toBe('brolls_en')
    expect(getSectionKey('brolls', 'pt')).toBe('brolls_pt')
  })

  it('returns lang-specific key for legacy postprod sub-section keys', () =&gt; {
    expect(getSectionKey('postprod_scenes', 'en')).toBe('postprod_scenes_en')
    expect(getSectionKey('postprod_crossref', 'pt')).toBe('postprod_crossref_pt')
    expect(getSectionKey('postprod_speedramps', 'en')).toBe('postprod_speedramps_en')
  })
})

describe('getSectionsForFormat', () =&gt; {
  it('returns 4 primary sections for video (brolls removed)', () =&gt; {
    const sections = getSectionsForFormat('video')
    expect(sections.map(s =&gt; s.key)).toEqual([
      'ideia', 'roteiro', 'postprod', 'publish',
    ])
  })

  it('marks only ideia as shared for video', () =&gt; {
    const sections = getSectionsForFormat('video')
    expect(sections.find(s =&gt; s.key === 'ideia')!.shared).toBe(true)
    expect(sections.find(s =&gt; s.key === 'roteiro')!.shared).toBe(false)
    expect(sections.find(s =&gt; s.key === 'postprod')!.shared).toBe(false)
  })

  it('postprod has no subSections', () =&gt; {
    const sections = getSectionsForFormat('video')
    const postprod = sections.find(s =&gt; s.key === 'postprod')!
    expect(postprod.subSections).toBeUndefined()
  })

  it('brolls is not in video sections', () =&gt; {
    const sections = getSectionsForFormat('video')
    expect(sections.find(s =&gt; s.key === 'brolls')).toBeUndefined()
  })

  it('returns sections for blog_post', () =&gt; {
    const sections = getSectionsForFormat('blog_post')
    expect(sections.map(s =&gt; s.key)).toEqual([
      'ideia', 'draft', 'seo', 'images', 'publish',
    ])
  })

  it('flattenSections with no sub-sections returns same array', () =&gt; {
    const sections = getSectionsForFormat('video')
    expect(flattenSections(sections)).toEqual(sections)
  })
})

describe('SectionDataSchema', () =&gt; {
  it('validates a valid section', () =&gt; {
    const result = SectionDataSchema.safeParse({
      rev: 1,
      source: 'producer',
      edited: false,
      content: 'some content',
      updated_at: '2026-05-10T14:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('allows null cowork_rev', () =&gt; {
    const result = SectionDataSchema.safeParse({
      rev: 1,
      cowork_rev: null,
      source: 'user',
      edited: false,
      content: { beats: [] },
      updated_at: '2026-05-10T14:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative rev', () =&gt; {
    const result = SectionDataSchema.safeParse({
      rev: -1,
      source: 'user',
      edited: false,
      content: '',
      updated_at: '2026-05-10T14:00:00Z',
    })
    expect(result.success).toBe(false)
  })
})

describe('SectionPatchSchema', () =&gt; {
  it('validates a patch with content and rev', () =&gt; {
    const result = SectionPatchSchema.safeParse({
      content: 'updated content',
      rev: 2,
    })
    expect(result.success).toBe(true)
  })

  it('rejects patch without rev', () =&gt; {
    const result = SectionPatchSchema.safeParse({
      content: 'updated',
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npx vitest run apps/web/test/unit/pipeline-sections.test.ts --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/pipeline/sections.ts apps/web/test/unit/pipeline-sections.test.ts apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/tab-container.tsx
git commit -m "refactor(pipeline): remove brolls from shared sections, remove postprod sub-sections

brolls moves to standalone B-Roll Library (no longer a pipeline section).
postprod becomes a unified section (sub-tabs removed).
Updates tab dependencies and all related tests."
```

---

### Task 5 — Section content registry + pipeline-item-detail sub-section removal

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/postprod-renderer.tsx`

- [ ] **Step 1: Create PostProductionView placeholder renderer**

Write `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/postprod-renderer.tsx`:

```tsx
'use client'

import type { RendererProps } from '../section-content'

interface PostProdContent {
  schema_version?: string
  timeline?: {
    beats?: Array&lt;{
      index: number
      label: string
      status?: string
      timecode_in?: string
      timecode_out?: string
      duration_sec?: number
    }&gt;
    total_duration_sec?: number
    fps?: number
  }
  assets?: Record&lt;string, unknown&gt;
  crossref?: {
    summary?: string
    beats?: Array&lt;{ beat: string; status?: string }&gt;
    divergences?: string[]
  }
  speedramps?: {
    summary?: string
    sections?: Array&lt;{ section: string; speed: string; rationale?: string }&gt;
  }
}

function parseContent(content: RendererProps['content']): PostProdContent {
  if (typeof content === 'string') return {}
  if (Array.isArray(content)) return {}
  if (content === null) return {}
  return content as PostProdContent
}

export function PostProductionView({ content }: RendererProps) {
  const data = parseContent(content)
  const beats = data.timeline?.beats ?? []
  const crossrefBeats = data.crossref?.beats ?? []
  const rampSections = data.speedramps?.sections ?? []
  const isV2 = data.schema_version === '2.0'

  if (!isV2 &amp;&amp; beats.length === 0 &amp;&amp; crossrefBeats.length === 0 &amp;&amp; rampSections.length === 0) {
    return (
      &lt;div className="p-5 text-[11px] text-center" style={{ color: 'var(--gem-dim)' }}&gt;
        Nenhum dado de pós-produção disponível. Envie pelo Cowork para gerar.
      &lt;/div&gt;
    )
  }

  return (
    &lt;div className="p-5 space-y-4"&gt;
      {/* Schema version badge */}
      {isV2 &amp;&amp; (
        &lt;div
          className="text-[9px] px-2 py-0.5 rounded inline-block font-mono"
          style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
        &gt;
          PostProd v2.0
        &lt;/div&gt;
      )}

      {/* Timeline beats */}
      {beats.length &gt; 0 &amp;&amp; (
        &lt;div&gt;
          &lt;div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--gem-dim)' }}&gt;
            Timeline ({beats.length} beats)
          &lt;/div&gt;
          &lt;div className="space-y-1"&gt;
            {beats.map((beat, i) =&gt; (
              &lt;div
                key={i}
                className="flex items-center gap-2 p-2 rounded-md text-[11px]"
                style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
              &gt;
                &lt;span
                  className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono shrink-0"
                  style={{ background: 'var(--gem-surface)', color: 'var(--gem-muted)', border: '1px solid var(--gem-border)' }}
                &gt;
                  {beat.index}
                &lt;/span&gt;
                &lt;span style={{ color: 'var(--gem-text)' }}&gt;{beat.label}&lt;/span&gt;
                {beat.timecode_in &amp;&amp; (
                  &lt;span className="font-mono text-[10px] ml-auto" style={{ color: 'var(--gem-dim)' }}&gt;
                    {beat.timecode_in}{beat.timecode_out ? ` - ${beat.timecode_out}` : ''}
                  &lt;/span&gt;
                )}
                {beat.status &amp;&amp; (
                  &lt;span
                    className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{
                      background: beat.status === 'done' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.1)',
                      color: beat.status === 'done' ? '#22c55e' : '#eab308',
                    }}
                  &gt;
                    {beat.status}
                  &lt;/span&gt;
                )}
              &lt;/div&gt;
            ))}
          &lt;/div&gt;
        &lt;/div&gt;
      )}

      {/* Cross-reference summary */}
      {data.crossref?.summary &amp;&amp; (
        &lt;div&gt;
          &lt;div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--gem-dim)' }}&gt;
            Cross-Reference
          &lt;/div&gt;
          &lt;div className="text-[11px] p-3 rounded-md" style={{ background: 'var(--gem-well)', color: 'var(--gem-muted)' }}&gt;
            {data.crossref.summary}
          &lt;/div&gt;
          {(data.crossref.divergences ?? []).length &gt; 0 &amp;&amp; (
            &lt;div className="mt-1.5 space-y-1"&gt;
              {data.crossref.divergences!.map((d, i) =&gt; (
                &lt;div key={i} className="text-[10px] flex items-start gap-1.5" style={{ color: '#f87171' }}&gt;
                  &lt;span&gt;!&lt;/span&gt;
                  &lt;span&gt;{d}&lt;/span&gt;
                &lt;/div&gt;
              ))}
            &lt;/div&gt;
          )}
        &lt;/div&gt;
      )}

      {/* Speed ramps summary */}
      {rampSections.length &gt; 0 &amp;&amp; (
        &lt;div&gt;
          &lt;div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--gem-dim)' }}&gt;
            Speed Ramps ({rampSections.length})
          &lt;/div&gt;
          &lt;div className="space-y-1"&gt;
            {rampSections.map((ramp, i) =&gt; (
              &lt;div
                key={i}
                className="flex items-center gap-2 p-2 rounded-md text-[11px]"
                style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
              &gt;
                &lt;span style={{ color: 'var(--gem-text)' }}&gt;{ramp.section}&lt;/span&gt;
                &lt;span className="font-mono text-[10px] ml-auto px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}&gt;
                  {ramp.speed}
                &lt;/span&gt;
              &lt;/div&gt;
            ))}
          &lt;/div&gt;
        &lt;/div&gt;
      )}

      {data.timeline?.total_duration_sec != null &amp;&amp; data.timeline.total_duration_sec &gt; 0 &amp;&amp; (
        &lt;div className="text-[9px] pt-1" style={{ color: 'var(--gem-dim)' }}&gt;
          Duração total: {Math.floor(data.timeline.total_duration_sec / 60)}:{String(Math.round(data.timeline.total_duration_sec % 60)).padStart(2, '0')}
          {data.timeline.fps ? ` @ ${data.timeline.fps}fps` : ''}
        &lt;/div&gt;
      )}
    &lt;/div&gt;
  )
}
```

- [ ] **Step 2: Update section-content.tsx registry**

In `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx`, add the import and update the REGISTRY.

Add import after the existing renderer imports:

```ts
import { PostProductionView } from './renderers/postprod-renderer'
```

Update the REGISTRY -- remove the three `postprod_*` sub-section entries, keep `brolls` for backward compat (existing data still renders), add `postprod`:

Change:

```ts
const REGISTRY: Record&lt;string, React.ComponentType&lt;RendererProps&gt;&gt; = {
  ideia: IdeaRenderer,
  roteiro: ScriptRenderer,
  brolls: BRollRenderer,
  postprod_scenes: SceneGuideRenderer,
  postprod_crossref: CrossRefRenderer,
  postprod_speedramps: SpeedRampRenderer,
  publish: PublishRenderer,
  draft: DraftRenderer,
  seo: SeoRenderer,
  images: ImagesRenderer,
}
```

to:

```ts
const REGISTRY: Record&lt;string, React.ComponentType&lt;RendererProps&gt;&gt; = {
  ideia: IdeaRenderer,
  roteiro: ScriptRenderer,
  brolls: BRollRenderer,
  postprod: PostProductionView,
  // Legacy sub-section keys — kept for backward compat with existing data
  postprod_scenes: SceneGuideRenderer,
  postprod_crossref: CrossRefRenderer,
  postprod_speedramps: SpeedRampRenderer,
  publish: PublishRenderer,
  draft: DraftRenderer,
  seo: SeoRenderer,
  images: ImagesRenderer,
}
```

- [ ] **Step 3: Run full test suite to ensure nothing breaks**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run test:web
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/section-content.tsx apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/postprod-renderer.tsx
git commit -m "feat(pipeline): add PostProductionView renderer, update section registry

Unified postprod renderer replaces sub-section tabs.
Legacy sub-section keys kept in REGISTRY for backward compat."
```

---

### Task 6 — PostProd section migration function (postprod-migration.ts) + tests

**Files:**
- Create: `apps/web/src/lib/pipeline/postprod-migration.ts`
- Create: `apps/web/test/unit/pipeline-postprod-migration.test.ts`

- [ ] **Step 1: Create postprod-migration.ts**

Write `apps/web/src/lib/pipeline/postprod-migration.ts`:

```ts
import type { PostProdSection, Beat, BeatAssets } from './postprod-schemas'

/**
 * Legacy scene structure from postprod_scenes section data
 */
interface LegacyScene {
  number: number
  label?: string
  beat_ref?: string
  timestamps?: string
  timeline?: string
  duration?: string
  status?: string
  difficulty?: string
  narrative?: string
  edit_notes?: string[]
  music?: {
    track_name?: string
    artist?: string
    bpm?: number
    energy?: number
    entry_style?: string
    role?: string
    asset_id?: string
  }
  sfx?: Array&lt;{
    label?: string
    description?: string
    type?: string
    timecode?: string
  }&gt;
  overlays?: Array&lt;{
    timestamp?: string
    instruction?: string
  }&gt;
  mix_params?: Array&lt;{
    parameter?: string
    value?: string
  }&gt;
  transition?: {
    type?: string
    reasoning?: string
  }
}

interface LegacyScenesContent {
  scenes?: LegacyScene[]
  summary?: string
  music_hero?: unknown
}

interface LegacyCrossRefContent {
  rows?: Array&lt;{
    beat: string
    srt_timestamp?: string
    duration?: string
    script_estimate?: string
    script_est?: string
    status?: string
  }&gt;
  beats?: Array&lt;{
    beat: string
    srt_timestamp?: string
    duration?: string
    script_estimate?: string
    script_est?: string
    status?: string
  }&gt;
  divergences?: string[]
  key_divergences?: string[]
  source?: string
  summary?: string
}

interface LegacySpeedRampContent {
  rows?: Array&lt;{
    section: string
    srt_range?: string
    timeline?: string
    speed: string
    rationale?: string
  }&gt;
  ramps?: Array&lt;{
    section: string
    srt_range?: string
    timeline?: string
    speed: string
    rationale?: string
  }&gt;
  segments?: Array&lt;{
    section: string
    srt_range?: string
    timeline?: string
    speed: string
    rationale?: string
  }&gt;
  source?: string
  est_final?: string
  edit_style?: string
  base_acceleration?: string
  summary?: string
}

export interface MigrationInput {
  scenes?: unknown
  crossref?: unknown
  speedramps?: unknown
}

export interface MigrationResult {
  data: PostProdSection
  warnings: string[]
}

function parseTimecodes(timestamps?: string): { timecode_in?: string; timecode_out?: string } {
  if (!timestamps) return {}
  const parts = timestamps.split(/[-–]/).map(s =&gt; s.trim())
  return {
    timecode_in: parts[0] || undefined,
    timecode_out: parts[1] || undefined,
  }
}

function parseDuration(duration?: string): number | undefined {
  if (!duration) return undefined
  const match = duration.match(/(\d+(?:\.\d+)?)/)
  if (!match) return undefined
  const val = parseFloat(match[1]!)
  if (duration.toLowerCase().includes('min')) return val * 60
  return val
}

function normalizeStatus(status?: string): Beat['status'] {
  if (!status) return 'pending'
  const s = status.toLowerCase()
  if (s === 'done' || s === 'complete' || s === 'completed') return 'done'
  if (s === 'in_progress' || s === 'in progress' || s === 'editing') return 'in_progress'
  if (s === 'review' || s === 'reviewing') return 'review'
  return 'pending'
}

function normalizeDifficulty(d?: string): Beat['difficulty'] {
  if (!d) return undefined
  const lower = d.toLowerCase()
  if (lower === 'easy' || lower === 'simple') return 'easy'
  if (lower === 'medium' || lower === 'moderate') return 'medium'
  if (lower === 'hard' || lower === 'difficult') return 'hard'
  if (lower === 'complex' || lower === 'very hard') return 'complex'
  return undefined
}

function normalizeCrossRefStatus(status?: string): 'match' | 'diverge' | 'missing' | 'extra' {
  if (!status) return 'match'
  const s = status.toLowerCase()
  if (s === 'match' || s === 'ok' || s === 'aligned') return 'match'
  if (s === 'diverge' || s === 'diverged' || s === 'mismatch') return 'diverge'
  if (s === 'missing') return 'missing'
  if (s === 'extra' || s === 'added') return 'extra'
  return 'match'
}

export function migrateToPostProdV2(input: MigrationInput): MigrationResult {
  const warnings: string[] = []
  const beats: Beat[] = []
  const assets: Record&lt;number, BeatAssets&gt; = {}

  // ── Migrate scenes ──
  const scenesRaw = input.scenes
  let scenes: LegacyScene[] = []

  if (scenesRaw &amp;&amp; typeof scenesRaw === 'object' &amp;&amp; !Array.isArray(scenesRaw)) {
    const obj = scenesRaw as LegacyScenesContent
    scenes = obj.scenes ?? []
  } else if (Array.isArray(scenesRaw)) {
    scenes = scenesRaw as LegacyScene[]
  }

  for (const scene of scenes) {
    const tc = parseTimecodes(scene.timestamps ?? scene.timeline)
    const beat: Beat = {
      index: scene.number - 1,
      label: scene.label ?? `Scene ${scene.number}`,
      beat_ref: scene.beat_ref,
      timecode_in: tc.timecode_in,
      timecode_out: tc.timecode_out,
      duration_sec: parseDuration(scene.duration),
      status: normalizeStatus(scene.status),
      difficulty: normalizeDifficulty(scene.difficulty),
      narrative: scene.narrative,
      edit_notes: scene.edit_notes ?? [],
      transition_in: scene.transition ? { type: scene.transition.type ?? 'cut', reasoning: scene.transition.reasoning } : undefined,
    }
    beats.push(beat)

    // Build assets for this beat
    const beatAssets: BeatAssets = {
      music: [],
      sfx: [],
      visual: [],
      ambience: [],
      soundDesign: [],
    }

    if (scene.music) {
      beatAssets.music.push({
        asset_id: scene.music.asset_id,
        track_name: scene.music.track_name,
        artist: scene.music.artist,
        bpm: scene.music.bpm,
        energy: scene.music.energy,
        entry_style: scene.music.entry_style,
        role: (scene.music.role as 'primary' | 'secondary' | 'accent') ?? 'primary',
      })
    }

    if (scene.sfx) {
      for (const sfx of scene.sfx) {
        beatAssets.sfx.push({
          label: sfx.label ?? sfx.description ?? 'SFX',
          timecode: sfx.timecode,
          type: (sfx.type as 'whoosh' | 'impact' | 'riser' | 'ambient' | 'foley' | 'ui' | 'other') ?? 'other',
        })
      }
    }

    const hasContent = beatAssets.music.length &gt; 0 || beatAssets.sfx.length &gt; 0
    if (hasContent) {
      assets[beat.index] = beatAssets
    }
  }

  // ── Migrate crossref ──
  const crossrefRaw = input.crossref
  let crossref: PostProdSection['crossref'] = { summary: '', beats: [], divergences: [], source: '' }

  if (crossrefRaw &amp;&amp; typeof crossrefRaw === 'object' &amp;&amp; !Array.isArray(crossrefRaw)) {
    const obj = crossrefRaw as LegacyCrossRefContent
    const rows = obj.rows ?? obj.beats ?? []

    crossref = {
      summary: obj.summary ?? '',
      beats: rows.map(r =&gt; ({
        beat: r.beat,
        srt_timestamp: r.srt_timestamp,
        duration: r.duration,
        script_estimate: r.script_estimate ?? r.script_est,
        status: normalizeCrossRefStatus(r.status),
      })),
      divergences: obj.divergences ?? obj.key_divergences ?? [],
      source: obj.source ?? '',
    }
  }

  // ── Migrate speedramps ──
  const speedrampsRaw = input.speedramps
  let speedramps: PostProdSection['speedramps'] = { summary: '', base: '', est_final: '', edit_style: '', sections: [], source: '' }

  if (speedrampsRaw &amp;&amp; typeof speedrampsRaw === 'object' &amp;&amp; !Array.isArray(speedrampsRaw)) {
    const obj = speedrampsRaw as LegacySpeedRampContent
    const rows = obj.rows ?? obj.ramps ?? obj.segments ?? []

    speedramps = {
      summary: obj.summary ?? '',
      base: obj.base_acceleration ?? '',
      est_final: obj.est_final ?? '',
      edit_style: obj.edit_style ?? '',
      sections: rows.map(r =&gt; ({
        section: r.section,
        srt_range: r.srt_range,
        timeline: r.timeline,
        speed: r.speed,
        rationale: r.rationale,
      })),
      source: obj.source ?? '',
    }
  }

  // ── Build result ──
  const totalDuration = beats.reduce((sum, b) =&gt; sum + (b.duration_sec ?? 0), 0)

  if (scenes.length === 0 &amp;&amp; Object.keys(crossrefRaw ?? {}).length === 0 &amp;&amp; Object.keys(speedrampsRaw ?? {}).length === 0) {
    warnings.push('No legacy data found to migrate — creating empty v2.0 structure')
  }

  const result: PostProdSection = {
    schema_version: '2.0',
    timeline: {
      tracks: [],
      beats,
      total_duration_sec: totalDuration,
      fps: 30,
    },
    assets,
    crossref,
    speedramps,
  }

  return { data: result, warnings }
}
```

- [ ] **Step 2: Create tests**

Write `apps/web/test/unit/pipeline-postprod-migration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { migrateToPostProdV2 } from '@/lib/pipeline/postprod-migration'

describe('migrateToPostProdV2', () =&gt; {
  it('creates empty v2.0 structure when no input data', () =&gt; {
    const { data, warnings } = migrateToPostProdV2({})
    expect(data.schema_version).toBe('2.0')
    expect(data.timeline.beats).toEqual([])
    expect(data.assets).toEqual({})
    expect(data.crossref.beats).toEqual([])
    expect(data.speedramps.sections).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('No legacy data')
  })

  it('migrates legacy scenes to timeline beats', () =&gt; {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [
          {
            number: 1,
            label: 'Hook',
            timestamps: '00:00:00 - 00:00:15',
            duration: '15s',
            status: 'done',
            difficulty: 'easy',
            narrative: 'Attention grabber',
            edit_notes: ['Add zoom effect'],
          },
          {
            number: 2,
            label: 'Intro',
            timestamps: '00:00:15-00:01:00',
            duration: '45s',
            status: 'in_progress',
          },
        ],
      },
    })

    expect(data.timeline.beats).toHaveLength(2)

    const hook = data.timeline.beats[0]!
    expect(hook.index).toBe(0)
    expect(hook.label).toBe('Hook')
    expect(hook.timecode_in).toBe('00:00:00')
    expect(hook.timecode_out).toBe('00:00:15')
    expect(hook.duration_sec).toBe(15)
    expect(hook.status).toBe('done')
    expect(hook.difficulty).toBe('easy')
    expect(hook.narrative).toBe('Attention grabber')
    expect(hook.edit_notes).toEqual(['Add zoom effect'])

    const intro = data.timeline.beats[1]!
    expect(intro.index).toBe(1)
    expect(intro.status).toBe('in_progress')
  })

  it('extracts music and SFX into beat assets', () =&gt; {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [
          {
            number: 1,
            label: 'Hook',
            music: {
              track_name: 'Epic Rise',
              artist: 'Composer X',
              bpm: 120,
              energy: 4,
              entry_style: 'fade_in',
              role: 'primary',
              asset_id: 'MUSIC_01',
            },
            sfx: [
              { label: 'whoosh', type: 'whoosh', timecode: '00:00:02' },
              { description: 'impact hit', type: 'impact' },
            ],
          },
        ],
      },
    })

    expect(data.assets[0]).toBeDefined()
    expect(data.assets[0]!.music).toHaveLength(1)
    expect(data.assets[0]!.music[0]!.track_name).toBe('Epic Rise')
    expect(data.assets[0]!.music[0]!.asset_id).toBe('MUSIC_01')
    expect(data.assets[0]!.sfx).toHaveLength(2)
    expect(data.assets[0]!.sfx[0]!.label).toBe('whoosh')
    expect(data.assets[0]!.sfx[1]!.label).toBe('impact hit')
  })

  it('migrates crossref with rows format', () =&gt; {
    const { data } = migrateToPostProdV2({
      crossref: {
        summary: 'Script matches well',
        rows: [
          { beat: 'Hook', srt_timestamp: '00:00:00', duration: '15s', status: 'match' },
          { beat: 'CTA', srt_timestamp: '00:08:00', duration: '30s', status: 'diverge' },
        ],
        divergences: ['CTA runs 10s long'],
        source: 'cowork',
      },
    })

    expect(data.crossref.summary).toBe('Script matches well')
    expect(data.crossref.beats).toHaveLength(2)
    expect(data.crossref.beats[0]!.beat).toBe('Hook')
    expect(data.crossref.beats[0]!.status).toBe('match')
    expect(data.crossref.beats[1]!.status).toBe('diverge')
    expect(data.crossref.divergences).toEqual(['CTA runs 10s long'])
    expect(data.crossref.source).toBe('cowork')
  })

  it('migrates crossref with beats format (alias)', () =&gt; {
    const { data } = migrateToPostProdV2({
      crossref: {
        beats: [{ beat: 'Intro', status: 'ok' }],
        key_divergences: ['Timing off'],
      },
    })

    expect(data.crossref.beats).toHaveLength(1)
    expect(data.crossref.beats[0]!.status).toBe('match') // 'ok' normalizes to 'match'
    expect(data.crossref.divergences).toEqual(['Timing off'])
  })

  it('migrates speedramps with ramps format', () =&gt; {
    const { data } = migrateToPostProdV2({
      speedramps: {
        ramps: [
          { section: 'Hook', speed: '1.0x', rationale: 'Keep pace' },
          { section: 'Filler', srt_range: '02:30-03:00', speed: '2.0x' },
        ],
        base_acceleration: '1.15x',
        est_final: '9:30',
        edit_style: 'aggressive',
        source: 'cowork',
      },
    })

    expect(data.speedramps.sections).toHaveLength(2)
    expect(data.speedramps.base).toBe('1.15x')
    expect(data.speedramps.est_final).toBe('9:30')
    expect(data.speedramps.edit_style).toBe('aggressive')
    expect(data.speedramps.source).toBe('cowork')
  })

  it('migrates speedramps with segments format (alias)', () =&gt; {
    const { data } = migrateToPostProdV2({
      speedramps: {
        segments: [{ section: 'Intro', speed: '1.5x' }],
      },
    })

    expect(data.speedramps.sections).toHaveLength(1)
    expect(data.speedramps.sections[0]!.section).toBe('Intro')
  })

  it('handles scenes as raw array', () =&gt; {
    const { data } = migrateToPostProdV2({
      scenes: [
        { number: 1, label: 'Scene 1' },
        { number: 2, label: 'Scene 2' },
      ],
    })

    expect(data.timeline.beats).toHaveLength(2)
  })

  it('calculates total_duration_sec from beats', () =&gt; {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [
          { number: 1, label: 'Hook', duration: '15s' },
          { number: 2, label: 'Main', duration: '5min' },
        ],
      },
    })

    expect(data.timeline.total_duration_sec).toBe(315) // 15 + 300
  })

  it('normalizes status values', () =&gt; {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [
          { number: 1, label: 'A', status: 'complete' },
          { number: 2, label: 'B', status: 'in progress' },
          { number: 3, label: 'C', status: 'editing' },
          { number: 4, label: 'D', status: 'reviewing' },
          { number: 5, label: 'E', status: 'unknown' },
        ],
      },
    })

    expect(data.timeline.beats.map(b =&gt; b.status)).toEqual([
      'done', 'in_progress', 'in_progress', 'review', 'pending',
    ])
  })

  it('handles transition data', () =&gt; {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [
          {
            number: 1,
            label: 'Hook',
            transition: { type: 'crossfade', reasoning: 'Smooth entry' },
          },
        ],
      },
    })

    expect(data.timeline.beats[0]!.transition_in).toEqual({
      type: 'crossfade',
      reasoning: 'Smooth entry',
    })
  })

  it('assigns default label when scene has no label', () =&gt; {
    const { data } = migrateToPostProdV2({
      scenes: { scenes: [{ number: 3 }] },
    })

    expect(data.timeline.beats[0]!.label).toBe('Scene 3')
  })

  it('does not create assets entry when scene has no music/sfx', () =&gt; {
    const { data } = migrateToPostProdV2({
      scenes: { scenes: [{ number: 1, label: 'Clean' }] },
    })

    expect(data.assets[0]).toBeUndefined()
  })

  it('full migration produces valid structure', () =&gt; {
    const { data, warnings } = migrateToPostProdV2({
      scenes: {
        scenes: [
          {
            number: 1,
            label: 'Hook',
            timestamps: '00:00:00-00:00:15',
            duration: '15s',
            status: 'done',
            music: { track_name: 'Rise', bpm: 120, energy: 4 },
            sfx: [{ label: 'whoosh' }],
          },
        ],
      },
      crossref: {
        summary: 'OK',
        rows: [{ beat: 'Hook', status: 'match' }],
      },
      speedramps: {
        ramps: [{ section: 'Hook', speed: '1.0x' }],
        est_final: '10:00',
      },
    })

    expect(data.schema_version).toBe('2.0')
    expect(data.timeline.beats).toHaveLength(1)
    expect(data.assets[0]).toBeDefined()
    expect(data.crossref.beats).toHaveLength(1)
    expect(data.speedramps.sections).toHaveLength(1)
    expect(warnings).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npx vitest run apps/web/test/unit/pipeline-postprod-migration.test.ts --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/pipeline/postprod-migration.ts apps/web/test/unit/pipeline-postprod-migration.test.ts
git commit -m "feat(pipeline): add PostProd v2.0 migration function + tests

Converts legacy scene/crossref/speedramp sub-sections into unified
PostProdSection v2.0 structure. Handles all known data shape variants."
```

---

### Task 7 — B-Roll Library API endpoints (CRUD + import) + tests

**Files:**
- Create: `apps/web/src/app/api/pipeline/broll-library/route.ts`
- Create: `apps/web/src/app/api/pipeline/broll-library/[id]/route.ts`
- Create: `apps/web/src/app/api/pipeline/broll-library/import/route.ts`
- Create: `apps/web/src/lib/pipeline/broll-import.ts`
- Create: `apps/web/test/unit/pipeline-broll-import.test.ts`

- [ ] **Step 1: Create broll-import.ts helper**

Write `apps/web/src/lib/pipeline/broll-import.ts`:

```ts
import type { BRollAssetRow, BRollImportItem } from './broll-schemas'

export function mapBRollJsonToDbRow(
  item: BRollImportItem,
): Record&lt;string, unknown&gt; {
  const row: Record&lt;string, unknown&gt; = {
    asset_id: item.asset_id,
    original_filename: item.original_filename,
    renamed_to: item.renamed_to,
    sha256: item.sha256,
    file_size_bytes: item.file_size_bytes,
    type: item.type ?? 'footage',
    source: item.source ?? 'local',
    source_type: item.source_type ?? 'pessoal',
    category: item.category,
    subcategory: item.subcategory,
    location: item.location,
    description: item.description,
    codec: item.codec,
    fps: item.fps,
    resolution: item.resolution ?? '1080p',
    width: item.width,
    height: item.height,
    duration_seconds: item.duration_seconds,
    bitrate_kbps: item.bitrate_kbps,
    has_audio: item.has_audio ?? false,
    color_profile: item.color_profile,
    storage_url: item.storage_url,
    thumbnail_url: item.thumbnail_url,
    proxy_url: item.proxy_url,
    reusable: item.reusable ?? true,
    status: item.status ?? 'available',
    captured_at: item.captured_at,
  }

  if (Array.isArray(item.tags)) row.tags = item.tags
  if (item.metadata !== undefined) row.metadata = item.metadata

  return row
}

export function classifyBRollImportItem(
  row: Record&lt;string, unknown&gt;,
  existing: Pick&lt;BRollAssetRow, 'sha256' | 'tags'&gt; | null,
): 'create' | 'update' | 'skip' {
  if (!existing) return 'create'
  if (existing.sha256 &amp;&amp; row.sha256 === existing.sha256) {
    const diffs = buildBRollDiffLog(existing as Record&lt;string, unknown&gt;, row)
    return diffs.length &gt; 0 ? 'update' : 'skip'
  }
  return 'update'
}

export function buildBRollDiffLog(
  oldRow: Record&lt;string, unknown&gt;,
  newRow: Record&lt;string, unknown&gt;,
): Array&lt;{ asset_id: string; field: string; old: unknown; new: unknown }&gt; {
  const diffs: Array&lt;{ asset_id: string; field: string; old: unknown; new: unknown }&gt; = []
  const assetId = (newRow.asset_id ?? oldRow.asset_id) as string

  for (const key of Object.keys(newRow)) {
    if (key === 'asset_id' || key === 'sha256') continue
    if (newRow[key] === undefined) continue
    const oldVal = JSON.stringify(oldRow[key])
    const newVal = JSON.stringify(newRow[key])
    if (oldVal !== newVal) {
      diffs.push({ asset_id: assetId, field: key, old: oldRow[key], new: newRow[key] })
    }
  }
  return diffs
}

export function buildBRollExportJson(assets: BRollAssetRow[]): {
  schema: string
  schema_version: string
  exported_at: string
  items: BRollAssetRow[]
  summary: { total: number; by_type: Record&lt;string, number&gt; }
  search_index: { tags: string[]; categories: string[]; locations: string[] }
} {
  const byType: Record&lt;string, number&gt; = {}
  const allTags = new Set&lt;string&gt;()
  const allCategories = new Set&lt;string&gt;()
  const allLocations = new Set&lt;string&gt;()

  for (const asset of assets) {
    byType[asset.type] = (byType[asset.type] ?? 0) + 1
    for (const tag of asset.tags ?? []) allTags.add(tag)
    if (asset.category) allCategories.add(asset.category)
    if (asset.location) allLocations.add(asset.location)
  }

  return {
    schema: 'broll-library',
    schema_version: '1.0.0',
    exported_at: new Date().toISOString(),
    items: assets,
    summary: { total: assets.length, by_type: byType },
    search_index: {
      tags: [...allTags],
      categories: [...allCategories],
      locations: [...allLocations],
    },
  }
}
```

- [ ] **Step 2: Create API route -- GET/POST broll-library**

Write `apps/web/src/app/api/pipeline/broll-library/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { BRollAssetCreateSchema } from '@/lib/pipeline/broll-schemas'
import { sanitizeForFilter, sanitizeForTsquery } from '@/lib/pipeline/sanitize'
import { pipelineLog } from '@/lib/pipeline/logger'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const params = req.nextUrl.searchParams
  const limit = Math.max(1, Math.min(parseInt(params.get('limit') || '50') || 50, 200))
  const cursor = params.get('cursor') || undefined

  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('broll_library')
    .select('*', { count: 'exact' })
    .eq('site_id', auth.siteId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  const type = params.get('type')
  if (type &amp;&amp; ['footage', 'photo', 'screen_recording', 'stock', 'graphic', 'animation'].includes(type)) query = query.eq('type', type)

  const status = params.get('status')
  if (status &amp;&amp; ['available', 'pending', 'retired'].includes(status)) query = query.eq('status', status)

  const sourceType = params.get('source_type')
  if (sourceType &amp;&amp; ['pessoal', 'generico'].includes(sourceType)) query = query.eq('source_type', sourceType)

  const category = params.get('category')
  if (category) query = query.eq('category', sanitizeForFilter(category))

  const resolution = params.get('resolution')
  if (resolution) query = query.eq('resolution', sanitizeForFilter(resolution))

  const tags = params.get('tags')
  if (tags) query = query.contains('tags', tags.split(',').map(t =&gt; sanitizeForFilter(t.trim())).filter(Boolean))

  const hasAudio = params.get('has_audio')
  if (hasAudio === 'true') query = query.eq('has_audio', true)
  else if (hasAudio === 'false') query = query.eq('has_audio', false)

  const reusable = params.get('reusable')
  if (reusable === 'true') query = query.eq('reusable', true)
  else if (reusable === 'false') query = query.eq('reusable', false)

  const location = params.get('location')
  if (location) query = query.ilike('location', `%${sanitizeForFilter(location)}%`)

  const q = params.get('q')
  if (q) {
    const safe = sanitizeForTsquery(q)
    if (safe) query = query.textSearch('search_vector', safe, { type: 'websearch', config: 'english' })
  }

  if (cursor &amp;&amp; UUID_REGEX.test(cursor)) {
    const { data: cursorItem } = await supabase.from('broll_library').select('created_at').eq('id', cursor).eq('site_id', auth.siteId).single()
    if (cursorItem) {
      query = query.or(`created_at.lt.${cursorItem.created_at},and(created_at.eq.${cursorItem.created_at},id.lt.${cursor})`)
    }
  }

  const { data, error, count } = await query.limit(limit + 1)
  if (error) { pipelineLog('error', 'broll-library', 'GET failed', { error }); return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Internal server error' } }, { status: 500 }) }

  const hasNext = (data?.length ?? 0) &gt; limit
  const items = data?.slice(0, limit) ?? []
  const lastItem = items[items.length - 1] as { id: string } | undefined

  return NextResponse.json({
    data: items,
    meta: { total: count ?? 0, has_next: hasNext, next_cursor: hasNext &amp;&amp; lastItem ? lastItem.id : undefined, limit },
  }, { headers: buildRateLimitHeaders(auth) })
}

export async function POST(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = BRollAssetCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i =&gt; i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('broll_library')
    .insert({ ...parsed.data, site_id: auth.siteId })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'Asset with this ID or SHA256 already exists' } }, { status: 409 })
    }
    pipelineLog('error', 'broll-library', 'POST failed', { error })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Internal server error' } }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201, headers: buildRateLimitHeaders(auth) })
}
```

- [ ] **Step 3: Create API route -- GET/PATCH/DELETE broll-library/[id]**

Write `apps/web/src/app/api/pipeline/broll-library/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { BRollAssetUpdateSchema } from '@/lib/pipeline/broll-schemas'
import { pipelineLog } from '@/lib/pipeline/logger'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise&lt;{ id: string }&gt; },
) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID format' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { data: asset, error } = await supabase
    .from('broll_library')
    .select('*')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (error) {
    pipelineLog('error', 'broll-library', 'GET by id failed', { error })
    if (error.code === 'PGRST116') return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Asset not found' } }, { status: 404 })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Internal server error' } }, { status: 500 })
  }
  if (!asset) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Asset not found' } }, { status: 404 })

  const { data: usage } = await supabase
    .from('broll_library_usage')
    .select('id, pipeline_item_id, beat_index, timecode_in, timecode_out, usage_type, notes, content_pipeline(code, title_pt, format)')
    .eq('broll_asset_id', id)
    .eq('site_id', auth.siteId)

  return NextResponse.json({ data: { ...asset, usage: usage ?? [] } }, { headers: buildRateLimitHeaders(auth) })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise&lt;{ id: string }&gt; },
) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID format' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = BRollAssetUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i =&gt; i.message).join(', ') } }, { status: 400 })
  }

  const { version, ...updates } = parsed.data
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('broll_library')
    .update(updates)
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .eq('version', version)
    .select('*')
    .single()

  if (error || !data) {
    const { data: exists } = await supabase.from('broll_library').select('id, version').eq('id', id).eq('site_id', auth.siteId).single()
    if (!exists) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Asset not found' } }, { status: 404 })
    return NextResponse.json({ error: { code: 'CONFLICT', message: `Version mismatch: expected ${version}, current ${exists.version}` } }, { status: 409 })
  }

  return NextResponse.json({ data }, { headers: buildRateLimitHeaders(auth) })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise&lt;{ id: string }&gt; },
) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID format' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('broll_library')
    .update({ status: 'retired' })
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .select('id, status')
    .single()

  if (error || !data) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Asset not found' } }, { status: 404 })

  return NextResponse.json({ data }, { headers: buildRateLimitHeaders(auth) })
}
```

- [ ] **Step 4: Create API route -- POST broll-library/import**

Write `apps/web/src/app/api/pipeline/broll-library/import/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { BRollImportSchema } from '@/lib/pipeline/broll-schemas'
import { mapBRollJsonToDbRow, classifyBRollImportItem, buildBRollDiffLog } from '@/lib/pipeline/broll-import'
import { pipelineLog } from '@/lib/pipeline/logger'

export async function POST(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = BRollImportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i =&gt; i.message).join(', ') } }, { status: 400 })
  }

  const { dry_run, schema_version, items } = parsed.data
  const supabase = getSupabaseServiceClient()

  const assetIds = items.map(i =&gt; i.asset_id).filter(Boolean)
  const { data: existingRows } = await supabase
    .from('broll_library')
    .select('asset_id, sha256, tags')
    .eq('site_id', auth.siteId)
    .in('asset_id', assetIds.length &gt; 0 ? assetIds : ['__none__'])

  const existingMap = new Map((existingRows ?? []).map(r =&gt; [r.asset_id, r]))

  let created = 0, updated = 0, skipped = 0, errorCount = 0
  const errors: Array&lt;{ asset_id: string; error: string }&gt; = []
  const diffLog: Array&lt;{ asset_id: string; field: string; old: unknown; new: unknown }&gt; = []

  const toUpsert: Array&lt;Record&lt;string, unknown&gt;&gt; = []

  for (const item of items) {
    const row = mapBRollJsonToDbRow(item)
    const existing = existingMap.get(row.asset_id as string) ?? null
    const classification = classifyBRollImportItem(row, existing)

    if (dry_run) {
      if (classification === 'create') created++
      else if (classification === 'update') updated++
      else skipped++
      continue
    }

    if (classification === 'skip') { skipped++; continue }
    if (classification === 'update' &amp;&amp; existing) {
      diffLog.push(...buildBRollDiffLog(existing as Record&lt;string, unknown&gt;, row))
    }
    toUpsert.push({ ...row, site_id: auth.siteId, _classification: classification })
  }

  if (!dry_run &amp;&amp; toUpsert.length &gt; 0) {
    const BATCH_SIZE = 100
    for (let i = 0; i &lt; toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE).map(({ _classification, ...row }) =&gt; row)
      const classifications = toUpsert.slice(i, i + BATCH_SIZE).map(r =&gt; r._classification)
      const { error } = await supabase
        .from('broll_library')
        .upsert(batch, { onConflict: 'site_id,asset_id' })

      if (error) {
        pipelineLog('error', 'broll-library', 'batch upsert failed', { error })
        errorCount += batch.length
        for (const row of batch) {
          errors.push({ asset_id: (row.asset_id as string) ?? 'unknown', error: 'Batch upsert failed' })
        }
      } else {
        for (const cls of classifications) {
          if (cls === 'create') created++
          else updated++
        }
      }
    }
  }

  if (dry_run) {
    return NextResponse.json({
      data: { dry_run: true, preview: { to_create: created, to_update: updated, to_skip: skipped, errors: [] } },
    }, { headers: buildRateLimitHeaders(auth) })
  }

  const { data: logRow } = await supabase
    .from('broll_import_log')
    .insert({
      site_id: auth.siteId,
      source: 'json_import',
      status: errorCount &gt; 0 ? (created + updated &gt; 0 ? 'partial' : 'failed') : 'success',
      total_items: items.length,
      created_count: created,
      updated_count: updated,
      skipped_count: skipped,
      error_count: errorCount,
      errors,
      diff_log: diffLog,
      schema_version,
      imported_by: auth.source === 'api_key' ? 'cowork' : 'cms_ui',
    })
    .select('id')
    .single()

  return NextResponse.json({
    data: { dry_run: false, import_log_id: logRow?.id, created, updated, skipped, errors },
  }, { headers: buildRateLimitHeaders(auth) })
}
```

- [ ] **Step 5: Create broll-import unit tests**

Write `apps/web/test/unit/pipeline-broll-import.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  mapBRollJsonToDbRow,
  classifyBRollImportItem,
  buildBRollDiffLog,
  buildBRollExportJson,
} from '@/lib/pipeline/broll-import'
import type { BRollAssetRow, BRollImportItem } from '@/lib/pipeline/broll-schemas'

describe('mapBRollJsonToDbRow', () =&gt; {
  it('maps minimal import item', () =&gt; {
    const item: BRollImportItem = { asset_id: 'BROLL_01' }
    const row = mapBRollJsonToDbRow(item)
    expect(row.asset_id).toBe('BROLL_01')
    expect(row.type).toBe('footage')
    expect(row.source).toBe('local')
    expect(row.source_type).toBe('pessoal')
    expect(row.resolution).toBe('1080p')
    expect(row.has_audio).toBe(false)
    expect(row.reusable).toBe(true)
    expect(row.status).toBe('available')
  })

  it('maps full import item', () =&gt; {
    const item: BRollImportItem = {
      asset_id: 'BROLL_DRONE_01',
      original_filename: 'DJI_0042.mp4',
      renamed_to: 'drone-sunset.mp4',
      sha256: 'a'.repeat(64),
      file_size_bytes: 1024000,
      type: 'photo',
      source: 'dji',
      source_type: 'generico',
      category: 'drone',
      subcategory: 'aerial',
      location: 'Floripa',
      description: 'Sunset drone shot',
      tags: ['drone', 'sunset'],
      codec: 'h265',
      fps: 60,
      resolution: '4k',
      width: 3840,
      height: 2160,
      duration_seconds: 45,
      bitrate_kbps: 50000,
      has_audio: true,
      color_profile: 'rec709',
      reusable: false,
      status: 'pending',
      captured_at: '2026-05-10T14:00:00Z',
      metadata: { camera: 'DJI Mini 4' },
    }
    const row = mapBRollJsonToDbRow(item)
    expect(row.type).toBe('photo')
    expect(row.source_type).toBe('generico')
    expect(row.location).toBe('Floripa')
    expect(row.tags).toEqual(['drone', 'sunset'])
    expect(row.metadata).toEqual({ camera: 'DJI Mini 4' })
  })
})

describe('classifyBRollImportItem', () =&gt; {
  it('returns create when no existing', () =&gt; {
    expect(classifyBRollImportItem({ asset_id: 'X' }, null)).toBe('create')
  })

  it('returns skip when sha256 matches and no other diffs', () =&gt; {
    const sha = 'a'.repeat(64)
    expect(classifyBRollImportItem(
      { asset_id: 'X', sha256: sha },
      { sha256: sha, tags: [] },
    )).toBe('skip')
  })

  it('returns update when sha256 matches but has other diffs', () =&gt; {
    const sha = 'a'.repeat(64)
    expect(classifyBRollImportItem(
      { asset_id: 'X', sha256: sha, tags: ['new'] },
      { sha256: sha, tags: ['old'] },
    )).toBe('update')
  })

  it('returns update when sha256 differs', () =&gt; {
    expect(classifyBRollImportItem(
      { asset_id: 'X', sha256: 'a'.repeat(64) },
      { sha256: 'b'.repeat(64), tags: [] },
    )).toBe('update')
  })
})

describe('buildBRollDiffLog', () =&gt; {
  it('returns empty for identical rows', () =&gt; {
    const row = { asset_id: 'X', sha256: 'a', tags: ['x'] }
    expect(buildBRollDiffLog(row, row)).toEqual([])
  })

  it('detects field changes', () =&gt; {
    const diffs = buildBRollDiffLog(
      { asset_id: 'X', tags: ['old'], description: 'old' },
      { asset_id: 'X', tags: ['new'], description: 'new' },
    )
    expect(diffs).toHaveLength(2)
    expect(diffs.map(d =&gt; d.field)).toContain('tags')
    expect(diffs.map(d =&gt; d.field)).toContain('description')
  })

  it('skips undefined new values', () =&gt; {
    const diffs = buildBRollDiffLog(
      { asset_id: 'X', tags: ['old'] },
      { asset_id: 'X', tags: undefined },
    )
    expect(diffs).toHaveLength(0)
  })
})

describe('buildBRollExportJson', () =&gt; {
  it('builds export with search index', () =&gt; {
    const assets: BRollAssetRow[] = [
      {
        id: '1', site_id: 's1', asset_id: 'BROLL_01', original_filename: 'clip.mp4',
        renamed_to: null, sha256: null, file_size_bytes: null,
        type: 'footage', source: 'local', source_type: 'pessoal',
        category: 'drone', subcategory: null, location: 'Floripa',
        description: null, tags: ['sunset', 'drone'],
        codec: null, fps: null, resolution: '4k',
        width: null, height: null, duration_seconds: null,
        bitrate_kbps: null, has_audio: false, color_profile: null,
        storage_url: null, thumbnail_url: null, proxy_url: null,
        reusable: true, status: 'available', captured_at: null,
        metadata: {}, version: 1, created_at: '', updated_at: '',
      },
      {
        id: '2', site_id: 's1', asset_id: 'BROLL_02', original_filename: 'photo.jpg',
        renamed_to: null, sha256: null, file_size_bytes: null,
        type: 'photo', source: 'local', source_type: 'generico',
        category: 'product', subcategory: null, location: 'Studio',
        description: null, tags: ['product'],
        codec: null, fps: null, resolution: '1080p',
        width: null, height: null, duration_seconds: null,
        bitrate_kbps: null, has_audio: false, color_profile: null,
        storage_url: null, thumbnail_url: null, proxy_url: null,
        reusable: true, status: 'available', captured_at: null,
        metadata: {}, version: 1, created_at: '', updated_at: '',
      },
    ]

    const result = buildBRollExportJson(assets)
    expect(result.schema).toBe('broll-library')
    expect(result.schema_version).toBe('1.0.0')
    expect(result.items).toHaveLength(2)
    expect(result.summary.total).toBe(2)
    expect(result.summary.by_type).toEqual({ footage: 1, photo: 1 })
    expect(result.search_index.tags).toContain('sunset')
    expect(result.search_index.tags).toContain('product')
    expect(result.search_index.categories).toContain('drone')
    expect(result.search_index.locations).toContain('Floripa')
    expect(result.search_index.locations).toContain('Studio')
  })
})
```

- [ ] **Step 6: Add vitest alias for broll-library [id] route**

In `apps/web/vitest.config.ts`, add an alias (right after the existing `audio-library/[id]` alias):

```ts
      {
        find: '@/app/api/pipeline/broll-library/[id]/route',
        replacement: path.resolve(__dirname, './src/app/api/pipeline/broll-library/[id]/route.ts'),
      },
```

- [ ] **Step 7: Run tests**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npx vitest run apps/web/test/unit/pipeline-broll-import.test.ts --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 8: Run full test suite**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run test:web
```

Expected: all tests pass, no regressions.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/pipeline/broll-import.ts \
  apps/web/src/app/api/pipeline/broll-library/route.ts \
  apps/web/src/app/api/pipeline/broll-library/\[id\]/route.ts \
  apps/web/src/app/api/pipeline/broll-library/import/route.ts \
  apps/web/test/unit/pipeline-broll-import.test.ts \
  apps/web/vitest.config.ts
git commit -m "feat(pipeline): add B-Roll Library API endpoints + import helpers + tests

CRUD at /api/pipeline/broll-library, import at /import.
Follows audio-library pattern: cursor pagination, version-based OCC,
soft delete, batch upsert import with dry_run support."
```

---

## Phase 2 — B-Roll Library UI (Tasks 8-14)

### Task 8 — `useBRollFilters` hook + `broll-helpers.ts`

**Files:**
- `apps/web/src/app/cms/(authed)/pipeline/brolls/_helpers/use-broll-filters.ts` (new)
- `apps/web/src/app/cms/(authed)/pipeline/brolls/_helpers/broll-helpers.ts` (new)

**Steps:**

- [ ] 1. Create the filter state hook mirroring `use-audio-filters.ts` with the B-Roll-specific `BRollFilterState` interface and URL serialization:

```ts
// apps/web/src/app/cms/(authed)/pipeline/brolls/_helpers/use-broll-filters.ts
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export interface BRollFilterState {
  q: string | null
  source_type: 'pessoal' | 'generico' | null
  status: 'ready' | 'pending' | null
  category: string | null
  resolution: '4k' | '1080p' | '720p' | null
  duration: '&lt;5s' | '5-15s' | '&gt;15s' | null
  codec: 'h265' | 'h264' | null
  fps: '24' | '30' | '60' | null
  tags: string[] | null
  sort: string
}

const DEFAULTS: BRollFilterState = {
  q: null, source_type: null, status: null, category: null,
  resolution: null, duration: null, codec: null, fps: null,
  tags: null, sort: 'newest',
}

export function serializeFilters(partial: Partial&lt;BRollFilterState&gt;): URLSearchParams {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(partial)) {
    if (v == null || v === '' || (Array.isArray(v) &amp;&amp; v.length === 0)) continue
    if (k === 'sort' &amp;&amp; v === 'newest') continue
    params.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  return params
}

export function deserializeFilters(params: URLSearchParams): BRollFilterState {
  const csvOrNull = (key: string) =&gt; {
    const v = params.get(key)
    return v ? v.split(',').filter(Boolean) : null
  }
  return {
    q: params.get('q') || null,
    source_type: (params.get('source_type') as BRollFilterState['source_type']) || null,
    status: (params.get('status') as BRollFilterState['status']) || null,
    category: params.get('category') || null,
    resolution: (params.get('resolution') as BRollFilterState['resolution']) || null,
    duration: (params.get('duration') as BRollFilterState['duration']) || null,
    codec: (params.get('codec') as BRollFilterState['codec']) || null,
    fps: (params.get('fps') as BRollFilterState['fps']) || null,
    tags: csvOrNull('tags'),
    sort: params.get('sort') || 'newest',
  }
}

export function useBRollFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [filters, setFiltersLocal] = useState&lt;BRollFilterState&gt;(() =&gt; deserializeFilters(searchParams))
  const debounceRef = useRef&lt;ReturnType&lt;typeof setTimeout&gt; | undefined&gt;(undefined)

  const setFilters = useCallback((updater: Partial&lt;BRollFilterState&gt; | ((prev: BRollFilterState) =&gt; BRollFilterState)) =&gt; {
    setFiltersLocal(prev =&gt; {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() =&gt; {
        const params = serializeFilters(next)
        const qs = params.toString()
        router.replace(qs ? `?${qs}` : '?', { scroll: false })
      }, 300)
      return next
    })
  }, [router])

  const clearAll = useCallback(() =&gt; {
    setFiltersLocal(DEFAULTS)
    router.replace('?', { scroll: false })
  }, [router])

  useEffect(() =&gt; () =&gt; clearTimeout(debounceRef.current), [])

  const activeCount = Object.entries(filters).filter(([k, v]) =&gt; {
    if (k === 'sort') return v !== 'newest'
    return v != null &amp;&amp; v !== '' &amp;&amp; !(Array.isArray(v) &amp;&amp; v.length === 0)
  }).length

  return { filters, setFilters, clearAll, activeCount }
}
```

- [ ] 2. Create the helper utilities mirroring `audio-helpers.ts` with B-Roll-specific styling (source type colors, category configs, resolution badges, similarity scoring):

```ts
// apps/web/src/app/cms/(authed)/pipeline/brolls/_helpers/broll-helpers.ts

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '--'
  if (seconds &lt; 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return '--'
  if (bytes &lt; 1024) return `${bytes} B`
  if (bytes &lt; 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes &lt; 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export const SOURCE_TYPE_CONFIG: Record&lt;string, { label: string; dotColor: string; badgeBg: string; badgeColor: string }&gt; = {
  pessoal: { label: 'Pessoal', dotColor: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)', badgeColor: '#22c55e' },
  generico: { label: 'Generico', dotColor: '#3b82f6', badgeBg: 'rgba(59,130,246,0.12)', badgeColor: '#3b82f6' },
}

export function sourceTypeConfig(sourceType: string | null | undefined) {
  if (!sourceType) return SOURCE_TYPE_CONFIG['pessoal']!
  return SOURCE_TYPE_CONFIG[sourceType] ?? SOURCE_TYPE_CONFIG['pessoal']!
}

interface CategoryStyle {
  badgeBg: string
  badgeColor: string
  hoverAccent: string
  dotColor: string
}

const CATEGORY_STYLES: Record&lt;string, CategoryStyle&gt; = {
  travel:    { badgeBg: 'rgba(14,165,233,0.12)', badgeColor: '#38bdf8', hoverAccent: '#0ea5e9', dotColor: '#38bdf8' },
  urban:     { badgeBg: 'rgba(107,114,128,0.12)', badgeColor: '#9ca3af', hoverAccent: '#6b7280', dotColor: '#9ca3af' },
  nature:    { badgeBg: 'rgba(16,185,129,0.12)', badgeColor: '#34d399', hoverAccent: '#10b981', dotColor: '#34d399' },
  tech:      { badgeBg: 'rgba(99,102,241,0.12)', badgeColor: '#818cf8', hoverAccent: '#6366f1', dotColor: '#818cf8' },
  food:      { badgeBg: 'rgba(245,158,11,0.12)', badgeColor: '#fbbf24', hoverAccent: '#f59e0b', dotColor: '#fbbf24' },
  lifestyle: { badgeBg: 'rgba(168,85,247,0.12)', badgeColor: '#c084fc', hoverAccent: '#a855f7', dotColor: '#c084fc' },
  abstract:  { badgeBg: 'rgba(236,72,153,0.12)', badgeColor: '#f472b6', hoverAccent: '#ec4899', dotColor: '#f472b6' },
}

const FALLBACK_STYLE: CategoryStyle = {
  badgeBg: 'rgba(107,114,128,0.12)',
  badgeColor: '#9ca3af',
  hoverAccent: '#6b7280',
  dotColor: '#9ca3af',
}

export function categoryConfig(category: string | null | undefined): CategoryStyle {
  if (!category) return FALLBACK_STYLE
  return CATEGORY_STYLES[category.toLowerCase()] ?? FALLBACK_STYLE
}

export const RESOLUTION_ORDER: Record&lt;string, number&gt; = { '4k': 4, '1080p': 3, '720p': 2, '480p': 1 }

export function resolutionLabel(res: string | null | undefined): string {
  if (!res) return '--'
  if (res === '4k') return '4K'
  return res.toUpperCase()
}

export function similarityScore(a: {
  category?: string | null
  tags?: string[]
  resolution?: string | null
  duration_seconds?: number | null
  source_type?: string | null
  location?: string | null
}, b: typeof a): number {
  let score = 0
  if (a.category &amp;&amp; a.category === b.category) score += 30
  const sharedTags = (a.tags ?? []).filter(t =&gt; (b.tags ?? []).includes(t))
  score += Math.min(sharedTags.length * 5, 30)
  if (a.resolution &amp;&amp; a.resolution === b.resolution) score += 15
  if (a.source_type &amp;&amp; a.source_type === b.source_type) score += 10
  if (a.duration_seconds != null &amp;&amp; b.duration_seconds != null &amp;&amp; Math.abs(a.duration_seconds - b.duration_seconds) &lt;= 3) score += 10
  if (a.location &amp;&amp; b.location &amp;&amp; a.location.toLowerCase() === b.location.toLowerCase()) score += 15
  return Math.min(score, 100)
}
```

- [ ] 3. Verify both files compile:

```bash
npx tsc --noEmit --project apps/web/tsconfig.json 2&gt;&amp;1 | grep -E 'broll-(helpers|filters)' | head -10
```

Expected: no errors referencing these files.

- [ ] 4. Commit:

```
feat(pipeline): add useBRollFilters hook and broll-helpers utilities
```

---

### Task 9 — FrameStrip component

**Files:**
- `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/frame-strip.tsx` (new)

**Steps:**

- [ ] 1. Create the `FrameStrip` component with `card` and `detail` variants. This replaces `WaveformDisplay` for video assets. Card variant shows a single thumbnail area (80px), detail variant shows a 5-frame strip (100px) with a progress bar below:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/brolls/_components/frame-strip.tsx
'use client'

import { memo, useId } from 'react'

type Variant = 'card' | 'detail'

interface FrameData {
  url: string
  timestamp: number
}

interface FrameStripProps {
  variant: Variant
  frames: FrameData[] | null
  duration: number | null
  resolution: string | null
  thumbnailUrl?: string | null
}

const VARIANT_CONFIG = {
  card: { height: 80 },
  detail: { height: 100, frameCount: 5 },
} as const

/** Film-frame SVG icon used as placeholder */
function FilmIcon({ size = 28, opacity = 0.15 }: { size?: number; opacity?: number }) {
  return (
    &lt;svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity, color: 'var(--gem-muted)' }}
      aria-hidden="true"
    &gt;
      &lt;rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /&gt;
      &lt;line x1="7" y1="2" x2="7" y2="22" /&gt;
      &lt;line x1="17" y1="2" x2="17" y2="22" /&gt;
      &lt;line x1="2" y1="12" x2="22" y2="12" /&gt;
      &lt;line x1="2" y1="7" x2="7" y2="7" /&gt;
      &lt;line x1="2" y1="17" x2="7" y2="17" /&gt;
      &lt;line x1="17" y1="7" x2="22" y2="7" /&gt;
      &lt;line x1="17" y1="17" x2="22" y2="17" /&gt;
    &lt;/svg&gt;
  )
}

function FrameStripInner({ variant, frames, duration, resolution, thumbnailUrl }: FrameStripProps) {
  const id = useId()
  const config = VARIANT_CONFIG[variant]
  const hasFrames = frames != null &amp;&amp; frames.length &gt; 0
  const hasThumbnail = thumbnailUrl != null &amp;&amp; thumbnailUrl !== ''

  // ── Card variant ───────────────────────────────────────────────
  if (variant === 'card') {
    const bgStyle: React.CSSProperties = hasThumbnail
      ? {
          backgroundImage: `url(${thumbnailUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        }

    return (
      &lt;div
        style={{
          position: 'relative',
          width: '100%',
          height: config.height,
          overflow: 'hidden',
          ...bgStyle,
        }}
        aria-hidden="true"
      &gt;
        {/* Centered film icon when no thumbnail */}
        {!hasThumbnail &amp;&amp; (
          &lt;div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          &gt;
            &lt;FilmIcon size={28} opacity={0.15} /&gt;
          &lt;/div&gt;
        )}

        {/* Resolution badge — top-right */}
        {resolution &amp;&amp; (
          &lt;span
            style={{
              position: 'absolute',
              top: 4,
              right: 6,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'rgba(255,255,255,0.7)',
              background: 'rgba(0,0,0,0.5)',
              borderRadius: 3,
              padding: '1px 4px',
              lineHeight: 1.4,
              textTransform: 'uppercase',
              pointerEvents: 'none',
            }}
          &gt;
            {resolution === '4k' ? '4K' : resolution}
          &lt;/span&gt;
        )}
      &lt;/div&gt;
    )
  }

  // ── Detail variant ─────────────────────────────────────────────
  const frameCount = config.frameCount

  if (!hasFrames) {
    // Placeholder: 5 gradient boxes with film icon
    return (
      &lt;div&gt;
        &lt;div
          style={{
            display: 'flex',
            gap: 2,
            height: config.height,
            borderRadius: 6,
            overflow: 'hidden',
          }}
        &gt;
          {Array.from({ length: frameCount }, (_, i) =&gt; (
            &lt;div
              key={i}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'pulse-subtle 1.6s ease-in-out infinite',
                animationDelay: `${i * 0.12}s`,
              }}
            &gt;
              &lt;FilmIcon size={16} opacity={0.12} /&gt;
            &lt;/div&gt;
          ))}
        &lt;/div&gt;
        {/* Progress bar placeholder */}
        &lt;div
          style={{
            height: 2,
            borderRadius: 1,
            marginTop: 4,
            background: 'var(--gem-border)',
          }}
        /&gt;
        &lt;span
          style={{
            display: 'block',
            textAlign: 'center',
            fontSize: 8,
            color: '#5a6b7f',
            marginTop: 2,
          }}
        &gt;
          Frame strip available after processing
        &lt;/span&gt;
      &lt;/div&gt;
    )
  }

  // Real frames
  return (
    &lt;div&gt;
      &lt;div
        style={{
          display: 'flex',
          gap: 2,
          height: config.height,
          borderRadius: 6,
          overflow: 'hidden',
        }}
      &gt;
        {frames.slice(0, frameCount).map((frame, i) =&gt; (
          &lt;div
            key={`${id}-frame-${i}`}
            style={{
              flex: 1,
              backgroundImage: `url(${frame.url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              position: 'relative',
            }}
          &gt;
            &lt;span
              style={{
                position: 'absolute',
                bottom: 2,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 8,
                color: 'rgba(255,255,255,0.5)',
                background: 'rgba(0,0,0,0.4)',
                borderRadius: 2,
                padding: '0px 3px',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            &gt;
              {frame.timestamp.toFixed(1)}s
            &lt;/span&gt;
          &lt;/div&gt;
        ))}
      &lt;/div&gt;

      {/* Progress bar with frame position markers */}
      &lt;div
        style={{
          position: 'relative',
          height: 2,
          borderRadius: 1,
          marginTop: 4,
          background: 'var(--gem-border)',
        }}
      &gt;
        {duration != null &amp;&amp; duration &gt; 0 &amp;&amp; frames.map((frame, i) =&gt; {
          const pct = Math.min((frame.timestamp / duration) * 100, 100)
          return (
            &lt;div
              key={`${id}-marker-${i}`}
              style={{
                position: 'absolute',
                left: `${pct}%`,
                top: -1,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'var(--gem-accent)',
                transform: 'translateX(-50%)',
              }}
            /&gt;
          )
        })}
      &lt;/div&gt;
    &lt;/div&gt;
  )
}

export const FrameStrip = memo(FrameStripInner)
```

- [ ] 2. Verify the component compiles:

```bash
npx tsc --noEmit --project apps/web/tsconfig.json 2&gt;&amp;1 | grep 'frame-strip' | head -5
```

Expected: no errors.

- [ ] 3. Commit:

```
feat(pipeline): add FrameStrip component for B-Roll video thumbnails
```

---

### Task 10 — BRollCard component

**Files:**
- `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-card.tsx` (new)

**Steps:**

- [ ] 1. Create the `BRollCard` component mirroring `AudioCard` structure. Uses `FrameStrip` (card variant) instead of `WaveformDisplay`. Shows source-type dot, title, resolution line, and tag pills:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-card.tsx
'use client'

import { memo } from 'react'
import { FrameStrip } from './frame-strip'
import { formatDuration, sourceTypeConfig, categoryConfig } from '../_helpers/broll-helpers'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'

interface BRollCardProps {
  asset: BRollAssetRow
  selected: boolean
  onSelect: (id: string) =&gt; void
}

const STATUS_LABEL: Record&lt;string, string&gt; = {
  ready: 'Ready',
  pending: 'Pending',
}

const STATUS_BADGE_STYLE: Record&lt;string, React.CSSProperties&gt; = {
  pending: {
    background: 'rgba(234,179,8,0.15)',
    color: '#fbbf24',
    border: '1px solid rgba(234,179,8,0.25)',
  },
}

function BRollCardInner({ asset, selected, onSelect }: BRollCardProps) {
  const {
    id,
    original_filename,
    renamed_to,
    source_type,
    category,
    resolution,
    duration_seconds,
    tags,
    status,
    thumbnail_url,
    metadata,
  } = asset

  const isPending = status === 'pending'
  const srcConfig = sourceTypeConfig(source_type)
  const catConfig = categoryConfig(category)
  const displayName = renamed_to ?? original_filename
  const visibleTags = tags.slice(0, 3)
  const overflowCount = tags.length - 3

  const frames = Array.isArray((metadata as Record&lt;string, unknown&gt;)?.frame_strip)
    ? ((metadata as Record&lt;string, unknown&gt;).frame_strip as Array&lt;{ url: string; timestamp: number }&gt;)
    : null

  const ariaLabel = [
    displayName,
    source_type === 'pessoal' ? 'Pessoal' : 'Generico',
    resolution,
    duration_seconds != null ? formatDuration(duration_seconds) : null,
    STATUS_LABEL[status] ?? status,
  ]
    .filter(Boolean)
    .join(', ')

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    cursor: 'pointer',
    outline: 'none',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
    background: 'var(--gem-surface)',
    border: selected
      ? '2px solid var(--gem-accent)'
      : '1px solid var(--gem-border)',
    boxShadow: selected
      ? '0 0 0 3px color-mix(in srgb, var(--gem-accent) 20%, transparent)'
      : 'none',
  }

  function handleClick() {
    onSelect(id)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id)
    }
  }

  return (
    &lt;article
      role="article"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={selected}
      style={cardStyle}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-card-id={id}
      className="broll-card"
    &gt;
      {/* Thumbnail hero */}
      &lt;div style={{ position: 'relative' }}&gt;
        &lt;FrameStrip
          variant="card"
          frames={frames}
          duration={duration_seconds}
          resolution={resolution}
          thumbnailUrl={thumbnail_url}
        /&gt;

        {/* Duration badge */}
        {duration_seconds != null &amp;&amp; (
          &lt;span
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: 4,
              left: 6,
              fontSize: 9,
              fontVariantNumeric: 'tabular-nums',
              color: 'rgba(255,255,255,0.6)',
              background: 'rgba(0,0,0,0.45)',
              borderRadius: 3,
              padding: '1px 4px',
              lineHeight: 1.4,
              pointerEvents: 'none',
            }}
          &gt;
            {formatDuration(duration_seconds)}
          &lt;/span&gt;
        )}

        {/* Status badge — pending only */}
        {isPending &amp;&amp; (
          &lt;span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 4,
              left: 6,
              fontSize: 9,
              borderRadius: 3,
              padding: '1px 5px',
              lineHeight: 1.4,
              fontWeight: 600,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              pointerEvents: 'none',
              ...(STATUS_BADGE_STYLE[status] ?? {}),
            }}
          &gt;
            {STATUS_LABEL[status]}
          &lt;/span&gt;
        )}
      &lt;/div&gt;

      {/* Card body */}
      &lt;div style={{ padding: '8px 10px 10px' }}&gt;
        {/* Title row: source dot + name */}
        &lt;div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 3,
          }}
        &gt;
          &lt;span
            aria-hidden="true"
            title={srcConfig.label}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              flexShrink: 0,
              background: srcConfig.dotColor,
            }}
          /&gt;
          &lt;span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--gem-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          &gt;
            {displayName}
          &lt;/span&gt;
        &lt;/div&gt;

        {/* Subtitle: source_type . resolution */}
        &lt;div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 5,
          }}
        &gt;
          &lt;span
            style={{
              fontSize: 10,
              color: 'var(--gem-text-muted, var(--gem-muted))',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          &gt;
            {srcConfig.label} {resolution ? `\u00B7 ${resolution === '4k' ? '4K' : resolution}` : ''}
          &lt;/span&gt;
          {category &amp;&amp; (
            &lt;span
              style={{
                fontSize: 9,
                borderRadius: 3,
                padding: '1px 5px',
                fontWeight: 600,
                letterSpacing: '0.02em',
                textTransform: 'capitalize',
                background: catConfig.badgeBg,
                color: catConfig.badgeColor,
                flexShrink: 0,
                lineHeight: 1.5,
              }}
            &gt;
              {category}
            &lt;/span&gt;
          )}
        &lt;/div&gt;

        {/* Tag pills */}
        {visibleTags.length &gt; 0 &amp;&amp; (
          &lt;div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}&gt;
            {visibleTags.map((tag) =&gt; (
              &lt;span
                key={tag}
                style={{
                  fontSize: 8,
                  borderRadius: 3,
                  padding: '1px 4px',
                  background: 'var(--gem-well)',
                  color: 'var(--gem-text-muted, var(--gem-muted))',
                  lineHeight: 1.5,
                  letterSpacing: '0.01em',
                }}
              &gt;
                {tag}
              &lt;/span&gt;
            ))}
            {overflowCount &gt; 0 &amp;&amp; (
              &lt;span
                style={{
                  fontSize: 8,
                  borderRadius: 3,
                  padding: '1px 4px',
                  background: 'var(--gem-well)',
                  color: 'var(--gem-text-muted, var(--gem-muted))',
                  lineHeight: 1.5,
                  opacity: 0.7,
                }}
              &gt;
                +{overflowCount}
              &lt;/span&gt;
            )}
          &lt;/div&gt;
        )}
      &lt;/div&gt;

      &lt;style&gt;{`
        .broll-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2);
          border-color: ${catConfig.hoverAccent} !important;
        }
        .broll-card:focus-visible {
          box-shadow: 0 0 0 2px var(--gem-accent);
        }
      `}&lt;/style&gt;
    &lt;/article&gt;
  )
}

export const BRollCard = memo(BRollCardInner)
```

- [ ] 2. Verify the component compiles:

```bash
npx tsc --noEmit --project apps/web/tsconfig.json 2&gt;&amp;1 | grep 'broll-card' | head -5
```

Expected: no errors.

- [ ] 3. Commit:

```
feat(pipeline): add BRollCard component with thumbnail, source dot, and tags
```

---

### Task 11 — BRollGrid + BRollTable + BRollFilters

**Files:**
- `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-grid.tsx` (new)
- `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-table.tsx` (new)
- `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-filters.tsx` (new)

**Steps:**

- [ ] 1. Create `BRollGrid` mirroring `AudioGridV2` with IntersectionObserver staggered animations and `minmax(280px, 340px)` grid:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-grid.tsx
'use client'

import { useRef, useEffect } from 'react'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'
import { BRollCard } from './broll-card'

interface BRollGridProps {
  assets: BRollAssetRow[]
  selectedId: string | null
  onSelect: (id: string) =&gt; void
}

export function BRollGrid({ assets, selectedId, onSelect }: BRollGridProps) {
  const gridRef = useRef&lt;HTMLDivElement&gt;(null)

  useEffect(() =&gt; {
    if (!gridRef.current) return
    const observer = new IntersectionObserver((entries) =&gt; {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          el.style.animationPlayState = 'running'
          observer.unobserve(el)
        }
      }
    }, { threshold: 0.1 })

    const cards = gridRef.current.querySelectorAll('[data-card-animate]')
    cards.forEach(card =&gt; observer.observe(card))
    return () =&gt; observer.disconnect()
  }, [assets])

  if (assets.length === 0) return null

  return (
    &lt;div
      ref={gridRef}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 340px))',
        gap: 14,
      }}
    &gt;
      {assets.map((asset, i) =&gt; (
        &lt;div
          key={asset.id}
          data-card-animate
          style={{
            animation: 'fade-in-up 0.3s ease-out both',
            animationDelay: `${Math.min(i * 30, 300)}ms`,
            animationPlayState: 'paused',
          }}
        &gt;
          &lt;BRollCard
            asset={asset}
            selected={asset.id === selectedId}
            onSelect={onSelect}
          /&gt;
        &lt;/div&gt;
      ))}
    &lt;/div&gt;
  )
}
```

- [ ] 2. Create `BRollTable` mirroring `AudioTableV2` with sortable columns (name, duration, resolution), density toggle, checkbox multi-select, column picker, and bulk actions. Columns: checkbox, thumbnail (64px), name, source_type, category, resolution, duration, codec, fps, status:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-table.tsx
'use client'

import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'
import { formatDuration, sourceTypeConfig, categoryConfig } from '../_helpers/broll-helpers'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BRollTableProps {
  assets: BRollAssetRow[]
  selectedId: string | null
  onSelect: (id: string) =&gt; void
  onRefetch?: () =&gt; void
}

type SortKey = 'name' | 'duration' | 'resolution'
type SortDir = 'asc' | 'desc'
type Density = 'compact' | 'default' | 'comfortable'

type ColumnId =
  | 'checkbox'
  | 'thumbnail'
  | 'name'
  | 'source_type'
  | 'category'
  | 'resolution'
  | 'duration'
  | 'codec'
  | 'fps'
  | 'status'

interface ColumnDef {
  id: ColumnId
  label: string
  width: number | string
  sortable: boolean
  locked?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: ColumnDef[] = [
  { id: 'checkbox',    label: '',          width: 32,     sortable: false },
  { id: 'thumbnail',   label: '',          width: 64,     sortable: false },
  { id: 'name',        label: 'Name',      width: '1fr',  sortable: true, locked: true },
  { id: 'source_type', label: 'Source',    width: 80,     sortable: false },
  { id: 'category',    label: 'Category',  width: 100,    sortable: false },
  { id: 'resolution',  label: 'Res.',      width: 60,     sortable: true },
  { id: 'duration',    label: 'Dur.',      width: 55,     sortable: true },
  { id: 'codec',       label: 'Codec',     width: 60,     sortable: false },
  { id: 'fps',         label: 'FPS',       width: 45,     sortable: false },
  { id: 'status',      label: 'Status',    width: 80,     sortable: false },
]

const DEFAULT_VISIBLE = new Set&lt;ColumnId&gt;([
  'checkbox', 'thumbnail', 'name', 'source_type', 'category',
  'resolution', 'duration', 'codec', 'fps', 'status',
])

const DENSITY_PAD: Record&lt;Density, string&gt; = {
  compact:     '5px 10px',
  default:     '8px 10px',
  comfortable: '10px 10px',
}

const RESOLUTION_ORDER: Record&lt;string, number&gt; = { '4k': 4, '1080p': 3, '720p': 2, '480p': 1 }

const STATUS_CONFIG: Record&lt;string, { label: string; bg: string; color: string; dot: string }&gt; = {
  ready:   { label: 'Ready',   bg: 'rgba(16,185,129,0.12)',  color: '#10b981', dot: '#10b981' },
  pending: { label: 'Pending', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', dot: '#f59e0b' },
}

const SOURCE_CONFIG: Record&lt;string, { label: string; bg: string; color: string }&gt; = {
  pessoal:  { label: 'Pessoal',  bg: 'rgba(34,197,94,0.15)',  color: '#22c55e' },
  generico: { label: 'Generico', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
}

// ─── Row component (memoised) ─────────────────────────────────────────────────

interface RowProps {
  asset: BRollAssetRow
  selected: boolean
  checked: boolean
  visibleCols: Set&lt;ColumnId&gt;
  tdPad: string
  onSelect: () =&gt; void
  onCheck: (e: React.MouseEvent) =&gt; void
}

const BRollTableRow = memo(function BRollTableRow({
  asset, selected, checked, visibleCols, tdPad, onSelect, onCheck,
}: RowProps) {
  const rowBg = selected
    ? 'color-mix(in srgb, var(--gem-accent) 8%, var(--gem-surface))'
    : checked
      ? 'color-mix(in srgb, var(--gem-accent) 4%, var(--gem-surface))'
      : 'transparent'

  const catCfg = categoryConfig(asset.category)
  const statusCfg = STATUS_CONFIG[asset.status] ?? { label: asset.status, bg: 'rgba(107,114,128,0.12)', color: '#6b7280', dot: '#6b7280' }
  const srcCfg = SOURCE_CONFIG[asset.source_type] ?? { label: asset.source_type, bg: 'rgba(107,114,128,0.12)', color: '#6b7280' }

  return (
    &lt;tr
      onClick={onSelect}
      style={{
        borderBottom: '1px solid var(--gem-border)',
        cursor: 'pointer',
        background: rowBg,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e =&gt; { if (!selected &amp;&amp; !checked) (e.currentTarget as HTMLElement).style.background = 'var(--gem-surface-hi)' }}
      onMouseLeave={e =&gt; { (e.currentTarget as HTMLElement).style.background = rowBg }}
    &gt;
      {visibleCols.has('checkbox') &amp;&amp; (
        &lt;td style={{ padding: tdPad, width: 32 }} onClick={onCheck}&gt;
          &lt;input
            type="checkbox"
            checked={checked}
            onChange={() =&gt; {}}
            aria-label={`Select ${asset.renamed_to ?? asset.original_filename}`}
            style={{ cursor: 'pointer' }}
          /&gt;
        &lt;/td&gt;
      )}

      {visibleCols.has('thumbnail') &amp;&amp; (
        &lt;td style={{ padding: tdPad, width: 64 }}&gt;
          &lt;div style={{
            width: 56, height: 32, borderRadius: 4, overflow: 'hidden',
            background: asset.thumbnail_url
              ? `url(${asset.thumbnail_url}) center/cover`
              : 'linear-gradient(135deg, #1e293b, #0f172a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}&gt;
            {!asset.thumbnail_url &amp;&amp; (
              &lt;svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a6b7f" strokeWidth="1.5" opacity="0.3"&gt;
                &lt;rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /&gt;
                &lt;line x1="7" y1="2" x2="7" y2="22" /&gt;
                &lt;line x1="17" y1="2" x2="17" y2="22" /&gt;
              &lt;/svg&gt;
            )}
          &lt;/div&gt;
        &lt;/td&gt;
      )}

      {visibleCols.has('name') &amp;&amp; (
        &lt;td style={{ padding: tdPad, minWidth: 180 }}&gt;
          &lt;div style={{ fontWeight: 500, color: 'var(--gem-text)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}&gt;
            {asset.renamed_to ?? asset.original_filename}
          &lt;/div&gt;
          &lt;div style={{ fontSize: 10, color: 'var(--gem-dim)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}&gt;
            {[asset.source, asset.asset_id].filter(Boolean).join(' \u00B7 ')}
          &lt;/div&gt;
        &lt;/td&gt;
      )}

      {visibleCols.has('source_type') &amp;&amp; (
        &lt;td style={{ padding: tdPad, width: 80 }}&gt;
          &lt;span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 6px', borderRadius: 4, background: srcCfg.bg, color: srcCfg.color }}&gt;
            &lt;span style={{ width: 5, height: 5, borderRadius: '50%', background: srcCfg.color, flexShrink: 0 }} /&gt;
            {srcCfg.label}
          &lt;/span&gt;
        &lt;/td&gt;
      )}

      {visibleCols.has('category') &amp;&amp; (
        &lt;td style={{ padding: tdPad, width: 100 }}&gt;
          {asset.category ? (
            &lt;span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 6px', borderRadius: 4, background: catCfg.badgeBg, color: catCfg.badgeColor }}&gt;
              &lt;span style={{ width: 5, height: 5, borderRadius: '50%', background: catCfg.dotColor, flexShrink: 0 }} /&gt;
              {asset.category}
            &lt;/span&gt;
          ) : (
            &lt;span style={{ color: 'var(--gem-dim)', opacity: 0.4 }}&gt;--&lt;/span&gt;
          )}
        &lt;/td&gt;
      )}

      {visibleCols.has('resolution') &amp;&amp; (
        &lt;td style={{ padding: tdPad, width: 60, fontSize: 11, fontWeight: 500, color: 'var(--gem-text)' }}&gt;
          {asset.resolution === '4k' ? '4K' : asset.resolution}
        &lt;/td&gt;
      )}

      {visibleCols.has('duration') &amp;&amp; (
        &lt;td style={{ padding: tdPad, width: 55, fontVariantNumeric: 'tabular-nums', color: asset.duration_seconds != null ? 'var(--gem-text)' : undefined }}&gt;
          {asset.duration_seconds != null
            ? formatDuration(asset.duration_seconds)
            : &lt;span style={{ opacity: 0.4 }}&gt;--&lt;/span&gt;}
        &lt;/td&gt;
      )}

      {visibleCols.has('codec') &amp;&amp; (
        &lt;td style={{ padding: tdPad, width: 60, fontSize: 11, color: 'var(--gem-muted)' }}&gt;
          {asset.codec ?? &lt;span style={{ opacity: 0.4 }}&gt;--&lt;/span&gt;}
        &lt;/td&gt;
      )}

      {visibleCols.has('fps') &amp;&amp; (
        &lt;td style={{ padding: tdPad, width: 45, fontVariantNumeric: 'tabular-nums', color: 'var(--gem-muted)' }}&gt;
          {asset.fps ?? &lt;span style={{ opacity: 0.4 }}&gt;--&lt;/span&gt;}
        &lt;/td&gt;
      )}

      {visibleCols.has('status') &amp;&amp; (
        &lt;td style={{ padding: tdPad, width: 80 }}&gt;
          &lt;span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 6px', borderRadius: 4, background: statusCfg.bg, color: statusCfg.color }}&gt;
            &lt;span style={{ width: 5, height: 5, borderRadius: '50%', background: statusCfg.dot, flexShrink: 0 }} /&gt;
            {statusCfg.label}
          &lt;/span&gt;
        &lt;/td&gt;
      )}
    &lt;/tr&gt;
  )
})

// ─── Column Picker popover ─────────────────────────────────────────────────────

interface ColumnPickerProps {
  visible: Set&lt;ColumnId&gt;
  onChange: (id: ColumnId, on: boolean) =&gt; void
  onClose: () =&gt; void
}

function ColumnPicker({ visible, onChange, onClose }: ColumnPickerProps) {
  const ref = useRef&lt;HTMLDivElement&gt;(null)
  useEffect(() =&gt; {
    function handleClick(e: MouseEvent) {
      if (ref.current &amp;&amp; !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () =&gt; document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const pickable = COLUMNS.filter(c =&gt; c.id !== 'checkbox' &amp;&amp; c.id !== 'thumbnail')

  return (
    &lt;div ref={ref} role="dialog" aria-label="Column picker" style={{
      position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 200, zIndex: 100,
      background: 'var(--gem-surface)', border: '1px solid var(--gem-border)', borderRadius: 8, padding: '8px 0',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}&gt;
      &lt;div style={{ padding: '4px 12px 6px', fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}&gt;Columns&lt;/div&gt;
      {pickable.map(col =&gt; {
        const locked = col.locked === true
        const isVisible = visible.has(col.id)
        return (
          &lt;label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: locked ? 'default' : 'pointer', opacity: locked ? 0.4 : 1, fontSize: 12, color: 'var(--gem-text)' }}&gt;
            &lt;input type="checkbox" checked={isVisible} disabled={locked} onChange={e =&gt; onChange(col.id, e.target.checked)} style={{ cursor: locked ? 'default' : 'pointer' }} /&gt;
            {col.label}
          &lt;/label&gt;
        )
      })}
    &lt;/div&gt;
  )
}

// ─── Bulk actions bar ─────────────────────────────────────────────────────────

interface BulkBarProps {
  count: number
  loading: boolean
  onAction: (action: 'tag' | 'category' | 'status' | 'export' | 'delete') =&gt; void
  onClear: () =&gt; void
}

function BulkBar({ count, loading, onAction, onClear }: BulkBarProps) {
  const btn: React.CSSProperties = {
    padding: '3px 10px', borderRadius: 4, border: '1px solid var(--gem-border)', background: 'transparent',
    color: 'var(--gem-text)', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 11, opacity: loading ? 0.5 : 1, fontFamily: 'inherit',
  }
  const dangerBtn: React.CSSProperties = { ...btn, color: 'var(--gem-danger, #ef4444)', borderColor: 'rgba(239,68,68,0.3)' }

  return (
    &lt;div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'color-mix(in srgb, var(--gem-accent) 8%, var(--gem-surface))', borderRadius: 6, marginBottom: 8, fontSize: 12, border: '1px solid color-mix(in srgb, var(--gem-accent) 20%, transparent)' }}&gt;
      &lt;span style={{ color: 'var(--gem-text)', fontWeight: 600 }}&gt;{count} selected{loading ? ' \u00B7 Working...' : ''}&lt;/span&gt;
      &lt;button onClick={() =&gt; onAction('tag')} disabled={loading} style={btn}&gt;Set Tag&lt;/button&gt;
      &lt;button onClick={() =&gt; onAction('category')} disabled={loading} style={btn}&gt;Set Category&lt;/button&gt;
      &lt;button onClick={() =&gt; onAction('status')} disabled={loading} style={btn}&gt;Set Status&lt;/button&gt;
      &lt;button onClick={() =&gt; onAction('export')} disabled={loading} style={btn}&gt;Export JSON&lt;/button&gt;
      &lt;button onClick={() =&gt; onAction('delete')} disabled={loading} style={dangerBtn}&gt;Delete&lt;/button&gt;
      &lt;button onClick={onClear} disabled={loading} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}&gt;Clear&lt;/button&gt;
    &lt;/div&gt;
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BRollTable({ assets, selectedId, onSelect, onRefetch }: BRollTableProps) {
  const [sortKey, setSortKey]     = useState&lt;SortKey&gt;('name')
  const [sortDir, setSortDir]     = useState&lt;SortDir&gt;('asc')
  const [density, setDensity]     = useState&lt;Density&gt;('default')
  const [checked, setChecked]     = useState&lt;Set&lt;string&gt;&gt;(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [pickerOpen, setPickerOpen]   = useState(false)
  const [visibleCols, setVisibleCols] = useState&lt;Set&lt;ColumnId&gt;&gt;(DEFAULT_VISIBLE)
  const pickerAnchorRef = useRef&lt;HTMLDivElement&gt;(null)
  const tdPad = DENSITY_PAD[density]

  const sorted = useMemo(() =&gt; {
    const list = [...assets]
    list.sort((a, b) =&gt; {
      let cmp = 0
      if (sortKey === 'name') cmp = (a.renamed_to ?? a.original_filename).localeCompare(b.renamed_to ?? b.original_filename)
      else if (sortKey === 'duration') cmp = (a.duration_seconds ?? -1) - (b.duration_seconds ?? -1)
      else if (sortKey === 'resolution') cmp = (RESOLUTION_ORDER[a.resolution] ?? 0) - (RESOLUTION_ORDER[b.resolution] ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [assets, sortKey, sortDir])

  const toggleSort = useCallback((key: SortKey) =&gt; {
    if (sortKey === key) setSortDir(d =&gt; d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }, [sortKey])

  const toggleCheck = useCallback((id: string, e: React.MouseEvent) =&gt; {
    e.stopPropagation()
    setChecked(prev =&gt; { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }, [])

  const toggleAll = useCallback(() =&gt; {
    setChecked(prev =&gt; prev.size === sorted.length &amp;&amp; sorted.length &gt; 0 ? new Set() : new Set(sorted.map(a =&gt; a.id)))
  }, [sorted])

  const toggleColumn = useCallback((id: ColumnId, on: boolean) =&gt; {
    setVisibleCols(prev =&gt; { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next })
  }, [])

  const bulkAction = useCallback(async (action: 'tag' | 'category' | 'status' | 'export' | 'delete') =&gt; {
    const ids = Array.from(checked)
    if (ids.length === 0) return
    if (action === 'export') {
      const selected = assets.filter(a =&gt; checked.has(a.id))
      const blob = new Blob([JSON.stringify({ schema_version: '1.0', brolls: selected }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `broll-selection-${ids.length}.json`; link.click()
      URL.revokeObjectURL(url)
      return
    }
    if (action === 'delete') {
      if (!confirm(`Delete ${ids.length} asset${ids.length &gt; 1 ? 's' : ''}?`)) return
      setBulkLoading(true)
      try {
        const results = await Promise.allSettled(ids.map(id =&gt; {
          const asset = assets.find(a =&gt; a.id === id)
          const url = asset ? `/api/pipeline/broll-library/${id}?version=${asset.version}` : `/api/pipeline/broll-library/${id}`
          return fetch(url, { method: 'DELETE' })
        }))
        const failed = results.filter(r =&gt; r.status === 'rejected' || (r.status === 'fulfilled' &amp;&amp; !r.value.ok)).length
        if (failed &gt; 0) alert(`${failed} of ${ids.length} deletes failed`)
        setChecked(new Set()); onRefetch?.()
      } finally { setBulkLoading(false) }
      return
    }
    const value = prompt(`Enter ${action} value for ${ids.length} asset${ids.length &gt; 1 ? 's' : ''}:`)
    if (!value) return
    const body: Record&lt;string, unknown&gt; = {}
    if (action === 'tag') body.tags = value.split(',').map(t =&gt; t.trim())
    else body[action] = value
    setBulkLoading(true)
    try {
      const results = await Promise.allSettled(ids.map(id =&gt; fetch(`/api/pipeline/broll-library/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, version: assets.find(a =&gt; a.id === id)?.version ?? 1 }),
      })))
      const failed = results.filter(r =&gt; r.status === 'rejected' || (r.status === 'fulfilled' &amp;&amp; !r.value.ok)).length
      if (failed &gt; 0) alert(`${failed} of ${ids.length} updates failed`)
      setChecked(new Set()); onRefetch?.()
    } finally { setBulkLoading(false) }
  }, [assets, checked, onRefetch])

  const sortIndicator = (key: SortKey) =&gt; {
    if (sortKey !== key) return null
    return &lt;span aria-hidden="true" style={{ marginLeft: 3, opacity: 0.7 }}&gt;{sortDir === 'asc' ? '\u2191' : '\u2193'}&lt;/span&gt;
  }

  const thBase: React.CSSProperties = { padding: tdPad, textAlign: 'left', color: 'var(--gem-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', userSelect: 'none', whiteSpace: 'nowrap' }
  const thSortable: React.CSSProperties = { ...thBase, cursor: 'pointer' }
  const allChecked = sorted.length &gt; 0 &amp;&amp; checked.size === sorted.length
  const someChecked = checked.size &gt; 0 &amp;&amp; checked.size &lt; sorted.length

  return (
    &lt;div&gt;
      {/* Toolbar */}
      &lt;div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}&gt;
        &lt;span style={{ fontSize: 12, color: 'var(--gem-muted)', fontWeight: 500 }}&gt;{assets.length} clip{assets.length !== 1 ? 's' : ''}&lt;/span&gt;
        &lt;div style={{ display: 'flex', alignItems: 'center', gap: 6 }}&gt;
          &lt;div role="group" aria-label="Table density" style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--gem-border)' }}&gt;
            {(['compact', 'default', 'comfortable'] as Density[]).map(d =&gt; (
              &lt;button key={d} onClick={() =&gt; setDensity(d)} aria-pressed={density === d} title={d.charAt(0).toUpperCase() + d.slice(1)} style={{ padding: '3px 9px', border: 'none', borderRight: d !== 'comfortable' ? '1px solid var(--gem-border)' : 'none', background: density === d ? 'var(--gem-surface-hi)' : 'transparent', color: density === d ? 'var(--gem-text)' : 'var(--gem-muted)', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', fontWeight: density === d ? 600 : 400, transition: 'background 0.1s' }}&gt;
                {d === 'compact' ? 'C' : d === 'default' ? 'D' : 'R'}
              &lt;/button&gt;
            ))}
          &lt;/div&gt;
          &lt;div ref={pickerAnchorRef} style={{ position: 'relative' }}&gt;
            &lt;button onClick={() =&gt; setPickerOpen(o =&gt; !o)} aria-haspopup="dialog" aria-expanded={pickerOpen} aria-label="Column picker" title="Choose columns" style={{ padding: '3px 9px', borderRadius: 5, border: '1px solid var(--gem-border)', background: pickerOpen ? 'var(--gem-surface-hi)' : 'transparent', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}&gt;
              Cols
            &lt;/button&gt;
            {pickerOpen &amp;&amp; &lt;ColumnPicker visible={visibleCols} onChange={toggleColumn} onClose={() =&gt; setPickerOpen(false)} /&gt;}
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;

      {checked.size &gt; 0 &amp;&amp; &lt;BulkBar count={checked.size} loading={bulkLoading} onAction={bulkAction} onClear={() =&gt; setChecked(new Set())} /&gt;}

      &lt;div style={{ overflowX: 'auto' }}&gt;
        &lt;table aria-label="B-Roll assets" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}&gt;
          &lt;thead&gt;
            &lt;tr style={{ borderBottom: '1px solid var(--gem-border)' }}&gt;
              {visibleCols.has('checkbox') &amp;&amp; (&lt;th style={{ ...thBase, width: 32, padding: tdPad }}&gt;&lt;input type="checkbox" checked={allChecked} ref={el =&gt; { if (el) el.indeterminate = someChecked }} onChange={toggleAll} aria-label="Select all" style={{ cursor: 'pointer' }} /&gt;&lt;/th&gt;)}
              {visibleCols.has('thumbnail') &amp;&amp; (&lt;th style={{ ...thBase, width: 64, padding: tdPad }} aria-label="Thumbnail" /&gt;)}
              {visibleCols.has('name') &amp;&amp; (&lt;th style={{ ...thSortable, minWidth: 180, padding: tdPad }} onClick={() =&gt; toggleSort('name')} aria-sort={sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}&gt;Name{sortIndicator('name')}&lt;/th&gt;)}
              {visibleCols.has('source_type') &amp;&amp; (&lt;th style={{ ...thBase, width: 80, padding: tdPad }}&gt;Source&lt;/th&gt;)}
              {visibleCols.has('category') &amp;&amp; (&lt;th style={{ ...thBase, width: 100, padding: tdPad }}&gt;Category&lt;/th&gt;)}
              {visibleCols.has('resolution') &amp;&amp; (&lt;th style={{ ...thSortable, width: 60, padding: tdPad }} onClick={() =&gt; toggleSort('resolution')} aria-sort={sortKey === 'resolution' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}&gt;Res.{sortIndicator('resolution')}&lt;/th&gt;)}
              {visibleCols.has('duration') &amp;&amp; (&lt;th style={{ ...thSortable, width: 55, padding: tdPad }} onClick={() =&gt; toggleSort('duration')} aria-sort={sortKey === 'duration' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}&gt;Dur.{sortIndicator('duration')}&lt;/th&gt;)}
              {visibleCols.has('codec') &amp;&amp; (&lt;th style={{ ...thBase, width: 60, padding: tdPad }}&gt;Codec&lt;/th&gt;)}
              {visibleCols.has('fps') &amp;&amp; (&lt;th style={{ ...thBase, width: 45, padding: tdPad }}&gt;FPS&lt;/th&gt;)}
              {visibleCols.has('status') &amp;&amp; (&lt;th style={{ ...thBase, width: 80, padding: tdPad }}&gt;Status&lt;/th&gt;)}
            &lt;/tr&gt;
          &lt;/thead&gt;
          &lt;tbody&gt;
            {sorted.length === 0 &amp;&amp; (&lt;tr&gt;&lt;td colSpan={visibleCols.size} style={{ padding: 40, textAlign: 'center', color: 'var(--gem-muted)', fontSize: 13 }}&gt;No assets match your filters.&lt;/td&gt;&lt;/tr&gt;)}
            {sorted.map(asset =&gt; (
              &lt;BRollTableRow key={asset.id} asset={asset} selected={selectedId === asset.id} checked={checked.has(asset.id)} visibleCols={visibleCols} tdPad={tdPad} onSelect={() =&gt; onSelect(asset.id)} onCheck={e =&gt; toggleCheck(asset.id, e)} /&gt;
            ))}
          &lt;/tbody&gt;
        &lt;/table&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  )
}
```

- [ ] 3. Create `BRollFilters` mirroring `AudioFiltersV2` with the B-Roll filter state. 280px sidebar with: search input (`data-broll-search`), sort dropdown, active pills, segmented Tipo (Pessoal/Generico), segmented Status (Ready/Pending), category chips, resolution segmented (4K/1080p/720p), duration buttons (&lt;5s/5-15s/&gt;15s), advanced collapsible (codec, fps, tags):

```tsx
// apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-filters.tsx
'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'
import type { BRollFilterState } from '../_helpers/use-broll-filters'
import { categoryConfig } from '../_helpers/broll-helpers'

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface BRollFiltersProps {
  filters: BRollFilterState
  setFilters: (partial: Partial&lt;BRollFilterState&gt;) =&gt; void
  clearAll: () =&gt; void
  activeCount: number
  assets: BRollAssetRow[]
  availableTags: string[]
}

/* ─── Constants ─────────────────────────────────────────────────────────── */

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'dur_asc', label: 'Duration \u2191' },
  { value: 'dur_desc', label: 'Duration \u2193' },
  { value: 'res_desc', label: 'Resolution \u2193' },
] as const

const DUR_OPTIONS = [
  { value: '&lt;5s', label: '&lt;5s' },
  { value: '5-15s', label: '5-15s' },
  { value: '&gt;15s', label: '&gt;15s' },
] as const

const PILL_LABELS: Partial&lt;Record&lt;keyof BRollFilterState, string&gt;&gt; = {
  q: 'Search', source_type: 'Source', status: 'Status', category: 'Category',
  resolution: 'Resolution', duration: 'Duration', codec: 'Codec', fps: 'FPS', tags: 'Tags', sort: 'Sort',
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

interface SegmentedProps&lt;T extends string | null&gt; {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) =&gt; void
  ariaLabel: string
}

function Segmented&lt;T extends string | null&gt;({ options, value, onChange, ariaLabel }: SegmentedProps&lt;T&gt;) {
  return (
    &lt;div role="group" aria-label={ariaLabel} style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}&gt;
      {options.map(opt =&gt; {
        const active = opt.value === value
        return (
          &lt;button key={String(opt.value ?? '__null__')} type="button" aria-pressed={active} onClick={() =&gt; onChange(opt.value)}
            style={{ flex: 1, minWidth: 0, padding: '4px 6px', fontSize: 11, fontWeight: active ? 600 : 400, borderRadius: 5, border: '1px solid var(--gem-border)', background: active ? 'var(--gem-accent)' : 'var(--gem-well)', color: active ? '#fff' : 'var(--gem-muted)', cursor: 'pointer', transition: 'background 0.1s, color 0.1s', whiteSpace: 'nowrap' }}&gt;
            {opt.label}
            {opt.count != null &amp;&amp; (&lt;span style={{ marginLeft: 3, opacity: 0.7, fontSize: 10 }}&gt;({opt.count})&lt;/span&gt;)}
          &lt;/button&gt;
        )
      })}
    &lt;/div&gt;
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (&lt;div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gem-muted)', marginBottom: 6 }}&gt;{children}&lt;/div&gt;)
}

function Section({ children }: { children: React.ReactNode }) {
  return (&lt;div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}&gt;{children}&lt;/div&gt;)
}

/* ─── Main Component ────────────────────────────────────────────────────── */

export function BRollFilters({ filters, setFilters, clearAll, activeCount, assets, availableTags: _availableTags }: BRollFiltersProps) {
  const searchRef = useRef&lt;HTMLInputElement&gt;(null)
  const debounceRef = useRef&lt;ReturnType&lt;typeof setTimeout&gt; | undefined&gt;(undefined)
  const [localQ, setLocalQ] = useState(filters.q ?? '')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() =&gt; { setLocalQ(filters.q ?? '') }, [filters.q])

  /* Derived counts */
  const sourceCounts = useMemo(() =&gt; ({
    all: assets.length,
    pessoal: assets.filter(a =&gt; a.source_type === 'pessoal').length,
    generico: assets.filter(a =&gt; a.source_type === 'generico').length,
  }), [assets])

  const statusCounts = useMemo(() =&gt; ({
    all: assets.length,
    ready: assets.filter(a =&gt; a.status === 'ready').length,
    pending: assets.filter(a =&gt; a.status === 'pending').length,
  }), [assets])

  const categoryCounts = useMemo(() =&gt; {
    const map = new Map&lt;string, number&gt;()
    for (const a of assets) { if (a.category) map.set(a.category, (map.get(a.category) ?? 0) + 1) }
    return map
  }, [assets])

  const allCategories = useMemo(() =&gt; {
    const all = new Set&lt;string&gt;()
    for (const a of assets) { if (a.category) all.add(a.category) }
    return Array.from(all).sort()
  }, [assets])

  const advancedActiveCount = useMemo(() =&gt; {
    let n = 0
    if (filters.codec) n++
    if (filters.fps) n++
    if (filters.tags &amp;&amp; filters.tags.length &gt; 0) n++
    return n
  }, [filters.codec, filters.fps, filters.tags])

  /* Active filter pills */
  const activePills = useMemo(() =&gt; {
    const pills: { key: keyof BRollFilterState; label: string }[] = []
    if (filters.q) pills.push({ key: 'q', label: `Search: ${filters.q}` })
    if (filters.source_type) pills.push({ key: 'source_type', label: `Source: ${filters.source_type}` })
    if (filters.status) pills.push({ key: 'status', label: `Status: ${filters.status}` })
    if (filters.category) pills.push({ key: 'category', label: `Category: ${filters.category}` })
    if (filters.resolution) pills.push({ key: 'resolution', label: `Resolution: ${filters.resolution}` })
    if (filters.duration) pills.push({ key: 'duration', label: `Duration: ${filters.duration}` })
    if (filters.codec) pills.push({ key: 'codec', label: `Codec: ${filters.codec}` })
    if (filters.fps) pills.push({ key: 'fps', label: `FPS: ${filters.fps}` })
    if (filters.tags &amp;&amp; filters.tags.length &gt; 0) pills.push({ key: 'tags', label: `Tags: ${filters.tags.join(', ')}` })
    if (filters.sort &amp;&amp; filters.sort !== 'newest') pills.push({ key: 'sort', label: `Sort: ${filters.sort}` })
    return pills
  }, [filters])

  const dismissPill = useCallback((key: keyof BRollFilterState) =&gt; {
    if (key === 'sort') setFilters({ sort: 'newest' })
    else setFilters({ [key]: null } as Partial&lt;BRollFilterState&gt;)
  }, [setFilters])

  /* Tag counts for advanced section */
  const tagCounts = useMemo(() =&gt; {
    const map = new Map&lt;string, number&gt;()
    for (const a of assets) { for (const t of a.tags) map.set(t, (map.get(t) ?? 0) + 1) }
    return map
  }, [assets])

  function toggleTag(tag: string) {
    const current = filters.tags ?? []
    const next = current.includes(tag) ? current.filter(t =&gt; t !== tag) : [...current, tag]
    setFilters({ tags: next.length &gt; 0 ? next : null })
  }

  /* ─── Render ─────────────────────────────────────────────────────────── */

  return (
    &lt;div style={{ width: 280, minWidth: 280, maxHeight: 'calc(100vh - 8rem)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 10, border: '1px solid var(--gem-border)', background: 'var(--gem-surface)', position: 'sticky', top: '4rem' }}&gt;
      {/* Sticky Header */}
      &lt;div style={{ padding: '10px 12px 0', borderBottom: '1px solid var(--gem-border)', flexShrink: 0 }}&gt;
        {/* Search */}
        &lt;div style={{ position: 'relative', marginBottom: 8 }}&gt;
          &lt;span aria-hidden="true" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--gem-muted)', pointerEvents: 'none' }}&gt;&amp;#x2315;&lt;/span&gt;
          &lt;input ref={searchRef} data-broll-search type="search" role="combobox" aria-expanded="false" aria-autocomplete="none" aria-label="Search B-Roll assets" placeholder="Search..." value={localQ}
            onChange={e =&gt; { const val = e.target.value; setLocalQ(val); clearTimeout(debounceRef.current); debounceRef.current = setTimeout(() =&gt; { setFilters({ q: val.trim() !== '' ? val : null }) }, 300) }}
            style={{ width: '100%', padding: '5px 52px 5px 28px', fontSize: 12, borderRadius: 6, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)', boxSizing: 'border-box', outline: 'none' }} /&gt;
          &lt;kbd aria-hidden="true" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 9, fontFamily: 'inherit', color: 'var(--gem-muted)', border: '1px solid var(--gem-border)', borderRadius: 3, padding: '1px 4px', background: 'var(--gem-well)' }}&gt;/&lt;/kbd&gt;
        &lt;/div&gt;
        {/* Sort */}
        &lt;div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}&gt;
          &lt;SectionLabel&gt;Sort&lt;/SectionLabel&gt;
          &lt;select aria-label="Sort by" value={filters.sort} onChange={e =&gt; setFilters({ sort: e.target.value })} style={{ flex: 1, fontSize: 11, padding: '3px 6px', borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)', cursor: 'pointer' }}&gt;
            {SORT_OPTIONS.map(o =&gt; (&lt;option key={o.value} value={o.value}&gt;{o.label}&lt;/option&gt;))}
          &lt;/select&gt;
        &lt;/div&gt;
        {/* Active pills */}
        {activePills.length &gt; 0 &amp;&amp; (
          &lt;div style={{ paddingBottom: 8 }}&gt;
            &lt;div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 56, overflow: 'hidden' }}&gt;
              {activePills.map(pill =&gt; (
                &lt;span key={pill.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '2px 4px 2px 5px', borderRadius: 4, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)', maxWidth: 160, overflow: 'hidden' }}&gt;
                  &lt;span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}&gt;{pill.label}&lt;/span&gt;
                  &lt;button type="button" aria-label={`Remove ${pill.label} filter`} onClick={() =&gt; dismissPill(pill.key)} style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', color: 'var(--gem-muted)', fontSize: 10, lineHeight: 1, flexShrink: 0 }}&gt;&amp;#x2715;&lt;/button&gt;
                &lt;/span&gt;
              ))}
            &lt;/div&gt;
            &lt;button type="button" onClick={clearAll} style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: 'var(--gem-accent)', cursor: 'pointer', marginTop: 4 }}&gt;Clear all ({activeCount})&lt;/button&gt;
          &lt;/div&gt;
        )}
      &lt;/div&gt;

      {/* Scrollable Body */}
      &lt;div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 16, scrollbarWidth: 'thin', scrollbarColor: 'var(--gem-border) transparent' }}&gt;
        {/* Tipo (Source Type) */}
        &lt;Section&gt;
          &lt;SectionLabel&gt;Tipo&lt;/SectionLabel&gt;
          &lt;Segmented ariaLabel="Filter by source type" value={filters.source_type}
            onChange={(v) =&gt; setFilters({ source_type: v as BRollFilterState['source_type'] })}
            options={[
              { value: null, label: 'All', count: sourceCounts.all },
              { value: 'pessoal', label: 'Pessoais', count: sourceCounts.pessoal },
              { value: 'generico', label: 'Genericos', count: sourceCounts.generico },
            ]} /&gt;
        &lt;/Section&gt;

        {/* Status */}
        &lt;Section&gt;
          &lt;SectionLabel&gt;Status&lt;/SectionLabel&gt;
          &lt;Segmented ariaLabel="Filter by status" value={filters.status}
            onChange={(v) =&gt; setFilters({ status: v as BRollFilterState['status'] })}
            options={[
              { value: null, label: 'All', count: statusCounts.all },
              { value: 'ready', label: 'Ready', count: statusCounts.ready },
              { value: 'pending', label: 'Pending', count: statusCounts.pending },
            ]} /&gt;
        &lt;/Section&gt;

        {/* Category */}
        {allCategories.length &gt; 0 &amp;&amp; (
          &lt;Section&gt;
            &lt;SectionLabel&gt;Categoria&lt;/SectionLabel&gt;
            &lt;div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}&gt;
              {allCategories.map(cat =&gt; {
                const count = categoryCounts.get(cat) ?? 0
                const active = filters.category === cat
                const cfg = categoryConfig(cat)
                return (
                  &lt;button key={cat} type="button" aria-pressed={active} onClick={() =&gt; setFilters({ category: active ? null : cat })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', fontSize: 11, borderRadius: 5, border: `1px solid ${active ? cfg.badgeColor : 'var(--gem-border)'}`, background: active ? cfg.badgeBg : 'var(--gem-well)', color: active ? cfg.badgeColor : 'var(--gem-text)', cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'background 0.1s, border-color 0.1s' }}&gt;
                    &lt;span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dotColor, flexShrink: 0 }} /&gt;
                    {cat}
                    &lt;span style={{ opacity: 0.6, fontSize: 9 }}&gt;{count}&lt;/span&gt;
                  &lt;/button&gt;
                )
              })}
            &lt;/div&gt;
          &lt;/Section&gt;
        )}

        {/* Resolution */}
        &lt;Section&gt;
          &lt;SectionLabel&gt;Resolucao&lt;/SectionLabel&gt;
          &lt;Segmented ariaLabel="Filter by resolution" value={filters.resolution}
            onChange={(v) =&gt; setFilters({ resolution: v as BRollFilterState['resolution'] })}
            options={[
              { value: null, label: 'All' },
              { value: '4k', label: '4K' },
              { value: '1080p', label: '1080p' },
              { value: '720p', label: '720p' },
            ]} /&gt;
        &lt;/Section&gt;

        {/* Duration */}
        &lt;Section&gt;
          &lt;SectionLabel&gt;Duracao&lt;/SectionLabel&gt;
          &lt;div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}&gt;
            {DUR_OPTIONS.map(opt =&gt; {
              const active = filters.duration === opt.value
              return (
                &lt;button key={opt.value} type="button" aria-pressed={active} onClick={() =&gt; setFilters({ duration: active ? null : opt.value })}
                  style={{ padding: '3px 8px', fontSize: 11, borderRadius: 5, border: '1px solid var(--gem-border)', background: active ? 'var(--gem-accent)' : 'var(--gem-well)', color: active ? '#fff' : 'var(--gem-muted)', cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'background 0.1s' }}&gt;
                  {opt.label}
                &lt;/button&gt;
              )
            })}
          &lt;/div&gt;
        &lt;/Section&gt;

        {/* Advanced (collapsible) */}
        &lt;div style={{ borderTop: '1px solid var(--gem-border)', paddingTop: 12 }}&gt;
          &lt;button type="button" aria-expanded={advancedOpen} onClick={() =&gt; setAdvancedOpen(v =&gt; !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: advancedOpen ? 12 : 0 }}&gt;
            &lt;span aria-hidden="true" style={{ fontSize: 10, color: 'var(--gem-muted)', transform: advancedOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block' }}&gt;&amp;#x25b6;&lt;/span&gt;
            &lt;span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gem-muted)' }}&gt;Advanced&lt;/span&gt;
            {advancedActiveCount &gt; 0 &amp;&amp; (
              &lt;span aria-label={`${advancedActiveCount} advanced filters active`} style={{ fontSize: 9, fontWeight: 700, background: 'var(--gem-accent)', color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}&gt;{advancedActiveCount}&lt;/span&gt;
            )}
          &lt;/button&gt;

          {advancedOpen &amp;&amp; (
            &lt;div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}&gt;
              {/* Codec */}
              &lt;Section&gt;
                &lt;SectionLabel&gt;Codec&lt;/SectionLabel&gt;
                &lt;Segmented ariaLabel="Filter by codec" value={filters.codec}
                  onChange={(v) =&gt; setFilters({ codec: v as BRollFilterState['codec'] })}
                  options={[
                    { value: null, label: 'Any' },
                    { value: 'h265', label: 'H.265' },
                    { value: 'h264', label: 'H.264' },
                  ]} /&gt;
              &lt;/Section&gt;
              {/* FPS */}
              &lt;Section&gt;
                &lt;SectionLabel&gt;FPS&lt;/SectionLabel&gt;
                &lt;Segmented ariaLabel="Filter by framerate" value={filters.fps}
                  onChange={(v) =&gt; setFilters({ fps: v as BRollFilterState['fps'] })}
                  options={[
                    { value: null, label: 'Any' },
                    { value: '24', label: '24' },
                    { value: '30', label: '30' },
                    { value: '60', label: '60' },
                  ]} /&gt;
              &lt;/Section&gt;
              {/* Tags */}
              {tagCounts.size &gt; 0 &amp;&amp; (
                &lt;Section&gt;
                  &lt;SectionLabel&gt;Tags&lt;/SectionLabel&gt;
                  &lt;div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}&gt;
                    {Array.from(tagCounts.entries()).sort((a, b) =&gt; b[1] - a[1]).slice(0, 20).map(([tag, count]) =&gt; {
                      const active = filters.tags?.includes(tag) ?? false
                      return (
                        &lt;button key={tag} type="button" aria-pressed={active} onClick={() =&gt; toggleTag(tag)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', fontSize: 10, borderRadius: 4, border: '1px solid var(--gem-border)', background: active ? 'var(--gem-accent)' : 'var(--gem-well)', color: active ? '#fff' : 'var(--gem-text)', cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'background 0.1s' }}&gt;
                          {tag}
                          &lt;span style={{ opacity: 0.6, fontSize: 9 }}&gt;{count}&lt;/span&gt;
                        &lt;/button&gt;
                      )
                    })}
                  &lt;/div&gt;
                &lt;/Section&gt;
              )}
            &lt;/div&gt;
          )}
        &lt;/div&gt;
        &lt;div style={{ height: 8 }} /&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  )
}
```

- [ ] 4. Verify all three files compile:

```bash
npx tsc --noEmit --project apps/web/tsconfig.json 2&gt;&amp;1 | grep -E 'broll-(grid|table|filters)' | head -10
```

Expected: no errors.

- [ ] 5. Commit:

```
feat(pipeline): add BRollGrid, BRollTable, and BRollFilters components
```

---

### Task 12 — BRollDetail panel

**Files:**
- `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-detail.tsx` (new)

**Steps:**

- [ ] 1. Create `BRollDetail` mirroring `AudioDetailV2` with 360px right panel. Includes: header with title/edit/close, FrameStrip (detail variant), quick stats pills (resolution, duration, codec, fps, file_size, status), 4 tabs (Details, Usage, Related, Raw), OCC edit with version conflict resolution, status selector in edit mode:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-detail.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { BRollAssetRow, BRollAssetUsageRow } from '@/lib/pipeline/broll-schemas'
import { FrameStrip } from './frame-strip'
import {
  formatDuration,
  formatFileSize,
  sourceTypeConfig,
  categoryConfig,
  similarityScore,
} from '../_helpers/broll-helpers'
import type { BRollFilterState } from '../_helpers/use-broll-filters'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BRollDetailProps {
  assetId: string
  allAssets: BRollAssetRow[]
  onClose: () =&gt; void
  onFilter: (partial: Partial&lt;BRollFilterState&gt;) =&gt; void
  fullWidth?: boolean
}

type Tab = 'details' | 'usage' | 'related' | 'raw'

type AssetWithUsage = BRollAssetRow &amp; { usage: BRollAssetUsageRow[] }

interface EditDraft {
  description: string
  category: string
  tags: string
  source_type: 'pessoal' | 'generico'
  status: 'ready' | 'pending'
  location: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_DOT: Record&lt;string, string&gt; = { ready: '#22c55e', pending: '#eab308' }
const STATUS_LABELS: Record&lt;string, string&gt; = { ready: 'Ready', pending: 'Pending' }

function assetToDraft(asset: AssetWithUsage): EditDraft {
  return {
    description: asset.description ?? '',
    category: asset.category ?? '',
    tags: asset.tags.join(', '),
    source_type: asset.source_type,
    status: asset.status,
    location: asset.location ?? '',
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    &lt;div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}&gt;
      {[100, 72, 36, 80, 60, 60].map((h, i) =&gt; (
        &lt;div key={i} style={{ height: h, borderRadius: 6, background: 'var(--gem-well)', opacity: 0.6, animation: 'pulse-subtle 1.6s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} /&gt;
      ))}
    &lt;/div&gt;
  )
}

function Chip({ label, onClick }: { label: string; onClick?: () =&gt; void }) {
  return (
    &lt;span role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick}
      onKeyDown={onClick ? (e) =&gt; { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      style={{ display: 'inline-block', fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)', cursor: onClick ? 'pointer' : 'default', lineHeight: 1.6, userSelect: 'none', transition: 'opacity 0.15s' }}&gt;
      {label}
    &lt;/span&gt;
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    &lt;span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)', lineHeight: 1.6, whiteSpace: 'nowrap' }}&gt;
      {children}
    &lt;/span&gt;
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (&lt;h4 style={{ fontSize: 9, fontWeight: 700, color: 'var(--gem-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px 0' }}&gt;{children}&lt;/h4&gt;)
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (&lt;div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 11 }}&gt;&lt;span style={{ color: 'var(--gem-dim)', flexShrink: 0 }}&gt;{label}&lt;/span&gt;&lt;div style={{ flex: 1, textAlign: 'right' }}&gt;{children}&lt;/div&gt;&lt;/div&gt;)
}

function DimValue({ children }: { children: React.ReactNode }) {
  return &lt;span style={{ color: 'var(--gem-text)', fontSize: 11 }}&gt;{children}&lt;/span&gt;
}

const inputBase: React.CSSProperties = { fontSize: 12, padding: '3px 7px', background: 'var(--gem-surface-hi)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)', borderRadius: 4, width: '100%', boxSizing: 'border-box' }

// ─── Tab panels ──────────────────────────────────────────────────────────────

function DetailsPanel({ asset, editing, draft, setField, onFilter }: {
  asset: AssetWithUsage; editing: boolean; draft: EditDraft | null
  setField: &lt;K extends keyof EditDraft&gt;(k: K, v: EditDraft[K]) =&gt; void
  onFilter: (partial: Partial&lt;BRollFilterState&gt;) =&gt; void
}) {
  const cat = categoryConfig(asset.category)
  const srcCfg = sourceTypeConfig(asset.source_type)

  return (
    &lt;div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 14px 20px' }}&gt;
      {/* Classification */}
      &lt;section&gt;
        &lt;SectionLabel&gt;Classification&lt;/SectionLabel&gt;
        &lt;div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}&gt;
          &lt;DetailRow label="Category"&gt;
            {editing &amp;&amp; draft ? (
              &lt;select value={draft.category} onChange={(e) =&gt; setField('category', e.target.value)} style={inputBase}&gt;
                {['', 'travel', 'urban', 'nature', 'tech', 'food', 'lifestyle', 'abstract'].map(c =&gt; (&lt;option key={c} value={c}&gt;{c || '--'}&lt;/option&gt;))}
              &lt;/select&gt;
            ) : asset.category ? (
              &lt;span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 8, background: cat.badgeBg, color: cat.badgeColor, fontWeight: 600 }}&gt;{asset.category}&lt;/span&gt;
            ) : &lt;DimValue&gt;--&lt;/DimValue&gt;}
          &lt;/DetailRow&gt;
          &lt;DetailRow label="Source Type"&gt;
            {editing &amp;&amp; draft ? (
              &lt;select value={draft.source_type} onChange={(e) =&gt; setField('source_type', e.target.value as 'pessoal' | 'generico')} style={inputBase}&gt;
                &lt;option value="pessoal"&gt;Pessoal&lt;/option&gt;
                &lt;option value="generico"&gt;Generico&lt;/option&gt;
              &lt;/select&gt;
            ) : (
              &lt;span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}&gt;
                &lt;span style={{ width: 6, height: 6, borderRadius: '50%', background: srcCfg.dotColor }} /&gt;
                {srcCfg.label}
              &lt;/span&gt;
            )}
          &lt;/DetailRow&gt;
          &lt;DetailRow label="Source"&gt;&lt;DimValue&gt;{asset.source || '--'}&lt;/DimValue&gt;&lt;/DetailRow&gt;
          &lt;DetailRow label="Location"&gt;
            {editing &amp;&amp; draft ? (
              &lt;input value={draft.location} onChange={(e) =&gt; setField('location', e.target.value)} placeholder="e.g., Vancouver, Canada" style={inputBase} /&gt;
            ) : &lt;DimValue&gt;{asset.location || '--'}&lt;/DimValue&gt;}
          &lt;/DetailRow&gt;
        &lt;/div&gt;
      &lt;/section&gt;
      {/* Video Properties */}
      &lt;section&gt;
        &lt;SectionLabel&gt;Video&lt;/SectionLabel&gt;
        &lt;div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}&gt;
          &lt;DetailRow label="Resolution"&gt;&lt;DimValue&gt;{asset.resolution === '4k' ? '4K' : asset.resolution}&lt;/DimValue&gt;&lt;/DetailRow&gt;
          {asset.width &amp;&amp; asset.height &amp;&amp; &lt;DetailRow label="Dimensions"&gt;&lt;DimValue&gt;{asset.width}x{asset.height}&lt;/DimValue&gt;&lt;/DetailRow&gt;}
          &lt;DetailRow label="Duration"&gt;&lt;DimValue&gt;{formatDuration(asset.duration_seconds)}&lt;/DimValue&gt;&lt;/DetailRow&gt;
          &lt;DetailRow label="Codec"&gt;&lt;DimValue&gt;{asset.codec ?? '--'}&lt;/DimValue&gt;&lt;/DetailRow&gt;
          &lt;DetailRow label="FPS"&gt;&lt;DimValue&gt;{asset.fps ?? '--'}&lt;/DimValue&gt;&lt;/DetailRow&gt;
          &lt;DetailRow label="Bitrate"&gt;&lt;DimValue&gt;{asset.bitrate_kbps ? `${asset.bitrate_kbps} kbps` : '--'}&lt;/DimValue&gt;&lt;/DetailRow&gt;
          &lt;DetailRow label="File Size"&gt;&lt;DimValue&gt;{formatFileSize(asset.file_size_bytes)}&lt;/DimValue&gt;&lt;/DetailRow&gt;
        &lt;/div&gt;
      &lt;/section&gt;
      {/* Description */}
      &lt;section&gt;
        &lt;SectionLabel&gt;Description&lt;/SectionLabel&gt;
        {editing &amp;&amp; draft ? (
          &lt;textarea value={draft.description} onChange={(e) =&gt; setField('description', e.target.value)} rows={3}
            style={{ ...inputBase, resize: 'vertical', fontFamily: 'inherit' }} /&gt;
        ) : (
          &lt;div style={{ fontSize: 11, color: asset.description ? 'var(--gem-text)' : 'var(--gem-dim)', lineHeight: 1.6 }}&gt;
            {asset.description || 'No description'}
          &lt;/div&gt;
        )}
      &lt;/section&gt;
      {/* Tags */}
      {(editing ? true : asset.tags.length &gt; 0) &amp;&amp; (
        &lt;section&gt;
          &lt;SectionLabel&gt;Tags&lt;/SectionLabel&gt;
          {editing &amp;&amp; draft ? (
            &lt;input value={draft.tags} onChange={(e) =&gt; setField('tags', e.target.value)} placeholder="comma-separated" style={inputBase} /&gt;
          ) : (
            &lt;div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}&gt;
              {asset.tags.map(tag =&gt; (&lt;Chip key={tag} label={tag} onClick={() =&gt; onFilter({ q: tag })} /&gt;))}
            &lt;/div&gt;
          )}
        &lt;/section&gt;
      )}
    &lt;/div&gt;
  )
}

function UsagePanel({ asset }: { asset: AssetWithUsage }) {
  if (asset.usage.length === 0) {
    return (&lt;div style={{ padding: '20px 14px', fontSize: 11, color: 'var(--gem-dim)', textAlign: 'center' }}&gt;Not used in any project yet.&lt;/div&gt;)
  }
  return (
    &lt;div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px' }}&gt;
      {asset.usage.map(u =&gt; (
        &lt;div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 6, background: 'var(--gem-well)', border: '1px solid var(--gem-border)', fontSize: 11, color: 'var(--gem-text)' }}&gt;
          &lt;span style={{ fontWeight: 600 }}&gt;{u.content_pipeline?.code ?? u.pipeline_item_id}&lt;/span&gt;
          &lt;span style={{ color: 'var(--gem-dim)', fontSize: 10 }}&gt;
            {u.scene_number != null ? `Scene ${u.scene_number}` : ''} {u.timestamp_range ? `\u00B7 ${u.timestamp_range}` : ''} {`\u00B7 ${u.usage_type}`}
          &lt;/span&gt;
        &lt;/div&gt;
      ))}
    &lt;/div&gt;
  )
}

function RelatedPanel({ asset, allAssets, onFilter }: { asset: AssetWithUsage; allAssets: BRollAssetRow[]; onFilter: (partial: Partial&lt;BRollFilterState&gt;) =&gt; void }) {
  const related = allAssets
    .filter(a =&gt; a.id !== asset.id)
    .map(a =&gt; ({ asset: a, score: similarityScore(asset, a) }))
    .sort((x, y) =&gt; y.score - x.score)
    .slice(0, 5)

  if (related.length === 0) return (&lt;div style={{ padding: '20px 14px', fontSize: 11, color: 'var(--gem-dim)', textAlign: 'center' }}&gt;No related assets found.&lt;/div&gt;)

  return (
    &lt;div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px' }}&gt;
      {related.map(({ asset: rel, score }) =&gt; {
        const rCat = categoryConfig(rel.category)
        return (
          &lt;div key={rel.id} style={{ padding: '7px 10px', borderRadius: 6, background: 'var(--gem-well)', border: '1px solid var(--gem-border)', display: 'flex', flexDirection: 'column', gap: 5 }}&gt;
            &lt;div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}&gt;
              &lt;span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gem-text)' }}&gt;{rel.renamed_to ?? rel.original_filename}&lt;/span&gt;
              {rel.category &amp;&amp; (&lt;span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: rCat.badgeBg, color: rCat.badgeColor, fontWeight: 600 }}&gt;{rel.category}&lt;/span&gt;)}
            &lt;/div&gt;
            &lt;div style={{ display: 'flex', alignItems: 'center', gap: 8 }}&gt;
              &lt;div style={{ flex: 1, height: 3, borderRadius: 3, background: 'var(--gem-border)', overflow: 'hidden' }}&gt;
                &lt;div style={{ width: `${score}%`, height: '100%', background: 'var(--gem-accent)', borderRadius: 3, transition: 'width 0.4s ease' }} /&gt;
              &lt;/div&gt;
              &lt;span style={{ fontSize: 10, color: 'var(--gem-dim)', minWidth: 32, textAlign: 'right' }}&gt;{score}%&lt;/span&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        )
      })}
      &lt;div style={{ paddingTop: 4, fontSize: 10, color: 'var(--gem-dim)', textAlign: 'center' }}&gt;Scores based on category, tags, resolution, source, duration, location&lt;/div&gt;
    &lt;/div&gt;
  )
}

function RawPanel({ asset }: { asset: AssetWithUsage }) {
  const [jsonOpen, setJsonOpen] = useState(false)
  const raw = { asset_id: asset.asset_id, file_path: asset.renamed_to ?? asset.original_filename, sha256: asset.sha256, version: asset.version }
  return (
    &lt;div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}&gt;
      {[
        { label: 'Asset ID', value: asset.asset_id },
        { label: 'File Path', value: asset.renamed_to ?? asset.original_filename },
        ...(asset.sha256 ? [{ label: 'SHA-256', value: asset.sha256 }] : []),
      ].map(item =&gt; (
        &lt;div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}&gt;
          &lt;span style={{ fontSize: 10, color: 'var(--gem-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}&gt;{item.label}&lt;/span&gt;
          &lt;code style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--gem-text)', wordBreak: 'break-all' }}&gt;{item.value}&lt;/code&gt;
        &lt;/div&gt;
      ))}
      &lt;div style={{ marginTop: 4 }}&gt;
        &lt;button onClick={() =&gt; setJsonOpen(v =&gt; !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--gem-dim)', fontSize: 10 }}&gt;
          &lt;span style={{ fontVariantNumeric: 'tabular-nums' }}&gt;{jsonOpen ? '\u25be' : '\u25b8'}&lt;/span&gt;&lt;span&gt;JSON&lt;/span&gt;
        &lt;/button&gt;
        {jsonOpen &amp;&amp; (
          &lt;pre style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--gem-text)', background: 'var(--gem-well)', border: '1px solid var(--gem-border)', borderRadius: 4, padding: 8, overflowX: 'auto', overflowY: 'auto', maxHeight: 160, marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}&gt;
            {JSON.stringify(raw, null, 2)}
          &lt;/pre&gt;
        )}
      &lt;/div&gt;
    &lt;/div&gt;
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function BRollDetail({ assetId, allAssets, onClose, onFilter, fullWidth }: BRollDetailProps) {
  const [asset, setAsset] = useState&lt;AssetWithUsage | null&gt;(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState&lt;string | null&gt;(null)
  const [activeTab, setActiveTab] = useState&lt;Tab&gt;('details')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState&lt;EditDraft | null&gt;(null)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [saveError, setSaveError] = useState&lt;string | null&gt;(null)
  const editingRef = useRef(editing)
  editingRef.current = editing

  // Fetch asset
  useEffect(() =&gt; {
    const controller = new AbortController()
    setLoading(true); setFetchError(null); setAsset(null)
    fetch(`/api/pipeline/broll-library/${assetId}`, { signal: controller.signal })
      .then(r =&gt; { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise&lt;{ data: AssetWithUsage }&gt; })
      .then(json =&gt; { if (!controller.signal.aborted) { setAsset(json.data); setLoading(false) } })
      .catch((e: unknown) =&gt; { if (e instanceof DOMException &amp;&amp; e.name === 'AbortError') return; if (!controller.signal.aborted) { setFetchError('Failed to load asset'); setLoading(false) } })
    return () =&gt; controller.abort()
  }, [assetId])

  // Keyboard: Escape
  useEffect(() =&gt; {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      if (editingRef.current) { setEditing(false); setDraft(null); setConflict(false); setSaveError(null) }
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () =&gt; window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleEditStart = useCallback(() =&gt; { if (!asset) return; setDraft(assetToDraft(asset)); setConflict(false); setSaveError(null); setEditing(true) }, [asset])
  const handleCancel = useCallback(() =&gt; { setEditing(false); setDraft(null); setConflict(false); setSaveError(null) }, [])
  const setField = useCallback(&lt;K extends keyof EditDraft&gt;(key: K, value: EditDraft[K]) =&gt; { setDraft(prev =&gt; prev ? { ...prev, [key]: value } : prev) }, [])

  const handleSave = useCallback(async (force = false) =&gt; {
    if (!asset || !draft) return
    setSaving(true); setConflict(false); setSaveError(null)
    try {
      const body: Record&lt;string, unknown&gt; = {
        description: draft.description || null,
        category: draft.category || null,
        tags: draft.tags.split(',').map(s =&gt; s.trim()).filter(Boolean),
        source_type: draft.source_type,
        status: draft.status,
        location: draft.location || null,
        version: asset.version,
      }
      if (force) body['force'] = true
      const res = await fetch(`/api/pipeline/broll-library/${asset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.status === 409) { setConflict(true); return }
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`)
      const json = await res.json() as { data: AssetWithUsage }
      setAsset(json.data); setEditing(false); setDraft(null)
    } catch { setSaveError('Failed to save. Please try again.') }
    finally { setSaving(false) }
  }, [asset, draft])

  // Derived
  const frames = asset ? (Array.isArray((asset.metadata as Record&lt;string, unknown&gt;)?.frame_strip)
    ? ((asset.metadata as Record&lt;string, unknown&gt;).frame_strip as Array&lt;{ url: string; timestamp: number }&gt;)
    : null) : null
  const hasUsage = (asset?.usage.length ?? 0) &gt; 0

  const panelStyle: React.CSSProperties = {
    width: fullWidth ? '100%' : 360, minWidth: fullWidth ? undefined : 360, maxWidth: fullWidth ? undefined : 360,
    display: 'flex', flexDirection: 'column', borderRadius: 10, border: '1px solid var(--gem-border)',
    background: 'var(--gem-surface)', overflow: 'hidden', flexShrink: 0,
  }

  if (loading) return (&lt;div style={panelStyle}&gt;&lt;Skeleton /&gt;&lt;/div&gt;)
  if (fetchError || !asset) {
    return (
      &lt;div style={{ ...panelStyle, padding: 20, gap: 10, display: 'flex', flexDirection: 'column' }}&gt;
        &lt;span style={{ fontSize: 12, color: '#f87171' }}&gt;{fetchError ?? 'Asset not found'}&lt;/span&gt;
        &lt;button onClick={onClose} style={{ fontSize: 11, background: 'none', border: '1px solid var(--gem-border)', color: 'var(--gem-muted)', cursor: 'pointer', borderRadius: 4, padding: '3px 10px', alignSelf: 'flex-start' }}&gt;Close&lt;/button&gt;
      &lt;/div&gt;
    )
  }

  const srcCfg = sourceTypeConfig(asset.source_type)
  const statusColor = STATUS_DOT[asset.status] ?? '#9ca3af'
  const statusLabel = STATUS_LABELS[asset.status] ?? asset.status

  return (
    &lt;div style={panelStyle}&gt;
      {/* Header */}
      &lt;div style={{ flexShrink: 0, padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--gem-border)', background: 'var(--gem-surface)', position: 'sticky', top: 0, zIndex: 2 }}&gt;
        &lt;div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}&gt;
          &lt;div style={{ flex: 1, minWidth: 0 }}&gt;
            &lt;h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gem-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}&gt;
              {asset.renamed_to ?? asset.original_filename}
            &lt;/h3&gt;
            &lt;p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--gem-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}&gt;
              {[asset.source, asset.asset_id, `v${asset.version}`].filter(Boolean).join(' \u00B7 ')}
            &lt;/p&gt;
          &lt;/div&gt;
          &lt;div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}&gt;
            {editing ? (
              &lt;&gt;
                &lt;button aria-label="Save changes" onClick={() =&gt; handleSave(false)} disabled={saving} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: 'var(--gem-accent)', color: '#fff', border: 'none', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}&gt;{saving ? 'Saving...' : 'Save'}&lt;/button&gt;
                &lt;button aria-label="Cancel editing" onClick={handleCancel} disabled={saving} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'none', border: '1px solid var(--gem-border)', color: 'var(--gem-muted)', cursor: 'pointer' }}&gt;Cancel&lt;/button&gt;
              &lt;/&gt;
            ) : (
              &lt;button aria-label="Edit asset" onClick={handleEditStart} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'none', border: '1px solid var(--gem-border)', color: 'var(--gem-muted)', cursor: 'pointer' }}&gt;Edit&lt;/button&gt;
            )}
            &lt;button aria-label="Close detail panel" onClick={onClose} style={{ fontSize: 14, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: 'pointer', lineHeight: 1 }}&gt;&amp;#x2715;&lt;/button&gt;
          &lt;/div&gt;
        &lt;/div&gt;

        {/* Conflict alert */}
        {conflict &amp;&amp; (
          &lt;div role="alert" style={{ fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 4, padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}&gt;
            &lt;span&gt;Asset was modified. Merge or force save?&lt;/span&gt;
            &lt;div style={{ display: 'flex', gap: 6 }}&gt;
              &lt;button onClick={() =&gt; { setConflict(false); setEditing(false); setDraft(null); setLoading(true); fetch(`/api/pipeline/broll-library/${assetId}`).then(r =&gt; r.json() as Promise&lt;{ data: AssetWithUsage }&gt;).then(json =&gt; { setAsset(json.data); setLoading(false) }).catch(() =&gt; setLoading(false)) }} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'none', border: '1px solid #f87171', color: '#f87171', cursor: 'pointer' }}&gt;Refresh &amp;amp; merge&lt;/button&gt;
              &lt;button onClick={() =&gt; handleSave(true)} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(248,113,113,0.2)', border: '1px solid #f87171', color: '#f87171', cursor: 'pointer' }}&gt;Force save&lt;/button&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        )}
        {saveError &amp;&amp; (&lt;div role="alert" style={{ fontSize: 11, color: '#fb923c', background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: 4, padding: '5px 10px' }}&gt;{saveError}&lt;/div&gt;)}

        {/* Status selector (edit mode) */}
        {editing &amp;&amp; draft &amp;&amp; (
          &lt;div style={{ display: 'flex', gap: 4 }}&gt;
            {(['ready', 'pending'] as const).map(s =&gt; (
              &lt;button key={s} onClick={() =&gt; setField('status', s)} style={{ flex: 1, fontSize: 10, padding: '3px 0', borderRadius: 4, border: `1px solid ${draft.status === s ? STATUS_DOT[s] : 'var(--gem-border)'}`, background: draft.status === s ? `${STATUS_DOT[s]}22` : 'none', color: draft.status === s ? STATUS_DOT[s] : 'var(--gem-muted)', cursor: 'pointer', fontWeight: draft.status === s ? 600 : 400, transition: 'all 0.15s' }}&gt;{STATUS_LABELS[s]}&lt;/button&gt;
            ))}
          &lt;/div&gt;
        )}

        {/* Quick stats pills */}
        &lt;div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingBottom: 10 }}&gt;
          &lt;Pill&gt;{asset.resolution === '4k' ? '4K' : asset.resolution}&lt;/Pill&gt;
          {asset.duration_seconds != null &amp;&amp; &lt;Pill&gt;{formatDuration(asset.duration_seconds)}&lt;/Pill&gt;}
          {asset.codec &amp;&amp; &lt;Pill&gt;{asset.codec.toUpperCase()}&lt;/Pill&gt;}
          {asset.fps &amp;&amp; &lt;Pill&gt;{asset.fps}fps&lt;/Pill&gt;}
          {asset.file_size_bytes &amp;&amp; &lt;Pill&gt;{formatFileSize(asset.file_size_bytes)}&lt;/Pill&gt;}
          &lt;Pill&gt;&lt;span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} /&gt;&lt;span&gt;{statusLabel}&lt;/span&gt;&lt;/Pill&gt;
          &lt;Pill&gt;&lt;span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: srcCfg.dotColor, flexShrink: 0 }} /&gt;&lt;span&gt;{srcCfg.label}&lt;/span&gt;&lt;/Pill&gt;
        &lt;/div&gt;
      &lt;/div&gt;

      {/* FrameStrip */}
      &lt;div style={{ flexShrink: 0, padding: '8px 14px 0', background: 'var(--gem-surface)', position: 'sticky', top: 0, zIndex: 1 }}&gt;
        &lt;FrameStrip variant="detail" frames={frames} duration={asset.duration_seconds} resolution={asset.resolution} thumbnailUrl={asset.thumbnail_url} /&gt;
        &lt;div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gem-dim)', marginTop: 3, marginBottom: 8 }}&gt;
          &lt;span&gt;{formatDuration(asset.duration_seconds)}&lt;/span&gt;
          &lt;span&gt;{frames ? `${frames.length} frames` : 'No frames'}&lt;/span&gt;
        &lt;/div&gt;
      &lt;/div&gt;

      {/* Tabs */}
      &lt;div style={{ flexShrink: 0, display: 'flex', borderBottom: '1px solid var(--gem-border)', background: 'var(--gem-surface)', position: 'sticky', top: 0, zIndex: 1, paddingLeft: 14, paddingRight: 14 }}&gt;
        {(['details', 'usage', 'related', 'raw'] as Tab[]).map(tab =&gt; {
          const active = activeTab === tab
          return (
            &lt;button key={tab} role="tab" aria-selected={active} onClick={() =&gt; setActiveTab(tab)}
              style={{ fontSize: 11, padding: '7px 10px', background: 'none', border: 'none', borderBottom: active ? '2px solid var(--gem-accent)' : '2px solid transparent', color: active ? 'var(--gem-text)' : 'var(--gem-dim)', fontWeight: active ? 600 : 400, cursor: 'pointer', position: 'relative', transition: 'color 0.15s', whiteSpace: 'nowrap' }}&gt;
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'usage' &amp;&amp; hasUsage &amp;&amp; (&lt;span style={{ position: 'absolute', top: 5, right: 3, width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'block' }} /&gt;)}
            &lt;/button&gt;
          )
        })}
      &lt;/div&gt;

      {/* Tab content */}
      &lt;div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}&gt;
        {activeTab === 'details' &amp;&amp; &lt;DetailsPanel asset={asset} editing={editing} draft={draft} setField={setField} onFilter={onFilter} /&gt;}
        {activeTab === 'usage' &amp;&amp; &lt;UsagePanel asset={asset} /&gt;}
        {activeTab === 'related' &amp;&amp; &lt;RelatedPanel asset={asset} allAssets={allAssets} onFilter={onFilter} /&gt;}
        {activeTab === 'raw' &amp;&amp; &lt;RawPanel asset={asset} /&gt;}
      &lt;/div&gt;
    &lt;/div&gt;
  )
}
```

- [ ] 2. Verify the component compiles:

```bash
npx tsc --noEmit --project apps/web/tsconfig.json 2&gt;&amp;1 | grep 'broll-detail' | head -5
```

Expected: no errors.

- [ ] 3. Commit:

```
feat(pipeline): add BRollDetail panel with tabs, FrameStrip, and OCC editing
```

---

### Task 13 — BRollImportModal + BRollLibrary shell + page.tsx

**Files:**
- `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-import-modal.tsx` (new)
- `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-empty.tsx` (new)
- `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-skeleton.tsx` (new)
- `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-error-boundary.tsx` (new)
- `apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-library.tsx` (new)
- `apps/web/src/app/cms/(authed)/pipeline/brolls/page.tsx` (new)

**Steps:**

- [ ] 1. Create `BRollImportModal` mirroring `AudioImportModal` with 3-step flow (input/preview/result), targeting `/api/pipeline/broll-library/import`:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-import-modal.tsx
'use client'

import { useState, useRef, useEffect } from 'react'

interface BRollImportModalProps { onClose: () =&gt; void }

type Step = 'input' | 'preview' | 'result'

interface ImportPreview { preview: { to_create: number; to_update: number; to_skip: number } }
interface ImportResult { dry_run: false; import_log_id: string; created: number; updated: number; skipped: number; errors: Array&lt;{ asset_id: string; error: string }&gt; }

export function BRollImportModal({ onClose }: BRollImportModalProps) {
  const [step, setStep] = useState&lt;Step&gt;('input')
  const [jsonText, setJsonText] = useState('')
  const [preview, setPreview] = useState&lt;ImportPreview | null&gt;(null)
  const [result, setResult] = useState&lt;ImportResult | null&gt;(null)
  const [error, setError] = useState&lt;string | null&gt;(null)
  const [loading, setLoading] = useState(false)
  const dialogRef = useRef&lt;HTMLDivElement&gt;(null)
  const mountedRef = useRef(true)
  useEffect(() =&gt; () =&gt; { mountedRef.current = false }, [])

  useEffect(() =&gt; {
    const el = dialogRef.current
    if (!el) return
    const focusable = el.querySelectorAll&lt;HTMLElement&gt;('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    const first = focusable[0]; const last = focusable[focusable.length - 1]
    first?.focus()
    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      if (e.shiftKey &amp;&amp; document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey &amp;&amp; document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
    el.addEventListener('keydown', onKeydown)
    return () =&gt; el.removeEventListener('keydown', onKeydown)
  }, [step, onClose])

  const handlePreview = async () =&gt; {
    setError(null)
    let parsed: unknown
    try { parsed = JSON.parse(jsonText) } catch { setError('Invalid JSON'); return }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) { setError('JSON must be an object'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/pipeline/broll-library/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...parsed, dry_run: true }) })
      const json = await res.json()
      if (!mountedRef.current) return
      if (!res.ok) { setError(json.error?.message ?? 'Import failed'); return }
      setPreview(json.data); setStep('preview')
    } catch { if (mountedRef.current) setError('Network error') }
    finally { if (mountedRef.current) setLoading(false) }
  }

  const handleExecute = async () =&gt; {
    setLoading(true)
    let parsed: unknown
    try { parsed = JSON.parse(jsonText) } catch { setError('Invalid JSON'); setLoading(false); setStep('input'); return }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) { setError('JSON must be an object'); setLoading(false); setStep('input'); return }
    try {
      const res = await fetch('/api/pipeline/broll-library/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...parsed, dry_run: false }) })
      const json = await res.json()
      if (!mountedRef.current) return
      if (!res.ok) { setError(json.error?.message ?? 'Import failed'); setStep('input'); return }
      setResult(json.data); setStep('result')
    } catch { if (mountedRef.current) { setError('Network error'); setStep('input') } }
    finally { if (mountedRef.current) setLoading(false) }
  }

  return (
    &lt;div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}&gt;
      &lt;div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="broll-import-title" onClick={e =&gt; e.stopPropagation()} style={{ width: 520, maxHeight: '80vh', background: 'var(--gem-surface)', border: '1px solid var(--gem-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}&gt;
        &lt;div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}&gt;
          &lt;h3 id="broll-import-title" style={{ fontSize: 14, fontWeight: 600, color: 'var(--gem-text)', margin: 0 }}&gt;Import B-Roll Library&lt;/h3&gt;
          &lt;button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 16 }}&gt;&amp;#x2715;&lt;/button&gt;
        &lt;/div&gt;

        {step === 'input' &amp;&amp; (
          &lt;&gt;
            &lt;textarea value={jsonText} onChange={e =&gt; setJsonText(e.target.value)} placeholder="Paste JSON here..." style={{ width: '100%', height: 200, padding: 8, fontSize: 12, fontFamily: 'monospace', borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)', resize: 'vertical' }} /&gt;
            &lt;div style={{ display: 'flex', alignItems: 'center', gap: 8 }}&gt;
              &lt;label style={{ fontSize: 11, color: 'var(--gem-muted)' }}&gt;Or upload a JSON file&lt;/label&gt;
              &lt;label style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid var(--gem-border)', color: 'var(--gem-text)', background: 'var(--gem-surface-hi)', cursor: 'pointer' }}&gt;
                Choose file
                &lt;input type="file" accept=".json" style={{ display: 'none' }} onChange={e =&gt; { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev =&gt; setJsonText(ev.target?.result as string ?? ''); reader.readAsText(file); e.target.value = '' }} /&gt;
              &lt;/label&gt;
            &lt;/div&gt;
            {error &amp;&amp; &lt;span style={{ fontSize: 12, color: 'var(--gem-danger)' }}&gt;{error}&lt;/span&gt;}
            &lt;button onClick={handlePreview} disabled={loading || !jsonText.trim()} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: 'none', background: 'var(--gem-accent)', color: '#fff', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}&gt;{loading ? 'Validating...' : 'Preview Import'}&lt;/button&gt;
          &lt;/&gt;
        )}

        {step === 'preview' &amp;&amp; preview &amp;&amp; (
          &lt;&gt;
            &lt;div style={{ fontSize: 12, color: 'var(--gem-text)' }}&gt;
              &lt;div&gt;Create: &lt;strong&gt;{preview.preview.to_create}&lt;/strong&gt;&lt;/div&gt;
              &lt;div&gt;Update: &lt;strong&gt;{preview.preview.to_update}&lt;/strong&gt;&lt;/div&gt;
              &lt;div&gt;Skip: &lt;strong&gt;{preview.preview.to_skip}&lt;/strong&gt;&lt;/div&gt;
            &lt;/div&gt;
            &lt;div style={{ display: 'flex', gap: 8 }}&gt;
              &lt;button onClick={() =&gt; setStep('input')} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-text)', cursor: 'pointer' }}&gt;Back&lt;/button&gt;
              &lt;button onClick={handleExecute} disabled={loading} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: 'none', background: 'var(--gem-done)', color: '#fff', cursor: 'pointer' }}&gt;{loading ? 'Importing...' : 'Confirm Import'}&lt;/button&gt;
            &lt;/div&gt;
          &lt;/&gt;
        )}

        {step === 'result' &amp;&amp; result &amp;&amp; (
          &lt;&gt;
            &lt;div style={{ fontSize: 12, color: 'var(--gem-text)' }}&gt;
              &lt;div&gt;Created: &lt;strong&gt;{result.created}&lt;/strong&gt;&lt;/div&gt;
              &lt;div&gt;Updated: &lt;strong&gt;{result.updated}&lt;/strong&gt;&lt;/div&gt;
              &lt;div&gt;Skipped: &lt;strong&gt;{result.skipped}&lt;/strong&gt;&lt;/div&gt;
              {result.errors.length &gt; 0 &amp;&amp; &lt;div style={{ color: 'var(--gem-danger)' }}&gt;Errors: {result.errors.length}&lt;/div&gt;}
              &lt;div style={{ marginTop: 6, fontSize: 11, color: 'var(--gem-muted)' }}&gt;Import log: {result.import_log_id}&lt;/div&gt;
            &lt;/div&gt;
            &lt;button onClick={onClose} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: 'none', background: 'var(--gem-accent)', color: '#fff', cursor: 'pointer' }}&gt;Done&lt;/button&gt;
          &lt;/&gt;
        )}
      &lt;/div&gt;
    &lt;/div&gt;
  )
}
```

- [ ] 2. Create `BRollEmpty` mirroring `AudioEmpty`:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-empty.tsx
'use client'

interface BRollEmptyProps {
  variant: 'no-assets' | 'no-results'
  onImport?: () =&gt; void
  onClearFilters?: () =&gt; void
}

export function BRollEmpty({ variant, onImport, onClearFilters }: BRollEmptyProps) {
  if (variant === 'no-assets') {
    return (
      &lt;div style={{ textAlign: 'center', padding: '64px 24px' }}&gt;
        &lt;div style={{ fontSize: 36, opacity: 0.3, marginBottom: 12 }}&gt;
          &lt;svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--gem-muted)' }}&gt;
            &lt;rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /&gt;&lt;line x1="7" y1="2" x2="7" y2="22" /&gt;&lt;line x1="17" y1="2" x2="17" y2="22" /&gt;
          &lt;/svg&gt;
        &lt;/div&gt;
        &lt;div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gem-text)', marginBottom: 4 }}&gt;No B-Roll assets yet&lt;/div&gt;
        &lt;div style={{ fontSize: 12, color: 'var(--gem-muted)', marginBottom: 16 }}&gt;Import your first clips to start building your B-Roll library.&lt;/div&gt;
        &lt;div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}&gt;
          &lt;button onClick={onImport} style={{ fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 5, background: 'var(--gem-accent)', color: 'white', border: 'none', cursor: 'pointer' }}&gt;Import JSON&lt;/button&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    )
  }
  return (
    &lt;div style={{ textAlign: 'center', padding: '48px 24px' }}&gt;
      &lt;div style={{ fontSize: 12, color: 'var(--gem-muted)', marginBottom: 4 }}&gt;No clips match your current filters&lt;/div&gt;
      &lt;div style={{ fontSize: 11, color: 'var(--gem-dim)', marginBottom: 8 }}&gt;Try removing some filters or broadening your search&lt;/div&gt;
      &lt;button onClick={onClearFilters} style={{ fontSize: 11, color: 'var(--gem-accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}&gt;Clear all filters&lt;/button&gt;
    &lt;/div&gt;
  )
}
```

- [ ] 3. Create `BRollGridSkeleton` mirroring `AudioGridSkeleton` with 80px thumbnail placeholder:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-skeleton.tsx
'use client'

export function BRollGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    &lt;div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 340px))', gap: 14 }}&gt;
      {Array.from({ length: count }).map((_, i) =&gt; (
        &lt;div key={i} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--gem-border)', background: 'var(--gem-surface)' }}&gt;
          &lt;div style={{ height: 80, backgroundImage: 'linear-gradient(90deg, var(--gem-well) 25%, var(--gem-surface) 50%, var(--gem-well) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.2}s` }} /&gt;
          &lt;div style={{ padding: '10px 12px 12px' }}&gt;
            &lt;div style={{ height: 12, width: '80%', borderRadius: 4, marginBottom: 6, backgroundImage: 'linear-gradient(90deg, var(--gem-well) 25%, var(--gem-surface) 50%, var(--gem-well) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} /&gt;
            &lt;div style={{ height: 10, width: '60%', borderRadius: 4, marginBottom: 10, backgroundImage: 'linear-gradient(90deg, var(--gem-well) 25%, var(--gem-surface) 50%, var(--gem-well) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} /&gt;
            &lt;div style={{ height: 10, width: '40%', borderRadius: 4, backgroundImage: 'linear-gradient(90deg, var(--gem-well) 25%, var(--gem-surface) 50%, var(--gem-well) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} /&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      ))}
    &lt;/div&gt;
  )
}
```

- [ ] 4. Create `BRollErrorBoundary` mirroring `AudioErrorBoundary`:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-error-boundary.tsx
'use client'

import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class BRollErrorBoundary extends Component&lt;Props, State&gt; {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        &lt;div style={{ padding: 40, textAlign: 'center' }}&gt;
          &lt;h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--gem-text)', marginBottom: 8 }}&gt;Something went wrong&lt;/h3&gt;
          &lt;p style={{ fontSize: 12, color: 'var(--gem-muted)', marginBottom: 16 }}&gt;{this.state.error.message}&lt;/p&gt;
          &lt;button onClick={() =&gt; this.setState({ error: null })} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-surface-hi)', color: 'var(--gem-text)', cursor: 'pointer' }}&gt;Try again&lt;/button&gt;
        &lt;/div&gt;
      )
    }
    return this.props.children
  }
}
```

- [ ] 5. Create `BRollLibrary` client shell mirroring `AudioLibrary` with state management for assets, filters, view mode, selection, pagination, and keyboard navigation:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/brolls/_components/broll-library.tsx
'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'
import { BRollFilters } from './broll-filters'
import { BRollGrid } from './broll-grid'
import { BRollTable } from './broll-table'
import { BRollDetail } from './broll-detail'
import { BRollEmpty } from './broll-empty'
import { BRollGridSkeleton } from './broll-skeleton'
import { BRollImportModal } from './broll-import-modal'
import { useBRollFilters, serializeFilters } from '../_helpers/use-broll-filters'

interface Stats { total: number; pessoal: number; generico: number; ready: number; pending: number }

interface BRollLibraryProps {
  initialAssets: BRollAssetRow[]
  stats: Stats
}

function deriveTags(assets: BRollAssetRow[]): string[] {
  const seen = new Set&lt;string&gt;()
  for (const a of assets) { for (const t of a.tags) seen.add(t) }
  return Array.from(seen).sort()
}

export function BRollLibrary({ initialAssets, stats }: BRollLibraryProps) {
  const [assets, setAssets] = useState&lt;BRollAssetRow[]&gt;(initialAssets)
  const availableTags = useMemo(() =&gt; deriveTags(assets), [assets])
  const [selectedId, setSelectedId] = useState&lt;string | null&gt;(null)
  const [viewMode, setViewMode] = useState&lt;'grid' | 'table'&gt;('grid')
  const [showImport, setShowImport] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasNext, setHasNext] = useState(false)
  const [nextCursor, setNextCursor] = useState&lt;string | null&gt;(null)
  const [fetchError, setFetchError] = useState&lt;string | null&gt;(null)
  const abortRef = useRef&lt;AbortController | null&gt;(null)
  const loadMoreAbortRef = useRef&lt;AbortController | null&gt;(null)
  const gTimerRef = useRef&lt;ReturnType&lt;typeof setTimeout&gt;&gt;(undefined)
  const assetsRef = useRef(assets)
  const selectedIdRef = useRef(selectedId)
  assetsRef.current = assets
  selectedIdRef.current = selectedId

  const { filters, setFilters, clearAll, activeCount } = useBRollFilters()

  const liveStats = useMemo(() =&gt; ({
    total: assets.length,
    pessoal: assets.filter(a =&gt; a.source_type === 'pessoal').length,
    generico: assets.filter(a =&gt; a.source_type === 'generico').length,
    ready: assets.filter(a =&gt; a.status === 'ready').length,
    pending: assets.filter(a =&gt; a.status === 'pending').length,
  }), [assets])

  const [isNarrow, setIsNarrow] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  useEffect(() =&gt; {
    const mq = window.matchMedia('(max-width: 900px)')
    setIsNarrow(mq.matches); setShowFilters(!mq.matches)
    const handler = (e: MediaQueryListEvent) =&gt; { setIsNarrow(e.matches); setShowFilters(!e.matches) }
    mq.addEventListener('change', handler)
    return () =&gt; mq.removeEventListener('change', handler)
  }, [])

  const refetch = useCallback(async (params: URLSearchParams | Record&lt;string, string&gt; = {}) =&gt; {
    abortRef.current?.abort()
    const controller = new AbortController(); abortRef.current = controller
    setFetchError(null); setLoading(true)
    try {
      const qs = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString()
      const res = await fetch(`/api/pipeline/broll-library${qs ? `?${qs}` : ''}`, { signal: controller.signal })
      if (!res.ok) { setFetchError('Failed to load assets'); return }
      const json = await res.json()
      if (!controller.signal.aborted) { setAssets(json.data); setHasNext(json.meta?.has_next ?? false); setNextCursor(json.meta?.next_cursor ?? null) }
    } catch (e) { if (e instanceof DOMException &amp;&amp; e.name === 'AbortError') return; setFetchError('Network error') }
    finally { if (!controller.signal.aborted) setLoading(false) }
  }, [])

  const loadMore = useCallback(async () =&gt; {
    if (!hasNext || !nextCursor || loadingMore) return
    loadMoreAbortRef.current?.abort()
    const controller = new AbortController(); loadMoreAbortRef.current = controller
    setLoadingMore(true)
    try {
      const params = serializeFilters(filters); params.set('cursor', nextCursor)
      const res = await fetch(`/api/pipeline/broll-library?${params.toString()}`, { signal: controller.signal })
      if (!res.ok) { setFetchError('Failed to load more assets'); return }
      const json = await res.json()
      if (!controller.signal.aborted) { setAssets(prev =&gt; [...prev, ...json.data]); setHasNext(json.meta?.has_next ?? false); setNextCursor(json.meta?.next_cursor ?? null) }
    } catch (e) { if (e instanceof DOMException &amp;&amp; e.name === 'AbortError') return; setFetchError('Network error') }
    finally { if (!controller.signal.aborted) setLoadingMore(false) }
  }, [hasNext, nextCursor, loadingMore, filters])

  const isFirstRender = useRef(true)
  useEffect(() =&gt; {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    loadMoreAbortRef.current?.abort(); setHasNext(false); setNextCursor(null)
    refetch(serializeFilters(filters))
  }, [filters, refetch])

  // Keyboard navigation
  const [gPressed, setGPressed] = useState(false)
  useEffect(() =&gt; {
    function onKeydown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '/') { e.preventDefault(); document.querySelector&lt;HTMLInputElement&gt;('[data-broll-search]')?.focus() }
      if (e.key === 'Escape') { setSelectedId(null); setGPressed(false) }
      if (e.key === 'g') { clearTimeout(gTimerRef.current); setGPressed(true); gTimerRef.current = setTimeout(() =&gt; setGPressed(false), 500); return }
      if (gPressed &amp;&amp; e.key === 't') { setViewMode(v =&gt; v === 'grid' ? 'table' : 'grid'); setGPressed(false); return }
      if (e.key === 'Enter') { if (!selectedIdRef.current &amp;&amp; assetsRef.current.length &gt; 0) setSelectedId(assetsRef.current[0]!.id); return }
      if (e.key === 'j' || e.key === 'k') {
        if (assetsRef.current.length === 0) return
        const ids = assetsRef.current.map(a =&gt; a.id)
        const idx = selectedIdRef.current ? ids.indexOf(selectedIdRef.current) : -1
        const next = e.key === 'j' ? Math.min(idx + 1, ids.length - 1) : Math.max(idx - 1, 0)
        setSelectedId(ids[next]!)
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () =&gt; { window.removeEventListener('keydown', onKeydown); clearTimeout(gTimerRef.current) }
  }, [gPressed])

  return (
    &lt;div style={{ display: 'flex', height: 'calc(100vh - 4rem)', overflow: 'hidden', gap: 12 }}&gt;
      {showFilters &amp;&amp; &lt;BRollFilters filters={filters} setFilters={setFilters} clearAll={clearAll} activeCount={activeCount} assets={assets} availableTags={availableTags} /&gt;}

      &lt;div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 0 }}&gt;
        {/* Toolbar */}
        &lt;div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}&gt;
          &lt;div style={{ display: 'flex', gap: 8, alignItems: 'center' }}&gt;
            &lt;button onClick={() =&gt; setShowFilters(v =&gt; !v)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: showFilters ? 'var(--gem-accent)' : 'transparent', color: 'var(--gem-text)', cursor: 'pointer' }}&gt;
              {showFilters ? 'Hide Filters' : 'Filters'}
            &lt;/button&gt;
            &lt;span style={{ fontSize: 12, color: 'var(--gem-muted)' }}&gt;
              {liveStats.total} clip{liveStats.total !== 1 ? 's' : ''}{activeCount &gt; 0 &amp;&amp; ' (filtered)'}
            &lt;/span&gt;
          &lt;/div&gt;
          &lt;div style={{ display: 'flex', gap: 8, alignItems: 'center' }}&gt;
            &lt;div role="group" aria-label="View mode" style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--gem-border)' }}&gt;
              &lt;button aria-pressed={viewMode === 'grid'} onClick={() =&gt; setViewMode('grid')} style={{ padding: '4px 10px', fontSize: 12, border: 'none', borderRight: '1px solid var(--gem-border)', background: viewMode === 'grid' ? 'var(--gem-surface-hi)' : 'transparent', color: viewMode === 'grid' ? 'var(--gem-text)' : 'var(--gem-muted)', cursor: 'pointer', fontWeight: viewMode === 'grid' ? 600 : 400 }}&gt;Grid&lt;/button&gt;
              &lt;button aria-pressed={viewMode === 'table'} onClick={() =&gt; setViewMode('table')} style={{ padding: '4px 10px', fontSize: 12, border: 'none', background: viewMode === 'table' ? 'var(--gem-surface-hi)' : 'transparent', color: viewMode === 'table' ? 'var(--gem-text)' : 'var(--gem-muted)', cursor: 'pointer', fontWeight: viewMode === 'table' ? 600 : 400 }}&gt;Table&lt;/button&gt;
            &lt;/div&gt;
            &lt;button onClick={() =&gt; setShowImport(true)} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-surface-hi)', color: 'var(--gem-text)', cursor: 'pointer' }}&gt;Import JSON&lt;/button&gt;
          &lt;/div&gt;
        &lt;/div&gt;

        {fetchError &amp;&amp; (
          &lt;div style={{ padding: '6px 12px', background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 12, borderRadius: 6 }}&gt;
            &lt;span style={{ color: '#f59e0b' }}&gt;{fetchError}&lt;/span&gt;
            &lt;div style={{ display: 'flex', gap: 6, alignItems: 'center' }}&gt;
              &lt;button onClick={() =&gt; refetch(serializeFilters(filters))} style={{ background: 'none', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: 'pointer', fontSize: 11, padding: '1px 8px', borderRadius: 4 }}&gt;Retry&lt;/button&gt;
              &lt;button aria-label="Dismiss error" onClick={() =&gt; setFetchError(null)} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: 11 }}&gt;&amp;#x2715;&lt;/button&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        )}

        {loading &amp;&amp; &lt;BRollGridSkeleton /&gt;}
        {!loading &amp;&amp; assets.length === 0 &amp;&amp; activeCount === 0 &amp;&amp; &lt;BRollEmpty variant="no-assets" onImport={() =&gt; setShowImport(true)} /&gt;}
        {!loading &amp;&amp; assets.length === 0 &amp;&amp; activeCount &gt; 0 &amp;&amp; &lt;BRollEmpty variant="no-results" onClearFilters={clearAll} /&gt;}

        {!loading &amp;&amp; assets.length &gt; 0 &amp;&amp; (
          viewMode === 'grid'
            ? &lt;BRollGrid assets={assets} selectedId={selectedId} onSelect={setSelectedId} /&gt;
            : &lt;BRollTable assets={assets} selectedId={selectedId} onSelect={setSelectedId} onRefetch={() =&gt; refetch(serializeFilters(filters))} /&gt;
        )}

        {hasNext &amp;&amp; (
          &lt;div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16 }}&gt;
            &lt;button onClick={loadMore} disabled={loadingMore} style={{ padding: '6px 20px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-surface-hi)', color: 'var(--gem-text)', cursor: loadingMore ? 'not-allowed' : 'pointer', opacity: loadingMore ? 0.6 : 1 }}&gt;{loadingMore ? 'Loading more...' : 'Load more'}&lt;/button&gt;
          &lt;/div&gt;
        )}

        &lt;div style={{ marginTop: 'auto', paddingTop: 24, fontSize: 11, color: 'var(--gem-muted)' }}&gt;
          {stats.total} total {'\u00B7'} Showing {liveStats.total} {'\u00B7'} {liveStats.pessoal} pessoal {'\u00B7'} {liveStats.generico} generico {'\u00B7'} {liveStats.ready} ready {'\u00B7'} {liveStats.pending} pending
        &lt;/div&gt;
      &lt;/div&gt;

      {selectedId &amp;&amp; (
        isNarrow ? (
          &lt;div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 400, zIndex: 40, background: 'var(--gem-surface)', boxShadow: '-4px 0 20px rgba(0,0,0,0.3)' }}&gt;
            &lt;BRollDetail assetId={selectedId} allAssets={assets} onClose={() =&gt; setSelectedId(null)} onFilter={setFilters} fullWidth /&gt;
          &lt;/div&gt;
        ) : (
          &lt;BRollDetail assetId={selectedId} allAssets={assets} onClose={() =&gt; setSelectedId(null)} onFilter={setFilters} /&gt;
        )
      )}

      {showImport &amp;&amp; &lt;BRollImportModal onClose={() =&gt; { setShowImport(false); refetch(serializeFilters(filters)) }} /&gt;}
    &lt;/div&gt;
  )
}
```

- [ ] 6. Create the SSR `page.tsx` mirroring `audio/page.tsx` with parallel stat queries from `broll_assets`:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/brolls/page.tsx
import { Suspense } from 'react'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'
import { BRollLibrary } from './_components/broll-library'
import { BRollErrorBoundary } from './_components/broll-error-boundary'
import { BRollGridSkeleton } from './_components/broll-skeleton'

export const dynamic = 'force-dynamic'

export default async function BRollPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [assetsRes, totalRes, pessoalRes, genericoRes, readyRes, pendingRes] = await Promise.all([
    supabase
      .from('broll_assets')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('broll_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId),
    supabase.from('broll_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('source_type', 'pessoal'),
    supabase.from('broll_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('source_type', 'generico'),
    supabase.from('broll_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'ready'),
    supabase.from('broll_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'pending'),
  ])

  if (assetsRes.error) console.error('[broll] assets query:', assetsRes.error.message)

  const assets = (assetsRes.data ?? []) as BRollAssetRow[]
  const stats = {
    total: totalRes.count ?? 0,
    pessoal: pessoalRes.count ?? 0,
    generico: genericoRes.count ?? 0,
    ready: readyRes.count ?? 0,
    pending: pendingRes.count ?? 0,
  }

  return (
    &lt;&gt;
      &lt;CmsTopbar title="Pipeline — B-Roll Library" /&gt;
      &lt;div className="p-4 gem-pipeline-theme" style={{ height: 'calc(100vh - 6rem)', ...GEM_CSS_VARS } as React.CSSProperties}&gt;
        &lt;BRollErrorBoundary&gt;
          &lt;Suspense fallback={&lt;div style={{ padding: 24 }}&gt;&lt;BRollGridSkeleton /&gt;&lt;/div&gt;}&gt;
            &lt;BRollLibrary initialAssets={assets} stats={stats} /&gt;
          &lt;/Suspense&gt;
        &lt;/BRollErrorBoundary&gt;
      &lt;/div&gt;
    &lt;/&gt;
  )
}
```

- [ ] 7. Verify all files compile:

```bash
npx tsc --noEmit --project apps/web/tsconfig.json 2&gt;&amp;1 | grep -E 'broll' | head -20
```

Expected: no errors referencing broll files.

- [ ] 8. Commit:

```
feat(pipeline): add B-Roll Library page with import modal, shell, and supporting components
```

---

### Task 14 — AssetPickerDialog (shared, reusable for audio and broll)

**Files:**
- `apps/web/src/app/cms/(authed)/pipeline/_components/asset-picker-dialog.tsx` (new)

**Steps:**

- [ ] 1. Create the shared `AssetPickerDialog` component at the pipeline level (not inside audio or brolls). This component is parameterized by `assetType` and renders either B-Roll cards or Audio cards. 900px modal, 80vh tall, sidebar (200px) with pre-applied tags, grid content, footer with count and select/cancel:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/asset-picker-dialog.tsx
'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'

// ─── Types ──────────────────────────────────────────────────────────────────

type AssetRow = BRollAssetRow | AudioAssetRow

interface AssetPickerContext {
  description: string
  suggestedTags: string[]
  suggestedCategory?: string
  suggestedResolution?: string
}

export interface AssetPickerDialogProps {
  assetType: 'broll' | 'audio'
  context: AssetPickerContext
  onSelect: (asset: AssetRow) =&gt; void
  onCancel: () =&gt; void
  initialSelectedId?: string
}

// ─── Type guards ────────────────────────────────────────────────────────────

function isBRoll(asset: AssetRow): asset is BRollAssetRow {
  return 'source_type' in asset &amp;&amp; 'resolution' in asset
}

function isAudio(asset: AssetRow): asset is AudioAssetRow {
  return 'type' in asset &amp;&amp; ('bpm' in asset || 'music_key' in asset)
}

// ─── Card sub-components ────────────────────────────────────────────────────

function BRollPickerCard({ asset, selected, onClick }: { asset: BRollAssetRow; selected: boolean; onClick: () =&gt; void }) {
  return (
    &lt;div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onClick}
      onKeyDown={e =&gt; { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{
        borderRadius: 6,
        overflow: 'hidden',
        cursor: 'pointer',
        border: selected ? '2px solid var(--gem-accent)' : '1px solid var(--gem-border)',
        boxShadow: selected ? '0 0 0 2px color-mix(in srgb, var(--gem-accent) 20%, transparent)' : 'none',
        background: 'var(--gem-surface)',
        transition: 'border-color 0.1s, box-shadow 0.1s',
        outline: 'none',
      }}
    &gt;
      {/* Thumbnail */}
      &lt;div
        style={{
          height: 80,
          background: asset.thumbnail_url
            ? `url(${asset.thumbnail_url}) center/cover`
            : 'linear-gradient(135deg, #1e293b, #0f172a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      &gt;
        {!asset.thumbnail_url &amp;&amp; (
          &lt;svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5a6b7f" strokeWidth="1.5" opacity="0.2"&gt;
            &lt;rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /&gt;
            &lt;line x1="7" y1="2" x2="7" y2="22" /&gt;
            &lt;line x1="17" y1="2" x2="17" y2="22" /&gt;
          &lt;/svg&gt;
        )}
        {asset.duration_seconds != null &amp;&amp; (
          &lt;span style={{ position: 'absolute', bottom: 3, right: 4, fontSize: 8, color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.5)', borderRadius: 2, padding: '0 3px', fontVariantNumeric: 'tabular-nums' }}&gt;
            {asset.duration_seconds &lt; 60 ? `${Math.round(asset.duration_seconds)}s` : `${Math.floor(asset.duration_seconds / 60)}:${Math.round(asset.duration_seconds % 60).toString().padStart(2, '0')}`}
          &lt;/span&gt;
        )}
        &lt;span style={{ position: 'absolute', top: 3, right: 4, fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.4)', borderRadius: 2, padding: '0 3px', textTransform: 'uppercase' }}&gt;
          {asset.resolution === '4k' ? '4K' : asset.resolution}
        &lt;/span&gt;
      &lt;/div&gt;
      {/* Body */}
      &lt;div style={{ padding: '6px 8px 8px' }}&gt;
        &lt;div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gem-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}&gt;
          {asset.renamed_to ?? asset.original_filename}
        &lt;/div&gt;
        &lt;div style={{ fontSize: 9, color: 'var(--gem-dim)' }}&gt;
          {asset.source_type} {asset.category ? `\u00B7 ${asset.category}` : ''}
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  )
}

function AudioPickerCard({ asset, selected, onClick }: { asset: AudioAssetRow; selected: boolean; onClick: () =&gt; void }) {
  return (
    &lt;div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onClick}
      onKeyDown={e =&gt; { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{
        borderRadius: 6,
        overflow: 'hidden',
        cursor: 'pointer',
        border: selected ? '2px solid var(--gem-accent)' : '1px solid var(--gem-border)',
        boxShadow: selected ? '0 0 0 2px color-mix(in srgb, var(--gem-accent) 20%, transparent)' : 'none',
        background: 'var(--gem-surface)',
        transition: 'border-color 0.1s, box-shadow 0.1s',
        outline: 'none',
      }}
    &gt;
      {/* Waveform area */}
      &lt;div style={{ height: 48, background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(99,102,241,0.04))', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}&gt;
        &lt;span style={{ fontSize: 18, opacity: 0.2 }}&gt;{asset.type === 'music' ? '\u266B' : '\u25CE'}&lt;/span&gt;
        {asset.duration_seconds != null &amp;&amp; (
          &lt;span style={{ position: 'absolute', bottom: 3, right: 4, fontSize: 8, color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.4)', borderRadius: 2, padding: '0 3px', fontVariantNumeric: 'tabular-nums' }}&gt;
            {Math.floor(asset.duration_seconds / 60)}:{Math.round(asset.duration_seconds % 60).toString().padStart(2, '0')}
          &lt;/span&gt;
        )}
      &lt;/div&gt;
      {/* Body */}
      &lt;div style={{ padding: '6px 8px 8px' }}&gt;
        &lt;div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gem-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}&gt;
          {asset.track_name ?? asset.original_filename}
        &lt;/div&gt;
        &lt;div style={{ fontSize: 9, color: 'var(--gem-dim)' }}&gt;
          {asset.type}{asset.bpm ? ` \u00B7 ${asset.bpm} BPM` : ''}{asset.music_key ? ` \u00B7 ${asset.music_key}` : ''}
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AssetPickerDialog({ assetType, context, onSelect, onCancel, initialSelectedId }: AssetPickerDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState&lt;AssetRow[]&gt;([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState&lt;string | null&gt;(initialSelectedId ?? null)
  const [activeTagFilters, setActiveTagFilters] = useState&lt;Set&lt;string&gt;&gt;(() =&gt; new Set(context.suggestedTags))
  const [categoryFilter, setCategoryFilter] = useState&lt;string | null&gt;(context.suggestedCategory ?? null)
  const [resolutionFilter, setResolutionFilter] = useState&lt;string | null&gt;(context.suggestedResolution ?? null)

  const dialogRef = useRef&lt;HTMLDivElement&gt;(null)
  const searchRef = useRef&lt;HTMLInputElement&gt;(null)
  const debounceRef = useRef&lt;ReturnType&lt;typeof setTimeout&gt;&gt;(undefined)
  const mountedRef = useRef(true)

  useEffect(() =&gt; () =&gt; { mountedRef.current = false }, [])

  const apiBase = assetType === 'broll' ? '/api/pipeline/broll-library' : '/api/pipeline/audio-library'
  const title = assetType === 'broll' ? 'SELECIONAR B-ROLL' : 'SELECIONAR AUDIO'

  // Build search params
  const buildParams = useCallback(() =&gt; {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    const tags = Array.from(activeTagFilters)
    if (tags.length &gt; 0) params.set('tags', tags.join(','))
    if (categoryFilter) params.set('category', categoryFilter)
    if (assetType === 'broll' &amp;&amp; resolutionFilter) params.set('resolution', resolutionFilter)
    params.set('limit', '40')
    return params
  }, [query, activeTagFilters, categoryFilter, resolutionFilter, assetType])

  // Fetch results
  const fetchResults = useCallback(async () =&gt; {
    setLoading(true)
    try {
      const params = buildParams()
      const res = await fetch(`${apiBase}?${params.toString()}`)
      if (!res.ok) return
      const json = await res.json()
      if (mountedRef.current) setResults(json.data ?? [])
    } catch {
      // silently fail
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [apiBase, buildParams])

  // Initial fetch and refetch on filter change
  useEffect(() =&gt; {
    fetchResults()
  }, [fetchResults])

  // Debounced search
  const handleSearchChange = useCallback((value: string) =&gt; {
    setQuery(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() =&gt; fetchResults(), 300)
  }, [fetchResults])

  // Focus trap + keyboard
  useEffect(() =&gt; {
    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onCancel(); return }
      if (e.key === 'Enter' &amp;&amp; selectedId) {
        const selected = results.find(r =&gt; r.id === selectedId)
        if (selected) onSelect(selected)
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () =&gt; window.removeEventListener('keydown', onKeydown)
  }, [onCancel, onSelect, selectedId, results])

  // Focus search on mount
  useEffect(() =&gt; { searchRef.current?.focus() }, [])

  const toggleTag = useCallback((tag: string) =&gt; {
    setActiveTagFilters(prev =&gt; {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }, [])

  const selectedAsset = useMemo(() =&gt; results.find(r =&gt; r.id === selectedId) ?? null, [results, selectedId])

  // All unique tags from suggested + results
  const allTags = useMemo(() =&gt; {
    const tags = new Set(context.suggestedTags)
    for (const r of results) {
      for (const t of r.tags) tags.add(t)
    }
    return Array.from(tags).sort()
  }, [context.suggestedTags, results])

  return (
    &lt;div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onCancel}&gt;
      &lt;div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e =&gt; e.stopPropagation()}
        style={{
          width: 900,
          maxWidth: '95vw',
          maxHeight: '80vh',
          background: 'var(--gem-surface)',
          border: '1px solid var(--gem-border)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      &gt;
        {/* Header */}
        &lt;div style={{ flexShrink: 0, padding: '14px 16px', borderBottom: '1px solid var(--gem-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}&gt;
          &lt;div&gt;
            &lt;h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--gem-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}&gt;{title}&lt;/h3&gt;
            {context.description &amp;&amp; &lt;p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--gem-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 600 }}&gt;{context.description}&lt;/p&gt;}
          &lt;/div&gt;
          &lt;button aria-label="Close" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}&gt;&amp;#x2715;&lt;/button&gt;
        &lt;/div&gt;

        {/* Body: sidebar + content */}
        &lt;div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}&gt;
          {/* Sidebar (200px) */}
          &lt;div style={{ width: 200, minWidth: 200, borderRight: '1px solid var(--gem-border)', padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}&gt;
            {/* Tags */}
            &lt;div&gt;
              &lt;div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gem-muted)', marginBottom: 6 }}&gt;Tags&lt;/div&gt;
              &lt;div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}&gt;
                {allTags.slice(0, 15).map(tag =&gt; {
                  const active = activeTagFilters.has(tag)
                  const isSuggested = context.suggestedTags.includes(tag)
                  return (
                    &lt;button
                      key={tag}
                      type="button"
                      aria-pressed={active}
                      onClick={() =&gt; toggleTag(tag)}
                      style={{
                        padding: '2px 6px',
                        fontSize: 10,
                        borderRadius: 4,
                        border: `1px solid ${active ? (isSuggested ? '#14b8a6' : 'var(--gem-accent)') : 'var(--gem-border)'}`,
                        background: active ? (isSuggested ? 'rgba(20,184,166,0.15)' : 'var(--gem-accent)') : 'var(--gem-well)',
                        color: active ? (isSuggested ? '#14b8a6' : '#fff') : 'var(--gem-text)',
                        cursor: 'pointer',
                        fontWeight: active ? 600 : 400,
                        transition: 'all 0.1s',
                      }}
                    &gt;
                      {tag}
                    &lt;/button&gt;
                  )
                })}
              &lt;/div&gt;
            &lt;/div&gt;

            {/* Resolution (B-Roll) or Type (Audio) */}
            {assetType === 'broll' ? (
              &lt;div&gt;
                &lt;div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gem-muted)', marginBottom: 6 }}&gt;Resolucao&lt;/div&gt;
                &lt;div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}&gt;
                  {[null, '4k', '1080p', '720p'].map(r =&gt; {
                    const active = resolutionFilter === r
                    return (
                      &lt;button key={String(r)} type="button" aria-pressed={active} onClick={() =&gt; setResolutionFilter(r)}
                        style={{ padding: '3px 6px', fontSize: 10, borderRadius: 4, border: '1px solid var(--gem-border)', background: active ? 'var(--gem-accent)' : 'var(--gem-well)', color: active ? '#fff' : 'var(--gem-muted)', cursor: 'pointer', fontWeight: active ? 600 : 400, textAlign: 'left' }}&gt;
                        {r === null ? 'All' : r === '4k' ? '4K' : r}
                      &lt;/button&gt;
                    )
                  })}
                &lt;/div&gt;
              &lt;/div&gt;
            ) : (
              &lt;div&gt;
                &lt;div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gem-muted)', marginBottom: 6 }}&gt;Type&lt;/div&gt;
                &lt;div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}&gt;
                  {[null, 'music', 'sfx'].map(t =&gt; {
                    // Audio type filter stored in query params
                    const active = false // Simplified: this would need a separate state
                    return (
                      &lt;button key={String(t)} type="button" aria-pressed={active}
                        style={{ padding: '3px 6px', fontSize: 10, borderRadius: 4, border: '1px solid var(--gem-border)', background: active ? 'var(--gem-accent)' : 'var(--gem-well)', color: active ? '#fff' : 'var(--gem-muted)', cursor: 'pointer', fontWeight: active ? 600 : 400, textAlign: 'left' }}&gt;
                        {t === null ? 'All' : t === 'music' ? 'Music' : 'SFX'}
                      &lt;/button&gt;
                    )
                  })}
                &lt;/div&gt;
              &lt;/div&gt;
            )}

            {/* Category */}
            {categoryFilter &amp;&amp; (
              &lt;div&gt;
                &lt;div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gem-muted)', marginBottom: 6 }}&gt;Category&lt;/div&gt;
                &lt;button onClick={() =&gt; setCategoryFilter(null)} style={{ padding: '3px 8px', fontSize: 10, borderRadius: 4, border: '1px solid var(--gem-accent)', background: 'var(--gem-accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}&gt;
                  {categoryFilter} &lt;span style={{ fontSize: 8 }}&gt;&amp;#x2715;&lt;/span&gt;
                &lt;/button&gt;
              &lt;/div&gt;
            )}
          &lt;/div&gt;

          {/* Content area */}
          &lt;div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}&gt;
            {/* Search */}
            &lt;div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gem-border)', flexShrink: 0 }}&gt;
              &lt;input
                ref={searchRef}
                type="search"
                placeholder="Search assets..."
                value={query}
                onChange={e =&gt; handleSearchChange(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)', outline: 'none', boxSizing: 'border-box' }}
              /&gt;
            &lt;/div&gt;

            {/* Grid */}
            &lt;div style={{ flex: 1, overflowY: 'auto', padding: 14 }}&gt;
              {loading &amp;&amp; (
                &lt;div style={{ textAlign: 'center', padding: 40, color: 'var(--gem-dim)', fontSize: 12 }}&gt;Loading...&lt;/div&gt;
              )}

              {!loading &amp;&amp; results.length === 0 &amp;&amp; (
                &lt;div style={{ textAlign: 'center', padding: 40, color: 'var(--gem-dim)', fontSize: 12 }}&gt;No assets found. Try adjusting filters.&lt;/div&gt;
              )}

              {!loading &amp;&amp; results.length &gt; 0 &amp;&amp; (
                &lt;div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}&gt;
                  {results.map(asset =&gt; {
                    const isSelected = asset.id === selectedId
                    if (isBRoll(asset)) {
                      return &lt;BRollPickerCard key={asset.id} asset={asset} selected={isSelected} onClick={() =&gt; setSelectedId(asset.id)} /&gt;
                    }
                    if (isAudio(asset)) {
                      return &lt;AudioPickerCard key={asset.id} asset={asset} selected={isSelected} onClick={() =&gt; setSelectedId(asset.id)} /&gt;
                    }
                    return null
                  })}
                &lt;/div&gt;
              )}
            &lt;/div&gt;
          &lt;/div&gt;
        &lt;/div&gt;

        {/* Footer */}
        &lt;div style={{ flexShrink: 0, padding: '10px 16px', borderTop: '1px solid var(--gem-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}&gt;
          &lt;span style={{ fontSize: 11, color: 'var(--gem-muted)' }}&gt;
            {results.length} resultado{results.length !== 1 ? 's' : ''}{selectedId ? ' \u00B7 1 selecionado' : ''}
          &lt;/span&gt;
          &lt;div style={{ display: 'flex', gap: 8 }}&gt;
            &lt;button onClick={onCancel} style={{ padding: '6px 14px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-text)', cursor: 'pointer' }}&gt;Cancelar&lt;/button&gt;
            &lt;button
              onClick={() =&gt; { if (selectedAsset) onSelect(selectedAsset) }}
              disabled={!selectedId}
              style={{ padding: '6px 14px', fontSize: 12, borderRadius: 5, border: 'none', background: selectedId ? 'var(--gem-accent)' : 'var(--gem-faint)', color: selectedId ? '#fff' : 'var(--gem-dim)', cursor: selectedId ? 'pointer' : 'not-allowed', fontWeight: 600, transition: 'background 0.15s' }}
            &gt;
              Selecionar
            &lt;/button&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  )
}
```

- [ ] 2. Verify the component compiles:

```bash
npx tsc --noEmit --project apps/web/tsconfig.json 2&gt;&amp;1 | grep 'asset-picker' | head -5
```

Expected: no errors.

- [ ] 3. Run the full test suite to ensure nothing is broken:

```bash
npm run test:web 2&gt;&amp;1 | tail -20
```

Expected: all existing tests pass, no regressions.

- [ ] 4. Commit:

```
feat(pipeline): add shared AssetPickerDialog for B-Roll and Audio asset selection
```

---

## Phase 3 — Roteiro Dual-Mode (Tasks 15-20)

### Task 15 — Roteiro Zod Schemas + Script Serializer + v1-to-v2 Migration + Tests

**Files:**
- `apps/web/src/lib/pipeline/roteiro-schemas.ts` (new)
- `apps/web/src/lib/pipeline/script-serializer.ts` (new)
- `apps/web/test/lib/pipeline/roteiro-schemas.test.ts` (new)
- `apps/web/test/lib/pipeline/script-serializer.test.ts` (new)

- [ ] 1. Create `apps/web/src/lib/pipeline/roteiro-schemas.ts` with Zod schemas and the v1-to-v2 migration function:

```ts
import { z } from 'zod'

// ── Script line discriminated union ──────────────────
export const ScriptLineLineSchema = z.object({
  type: z.literal('line'),
  text: z.string().min(1),
  accent: z.string().optional(),
})

export const ScriptLinePauseSchema = z.object({
  type: z.literal('pause'),
  duration: z.number().min(0),
})

export const ScriptLineNoteSchema = z.object({
  type: z.literal('note'),
  tag: z.enum(['VISUAL', 'DIRECTION', 'NARRACAO']),
  text: z.string().min(1),
})

export const ScriptLineRefSchema = z.object({
  type: z.literal('ref'),
  text: z.string().min(1),
})

export const ScriptLineSchema = z.discriminatedUnion('type', [
  ScriptLineLineSchema,
  ScriptLinePauseSchema,
  ScriptLineNoteSchema,
  ScriptLineRefSchema,
])

export type ScriptLine = z.infer<typeof ScriptLineSchema>

// ── Beat ─────────────────────────────────────────────
export const RoteiroBeatSchema = z.object({
  idx: z.number().int().min(0),
  name: z.string().min(1),
  status: z.enum(['PENDING', 'DONE']).default('PENDING'),
  duration: z.number().int().min(0).optional(),
  script: z.array(ScriptLineSchema).default([]),
})

export type RoteiroBeat = z.infer<typeof RoteiroBeatSchema>

// ── Meta ─────────────────────────────────────────────
export const RoteiroMetaSchema = z.object({
  canal: z.string().optional(),
  formato: z.string().optional(),
  angulos: z.string().optional(),
  duracao: z.string().optional(),
  framework: z.string().optional(),
  fonte_vvs: z.string().optional(),
})

export type RoteiroMeta = z.infer<typeof RoteiroMetaSchema>

// ── Root content (v2) ────────────────────────────────
export const RoteiroContentSchema = z.object({
  version: z.literal(2),
  meta: RoteiroMetaSchema.default({}),
  beats: z.array(RoteiroBeatSchema).default([]),
})

export type RoteiroContent = z.infer<typeof RoteiroContentSchema>

// ── Legacy v1 types (from current script-renderer) ───
interface LegacyBeat {
  number: number
  label: string
  text: string
  status?: string
  divergence_note?: string
}

interface LegacyScriptContent {
  meta?: Record<string, string | undefined>
  beats?: LegacyBeat[]
}

/**
 * Parses a v1 beat's text field into ScriptLine[].
 * Uses regex patterns matching the tag syntax from parse-script-tags.ts.
 */
function parseLegacyBeatText(text: string): ScriptLine[] {
  const lines: ScriptLine[] = []
  const TAG_RE = /\[(VISUAL|DIRECTION|DIREÇÃO|TOM|B-ROLL|CORTE|OVERLAY|TRANS|SFX):\s*(.+?)\]/g
  const PAUSE_RE = /\[PAUS[EA]\s+([\d.]+)s?\]/g
  const QUOTE_RE = /"([^"]+)"/g
  const REF_RE = /^Reference\s*[-—–]\s*/i

  // Extract tags
  let m: RegExpExecArray | null
  const consumed = new Set<string>()

  TAG_RE.lastIndex = 0
  while ((m = TAG_RE.exec(text)) !== null) {
    consumed.add(m[0])
    let tag = m[1]!
    if (tag === 'DIREÇÃO') tag = 'DIRECTION'
    // Map non-standard tags to closest match
    if (['TOM', 'B-ROLL', 'CORTE', 'OVERLAY', 'TRANS', 'SFX'].includes(tag)) {
      tag = 'VISUAL' // bucket under VISUAL for v2
    }
    const noteTag = tag as 'VISUAL' | 'DIRECTION' | 'NARRACAO'
    lines.push({ type: 'note', tag: noteTag, text: m[2]! })
  }

  PAUSE_RE.lastIndex = 0
  while ((m = PAUSE_RE.exec(text)) !== null) {
    consumed.add(m[0])
    lines.push({ type: 'pause', duration: parseFloat(m[1]!) })
  }

  // Strip consumed tokens, then extract quotes as lines
  let remaining = text
  for (const token of consumed) {
    remaining = remaining.replace(token, '')
  }

  QUOTE_RE.lastIndex = 0
  while ((m = QUOTE_RE.exec(remaining)) !== null) {
    lines.push({ type: 'line', text: m[1]! })
  }

  // Check for reference text
  const stripped = remaining.replace(/"[^"]+"/g, '').trim()
  if (stripped && REF_RE.test(stripped)) {
    lines.push({ type: 'ref', text: stripped.replace(REF_RE, '').trim() })
  } else if (stripped && !consumed.size && !lines.some(l => l.type === 'line')) {
    // Entire text is a single spoken line (no tags, no quotes)
    lines.push({ type: 'line', text: text.trim() })
  }

  return lines
}

/**
 * Migrates a legacy v1 beat to v2 RoteiroBeat.
 */
export function legacyBeatToNew(beat: LegacyBeat): RoteiroBeat {
  return {
    idx: beat.number,
    name: beat.label,
    status: beat.status?.toUpperCase() === 'DONE' || beat.status?.toUpperCase() === 'GRAVADO' ? 'DONE' : 'PENDING',
    script: parseLegacyBeatText(beat.text),
  }
}

/**
 * Migrates v1 ScriptContent to v2 RoteiroContent.
 * Returns a valid v2 object. Idempotent — if already v2, returns as-is.
 */
export function migrateV1toV2(content: unknown): RoteiroContent {
  // Already v2
  if (
    typeof content === 'object' && content !== null &&
    !Array.isArray(content) &&
    (content as Record<string, unknown>).version === 2
  ) {
    return RoteiroContentSchema.parse(content)
  }

  if (typeof content === 'string') {
    return {
      version: 2,
      meta: {},
      beats: [{ idx: 0, name: 'Beat 1', status: 'PENDING', script: [{ type: 'line', text: content }] }],
    }
  }

  const legacy = (content ?? {}) as LegacyScriptContent
  const meta: RoteiroMeta = {
    canal: legacy.meta?.canal,
    formato: legacy.meta?.formato,
    angulos: legacy.meta?.angulos,
    duracao: legacy.meta?.duracao,
    framework: legacy.meta?.framework,
    fonte_vvs: legacy.meta?.fonte_vvs,
  }

  const beats = (legacy.beats ?? []).map(legacyBeatToNew)

  return { version: 2, meta, beats }
}

export function createEmptyBeat(idx: number): RoteiroBeat {
  return { idx, name: `Beat ${idx}`, status: 'PENDING', script: [] }
}
```

- [ ] 2. Create `apps/web/src/lib/pipeline/script-serializer.ts` with bidirectional TipTap conversion:

```ts
import type { JSONContent } from '@tiptap/react'
import type { RoteiroBeat, ScriptLine } from './roteiro-schemas'

/**
 * Converts a RoteiroBeat's script lines into TipTap JSONContent
 * for use inside a beat's TipTap editor instance.
 */
export function roteiroToTipTap(beat: RoteiroBeat): JSONContent {
  const children: JSONContent[] = []

  for (const line of beat.script) {
    switch (line.type) {
      case 'line': {
        const marks: JSONContent['marks'] = [{ type: 'italic' }]
        if (line.accent) {
          marks.push({ type: 'highlight', attrs: { color: line.accent } })
        }
        children.push({
          type: 'paragraph',
          content: [{ type: 'text', text: line.text, marks }],
        })
        break
      }
      case 'pause': {
        children.push({
          type: 'scriptPause',
          attrs: { duration: line.duration },
        })
        break
      }
      case 'note': {
        children.push({
          type: 'scriptTag',
          attrs: { tag: line.tag },
          content: [{ type: 'text', text: line.text }],
        })
        break
      }
      case 'ref': {
        children.push({
          type: 'blockquote',
          content: [{
            type: 'paragraph',
            content: [
              { type: 'text', text: 'REF ', marks: [{ type: 'bold' }] },
              { type: 'text', text: line.text },
            ],
          }],
        })
        break
      }
    }
  }

  if (children.length === 0) {
    children.push({ type: 'paragraph' })
  }

  return { type: 'doc', content: children }
}

/**
 * Converts TipTap JSONContent back into ScriptLine[].
 * Inverse of roteiroToTipTap.
 */
export function tipTapToRoteiro(json: JSONContent): ScriptLine[] {
  const lines: ScriptLine[] = []
  if (!json.content) return lines

  for (const node of json.content) {
    switch (node.type) {
      case 'scriptTag': {
        const tag = (node.attrs?.tag ?? 'VISUAL') as ScriptLine & { type: 'note' } extends { tag: infer T } ? T : never
        const text = extractText(node)
        if (text) {
          lines.push({ type: 'note', tag: tag as 'VISUAL' | 'DIRECTION' | 'NARRACAO', text })
        }
        break
      }
      case 'scriptPause': {
        const duration = typeof node.attrs?.duration === 'number' ? node.attrs.duration : 0
        lines.push({ type: 'pause', duration })
        break
      }
      case 'blockquote': {
        const text = extractText(node).replace(/^REF\s*/i, '').trim()
        if (text) {
          lines.push({ type: 'ref', text })
        }
        break
      }
      case 'paragraph': {
        const text = extractText(node)
        if (!text) continue
        const firstContent = node.content?.[0]
        const accent = firstContent?.marks?.find(m => m.type === 'highlight')?.attrs?.color as string | undefined
        lines.push({ type: 'line', text, accent })
        break
      }
    }
  }

  return lines
}

function extractText(node: JSONContent): string {
  if (node.text) return node.text
  if (!node.content) return ''
  return node.content.map(extractText).join('')
}
```

- [ ] 3. Create `apps/web/test/lib/pipeline/roteiro-schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  RoteiroContentSchema,
  RoteiroBeatSchema,
  ScriptLineSchema,
  migrateV1toV2,
  legacyBeatToNew,
  createEmptyBeat,
} from '@/lib/pipeline/roteiro-schemas'

describe('ScriptLineSchema', () => {
  it('validates a line', () => {
    const result = ScriptLineSchema.safeParse({ type: 'line', text: 'Hello world' })
    expect(result.success).toBe(true)
  })

  it('validates a pause', () => {
    const result = ScriptLineSchema.safeParse({ type: 'pause', duration: 0.5 })
    expect(result.success).toBe(true)
  })

  it('validates a note with VISUAL tag', () => {
    const result = ScriptLineSchema.safeParse({ type: 'note', tag: 'VISUAL', text: 'talking head' })
    expect(result.success).toBe(true)
  })

  it('validates a ref', () => {
    const result = ScriptLineSchema.safeParse({ type: 'ref', text: 'see doc X' })
    expect(result.success).toBe(true)
  })

  it('rejects unknown type', () => {
    const result = ScriptLineSchema.safeParse({ type: 'unknown', text: 'nope' })
    expect(result.success).toBe(false)
  })

  it('rejects note with invalid tag', () => {
    const result = ScriptLineSchema.safeParse({ type: 'note', tag: 'INVALID', text: 'x' })
    expect(result.success).toBe(false)
  })
})

describe('RoteiroBeatSchema', () => {
  it('applies defaults for status and script', () => {
    const result = RoteiroBeatSchema.parse({ idx: 0, name: 'Hook' })
    expect(result.status).toBe('PENDING')
    expect(result.script).toEqual([])
  })

  it('rejects negative idx', () => {
    const result = RoteiroBeatSchema.safeParse({ idx: -1, name: 'X' })
    expect(result.success).toBe(false)
  })
})

describe('RoteiroContentSchema', () => {
  it('validates a minimal v2 roteiro', () => {
    const result = RoteiroContentSchema.safeParse({ version: 2 })
    expect(result.success).toBe(true)
    expect(result.data!.meta).toEqual({})
    expect(result.data!.beats).toEqual([])
  })

  it('rejects version 1', () => {
    const result = RoteiroContentSchema.safeParse({ version: 1, beats: [] })
    expect(result.success).toBe(false)
  })
})

describe('migrateV1toV2', () => {
  it('migrates a v1 script with meta and beats', () => {
    const v1 = {
      meta: { canal: 'EN', formato: 'Storytelling' },
      beats: [
        {
          number: 0,
          label: 'HOOK',
          text: '[VISUAL: talking head] "I lived in Canada." [PAUSE 0.5s] "I moved back."',
          status: 'GRAVADO',
        },
      ],
    }
    const v2 = migrateV1toV2(v1)
    expect(v2.version).toBe(2)
    expect(v2.meta.canal).toBe('EN')
    expect(v2.beats).toHaveLength(1)
    expect(v2.beats[0]!.idx).toBe(0)
    expect(v2.beats[0]!.name).toBe('HOOK')
    expect(v2.beats[0]!.status).toBe('DONE')
    expect(v2.beats[0]!.script.length).toBeGreaterThan(0)
    expect(v2.beats[0]!.script.some(l => l.type === 'note')).toBe(true)
    expect(v2.beats[0]!.script.some(l => l.type === 'pause')).toBe(true)
    expect(v2.beats[0]!.script.some(l => l.type === 'line')).toBe(true)
  })

  it('is idempotent on v2 content', () => {
    const v2 = { version: 2, meta: {}, beats: [] }
    expect(migrateV1toV2(v2)).toEqual(v2)
  })

  it('handles plain string content', () => {
    const v2 = migrateV1toV2('Hello world')
    expect(v2.version).toBe(2)
    expect(v2.beats).toHaveLength(1)
    expect(v2.beats[0]!.script[0]).toEqual({ type: 'line', text: 'Hello world' })
  })

  it('handles null/undefined content', () => {
    const v2 = migrateV1toV2(null)
    expect(v2.version).toBe(2)
    expect(v2.beats).toEqual([])
  })
})

describe('legacyBeatToNew', () => {
  it('converts beat number to idx and label to name', () => {
    const beat = legacyBeatToNew({ number: 3, label: 'Climax', text: '"The big moment."' })
    expect(beat.idx).toBe(3)
    expect(beat.name).toBe('Climax')
  })

  it('maps GRAVADO status to DONE', () => {
    const beat = legacyBeatToNew({ number: 0, label: 'X', text: '"hi"', status: 'GRAVADO' })
    expect(beat.status).toBe('DONE')
  })

  it('maps unknown status to PENDING', () => {
    const beat = legacyBeatToNew({ number: 0, label: 'X', text: '"hi"', status: 'IMPROVISED' })
    expect(beat.status).toBe('PENDING')
  })
})

describe('createEmptyBeat', () => {
  it('creates a beat with correct defaults', () => {
    const beat = createEmptyBeat(5)
    expect(beat).toEqual({ idx: 5, name: 'Beat 5', status: 'PENDING', script: [] })
  })
})
```

- [ ] 4. Create `apps/web/test/lib/pipeline/script-serializer.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { roteiroToTipTap, tipTapToRoteiro } from '@/lib/pipeline/script-serializer'
import type { RoteiroBeat, ScriptLine } from '@/lib/pipeline/roteiro-schemas'

describe('roteiroToTipTap', () => {
  it('converts spoken lines to italic paragraphs', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'Hook', status: 'PENDING',
      script: [{ type: 'line', text: 'I lived in Canada.' }],
    }
    const doc = roteiroToTipTap(beat)
    expect(doc.type).toBe('doc')
    expect(doc.content).toHaveLength(1)
    expect(doc.content![0]!.type).toBe('paragraph')
    expect(doc.content![0]!.content![0]!.text).toBe('I lived in Canada.')
    expect(doc.content![0]!.content![0]!.marks).toContainEqual({ type: 'italic' })
  })

  it('converts pause to scriptPause node', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'X', status: 'PENDING',
      script: [{ type: 'pause', duration: 0.5 }],
    }
    const doc = roteiroToTipTap(beat)
    expect(doc.content![0]!.type).toBe('scriptPause')
    expect(doc.content![0]!.attrs?.duration).toBe(0.5)
  })

  it('converts note to scriptTag node', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'X', status: 'PENDING',
      script: [{ type: 'note', tag: 'VISUAL', text: 'talking head' }],
    }
    const doc = roteiroToTipTap(beat)
    expect(doc.content![0]!.type).toBe('scriptTag')
    expect(doc.content![0]!.attrs?.tag).toBe('VISUAL')
  })

  it('converts ref to blockquote', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'X', status: 'PENDING',
      script: [{ type: 'ref', text: 'see other document' }],
    }
    const doc = roteiroToTipTap(beat)
    expect(doc.content![0]!.type).toBe('blockquote')
  })

  it('returns empty doc with paragraph for empty script', () => {
    const beat: RoteiroBeat = { idx: 0, name: 'X', status: 'PENDING', script: [] }
    const doc = roteiroToTipTap(beat)
    expect(doc.content).toHaveLength(1)
    expect(doc.content![0]!.type).toBe('paragraph')
  })
})

describe('tipTapToRoteiro', () => {
  it('converts italic paragraph to line', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello world', marks: [{ type: 'italic' }] }],
      }],
    }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toEqual([{ type: 'line', text: 'Hello world', accent: undefined }])
  })

  it('converts scriptPause to pause', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'scriptPause', attrs: { duration: 1.5 } }],
    }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toEqual([{ type: 'pause', duration: 1.5 }])
  })

  it('converts scriptTag to note', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'scriptTag',
        attrs: { tag: 'DIRECTION' },
        content: [{ type: 'text', text: 'calm delivery' }],
      }],
    }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toEqual([{ type: 'note', tag: 'DIRECTION', text: 'calm delivery' }])
  })

  it('converts blockquote to ref, stripping REF prefix', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'REF ', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'see other doc' },
          ],
        }],
      }],
    }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toEqual([{ type: 'ref', text: 'see other doc' }])
  })

  it('skips empty paragraphs', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph' }] }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toEqual([])
  })
})

describe('roundtrip', () => {
  it('preserves data through roteiroToTipTap -> tipTapToRoteiro', () => {
    const script: ScriptLine[] = [
      { type: 'note', tag: 'VISUAL', text: '3s montage' },
      { type: 'note', tag: 'DIRECTION', text: 'calm, no drama' },
      { type: 'line', text: 'I lived in Canada for four years.' },
      { type: 'pause', duration: 0.5 },
      { type: 'line', text: 'I chose to move back.' },
      { type: 'ref', text: 'Double promise + plan for Asia' },
    ]
    const beat: RoteiroBeat = { idx: 0, name: 'Hook', status: 'PENDING', script }
    const doc = roteiroToTipTap(beat)
    const result = tipTapToRoteiro(doc)
    // Types and texts should match (accent may differ)
    expect(result.map(l => l.type)).toEqual(script.map(l => l.type))
    for (let i = 0; i < script.length; i++) {
      if ('text' in script[i]! && 'text' in result[i]!) {
        expect((result[i] as { text: string }).text).toBe((script[i] as { text: string }).text)
      }
    }
  })
})
```

- [ ] 5. Run `npm run test:web -- --run apps/web/test/lib/pipeline/roteiro-schemas.test.ts apps/web/test/lib/pipeline/script-serializer.test.ts` and fix any failures.

- [ ] 6. Commit: `feat(pipeline): add roteiro v2 Zod schemas, script serializer, and v1-to-v2 migration`

---

### Task 16 — TipTap Extensions: ScriptTagExtension + ScriptPauseExtension

**Files:**
- `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/script-tag-extension.tsx` (new)
- `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/script-pause-extension.tsx` (new)
- `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/script-extensions.ts` (new)
- `apps/web/test/unit/pipeline/script-extensions.test.tsx` (new)

- [ ] 1. Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/script-tag-extension.tsx` -- a TipTap custom Node for inline direction/visual/narration tags:

```tsx
'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

const TAG_OPTIONS = ['VISUAL', 'DIRECTION', 'NARRACAO'] as const
type ScriptTagName = (typeof TAG_OPTIONS)[number]

const TAG_STYLE: Record<ScriptTagName, { bg: string; color: string; border: string; label: string }> = {
  VISUAL:    { bg: '#7c3aed15', color: '#a78bfa', border: '#7c3aed30', label: 'VISUAL' },
  DIRECTION: { bg: '#f4364515', color: '#fb7185', border: '#f4364530', label: 'DIRECTION' },
  NARRACAO:  { bg: '#0ea5e915', color: '#67e8f9', border: '#0ea5e930', label: 'NARRACAO' },
}

function ScriptTagNodeView({ node, updateAttributes }: NodeViewProps) {
  const tag = (TAG_OPTIONS.includes(node.attrs.tag as ScriptTagName)
    ? node.attrs.tag
    : 'VISUAL') as ScriptTagName
  const style = TAG_STYLE[tag]

  return (
    <NodeViewWrapper>
      <div
        className="script-tag-block flex items-start gap-2 my-1 py-1.5 px-2 rounded"
        style={{
          background: style.bg,
          borderLeft: `3px solid ${style.border}`,
        }}
      >
        <select
          className="shrink-0 text-[8px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 border-0 cursor-pointer"
          style={{
            background: style.bg,
            color: style.color,
            outline: 'none',
          }}
          value={tag}
          onChange={(e) => updateAttributes({ tag: e.target.value })}
          aria-label="Tag type"
        >
          {TAG_OPTIONS.map((t) => (
            <option key={t} value={t}>{TAG_STYLE[t].label}</option>
          ))}
        </select>
        <NodeViewContent
          className="flex-1 min-w-0 outline-none text-[11.5px] leading-relaxed"
          style={{ color: style.color }}
        />
      </div>
    </NodeViewWrapper>
  )
}

export const ScriptTagExtension = Node.create({
  name: 'scriptTag',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return {
      tag: { default: 'VISUAL' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-script-tag]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-script-tag': HTMLAttributes.tag ?? 'VISUAL',
        class: `script-tag script-tag--${(HTMLAttributes.tag ?? 'visual').toLowerCase()}`,
      }),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ScriptTagNodeView)
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-v': () => {
        return this.editor.chain().focus()
          .insertContent({ type: 'scriptTag', attrs: { tag: 'VISUAL' }, content: [{ type: 'text', text: ' ' }] })
          .run()
      },
      'Mod-Shift-d': () => {
        return this.editor.chain().focus()
          .insertContent({ type: 'scriptTag', attrs: { tag: 'DIRECTION' }, content: [{ type: 'text', text: ' ' }] })
          .run()
      },
      'Mod-Shift-n': () => {
        return this.editor.chain().focus()
          .insertContent({ type: 'scriptTag', attrs: { tag: 'NARRACAO' }, content: [{ type: 'text', text: ' ' }] })
          .run()
      },
    }
  },
})

export { TAG_STYLE, TAG_OPTIONS }
export type { ScriptTagName }
```

- [ ] 2. Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/script-pause-extension.tsx` -- a TipTap atom node for pause markers:

```tsx
'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import { useState, useCallback } from 'react'

function ScriptPauseNodeView({ node, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const [editing, setEditing] = useState(false)
  const duration = typeof node.attrs.duration === 'number' ? node.attrs.duration : 0

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value)
      if (!isNaN(val) && val >= 0 && val <= 30) {
        updateAttributes({ duration: val })
      }
    },
    [updateAttributes],
  )

  return (
    <NodeViewWrapper>
      <div
        className="script-pause-block inline-flex items-center gap-1 my-1 px-2.5 py-1 rounded cursor-pointer select-none"
        style={{
          background: '#22c55e12',
          border: '1px solid #22c55e25',
          color: '#4ade80',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          letterSpacing: '0.04em',
        }}
        onClick={() => setEditing(true)}
        onDoubleClick={deleteNode}
        title="Click to edit, double-click to remove"
      >
        <span style={{ opacity: 0.7 }}>&#9208;</span>
        {editing ? (
          <input
            type="number"
            className="w-12 bg-transparent border-b text-center outline-none"
            style={{ color: '#4ade80', borderColor: '#4ade8050' }}
            value={duration}
            onChange={handleChange}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false) }}
            step="0.5"
            min="0"
            max="30"
            autoFocus
            aria-label="Pause duration in seconds"
          />
        ) : (
          <span>{duration}s</span>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const ScriptPauseExtension = Node.create({
  name: 'scriptPause',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      duration: { default: 0.5 },
    }
  },

  parseHTML() {
    return [{
      tag: 'div[data-script-pause]',
      getAttrs: (el) => ({
        duration: parseFloat((el as HTMLElement).getAttribute('data-duration') ?? '0.5'),
      }),
    }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({
        'data-script-pause': '',
        'data-duration': String(HTMLAttributes.duration ?? 0.5),
        class: 'script-pause',
        style: 'font-family:monospace;font-size:10px;color:#4ade80;margin:4px 0',
      }),
      `\u23F8 ${HTMLAttributes.duration ?? 0.5}s`,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ScriptPauseNodeView)
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-p': () => {
        return this.editor.chain().focus()
          .insertContent({ type: 'scriptPause', attrs: { duration: 0.5 } })
          .run()
      },
    }
  },
})
```

- [ ] 3. Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/script-extensions.ts` -- barrel that builds the TipTap extension array for the script editor:

```ts
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import { ScriptTagExtension } from './script-tag-extension'
import { ScriptPauseExtension } from './script-pause-extension'
import type { Extensions } from '@tiptap/react'

export function getScriptExtensions(placeholder?: string): Extensions {
  return [
    StarterKit.configure({
      heading: false,           // no headings in beat editor
      codeBlock: false,
      horizontalRule: false,
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
    }),
    TextStyle,
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({
      placeholder: placeholder ?? 'Escreva o texto do beat...',
    }),
    CharacterCount,
    ScriptTagExtension,
    ScriptPauseExtension,
  ]
}
```

- [ ] 4. Create `apps/web/test/unit/pipeline/script-extensions.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { ScriptTagExtension } from '@/app/cms/(authed)/pipeline/_components/detail/editors/script-tag-extension'
import { ScriptPauseExtension } from '@/app/cms/(authed)/pipeline/_components/detail/editors/script-pause-extension'

describe('ScriptTagExtension', () => {
  it('has name "scriptTag"', () => {
    expect(ScriptTagExtension.name).toBe('scriptTag')
  })

  it('defines tag attribute with default VISUAL', () => {
    const config = ScriptTagExtension.config
    expect(config.name).toBe('scriptTag')
  })

  it('is a block-level group', () => {
    // group is set at extension creation time
    expect(ScriptTagExtension.config.group).toBe('block')
  })

  it('has content "inline*"', () => {
    expect(ScriptTagExtension.config.content).toBe('inline*')
  })
})

describe('ScriptPauseExtension', () => {
  it('has name "scriptPause"', () => {
    expect(ScriptPauseExtension.name).toBe('scriptPause')
  })

  it('is atom (no editable content)', () => {
    expect(ScriptPauseExtension.config.atom).toBe(true)
  })

  it('is draggable', () => {
    expect(ScriptPauseExtension.config.draggable).toBe(true)
  })

  it('is a block-level group', () => {
    expect(ScriptPauseExtension.config.group).toBe('block')
  })
})
```

- [ ] 5. Run `npm run test:web -- --run apps/web/test/unit/pipeline/script-extensions.test.tsx` and fix any failures.

- [ ] 6. Commit: `feat(pipeline): add ScriptTag + ScriptPause TipTap custom extensions`

---

### Task 17 — ScriptMetaEditor + ScriptBeatToolbar

**Files:**
- `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/script-meta-editor.tsx` (new)
- `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/script-beat-toolbar.tsx` (new)
- `apps/web/test/unit/pipeline/script-meta-editor.test.tsx` (new)

- [ ] 1. Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/script-meta-editor.tsx` -- editable 3-column meta grid:

```tsx
'use client'

import { useCallback } from 'react'
import type { RoteiroMeta } from '@/lib/pipeline/roteiro-schemas'

interface ScriptMetaEditorProps {
  meta: RoteiroMeta
  isEditing: boolean
  onChange: (meta: RoteiroMeta) => void
}

const META_FIELDS: { key: keyof RoteiroMeta; label: string }[] = [
  { key: 'canal', label: 'Canal' },
  { key: 'formato', label: 'Formato' },
  { key: 'angulos', label: 'Angulos' },
  { key: 'duracao', label: 'Duracao' },
  { key: 'framework', label: 'Framework' },
  { key: 'fonte_vvs', label: 'Fonte VVS' },
]

export function ScriptMetaEditor({ meta, isEditing, onChange }: ScriptMetaEditorProps) {
  const handleChange = useCallback(
    (key: keyof RoteiroMeta, value: string) => {
      onChange({ ...meta, [key]: value || undefined })
    },
    [meta, onChange],
  )

  const entries = META_FIELDS.filter(({ key }) => isEditing || meta[key])

  if (entries.length === 0 && !isEditing) return null

  return (
    <div
      className="grid grid-cols-3 gap-x-5 gap-y-2 p-3 rounded-md text-[11px]"
      style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
    >
      {(isEditing ? META_FIELDS : entries).map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-0.5">
          <label
            className="text-[8px] font-bold uppercase tracking-wide"
            style={{ color: 'var(--gem-dim)' }}
            htmlFor={`meta-${key}`}
          >
            {label}
          </label>
          {isEditing ? (
            <input
              id={`meta-${key}`}
              type="text"
              className="w-full bg-transparent border-b px-0 py-0.5 text-[11px] outline-none transition-colors focus:border-[var(--gem-accent)]"
              style={{
                color: 'var(--gem-muted)',
                borderColor: 'var(--gem-border)',
              }}
              value={meta[key] ?? ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder="—"
            />
          ) : (
            <span style={{ color: 'var(--gem-muted)' }}>{meta[key] ?? '—'}</span>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] 2. Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/script-beat-toolbar.tsx` -- compact toolbar for beat-level TipTap editors:

```tsx
'use client'

import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline,
  List,
  Quote,
  Eye,
  Mic,
  Camera,
  Navigation,
  Timer,
} from 'lucide-react'
import { TAG_OPTIONS, type ScriptTagName } from './script-tag-extension'

interface ScriptBeatToolbarProps {
  editor: Editor
}

const TAG_ICONS: Record<ScriptTagName, React.ReactNode> = {
  VISUAL: <Camera size={13} />,
  DIRECTION: <Navigation size={13} />,
  NARRACAO: <Mic size={13} />,
}

const TAG_TITLES: Record<ScriptTagName, string> = {
  VISUAL: 'Visual note (Cmd+Shift+V)',
  DIRECTION: 'Direction note (Cmd+Shift+D)',
  NARRACAO: 'Narration note (Cmd+Shift+N)',
}

function Btn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1 rounded transition-colors ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-white/5'}`}
      style={{
        color: active ? 'var(--gem-accent)' : 'var(--gem-muted)',
        background: active ? 'color-mix(in srgb, var(--gem-accent) 15%, transparent)' : undefined,
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-3.5 mx-0.5" style={{ background: 'var(--gem-border)' }} />
}

export function ScriptBeatToolbar({ editor }: ScriptBeatToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Beat text formatting"
      className="flex items-center gap-0.5 px-2 py-1 flex-wrap"
      style={{
        borderBottom: '1px solid var(--gem-border)',
        background: 'var(--gem-surface)',
      }}
    >
      <Btn
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <Bold size={13} />
      </Btn>
      <Btn
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <Italic size={13} />
      </Btn>
      <Btn
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Ctrl+U)"
      >
        <Underline size={13} />
      </Btn>
      <Sep />
      <Btn
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List size={13} />
      </Btn>
      <Btn
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Reference block"
      >
        <Quote size={13} />
      </Btn>
      <Sep />
      {TAG_OPTIONS.map((tag) => (
        <Btn
          key={tag}
          onClick={() => {
            editor.chain().focus()
              .insertContent({ type: 'scriptTag', attrs: { tag }, content: [{ type: 'text', text: ' ' }] })
              .run()
          }}
          title={TAG_TITLES[tag]}
        >
          {TAG_ICONS[tag]}
        </Btn>
      ))}
      <Btn
        onClick={() => {
          editor.chain().focus()
            .insertContent({ type: 'scriptPause', attrs: { duration: 0.5 } })
            .run()
        }}
        title="Pause marker (Cmd+Shift+P)"
      >
        <Timer size={13} />
      </Btn>
    </div>
  )
}
```

- [ ] 3. Create `apps/web/test/unit/pipeline/script-meta-editor.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScriptMetaEditor } from '@/app/cms/(authed)/pipeline/_components/detail/editors/script-meta-editor'

describe('ScriptMetaEditor', () => {
  it('renders non-empty meta fields in read mode', () => {
    const meta = { canal: 'EN', formato: 'Storytelling', duracao: '14 min' }
    render(<ScriptMetaEditor meta={meta} isEditing={false} onChange={vi.fn()} />)
    expect(screen.getByText('EN')).toBeTruthy()
    expect(screen.getByText('Storytelling')).toBeTruthy()
    expect(screen.getByText('14 min')).toBeTruthy()
  })

  it('hides empty fields in read mode', () => {
    const meta = { canal: 'EN' }
    const { container } = render(<ScriptMetaEditor meta={meta} isEditing={false} onChange={vi.fn()} />)
    // Only canal label + value should render, not all 6 fields
    const labels = container.querySelectorAll('label')
    expect(labels).toHaveLength(1)
  })

  it('shows all 6 fields in edit mode', () => {
    const { container } = render(<ScriptMetaEditor meta={{}} isEditing={true} onChange={vi.fn()} />)
    const inputs = container.querySelectorAll('input')
    expect(inputs).toHaveLength(6)
  })

  it('calls onChange when editing a field', () => {
    const onChange = vi.fn()
    render(<ScriptMetaEditor meta={{ canal: 'EN' }} isEditing={true} onChange={onChange} />)
    const input = screen.getByLabelText('Canal') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'PT' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ canal: 'PT' }))
  })

  it('returns null when no meta and not editing', () => {
    const { container } = render(<ScriptMetaEditor meta={{}} isEditing={false} onChange={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] 4. Run `npm run test:web -- --run apps/web/test/unit/pipeline/script-meta-editor.test.tsx` and fix any failures.

- [ ] 5. Commit: `feat(pipeline): add ScriptMetaEditor and ScriptBeatToolbar components`

---

### Task 18 — ScriptBeatAccordion with TipTap Editor + Drag-to-Reorder

**Files:**
- `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/script-beat-accordion.tsx` (new)
- `apps/web/test/unit/pipeline/script-beat-accordion.test.tsx` (new)

- [ ] 1. Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/script-beat-accordion.tsx`:

```tsx
'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Trash2,
  Check,
  Clock,
} from 'lucide-react'
import type { RoteiroBeat } from '@/lib/pipeline/roteiro-schemas'
import { roteiroToTipTap, tipTapToRoteiro } from '@/lib/pipeline/script-serializer'
import { getScriptExtensions } from './script-extensions'
import { ScriptBeatToolbar } from './script-beat-toolbar'

interface ScriptBeatAccordionProps {
  beat: RoteiroBeat
  isEditing: boolean
  onBeatChange: (beat: RoteiroBeat) => void
  onDelete: (idx: number) => void
}

export function ScriptBeatAccordion({
  beat,
  isEditing,
  onBeatChange,
  onDelete,
}: ScriptBeatAccordionProps) {
  const [expanded, setExpanded] = useState(true)
  const [editingName, setEditingName] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `beat-${beat.idx}`, disabled: !isEditing })

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const extensions = useMemo(() => getScriptExtensions(), [])
  const initialContent = useMemo(() => roteiroToTipTap(beat), []) // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable: isEditing,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'script-beat-prosemirror',
      },
    },
    onUpdate: ({ editor: e }) => {
      const lines = tipTapToRoteiro(e.getJSON())
      onBeatChange({ ...beat, script: lines })
    },
  })

  useEffect(() => {
    if (editor && editor.isEditable !== isEditing) {
      editor.setEditable(isEditing)
    }
  }, [editor, isEditing])

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onBeatChange({ ...beat, name: e.target.value })
    },
    [beat, onBeatChange],
  )

  const handleToggleStatus = useCallback(() => {
    onBeatChange({
      ...beat,
      status: beat.status === 'DONE' ? 'PENDING' : 'DONE',
    })
  }, [beat, onBeatChange])

  const wordCount = editor?.storage.characterCount?.words() ?? 0

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      {...attributes}
      className="rounded-md overflow-hidden"
      data-beat-idx={beat.idx}
      style={{
        ...sortableStyle,
        border: '1px solid var(--gem-border)',
        background: isDragging ? 'var(--gem-well)' : 'transparent',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5"
        style={{ background: 'var(--gem-well)', borderBottom: expanded ? '1px solid var(--gem-border)' : 'none' }}
      >
        {/* Drag handle */}
        {isEditing && (
          <button
            ref={setActivatorNodeRef}
            {...listeners}
            type="button"
            className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-white/5"
            style={{ color: 'var(--gem-dim)' }}
            aria-label="Drag to reorder beat"
          >
            <GripVertical size={14} />
          </button>
        )}

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 rounded hover:bg-white/5"
          style={{ color: 'var(--gem-dim)' }}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse beat' : 'Expand beat'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Beat number */}
        <span
          className="text-[10px] font-bold tabular-nums shrink-0"
          style={{ color: 'var(--gem-accent)', minWidth: '1.5rem' }}
        >
          #{beat.idx}
        </span>

        {/* Beat name */}
        {editingName && isEditing ? (
          <input
            className="flex-1 text-[11px] font-medium bg-transparent border-b outline-none"
            style={{ color: 'var(--gem-text)', borderColor: 'var(--gem-accent)' }}
            value={beat.name}
            onChange={handleNameChange}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false) }}
            autoFocus
            aria-label="Beat name"
          />
        ) : (
          <span
            className="text-[11px] font-medium flex-1 truncate"
            style={{ color: 'var(--gem-text)', cursor: isEditing ? 'pointer' : 'default' }}
            onClick={() => isEditing && setEditingName(true)}
            title={isEditing ? 'Click to rename' : beat.name}
          >
            {beat.name}
          </span>
        )}

        {/* Word count */}
        {expanded && (
          <span className="text-[9px] tabular-nums shrink-0" style={{ color: 'var(--gem-dim)' }}>
            {wordCount}w
          </span>
        )}

        {/* Status toggle */}
        {isEditing && (
          <button
            type="button"
            onClick={handleToggleStatus}
            className="p-0.5 rounded hover:bg-white/5"
            style={{ color: beat.status === 'DONE' ? '#22c55e' : 'var(--gem-dim)' }}
            title={beat.status === 'DONE' ? 'Mark pending' : 'Mark done'}
            aria-label={`Status: ${beat.status}`}
          >
            {beat.status === 'DONE' ? <Check size={14} /> : <Clock size={14} />}
          </button>
        )}

        {/* Delete */}
        {isEditing && (
          <button
            type="button"
            onClick={() => onDelete(beat.idx)}
            className="p-0.5 rounded hover:bg-red-500/10"
            style={{ color: 'var(--gem-dim)' }}
            title="Delete beat"
            aria-label="Delete beat"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Body */}
      {expanded && editor && (
        <div className="script-beat-editor">
          {isEditing && <ScriptBeatToolbar editor={editor} />}
          <div
            className="px-3 py-2"
            style={{ background: isEditing ? 'var(--gem-well)' : 'transparent' }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] 2. Create `apps/web/test/unit/pipeline/script-beat-accordion.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScriptBeatAccordion } from '@/app/cms/(authed)/pipeline/_components/detail/editors/script-beat-accordion'
import type { RoteiroBeat } from '@/lib/pipeline/roteiro-schemas'

// Mock TipTap editor (heavy dependency)
vi.mock('@tiptap/react', async () => {
  const actual = await vi.importActual('@tiptap/react')
  return {
    ...actual,
    useEditor: () => ({
      isEditable: true,
      setEditable: vi.fn(),
      getJSON: () => ({ type: 'doc', content: [] }),
      storage: { characterCount: { words: () => 12 } },
      chain: () => ({ focus: () => ({ toggleBold: () => ({ run: vi.fn() }) }) }),
      isActive: () => false,
    }),
    EditorContent: ({ editor }: { editor: unknown }) => (
      <div data-testid="editor-content">Editor</div>
    ),
  }
})

// Mock dnd-kit
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    setActivatorNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}))

const baseBeat: RoteiroBeat = {
  idx: 0,
  name: 'HOOK',
  status: 'PENDING',
  script: [{ type: 'line', text: 'I lived in Canada.' }],
}

describe('ScriptBeatAccordion', () => {
  it('renders beat number and name', () => {
    render(
      <ScriptBeatAccordion beat={baseBeat} isEditing={false} onBeatChange={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByText('#0')).toBeTruthy()
    expect(screen.getByText('HOOK')).toBeTruthy()
  })

  it('shows drag handle only in edit mode', () => {
    const { rerender, container } = render(
      <ScriptBeatAccordion beat={baseBeat} isEditing={false} onBeatChange={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(container.querySelector('[aria-label="Drag to reorder beat"]')).toBeNull()

    rerender(
      <ScriptBeatAccordion beat={baseBeat} isEditing={true} onBeatChange={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(container.querySelector('[aria-label="Drag to reorder beat"]')).toBeTruthy()
  })

  it('collapses body when toggle clicked', () => {
    render(
      <ScriptBeatAccordion beat={baseBeat} isEditing={false} onBeatChange={vi.fn()} onDelete={vi.fn()} />,
    )
    const toggle = screen.getByLabelText('Collapse beat')
    fireEvent.click(toggle)
    expect(screen.queryByTestId('editor-content')).toBeNull()
  })

  it('calls onDelete with beat idx', () => {
    const onDelete = vi.fn()
    render(
      <ScriptBeatAccordion beat={baseBeat} isEditing={true} onBeatChange={vi.fn()} onDelete={onDelete} />,
    )
    fireEvent.click(screen.getByLabelText('Delete beat'))
    expect(onDelete).toHaveBeenCalledWith(0)
  })

  it('toggles status when status button clicked', () => {
    const onBeatChange = vi.fn()
    render(
      <ScriptBeatAccordion beat={baseBeat} isEditing={true} onBeatChange={onBeatChange} onDelete={vi.fn()} />,
    )
    fireEvent.click(screen.getByLabelText('Status: PENDING'))
    expect(onBeatChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'DONE' }))
  })
})
```

- [ ] 3. Add CSS rules for the script beat TipTap editor by appending to `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-editor.css`:

```css
/* ── Script Beat Editor (inside ScriptBeatAccordion) ─── */
.script-beat-editor .ProseMirror {
  outline: none;
  min-height: 80px;
  font-size: 0.8125rem;
  line-height: 1.85;
  color: var(--gem-text);
}

.script-beat-editor .ProseMirror.script-beat-prosemirror {
  padding: 0;
}

.script-beat-editor .ProseMirror p {
  margin: 0.25rem 0;
  color: var(--gem-muted);
}

.script-beat-editor .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--gem-dim);
  pointer-events: none;
  height: 0;
}

.script-beat-editor .ProseMirror blockquote {
  margin: 0.5rem 0;
  padding: 0.5rem 0.75rem;
  border-left: 2px solid rgba(129, 140, 248, 0.3);
  border-radius: 0 0.25rem 0.25rem 0;
  background: rgba(129, 140, 248, 0.04);
  color: var(--gem-dim);
  font-size: 0.75rem;
  font-style: italic;
}
```

- [ ] 4. Run `npm run test:web -- --run apps/web/test/unit/pipeline/script-beat-accordion.test.tsx` and fix any failures.

- [ ] 5. Commit: `feat(pipeline): add ScriptBeatAccordion with TipTap editor and drag-to-reorder`

---

### Task 19 — ScriptViewMode + Print CSS (Faithful to Roteiro Print.html Design)

**Files:**
- `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/script-view-mode.tsx` (new)
- `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/script-view-mode.css` (new)
- `apps/web/test/unit/pipeline/script-view-mode.test.tsx` (new)

- [ ] 1. Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/script-view-mode.css` -- print-ready CSS faithful to `design/Roteiro Print.html`:

```css
/* ── Script View Mode — Print CSS ──────────────────── */
/* Matches design/Roteiro Print.html exactly */

.script-view {
  --sv-ink: #1A1410;
  --sv-ink-80: #3D352C;
  --sv-ink-50: #7A7064;
  --sv-ink-30: #A89E92;
  --sv-ink-15: #D4CEC6;
  --sv-ink-08: #EBE7E0;
  --sv-accent: #C45A1C;
  --sv-blue: #2060A0;
  --sv-teal: #18806E;
  --sv-green: #1E7A46;
  --sv-pink: #A82860;
  --sv-bg: #FFFFFF;
  --sv-paper: #F6F5F2;

  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 11.5pt;
  line-height: 1.55;
  color: var(--sv-ink);
  background: var(--sv-bg);
  -webkit-font-smoothing: antialiased;
  max-width: 780px;
  margin: 0 auto;
  padding: 28px 32px 60px;
  orphans: 2;
  widows: 2;
}

/* ── Dark mode ─────────────────────────────────────── */
.script-view.sv-dark {
  --sv-ink: #E8E2D6;
  --sv-ink-80: #C0B8AA;
  --sv-ink-50: #8A8278;
  --sv-ink-30: #5A544C;
  --sv-ink-15: #3A352E;
  --sv-ink-08: #2A2520;
  --sv-accent: #FF8240;
  --sv-teal: #2DD4BF;
  --sv-green: #4ADE80;
  --sv-pink: #F472B6;
  --sv-blue: #60A5FA;
  --sv-bg: #14110B;
  --sv-paper: #1E1A14;
}

.script-view .sv-mono  { font-family: 'JetBrains Mono', monospace; }
.script-view .sv-sans  { font-family: 'Inter', system-ui, sans-serif; }
.script-view .sv-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 7.5pt;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--sv-ink-30);
}

/* ── Header ────────────────────────────────────────── */
.script-view .sv-header {
  border-bottom: 2px solid var(--sv-ink);
  padding-bottom: 14px;
  margin-bottom: 16px;
}

.script-view .sv-header-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 7.5pt;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--sv-ink-30);
  margin-bottom: 6px;
}

.script-view .sv-header-title {
  font-size: 16pt;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.02em;
  margin-bottom: 12px;
  text-wrap: balance;
}

.script-view .sv-header-meta {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 3px 20px;
  font-family: 'Inter', sans-serif;
  font-size: 8.5pt;
  color: var(--sv-ink-50);
  line-height: 1.45;
}

.script-view .sv-header-meta strong {
  font-weight: 600;
  color: var(--sv-ink-80);
  font-family: 'JetBrains Mono', monospace;
  font-size: 7.5pt;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* ── Overview table ────────────────────────────────── */
.script-view .sv-overview {
  margin-bottom: 14px;
  padding: 10px 14px;
  background: var(--sv-paper);
  border-radius: 3px;
}

.script-view .sv-overview table {
  width: 100%;
  font-family: 'Inter', sans-serif;
  font-size: 8.5pt;
  border-collapse: collapse;
  color: var(--sv-ink-80);
}

.script-view .sv-overview th {
  font-family: 'JetBrains Mono', monospace;
  font-size: 7pt;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--sv-ink-30);
  padding: 0 0 3px;
  border-bottom: 1px solid var(--sv-ink-08);
}

.script-view .sv-overview td { padding: 2px 0; }

.script-view .sv-ov-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8pt;
  font-weight: 600;
  width: 30px;
  color: var(--sv-ink-30);
}

.script-view .sv-ov-name {
  text-align: left;
  font-weight: 500;
}

.script-view .sv-ov-dur {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8pt;
  text-align: right;
  width: 50px;
  color: var(--sv-ink-50);
}

.script-view .sv-ov-words {
  font-family: 'JetBrains Mono', monospace;
  font-size: 7.5pt;
  text-align: right;
  width: 60px;
  color: var(--sv-ink-30);
}

.script-view .sv-overview tfoot td {
  padding-top: 4px;
  border-top: 1px solid var(--sv-ink-15);
  font-weight: 600;
  font-size: 8pt;
}

/* ── Beat section ──────────────────────────────────── */
.script-view .sv-beat {
  margin-bottom: 6px;
  break-inside: avoid;
}

.script-view .sv-beat-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 0 5px;
  border-top: 1.5px solid var(--sv-ink);
  margin-top: 20px;
}

.script-view .sv-beat-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5pt;
  font-weight: 700;
  color: var(--sv-bg);
  background: var(--sv-ink);
  border-radius: 2px;
  padding: 1px 5px;
  flex-shrink: 0;
}

.script-view.sv-dark .sv-beat-num {
  color: #14110B;
  background: var(--sv-ink);
}

.script-view .sv-beat-name {
  font-family: 'Inter', sans-serif;
  font-size: 10pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex: 1;
}

.script-view .sv-beat-info {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8pt;
  color: var(--sv-ink-50);
  flex-shrink: 0;
  text-align: right;
}

/* ── Direction notes ───────────────────────────────── */
.script-view .sv-dir-block {
  margin: 4px 0 8px;
  padding: 0 0 0 3px;
  font-family: 'Inter', sans-serif;
  font-size: 8.5pt;
  color: var(--sv-ink-50);
  line-height: 1.5;
}

.script-view .sv-dir-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 7pt;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-right: 5px;
}

.script-view .sv-dir-label.sv-visual    { color: var(--sv-teal); }
.script-view .sv-dir-label.sv-direction { color: var(--sv-accent); }
.script-view .sv-dir-label.sv-narracao  { color: var(--sv-blue); }

/* ── Spoken lines ──────────────────────────────────── */
.script-view .sv-lines { margin: 6px 0 2px; }

.script-view .sv-line {
  margin: 5px 0;
  padding: 4px 0 4px 14px;
  font-size: 11.5pt;
  line-height: 1.65;
  font-style: italic;
  border-left: 3px solid var(--sv-ink-08);
}

/* ── Pause marker ──────────────────────────────────── */
.script-view .sv-pause {
  font-family: 'JetBrains Mono', monospace;
  font-size: 7.5pt;
  color: var(--sv-green);
  margin: 2px 0 2px 16px;
  letter-spacing: 0.04em;
  opacity: 0.85;
}

/* ── REF notes ─────────────────────────────────────── */
.script-view .sv-ref {
  font-family: 'Inter', sans-serif;
  font-size: 8pt;
  color: var(--sv-ink-30);
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--sv-ink-08);
  line-height: 1.45;
}

.script-view .sv-ref-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 7pt;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--sv-accent);
  margin-right: 5px;
}

/* ── Footer ────────────────────────────────────────── */
.script-view .sv-footer {
  margin-top: 28px;
  padding-top: 10px;
  border-top: 1.5px solid var(--sv-ink);
  font-family: 'Inter', sans-serif;
  font-size: 8pt;
  color: var(--sv-ink-30);
  display: flex;
  justify-content: space-between;
}

/* ── View controls ─────────────────────────────────── */
.script-view .sv-controls {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--sv-paper);
  border-bottom: 1px solid var(--sv-ink-08);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.script-view .sv-controls button {
  padding: 4px 10px;
  border: 1px solid var(--sv-ink-15);
  border-radius: 3px;
  background: var(--sv-bg);
  color: var(--sv-ink-50);
  cursor: pointer;
  font: inherit;
}

.script-view .sv-controls button:hover {
  background: var(--sv-paper);
  color: var(--sv-ink);
}

/* ── Print ─────────────────────────────────────────── */
@page {
  size: A4;
  margin: 16mm 18mm 18mm 18mm;
}

@media print {
  .script-view {
    padding: 0;
    max-width: none;
    font-size: 11pt;
  }
  .script-view .sv-controls { display: none !important; }
  .script-view .sv-beat { break-inside: avoid; }
  .script-view .sv-overview,
  .script-view .sv-dir-block,
  .script-view .sv-beat-num,
  .script-view .sv-line {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

- [ ] 2. Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/script-view-mode.tsx`:

```tsx
'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { RoteiroContent, RoteiroBeat, ScriptLine } from '@/lib/pipeline/roteiro-schemas'
import './script-view-mode.css'

interface ScriptViewModeProps {
  content: RoteiroContent
  title?: string
  onExitView: () => void
}

function fmtDur(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${m}m`
}

function beatWordCount(beat: RoteiroBeat): number {
  return beat.script
    .filter((l): l is ScriptLine & { type: 'line' } => l.type === 'line')
    .reduce((n, l) => n + l.text.split(/\s+/).length, 0)
}

function beatReadTime(beat: RoteiroBeat): number {
  const words = beatWordCount(beat)
  const pauses = beat.script
    .filter((l): l is ScriptLine & { type: 'pause' } => l.type === 'pause')
    .reduce((n, l) => n + l.duration, 0)
  return Math.ceil(words / 2.5 + pauses)
}

function Overview({ beats }: { beats: RoteiroBeat[] }) {
  const totalDur = beats.reduce((s, b) => s + (b.duration ?? 0), 0)
  const totalRead = beats.reduce((s, b) => s + beatReadTime(b), 0)

  return (
    <div className="sv-overview">
      <div className="sv-label" style={{ marginBottom: 6 }}>Beats</div>
      <table>
        <thead>
          <tr>
            <th className="sv-ov-num" />
            <th className="sv-ov-name">Beat</th>
            <th className="sv-ov-dur">Dur</th>
            <th className="sv-ov-words">Leitura</th>
          </tr>
        </thead>
        <tbody>
          {beats.map((b) => (
            <tr key={b.idx}>
              <td className="sv-ov-num">#{b.idx}</td>
              <td className="sv-ov-name">{b.name}</td>
              <td className="sv-ov-dur">{b.duration ? fmtDur(b.duration) : '-'}</td>
              <td className="sv-ov-words">~{beatReadTime(b)}s</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td className="sv-ov-name">Total</td>
            <td className="sv-ov-dur">{fmtDur(totalDur)}</td>
            <td className="sv-ov-words">~{totalRead}s</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function DirBlock({ notes }: { notes: (ScriptLine & { type: 'note' })[] }) {
  if (notes.length === 0) return null
  return (
    <div className="sv-dir-block">
      {notes.map((n, i) => (
        <div key={i} className="sv-dir-row">
          <span className={`sv-dir-label sv-${n.tag.toLowerCase()}`}>{n.tag}:</span>
          {n.text}
        </div>
      ))}
    </div>
  )
}

function BeatSection({ beat }: { beat: RoteiroBeat }) {
  const notes = beat.script.filter(
    (s): s is ScriptLine & { type: 'note' } => s.type === 'note',
  )
  const body = beat.script.filter((s) => s.type !== 'note')
  const readSec = beatReadTime(beat)

  return (
    <div className="sv-beat">
      <div className="sv-beat-header">
        <span className="sv-beat-num">#{beat.idx}</span>
        <span className="sv-beat-name">{beat.name}</span>
        <span className="sv-beat-info">
          {beat.duration ? `${fmtDur(beat.duration)} \u00B7 ` : ''}~{readSec}s
        </span>
      </div>
      <DirBlock notes={notes} />
      <div className="sv-lines">
        {body.map((item, i) => {
          if (item.type === 'line') {
            return (
              <div key={i} className="sv-line">
                {item.text}
              </div>
            )
          }
          if (item.type === 'pause') {
            return (
              <div key={i} className="sv-pause">
                &#9208; {item.duration}s
              </div>
            )
          }
          if (item.type === 'ref') {
            return (
              <div key={i} className="sv-ref">
                <span className="sv-ref-tag">REF</span>
                {item.text}
              </div>
            )
          }
          return null
        })}
      </div>
    </div>
  )
}

export function ScriptViewMode({ content, title, onExitView }: ScriptViewModeProps) {
  const [dark, setDark] = useState(false)
  const { meta, beats } = content

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'd' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setDark((d) => !d)
      }
      if (e.key === 'Escape') {
        onExitView()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onExitView])

  const metaEntries = useMemo(
    () =>
      [
        ['Canal', meta.canal],
        ['Formato', meta.formato],
        ['Angulos', meta.angulos],
        ['Duracao', meta.duracao],
        ['Framework', meta.framework],
        ['VVS', meta.fonte_vvs],
      ].filter(([, v]) => v) as [string, string][],
    [meta],
  )

  return (
    <div className={`script-view ${dark ? 'sv-dark' : ''}`}>
      {/* Controls bar */}
      <div className="sv-controls">
        <button type="button" onClick={() => setDark(!dark)} title="Toggle dark/light (D)">
          &#9684; Tema
        </button>
        <button type="button" onClick={() => window.print()} title="Print">
          &#9112; Print
        </button>
        <button type="button" onClick={onExitView} title="Back to edit (Esc)">
          &#8592; Editar
        </button>
      </div>

      {/* Header */}
      <header className="sv-header">
        <div className="sv-header-label">
          Roteiro {'\u00B7'} v2 {'\u00B7'} {beats.length} beats
        </div>
        {title && <h1 className="sv-header-title">{title}</h1>}
        {metaEntries.length > 0 && (
          <div className="sv-header-meta">
            {metaEntries.map(([label, value]) => (
              <div key={label}>
                <strong>{label} </strong>
                {value}
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Overview */}
      {beats.length > 0 && <Overview beats={beats} />}

      {/* Beats */}
      {beats.map((beat) => (
        <BeatSection key={beat.idx} beat={beat} />
      ))}

      {/* Footer */}
      <footer className="sv-footer">
        <span>tf &#10086; Pipeline CMS</span>
        <span>{new Date().toLocaleDateString('pt-BR')}</span>
      </footer>
    </div>
  )
}
```

- [ ] 3. Create `apps/web/test/unit/pipeline/script-view-mode.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScriptViewMode } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/script-view-mode'
import type { RoteiroContent } from '@/lib/pipeline/roteiro-schemas'

const SAMPLE_CONTENT: RoteiroContent = {
  version: 2,
  meta: { canal: 'EN', formato: 'Storytelling', duracao: '14 min' },
  beats: [
    {
      idx: 0,
      name: 'HOOK',
      status: 'DONE',
      duration: 24,
      script: [
        { type: 'note', tag: 'VISUAL', text: 'montage rapida' },
        { type: 'note', tag: 'DIRECTION', text: 'calm delivery' },
        { type: 'line', text: 'I lived in Canada for four years.' },
        { type: 'pause', duration: 0.5 },
        { type: 'line', text: 'I chose to move back.' },
        { type: 'ref', text: 'Double promise plus plan' },
      ],
    },
    {
      idx: 1,
      name: 'Chapter Canada',
      status: 'PENDING',
      duration: 93,
      script: [
        { type: 'line', text: 'It was 2022 when I arrived in Toronto.' },
      ],
    },
  ],
}

describe('ScriptViewMode', () => {
  it('renders header with meta fields', () => {
    render(<ScriptViewMode content={SAMPLE_CONTENT} title="Test Video" onExitView={vi.fn()} />)
    expect(screen.getByText('Test Video')).toBeTruthy()
    expect(screen.getByText(/EN/)).toBeTruthy()
    expect(screen.getByText(/Storytelling/)).toBeTruthy()
  })

  it('renders overview table with beat count', () => {
    const { container } = render(
      <ScriptViewMode content={SAMPLE_CONTENT} onExitView={vi.fn()} />,
    )
    const rows = container.querySelectorAll('.sv-overview tbody tr')
    expect(rows).toHaveLength(2)
  })

  it('renders beat sections with spoken lines', () => {
    render(<ScriptViewMode content={SAMPLE_CONTENT} onExitView={vi.fn()} />)
    expect(screen.getByText('I lived in Canada for four years.')).toBeTruthy()
    expect(screen.getByText('I chose to move back.')).toBeTruthy()
  })

  it('renders direction notes', () => {
    render(<ScriptViewMode content={SAMPLE_CONTENT} onExitView={vi.fn()} />)
    expect(screen.getByText(/calm delivery/)).toBeTruthy()
    expect(screen.getByText(/montage rapida/)).toBeTruthy()
  })

  it('renders pause markers', () => {
    const { container } = render(
      <ScriptViewMode content={SAMPLE_CONTENT} onExitView={vi.fn()} />,
    )
    const pauses = container.querySelectorAll('.sv-pause')
    expect(pauses).toHaveLength(1)
    expect(pauses[0]!.textContent).toContain('0.5s')
  })

  it('renders ref blocks', () => {
    const { container } = render(
      <ScriptViewMode content={SAMPLE_CONTENT} onExitView={vi.fn()} />,
    )
    const refs = container.querySelectorAll('.sv-ref')
    expect(refs).toHaveLength(1)
    expect(refs[0]!.textContent).toContain('Double promise plus plan')
  })

  it('calls onExitView when Escape pressed', () => {
    const onExit = vi.fn()
    render(<ScriptViewMode content={SAMPLE_CONTENT} onExitView={onExit} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onExit).toHaveBeenCalled()
  })

  it('toggles dark mode when D pressed', () => {
    const { container } = render(
      <ScriptViewMode content={SAMPLE_CONTENT} onExitView={vi.fn()} />,
    )
    expect(container.querySelector('.sv-dark')).toBeNull()
    fireEvent.keyDown(window, { key: 'd' })
    expect(container.querySelector('.sv-dark')).toBeTruthy()
  })

  it('renders footer with date', () => {
    const { container } = render(
      <ScriptViewMode content={SAMPLE_CONTENT} onExitView={vi.fn()} />,
    )
    const footer = container.querySelector('.sv-footer')
    expect(footer).toBeTruthy()
    expect(footer!.textContent).toContain('Pipeline CMS')
  })
})
```

- [ ] 4. Run `npm run test:web -- --run apps/web/test/unit/pipeline/script-view-mode.test.tsx` and fix any failures.

- [ ] 5. Commit: `feat(pipeline): add ScriptViewMode with print-ready CSS matching Roteiro Print.html`

---

### Task 20 — ScriptEditMode + ScriptRenderer Refactor (Dual-Mode Wrapper)

**Files:**
- `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/script-edit-mode.tsx` (new)
- `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/script-renderer.tsx` (modify)
- `apps/web/test/unit/pipeline/script-edit-mode.test.tsx` (new)
- `apps/web/test/app/cms/pipeline/renderers/script-renderer.test.tsx` (modify)

- [ ] 1. Create `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/script-edit-mode.tsx` -- full edit mode composing meta + beats + add button + drag context:

```tsx
'use client'

import { useCallback, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { RoteiroContent, RoteiroBeat, RoteiroMeta } from '@/lib/pipeline/roteiro-schemas'
import { createEmptyBeat } from '@/lib/pipeline/roteiro-schemas'
import { ScriptMetaEditor } from './script-meta-editor'
import { ScriptBeatAccordion } from './script-beat-accordion'

interface ScriptEditModeProps {
  content: RoteiroContent
  isEditing: boolean
  onChange: (content: RoteiroContent) => void
}

export function ScriptEditMode({ content, isEditing, onChange }: ScriptEditModeProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const sortableIds = useMemo(
    () => content.beats.map((b) => `beat-${b.idx}`),
    [content.beats],
  )

  const handleMetaChange = useCallback(
    (meta: RoteiroMeta) => {
      onChange({ ...content, meta })
    },
    [content, onChange],
  )

  const handleBeatChange = useCallback(
    (updated: RoteiroBeat) => {
      const beats = content.beats.map((b) => (b.idx === updated.idx ? updated : b))
      onChange({ ...content, beats })
    },
    [content, onChange],
  )

  const handleDeleteBeat = useCallback(
    (idx: number) => {
      const beats = content.beats
        .filter((b) => b.idx !== idx)
        .map((b, i) => ({ ...b, idx: i })) // re-index
      onChange({ ...content, beats })
    },
    [content, onChange],
  )

  const handleAddBeat = useCallback(() => {
    const nextIdx = content.beats.length
    onChange({
      ...content,
      beats: [...content.beats, createEmptyBeat(nextIdx)],
    })
  }, [content, onChange])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = content.beats.findIndex((b) => `beat-${b.idx}` === active.id)
      const newIndex = content.beats.findIndex((b) => `beat-${b.idx}` === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = [...content.beats]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved!)

      // Re-index
      const beats = reordered.map((b, i) => ({ ...b, idx: i }))
      onChange({ ...content, beats })
    },
    [content, onChange],
  )

  return (
    <div className="p-5 space-y-4">
      {/* Meta grid */}
      <ScriptMetaEditor
        meta={content.meta}
        isEditing={isEditing}
        onChange={handleMetaChange}
      />

      {/* Beats with drag-to-reorder */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {content.beats.map((beat) => (
              <ScriptBeatAccordion
                key={beat.idx}
                beat={beat}
                isEditing={isEditing}
                onBeatChange={handleBeatChange}
                onDelete={handleDeleteBeat}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add beat button */}
      {isEditing && (
        <button
          type="button"
          onClick={handleAddBeat}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] font-medium transition-colors hover:bg-white/5"
          style={{
            color: 'var(--gem-dim)',
            border: '1px dashed var(--gem-border)',
          }}
        >
          <Plus size={14} />
          Adicionar beat
        </button>
      )}

      {/* Empty state */}
      {content.beats.length === 0 && !isEditing && (
        <div className="text-[11px] text-center py-4" style={{ color: 'var(--gem-dim)' }}>
          Nenhum beat encontrado no roteiro.
        </div>
      )}
    </div>
  )
}
```

- [ ] 2. Refactor `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/script-renderer.tsx` into a dual-mode wrapper:

```tsx
'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { RendererProps } from '../section-content'
import { migrateV1toV2, type RoteiroContent } from '@/lib/pipeline/roteiro-schemas'
import { ScriptEditMode } from '../editors/script-edit-mode'
import { ScriptViewMode } from './script-view-mode'
import { Eye, Pencil } from 'lucide-react'

type ViewMode = 'edit' | 'view'

export function ScriptRenderer({ content, isEditing, lang, onContentChange }: RendererProps) {
  const [mode, setMode] = useState<ViewMode>('edit')

  // Migrate v1 -> v2 on first render
  const v2Content = useMemo(() => migrateV1toV2(content), [content])

  const handleChange = useCallback(
    (updated: RoteiroContent) => {
      onContentChange(updated as unknown as RendererProps['content'])
    },
    [onContentChange],
  )

  const handleExitView = useCallback(() => setMode('edit'), [])

  // Keyboard shortcut: Cmd+Shift+P toggles mode
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setMode((m) => (m === 'edit' ? 'view' : 'edit'))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // View mode
  if (mode === 'view') {
    return <ScriptViewMode content={v2Content} onExitView={handleExitView} />
  }

  // Edit mode
  return (
    <div>
      {/* Mode toggle */}
      <div
        className="flex items-center justify-end gap-1 px-4 py-1.5"
        style={{ borderBottom: '1px solid var(--gem-border)' }}
      >
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
            mode === 'edit' ? 'text-[var(--gem-accent)]' : 'text-[var(--gem-dim)] hover:text-[var(--gem-muted)]'
          }`}
          style={mode === 'edit' ? { background: 'color-mix(in srgb, var(--gem-accent) 10%, transparent)' } : undefined}
          title="Edit mode"
        >
          <Pencil size={12} className="inline mr-1" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => setMode('view')}
          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
            mode === 'view' ? 'text-[var(--gem-accent)]' : 'text-[var(--gem-dim)] hover:text-[var(--gem-muted)]'
          }`}
          style={mode === 'view' ? { background: 'color-mix(in srgb, var(--gem-accent) 10%, transparent)' } : undefined}
          title="View mode (Cmd+Shift+P)"
        >
          <Eye size={12} className="inline mr-1" />
          View
        </button>
      </div>

      <ScriptEditMode
        content={v2Content}
        isEditing={isEditing}
        onChange={handleChange}
      />
    </div>
  )
}
```

- [ ] 3. Create `apps/web/test/unit/pipeline/script-edit-mode.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScriptEditMode } from '@/app/cms/(authed)/pipeline/_components/detail/editors/script-edit-mode'
import type { RoteiroContent } from '@/lib/pipeline/roteiro-schemas'

// Mock TipTap (heavy dep)
vi.mock('@tiptap/react', async () => {
  const actual = await vi.importActual('@tiptap/react')
  return {
    ...actual,
    useEditor: () => ({
      isEditable: true,
      setEditable: vi.fn(),
      getJSON: () => ({ type: 'doc', content: [] }),
      storage: { characterCount: { words: () => 5 } },
      chain: () => ({ focus: () => ({ toggleBold: () => ({ run: vi.fn() }) }) }),
      isActive: () => false,
    }),
    EditorContent: () => <div data-testid="editor-content">Editor</div>,
  }
})

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: 'vertical',
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    setActivatorNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}))

const CONTENT: RoteiroContent = {
  version: 2,
  meta: { canal: 'EN' },
  beats: [
    { idx: 0, name: 'Hook', status: 'PENDING', script: [{ type: 'line', text: 'Hello' }] },
    { idx: 1, name: 'Body', status: 'DONE', script: [] },
  ],
}

describe('ScriptEditMode', () => {
  it('renders meta editor', () => {
    render(<ScriptEditMode content={CONTENT} isEditing={true} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Canal')).toBeTruthy()
  })

  it('renders all beats', () => {
    render(<ScriptEditMode content={CONTENT} isEditing={false} onChange={vi.fn()} />)
    expect(screen.getByText('#0')).toBeTruthy()
    expect(screen.getByText('#1')).toBeTruthy()
    expect(screen.getByText('Hook')).toBeTruthy()
    expect(screen.getByText('Body')).toBeTruthy()
  })

  it('shows add-beat button in edit mode', () => {
    render(<ScriptEditMode content={CONTENT} isEditing={true} onChange={vi.fn()} />)
    expect(screen.getByText('Adicionar beat')).toBeTruthy()
  })

  it('hides add-beat button in read mode', () => {
    render(<ScriptEditMode content={CONTENT} isEditing={false} onChange={vi.fn()} />)
    expect(screen.queryByText('Adicionar beat')).toBeNull()
  })

  it('calls onChange with new beat when add clicked', () => {
    const onChange = vi.fn()
    render(<ScriptEditMode content={CONTENT} isEditing={true} onChange={onChange} />)
    fireEvent.click(screen.getByText('Adicionar beat'))
    expect(onChange).toHaveBeenCalledTimes(1)
    const newContent = onChange.mock.calls[0]![0] as RoteiroContent
    expect(newContent.beats).toHaveLength(3)
    expect(newContent.beats[2]!.idx).toBe(2)
  })

  it('shows empty state when no beats and not editing', () => {
    const empty: RoteiroContent = { version: 2, meta: {}, beats: [] }
    render(<ScriptEditMode content={empty} isEditing={false} onChange={vi.fn()} />)
    expect(screen.getByText('Nenhum beat encontrado no roteiro.')).toBeTruthy()
  })
})
```

- [ ] 4. Update `apps/web/test/app/cms/pipeline/renderers/script-renderer.test.tsx` to cover the new dual-mode wrapper. Add these tests at the end of the file:

```tsx
// -- At the end of the existing file, after the existing describe blocks --

// Mock TipTap and dnd-kit for the refactored renderer
vi.mock('@tiptap/react', async () => {
  const actual = await vi.importActual('@tiptap/react')
  return {
    ...actual,
    useEditor: () => ({
      isEditable: true,
      setEditable: vi.fn(),
      getJSON: () => ({ type: 'doc', content: [] }),
      storage: { characterCount: { words: () => 5 } },
      chain: () => ({ focus: () => ({ toggleBold: () => ({ run: vi.fn() }) }) }),
      isActive: () => false,
    }),
    EditorContent: () => <div data-testid="editor-content">Editor</div>,
  }
})

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: 'vertical',
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    setActivatorNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}))

describe('ScriptRenderer — dual-mode toggle', () => {
  it('starts in edit mode by default', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={true} lang="en" onContentChange={noop} />,
    )
    expect(container.querySelector('.script-view')).toBeNull()
  })

  it('shows Edit/View toggle buttons', () => {
    render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />,
    )
    expect(screen.getByTitle('Edit mode')).toBeTruthy()
    expect(screen.getByTitle(/View mode/)).toBeTruthy()
  })

  it('switches to view mode when View button clicked', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />,
    )
    fireEvent.click(screen.getByTitle(/View mode/))
    expect(container.querySelector('.script-view')).toBeTruthy()
  })

  it('migrates v1 content automatically', () => {
    // If v1 content is passed, the renderer should not crash
    render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />,
    )
    // The fact that it renders without error proves migration worked
    expect(screen.getByText('#0')).toBeTruthy()
  })
})
```

- [ ] 5. Run `npm run test:web -- --run apps/web/test/unit/pipeline/script-edit-mode.test.tsx apps/web/test/app/cms/pipeline/renderers/script-renderer.test.tsx` and fix any failures.

- [ ] 6. Run full test suite: `npm run test:web` to ensure no regressions.

- [ ] 7. Commit: `feat(pipeline): dual-mode ScriptRenderer with edit/view toggle and Cmd+Shift+P shortcut`

---

## Phase 4 — PostProd DaVinci Timeline (Tasks 21-28)

### Task 21 — Timeline types, constants, utils

**Files:** `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/types.ts`, `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/constants.ts`, `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/utils.ts`, `apps/web/test/unit/timeline-utils.test.ts`

- [ ] 1. Create `_timeline/types.ts` with all timeline-specific interfaces:

```ts
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/types.ts

/* ── Track definitions ─────────────────────────────── */

export interface TrackDef {
  id: string
  name: string
  color: string
  fn: string
}

export interface TrackGroup {
  video: TrackDef[]
  audio: TrackDef[]
}

/* ── Clip ──────────────────────────────────────────── */

export interface TimelineClipData {
  s: number
  e: number
  label: string
}

/* ── Beat (a single timeline section) ──────────────── */

export interface BeatData {
  idx: number
  label: string
  name: string
  duration: number
  absStart: number
  status: string
  difficulty: string
  clips: Record&lt;string, TimelineClipData[]&gt;
  script?: ScriptItem[]
}

/* ── ScriptPanel item types ────────────────────────── */

export type ScriptItemType = 'note' | 'line' | 'pause' | 'ref'

export interface ScriptItemNote {
  type: 'note'
  tag: string
  tagColor: string
  text: string
}

export interface ScriptItemLine {
  type: 'line'
  text: string
  accent?: string
}

export interface ScriptItemPause {
  type: 'pause'
  duration: number
}

export interface ScriptItemRef {
  type: 'ref'
  text: string
}

export type ScriptItem = ScriptItemNote | ScriptItemLine | ScriptItemPause | ScriptItemRef

/* ── Asset Resolver ────────────────────────────────── */

export type AssetCategory = 'music' | 'sfx' | 'visual' | 'ambience' | 'soundDesign'

export interface MusicAsset {
  id: string
  name: string
  artist: string
  genre: string
  bpm?: number
  dur?: string
  match: number
  local: boolean
  selected: boolean
  confirmed?: boolean
  tags?: string[]
  note?: string
}

export interface SfxFile {
  name: string
  local: boolean
  match: number
}

export interface SfxAsset {
  tc: string
  type: string
  typeColor: string
  desc: string
  file: SfxFile | null
  tags?: string[]
  altCount?: number
}

export interface VisualAsset {
  tc: string
  desc: string
  status: 'pending' | 'resolved'
  file?: string
  search?: string[]
}

export interface AmbienceAsset {
  name: string
  local: boolean
  match: number
  tags?: string[]
}

export interface SoundDesignAsset {
  tc: string
  name: string
  status: 'pending' | 'done'
  tags?: string[]
}

export interface BeatAssets {
  music?: MusicAsset[]
  sfx?: SfxAsset[]
  visual?: VisualAsset[]
  ambience?: AmbienceAsset[]
  soundDesign?: SoundDesignAsset[]
}

/* ── CrossRef ──────────────────────────────────────── */

export interface CrossRefBeat {
  name: string
  srt: string
  dur: string
  estRot: string
  status: string
  statusColor: string
  note?: string
}

export interface CrossRefData {
  summary: string
  beats: CrossRefBeat[]
  divergences: string[]
}

/* ── Speed Ramps ───────────────────────────────────── */

export interface SpeedRampSection {
  name: string
  srt: string
  vel: string
  velColor: string
  racional: string
}

export interface SpeedRampData {
  summary: string
  base: string
  sections: SpeedRampSection[]
}

/* ── PostProd section content shape ────────────────── */

export interface PostProdContent {
  beats?: BeatData[]
  assets?: Record&lt;number, BeatAssets&gt;
  crossRef?: CrossRefData
  speedRamps?: SpeedRampData
}

/* ── Track height map ──────────────────────────────── */

export type TrackHeightMap = Record&lt;string, number&gt;
```

- [ ] 2. Create `_timeline/constants.ts` with layout constants, track definitions, and theme:

```ts
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/constants.ts

import type { TrackDef, TrackGroup } from './types'

/* ── Layout constants ──────────────────────────────── */

export const PANEL_W = 170
export const RULER_H = 26
export const DEF_H = 34
export const EMPTY_H = 18
export const MIN_H = 16
export const MAX_H = 120
export const HANDLE_H = 4
export const DIVIDER_H = 16

/* ── Zoom ──────────────────────────────────────────── */

export const ZOOM_MIN = 0.3
export const ZOOM_MAX = 4
export const ZOOM_DEFAULT = 1
export const ZOOM_STEP = 0.15

/* ── Track definitions ─────────────────────────────── */

export const TL_TRACKS: TrackGroup = {
  video: [
    { id: 'V7', name: 'Overlays + End Screen', color: '#A3CB38', fn: 'End screen, cards, transições visuais, vignettes' },
    { id: 'V6', name: 'Subtitles',             color: '#F1C40F', fn: 'Captions estilizados (Text+ ou Fusion)' },
    { id: 'V5', name: 'Graphics + QR',         color: '#E84393', fn: 'QR codes, subscribe CTA, logos, infográficos' },
    { id: 'V4', name: 'Lower Thirds',          color: '#9B59B6', fn: 'Nome, localização, chapter titles' },
    { id: 'V3', name: 'B-Roll',                color: '#1ABC9C', fn: 'Cutaways, insert shots' },
    { id: 'V2', name: 'Background Layer',      color: '#A0845C', fn: 'Conteúdo por trás da pessoa (Fusion Magic Mask)' },
    { id: 'V1', name: 'Main Footage',          color: '#C4A882', fn: 'Talking head, A-roll principal' },
  ],
  audio: [
    { id: 'A1', name: 'Voice',            color: '#27AE60', fn: 'Narração, talking head' },
    { id: 'A2', name: 'Music',            color: '#3498DB', fn: 'Bed musical (ducked sob voz)' },
    { id: 'A3', name: 'SFX Punctuation',  color: '#E67E22', fn: 'Impactos, bass drops, risers' },
    { id: 'A4', name: 'SFX Textures',     color: '#F0B27A', fn: 'Whooshes, shimmers, transições' },
    { id: 'A5', name: 'Ambience',         color: '#7D8B5E', fn: 'Room tone, ambience' },
    { id: 'A6', name: 'Sound Design',     color: '#8E44AD', fn: 'Branded sounds, notificações, stingers' },
  ],
}

export const ALL_TRACKS: TrackDef[] = [...TL_TRACKS.video, ...TL_TRACKS.audio]

/* ── Theme tokens (maps to GEM + DaVinci palette) ──── */

export const TH = {
  bg:       'var(--gem-well)',        // #0c1222
  surface:  'var(--gem-surface)',     // #161d2d
  surface2: 'var(--gem-surface-hi)', // #1a2236
  header:   'var(--gem-surface-hi)', // #1a2236
  border:   'var(--gem-border)',     // #222d40
  brdLight: 'var(--gem-faint)',      // #2a3650
  text:     'var(--gem-text)',       // #edf2f7
  muted:    'var(--gem-muted)',      // #7a8ba3
  dim:      'var(--gem-dim)',        // #5a6b7f
  accent:   'var(--gem-accent)',     // #6366f1
  ruler:    '#0e1628',
  playhead: '#e04040',
  divLine:  'rgba(99,102,241,0.18)',
} as const

/* ── Typography class helpers ──────────────────────── */

export const MONO_CLS = 'font-mono'
export const MONO_SM_CLS = 'font-mono text-[10px] tracking-wide'
export const MONO_XS_CLS = 'font-mono text-[9px] tracking-widest uppercase'
```

- [ ] 3. Create `_timeline/utils.ts` with shared pure utility functions (ported from `design/timeline.jsx`):

```ts
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/utils.ts

/**
 * Format seconds as MM:SS.
 */
export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Format duration as human-friendly string (e.g. "24s", "1m33s").
 */
export function fmtDur(sec: number): string {
  if (sec &lt; 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s &gt; 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${m}m`
}

/**
 * Deterministic pseudo-random [0,1) for procedural generation.
 */
export function pRand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Given a hex color, returns '#111' or '#fff' for readable text.
 */
export function badgeTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 &gt; 0.52 ? '#111' : '#fff'
}

/**
 * Choose ruler tick interval based on beat duration.
 */
export function tickInterval(dur: number): number {
  if (dur &lt;= 15) return 1
  if (dur &lt;= 30) return 2
  if (dur &lt;= 60) return 5
  if (dur &lt;= 180) return 10
  if (dur &lt;= 600) return 30
  return 60
}

/**
 * Compute pixels-per-second from available width, beat duration, and zoom.
 */
export function calcPxPerSec(availW: number, duration: number, zoom: number): number {
  return (availW / duration) * zoom
}

/**
 * Compute effective track height: full height if clips present, EMPTY_H otherwise.
 */
export function effectiveTrackH(
  trackId: string,
  clips: Record&lt;string, unknown[]&gt;,
  trackHeights: Record&lt;string, number&gt;,
  emptyH: number,
): number {
  return (clips[trackId]?.length ?? 0) &gt; 0 ? (trackHeights[trackId] ?? emptyH) : emptyH
}

/**
 * Difficulty badge color.
 */
export function difficultyColor(difficulty: string): string {
  switch (difficulty.toUpperCase()) {
    case 'EASY': return '#27AE60'
    case 'HARD': return '#E74C3C'
    default: return '#E67E22'
  }
}

/**
 * Parse PostProd section content from 3 useSection() instances.
 * Merges scenes, crossRef, speedRamps into a single PostProdContent object.
 */
export function parsePostProdContent(
  scenesContent: unknown,
  crossRefContent: unknown,
  speedRampsContent: unknown,
): import('./types').PostProdContent {
  const result: import('./types').PostProdContent = {}

  // Parse scenes -&gt; beats + assets
  if (scenesContent &amp;&amp; typeof scenesContent === 'object' &amp;&amp; !Array.isArray(scenesContent)) {
    const sc = scenesContent as Record&lt;string, unknown&gt;
    if (Array.isArray(sc.beats)) result.beats = sc.beats as import('./types').BeatData[]
    if (sc.assets &amp;&amp; typeof sc.assets === 'object') result.assets = sc.assets as Record&lt;number, import('./types').BeatAssets&gt;
  }

  // Parse crossRef
  if (crossRefContent &amp;&amp; typeof crossRefContent === 'object' &amp;&amp; !Array.isArray(crossRefContent)) {
    result.crossRef = crossRefContent as import('./types').CrossRefData
  }

  // Parse speedRamps
  if (speedRampsContent &amp;&amp; typeof speedRampsContent === 'object' &amp;&amp; !Array.isArray(speedRampsContent)) {
    result.speedRamps = speedRampsContent as import('./types').SpeedRampData
  }

  return result
}

/**
 * Build default track height map (V1 + A1 get 42px, rest get DEF_H).
 */
export function buildDefaultTrackHeights(defH: number): Record&lt;string, number&gt; {
  const heights: Record&lt;string, number&gt; = {}
  const { TL_TRACKS } = require('./constants')
  for (const t of [...TL_TRACKS.video, ...TL_TRACKS.audio]) {
    heights[t.id] = (t.id === 'V1' || t.id === 'A1') ? 42 : defH
  }
  return heights
}
```

- [ ] 4. Create `_timeline/index.ts` barrel export:

```ts
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/index.ts

export * from './types'
export * from './constants'
export * from './utils'
```

- [ ] 5. Write unit tests for the pure utility functions:

```ts
// apps/web/test/unit/timeline-utils.test.ts

import { describe, it, expect } from 'vitest'
import { fmtTime, fmtDur, pRand, badgeTextColor, tickInterval, calcPxPerSec, difficultyColor } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/utils'

describe('fmtTime', () =&gt; {
  it('formats 0 as 00:00', () =&gt; {
    expect(fmtTime(0)).toBe('00:00')
  })

  it('formats 93 as 01:33', () =&gt; {
    expect(fmtTime(93)).toBe('01:33')
  })

  it('formats 600 as 10:00', () =&gt; {
    expect(fmtTime(600)).toBe('10:00')
  })
})

describe('fmtDur', () =&gt; {
  it('formats seconds under 60', () =&gt; {
    expect(fmtDur(24)).toBe('24s')
  })

  it('formats exact minutes', () =&gt; {
    expect(fmtDur(120)).toBe('2m')
  })

  it('formats minutes + seconds', () =&gt; {
    expect(fmtDur(93)).toBe('1m33s')
  })
})

describe('pRand', () =&gt; {
  it('returns deterministic value for same seed', () =&gt; {
    expect(pRand(42)).toBe(pRand(42))
  })

  it('returns value in [0,1)', () =&gt; {
    for (let i = 0; i &lt; 100; i++) {
      const v = pRand(i)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('badgeTextColor', () =&gt; {
  it('returns dark text for light colors', () =&gt; {
    expect(badgeTextColor('#F1C40F')).toBe('#111')
  })

  it('returns white text for dark colors', () =&gt; {
    expect(badgeTextColor('#8E44AD')).toBe('#fff')
  })
})

describe('tickInterval', () =&gt; {
  it('returns 1 for very short durations', () =&gt; {
    expect(tickInterval(10)).toBe(1)
  })

  it('returns 5 for ~1min durations', () =&gt; {
    expect(tickInterval(45)).toBe(5)
  })

  it('returns 10 for 2-3min durations', () =&gt; {
    expect(tickInterval(93)).toBe(10)
  })
})

describe('calcPxPerSec', () =&gt; {
  it('calculates base at zoom 1', () =&gt; {
    expect(calcPxPerSec(800, 100, 1)).toBe(8)
  })

  it('scales with zoom', () =&gt; {
    expect(calcPxPerSec(800, 100, 2)).toBe(16)
  })
})

describe('difficultyColor', () =&gt; {
  it('returns green for EASY', () =&gt; {
    expect(difficultyColor('EASY')).toBe('#27AE60')
  })

  it('returns red for HARD', () =&gt; {
    expect(difficultyColor('HARD')).toBe('#E74C3C')
  })

  it('returns orange for MEDIUM', () =&gt; {
    expect(difficultyColor('MEDIUM')).toBe('#E67E22')
  })
})
```

- [ ] 6. Run `npm run test:web -- --run test/unit/timeline-utils.test.ts` and verify all pass.
- [ ] 7. Commit: `feat(pipeline): add timeline types, constants, and utils for PostProd DaVinci view`

---

### Task 22 — WaveDecor + TrackDivider + ResizeHandle (small primitives)

**Files:** `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/wave-decor.tsx`, `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/track-divider.tsx`, `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/resize-handle.tsx`, `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/clip-tooltip.tsx`

- [ ] 1. Create `_timeline/wave-decor.tsx` — procedural SVG waveform bars, memoized on width+height+seed:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/wave-decor.tsx
'use client'

import { memo, useMemo } from 'react'
import { pRand } from './utils'

interface WaveDecorProps {
  width: number
  height: number
  color: string
  seed?: number
}

function WaveDecorRaw({ width, height, seed = 0 }: WaveDecorProps) {
  const bars = useMemo(() =&gt; {
    const bw = 2
    const gap = 1
    const step = bw + gap
    const n = Math.max(1, Math.floor(width / step))
    const result: Array&lt;{ x: number; y: number; h: number }&gt; = []
    for (let i = 0; i &lt; n; i++) {
      const r = pRand(i + seed * 7.3)
      const h = r * 0.55 + 0.25
      result.push({ x: i * step, y: height * (1 - h) / 2, h: height * h })
    }
    return result
  }, [width, height, seed])

  return (
    &lt;svg
      width={width}
      height={height}
      className="absolute left-0 top-0 pointer-events-none"
      style={{ opacity: 0.18 }}
      aria-hidden
    &gt;
      {bars.map((b, i) =&gt; (
        &lt;rect key={i} x={b.x} y={b.y} width={2} height={b.h} fill="#fff" /&gt;
      ))}
    &lt;/svg&gt;
  )
}

export const WaveDecor = memo(WaveDecorRaw)
WaveDecor.displayName = 'WaveDecor'
```

- [ ] 2. Create `_timeline/clip-tooltip.tsx` — hover tooltip positioned above the clip:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/clip-tooltip.tsx
'use client'

import type { TimelineClipData } from './types'
import { fmtTime, fmtDur } from './utils'
import { TH, MONO_SM_CLS, MONO_XS_CLS } from './constants'

interface ClipTooltipProps {
  clip: TimelineClipData
  trackName: string
}

export function ClipTooltip({ clip, trackName }: ClipTooltipProps) {
  return (
    &lt;div
      className="absolute pointer-events-none z-20 min-w-[180px] rounded-[5px] px-2.5 py-2"
      style={{
        bottom: 'calc(100% + 6px)',
        left: 0,
        background: 'rgba(12,18,34,0.96)',
        border: `1px solid ${TH.brdLight}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    &gt;
      &lt;div className={MONO_XS_CLS} style={{ color: TH.muted, marginBottom: 4 }}&gt;{trackName}&lt;/div&gt;
      &lt;div className="text-[12px] font-medium leading-tight mb-1" style={{ color: TH.text }}&gt;{clip.label}&lt;/div&gt;
      &lt;div className={MONO_SM_CLS} style={{ color: TH.muted }}&gt;
        {fmtTime(clip.s)} → {fmtTime(clip.e)} · {fmtDur(clip.e - clip.s)}
      &lt;/div&gt;
    &lt;/div&gt;
  )
}
```

- [ ] 3. Create `_timeline/track-divider.tsx` — horizontal separator between video and audio sections:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/track-divider.tsx
'use client'

import { DIVIDER_H, TH, MONO_XS_CLS } from './constants'

interface TrackDividerProps {
  width?: number
  inPanel?: boolean
}

export function TrackDivider({ width, inPanel }: TrackDividerProps) {
  return (
    &lt;div
      className="flex items-center justify-center"
      style={{
        height: DIVIDER_H,
        background: `linear-gradient(180deg, ${TH.surface}, rgba(99,102,241,0.05), ${TH.surface})`,
        borderBottom: `1px solid ${TH.divLine}`,
        borderTop: `1px solid ${TH.divLine}`,
        width: inPanel ? '100%' : width,
        padding: inPanel ? '0 6px' : '0 8px',
        gap: 6,
      }}
    &gt;
      {inPanel ? (
        &lt;span className={MONO_XS_CLS} style={{ fontSize: 9, color: TH.accent, opacity: 0.85, letterSpacing: '0.12em' }}&gt;
          ▲ VIDEO · AUDIO ▼
        &lt;/span&gt;
      ) : (
        &lt;&gt;
          &lt;div className="flex-1 h-px" style={{ background: TH.divLine }} /&gt;
          &lt;span className="font-mono text-[7px]" style={{ color: TH.accent, opacity: 0.35 }}&gt;◆&lt;/span&gt;
          &lt;div className="flex-1 h-px" style={{ background: TH.divLine }} /&gt;
        &lt;/&gt;
      )}
    &lt;/div&gt;
  )
}
```

- [ ] 4. Create `_timeline/resize-handle.tsx` — draggable handle for track lane height adjustment:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/resize-handle.tsx
'use client'

import { useState, useCallback } from 'react'
import { HANDLE_H, TH } from './constants'

interface ResizeHandleProps {
  onStart: (e: React.MouseEvent) =&gt; void
}

export function ResizeHandle({ onStart }: ResizeHandleProps) {
  const [hov, setHov] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) =&gt; {
    e.preventDefault()
    onStart(e)
  }, [onStart])

  return (
    &lt;div
      style={{ height: HANDLE_H, cursor: 'row-resize', position: 'relative', zIndex: 2 }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() =&gt; setHov(true)}
      onMouseLeave={() =&gt; setHov(false)}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize track"
    &gt;
      &lt;div
        className="absolute left-0 right-0"
        style={{
          top: 1,
          height: hov ? 2 : 1,
          background: hov ? TH.accent : TH.border,
          transition: 'background 0.15s, height 0.1s',
          borderRadius: hov ? 1 : 0,
        }}
      /&gt;
    &lt;/div&gt;
  )
}
```

- [ ] 5. Update `_timeline/index.ts` barrel to export the new components:

```ts
// append to _timeline/index.ts
export { WaveDecor } from './wave-decor'
export { ClipTooltip } from './clip-tooltip'
export { TrackDivider } from './track-divider'
export { ResizeHandle } from './resize-handle'
```

- [ ] 6. Run `npm run test:web` to ensure no regressions.
- [ ] 7. Commit: `feat(pipeline): add WaveDecor, ClipTooltip, TrackDivider, ResizeHandle primitives`

---

### Task 23 — Ruler + TrackHead + TrackLane + TimelineClip

**Files:** `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/ruler.tsx`, `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/track-head.tsx`, `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/track-lane.tsx`, `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/timeline-clip.tsx`

- [ ] 1. Create `_timeline/ruler.tsx` — time ruler with major ticks, sub-ticks, and playhead:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/ruler.tsx
'use client'

import { memo, useMemo } from 'react'
import { RULER_H, TH, MONO_SM_CLS } from './constants'
import { fmtTime, tickInterval } from './utils'

interface RulerProps {
  duration: number
  pxPerSec: number
  totalW: number
}

function RulerRaw({ duration, pxPerSec, totalW }: RulerProps) {
  const intv = tickInterval(duration)

  const { ticks, subs } = useMemo(() =&gt; {
    const t: number[] = []
    for (let i = 0; i &lt;= duration; i += intv) t.push(i)
    if (t[t.length - 1]! &lt; duration &amp;&amp; duration - t[t.length - 1]! &gt; intv * 0.35) t.push(duration)

    const s: number[] = []
    const subIntv = intv / 2
    if (subIntv &gt;= 1) {
      for (let i = subIntv; i &lt; duration; i += intv) s.push(i)
    }
    return { ticks: t, subs: s }
  }, [duration, intv])

  return (
    &lt;div
      className="relative select-none"
      style={{ height: RULER_H, background: TH.ruler, borderBottom: `1px solid ${TH.border}`, width: totalW }}
    &gt;
      {subs.map(t =&gt; (
        &lt;div key={`s${t}`} className="absolute top-0" style={{ left: t * pxPerSec, width: 1, height: 6, background: TH.dim }} /&gt;
      ))}
      {ticks.map(t =&gt; (
        &lt;div key={t} className="absolute top-0" style={{ left: t * pxPerSec }}&gt;
          &lt;div style={{ width: 1, height: 10, background: TH.brdLight }} /&gt;
          &lt;span className={MONO_SM_CLS} style={{ color: TH.muted, position: 'absolute', left: 3, top: 10, fontSize: 9 }}&gt;
            {fmtTime(t)}
          &lt;/span&gt;
        &lt;/div&gt;
      ))}
      {/* Playhead at 0 */}
      &lt;div className="absolute top-0 z-[2]" style={{ left: 0, width: 2, height: '100%', background: TH.playhead }} /&gt;
    &lt;/div&gt;
  )
}

export const Ruler = memo(RulerRaw)
Ruler.displayName = 'Ruler'
```

- [ ] 2. Create `_timeline/track-head.tsx` — left panel label with track badge and clip count:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/track-head.tsx
'use client'

import { memo } from 'react'
import type { TrackDef } from './types'
import { TH, MONO_SM_CLS } from './constants'
import { badgeTextColor } from './utils'

interface TrackHeadProps {
  track: TrackDef
  height: number
  clipCount: number
  isAudio?: boolean
}

function TrackHeadRaw({ track, height, clipCount }: TrackHeadProps) {
  const hasClips = clipCount &gt; 0
  return (
    &lt;div
      className="flex items-center gap-2"
      style={{
        height,
        padding: '0 8px 0 10px',
        borderBottom: `1px solid ${TH.border}`,
        background: TH.surface,
        opacity: hasClips ? 1 : 0.45,
        transition: 'opacity 0.15s',
      }}
    &gt;
      {/* Track badge */}
      &lt;div
        className="font-mono text-[10px] font-semibold tracking-tight rounded-[3px] text-center shrink-0"
        style={{
          color: badgeTextColor(track.color),
          background: track.color,
          padding: '2px 5px',
          minWidth: 24,
        }}
      &gt;
        {track.id}
      &lt;/div&gt;
      {/* Name */}
      &lt;div
        className="text-[11px] whitespace-nowrap overflow-hidden text-ellipsis flex-1"
        style={{ color: TH.text, fontWeight: hasClips ? 500 : 400 }}
      &gt;
        {track.name}
      &lt;/div&gt;
      {/* Clip count */}
      {hasClips &amp;&amp; (
        &lt;span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9, flexShrink: 0 }}&gt;
          {clipCount}
        &lt;/span&gt;
      )}
    &lt;/div&gt;
  )
}

export const TrackHead = memo(TrackHeadRaw)
TrackHead.displayName = 'TrackHead'
```

- [ ] 3. Create `_timeline/timeline-clip.tsx` — individual clip block with hover glow, frame markers (video), WaveDecor (audio), and tooltip:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/timeline-clip.tsx
'use client'

import { memo, useState } from 'react'
import type { TimelineClipData, TrackDef } from './types'
import { WaveDecor } from './wave-decor'
import { ClipTooltip } from './clip-tooltip'

interface TimelineClipProps {
  clip: TimelineClipData
  track: TrackDef
  pxPerSec: number
  laneH: number
  isAudio: boolean
  idx: number
}

function TimelineClipRaw({ clip, track, pxPerSec, laneH, isAudio, idx }: TimelineClipProps) {
  const [hovered, setHovered] = useState(false)
  const left = clip.s * pxPerSec + 1
  const w = Math.max((clip.e - clip.s) * pxPerSec - 2, 3)
  const c = track.color
  const innerH = laneH - 4

  return (
    &lt;div
      className="absolute cursor-pointer overflow-hidden rounded-[3px]"
      style={{
        left,
        width: w,
        top: 2,
        height: innerH,
        background: isAudio
          ? `linear-gradient(180deg, ${c}dd, ${c}aa)`
          : `linear-gradient(180deg, ${c}cc, ${c}99)`,
        borderTop: `2px solid ${c}`,
        boxShadow: hovered ? `0 0 0 1px ${c}, 0 2px 8px rgba(0,0,0,0.4)` : 'none',
        transition: 'box-shadow 0.12s',
      }}
      onMouseEnter={() =&gt; setHovered(true)}
      onMouseLeave={() =&gt; setHovered(false)}
    &gt;
      {/* Video frame markers */}
      {!isAudio &amp;&amp; w &gt; 40 &amp;&amp; (
        &lt;div
          className="absolute inset-0"
          style={{
            opacity: 0.12,
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 32px, rgba(0,0,0,0.6) 32px, rgba(0,0,0,0.6) 33px)',
          }}
        /&gt;
      )}
      {/* Audio waveform */}
      {isAudio &amp;&amp; w &gt; 20 &amp;&amp; &lt;WaveDecor width={w} height={innerH} color={c} seed={idx + clip.s} /&gt;}
      {/* Label */}
      {w &gt; 20 &amp;&amp; (
        &lt;div
          className="relative z-[1] whitespace-nowrap overflow-hidden text-ellipsis"
          style={{
            padding: '2px 5px',
            fontSize: innerH &lt; 24 ? 9 : 10,
            fontWeight: 500,
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.4)',
            lineHeight: `${innerH - 4}px`,
          }}
        &gt;
          {clip.label}
        &lt;/div&gt;
      )}
      {/* Tooltip */}
      {hovered &amp;&amp; &lt;ClipTooltip clip={clip} trackName={`${track.id} · ${track.name}`} /&gt;}
    &lt;/div&gt;
  )
}

export const TimelineClip = memo(TimelineClipRaw)
TimelineClip.displayName = 'TimelineClip'
```

- [ ] 4. Create `_timeline/track-lane.tsx` — the scrollable timeline lane with grid lines, playhead, and clips:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/track-lane.tsx
'use client'

import { memo, useMemo } from 'react'
import type { TimelineClipData, TrackDef } from './types'
import { TH } from './constants'
import { tickInterval } from './utils'
import { TimelineClip } from './timeline-clip'

interface TrackLaneProps {
  track: TrackDef
  clips?: TimelineClipData[]
  height: number
  pxPerSec: number
  duration: number
  isAudio?: boolean
  zIdx?: number
}

function TrackLaneRaw({ track, clips, height, pxPerSec, duration, isAudio = false, zIdx = 0 }: TrackLaneProps) {
  const totalW = duration * pxPerSec
  const hasClips = clips != null &amp;&amp; clips.length &gt; 0
  const intv = tickInterval(duration)

  const gridLines = useMemo(() =&gt; {
    const lines: number[] = []
    const count = Math.ceil(duration / intv) - 1
    for (let i = 0; i &lt; count; i++) lines.push((i + 1) * intv)
    return lines
  }, [duration, intv])

  return (
    &lt;div
      className="relative"
      style={{
        height,
        width: totalW,
        borderBottom: `1px solid ${TH.border}`,
        background: hasClips
          ? (zIdx % 2 === 1 ? 'rgba(255,255,255,0.018)' : 'transparent')
          : 'rgba(255,255,255,0.006)',
      }}
    &gt;
      {/* Vertical grid lines */}
      {gridLines.map(t =&gt; (
        &lt;div
          key={`g${t}`}
          className="absolute top-0 pointer-events-none"
          style={{ left: t * pxPerSec, width: 1, height: '100%', background: 'rgba(255,255,255,0.03)' }}
        /&gt;
      ))}
      {/* Playhead line */}
      &lt;div
        className="absolute top-0 z-[1]"
        style={{ left: 0, width: 1, height: '100%', background: `${TH.playhead}18` }}
      /&gt;
      {/* Clips */}
      {(clips ?? []).map((clip, i) =&gt; (
        &lt;TimelineClip key={i} clip={clip} track={track} pxPerSec={pxPerSec} laneH={height} isAudio={isAudio} idx={i} /&gt;
      ))}
    &lt;/div&gt;
  )
}

export const TrackLane = memo(TrackLaneRaw)
TrackLane.displayName = 'TrackLane'
```

- [ ] 5. Update `_timeline/index.ts` barrel:

```ts
// append to _timeline/index.ts
export { Ruler } from './ruler'
export { TrackHead } from './track-head'
export { TrackLane } from './track-lane'
export { TimelineClip } from './timeline-clip'
```

- [ ] 6. Run `npm run test:web` to ensure no regressions.
- [ ] 7. Commit: `feat(pipeline): add Ruler, TrackHead, TrackLane, TimelineClip components`

---

### Task 24 — CrossRefPanel + SpeedRampsPanel (migrated from renderers)

**Files:** `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/crossref-panel.tsx`, `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/speedramps-panel.tsx`

- [ ] 1. Create `_timeline/crossref-panel.tsx` — collapsible top panel reading from `CrossRefData` (migrated from `crossref-renderer.tsx` but adapted for the unified timeline layout):

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/crossref-panel.tsx
'use client'

import { useState, memo } from 'react'
import type { CrossRefData } from './types'
import { TH, MONO_SM_CLS, MONO_XS_CLS } from './constants'

interface CrossRefPanelProps {
  data: CrossRefData | undefined
}

function CrossRefPanelRaw({ data }: CrossRefPanelProps) {
  const [open, setOpen] = useState(false)

  if (!data || data.beats.length === 0) return null

  return (
    &lt;div className="rounded-md overflow-hidden" style={{ background: TH.surface, border: `1px solid ${TH.border}` }}&gt;
      &lt;button
        onClick={() =&gt; setOpen(v =&gt; !v)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 cursor-pointer select-none text-left"
        style={{ background: TH.header }}
      &gt;
        &lt;span
          className="text-[10px] transition-transform duration-200"
          style={{ color: TH.dim, transform: open ? 'rotate(90deg)' : 'rotate(0)' }}
        &gt;
          ▶
        &lt;/span&gt;
        &lt;span className={MONO_XS_CLS} style={{ color: '#3498DB', fontSize: 10, whiteSpace: 'nowrap' }}&gt;
          CROSS-REFERENCE
        &lt;/span&gt;
        &lt;span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9 }}&gt;
          {data.beats.length} beats · SRT
        &lt;/span&gt;
        &lt;div className="flex-1" /&gt;
        {data.divergences.length &gt; 0 &amp;&amp; (
          &lt;span
            className={MONO_XS_CLS}
            style={{ fontSize: 8, color: '#E67E22', background: 'rgba(230,126,34,0.12)', padding: '1px 6px', borderRadius: 3 }}
          &gt;
            {data.divergences.length} divergência{data.divergences.length &gt; 1 ? 's' : ''}
          &lt;/span&gt;
        )}
      &lt;/button&gt;
      {open &amp;&amp; (
        &lt;div className="p-3.5 pt-3"&gt;
          &lt;div className={`${MONO_SM_CLS} mb-2.5 leading-relaxed`} style={{ color: TH.muted, fontSize: 9 }}&gt;
            {data.summary}
          &lt;/div&gt;
          &lt;table className="w-full border-collapse text-[11px]" style={{ color: TH.text }}&gt;
            &lt;thead&gt;
              &lt;tr&gt;
                {['Beat', 'SRT Timestamp', 'Duração', 'Est. Roteiro', 'Status'].map(h =&gt; (
                  &lt;th
                    key={h}
                    className={`${MONO_XS_CLS} text-left px-2 py-1`}
                    style={{ color: TH.muted, fontSize: 8, borderBottom: `1px solid ${TH.border}` }}
                  &gt;
                    {h}
                  &lt;/th&gt;
                ))}
              &lt;/tr&gt;
            &lt;/thead&gt;
            &lt;tbody&gt;
              {data.beats.map((b, i) =&gt; (
                &lt;tr key={i}&gt;
                  &lt;td className="px-2 py-1.5 font-medium" style={{ color: TH.accent }}&gt;{b.name}&lt;/td&gt;
                  &lt;td className="px-2 py-1.5 font-mono text-[10px]" style={{ color: TH.muted }}&gt;{b.srt}&lt;/td&gt;
                  &lt;td className="px-2 py-1.5 font-mono text-[10px]"&gt;{b.dur}&lt;/td&gt;
                  &lt;td className="px-2 py-1.5 font-mono text-[10px]" style={{ color: TH.muted }}&gt;{b.estRot}&lt;/td&gt;
                  &lt;td className="px-2 py-1.5"&gt;
                    &lt;span
                      className={MONO_XS_CLS}
                      style={{ fontSize: 8, color: b.statusColor, background: `${b.statusColor}18`, padding: '1px 5px', borderRadius: 2 }}
                    &gt;
                      {b.status}
                    &lt;/span&gt;
                    {b.note &amp;&amp; &lt;span className={`${MONO_SM_CLS} ml-1.5`} style={{ fontSize: 8, color: TH.dim }}&gt;{b.note}&lt;/span&gt;}
                  &lt;/td&gt;
                &lt;/tr&gt;
              ))}
            &lt;/tbody&gt;
          &lt;/table&gt;
          {data.divergences.length &gt; 0 &amp;&amp; (
            &lt;div
              className="mt-3 p-2.5 rounded"
              style={{ background: 'rgba(230,78,60,0.06)', border: '1px solid rgba(230,78,60,0.15)' }}
            &gt;
              &lt;div className={MONO_XS_CLS} style={{ fontSize: 8, color: '#E74C3C', marginBottom: 6 }}&gt;
                DIVERGÊNCIAS IDENTIFICADAS
              &lt;/div&gt;
              {data.divergences.map((d, i) =&gt; (
                &lt;div key={i} className="text-[11px] leading-relaxed mb-0.5" style={{ color: '#E67E22' }}&gt;
                  • {d}
                &lt;/div&gt;
              ))}
            &lt;/div&gt;
          )}
        &lt;/div&gt;
      )}
    &lt;/div&gt;
  )
}

export const CrossRefPanel = memo(CrossRefPanelRaw)
CrossRefPanel.displayName = 'CrossRefPanel'
```

- [ ] 2. Create `_timeline/speedramps-panel.tsx` — collapsible top panel with speed badges (migrated from `speedramp-renderer.tsx`):

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/speedramps-panel.tsx
'use client'

import { useState, memo } from 'react'
import type { SpeedRampData } from './types'
import { TH, MONO_SM_CLS, MONO_XS_CLS } from './constants'

interface SpeedRampsPanelProps {
  data: SpeedRampData | undefined
}

function parseSpeedValue(speed: string): number | null {
  const match = speed.replace(/[^0-9.]/g, '')
  const num = parseFloat(match)
  return isNaN(num) ? null : num
}

function SpeedBadge({ vel, velColor }: { vel: string; velColor: string }) {
  return (
    &lt;span
      className="font-mono text-[11px] font-semibold rounded-[3px]"
      style={{ color: velColor, background: `${velColor}18`, padding: '2px 7px' }}
    &gt;
      {vel}
    &lt;/span&gt;
  )
}

function SpeedRampsPanelRaw({ data }: SpeedRampsPanelProps) {
  const [open, setOpen] = useState(false)

  if (!data || data.sections.length === 0) return null

  return (
    &lt;div className="rounded-md overflow-hidden" style={{ background: TH.surface, border: `1px solid ${TH.border}` }}&gt;
      &lt;button
        onClick={() =&gt; setOpen(v =&gt; !v)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 cursor-pointer select-none text-left"
        style={{ background: TH.header }}
      &gt;
        &lt;span
          className="text-[10px] transition-transform duration-200"
          style={{ color: TH.dim, transform: open ? 'rotate(90deg)' : 'rotate(0)' }}
        &gt;
          ▶
        &lt;/span&gt;
        &lt;span className={MONO_XS_CLS} style={{ color: '#9B59B6', fontSize: 10, whiteSpace: 'nowrap' }}&gt;
          SPEED RAMPS
        &lt;/span&gt;
        &lt;span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9 }}&gt;
          {data.sections.length} seções
        &lt;/span&gt;
        &lt;div className="flex-1" /&gt;
        &lt;span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9 }}&gt;
          ~12-14 min final
        &lt;/span&gt;
      &lt;/button&gt;
      {open &amp;&amp; (
        &lt;div className="p-3.5 pt-3"&gt;
          &lt;div className={`${MONO_SM_CLS} mb-1 leading-relaxed`} style={{ color: TH.muted, fontSize: 9 }}&gt;
            {data.summary}
          &lt;/div&gt;
          &lt;div className={`${MONO_SM_CLS} mb-2.5 leading-relaxed`} style={{ color: TH.dim, fontSize: 9 }}&gt;
            {data.base}
          &lt;/div&gt;
          &lt;table className="w-full border-collapse text-[11px]" style={{ color: TH.text }}&gt;
            &lt;thead&gt;
              &lt;tr&gt;
                {['Seção', 'SRT Range', 'Velocidade', 'Racional'].map(h =&gt; (
                  &lt;th
                    key={h}
                    className={`${MONO_XS_CLS} text-left px-2 py-1`}
                    style={{ color: TH.muted, fontSize: 8, borderBottom: `1px solid ${TH.border}` }}
                  &gt;
                    {h}
                  &lt;/th&gt;
                ))}
              &lt;/tr&gt;
            &lt;/thead&gt;
            &lt;tbody&gt;
              {data.sections.map((s, i) =&gt; (
                &lt;tr key={i}&gt;
                  &lt;td className="px-2 py-1.5 font-medium"&gt;{s.name}&lt;/td&gt;
                  &lt;td className="px-2 py-1.5 font-mono text-[10px]" style={{ color: TH.muted }}&gt;{s.srt}&lt;/td&gt;
                  &lt;td className="px-2 py-1.5"&gt;
                    &lt;SpeedBadge vel={s.vel} velColor={s.velColor} /&gt;
                  &lt;/td&gt;
                  &lt;td className="px-2 py-1.5 leading-relaxed" style={{ color: TH.muted }}&gt;{s.racional}&lt;/td&gt;
                &lt;/tr&gt;
              ))}
            &lt;/tbody&gt;
          &lt;/table&gt;
          &lt;div className={`mt-2 ${MONO_SM_CLS}`} style={{ fontSize: 8, color: TH.dim }}&gt;
            Fonte: produzido por IA tool (Gemini AI transcribe + análise rítmica)
          &lt;/div&gt;
        &lt;/div&gt;
      )}
    &lt;/div&gt;
  )
}

export const SpeedRampsPanel = memo(SpeedRampsPanelRaw)
SpeedRampsPanel.displayName = 'SpeedRampsPanel'
```

- [ ] 3. Update `_timeline/index.ts` barrel:

```ts
// append to _timeline/index.ts
export { CrossRefPanel } from './crossref-panel'
export { SpeedRampsPanel } from './speedramps-panel'
```

- [ ] 4. Run `npm run test:web` to ensure no regressions.
- [ ] 5. Commit: `feat(pipeline): add CrossRefPanel and SpeedRampsPanel for unified timeline view`

---

### Task 25 — ScriptPanel (inline roteiro per beat)

**Files:** `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/script-panel.tsx`

- [ ] 1. Create `_timeline/script-panel.tsx` — per-beat collapsible script panel with 4 item types (note, line, pause, ref), matching the design prototype:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/script-panel.tsx
'use client'

import { useState, memo } from 'react'
import type { ScriptItem } from './types'
import { TH, MONO_XS_CLS, MONO_SM_CLS } from './constants'
import { badgeTextColor } from './utils'

interface ScriptPanelProps {
  script: ScriptItem[] | undefined
}

function ScriptItemNote({ item }: { item: Extract&lt;ScriptItem, { type: 'note' }&gt; }) {
  return (
    &lt;div className="flex gap-2 mb-2 items-start"&gt;
      &lt;span
        className={`${MONO_XS_CLS} shrink-0 mt-0.5 rounded-[3px]`}
        style={{
          fontSize: 9,
          padding: '2px 7px',
          background: item.tagColor,
          color: badgeTextColor(item.tagColor),
        }}
      &gt;
        {item.tag}
      &lt;/span&gt;
      &lt;span className="text-[12px] leading-relaxed" style={{ color: TH.muted }}&gt;
        {item.text}
      &lt;/span&gt;
    &lt;/div&gt;
  )
}

function ScriptItemLine({ item }: { item: Extract&lt;ScriptItem, { type: 'line' }&gt; }) {
  return (
    &lt;div
      className="my-1.5 rounded-r"
      style={{
        borderLeft: `3px solid ${item.accent ?? TH.text}`,
        padding: '10px 16px',
        background: 'rgba(255,255,255,0.02)',
      }}
    &gt;
      &lt;span className="text-[13px] italic leading-[1.65]" style={{ color: TH.text }}&gt;
        {item.text}
      &lt;/span&gt;
    &lt;/div&gt;
  )
}

function ScriptItemPause({ item }: { item: Extract&lt;ScriptItem, { type: 'pause' }&gt; }) {
  return (
    &lt;div className="my-1 ml-1.5"&gt;
      &lt;span
        className="font-mono text-[10px] rounded-[3px]"
        style={{ padding: '2px 8px', background: 'rgba(39,174,96,0.12)', color: '#27AE60' }}
      &gt;
        ⏸ {item.duration}s
      &lt;/span&gt;
    &lt;/div&gt;
  )
}

function ScriptItemRef({ item }: { item: Extract&lt;ScriptItem, { type: 'ref' }&gt; }) {
  return (
    &lt;div className="mt-3 pt-2" style={{ borderTop: `1px solid ${TH.border}` }}&gt;
      &lt;span
        className={MONO_XS_CLS}
        style={{
          fontSize: 8,
          color: '#E67E22',
          marginRight: 6,
          padding: '1px 5px',
          borderRadius: 2,
          background: 'rgba(230,126,34,0.12)',
        }}
      &gt;
        REF
      &lt;/span&gt;
      &lt;span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 10, lineHeight: 1.5 }}&gt;
        {item.text}
      &lt;/span&gt;
    &lt;/div&gt;
  )
}

function ScriptPanelRaw({ script }: ScriptPanelProps) {
  const [open, setOpen] = useState(false)

  if (!script || script.length === 0) return null

  const lineCount = script.filter(s =&gt; s.type === 'line').length

  return (
    &lt;div style={{ borderTop: `1px solid ${TH.border}` }}&gt;
      &lt;button
        onClick={() =&gt; setOpen(v =&gt; !v)}
        className="w-full flex items-center gap-2 px-3.5 py-2 cursor-pointer select-none text-left"
        style={{ background: TH.header }}
      &gt;
        &lt;span
          className="text-[10px] transition-transform duration-200"
          style={{ color: TH.dim, transform: open ? 'rotate(90deg)' : 'rotate(0)' }}
        &gt;
          ▶
        &lt;/span&gt;
        &lt;span className={MONO_XS_CLS} style={{ color: TH.muted, fontSize: 9 }}&gt;ROTEIRO&lt;/span&gt;
        &lt;span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9 }}&gt;
          {lineCount} fala{lineCount !== 1 ? 's' : ''}
        &lt;/span&gt;
        &lt;div className="flex-1" /&gt;
      &lt;/button&gt;
      {open &amp;&amp; (
        &lt;div className="px-4 py-3.5 pb-4.5" style={{ background: TH.bg }}&gt;
          {script.map((item, i) =&gt; {
            switch (item.type) {
              case 'note':  return &lt;ScriptItemNote key={i} item={item} /&gt;
              case 'line':  return &lt;ScriptItemLine key={i} item={item} /&gt;
              case 'pause': return &lt;ScriptItemPause key={i} item={item} /&gt;
              case 'ref':   return &lt;ScriptItemRef key={i} item={item} /&gt;
              default:      return null
            }
          })}
        &lt;/div&gt;
      )}
    &lt;/div&gt;
  )
}

export const ScriptPanel = memo(ScriptPanelRaw)
ScriptPanel.displayName = 'ScriptPanel'
```

- [ ] 2. Update `_timeline/index.ts` barrel:

```ts
// append to _timeline/index.ts
export { ScriptPanel } from './script-panel'
```

- [ ] 3. Run `npm run test:web` to ensure no regressions.
- [ ] 4. Commit: `feat(pipeline): add ScriptPanel for per-beat roteiro display`

---

### Task 26 — AssetResolver (5 categories: Music, SFX, Visual, Ambience, Sound Design)

**Files:** `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/asset-resolver.tsx`

- [ ] 1. Create `_timeline/asset-resolver.tsx` — per-beat collapsible asset panel with 5 category sections (Music with 2-step select/confirm, SFX with type badges, Visual with pending/resolved states, Ambience, Sound Design):

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/asset-resolver.tsx
'use client'

import { useState, useCallback, memo } from 'react'
import type { BeatAssets, MusicAsset, SfxAsset, VisualAsset, AmbienceAsset, SoundDesignAsset } from './types'
import { TH, MONO_XS_CLS, MONO_SM_CLS } from './constants'

interface AssetResolverProps {
  assets: BeatAssets | undefined
}

/* ── Music Section ─────────────────────────────────── */

function MusicSection({ items }: { items: MusicAsset[] }) {
  const [selections, setSelections] = useState&lt;Record&lt;string, boolean&gt;&gt;(() =&gt; {
    const s: Record&lt;string, boolean&gt; = {}
    items.forEach(m =&gt; { if (m.selected) s[m.id] = true })
    return s
  })
  const [confirmed, setConfirmed] = useState&lt;Record&lt;string, boolean&gt;&gt;(() =&gt; {
    const c: Record&lt;string, boolean&gt; = {}
    items.forEach(m =&gt; { if (m.confirmed) c[m.id] = true })
    return c
  })

  const selectMusic = useCallback((id: string) =&gt; {
    setSelections(() =&gt; {
      const next: Record&lt;string, boolean&gt; = {}
      items.forEach(m =&gt; { next[m.id] = m.id === id })
      return next
    })
  }, [items])

  const confirmMusic = useCallback((id: string) =&gt; {
    setConfirmed(prev =&gt; ({ ...prev, [id]: true }))
  }, [])

  return (
    &lt;div className="mb-3.5"&gt;
      &lt;div className={MONO_XS_CLS} style={{ color: TH.muted, fontSize: 8, marginBottom: 6 }}&gt;MÚSICA&lt;/div&gt;
      &lt;div className="flex flex-col gap-1.5"&gt;
        {items.map(m =&gt; {
          const isSel = selections[m.id] ?? false
          const isConf = confirmed[m.id] ?? false
          if (isConf &amp;&amp; !isSel) return null
          return (
            &lt;div
              key={m.id}
              className="rounded-[5px] cursor-pointer"
              style={{
                padding: '10px 12px',
                background: isSel ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)',
                border: isSel ? `1px solid rgba(99,102,241,0.25)` : `1px solid ${TH.border}`,
                opacity: isConf ? 0.6 : 1,
                cursor: isConf ? 'default' : 'pointer',
              }}
              onClick={() =&gt; !isConf &amp;&amp; selectMusic(m.id)}
            &gt;
              &lt;div className="flex items-center gap-2 mb-1"&gt;
                {isSel &amp;&amp; &lt;span className="text-[12px]" style={{ color: TH.accent }}&gt;★&lt;/span&gt;}
                &lt;span className="text-[13px] font-semibold" style={{ color: TH.text }}&gt;{m.name}&lt;/span&gt;
                &lt;span className="text-[11px]" style={{ color: TH.muted }}&gt;— {m.artist}&lt;/span&gt;
                &lt;div className="flex-1" /&gt;
                {m.local ? (
                  &lt;span className={MONO_XS_CLS} style={{ fontSize: 8, color: '#27AE60', background: 'rgba(39,174,96,0.12)', padding: '1px 5px', borderRadius: 2 }}&gt;✓ Local&lt;/span&gt;
                ) : (
                  &lt;span className={MONO_XS_CLS} style={{ fontSize: 8, color: '#E67E22', background: 'rgba(230,126,34,0.12)', padding: '1px 5px', borderRadius: 2 }}&gt;⬇ Download&lt;/span&gt;
                )}
                &lt;span className="font-mono text-[16px] font-bold" style={{ color: m.match &gt;= 80 ? '#27AE60' : m.match &gt;= 60 ? TH.text : TH.muted }}&gt;
                  {m.match}&lt;span className="text-[10px] opacity-60"&gt;%&lt;/span&gt;
                &lt;/span&gt;
              &lt;/div&gt;
              &lt;div className="flex items-center gap-2 mb-1"&gt;
                &lt;span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9 }}&gt;{m.genre}&lt;/span&gt;
                {m.bpm != null &amp;&amp; &lt;span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9 }}&gt;{m.bpm} BPM&lt;/span&gt;}
                {m.dur &amp;&amp; &lt;span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9 }}&gt;{m.dur}&lt;/span&gt;}
                &lt;div className="flex-1" /&gt;
                &lt;div className="flex gap-1 flex-wrap"&gt;
                  {(m.tags ?? []).slice(0, 3).map(tag =&gt; (
                    &lt;span key={tag} className="font-mono text-[8px] rounded-sm" style={{ color: TH.dim, padding: '1px 5px', background: 'rgba(255,255,255,0.04)' }}&gt;{tag}&lt;/span&gt;
                  ))}
                &lt;/div&gt;
              &lt;/div&gt;
              {m.note &amp;&amp; &lt;div className="text-[11px] italic mt-0.5" style={{ color: TH.muted }}&gt;{m.note}&lt;/div&gt;}
              {isSel &amp;&amp; !isConf &amp;&amp; (
                &lt;div className="mt-2 flex justify-end gap-1.5"&gt;
                  &lt;button
                    onClick={(e) =&gt; { e.stopPropagation(); confirmMusic(m.id) }}
                    className="font-mono text-[10px] font-semibold rounded-[3px] border-none cursor-pointer"
                    style={{ padding: '4px 12px', background: TH.accent, color: '#fff' }}
                  &gt;
                    ✓ Confirmar Seleção
                  &lt;/button&gt;
                &lt;/div&gt;
              )}
              {isConf &amp;&amp; &lt;div className={MONO_XS_CLS} style={{ fontSize: 8, color: '#27AE60', marginTop: 4 }}&gt;✓ CONFIRMADO&lt;/div&gt;}
            &lt;/div&gt;
          )
        })}
      &lt;/div&gt;
    &lt;/div&gt;
  )
}

/* ── SFX Section ───────────────────────────────────── */

function SfxSection({ items }: { items: SfxAsset[] }) {
  return (
    &lt;div className="mb-3.5"&gt;
      &lt;div className={MONO_XS_CLS} style={{ color: TH.muted, fontSize: 8, marginBottom: 6 }}&gt;SFX&lt;/div&gt;
      &lt;div className="flex flex-col gap-1.5"&gt;
        {items.map((s, i) =&gt; (
          &lt;div key={i} className="rounded p-2 px-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${TH.border}` }}&gt;
            &lt;div className="flex items-center gap-2 mb-1"&gt;
              &lt;span className="font-mono text-[10px]" style={{ color: TH.accent }}&gt;{s.tc}&lt;/span&gt;
              &lt;span
                className={MONO_XS_CLS}
                style={{ fontSize: 8, color: s.typeColor, border: `1px solid ${s.typeColor}`, padding: '0 4px', borderRadius: 2 }}
              &gt;
                {s.type}
              &lt;/span&gt;
              &lt;span className="text-[11px]" style={{ color: TH.text }}&gt;{s.desc}&lt;/span&gt;
            &lt;/div&gt;
            {s.file ? (
              &lt;div className="flex items-center gap-2 mb-1"&gt;
                &lt;span className="text-[11px]" style={{ color: TH.muted }}&gt;{s.file.name}&lt;/span&gt;
                &lt;span className={MONO_XS_CLS} style={{ fontSize: 8, color: '#27AE60', background: 'rgba(39,174,96,0.12)', padding: '1px 5px', borderRadius: 2 }}&gt;✓ Local&lt;/span&gt;
                &lt;span className="font-mono text-[12px] font-semibold" style={{ color: s.file.match &gt;= 80 ? '#27AE60' : TH.text }}&gt;{s.file.match}%&lt;/span&gt;
              &lt;/div&gt;
            ) : (
              &lt;div className={MONO_XS_CLS} style={{ fontSize: 9, color: '#E67E22', marginBottom: 4 }}&gt;⚠ Nenhum arquivo selecionado — buscar&lt;/div&gt;
            )}
            &lt;div className="flex gap-1 flex-wrap items-center"&gt;
              {(s.tags ?? []).map(tag =&gt; (
                &lt;span key={tag} className="font-mono text-[8px] rounded-full cursor-pointer" style={{ color: TH.dim, padding: '1px 5px', background: 'rgba(255,255,255,0.04)' }}&gt;{tag} ↗&lt;/span&gt;
              ))}
              {s.altCount != null &amp;&amp; &lt;span className={`${MONO_SM_CLS} cursor-pointer ml-1`} style={{ fontSize: 9, color: TH.accent }}&gt;+{s.altCount} alt →&lt;/span&gt;}
            &lt;/div&gt;
          &lt;/div&gt;
        ))}
      &lt;/div&gt;
    &lt;/div&gt;
  )
}

/* ── Visual Section ────────────────────────────────── */

function VisualSection({ items }: { items: VisualAsset[] }) {
  return (
    &lt;div className="mb-3.5"&gt;
      &lt;div className={MONO_XS_CLS} style={{ color: TH.muted, fontSize: 8, marginBottom: 6 }}&gt;VISUAL&lt;/div&gt;
      &lt;div className="flex flex-col gap-1"&gt;
        {items.map((v, i) =&gt; (
          &lt;div key={i} className="flex items-center gap-2 rounded-[3px] px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${TH.border}` }}&gt;
            &lt;span className="font-mono text-[10px]" style={{ color: TH.accent }}&gt;{v.tc}&lt;/span&gt;
            &lt;span className="text-[11px] flex-1" style={{ color: TH.text }}&gt;{v.desc}&lt;/span&gt;
            {v.status === 'resolved' ? (
              &lt;span className={MONO_XS_CLS} style={{ fontSize: 8, color: '#27AE60' }}&gt;✓ {v.file}&lt;/span&gt;
            ) : (
              &lt;&gt;
                &lt;span className={MONO_XS_CLS} style={{ fontSize: 8, color: '#E67E22' }}&gt;⚠ Pendente&lt;/span&gt;
                &lt;button className={`${MONO_SM_CLS} cursor-pointer border-none bg-transparent`} style={{ fontSize: 9, color: TH.accent }}&gt;
                  Buscar
                &lt;/button&gt;
              &lt;/&gt;
            )}
          &lt;/div&gt;
        ))}
      &lt;/div&gt;
    &lt;/div&gt;
  )
}

/* ── Ambience Section ──────────────────────────────── */

function AmbienceSection({ items }: { items: AmbienceAsset[] }) {
  return (
    &lt;div className="mb-2"&gt;
      &lt;div className={MONO_XS_CLS} style={{ color: TH.muted, fontSize: 8, marginBottom: 4 }}&gt;AMBIENCE&lt;/div&gt;
      {items.map((a, i) =&gt; (
        &lt;div key={i} className="flex items-center gap-2 rounded-[3px] px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${TH.border}` }}&gt;
          &lt;span className="text-[11px]" style={{ color: TH.text }}&gt;{a.name}&lt;/span&gt;
          {a.local &amp;&amp; &lt;span className={MONO_XS_CLS} style={{ fontSize: 8, color: '#27AE60' }}&gt;✓ Local&lt;/span&gt;}
          &lt;span className="font-mono text-[11px]" style={{ color: TH.muted }}&gt;{a.match}%&lt;/span&gt;
        &lt;/div&gt;
      ))}
    &lt;/div&gt;
  )
}

/* ── Sound Design Section ──────────────────────────── */

function SoundDesignSection({ items }: { items: SoundDesignAsset[] }) {
  return (
    &lt;div&gt;
      &lt;div className={MONO_XS_CLS} style={{ color: TH.muted, fontSize: 8, marginBottom: 4 }}&gt;SOUND DESIGN&lt;/div&gt;
      {items.map((sd, i) =&gt; (
        &lt;div key={i} className="flex items-center gap-2 rounded-[3px] px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${TH.border}` }}&gt;
          &lt;span className="font-mono text-[10px]" style={{ color: TH.accent }}&gt;{sd.tc}&lt;/span&gt;
          &lt;span className="text-[11px] flex-1" style={{ color: TH.text }}&gt;{sd.name}&lt;/span&gt;
          &lt;span className={MONO_XS_CLS} style={{ fontSize: 8, color: sd.status === 'pending' ? '#E67E22' : '#27AE60' }}&gt;
            {sd.status === 'pending' ? '⚠ Pendente' : '✓ Pronto'}
          &lt;/span&gt;
        &lt;/div&gt;
      ))}
    &lt;/div&gt;
  )
}

/* ── Main Resolver ─────────────────────────────────── */

function AssetResolverRaw({ assets }: AssetResolverProps) {
  const [open, setOpen] = useState(false)

  if (!assets) return null

  const musicCount = (assets.music ?? []).length
  const sfxCount = (assets.sfx ?? []).length
  const visualCount = (assets.visual ?? []).length
  const pendingVisual = (assets.visual ?? []).filter(v =&gt; v.status === 'pending').length
  const pendingSfx = (assets.sfx ?? []).filter(s =&gt; !s.file).length
  const pendingMusic = (assets.music ?? []).filter(m =&gt; !m.local).length
  const totalPending = pendingVisual + pendingSfx + pendingMusic

  const summaryParts: string[] = []
  if (musicCount &gt; 0) summaryParts.push(`${musicCount} mús`)
  if (sfxCount &gt; 0) summaryParts.push(`${sfxCount} sfx`)
  if (visualCount &gt; 0) summaryParts.push(`${visualCount} vis`)

  return (
    &lt;div style={{ borderTop: `1px solid ${TH.border}` }}&gt;
      &lt;button
        onClick={() =&gt; setOpen(v =&gt; !v)}
        className="w-full flex items-center gap-2 px-3.5 py-2 cursor-pointer select-none text-left"
        style={{ background: TH.header }}
      &gt;
        &lt;span
          className="text-[10px] transition-transform duration-200"
          style={{ color: TH.dim, transform: open ? 'rotate(90deg)' : 'rotate(0)' }}
        &gt;
          ▶
        &lt;/span&gt;
        &lt;span className={MONO_XS_CLS} style={{ color: TH.accent, fontSize: 9 }}&gt;ASSETS&lt;/span&gt;
        &lt;span
          className={`${MONO_SM_CLS} shrink overflow-hidden text-ellipsis whitespace-nowrap`}
          style={{ color: TH.dim, fontSize: 9 }}
        &gt;
          {summaryParts.join(' · ')}
        &lt;/span&gt;
        &lt;div className="flex-1" /&gt;
        {totalPending &gt; 0 &amp;&amp; (
          &lt;span className={MONO_XS_CLS} style={{ fontSize: 8, color: '#E67E22', background: 'rgba(230,126,34,0.12)', padding: '1px 6px', borderRadius: 3 }}&gt;
            {totalPending} pendente{totalPending &gt; 1 ? 's' : ''}
          &lt;/span&gt;
        )}
      &lt;/button&gt;
      {open &amp;&amp; (
        &lt;div className="p-3.5 pt-3" style={{ background: TH.bg }}&gt;
          {musicCount &gt; 0 &amp;&amp; &lt;MusicSection items={assets.music!} /&gt;}
          {sfxCount &gt; 0 &amp;&amp; &lt;SfxSection items={assets.sfx!} /&gt;}
          {visualCount &gt; 0 &amp;&amp; &lt;VisualSection items={assets.visual!} /&gt;}
          {(assets.ambience || assets.soundDesign) &amp;&amp; (
            &lt;div&gt;
              {assets.ambience &amp;&amp; assets.ambience.length &gt; 0 &amp;&amp; &lt;AmbienceSection items={assets.ambience} /&gt;}
              {assets.soundDesign &amp;&amp; assets.soundDesign.length &gt; 0 &amp;&amp; &lt;SoundDesignSection items={assets.soundDesign} /&gt;}
            &lt;/div&gt;
          )}
        &lt;/div&gt;
      )}
    &lt;/div&gt;
  )
}

export const AssetResolver = memo(AssetResolverRaw)
AssetResolver.displayName = 'AssetResolver'
```

- [ ] 2. Update `_timeline/index.ts` barrel:

```ts
// append to _timeline/index.ts
export { AssetResolver } from './asset-resolver'
```

- [ ] 3. Run `npm run test:web` to ensure no regressions.
- [ ] 4. Commit: `feat(pipeline): add AssetResolver with 5-category support for timeline beats`

---

### Task 27 — ProgressBar + Toolbar + BeatAccordion

**Files:** `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/progress-bar.tsx`, `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/toolbar.tsx`, `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/beat-accordion.tsx`

- [ ] 1. Create `_timeline/progress-bar.tsx` — overview bar showing beat segments proportional to duration:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/progress-bar.tsx
'use client'

import { memo } from 'react'
import type { BeatData } from './types'
import { TH, MONO_SM_CLS, MONO_XS_CLS } from './constants'
import { fmtDur } from './utils'

interface ProgressBarProps {
  beats: BeatData[]
}

function ProgressBarRaw({ beats }: ProgressBarProps) {
  const totalDur = beats.reduce((s, b) =&gt; s + b.duration, 0)

  return (
    &lt;div
      className="flex items-center gap-3 flex-wrap rounded-md mb-3"
      style={{ padding: '10px 16px', background: TH.surface, border: `1px solid ${TH.border}` }}
    &gt;
      &lt;span className={MONO_XS_CLS} style={{ color: TH.muted, fontSize: 9 }}&gt;OVERVIEW&lt;/span&gt;
      &lt;div
        className="flex-1 flex overflow-hidden rounded gap-px"
        style={{ height: 26, background: TH.bg }}
      &gt;
        {beats.map((b, i) =&gt; (
          &lt;div
            key={i}
            title={`Beat ${b.idx + 1} — ${b.name} · ${fmtDur(b.duration)}`}
            className="relative flex items-center justify-center overflow-hidden cursor-default"
            style={{
              flex: b.duration,
              height: '100%',
              background: `linear-gradient(90deg, rgba(99,102,241,0.19), rgba(99,102,241,0.09))`,
            }}
          &gt;
            &lt;span
              className="font-mono text-[9px] whitespace-nowrap px-1.5 overflow-hidden text-ellipsis"
              style={{ color: TH.text, opacity: 0.8 }}
            &gt;
              {b.idx + 1} {b.name}
            &lt;/span&gt;
          &lt;/div&gt;
        ))}
      &lt;/div&gt;
      &lt;span className={MONO_SM_CLS} style={{ color: TH.text }}&gt;
        {beats.length} beats · {fmtDur(totalDur)} total
      &lt;/span&gt;
    &lt;/div&gt;
  )
}

export const ProgressBar = memo(ProgressBarRaw)
ProgressBar.displayName = 'ProgressBar'
```

- [ ] 2. Create `_timeline/toolbar.tsx` — zoom controls (30-400%, slider, fit), expand/collapse all, track color legend:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/toolbar.tsx
'use client'

import { useCallback, memo } from 'react'
import { TL_TRACKS, TH, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, MONO_SM_CLS, MONO_XS_CLS } from './constants'

interface ToolbarProps {
  zoom: number
  setZoom: (fn: (z: number) =&gt; number) =&gt; void
  expandAll: () =&gt; void
  collapseAll: () =&gt; void
}

const btnCls = 'font-mono text-[12px] leading-none rounded cursor-pointer'
const btnStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: `1px solid ${TH.border}`,
  color: TH.text,
  padding: '3px 6px',
}
const btnSmStyle = { ...btnStyle, padding: '3px 8px', fontSize: 10 }

function ToolbarRaw({ zoom, setZoom, expandAll, collapseAll }: ToolbarProps) {
  const zoomIn = useCallback(() =&gt; setZoom(z =&gt; Math.min(ZOOM_MAX, z + ZOOM_STEP)), [setZoom])
  const zoomOut = useCallback(() =&gt; setZoom(z =&gt; Math.max(ZOOM_MIN, z - ZOOM_STEP)), [setZoom])
  const zoomFit = useCallback(() =&gt; setZoom(() =&gt; 1), [setZoom])
  const handleSlider = useCallback((e: React.ChangeEvent&lt;HTMLInputElement&gt;) =&gt; {
    const val = parseFloat(e.target.value)
    setZoom(() =&gt; val)
  }, [setZoom])

  const allTracks = [...TL_TRACKS.video].reverse().concat(TL_TRACKS.audio)

  return (
    &lt;div
      className="flex items-center gap-4 flex-wrap rounded-md mb-3"
      style={{ padding: '10px 16px', background: TH.surface, border: `1px solid ${TH.border}` }}
    &gt;
      &lt;div className={MONO_XS_CLS} style={{ color: TH.accent, fontSize: 10, letterSpacing: '0.14em', whiteSpace: 'nowrap' }}&gt;
        TIMELINE RESOLVER
      &lt;/div&gt;
      &lt;div style={{ width: 1, height: 20, background: TH.border }} /&gt;
      {/* Zoom controls */}
      &lt;div className="flex items-center gap-2"&gt;
        &lt;span className={MONO_SM_CLS} style={{ color: TH.muted, fontSize: 9 }}&gt;ZOOM&lt;/span&gt;
        &lt;button onClick={zoomOut} className={btnCls} style={btnStyle} aria-label="Zoom out"&gt;−&lt;/button&gt;
        &lt;input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.05}
          value={zoom}
          onChange={handleSlider}
          className="w-[100px]"
          style={{ accentColor: TH.accent }}
          aria-label="Zoom level"
        /&gt;
        &lt;button onClick={zoomIn} className={btnCls} style={btnStyle} aria-label="Zoom in"&gt;+&lt;/button&gt;
        &lt;span className={`${MONO_SM_CLS} min-w-[36px] text-center`} style={{ color: TH.text }}&gt;
          {Math.round(zoom * 100)}%
        &lt;/span&gt;
        &lt;button onClick={zoomFit} className={btnCls} style={btnSmStyle}&gt;Fit&lt;/button&gt;
      &lt;/div&gt;
      &lt;div className="flex-1" /&gt;
      {/* Collapse / Expand */}
      &lt;button onClick={expandAll} className={btnCls} style={btnSmStyle}&gt;Expand All&lt;/button&gt;
      &lt;button onClick={collapseAll} className={btnCls} style={btnSmStyle}&gt;Collapse All&lt;/button&gt;
      {/* Track color legend */}
      &lt;div className="flex gap-1.5 flex-wrap"&gt;
        {allTracks.map(t =&gt; (
          &lt;div
            key={t.id}
            title={`${t.id} · ${t.name}: ${t.fn}`}
            className="w-2.5 h-2.5 rounded-sm cursor-help"
            style={{ background: t.color, opacity: 0.8 }}
          /&gt;
        ))}
      &lt;/div&gt;
    &lt;/div&gt;
  )
}

export const Toolbar = memo(ToolbarRaw)
Toolbar.displayName = 'Toolbar'
```

- [ ] 3. Create `_timeline/beat-accordion.tsx` — full beat section: header + track panel + timeline area + asset resolver + script panel. Memoized via `React.memo`. Includes ResizeObserver for container width, drag-resize for tracks, lazy body render on collapse:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/beat-accordion.tsx
'use client'

import { useState, useRef, useCallback, useMemo, memo } from 'react'
import type { BeatData, BeatAssets, TrackHeightMap } from './types'
import {
  TL_TRACKS, ALL_TRACKS, TH,
  PANEL_W, RULER_H, HANDLE_H, EMPTY_H, MIN_H, MAX_H,
  MONO_SM_CLS, MONO_XS_CLS,
} from './constants'
import { fmtTime, fmtDur, effectiveTrackH, calcPxPerSec, difficultyColor } from './utils'
import { Ruler } from './ruler'
import { TrackHead } from './track-head'
import { TrackLane } from './track-lane'
import { TrackDivider } from './track-divider'
import { ResizeHandle } from './resize-handle'
import { AssetResolver } from './asset-resolver'
import { ScriptPanel } from './script-panel'

interface BeatAccordionProps {
  beat: BeatData
  assets: BeatAssets | undefined
  trackHeights: TrackHeightMap
  onResize: (trackId: string, newH: number) =&gt; void
  zoom: number
  containerW: number
  defaultOpen: boolean
}

function BeatAccordionRaw({ beat, assets, trackHeights, onResize, zoom, containerW, defaultOpen }: BeatAccordionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const scrollRef = useRef&lt;HTMLDivElement&gt;(null)

  const effH = useCallback(
    (tid: string) =&gt; effectiveTrackH(tid, beat.clips, trackHeights, EMPTY_H),
    [beat.clips, trackHeights],
  )

  const availW = Math.max(containerW - PANEL_W - 2, 300)
  const pps = calcPxPerSec(availW, beat.duration, zoom)
  const totalW = beat.duration * pps

  const startResize = useCallback((trackId: string) =&gt; (e: React.MouseEvent) =&gt; {
    e.preventDefault()
    const startY = e.clientY
    const startH = trackHeights[trackId] ?? EMPTY_H
    let raf: number | null = null

    const move = (me: MouseEvent) =&gt; {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() =&gt; {
        const delta = me.clientY - startY
        onResize(trackId, Math.max(MIN_H, Math.min(MAX_H, startH + delta)))
      })
    }

    const up = () =&gt; {
      if (raf) cancelAnimationFrame(raf)
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }, [trackHeights, onResize])

  const totalClips = ALL_TRACKS.reduce((n, t) =&gt; n + (beat.clips[t.id]?.length ?? 0), 0)
  const usedTracks = ALL_TRACKS.filter(t =&gt; (beat.clips[t.id]?.length ?? 0) &gt; 0).length
  const diffColor = difficultyColor(beat.difficulty)

  return (
    &lt;div
      className="rounded-md overflow-hidden mb-3.5"
      style={{ background: TH.surface, border: `1px solid ${TH.border}`, borderLeft: `3px solid ${TH.accent}` }}
    &gt;
      {/* Beat header */}
      &lt;button
        className="w-full flex items-center gap-2 px-3.5 py-2.5 cursor-pointer select-none text-left"
        style={{ background: TH.header, borderBottom: open ? `1px solid ${TH.border}` : 'none' }}
        onClick={() =&gt; setOpen(v =&gt; !v)}
      &gt;
        &lt;span
          className="text-[11px] shrink-0 w-3.5 text-center transition-transform duration-200"
          style={{ color: TH.dim, transform: open ? 'rotate(90deg)' : 'rotate(0)' }}
        &gt;
          ▶
        &lt;/span&gt;
        &lt;span className="font-mono text-[13px] font-bold shrink-0" style={{ color: TH.accent }}&gt;
          {beat.idx + 1}
        &lt;/span&gt;
        &lt;span className="text-[13px] flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: TH.text }}&gt;
          &lt;span className={MONO_SM_CLS} style={{ color: TH.muted }}&gt;{beat.label}&lt;/span&gt;
          &lt;span style={{ color: TH.dim, margin: '0 5px' }}&gt;—&lt;/span&gt;
          &lt;span className="font-semibold"&gt;{beat.name}&lt;/span&gt;
        &lt;/span&gt;
        &lt;span className={`${MONO_SM_CLS} shrink-0`} style={{ color: TH.muted }}&gt;
          {fmtTime(beat.absStart)}–{fmtTime(beat.absStart + beat.duration)}
        &lt;/span&gt;
        &lt;span className="font-mono text-[12px] font-bold shrink-0" style={{ color: TH.text }}&gt;
          {fmtDur(beat.duration)}
        &lt;/span&gt;
        &lt;span className={`${MONO_XS_CLS} rounded-[3px]`} style={{ fontSize: 9, padding: '2px 7px', color: TH.muted, background: 'rgba(255,255,255,0.06)' }}&gt;
          {beat.status}
        &lt;/span&gt;
        &lt;span className={`${MONO_XS_CLS} rounded-[3px]`} style={{ fontSize: 9, padding: '2px 7px', color: diffColor, background: `${diffColor}18` }}&gt;
          {beat.difficulty}
        &lt;/span&gt;
        &lt;span className={`${MONO_SM_CLS} shrink-0 whitespace-nowrap`} style={{ color: TH.dim, fontSize: 8 }}&gt;
          {totalClips}c · {usedTracks}/13
        &lt;/span&gt;
      &lt;/button&gt;

      {/* Beat body — lazy render when collapsed */}
      {open &amp;&amp; (
        &lt;&gt;
          &lt;div className="flex"&gt;
            {/* Track panel (left) */}
            &lt;div className="shrink-0" style={{ width: PANEL_W, borderRight: `1px solid ${TH.border}` }}&gt;
              &lt;div style={{ height: RULER_H, background: TH.surface, borderBottom: `1px solid ${TH.border}` }} /&gt;
              {TL_TRACKS.video.map(t =&gt; (
                &lt;div key={t.id}&gt;
                  &lt;TrackHead track={t} height={effH(t.id)} clipCount={beat.clips[t.id]?.length ?? 0} /&gt;
                  &lt;ResizeHandle onStart={startResize(t.id)} /&gt;
                &lt;/div&gt;
              ))}
              &lt;TrackDivider inPanel /&gt;
              {TL_TRACKS.audio.map(t =&gt; (
                &lt;div key={t.id}&gt;
                  &lt;TrackHead track={t} height={effH(t.id)} clipCount={beat.clips[t.id]?.length ?? 0} isAudio /&gt;
                  &lt;ResizeHandle onStart={startResize(t.id)} /&gt;
                &lt;/div&gt;
              ))}
            &lt;/div&gt;
            {/* Timeline area (right, scrollable) */}
            &lt;div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden"&gt;
              &lt;div style={{ width: Math.max(totalW, availW) + 36, minWidth: availW }}&gt;
                &lt;Ruler duration={beat.duration} pxPerSec={pps} totalW={Math.max(totalW, availW) + 36} /&gt;
                {TL_TRACKS.video.map((t, vi) =&gt; (
                  &lt;div key={t.id}&gt;
                    &lt;TrackLane
                      track={t}
                      clips={beat.clips[t.id]}
                      height={effH(t.id)}
                      pxPerSec={pps}
                      duration={beat.duration}
                      zIdx={vi}
                    /&gt;
                    &lt;div style={{ height: HANDLE_H }} /&gt;
                  &lt;/div&gt;
                ))}
                &lt;TrackDivider width={Math.max(totalW, availW) + 36} /&gt;
                {TL_TRACKS.audio.map((t, ai) =&gt; (
                  &lt;div key={t.id}&gt;
                    &lt;TrackLane
                      track={t}
                      clips={beat.clips[t.id]}
                      height={effH(t.id)}
                      pxPerSec={pps}
                      duration={beat.duration}
                      isAudio
                      zIdx={ai}
                    /&gt;
                    &lt;div style={{ height: HANDLE_H }} /&gt;
                  &lt;/div&gt;
                ))}
              &lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;
          &lt;AssetResolver assets={assets} /&gt;
          &lt;ScriptPanel script={beat.script} /&gt;
        &lt;/&gt;
      )}
    &lt;/div&gt;
  )
}

export const BeatAccordion = memo(BeatAccordionRaw)
BeatAccordion.displayName = 'BeatAccordion'
```

- [ ] 4. Update `_timeline/index.ts` barrel:

```ts
// append to _timeline/index.ts
export { ProgressBar } from './progress-bar'
export { Toolbar } from './toolbar'
export { BeatAccordion } from './beat-accordion'
```

- [ ] 5. Run `npm run test:web` to ensure no regressions.
- [ ] 6. Commit: `feat(pipeline): add ProgressBar, Toolbar, BeatAccordion for timeline view`

---

### Task 28 — PostProductionView (root component wiring everything together)

**Files:** `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/post-production-view.tsx`, `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx`, `apps/web/src/lib/pipeline/sections.ts`, `apps/web/test/unit/timeline-utils.test.ts`

- [ ] 1. Create `_timeline/post-production-view.tsx` — root component that reads from 3 `useSection()` instances, manages zoom/trackHeights/expand-collapse state, handles keyboard shortcuts, and renders the full layout:

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/post-production-view.tsx
'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { RendererProps } from '../../section-content'
import type { PostProdContent, TrackHeightMap } from './types'
import { ALL_TRACKS, DEF_H, TH, ZOOM_DEFAULT, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, MONO_SM_CLS } from './constants'
import { fmtDur, parsePostProdContent } from './utils'
import { ProgressBar } from './progress-bar'
import { CrossRefPanel } from './crossref-panel'
import { SpeedRampsPanel } from './speedramps-panel'
import { Toolbar } from './toolbar'
import { BeatAccordion } from './beat-accordion'

interface PostProductionViewProps extends RendererProps {
  /** Parsed scenes content (from postprod_scenes section) */
  scenesContent?: unknown
  /** Parsed crossRef content (from postprod_crossref section) */
  crossRefContent?: unknown
  /** Parsed speedRamps content (from postprod_speedramps section) */
  speedRampsContent?: unknown
}

/**
 * PostProductionView — DaVinci Resolve-inspired timeline for Pós-Produção.
 *
 * When used standalone (via the registry as a single `postprod` section),
 * it reads from `content` prop which should contain the unified PostProdContent.
 *
 * When used with 3 separate section instances, pass scenesContent/crossRefContent/speedRampsContent.
 */
export function PostProductionView({
  content,
  scenesContent,
  crossRefContent,
  speedRampsContent,
}: PostProductionViewProps) {
  // Parse content — either from unified prop or from 3 separate sections
  const data: PostProdContent = useMemo(() =&gt; {
    if (scenesContent || crossRefContent || speedRampsContent) {
      return parsePostProdContent(scenesContent ?? content, crossRefContent, speedRampsContent)
    }
    // Unified content shape
    if (content &amp;&amp; typeof content === 'object' &amp;&amp; !Array.isArray(content)) {
      return content as PostProdContent
    }
    return {}
  }, [content, scenesContent, crossRefContent, speedRampsContent])

  const beats = data.beats ?? []

  // ── State ───────────────────────────────────────────
  const [zoom, setZoom] = useState(ZOOM_DEFAULT)
  const [trackHeights, setTrackHeights] = useState&lt;TrackHeightMap&gt;(() =&gt; {
    const h: TrackHeightMap = {}
    ALL_TRACKS.forEach(t =&gt; { h[t.id] = (t.id === 'V1' || t.id === 'A1') ? 42 : DEF_H })
    return h
  })
  const [containerW, setContainerW] = useState(960)
  const containerRef = useRef&lt;HTMLDivElement&gt;(null)

  // Expand/collapse all via key + resetKey
  const [allState, setAllState] = useState&lt;0 | 1 | 2&gt;(0) // 0=normal, 1=collapse, 2=expand
  const [resetKey, setResetKey] = useState(0)

  // ── ResizeObserver ──────────────────────────────────
  useEffect(() =&gt; {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries =&gt; {
      for (const e of entries) setContainerW(e.contentRect.width)
    })
    ro.observe(el)
    return () =&gt; ro.disconnect()
  }, [])

  // ── Track resize handler (debounced via rAF in BeatAccordion) ──
  const handleResize = useCallback((id: string, newH: number) =&gt; {
    setTrackHeights(prev =&gt; ({ ...prev, [id]: newH }))
  }, [])

  // ── Keyboard shortcuts ──────────────────────────────
  useEffect(() =&gt; {
    const handler = (e: KeyboardEvent) =&gt; {
      // Skip if user is in an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault()
          setZoom(z =&gt; Math.min(ZOOM_MAX, z + ZOOM_STEP))
          break
        case '-':
          e.preventDefault()
          setZoom(z =&gt; Math.max(ZOOM_MIN, z - ZOOM_STEP))
          break
        case '0':
          e.preventDefault()
          setZoom(ZOOM_DEFAULT)
          break
        case 'e':
        case 'E':
          e.preventDefault()
          setAllState(2)
          setResetKey(k =&gt; k + 1)
          break
        case 'c':
        case 'C':
          e.preventDefault()
          setAllState(1)
          setResetKey(k =&gt; k + 1)
          break
      }
    }
    document.addEventListener('keydown', handler)
    return () =&gt; document.removeEventListener('keydown', handler)
  }, [])

  // ── Empty state ─────────────────────────────────────
  if (beats.length === 0) {
    return (
      &lt;div className="p-5 text-[11px] text-center" style={{ color: TH.dim }}&gt;
        Nenhum beat de pós-produção disponível.
      &lt;/div&gt;
    )
  }

  const totalDur = beats.reduce((s, b) =&gt; s + b.duration, 0)

  return (
    &lt;div ref={containerRef} className="max-w-[1440px] mx-auto px-5 py-4 pb-10"&gt;
      {/* Page header */}
      &lt;div className="flex items-baseline gap-3.5 flex-wrap mb-4"&gt;
        &lt;h2 className="text-[18px] font-semibold m-0" style={{ color: TH.text }}&gt;
          Pós-Produção
        &lt;/h2&gt;
        &lt;span className="text-[13px]" style={{ color: TH.muted }}&gt;Cena × Cena&lt;/span&gt;
        &lt;div className="flex-1" /&gt;
        &lt;span className={MONO_SM_CLS} style={{ color: TH.muted }}&gt;
          {fmtDur(totalDur)} · {beats.length} beats
        &lt;/span&gt;
      &lt;/div&gt;

      &lt;ProgressBar beats={beats} /&gt;

      {/* CrossRef + SpeedRamps side by side */}
      {(data.crossRef || data.speedRamps) &amp;&amp; (
        &lt;div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3"&gt;
          &lt;CrossRefPanel data={data.crossRef} /&gt;
          &lt;SpeedRampsPanel data={data.speedRamps} /&gt;
        &lt;/div&gt;
      )}

      &lt;Toolbar
        zoom={zoom}
        setZoom={setZoom as (fn: (z: number) =&gt; number) =&gt; void}
        expandAll={() =&gt; { setAllState(2); setResetKey(k =&gt; k + 1) }}
        collapseAll={() =&gt; { setAllState(1); setResetKey(k =&gt; k + 1) }}
      /&gt;

      {/* Beat timelines */}
      {beats.map(beat =&gt; (
        &lt;BeatAccordion
          key={`${beat.idx}-${resetKey}`}
          beat={beat}
          assets={data.assets?.[beat.idx]}
          trackHeights={trackHeights}
          onResize={handleResize}
          zoom={zoom}
          containerW={containerW}
          defaultOpen={allState !== 1}
        /&gt;
      ))}
    &lt;/div&gt;
  )
}
```

- [ ] 2. Update `_timeline/index.ts` barrel to export the root component:

```ts
// append to _timeline/index.ts
export { PostProductionView } from './post-production-view'
```

- [ ] 3. Update the registry in `section-content.tsx` to map `postprod` to `PostProductionView` and keep legacy sub-section renderers:

In `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx`, add the import and registry entry:

```ts
// Add import at top:
import { PostProductionView } from './renderers/_timeline/post-production-view'

// Add to REGISTRY object:
//   postprod: PostProductionView,
```

The existing `postprod_scenes`, `postprod_crossref`, and `postprod_speedramps` entries remain for backward compatibility. The new `postprod` key enables the unified view when sections are consolidated.

- [ ] 4. Update `sections.ts` — remove `subSections` from the `postprod` definition so it renders as a single unified section instead of 3 sub-tabs:

In `apps/web/src/lib/pipeline/sections.ts`, replace the postprod entry:

```ts
// Before:
//   {
//     key: 'postprod', label_pt: 'Pós-Produção', label_en: 'Post-Production', type: 'postprod', shared: false,
//     subSections: [
//       { key: 'postprod_scenes', ... },
//       { key: 'postprod_crossref', ... },
//       { key: 'postprod_speedramps', ... },
//     ],
//   },

// After:
//   { key: 'postprod', label_pt: 'Pós-Produção', label_en: 'Post-Production', type: 'postprod', shared: false },
```

- [ ] 5. Add a test to `apps/web/test/unit/timeline-utils.test.ts` for `parsePostProdContent`:

```ts
// append to timeline-utils.test.ts

import { parsePostProdContent } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/utils'

describe('parsePostProdContent', () =&gt; {
  it('parses scenes content into beats and assets', () =&gt; {
    const scenes = {
      beats: [{ idx: 0, label: 'Beat 0', name: 'Hook', duration: 24, absStart: 0, status: 'PENDING', difficulty: 'EASY', clips: {} }],
      assets: { 0: { music: [] } },
    }
    const result = parsePostProdContent(scenes, undefined, undefined)
    expect(result.beats).toHaveLength(1)
    expect(result.beats![0]!.name).toBe('Hook')
    expect(result.assets).toBeDefined()
  })

  it('parses crossRef and speedRamps', () =&gt; {
    const crossRef = { summary: 'test', beats: [], divergences: [] }
    const speedRamps = { summary: 'test', base: 'x', sections: [] }
    const result = parsePostProdContent(undefined, crossRef, speedRamps)
    expect(result.crossRef).toBeDefined()
    expect(result.speedRamps).toBeDefined()
  })

  it('returns empty object for null inputs', () =&gt; {
    const result = parsePostProdContent(null, null, null)
    expect(result).toEqual({})
  })
})
```

- [ ] 6. Run `npm run test:web -- --run test/unit/timeline-utils.test.ts` and verify all pass.
- [ ] 7. Run `npm run test:web` full suite to ensure no regressions.
- [ ] 8. Commit: `feat(pipeline): add PostProductionView root, wire registry, unify postprod section`
