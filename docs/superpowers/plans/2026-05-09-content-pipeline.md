# Content Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a planning-layer CMS module for multi-format content pipeline with full REST API, format-specific kanban boards, and Claude Cowork integration.

**Architecture:** Next.js API routes for the REST layer (pipeline/* prefix), server actions for CMS UI mutations, Supabase DB with RLS. Pipeline items use FK to `pipeline_workflows` for stage validation, cursor-based pagination, optimistic locking via `version` field.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, Supabase (PostgreSQL 17), Zod, Vitest

---

## File Structure

### Database
- `supabase/migrations/20260509000001_content_pipeline.sql` — all tables, indexes, triggers, RLS, workflow seeds, blog taxonomy migration

### Shared Logic (lib layer)
- `apps/web/src/lib/pipeline/schemas.ts` — Zod schemas for all pipeline types + format metadata
- `apps/web/src/lib/pipeline/workflows.ts` — workflow definitions, stage helpers, default checklists
- `apps/web/src/lib/pipeline/validation.ts` — validation score computation
- `apps/web/src/lib/pipeline/auth.ts` — API key verification + rate limiting middleware
- `apps/web/src/lib/pipeline/queries.ts` — reusable Supabase query builders

### REST API Routes
- `apps/web/src/app/api/pipeline/route.ts` — GET manifest (discovery)
- `apps/web/src/app/api/pipeline/context/route.ts` — GET all / PUT (no key)
- `apps/web/src/app/api/pipeline/context/[key]/route.ts` — GET / PUT / DELETE
- `apps/web/src/app/api/pipeline/collections/route.ts` — GET list / POST create
- `apps/web/src/app/api/pipeline/collections/[id]/route.ts` — GET / PUT / DELETE
- `apps/web/src/app/api/pipeline/items/route.ts` — GET list / POST create
- `apps/web/src/app/api/pipeline/items/[id]/route.ts` — GET / PATCH / DELETE
- `apps/web/src/app/api/pipeline/items/[id]/advance/route.ts` — POST
- `apps/web/src/app/api/pipeline/items/[id]/retreat/route.ts` — POST
- `apps/web/src/app/api/pipeline/items/[id]/checklist/route.ts` — POST
- `apps/web/src/app/api/pipeline/items/[id]/graduate/route.ts` — POST
- `apps/web/src/app/api/pipeline/items/[id]/restore/route.ts` — POST
- `apps/web/src/app/api/pipeline/items/bulk/route.ts` — POST
- `apps/web/src/app/api/pipeline/workflows/route.ts` — GET
- `apps/web/src/app/api/pipeline/search/route.ts` — GET
- `apps/web/src/app/api/pipeline/stats/route.ts` — GET
- `apps/web/src/app/api/pipeline/topics/[code]/route.ts` — GET

### CMS UI (Server Actions + Pages)
- `apps/web/src/app/cms/(authed)/pipeline/actions.ts` — server actions for CMS UI
- `apps/web/src/app/cms/(authed)/pipeline/page.tsx` — Overview
- `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx` — Format board (video/blog/newsletter/course/campaign)
- `apps/web/src/app/cms/(authed)/pipeline/all/page.tsx` — All formats overview
- `apps/web/src/app/cms/(authed)/pipeline/list/page.tsx` — Table/list view
- `apps/web/src/app/cms/(authed)/pipeline/collections/page.tsx` — Collections
- `apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx` — Item detail
- `apps/web/src/app/cms/(authed)/pipeline/reference/page.tsx` — Reference editor
- `apps/web/src/app/cms/(authed)/pipeline/search/page.tsx` — Search
- `apps/web/src/app/cms/(authed)/pipeline/topics/[code]/page.tsx` — Topic aggregation
- `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx` — Kanban board
- `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-card.tsx` — Board card
- `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-list-table.tsx` — Table view
- `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx` — Item detail panel
- `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview-cards.tsx` — KPI/format cards
- `apps/web/src/app/cms/(authed)/pipeline/_components/collection-manager.tsx` — Collection CRUD
- `apps/web/src/app/cms/(authed)/pipeline/_components/reference-editor.tsx` — Split-pane editor
- `apps/web/src/app/cms/(authed)/pipeline/_components/search-results.tsx` — Search UI

### Seed Script
- `scripts/seed-pipeline.ts` — Parse dashboard.html + seed DB

### Tests
- `apps/web/test/cms/pipeline-actions.test.ts`
- `apps/web/test/cms/pipeline-board.test.tsx`
- `apps/web/test/cms/pipeline-item-detail.test.tsx`
- `apps/web/test/api/pipeline-items.test.ts`
- `apps/web/test/api/pipeline-auth.test.ts`
- `apps/web/test/api/pipeline-advance.test.ts`
- `apps/web/test/api/pipeline-search.test.ts`
- `apps/web/test/lib/pipeline-schemas.test.ts`
- `apps/web/test/lib/pipeline-validation.test.ts`

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260509000001_content_pipeline.sql`

- [ ] **Step 1: Create migration file with workflow + pipeline tables**

```sql
-- supabase/migrations/20260509000001_content_pipeline.sql

BEGIN;

-- ============================================================
-- pipeline_workflows (format-specific stage definitions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pipeline_workflows (
  format text NOT NULL,
  stage text NOT NULL,
  "position" integer NOT NULL,
  label_pt text NOT NULL,
  label_en text NOT NULL,
  PRIMARY KEY (format, stage)
);

ALTER TABLE public.pipeline_workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pipeline_workflows_public_read ON public.pipeline_workflows;
CREATE POLICY pipeline_workflows_public_read ON public.pipeline_workflows
  FOR SELECT USING (true);

-- ============================================================
-- content_pipeline (main items table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.content_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  code text NOT NULL,
  title_pt text,
  title_en text,
  slug text,
  format text NOT NULL,
  stage text NOT NULL DEFAULT 'idea',
  language text NOT NULL DEFAULT 'pt-br' CHECK (language IN ('pt-br', 'en', 'both')),
  priority integer DEFAULT 0 CHECK (priority BETWEEN 0 AND 5),
  parent_id uuid REFERENCES public.content_pipeline(id),
  hook text,
  synopsis text,
  body_content text,
  body_compiled text,
  format_metadata jsonb DEFAULT '{}',
  production_checklist jsonb DEFAULT '[]',
  validation_score jsonb,
  tags text[] DEFAULT '{}',
  youtube_video_id uuid REFERENCES public.youtube_videos(id),
  blog_post_id uuid REFERENCES public.blog_posts(id),
  newsletter_edition_id uuid REFERENCES public.newsletter_editions(id),
  campaign_id uuid REFERENCES public.campaigns(id),
  is_archived boolean DEFAULT false,
  archived_at timestamptz,
  archive_reason text,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id),
  assigned_to uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_at timestamptz,
  search_vector tsvector,
  UNIQUE (site_id, code),
  CONSTRAINT valid_stage FOREIGN KEY (format, stage) REFERENCES public.pipeline_workflows(format, stage)
);

-- ============================================================
-- content_collections
-- ============================================================
CREATE TABLE IF NOT EXISTS public.content_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('playlist', 'category', 'series', 'arc', 'launch')),
  parent_id uuid REFERENCES public.content_collections(id),
  metadata jsonb DEFAULT '{}',
  "position" integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (site_id, code)
);

-- ============================================================
-- content_pipeline_memberships
-- ============================================================
CREATE TABLE IF NOT EXISTS public.content_pipeline_memberships (
  pipeline_id uuid NOT NULL REFERENCES public.content_pipeline(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.content_collections(id) ON DELETE CASCADE,
  "position" integer DEFAULT 0,
  role text DEFAULT 'member',
  PRIMARY KEY (pipeline_id, collection_id)
);

-- ============================================================
-- content_pipeline_history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.content_pipeline_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.content_pipeline(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_value text,
  to_value text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now(),
  notes text
);

-- ============================================================
-- pipeline_dependencies
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pipeline_dependencies (
  blocker_id uuid NOT NULL REFERENCES public.content_pipeline(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.content_pipeline(id) ON DELETE CASCADE,
  dependency_type text NOT NULL DEFAULT 'soft' CHECK (dependency_type IN ('soft', 'hard')),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

-- ============================================================
-- pipeline_api_keys
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pipeline_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  label text NOT NULL,
  key_hash text NOT NULL,
  permissions text[] DEFAULT '{read}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- reference_content
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reference_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  key text NOT NULL,
  title text NOT NULL,
  content_md text,
  content_compact jsonb,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE (site_id, key)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pipeline_site_format ON public.content_pipeline(site_id, format) WHERE NOT is_archived;
CREATE INDEX IF NOT EXISTS idx_pipeline_site_stage ON public.content_pipeline(site_id, format, stage) WHERE NOT is_archived;
CREATE INDEX IF NOT EXISTS idx_pipeline_search ON public.content_pipeline USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_pipeline_tags ON public.content_pipeline USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_pipeline_parent ON public.content_pipeline(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_graduated_blog ON public.content_pipeline(blog_post_id) WHERE blog_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collections_site_type ON public.content_collections(site_id, type);
CREATE INDEX IF NOT EXISTS idx_memberships_collection ON public.content_pipeline_memberships(collection_id);
CREATE INDEX IF NOT EXISTS idx_memberships_pipeline ON public.content_pipeline_memberships(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_history_pipeline ON public.content_pipeline_history(pipeline_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.pipeline_api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reference_site_key ON public.reference_content(site_id, key);

-- ============================================================
-- Functions & Triggers
-- ============================================================

-- Search vector (bilingual, weighted, body capped at 10k chars)
CREATE OR REPLACE FUNCTION public.pipeline_search_vector_update() RETURNS trigger
  LANGUAGE plpgsql AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_pipeline_search ON public.content_pipeline;
CREATE TRIGGER trg_pipeline_search
  BEFORE INSERT OR UPDATE OF title_pt, title_en, hook, synopsis, tags, body_content
  ON public.content_pipeline FOR EACH ROW EXECUTE FUNCTION public.pipeline_search_vector_update();

-- Auto updated_at + version increment
CREATE OR REPLACE FUNCTION public.pipeline_updated_at() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF OLD.version = NEW.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_updated ON public.content_pipeline;
CREATE TRIGGER trg_pipeline_updated
  BEFORE UPDATE ON public.content_pipeline FOR EACH ROW EXECUTE FUNCTION public.pipeline_updated_at();

-- Record stage changes in history
CREATE OR REPLACE FUNCTION public.pipeline_record_stage_change() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.content_pipeline_history (pipeline_id, event_type, from_value, to_value, changed_by)
    VALUES (NEW.id, 'stage_change', OLD.stage, NEW.stage, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_stage_history ON public.content_pipeline;
CREATE TRIGGER trg_pipeline_stage_history
  AFTER UPDATE OF stage ON public.content_pipeline FOR EACH ROW EXECUTE FUNCTION public.pipeline_record_stage_change();

-- Prevent format change after creation
CREATE OR REPLACE FUNCTION public.pipeline_immutable_format() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.format IS DISTINCT FROM NEW.format THEN
    RAISE EXCEPTION 'Cannot change format after creation. Create a new item instead.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_immutable_format ON public.content_pipeline;
CREATE TRIGGER trg_pipeline_immutable_format
  BEFORE UPDATE OF format ON public.content_pipeline FOR EACH ROW EXECUTE FUNCTION public.pipeline_immutable_format();

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.content_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pipeline_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pipeline_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_content ENABLE ROW LEVEL SECURITY;

-- content_pipeline
DROP POLICY IF EXISTS pipeline_staff_read ON public.content_pipeline;
CREATE POLICY pipeline_staff_read ON public.content_pipeline FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));
DROP POLICY IF EXISTS pipeline_staff_write ON public.content_pipeline;
CREATE POLICY pipeline_staff_write ON public.content_pipeline FOR ALL TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- content_collections
DROP POLICY IF EXISTS collections_staff_read ON public.content_collections;
CREATE POLICY collections_staff_read ON public.content_collections FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));
DROP POLICY IF EXISTS collections_staff_write ON public.content_collections;
CREATE POLICY collections_staff_write ON public.content_collections FOR ALL TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- content_pipeline_memberships
DROP POLICY IF EXISTS memberships_staff_read ON public.content_pipeline_memberships;
CREATE POLICY memberships_staff_read ON public.content_pipeline_memberships FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_pipeline p WHERE p.id = pipeline_id AND public.can_view_site(p.site_id)));
DROP POLICY IF EXISTS memberships_staff_write ON public.content_pipeline_memberships;
CREATE POLICY memberships_staff_write ON public.content_pipeline_memberships FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_pipeline p WHERE p.id = pipeline_id AND public.can_edit_site(p.site_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.content_pipeline p WHERE p.id = pipeline_id AND public.can_edit_site(p.site_id)));

-- content_pipeline_history
DROP POLICY IF EXISTS history_staff_read ON public.content_pipeline_history;
CREATE POLICY history_staff_read ON public.content_pipeline_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_pipeline p WHERE p.id = pipeline_id AND public.can_view_site(p.site_id)));

-- pipeline_dependencies
DROP POLICY IF EXISTS deps_staff_read ON public.pipeline_dependencies;
CREATE POLICY deps_staff_read ON public.pipeline_dependencies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_pipeline p WHERE p.id = blocker_id AND public.can_view_site(p.site_id)));
DROP POLICY IF EXISTS deps_staff_write ON public.pipeline_dependencies;
CREATE POLICY deps_staff_write ON public.pipeline_dependencies FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_pipeline p WHERE p.id = blocker_id AND public.can_edit_site(p.site_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.content_pipeline p WHERE p.id = blocker_id AND public.can_edit_site(p.site_id)));

-- reference_content
DROP POLICY IF EXISTS reference_staff_read ON public.reference_content;
CREATE POLICY reference_staff_read ON public.reference_content FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));
DROP POLICY IF EXISTS reference_staff_write ON public.reference_content;
CREATE POLICY reference_staff_write ON public.reference_content FOR ALL TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- pipeline_api_keys (admin only)
DROP POLICY IF EXISTS api_keys_admin_read ON public.pipeline_api_keys;
CREATE POLICY api_keys_admin_read ON public.pipeline_api_keys FOR SELECT TO authenticated
  USING (public.can_admin_site_users(site_id));
DROP POLICY IF EXISTS api_keys_admin_write ON public.pipeline_api_keys;
CREATE POLICY api_keys_admin_write ON public.pipeline_api_keys FOR ALL TO authenticated
  USING (public.can_admin_site_users(site_id))
  WITH CHECK (public.can_admin_site_users(site_id));

-- ============================================================
-- Seed: Workflow definitions
-- ============================================================
INSERT INTO public.pipeline_workflows (format, stage, "position", label_pt, label_en) VALUES
  ('video', 'idea', 1, 'Ideia', 'Idea'),
  ('video', 'roteiro', 2, 'Roteiro', 'Script'),
  ('video', 'gravacao', 3, 'Gravação', 'Recording'),
  ('video', 'edicao', 4, 'Edição', 'Editing'),
  ('video', 'pos_producao', 5, 'Pós-produção', 'Post-production'),
  ('video', 'scheduled', 6, 'Agendado', 'Scheduled'),
  ('video', 'published', 7, 'Publicado', 'Published'),
  ('blog_post', 'idea', 1, 'Ideia', 'Idea'),
  ('blog_post', 'draft', 2, 'Rascunho', 'Draft'),
  ('blog_post', 'ready', 3, 'Pronto', 'Ready'),
  ('blog_post', 'scheduled', 4, 'Agendado', 'Scheduled'),
  ('blog_post', 'published', 5, 'Publicado', 'Published'),
  ('newsletter', 'idea', 1, 'Ideia', 'Idea'),
  ('newsletter', 'draft', 2, 'Rascunho', 'Draft'),
  ('newsletter', 'ready', 3, 'Pronto', 'Ready'),
  ('newsletter', 'scheduled', 4, 'Agendado', 'Scheduled'),
  ('newsletter', 'published', 5, 'Publicado', 'Published'),
  ('course', 'idea', 1, 'Ideia', 'Idea'),
  ('course', 'outline', 2, 'Outline', 'Outline'),
  ('course', 'modulos', 3, 'Módulos', 'Modules'),
  ('course', 'review', 4, 'Revisão', 'Review'),
  ('course', 'published', 5, 'Publicado', 'Published'),
  ('campaign', 'idea', 1, 'Ideia', 'Idea'),
  ('campaign', 'draft', 2, 'Rascunho', 'Draft'),
  ('campaign', 'approved', 3, 'Aprovada', 'Approved'),
  ('campaign', 'scheduled', 4, 'Agendada', 'Scheduled'),
  ('campaign', 'sent', 5, 'Enviada', 'Sent')
ON CONFLICT (format, stage) DO NOTHING;

-- ============================================================
-- Blog taxonomy migration
-- ============================================================
UPDATE public.blog_posts SET category = 'building' WHERE category IN ('tech', 'code');
UPDATE public.blog_posts SET category = 'stories' WHERE category IN ('vida', 'viagem');
UPDATE public.blog_posts SET category = 'money' WHERE category = 'negocio';
UPDATE public.blog_posts SET category = 'bts' WHERE category = 'crescimento';

ALTER TABLE public.blog_posts DROP CONSTRAINT IF EXISTS blog_posts_category_check;
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_category_check
  CHECK (category IN ('stories', 'building', 'money', 'bts'));

-- Seed category collections
DO $$ DECLARE v_site_id uuid;
BEGIN
  SELECT id INTO v_site_id FROM public.sites LIMIT 1;
  IF v_site_id IS NOT NULL THEN
    INSERT INTO public.content_collections (site_id, code, name, type, "position") VALUES
      (v_site_id, 'stories', 'Stories', 'category', 1),
      (v_site_id, 'building', 'Building', 'category', 2),
      (v_site_id, 'money', 'Money', 'category', 3),
      (v_site_id, 'bts', 'BTS', 'category', 4)
    ON CONFLICT (site_id, code) DO NOTHING;
  END IF;
END $$;

COMMIT;
```

- [ ] **Step 2: Verify migration applies locally**

Run: `npm run db:reset`
Expected: Migration completes without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260509000001_content_pipeline.sql
git commit -m "feat(db): add content pipeline schema, workflows, blog taxonomy migration"
```

---

## Task 2: Shared Library — Schemas & Workflows

**Files:**
- Create: `apps/web/src/lib/pipeline/schemas.ts`
- Create: `apps/web/src/lib/pipeline/workflows.ts`
- Test: `apps/web/test/lib/pipeline-schemas.test.ts`

- [ ] **Step 1: Write the schema tests**

```typescript
// apps/web/test/lib/pipeline-schemas.test.ts
import { describe, it, expect } from 'vitest'
import {
  PipelineItemCreateSchema,
  PipelineItemUpdateSchema,
  VideoMetadataSchema,
  BlogPostMetadataSchema,
  NewsletterMetadataSchema,
  CourseMetadataSchema,
  CampaignMetadataSchema,
  CollectionCreateSchema,
  ReferenceContentUpsertSchema,
} from '@/lib/pipeline/schemas'

describe('PipelineItemCreateSchema', () => {
  it('validates a minimal video item', () => {
    const result = PipelineItemCreateSchema.safeParse({
      title_pt: 'Meu vídeo',
      format: 'video',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown format', () => {
    const result = PipelineItemCreateSchema.safeParse({
      title_pt: 'X',
      format: 'podcast',
    })
    expect(result.success).toBe(false)
  })

  it('rejects priority out of range', () => {
    const result = PipelineItemCreateSchema.safeParse({
      title_pt: 'X',
      format: 'video',
      priority: 10,
    })
    expect(result.success).toBe(false)
  })

  it('accepts bilingual item', () => {
    const result = PipelineItemCreateSchema.safeParse({
      title_pt: 'Título PT',
      title_en: 'Title EN',
      format: 'blog_post',
      language: 'both',
      tags: ['ai', 'tools'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts batch of items (array)', () => {
    const result = PipelineItemCreateSchema.array().max(50).safeParse([
      { title_pt: 'A', format: 'video' },
      { title_en: 'B', format: 'blog_post' },
    ])
    expect(result.success).toBe(true)
  })
})

describe('VideoMetadataSchema', () => {
  it('validates complete video metadata', () => {
    const result = VideoMetadataSchema.safeParse({
      playlist_letter: 'G',
      episode_number: 14,
      duration_estimate_min: 12,
    })
    expect(result.success).toBe(true)
  })

  it('allows empty object', () => {
    expect(VideoMetadataSchema.safeParse({}).success).toBe(true)
  })
})

describe('CollectionCreateSchema', () => {
  it('validates a launch collection', () => {
    const result = CollectionCreateSchema.safeParse({
      code: 'q2-launch',
      name: 'Q2 Launch',
      type: 'launch',
      metadata: { target_date: '2026-06-01', description: 'Ship it' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid type', () => {
    const result = CollectionCreateSchema.safeParse({
      code: 'x',
      name: 'X',
      type: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})

describe('ReferenceContentUpsertSchema', () => {
  it('validates markdown reference', () => {
    const result = ReferenceContentUpsertSchema.safeParse({
      title: 'Audience Profile',
      content_md: '# Profile\n\nTech founders aged 25-40',
    })
    expect(result.success).toBe(true)
  })

  it('validates compact JSON reference', () => {
    const result = ReferenceContentUpsertSchema.safeParse({
      title: 'Guidelines',
      content_compact: { tone: 'casual', length: 'medium' },
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run apps/web/test/lib/pipeline-schemas.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement schemas**

```typescript
// apps/web/src/lib/pipeline/schemas.ts
import { z } from 'zod'

export const FORMATS = ['video', 'blog_post', 'newsletter', 'course', 'campaign'] as const
export type Format = (typeof FORMATS)[number]

export const LANGUAGES = ['pt-br', 'en', 'both'] as const
export type Language = (typeof LANGUAGES)[number]

export const COLLECTION_TYPES = ['playlist', 'category', 'series', 'arc', 'launch'] as const
export type CollectionType = (typeof COLLECTION_TYPES)[number]

// Format-specific metadata schemas
export const VideoMetadataSchema = z.object({
  playlist_letter: z.string().max(2).optional(),
  episode_number: z.number().int().positive().optional(),
  duration_estimate_min: z.number().positive().optional(),
  thumbnail_concept: z.string().optional(),
  recording_location: z.string().optional(),
  equipment_notes: z.string().optional(),
}).strict()

export const BlogPostMetadataSchema = z.object({
  word_count_target: z.number().int().positive().optional(),
  seo_keyword: z.string().optional(),
  cover_image_concept: z.string().optional(),
  series_position: z.number().int().positive().optional(),
}).strict()

export const NewsletterMetadataSchema = z.object({
  edition_number: z.number().int().positive().optional(),
  newsletter_type_id: z.string().uuid().optional(),
  cadence: z.enum(['weekly', 'biweekly', 'monthly', 'one-off']).optional(),
  target_send_date: z.string().datetime().optional(),
}).strict()

export const CourseMetadataSchema = z.object({
  module_count: z.number().int().positive().optional(),
  platform: z.enum(['self-hosted', 'youtube', 'udemy', 'other']).optional(),
  price_model: z.enum(['free', 'paid', 'freemium']).optional(),
  prerequisite_courses: z.array(z.string()).optional(),
}).strict()

export const CampaignMetadataSchema = z.object({
  campaign_type: z.enum(['email', 'social', 'cross-platform']).optional(),
  target_audience: z.string().optional(),
  budget: z.number().positive().optional(),
  kpi_target: z.string().optional(),
}).strict()

export const FORMAT_METADATA_SCHEMAS: Record<Format, z.ZodType> = {
  video: VideoMetadataSchema,
  blog_post: BlogPostMetadataSchema,
  newsletter: NewsletterMetadataSchema,
  course: CourseMetadataSchema,
  campaign: CampaignMetadataSchema,
}

// Pipeline item schemas
export const PipelineItemCreateSchema = z.object({
  code: z.string().min(1).max(100).optional(),
  title_pt: z.string().max(500).optional(),
  title_en: z.string().max(500).optional(),
  slug: z.string().max(200).optional(),
  format: z.enum(FORMATS),
  stage: z.string().optional(),
  language: z.enum(LANGUAGES).default('pt-br'),
  priority: z.number().int().min(0).max(5).default(0),
  parent_id: z.string().uuid().optional(),
  hook: z.string().max(300).optional(),
  synopsis: z.string().max(2000).optional(),
  body_content: z.string().optional(),
  format_metadata: z.record(z.unknown()).default({}),
  production_checklist: z.array(z.object({
    label: z.string(),
    done: z.boolean().default(false),
    toggled_at: z.string().datetime().optional(),
  })).optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  assigned_to: z.string().uuid().optional(),
}).refine(
  (d) => d.title_pt || d.title_en,
  { message: 'At least one title (title_pt or title_en) is required' },
)

export const PipelineItemUpdateSchema = z.object({
  title_pt: z.string().max(500).optional(),
  title_en: z.string().max(500).optional(),
  slug: z.string().max(200).optional(),
  stage: z.string().optional(),
  language: z.enum(LANGUAGES).optional(),
  priority: z.number().int().min(0).max(5).optional(),
  hook: z.string().max(300).optional(),
  synopsis: z.string().max(2000).optional(),
  body_content: z.string().optional(),
  format_metadata: z.record(z.unknown()).optional(),
  production_checklist: z.array(z.object({
    label: z.string(),
    done: z.boolean().default(false),
    toggled_at: z.string().datetime().optional(),
  })).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  youtube_video_id: z.string().uuid().nullable().optional(),
  blog_post_id: z.string().uuid().nullable().optional(),
  newsletter_edition_id: z.string().uuid().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
}).partial()

export const CollectionCreateSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(COLLECTION_TYPES),
  parent_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
  position: z.number().int().default(0),
})

export const CollectionUpdateSchema = CollectionCreateSchema.partial().omit({ type: true })

export const ReferenceContentUpsertSchema = z.object({
  title: z.string().min(1).max(200),
  content_md: z.string().optional(),
  content_compact: z.record(z.unknown()).optional(),
})

export const ChecklistToggleSchema = z.object({
  index: z.number().int().min(0),
  done: z.boolean(),
})

export const GraduateSchema = z.object({
  target: z.enum(['blog_post', 'newsletter', 'campaign']),
  data: z.record(z.unknown()).optional(),
})

export const BulkOperationSchema = z.object({
  operations: z.array(z.discriminatedUnion('op', [
    z.object({ op: z.literal('advance'), id: z.string().uuid() }),
    z.object({ op: z.literal('retreat'), id: z.string().uuid() }),
    z.object({ op: z.literal('archive'), id: z.string().uuid() }),
    z.object({ op: z.literal('restore'), id: z.string().uuid() }),
    z.object({ op: z.literal('update'), id: z.string().uuid(), data: PipelineItemUpdateSchema, version: z.number().int() }),
    z.object({ op: z.literal('tag'), id: z.string().uuid(), data: z.object({ add: z.array(z.string()).default([]), remove: z.array(z.string()).default([]) }) }),
    z.object({ op: z.literal('move_collection'), id: z.string().uuid(), data: z.object({ collection_id: z.string().uuid(), position: z.number().int() }) }),
  ])).min(1).max(50),
})
```

- [ ] **Step 4: Implement workflows**

```typescript
// apps/web/src/lib/pipeline/workflows.ts
import type { Format } from './schemas'

export interface WorkflowStage {
  stage: string
  position: number
  label_pt: string
  label_en: string
}

export const WORKFLOWS: Record<Format, WorkflowStage[]> = {
  video: [
    { stage: 'idea', position: 1, label_pt: 'Ideia', label_en: 'Idea' },
    { stage: 'roteiro', position: 2, label_pt: 'Roteiro', label_en: 'Script' },
    { stage: 'gravacao', position: 3, label_pt: 'Gravação', label_en: 'Recording' },
    { stage: 'edicao', position: 4, label_pt: 'Edição', label_en: 'Editing' },
    { stage: 'pos_producao', position: 5, label_pt: 'Pós-produção', label_en: 'Post-production' },
    { stage: 'scheduled', position: 6, label_pt: 'Agendado', label_en: 'Scheduled' },
    { stage: 'published', position: 7, label_pt: 'Publicado', label_en: 'Published' },
  ],
  blog_post: [
    { stage: 'idea', position: 1, label_pt: 'Ideia', label_en: 'Idea' },
    { stage: 'draft', position: 2, label_pt: 'Rascunho', label_en: 'Draft' },
    { stage: 'ready', position: 3, label_pt: 'Pronto', label_en: 'Ready' },
    { stage: 'scheduled', position: 4, label_pt: 'Agendado', label_en: 'Scheduled' },
    { stage: 'published', position: 5, label_pt: 'Publicado', label_en: 'Published' },
  ],
  newsletter: [
    { stage: 'idea', position: 1, label_pt: 'Ideia', label_en: 'Idea' },
    { stage: 'draft', position: 2, label_pt: 'Rascunho', label_en: 'Draft' },
    { stage: 'ready', position: 3, label_pt: 'Pronto', label_en: 'Ready' },
    { stage: 'scheduled', position: 4, label_pt: 'Agendado', label_en: 'Scheduled' },
    { stage: 'published', position: 5, label_pt: 'Publicado', label_en: 'Published' },
  ],
  course: [
    { stage: 'idea', position: 1, label_pt: 'Ideia', label_en: 'Idea' },
    { stage: 'outline', position: 2, label_pt: 'Outline', label_en: 'Outline' },
    { stage: 'modulos', position: 3, label_pt: 'Módulos', label_en: 'Modules' },
    { stage: 'review', position: 4, label_pt: 'Revisão', label_en: 'Review' },
    { stage: 'published', position: 5, label_pt: 'Publicado', label_en: 'Published' },
  ],
  campaign: [
    { stage: 'idea', position: 1, label_pt: 'Ideia', label_en: 'Idea' },
    { stage: 'draft', position: 2, label_pt: 'Rascunho', label_en: 'Draft' },
    { stage: 'approved', position: 3, label_pt: 'Aprovada', label_en: 'Approved' },
    { stage: 'scheduled', position: 4, label_pt: 'Agendada', label_en: 'Scheduled' },
    { stage: 'sent', position: 5, label_pt: 'Enviada', label_en: 'Sent' },
  ],
}

export interface ChecklistItem {
  label: string
  done: boolean
  toggled_at?: string
}

export const DEFAULT_CHECKLISTS: Record<Format, ChecklistItem[]> = {
  video: [
    { label: 'Roteiro finalizado', done: false },
    { label: 'Thumbnail conceituada', done: false },
    { label: 'B-roll listado', done: false },
    { label: 'Equipamento verificado', done: false },
    { label: 'Gravação concluída', done: false },
    { label: 'Edição concluída', done: false },
    { label: 'Título + descrição SEO', done: false },
    { label: 'Cards e end screen', done: false },
  ],
  blog_post: [
    { label: 'Outline aprovado', done: false },
    { label: 'Rascunho escrito', done: false },
    { label: 'Revisão gramatical', done: false },
    { label: 'Imagens/mídia inseridos', done: false },
    { label: 'SEO meta preenchido', done: false },
    { label: 'CTA definido', done: false },
  ],
  newsletter: [
    { label: 'Tema definido', done: false },
    { label: 'Rascunho escrito', done: false },
    { label: 'Links verificados', done: false },
    { label: 'Preview testado', done: false },
    { label: 'Segmentação confirmada', done: false },
  ],
  course: [
    { label: 'Módulos definidos', done: false },
    { label: 'Material de cada módulo criado', done: false },
    { label: 'Exercícios/quizzes prontos', done: false },
    { label: 'Revisão de conteúdo', done: false },
    { label: 'Landing page criada', done: false },
  ],
  campaign: [
    { label: 'Objetivo definido', done: false },
    { label: 'Criativos prontos', done: false },
    { label: 'Segmentação definida', done: false },
    { label: 'Budget aprovado', done: false },
    { label: 'Tracking configurado', done: false },
  ],
}

export function getNextStage(format: Format, currentStage: string): string | null {
  const workflow = WORKFLOWS[format]
  const current = workflow.find((s) => s.stage === currentStage)
  if (!current) return null
  const next = workflow.find((s) => s.position === current.position + 1)
  return next?.stage ?? null
}

export function getPreviousStage(format: Format, currentStage: string): string | null {
  const workflow = WORKFLOWS[format]
  const current = workflow.find((s) => s.stage === currentStage)
  if (!current) return null
  const prev = workflow.find((s) => s.position === current.position - 1)
  return prev?.stage ?? null
}

export function getStagePosition(format: Format, stage: string): number {
  const workflow = WORKFLOWS[format]
  return workflow.find((s) => s.stage === stage)?.position ?? 0
}

export function isFinalStage(format: Format, stage: string): boolean {
  const workflow = WORKFLOWS[format]
  const maxPosition = Math.max(...workflow.map((s) => s.position))
  return getStagePosition(format, stage) === maxPosition
}

export function isFirstStage(format: Format, stage: string): boolean {
  return getStagePosition(format, stage) === 1
}

export function generateCode(format: Format, title: string, metadata?: Record<string, unknown>): string {
  const slug = title.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

  switch (format) {
    case 'video': {
      const letter = (metadata?.playlist_letter as string) || ''
      const ep = (metadata?.episode_number as number) || ''
      return letter && ep ? `${letter}${ep}-${slug}` : `vid-${slug}`
    }
    case 'blog_post':
      return `blog-${slug}`
    case 'newsletter':
      return `nl-${slug}`
    case 'course':
      return `course-${slug}`
    case 'campaign':
      return `camp-${slug}`
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:web -- --run apps/web/test/lib/pipeline-schemas.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/pipeline/schemas.ts apps/web/src/lib/pipeline/workflows.ts apps/web/test/lib/pipeline-schemas.test.ts
git commit -m "feat(pipeline): add Zod schemas and workflow definitions"
```

---

## Task 3: Shared Library — Validation & Auth

**Files:**
- Create: `apps/web/src/lib/pipeline/validation.ts`
- Create: `apps/web/src/lib/pipeline/auth.ts`
- Test: `apps/web/test/lib/pipeline-validation.test.ts`
- Test: `apps/web/test/api/pipeline-auth.test.ts`

- [ ] **Step 1: Write validation tests**

```typescript
// apps/web/test/lib/pipeline-validation.test.ts
import { describe, it, expect } from 'vitest'
import { computeValidationScore } from '@/lib/pipeline/validation'

describe('computeValidationScore', () => {
  it('returns 0 for empty item', () => {
    const score = computeValidationScore({
      title_pt: null,
      title_en: null,
      hook: null,
      synopsis: null,
      body_content: null,
      tags: [],
      production_checklist: [],
      format_metadata: {},
      memberships_count: 0,
      format: 'video',
    })
    expect(score.overall).toBe(0)
    expect(score.breakdown.has_title).toBe(false)
  })

  it('returns 100 for fully complete item', () => {
    const score = computeValidationScore({
      title_pt: 'Título',
      title_en: 'Title',
      hook: 'Great hook',
      synopsis: 'A synopsis here',
      body_content: 'Full body content',
      tags: ['ai'],
      production_checklist: [
        { label: 'A', done: true },
        { label: 'B', done: true },
      ],
      format_metadata: { playlist_letter: 'G', episode_number: 1 },
      memberships_count: 1,
      format: 'video',
    })
    expect(score.overall).toBe(100)
    expect(score.breakdown.has_title).toBe(true)
    expect(score.breakdown.checklist_pct).toBe(100)
  })

  it('handles partial checklist', () => {
    const score = computeValidationScore({
      title_pt: 'X',
      title_en: null,
      hook: null,
      synopsis: null,
      body_content: null,
      tags: [],
      production_checklist: [
        { label: 'A', done: true },
        { label: 'B', done: false },
        { label: 'C', done: false },
        { label: 'D', done: true },
      ],
      format_metadata: {},
      memberships_count: 0,
      format: 'blog_post',
    })
    expect(score.breakdown.checklist_pct).toBe(50)
    expect(score.breakdown.has_title).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run apps/web/test/lib/pipeline-validation.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement validation**

```typescript
// apps/web/src/lib/pipeline/validation.ts
import type { Format } from './schemas'
import { FORMAT_METADATA_SCHEMAS } from './schemas'

export interface ValidationScore {
  overall: number
  breakdown: {
    has_title: boolean
    has_hook: boolean
    has_synopsis: boolean
    has_body: boolean
    has_tags: boolean
    checklist_pct: number
    in_collection: boolean
    metadata_complete: boolean
  }
  computed_at: string
}

interface ValidationInput {
  title_pt: string | null
  title_en: string | null
  hook: string | null
  synopsis: string | null
  body_content: string | null
  tags: string[]
  production_checklist: Array<{ label: string; done: boolean }>
  format_metadata: Record<string, unknown>
  memberships_count: number
  format: Format
}

const WEIGHTS = {
  has_title: 20,
  has_hook: 15,
  has_synopsis: 10,
  has_body: 20,
  has_tags: 5,
  checklist_pct: 15,
  in_collection: 5,
  metadata_complete: 10,
}

export function computeValidationScore(input: ValidationInput): ValidationScore {
  const has_title = Boolean(input.title_pt || input.title_en)
  const has_hook = Boolean(input.hook)
  const has_synopsis = Boolean(input.synopsis)
  const has_body = Boolean(input.body_content)
  const has_tags = input.tags.length > 0
  const in_collection = input.memberships_count > 0

  const doneCount = input.production_checklist.filter((c) => c.done).length
  const totalCount = input.production_checklist.length
  const checklist_pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const schema = FORMAT_METADATA_SCHEMAS[input.format]
  const metaResult = schema.safeParse(input.format_metadata)
  const hasMetaValues = Object.values(input.format_metadata).some((v) => v !== undefined && v !== null && v !== '')
  const metadata_complete = metaResult.success && hasMetaValues

  const breakdown = { has_title, has_hook, has_synopsis, has_body, has_tags, checklist_pct, in_collection, metadata_complete }

  const overall = Math.round(
    (has_title ? WEIGHTS.has_title : 0) +
    (has_hook ? WEIGHTS.has_hook : 0) +
    (has_synopsis ? WEIGHTS.has_synopsis : 0) +
    (has_body ? WEIGHTS.has_body : 0) +
    (has_tags ? WEIGHTS.has_tags : 0) +
    (checklist_pct / 100) * WEIGHTS.checklist_pct +
    (in_collection ? WEIGHTS.in_collection : 0) +
    (metadata_complete ? WEIGHTS.metadata_complete : 0)
  )

  return { overall, breakdown, computed_at: new Date().toISOString() }
}
```

- [ ] **Step 4: Implement API key auth**

```typescript
// apps/web/src/lib/pipeline/auth.ts
import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

export interface PipelineAuth {
  siteId: string
  permissions: string[]
  source: 'api_key' | 'session'
}

const rateLimitMap = new Map<string, { count: number; window_start: number }>()
const RATE_LIMIT = 100
const WINDOW_MS = 60_000

function checkRateLimit(keyHash: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(keyHash)
  if (!entry || now - entry.window_start > WINDOW_MS) {
    rateLimitMap.set(keyHash, { count: 1, window_start: now })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export function getRateLimitHeaders(keyHash: string): Record<string, string> {
  const entry = rateLimitMap.get(keyHash)
  if (!entry) return { 'X-RateLimit-Remaining': String(RATE_LIMIT), 'X-RateLimit-Reset': '0' }
  const remaining = Math.max(0, RATE_LIMIT - entry.count)
  const resetMs = entry.window_start + WINDOW_MS - Date.now()
  return { 'X-RateLimit-Remaining': String(remaining), 'X-RateLimit-Reset': String(Math.ceil(resetMs / 1000)) }
}

export async function authenticatePipeline(req: NextRequest): Promise<
  { ok: true; auth: PipelineAuth } | { ok: false; status: number; error: string }
> {
  const apiKey = req.headers.get('X-Pipeline-Key')

  if (apiKey) {
    const keyHash = createHash('sha256').update(apiKey).digest('hex')

    if (!checkRateLimit(keyHash)) {
      return { ok: false, status: 429, error: 'Rate limit exceeded. Max 100 requests per minute.' }
    }

    const supabase = getSupabaseServiceClient()
    const { data: keyRow } = await supabase
      .from('pipeline_api_keys')
      .select('id, site_id, permissions')
      .eq('key_hash', keyHash)
      .is('revoked_at', null)
      .single()

    if (!keyRow) {
      return { ok: false, status: 401, error: 'Invalid or revoked API key' }
    }

    await supabase
      .from('pipeline_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRow.id)

    return { ok: true, auth: { siteId: keyRow.site_id, permissions: keyRow.permissions, source: 'api_key' } }
  }

  // Fall back to session auth
  try {
    const { siteId } = await getSiteContext()
    const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
    if (!res.ok) {
      return { ok: false, status: 403, error: 'Forbidden' }
    }
    return { ok: true, auth: { siteId, permissions: ['read', 'write', 'admin'], source: 'session' } }
  } catch {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
}

export function requirePermission(auth: PipelineAuth, required: 'read' | 'write' | 'admin'): boolean {
  if (required === 'read') return auth.permissions.includes('read') || auth.permissions.includes('write') || auth.permissions.includes('admin')
  if (required === 'write') return auth.permissions.includes('write') || auth.permissions.includes('admin')
  return auth.permissions.includes('admin')
}
```

- [ ] **Step 5: Write auth test**

```typescript
// apps/web/test/api/pipeline-auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'key-1', site_id: 'site-1', permissions: ['read', 'write'] },
            }),
          })),
        })),
      })),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })),
    })),
  })),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', timezone: 'America/Sao_Paulo' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'

describe('authenticatePipeline', () => {
  it('authenticates via API key', async () => {
    const req = new Request('http://localhost/api/pipeline/items', {
      headers: { 'X-Pipeline-Key': 'test-key-123' },
    }) as any
    req.headers = new Headers({ 'X-Pipeline-Key': 'test-key-123' })
    // NextRequest mock
    const result = await authenticatePipeline({ headers: req.headers } as any)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.auth.source).toBe('api_key')
      expect(result.auth.siteId).toBe('site-1')
    }
  })
})

describe('requirePermission', () => {
  it('read permission allows read', () => {
    expect(requirePermission({ siteId: 's', permissions: ['read'], source: 'api_key' }, 'read')).toBe(true)
  })

  it('read permission blocks write', () => {
    expect(requirePermission({ siteId: 's', permissions: ['read'], source: 'api_key' }, 'write')).toBe(false)
  })

  it('write permission allows read and write', () => {
    expect(requirePermission({ siteId: 's', permissions: ['write'], source: 'api_key' }, 'read')).toBe(true)
    expect(requirePermission({ siteId: 's', permissions: ['write'], source: 'api_key' }, 'write')).toBe(true)
  })

  it('admin allows everything', () => {
    expect(requirePermission({ siteId: 's', permissions: ['admin'], source: 'api_key' }, 'admin')).toBe(true)
  })
})
```

- [ ] **Step 6: Run all tests**

Run: `npm run test:web -- --run apps/web/test/lib/pipeline-validation.test.ts apps/web/test/api/pipeline-auth.test.ts`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/pipeline/validation.ts apps/web/src/lib/pipeline/auth.ts apps/web/test/lib/pipeline-validation.test.ts apps/web/test/api/pipeline-auth.test.ts
git commit -m "feat(pipeline): add validation score computation and API key auth"
```

---

## Task 4: REST API — Items CRUD + Cursor Pagination

**Files:**
- Create: `apps/web/src/lib/pipeline/queries.ts`
- Create: `apps/web/src/app/api/pipeline/items/route.ts`
- Create: `apps/web/src/app/api/pipeline/items/[id]/route.ts`
- Test: `apps/web/test/api/pipeline-items.test.ts`

- [ ] **Step 1: Write items API tests**

```typescript
// apps/web/test/api/pipeline-items.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockSingle = vi.fn()
const mockOrder = vi.fn()

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn().mockResolvedValue({
    ok: true,
    auth: { siteId: 'site-1', permissions: ['read', 'write', 'admin'], source: 'session' },
  }),
  requirePermission: vi.fn().mockReturnValue(true),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    })),
  })),
}))

describe('Pipeline Items API schemas', () => {
  it('PipelineItemCreateSchema rejects item with no title', async () => {
    const { PipelineItemCreateSchema } = await import('@/lib/pipeline/schemas')
    const result = PipelineItemCreateSchema.safeParse({ format: 'video' })
    expect(result.success).toBe(false)
  })

  it('PipelineItemCreateSchema accepts item with title_en only', async () => {
    const { PipelineItemCreateSchema } = await import('@/lib/pipeline/schemas')
    const result = PipelineItemCreateSchema.safeParse({ format: 'video', title_en: 'My Video' })
    expect(result.success).toBe(true)
  })

  it('BulkOperationSchema validates advance op', async () => {
    const { BulkOperationSchema } = await import('@/lib/pipeline/schemas')
    const result = BulkOperationSchema.safeParse({
      operations: [{ op: 'advance', id: '00000000-0000-0000-0000-000000000001' }],
    })
    expect(result.success).toBe(true)
  })

  it('BulkOperationSchema rejects >50 operations', async () => {
    const { BulkOperationSchema } = await import('@/lib/pipeline/schemas')
    const ops = Array.from({ length: 51 }, (_, i) => ({
      op: 'advance' as const,
      id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    }))
    const result = BulkOperationSchema.safeParse({ operations: ops })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run apps/web/test/api/pipeline-items.test.ts`
Expected: FAIL on import errors for missing route files (schemas should already pass)

- [ ] **Step 3: Implement query helpers**

```typescript
// apps/web/src/lib/pipeline/queries.ts
import { SupabaseClient } from '@supabase/supabase-js'

export interface CursorParams {
  cursor?: string
  limit?: number
  sort?: string
}

interface DecodedCursor {
  sort_value: string
  id: string
}

export function decodeCursor(cursor: string): DecodedCursor | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8')
    const [sort_value, id] = decoded.split('|')
    if (!sort_value || !id) return null
    return { sort_value, id }
  } catch {
    return null
  }
}

export function encodeCursor(sort_value: string, id: string): string {
  return Buffer.from(`${sort_value}|${id}`).toString('base64url')
}

export function parseSortParam(sort?: string): { column: string; ascending: boolean } {
  if (!sort) return { column: 'updated_at', ascending: false }
  const [col, dir] = sort.split(':')
  const allowed = ['updated_at', 'created_at', 'priority', 'title_pt', 'stage']
  const column = allowed.includes(col) ? col : 'updated_at'
  const ascending = dir === 'asc'
  return { column, ascending }
}

export function applyPipelineFilters(
  query: any,
  filters: {
    format?: string
    stage?: string
    collection?: string
    lang?: string
    archived?: string
    priority_min?: string
    priority_max?: string
    tag?: string
    parent_id?: string
    graduated?: string
    assigned_to?: string
    stale_days?: string
    search?: string
  },
) {
  if (filters.format) {
    const formats = filters.format.split(',')
    query = query.in('format', formats)
  }
  if (filters.stage) {
    const stages = filters.stage.split(',')
    query = query.in('stage', stages)
  }
  if (filters.lang) {
    if (filters.lang === 'both') {
      query = query.eq('language', 'both')
    } else {
      query = query.in('language', [filters.lang, 'both'])
    }
  }
  if (!filters.archived || filters.archived === 'false') {
    query = query.eq('is_archived', false)
  } else if (filters.archived === 'only') {
    query = query.eq('is_archived', true)
  }
  if (filters.priority_min) query = query.gte('priority', parseInt(filters.priority_min))
  if (filters.priority_max) query = query.lte('priority', parseInt(filters.priority_max))
  if (filters.tag) {
    const tags = filters.tag.split(',')
    query = query.contains('tags', tags)
  }
  if (filters.parent_id) query = query.eq('parent_id', filters.parent_id)
  if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to)
  if (filters.graduated === 'true') {
    query = query.or('blog_post_id.not.is.null,newsletter_edition_id.not.is.null,youtube_video_id.not.is.null,campaign_id.not.is.null')
  } else if (filters.graduated === 'false') {
    query = query.is('blog_post_id', null).is('newsletter_edition_id', null).is('youtube_video_id', null).is('campaign_id', null)
  }
  if (filters.search) {
    query = query.textSearch('search_vector', filters.search, { type: 'plain' })
  }
  return query
}
```

- [ ] **Step 4: Implement items list + create route**

```typescript
// apps/web/src/app/api/pipeline/items/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, getRateLimitHeaders } from '@/lib/pipeline/auth'
import { PipelineItemCreateSchema } from '@/lib/pipeline/schemas'
import { generateCode, DEFAULT_CHECKLISTS } from '@/lib/pipeline/workflows'
import { decodeCursor, encodeCursor, parseSortParam, applyPipelineFilters } from '@/lib/pipeline/queries'
import type { Format } from '@/lib/pipeline/schemas'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const params = req.nextUrl.searchParams
  const limit = Math.min(parseInt(params.get('limit') || '50'), 200)
  const cursorParam = params.get('cursor') || undefined
  const { column, ascending } = parseSortParam(params.get('sort') || undefined)

  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('content_pipeline')
    .select('*, content_pipeline_memberships(collection_id)', { count: 'exact' })
    .eq('site_id', auth.siteId)
    .order(column, { ascending })
    .order('id', { ascending })
    .limit(limit + 1)

  query = applyPipelineFilters(query, {
    format: params.get('format') || undefined,
    stage: params.get('stage') || undefined,
    collection: params.get('collection') || undefined,
    lang: params.get('lang') || undefined,
    archived: params.get('archived') || undefined,
    priority_min: params.get('priority_min') || undefined,
    priority_max: params.get('priority_max') || undefined,
    tag: params.get('tag') || undefined,
    parent_id: params.get('parent_id') || undefined,
    graduated: params.get('graduated') || undefined,
    assigned_to: params.get('assigned_to') || undefined,
    stale_days: params.get('stale_days') || undefined,
    search: params.get('search') || undefined,
  })

  if (cursorParam) {
    const decoded = decodeCursor(cursorParam)
    if (decoded) {
      const op = ascending ? 'gt' : 'lt'
      query = query.or(`${column}.${op}.${decoded.sort_value},and(${column}.eq.${decoded.sort_value},id.gt.${decoded.id})`)
    }
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })

  const hasNext = (data?.length ?? 0) > limit
  const items = data?.slice(0, limit) ?? []
  const lastItem = items[items.length - 1]
  const nextCursor = hasNext && lastItem ? encodeCursor(String(lastItem[column as keyof typeof lastItem]), lastItem.id) : undefined

  const headers = auth.source === 'api_key' ? getRateLimitHeaders('' /* keyHash */) : {}
  return NextResponse.json({
    data: items,
    meta: { total: count ?? 0, has_next: hasNext, next_cursor: nextCursor, limit },
  }, { headers })
}

export async function POST(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const body = await req.json()
  const isBatch = Array.isArray(body)
  const items = isBatch ? body : [body]

  if (items.length > 50) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Max 50 items per batch' } }, { status: 400 })
  }

  const parsed = items.map((item) => PipelineItemCreateSchema.safeParse(item))
  const firstError = parsed.find((p) => !p.success)
  if (firstError && !firstError.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: firstError.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const toInsert = parsed.map((p) => {
    const data = (p as any).data
    const format = data.format as Format
    const title = data.title_pt || data.title_en || 'untitled'
    const code = data.code || generateCode(format, title, data.format_metadata)
    const checklist = data.production_checklist || DEFAULT_CHECKLISTS[format]

    return {
      site_id: auth.siteId,
      code,
      title_pt: data.title_pt || null,
      title_en: data.title_en || null,
      slug: data.slug || null,
      format,
      stage: data.stage || 'idea',
      language: data.language,
      priority: data.priority,
      parent_id: data.parent_id || null,
      hook: data.hook || null,
      synopsis: data.synopsis || null,
      body_content: data.body_content || null,
      format_metadata: data.format_metadata,
      production_checklist: checklist,
      tags: data.tags,
      assigned_to: data.assigned_to || null,
    }
  })

  const { data: inserted, error } = await supabase
    .from('content_pipeline')
    .insert(toInsert)
    .select()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Duplicate code. Please use a unique code.' } }, { status: 409 })
    }
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
  }

  return NextResponse.json({ data: isBatch ? inserted : inserted?.[0] }, { status: 201 })
}
```

- [ ] **Step 5: Implement single item route (GET/PATCH/DELETE)**

```typescript
// apps/web/src/app/api/pipeline/items/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { PipelineItemUpdateSchema } from '@/lib/pipeline/schemas'
import { computeValidationScore } from '@/lib/pipeline/validation'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult

  const supabase = getSupabaseServiceClient()
  const { data: item, error } = await supabase
    .from('content_pipeline')
    .select('*, content_pipeline_memberships(collection_id, position, role, content_collections(id, code, name, type))')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (error || !item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })

  const { data: history } = await supabase
    .from('content_pipeline_history')
    .select('*')
    .eq('pipeline_id', id)
    .order('changed_at', { ascending: false })
    .limit(20)

  const { data: deps } = await supabase
    .from('pipeline_dependencies')
    .select('blocker_id, blocked_id, dependency_type')
    .or(`blocker_id.eq.${id},blocked_id.eq.${id}`)

  return NextResponse.json({
    data: { ...item, history: history ?? [], dependencies: deps ?? [] },
    meta: { version: item.version, etag: String(item.version), updated_at: item.updated_at },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const ifMatch = req.headers.get('If-Match')
  if (!ifMatch) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'If-Match header required' } }, { status: 400 })
  const expectedVersion = parseInt(ifMatch)

  const body = await req.json()
  const parsed = PipelineItemUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()

  const { data: current } = await supabase
    .from('content_pipeline')
    .select('version, format')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!current) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })
  if (current.version !== expectedVersion) {
    const { data: freshItem } = await supabase.from('content_pipeline').select('*').eq('id', id).single()
    return NextResponse.json({ error: { code: 'VERSION_CONFLICT', message: `Version mismatch. Current: ${current.version}`, details: { current_version: current.version, your_version: expectedVersion, current_state: freshItem } } }, { status: 409 })
  }

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update(updateData)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'VERSION_CONFLICT', message: 'Concurrent modification detected' } }, { status: 409 })
  }

  return NextResponse.json({ data: updated, meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at } })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('content_pipeline')
    .update({ is_archived: true, archived_at: new Date().toISOString(), archive_reason: 'Archived via API' })
    .eq('id', id)
    .eq('site_id', auth.siteId)

  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
  return NextResponse.json({ data: { archived: true } })
}
```

- [ ] **Step 6: Run tests**

Run: `npm run test:web -- --run apps/web/test/api/pipeline-items.test.ts`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/pipeline/queries.ts apps/web/src/app/api/pipeline/items/ apps/web/test/api/pipeline-items.test.ts
git commit -m "feat(pipeline): add items CRUD API with cursor pagination"
```

---

## Task 5: REST API — Advance/Retreat + Checklist + Graduate + Restore

**Files:**
- Create: `apps/web/src/app/api/pipeline/items/[id]/advance/route.ts`
- Create: `apps/web/src/app/api/pipeline/items/[id]/retreat/route.ts`
- Create: `apps/web/src/app/api/pipeline/items/[id]/checklist/route.ts`
- Create: `apps/web/src/app/api/pipeline/items/[id]/graduate/route.ts`
- Create: `apps/web/src/app/api/pipeline/items/[id]/restore/route.ts`
- Test: `apps/web/test/api/pipeline-advance.test.ts`

- [ ] **Step 1: Write advance/retreat tests**

```typescript
// apps/web/test/api/pipeline-advance.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getNextStage, getPreviousStage, isFinalStage, isFirstStage } from '@/lib/pipeline/workflows'

describe('Stage advancement logic', () => {
  it('video: idea -> roteiro', () => {
    expect(getNextStage('video', 'idea')).toBe('roteiro')
  })

  it('video: published -> null (final)', () => {
    expect(getNextStage('video', 'published')).toBeNull()
  })

  it('video: idea has no previous', () => {
    expect(getPreviousStage('video', 'idea')).toBeNull()
  })

  it('video: roteiro -> idea (retreat)', () => {
    expect(getPreviousStage('video', 'roteiro')).toBe('idea')
  })

  it('blog_post: draft -> ready', () => {
    expect(getNextStage('blog_post', 'draft')).toBe('ready')
  })

  it('isFinalStage works', () => {
    expect(isFinalStage('video', 'published')).toBe(true)
    expect(isFinalStage('video', 'edicao')).toBe(false)
    expect(isFinalStage('campaign', 'sent')).toBe(true)
  })

  it('isFirstStage works', () => {
    expect(isFirstStage('video', 'idea')).toBe(true)
    expect(isFirstStage('video', 'roteiro')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify pass (workflow logic already implemented)**

Run: `npm run test:web -- --run apps/web/test/api/pipeline-advance.test.ts`
Expected: All PASS

- [ ] **Step 3: Implement advance route**

```typescript
// apps/web/src/app/api/pipeline/items/[id]/advance/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { getNextStage, isFinalStage } from '@/lib/pipeline/workflows'
import { computeValidationScore } from '@/lib/pipeline/validation'
import type { Format } from '@/lib/pipeline/schemas'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const ifMatch = req.headers.get('If-Match')
  if (!ifMatch) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'If-Match header required' } }, { status: 400 })
  const expectedVersion = parseInt(ifMatch)

  const supabase = getSupabaseServiceClient()
  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, format, stage, version, site_id, title_pt, title_en, hook, synopsis, body_content, tags, production_checklist, format_metadata')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })
  if (item.version !== expectedVersion) {
    return NextResponse.json({ error: { code: 'VERSION_CONFLICT', message: `Version mismatch. Current: ${item.version}` } }, { status: 409 })
  }

  const format = item.format as Format
  const nextStage = getNextStage(format, item.stage)
  if (!nextStage) {
    return NextResponse.json({ error: { code: 'INVALID_OPERATION', message: 'Already at final stage' } }, { status: 422 })
  }

  // Check hard dependencies
  const { data: deps } = await supabase
    .from('pipeline_dependencies')
    .select('blocker_id, dependency_type')
    .eq('blocked_id', id)
    .eq('dependency_type', 'hard')

  if (deps && deps.length > 0) {
    const { data: blockers } = await supabase
      .from('content_pipeline')
      .select('id, code, format, stage')
      .in('id', deps.map((d) => d.blocker_id))

    const unresolved = blockers?.filter((b) => !isFinalStage(b.format as Format, b.stage))
    if (unresolved && unresolved.length > 0) {
      return NextResponse.json({
        error: { code: 'DEPENDENCY_BLOCKED', message: 'Hard dependencies not resolved', details: { blockers: unresolved } },
      }, { status: 409 })
    }
  }

  // Check soft dependencies for warnings
  const { data: softDeps } = await supabase
    .from('pipeline_dependencies')
    .select('blocker_id, dependency_type')
    .eq('blocked_id', id)
    .eq('dependency_type', 'soft')

  let warnings: string[] = []
  if (softDeps && softDeps.length > 0) {
    const { data: softBlockers } = await supabase
      .from('content_pipeline')
      .select('id, code, format, stage')
      .in('id', softDeps.map((d) => d.blocker_id))

    const pending = softBlockers?.filter((b) => !isFinalStage(b.format as Format, b.stage))
    if (pending && pending.length > 0) {
      warnings = pending.map((b) => `Soft dependency "${b.code}" still at stage "${b.stage}"`)
    }
  }

  const updateData: Record<string, unknown> = { stage: nextStage }
  if (isFinalStage(format, nextStage)) {
    updateData.published_at = new Date().toISOString()
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update(updateData)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'VERSION_CONFLICT', message: 'Concurrent modification' } }, { status: 409 })
  }

  // Recompute validation score
  const { count: membershipsCount } = await supabase
    .from('content_pipeline_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('pipeline_id', id)

  const score = computeValidationScore({
    title_pt: updated.title_pt,
    title_en: updated.title_en,
    hook: updated.hook,
    synopsis: updated.synopsis,
    body_content: updated.body_content,
    tags: updated.tags || [],
    production_checklist: updated.production_checklist || [],
    format_metadata: updated.format_metadata || {},
    memberships_count: membershipsCount ?? 0,
    format,
  })

  await supabase.from('content_pipeline').update({ validation_score: score }).eq('id', id)

  return NextResponse.json({
    data: { ...updated, validation_score: score },
    meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at },
    ...(warnings.length > 0 ? { warnings } : {}),
  })
}
```

- [ ] **Step 4: Implement retreat route**

```typescript
// apps/web/src/app/api/pipeline/items/[id]/retreat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { getPreviousStage } from '@/lib/pipeline/workflows'
import type { Format } from '@/lib/pipeline/schemas'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const ifMatch = req.headers.get('If-Match')
  if (!ifMatch) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'If-Match header required' } }, { status: 400 })
  const expectedVersion = parseInt(ifMatch)

  const supabase = getSupabaseServiceClient()
  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, format, stage, version')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })
  if (item.version !== expectedVersion) {
    return NextResponse.json({ error: { code: 'VERSION_CONFLICT', message: `Version mismatch. Current: ${item.version}` } }, { status: 409 })
  }

  const prevStage = getPreviousStage(item.format as Format, item.stage)
  if (!prevStage) {
    return NextResponse.json({ error: { code: 'INVALID_OPERATION', message: 'Already at first stage' } }, { status: 422 })
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: prevStage })
    .eq('id', id)
    .eq('version', expectedVersion)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'VERSION_CONFLICT', message: 'Concurrent modification' } }, { status: 409 })
  }

  return NextResponse.json({ data: updated, meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at } })
}
```

- [ ] **Step 5: Implement checklist toggle route**

```typescript
// apps/web/src/app/api/pipeline/items/[id]/checklist/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { ChecklistToggleSchema } from '@/lib/pipeline/schemas'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const body = await req.json()
  const parsed = ChecklistToggleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })

  const { index, done } = parsed.data
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, production_checklist, version')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })

  const checklist = [...(item.production_checklist as any[] || [])]
  if (index >= checklist.length) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Index out of bounds' } }, { status: 400 })

  checklist[index] = { ...checklist[index], done, toggled_at: new Date().toISOString() }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ production_checklist: checklist })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
  return NextResponse.json({ data: updated, meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at } })
}
```

- [ ] **Step 6: Implement graduate route**

```typescript
// apps/web/src/app/api/pipeline/items/[id]/graduate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { GraduateSchema } from '@/lib/pipeline/schemas'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const body = await req.json()
  const parsed = GraduateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })

  const { target } = parsed.data
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('*')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })

  const title = item.title_pt || item.title_en
  if (!title) return NextResponse.json({ error: { code: 'INVALID_OPERATION', message: 'Item must have a title to graduate' } }, { status: 422 })

  let entityId: string | null = null
  let fkField: string | null = null

  if (target === 'blog_post') {
    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert({
        site_id: auth.siteId,
        author_id: item.created_by,
        status: 'draft',
        category: 'building',
        locale: item.language === 'en' ? 'en' : 'pt-br',
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
    entityId = post.id
    fkField = 'blog_post_id'
  } else if (target === 'newsletter') {
    const { data: edition, error } = await supabase
      .from('newsletter_editions')
      .insert({
        site_id: auth.siteId,
        subject: title,
        status: 'draft',
        content: item.body_content || '',
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
    entityId = edition.id
    fkField = 'newsletter_edition_id'
  } else if (target === 'campaign') {
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        site_id: auth.siteId,
        name: title,
        slug: item.slug || item.code,
        status: 'draft',
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
    entityId = campaign.id
    fkField = 'campaign_id'
  }

  if (entityId && fkField) {
    await supabase.from('content_pipeline').update({ [fkField]: entityId }).eq('id', id)
    await supabase.from('content_pipeline_history').insert({
      pipeline_id: id,
      event_type: 'graduated',
      to_value: `${target}:${entityId}`,
    })
  }

  return NextResponse.json({ data: { graduated: true, target, entity_id: entityId } })
}
```

- [ ] **Step 7: Implement restore route**

```typescript
// apps/web/src/app/api/pipeline/items/[id]/restore/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ is_archived: false, archived_at: null, archive_reason: null })
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .select()
    .single()

  if (error || !updated) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })

  await supabase.from('content_pipeline_history').insert({
    pipeline_id: id,
    event_type: 'restored',
  })

  return NextResponse.json({ data: updated, meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at } })
}
```

- [ ] **Step 8: Run tests**

Run: `npm run test:web -- --run apps/web/test/api/pipeline-advance.test.ts`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/api/pipeline/items/\[id\]/
git commit -m "feat(pipeline): add advance, retreat, checklist, graduate, restore endpoints"
```

---

## Task 6: REST API — Collections, Context, Workflows, Search, Stats, Topics, Discovery, Bulk

**Files:**
- Create: `apps/web/src/app/api/pipeline/route.ts`
- Create: `apps/web/src/app/api/pipeline/context/route.ts`
- Create: `apps/web/src/app/api/pipeline/context/[key]/route.ts`
- Create: `apps/web/src/app/api/pipeline/collections/route.ts`
- Create: `apps/web/src/app/api/pipeline/collections/[id]/route.ts`
- Create: `apps/web/src/app/api/pipeline/workflows/route.ts`
- Create: `apps/web/src/app/api/pipeline/search/route.ts`
- Create: `apps/web/src/app/api/pipeline/stats/route.ts`
- Create: `apps/web/src/app/api/pipeline/topics/[code]/route.ts`
- Create: `apps/web/src/app/api/pipeline/items/bulk/route.ts`
- Test: `apps/web/test/api/pipeline-search.test.ts`

- [ ] **Step 1: Write search test**

```typescript
// apps/web/test/api/pipeline-search.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn().mockResolvedValue({ ok: true, auth: { siteId: 'site-1', permissions: ['read'], source: 'api_key' } }),
  requirePermission: vi.fn().mockReturnValue(true),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}))

vi.mock('@/lib/supabase/service', () => {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  return {
    getSupabaseServiceClient: vi.fn(() => ({
      from: vi.fn(() => mockQuery),
    })),
  }
})

describe('Pipeline search query construction', () => {
  it('parseSortParam defaults to updated_at desc', async () => {
    const { parseSortParam } = await import('@/lib/pipeline/queries')
    expect(parseSortParam(undefined)).toEqual({ column: 'updated_at', ascending: false })
  })

  it('parseSortParam handles priority:desc', async () => {
    const { parseSortParam } = await import('@/lib/pipeline/queries')
    expect(parseSortParam('priority:desc')).toEqual({ column: 'priority', ascending: false })
  })

  it('parseSortParam rejects invalid columns', async () => {
    const { parseSortParam } = await import('@/lib/pipeline/queries')
    expect(parseSortParam('drop_table:asc')).toEqual({ column: 'updated_at', ascending: true })
  })

  it('encodeCursor and decodeCursor are inverses', async () => {
    const { encodeCursor, decodeCursor } = await import('@/lib/pipeline/queries')
    const cursor = encodeCursor('2026-05-09T12:00:00Z', 'abc-123')
    const decoded = decodeCursor(cursor)
    expect(decoded).toEqual({ sort_value: '2026-05-09T12:00:00Z', id: 'abc-123' })
  })
})
```

- [ ] **Step 2: Run test**

Run: `npm run test:web -- --run apps/web/test/api/pipeline-search.test.ts`
Expected: PASS (query helpers already implemented)

- [ ] **Step 3: Implement discovery manifest**

```typescript
// apps/web/src/app/api/pipeline/route.ts
import { NextResponse } from 'next/server'
import { WORKFLOWS } from '@/lib/pipeline/workflows'

export async function GET() {
  return NextResponse.json({
    name: 'Content Pipeline API',
    version: '1.0.0',
    auth: {
      methods: ['api_key', 'session_cookie'],
      header: 'X-Pipeline-Key',
      rate_limit: '100/min (api_key only)',
    },
    endpoints: [
      { method: 'GET', path: '/api/pipeline/context', description: 'Get all reference content' },
      { method: 'GET', path: '/api/pipeline/context/:key', description: 'Get specific reference doc' },
      { method: 'PUT', path: '/api/pipeline/context/:key', description: 'Upsert reference doc' },
      { method: 'GET', path: '/api/pipeline/collections', description: 'List collections' },
      { method: 'GET', path: '/api/pipeline/collections/:id', description: 'Get collection with members' },
      { method: 'POST', path: '/api/pipeline/collections', description: 'Create collection' },
      { method: 'PUT', path: '/api/pipeline/collections/:id', description: 'Update collection' },
      { method: 'GET', path: '/api/pipeline/items', description: 'List items (cursor pagination)' },
      { method: 'GET', path: '/api/pipeline/items/:id', description: 'Get item detail' },
      { method: 'POST', path: '/api/pipeline/items', description: 'Create item(s)' },
      { method: 'PATCH', path: '/api/pipeline/items/:id', description: 'Update item (If-Match required)' },
      { method: 'DELETE', path: '/api/pipeline/items/:id', description: 'Archive item' },
      { method: 'POST', path: '/api/pipeline/items/:id/advance', description: 'Advance to next stage' },
      { method: 'POST', path: '/api/pipeline/items/:id/retreat', description: 'Retreat to previous stage' },
      { method: 'POST', path: '/api/pipeline/items/:id/checklist', description: 'Toggle checklist item' },
      { method: 'POST', path: '/api/pipeline/items/:id/graduate', description: 'Graduate to entity' },
      { method: 'POST', path: '/api/pipeline/items/:id/restore', description: 'Restore archived item' },
      { method: 'POST', path: '/api/pipeline/items/bulk', description: 'Batch operations' },
      { method: 'GET', path: '/api/pipeline/workflows', description: 'Get all workflow definitions' },
      { method: 'GET', path: '/api/pipeline/search', description: 'Cross-entity search' },
      { method: 'GET', path: '/api/pipeline/stats', description: 'Pipeline statistics' },
      { method: 'GET', path: '/api/pipeline/topics/:code', description: 'Topic aggregation' },
    ],
    formats: Object.keys(WORKFLOWS),
    workflows: WORKFLOWS,
  })
}
```

- [ ] **Step 4: Implement context routes**

```typescript
// apps/web/src/app/api/pipeline/context/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult

  const format = req.nextUrl.searchParams.get('format')
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('reference_content')
    .select('key, title, content_md, content_compact, version, updated_at')
    .eq('site_id', auth.siteId)
    .order('key')

  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })

  const mapped = data?.map((d) => ({
    key: d.key,
    title: d.title,
    content: format === 'md' ? d.content_md : d.content_compact ?? d.content_md,
    version: d.version,
    updated_at: d.updated_at,
  }))

  return NextResponse.json({ data: mapped })
}
```

```typescript
// apps/web/src/app/api/pipeline/context/[key]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { ReferenceContentUpsertSchema } from '@/lib/pipeline/schemas'

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('reference_content')
    .select('*')
    .eq('site_id', authResult.auth.siteId)
    .eq('key', key)
    .single()

  if (error || !data) return NextResponse.json({ error: { code: 'NOT_FOUND', message: `Reference "${key}" not found` } }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  if (!requirePermission(authResult.auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const body = await req.json()
  const parsed = ReferenceContentUpsertSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('reference_content')
    .upsert({
      site_id: authResult.auth.siteId,
      key,
      title: parsed.data.title,
      content_md: parsed.data.content_md ?? null,
      content_compact: parsed.data.content_compact ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'site_id,key' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  if (!requirePermission(authResult.auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  await supabase.from('reference_content').delete().eq('site_id', authResult.auth.siteId).eq('key', key)
  return NextResponse.json({ data: { deleted: true } })
}
```

- [ ] **Step 5: Implement collections, workflows, search, stats, topics, bulk routes**

These follow the same pattern as items. Implementation details in each file follow the spec exactly (§2.2, §2.6, §2.7, §9). Each route:
1. Authenticates via `authenticatePipeline()`
2. Validates with Zod schemas
3. Queries/mutates via service client
4. Returns consistent `{ data, meta? }` or `{ error: { code, message } }` envelope

The full implementations for these files are straightforward CRUD following the patterns above. Key differences:
- `collections/route.ts`: GET with `?type=` filter, POST with CollectionCreateSchema
- `collections/[id]/route.ts`: GET includes members ordered by position, PUT uses CollectionUpdateSchema
- `workflows/route.ts`: simple GET returning WORKFLOWS + DEFAULT_CHECKLISTS constants
- `search/route.ts`: uses `textSearch()` for pipeline, parallel queries for cross-entity
- `stats/route.ts`: aggregate queries grouped by format/stage
- `topics/[code]/route.ts`: multi-table resolution per §9
- `items/bulk/route.ts`: transaction with BulkOperationSchema, all-or-nothing

- [ ] **Step 6: Run all tests**

Run: `npm run test:web -- --run apps/web/test/api/`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/pipeline/
git commit -m "feat(pipeline): add full REST API — context, collections, workflows, search, stats, topics, bulk"
```

---

## Task 7: CMS Navigation + Server Actions

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`
- Create: `apps/web/src/app/cms/(authed)/pipeline/actions.ts`
- Test: `apps/web/test/cms/pipeline-actions.test.ts`

- [ ] **Step 1: Write server action tests**

```typescript
// apps/web/test/cms/pipeline-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'item-1', version: 1 }, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  })),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', timezone: 'America/Sao_Paulo' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('Pipeline server actions', () => {
  it('createPipelineItem validates input', async () => {
    const { createPipelineItem } = await import('@/app/cms/(authed)/pipeline/actions')
    const result = await createPipelineItem({ format: 'video', title_pt: 'Test' })
    expect(result.ok).toBe(true)
  })

  it('createPipelineItem rejects no title', async () => {
    const { createPipelineItem } = await import('@/app/cms/(authed)/pipeline/actions')
    const result = await createPipelineItem({ format: 'video' } as any)
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- --run apps/web/test/cms/pipeline-actions.test.ts`
Expected: FAIL

- [ ] **Step 3: Update CMS sidebar sections**

```typescript
// apps/web/src/app/cms/(authed)/_shared/cms-sections.ts
import { DEFAULT_SECTIONS, type SidebarSection } from '@tn-figueiredo/cms-ui'

export function buildCmsSections(): SidebarSection[] {
  const sections = DEFAULT_SECTIONS.map(section => {
    if (section.label === 'Content') {
      const items = [
        ...section.items,
        { icon: '🎬', label: 'YouTube', href: '/cms/youtube', minRole: 'editor' as const },
        { icon: '🖼️', label: 'Media', href: '/cms/media', minRole: 'editor' as const },
        { icon: '🔗', label: 'Links', href: '/cms/links', minRole: 'editor' as const },
      ]

      return { ...section, items }
    }
    return section
  })

  const pipelineSection: SidebarSection = {
    label: 'Pipeline',
    items: [
      { icon: '📊', label: 'Overview', href: '/cms/pipeline', minRole: 'editor' as const },
      { icon: '🎬', label: 'Video', href: '/cms/pipeline/video', minRole: 'editor' as const },
      { icon: '✍️', label: 'Blog', href: '/cms/pipeline/blog', minRole: 'editor' as const },
      { icon: '📧', label: 'Newsletter', href: '/cms/pipeline/newsletter', minRole: 'editor' as const },
      { icon: '🎓', label: 'Course', href: '/cms/pipeline/course', minRole: 'editor' as const },
      { icon: '📣', label: 'Campaign', href: '/cms/pipeline/campaign', minRole: 'editor' as const },
      { icon: '📁', label: 'Collections', href: '/cms/pipeline/collections', minRole: 'editor' as const },
      { icon: '🔍', label: 'Search', href: '/cms/pipeline/search', minRole: 'editor' as const },
      { icon: '📝', label: 'Reference', href: '/cms/pipeline/reference', minRole: 'editor' as const },
    ],
  }

  const contentIdx = sections.findIndex(s => s.label === 'Content')
  sections.splice(contentIdx + 1, 0, pipelineSection)
  return sections
}
```

- [ ] **Step 4: Implement server actions**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/actions.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { PipelineItemCreateSchema, PipelineItemUpdateSchema, CollectionCreateSchema, CollectionUpdateSchema } from '@/lib/pipeline/schemas'
import { generateCode, DEFAULT_CHECKLISTS, getNextStage, getPreviousStage } from '@/lib/pipeline/workflows'
import { computeValidationScore } from '@/lib/pipeline/validation'
import type { Format } from '@/lib/pipeline/schemas'

type ActionResult = { ok: true; data?: any } | { ok: false; error: string }

function zodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(', ') || 'Validation failed'
}

async function requireEditAccess() {
  const { siteId, timezone } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return { siteId, timezone }
}

export async function createPipelineItem(input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = PipelineItemCreateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const data = parsed.data
  const format = data.format as Format
  const title = data.title_pt || data.title_en || 'untitled'
  const code = data.code || generateCode(format, title, data.format_metadata)

  const { data: item, error } = await supabase
    .from('content_pipeline')
    .insert({
      site_id: siteId,
      code,
      title_pt: data.title_pt || null,
      title_en: data.title_en || null,
      format,
      stage: data.stage || 'idea',
      language: data.language,
      priority: data.priority,
      parent_id: data.parent_id || null,
      hook: data.hook || null,
      synopsis: data.synopsis || null,
      body_content: data.body_content || null,
      format_metadata: data.format_metadata,
      production_checklist: data.production_checklist || DEFAULT_CHECKLISTS[format],
      tags: data.tags,
      assigned_to: data.assigned_to || null,
    })
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline')
  return { ok: true, data: item }
}

export async function updatePipelineItem(id: string, version: number, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = PipelineItemUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update(parsed.data)
    .eq('id', id)
    .eq('site_id', siteId)
    .eq('version', version)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'Version conflict or item not found' }
  revalidatePath('/cms/pipeline')
  return { ok: true, data: updated }
}

export async function advancePipelineItem(id: string, version: number): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, format, stage, version')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!item) return { ok: false, error: 'Item not found' }
  if (item.version !== version) return { ok: false, error: 'Version conflict' }

  const next = getNextStage(item.format as Format, item.stage)
  if (!next) return { ok: false, error: 'Already at final stage' }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: next })
    .eq('id', id)
    .eq('version', version)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'Version conflict' }
  revalidatePath('/cms/pipeline')
  return { ok: true, data: updated }
}

export async function retreatPipelineItem(id: string, version: number): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, format, stage, version')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!item) return { ok: false, error: 'Item not found' }
  if (item.version !== version) return { ok: false, error: 'Version conflict' }

  const prev = getPreviousStage(item.format as Format, item.stage)
  if (!prev) return { ok: false, error: 'Already at first stage' }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: prev })
    .eq('id', id)
    .eq('version', version)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'Version conflict' }
  revalidatePath('/cms/pipeline')
  return { ok: true, data: updated }
}

export async function archivePipelineItem(id: string): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('content_pipeline')
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline')
  return { ok: true }
}

export async function createCollection(input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = CollectionCreateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('content_collections')
    .insert({ site_id: siteId, ...parsed.data })
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline/collections')
  return { ok: true, data }
}

export async function updateCollection(id: string, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = CollectionUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('content_collections')
    .update(parsed.data)
    .eq('id', id)
    .eq('site_id', siteId)
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline/collections')
  return { ok: true, data }
}
```

- [ ] **Step 5: Run tests**

Run: `npm run test:web -- --run apps/web/test/cms/pipeline-actions.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/_shared/cms-sections.ts apps/web/src/app/cms/\(authed\)/pipeline/actions.ts apps/web/test/cms/pipeline-actions.test.ts
git commit -m "feat(pipeline): add CMS sidebar navigation and server actions"
```

---

## Task 8: CMS UI — Overview + Board Pages

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview-cards.tsx`
- Test: `apps/web/test/cms/pipeline-board.test.tsx`

- [ ] **Step 1: Write board component test**

```typescript
// apps/web/test/cms/pipeline-board.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/cms/pipeline/video'),
}))

vi.mock('@/app/cms/(authed)/pipeline/actions', () => ({
  advancePipelineItem: vi.fn().mockResolvedValue({ ok: true }),
  retreatPipelineItem: vi.fn().mockResolvedValue({ ok: true }),
}))

describe('PipelineBoard', () => {
  it('renders columns for video workflow', async () => {
    const { PipelineBoard } = await import('@/app/cms/(authed)/pipeline/_components/pipeline-board')
    render(
      <PipelineBoard
        format="video"
        items={[
          { id: '1', code: 'G1-test', title_pt: 'Video 1', stage: 'idea', priority: 3, language: 'pt-br', tags: [], production_checklist: [], version: 1, format: 'video' },
          { id: '2', code: 'G2-test', title_pt: 'Video 2', stage: 'roteiro', priority: 1, language: 'both', tags: ['ai'], production_checklist: [{ label: 'X', done: true }], version: 1, format: 'video' },
        ]}
      />,
    )
    expect(screen.getByText('Ideia')).toBeTruthy()
    expect(screen.getByText('Roteiro')).toBeTruthy()
    expect(screen.getByText('Gravação')).toBeTruthy()
    expect(screen.getByText('Video 1')).toBeTruthy()
    expect(screen.getByText('Video 2')).toBeTruthy()
  })

  it('renders empty columns gracefully', async () => {
    const { PipelineBoard } = await import('@/app/cms/(authed)/pipeline/_components/pipeline-board')
    render(<PipelineBoard format="blog_post" items={[]} />)
    expect(screen.getByText('Ideia')).toBeTruthy()
    expect(screen.getByText('Rascunho')).toBeTruthy()
    expect(screen.getByText('Pronto')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- --run apps/web/test/cms/pipeline-board.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement PipelineCard component**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-card.tsx
'use client'

import Link from 'next/link'

interface PipelineCardProps {
  id: string
  code: string
  title: string
  priority: number
  language: string
  tags: string[]
  checklist: Array<{ label: string; done: boolean }>
  version: number
}

const PRIORITY_COLORS: Record<number, string> = {
  5: 'bg-red-500',
  4: 'bg-orange-500',
  3: 'bg-yellow-500',
  2: 'bg-blue-500',
  1: 'bg-gray-400',
  0: 'bg-transparent',
}

export function PipelineCard({ id, code, title, priority, language, tags, checklist, version }: PipelineCardProps) {
  const doneCount = checklist.filter((c) => c.done).length
  const totalCount = checklist.length
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  return (
    <Link
      href={`/cms/pipeline/items/${id}`}
      className="block rounded-lg border border-slate-700 bg-slate-800 p-3 hover:border-indigo-500 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        {priority > 0 && <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[priority]}`} />}
        <span className="text-xs text-slate-400 font-mono">{code}</span>
        {language === 'both' && <span className="text-xs bg-indigo-900 text-indigo-300 px-1 rounded">PT+EN</span>}
      </div>
      <p className="text-sm text-slate-100 font-medium truncate">{title}</p>
      {tags.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{tag}</span>
          ))}
          {tags.length > 2 && <span className="text-xs text-slate-500">+{tags.length - 2}</span>}
        </div>
      )}
      {totalCount > 0 && (
        <div className="mt-2">
          <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs text-slate-500 mt-0.5">{doneCount}/{totalCount}</span>
        </div>
      )}
    </Link>
  )
}
```

- [ ] **Step 4: Implement PipelineBoard component**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx
'use client'

import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { PipelineCard } from './pipeline-card'
import type { Format } from '@/lib/pipeline/schemas'

interface BoardItem {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  stage: string
  priority: number
  language: string
  tags: string[]
  production_checklist: Array<{ label: string; done: boolean }>
  version: number
  format: string
}

interface PipelineBoardProps {
  format: Format
  items: BoardItem[]
}

export function PipelineBoard({ format, items }: PipelineBoardProps) {
  const stages = WORKFLOWS[format]

  const itemsByStage = stages.reduce<Record<string, BoardItem[]>>((acc, stage) => {
    acc[stage.stage] = items.filter((i) => i.stage === stage.stage)
    return acc
  }, {})

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-12rem)]">
      {stages.map((stage) => (
        <div key={stage.stage} className="flex-shrink-0 w-64">
          <div className="sticky top-0 bg-slate-900 pb-2 z-10">
            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-800">
              <span className="text-sm font-medium text-slate-200">{stage.label_pt}</span>
              <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded-full">
                {itemsByStage[stage.stage]?.length ?? 0}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {itemsByStage[stage.stage]?.map((item) => (
              <PipelineCard
                key={item.id}
                id={item.id}
                code={item.code}
                title={item.title_pt || item.title_en || 'Untitled'}
                priority={item.priority}
                language={item.language}
                tags={item.tags}
                checklist={item.production_checklist}
                version={item.version}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Implement Overview page**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/page.tsx
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { FORMATS } from '@/lib/pipeline/schemas'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { CmsTopbar } from '@tn-figueiredo/cms-ui'
import { PipelineOverviewCards } from './_components/pipeline-overview-cards'

export const dynamic = 'force-dynamic'

export default async function PipelineOverviewPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: items } = await supabase
    .from('content_pipeline')
    .select('id, format, stage, priority, updated_at')
    .eq('site_id', siteId)
    .eq('is_archived', false)

  const stats = FORMATS.map((format) => {
    const formatItems = items?.filter((i) => i.format === format) ?? []
    const byStage: Record<string, number> = {}
    WORKFLOWS[format].forEach((s) => { byStage[s.stage] = formatItems.filter((i) => i.stage === s.stage).length })
    return { format, total: formatItems.length, byStage }
  })

  return (
    <>
      <CmsTopbar title="Pipeline Overview" />
      <div className="p-6">
        <PipelineOverviewCards stats={stats} />
      </div>
    </>
  )
}
```

- [ ] **Step 6: Implement format board page**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx
import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { FORMATS, type Format } from '@/lib/pipeline/schemas'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { CmsTopbar } from '@tn-figueiredo/cms-ui'
import { PipelineBoard } from '../_components/pipeline-board'

export const dynamic = 'force-dynamic'

export default async function FormatBoardPage({ params }: { params: Promise<{ format: string }> }) {
  const { format } = await params
  if (!FORMATS.includes(format as Format)) notFound()

  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: items } = await supabase
    .from('content_pipeline')
    .select('id, code, title_pt, title_en, stage, priority, language, tags, production_checklist, version, format')
    .eq('site_id', siteId)
    .eq('format', format)
    .eq('is_archived', false)
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false })

  const labels: Record<string, string> = {
    video: 'Video', blog_post: 'Blog', newsletter: 'Newsletter', course: 'Course', campaign: 'Campaign',
  }

  return (
    <>
      <CmsTopbar title={`Pipeline: ${labels[format]}`} />
      <div className="p-4">
        <PipelineBoard format={format as Format} items={items ?? []} />
      </div>
    </>
  )
}
```

- [ ] **Step 7: Implement overview cards component**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview-cards.tsx
'use client'

import Link from 'next/link'

interface FormatStats {
  format: string
  total: number
  byStage: Record<string, number>
}

const FORMAT_ICONS: Record<string, string> = {
  video: '🎬', blog_post: '✍️', newsletter: '📧', course: '🎓', campaign: '📣',
}
const FORMAT_LABELS: Record<string, string> = {
  video: 'Video', blog_post: 'Blog', newsletter: 'Newsletter', course: 'Course', campaign: 'Campaign',
}

export function PipelineOverviewCards({ stats }: { stats: FormatStats[] }) {
  const totalItems = stats.reduce((sum, s) => sum + s.total, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((s) => (
          <Link
            key={s.format}
            href={`/cms/pipeline/${s.format === 'blog_post' ? 'blog' : s.format}`}
            className="block rounded-lg border border-slate-700 bg-slate-800 p-4 hover:border-indigo-500 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{FORMAT_ICONS[s.format]}</span>
              <span className="text-sm font-medium text-slate-200">{FORMAT_LABELS[s.format]}</span>
            </div>
            <p className="text-2xl font-bold text-white">{s.total}</p>
            <p className="text-xs text-slate-400 mt-1">items in pipeline</p>
          </Link>
        ))}
      </div>
      <div className="text-sm text-slate-400">
        Total: {totalItems} items across all formats
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Run tests**

Run: `npm run test:web -- --run apps/web/test/cms/pipeline-board.test.tsx`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/
git commit -m "feat(pipeline): add CMS overview and format board pages"
```

---

## Task 9: CMS UI — Item Detail + List + Remaining Views

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/list/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-list-table.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/collections/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/collection-manager.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/reference/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/reference-editor.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/search/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/search-results.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/topics/[code]/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/all/page.tsx`
- Test: `apps/web/test/cms/pipeline-item-detail.test.tsx`

This is the largest task. Each page follows the same pattern:
1. Server component fetches data from Supabase
2. Passes to client component for interactivity
3. Client component calls server actions for mutations

- [ ] **Step 1: Write item detail test**

```typescript
// apps/web/test/cms/pipeline-item-detail.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))

vi.mock('@/app/cms/(authed)/pipeline/actions', () => ({
  updatePipelineItem: vi.fn().mockResolvedValue({ ok: true, data: { id: '1', version: 2 } }),
  advancePipelineItem: vi.fn().mockResolvedValue({ ok: true }),
  archivePipelineItem: vi.fn().mockResolvedValue({ ok: true }),
}))

describe('PipelineItemDetail', () => {
  it('renders item title and stage', async () => {
    const { PipelineItemDetail } = await import('@/app/cms/(authed)/pipeline/_components/pipeline-item-detail')
    render(
      <PipelineItemDetail
        item={{
          id: '1',
          code: 'G14-test',
          title_pt: 'AI Agents',
          title_en: null,
          format: 'video',
          stage: 'roteiro',
          language: 'pt-br',
          priority: 3,
          hook: 'Learn AI agents',
          synopsis: 'Full overview',
          body_content: '# Script\n\nHello',
          tags: ['ai'],
          production_checklist: [{ label: 'Roteiro', done: true, toggled_at: null }],
          format_metadata: { playlist_letter: 'G', episode_number: 14 },
          version: 1,
          is_archived: false,
          validation_score: { overall: 70, breakdown: {}, computed_at: '' },
        }}
        collections={[]}
        history={[]}
      />,
    )
    expect(screen.getByDisplayValue('AI Agents')).toBeTruthy()
    expect(screen.getByText('Roteiro')).toBeTruthy()
  })

  it('shows checklist items', async () => {
    const { PipelineItemDetail } = await import('@/app/cms/(authed)/pipeline/_components/pipeline-item-detail')
    render(
      <PipelineItemDetail
        item={{
          id: '1', code: 'G14', title_pt: 'X', title_en: null,
          format: 'video', stage: 'idea', language: 'pt-br', priority: 0,
          hook: null, synopsis: null, body_content: null, tags: [],
          production_checklist: [
            { label: 'Task A', done: false, toggled_at: null },
            { label: 'Task B', done: true, toggled_at: '2026-05-09' },
          ],
          format_metadata: {}, version: 1, is_archived: false, validation_score: null,
        }}
        collections={[]}
        history={[]}
      />,
    )
    expect(screen.getByText('Task A')).toBeTruthy()
    expect(screen.getByText('Task B')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Implement all remaining page/component files**

Each follows the established patterns. The implementation is mechanical but necessary — server component fetches, client component renders with actions. Full code for each file will be generated during execution following the board/card patterns above.

Key implementation notes per view:
- **Item Detail:** Split layout (textarea left 70%, metadata sidebar right 30%), save via `updatePipelineItem` action
- **List:** Table with columns (code, title, format, stage, priority, updated_at), filters in URL params
- **Collections:** Grid of collection cards, create modal, click to see members
- **Reference Editor:** Split-pane with list of keys on left, markdown textarea on right
- **Search:** Input + results grouped by type, calls `/api/pipeline/search` client-side
- **Topics:** Server component that aggregates via supabase queries (same logic as API endpoint)
- **All:** Grid showing all formats with stage counts (same as overview but with links to each board)

- [ ] **Step 3: Run tests**

Run: `npm run test:web -- --run apps/web/test/cms/pipeline-item-detail.test.tsx`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/ apps/web/test/cms/pipeline-item-detail.test.tsx
git commit -m "feat(pipeline): add item detail, list, collections, reference, search, topics views"
```

---

## Task 10: Seed Script

**Files:**
- Create: `scripts/seed-pipeline.ts`

- [ ] **Step 1: Create the seed script**

```typescript
// scripts/seed-pipeline.ts
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

// Parse dashboard.html to extract video data
function parseDashboard(html: string) {
  // Extract PLAYLISTS object
  const playlistsMatch = html.match(/const PLAYLISTS\s*=\s*(\{[\s\S]*?\n\s*\});/)
  if (!playlistsMatch) throw new Error('Could not find PLAYLISTS in dashboard.html')
  const playlists = eval(`(${playlistsMatch[1]})`) // Safe: local script, trusted file

  // Extract WRITTEN_SCRIPTS
  const scriptsMatch = html.match(/const WRITTEN_SCRIPTS\s*=\s*(\{[\s\S]*?\n\s*\});/)
  const writtenScripts = scriptsMatch ? eval(`(${scriptsMatch[1]})`) : {}

  return { playlists, writtenScripts }
}

async function seed() {
  const dashboardPath = resolve(process.env.HOME!, 'Workspace/Youtube/dashboard.html')
  const html = readFileSync(dashboardPath, 'utf8')
  const { playlists, writtenScripts } = parseDashboard(html)

  // Get site ID
  const { data: site } = await supabase.from('sites').select('id').limit(1).single()
  if (!site) throw new Error('No site found')
  const siteId = site.id

  console.log(`Seeding pipeline for site ${siteId}...`)

  // Create playlist collections
  const playlistMap: Record<string, string> = {}
  for (const [letter, playlist] of Object.entries(playlists) as [string, any][]) {
    const code = `playlist-${letter.toLowerCase()}`
    const { data } = await supabase
      .from('content_collections')
      .upsert({ site_id: siteId, code, name: playlist.name, type: 'playlist', position: Object.keys(playlists).indexOf(letter) }, { onConflict: 'site_id,code' })
      .select('id')
      .single()
    if (data) playlistMap[letter] = data.id
    console.log(`  Collection: ${playlist.name} (${letter}) → ${data?.id}`)
  }

  // Create arc collections for playlist G if it has arcs
  const arcMap: Record<string, string> = {}
  const gPlaylist = playlists['G']
  if (gPlaylist?.arcs) {
    for (const [arcName, arcData] of Object.entries(gPlaylist.arcs) as [string, any][]) {
      const code = `arc-g-${arcName.toLowerCase().replace(/\s+/g, '-')}`
      const { data } = await supabase
        .from('content_collections')
        .upsert({ site_id: siteId, code, name: arcName, type: 'arc', parent_id: playlistMap['G'] }, { onConflict: 'site_id,code' })
        .select('id')
        .single()
      if (data) arcMap[arcName] = data.id
    }
  }

  // Create pipeline items for each video
  let created = 0
  for (const [letter, playlist] of Object.entries(playlists) as [string, any][]) {
    const videos = playlist.videos || []
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i]
      const title = video.title || video.name || `${letter}${i + 1}`
      const slug = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
      const code = `${letter}${i + 1}-${slug}`

      // Determine stage based on WRITTEN_SCRIPTS
      let stage = 'idea'
      const scriptKey = `${letter}${i + 1}`
      if (writtenScripts[scriptKey]) {
        stage = writtenScripts[scriptKey].recorded ? 'gravacao' : 'roteiro'
      }

      const { error } = await supabase
        .from('content_pipeline')
        .upsert({
          site_id: siteId,
          code,
          title_pt: title,
          format: 'video',
          stage,
          language: 'pt-br',
          format_metadata: { playlist_letter: letter, episode_number: i + 1 },
          tags: [letter.toLowerCase(), playlist.name.toLowerCase().replace(/\s+/g, '-')],
        }, { onConflict: 'site_id,code', ignoreDuplicates: true })

      if (!error) created++

      // Add membership
      const { data: item } = await supabase
        .from('content_pipeline')
        .select('id')
        .eq('site_id', siteId)
        .eq('code', code)
        .single()

      if (item && playlistMap[letter]) {
        await supabase
          .from('content_pipeline_memberships')
          .upsert({ pipeline_id: item.id, collection_id: playlistMap[letter], position: i }, { onConflict: 'pipeline_id,collection_id' })
      }
    }
  }

  console.log(`\nDone! Created/updated ${created} pipeline items.`)
}

seed().catch(console.error)
```

- [ ] **Step 2: Run seed script (after migration is pushed)**

Run: `npx tsx scripts/seed-pipeline.ts`
Expected: "Done! Created/updated 78 pipeline items."

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-pipeline.ts
git commit -m "feat(pipeline): add seed script for dashboard.html video data"
```

---

## Task 11: Final Integration — Run Tests + Verify

- [ ] **Step 1: Run full test suite**

Run: `npm run test:web`
Expected: All tests PASS (existing + new pipeline tests)

- [ ] **Step 2: Start dev server and verify CMS navigation**

Run: `npm run dev -w apps/web`
Navigate to `http://localhost:3000/cms/pipeline`
Expected: Pipeline section visible in sidebar, Overview page loads with format cards

- [ ] **Step 3: Verify format board**

Navigate to `http://localhost:3000/cms/pipeline/video`
Expected: 7-column kanban board renders (empty or seeded data)

- [ ] **Step 4: Verify API discovery endpoint**

Run: `curl http://localhost:3000/api/pipeline | jq .`
Expected: JSON manifest with all endpoints listed

- [ ] **Step 5: Push migration to prod**

Run: `npm run db:push:prod`
Expected: Migration applies successfully

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(pipeline): complete Content Pipeline module integration"
```
