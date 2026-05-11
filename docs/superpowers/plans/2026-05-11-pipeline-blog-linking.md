# Pipeline ↔ Blog Post Linking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable bidirectional linking between pipeline items and blog posts with automatic status sync.

**Architecture:** Use the existing `content_pipeline.blog_post_id` FK as single source of truth. Add a partial unique index for 1:1 enforcement + reverse lookup performance. New link/unlink API endpoints, status sync helper called from blog `movePost()` / `bulkPublish()`, and UI on both pipeline detail sidebar and blog editor header.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL), Zod, React 19, Tailwind 4, Vitest

---

## File Structure

### New files (all under `apps/web/src/`)
| File | Responsibility |
|------|---------------|
| `lib/pipeline/blog-link.ts` | Reverse lookup helper, search helpers, link/unlink DB operations |
| `lib/pipeline/blog-sync.ts` | `syncPipelineOnPostStatusChange()` — unidirectional blog→pipeline stage sync |
| `app/api/pipeline/items/[id]/link/route.ts` | POST endpoint to link existing blog post |
| `app/api/pipeline/items/[id]/unlink/route.ts` | POST endpoint to unlink blog post |
| `app/cms/(authed)/pipeline/_components/detail/blog-post-card.tsx` | Sidebar card: linked/unlinked states, dropdown, unlink confirm |
| `app/cms/(authed)/pipeline/_components/detail/blog-post-search-dialog.tsx` | Search dialog for finding existing blog posts |
| `app/cms/(authed)/blog/[id]/edit/pipeline-pill.tsx` | Editor header pill: linked/unlinked states, popover, search |

### Migration
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260511300001_pipeline_blog_post_unique_idx.sql` | Partial unique index on `blog_post_id` |

### Modified files
| File | Change |
|------|--------|
| `app/api/pipeline/items/[id]/graduate/route.ts` | Copy title only (not body_content), handle `language:'both'` with 2 translations |
| `app/cms/(authed)/blog/actions.ts` | Add sync calls in `movePost()` and `bulkPublish()` |
| `app/cms/(authed)/blog/[id]/edit/actions.ts` | Add `linkToPipelineItem()`, `unlinkFromPipeline()`, `searchPipelineItems()` |
| `app/cms/(authed)/blog/[id]/edit/page.tsx` | Fetch pipeline item for post, pass as prop |
| `app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx` | Add `initialPipelineItem` prop, render PipelinePill |
| `app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx` | Add BlogPostCard to sidebar between Stage and Sections cards |
| `app/cms/(authed)/pipeline/_components/gem-card.tsx` | Enhance graduated badge with post status color |
| `app/cms/(authed)/pipeline/_components/pipeline-filter-bar.tsx` | Add "Vínculo" dropdown filter |
| `lib/pipeline/gem-design.ts` | No changes needed — `getCardState()` already handles `blog_post_id` |

---

## Task 1: Migration — Partial Unique Index

**Files:**
- Create: `supabase/migrations/20260511300001_pipeline_blog_post_unique_idx.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Enforce 1:1 between pipeline items and blog posts.
-- Also provides an index for O(1) reverse lookup (blog_post → pipeline item).
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_blog_post_id
  ON public.content_pipeline(blog_post_id)
  WHERE blog_post_id IS NOT NULL;
```

- [ ] **Step 2: Verify migration is syntactically valid**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx supabase migration list --local 2>&1 | tail -5`

Expected: the new migration appears in the list without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260511300001_pipeline_blog_post_unique_idx.sql
git commit -m "feat(pipeline): add partial unique index on blog_post_id for 1:1 enforcement"
```

---

## Task 2: Core Library — blog-link.ts

**Files:**
- Create: `apps/web/src/lib/pipeline/blog-link.ts`
- Test: `apps/web/test/unit/pipeline-blog-link.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/test/unit/pipeline-blog-link.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockMaybeSingle = vi.fn()
const mockSelect = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle })) }))
const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null }) })) })) })) }))
const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockFrom = vi.fn((table: string) => {
  if (table === 'content_pipeline') return { select: mockSelect, update: mockUpdate }
  if (table === 'content_pipeline_history') return { insert: mockInsert }
  return {}
})
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

import { getPipelineItemForPost, linkPostToItem, unlinkPostFromItem } from '@/lib/pipeline/blog-link'

describe('getPipelineItemForPost', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no pipeline item is linked', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    const result = await getPipelineItemForPost('post-1')
    expect(result).toBeNull()
  })

  it('returns pipeline item data when linked', async () => {
    const item = { id: 'item-1', code: 'blog-test', title_pt: 'Test', title_en: null, stage: 'draft', format: 'blog_post', priority: 3 }
    mockMaybeSingle.mockResolvedValue({ data: item, error: null })
    const result = await getPipelineItemForPost('post-1')
    expect(result).toEqual(item)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/unit/pipeline-blog-link.test.ts 2>&1 | tail -10`

Expected: FAIL — module `@/lib/pipeline/blog-link` not found.

- [ ] **Step 3: Implement blog-link.ts**

```typescript
// apps/web/src/lib/pipeline/blog-link.ts
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export interface LinkedPipelineItem {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  stage: string
  format: string
  priority: number
}

export async function getPipelineItemForPost(postId: string): Promise<LinkedPipelineItem | null> {
  const svc = getSupabaseServiceClient()
  const { data } = await svc
    .from('content_pipeline')
    .select('id, code, title_pt, title_en, stage, format, priority')
    .eq('blog_post_id', postId)
    .maybeSingle()
  return data as LinkedPipelineItem | null
}

export async function linkPostToItem(
  itemId: string,
  postId: string,
  siteId: string,
  userId: string | null,
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const svc = getSupabaseServiceClient()

  // Validate item belongs to site and has no existing link
  const { data: item, error: fetchErr } = await svc
    .from('content_pipeline')
    .select('id, blog_post_id, code')
    .eq('id', itemId)
    .eq('site_id', siteId)
    .single()

  if (fetchErr || !item) return { ok: false, error: 'Pipeline item not found', code: 'NOT_FOUND' }
  if (item.blog_post_id) return { ok: false, error: 'Item already linked to a blog post', code: 'ALREADY_LINKED' }

  // Validate post belongs to site
  const { data: post, error: postErr } = await svc
    .from('blog_posts')
    .select('id, site_id, status')
    .eq('id', postId)
    .single()

  if (postErr || !post) return { ok: false, error: 'Blog post not found', code: 'NOT_FOUND' }
  if (post.site_id !== siteId) return { ok: false, error: 'Blog post belongs to a different site', code: 'FORBIDDEN' }

  // Set link (UNIQUE index will reject if post already linked to another item)
  const { error: updateErr } = await svc
    .from('content_pipeline')
    .update({ blog_post_id: postId })
    .eq('id', itemId)

  if (updateErr) {
    if (updateErr.code === '23505') {
      // Find which item already has this post
      const { data: existing } = await svc
        .from('content_pipeline')
        .select('code')
        .eq('blog_post_id', postId)
        .maybeSingle()
      return { ok: false, error: `Post already linked to item ${existing?.code ?? 'unknown'}`, code: 'DUPLICATE' }
    }
    return { ok: false, error: updateErr.message }
  }

  await svc.from('content_pipeline_history').insert({
    pipeline_id: itemId,
    event_type: 'linked',
    to_value: postId,
    changed_by: userId,
  })

  return { ok: true }
}

export async function unlinkPostFromItem(
  itemId: string,
  siteId: string,
  userId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const svc = getSupabaseServiceClient()

  const { data: item } = await svc
    .from('content_pipeline')
    .select('id, blog_post_id')
    .eq('id', itemId)
    .eq('site_id', siteId)
    .single()

  if (!item) return { ok: false, error: 'Pipeline item not found' }
  if (!item.blog_post_id) return { ok: true } // idempotent

  const previousPostId = item.blog_post_id

  await svc
    .from('content_pipeline')
    .update({ blog_post_id: null })
    .eq('id', itemId)

  await svc.from('content_pipeline_history').insert({
    pipeline_id: itemId,
    event_type: 'unlinked',
    from_value: previousPostId,
    changed_by: userId,
  })

  return { ok: true }
}

export async function searchBlogPostsForLink(
  siteId: string,
  query: string,
): Promise<Array<{
  id: string
  title: string
  locale: string
  status: string
  linked_to_code: string | null
}>> {
  const svc = getSupabaseServiceClient()

  const { data: translations } = await svc
    .from('blog_translations')
    .select('post_id, title, locale, blog_posts!inner(id, site_id, status)')
    .eq('blog_posts.site_id', siteId)
    .ilike('title', `%${query}%`)
    .limit(10)

  if (!translations) return []

  // Check which posts are already linked to pipeline items
  const postIds = translations.map((t: any) => t.post_id)
  const { data: linkedItems } = await svc
    .from('content_pipeline')
    .select('blog_post_id, code')
    .in('blog_post_id', postIds)

  const linkMap = new Map((linkedItems ?? []).map((l: any) => [l.blog_post_id, l.code]))

  return translations.map((t: any) => ({
    id: t.post_id as string,
    title: t.title as string,
    locale: t.locale as string,
    status: (t.blog_posts as any)?.status as string ?? 'draft',
    linked_to_code: linkMap.get(t.post_id as string) ?? null,
  }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/unit/pipeline-blog-link.test.ts 2>&1 | tail -10`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/blog-link.ts apps/web/test/unit/pipeline-blog-link.test.ts
git commit -m "feat(pipeline): add blog-link helpers — reverse lookup, link, unlink, search"
```

---

## Task 3: Core Library — blog-sync.ts

**Files:**
- Create: `apps/web/src/lib/pipeline/blog-sync.ts`
- Test: `apps/web/test/unit/pipeline-blog-sync.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/test/unit/pipeline-blog-sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockMaybeSingle = vi.fn()
const mockUpdate = vi.fn()
const mockInsert = vi.fn().mockResolvedValue({ error: null })

const chainedUpdate = {
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue(mockUpdate),
  }),
}

const chainedSelect = {
  eq: vi.fn().mockReturnValue({
    maybeSingle: mockMaybeSingle,
  }),
}

const chainedHistorySelect = {
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    }),
  }),
}

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

import { syncPipelineOnPostStatusChange } from '@/lib/pipeline/blog-sync'

describe('syncPipelineOnPostStatusChange', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does nothing when no pipeline item is linked', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    })
    await syncPipelineOnPostStatusChange('post-1', 'published', 'draft')
    expect(mockFrom).toHaveBeenCalledTimes(1) // only the lookup
  })

  it('advances pipeline item to published when post is published', async () => {
    const lookupChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'item-1', stage: 'ready', version: 5 },
          }),
        }),
      }),
    }
    const updateChain = {
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }
    const insertChain = { insert: vi.fn().mockResolvedValue({ error: null }) }

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return lookupChain
      if (callCount === 2) return updateChain
      return insertChain
    })

    await syncPipelineOnPostStatusChange('post-1', 'published', 'draft')
    expect(updateChain.update).toHaveBeenCalledWith({ stage: 'published', version: 6 })
  })

  it('does not advance if pipeline item already at published', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'item-1', stage: 'published', version: 5 },
          }),
        }),
      }),
    })
    await syncPipelineOnPostStatusChange('post-1', 'published', 'draft')
    expect(mockFrom).toHaveBeenCalledTimes(1) // only lookup, no update
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/unit/pipeline-blog-sync.test.ts 2>&1 | tail -10`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement blog-sync.ts**

```typescript
// apps/web/src/lib/pipeline/blog-sync.ts
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function syncPipelineOnPostStatusChange(
  postId: string,
  newStatus: string,
  oldStatus: string,
): Promise<void> {
  const svc = getSupabaseServiceClient()

  const { data: item } = await svc
    .from('content_pipeline')
    .select('id, stage, version')
    .eq('blog_post_id', postId)
    .maybeSingle()

  if (!item) return

  // Publish: advance pipeline item to 'published'
  if (newStatus === 'published' && item.stage !== 'published') {
    const { error } = await svc
      .from('content_pipeline')
      .update({ stage: 'published', version: item.version + 1 })
      .eq('id', item.id)
      .eq('version', item.version)

    if (error) {
      console.error('[blog-sync] Failed to advance pipeline item', item.id, error)
      return
    }

    await svc.from('content_pipeline_history').insert({
      pipeline_id: item.id,
      event_type: 'stage_changed',
      from_value: item.stage,
      to_value: 'published',
      changed_by: null,
    })
    return
  }

  // Unpublish: retreat pipeline item to previous stage
  if (oldStatus === 'published' && newStatus !== 'published') {
    const { data: hist } = await svc
      .from('content_pipeline_history')
      .select('from_value')
      .eq('pipeline_id', item.id)
      .eq('event_type', 'stage_changed')
      .eq('to_value', 'published')
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const retreatTo = (hist?.from_value as string) || 'ready'

    const { error } = await svc
      .from('content_pipeline')
      .update({ stage: retreatTo, version: item.version + 1 })
      .eq('id', item.id)
      .eq('version', item.version)

    if (error) {
      console.error('[blog-sync] Failed to retreat pipeline item', item.id, error)
      return
    }

    await svc.from('content_pipeline_history').insert({
      pipeline_id: item.id,
      event_type: 'stage_changed',
      from_value: 'published',
      to_value: retreatTo,
      changed_by: null,
    })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/unit/pipeline-blog-sync.test.ts 2>&1 | tail -10`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/blog-sync.ts apps/web/test/unit/pipeline-blog-sync.test.ts
git commit -m "feat(pipeline): add blog-sync — unidirectional status sync blog→pipeline"
```

---

## Task 4: API Endpoints — link & unlink

**Files:**
- Create: `apps/web/src/app/api/pipeline/items/[id]/link/route.ts`
- Create: `apps/web/src/app/api/pipeline/items/[id]/unlink/route.ts`

- [ ] **Step 1: Create link endpoint**

```typescript
// apps/web/src/app/api/pipeline/items/[id]/link/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { linkPostToItem } from '@/lib/pipeline/blog-link'
import { syncPipelineOnPostStatusChange } from '@/lib/pipeline/blog-sync'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

const LinkSchema = z.object({
  blog_post_id: z.string().uuid(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID format' } }, { status: 400 })
  }

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = LinkSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 })

  const result = await linkPostToItem(id, parsed.data.blog_post_id, auth.siteId, null)

  if (!result.ok) {
    const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : result.code === 'DUPLICATE' || result.code === 'ALREADY_LINKED' ? 409 : 400
    return NextResponse.json({ error: { code: result.code ?? 'LINK_FAILED', message: result.error } }, { status })
  }

  // If post is already published, trigger immediate sync
  const supabase = getSupabaseServiceClient()
  const { data: post } = await supabase.from('blog_posts').select('status').eq('id', parsed.data.blog_post_id).maybeSingle()
  if (post?.status === 'published') {
    await syncPipelineOnPostStatusChange(parsed.data.blog_post_id, 'published', 'draft')
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: { linked: true, blog_post_id: parsed.data.blog_post_id } }, { headers })
}
```

- [ ] **Step 2: Create unlink endpoint**

```typescript
// apps/web/src/app/api/pipeline/items/[id]/unlink/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { unlinkPostFromItem } from '@/lib/pipeline/blog-link'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID format' } }, { status: 400 })
  }

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const result = await unlinkPostFromItem(id, auth.siteId, null)
  if (!result.ok) return NextResponse.json({ error: { code: 'UNLINK_FAILED', message: result.error } }, { status: 400 })

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: { unlinked: true } }, { headers })
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | tail -10`

Expected: no errors related to new files.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/pipeline/items/\[id\]/link/route.ts apps/web/src/app/api/pipeline/items/\[id\]/unlink/route.ts
git commit -m "feat(pipeline): add POST /items/[id]/link and /unlink API endpoints"
```

---

## Task 5: Modify Graduate Endpoint — Title Only + Both Locales

**Files:**
- Modify: `apps/web/src/app/api/pipeline/items/[id]/graduate/route.ts`

- [ ] **Step 1: Update graduate route to copy title only and handle both locales**

In `apps/web/src/app/api/pipeline/items/[id]/graduate/route.ts`, replace lines 48-81 (the `if (target === 'blog_post')` block):

Replace:
```typescript
  if (target === 'blog_post') {
    if (!item.created_by) return NextResponse.json({ error: { code: 'INVALID_OPERATION', message: 'Item has no creator — cannot resolve author' } }, { status: 422 })
    const { data: author } = await supabase
      .from('authors')
      .select('id')
      .eq('user_id', item.created_by)
      .single()
    if (!author) return NextResponse.json({ error: { code: 'INVALID_OPERATION', message: 'No author profile found for this user' } }, { status: 422 })

    const locale = item.language === 'en' ? 'en' : 'pt-br'
    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert({
        site_id: auth.siteId,
        author_id: author.id,
        status: 'draft',
        category: 'building',
        locale,
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })

    const slug = (item.code || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).slice(0, 200)
    await supabase.from('blog_translations').insert({
      post_id: post.id,
      locale,
      title,
      slug,
      content_mdx: item.body_content || '',
    })

    entityId = post.id
    fkField = 'blog_post_id'
```

With:
```typescript
  if (target === 'blog_post') {
    if (!item.created_by) return NextResponse.json({ error: { code: 'INVALID_OPERATION', message: 'Item has no creator — cannot resolve author' } }, { status: 422 })
    const { data: author } = await supabase
      .from('authors')
      .select('id')
      .eq('user_id', item.created_by)
      .single()
    if (!author) return NextResponse.json({ error: { code: 'INVALID_OPERATION', message: 'No author profile found for this user' } }, { status: 422 })

    const primaryLocale = item.language === 'en' ? 'en' : 'pt-br'
    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert({
        site_id: auth.siteId,
        author_id: author.id,
        status: 'draft',
        category: 'building',
        locale: primaryLocale,
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })

    const makeSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200)
    const translations: Array<{ post_id: string; locale: string; title: string; slug: string; content_mdx: string }> = []

    if (item.language === 'both') {
      if (item.title_pt) translations.push({ post_id: post.id, locale: 'pt-br', title: item.title_pt, slug: makeSlug(item.title_pt), content_mdx: '' })
      if (item.title_en) translations.push({ post_id: post.id, locale: 'en', title: item.title_en, slug: makeSlug(item.title_en), content_mdx: '' })
    } else {
      translations.push({ post_id: post.id, locale: primaryLocale, title, slug: makeSlug(title), content_mdx: '' })
    }

    if (translations.length > 0) {
      await supabase.from('blog_translations').insert(translations)
    }

    entityId = post.id
    fkField = 'blog_post_id'
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -i error | head -5`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/pipeline/items/\[id\]/graduate/route.ts
git commit -m "fix(pipeline): graduate copies title only, handles both locales"
```

---

## Task 6: Blog Status Sync Integration — movePost + bulkPublish

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/actions.ts`

- [ ] **Step 1: Add sync import and call in movePost()**

In `apps/web/src/app/cms/(authed)/blog/actions.ts`, add the import after line 11:

```typescript
import { syncPipelineOnPostStatusChange } from '@/lib/pipeline/blog-sync'
```

Then in `movePost()`, after line 540 (`revalidateBlogHub(siteId)`), add:

```typescript
  // Sync pipeline item stage (fire-and-forget, never blocks blog operations)
  syncPipelineOnPostStatusChange(postId, newStatus, current.status as string).catch(() => {})
```

- [ ] **Step 2: Add sync call in bulkPublish()**

In `bulkPublish()`, after line 49 (`revalidatePath('/cms/blog')`), add:

```typescript
  // Sync pipeline items for all published posts (fire-and-forget)
  for (const post of published) {
    syncPipelineOnPostStatusChange(post.id, 'published', 'draft').catch(() => {})
  }
```

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web 2>&1 | tail -15`

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/actions.ts
git commit -m "feat(pipeline): sync pipeline stage on blog post publish/unpublish"
```

---

## Task 7: Blog Editor Server Actions — linkToPipelineItem, unlinkFromPipeline, searchPipelineItems

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts`

- [ ] **Step 1: Add new server actions at end of file**

Append to `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts`:

```typescript
// ─── Pipeline Linking ────────────────────────────────────────────────────────

export async function linkToPipelineItem(
  postId: string,
  pipelineItemId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireSiteAdminForRow('blog_posts', postId)

  const { linkPostToItem } = await import('@/lib/pipeline/blog-link')
  const { syncPipelineOnPostStatusChange } = await import('@/lib/pipeline/blog-sync')

  const result = await linkPostToItem(pipelineItemId, postId, siteId, null)
  if (!result.ok) return { ok: false, error: result.error }

  // If this post is already published, sync pipeline immediately
  const svc = getSupabaseServiceClient()
  const { data: post } = await svc.from('blog_posts').select('status').eq('id', postId).maybeSingle()
  if (post?.status === 'published') {
    await syncPipelineOnPostStatusChange(postId, 'published', 'draft').catch(() => {})
  }

  return { ok: true }
}

export async function unlinkFromPipeline(
  postId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireSiteAdminForRow('blog_posts', postId)

  const { getPipelineItemForPost, unlinkPostFromItem } = await import('@/lib/pipeline/blog-link')
  const item = await getPipelineItemForPost(postId)
  if (!item) return { ok: true } // idempotent

  return await unlinkPostFromItem(item.id, siteId, null)
}

export async function searchPipelineItems(
  siteId: string,
  query: string,
): Promise<Array<{ id: string; code: string; title: string; format: string; stage: string; blog_post_id: string | null }>> {
  const svc = getSupabaseServiceClient()
  const { data } = await svc
    .from('content_pipeline')
    .select('id, code, title_pt, title_en, format, stage, blog_post_id')
    .eq('site_id', siteId)
    .eq('is_archived', false)
    .or(`title_pt.ilike.%${query}%,title_en.ilike.%${query}%,code.ilike.%${query}%`)
    .limit(10)

  return (data ?? []).map((item: any) => ({
    id: item.id as string,
    code: item.code as string,
    title: (item.title_pt || item.title_en || 'Untitled') as string,
    format: item.format as string,
    stage: item.stage as string,
    blog_post_id: item.blog_post_id as string | null,
  }))
}
```

Note: Uses dynamic `import()` for pipeline modules to avoid making blog always import pipeline code at module level.

- [ ] **Step 2: Add missing import for getSiteContext**

Verify `getSiteContext` is already imported (it's imported on line 7). If not, add it. Also verify `getSupabaseServiceClient` is imported (line 8). Both should already exist.

- [ ] **Step 3: Verify typecheck**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -i error | head -5`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/\[id\]/edit/actions.ts
git commit -m "feat(blog): add linkToPipelineItem, unlinkFromPipeline, searchPipelineItems actions"
```

---

## Task 8: Blog Editor Page — Fetch Pipeline Item + Pass Prop

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/page.tsx`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx`

- [ ] **Step 1: Update page.tsx to fetch pipeline item**

In `apps/web/src/app/cms/(authed)/blog/[id]/edit/page.tsx`, add import after line 4:

```typescript
import { getPipelineItemForPost, type LinkedPipelineItem } from '@/lib/pipeline/blog-link'
```

Then add the pipeline fetch to the Promise.all. Replace lines 24-50 (the Promise.all block):

```typescript
  const supabase = getSupabaseServiceClient()
  const [tagsResult, siteResult, hashtagResult, txExtraResult, postExtraResult, pipelineItem] = await Promise.all([
    supabase
      .from('blog_tags')
      .select('id, name, color, name_translations')
      .eq('site_id', ctx.siteId)
      .order('sort_order'),
    supabase
      .from('sites')
      .select('supported_locales')
      .eq('id', ctx.siteId)
      .single(),
    supabase
      .from('post_hashtags')
      .select('hashtags(id, name, slug)')
      .eq('post_id', id),
    supabase
      .from('blog_translations')
      .select('key_points, pull_quote, notes, colophon, content_json, content_html')
      .eq('post_id', id)
      .eq('locale', tx.locale)
      .maybeSingle(),
    supabase
      .from('blog_posts')
      .select('previous_post_id, continues_in_next, status, tag_id')
      .eq('id', id)
      .maybeSingle(),
    getPipelineItemForPost(id),
  ])
```

Then add the prop to PostEditionEditor. After line 93 (`existingLocales={existingLocales}`), add:

```typescript
      initialPipelineItem={pipelineItem}
```

- [ ] **Step 2: Update edit-post-client.tsx props**

In `apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx`, add to the EditPostClientProps interface (after `initialHashtags`):

```typescript
  initialPipelineItem: { id: string; code: string; title_pt: string | null; title_en: string | null; stage: string; format: string; priority: number } | null
```

Then add to the component destructuring and render the PipelinePill. Add import at top:

```typescript
import { PipelinePill } from './pipeline-pill'
```

Add the PipelinePill render at the top of the return fragment (before the cover gallery button):

```typescript
      <PipelinePill
        postId={postId}
        siteId={siteId}
        initialItem={initialPipelineItem}
      />
```

- [ ] **Step 3: Verify typecheck (will fail — PipelinePill not created yet, that's Task 11)**

This is expected. The component will be created in Task 11. For now, just ensure the props and wiring are correct.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/\[id\]/edit/page.tsx apps/web/src/app/cms/\(authed\)/blog/\[id\]/edit/edit-post-client.tsx
git commit -m "feat(blog): wire pipeline item data into editor page and client props"
```

---

## Task 9: UI — Pipeline Sidebar BlogPostCard

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/blog-post-card.tsx`

- [ ] **Step 1: Create the BlogPostCard component**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/blog-post-card.tsx
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface BlogPostInfo {
  id: string
  title: string
  status: string
  locales: string[]
}

interface Props {
  itemId: string
  itemVersion: number
  siteId: string
  linkedPost: BlogPostInfo | null
  onGraduate: () => Promise<void>
  onShowSearch: () => void
}

export function BlogPostCard({ itemId, itemVersion, siteId, linkedPost, onGraduate, onShowSearch }: Props) {
  const router = useRouter()
  const [isGraduating, setIsGraduating] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const handleGraduate = useCallback(async () => {
    setIsGraduating(true)
    try {
      await onGraduate()
      toast.success('Blog post criado', {
        action: { label: 'Abrir editor →', onClick: () => {} },
      })
      router.refresh()
    } catch {
      toast.error('Erro ao criar blog post')
    } finally {
      setIsGraduating(false)
    }
  }, [onGraduate, router])

  const handleUnlink = useCallback(async () => {
    setIsUnlinking(true)
    try {
      const res = await fetch(`/api/pipeline/items/${itemId}/unlink`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success('Post desvinculado')
      router.refresh()
    } catch {
      toast.error('Erro ao desvincular')
    } finally {
      setIsUnlinking(false)
      setShowConfirm(false)
    }
  }, [itemId, router])

  const isPublished = linkedPost?.status === 'published'

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--gem-surface)',
        borderColor: 'var(--gem-border)',
        borderLeftColor: isPublished ? '#10b981' : undefined,
        borderLeftWidth: isPublished ? 3 : undefined,
      }}
    >
      <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--gem-text)' }}>Blog Post</h3>

      {linkedPost ? (
        <div>
          <p className="text-xs font-medium truncate" style={{ color: 'var(--gem-text)' }}>{linkedPost.title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {linkedPost.locales.map(l => (
              <span key={l} className="text-[10px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-300">{l.toUpperCase()}</span>
            ))}
            <span
              className="text-[10px] px-1 py-0.5 rounded font-medium"
              style={{
                backgroundColor: isPublished ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                color: isPublished ? '#10b981' : '#f59e0b',
              }}
            >
              {linkedPost.status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <a
              href={`/cms/blog/${linkedPost.id}/edit`}
              target="_blank"
              rel="noopener"
              className="text-xs px-2 py-1 rounded transition-colors hover:bg-white/5"
              style={{ color: 'var(--gem-accent)' }}
            >
              Abrir editor →
            </a>
            <div className="relative ml-auto">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="text-xs px-1.5 py-0.5 rounded hover:bg-white/5"
                style={{ color: 'var(--gem-dim)' }}
              >
                ···
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-lg border p-1 z-50 min-w-28 shadow-lg"
                  style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                >
                  <button
                    onClick={() => { setShowMenu(false); setShowConfirm(true) }}
                    className="w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-red-500/10 transition-colors"
                    style={{ color: '#ef4444' }}
                  >
                    Desvincular
                  </button>
                </div>
              )}
            </div>
          </div>
          {showConfirm && (
            <div className="mt-2 p-2 rounded border" style={{ borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)' }}>
              <p className="text-[11px] mb-2" style={{ color: 'var(--gem-muted)' }}>
                Desvincular &ldquo;{linkedPost.title}&rdquo;? O post continuará existindo independentemente.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="text-xs px-2 py-1 rounded border"
                  style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-muted)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUnlink}
                  disabled={isUnlinking}
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: '#ef4444', color: 'white', opacity: isUnlinking ? 0.5 : 1 }}
                >
                  {isUnlinking ? 'Desvinculando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p className="text-[11px] mb-2" style={{ color: 'var(--gem-dim)' }}>Nenhum post vinculado</p>
          <div className="flex gap-2">
            <button
              onClick={handleGraduate}
              disabled={isGraduating}
              className="text-xs px-2.5 py-1.5 rounded transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--gem-done)', color: 'white', opacity: isGraduating ? 0.5 : 1 }}
            >
              {isGraduating ? 'Criando...' : 'Criar novo post'}
            </button>
            <button
              onClick={onShowSearch}
              className="text-xs px-2.5 py-1.5 rounded border transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-muted)' }}
            >
              Buscar existente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/blog-post-card.tsx
git commit -m "feat(pipeline): add BlogPostCard sidebar component"
```

---

## Task 10: UI — Pipeline BlogPostSearchDialog

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/blog-post-search-dialog.tsx`

- [ ] **Step 1: Create the search dialog**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/blog-post-search-dialog.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface SearchResult {
  id: string
  title: string
  locale: string
  status: string
  linked_to_code: string | null
}

interface Props {
  itemId: string
  siteId: string
  open: boolean
  onClose: () => void
}

export function BlogPostSearchDialog({ itemId, siteId, open, onClose }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const [focused, setFocused] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setFocused(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const { searchBlogPostsForLink } = await import('@/lib/pipeline/blog-link')
        const data = await searchBlogPostsForLink(siteId, query.trim())
        setResults(data)
        setFocused(0)
      } finally {
        setIsSearching(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, siteId])

  async function handleSelect(postId: string) {
    setIsLinking(true)
    try {
      const res = await fetch(`/api/pipeline/items/${itemId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blog_post_id: postId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error?.message ?? 'Erro ao vincular')
        return
      }
      toast.success('Post vinculado')
      router.refresh()
      onClose()
    } finally {
      setIsLinking(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const linkable = results.filter(r => !r.linked_to_code)
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, linkable.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
    if (e.key === 'Enter' && linkable[focused]) { e.preventDefault(); handleSelect(linkable[focused].id) }
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-md rounded-lg border shadow-2xl"
        style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="p-3 border-b" style={{ borderColor: 'var(--gem-border)' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por título..."
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: 'var(--gem-text)' }}
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {isSearching && <p className="text-xs p-3 text-center" style={{ color: 'var(--gem-dim)' }}>Buscando...</p>}
          {!isSearching && query && results.length === 0 && (
            <p className="text-xs p-3 text-center" style={{ color: 'var(--gem-dim)' }}>Nenhum post encontrado</p>
          )}
          {results.map((r, i) => {
            const isDisabled = !!r.linked_to_code
            const linkableIndex = results.filter((x, xi) => xi < i && !x.linked_to_code).length
            return (
              <button
                key={r.id}
                disabled={isDisabled || isLinking}
                onClick={() => handleSelect(r.id)}
                className="w-full text-left px-3 py-2 rounded text-xs transition-colors"
                style={{
                  backgroundColor: !isDisabled && linkableIndex === focused ? 'rgba(99,102,241,0.1)' : 'transparent',
                  opacity: isDisabled ? 0.4 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  color: 'var(--gem-text)',
                }}
                title={isDisabled ? `Vinculado a ${r.linked_to_code}` : undefined}
              >
                <span className="font-medium">{r.title}</span>
                <span className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-300">{r.locale.toUpperCase()}</span>
                  <span
                    className="text-[10px] px-1 py-0.5 rounded font-medium"
                    style={{
                      backgroundColor: r.status === 'published' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: r.status === 'published' ? '#10b981' : '#f59e0b',
                    }}
                  >
                    {r.status}
                  </span>
                  {isDisabled && <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>→ {r.linked_to_code}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/blog-post-search-dialog.tsx
git commit -m "feat(pipeline): add BlogPostSearchDialog for linking existing posts"
```

---

## Task 11: UI — Blog Editor PipelinePill

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/[id]/edit/pipeline-pill.tsx`

- [ ] **Step 1: Create the PipelinePill component**

```typescript
// apps/web/src/app/cms/(authed)/blog/[id]/edit/pipeline-pill.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { linkToPipelineItem, unlinkFromPipeline, searchPipelineItems } from './actions'

interface PipelineItemInfo {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  stage: string
  format: string
  priority: number
}

interface SearchResult {
  id: string
  code: string
  title: string
  format: string
  stage: string
  blog_post_id: string | null
}

interface Props {
  postId: string
  siteId: string
  initialItem: PipelineItemInfo | null
}

const STAGE_COLORS: Record<string, string> = {
  idea: '#6366f1',
  draft: '#a855f7',
  ready: '#06b6d4',
  scheduled: '#14b8a6',
  published: '#10b981',
}

export function PipelinePill({ postId, siteId, initialItem }: Props) {
  const router = useRouter()
  const [item, setItem] = useState<PipelineItemInfo | null>(initialItem)
  const [showSearch, setShowSearch] = useState(false)
  const [showPopover, setShowPopover] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLinking, setIsLinking] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const pillRef = useRef<HTMLDivElement>(null)

  useEffect(() => setItem(initialItem), [initialItem])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) {
        setShowPopover(false)
        setShowSearch(false)
        setShowConfirm(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const data = await searchPipelineItems(siteId, query.trim())
      setResults(data)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, siteId])

  const handleLink = useCallback(async (pipelineItemId: string) => {
    setIsLinking(true)
    const result = await linkToPipelineItem(postId, pipelineItemId)
    if (!result.ok) {
      toast.error(result.error)
    } else {
      toast.success('Vinculado ao pipeline')
      setShowSearch(false)
      router.refresh()
    }
    setIsLinking(false)
  }, [postId, router])

  const handleUnlink = useCallback(async () => {
    const result = await unlinkFromPipeline(postId)
    if (!result.ok) {
      toast.error(result.error)
    } else {
      setItem(null)
      setShowPopover(false)
      setShowConfirm(false)
      toast.success('Desvinculado do pipeline')
    }
  }, [postId])

  const stageColor = item ? (STAGE_COLORS[item.stage] ?? 'var(--gem-dim)') : undefined
  const title = item ? (item.title_pt || item.title_en || 'Untitled') : null

  return (
    <div ref={pillRef} className="relative inline-block mb-2">
      {item ? (
        <button
          onClick={() => setShowPopover(!showPopover)}
          className="text-xs px-2.5 py-1 rounded-full border transition-colors hover:bg-white/5"
          style={{ borderColor: stageColor, color: stageColor }}
        >
          {item.code} · {item.stage}
        </button>
      ) : (
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="text-xs px-2.5 py-1 rounded-full border border-dashed transition-colors hover:bg-white/5"
          style={{ borderColor: 'var(--gem-border, #374151)', color: 'var(--gem-dim, #6b7280)' }}
        >
          + Pipeline
        </button>
      )}

      {/* Popover for linked item */}
      {showPopover && item && (
        <div
          className="absolute left-0 top-full mt-1 w-64 rounded-lg border p-3 z-50 shadow-lg"
          style={{ backgroundColor: 'var(--gem-surface, #1e1e2e)', borderColor: 'var(--gem-border, #374151)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--gem-text, #e5e7eb)' }}>{title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: `${stageColor}20`, color: stageColor }}>{item.stage}</span>
            <span className="text-[10px]" style={{ color: 'var(--gem-dim, #6b7280)' }}>P{item.priority}</span>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--gem-border, #374151)' }}>
            <a
              href={`/cms/pipeline/${item.id}`}
              target="_blank"
              rel="noopener"
              className="text-xs"
              style={{ color: 'var(--gem-accent, #6366f1)' }}
            >
              Abrir pipeline →
            </a>
            {showConfirm ? (
              <div className="ml-auto flex gap-1">
                <button onClick={() => setShowConfirm(false)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--gem-dim)' }}>Não</button>
                <button onClick={handleUnlink} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#ef4444' }}>Sim, desvincular</button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="text-xs ml-auto"
                style={{ color: '#ef4444' }}
              >
                Desvincular
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search dialog for unlinked */}
      {showSearch && !item && (
        <div
          className="absolute left-0 top-full mt-1 w-80 rounded-lg border shadow-lg z-50"
          style={{ backgroundColor: 'var(--gem-surface, #1e1e2e)', borderColor: 'var(--gem-border, #374151)' }}
        >
          <div className="p-2 border-b" style={{ borderColor: 'var(--gem-border, #374151)' }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por código ou título..."
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: 'var(--gem-text, #e5e7eb)' }}
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {results.length === 0 && query && (
              <p className="text-[11px] p-2 text-center" style={{ color: 'var(--gem-dim, #6b7280)' }}>Nenhum item encontrado</p>
            )}
            {results.map(r => {
              const isDisabled = !!r.blog_post_id
              return (
                <button
                  key={r.id}
                  disabled={isDisabled || isLinking}
                  onClick={() => handleLink(r.id)}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors hover:bg-white/5"
                  style={{ opacity: isDisabled ? 0.4 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer', color: 'var(--gem-text, #e5e7eb)' }}
                  title={isDisabled ? 'Já vinculado a outro post' : undefined}
                >
                  <span className="font-mono text-[10px]" style={{ color: STAGE_COLORS[r.stage] ?? 'var(--gem-dim)' }}>{r.code}</span>
                  <span className="ml-1.5">{r.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -i error | head -5`

Expected: no errors (this completes the pipeline-pill reference from Task 8).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/\[id\]/edit/pipeline-pill.tsx
git commit -m "feat(blog): add PipelinePill component for bidirectional pipeline linking"
```

---

## Task 12: Wire BlogPostCard into Pipeline Detail Sidebar

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx`

- [ ] **Step 1: Add imports and state**

At the top of the file, add these imports after line 19:

```typescript
import { BlogPostCard } from './detail/blog-post-card'
import { BlogPostSearchDialog } from './detail/blog-post-search-dialog'
```

Add to the ItemData interface (after `sections`):

```typescript
  blog_post_id: string | null
  linked_post?: { id: string; title: string; status: string; locales: string[] } | null
  site_id: string
```

Inside the component (after the existing state declarations), add:

```typescript
  const [showPostSearch, setShowPostSearch] = useState(false)

  const handleGraduate = useCallback(async () => {
    const res = await fetch(`/api/pipeline/items/${item.id}/graduate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'blog_post' }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error?.message ?? 'Graduate failed')
    }
  }, [item.id])
```

- [ ] **Step 2: Add BlogPostCard to sidebar between Stage card and Sections card**

After the Stage card closing `</div>` (line 385), add:

```typescript
        {/* Blog Post card */}
        <BlogPostCard
          itemId={item.id}
          itemVersion={item.version}
          siteId={item.site_id}
          linkedPost={item.linked_post ?? null}
          onGraduate={handleGraduate}
          onShowSearch={() => setShowPostSearch(true)}
        />
        <BlogPostSearchDialog
          itemId={item.id}
          siteId={item.site_id}
          open={showPostSearch}
          onClose={() => setShowPostSearch(false)}
        />
```

- [ ] **Step 3: Update the server page that loads the detail to fetch linked post data**

Find the page that renders `PipelineItemDetail` and ensure it fetches the linked blog post info. This is likely in the `[id]/page.tsx` under pipeline. Add a query to fetch blog post info when `blog_post_id` is set:

```typescript
// After fetching the pipeline item, if blog_post_id exists:
let linkedPost = null
if (item.blog_post_id) {
  const { data: post } = await supabase
    .from('blog_posts')
    .select('id, status, blog_translations(locale, title)')
    .eq('id', item.blog_post_id)
    .maybeSingle()
  if (post) {
    const translations = (post as any).blog_translations ?? []
    linkedPost = {
      id: post.id as string,
      title: (translations[0]?.title as string) ?? 'Untitled',
      status: post.status as string,
      locales: translations.map((t: any) => t.locale as string),
    }
  }
}
```

Pass `linked_post: linkedPost` and `site_id: siteId` along with the item data.

- [ ] **Step 4: Verify typecheck + run tests**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -i error | head -5 && npm run test:web 2>&1 | tail -10`

Expected: no type errors, tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/pipeline-item-detail.tsx
git commit -m "feat(pipeline): wire BlogPostCard and search dialog into detail sidebar"
```

---

## Task 13: Enhance GemCard Graduated Badge

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/gem-card.tsx`

- [ ] **Step 1: Update GemCardItem interface and badge rendering**

The `GemCardItem` already has `blog_post_id`. The kanban data loader needs to also fetch the linked blog post status. Add to the interface after `campaign_id`:

```typescript
  linked_post_status: string | null
```

Replace the graduated badge (lines 105-109):

```typescript
        {isGraduated && (
          <span
            className="text-[10px] px-1 py-0.5 rounded font-medium"
            style={{
              backgroundColor: item.linked_post_status === 'published' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              color: item.linked_post_status === 'published' ? '#10b981' : '#f59e0b',
            }}
            title={`Blog post: ${item.linked_post_status ?? 'linked'}`}
          >
            {item.linked_post_status === 'published' ? '✓ published' : 'graduated'}
          </span>
        )}
```

- [ ] **Step 2: Update kanban data loader to include linked post status**

In the pipeline board/list component that fetches items, modify the Supabase select to include blog post status:

```typescript
.select('..., blog_posts!blog_post_id(status)')
```

Then map the result: `linked_post_status: item.blog_posts?.status ?? null`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/gem-card.tsx
git commit -m "feat(pipeline): enhance graduated badge with linked post status color"
```

---

## Task 14: Add "Vínculo" Filter to PipelineFilterBar

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-filter-bar.tsx`

- [ ] **Step 1: Update FilterKey type and add LINK_OPTIONS**

Replace the `FilterKey` type (line 10):

```typescript
type FilterKey = 'collection' | 'lang' | 'priority' | 'link'
```

Add after LANG_OPTIONS (line 23):

```typescript
const LINK_OPTIONS = [
  { value: 'linked', label: 'Com blog post' },
  { value: 'unlinked', label: 'Sem blog post' },
]
```

- [ ] **Step 2: Add link filter state and rendering**

Add to the active filters (after line 34):

```typescript
  const activeLink = searchParams.get('link')
```

Update `getOptions()` (after the priority case):

```typescript
    if (key === 'link') return LINK_OPTIONS
```

Update `hasFilters` (line 121):

```typescript
  const hasFilters = activeCollection || activeLang || activePriority || activeLink
```

Add the new chip in the return (after line 127):

```typescript
      {renderChip('link', 'Vínculo', activeLink)}
```

- [ ] **Step 3: Update the pipeline API/query to handle the link filter**

In the pipeline items query handler (or `applyPipelineFilters` in `queries.ts`), add handling for the `link` search param:

```typescript
if (link === 'linked') query = query.not('blog_post_id', 'is', null)
if (link === 'unlinked') query = query.is('blog_post_id', null)
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/pipeline-filter-bar.tsx
git commit -m "feat(pipeline): add Vínculo filter for linked/unlinked blog post status"
```

---

## Task 15: Final Integration Test + Full Test Suite

**Files:**
- All previously created/modified files

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm test 2>&1 | tail -20`

Expected: all tests pass (both API and web).

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | tail -5`

Expected: no errors.

- [ ] **Step 3: Verify the dev server builds**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx next build --no-lint 2>&1 | tail -10` (or check that dev server starts without errors)

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore(pipeline): integration fixes for pipeline↔blog linking"
```
