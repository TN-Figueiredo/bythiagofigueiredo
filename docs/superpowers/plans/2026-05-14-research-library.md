# Research Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Research Library in the CMS where Claude pushes deep research via API, organized in hierarchical topics, with many-to-many links to pipeline items and a rich Tiptap editor.

**Architecture:** Three new DB tables (research_topics, research_items, research_links) with RLS. RESTful API using existing `authenticatePipeline()` auth. Three-panel CMS UI (topic tree + item list + content detail) reusing `PipelineEditor`. Server actions for CMS mutations.

**Tech Stack:** Next.js 15 API routes, Supabase PostgreSQL, Zod validation, Tiptap/PipelineEditor, Vitest

---

## File Structure

```
NEW FILES:
supabase/migrations/20260515000001_research_library.sql
apps/web/src/lib/pipeline/research-schemas.ts
apps/web/src/lib/pipeline/research-topics.ts
apps/web/src/app/api/pipeline/research/route.ts
apps/web/src/app/api/pipeline/research/import/route.ts
apps/web/src/app/api/pipeline/research/[id]/route.ts
apps/web/src/app/api/pipeline/research/[id]/links/route.ts
apps/web/src/app/api/pipeline/research/[id]/links/[linkId]/route.ts
apps/web/src/app/api/pipeline/research/topics/route.ts
apps/web/src/app/api/pipeline/research/topics/[id]/route.ts
apps/web/src/app/cms/(authed)/pipeline/research/page.tsx
apps/web/src/app/cms/(authed)/pipeline/research/actions.ts
apps/web/src/app/cms/(authed)/pipeline/research/_components/research-library.tsx
apps/web/src/app/cms/(authed)/pipeline/research/_components/topic-tree.tsx
apps/web/src/app/cms/(authed)/pipeline/research/_components/research-list.tsx
apps/web/src/app/cms/(authed)/pipeline/research/_components/research-detail.tsx
apps/web/src/app/cms/(authed)/pipeline/research/_components/research-picker.tsx
apps/web/test/lib/pipeline/research-schemas.test.ts
apps/web/test/api/pipeline/research-topics-api.test.ts
apps/web/test/api/pipeline/research-items-api.test.ts
apps/web/test/api/pipeline/research-links-api.test.ts
apps/web/test/api/pipeline/research-import-api.test.ts

MODIFIED FILES:
apps/web/src/app/cms/(authed)/_shared/cms-sections.ts      # Add Research nav item
apps/web/src/app/cms/(authed)/layout.tsx                    # Add research unread badge
docs/cowork-pipeline-reference.md                           # Add Research API docs
```

---

### Task 1: Zod Schemas + Slug Utilities

**Files:**
- Create: `apps/web/src/lib/pipeline/research-schemas.ts`
- Create: `apps/web/src/lib/pipeline/research-topics.ts`
- Test: `apps/web/test/lib/pipeline/research-schemas.test.ts`

- [ ] **Step 1: Write the failing test for Zod schemas**

```typescript
// apps/web/test/lib/pipeline/research-schemas.test.ts
import { describe, it, expect } from 'vitest'
import {
  RESEARCH_STATUS,
  ResearchItemCreateSchema,
  ResearchItemUpdateSchema,
  ResearchImportSchema,
  ResearchTopicCreateSchema,
  ResearchTopicUpdateSchema,
  ResearchLinkSchema,
} from '@/lib/pipeline/research-schemas'

describe('research-schemas', () => {
  describe('RESEARCH_STATUS', () => {
    it('has exactly 4 statuses', () => {
      expect(RESEARCH_STATUS).toEqual(['new', 'reviewed', 'starred', 'archived'])
    })
  })

  describe('ResearchItemCreateSchema', () => {
    it('accepts valid minimal input', () => {
      const result = ResearchItemCreateSchema.safeParse({
        title: 'WYD Ongame Era',
        topic_slug: 'gaming-history/wyd',
        content_md: '# WYD Research\n\nContent here.',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sources).toEqual([])
      }
    })

    it('accepts full input with sources', () => {
      const result = ResearchItemCreateSchema.safeParse({
        title: 'WYD Ongame Era',
        topic_slug: 'gaming-history/wyd',
        content_md: '# Research',
        summary: 'Short summary',
        sources: [
          { url: 'https://example.com/article', title: 'Example Article', accessed_at: '2026-05-14T00:00:00Z' },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty title', () => {
      const result = ResearchItemCreateSchema.safeParse({
        title: '',
        topic_slug: 'test',
        content_md: 'content',
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty content_md', () => {
      const result = ResearchItemCreateSchema.safeParse({
        title: 'Test',
        topic_slug: 'test',
        content_md: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects title over 500 chars', () => {
      const result = ResearchItemCreateSchema.safeParse({
        title: 'x'.repeat(501),
        topic_slug: 'test',
        content_md: 'content',
      })
      expect(result.success).toBe(false)
    })

    it('rejects more than 50 sources', () => {
      const sources = Array.from({ length: 51 }, (_, i) => ({
        url: `https://example.com/${i}`,
        title: `Source ${i}`,
      }))
      const result = ResearchItemCreateSchema.safeParse({
        title: 'Test',
        topic_slug: 'test',
        content_md: 'content',
        sources,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ResearchItemUpdateSchema', () => {
    it('accepts partial update', () => {
      const result = ResearchItemUpdateSchema.safeParse({
        title: 'Updated title',
        status: 'reviewed',
      })
      expect(result.success).toBe(true)
    })

    it('accepts empty object', () => {
      const result = ResearchItemUpdateSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('rejects content_json + content_md together', () => {
      const result = ResearchItemUpdateSchema.safeParse({
        content_json: { type: 'doc', content: [] },
        content_md: 'text',
      })
      expect(result.success).toBe(false)
    })

    it('accepts content_json alone', () => {
      const result = ResearchItemUpdateSchema.safeParse({
        content_json: { type: 'doc', content: [] },
      })
      expect(result.success).toBe(true)
    })

    it('accepts content_md alone', () => {
      const result = ResearchItemUpdateSchema.safeParse({
        content_md: 'updated markdown',
      })
      expect(result.success).toBe(true)
    })

    it('allows nullable summary', () => {
      const result = ResearchItemUpdateSchema.safeParse({ summary: null })
      expect(result.success).toBe(true)
    })

    it('rejects invalid status', () => {
      const result = ResearchItemUpdateSchema.safeParse({ status: 'draft' })
      expect(result.success).toBe(false)
    })
  })

  describe('ResearchImportSchema', () => {
    it('accepts array of 1-50 items', () => {
      const result = ResearchImportSchema.safeParse({
        items: [{ title: 'A', topic_slug: 'test', content_md: 'content' }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty array', () => {
      const result = ResearchImportSchema.safeParse({ items: [] })
      expect(result.success).toBe(false)
    })

    it('rejects more than 50 items', () => {
      const items = Array.from({ length: 51 }, (_, i) => ({
        title: `Item ${i}`,
        topic_slug: 'test',
        content_md: 'content',
      }))
      const result = ResearchImportSchema.safeParse({ items })
      expect(result.success).toBe(false)
    })
  })

  describe('ResearchTopicCreateSchema', () => {
    it('accepts valid topic', () => {
      const result = ResearchTopicCreateSchema.safeParse({
        name: 'Gaming History',
        slug: 'gaming-history',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.color).toBe('#a78bfa')
        expect(result.data.icon).toBe('📁')
      }
    })

    it('rejects invalid slug characters', () => {
      const result = ResearchTopicCreateSchema.safeParse({
        name: 'Test',
        slug: 'UPPER_CASE',
      })
      expect(result.success).toBe(false)
    })

    it('accepts slug with numbers and hyphens', () => {
      const result = ResearchTopicCreateSchema.safeParse({
        name: 'AI Dev 101',
        slug: 'ai-dev-101',
      })
      expect(result.success).toBe(true)
    })

    it('rejects hex color without hash', () => {
      const result = ResearchTopicCreateSchema.safeParse({
        name: 'Test',
        slug: 'test',
        color: 'a78bfa',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ResearchTopicUpdateSchema', () => {
    it('accepts partial update', () => {
      const result = ResearchTopicUpdateSchema.safeParse({
        name: 'Updated Name',
        color: '#ff0000',
      })
      expect(result.success).toBe(true)
    })

    it('accepts parent_id change', () => {
      const result = ResearchTopicUpdateSchema.safeParse({
        parent_id: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(true)
    })

    it('accepts null parent_id (move to root)', () => {
      const result = ResearchTopicUpdateSchema.safeParse({
        parent_id: null,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('ResearchLinkSchema', () => {
    it('accepts valid link', () => {
      const result = ResearchLinkSchema.safeParse({
        pipeline_item_id: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(true)
    })

    it('accepts link with note', () => {
      const result = ResearchLinkSchema.safeParse({
        pipeline_item_id: '123e4567-e89b-12d3-a456-426614174000',
        note: 'Source for intro section',
      })
      expect(result.success).toBe(true)
    })

    it('rejects note over 500 chars', () => {
      const result = ResearchLinkSchema.safeParse({
        pipeline_item_id: '123e4567-e89b-12d3-a456-426614174000',
        note: 'x'.repeat(501),
      })
      expect(result.success).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/pipeline/research-schemas.test.ts`
Expected: FAIL — module `@/lib/pipeline/research-schemas` not found

- [ ] **Step 3: Implement Zod schemas**

```typescript
// apps/web/src/lib/pipeline/research-schemas.ts
import { z } from 'zod'

export const RESEARCH_STATUS = ['new', 'reviewed', 'starred', 'archived'] as const
export type ResearchStatus = (typeof RESEARCH_STATUS)[number]

const SourceSchema = z.object({
  url: z.string().url().max(2000),
  title: z.string().max(200),
  accessed_at: z.string().datetime().optional(),
})

export const ResearchItemCreateSchema = z.object({
  title: z.string().min(1).max(500),
  topic_slug: z.string().min(1).max(200),
  content_md: z.string().min(1).max(500_000),
  summary: z.string().max(2000).optional(),
  sources: z.array(SourceSchema).max(50).default([]),
})

export type ResearchItemCreateInput = z.infer<typeof ResearchItemCreateSchema>

export const ResearchItemUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content_json: z.record(z.unknown()).optional(),
  content_md: z.string().max(500_000).optional(),
  summary: z.string().max(2000).nullable().optional(),
  sources: z.array(z.object({
    url: z.string().url().max(2000),
    title: z.string().max(200),
  })).max(50).optional(),
  status: z.enum(RESEARCH_STATUS).optional(),
  topic_id: z.string().uuid().optional(),
}).refine(
  (d) => !(d.content_json && d.content_md),
  { message: 'content_json and content_md are mutually exclusive' }
)

export type ResearchItemUpdateInput = z.infer<typeof ResearchItemUpdateSchema>

export const ResearchImportSchema = z.object({
  items: z.array(ResearchItemCreateSchema).min(1).max(50),
})

export const ResearchTopicCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  parent_id: z.string().uuid().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#a78bfa'),
  icon: z.string().max(10).default('📁'),
})

export type ResearchTopicCreateInput = z.infer<typeof ResearchTopicCreateSchema>

export const ResearchTopicUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  icon: z.string().max(10).optional(),
  sort_order: z.number().int().optional(),
})

export type ResearchTopicUpdateInput = z.infer<typeof ResearchTopicUpdateSchema>

export const ResearchLinkSchema = z.object({
  pipeline_item_id: z.string().uuid(),
  note: z.string().max(500).optional(),
})

export type ResearchLinkInput = z.infer<typeof ResearchLinkSchema>
```

- [ ] **Step 4: Implement slug utilities**

```typescript
// apps/web/src/lib/pipeline/research-topics.ts

export function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function parseTopicSlug(topicSlug: string): string[] {
  return topicSlug.split('/').filter(Boolean)
}

export const MAX_TOPIC_DEPTH = 2

export function validateTopicSlugDepth(topicSlug: string): boolean {
  const parts = parseTopicSlug(topicSlug)
  return parts.length > 0 && parts.length <= MAX_TOPIC_DEPTH + 1
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/lib/pipeline/research-schemas.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/pipeline/research-schemas.ts apps/web/src/lib/pipeline/research-topics.ts apps/web/test/lib/pipeline/research-schemas.test.ts
git commit -m "feat(research): add Zod schemas and slug utilities with tests"
```

---

### Task 2: Database Migration

**Files:**
- Create: `supabase/migrations/20260515000001_research_library.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260515000001_research_library.sql
-- Research Library: topics, items, links tables with RLS, triggers, and indexes.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. research_topics — hierarchical topic tree (max depth 2 = 3 levels)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.research_topics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid REFERENCES public.research_topics(id) ON DELETE CASCADE,
  name        text NOT NULL,
  slug        text NOT NULL,
  path        text NOT NULL,
  depth       int NOT NULL DEFAULT 0 CHECK (depth <= 2),
  color       text NOT NULL DEFAULT '#a78bfa',
  icon        text NOT NULL DEFAULT '📁',
  sort_order  int NOT NULL DEFAULT 0,
  site_id     uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE(site_id, path),
  UNIQUE(site_id, parent_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_research_topics_site ON public.research_topics (site_id);
CREATE INDEX IF NOT EXISTS idx_research_topics_parent ON public.research_topics (parent_id) WHERE parent_id IS NOT NULL;

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.research_topics;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.research_topics
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RLS
ALTER TABLE public.research_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_topics_select ON public.research_topics;
CREATE POLICY research_topics_select ON public.research_topics
  FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS research_topics_insert ON public.research_topics;
CREATE POLICY research_topics_insert ON public.research_topics
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS research_topics_update ON public.research_topics;
CREATE POLICY research_topics_update ON public.research_topics
  FOR UPDATE TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS research_topics_delete ON public.research_topics;
CREATE POLICY research_topics_delete ON public.research_topics
  FOR DELETE TO authenticated
  USING (public.can_edit_site(site_id));


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. research_items — individual research documents
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.research_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id        uuid NOT NULL REFERENCES public.research_topics(id) ON DELETE CASCADE,
  title           text NOT NULL,
  content_json    jsonb,
  content_md      text,
  summary         text,
  sources         jsonb NOT NULL DEFAULT '[]',
  status          text NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'reviewed', 'starred', 'archived')),
  word_count      int NOT NULL DEFAULT 0,
  version         int NOT NULL DEFAULT 1,
  search_vector   tsvector,
  site_id         uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE(site_id, topic_id, title)
);

CREATE INDEX IF NOT EXISTS idx_research_items_topic ON public.research_items (topic_id);
CREATE INDEX IF NOT EXISTS idx_research_items_site_status ON public.research_items (site_id, status)
  WHERE status != 'archived';
CREATE INDEX IF NOT EXISTS idx_research_items_search ON public.research_items USING GIN (search_vector);

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.research_items;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.research_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Version increment trigger (same pattern as pipeline_updated_at)
CREATE OR REPLACE FUNCTION public.research_item_version_increment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS research_item_version_inc ON public.research_items;
CREATE TRIGGER research_item_version_inc
  BEFORE UPDATE ON public.research_items
  FOR EACH ROW EXECUTE FUNCTION public.research_item_version_increment();

-- Search vector trigger
CREATE OR REPLACE FUNCTION public.research_item_search_vector_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', left(coalesce(NEW.content_md, ''), 50000)), 'B');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS research_item_search_vec ON public.research_items;
CREATE TRIGGER research_item_search_vec
  BEFORE INSERT OR UPDATE OF title, content_md ON public.research_items
  FOR EACH ROW EXECUTE FUNCTION public.research_item_search_vector_update();

-- Word count trigger
CREATE OR REPLACE FUNCTION public.research_item_word_count_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.word_count := coalesce(
    array_length(
      regexp_split_to_array(trim(coalesce(NEW.content_md, '')), '\s+'),
      1
    ),
    0
  );
  IF NEW.content_md IS NULL OR trim(NEW.content_md) = '' THEN
    NEW.word_count := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS research_item_word_count ON public.research_items;
CREATE TRIGGER research_item_word_count
  BEFORE INSERT OR UPDATE OF content_md ON public.research_items
  FOR EACH ROW EXECUTE FUNCTION public.research_item_word_count_update();

-- RLS
ALTER TABLE public.research_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_items_select ON public.research_items;
CREATE POLICY research_items_select ON public.research_items
  FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS research_items_insert ON public.research_items;
CREATE POLICY research_items_insert ON public.research_items
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS research_items_update ON public.research_items;
CREATE POLICY research_items_update ON public.research_items
  FOR UPDATE TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS research_items_delete ON public.research_items;
CREATE POLICY research_items_delete ON public.research_items
  FOR DELETE TO authenticated
  USING (public.can_edit_site(site_id));


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. research_links — many-to-many between research and pipeline items
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.research_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id       uuid NOT NULL REFERENCES public.research_items(id) ON DELETE CASCADE,
  pipeline_item_id  uuid NOT NULL REFERENCES public.content_pipeline(id) ON DELETE CASCADE,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE(research_id, pipeline_item_id)
);

CREATE INDEX IF NOT EXISTS idx_research_links_pipeline ON public.research_links (pipeline_item_id);
CREATE INDEX IF NOT EXISTS idx_research_links_research ON public.research_links (research_id);

-- RLS (via JOIN to research_items for site_id)
ALTER TABLE public.research_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_links_select ON public.research_links;
CREATE POLICY research_links_select ON public.research_links
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_items ri
    WHERE ri.id = research_id AND public.can_view_site(ri.site_id)
  ));

DROP POLICY IF EXISTS research_links_insert ON public.research_links;
CREATE POLICY research_links_insert ON public.research_links
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.research_items ri
    WHERE ri.id = research_id AND public.can_edit_site(ri.site_id)
  ));

DROP POLICY IF EXISTS research_links_update ON public.research_links;
CREATE POLICY research_links_update ON public.research_links
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_items ri
    WHERE ri.id = research_id AND public.can_edit_site(ri.site_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.research_items ri
    WHERE ri.id = research_id AND public.can_edit_site(ri.site_id)
  ));

DROP POLICY IF EXISTS research_links_delete ON public.research_links;
CREATE POLICY research_links_delete ON public.research_links
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.research_items ri
    WHERE ri.id = research_id AND public.can_edit_site(ri.site_id)
  ));

COMMIT;
```

- [ ] **Step 2: Verify migration syntax**

Run: `cd supabase && cat migrations/20260515000001_research_library.sql | head -5`
Expected: File exists with correct header

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260515000001_research_library.sql
git commit -m "feat(research): add database migration for research_topics, research_items, research_links"
```

---

### Task 3: Topics API Routes

**Files:**
- Create: `apps/web/src/app/api/pipeline/research/topics/route.ts`
- Create: `apps/web/src/app/api/pipeline/research/topics/[id]/route.ts`
- Test: `apps/web/test/api/pipeline/research-topics-api.test.ts`

- [ ] **Step 1: Write the failing test for topics API**

```typescript
// apps/web/test/api/pipeline/research-topics-api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'

const mockAuth = {
  ok: true as const,
  auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
}

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn().mockResolvedValue(mockAuth),
  requirePermission: vi.fn().mockReturnValue(true),
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

const buildQuery = () => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn(),
})

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => buildQuery()),
  })),
}))

describe('GET /api/pipeline/research/topics', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns topics list', async () => {
    const mockTopics = [
      { id: 'aaa', name: 'Gaming History', slug: 'gaming-history', path: 'gaming-history', depth: 0, parent_id: null, color: '#a78bfa', icon: '🎮', sort_order: 0, item_count: 5 },
    ]
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockTopics, error: null }),
          }),
        }),
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockTopics, error: null }),
        }),
      }),
    })

    const { GET } = await import('@/app/api/pipeline/research/topics/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/topics')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
  })
})

describe('POST /api/pipeline/research/topics', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a topic with valid input', async () => {
    const newTopic = {
      id: 'bbb',
      name: 'Gaming History',
      slug: 'gaming-history',
      path: 'gaming-history',
      depth: 0,
      parent_id: null,
      color: '#a78bfa',
      icon: '📁',
      sort_order: 0,
      site_id: MOCK_SITE_ID,
    }
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: newTopic, error: null }),
      }),
    })

    const { POST } = await import('@/app/api/pipeline/research/topics/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/topics', {
      method: 'POST',
      body: JSON.stringify({ name: 'Gaming History', slug: 'gaming-history' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('Gaming History')
  })

  it('rejects invalid slug', async () => {
    const { POST } = await import('@/app/api/pipeline/research/topics/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/topics', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', slug: 'INVALID SLUG' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/api/pipeline/research-topics-api.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement GET + POST topics route**

```typescript
// apps/web/src/app/api/pipeline/research/topics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { ResearchTopicCreateSchema } from '@/lib/pipeline/research-schemas'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { data: topics, error } = await supabase
    .from('research_topics')
    .select('id, parent_id, name, slug, path, depth, color, icon, sort_order, created_at, updated_at')
    .eq('site_id', auth.siteId)
    .order('depth')
    .order('sort_order')

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: topics ?? [] }, { headers })
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

  const parsed = ResearchTopicCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const { name, slug, parent_id, color, icon } = parsed.data

  let parentPath = ''
  let depth = 0

  if (parent_id) {
    const { data: parent } = await supabase
      .from('research_topics')
      .select('path, depth')
      .eq('id', parent_id)
      .eq('site_id', auth.siteId)
      .single()

    if (!parent) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Parent topic not found' } }, { status: 404 })
    if (parent.depth >= 2) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Max 3 levels (depth 0-2). Parent is already at max depth.' } }, { status: 400 })

    parentPath = parent.path
    depth = parent.depth + 1
  }

  const path = parentPath ? `${parentPath}/${slug}` : slug

  const { data: topic, error } = await supabase
    .from('research_topics')
    .insert({
      site_id: auth.siteId,
      name,
      slug,
      path,
      depth,
      parent_id: parent_id ?? null,
      color,
      icon,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Topic with this path already exists' } }, { status: 409 })
    }
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: topic }, { status: 201, headers })
}
```

- [ ] **Step 4: Implement PATCH + DELETE topics/[id] route**

```typescript
// apps/web/src/app/api/pipeline/research/topics/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { ResearchTopicUpdateSchema } from '@/lib/pipeline/research-schemas'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid topic ID' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = ResearchTopicUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('research_topics')
    .update(updateData)
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .select()
    .single()

  if (error || !updated) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Topic not found' } }, { status: 404 })

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: updated }, { headers })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid topic ID' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('research_topics')
    .delete()
    .eq('id', id)
    .eq('site_id', auth.siteId)

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: { deleted: true } }, { headers })
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/api/pipeline/research-topics-api.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/pipeline/research/topics/route.ts apps/web/src/app/api/pipeline/research/topics/\[id\]/route.ts apps/web/test/api/pipeline/research-topics-api.test.ts
git commit -m "feat(research): add topics API routes (GET, POST, PATCH, DELETE)"
```

---

### Task 4: Research Items API — POST (Create/Upsert) + GET (List)

**Files:**
- Create: `apps/web/src/app/api/pipeline/research/route.ts`
- Test: `apps/web/test/api/pipeline/research-items-api.test.ts`

- [ ] **Step 1: Write the failing test for research items POST + GET**

```typescript
// apps/web/test/api/pipeline/research-items-api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_TOPIC_ID = '22222222-2222-2222-2222-222222222222'

const mockAuth = {
  ok: true as const,
  auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
}

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn().mockResolvedValue(mockAuth),
  requirePermission: vi.fn().mockReturnValue(true),
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/supabase/service', () => {
  const mockChain = () => {
    const chain: Record<string, any> = {}
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'in', 'or', 'like', 'ilike',
      'order', 'limit', 'single', 'maybeSingle', 'textSearch', 'not', 'neq']
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain)
    }
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
    return chain
  }
  return {
    getSupabaseServiceClient: vi.fn(() => ({
      from: vi.fn(() => mockChain()),
    })),
  }
})

describe('POST /api/pipeline/research', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects invalid JSON', async () => {
    const { POST } = await import('@/app/api/pipeline/research/route')
    const req = new NextRequest('http://localhost/api/pipeline/research', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects missing required fields', async () => {
    const { POST } = await import('@/app/api/pipeline/research/route')
    const req = new NextRequest('http://localhost/api/pipeline/research', {
      method: 'POST',
      body: JSON.stringify({ title: 'test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects topic_slug deeper than 3 levels', async () => {
    const { POST } = await import('@/app/api/pipeline/research/route')
    const req = new NextRequest('http://localhost/api/pipeline/research', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test',
        topic_slug: 'a/b/c/d',
        content_md: 'content',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('Max 3 levels')
  })
})

describe('GET /api/pipeline/research', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 200 with data array', async () => {
    const { GET } = await import('@/app/api/pipeline/research/route')
    const req = new NextRequest('http://localhost/api/pipeline/research')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.meta).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/api/pipeline/research-items-api.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement GET + POST research route**

```typescript
// apps/web/src/app/api/pipeline/research/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { ResearchItemCreateSchema } from '@/lib/pipeline/research-schemas'
import { slugToName, parseTopicSlug, validateTopicSlugDepth } from '@/lib/pipeline/research-topics'

async function resolveOrCreateTopics(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  siteId: string,
  topicSlug: string,
): Promise<{ topicId: string } | { error: string }> {
  const parts = parseTopicSlug(topicSlug)
  let parentId: string | null = null
  let currentPath = ''

  for (let i = 0; i < parts.length; i++) {
    const slug = parts[i]!
    currentPath = currentPath ? `${currentPath}/${slug}` : slug

    const { data: existing } = await supabase
      .from('research_topics')
      .select('id')
      .eq('site_id', siteId)
      .eq('path', currentPath)
      .single()

    if (existing) {
      parentId = existing.id
      continue
    }

    const { data: created, error } = await supabase
      .from('research_topics')
      .insert({
        site_id: siteId,
        name: slugToName(slug),
        slug,
        path: currentPath,
        depth: i,
        parent_id: parentId,
      })
      .select('id')
      .single()

    if (error) return { error: `Failed to create topic "${currentPath}": ${error.message}` }
    parentId = created!.id
  }

  return { topicId: parentId! }
}

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const params = req.nextUrl.searchParams
  const limit = Math.min(parseInt(params.get('limit') || '50'), 200)
  const cursor = params.get('cursor') || undefined
  const includeContent = params.get('include') === 'content'

  const selectFields = includeContent
    ? 'id, title, topic_id, summary, status, word_count, sources, version, created_at, updated_at, content_md, research_topics!inner(path, name, icon)'
    : 'id, title, topic_id, summary, status, word_count, sources, version, created_at, updated_at, research_topics!inner(path, name, icon)'

  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('research_items')
    .select(selectFields, { count: 'exact' })
    .eq('site_id', auth.siteId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  const topicId = params.get('topic_id')
  if (topicId && UUID_REGEX.test(topicId)) {
    query = query.eq('topic_id', topicId)
  }

  const topicSlug = params.get('topic_slug')
  if (topicSlug) {
    query = query.or(`research_topics.path.eq.${topicSlug},research_topics.path.like.${topicSlug}/%`)
  }

  const statusFilter = params.get('status')
  if (statusFilter) {
    const statuses = statusFilter.split(',').filter(Boolean)
    query = query.in('status', statuses)
  }

  const search = params.get('search')
  if (search) {
    query = query.textSearch('search_vector', search, { type: 'websearch', config: 'portuguese' })
  }

  const pipelineItemId = params.get('pipeline_item_id')
  if (pipelineItemId && UUID_REGEX.test(pipelineItemId)) {
    query = query.in('id',
      supabase.from('research_links').select('research_id').eq('pipeline_item_id', pipelineItemId)
    )
  }

  if (cursor && UUID_REGEX.test(cursor)) {
    const { data: cursorItem } = await supabase
      .from('research_items')
      .select('created_at')
      .eq('id', cursor)
      .single()
    if (cursorItem) {
      query = query.or(`created_at.lt.${cursorItem.created_at},and(created_at.eq.${cursorItem.created_at},id.lt.${cursor})`)
    }
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  const hasNext = (data?.length ?? 0) > limit
  const items = data?.slice(0, limit) ?? []
  const lastItem = items[items.length - 1]

  const mapped = items.map((item: any) => ({
    id: item.id,
    title: item.title,
    topic_id: item.topic_id,
    topic_path: item.research_topics?.path,
    topic_name: item.research_topics?.name,
    topic_icon: item.research_topics?.icon,
    summary: item.summary,
    status: item.status,
    word_count: item.word_count,
    sources_count: Array.isArray(item.sources) ? item.sources.length : 0,
    version: item.version,
    created_at: item.created_at,
    updated_at: item.updated_at,
    ...(includeContent ? { content_md: item.content_md } : {}),
  }))

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: mapped,
    meta: {
      total: count ?? 0,
      has_next: hasNext,
      next_cursor: hasNext && lastItem ? lastItem.id : undefined,
      limit,
    },
  }, { headers })
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

  const parsed = ResearchItemCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })
  }

  const { title, topic_slug, content_md, summary, sources } = parsed.data

  if (!validateTopicSlugDepth(topic_slug)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Max 3 levels (e.g., "a/b/c"). Got too many segments.' } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const topicResult = await resolveOrCreateTopics(supabase, auth.siteId, topic_slug)
  if ('error' in topicResult) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: topicResult.error } }, { status: 500 })
  }

  const { data: item, error } = await supabase
    .from('research_items')
    .upsert(
      {
        site_id: auth.siteId,
        topic_id: topicResult.topicId,
        title,
        content_md,
        content_json: null,
        summary: summary ?? null,
        sources,
        status: 'new',
      },
      { onConflict: 'site_id,topic_id,title' }
    )
    .select('id, title, topic_id, status, word_count, version, created_at, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  }

  const isUpsert = item!.version > 1
  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: { ...item, upserted: isUpsert },
  }, { status: isUpsert ? 200 : 201, headers })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/api/pipeline/research-items-api.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/pipeline/research/route.ts apps/web/test/api/pipeline/research-items-api.test.ts
git commit -m "feat(research): add research items GET (list) and POST (create/upsert) API routes"
```

---

### Task 5: Research Items API — GET/PATCH/DELETE [id]

**Files:**
- Create: `apps/web/src/app/api/pipeline/research/[id]/route.ts`

- [ ] **Step 1: Add tests for single-item routes to existing test file**

Append to `apps/web/test/api/pipeline/research-items-api.test.ts`:

```typescript
describe('GET /api/pipeline/research/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects invalid UUID', async () => {
    const { GET } = await import('@/app/api/pipeline/research/[id]/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/not-a-uuid')
    const res = await GET(req, { params: Promise.resolve({ id: 'not-a-uuid' }) })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/pipeline/research/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('requires X-Expected-Version header', async () => {
    const { PATCH } = await import('@/app/api/pipeline/research/[id]/route')
    const id = '33333333-3333-3333-3333-333333333333'
    const req = new NextRequest(`http://localhost/api/pipeline/research/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('X-Expected-Version')
  })
})

describe('DELETE /api/pipeline/research/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects invalid UUID', async () => {
    const { DELETE: DEL } = await import('@/app/api/pipeline/research/[id]/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/bad-id', { method: 'DELETE' })
    const res = await DEL(req, { params: Promise.resolve({ id: 'bad-id' }) })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify new tests fail**

Run: `cd apps/web && npx vitest run test/api/pipeline/research-items-api.test.ts`
Expected: FAIL — module not found for `[id]/route`

- [ ] **Step 3: Implement GET/PATCH/DELETE [id] route**

```typescript
// apps/web/src/app/api/pipeline/research/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { ResearchItemUpdateSchema } from '@/lib/pipeline/research-schemas'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult

  const supabase = getSupabaseServiceClient()
  const { data: item, error } = await supabase
    .from('research_items')
    .select('*, research_topics!inner(path, name, icon)')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (error || !item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Research item not found' } }, { status: 404 })

  const { data: links } = await supabase
    .from('research_links')
    .select('id, pipeline_item_id, note, created_at, content_pipeline(id, title_pt, title_en, format, stage)')
    .eq('research_id', id)

  const linkedItems = (links ?? []).map((l: any) => ({
    link_id: l.id,
    pipeline_item_id: l.pipeline_item_id,
    note: l.note,
    title: l.content_pipeline?.title_pt ?? l.content_pipeline?.title_en ?? '',
    format: l.content_pipeline?.format,
    stage: l.content_pipeline?.stage,
  }))

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: {
      id: item.id,
      title: item.title,
      topic_id: item.topic_id,
      topic_path: (item as any).research_topics?.path,
      topic_name: (item as any).research_topics?.name,
      topic_icon: (item as any).research_topics?.icon,
      content_json: item.content_json,
      content_md: item.content_md,
      summary: item.summary,
      sources: item.sources,
      status: item.status,
      word_count: item.word_count,
      version: item.version,
      created_at: item.created_at,
      updated_at: item.updated_at,
      linked_items: linkedItems,
    },
    meta: { version: item.version, updated_at: item.updated_at },
  }, { headers })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const expectedVersionRaw = req.headers.get('X-Expected-Version') ?? req.headers.get('If-Match')
  if (!expectedVersionRaw) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Expected-Version header required' } }, { status: 400 })
  const expectedVersion = parseInt(expectedVersionRaw)

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = ResearchItemUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()

  const { data: current } = await supabase
    .from('research_items')
    .select('version')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!current) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })

  if (current.version !== expectedVersion) {
    return NextResponse.json({
      error: {
        code: 'VERSION_CONFLICT',
        message: `Version mismatch. Current: ${current.version}, yours: ${expectedVersion}`,
        details: { current_version: current.version, your_version: expectedVersion },
      },
    }, { status: 409 })
  }

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  if (parsed.data.content_md !== undefined && !parsed.data.content_json) {
    updateData.content_json = null
  }

  const { data: updated, error } = await supabase
    .from('research_items')
    .update(updateData)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'VERSION_CONFLICT', message: 'Concurrent modification detected' } }, { status: 409 })
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: updated,
    meta: { version: updated.version, updated_at: updated.updated_at },
  }, { headers })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('research_items')
    .delete()
    .eq('id', id)
    .eq('site_id', auth.siteId)

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: { deleted: true } }, { headers })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/api/pipeline/research-items-api.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/pipeline/research/\[id\]/route.ts apps/web/test/api/pipeline/research-items-api.test.ts
git commit -m "feat(research): add single research item GET, PATCH, DELETE API routes"
```

---

### Task 6: Research Links + Import API Routes

**Files:**
- Create: `apps/web/src/app/api/pipeline/research/[id]/links/route.ts`
- Create: `apps/web/src/app/api/pipeline/research/[id]/links/[linkId]/route.ts`
- Create: `apps/web/src/app/api/pipeline/research/import/route.ts`
- Test: `apps/web/test/api/pipeline/research-links-api.test.ts`
- Test: `apps/web/test/api/pipeline/research-import-api.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/test/api/pipeline/research-links-api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn().mockResolvedValue({
    ok: true,
    auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  }),
  requirePermission: vi.fn().mockReturnValue(true),
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/supabase/service', () => {
  const mockChain = () => {
    const chain: Record<string, any> = {}
    const methods = ['select', 'insert', 'delete', 'eq', 'single']
    for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
    return chain
  }
  return { getSupabaseServiceClient: vi.fn(() => ({ from: vi.fn(() => mockChain()) })) }
})

describe('POST /api/pipeline/research/[id]/links', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects invalid research item ID', async () => {
    const { POST } = await import('@/app/api/pipeline/research/[id]/links/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/bad/links', {
      method: 'POST',
      body: JSON.stringify({ pipeline_item_id: '33333333-3333-3333-3333-333333333333' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'bad' }) })
    expect(res.status).toBe(400)
  })

  it('rejects missing pipeline_item_id', async () => {
    const { POST } = await import('@/app/api/pipeline/research/[id]/links/route')
    const id = '22222222-2222-2222-2222-222222222222'
    const req = new NextRequest(`http://localhost/api/pipeline/research/${id}/links`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req, { params: Promise.resolve({ id }) })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/pipeline/research/[id]/links/[linkId]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects invalid link ID', async () => {
    const { DELETE: DEL } = await import('@/app/api/pipeline/research/[id]/links/[linkId]/route')
    const id = '22222222-2222-2222-2222-222222222222'
    const req = new NextRequest(`http://localhost/api/pipeline/research/${id}/links/bad`, { method: 'DELETE' })
    const res = await DEL(req, { params: Promise.resolve({ id, linkId: 'bad' }) })
    expect(res.status).toBe(400)
  })
})
```

```typescript
// apps/web/test/api/pipeline/research-import-api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'

vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn().mockResolvedValue({
    ok: true,
    auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
  }),
  requirePermission: vi.fn().mockReturnValue(true),
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/supabase/service', () => {
  const mockChain = () => {
    const chain: Record<string, any> = {}
    const methods = ['select', 'insert', 'upsert', 'eq', 'single', 'maybeSingle']
    for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
    return chain
  }
  return { getSupabaseServiceClient: vi.fn(() => ({ from: vi.fn(() => mockChain()) })) }
})

describe('POST /api/pipeline/research/import', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects empty items array', async () => {
    const { POST } = await import('@/app/api/pipeline/research/import/route')
    const req = new NextRequest('http://localhost/api/pipeline/research/import', {
      method: 'POST',
      body: JSON.stringify({ items: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects more than 50 items', async () => {
    const { POST } = await import('@/app/api/pipeline/research/import/route')
    const items = Array.from({ length: 51 }, (_, i) => ({
      title: `Item ${i}`, topic_slug: 'test', content_md: 'content',
    }))
    const req = new NextRequest('http://localhost/api/pipeline/research/import', {
      method: 'POST',
      body: JSON.stringify({ items }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/api/pipeline/research-links-api.test.ts test/api/pipeline/research-import-api.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement links route**

```typescript
// apps/web/src/app/api/pipeline/research/[id]/links/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { ResearchLinkSchema } from '@/lib/pipeline/research-schemas'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid research item ID' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = ResearchLinkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()

  const { data: researchItem } = await supabase
    .from('research_items')
    .select('id')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!researchItem) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Research item not found' } }, { status: 404 })

  const { data: link, error } = await supabase
    .from('research_links')
    .insert({
      research_id: id,
      pipeline_item_id: parsed.data.pipeline_item_id,
      note: parsed.data.note ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Link already exists' } }, { status: 409 })
    }
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: link }, { status: 201, headers })
}
```

- [ ] **Step 4: Implement link delete route**

```typescript
// apps/web/src/app/api/pipeline/research/[id]/links/[linkId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const { id, linkId } = await params
  if (!UUID_REGEX.test(id) || !UUID_REGEX.test(linkId)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID format' } }, { status: 400 })
  }

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('research_links')
    .delete()
    .eq('id', linkId)
    .eq('research_id', id)

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: { deleted: true } }, { headers })
}
```

- [ ] **Step 5: Implement import route**

```typescript
// apps/web/src/app/api/pipeline/research/import/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { ResearchImportSchema } from '@/lib/pipeline/research-schemas'
import { slugToName, parseTopicSlug, validateTopicSlugDepth } from '@/lib/pipeline/research-topics'

async function resolveOrCreateTopics(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  siteId: string,
  topicSlug: string,
): Promise<{ topicId: string } | { error: string }> {
  const parts = parseTopicSlug(topicSlug)
  let parentId: string | null = null
  let currentPath = ''

  for (let i = 0; i < parts.length; i++) {
    const slug = parts[i]!
    currentPath = currentPath ? `${currentPath}/${slug}` : slug

    const { data: existing } = await supabase
      .from('research_topics')
      .select('id')
      .eq('site_id', siteId)
      .eq('path', currentPath)
      .single()

    if (existing) {
      parentId = existing.id
      continue
    }

    const { data: created, error } = await supabase
      .from('research_topics')
      .insert({
        site_id: siteId,
        name: slugToName(slug),
        slug,
        path: currentPath,
        depth: i,
        parent_id: parentId,
      })
      .select('id')
      .single()

    if (error) return { error: `Failed to create topic "${currentPath}": ${error.message}` }
    parentId = created!.id
  }

  return { topicId: parentId! }
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

  const parsed = ResearchImportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const results: Array<{ id?: string; title: string; ok: boolean; error?: string }> = []

  for (const item of parsed.data.items) {
    if (!validateTopicSlugDepth(item.topic_slug)) {
      results.push({ title: item.title, ok: false, error: 'Max 3 levels' })
      continue
    }

    const topicResult = await resolveOrCreateTopics(supabase, auth.siteId, item.topic_slug)
    if ('error' in topicResult) {
      results.push({ title: item.title, ok: false, error: topicResult.error })
      continue
    }

    const { data: created, error } = await supabase
      .from('research_items')
      .upsert(
        {
          site_id: auth.siteId,
          topic_id: topicResult.topicId,
          title: item.title,
          content_md: item.content_md,
          content_json: null,
          summary: item.summary ?? null,
          sources: item.sources,
          status: 'new',
        },
        { onConflict: 'site_id,topic_id,title' }
      )
      .select('id')
      .single()

    if (error) {
      results.push({ title: item.title, ok: false, error: error.message })
    } else {
      results.push({ id: created!.id, title: item.title, ok: true })
    }
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: {
      results,
      success_count: results.filter((r) => r.ok).length,
      failure_count: results.filter((r) => !r.ok).length,
    },
  }, { headers })
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/api/pipeline/research-links-api.test.ts test/api/pipeline/research-import-api.test.ts`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/pipeline/research/\[id\]/links/route.ts apps/web/src/app/api/pipeline/research/\[id\]/links/\[linkId\]/route.ts apps/web/src/app/api/pipeline/research/import/route.ts apps/web/test/api/pipeline/research-links-api.test.ts apps/web/test/api/pipeline/research-import-api.test.ts
git commit -m "feat(research): add links CRUD and bulk import API routes"
```

---

### Task 7: Server Actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/research/actions.ts`

- [ ] **Step 1: Implement server actions**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/research/actions.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import {
  ResearchItemUpdateSchema,
  ResearchTopicCreateSchema,
  ResearchTopicUpdateSchema,
  ResearchLinkSchema,
  type ResearchStatus,
} from '@/lib/pipeline/research-schemas'

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

// ─── Research Items ──────────────────────────────────────────────────────────

export async function saveResearchItem(
  id: string,
  version: number,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const parsed = ResearchItemUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  if (parsed.data.content_md !== undefined && !parsed.data.content_json) {
    updateData.content_json = null
  }

  const { data: updated, error } = await supabase
    .from('research_items')
    .update(updateData)
    .eq('id', id)
    .eq('site_id', siteId)
    .eq('version', version)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'Version conflict or item not found' }
  revalidatePath('/cms/pipeline/research')
  return { ok: true, data: updated }
}

export async function updateResearchStatus(
  id: string,
  status: ResearchStatus,
): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: updated, error } = await supabase
    .from('research_items')
    .update({ status })
    .eq('id', id)
    .eq('site_id', siteId)
    .select('id, status, version')
    .single()

  if (error || !updated) return { ok: false, error: 'Item not found' }
  revalidatePath('/cms/pipeline/research')
  return { ok: true, data: updated }
}

export async function moveResearchToTopic(
  id: string,
  topicId: string,
): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: topic } = await supabase
    .from('research_topics')
    .select('id')
    .eq('id', topicId)
    .eq('site_id', siteId)
    .single()

  if (!topic) return { ok: false, error: 'Target topic not found' }

  const { data: updated, error } = await supabase
    .from('research_items')
    .update({ topic_id: topicId })
    .eq('id', id)
    .eq('site_id', siteId)
    .select('id, topic_id, version')
    .single()

  if (error || !updated) return { ok: false, error: 'Item not found' }
  revalidatePath('/cms/pipeline/research')
  return { ok: true, data: updated }
}

export async function deleteResearchItem(id: string): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('research_items')
    .delete()
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline/research')
  return { ok: true }
}

// ─── Topics ──────────────────────────────────────────────────────────────────

export async function createResearchTopic(
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const parsed = ResearchTopicCreateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { name, slug, parent_id, color, icon } = parsed.data

  let parentPath = ''
  let depth = 0

  if (parent_id) {
    const { data: parent } = await supabase
      .from('research_topics')
      .select('path, depth')
      .eq('id', parent_id)
      .eq('site_id', siteId)
      .single()

    if (!parent) return { ok: false, error: 'Parent topic not found' }
    if (parent.depth >= 2) return { ok: false, error: 'Max 3 levels' }
    parentPath = parent.path
    depth = parent.depth + 1
  }

  const path = parentPath ? `${parentPath}/${slug}` : slug

  const { data: topic, error } = await supabase
    .from('research_topics')
    .insert({ site_id: siteId, name, slug, path, depth, parent_id: parent_id ?? null, color, icon })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Topic already exists at this path' }
    return { ok: false, error: error.message }
  }

  revalidatePath('/cms/pipeline/research')
  return { ok: true, data: topic }
}

export async function updateResearchTopic(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const parsed = ResearchTopicUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  if (Object.keys(updateData).length === 0) return { ok: false, error: 'No fields to update' }

  const { data: updated, error } = await supabase
    .from('research_topics')
    .update(updateData)
    .eq('id', id)
    .eq('site_id', siteId)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'Topic not found' }
  revalidatePath('/cms/pipeline/research')
  return { ok: true, data: updated }
}

export async function deleteResearchTopic(id: string): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('research_topics')
    .delete()
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline/research')
  return { ok: true }
}

// ─── Links ───────────────────────────────────────────────────────────────────

export async function linkResearchToItem(
  researchId: string,
  pipelineItemId: string,
  note?: string,
): Promise<ActionResult> {
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const parsed = ResearchLinkSchema.safeParse({ pipeline_item_id: pipelineItemId, note })
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { data: link, error } = await supabase
    .from('research_links')
    .insert({
      research_id: researchId,
      pipeline_item_id: pipelineItemId,
      note: note ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Already linked' }
    return { ok: false, error: error.message }
  }

  revalidatePath('/cms/pipeline/research')
  return { ok: true, data: link }
}

export async function unlinkResearchFromItem(linkId: string): Promise<ActionResult> {
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('research_links')
    .delete()
    .eq('id', linkId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline/research')
  return { ok: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/research/actions.ts
git commit -m "feat(research): add server actions for research items, topics, and links"
```

---

### Task 8: Sidebar Integration + Unread Badge

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts:18-29`
- Modify: `apps/web/src/app/cms/(authed)/layout.tsx:62-73`

- [ ] **Step 1: Add Research nav item to cms-sections.ts**

In `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`, add the Research item to the Pipeline section items array, after the Reference entry (line 28):

```typescript
// Add after: { icon: '📝', label: 'Reference', href: '/cms/pipeline/reference', minRole: 'editor' as const },
{ icon: '🔬', label: 'Research', href: '/cms/pipeline/research', minRole: 'editor' as const },
```

- [ ] **Step 2: Add research unread badge to layout.tsx**

In `apps/web/src/app/cms/(authed)/layout.tsx`, add to the parallel Promise.all (around line 62):

Add a new query alongside the existing ones:
```typescript
svc.from('research_items').select('id', { count: 'exact', head: true })
  .eq('site_id', middlewareSiteId).eq('status', 'new'),
```

Then after line 72, add:
```typescript
if (researchUnreadRes.count) badges['/cms/pipeline/research'] = researchUnreadRes.count
```

Destructure the new result from Promise.all:
```typescript
const [badgeData, pendingContactsRes, ytPendingRes, researchUnreadRes] = await Promise.all([...])
```

- [ ] **Step 3: Verify the app compiles**

Run: `cd apps/web && npx next build --no-lint 2>&1 | head -30`
If build errors appear, fix them before proceeding.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/_shared/cms-sections.ts apps/web/src/app/cms/\(authed\)/layout.tsx
git commit -m "feat(research): add Research nav item and unread badge to CMS sidebar"
```

---

### Task 9: Server Component — page.tsx

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/research/page.tsx`

- [ ] **Step 1: Implement the server component**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/research/page.tsx
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { ResearchLibrary } from './_components/research-library'

export const dynamic = 'force-dynamic'

export default async function ResearchPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [topicsRes, itemsRes, statsRes] = await Promise.all([
    supabase
      .from('research_topics')
      .select('id, parent_id, name, slug, path, depth, color, icon, sort_order')
      .eq('site_id', siteId)
      .order('depth')
      .order('sort_order'),
    supabase
      .from('research_items')
      .select('id, title, topic_id, summary, status, word_count, sources, version, created_at, updated_at')
      .eq('site_id', siteId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('research_items')
      .select('id, status', { count: 'exact' })
      .eq('site_id', siteId),
  ])

  const topics = topicsRes.data ?? []
  const items = itemsRes.data ?? []
  const allItems = statsRes.data ?? []

  const stats = {
    total: allItems.length,
    unread: allItems.filter((i: any) => i.status === 'new').length,
    starred: allItems.filter((i: any) => i.status === 'starred').length,
    reviewed: allItems.filter((i: any) => i.status === 'reviewed').length,
    archived: allItems.filter((i: any) => i.status === 'archived').length,
  }

  const topicItemCounts: Record<string, { total: number; unread: number }> = {}
  for (const item of allItems) {
    const tid = (item as any).topic_id ?? ''
    if (!topicItemCounts[tid]) topicItemCounts[tid] = { total: 0, unread: 0 }
    topicItemCounts[tid].total++
    if ((item as any).status === 'new') topicItemCounts[tid].unread++
  }

  return (
    <>
      <CmsTopbar title="Pipeline — Research" />
      <div className="p-4" style={{ height: 'calc(100vh - 6rem)' }}>
        <ResearchLibrary
          topics={topics}
          items={items}
          stats={stats}
          topicItemCounts={topicItemCounts}
        />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/research/page.tsx
git commit -m "feat(research): add Research page server component with data fetching"
```

---

### Task 10: UI — Topic Tree Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/research/_components/topic-tree.tsx`

- [ ] **Step 1: Implement the topic tree**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/research/_components/topic-tree.tsx
'use client'

import { useState, useMemo, useCallback, useRef } from 'react'

interface Topic {
  id: string
  parent_id: string | null
  name: string
  slug: string
  path: string
  depth: number
  color: string
  icon: string
  sort_order: number
}

interface TopicTreeProps {
  topics: Topic[]
  topicItemCounts: Record<string, { total: number; unread: number }>
  selectedTopicId: string | null
  onSelectTopic: (topicId: string | null) => void
  onCreateTopic: () => void
  totalItemCount: number
  totalUnreadCount: number
}

interface TreeNode extends Topic {
  children: TreeNode[]
  totalCount: number
  unreadCount: number
}

function buildTree(topics: Topic[], counts: Record<string, { total: number; unread: number }>): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const t of topics) {
    const c = counts[t.id] ?? { total: 0, unread: 0 }
    map.set(t.id, { ...t, children: [], totalCount: c.total, unreadCount: c.unread })
  }

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function bubbleUp(node: TreeNode): { total: number; unread: number } {
    let total = counts[node.id]?.total ?? 0
    let unread = counts[node.id]?.unread ?? 0
    for (const child of node.children) {
      const childCounts = bubbleUp(child)
      total += childCounts.total
      unread += childCounts.unread
    }
    node.totalCount = total
    node.unreadCount = unread
    return { total, unread }
  }

  for (const root of roots) bubbleUp(root)
  return roots
}

export function TopicTree({
  topics,
  topicItemCounts,
  selectedTopicId,
  onSelectTopic,
  onCreateTopic,
  totalItemCount,
  totalUnreadCount,
}: TopicTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const set = new Set<string>()
    for (const t of topics) {
      if (t.depth === 0) set.add(t.id)
    }
    return set
  })
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const tree = useMemo(() => buildTree(topics, topicItemCounts), [topics, topicItemCounts])

  const filteredTopics = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    return topics.filter((t) => t.name.toLowerCase().includes(q))
  }, [topics, search])

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const renderNode = (node: TreeNode, level: number) => {
    const isSelected = selectedTopicId === node.id
    const isExpanded = expanded.has(node.id)
    const hasChildren = node.children.length > 0

    return (
      <div key={node.id}>
        <button
          onClick={() => onSelectTopic(node.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            textAlign: 'left',
            padding: '5px 8px',
            paddingLeft: 8 + level * 16,
            borderRadius: 5,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: isSelected ? 'rgba(99,102,241,0.12)' : 'transparent',
            borderLeft: isSelected ? '2px solid rgb(99,102,241)' : '2px solid transparent',
          }}
        >
          {hasChildren && (
            <span
              onClick={(e) => { e.stopPropagation(); toggle(node.id) }}
              style={{
                fontSize: 9,
                color: 'var(--gem-muted)',
                cursor: 'pointer',
                width: 12,
                textAlign: 'center',
                transition: 'transform 0.15s',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >
              {'▶'}
            </span>
          )}
          {!hasChildren && <span style={{ width: 12 }} />}
          <span style={{ fontSize: 14 }}>{node.icon}</span>
          <span
            style={{
              fontSize: 12,
              color: isSelected ? 'var(--gem-text)' : 'var(--gem-muted)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.name}
          </span>
          {node.totalCount > 0 && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--gem-muted)',
                backgroundColor: 'var(--gem-well)',
                borderRadius: 9999,
                padding: '0 6px',
                lineHeight: '16px',
              }}
            >
              {node.totalCount}
            </span>
          )}
          {node.unreadCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#fbbf24',
                backgroundColor: 'rgba(251,191,36,0.15)',
                borderRadius: 9999,
                padding: '0 5px',
                lineHeight: '16px',
              }}
            >
              {node.unreadCount}
            </span>
          )}
        </button>
        {isExpanded && hasChildren && (
          <div>
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        width: 220,
        minWidth: 220,
        borderRight: '1px solid var(--gem-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--gem-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gem-text)' }}>Topics</span>
          <button
            onClick={onCreateTopic}
            title="New topic"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              color: 'var(--gem-muted)',
              padding: '0 4px',
            }}
          >
            +
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter topics..."
            style={{
              width: '100%',
              padding: '5px 8px',
              paddingRight: 40,
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid var(--gem-border)',
              backgroundColor: 'var(--gem-well)',
              color: 'var(--gem-text)',
              outline: 'none',
            }}
          />
          <span
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 9,
              color: 'var(--gem-muted)',
              opacity: 0.6,
              pointerEvents: 'none',
              fontFamily: 'monospace',
            }}
          >
            {'⌘'}K
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {/* "Todas" entry */}
        <button
          onClick={() => onSelectTopic(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            textAlign: 'left',
            padding: '6px 8px',
            borderRadius: 5,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: selectedTopicId === null ? 'rgba(99,102,241,0.12)' : 'transparent',
            borderLeft: selectedTopicId === null ? '2px solid rgb(99,102,241)' : '2px solid transparent',
          }}
        >
          <span style={{ width: 12 }} />
          <span style={{ fontSize: 14 }}>{'📚'}</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: selectedTopicId === null ? 'var(--gem-text)' : 'var(--gem-muted)',
              flex: 1,
            }}
          >
            Todas
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'var(--gem-muted)',
              backgroundColor: 'var(--gem-well)',
              borderRadius: 9999,
              padding: '0 6px',
              lineHeight: '16px',
            }}
          >
            {totalItemCount}
          </span>
          {totalUnreadCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#fbbf24',
                backgroundColor: 'rgba(251,191,36,0.15)',
                borderRadius: 9999,
                padding: '0 5px',
                lineHeight: '16px',
              }}
            >
              {totalUnreadCount}
            </span>
          )}
        </button>

        {/* Topic tree or filtered list */}
        {filteredTopics
          ? filteredTopics.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTopic(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  textAlign: 'left',
                  padding: '5px 8px',
                  borderRadius: 5,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: selectedTopicId === t.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                }}
              >
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <span style={{ fontSize: 12, color: 'var(--gem-text)' }}>{t.name}</span>
                <span style={{ fontSize: 10, color: 'var(--gem-muted)' }}>{t.path}</span>
              </button>
            ))
          : tree.map((node) => renderNode(node, 0))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/research/_components/topic-tree.tsx
git commit -m "feat(research): add TopicTree component with hierarchy, badges, search"
```

---

### Task 11: UI — Research List Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/research/_components/research-list.tsx`

- [ ] **Step 1: Implement the research list**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/research/_components/research-list.tsx
'use client'

import { useMemo, useState } from 'react'

interface ResearchItem {
  id: string
  title: string
  topic_id: string
  summary: string | null
  status: string
  word_count: number
  sources: any[]
  version: number
  created_at: string
  updated_at: string
}

interface Topic {
  id: string
  name: string
  icon: string
  path: string
}

interface ResearchListProps {
  items: ResearchItem[]
  topics: Topic[]
  selectedItemId: string | null
  selectedTopicId: string | null
  onSelectItem: (id: string) => void
}

type SortKey = 'recent' | 'title' | 'size'

const STATUS_COLORS: Record<string, string> = {
  new: '#fbbf24',
  reviewed: '#34d399',
  starred: '#f472b6',
  archived: '#64748b',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function ResearchList({
  items,
  topics,
  selectedItemId,
  selectedTopicId,
  onSelectItem,
}: ResearchListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('recent')

  const topicMap = useMemo(() => {
    const m = new Map<string, Topic>()
    for (const t of topics) m.set(t.id, t)
    return m
  }, [topics])

  const sorted = useMemo(() => {
    const list = [...items]
    switch (sortKey) {
      case 'recent':
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'title':
        list.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
        break
      case 'size':
        list.sort((a, b) => b.word_count - a.word_count)
        break
    }
    return list
  }, [items, sortKey])

  const currentTopic = selectedTopicId ? topicMap.get(selectedTopicId) : null
  const breadcrumb = currentTopic
    ? `${currentTopic.icon} ${currentTopic.name}`
    : '📚 Todas'

  return (
    <div
      style={{
        width: 280,
        minWidth: 280,
        borderRight: '1px solid var(--gem-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--gem-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gem-text)' }}>
            {breadcrumb}
          </span>
          <span style={{ fontSize: 10, color: 'var(--gem-muted)' }}>{sorted.length}</span>
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={{
            width: '100%',
            padding: '4px 6px',
            fontSize: 11,
            borderRadius: 5,
            border: '1px solid var(--gem-border)',
            backgroundColor: 'var(--gem-well)',
            color: 'var(--gem-text)',
            outline: 'none',
          }}
        >
          <option value="recent">Recentes</option>
          <option value="title">Titulo</option>
          <option value="size">Tamanho</option>
        </select>
      </div>

      {/* Item list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
        {sorted.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--gem-muted)', fontSize: 12 }}>
            Nenhuma pesquisa neste tema.
          </div>
        )}
        {sorted.map((item) => {
          const isSelected = selectedItemId === item.id
          const isArchived = item.status === 'archived'
          const topic = topicMap.get(item.topic_id)
          const snippet = item.summary?.slice(0, 100) || ''

          return (
            <button
              key={item.id}
              onClick={() => onSelectItem(item.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                borderRadius: 0,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isSelected ? 'rgba(99,102,241,0.08)' : 'transparent',
                borderLeft: isSelected ? '3px solid rgb(99,102,241)' : '3px solid transparent',
                opacity: isArchived ? 0.5 : 1,
              }}
            >
              {/* Row 1: status dot + title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: STATUS_COLORS[item.status] ?? '#64748b',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--gem-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {item.title}
                </span>
              </div>
              {/* Row 2: snippet */}
              {snippet && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--gem-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    paddingLeft: 13,
                  }}
                >
                  {snippet}
                </span>
              )}
              {/* Row 3: meta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 13 }}>
                {selectedTopicId === null && topic && (
                  <span style={{ fontSize: 10, color: 'var(--gem-muted)' }}>
                    {topic.icon} {topic.name}
                  </span>
                )}
                <span style={{ fontSize: 10, color: 'var(--gem-muted)' }}>
                  {item.word_count.toLocaleString()} palavras
                </span>
                <span style={{ fontSize: 10, color: 'var(--gem-muted)' }}>
                  {timeAgo(item.updated_at)}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/research/_components/research-list.tsx
git commit -m "feat(research): add ResearchList component with sort, status dots, snippets"
```

---

### Task 12: UI — Research Detail Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/research/_components/research-detail.tsx`

- [ ] **Step 1: Implement the research detail (read + edit modes)**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/research/_components/research-detail.tsx
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { PipelineEditor, type JSONContent } from '../../_components/detail/editors/pipeline-editor'
import {
  saveResearchItem,
  updateResearchStatus,
  deleteResearchItem,
} from '../actions'
import type { ResearchStatus } from '@/lib/pipeline/research-schemas'

interface ResearchItemFull {
  id: string
  title: string
  topic_id: string
  content_json: JSONContent | null
  content_md: string | null
  summary: string | null
  sources: Array<{ url: string; title: string; accessed_at?: string }>
  status: string
  word_count: number
  version: number
  created_at: string
  updated_at: string
}

interface ResearchDetailProps {
  item: ResearchItemFull | null
  isEditing: boolean
  onToggleEdit: (editing: boolean) => void
  onItemUpdated: (item: any) => void
  onItemDeleted: (id: string) => void
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const STATUS_LABELS: Record<string, string> = {
  new: 'Novo',
  reviewed: 'Revisado',
  starred: 'Destaque',
  archived: 'Arquivado',
}

const STATUS_COLORS: Record<string, string> = {
  new: '#fbbf24',
  reviewed: '#34d399',
  starred: '#f472b6',
  archived: '#64748b',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ResearchDetail({
  item,
  isEditing,
  onToggleEdit,
  onItemUpdated,
  onItemDeleted,
}: ResearchDetailProps) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [pendingContent, setPendingContent] = useState<JSONContent | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setPendingContent(null)
    setIsDirty(false)
    setSaveState('idle')
  }, [item?.id])

  const handleContentChange = useCallback((content: JSONContent) => {
    setPendingContent(content)
    setIsDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!item || !pendingContent) return
    setSaveState('saving')

    const contentText = extractTextFromJSON(pendingContent)

    const result = await saveResearchItem(item.id, item.version, {
      content_json: pendingContent,
      content_md: contentText,
    })

    if (result.ok) {
      setSaveState('saved')
      setIsDirty(false)
      onItemUpdated(result.data)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => setSaveState('idle'), 2000)
    } else {
      setSaveState('error')
    }
  }, [item, pendingContent, onItemUpdated])

  const handleStatusChange = useCallback(async (status: ResearchStatus) => {
    if (!item) return
    const result = await updateResearchStatus(item.id, status)
    if (result.ok) onItemUpdated(result.data)
  }, [item, onItemUpdated])

  const handleDelete = useCallback(async () => {
    if (!item) return
    if (!confirm('Deletar esta pesquisa permanentemente?')) return
    const result = await deleteResearchItem(item.id)
    if (result.ok) onItemDeleted(item.id)
  }, [item, onItemDeleted])

  if (!item) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--gem-muted)',
          fontSize: 13,
        }}
      >
        Selecione um item para ler. Use ↑↓ para navegar.
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: STATUS_COLORS[item.status] ?? '#64748b',
              backgroundColor: `${STATUS_COLORS[item.status] ?? '#64748b'}18`,
              borderRadius: 4,
              padding: '2px 8px',
            }}
          >
            {STATUS_LABELS[item.status] ?? item.status}
          </span>
          <span style={{ fontSize: 11, color: 'var(--gem-muted)' }}>
            {formatDate(item.updated_at)} · {item.word_count.toLocaleString()} palavras · v{item.version}
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {item.status !== 'starred' && (
              <button onClick={() => handleStatusChange('starred')} title="Star"
                style={{ background: 'none', border: '1px solid var(--gem-border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--gem-muted)' }}>
                {'⭐'}
              </button>
            )}
            {item.status === 'new' && (
              <button onClick={() => handleStatusChange('reviewed')} title="Mark reviewed"
                style={{ background: 'none', border: '1px solid var(--gem-border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--gem-muted)' }}>
                {'✓'}
              </button>
            )}
            {item.status !== 'archived' ? (
              <button onClick={() => handleStatusChange('archived')} title="Archive"
                style={{ background: 'none', border: '1px solid var(--gem-border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--gem-muted)' }}>
                {'📦'}
              </button>
            ) : (
              <button onClick={() => handleStatusChange('new')} title="Restore"
                style={{ background: 'none', border: '1px solid var(--gem-border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--gem-muted)' }}>
                {'↩'}
              </button>
            )}
          </div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gem-text)', margin: '4px 0' }}>
          {item.title}
        </h2>

        <div style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--gem-border)' }}>
          <button
            onClick={() => onToggleEdit(!isEditing)}
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: isEditing ? '#6366f1' : 'var(--gem-muted)',
              backgroundColor: isEditing ? 'rgba(99,102,241,0.1)' : 'transparent',
              border: '1px solid var(--gem-border)',
              borderRadius: 5,
              padding: '3px 10px',
              cursor: 'pointer',
            }}
          >
            {isEditing ? 'Lendo' : 'Editar (E)'}
          </button>
          <button
            onClick={handleDelete}
            style={{
              fontSize: 11,
              color: '#ef4444',
              backgroundColor: 'transparent',
              border: '1px solid var(--gem-border)',
              borderRadius: 5,
              padding: '3px 10px',
              cursor: 'pointer',
            }}
          >
            Deletar
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <PipelineEditor
          content={item.content_json ?? item.content_md}
          isEditing={isEditing}
          onContentChange={handleContentChange}
          preset="full"
        />
      </div>

      {/* Sources */}
      {item.sources.length > 0 && (
        <div style={{ padding: '8px 20px', borderTop: '1px solid var(--gem-border)', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase' }}>
            Fontes ({item.sources.length})
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {item.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}>
                {s.title || s.url}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Save bar (edit mode) */}
      {isEditing && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 20px',
            borderTop: '1px solid var(--gem-border)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: isDirty ? '#fbbf24' : 'var(--gem-muted)' }}>
            {isDirty ? 'Alteracoes nao salvas' : 'Salvo'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, color: 'var(--gem-muted)', fontFamily: 'monospace', opacity: 0.6 }}>
              {'⌘'}S
            </span>
            <button
              onClick={handleSave}
              disabled={!isDirty || saveState === 'saving'}
              style={{
                padding: '6px 16px',
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: !isDirty || saveState === 'saving' ? 'default' : 'pointer',
                backgroundColor:
                  saveState === 'saved' ? '#34d399'
                  : saveState === 'error' ? '#ef4444'
                  : saveState === 'saving' ? 'rgba(99,102,241,0.5)'
                  : !isDirty ? 'rgba(99,102,241,0.3)'
                  : 'rgb(99,102,241)',
              }}
            >
              {saveState === 'saved' ? '✓ Salvo'
                : saveState === 'saving' ? 'Salvando...'
                : saveState === 'error' ? 'Erro — tentar novamente'
                : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function extractTextFromJSON(json: JSONContent): string {
  if (!json?.content) return ''
  const parts: string[] = []

  function walk(nodes: JSONContent[]) {
    for (const node of nodes) {
      if (node.type === 'text' && node.text) {
        parts.push(node.text)
      }
      if (node.type === 'heading' || node.type === 'paragraph') {
        if (node.content) walk(node.content)
        parts.push('\n')
      } else if (node.type === 'bulletList' || node.type === 'orderedList') {
        if (node.content) walk(node.content)
      } else if (node.type === 'listItem') {
        parts.push('- ')
        if (node.content) walk(node.content)
      } else if (node.content) {
        walk(node.content)
      }
    }
  }

  walk(json.content)
  return parts.join('').trim()
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/research/_components/research-detail.tsx
git commit -m "feat(research): add ResearchDetail component with read/edit modes, save, status actions"
```

---

### Task 13: UI — Research Library Main Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/research/_components/research-library.tsx`

- [ ] **Step 1: Implement the main 3-panel component**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/research/_components/research-library.tsx
'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { TopicTree } from './topic-tree'
import { ResearchList } from './research-list'
import { ResearchDetail } from './research-detail'

interface Topic {
  id: string
  parent_id: string | null
  name: string
  slug: string
  path: string
  depth: number
  color: string
  icon: string
  sort_order: number
}

interface ResearchItem {
  id: string
  title: string
  topic_id: string
  summary: string | null
  status: string
  word_count: number
  sources: any[]
  version: number
  created_at: string
  updated_at: string
  content_json?: any
  content_md?: string | null
}

interface Stats {
  total: number
  unread: number
  starred: number
  reviewed: number
  archived: number
}

interface ResearchLibraryProps {
  topics: Topic[]
  items: ResearchItem[]
  stats: Stats
  topicItemCounts: Record<string, { total: number; unread: number }>
}

export function ResearchLibrary({
  topics,
  items: initialItems,
  stats,
  topicItemCounts,
}: ResearchLibraryProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [items, setItems] = useState(initialItems)
  const [detailItem, setDetailItem] = useState<ResearchItem | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const topicChildIds = useMemo(() => {
    if (!selectedTopicId) return null
    const selected = topics.find((t) => t.id === selectedTopicId)
    if (!selected) return new Set<string>()
    const ids = new Set<string>()
    ids.add(selectedTopicId)
    for (const t of topics) {
      if (t.path.startsWith(selected.path + '/') || t.id === selectedTopicId) {
        ids.add(t.id)
      }
    }
    return ids
  }, [selectedTopicId, topics])

  const filteredItems = useMemo(() => {
    if (!topicChildIds) return items
    return items.filter((item) => topicChildIds.has(item.topic_id))
  }, [items, topicChildIds])

  const handleSelectItem = useCallback(async (id: string) => {
    setSelectedItemId(id)
    setIsEditing(false)
    setLoadingDetail(true)

    try {
      const res = await fetch(`/api/pipeline/research/${id}`)
      if (res.ok) {
        const { data } = await res.json()
        setDetailItem(data)
      }
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const handleItemUpdated = useCallback((updated: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    )
    setDetailItem((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev))
  }, [])

  const handleItemDeleted = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    if (selectedItemId === id) {
      setSelectedItemId(null)
      setDetailItem(null)
    }
  }, [selectedItemId])

  const handleCreateTopic = useCallback(() => {
    const name = window.prompt('Nome do topic:')
    if (!name) return
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    fetch('/api/pipeline/research/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, parent_id: selectedTopicId }),
    }).then(() => {
      window.location.reload()
    })
  }, [selectedTopicId])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
        target.isContentEditable || target.closest('.ProseMirror')

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        return
      }

      if (e.key === 'Escape') {
        if (isEditing) { setIsEditing(false); return }
        if (selectedItemId) { setSelectedItemId(null); setDetailItem(null); return }
      }

      if (isTyping) return

      if (e.key === 'e' || e.key === 'E') {
        if (selectedItemId && !isEditing) {
          e.preventDefault()
          setIsEditing(true)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, selectedItemId])

  return (
    <div className="flex" style={{ height: '100%', gap: 0 }}>
      <TopicTree
        topics={topics}
        topicItemCounts={topicItemCounts}
        selectedTopicId={selectedTopicId}
        onSelectTopic={setSelectedTopicId}
        onCreateTopic={handleCreateTopic}
        totalItemCount={stats.total}
        totalUnreadCount={stats.unread}
      />
      <ResearchList
        items={filteredItems}
        topics={topics}
        selectedItemId={selectedItemId}
        selectedTopicId={selectedTopicId}
        onSelectItem={handleSelectItem}
      />
      <ResearchDetail
        item={detailItem}
        isEditing={isEditing}
        onToggleEdit={setIsEditing}
        onItemUpdated={handleItemUpdated}
        onItemDeleted={handleItemDeleted}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/research/_components/research-library.tsx
git commit -m "feat(research): add ResearchLibrary main 3-panel component with keyboard shortcuts"
```

---

### Task 14: UI — Research Picker Dialog

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/research/_components/research-picker.tsx`

- [ ] **Step 1: Implement the picker dialog**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/research/_components/research-picker.tsx
'use client'

import { useState, useCallback, useEffect } from 'react'

interface ResearchPickerItem {
  id: string
  title: string
  topic_path: string
  topic_icon: string
  status: string
  word_count: number
}

interface ResearchPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (researchId: string) => void
  excludeIds?: string[]
}

const STATUS_COLORS: Record<string, string> = {
  new: '#fbbf24',
  reviewed: '#34d399',
  starred: '#f472b6',
  archived: '#64748b',
}

export function ResearchPicker({
  open,
  onClose,
  onSelect,
  excludeIds = [],
}: ResearchPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResearchPickerItem[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (q.trim()) params.set('search', q)
      const res = await fetch(`/api/pipeline/research?${params}`)
      if (res.ok) {
        const { data } = await res.json()
        setResults(
          data.filter((r: any) => !excludeIds.includes(r.id)).map((r: any) => ({
            id: r.id,
            title: r.title,
            topic_path: r.topic_path ?? '',
            topic_icon: r.topic_icon ?? '📁',
            status: r.status,
            word_count: r.word_count,
          }))
        )
      }
    } finally {
      setLoading(false)
    }
  }, [excludeIds])

  useEffect(() => {
    if (open) search(query)
  }, [open, query, search])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxHeight: '70vh',
          backgroundColor: 'var(--gem-surface)',
          border: '1px solid var(--gem-border)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gem-border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gem-text)', marginBottom: 8 }}>
            Vincular Research
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pesquisa..."
            autoFocus
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid var(--gem-border)',
              backgroundColor: 'var(--gem-well)',
              color: 'var(--gem-text)',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {loading && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--gem-muted)', fontSize: 12 }}>
              Buscando...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--gem-muted)', fontSize: 12 }}>
              Nenhum resultado.
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => { onSelect(r.id); onClose() }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                padding: '8px 16px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: 'transparent',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: STATUS_COLORS[r.status] ?? '#64748b',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--gem-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.title}
                </div>
                <div style={{ fontSize: 10, color: 'var(--gem-muted)' }}>
                  {r.topic_icon} {r.topic_path} · {r.word_count.toLocaleString()} palavras
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--gem-border)', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              fontSize: 12,
              color: 'var(--gem-muted)',
              backgroundColor: 'transparent',
              border: '1px solid var(--gem-border)',
              borderRadius: 6,
              padding: '4px 12px',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/research/_components/research-picker.tsx
git commit -m "feat(research): add ResearchPicker dialog for linking from pipeline items"
```

---

### Task 15: Cowork Pipeline Reference Update

**Files:**
- Modify: `docs/cowork-pipeline-reference.md`

- [ ] **Step 1: Add Research section to cowork reference**

Append to the end of `docs/cowork-pipeline-reference.md`:

```markdown

---

## Research Library

### POST /api/pipeline/research — Create/upsert research item

Claude pushes research via this endpoint. Duplicate title+topic = upsert (updates content, resets status to 'new').

```json
{
  "title": "WYD Ongame Era — Early MMORPG History",
  "topic_slug": "gaming-history/wyd",
  "content_md": "# WYD Research\n\n...",
  "summary": "Research about WYD Online during the Ongame era (2003-2008)",
  "sources": [
    { "url": "https://example.com/article", "title": "Source Article" }
  ]
}
```

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
```

- [ ] **Step 2: Commit**

```bash
git add docs/cowork-pipeline-reference.md
git commit -m "docs: add Research Library API to cowork pipeline reference"
```

---

### Task 16: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `cd apps/web && npm test`
Expected: All existing + new tests pass.

- [ ] **Step 2: Fix any failures**

If any test fails, fix the issue and re-run until all pass.

- [ ] **Step 3: Start dev server and test manually**

Run: `cd apps/web && npm run dev`
Navigate to `/cms/pipeline/research` in the browser. Verify:
- Topic tree renders (empty or with data)
- "Research" nav item visible in sidebar
- Page loads without errors
- Three-panel layout displays correctly

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(research): test suite and runtime fixes"
```
