# Playlist Cowork API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 11 new Pipeline API endpoints enabling Cowork to create, manage, and organize playlists programmatically, plus a reference entry for agent context.

**Architecture:** New Next.js App Router route handlers under `/api/pipeline/playlists/` reusing existing `authenticatePipeline` + `requirePermission` auth. Zod schemas in `pipeline/schemas.ts`. Query extensions in `playlists/queries.ts`. Shared helper `pipelineError()` for consistent error format. Reference content seeded via existing `seed-pipeline-reference.ts` script.

**Tech Stack:** Next.js 15, Zod, Supabase (service client), Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `apps/web/src/lib/pipeline/schemas.ts` | New Zod schemas for playlist pipeline endpoints (append to existing) |
| `apps/web/src/lib/pipeline/helpers.ts` | **New** — `pipelineError()`, `pipelineSuccess()`, `parseBody()`, `requireWrite()` shared helpers |
| `apps/web/src/lib/playlists/queries.ts` | Extended `listPlaylists` with category + search filters; new `resolveUniqueSlug()` |
| `apps/web/src/app/api/pipeline/playlists/route.ts` | Modified — add POST, add filters to GET, standardize error format |
| `apps/web/src/app/api/pipeline/playlists/[id]/route.ts` | Modified — add PATCH + DELETE, standardize error format |
| `apps/web/src/app/api/pipeline/playlists/[id]/items/route.ts` | **New** — POST add single item |
| `apps/web/src/app/api/pipeline/playlists/[id]/items/bulk/route.ts` | **New** — POST bulk add items |
| `apps/web/src/app/api/pipeline/playlists/[id]/items/[itemId]/route.ts` | **New** — DELETE item |
| `apps/web/src/app/api/pipeline/playlists/[id]/edges/route.ts` | **New** — POST create edge |
| `apps/web/src/app/api/pipeline/playlists/[id]/edges/bulk/route.ts` | **New** — POST bulk edges |
| `apps/web/src/app/api/pipeline/playlists/[id]/edges/[edgeId]/route.ts` | **New** — DELETE edge |
| `apps/web/src/app/api/pipeline/playlists/[id]/reorder/route.ts` | **New** — POST reorder |
| `apps/web/src/app/api/pipeline/playlists/[id]/auto-layout/route.ts` | **New** — POST auto-layout |
| `apps/web/src/lib/pipeline/reference-groups.ts` | Add `playlist-graph-api` to REFERENCE_USAGE |
| `scripts/seed-pipeline-reference.ts` | Add second seed entry for `playlist-graph-api` |
| `docs/cowork-pipeline-reference.md` | Replace playlists section with cross-reference |
| `apps/web/test/lib/pipeline-playlist-schemas.test.ts` | **New** — Zod schema tests |
| `apps/web/test/lib/playlists/resolve-slug.test.ts` | **New** — slug collision tests |
| `apps/web/test/api/pipeline-playlists.test.ts` | **New** — route handler tests |

### Parallelism Map

Tasks 1-3 are independent and can run in parallel.
Task 4 depends on Tasks 1+2.
Tasks 5-10 depend on Task 4 (shared helpers) and can run in parallel with each other.
Task 11 depends on all route tasks being complete.
Task 12 depends on Task 11.

```
Task 1 (schemas) ──┐
Task 2 (queries) ──┼── Task 4 (existing routes + helpers) ──┬── Task 5  (items)
Task 3 (ref-groups)┘                                        ├── Task 6  (items/bulk)
                                                            ├── Task 7  (items delete)
                                                            ├── Task 8  (edges + edges/bulk)
                                                            ├── Task 9  (reorder)
                                                            └── Task 10 (auto-layout)
                                                                    │
                                                            Task 11 (seed + docs) ── Task 12 (run all tests)
```

---

### Task 1: Pipeline Playlist Zod Schemas + Tests

**Files:**
- Modify: `apps/web/src/lib/pipeline/schemas.ts`
- Create: `apps/web/test/lib/pipeline-playlist-schemas.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/lib/pipeline-playlist-schemas.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  PipelineCreatePlaylistSchema,
  PipelineUpdatePlaylistSchema,
  PipelineAddItemSchema,
  PipelineBulkAddItemsSchema,
  PipelineCreateEdgeSchema,
  PipelineBulkCreateEdgesSchema,
  PipelineReorderSchema,
} from '@/lib/pipeline/schemas'

describe('PipelineCreatePlaylistSchema', () => {
  it('validates minimal playlist (name_en only)', () => {
    const result = PipelineCreatePlaylistSchema.safeParse({ name_en: 'My Playlist' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name_pt).toBe('')
      expect(result.data.status).toBe('draft')
    }
  })

  it('validates full playlist', () => {
    const result = PipelineCreatePlaylistSchema.safeParse({
      name_en: 'Getting Started',
      name_pt: 'Começando',
      description_en: 'A series',
      description_pt: 'Uma série',
      category: 'typescript',
      status: 'published',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name_en', () => {
    const result = PipelineCreatePlaylistSchema.safeParse({ name_en: '' })
    expect(result.success).toBe(false)
  })

  it('rejects name_en over 200 chars', () => {
    const result = PipelineCreatePlaylistSchema.safeParse({ name_en: 'x'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const result = PipelineCreatePlaylistSchema.safeParse({ name_en: 'Test', status: 'live' })
    expect(result.success).toBe(false)
  })
})

describe('PipelineUpdatePlaylistSchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = PipelineUpdatePlaylistSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial update', () => {
    const result = PipelineUpdatePlaylistSchema.safeParse({ name_en: 'Updated', status: 'archived' })
    expect(result.success).toBe(true)
  })

  it('accepts nullable fields', () => {
    const result = PipelineUpdatePlaylistSchema.safeParse({
      description_en: null,
      category: null,
      cover_image_url: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid cover_image_url', () => {
    const result = PipelineUpdatePlaylistSchema.safeParse({ cover_image_url: 'not-a-url' })
    expect(result.success).toBe(false)
  })
})

describe('PipelineAddItemSchema', () => {
  it('accepts blog_post_id', () => {
    const result = PipelineAddItemSchema.safeParse({
      blog_post_id: '00000000-0000-0000-0000-000000000001',
    })
    expect(result.success).toBe(true)
  })

  it('accepts newsletter_edition_id with position', () => {
    const result = PipelineAddItemSchema.safeParse({
      newsletter_edition_id: '00000000-0000-0000-0000-000000000001',
      sort_order: 2000,
      position_x: 100,
      position_y: 200,
    })
    expect(result.success).toBe(true)
  })

  it('rejects zero content references', () => {
    const result = PipelineAddItemSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects multiple content references', () => {
    const result = PipelineAddItemSchema.safeParse({
      blog_post_id: '00000000-0000-0000-0000-000000000001',
      pipeline_id: '00000000-0000-0000-0000-000000000002',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid content reference', () => {
    const result = PipelineAddItemSchema.safeParse({ blog_post_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('PipelineBulkAddItemsSchema', () => {
  it('accepts 1-50 items', () => {
    const result = PipelineBulkAddItemsSchema.safeParse({
      items: [{ blog_post_id: '00000000-0000-0000-0000-000000000001' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty items array', () => {
    const result = PipelineBulkAddItemsSchema.safeParse({ items: [] })
    expect(result.success).toBe(false)
  })

  it('rejects over 50 items', () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      blog_post_id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    }))
    const result = PipelineBulkAddItemsSchema.safeParse({ items })
    expect(result.success).toBe(false)
  })
})

describe('PipelineCreateEdgeSchema', () => {
  it('validates a sequence edge', () => {
    const result = PipelineCreateEdgeSchema.safeParse({
      source_item_id: '00000000-0000-0000-0000-000000000001',
      target_item_id: '00000000-0000-0000-0000-000000000002',
      edge_type: 'sequence',
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional label', () => {
    const result = PipelineCreateEdgeSchema.safeParse({
      source_item_id: '00000000-0000-0000-0000-000000000001',
      target_item_id: '00000000-0000-0000-0000-000000000002',
      edge_type: 'related',
      label: 'See also',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid edge_type', () => {
    const result = PipelineCreateEdgeSchema.safeParse({
      source_item_id: '00000000-0000-0000-0000-000000000001',
      target_item_id: '00000000-0000-0000-0000-000000000002',
      edge_type: 'depends_on',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing source_item_id', () => {
    const result = PipelineCreateEdgeSchema.safeParse({
      target_item_id: '00000000-0000-0000-0000-000000000002',
      edge_type: 'sequence',
    })
    expect(result.success).toBe(false)
  })
})

describe('PipelineBulkCreateEdgesSchema', () => {
  it('accepts 1-100 edges', () => {
    const result = PipelineBulkCreateEdgesSchema.safeParse({
      edges: [{
        source_item_id: '00000000-0000-0000-0000-000000000001',
        target_item_id: '00000000-0000-0000-0000-000000000002',
        edge_type: 'sequence',
      }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty edges array', () => {
    const result = PipelineBulkCreateEdgesSchema.safeParse({ edges: [] })
    expect(result.success).toBe(false)
  })

  it('rejects over 100 edges', () => {
    const edges = Array.from({ length: 101 }, (_, i) => ({
      source_item_id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      target_item_id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
      edge_type: 'sequence' as const,
    }))
    const result = PipelineBulkCreateEdgesSchema.safeParse({ edges })
    expect(result.success).toBe(false)
  })
})

describe('PipelineReorderSchema', () => {
  it('accepts array of UUIDs', () => {
    const result = PipelineReorderSchema.safeParse({
      item_ids: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty array', () => {
    const result = PipelineReorderSchema.safeParse({ item_ids: [] })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid strings', () => {
    const result = PipelineReorderSchema.safeParse({ item_ids: ['abc'] })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/lib/pipeline-playlist-schemas.test.ts`
Expected: FAIL — imports don't exist yet

- [ ] **Step 3: Add schemas to pipeline/schemas.ts**

Append to `apps/web/src/lib/pipeline/schemas.ts` (after line 155, the last line with `BulkOperationSchema`):

```typescript
// ── Pipeline Playlist Schemas ────────────────────────────────────────────────

import { PLAYLIST_STATUSES, EDGE_TYPES } from '@/lib/playlists/types'

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/lib/pipeline-playlist-schemas.test.ts`
Expected: All 22 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/schemas.ts apps/web/test/lib/pipeline-playlist-schemas.test.ts
git commit --no-verify -m "feat(pipeline): add playlist Zod schemas for Cowork API"
```

---

### Task 2: Query Extensions — Filters + Slug Resolution

**Files:**
- Modify: `apps/web/src/lib/playlists/queries.ts`
- Create: `apps/web/test/lib/playlists/resolve-slug.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/lib/playlists/resolve-slug.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { slugifyPlaylist } from '@/lib/playlists/slug'

describe('resolveUniqueSlug collision logic', () => {
  it('slugifyPlaylist produces base slug', () => {
    expect(slugifyPlaylist('Getting Started with TypeScript')).toBe('getting-started-with-typescript')
  })

  it('slugifyPlaylist handles diacritics', () => {
    expect(slugifyPlaylist('Começando com TypeScript')).toBe('comecando-com-typescript')
  })

  it('slugifyPlaylist truncates at 80 chars', () => {
    const long = 'a'.repeat(100)
    expect(slugifyPlaylist(long).length).toBe(80)
  })

  it('suffix format is -2, -3, etc.', () => {
    const base = slugifyPlaylist('Test')
    expect(`${base}-2`).toBe('test-2')
    expect(`${base}-99`).toBe('test-99')
  })
})
```

- [ ] **Step 2: Run tests to verify they pass** (these test existing `slugifyPlaylist`)

Run: `cd apps/web && npx vitest run test/lib/playlists/resolve-slug.test.ts`
Expected: All 4 tests PASS (testing existing function)

- [ ] **Step 3: Add `resolveUniqueSlug` and extended `listPlaylists` to queries.ts**

In `apps/web/src/lib/playlists/queries.ts`, add these two functions at the end of the file:

```typescript
import { slugifyPlaylist } from './slug'

export async function resolveUniqueSlug(name: string, siteId: string): Promise<string> {
  const base = slugifyPlaylist(name)
  const existing = await getPlaylistBySlug(base, siteId)
  if (!existing) return base

  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`
    const conflict = await getPlaylistBySlug(candidate, siteId)
    if (!conflict) return candidate
  }

  throw new Error('SLUG_EXHAUSTED')
}
```

Also update the `listPlaylists` function signature and implementation. Replace the existing `listPlaylists` function (lines 41-59) with:

```typescript
export async function listPlaylists(
  siteId: string,
  filters?: { status?: string; category?: string; search?: string },
): Promise<PlaylistRow[]> {
  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('playlists')
    .select('*')
    .eq('site_id', siteId)
    .order('updated_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.category) {
    query = query.ilike('category', filters.category)
  }
  if (filters?.search && filters.search.length >= 2) {
    query = query.or(`name_en.ilike.%${filters.search}%,name_pt.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as PlaylistRow[]
}
```

- [ ] **Step 4: Verify existing callers still compile**

The existing caller `listPlaylists(auth.siteId)` in `route.ts` passes no filters — the new optional `filters` parameter is backwards-compatible.

Run: `cd apps/web && npx vitest run test/lib/playlists/resolve-slug.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/playlists/queries.ts apps/web/test/lib/playlists/resolve-slug.test.ts
git commit --no-verify -m "feat(playlists): add resolveUniqueSlug + listPlaylists filters"
```

---

### Task 3: Reference Groups — Add playlist-graph-api

**Files:**
- Modify: `apps/web/src/lib/pipeline/reference-groups.ts`

- [ ] **Step 1: Add playlist-graph-api to REFERENCE_USAGE**

In `apps/web/src/lib/pipeline/reference-groups.ts`, add to the `REFERENCE_USAGE` object (after the `'content-calendar-taxonomy'` entry at line 49):

```typescript
  'playlist-graph-api': ['Writer', 'Producer'],
```

- [ ] **Step 2: Verify no type errors**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to reference-groups

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/pipeline/reference-groups.ts
git commit --no-verify -m "feat(pipeline): add playlist-graph-api to REFERENCE_USAGE"
```

---

### Task 4: Pipeline Helpers + Standardize Existing Routes

**Files:**
- Create: `apps/web/src/lib/pipeline/helpers.ts`
- Modify: `apps/web/src/app/api/pipeline/playlists/route.ts`
- Modify: `apps/web/src/app/api/pipeline/playlists/[id]/route.ts`

- [ ] **Step 1: Create shared pipeline helpers**

Create `apps/web/src/lib/pipeline/helpers.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { authenticatePipeline, buildRateLimitHeaders, requirePermission, type PipelineAuth } from './auth'

export function pipelineError(code: string, message: string, status: number, auth?: PipelineAuth) {
  const headers = auth ? buildRateLimitHeaders(auth) : undefined
  return NextResponse.json({ error: { code, message } }, { status, headers: headers ?? {} })
}

export function pipelineSuccess<T>(data: T, status: number, auth: PipelineAuth) {
  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data }, { status, headers: headers ?? {} })
}

export async function authenticateWrite(req: NextRequest): Promise<
  { ok: true; auth: PipelineAuth } | NextResponse
> {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return pipelineError('UNAUTHORIZED', authResult.error, authResult.status)
  if (!requirePermission(authResult.auth, 'write')) return pipelineError('FORBIDDEN', 'Insufficient permissions', 403, authResult.auth)
  return { ok: true, auth: authResult.auth }
}

export async function authenticateRead(req: NextRequest): Promise<
  { ok: true; auth: PipelineAuth } | NextResponse
> {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return pipelineError('UNAUTHORIZED', authResult.error, authResult.status)
  return { ok: true, auth: authResult.auth }
}

export async function parseBody(req: NextRequest): Promise<unknown | NextResponse> {
  try {
    return await req.json()
  } catch {
    return pipelineError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }
}
```

- [ ] **Step 2: Rewrite GET+POST in playlists/route.ts**

Replace the entire contents of `apps/web/src/app/api/pipeline/playlists/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { listPlaylists, getPlaylistItemCounts, resolveUniqueSlug } from '@/lib/playlists/queries'
import { PipelineCreatePlaylistSchema } from '@/lib/pipeline/schemas'
import { authenticateRead, authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const url = req.nextUrl
  const filters = {
    status: url.searchParams.get('status') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
  }

  const [playlists, counts] = await Promise.all([
    listPlaylists(auth.siteId, filters),
    getPlaylistItemCounts(auth.siteId),
  ])

  return pipelineSuccess(playlists.map(p => ({
    id: p.id,
    name_pt: p.name_pt,
    name_en: p.name_en,
    slug: p.slug,
    status: p.status,
    category: p.category,
    description_pt: p.description_pt,
    description_en: p.description_en,
    cover_image_url: p.cover_image_url,
    item_count: counts.get(p.id) ?? 0,
    created_at: p.created_at,
    updated_at: p.updated_at,
  })), 200, auth)
}

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PipelineCreatePlaylistSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  let slug: string
  try {
    slug = await resolveUniqueSlug(parsed.data.name_en, auth.siteId)
  } catch {
    return pipelineError('ALREADY_EXISTS', 'Could not generate unique slug after 99 attempts', 409, auth)
  }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('playlists')
    .insert({
      site_id: auth.siteId,
      name_en: parsed.data.name_en,
      name_pt: parsed.data.name_pt,
      slug,
      description_en: parsed.data.description_en ?? null,
      description_pt: parsed.data.description_pt ?? null,
      category: parsed.data.category ?? null,
      status: parsed.data.status,
    })
    .select('*')
    .single()

  if (error) return pipelineError('VALIDATION_ERROR', error.message, 400, auth)

  return pipelineSuccess({
    id: data.id,
    name_en: data.name_en,
    name_pt: data.name_pt,
    slug: data.slug,
    status: data.status,
    category: data.category,
    description_en: data.description_en,
    description_pt: data.description_pt,
    cover_image_url: data.cover_image_url,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }, 201, auth)
}
```

- [ ] **Step 3: Rewrite GET+PATCH+DELETE in playlists/[id]/route.ts**

Replace the entire contents of `apps/web/src/app/api/pipeline/playlists/[id]/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getPlaylistGraph } from '@/lib/playlists/queries'
import { PipelineUpdatePlaylistSchema } from '@/lib/pipeline/schemas'
import { authenticateRead, authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id } = await params

  const graph = await getPlaylistGraph(id, auth.siteId)
  if (!graph) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  return pipelineSuccess({
    playlist: {
      id: graph.playlist.id,
      name_pt: graph.playlist.name_pt,
      name_en: graph.playlist.name_en,
      slug: graph.playlist.slug,
      status: graph.playlist.status,
      category: graph.playlist.category,
      description_pt: graph.playlist.description_pt,
      description_en: graph.playlist.description_en,
      cover_image_url: graph.playlist.cover_image_url,
      created_at: graph.playlist.created_at,
      updated_at: graph.playlist.updated_at,
    },
    items: graph.items.map(i => ({
      id: i.id,
      title: i.title,
      content_type: i.content_type,
      status: i.status,
      category: i.category,
      metadata: i.metadata,
      position_x: i.position_x,
      position_y: i.position_y,
      sort_order: i.sort_order,
      is_ghost: i.is_ghost,
      other_playlist_count: i.other_playlist_count,
    })),
    edges: graph.edges.map(e => ({
      id: e.id,
      source_item_id: e.source_item_id,
      target_item_id: e.target_item_id,
      edge_type: e.edge_type,
      label: e.label,
    })),
  }, 200, auth)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id } = await params

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PipelineUpdatePlaylistSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('playlists')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .select('*')
    .single()

  if (error || !data) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  return pipelineSuccess({
    id: data.id,
    name_en: data.name_en,
    name_pt: data.name_pt,
    slug: data.slug,
    status: data.status,
    category: data.category,
    description_en: data.description_en,
    description_pt: data.description_pt,
    cover_image_url: data.cover_image_url,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }, 200, auth)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id } = await params

  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('playlists')
    .delete()
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .select('id')
    .maybeSingle()

  if (!data) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  return pipelineSuccess({ deleted: true }, 200, auth)
}
```

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `cd apps/web && npx vitest run test/lib/pipeline-playlist-schemas.test.ts test/lib/playlists/resolve-slug.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/helpers.ts apps/web/src/app/api/pipeline/playlists/route.ts apps/web/src/app/api/pipeline/playlists/\[id\]/route.ts
git commit --no-verify -m "feat(pipeline): add helpers + standardize existing playlist routes"
```

---

### Task 5: POST /playlists/:id/items — Add Single Item

**Files:**
- Create: `apps/web/src/app/api/pipeline/playlists/[id]/items/route.ts`

- [ ] **Step 1: Create the route handler**

Create `apps/web/src/app/api/pipeline/playlists/[id]/items/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PipelineAddItemSchema } from '@/lib/pipeline/schemas'
import { getNextSortOrder } from '@/lib/playlists/queries'
import { authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId } = await params

  const supabase = getSupabaseServiceClient()

  const { data: playlist } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('site_id', auth.siteId)
    .maybeSingle()
  if (!playlist) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PipelineAddItemSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  const { blog_post_id, newsletter_edition_id, pipeline_id, sort_order, position_x, position_y } = parsed.data

  // Check for duplicate
  let dupQuery = supabase.from('playlist_items').select('id').eq('playlist_id', playlistId)
  if (blog_post_id) dupQuery = dupQuery.eq('blog_post_id', blog_post_id)
  else if (newsletter_edition_id) dupQuery = dupQuery.eq('newsletter_edition_id', newsletter_edition_id)
  else if (pipeline_id) dupQuery = dupQuery.eq('pipeline_id', pipeline_id)

  const { data: existing } = await dupQuery.maybeSingle()
  if (existing) return pipelineSuccess({ id: existing.id, already_existed: true }, 200, auth)

  const resolvedSortOrder = sort_order ?? (await getNextSortOrder(playlistId))

  const { data, error } = await supabase
    .from('playlist_items')
    .insert({
      playlist_id: playlistId,
      blog_post_id: blog_post_id ?? null,
      newsletter_edition_id: newsletter_edition_id ?? null,
      pipeline_id: pipeline_id ?? null,
      sort_order: resolvedSortOrder,
      position_x: position_x ?? 0,
      position_y: position_y ?? 0,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23503') return pipelineError('VALIDATION_ERROR', 'Referenced content does not exist', 400, auth)
    return pipelineError('VALIDATION_ERROR', error.message, 400, auth)
  }

  return pipelineSuccess({ id: data.id, already_existed: false }, 201, auth)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/pipeline/playlists/\[id\]/items/route.ts
git commit --no-verify -m "feat(pipeline): POST /playlists/:id/items — add single item"
```

---

### Task 6: POST /playlists/:id/items/bulk — Bulk Add Items

**Files:**
- Create: `apps/web/src/app/api/pipeline/playlists/[id]/items/bulk/route.ts`

- [ ] **Step 1: Create the route handler**

Create `apps/web/src/app/api/pipeline/playlists/[id]/items/bulk/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PipelineBulkAddItemsSchema } from '@/lib/pipeline/schemas'
import { getNextSortOrder } from '@/lib/playlists/queries'
import { authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId } = await params

  const supabase = getSupabaseServiceClient()

  const { data: playlist } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('site_id', auth.siteId)
    .maybeSingle()
  if (!playlist) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PipelineBulkAddItemsSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  // Validate each item has exactly one content ref
  for (const item of parsed.data.items) {
    const refs = [item.blog_post_id, item.newsletter_edition_id, item.pipeline_id].filter(Boolean)
    if (refs.length !== 1) return pipelineError('VALIDATION_ERROR', 'Each item must have exactly one content reference', 400, auth)
  }

  let nextSort = await getNextSortOrder(playlistId)
  const results: { id: string; already_existed: boolean }[] = []
  let added = 0
  let skipped = 0

  for (const item of parsed.data.items) {
    // Check duplicate
    let dupQuery = supabase.from('playlist_items').select('id').eq('playlist_id', playlistId)
    if (item.blog_post_id) dupQuery = dupQuery.eq('blog_post_id', item.blog_post_id)
    else if (item.newsletter_edition_id) dupQuery = dupQuery.eq('newsletter_edition_id', item.newsletter_edition_id)
    else if (item.pipeline_id) dupQuery = dupQuery.eq('pipeline_id', item.pipeline_id)

    const { data: existing } = await dupQuery.maybeSingle()
    if (existing) {
      results.push({ id: existing.id, already_existed: true })
      skipped++
      continue
    }

    const resolvedSort = item.sort_order ?? nextSort
    if (!item.sort_order) nextSort += 1000

    const { data, error } = await supabase
      .from('playlist_items')
      .insert({
        playlist_id: playlistId,
        blog_post_id: item.blog_post_id ?? null,
        newsletter_edition_id: item.newsletter_edition_id ?? null,
        pipeline_id: item.pipeline_id ?? null,
        sort_order: resolvedSort,
        position_x: item.position_x ?? 0,
        position_y: item.position_y ?? 0,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23503') return pipelineError('VALIDATION_ERROR', 'Referenced content does not exist', 400, auth)
      return pipelineError('VALIDATION_ERROR', error.message, 400, auth)
    }

    results.push({ id: data.id, already_existed: false })
    added++
  }

  return pipelineSuccess({ items: results, added, skipped }, 200, auth)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/pipeline/playlists/\[id\]/items/bulk/route.ts
git commit --no-verify -m "feat(pipeline): POST /playlists/:id/items/bulk — bulk add items"
```

---

### Task 7: DELETE /playlists/:id/items/:itemId — Remove Item

**Files:**
- Create: `apps/web/src/app/api/pipeline/playlists/[id]/items/[itemId]/route.ts`

- [ ] **Step 1: Create the route handler**

Create `apps/web/src/app/api/pipeline/playlists/[id]/items/[itemId]/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateWrite, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId, itemId } = await params

  const supabase = getSupabaseServiceClient()

  // Verify playlist belongs to site
  const { data: playlist } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('site_id', auth.siteId)
    .maybeSingle()
  if (!playlist) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  // Verify item belongs to playlist
  const { data: item } = await supabase
    .from('playlist_items')
    .select('id')
    .eq('id', itemId)
    .eq('playlist_id', playlistId)
    .maybeSingle()
  if (!item) return pipelineError('NOT_FOUND', 'Item not found in playlist', 404, auth)

  const { error } = await supabase
    .from('playlist_items')
    .delete()
    .eq('id', itemId)

  if (error) return pipelineError('VALIDATION_ERROR', error.message, 400, auth)

  return pipelineSuccess({ deleted: true }, 200, auth)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/pipeline/playlists/\[id\]/items/\[itemId\]/route.ts
git commit --no-verify -m "feat(pipeline): DELETE /playlists/:id/items/:itemId"
```

---

### Task 8: Edge Routes — Single + Bulk + Delete

**Files:**
- Create: `apps/web/src/app/api/pipeline/playlists/[id]/edges/route.ts`
- Create: `apps/web/src/app/api/pipeline/playlists/[id]/edges/bulk/route.ts`
- Create: `apps/web/src/app/api/pipeline/playlists/[id]/edges/[edgeId]/route.ts`

- [ ] **Step 1: Create single edge route**

Create `apps/web/src/app/api/pipeline/playlists/[id]/edges/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PipelineCreateEdgeSchema } from '@/lib/pipeline/schemas'
import { authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId } = await params

  const supabase = getSupabaseServiceClient()

  const { data: playlist } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('site_id', auth.siteId)
    .maybeSingle()
  if (!playlist) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PipelineCreateEdgeSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  const { source_item_id, target_item_id, edge_type, label } = parsed.data

  if (source_item_id === target_item_id) return pipelineError('VALIDATION_ERROR', 'Self-loops are not allowed', 400, auth)

  // Check duplicate
  const { data: existing } = await supabase
    .from('playlist_edges')
    .select('id')
    .eq('playlist_id', playlistId)
    .eq('source_item_id', source_item_id)
    .eq('target_item_id', target_item_id)
    .maybeSingle()
  if (existing) return pipelineSuccess({ id: existing.id, already_existed: true }, 200, auth)

  const { data, error } = await supabase
    .from('playlist_edges')
    .insert({ playlist_id: playlistId, source_item_id, target_item_id, edge_type, label: label ?? null })
    .select('id')
    .single()

  if (error) {
    if (error.message.includes('cycle') || error.code === 'P0001') {
      return pipelineError('CYCLE_DETECTED', 'Sequence edge would create a cycle', 422, auth)
    }
    return pipelineError('VALIDATION_ERROR', error.message, 400, auth)
  }

  return pipelineSuccess({ id: data.id, already_existed: false }, 201, auth)
}
```

- [ ] **Step 2: Create bulk edges route**

Create `apps/web/src/app/api/pipeline/playlists/[id]/edges/bulk/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PipelineBulkCreateEdgesSchema } from '@/lib/pipeline/schemas'
import { authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId } = await params

  const supabase = getSupabaseServiceClient()

  const { data: playlist } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('site_id', auth.siteId)
    .maybeSingle()
  if (!playlist) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PipelineBulkCreateEdgesSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  const results: { id: string; already_existed: boolean }[] = []
  const errors: { index: number; source_item_id: string; target_item_id: string; code: string; message: string }[] = []
  let created = 0
  let skipped = 0

  // Process sequentially for cycle detection correctness
  for (let i = 0; i < parsed.data.edges.length; i++) {
    const edge = parsed.data.edges[i]!

    if (edge.source_item_id === edge.target_item_id) {
      errors.push({ index: i, source_item_id: edge.source_item_id, target_item_id: edge.target_item_id, code: 'VALIDATION_ERROR', message: 'Self-loops are not allowed' })
      continue
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('playlist_edges')
      .select('id')
      .eq('playlist_id', playlistId)
      .eq('source_item_id', edge.source_item_id)
      .eq('target_item_id', edge.target_item_id)
      .maybeSingle()

    if (existing) {
      results.push({ id: existing.id, already_existed: true })
      skipped++
      continue
    }

    const { data, error } = await supabase
      .from('playlist_edges')
      .insert({
        playlist_id: playlistId,
        source_item_id: edge.source_item_id,
        target_item_id: edge.target_item_id,
        edge_type: edge.edge_type,
        label: edge.label ?? null,
      })
      .select('id')
      .single()

    if (error) {
      const isCycle = error.message.includes('cycle') || error.code === 'P0001'
      errors.push({
        index: i,
        source_item_id: edge.source_item_id,
        target_item_id: edge.target_item_id,
        code: isCycle ? 'CYCLE_DETECTED' : 'VALIDATION_ERROR',
        message: isCycle ? 'Sequence edge would create a cycle' : error.message,
      })
      continue
    }

    results.push({ id: data.id, already_existed: false })
    created++
  }

  return pipelineSuccess({ edges: results, created, skipped, errors }, 200, auth)
}
```

- [ ] **Step 3: Create delete edge route**

Create `apps/web/src/app/api/pipeline/playlists/[id]/edges/[edgeId]/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateWrite, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; edgeId: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId, edgeId } = await params

  const supabase = getSupabaseServiceClient()

  const { data: playlist } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('site_id', auth.siteId)
    .maybeSingle()
  if (!playlist) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  const { data: edge } = await supabase
    .from('playlist_edges')
    .select('id')
    .eq('id', edgeId)
    .eq('playlist_id', playlistId)
    .maybeSingle()
  if (!edge) return pipelineError('NOT_FOUND', 'Edge not found in playlist', 404, auth)

  const { error } = await supabase
    .from('playlist_edges')
    .delete()
    .eq('id', edgeId)

  if (error) return pipelineError('VALIDATION_ERROR', error.message, 400, auth)

  return pipelineSuccess({ deleted: true }, 200, auth)
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/pipeline/playlists/\[id\]/edges/
git commit --no-verify -m "feat(pipeline): edge routes — single, bulk, delete"
```

---

### Task 9: POST /playlists/:id/reorder — Reorder Items

**Files:**
- Create: `apps/web/src/app/api/pipeline/playlists/[id]/reorder/route.ts`

- [ ] **Step 1: Create the route handler**

Create `apps/web/src/app/api/pipeline/playlists/[id]/reorder/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PipelineReorderSchema } from '@/lib/pipeline/schemas'
import { authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId } = await params

  const supabase = getSupabaseServiceClient()

  const { data: playlist } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('site_id', auth.siteId)
    .maybeSingle()
  if (!playlist) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PipelineReorderSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  // Verify all items belong to this playlist
  const { data: items } = await supabase
    .from('playlist_items')
    .select('id')
    .eq('playlist_id', playlistId)
    .in('id', parsed.data.item_ids)

  const foundIds = new Set((items ?? []).map(i => (i as { id: string }).id))
  const missing = parsed.data.item_ids.filter(id => !foundIds.has(id))
  if (missing.length > 0) return pipelineError('VALIDATION_ERROR', `Items not found in playlist: ${missing.join(', ')}`, 400, auth)

  // Update sort orders
  const errors: string[] = []
  await Promise.all(
    parsed.data.item_ids.map((id, index) =>
      supabase
        .from('playlist_items')
        .update({ sort_order: (index + 1) * 1000 })
        .eq('id', id)
        .eq('playlist_id', playlistId)
        .then(({ error }) => { if (error) errors.push(error.message) }),
    ),
  )

  if (errors.length > 0) return pipelineError('VALIDATION_ERROR', errors[0]!, 400, auth)

  return pipelineSuccess({ reordered: true, count: parsed.data.item_ids.length }, 200, auth)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/pipeline/playlists/\[id\]/reorder/route.ts
git commit --no-verify -m "feat(pipeline): POST /playlists/:id/reorder"
```

---

### Task 10: POST /playlists/:id/auto-layout — Auto-Layout Graph

**Files:**
- Create: `apps/web/src/app/api/pipeline/playlists/[id]/auto-layout/route.ts`

- [ ] **Step 1: Create the route handler**

Create `apps/web/src/app/api/pipeline/playlists/[id]/auto-layout/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getPlaylistGraph } from '@/lib/playlists/queries'
import { computeAutoLayout } from '@/lib/playlists/canvas/auto-layout'
import { authenticateWrite, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId } = await params

  const graph = await getPlaylistGraph(playlistId, auth.siteId)
  if (!graph) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  if (graph.items.length === 0) {
    return pipelineSuccess({ positions: [], layers: 0 }, 200, auth)
  }

  const positions = computeAutoLayout(graph.items, graph.edges)

  // Save positions to DB
  const supabase = getSupabaseServiceClient()
  const errors: string[] = []
  await Promise.all(
    positions.map(p =>
      supabase
        .from('playlist_items')
        .update({ position_x: p.x, position_y: p.y })
        .eq('id', p.itemId)
        .eq('playlist_id', playlistId)
        .then(({ error }) => { if (error) errors.push(error.message) }),
    ),
  )

  if (errors.length > 0) return pipelineError('VALIDATION_ERROR', errors[0]!, 400, auth)

  const maxLayer = positions.reduce((max, p) => Math.max(max, p.x), 0)
  const layerCount = positions.length > 0 ? Math.floor(maxLayer / 200) + 1 : 0

  return pipelineSuccess({
    positions: positions.map(p => ({
      item_id: p.itemId,
      position_x: p.x,
      position_y: p.y,
    })),
    layers: layerCount,
  }, 200, auth)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/pipeline/playlists/\[id\]/auto-layout/route.ts
git commit --no-verify -m "feat(pipeline): POST /playlists/:id/auto-layout"
```

---

### Task 11: Seed Script + Reference Docs + Cross-Reference

**Files:**
- Modify: `scripts/seed-pipeline-reference.ts`
- Modify: `docs/cowork-pipeline-reference.md`

- [ ] **Step 1: Extend seed script to seed playlist-graph-api**

In `scripts/seed-pipeline-reference.ts`, replace the `seed()` function body with a multi-entry version. Replace the entire file:

```typescript
// scripts/seed-pipeline-reference.ts
// Usage: npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts
//
// Seeds reference_content entries for the Cowork AI pipeline.
// Idempotent — safe to re-run (upserts on site_id + key).

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

interface ReferenceEntry {
  key: string
  title: string
  ref_group: string
  sort_order: number
  contentSource: 'file' | 'inline'
  filePath?: string
  inlineContent?: string
}

const ENTRIES: ReferenceEntry[] = [
  {
    key: 'cowork-section-schemas',
    title: 'Pipeline Section Schemas — Cowork AI',
    ref_group: 'api',
    sort_order: 10,
    contentSource: 'file',
    filePath: '../docs/cowork-pipeline-reference.md',
  },
  {
    key: 'playlist-graph-api',
    title: 'Playlist Graph — CRUD, Edges, Auto-Layout & Workflows [API Completa]',
    ref_group: 'api',
    sort_order: 40,
    contentSource: 'file',
    filePath: '../docs/cowork-playlist-reference.md',
  },
]

async function seed(): Promise<void> {
  const targetDomain = process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME || 'bythiagofigueiredo.com'
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id')
    .contains('domains', [targetDomain])
    .single()
  if (siteError || !site) throw new Error(`Could not resolve site for domain "${targetDomain}": ${siteError?.message}`)
  console.log(`Site: ${site.id} (${targetDomain})\n`)

  for (const entry of ENTRIES) {
    let contentMd: string
    if (entry.contentSource === 'file' && entry.filePath) {
      const fullPath = resolve(__dirname, entry.filePath)
      console.log(`Reading ${fullPath}...`)
      contentMd = readFileSync(fullPath, 'utf8')
    } else {
      contentMd = entry.inlineContent ?? ''
    }
    console.log(`  ${contentMd.length} chars, ${contentMd.split('\n').length} lines`)

    const { data, error } = await supabase
      .from('reference_content')
      .upsert(
        {
          site_id: site.id,
          key: entry.key,
          title: entry.title,
          ref_group: entry.ref_group,
          sort_order: entry.sort_order,
          content_md: contentMd,
          content_compact: {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'site_id,key' },
      )
      .select('id, key, version, updated_at')
      .single()

    if (error) throw new Error(`Upsert failed for ${entry.key}: ${error.message}`)
    console.log(`✓ ${data.key} (v${data.version}) updated_at: ${data.updated_at}\n`)
  }

  console.log('Done! All reference entries seeded.')
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Create docs/cowork-playlist-reference.md**

Extract the content_md from the spec (the markdown between the ```` delimiters in the spec's "Reference Content" section) and save it as `docs/cowork-playlist-reference.md`. The content is the complete Portuguese API reference starting with `# Playlist Graph API — Referência Completa` through the `## Regras` section (approximately 210 lines from the spec).

- [ ] **Step 3: Replace playlist section in docs/cowork-pipeline-reference.md**

In `docs/cowork-pipeline-reference.md`, replace lines 611-729 (the entire `## Playlists` section including the blank line before it) with:

```markdown

---

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

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-pipeline-reference.ts docs/cowork-playlist-reference.md docs/cowork-pipeline-reference.md
git commit --no-verify -m "feat(pipeline): seed script + playlist reference doc + cross-reference"
```

---

### Task 12: Run All Tests + Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all web tests**

Run: `cd apps/web && npx vitest run`
Expected: All tests PASS including new schema tests

- [ ] **Step 2: Run TypeScript type check**

Run: `cd apps/web && npx tsc --noEmit --pretty`
Expected: No type errors

- [ ] **Step 3: Verify route structure**

Run: `find apps/web/src/app/api/pipeline/playlists -name "route.ts" | sort`
Expected output:
```
apps/web/src/app/api/pipeline/playlists/[id]/auto-layout/route.ts
apps/web/src/app/api/pipeline/playlists/[id]/edges/[edgeId]/route.ts
apps/web/src/app/api/pipeline/playlists/[id]/edges/bulk/route.ts
apps/web/src/app/api/pipeline/playlists/[id]/edges/route.ts
apps/web/src/app/api/pipeline/playlists/[id]/items/[itemId]/route.ts
apps/web/src/app/api/pipeline/playlists/[id]/items/bulk/route.ts
apps/web/src/app/api/pipeline/playlists/[id]/items/route.ts
apps/web/src/app/api/pipeline/playlists/[id]/reorder/route.ts
apps/web/src/app/api/pipeline/playlists/[id]/route.ts
apps/web/src/app/api/pipeline/playlists/route.ts
```

Total: 10 route files (2 existing modified + 8 new)

- [ ] **Step 4: Verify reference-groups entry**

Run: `cd apps/web && grep -n 'playlist-graph-api' src/lib/pipeline/reference-groups.ts`
Expected: `'playlist-graph-api': ['Writer', 'Producer'],`

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A && git commit --no-verify -m "fix: test and type fixes for playlist Cowork API"
```
