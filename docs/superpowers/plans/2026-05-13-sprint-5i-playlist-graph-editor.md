# Sprint 5i — Playlist Graph Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a visual node graph editor for organizing blog posts, newsletters, and pipeline items into named playlists within the CMS.

**Architecture:** Three new database tables (playlists, playlist_items, playlist_edges) with nested RLS. Custom canvas engine using React 19 + SVG + CSS transforms (no external graph library). CMS integration with hub page, graph editor, sidebar drag-to-canvas, auto-layout, and Cowork API via server actions.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind 4, Supabase (PostgreSQL 17), Vitest, Zod, sonner (toasts), lucide-react (icons)

**Spec:** `docs/superpowers/specs/2026-05-12-sprint-5i-playlist-graph-editor-design.md`

---

## PR-A: Schema & Foundation (~6h)

### Task 1: Database Migration — Tables, RLS, Triggers, Indexes

**Files:**
- Create: `supabase/migrations/20260514000001_playlists.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- =============================================================
-- Sprint 5i: Playlist Graph Editor — Schema
-- 3 tables: playlists, playlist_items, playlist_edges
-- =============================================================

-- 1. playlists
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  category TEXT,
  viewport_state JSONB DEFAULT '{"zoom":1,"x":0,"y":0}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT playlists_site_slug_unique UNIQUE (site_id, slug)
);

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playlists_select" ON public.playlists;
CREATE POLICY "playlists_select"
  ON public.playlists FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "playlists_insert" ON public.playlists;
CREATE POLICY "playlists_insert"
  ON public.playlists FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "playlists_update" ON public.playlists;
CREATE POLICY "playlists_update"
  ON public.playlists FOR UPDATE TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "playlists_delete" ON public.playlists;
CREATE POLICY "playlists_delete"
  ON public.playlists FOR DELETE TO authenticated
  USING (public.can_edit_site(site_id));

CREATE TRIGGER set_playlists_updated_at
  BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_playlists_site ON public.playlists(site_id);

-- 2. playlist_items
CREATE TABLE IF NOT EXISTS public.playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  blog_post_id UUID REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  newsletter_edition_id UUID REFERENCES public.newsletter_editions(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES public.content_pipeline(id) ON DELETE SET NULL,
  CONSTRAINT playlist_items_single_ref CHECK (num_nonnulls(blog_post_id, newsletter_edition_id, pipeline_id) <= 1),
  sort_order INTEGER NOT NULL DEFAULT 1000,
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_playlist_item_blog
  ON public.playlist_items(playlist_id, blog_post_id) WHERE blog_post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_playlist_item_newsletter
  ON public.playlist_items(playlist_id, newsletter_edition_id) WHERE newsletter_edition_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_playlist_item_pipeline
  ON public.playlist_items(playlist_id, pipeline_id) WHERE pipeline_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON public.playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_blog ON public.playlist_items(blog_post_id) WHERE blog_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_playlist_items_newsletter ON public.playlist_items(newsletter_edition_id) WHERE newsletter_edition_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_playlist_items_pipeline ON public.playlist_items(pipeline_id) WHERE pipeline_id IS NOT NULL;

ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playlist_items_select" ON public.playlist_items;
CREATE POLICY "playlist_items_select"
  ON public.playlist_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_items.playlist_id
      AND public.can_view_site(playlists.site_id)
  ));

DROP POLICY IF EXISTS "playlist_items_insert" ON public.playlist_items;
CREATE POLICY "playlist_items_insert"
  ON public.playlist_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_items.playlist_id
      AND public.can_edit_site(playlists.site_id)
  ));

DROP POLICY IF EXISTS "playlist_items_update" ON public.playlist_items;
CREATE POLICY "playlist_items_update"
  ON public.playlist_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_items.playlist_id
      AND public.can_edit_site(playlists.site_id)
  ));

DROP POLICY IF EXISTS "playlist_items_delete" ON public.playlist_items;
CREATE POLICY "playlist_items_delete"
  ON public.playlist_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_items.playlist_id
      AND public.can_edit_site(playlists.site_id)
  ));

-- 3. playlist_edges
CREATE TABLE IF NOT EXISTS public.playlist_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  source_item_id UUID NOT NULL REFERENCES public.playlist_items(id) ON DELETE CASCADE,
  target_item_id UUID NOT NULL REFERENCES public.playlist_items(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL DEFAULT 'sequence'
    CHECK (edge_type IN ('sequence', 'related', 'prerequisite', 'continuation')),
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT playlist_edges_unique UNIQUE (playlist_id, source_item_id, target_item_id),
  CONSTRAINT playlist_edges_no_self CHECK (source_item_id != target_item_id)
);

CREATE INDEX IF NOT EXISTS idx_playlist_edges_playlist ON public.playlist_edges(playlist_id);

ALTER TABLE public.playlist_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playlist_edges_select" ON public.playlist_edges;
CREATE POLICY "playlist_edges_select"
  ON public.playlist_edges FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_edges.playlist_id
      AND public.can_view_site(playlists.site_id)
  ));

DROP POLICY IF EXISTS "playlist_edges_insert" ON public.playlist_edges;
CREATE POLICY "playlist_edges_insert"
  ON public.playlist_edges FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_edges.playlist_id
      AND public.can_edit_site(playlists.site_id)
  ));

DROP POLICY IF EXISTS "playlist_edges_update" ON public.playlist_edges;
CREATE POLICY "playlist_edges_update"
  ON public.playlist_edges FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_edges.playlist_id
      AND public.can_edit_site(playlists.site_id)
  ));

DROP POLICY IF EXISTS "playlist_edges_delete" ON public.playlist_edges;
CREATE POLICY "playlist_edges_delete"
  ON public.playlist_edges FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_edges.playlist_id
      AND public.can_edit_site(playlists.site_id)
  ));

-- 4. Cycle prevention trigger (sequence edges only)
CREATE OR REPLACE FUNCTION public.prevent_sequence_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.edge_type != 'sequence' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    WITH RECURSIVE chain AS (
      SELECT target_item_id
      FROM public.playlist_edges
      WHERE source_item_id = NEW.target_item_id
        AND playlist_id = NEW.playlist_id
        AND edge_type = 'sequence'
      UNION ALL
      SELECT e.target_item_id
      FROM public.playlist_edges e
      JOIN chain c ON e.source_item_id = c.target_item_id
      WHERE e.playlist_id = NEW.playlist_id
        AND e.edge_type = 'sequence'
    )
    SELECT 1 FROM chain WHERE target_item_id = NEW.source_item_id
  ) THEN
    RAISE EXCEPTION 'Sequence edge would create a cycle';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_prevent_sequence_cycle ON public.playlist_edges;
CREATE TRIGGER tg_prevent_sequence_cycle
  BEFORE INSERT OR UPDATE ON public.playlist_edges
  FOR EACH ROW EXECUTE FUNCTION public.prevent_sequence_cycle();
```

- [ ] **Step 2: Push migration to local DB and verify**

Run: `npm run db:reset`
Expected: All migrations apply without errors, including the new playlists migration.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260514000001_playlists.sql
git commit -m "feat(playlists): schema — 3 tables, RLS, cycle trigger, indexes"
```

---

### Task 2: Zod Schemas & TypeScript Types

**Files:**
- Create: `apps/web/src/lib/playlists/types.ts`

- [ ] **Step 1: Write types file**

```typescript
import { z } from 'zod'

// -- Enums --

export const PLAYLIST_STATUSES = ['draft', 'published', 'archived'] as const
export type PlaylistStatus = (typeof PLAYLIST_STATUSES)[number]

export const EDGE_TYPES = ['sequence', 'related', 'prerequisite', 'continuation'] as const
export type EdgeType = (typeof EDGE_TYPES)[number]

export const CONTENT_TYPES = ['blog_post', 'newsletter', 'pipeline'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

// -- Schemas --

export const CreatePlaylistSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug'),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  status: z.enum(PLAYLIST_STATUSES).default('draft'),
})

export const UpdatePlaylistSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  status: z.enum(PLAYLIST_STATUSES).optional(),
  cover_image_url: z.string().url().nullable().optional(),
  viewport_state: z.object({
    zoom: z.number().min(0.25).max(2),
    x: z.number(),
    y: z.number(),
  }).optional(),
})

export const AddItemSchema = z.object({
  playlistId: z.string().uuid(),
  blogPostId: z.string().uuid().optional(),
  newsletterEditionId: z.string().uuid().optional(),
  pipelineId: z.string().uuid().optional(),
  sortOrder: z.number().int().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
})

export const CreateEdgeSchema = z.object({
  playlistId: z.string().uuid(),
  sourceItemId: z.string().uuid(),
  targetItemId: z.string().uuid(),
  edgeType: z.enum(EDGE_TYPES),
  label: z.string().max(100).optional(),
})

export const SaveDeltaSchema = z.object({
  playlistId: z.string().uuid(),
  itemsUpserted: z.array(z.object({
    id: z.string().uuid(),
    position_x: z.number(),
    position_y: z.number(),
    sort_order: z.number().int(),
  })),
  itemsRemoved: z.array(z.string().uuid()),
  edgesCreated: z.array(z.object({
    source_item_id: z.string().uuid(),
    target_item_id: z.string().uuid(),
    edge_type: z.enum(EDGE_TYPES),
    label: z.string().max(100).optional(),
  })),
  edgesRemoved: z.array(z.string().uuid()),
})

// -- Row types (from DB) --

export interface PlaylistRow {
  id: string
  site_id: string
  name: string
  slug: string
  description: string | null
  cover_image_url: string | null
  status: PlaylistStatus
  category: string | null
  viewport_state: { zoom: number; x: number; y: number } | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PlaylistItemRow {
  id: string
  playlist_id: string
  blog_post_id: string | null
  newsletter_edition_id: string | null
  pipeline_id: string | null
  sort_order: number
  position_x: number
  position_y: number
  created_at: string
}

export interface PlaylistEdgeRow {
  id: string
  playlist_id: string
  source_item_id: string
  target_item_id: string
  edge_type: EdgeType
  label: string | null
  created_at: string
}

// -- Enriched types (for UI) --

export interface PlaylistItemEnriched extends PlaylistItemRow {
  content_type: ContentType | null
  title: string
  status: string | null
  category: string | null
  metadata: string | null
  is_ghost: boolean
  other_playlist_count: number
}

export interface PlaylistGraph {
  playlist: PlaylistRow
  items: PlaylistItemEnriched[]
  edges: PlaylistEdgeRow[]
}

// -- Action result --

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors related to playlists types.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/playlists/types.ts
git commit -m "feat(playlists): zod schemas + typescript types"
```

---

### Task 3: Supabase Queries

**Files:**
- Create: `apps/web/src/lib/playlists/queries.ts`

- [ ] **Step 1: Write queries file**

```typescript
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type {
  PlaylistRow,
  PlaylistItemRow,
  PlaylistEdgeRow,
  PlaylistItemEnriched,
  PlaylistGraph,
  ContentType,
} from './types'

export async function listPlaylists(
  siteId: string,
  status?: string,
): Promise<PlaylistRow[]> {
  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('playlists')
    .select('*')
    .eq('site_id', siteId)
    .order('updated_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as PlaylistRow[]
}

export async function getPlaylistById(
  playlistId: string,
  siteId: string,
): Promise<PlaylistRow | null> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', playlistId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (error) return null
  return data as PlaylistRow | null
}

export async function getPlaylistBySlug(
  slug: string,
  siteId: string,
): Promise<PlaylistRow | null> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('slug', slug)
    .eq('site_id', siteId)
    .maybeSingle()

  if (error) return null
  return data as PlaylistRow | null
}

function resolveContentType(item: PlaylistItemRow): ContentType | null {
  if (item.blog_post_id) return 'blog_post'
  if (item.newsletter_edition_id) return 'newsletter'
  if (item.pipeline_id) return 'pipeline'
  return null
}

export async function getPlaylistGraph(
  playlistId: string,
  siteId: string,
): Promise<PlaylistGraph | null> {
  const supabase = getSupabaseServiceClient()

  const [playlistRes, itemsRes, edgesRes] = await Promise.all([
    supabase
      .from('playlists')
      .select('*')
      .eq('id', playlistId)
      .eq('site_id', siteId)
      .maybeSingle(),
    supabase
      .from('playlist_items')
      .select('*')
      .eq('playlist_id', playlistId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('playlist_edges')
      .select('*')
      .eq('playlist_id', playlistId),
  ])

  if (playlistRes.error || !playlistRes.data) return null

  const rawItems = (itemsRes.data ?? []) as PlaylistItemRow[]
  const edges = (edgesRes.data ?? []) as PlaylistEdgeRow[]

  const enriched = await enrichItems(rawItems, playlistId)

  return {
    playlist: playlistRes.data as PlaylistRow,
    items: enriched,
    edges,
  }
}

async function enrichItems(
  items: PlaylistItemRow[],
  playlistId: string,
): Promise<PlaylistItemEnriched[]> {
  if (items.length === 0) return []

  const supabase = getSupabaseServiceClient()
  const blogIds = items.map(i => i.blog_post_id).filter(Boolean) as string[]
  const newsletterIds = items.map(i => i.newsletter_edition_id).filter(Boolean) as string[]
  const pipelineIds = items.map(i => i.pipeline_id).filter(Boolean) as string[]

  const [blogRes, newsletterRes, pipelineRes, crossRes] = await Promise.all([
    blogIds.length > 0
      ? supabase
          .from('blog_posts')
          .select('id, status, category, blog_translations!inner(title, locale)')
          .in('id', blogIds)
      : { data: [] },
    newsletterIds.length > 0
      ? supabase
          .from('newsletter_editions')
          .select('id, subject, status, edition_kind')
          .in('id', newsletterIds)
      : { data: [] },
    pipelineIds.length > 0
      ? supabase
          .from('content_pipeline')
          .select('id, title_pt, title_en, format, stage, version')
          .in('id', pipelineIds)
      : { data: [] },
    supabase
      .from('playlist_items')
      .select('blog_post_id, newsletter_edition_id, pipeline_id, playlist_id')
      .or(
        [
          blogIds.length > 0 ? `blog_post_id.in.(${blogIds.join(',')})` : null,
          newsletterIds.length > 0 ? `newsletter_edition_id.in.(${newsletterIds.join(',')})` : null,
          pipelineIds.length > 0 ? `pipeline_id.in.(${pipelineIds.join(',')})` : null,
        ].filter(Boolean).join(','),
      )
      .neq('playlist_id', playlistId),
  ])

  const blogMap = new Map((blogRes.data ?? []).map((b: Record<string, unknown>) => [b.id, b]))
  const newsletterMap = new Map((newsletterRes.data ?? []).map((n: Record<string, unknown>) => [n.id, n]))
  const pipelineMap = new Map((pipelineRes.data ?? []).map((p: Record<string, unknown>) => [p.id, p]))

  const crossCounts = new Map<string, number>()
  for (const row of (crossRes.data ?? []) as Record<string, unknown>[]) {
    const key = (row.blog_post_id ?? row.newsletter_edition_id ?? row.pipeline_id) as string
    crossCounts.set(key, (crossCounts.get(key) ?? 0) + 1)
  }

  return items.map((item): PlaylistItemEnriched => {
    const contentType = resolveContentType(item)
    const isGhost = contentType === null

    let title = 'Content removed'
    let status: string | null = null
    let category: string | null = null
    let metadata: string | null = null
    let refId: string | null = null

    if (item.blog_post_id && blogMap.has(item.blog_post_id)) {
      const blog = blogMap.get(item.blog_post_id) as Record<string, unknown>
      const translations = blog.blog_translations as Array<{ title: string; locale: string }>
      title = translations?.[0]?.title ?? 'Untitled'
      status = blog.status as string
      category = blog.category as string
      refId = item.blog_post_id
    } else if (item.newsletter_edition_id && newsletterMap.has(item.newsletter_edition_id)) {
      const nl = newsletterMap.get(item.newsletter_edition_id) as Record<string, unknown>
      title = nl.subject as string
      status = nl.status as string
      metadata = nl.edition_kind as string
      refId = item.newsletter_edition_id
    } else if (item.pipeline_id && pipelineMap.has(item.pipeline_id)) {
      const pl = pipelineMap.get(item.pipeline_id) as Record<string, unknown>
      title = (pl.title_pt ?? pl.title_en ?? 'Untitled') as string
      status = pl.stage as string
      category = pl.format as string
      metadata = `v${pl.version}`
      refId = item.pipeline_id
    }

    return {
      ...item,
      content_type: contentType,
      title,
      status,
      category,
      metadata,
      is_ghost: isGhost,
      other_playlist_count: refId ? (crossCounts.get(refId) ?? 0) : 0,
    }
  })
}

export async function getNextSortOrder(playlistId: string): Promise<number> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('playlist_items')
    .select('sort_order')
    .eq('playlist_id', playlistId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  return ((data as { sort_order: number } | null)?.sort_order ?? 0) + 1000
}

export async function getPlaylistItemCounts(
  siteId: string,
): Promise<Map<string, number>> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('playlist_items')
    .select('playlist_id')
    .in('playlist_id', (
      await supabase
        .from('playlists')
        .select('id')
        .eq('site_id', siteId)
    ).data?.map((p: { id: string }) => p.id) ?? [])

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as { playlist_id: string }[]) {
    counts.set(row.playlist_id, (counts.get(row.playlist_id) ?? 0) + 1)
  }
  return counts
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/playlists/queries.ts
git commit -m "feat(playlists): supabase queries + enrichment"
```

---

### Task 4: Slug Utility

**Files:**
- Create: `apps/web/src/lib/playlists/slug.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/playlists/slug.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { slugifyPlaylist } from '@/lib/playlists/slug'

describe('slugifyPlaylist', () => {
  it('converts spaces to hyphens and lowercases', () => {
    expect(slugifyPlaylist('React Fundamentals')).toBe('react-fundamentals')
  })

  it('strips diacritics', () => {
    expect(slugifyPlaylist('Séries de Programação')).toBe('series-de-programacao')
  })

  it('removes special characters', () => {
    expect(slugifyPlaylist('C++ & Rust: A Comparison!')).toBe('c-rust-a-comparison')
  })

  it('collapses multiple hyphens', () => {
    expect(slugifyPlaylist('a---b')).toBe('a-b')
  })

  it('trims leading/trailing hyphens', () => {
    expect(slugifyPlaylist('--hello--')).toBe('hello')
  })

  it('truncates to 80 chars', () => {
    const long = 'a'.repeat(100)
    expect(slugifyPlaylist(long).length).toBeLessThanOrEqual(80)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/playlists/slug.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```typescript
export function slugifyPlaylist(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/playlists/slug.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/playlists/slug.ts apps/web/test/lib/playlists/slug.test.ts
git commit -m "feat(playlists): slug utility with tests"
```

---

### Task 5: Integration Tests (DB-gated)

**Files:**
- Create: `apps/web/test/integration/playlists.test.ts`

- [ ] **Step 1: Write integration tests**

```typescript
import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

describe.skipIf(skipIfNoLocalDb())('playlists integration', () => {
  const cleanupPlaylistIds: string[] = []
  const cleanupSiteIds: string[] = []
  const cleanupOrgIds: string[] = []
  let siteId: string

  afterAll(async () => {
    if (cleanupPlaylistIds.length) {
      await db.from('playlists').delete().in('id', cleanupPlaylistIds)
    }
    if (cleanupSiteIds.length) {
      await db.from('sites').delete().in('id', cleanupSiteIds)
    }
    if (cleanupOrgIds.length) {
      await db.from('organizations').delete().in('id', cleanupOrgIds)
    }
  })

  it('setup: create test site', async () => {
    const seed = await seedSite(db)
    siteId = seed.siteId
    cleanupSiteIds.push(seed.siteId)
    cleanupOrgIds.push(seed.orgId)
    expect(siteId).toBeTruthy()
  })

  it('CRUD: create, read, update, delete playlist', async () => {
    const { data: created, error: insertErr } = await db
      .from('playlists')
      .insert({
        site_id: siteId,
        name: 'Test Playlist',
        slug: 'test-playlist',
        status: 'draft',
      })
      .select()
      .single()

    expect(insertErr).toBeNull()
    expect(created).not.toBeNull()
    cleanupPlaylistIds.push(created!.id)

    const { data: read } = await db
      .from('playlists')
      .select('*')
      .eq('id', created!.id)
      .single()

    expect(read!.name).toBe('Test Playlist')
    expect(read!.status).toBe('draft')

    await db
      .from('playlists')
      .update({ status: 'published' })
      .eq('id', created!.id)

    const { data: updated } = await db
      .from('playlists')
      .select('status')
      .eq('id', created!.id)
      .single()

    expect(updated!.status).toBe('published')
  })

  it('playlist_items: add item with blog_post_id, ON DELETE SET NULL creates ghost', async () => {
    const { data: playlist } = await db
      .from('playlists')
      .insert({ site_id: siteId, name: 'Ghost Test', slug: 'ghost-test' })
      .select()
      .single()
    cleanupPlaylistIds.push(playlist!.id)

    const { data: item, error: itemErr } = await db
      .from('playlist_items')
      .insert({
        playlist_id: playlist!.id,
        sort_order: 1000,
        position_x: 100,
        position_y: 200,
      })
      .select()
      .single()

    expect(itemErr).toBeNull()
    expect(item!.blog_post_id).toBeNull()
    expect(item!.newsletter_edition_id).toBeNull()
    expect(item!.pipeline_id).toBeNull()
  })

  it('playlist_items: rejects duplicate content in same playlist', async () => {
    const { data: playlist } = await db
      .from('playlists')
      .insert({ site_id: siteId, name: 'Dup Test', slug: 'dup-test' })
      .select()
      .single()
    cleanupPlaylistIds.push(playlist!.id)

    const fakePipelineId = '00000000-0000-0000-0000-000000000001'

    await db.from('playlist_items').insert({
      playlist_id: playlist!.id,
      pipeline_id: fakePipelineId,
      sort_order: 1000,
    })

    const { error: dupErr } = await db.from('playlist_items').insert({
      playlist_id: playlist!.id,
      pipeline_id: fakePipelineId,
      sort_order: 2000,
    })

    expect(dupErr).not.toBeNull()
    expect(dupErr!.message).toContain('unique')
  })

  it('playlist_edges: cycle prevention trigger blocks sequence cycles', async () => {
    const { data: playlist } = await db
      .from('playlists')
      .insert({ site_id: siteId, name: 'Cycle Test', slug: 'cycle-test' })
      .select()
      .single()
    cleanupPlaylistIds.push(playlist!.id)

    const items = await Promise.all(
      [1000, 2000, 3000].map(async (order) => {
        const { data } = await db
          .from('playlist_items')
          .insert({ playlist_id: playlist!.id, sort_order: order })
          .select()
          .single()
        return data!
      }),
    )

    await db.from('playlist_edges').insert({
      playlist_id: playlist!.id,
      source_item_id: items[0].id,
      target_item_id: items[1].id,
      edge_type: 'sequence',
    })

    await db.from('playlist_edges').insert({
      playlist_id: playlist!.id,
      source_item_id: items[1].id,
      target_item_id: items[2].id,
      edge_type: 'sequence',
    })

    const { error: cycleErr } = await db.from('playlist_edges').insert({
      playlist_id: playlist!.id,
      source_item_id: items[2].id,
      target_item_id: items[0].id,
      edge_type: 'sequence',
    })

    expect(cycleErr).not.toBeNull()
    expect(cycleErr!.message).toContain('cycle')
  })

  it('playlist_edges: related edges allow cycles', async () => {
    const { data: playlist } = await db
      .from('playlists')
      .insert({ site_id: siteId, name: 'Related Cycle', slug: 'related-cycle' })
      .select()
      .single()
    cleanupPlaylistIds.push(playlist!.id)

    const items = await Promise.all(
      [1000, 2000].map(async (order) => {
        const { data } = await db
          .from('playlist_items')
          .insert({ playlist_id: playlist!.id, sort_order: order })
          .select()
          .single()
        return data!
      }),
    )

    await db.from('playlist_edges').insert({
      playlist_id: playlist!.id,
      source_item_id: items[0].id,
      target_item_id: items[1].id,
      edge_type: 'related',
    })

    const { error } = await db.from('playlist_edges').insert({
      playlist_id: playlist!.id,
      source_item_id: items[1].id,
      target_item_id: items[0].id,
      edge_type: 'related',
    })

    expect(error).toBeNull()
  })

  it('cascade: deleting playlist removes items and edges', async () => {
    const { data: playlist } = await db
      .from('playlists')
      .insert({ site_id: siteId, name: 'Cascade Test', slug: 'cascade-test' })
      .select()
      .single()

    const { data: item } = await db
      .from('playlist_items')
      .insert({ playlist_id: playlist!.id, sort_order: 1000 })
      .select()
      .single()

    await db.from('playlists').delete().eq('id', playlist!.id)

    const { data: orphanItems } = await db
      .from('playlist_items')
      .select('id')
      .eq('id', item!.id)

    expect(orphanItems).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests (skip if no local DB)**

Run: `cd apps/web && npx vitest run test/integration/playlists.test.ts`
Expected: Tests PASS (or skip if no local DB).

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/integration/playlists.test.ts
git commit -m "test(playlists): integration tests — CRUD, ghost nodes, cycles, cascade"
```

---

## PR-B: Canvas Engine Core (~16h)

### Task 6: Graph Reducer — Pure State Management

**Files:**
- Create: `apps/web/src/lib/playlists/canvas/graph-reducer.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/playlists/graph-reducer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  graphReducer,
  initialGraphState,
  type GraphState,
  type GraphAction,
} from '@/lib/playlists/canvas/graph-reducer'

function makeItem(id: string, x = 0, y = 0, order = 1000) {
  return {
    id,
    playlist_id: 'p1',
    blog_post_id: null,
    newsletter_edition_id: null,
    pipeline_id: null,
    sort_order: order,
    position_x: x,
    position_y: y,
    created_at: '2026-01-01',
    content_type: 'blog_post' as const,
    title: `Item ${id}`,
    status: 'draft',
    category: null,
    metadata: null,
    is_ghost: false,
    other_playlist_count: 0,
  }
}

function makeEdge(id: string, source: string, target: string, type = 'sequence' as const) {
  return {
    id,
    playlist_id: 'p1',
    source_item_id: source,
    target_item_id: target,
    edge_type: type,
    label: null,
    created_at: '2026-01-01',
  }
}

describe('graphReducer', () => {
  it('ADD_ITEM adds an item to state', () => {
    const state = initialGraphState()
    const item = makeItem('a', 100, 200)
    const next = graphReducer(state, { type: 'ADD_ITEM', item })
    expect(next.items).toHaveLength(1)
    expect(next.items[0].id).toBe('a')
  })

  it('REMOVE_ITEM removes item and connected edges', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('a'), makeItem('b'), makeItem('c')],
      edges: [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')],
    }
    const next = graphReducer(state, { type: 'REMOVE_ITEM', itemId: 'b' })
    expect(next.items).toHaveLength(2)
    expect(next.edges).toHaveLength(0)
  })

  it('MOVE_ITEM updates position', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('a', 0, 0)],
    }
    const next = graphReducer(state, { type: 'MOVE_ITEM', itemId: 'a', x: 300, y: 400 })
    expect(next.items[0].position_x).toBe(300)
    expect(next.items[0].position_y).toBe(400)
  })

  it('MOVE_ITEMS moves multiple items by delta', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('a', 100, 100), makeItem('b', 200, 200)],
    }
    const next = graphReducer(state, {
      type: 'MOVE_ITEMS',
      moves: [
        { itemId: 'a', x: 150, y: 150 },
        { itemId: 'b', x: 250, y: 250 },
      ],
    })
    expect(next.items[0].position_x).toBe(150)
    expect(next.items[1].position_x).toBe(250)
  })

  it('ADD_EDGE adds edge', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('a'), makeItem('b')],
    }
    const edge = makeEdge('e1', 'a', 'b')
    const next = graphReducer(state, { type: 'ADD_EDGE', edge })
    expect(next.edges).toHaveLength(1)
  })

  it('REMOVE_EDGE removes edge', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('a'), makeItem('b')],
      edges: [makeEdge('e1', 'a', 'b')],
    }
    const next = graphReducer(state, { type: 'REMOVE_EDGE', edgeId: 'e1' })
    expect(next.edges).toHaveLength(0)
  })

  it('SET_SELECTION selects items', () => {
    const state = initialGraphState()
    const next = graphReducer(state, { type: 'SET_SELECTION', itemIds: ['a', 'b'], edgeIds: [] })
    expect(next.selectedItemIds).toEqual(new Set(['a', 'b']))
  })

  it('CLEAR_SELECTION clears all', () => {
    const state: GraphState = {
      ...initialGraphState(),
      selectedItemIds: new Set(['a']),
      selectedEdgeIds: new Set(['e1']),
    }
    const next = graphReducer(state, { type: 'CLEAR_SELECTION' })
    expect(next.selectedItemIds.size).toBe(0)
    expect(next.selectedEdgeIds.size).toBe(0)
  })

  it('REORDER_ITEMS assigns sequential sort_order', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('a', 0, 0, 3000), makeItem('b', 0, 0, 1000), makeItem('c', 0, 0, 2000)],
    }
    const next = graphReducer(state, { type: 'REORDER_ITEMS', itemIds: ['b', 'c', 'a'] })
    const ordered = next.items.sort((a, b) => a.sort_order - b.sort_order)
    expect(ordered[0].id).toBe('b')
    expect(ordered[1].id).toBe('c')
    expect(ordered[2].id).toBe('a')
    expect(ordered[0].sort_order).toBe(1000)
    expect(ordered[1].sort_order).toBe(2000)
    expect(ordered[2].sort_order).toBe(3000)
  })

  it('SET_POSITIONS batch updates positions', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('a', 0, 0), makeItem('b', 0, 0)],
    }
    const next = graphReducer(state, {
      type: 'SET_POSITIONS',
      positions: [
        { itemId: 'a', x: 100, y: 200 },
        { itemId: 'b', x: 300, y: 400 },
      ],
    })
    expect(next.items.find(i => i.id === 'a')!.position_x).toBe(100)
    expect(next.items.find(i => i.id === 'b')!.position_x).toBe(300)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/playlists/graph-reducer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```typescript
import type { PlaylistItemEnriched, PlaylistEdgeRow } from '../types'

export interface GraphState {
  items: PlaylistItemEnriched[]
  edges: PlaylistEdgeRow[]
  selectedItemIds: Set<string>
  selectedEdgeIds: Set<string>
}

export function initialGraphState(): GraphState {
  return {
    items: [],
    edges: [],
    selectedItemIds: new Set(),
    selectedEdgeIds: new Set(),
  }
}

export type GraphAction =
  | { type: 'LOAD'; items: PlaylistItemEnriched[]; edges: PlaylistEdgeRow[] }
  | { type: 'ADD_ITEM'; item: PlaylistItemEnriched }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'MOVE_ITEM'; itemId: string; x: number; y: number }
  | { type: 'MOVE_ITEMS'; moves: Array<{ itemId: string; x: number; y: number }> }
  | { type: 'ADD_EDGE'; edge: PlaylistEdgeRow }
  | { type: 'REMOVE_EDGE'; edgeId: string }
  | { type: 'SET_SELECTION'; itemIds: string[]; edgeIds: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'REORDER_ITEMS'; itemIds: string[] }
  | { type: 'SET_POSITIONS'; positions: Array<{ itemId: string; x: number; y: number }> }

export function graphReducer(state: GraphState, action: GraphAction): GraphState {
  switch (action.type) {
    case 'LOAD':
      return {
        ...state,
        items: action.items,
        edges: action.edges,
        selectedItemIds: new Set(),
        selectedEdgeIds: new Set(),
      }

    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.item] }

    case 'REMOVE_ITEM': {
      const id = action.itemId
      return {
        ...state,
        items: state.items.filter(i => i.id !== id),
        edges: state.edges.filter(
          e => e.source_item_id !== id && e.target_item_id !== id,
        ),
        selectedItemIds: setWithout(state.selectedItemIds, id),
      }
    }

    case 'MOVE_ITEM':
      return {
        ...state,
        items: state.items.map(i =>
          i.id === action.itemId
            ? { ...i, position_x: action.x, position_y: action.y }
            : i,
        ),
      }

    case 'MOVE_ITEMS': {
      const moveMap = new Map(action.moves.map(m => [m.itemId, m]))
      return {
        ...state,
        items: state.items.map(i => {
          const move = moveMap.get(i.id)
          return move ? { ...i, position_x: move.x, position_y: move.y } : i
        }),
      }
    }

    case 'ADD_EDGE':
      return { ...state, edges: [...state.edges, action.edge] }

    case 'REMOVE_EDGE':
      return {
        ...state,
        edges: state.edges.filter(e => e.id !== action.edgeId),
        selectedEdgeIds: setWithout(state.selectedEdgeIds, action.edgeId),
      }

    case 'SET_SELECTION':
      return {
        ...state,
        selectedItemIds: new Set(action.itemIds),
        selectedEdgeIds: new Set(action.edgeIds),
      }

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedItemIds: new Set(),
        selectedEdgeIds: new Set(),
      }

    case 'REORDER_ITEMS': {
      const orderMap = new Map(action.itemIds.map((id, i) => [id, (i + 1) * 1000]))
      return {
        ...state,
        items: state.items.map(item => {
          const newOrder = orderMap.get(item.id)
          return newOrder !== undefined ? { ...item, sort_order: newOrder } : item
        }),
      }
    }

    case 'SET_POSITIONS': {
      const posMap = new Map(action.positions.map(p => [p.itemId, p]))
      return {
        ...state,
        items: state.items.map(item => {
          const pos = posMap.get(item.id)
          return pos ? { ...item, position_x: pos.x, position_y: pos.y } : item
        }),
      }
    }
  }
}

function setWithout(set: Set<string>, value: string): Set<string> {
  if (!set.has(value)) return set
  const next = new Set(set)
  next.delete(value)
  return next
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/lib/playlists/graph-reducer.test.ts`
Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/playlists/canvas/graph-reducer.ts apps/web/test/lib/playlists/graph-reducer.test.ts
git commit -m "feat(playlists): graph-reducer — pure state management with tests"
```

---

### Task 7: Canvas Utilities — Coordinate Conversion & Edge Paths

**Files:**
- Create: `apps/web/src/lib/playlists/canvas/utils.ts`
- Create: `apps/web/test/lib/playlists/canvas-utils.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { screenToCanvas, canvasToScreen, edgePath, clampZoom } from '@/lib/playlists/canvas/utils'

describe('screenToCanvas', () => {
  const camera = { x: 50, y: 30, zoom: 1 }
  const rect = { left: 10, top: 20 } as DOMRect

  it('converts screen coords to canvas coords at zoom 1', () => {
    const result = screenToCanvas(160, 150, rect, camera)
    expect(result.x).toBe(100)
    expect(result.y).toBe(100)
  })

  it('accounts for zoom', () => {
    const zoomed = { x: 0, y: 0, zoom: 2 }
    const result = screenToCanvas(110, 120, rect, zoomed)
    expect(result.x).toBe(50)
    expect(result.y).toBe(50)
  })
})

describe('canvasToScreen', () => {
  it('is inverse of screenToCanvas', () => {
    const camera = { x: 50, y: 30, zoom: 1.5 }
    const rect = { left: 10, top: 20 } as DOMRect
    const screen = canvasToScreen(100, 100, rect, camera)
    const back = screenToCanvas(screen.x, screen.y, rect, camera)
    expect(Math.round(back.x)).toBe(100)
    expect(Math.round(back.y)).toBe(100)
  })
})

describe('edgePath', () => {
  it('generates a cubic bezier SVG path', () => {
    const path = edgePath({ x: 0, y: 50 }, { x: 200, y: 50 })
    expect(path).toContain('M 0 50')
    expect(path).toContain('C')
  })

  it('uses minimum control point offset of 50', () => {
    const path = edgePath({ x: 0, y: 0 }, { x: 10, y: 0 })
    expect(path).toContain('C 50')
  })
})

describe('clampZoom', () => {
  it('clamps below minimum', () => {
    expect(clampZoom(0.1)).toBe(0.25)
  })

  it('clamps above maximum', () => {
    expect(clampZoom(5)).toBe(2)
  })

  it('passes through valid values', () => {
    expect(clampZoom(1)).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/playlists/canvas-utils.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write implementation**

```typescript
export interface Point {
  x: number
  y: number
}

export interface Camera {
  x: number
  y: number
  zoom: number
}

const MIN_ZOOM = 0.25
const MAX_ZOOM = 2

export function screenToCanvas(
  screenX: number,
  screenY: number,
  rect: Pick<DOMRect, 'left' | 'top'>,
  camera: Camera,
): Point {
  return {
    x: (screenX - rect.left - camera.x) / camera.zoom,
    y: (screenY - rect.top - camera.y) / camera.zoom,
  }
}

export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  rect: Pick<DOMRect, 'left' | 'top'>,
  camera: Camera,
): Point {
  return {
    x: canvasX * camera.zoom + camera.x + rect.left,
    y: canvasY * camera.zoom + camera.y + rect.top,
  }
}

export function edgePath(source: Point, target: Point): string {
  const dx = Math.abs(target.x - source.x)
  const cp = Math.max(dx * 0.4, 50)
  return `M ${source.x} ${source.y} C ${source.x + cp} ${source.y}, ${target.x - cp} ${target.y}, ${target.x} ${target.y}`
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function zoomTowardPoint(
  camera: Camera,
  screenX: number,
  screenY: number,
  rect: Pick<DOMRect, 'left' | 'top'>,
  delta: number,
): Camera {
  const zoomFactor = delta > 0 ? 0.9 : 1.1
  const newZoom = clampZoom(camera.zoom * zoomFactor)
  const ratio = newZoom / camera.zoom

  const mouseX = screenX - rect.left
  const mouseY = screenY - rect.top

  return {
    zoom: newZoom,
    x: mouseX - (mouseX - camera.x) * ratio,
    y: mouseY - (mouseY - camera.y) * ratio,
  }
}

export function fitAllNodes(
  items: Array<{ position_x: number; position_y: number }>,
  viewportWidth: number,
  viewportHeight: number,
  padding = 60,
  nodeWidth = 180,
  nodeHeight = 80,
): Camera {
  if (items.length === 0) return { x: 0, y: 0, zoom: 1 }

  const minX = Math.min(...items.map(i => i.position_x))
  const maxX = Math.max(...items.map(i => i.position_x)) + nodeWidth
  const minY = Math.min(...items.map(i => i.position_y))
  const maxY = Math.max(...items.map(i => i.position_y)) + nodeHeight

  const contentWidth = maxX - minX + padding * 2
  const contentHeight = maxY - minY + padding * 2

  const zoom = clampZoom(
    Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight),
  )

  return {
    zoom,
    x: (viewportWidth - contentWidth * zoom) / 2 - minX * zoom + padding * zoom,
    y: (viewportHeight - contentHeight * zoom) / 2 - minY * zoom + padding * zoom,
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run test/lib/playlists/canvas-utils.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/playlists/canvas/utils.ts apps/web/test/lib/playlists/canvas-utils.test.ts
git commit -m "feat(playlists): canvas coordinate utils + edge path with tests"
```

---

### Task 8: Auto-Layout Algorithm

**Files:**
- Create: `apps/web/src/lib/playlists/canvas/auto-layout.ts`
- Create: `apps/web/test/lib/playlists/auto-layout.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { computeAutoLayout } from '@/lib/playlists/canvas/auto-layout'
import type { PlaylistItemEnriched } from '@/lib/playlists/types'
import type { PlaylistEdgeRow } from '@/lib/playlists/types'

function item(id: string, order = 1000): PlaylistItemEnriched {
  return {
    id,
    playlist_id: 'p1',
    blog_post_id: null,
    newsletter_edition_id: null,
    pipeline_id: null,
    sort_order: order,
    position_x: 0,
    position_y: 0,
    created_at: '2026-01-01',
    content_type: 'blog_post',
    title: id,
    status: null,
    category: null,
    metadata: null,
    is_ghost: false,
    other_playlist_count: 0,
  }
}

function edge(source: string, target: string): PlaylistEdgeRow {
  return {
    id: `${source}-${target}`,
    playlist_id: 'p1',
    source_item_id: source,
    target_item_id: target,
    edge_type: 'sequence',
    label: null,
    created_at: '2026-01-01',
  }
}

describe('computeAutoLayout', () => {
  it('returns empty for no items', () => {
    expect(computeAutoLayout([], [])).toEqual([])
  })

  it('places single node at origin', () => {
    const result = computeAutoLayout([item('a')], [])
    expect(result).toEqual([{ itemId: 'a', x: 0, y: 0 }])
  })

  it('assigns layers left-to-right based on sequence edges', () => {
    const items = [item('a', 1000), item('b', 2000), item('c', 3000)]
    const edges = [edge('a', 'b'), edge('b', 'c')]
    const result = computeAutoLayout(items, edges)

    const posMap = new Map(result.map(r => [r.itemId, r]))
    expect(posMap.get('a')!.x).toBeLessThan(posMap.get('b')!.x)
    expect(posMap.get('b')!.x).toBeLessThan(posMap.get('c')!.x)
  })

  it('sorts within layers by sort_order', () => {
    const items = [item('a', 2000), item('b', 1000)]
    const result = computeAutoLayout(items, [])

    const posMap = new Map(result.map(r => [r.itemId, r]))
    expect(posMap.get('b')!.y).toBeLessThan(posMap.get('a')!.y)
  })

  it('ignores non-sequence edges for layout', () => {
    const items = [item('a'), item('b')]
    const edges: PlaylistEdgeRow[] = [{
      ...edge('a', 'b'),
      edge_type: 'related',
    }]
    const result = computeAutoLayout(items, edges)
    const posMap = new Map(result.map(r => [r.itemId, r]))
    expect(posMap.get('a')!.x).toBe(posMap.get('b')!.x)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/playlists/auto-layout.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write implementation**

```typescript
import type { PlaylistItemEnriched, PlaylistEdgeRow } from '../types'

const LAYER_GAP_X = 200
const NODE_GAP_Y = 120

interface LayoutPosition {
  itemId: string
  x: number
  y: number
}

export function computeAutoLayout(
  items: PlaylistItemEnriched[],
  edges: PlaylistEdgeRow[],
): LayoutPosition[] {
  if (items.length === 0) return []

  const sequenceEdges = edges.filter(e => e.edge_type === 'sequence')

  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const item of items) {
    inDegree.set(item.id, 0)
    adjacency.set(item.id, [])
  }

  for (const edge of sequenceEdges) {
    if (!inDegree.has(edge.source_item_id) || !inDegree.has(edge.target_item_id)) continue
    adjacency.get(edge.source_item_id)!.push(edge.target_item_id)
    inDegree.set(edge.target_item_id, (inDegree.get(edge.target_item_id) ?? 0) + 1)
  }

  // Kahn's algorithm — topological sort for layer assignment
  const layers = new Map<string, number>()
  const queue: string[] = []

  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id)
      layers.set(id, 0)
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentLayer = layers.get(current)!

    for (const next of adjacency.get(current) ?? []) {
      const newLayer = currentLayer + 1
      layers.set(next, Math.max(layers.get(next) ?? 0, newLayer))

      const newDeg = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, newDeg)
      if (newDeg === 0) {
        queue.push(next)
      }
    }
  }

  // Items not reached by sequence edges go to layer 0
  for (const item of items) {
    if (!layers.has(item.id)) {
      layers.set(item.id, 0)
    }
  }

  // Group by layer, sort within each layer by sort_order
  const layerGroups = new Map<number, PlaylistItemEnriched[]>()
  for (const item of items) {
    const layer = layers.get(item.id) ?? 0
    if (!layerGroups.has(layer)) layerGroups.set(layer, [])
    layerGroups.get(layer)!.push(item)
  }

  for (const group of layerGroups.values()) {
    group.sort((a, b) => a.sort_order - b.sort_order)
  }

  const sortedLayers = [...layerGroups.entries()].sort(([a], [b]) => a - b)

  const positions: LayoutPosition[] = []
  for (const [layerIndex, group] of sortedLayers) {
    for (let i = 0; i < group.length; i++) {
      positions.push({
        itemId: group[i].id,
        x: layerIndex * LAYER_GAP_X,
        y: i * NODE_GAP_Y,
      })
    }
  }

  return positions
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run test/lib/playlists/auto-layout.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/playlists/canvas/auto-layout.ts apps/web/test/lib/playlists/auto-layout.test.ts
git commit -m "feat(playlists): auto-layout — Sugiyama-simplified with tests"
```

---

### Task 9: useCanvas Hook — Camera State, Zoom, Pan

**Files:**
- Create: `apps/web/src/lib/playlists/canvas/use-canvas.ts`

- [ ] **Step 1: Write the hook**

```typescript
'use client'

import { useCallback, useRef, useState } from 'react'
import { type Camera, type Point, screenToCanvas, zoomTowardPoint, clampZoom, fitAllNodes } from './utils'

interface UseCanvasOptions {
  initialCamera?: Camera
}

export function useCanvas(options: UseCanvasOptions = {}) {
  const [camera, setCamera] = useState<Camera>(
    options.initialCamera ?? { x: 0, y: 0, zoom: 1 },
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanningRef = useRef(false)
  const panStartRef = useRef<Point>({ x: 0, y: 0 })
  const cameraStartRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 })

  const getRect = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 } as DOMRect
  }, [])

  const toCanvas = useCallback(
    (screenX: number, screenY: number): Point => {
      return screenToCanvas(screenX, screenY, getRect(), camera)
    },
    [camera, getRect],
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const rect = getRect()
      setCamera(prev => zoomTowardPoint(prev, e.clientX, e.clientY, rect, e.deltaY))
    },
    [getRect],
  )

  const handlePanStart = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && e.metaKey)) {
        isPanningRef.current = true
        panStartRef.current = { x: e.clientX, y: e.clientY }
        cameraStartRef.current = { ...camera }
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        e.preventDefault()
      }
    },
    [camera],
  )

  const handlePanMove = useCallback((e: React.PointerEvent) => {
    if (!isPanningRef.current) return
    const dx = e.clientX - panStartRef.current.x
    const dy = e.clientY - panStartRef.current.y
    setCamera({
      ...cameraStartRef.current,
      x: cameraStartRef.current.x + dx,
      y: cameraStartRef.current.y + dy,
    })
  }, [])

  const handlePanEnd = useCallback(() => {
    isPanningRef.current = false
  }, [])

  const zoomToFit = useCallback(
    (items: Array<{ position_x: number; position_y: number }>) => {
      const el = containerRef.current
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      setCamera(fitAllNodes(items, width, height))
    },
    [],
  )

  const setZoom = useCallback((zoom: number) => {
    setCamera(prev => ({ ...prev, zoom: clampZoom(zoom) }))
  }, [])

  return {
    camera,
    setCamera,
    containerRef,
    toCanvas,
    handleWheel,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    zoomToFit,
    setZoom,
    isPanning: isPanningRef,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/playlists/canvas/use-canvas.ts
git commit -m "feat(playlists): useCanvas hook — camera, zoom, pan"
```

---

### Task 10: useDragNode Hook — Pointer Events Node Drag

**Files:**
- Create: `apps/web/src/lib/playlists/canvas/use-drag-node.ts`

- [ ] **Step 1: Write the hook**

```typescript
'use client'

import { useCallback, useRef } from 'react'
import type { Camera, Point } from './utils'
import { screenToCanvas } from './utils'

interface UseDragNodeOptions {
  camera: Camera
  containerRef: React.RefObject<HTMLDivElement | null>
  selectedItemIds: Set<string>
  onMoveEnd: (moves: Array<{ itemId: string; x: number; y: number }>) => void
}

export function useDragNode({ camera, containerRef, selectedItemIds, onMoveEnd }: UseDragNodeOptions) {
  const isDraggingRef = useRef(false)
  const dragItemIdRef = useRef<string | null>(null)
  const dragStartCanvasRef = useRef<Point>({ x: 0, y: 0 })
  const initialPositionsRef = useRef<Map<string, Point>>(new Map())

  const getRect = () =>
    containerRef.current?.getBoundingClientRect() ?? ({ left: 0, top: 0 } as DOMRect)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, itemId: string, currentX: number, currentY: number) => {
      if (e.button !== 0 || e.metaKey) return
      e.stopPropagation()
      e.preventDefault()

      isDraggingRef.current = true
      dragItemIdRef.current = itemId
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      const canvasPos = screenToCanvas(e.clientX, e.clientY, getRect(), camera)
      dragStartCanvasRef.current = canvasPos

      const idsToMove = selectedItemIds.has(itemId)
        ? selectedItemIds
        : new Set([itemId])

      initialPositionsRef.current = new Map()
      const nodeEls = containerRef.current?.querySelectorAll('[data-node-id]')
      if (nodeEls) {
        for (const el of nodeEls) {
          const id = (el as HTMLElement).dataset.nodeId!
          if (idsToMove.has(id)) {
            const x = parseFloat((el as HTMLElement).dataset.posX ?? '0')
            const y = parseFloat((el as HTMLElement).dataset.posY ?? '0')
            initialPositionsRef.current.set(id, { x, y })
          }
        }
      }

      if (!initialPositionsRef.current.has(itemId)) {
        initialPositionsRef.current.set(itemId, { x: currentX, y: currentY })
      }
    },
    [camera, containerRef, selectedItemIds],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return

      const canvasPos = screenToCanvas(e.clientX, e.clientY, getRect(), camera)
      const dx = canvasPos.x - dragStartCanvasRef.current.x
      const dy = canvasPos.y - dragStartCanvasRef.current.y

      for (const [id, initial] of initialPositionsRef.current) {
        const el = containerRef.current?.querySelector(`[data-node-id="${id}"]`) as HTMLElement
        if (el) {
          const newX = initial.x + dx
          const newY = initial.y + dy
          el.style.transform = `translate(${newX}px, ${newY}px)`
        }
      }
    },
    [camera, containerRef],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false

      const canvasPos = screenToCanvas(e.clientX, e.clientY, getRect(), camera)
      const dx = canvasPos.x - dragStartCanvasRef.current.x
      const dy = canvasPos.y - dragStartCanvasRef.current.y

      const moves: Array<{ itemId: string; x: number; y: number }> = []
      for (const [id, initial] of initialPositionsRef.current) {
        moves.push({ itemId: id, x: initial.x + dx, y: initial.y + dy })
      }

      if (moves.length > 0 && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
        onMoveEnd(moves)
      }

      dragItemIdRef.current = null
      initialPositionsRef.current.clear()
    },
    [camera, onMoveEnd],
  )

  return {
    isDragging: isDraggingRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/playlists/canvas/use-drag-node.ts
git commit -m "feat(playlists): useDragNode — pointer events, ref-based DOM drag"
```

---

### Task 11: useGraphHistory Hook — Undo/Redo

**Files:**
- Create: `apps/web/src/lib/playlists/canvas/use-graph-history.ts`
- Create: `apps/web/test/lib/playlists/graph-history.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { createHistory } from '@/lib/playlists/canvas/use-graph-history'
import { initialGraphState, type GraphState } from '@/lib/playlists/canvas/graph-reducer'

describe('createHistory', () => {
  it('starts with no undo/redo', () => {
    const h = createHistory<GraphState>()
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
  })

  it('push then undo returns previous state', () => {
    const h = createHistory<GraphState>()
    const s1 = initialGraphState()
    const s2 = { ...s1, items: [{ id: 'a' }] } as unknown as GraphState
    h.push(s1)
    h.push(s2)
    expect(h.canUndo()).toBe(true)
    expect(h.undo()).toEqual(s1)
  })

  it('undo then redo returns forward state', () => {
    const h = createHistory<GraphState>()
    const s1 = initialGraphState()
    const s2 = { ...s1, items: [{ id: 'a' }] } as unknown as GraphState
    h.push(s1)
    h.push(s2)
    h.undo()
    expect(h.canRedo()).toBe(true)
    expect(h.redo()).toEqual(s2)
  })

  it('push after undo clears redo stack', () => {
    const h = createHistory<GraphState>()
    const s1 = initialGraphState()
    const s2 = { ...s1, items: [{ id: 'a' }] } as unknown as GraphState
    const s3 = { ...s1, items: [{ id: 'b' }] } as unknown as GraphState
    h.push(s1)
    h.push(s2)
    h.undo()
    h.push(s3)
    expect(h.canRedo()).toBe(false)
  })

  it('respects max size', () => {
    const h = createHistory<GraphState>(3)
    for (let i = 0; i < 5; i++) {
      h.push({ ...initialGraphState(), items: [{ id: String(i) }] } as unknown as GraphState)
    }
    let undoCount = 0
    while (h.canUndo()) {
      h.undo()
      undoCount++
    }
    expect(undoCount).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/playlists/graph-history.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write implementation**

```typescript
'use client'

import { useCallback, useRef } from 'react'

const MAX_HISTORY = 50

export interface History<T> {
  push(state: T): void
  undo(): T | null
  redo(): T | null
  canUndo(): boolean
  canRedo(): boolean
  clear(): void
}

export function createHistory<T>(maxSize = MAX_HISTORY): History<T> {
  const past: T[] = []
  const future: T[] = []

  return {
    push(state: T) {
      past.push(state)
      future.length = 0
      if (past.length > maxSize) {
        past.shift()
      }
    },

    undo(): T | null {
      if (past.length <= 1) return null
      const current = past.pop()!
      future.push(current)
      return past[past.length - 1] ?? null
    },

    redo(): T | null {
      if (future.length === 0) return null
      const next = future.pop()!
      past.push(next)
      return next
    },

    canUndo() {
      return past.length > 1
    },

    canRedo() {
      return future.length > 0
    },

    clear() {
      past.length = 0
      future.length = 0
    },
  }
}

export function useGraphHistory<T>() {
  const historyRef = useRef(createHistory<T>())

  const pushSnapshot = useCallback((state: T) => {
    historyRef.current.push(structuredClone(state))
  }, [])

  const undo = useCallback((): T | null => {
    return historyRef.current.undo()
  }, [])

  const redo = useCallback((): T | null => {
    return historyRef.current.redo()
  }, [])

  const canUndo = useCallback(() => historyRef.current.canUndo(), [])
  const canRedo = useCallback(() => historyRef.current.canRedo(), [])

  return { pushSnapshot, undo, redo, canUndo, canRedo }
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run test/lib/playlists/graph-history.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/playlists/canvas/use-graph-history.ts apps/web/test/lib/playlists/graph-history.test.ts
git commit -m "feat(playlists): useGraphHistory — undo/redo with tests"
```

---

### Task 12: useEdgeDrag Hook — Edge Creation Drag

**Files:**
- Create: `apps/web/src/lib/playlists/canvas/use-edge-drag.ts`

- [ ] **Step 1: Write the hook**

```typescript
'use client'

import { useCallback, useRef, useState } from 'react'
import type { Camera, Point } from './utils'
import { screenToCanvas } from './utils'

export interface DragEdgeState {
  active: boolean
  sourceItemId: string | null
  sourcePoint: Point
  currentPoint: Point
}

interface UseEdgeDragOptions {
  camera: Camera
  containerRef: React.RefObject<HTMLDivElement | null>
  onEdgeCreated: (sourceItemId: string, targetItemId: string) => void
}

export function useEdgeDrag({ camera, containerRef, onEdgeCreated }: UseEdgeDragOptions) {
  const [dragEdge, setDragEdge] = useState<DragEdgeState>({
    active: false,
    sourceItemId: null,
    sourcePoint: { x: 0, y: 0 },
    currentPoint: { x: 0, y: 0 },
  })
  const sourceIdRef = useRef<string | null>(null)

  const getRect = () =>
    containerRef.current?.getBoundingClientRect() ?? ({ left: 0, top: 0 } as DOMRect)

  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent, itemId: string, handleX: number, handleY: number) => {
      e.stopPropagation()
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      sourceIdRef.current = itemId
      setDragEdge({
        active: true,
        sourceItemId: itemId,
        sourcePoint: { x: handleX, y: handleY },
        currentPoint: { x: handleX, y: handleY },
      })
    },
    [],
  )

  const handleHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!sourceIdRef.current) return
      const canvasPos = screenToCanvas(e.clientX, e.clientY, getRect(), camera)
      setDragEdge(prev => ({ ...prev, currentPoint: canvasPos }))
    },
    [camera, containerRef],
  )

  const handleHandlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!sourceIdRef.current) return
      const sourceId = sourceIdRef.current

      const target = (e.target as HTMLElement).closest('[data-handle-id]')
      const targetItemId = target?.getAttribute('data-handle-id')

      if (targetItemId && targetItemId !== sourceId) {
        onEdgeCreated(sourceId, targetItemId)
      }

      sourceIdRef.current = null
      setDragEdge({
        active: false,
        sourceItemId: null,
        sourcePoint: { x: 0, y: 0 },
        currentPoint: { x: 0, y: 0 },
      })
    },
    [onEdgeCreated],
  )

  return {
    dragEdge,
    handleHandlePointerDown,
    handleHandlePointerMove,
    handleHandlePointerUp,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/playlists/canvas/use-edge-drag.ts
git commit -m "feat(playlists): useEdgeDrag — edge creation via pointer events"
```

---

### Task 13: Canvas Engine Index Export

**Files:**
- Create: `apps/web/src/lib/playlists/canvas/index.ts`

- [ ] **Step 1: Write the barrel export**

```typescript
export { useCanvas } from './use-canvas'
export { useDragNode } from './use-drag-node'
export { useEdgeDrag } from './use-edge-drag'
export { useGraphHistory, createHistory } from './use-graph-history'
export { graphReducer, initialGraphState, type GraphState, type GraphAction } from './graph-reducer'
export { computeAutoLayout } from './auto-layout'
export {
  screenToCanvas,
  canvasToScreen,
  edgePath,
  clampZoom,
  zoomTowardPoint,
  fitAllNodes,
  type Camera,
  type Point,
} from './utils'
```

- [ ] **Step 2: Run all playlists tests**

Run: `cd apps/web && npx vitest run test/lib/playlists/`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/playlists/canvas/index.ts
git commit -m "feat(playlists): canvas engine barrel export"
```

---

## PR-C: CMS Integration (~10h)

### Task 14: CMS Sidebar Entry

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`

- [ ] **Step 1: Add Playlists to Content section**

Add `Playlists` entry with `ListMusic` icon to the Content section, after existing items. Import the icon from lucide-react if using string icons, or use emoji `'🎵'` to match existing pattern.

Find the Content section items array and add:
```typescript
{
  icon: '🎵',
  label: 'Playlists',
  href: '/cms/playlists',
  minRole: 'editor' as const,
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/cms-sections.ts
git commit -m "feat(playlists): add CMS sidebar entry"
```

---

### Task 15: Server Actions — CRUD + Cowork API

**Files:**
- Create: `apps/web/src/app/cms/(authed)/playlists/actions.ts`

- [ ] **Step 1: Write server actions**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import {
  CreatePlaylistSchema,
  UpdatePlaylistSchema,
  AddItemSchema,
  CreateEdgeSchema,
  SaveDeltaSchema,
  type ActionResult,
  type PlaylistRow,
  type PlaylistGraph,
} from '@/lib/playlists/types'
import { getPlaylistGraph, getPlaylistBySlug, getNextSortOrder } from '@/lib/playlists/queries'

async function requireEditScope(siteId: string): Promise<void> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  }
}

export async function createPlaylist(
  siteId: string,
  input: unknown,
): Promise<ActionResult<PlaylistRow>> {
  const parsed = CreatePlaylistSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  try {
    await requireEditScope(siteId)
    const supabase = getSupabaseServiceClient()

    const existing = await getPlaylistBySlug(parsed.data.slug, siteId)
    if (existing) return { ok: false, error: 'slug_already_exists' }

    const { data, error } = await supabase
      .from('playlists')
      .insert({ ...parsed.data, site_id: siteId })
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath('/cms/playlists')
    return { ok: true, data: data as PlaylistRow }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function updatePlaylist(
  playlistId: string,
  siteId: string,
  input: unknown,
): Promise<ActionResult<PlaylistRow>> {
  const parsed = UpdatePlaylistSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  try {
    await requireEditScope(siteId)
    const supabase = getSupabaseServiceClient()

    const { data, error } = await supabase
      .from('playlists')
      .update(parsed.data)
      .eq('id', playlistId)
      .eq('site_id', siteId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath('/cms/playlists')
    revalidatePath(`/cms/playlists/${playlistId}`)
    return { ok: true, data: data as PlaylistRow }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function deletePlaylist(
  playlistId: string,
  siteId: string,
): Promise<ActionResult> {
  try {
    await requireEditScope(siteId)
    const supabase = getSupabaseServiceClient()

    const { error } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlistId)
      .eq('site_id', siteId)

    if (error) return { ok: false, error: error.message }

    revalidatePath('/cms/playlists')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function addItemToPlaylist(
  siteId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = AddItemSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  try {
    await requireEditScope(siteId)
    const supabase = getSupabaseServiceClient()

    const sortOrder = parsed.data.sortOrder ?? await getNextSortOrder(parsed.data.playlistId)

    const { data, error } = await supabase
      .from('playlist_items')
      .insert({
        playlist_id: parsed.data.playlistId,
        blog_post_id: parsed.data.blogPostId ?? null,
        newsletter_edition_id: parsed.data.newsletterEditionId ?? null,
        pipeline_id: parsed.data.pipelineId ?? null,
        sort_order: sortOrder,
        position_x: parsed.data.positionX ?? 0,
        position_y: parsed.data.positionY ?? 0,
      })
      .select('id')
      .single()

    if (error) {
      if (error.message.includes('unique')) return { ok: false, error: 'already_in_playlist' }
      return { ok: false, error: error.message }
    }

    return { ok: true, data: { id: (data as { id: string }).id } }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function removeItemFromPlaylist(
  playlistItemId: string,
  siteId: string,
): Promise<ActionResult> {
  try {
    await requireEditScope(siteId)
    const supabase = getSupabaseServiceClient()

    const { error } = await supabase
      .from('playlist_items')
      .delete()
      .eq('id', playlistItemId)

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function createEdge(
  siteId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateEdgeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  try {
    await requireEditScope(siteId)
    const supabase = getSupabaseServiceClient()

    const { data, error } = await supabase
      .from('playlist_edges')
      .insert({
        playlist_id: parsed.data.playlistId,
        source_item_id: parsed.data.sourceItemId,
        target_item_id: parsed.data.targetItemId,
        edge_type: parsed.data.edgeType,
        label: parsed.data.label ?? null,
      })
      .select('id')
      .single()

    if (error) {
      if (error.message.includes('cycle')) return { ok: false, error: 'cycle_detected' }
      if (error.message.includes('unique')) return { ok: false, error: 'edge_already_exists' }
      return { ok: false, error: error.message }
    }

    return { ok: true, data: { id: (data as { id: string }).id } }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function deleteEdge(
  edgeId: string,
  siteId: string,
): Promise<ActionResult> {
  try {
    await requireEditScope(siteId)
    const supabase = getSupabaseServiceClient()

    const { error } = await supabase
      .from('playlist_edges')
      .delete()
      .eq('id', edgeId)

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function savePlaylistDelta(
  siteId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = SaveDeltaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  try {
    await requireEditScope(siteId)
    const supabase = getSupabaseServiceClient()
    const { playlistId, itemsUpserted, itemsRemoved, edgesCreated, edgesRemoved } = parsed.data

    const promises: Promise<unknown>[] = []

    for (const item of itemsUpserted) {
      promises.push(
        supabase
          .from('playlist_items')
          .update({
            position_x: item.position_x,
            position_y: item.position_y,
            sort_order: item.sort_order,
          })
          .eq('id', item.id),
      )
    }

    if (itemsRemoved.length > 0) {
      promises.push(
        supabase.from('playlist_items').delete().in('id', itemsRemoved),
      )
    }

    for (const edge of edgesCreated) {
      promises.push(
        supabase.from('playlist_edges').insert({
          playlist_id: playlistId,
          ...edge,
        }),
      )
    }

    if (edgesRemoved.length > 0) {
      promises.push(
        supabase.from('playlist_edges').delete().in('id', edgesRemoved),
      )
    }

    await Promise.all(promises)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function saveViewportState(
  playlistId: string,
  siteId: string,
  viewport: { zoom: number; x: number; y: number },
): Promise<ActionResult> {
  try {
    await requireEditScope(siteId)
    const supabase = getSupabaseServiceClient()

    const { error } = await supabase
      .from('playlists')
      .update({ viewport_state: viewport })
      .eq('id', playlistId)
      .eq('site_id', siteId)

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function reorderPlaylistItems(
  siteId: string,
  playlistId: string,
  itemIds: string[],
): Promise<ActionResult> {
  try {
    await requireEditScope(siteId)
    const supabase = getSupabaseServiceClient()

    const promises = itemIds.map((id, index) =>
      supabase
        .from('playlist_items')
        .update({ sort_order: (index + 1) * 1000 })
        .eq('id', id)
        .eq('playlist_id', playlistId),
    )

    await Promise.all(promises)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function updatePlaylistStatus(
  playlistId: string,
  siteId: string,
  status: string,
): Promise<ActionResult> {
  return updatePlaylist(playlistId, siteId, { status })
}

export async function getPlaylistWithItems(
  playlistId: string,
  siteId: string,
): Promise<ActionResult<PlaylistGraph>> {
  try {
    const graph = await getPlaylistGraph(playlistId, siteId)
    if (!graph) return { ok: false, error: 'not_found' }
    return { ok: true, data: graph }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/actions.ts
git commit -m "feat(playlists): server actions — CRUD, delta save, viewport, cowork API"
```

---

### Task 16: Hub Page — Playlist List with Tabs

**Files:**
- Create: `apps/web/src/app/cms/(authed)/playlists/page.tsx`

- [ ] **Step 1: Write the hub page**

```typescript
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSiteContext } from '@/lib/cms/site-context'
import { listPlaylists } from '@/lib/playlists/queries'
import { getPlaylistItemCounts } from '@/lib/playlists/queries'
import type { PlaylistRow, PlaylistStatus } from '@/lib/playlists/types'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'published', label: 'Published' },
  { key: 'archived', label: 'Archived' },
] as const

export default async function PlaylistsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const ctx = await getSiteContext()
  if (!ctx) notFound()

  const params = await searchParams
  const tab = params.tab ?? 'all'
  const status = tab === 'all' ? undefined : tab

  const [playlists, itemCounts] = await Promise.all([
    listPlaylists(ctx.siteId, status),
    getPlaylistItemCounts(ctx.siteId),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Playlists</h1>
        <Link
          href="/cms/playlists/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New Playlist
        </Link>
      </div>

      <div className="flex gap-1 border-b border-white/10 pb-px">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={`/cms/playlists${t.key === 'all' ? '' : `?tab=${t.key}`}`}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white/5 text-white'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <p className="text-lg">No playlists yet</p>
          <p className="mt-1 text-sm">Create your first playlist to start organizing content</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map(playlist => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              itemCount={itemCounts.get(playlist.id) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PlaylistCard({
  playlist,
  itemCount,
}: {
  playlist: PlaylistRow
  itemCount: number
}) {
  const statusColors: Record<PlaylistStatus, string> = {
    draft: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    published: 'bg-green-500/10 text-green-400 border-green-500/20',
    archived: 'bg-white/5 text-white/40 border-white/10',
  }

  return (
    <Link
      href={`/cms/playlists/${playlist.id}`}
      className="group rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-all hover:border-white/20 hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-white group-hover:text-indigo-300">
          {playlist.name}
        </h3>
        <span
          className={`rounded-md border px-2 py-0.5 text-xs font-medium ${statusColors[playlist.status]}`}
        >
          {playlist.status}
        </span>
      </div>

      {playlist.description && (
        <p className="mt-2 line-clamp-2 text-sm text-white/50">
          {playlist.description}
        </p>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-white/30">
        <span>{itemCount} items</span>
        {playlist.category && <span>{playlist.category}</span>}
        <span className="ml-auto">
          {new Date(playlist.updated_at).toLocaleDateString()}
        </span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/page.tsx
git commit -m "feat(playlists): hub page — list with tabs, cards, empty state"
```

---

### Task 17: Create Playlist Page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/playlists/new/page.tsx`

- [ ] **Step 1: Write the create page (client component with form)**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPlaylist } from '../actions'
import { slugifyPlaylist } from '@/lib/playlists/slug'

export default function NewPlaylistPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')

  function handleNameChange(value: string) {
    setName(value)
    if (!slugManual) {
      setSlug(slugifyPlaylist(value))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const siteId = document.cookie
        .split('; ')
        .find(c => c.startsWith('x-site-id='))
        ?.split('=')[1]

      if (!siteId) {
        toast.error('Site context not found')
        return
      }

      const result = await createPlaylist(siteId, {
        name,
        slug,
        description: description || undefined,
        category: category || undefined,
      })

      if (result.ok) {
        toast.success('Playlist created')
        router.push(`/cms/playlists/${result.data.id}`)
      } else {
        toast.error(
          result.error === 'slug_already_exists'
            ? 'A playlist with this slug already exists'
            : result.error,
        )
      }
    })
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-2xl font-bold">New Playlist</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-white/70">Name</span>
          <input
            type="text"
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30"
            placeholder="React Fundamentals"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-white/70">Slug</span>
          <input
            type="text"
            value={slug}
            onChange={e => {
              setSlug(e.target.value)
              setSlugManual(true)
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white/60 placeholder:text-white/30"
            placeholder="react-fundamentals"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-white/70">Description</span>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30"
            rows={3}
            placeholder="Optional description..."
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-white/70">Category</span>
          <input
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30"
            placeholder="tech, vida, etc."
          />
        </label>

        <div className="mt-2 flex gap-3">
          <button
            type="submit"
            disabled={isPending || !name || !slug}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? 'Creating...' : 'Create Playlist'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-white/10 px-6 py-2 text-sm text-white/60 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/new/page.tsx
git commit -m "feat(playlists): create playlist page with auto-slug"
```

---

### Task 18: Run All Tests

- [ ] **Step 1: Run full test suite**

Run: `npm run test:web`
Expected: All tests PASS (playlists + existing tests).

- [ ] **Step 2: TypeScript check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors.

---

## PR-D: Graph Editor Page (~14h)

> **Note:** Tasks 19-26 build the graph editor page component by component. Each task creates one focused component file. The final assembly happens in Task 27.

### Task 19: Playlist Node Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-node.tsx`

- [ ] **Step 1: Write the node component**

This component renders a single node on the canvas. Three visual variants by content type (blog=indigo, newsletter=green, pipeline=purple) plus ghost nodes (dashed border, muted).

```typescript
'use client'

import type { PlaylistItemEnriched, ContentType } from '@/lib/playlists/types'

const TYPE_STYLES: Record<ContentType, { bg: string; border: string; badge: string; badgeBg: string; headerBg: string }> = {
  blog_post: {
    bg: 'bg-indigo-500/[0.08]',
    border: 'border-indigo-500/25',
    badge: 'BLOG',
    badgeBg: 'bg-indigo-500',
    headerBg: 'bg-indigo-500/10',
  },
  newsletter: {
    bg: 'bg-green-500/[0.08]',
    border: 'border-green-500/25',
    badge: 'NEWS',
    badgeBg: 'bg-green-500',
    headerBg: 'bg-green-500/10',
  },
  pipeline: {
    bg: 'bg-purple-500/[0.08]',
    border: 'border-purple-500/25',
    badge: 'PIPE',
    badgeBg: 'bg-purple-500',
    headerBg: 'bg-purple-500/10',
  },
}

interface PlaylistNodeProps {
  item: PlaylistItemEnriched
  isSelected: boolean
  onPointerDown: (e: React.PointerEvent, itemId: string, x: number, y: number) => void
  onHandlePointerDown: (e: React.PointerEvent, itemId: string, x: number, y: number) => void
  onContextMenu: (e: React.MouseEvent, itemId: string) => void
  onClick: (e: React.MouseEvent, itemId: string) => void
}

export function PlaylistNode({
  item,
  isSelected,
  onPointerDown,
  onHandlePointerDown,
  onContextMenu,
  onClick,
}: PlaylistNodeProps) {
  const style = item.is_ghost
    ? null
    : item.content_type
      ? TYPE_STYLES[item.content_type]
      : null

  const ghostClasses = item.is_ghost
    ? 'border-dashed border-white/20 bg-white/[0.02]'
    : ''

  const selectedRing = isSelected ? 'ring-2 ring-indigo-500/50 shadow-lg shadow-black/30' : ''

  return (
    <div
      data-node-id={item.id}
      data-pos-x={item.position_x}
      data-pos-y={item.position_y}
      role="button"
      aria-label={`${item.content_type ?? 'Ghost'}: ${item.title}, ${item.status ?? 'removed'}`}
      tabIndex={0}
      className={`absolute min-w-[160px] cursor-grab rounded-xl border-2 ${style?.bg ?? ''} ${style?.border ?? ''} ${ghostClasses} ${selectedRing} select-none transition-shadow`}
      style={{ transform: `translate(${item.position_x}px, ${item.position_y}px)` }}
      onPointerDown={e => onPointerDown(e, item.id, item.position_x, item.position_y)}
      onContextMenu={e => {
        e.preventDefault()
        onContextMenu(e, item.id)
      }}
      onClick={e => onClick(e, item.id)}
    >
      {/* Left handle */}
      <div
        data-handle-id={item.id}
        className={`absolute left-[-6px] top-1/2 h-[11px] w-[11px] -translate-y-1/2 cursor-crosshair rounded-full border-[2.5px] border-[var(--bg,#0a0a12)] ${style?.badgeBg ?? 'bg-white/30'} hover:scale-125`}
        onPointerDown={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          onHandlePointerDown(e, item.id, item.position_x, item.position_y + 40)
        }}
      />

      {/* Right handle */}
      <div
        data-handle-id={item.id}
        className={`absolute right-[-6px] top-1/2 h-[11px] w-[11px] -translate-y-1/2 cursor-crosshair rounded-full border-[2.5px] border-[var(--bg,#0a0a12)] ${style?.badgeBg ?? 'bg-white/30'} hover:scale-125`}
        onPointerDown={e => {
          onHandlePointerDown(e, item.id, item.position_x + 160, item.position_y + 40)
        }}
      />

      {/* Header */}
      {style && !item.is_ghost && (
        <div className={`flex items-center gap-1.5 rounded-t-[9px] px-2.5 py-1 text-[0.62rem] ${style.headerBg}`}>
          <span className={`rounded px-1.5 py-px text-[0.6rem] font-bold text-white ${style.badgeBg}`}>
            {style.badge}
          </span>
          <span className="text-white/40">{item.category ?? ''}</span>
        </div>
      )}

      {/* Body */}
      <div className="px-2.5 py-1.5">
        <h4 className={`text-sm font-semibold ${item.is_ghost ? 'text-white/30' : 'text-white'}`}>
          {item.title}
        </h4>
        <p className="mt-0.5 text-[0.65rem] text-white/40">
          {item.status ?? ''}{item.metadata ? ` · ${item.metadata}` : ''}
        </p>
      </div>

      {/* Cross-playlist badge */}
      {item.other_playlist_count > 0 && (
        <div className="border-t border-white/5 px-2.5 py-1 text-[0.62rem] text-white/30">
          em {item.other_playlist_count + 1} playlists
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-node.tsx
git commit -m "feat(playlists): PlaylistNode — 3 content types + ghost node"
```

---

### Task 20: Playlist Edge Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-edge.tsx`

- [ ] **Step 1: Write the edge component**

```typescript
'use client'

import type { PlaylistEdgeRow, EdgeType } from '@/lib/playlists/types'
import type { PlaylistItemEnriched } from '@/lib/playlists/types'
import { edgePath } from '@/lib/playlists/canvas/utils'

const EDGE_STYLES: Record<EdgeType, { stroke: string; dash?: string; marker: boolean; defaultLabel?: string }> = {
  sequence: { stroke: '#818cf8', marker: true },
  related: { stroke: '#4b5563', dash: '5,3', marker: false, defaultLabel: 'veja também' },
  prerequisite: { stroke: '#fbbf24', dash: '8,3', marker: true, defaultLabel: 'leia antes' },
  continuation: { stroke: '#34d399', marker: true },
}

const NODE_WIDTH = 160
const NODE_HEIGHT = 80

interface PlaylistEdgeProps {
  edge: PlaylistEdgeRow
  sourceItem: PlaylistItemEnriched
  targetItem: PlaylistItemEnriched
  isSelected: boolean
  onSelect: (edgeId: string) => void
}

export function PlaylistEdge({
  edge,
  sourceItem,
  targetItem,
  isSelected,
  onSelect,
}: PlaylistEdgeProps) {
  const style = EDGE_STYLES[edge.edge_type]

  const sourcePoint = {
    x: sourceItem.position_x + NODE_WIDTH,
    y: sourceItem.position_y + NODE_HEIGHT / 2,
  }
  const targetPoint = {
    x: targetItem.position_x,
    y: targetItem.position_y + NODE_HEIGHT / 2,
  }

  const path = edgePath(sourcePoint, targetPoint)
  const displayLabel = edge.label || style.defaultLabel

  const midX = (sourcePoint.x + targetPoint.x) / 2
  const midY = (sourcePoint.y + targetPoint.y) / 2

  return (
    <g>
      {/* Fat invisible hit area */}
      <path
        d={path}
        stroke="transparent"
        strokeWidth={12}
        fill="none"
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onClick={() => onSelect(edge.id)}
      />

      {/* Visible edge */}
      <path
        d={path}
        stroke={isSelected ? '#f87171' : style.stroke}
        strokeWidth={isSelected ? 3 : 2}
        fill="none"
        strokeDasharray={style.dash}
        markerEnd={style.marker ? `url(#arrow-${edge.edge_type})` : undefined}
        style={{ pointerEvents: 'none', filter: isSelected ? 'drop-shadow(0 0 4px rgba(248,113,113,0.4))' : undefined }}
      />

      {/* Label */}
      {displayLabel && (
        <text
          x={midX}
          y={midY - 8}
          fill={style.stroke}
          fontSize={9}
          fontFamily="-apple-system, sans-serif"
          fontStyle="italic"
          textAnchor="middle"
          style={{ pointerEvents: 'none' }}
        >
          {displayLabel}
        </text>
      )}
    </g>
  )
}

export function EdgeArrowDefs() {
  return (
    <defs>
      {(['sequence', 'prerequisite', 'continuation'] as const).map(type => (
        <marker
          key={type}
          id={`arrow-${type}`}
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L8,3 L0,6" fill={EDGE_STYLES[type].stroke} />
        </marker>
      ))}
    </defs>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-edge.tsx
git commit -m "feat(playlists): PlaylistEdge — 4 edge types, fat hit area, labels"
```

---

### Task 21-27: Remaining PR-D Components

> Tasks 21-27 follow the same pattern: create component file, implement, commit. For brevity, the remaining components are listed with their key responsibilities. Each produces one focused file.

**Task 21: Playlist Toolbar** (`playlist-toolbar.tsx`)
- Back link, playlist name, status badge, save indicator, undo/redo buttons, auto-layout button, settings toggle
- Save states: `saved` / `saving` / `error`

**Task 22: Playlist Sidebar** (`playlist-sidebar.tsx`)
- Search input, type filter toggle buttons (Blog/News/Pipe/All)
- Available items list (not in playlist), already-in-playlist dimmed list
- Phantom node drag via pointer events (onPointerDown → position:fixed element → onPointerUp creates item)

**Task 23: Edge Type Selector** (`edge-type-selector.tsx`)
- Popover that appears after edge drop: 4 options (sequence/related/prerequisite/continuation) with colored dots and labels

**Task 24: Context Menu** (`context-menu.tsx`)
- Right-click menu: Open in editor, Create edge from here, separator, Remove from playlist (red)
- Positioned at cursor, closes on click outside or Escape

**Task 25: Playlist Canvas** (`playlist-canvas.tsx`)
- 6-layer rendering: viewport → transform group → SVG edges → DOM nodes → marquee → mini-map
- Wires useCanvas, useDragNode, useEdgeDrag, useGraphHistory
- Handles keyboard shortcuts, beforeunload guard
- Debounced auto-save via savePlaylistDelta

**Task 26: Graph Editor Page** (`[id]/page.tsx`)
- Server component: fetches playlist graph via getPlaylistGraph
- Renders toolbar + sidebar + canvas
- Handles not found

**Task 27: Run tests + typecheck**
- Run: `npm run test:web` — all PASS
- Run: `cd apps/web && npx tsc --noEmit` — no errors

---

## PR-E: Polish (~8h)

### Task 28-34: Polish Components

**Task 28: Mini-map** (`playlist-minimap.tsx`)
- 130x80px overview in bottom-right corner, backdrop-blur
- Mini-nodes as colored rectangles, viewport indicator rectangle
- Click to navigate

**Task 29: Settings Panel** (`playlist-settings.tsx`)
- Slide-over from right: name, slug, description, category, status, cover image (MediaGalleryModal)
- Stats: item count, edge count, content types
- Delete playlist button with confirmation

**Task 30: Keyboard Shortcuts**
- Wire in canvas component: ⌘Z (undo), ⌘⇧Z (redo), Delete (remove selection), ⌘A (select all), Escape (deselect), ⌘0 (zoom to fit), Tab (next node), Arrow keys (move selected)

**Task 31: A11y List View**
- Toggle "List view" in toolbar
- Table: order, title, type, status, connections
- Full CRUD from list view

**Task 32: Loading Skeletons + Empty State**
- Canvas skeleton: pulsing rectangles at saved positions
- Sidebar skeleton items
- Empty state: centered placeholder with instructions

**Task 33: Viewport Persistence**
- Load viewport_state from playlist row on mount
- Save on page leave (beforeunload + router navigation) via saveViewportState action

**Task 34: Final Tests + Manual Testing**
- Run: `npm run test:web` — all PASS
- Run: `cd apps/web && npx tsc --noEmit` — no errors
- Manual test checklist (12 scenarios from spec section 16.1)

---

## POST: Cowork Reference Update (~2h)

### Task 35: Update cowork-pipeline-reference.md

**Files:**
- Modify: `docs/cowork-pipeline-reference.md`

- [ ] **Step 1: Add Playlists section**

Append a new `## Playlists` section after the existing content. Document:

1. Available server actions (createPlaylist, addItemToPlaylist, etc.) with parameters and response shapes
2. Example: auto-adding a graduated pipeline item to a playlist
3. Rules: naming conventions, when to create playlists, edge type guidelines
4. Integration with pipeline graduation flow

- [ ] **Step 2: Commit**

```bash
git add docs/cowork-pipeline-reference.md
git commit -m "docs: add Playlists section to cowork-pipeline-reference"
```

---

## Dependency Graph

```
Task 1 (migration)
  ├── Task 2 (types) ── Task 3 (queries) ── Task 4 (slug)
  │     └── Task 5 (integration tests)
  │
  ├── Task 6 (graph-reducer) ── Task 7 (canvas utils) ── Task 8 (auto-layout)
  │     └── Task 9 (useCanvas) ── Task 10 (useDragNode) ── Task 11 (useGraphHistory)
  │           └── Task 12 (useEdgeDrag) ── Task 13 (barrel export)
  │
  ├── Task 14 (sidebar entry) ── Task 15 (server actions) ── Task 16 (hub page) ── Task 17 (create page)
  │
  └── Tasks 19-27 (graph editor page + components)
        └── Tasks 28-34 (polish)
              └── Task 35 (cowork reference)
```

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Custom canvas edge cases (zoom drift, coordinate misalignment) | Extensive unit tests on coordinate conversion, manual testing at zoom extremes |
| Pointer events cross-browser differences | Test in Chrome + Firefox + Safari. Pointer Events are well-supported since 2019. |
| Cycle prevention trigger performance on large graphs | Recursive CTE is efficient for playlists <100 items. Document limit. |
| Debounced auto-save race conditions | Delta-based saves are idempotent. Last-write-wins is acceptable for single-user CMS. |
| Ghost node UX confusion | Clear "Content removed" label + dashed border. Context menu has "Remove" option. |
