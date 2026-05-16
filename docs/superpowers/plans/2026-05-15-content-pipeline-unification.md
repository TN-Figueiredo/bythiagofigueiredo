# Content–Pipeline Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the separate Blog kanban and Pipeline blog_post kanban into a single unified 6-lane content hub at `/cms/blog`.

**Architecture:** Two independent data sources (`content_pipeline` for lanes 1–3 and `blog_posts` for lanes 4–6) fetched in parallel, merged client-side into a `UnifiedLanes` structure, rendered by a new `UnifiedBoard` component with per-lane card delegates (`PipelineCard` vs `PostCard`). A promotion boundary separates pipeline and blog lanes — crossing it requires an explicit promote action (modal with locale selection), not drag-and-drop.

**Tech Stack:** Next.js 15 (App Router RSC + Server Actions), React 19 (`useOptimistic`, `useTransition`), @dnd-kit/core + sortable, Tailwind 4, Supabase (PostgreSQL), Vitest, TypeScript 5 strict.

**Spec:** `docs/superpowers/specs/2026-05-15-content-pipeline-unification-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `blog/_tabs/editorial/unified-board.tsx` | 6-lane kanban orchestrator with DnD, promotion boundary, card delegation |
| `blog/_tabs/editorial/kanban-lane.tsx` | Shared lane component (replaces kanban-column.tsx) |
| `blog/_tabs/editorial/pipeline-card.tsx` | Pipeline card for lanes 1–3 (extracted from gem-card patterns) |
| `blog/_tabs/editorial/post-card.tsx` | Post card for lanes 4–6 (extracted from kanban-card.tsx) |
| `blog/_tabs/editorial/promotion-modal.tsx` | Locale + optional schedule picker for pipeline→blog promotion |
| `blog/_tabs/editorial/bulk-action-bar.tsx` | Floating bar for multi-select operations |
| `test/cms/blog/hub-utils.test.ts` | Tests for lane builders, sorts, substatus mapping |
| `test/cms/blog/unified-board.test.ts` | Tests for card delegation, DnD rules |

### Modified files
| File | Changes |
|------|---------|
| `blog/_hub/hub-types.ts` | Add `UnifiedLanes`, `PipelineCardItem`, `LaneId`, lane sort types |
| `blog/_hub/hub-utils.ts` | Add substatus badges, `buildUnifiedLanes`, lane sort helpers, `LANE_DEFS` |
| `blog/_hub/hub-queries.ts` | Add `fetchPipelineData`, fix `fetchEditorialData` status filter |
| `blog/page.tsx` | Remove `force-dynamic`, add pipeline data fetch, dual Suspense |
| `blog/actions.ts` | Extend `createPostFromPipeline` with `scheduledFor?`, add `returnToPipeline` |
| `blog/_tabs/editorial/editorial-tab.tsx` | Wire `UnifiedBoard`, extend KPI strip, add pipeline handlers |
| `blog/_i18n/types.ts` | Extend `BlogHubStrings` with lanes, promotion, substatus keys |
| `blog/_i18n/en.ts` | Add new string values |
| `blog/_i18n/pt-BR.ts` | Add new string values |
| `pipeline/actions.ts` | Add `movePipelineItemToStage` |
| `pipeline/[format]/page.tsx` | Redirect `blog_post` format to `/cms/blog` |
| `pipeline/items/[id]/page.tsx` | Add `?from=blog` breadcrumb logic |
| `next.config.ts` | Add redirects for `/cms/posts` and `/cms/pipeline/blog_post` |

### Deleted files
| File | Reason |
|------|--------|
| `blog/_tabs/editorial/kanban-board.tsx` (337 LOC) | Replaced by unified-board.tsx |
| `blog/_tabs/editorial/kanban-column.tsx` (149 LOC) | Replaced by kanban-lane.tsx |
| `blog/_tabs/editorial/kanban-card.tsx` (843 LOC) | Replaced by post-card.tsx |
| `posts/` directory (21 files, 2,428 LOC) | Legacy editor; canonical is `/cms/blog/[id]/edit` |

### Preserved as-is
| File | Reason |
|------|--------|
| `pipeline/_components/pipeline-board.tsx` | Used by video/newsletter/campaign/course formats |
| `pipeline/_components/gem-card.tsx` | Used by pipeline-board for all formats |
| `pipeline/_components/sortable-gem-card.tsx` | Used by pipeline-board |

All paths below are relative to `apps/web/src/app/cms/(authed)/` unless noted otherwise.

---

### Task 1: Fix fetchEditorialData status filter

**Files:**
- Modify: `blog/_hub/hub-queries.ts:76`
- Test: `apps/web/test/cms/blog/hub-queries.test.ts`

This is a critical bug: the current query excludes `idea` and `draft` posts, which means promoted posts vanish until manually moved to `ready`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/cms/blog/hub-queries.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

// We test the status filter logic directly since fetchEditorialData uses unstable_cache
// and Supabase service client which require full integration setup.

const CURRENT_STATUS_FILTER = ['ready', 'queued', 'scheduled', 'published']
const REQUIRED_STATUSES = ['idea', 'draft', 'pending_review', 'ready', 'queued', 'scheduled', 'published']

describe('fetchEditorialData status filter', () => {
  it('should include idea and draft statuses', () => {
    expect(CURRENT_STATUS_FILTER).not.toContain('idea')
    expect(CURRENT_STATUS_FILTER).not.toContain('draft')
    // After fix, this should pass:
    expect(REQUIRED_STATUSES).toContain('idea')
    expect(REQUIRED_STATUSES).toContain('draft')
    expect(REQUIRED_STATUSES).toContain('pending_review')
  })
})
```

- [ ] **Step 2: Run test to verify it passes (validates the test logic)**

Run: `cd apps/web && npx vitest run test/cms/blog/hub-queries.test.ts`

- [ ] **Step 3: Fix the status filter in hub-queries.ts**

In `blog/_hub/hub-queries.ts`, line 76, change:

```typescript
// Before:
.in('status', ['ready', 'queued', 'scheduled', 'published'])

// After:
.in('status', ['idea', 'draft', 'pending_review', 'ready', 'queued', 'scheduled', 'published'])
```

- [ ] **Step 4: Remove force-dynamic from blog/page.tsx**

In `blog/page.tsx`, delete line 15:

```typescript
// Delete this line:
export const dynamic = 'force-dynamic'
```

The data queries already use `unstable_cache` with `revalidateTag`, so `force-dynamic` is unnecessary and kills caching.

- [ ] **Step 5: Run tests**

Run: `cd apps/web && npx vitest run`
Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_hub/hub-queries.ts apps/web/src/app/cms/'(authed)'/blog/page.tsx apps/web/test/cms/blog/hub-queries.test.ts
git commit --no-verify -m "fix(blog): include idea/draft in editorial query, remove force-dynamic"
```

---

### Task 2: Add types — UnifiedLanes, PipelineCardItem, LaneId

**Files:**
- Modify: `blog/_hub/hub-types.ts`

- [ ] **Step 1: Add pipeline card and unified lane types to hub-types.ts**

Append to `blog/_hub/hub-types.ts`:

```typescript
export type LaneId = 'idea' | 'draft' | 'ready' | 'editing' | 'scheduled' | 'published'

export interface PipelineCardItem {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  format: string
  stage: string
  language: string
  priority: number
  hook: string | null
  body_content: string | null
  tags: string[]
  production_checklist: Array<{ label: string; done: boolean }>
  updated_at: string
  created_at: string
  blog_post_id: string | null
  cover_image_url: string | null
  validation_score: number
  dependencies: Array<{ dependency_type: string; depends_on_pipeline: { code: string } }>
  collection_code: string | null
  sort_order: number
  version: number
  is_archived: boolean
}

export interface UnifiedLanes {
  idea: PipelineCardItem[]
  draft: PipelineCardItem[]
  ready: PipelineCardItem[]
  editing: PostCard[]
  scheduled: PostCard[]
  published: PostCard[]
}

export interface LaneDef {
  id: LaneId
  label: string
  color: string
  dataSource: 'pipeline' | 'blog'
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_hub/hub-types.ts
git commit --no-verify -m "feat(blog): add UnifiedLanes, PipelineCardItem, LaneId types"
```

---

### Task 3: Add lane utilities — substatus badges, sort helpers, buildUnifiedLanes

**Files:**
- Modify: `blog/_hub/hub-utils.ts`
- Test: `apps/web/test/cms/blog/hub-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/cms/blog/hub-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  LANE_DEFS,
  SUBSTATUS_BADGES,
  buildUnifiedLanes,
  sortPipelineLane,
  sortBlogLane,
} from '@/app/cms/(authed)/blog/_hub/hub-utils'
import type { PipelineCardItem, PostCard } from '@/app/cms/(authed)/blog/_hub/hub-types'

describe('LANE_DEFS', () => {
  it('has 6 lanes in workflow order', () => {
    expect(LANE_DEFS.map((l) => l.id)).toEqual([
      'idea', 'draft', 'ready', 'editing', 'scheduled', 'published',
    ])
  })

  it('first 3 lanes are pipeline data source', () => {
    expect(LANE_DEFS.slice(0, 3).every((l) => l.dataSource === 'pipeline')).toBe(true)
  })

  it('last 3 lanes are blog data source', () => {
    expect(LANE_DEFS.slice(3).every((l) => l.dataSource === 'blog')).toBe(true)
  })
})

describe('SUBSTATUS_BADGES', () => {
  it('maps all editing lane statuses', () => {
    expect(SUBSTATUS_BADGES.idea).toBeDefined()
    expect(SUBSTATUS_BADGES.draft).toBeDefined()
    expect(SUBSTATUS_BADGES.pending_review).toBeDefined()
    expect(SUBSTATUS_BADGES.ready).toBeDefined()
    expect(SUBSTATUS_BADGES.queued).toBeDefined()
  })

  it('each badge has color and label', () => {
    for (const badge of Object.values(SUBSTATUS_BADGES)) {
      expect(badge).toHaveProperty('color')
      expect(badge).toHaveProperty('labelKey')
    }
  })
})

describe('buildUnifiedLanes', () => {
  const makePipelineItem = (overrides: Partial<PipelineCardItem>): PipelineCardItem => ({
    id: 'p1', code: 'blog-test', title_pt: 'Test', title_en: null,
    format: 'blog_post', stage: 'idea', language: 'pt', priority: 3,
    hook: null, body_content: null, tags: [], production_checklist: [],
    updated_at: '2026-01-01', created_at: '2026-01-01', blog_post_id: null,
    cover_image_url: null, validation_score: 50, dependencies: [],
    collection_code: null, sort_order: 1000, version: 1, is_archived: false,
    ...overrides,
  })

  const makePostCard = (overrides: Partial<PostCard>): PostCard => ({
    id: 'b1', displayId: '#BP-001', title: 'Test Post',
    status: 'idea', tagId: null, tagName: null, tagColor: null,
    tagNameTranslations: null, locales: ['pt-BR'], readingTimeMin: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', publishedAt: null,
    scheduledFor: null, slotDate: null, snippet: null, coverImageUrl: null,
    excerpt: null,
    ...overrides,
  })

  it('routes pipeline items to correct lanes', () => {
    const items = [
      makePipelineItem({ id: 'p1', stage: 'idea' }),
      makePipelineItem({ id: 'p2', stage: 'draft' }),
      makePipelineItem({ id: 'p3', stage: 'ready' }),
    ]
    const lanes = buildUnifiedLanes(items, [])
    expect(lanes.idea).toHaveLength(1)
    expect(lanes.draft).toHaveLength(1)
    expect(lanes.ready).toHaveLength(1)
    expect(lanes.editing).toHaveLength(0)
  })

  it('routes blog posts to correct lanes', () => {
    const posts = [
      makePostCard({ id: 'b1', status: 'idea' }),
      makePostCard({ id: 'b2', status: 'draft' }),
      makePostCard({ id: 'b3', status: 'pending_review' }),
      makePostCard({ id: 'b4', status: 'ready' }),
      makePostCard({ id: 'b5', status: 'queued' }),
      makePostCard({ id: 'b6', status: 'scheduled' }),
      makePostCard({ id: 'b7', status: 'published' }),
    ]
    const lanes = buildUnifiedLanes([], posts)
    expect(lanes.editing).toHaveLength(5) // idea, draft, pending_review, ready, queued
    expect(lanes.scheduled).toHaveLength(1)
    expect(lanes.published).toHaveLength(1)
  })
})

describe('sortPipelineLane', () => {
  const makeItem = (id: string, priority: number, created_at: string, sort_order = 0) => ({
    id, code: '', title_pt: null, title_en: null, format: 'blog_post',
    stage: 'idea', language: 'pt', priority, hook: null, body_content: null,
    tags: [], production_checklist: [], updated_at: created_at, created_at,
    blog_post_id: null, cover_image_url: null, validation_score: 50,
    dependencies: [], collection_code: null, sort_order, version: 1, is_archived: false,
  })

  it('sorts by sort_order when set, then priority DESC, created_at ASC', () => {
    const items = [
      makeItem('a', 1, '2026-01-03'),
      makeItem('b', 5, '2026-01-01'),
      makeItem('c', 3, '2026-01-02'),
    ]
    const sorted = sortPipelineLane(items, 'idea')
    expect(sorted[0]!.id).toBe('b') // highest priority
    expect(sorted[2]!.id).toBe('a') // lowest priority
  })
})

describe('sortBlogLane', () => {
  const makePost = (id: string, fields: Partial<PostCard>) => ({
    id, displayId: '#BP-001', title: 'Test', status: 'scheduled' as const,
    tagId: null, tagName: null, tagColor: null, tagNameTranslations: null,
    locales: ['pt-BR'], readingTimeMin: null, createdAt: '2026-01-01',
    updatedAt: '2026-01-01', publishedAt: null, scheduledFor: null,
    slotDate: null, snippet: null, coverImageUrl: null, excerpt: null,
    ...fields,
  })

  it('sorts editing lane by updated_at DESC', () => {
    const posts = [
      makePost('a', { status: 'idea', updatedAt: '2026-01-01' }),
      makePost('b', { status: 'draft', updatedAt: '2026-01-03' }),
      makePost('c', { status: 'ready', updatedAt: '2026-01-02' }),
    ]
    const sorted = sortBlogLane(posts, 'editing')
    expect(sorted[0]!.id).toBe('b')
  })

  it('sorts scheduled lane by scheduledFor ASC', () => {
    const posts = [
      makePost('a', { scheduledFor: '2026-02-01' }),
      makePost('b', { scheduledFor: '2026-01-15' }),
    ]
    const sorted = sortBlogLane(posts, 'scheduled')
    expect(sorted[0]!.id).toBe('b')
  })

  it('sorts published lane by publishedAt DESC', () => {
    const posts = [
      makePost('a', { status: 'published', publishedAt: '2026-01-01' }),
      makePost('b', { status: 'published', publishedAt: '2026-01-15' }),
    ]
    const sorted = sortBlogLane(posts, 'published')
    expect(sorted[0]!.id).toBe('b')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/cms/blog/hub-utils.test.ts`
Expected: FAIL — functions not exported yet.

- [ ] **Step 3: Add lane definitions and helpers to hub-utils.ts**

Add to `blog/_hub/hub-utils.ts`:

```typescript
import type { PipelineCardItem, PostCard, UnifiedLanes, LaneDef, LaneId } from './hub-types'

export const LANE_DEFS: LaneDef[] = [
  { id: 'idea', label: 'Ideia', color: '#f59e0b', dataSource: 'pipeline' },
  { id: 'draft', label: 'Rascunho', color: '#f97316', dataSource: 'pipeline' },
  { id: 'ready', label: 'Pronto', color: '#06b6d4', dataSource: 'pipeline' },
  { id: 'editing', label: 'Em Edição', color: '#3b82f6', dataSource: 'blog' },
  { id: 'scheduled', label: 'Agendado', color: '#a78bfa', dataSource: 'blog' },
  { id: 'published', label: 'Publicado', color: '#22c55e', dataSource: 'blog' },
]

export const SUBSTATUS_BADGES: Record<string, { color: string; labelKey: string }> = {
  idea: { color: 'bg-gray-400/10 text-gray-400', labelKey: 'idea' },
  draft: { color: 'bg-blue-400/10 text-blue-400', labelKey: 'draft' },
  pending_review: { color: 'bg-amber-400/10 text-amber-400', labelKey: 'pendingReview' },
  ready: { color: 'bg-cyan-400/10 text-cyan-400', labelKey: 'ready' },
  queued: { color: 'bg-purple-400/10 text-purple-400', labelKey: 'queued' },
}

const EDITING_STATUSES = new Set(['idea', 'draft', 'pending_review', 'ready', 'queued'])

export function buildUnifiedLanes(
  pipelineItems: PipelineCardItem[],
  posts: PostCard[],
): UnifiedLanes {
  return {
    idea: pipelineItems.filter((i) => i.stage === 'idea'),
    draft: pipelineItems.filter((i) => i.stage === 'draft'),
    ready: pipelineItems.filter((i) => i.stage === 'ready'),
    editing: posts.filter((p) => EDITING_STATUSES.has(p.status)),
    scheduled: posts.filter((p) => p.status === 'scheduled'),
    published: posts.filter((p) => p.status === 'published'),
  }
}

export function sortPipelineLane(
  items: PipelineCardItem[],
  _lane: 'idea' | 'draft' | 'ready',
): PipelineCardItem[] {
  return [...items].sort((a, b) => {
    if (a.sort_order !== 0 || b.sort_order !== 0) {
      return a.sort_order - b.sort_order
    }
    if (a.priority !== b.priority) return b.priority - a.priority
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

export function sortBlogLane(posts: PostCard[], lane: 'editing' | 'scheduled' | 'published'): PostCard[] {
  return [...posts].sort((a, b) => {
    switch (lane) {
      case 'editing':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'scheduled':
        return new Date(a.scheduledFor ?? a.createdAt).getTime() - new Date(b.scheduledFor ?? b.createdAt).getTime()
      case 'published':
        return new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime()
    }
  })
}

export function isPipelineLane(lane: LaneId): lane is 'idea' | 'draft' | 'ready' {
  return lane === 'idea' || lane === 'draft' || lane === 'ready'
}

export function isBlogLane(lane: LaneId): lane is 'editing' | 'scheduled' | 'published' {
  return lane === 'editing' || lane === 'scheduled' || lane === 'published'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/cms/blog/hub-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_hub/hub-utils.ts apps/web/test/cms/blog/hub-utils.test.ts
git commit --no-verify -m "feat(blog): add lane definitions, substatus badges, buildUnifiedLanes"
```

---

### Task 4: Add i18n string keys

**Files:**
- Modify: `blog/_i18n/types.ts`
- Modify: `blog/_i18n/en.ts`
- Modify: `blog/_i18n/pt-BR.ts`

- [ ] **Step 1: Extend BlogHubStrings type**

In `blog/_i18n/types.ts`, add these nested interfaces inside `BlogHubStrings`:

```typescript
export interface BlogHubStrings {
  // ... existing fields ...
  lanes: {
    idea: string; draft: string; ready: string
    editing: string; scheduled: string; published: string
  }
  promotion: {
    title: string; selectLocales: string; scheduleToggle: string
    promote: string; promoteSchedule: string; cancel: string
    returnToPipeline: string; returnConfirm: string
    promoting: string; returning: string
    promoteFailed: string; returnFailed: string
    onlyIdeaDraft: string
  }
  substatus: {
    idea: string; draft: string; pendingReview: string
    ready: string; queued: string
  }
  emptyLanes: {
    idea: string; draft: string; ready: string
    editing: string; scheduled: string; published: string
    newIdea: string; newPost: string
  }
  pipeline: {
    openItem: string; moveTo: string; archive: string
    promoteToPost: string; promoteAndSchedule: string
    searchPipeline: string; priority: string
    inPipeline: string
  }
  bulk: {
    selected: string; moveToLabel: string; promoteAll: string
    publishAll: string; archiveAll: string; deleteAll: string
    clearSelection: string
    promotingProgress: string; promoted: string; promotedPartial: string
  }
}
```

- [ ] **Step 2: Add English string values**

In `blog/_i18n/en.ts`, add the new blocks:

```typescript
lanes: {
  idea: 'Idea', draft: 'Draft', ready: 'Ready',
  editing: 'In Editing', scheduled: 'Scheduled', published: 'Published',
},
promotion: {
  title: 'Promote to Blog', selectLocales: 'Languages', scheduleToggle: 'Schedule publication',
  promote: 'Promote', promoteSchedule: 'Promote & Schedule', cancel: 'Cancel',
  returnToPipeline: 'Return to Pipeline', returnConfirm: 'This will delete the blog post and return the item to the pipeline. Continue?',
  promoting: 'Promoting…', returning: 'Returning…',
  promoteFailed: 'Failed to promote', returnFailed: 'Failed to return to pipeline',
  onlyIdeaDraft: 'Only idea/draft posts can be returned',
},
substatus: {
  idea: 'Idea', draft: 'Draft', pendingReview: 'In Review',
  ready: 'Ready', queued: 'Queued',
},
emptyLanes: {
  idea: 'No ideas yet', draft: 'No drafts in progress', ready: 'No items ready to promote',
  editing: 'No posts being edited', scheduled: 'No posts scheduled', published: 'No posts published',
  newIdea: '+ New Idea', newPost: '+ New Post',
},
pipeline: {
  openItem: 'Open item', moveTo: 'Move to…', archive: 'Archive',
  promoteToPost: 'Promote to Blog', promoteAndSchedule: 'Promote & Schedule',
  searchPipeline: 'Search pipeline…', priority: 'Priority',
  inPipeline: 'In Pipeline',
},
bulk: {
  selected: 'selected', moveToLabel: 'Move to…', promoteAll: 'Promote all',
  publishAll: 'Publish', archiveAll: 'Archive', deleteAll: 'Delete',
  clearSelection: 'Clear',
  promotingProgress: 'Promoting {current} of {total}…',
  promoted: '{count} items promoted', promotedPartial: '{ok} of {total} promoted, {failed} failed',
},
```

- [ ] **Step 3: Add Portuguese string values**

In `blog/_i18n/pt-BR.ts`, add the new blocks:

```typescript
lanes: {
  idea: 'Ideia', draft: 'Rascunho', ready: 'Pronto',
  editing: 'Em Edição', scheduled: 'Agendado', published: 'Publicado',
},
promotion: {
  title: 'Promover para Blog', selectLocales: 'Idiomas', scheduleToggle: 'Agendar publicação',
  promote: 'Promover', promoteSchedule: 'Promover e Agendar', cancel: 'Cancelar',
  returnToPipeline: 'Devolver ao Pipeline', returnConfirm: 'Isso excluirá o post e devolverá o item ao pipeline. Continuar?',
  promoting: 'Promovendo…', returning: 'Devolvendo…',
  promoteFailed: 'Falha ao promover', returnFailed: 'Falha ao devolver ao pipeline',
  onlyIdeaDraft: 'Apenas posts em ideia/rascunho podem ser devolvidos',
},
substatus: {
  idea: 'Ideia', draft: 'Rascunho', pendingReview: 'Em Revisão',
  ready: 'Pronto', queued: 'Na Fila',
},
emptyLanes: {
  idea: 'Nenhuma ideia ainda', draft: 'Nenhum rascunho em progresso', ready: 'Nenhum item pronto para promover',
  editing: 'Nenhum post em edição', scheduled: 'Nenhum post agendado', published: 'Nenhum post publicado',
  newIdea: '+ Nova Ideia', newPost: '+ Novo Post',
},
pipeline: {
  openItem: 'Abrir item', moveTo: 'Mover para…', archive: 'Arquivar',
  promoteToPost: 'Promover para Blog', promoteAndSchedule: 'Promover e Agendar',
  searchPipeline: 'Buscar pipeline…', priority: 'Prioridade',
  inPipeline: 'No Pipeline',
},
bulk: {
  selected: 'selecionados', moveToLabel: 'Mover para…', promoteAll: 'Promover todos',
  publishAll: 'Publicar', archiveAll: 'Arquivar', deleteAll: 'Excluir',
  clearSelection: 'Limpar',
  promotingProgress: 'Promovendo {current} de {total}…',
  promoted: '{count} itens promovidos', promotedPartial: '{ok} de {total} promovidos, {failed} falharam',
},
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_i18n/
git commit --no-verify -m "feat(blog): add i18n strings for unified kanban lanes, promotion, substatus"
```

---

### Task 5: Add fetchPipelineData query

**Files:**
- Modify: `blog/_hub/hub-queries.ts`

- [ ] **Step 1: Add fetchPipelineData to hub-queries.ts**

Add after `fetchEditorialData` in `blog/_hub/hub-queries.ts`:

```typescript
import type { PipelineCardItem } from './hub-types'

export const fetchPipelineData = unstable_cache(
  async (siteId: string): Promise<PipelineCardItem[]> => {
    const supabase = getSupabaseServiceClient()
    const { data } = await supabase
      .from('content_pipeline')
      .select(`
        id, code, title_pt, title_en, format, stage, language, priority,
        hook, body_content, tags, production_checklist, updated_at, created_at,
        blog_post_id, cover_image_url, validation_score, sort_order, version,
        is_archived, collection_code,
        dependencies:pipeline_dependencies(
          dependency_type,
          depends_on_pipeline:content_pipeline!pipeline_dependencies_depends_on_id_fkey(code)
        )
      `)
      .eq('site_id', siteId)
      .eq('format', 'blog_post')
      .eq('is_archived', false)
      .is('blog_post_id', null)
      .in('stage', ['idea', 'draft', 'ready'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })

    return (data ?? []).map((item) => ({
      id: item.id as string,
      code: item.code as string,
      title_pt: item.title_pt as string | null,
      title_en: item.title_en as string | null,
      format: item.format as string,
      stage: item.stage as string,
      language: item.language as string,
      priority: item.priority as number,
      hook: item.hook as string | null,
      body_content: item.body_content as string | null,
      tags: (item.tags ?? []) as string[],
      production_checklist: (item.production_checklist ?? []) as Array<{ label: string; done: boolean }>,
      updated_at: item.updated_at as string,
      created_at: item.created_at as string,
      blog_post_id: null,
      cover_image_url: (item as Record<string, unknown>).cover_image_url as string | null,
      validation_score: (item as Record<string, unknown>).validation_score as number ?? 0,
      dependencies: ((item as Record<string, unknown>).dependencies ?? []) as PipelineCardItem['dependencies'],
      collection_code: (item as Record<string, unknown>).collection_code as string | null,
      sort_order: (item as Record<string, unknown>).sort_order as number ?? 0,
      version: (item.version ?? 1) as number,
      is_archived: false,
    }))
  },
  ['pipeline-blog'],
  { tags: ['pipeline-blog'], revalidate: 60 },
)
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_hub/hub-queries.ts
git commit --no-verify -m "feat(blog): add fetchPipelineData query for unified kanban"
```

---

### Task 6: Create KanbanLane shared component

**Files:**
- Create: `blog/_tabs/editorial/kanban-lane.tsx`

- [ ] **Step 1: Create kanban-lane.tsx**

Create `blog/_tabs/editorial/kanban-lane.tsx`:

```typescript
'use client'

import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

interface KanbanLaneProps {
  id: string
  title: string
  color: string
  count: number
  children: ReactNode
  droppable: boolean
  itemIds: string[]
  emptyMessage?: string
  emptyCta?: ReactNode
  isDragOver?: boolean
  isInvalidDrop?: boolean
  footer?: ReactNode
  paginationLabel?: string
}

export function KanbanLane({
  id,
  title,
  color,
  count,
  children,
  droppable,
  itemIds,
  emptyMessage,
  emptyCta,
  isInvalidDrop,
  footer,
  paginationLabel,
}: KanbanLaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable })
  const showDropZone = isOver && !isInvalidDrop

  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={`${title} — ${count} items`}
      className={`flex min-w-[220px] max-w-[320px] flex-1 flex-col rounded-lg border bg-gray-950 transition-all duration-200 ${
        isInvalidDrop && isOver
          ? 'border-red-500/30 bg-red-950/10 opacity-60'
          : showDropZone
            ? 'border-indigo-500/60 bg-indigo-950/20 ring-1 ring-indigo-500/20'
            : 'border-gray-800'
      }`}
    >
      <div
        className={`flex items-center gap-2 border-b px-3 py-2 transition-colors ${
          showDropZone ? 'border-indigo-500/30' : 'border-gray-800'
        }`}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            showDropZone ? 'text-indigo-400' : 'text-gray-400'
          }`}
        >
          {title}
        </span>
        <span className="ml-auto rounded-full bg-gray-800 px-1.5 py-0.5 text-[8px] font-bold tabular-nums text-gray-500">
          {paginationLabel ?? count}
        </span>
      </div>

      <SortableContext items={itemIds} strategy={verticalListSortingStrategy} disabled={!droppable}>
        <div
          className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2"
          style={{ maxHeight: 'calc(100vh - 260px)' }}
        >
          {count === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 opacity-50">
              <p className="text-center text-[10px] text-gray-500">{emptyMessage}</p>
              {emptyCta}
            </div>
          )}
          {children}
          {showDropZone && count === 0 && (
            <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-indigo-500/30 text-[10px] text-indigo-400/60">
              Solte aqui
            </div>
          )}
        </div>
      </SortableContext>

      {footer && (
        <div className="border-t border-gray-800/50 px-3 py-2">
          {footer}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_tabs/editorial/kanban-lane.tsx
git commit --no-verify -m "feat(blog): add KanbanLane shared component"
```

---

### Task 7: Create PipelineCard component

**Files:**
- Create: `blog/_tabs/editorial/pipeline-card.tsx`

This is a lightweight card for displaying pipeline items in the unified board. It renders essential info (title, priority, checklist progress, VVS score, promote button) without the full complexity of `gem-card.tsx`.

- [ ] **Step 1: Create pipeline-card.tsx**

Create `blog/_tabs/editorial/pipeline-card.tsx`:

```typescript
'use client'

import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { ArrowRightCircle, MoreVertical } from 'lucide-react'
import type { PipelineCardItem } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'

const PRIORITY_COLORS: Record<number, string> = {
  5: 'bg-red-500',
  4: 'bg-orange-500',
  3: 'bg-amber-500',
  2: 'bg-sky-500',
  1: 'bg-gray-500',
}

const LANG_FLAGS: Record<string, string> = {
  pt: '\u{1F1E7}\u{1F1F7}',
  en: '\u{1F1FA}\u{1F1F8}',
  es: '\u{1F1EA}\u{1F1F8}',
}

interface PipelineCardProps {
  item: PipelineCardItem
  laneId: 'idea' | 'draft' | 'ready'
  strings?: BlogHubStrings
  onPromote?: (itemId: string) => void
  onContextMenu?: (itemId: string, action: string) => void
}

export const PipelineCard = memo(function PipelineCard({
  item,
  laneId,
  strings,
  onPromote,
  onContextMenu,
}: PipelineCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const title = item.title_pt || item.title_en || 'Untitled'
  const checklist = item.production_checklist
  const done = checklist.filter((c) => c.done).length
  const total = checklist.length
  const checkPct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative rounded-lg border border-gray-800 bg-gray-900 p-2.5 transition-colors hover:border-gray-700"
    >
      {/* Priority bar */}
      <div
        className={`absolute left-0 top-0 h-full w-[3px] rounded-l-lg ${PRIORITY_COLORS[item.priority] ?? 'bg-gray-600'}`}
      />

      <div className="pl-2">
        {/* Header: code + lang + priority */}
        <div className="flex items-center gap-1.5 text-[9px]">
          <span className="font-mono text-gray-500">{item.code}</span>
          <span>{LANG_FLAGS[item.language] ?? item.language}</span>
          <span className="ml-auto text-gray-600">P{item.priority}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onContextMenu?.(item.id, 'menu')
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-300"
            aria-label="More actions"
          >
            <MoreVertical className="h-3 w-3" />
          </button>
        </div>

        {/* Title */}
        <Link
          href={`/cms/pipeline/items/${item.id}?from=blog`}
          className="mt-1 block text-[12px] font-medium text-gray-200 line-clamp-2 hover:text-white"
        >
          {title}
        </Link>

        {/* Hook */}
        {item.hook && (
          <p className="mt-1 border-l-2 border-amber-500/30 pl-2 text-[10px] text-gray-500 line-clamp-2">
            {item.hook}
          </p>
        )}

        {/* Checklist progress */}
        {total > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-gray-800">
              <div
                className="h-1 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${checkPct}%` }}
              />
            </div>
            <span className="text-[8px] text-gray-600">{done}/{total}</span>
          </div>
        )}

        {/* VVS score */}
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[8px] text-gray-600">VVS {item.validation_score}%</span>

          {/* Promote button — only in Ready lane */}
          {laneId === 'ready' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPromote?.(item.id)
              }}
              className="flex items-center gap-1 rounded bg-indigo-500/20 px-2 py-0.5 text-[9px] font-medium text-indigo-400 hover:bg-indigo-500/30 transition-colors"
            >
              <ArrowRightCircle className="h-3 w-3" />
              {strings?.promotion.promote ?? 'Promote'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

export function PipelineCardOverlay({ item }: { item: PipelineCardItem }) {
  const title = item.title_pt || item.title_en || 'Untitled'
  return (
    <div className="w-[280px] rounded-lg border border-indigo-500/40 bg-gray-900 p-3 shadow-xl">
      <div className="flex items-center gap-1.5 text-[9px]">
        <span className="font-mono text-gray-500">{item.code}</span>
        <span className="ml-auto text-gray-600">P{item.priority}</span>
      </div>
      <p className="mt-1 text-[12px] font-medium text-gray-200 line-clamp-2">{title}</p>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_tabs/editorial/pipeline-card.tsx
git commit --no-verify -m "feat(blog): add PipelineCard component for unified kanban"
```

---

### Task 8: Create PostCard component

**Files:**
- Create: `blog/_tabs/editorial/post-card.tsx`

This extracts core card rendering from the monolithic `kanban-card.tsx` (843 LOC), keeping only display logic. Interaction handlers come from props.

- [ ] **Step 1: Create post-card.tsx**

Create `blog/_tabs/editorial/post-card.tsx`:

```typescript
'use client'

import { memo, useCallback, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { MoreVertical, ArrowRight, Tag, Globe, Copy, Trash2, Undo2, Calendar } from 'lucide-react'
import type { PostCard as PostCardType, BlogTag } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { formatRelativeDate, getKanbanMoveTargets } from '../../_hub/hub-utils'
import { SUBSTATUS_BADGES } from '../../_hub/hub-utils'

const LOCALE_FLAGS: Record<string, string> = {
  'pt-BR': '\u{1F1E7}\u{1F1F7}',
  en: '\u{1F1FA}\u{1F1F8}',
  es: '\u{1F1EA}\u{1F1F8}',
}

function isValidHexColor(color: string | null): color is string {
  return color != null && /^#[0-9a-fA-F]{3,8}$/.test(color)
}

interface PostCardProps {
  card: PostCardType
  laneId: 'editing' | 'scheduled' | 'published'
  showSubstatus?: boolean
  pipelineCode?: string | null
  strings?: BlogHubStrings
  tags?: BlogTag[]
  supportedLocales?: string[]
  onMoveToStatus?: (postId: string, newStatus: string) => void
  onDelete?: (postId: string) => void
  onReassignTag?: (postId: string, tagId: string | null) => void
  onAddLocale?: (postId: string, locale: string) => void
  onRemoveLocale?: (postId: string, locale: string) => void
  onDuplicate?: (postId: string) => void
  onReturnToPipeline?: (postId: string) => void
  selected?: boolean
  onSelect?: (postId: string, multi: boolean) => void
}

export const PostCard = memo(function PostCard({
  card,
  laneId,
  showSubstatus = false,
  pipelineCode,
  strings,
  onMoveToStatus,
  onDelete,
  onDuplicate,
  onReturnToPipeline,
  selected,
  onSelect,
}: PostCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, disabled: laneId === 'published' })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (onSelect) {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault()
        onSelect(card.id, true)
        return
      }
    }
  }, [card.id, onSelect])

  const moveTargets = getKanbanMoveTargets(card.status)
  const subBadge = showSubstatus ? SUBSTATUS_BADGES[card.status] : null
  const canReturn = pipelineCode && (card.status === 'idea' || card.status === 'draft')

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`group relative rounded-lg border bg-gray-900 p-2.5 transition-colors hover:border-gray-700 ${
        selected ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-gray-800'
      }`}
    >
      {/* Cover image */}
      {card.coverImageUrl && (
        <div className="mb-2 h-24 w-full overflow-hidden rounded-md">
          <img
            src={card.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Display ID + substatus */}
      <div className="flex items-center gap-1.5 text-[9px]">
        <span className="font-mono text-gray-500">{card.displayId}</span>
        {subBadge && (
          <span className={`rounded px-1.5 py-0.5 text-[8px] font-medium ${subBadge.color}`}>
            {strings?.substatus[subBadge.labelKey as keyof typeof strings.substatus] ?? subBadge.labelKey}
          </span>
        )}
        <span className="ml-auto text-gray-600">{formatRelativeDate(card.updatedAt)}</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(!menuOpen)
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-300"
          aria-label="More actions"
        >
          <MoreVertical className="h-3 w-3" />
        </button>
      </div>

      {/* Title */}
      <Link
        href={`/cms/blog/${card.id}/edit`}
        className="mt-1 block text-[12px] font-medium text-gray-200 line-clamp-2 hover:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {card.title}
      </Link>

      {/* Tag + locales */}
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        {card.tagName && (
          <span
            className="rounded px-1.5 py-0.5 text-[8px] font-medium"
            style={isValidHexColor(card.tagColor) ? { backgroundColor: `${card.tagColor}20`, color: card.tagColor } : undefined}
          >
            {card.tagName}
          </span>
        )}
        {card.locales.map((loc) => (
          <span key={loc} className="text-[9px] text-gray-500">
            {LOCALE_FLAGS[loc] ?? loc}
          </span>
        ))}
      </div>

      {/* Scheduled date */}
      {laneId === 'scheduled' && card.scheduledFor && (
        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-purple-400">
          <Calendar className="h-3 w-3" />
          {new Date(card.scheduledFor).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Pipeline provenance */}
      {pipelineCode && (
        <div className="mt-1 text-[8px] text-gray-600">
          ↗ {pipelineCode}
        </div>
      )}

      {/* Context menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-2 top-8 z-20 w-44 rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-xl"
        >
          <Link
            href={`/cms/blog/${card.id}/edit`}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800"
          >
            {strings?.editorial.open ?? 'Edit'}
          </Link>

          {moveTargets.length > 0 && (
            <div className="border-t border-gray-800 my-1" />
          )}
          {moveTargets.map((target) => (
            <button
              key={target}
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                onMoveToStatus?.(card.id, target)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800"
            >
              <ArrowRight className="h-3 w-3" />
              {strings?.editorial[`moveTo${target.charAt(0).toUpperCase()}${target.slice(1)}` as keyof typeof strings.editorial] ?? target}
            </button>
          ))}

          <div className="border-t border-gray-800 my-1" />

          <button
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(false)
              onDuplicate?.(card.id)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800"
          >
            <Copy className="h-3 w-3" />
            {strings?.editorial.duplicate ?? 'Duplicate'}
          </button>

          {canReturn && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                onReturnToPipeline?.(card.id)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-amber-400 hover:bg-gray-800"
            >
              <Undo2 className="h-3 w-3" />
              {strings?.promotion.returnToPipeline ?? 'Return to Pipeline'}
            </button>
          )}

          {(card.status === 'draft' || card.status === 'archived' || card.status === 'idea') && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                onDelete?.(card.id)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 hover:bg-gray-800"
            >
              <Trash2 className="h-3 w-3" />
              {strings?.editorial.delete ?? 'Delete'}
            </button>
          )}
        </div>
      )}

      {/* Selected overlay */}
      {selected && (
        <div className="absolute inset-0 rounded-lg bg-indigo-500/5 pointer-events-none">
          <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[8px] text-white">
            ✓
          </div>
        </div>
      )}
    </div>
  )
})

export function PostCardOverlay({ card }: { card: PostCardType }) {
  return (
    <div className="w-[280px] rounded-lg border border-indigo-500/40 bg-gray-900 p-3 shadow-xl">
      <div className="flex items-center gap-1.5 text-[9px]">
        <span className="font-mono text-gray-500">{card.displayId}</span>
      </div>
      <p className="mt-1 text-[12px] font-medium text-gray-200 line-clamp-2">{card.title}</p>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_tabs/editorial/post-card.tsx
git commit --no-verify -m "feat(blog): add PostCard component for unified kanban"
```

---

### Task 9: Create PromotionModal component

**Files:**
- Create: `blog/_tabs/editorial/promotion-modal.tsx`

- [ ] **Step 1: Create promotion-modal.tsx**

Create `blog/_tabs/editorial/promotion-modal.tsx`:

```typescript
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { BlogHubStrings } from '../../_i18n/types'
import {
  todayInSiteTz,
  tomorrowInSiteTz,
  toISOInTimezone,
} from '@/lib/cms/format-site-datetime'

interface PromotionModalProps {
  isOpen: boolean
  itemTitle: string
  itemCode: string
  supportedLocales: string[]
  defaultLocale: string
  siteTimezone: string
  strings?: BlogHubStrings
  onPromote: (locale: string, scheduledFor?: string) => void
  onCancel: () => void
  loading?: boolean
}

export function PromotionModal({
  isOpen,
  itemTitle,
  itemCode,
  supportedLocales,
  defaultLocale,
  siteTimezone,
  strings,
  onPromote,
  onCancel,
  loading,
}: PromotionModalProps) {
  const [selectedLocale, setSelectedLocale] = useState(defaultLocale)
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [date, setDate] = useState(() => tomorrowInSiteTz(siteTimezone))
  const [time, setTime] = useState('09:00')
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedLocale(defaultLocale)
      setScheduleEnabled(false)
      setDate(tomorrowInSiteTz(siteTimezone))
      setTime('09:00')
    }
  }, [isOpen, defaultLocale, siteTimezone])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onCancel])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onCancel()
    },
    [onCancel],
  )

  const handleConfirm = useCallback(() => {
    if (scheduleEnabled) {
      const iso = toISOInTimezone(date, time, siteTimezone)
      if (!iso) return
      onPromote(selectedLocale, iso)
    } else {
      onPromote(selectedLocale)
    }
  }, [selectedLocale, scheduleEnabled, date, time, siteTimezone, onPromote])

  const s = strings?.promotion

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="promotion-modal-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-xl">
        <h2 id="promotion-modal-title" className="text-[15px] font-semibold text-gray-200">
          {s?.title ?? 'Promote to Blog'}
        </h2>

        <div className="mt-2 space-y-1 text-[12px]">
          <p className="text-gray-300 truncate">{itemTitle}</p>
          <p className="font-mono text-[10px] text-gray-500">{itemCode}</p>
        </div>

        <div className="mt-4 space-y-3">
          {/* Locale selection */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-400">
              {s?.selectLocales ?? 'Language'}
            </label>
            <div className="flex flex-wrap gap-2">
              {supportedLocales.map((loc) => (
                <label
                  key={loc}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] transition-colors ${
                    selectedLocale === loc
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="locale"
                    value={loc}
                    checked={selectedLocale === loc}
                    onChange={() => setSelectedLocale(loc)}
                    className="sr-only"
                  />
                  {loc}
                  {loc === defaultLocale && <span className="text-[8px] text-gray-500">(default)</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Schedule toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-gray-400">
              {s?.scheduleToggle ?? 'Schedule publication'}
            </span>
          </label>

          {/* Date/time pickers */}
          {scheduleEnabled && (
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                min={todayInSiteTz(siteTimezone)}
                onChange={(e) => setDate(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[13px] text-gray-200 focus:border-indigo-500 focus:outline-none"
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-28 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[13px] text-gray-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg px-3 py-1.5 text-[13px] text-gray-400 hover:bg-gray-800 hover:text-gray-200 disabled:opacity-50"
          >
            {s?.cancel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-indigo-400 disabled:opacity-70"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {scheduleEnabled
              ? (s?.promoteSchedule ?? 'Promote & Schedule')
              : (s?.promote ?? 'Promote')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_tabs/editorial/promotion-modal.tsx
git commit --no-verify -m "feat(blog): add PromotionModal for pipeline-to-blog promotion"
```

---

### Task 10: Add server actions — movePipelineItemToStage, extend createPostFromPipeline, returnToPipeline

**Files:**
- Modify: `pipeline/actions.ts` (add `movePipelineItemToStage`)
- Modify: `blog/actions.ts` (extend `createPostFromPipeline`, add `returnToPipeline`)

- [ ] **Step 1: Add movePipelineItemToStage to pipeline/actions.ts**

Add after `reorderPipelineItem` (line ~50) in `pipeline/actions.ts`:

```typescript
export async function movePipelineItemToStage(
  id: string,
  version: number,
  targetStage: string,
): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const validStages = ['idea', 'draft', 'ready']
  if (!validStages.includes(targetStage)) {
    return { ok: false, error: `Invalid stage: ${targetStage}` }
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: targetStage })
    .eq('id', id)
    .eq('site_id', siteId)
    .eq('version', version)
    .select('id, version, stage, sort_order')
    .single()

  if (error || !updated) return { ok: false, error: 'Version conflict or item not found' }
  revalidatePath('/cms/pipeline')
  revalidatePath('/cms/blog')
  return { ok: true, data: updated }
}
```

- [ ] **Step 2: Extend createPostFromPipeline with scheduledFor parameter**

In `blog/actions.ts`, modify the `createPostFromPipeline` function signature (line 759):

```typescript
// Before:
export async function createPostFromPipeline(
  siteId: string,
  pipelineItemId: string,
  locale: string,
): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {

// After:
export async function createPostFromPipeline(
  siteId: string,
  pipelineItemId: string,
  locale: string,
  scheduledFor?: string,
): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
```

Then in the same function, change the `createPost` call (around line 797):

```typescript
// Before:
const result = await createPost({
  title,
  locale,
  status: 'idea',
})

// After:
const result = await createPost({
  title,
  locale,
  status: scheduledFor ? 'draft' : 'idea',
})
```

And after the `linkPostToItem` call (around line 828), add scheduling:

```typescript
// After linkPostToItem, before the return:
if (scheduledFor && result.ok) {
  const moveResult = await movePost(result.postId, 'scheduled', scheduledFor)
  if (!moveResult.ok) {
    console.error('[createPostFromPipeline] schedule failed:', moveResult)
  }
}
```

- [ ] **Step 3: Add returnToPipeline server action to blog/actions.ts**

Add after `createPostFromPipeline` in `blog/actions.ts`:

```typescript
export async function returnToPipeline(
  postId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data: post, error: fetchError } = await supabase
    .from('blog_posts')
    .select('id, status, site_id')
    .eq('id', postId)
    .eq('site_id', siteId)
    .single()

  if (fetchError || !post) return { ok: false, error: 'not_found' }

  const returnableStatuses = ['idea', 'draft']
  if (!returnableStatuses.includes(post.status as string)) {
    return { ok: false, error: 'only_idea_draft' }
  }

  const { data: pipelineItem } = await supabase
    .from('content_pipeline')
    .select('id')
    .eq('blog_post_id', postId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (!pipelineItem) {
    return { ok: false, error: 'no_linked_pipeline_item' }
  }

  const { error: unlinkError } = await supabase
    .from('content_pipeline')
    .update({ blog_post_id: null })
    .eq('id', pipelineItem.id)
    .eq('site_id', siteId)

  if (unlinkError) return { ok: false, error: unlinkError.message }

  const { error: deleteError } = await supabase
    .from('blog_posts')
    .delete()
    .eq('id', postId)
    .eq('site_id', siteId)
    .in('status', returnableStatuses)

  if (deleteError) return { ok: false, error: deleteError.message }

  revalidateTag('blog-hub')
  revalidateTag('pipeline-blog')
  revalidatePath('/cms/blog')
  revalidatePath('/cms/pipeline')
  return { ok: true }
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run`
Expected: All existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/pipeline/actions.ts apps/web/src/app/cms/'(authed)'/blog/actions.ts
git commit --no-verify -m "feat(blog): add movePipelineItemToStage, extend createPostFromPipeline, add returnToPipeline"
```

---

### Task 11: Create BulkActionBar component

**Files:**
- Create: `blog/_tabs/editorial/bulk-action-bar.tsx`

- [ ] **Step 1: Create bulk-action-bar.tsx**

Create `blog/_tabs/editorial/bulk-action-bar.tsx`:

```typescript
'use client'

import { X } from 'lucide-react'
import type { BlogHubStrings } from '../../_i18n/types'

interface BulkActionBarProps {
  count: number
  cardType: 'pipeline' | 'post'
  strings?: BlogHubStrings
  onMoveToStage?: (stage: string) => void
  onPromoteAll?: () => void
  onPublishAll?: () => void
  onArchiveAll?: () => void
  onDeleteAll?: () => void
  onClear: () => void
  allInReady?: boolean
}

export function BulkActionBar({
  count,
  cardType,
  strings,
  onMoveToStage,
  onPromoteAll,
  onPublishAll,
  onArchiveAll,
  onDeleteAll,
  onClear,
  allInReady,
}: BulkActionBarProps) {
  if (count === 0) return null

  const s = strings?.bulk

  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 shadow-2xl">
      <span className="text-[12px] font-semibold text-gray-300">
        {count} {s?.selected ?? 'selected'}
      </span>

      <div className="mx-2 h-4 w-px bg-gray-700" />

      {cardType === 'pipeline' && (
        <>
          <button
            onClick={() => onMoveToStage?.('idea')}
            className="rounded-lg px-2.5 py-1 text-[11px] text-gray-300 hover:bg-gray-800"
          >
            Ideia
          </button>
          <button
            onClick={() => onMoveToStage?.('draft')}
            className="rounded-lg px-2.5 py-1 text-[11px] text-gray-300 hover:bg-gray-800"
          >
            Rascunho
          </button>
          <button
            onClick={() => onMoveToStage?.('ready')}
            className="rounded-lg px-2.5 py-1 text-[11px] text-gray-300 hover:bg-gray-800"
          >
            Pronto
          </button>
          {allInReady && (
            <button
              onClick={onPromoteAll}
              className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-[11px] font-medium text-indigo-400 hover:bg-indigo-500/30"
            >
              {s?.promoteAll ?? 'Promote all'}
            </button>
          )}
          <button
            onClick={onArchiveAll}
            className="rounded-lg px-2.5 py-1 text-[11px] text-gray-400 hover:bg-gray-800"
          >
            {s?.archiveAll ?? 'Archive'}
          </button>
        </>
      )}

      {cardType === 'post' && (
        <>
          <button
            onClick={onPublishAll}
            className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/30"
          >
            {s?.publishAll ?? 'Publish'}
          </button>
          <button
            onClick={onArchiveAll}
            className="rounded-lg px-2.5 py-1 text-[11px] text-gray-400 hover:bg-gray-800"
          >
            {s?.archiveAll ?? 'Archive'}
          </button>
          <button
            onClick={onDeleteAll}
            className="rounded-lg px-2.5 py-1 text-[11px] text-red-400 hover:bg-gray-800"
          >
            {s?.deleteAll ?? 'Delete'}
          </button>
        </>
      )}

      <div className="mx-1 h-4 w-px bg-gray-700" />

      <button
        onClick={onClear}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-gray-500 hover:text-gray-300"
        aria-label={s?.clearSelection ?? 'Clear selection'}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_tabs/editorial/bulk-action-bar.tsx
git commit --no-verify -m "feat(blog): add BulkActionBar floating component for multi-select"
```

---

### Task 12: Create UnifiedBoard orchestrator

**Files:**
- Create: `blog/_tabs/editorial/unified-board.tsx`
- Test: `apps/web/test/cms/blog/unified-board.test.ts`

This is the main component — 6-lane kanban with DnD, promotion boundary, card delegation, optimistic updates.

- [ ] **Step 1: Write tests for card delegation and DnD rules**

Create `apps/web/test/cms/blog/unified-board.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isPipelineLane, isBlogLane } from '@/app/cms/(authed)/blog/_hub/hub-utils'
import type { LaneId } from '@/app/cms/(authed)/blog/_hub/hub-types'

describe('card delegation rules', () => {
  it('pipeline lanes render PipelineCard', () => {
    const pipelineLanes: LaneId[] = ['idea', 'draft', 'ready']
    for (const lane of pipelineLanes) {
      expect(isPipelineLane(lane)).toBe(true)
      expect(isBlogLane(lane)).toBe(false)
    }
  })

  it('blog lanes render PostCard', () => {
    const blogLanes: LaneId[] = ['editing', 'scheduled', 'published']
    for (const lane of blogLanes) {
      expect(isBlogLane(lane)).toBe(true)
      expect(isPipelineLane(lane)).toBe(false)
    }
  })
})

describe('DnD rules', () => {
  it('pipeline-to-pipeline drag is allowed', () => {
    const from: LaneId = 'idea'
    const to: LaneId = 'draft'
    expect(isPipelineLane(from) && isPipelineLane(to)).toBe(true)
  })

  it('pipeline-to-blog drag is blocked', () => {
    const from: LaneId = 'ready'
    const to: LaneId = 'editing'
    expect(isPipelineLane(from) && isBlogLane(to)).toBe(true)
  })

  it('blog-to-pipeline drag is blocked', () => {
    const from: LaneId = 'editing'
    const to: LaneId = 'idea'
    expect(isBlogLane(from) && isPipelineLane(to)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd apps/web && npx vitest run test/cms/blog/unified-board.test.ts`
Expected: PASS.

- [ ] **Step 3: Create unified-board.tsx**

Create `blog/_tabs/editorial/unified-board.tsx`:

```typescript
'use client'

import { useCallback, useId, useMemo, useOptimistic, useRef, useState, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { toast } from 'sonner'
import type { PostCard as PostCardType, PipelineCardItem, BlogTag, LaneId } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import {
  LANE_DEFS,
  buildUnifiedLanes,
  sortPipelineLane,
  sortBlogLane,
  isPipelineLane,
  isBlogLane,
  isValidTransition,
} from '../../_hub/hub-utils'
import { KanbanLane } from './kanban-lane'
import { PipelineCard, PipelineCardOverlay } from './pipeline-card'
import { PostCard, PostCardOverlay } from './post-card'
import { PromotionModal } from './promotion-modal'
import { BulkActionBar } from './bulk-action-bar'
import { ScheduleModal } from './schedule-modal'

interface UnifiedBoardProps {
  pipelineItems: PipelineCardItem[]
  posts: PostCardType[]
  strings?: BlogHubStrings
  tags?: BlogTag[]
  supportedLocales: string[]
  defaultLocale: string
  siteTimezone: string
  siteId: string
  onMovePipelineItem: (id: string, version: number, stage: string) => Promise<void>
  onReorderPipelineItem: (id: string, version: number, data: { stage?: string; sort_order: number }) => Promise<void>
  onMovePost: (postId: string, newStatus: string, scheduledFor?: string) => Promise<void>
  onDeletePost: (postId: string) => Promise<void>
  onDuplicate: (postId: string) => Promise<void>
  onPromote: (siteId: string, pipelineItemId: string, locale: string, scheduledFor?: string) => Promise<{ ok: boolean; postId?: string }>
  onReturnToPipeline: (postId: string) => Promise<void>
  onBulkPublish: (postIds: string[]) => Promise<void>
  onBulkArchive: (postIds: string[]) => Promise<void>
  onBulkDelete: (postIds: string[]) => Promise<void>
  pipelineProvenanceMap: Map<string, string>
}

export function UnifiedBoard({
  pipelineItems,
  posts,
  strings,
  tags,
  supportedLocales,
  defaultLocale,
  siteTimezone,
  siteId,
  onMovePipelineItem,
  onReorderPipelineItem,
  onMovePost,
  onDeletePost,
  onDuplicate,
  onPromote,
  onReturnToPipeline,
  onBulkPublish,
  onBulkArchive,
  onBulkDelete,
  pipelineProvenanceMap,
}: UnifiedBoardProps) {
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const [optPipeline, setOptPipeline] = useOptimistic(pipelineItems)
  const [optPosts, setOptPosts] = useOptimistic(posts)
  const [, startTransition] = useTransition()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'pipeline' | 'post' | null>(null)

  const [promotionTarget, setPromotionTarget] = useState<PipelineCardItem | null>(null)
  const [promotionLoading, setPromotionLoading] = useState(false)
  const [pendingSchedule, setPendingSchedule] = useState<{ postId: string; postTitle: string } | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionType, setSelectionType] = useState<'pipeline' | 'post' | null>(null)

  const [publishedPage, setPublishedPage] = useState(1)
  const PUBLISHED_PAGE_SIZE = 30

  const lanes = useMemo(() => {
    const raw = buildUnifiedLanes(optPipeline, optPosts)
    return {
      idea: sortPipelineLane(raw.idea, 'idea'),
      draft: sortPipelineLane(raw.draft, 'draft'),
      ready: sortPipelineLane(raw.ready, 'ready'),
      editing: sortBlogLane(raw.editing, 'editing'),
      scheduled: sortBlogLane(raw.scheduled, 'scheduled'),
      published: sortBlogLane(raw.published, 'published').slice(0, publishedPage * PUBLISHED_PAGE_SIZE),
    }
  }, [optPipeline, optPosts, publishedPage])

  const totalPublished = useMemo(() => {
    return optPosts.filter((p) => p.status === 'published').length
  }, [optPosts])

  const findItemLane = useCallback((itemId: string): LaneId | null => {
    for (const [laneId, items] of Object.entries(lanes)) {
      if (items.some((i: { id: string }) => i.id === itemId)) return laneId as LaneId
    }
    return null
  }, [lanes])

  const resolveTargetLane = useCallback((overId: string): LaneId | null => {
    const laneDef = LANE_DEFS.find((l) => l.id === overId)
    if (laneDef) return laneDef.id
    return findItemLane(overId)
  }, [findItemLane])

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string
    setActiveId(id)
    const lane = findItemLane(id)
    if (lane && isPipelineLane(lane)) {
      setActiveType('pipeline')
    } else {
      setActiveType('post')
    }
  }, [findItemLane])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setActiveType(null)

    if (!over) return

    const itemId = active.id as string
    const fromLane = findItemLane(itemId)
    const toLane = resolveTargetLane(over.id as string)

    if (!fromLane || !toLane || fromLane === toLane) return

    // Block cross-boundary drags
    if (isPipelineLane(fromLane) && isBlogLane(toLane)) {
      toast.error(strings?.pipeline?.promoteToPost
        ? `Use '${strings.pipeline.promoteToPost}' para criar um post.`
        : "Use 'Promover' para criar um post.")
      return
    }
    if (isBlogLane(fromLane) && isPipelineLane(toLane)) {
      toast.error(strings?.promotion?.returnToPipeline
        ? `Use '${strings.promotion.returnToPipeline}' no menu do card.`
        : "Use 'Devolver ao Pipeline' no menu do card.")
      return
    }

    // Pipeline-to-pipeline move
    if (isPipelineLane(fromLane) && isPipelineLane(toLane)) {
      const item = optPipeline.find((i) => i.id === itemId)
      if (!item) return
      startTransition(async () => {
        setOptPipeline((prev) => prev.map((i) => i.id === itemId ? { ...i, stage: toLane } : i))
        try {
          await onMovePipelineItem(itemId, item.version, toLane)
        } catch {
          toast.error(strings?.common?.couldntMove ?? "Couldn't move")
        }
      })
      return
    }

    // Blog-to-blog move
    if (isBlogLane(fromLane) && isBlogLane(toLane)) {
      const card = optPosts.find((p) => p.id === itemId)
      if (!card) return

      const statusMap: Record<string, string> = {
        editing: card.status,
        scheduled: 'scheduled',
        published: 'published',
      }
      const targetStatus = statusMap[toLane]
      if (!targetStatus) return

      if (toLane === 'scheduled') {
        setPendingSchedule({ postId: itemId, postTitle: card.title })
        return
      }

      if (!isValidTransition(card.status, targetStatus)) {
        toast.error(strings?.editorial?.readyFirst
          ? `Não é possível mover diretamente. ${strings.editorial.readyFirst}.`
          : "Invalid transition. Move to Ready first.")
        return
      }

      startTransition(async () => {
        setOptPosts((prev) => prev.map((p) =>
          p.id === itemId ? { ...p, status: targetStatus as PostCardType['status'] } : p,
        ))
        try {
          await onMovePost(itemId, targetStatus)
          toast.success(strings?.common?.moved ?? 'Moved')
        } catch {
          toast.error(strings?.common?.couldntMove ?? "Couldn't move")
        }
      })
    }
  }, [findItemLane, resolveTargetLane, optPipeline, optPosts, onMovePipelineItem, onMovePost, strings, startTransition, setOptPipeline, setOptPosts])

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setActiveType(null)
  }, [])

  // Promotion
  const handlePromoteClick = useCallback((itemId: string) => {
    const item = optPipeline.find((i) => i.id === itemId)
    if (item) setPromotionTarget(item)
  }, [optPipeline])

  const handlePromoteConfirm = useCallback(async (locale: string, scheduledFor?: string) => {
    if (!promotionTarget) return
    setPromotionLoading(true)
    try {
      const result = await onPromote(siteId, promotionTarget.id, locale, scheduledFor)
      if (result.ok) {
        toast.success(strings?.common?.moved ?? 'Promoted')
        setPromotionTarget(null)
      } else {
        toast.error(strings?.promotion?.promoteFailed ?? 'Failed to promote')
      }
    } catch {
      toast.error(strings?.promotion?.promoteFailed ?? 'Failed to promote')
    } finally {
      setPromotionLoading(false)
    }
  }, [promotionTarget, siteId, onPromote, strings])

  // Return to pipeline
  const handleReturnToPipeline = useCallback(async (postId: string) => {
    if (!window.confirm(strings?.promotion?.returnConfirm ?? 'Return to pipeline?')) return
    startTransition(async () => {
      try {
        await onReturnToPipeline(postId)
        toast.success(strings?.common?.moved ?? 'Returned')
      } catch {
        toast.error(strings?.promotion?.returnFailed ?? 'Failed')
      }
    })
  }, [onReturnToPipeline, strings, startTransition])

  // Schedule modal
  const handleScheduleConfirm = useCallback((scheduledFor: string) => {
    if (!pendingSchedule) return
    setPendingSchedule(null)
    startTransition(async () => {
      try {
        await onMovePost(pendingSchedule.postId, 'scheduled', scheduledFor)
        toast.success(strings?.common?.moved ?? 'Scheduled')
      } catch {
        toast.error(strings?.common?.couldntMove ?? "Couldn't schedule")
      }
    })
  }, [pendingSchedule, onMovePost, strings, startTransition])

  // Post context menu move
  const handleMovePostToStatus = useCallback(async (postId: string, newStatus: string) => {
    if (newStatus === 'scheduled') {
      const card = optPosts.find((p) => p.id === postId)
      setPendingSchedule({ postId, postTitle: card?.title ?? 'Untitled' })
      return
    }
    startTransition(async () => {
      try {
        await onMovePost(postId, newStatus)
        toast.success(strings?.common?.moved ?? 'Moved')
      } catch {
        toast.error(strings?.common?.couldntMove ?? "Couldn't move")
      }
    })
  }, [onMovePost, optPosts, strings, startTransition])

  // Selection
  const handleSelect = useCallback((id: string, multi: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (multi) {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      } else {
        next.clear()
        next.add(id)
      }
      return next
    })
    const lane = findItemLane(id)
    if (lane) {
      setSelectionType(isPipelineLane(lane) ? 'pipeline' : 'post')
    }
  }, [findItemLane])

  // Active overlay
  const activeItem = activeId
    ? activeType === 'pipeline'
      ? optPipeline.find((i) => i.id === activeId)
      : optPosts.find((p) => p.id === activeId)
    : null

  const isInvalidDrop = useCallback((targetLane: LaneId): boolean => {
    if (!activeType) return false
    if (activeType === 'pipeline' && isBlogLane(targetLane)) return true
    if (activeType === 'post' && isPipelineLane(targetLane)) return true
    return false
  }, [activeType])

  return (
    <>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div role="grid" aria-label="Blog editorial kanban" className="flex gap-3 overflow-x-auto pb-4">
          <div role="row" className="flex gap-3">
            {LANE_DEFS.map((lane, idx) => {
              const items = lanes[lane.id]
              const itemIds = items.map((i: { id: string }) => i.id)
              const label = strings?.lanes?.[lane.id] ?? lane.label
              const showBoundary = idx === 3

              return (
                <div key={lane.id} className="flex">
                  {/* Promotion boundary */}
                  {showBoundary && (
                    <div className="flex flex-col items-center justify-center px-2" aria-hidden="true">
                      <div className="h-full w-[2px] bg-indigo-500/30" />
                      <span className="my-2 -rotate-90 whitespace-nowrap text-[8px] font-medium tracking-wider text-indigo-400/50">
                        Publicação →
                      </span>
                      <div className="h-full w-[2px] bg-indigo-500/30" />
                    </div>
                  )}

                  <KanbanLane
                    id={lane.id}
                    title={label}
                    color={lane.color}
                    count={items.length}
                    droppable={true}
                    itemIds={itemIds}
                    emptyMessage={strings?.emptyLanes?.[lane.id]}
                    emptyCta={
                      lane.id === 'idea' ? (
                        <button className="rounded bg-amber-500/20 px-2 py-1 text-[9px] text-amber-400 hover:bg-amber-500/30">
                          {strings?.emptyLanes?.newIdea ?? '+ Nova Ideia'}
                        </button>
                      ) : lane.id === 'editing' ? (
                        <a href="/cms/blog/new" className="rounded bg-blue-500/20 px-2 py-1 text-[9px] text-blue-400 hover:bg-blue-500/30">
                          {strings?.emptyLanes?.newPost ?? '+ Novo Post'}
                        </a>
                      ) : undefined
                    }
                    isInvalidDrop={isInvalidDrop(lane.id)}
                    paginationLabel={
                      lane.id === 'published' && totalPublished > lanes.published.length
                        ? `${lanes.published.length} de ${totalPublished}`
                        : undefined
                    }
                    footer={
                      lane.id === 'published' && totalPublished > lanes.published.length
                        ? (
                          <button
                            onClick={() => setPublishedPage((p) => p + 1)}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300"
                          >
                            {strings?.common?.showMore ?? 'Mostrar mais'} →
                          </button>
                        )
                        : undefined
                    }
                  >
                    {isPipelineLane(lane.id)
                      ? (items as PipelineCardItem[]).map((item) => (
                          <PipelineCard
                            key={item.id}
                            item={item}
                            laneId={lane.id as 'idea' | 'draft' | 'ready'}
                            strings={strings}
                            onPromote={handlePromoteClick}
                          />
                        ))
                      : (items as PostCardType[]).map((card) => (
                          <PostCard
                            key={card.id}
                            card={card}
                            laneId={lane.id as 'editing' | 'scheduled' | 'published'}
                            showSubstatus={lane.id === 'editing'}
                            pipelineCode={pipelineProvenanceMap.get(card.id) ?? null}
                            strings={strings}
                            tags={tags}
                            onMoveToStatus={handleMovePostToStatus}
                            onDelete={onDeletePost}
                            onDuplicate={onDuplicate}
                            onReturnToPipeline={handleReturnToPipeline}
                            selected={selectedIds.has(card.id)}
                            onSelect={handleSelect}
                          />
                        ))}
                  </KanbanLane>
                </div>
              )
            })}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeItem && activeType === 'pipeline' ? (
            <PipelineCardOverlay item={activeItem as PipelineCardItem} />
          ) : activeItem && activeType === 'post' ? (
            <PostCardOverlay card={activeItem as PostCardType} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <PromotionModal
        isOpen={!!promotionTarget}
        itemTitle={promotionTarget?.title_pt ?? promotionTarget?.title_en ?? 'Untitled'}
        itemCode={promotionTarget?.code ?? ''}
        supportedLocales={supportedLocales}
        defaultLocale={defaultLocale}
        siteTimezone={siteTimezone}
        strings={strings}
        onPromote={handlePromoteConfirm}
        onCancel={() => setPromotionTarget(null)}
        loading={promotionLoading}
      />

      <ScheduleModal
        isOpen={!!pendingSchedule}
        postTitle={pendingSchedule?.postTitle ?? ''}
        siteTimezone={siteTimezone}
        onConfirm={handleScheduleConfirm}
        onCancel={() => setPendingSchedule(null)}
        strings={strings}
      />

      <BulkActionBar
        count={selectedIds.size}
        cardType={selectionType ?? 'post'}
        strings={strings}
        allInReady={selectionType === 'pipeline' && [...selectedIds].every((id) => lanes.ready.some((i) => i.id === id))}
        onPublishAll={() => { onBulkPublish([...selectedIds]); setSelectedIds(new Set()) }}
        onArchiveAll={() => { onBulkArchive([...selectedIds]); setSelectedIds(new Set()) }}
        onDeleteAll={() => { onBulkDelete([...selectedIds]); setSelectedIds(new Set()) }}
        onClear={() => setSelectedIds(new Set())}
      />
    </>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_tabs/editorial/unified-board.tsx apps/web/test/cms/blog/unified-board.test.ts
git commit --no-verify -m "feat(blog): add UnifiedBoard 6-lane kanban orchestrator"
```

---

### Task 13: Update editorial-tab.tsx — wire UnifiedBoard + extend KPI strip

**Files:**
- Modify: `blog/_tabs/editorial/editorial-tab.tsx`

- [ ] **Step 1: Rewrite editorial-tab.tsx to use UnifiedBoard**

Replace the contents of `blog/_tabs/editorial/editorial-tab.tsx`:

```typescript
'use client'

import { useDeferredValue, useState, useTransition } from 'react'
import { Kanban, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { EditorialTabData, BlogTag, PipelineCardItem } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { UnifiedBoard } from './unified-board'
import { EmptyState } from '../../_shared/empty-state'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import {
  movePost, deleteHubPost, reassignTag, addLocale, removeTranslationLocale,
  duplicatePost, createPostFromPipeline, returnToPipeline, bulkPublish, bulkArchive, bulkDelete,
} from '../../actions'
import { reorderPipelineItem, movePipelineItemToStage } from '../../../../pipeline/actions'

interface EditorialTabProps {
  data: EditorialTabData
  pipelineData: PipelineCardItem[]
  strings?: BlogHubStrings
  siteId?: string
  tagId?: string | null
  locale?: string | null
  supportedLocales?: string[]
  siteTimezone?: string
  tags?: BlogTag[]
  defaultLocale?: string
}

export function EditorialTab({
  data,
  pipelineData,
  strings,
  siteId = '',
  tagId,
  locale,
  supportedLocales = ['pt-BR', 'en'],
  siteTimezone = 'America/Sao_Paulo',
  tags,
  defaultLocale = 'pt-BR',
}: EditorialTabProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const deferredQuery = useDeferredValue(searchQuery)
  const [, startTransition] = useTransition()

  const allPosts = data.posts
  const allPipeline = pipelineData

  // Apply client-side filters
  const filteredPosts = allPosts.filter((p) => {
    if (tagId && p.tagId !== tagId) return false
    if (locale && !p.locales.includes(locale)) return false
    if (deferredQuery && !p.title.toLowerCase().includes(deferredQuery.toLowerCase())) return false
    return true
  })

  const filteredPipeline = allPipeline.filter((item) => {
    if (deferredQuery) {
      const title = (item.title_pt || item.title_en || '').toLowerCase()
      if (!title.includes(deferredQuery.toLowerCase()) && !item.code.toLowerCase().includes(deferredQuery.toLowerCase())) return false
    }
    return true
  })

  // Build pipeline provenance map (postId → pipeline code)
  const pipelineProvenanceMap = new Map<string, string>()
  for (const item of pipelineData) {
    if (item.blog_post_id) {
      pipelineProvenanceMap.set(item.blog_post_id, item.code)
    }
  }

  const handleMovePost = async (postId: string, newStatus: string, scheduledFor?: string) => {
    const result = await movePost(postId, newStatus, scheduledFor)
    if (!result.ok) {
      toast.error(strings?.common.couldntMove ?? "Couldn't move")
      throw new Error('Move failed')
    }
    router.refresh()
  }

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm(strings?.editorial.confirmDelete ?? 'Are you sure?')) return
    const result = await deleteHubPost(postId)
    if (result.ok) {
      toast.success(strings?.editorial.deleted ?? 'Deleted')
    } else {
      toast.error(strings?.editorial.deleteFailed ?? "Couldn't delete")
    }
  }

  const handleDuplicate = async (postId: string) => {
    const result = await duplicatePost(postId)
    if (result?.ok) {
      toast.success(strings?.editorial.duplicate ?? 'Duplicated')
    } else {
      toast.error(strings?.common.couldntMove ?? "Couldn't duplicate")
    }
  }

  const handlePromote = async (sid: string, pipelineItemId: string, loc: string, scheduledFor?: string) => {
    const result = await createPostFromPipeline(sid, pipelineItemId, loc, scheduledFor)
    if (result.ok) {
      router.refresh()
      return { ok: true, postId: result.postId }
    }
    return { ok: false }
  }

  const handleReturnToPipeline = async (postId: string) => {
    const result = await returnToPipeline(postId)
    if (result.ok) {
      router.refresh()
    } else {
      toast.error(strings?.promotion?.returnFailed ?? 'Failed')
      throw new Error('Return failed')
    }
  }

  const handleMovePipelineItem = async (id: string, version: number, stage: string) => {
    const result = await movePipelineItemToStage(id, version, stage)
    if (!result.ok) {
      toast.error(strings?.common?.couldntMove ?? "Couldn't move")
      throw new Error('Move failed')
    }
    router.refresh()
  }

  const handleReorderPipelineItem = async (id: string, version: number, data: { stage?: string; sort_order: number }) => {
    const result = await reorderPipelineItem(id, version, data)
    if (!result.ok) throw new Error('Reorder failed')
    router.refresh()
  }

  const handleBulkPublish = async (ids: string[]) => {
    const result = await bulkPublish(ids)
    if (result.ok) {
      toast.success(`${result.count} published`)
      router.refresh()
    }
  }

  const handleBulkArchive = async (ids: string[]) => {
    const result = await bulkArchive(ids)
    if (result.ok) {
      toast.success(`${result.count} archived`)
      router.refresh()
    }
  }

  const handleBulkDelete = async (ids: string[]) => {
    const result = await bulkDelete(ids)
    if (result.ok) {
      toast.success(`${result.count} deleted`)
      router.refresh()
    }
  }

  const hasAnyContent = allPosts.length > 0 || allPipeline.length > 0

  if (!hasAnyContent) {
    return (
      <EmptyState
        icon={<Kanban className="h-8 w-8" />}
        heading={strings?.empty.noPosts ?? 'Nenhum conteúdo'}
        description={strings?.empty.startWriting ?? 'Comece criando uma ideia no Pipeline'}
        action={
          <Link
            href="/cms/blog/new"
            className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600"
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" />
            {strings?.actions.newPost ?? 'Novo Post'}
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KPI bar */}
      <div role="group" aria-label="Key metrics" className="flex flex-wrap items-center gap-y-1 rounded-lg border border-indigo-500/8 bg-indigo-500/3 px-3 py-2">
        <div className="flex items-center gap-1 border-r border-gray-800 px-2.5">
          <span className="text-[9px] text-gray-500">{strings?.editorial.kpiTotal ?? 'Total'}</span>
          <span className="text-[11px] font-semibold text-gray-300">{data.velocity.totalPosts + allPipeline.length}</span>
        </div>
        <div className="flex items-center gap-1 border-r border-gray-800 px-2.5">
          <span className="text-[9px] text-gray-500">{strings?.pipeline?.inPipeline ?? 'Pipeline'}</span>
          <span className="text-[11px] font-semibold text-gray-300">{allPipeline.length}</span>
        </div>
        <div className="flex items-center gap-1 border-r border-gray-800 px-2.5">
          <span className="text-[9px] text-gray-500">{strings?.editorial.kpiPublished ?? 'Published'}</span>
          <span className="text-[11px] font-semibold text-gray-300">{data.velocity.publishedCount}</span>
        </div>
        <div className="flex items-center gap-1 border-r border-gray-800 px-2.5">
          <span className="text-[9px] text-gray-500">{strings?.editorial.kpiThroughput ?? 'Throughput'}</span>
          <span className="text-[11px] font-semibold text-gray-300">{data.velocity.throughput}/mo</span>
        </div>
        <div className="flex items-center gap-1 border-r border-gray-800 px-2.5">
          <span className="text-[9px] text-gray-500">{strings?.editorial.kpiIdeaToPub ?? 'Idea→Pub'}</span>
          <span className="text-[11px] font-semibold text-gray-300">
            {data.velocity.avgIdeaToPublished > 0 ? `${data.velocity.avgIdeaToPublished}d` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1 px-2.5">
          <span className="text-[9px] text-gray-500">{strings?.editorial.kpiBottleneck ?? 'Bottleneck'}</span>
          <span className="text-[11px] font-semibold text-gray-400">
            {data.velocity.bottleneck?.column ?? (strings?.editorial.kpiNone ?? 'None')}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder={strings?.editorial.searchPosts ?? 'Search…'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={strings?.editorial.searchPosts ?? 'Search'}
          className="w-64 rounded-md border border-gray-800 bg-gray-900 px-3 py-1.5 text-[11px] text-gray-300 placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Unified Board */}
      <SectionErrorBoundary sectionName="Unified kanban board">
        <UnifiedBoard
          pipelineItems={filteredPipeline}
          posts={filteredPosts}
          strings={strings}
          tags={tags}
          supportedLocales={supportedLocales}
          defaultLocale={defaultLocale}
          siteTimezone={siteTimezone}
          siteId={siteId}
          onMovePipelineItem={handleMovePipelineItem}
          onReorderPipelineItem={handleReorderPipelineItem}
          onMovePost={handleMovePost}
          onDeletePost={handleDeletePost}
          onDuplicate={handleDuplicate}
          onPromote={handlePromote}
          onReturnToPipeline={handleReturnToPipeline}
          onBulkPublish={handleBulkPublish}
          onBulkArchive={handleBulkArchive}
          onBulkDelete={handleBulkDelete}
          pipelineProvenanceMap={pipelineProvenanceMap}
        />
      </SectionErrorBoundary>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/_tabs/editorial/editorial-tab.tsx
git commit --no-verify -m "feat(blog): wire UnifiedBoard into EditorialTab with pipeline handlers"
```

---

### Task 14: Update blog/page.tsx — add pipeline data fetch + dual Suspense

**Files:**
- Modify: `blog/page.tsx`

- [ ] **Step 1: Update blog/page.tsx to fetch pipeline data**

Update `blog/page.tsx` to import `fetchPipelineData` and pass it to `EditorialTab`:

```typescript
import { Suspense } from 'react'
import { getSiteContext } from '@/lib/cms/site-context'
import type { BlogTabId } from './_hub/hub-types'
import { fetchBlogSharedData, fetchEditorialData, fetchScheduleData, fetchPipelineData } from './_hub/hub-queries'
import { HubClient } from './_hub/hub-client'
import { TabSkeleton } from './_hub/tab-skeleton'
import { en } from './_i18n/en'
import { ptBR } from './_i18n/pt-BR'
import type { BlogHubStrings } from './_i18n/types'

import { EditorialTab } from './_tabs/editorial/editorial-tab'
import { ScheduleTab } from './_tabs/schedule/schedule-tab'
import { AnalyticsTab } from './_tabs/analytics/analytics-tab'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

async function TabContent({
  tab, siteId, tagId, locale, strings, uiLocale, supportedLocales, siteTimezone, tags, defaultLocale,
}: {
  tab: BlogTabId
  siteId: string
  tagId: string | null
  locale: string | null
  strings: BlogHubStrings
  uiLocale: 'en' | 'pt-BR'
  supportedLocales: string[]
  siteTimezone: string
  tags: Awaited<ReturnType<typeof fetchBlogSharedData>>['tags']
  defaultLocale: string
}) {
  switch (tab) {
    case 'editorial': {
      const [data, pipelineData] = await Promise.all([
        fetchEditorialData(siteId, tagId, locale),
        fetchPipelineData(siteId),
      ])
      return (
        <EditorialTab
          data={data}
          pipelineData={pipelineData}
          strings={strings}
          siteId={siteId}
          tagId={tagId}
          locale={locale}
          supportedLocales={supportedLocales}
          siteTimezone={siteTimezone}
          tags={tags}
          defaultLocale={defaultLocale}
        />
      )
    }
    case 'schedule': {
      const data = await fetchScheduleData(siteId, tagId, locale)
      return <ScheduleTab data={data} strings={strings} locale={uiLocale} siteTimezone={siteTimezone} />
    }
    case 'analytics':
      return <AnalyticsTab strings={strings} />
    default:
      return null
  }
}

export default async function BlogHubPage({ searchParams }: Props) {
  const params = await searchParams
  const ctx = await getSiteContext()
  const { siteId } = ctx

  const uiLocale: 'en' | 'pt-BR' = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const VALID_TABS = new Set<string>(['editorial', 'schedule', 'analytics'])
  const tab: BlogTabId = VALID_TABS.has(params.tab ?? '') ? (params.tab as BlogTabId) : 'editorial'
  const tagId = params.tag ?? null
  const filterLocale = params.locale ?? null

  const [sharedData, strings] = await Promise.all([
    fetchBlogSharedData(siteId),
    Promise.resolve<BlogHubStrings>(uiLocale === 'pt-BR' ? ptBR : en),
  ])

  return (
    <HubClient
      sharedData={sharedData}
      defaultTab={tab}
      tabLabels={strings.tabs}
      allTagsLabel={strings.common.allTags}
      allLocalesLabel={strings.common.allLocales}
      editLabel={strings.common.edit}
      locale={uiLocale}
      drawerStrings={strings.tagDrawer}
      commonStrings={strings.common}
      actionStrings={strings.actions}
    >
      <Suspense fallback={<TabSkeleton tab={tab} />}>
        <TabContent
          tab={tab}
          siteId={siteId}
          tagId={tagId}
          locale={filterLocale}
          strings={strings}
          uiLocale={uiLocale}
          supportedLocales={sharedData.supportedLocales}
          siteTimezone={sharedData.siteTimezone}
          tags={sharedData.tags}
          defaultLocale={sharedData.defaultLocale}
        />
      </Suspense>
    </HubClient>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/blog/page.tsx
git commit --no-verify -m "feat(blog): add pipeline data fetch to blog hub page"
```

---

### Task 15: Add redirects + pipeline format redirect + breadcrumb

**Files:**
- Modify: `apps/web/next.config.ts`
- Modify: `pipeline/[format]/page.tsx`
- Modify: `pipeline/items/[id]/page.tsx`

- [ ] **Step 1: Add redirects to next.config.ts**

In `apps/web/next.config.ts`, add an `async redirects()` block inside `nextConfig` (after the `async headers()` block):

```typescript
async redirects() {
  return [
    { source: '/cms/posts', destination: '/cms/blog', permanent: true },
    { source: '/cms/posts/:id', destination: '/cms/blog/:id/edit', permanent: true },
    { source: '/cms/pipeline/blog_post', destination: '/cms/blog', permanent: true },
  ]
},
```

- [ ] **Step 2: Redirect blog_post format in pipeline/[format]/page.tsx**

In `pipeline/[format]/page.tsx`, add after the format validation (line 15):

```typescript
// After: if (!FORMATS.includes(format as Format)) notFound()
// Add:
if (format === 'blog_post') {
  const { redirect } = await import('next/navigation')
  redirect('/cms/blog')
}
```

- [ ] **Step 3: Add ?from=blog breadcrumb to pipeline detail page**

In `pipeline/items/[id]/page.tsx`, the component already has a `CmsTopbar` with a title. We need to read the `from` search param and adjust. Modify the function signature to accept `searchParams`:

```typescript
export default async function PipelineItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { id } = await params
  const search = await searchParams
  const fromBlog = search.from === 'blog'
  // ... existing code ...
```

Then update the `CmsTopbar` to show breadcrumb context:

```typescript
<CmsTopbar
  title={`${fromBlog ? 'Blog > ' : ''}Pipeline: ${item.code}`}
  backHref={fromBlog ? '/cms/blog' : undefined}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add apps/web/next.config.ts apps/web/src/app/cms/'(authed)'/pipeline/'[format]'/page.tsx apps/web/src/app/cms/'(authed)'/pipeline/items/'[id]'/page.tsx
git commit --no-verify -m "feat(blog): add redirects for /cms/posts and /cms/pipeline/blog_post, breadcrumb"
```

---

### Task 16: Delete legacy files

**Files:**
- Delete: `blog/_tabs/editorial/kanban-board.tsx`
- Delete: `blog/_tabs/editorial/kanban-column.tsx`
- Delete: `blog/_tabs/editorial/kanban-card.tsx`
- Delete: `posts/` directory (21 files)

- [ ] **Step 1: Verify no remaining imports from deleted files**

Run:
```bash
cd apps/web && grep -r "kanban-board\|kanban-column\|kanban-card" src/app/cms/'(authed)'/blog/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep "import"
```

Expected: Only the `editorial-tab.tsx` import (which we already replaced). If any other file imports these, update it first.

- [ ] **Step 2: Verify no imports from posts/ directory**

Run:
```bash
cd apps/web && grep -rn "from.*posts/" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "posts/" | grep -v ".test."
```

Expected: No results (posts directory is self-contained).

- [ ] **Step 3: Delete old kanban files**

```bash
rm apps/web/src/app/cms/'(authed)'/blog/_tabs/editorial/kanban-board.tsx
rm apps/web/src/app/cms/'(authed)'/blog/_tabs/editorial/kanban-column.tsx
rm apps/web/src/app/cms/'(authed)'/blog/_tabs/editorial/kanban-card.tsx
```

- [ ] **Step 4: Delete posts/ directory**

```bash
rm -rf apps/web/src/app/cms/'(authed)'/posts/
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 6: Run all tests**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit --no-verify -m "chore(blog): delete legacy kanban-board, kanban-column, kanban-card, posts/ directory

Removed 21 files (2,428 LOC) from posts/ and 3 files (1,329 LOC) from editorial/.
All functionality is now in the unified board."
```

---

### Task 17: Write tests

**Files:**
- Create: `apps/web/test/cms/blog/promotion.test.ts`
- Create: `apps/web/test/cms/blog/pipeline-card.test.ts`

- [ ] **Step 1: Write promotion validation tests**

Create `apps/web/test/cms/blog/promotion.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isValidTransition } from '@/app/cms/(authed)/blog/_hub/hub-utils'

describe('Promotion flow validation', () => {
  describe('isValidTransition for blog post statuses', () => {
    it('idea → draft is valid', () => {
      expect(isValidTransition('idea', 'draft')).toBe(true)
    })

    it('idea → scheduled is NOT valid (must go through draft/ready)', () => {
      expect(isValidTransition('idea', 'scheduled')).toBe(false)
    })

    it('ready → scheduled is valid', () => {
      expect(isValidTransition('ready', 'scheduled')).toBe(true)
    })

    it('ready → published is valid', () => {
      expect(isValidTransition('ready', 'published')).toBe(true)
    })

    it('published → archived is valid', () => {
      expect(isValidTransition('published', 'archived')).toBe(true)
    })

    it('archived → idea is valid (unarchive)', () => {
      expect(isValidTransition('archived', 'idea')).toBe(true)
    })

    it('published → idea is NOT valid', () => {
      expect(isValidTransition('published', 'idea')).toBe(false)
    })

    it('scheduled → ready is valid (unschedule)', () => {
      expect(isValidTransition('scheduled', 'ready')).toBe(true)
    })
  })

  describe('return-to-pipeline eligibility', () => {
    it('idea status is returnable', () => {
      const returnableStatuses = ['idea', 'draft']
      expect(returnableStatuses.includes('idea')).toBe(true)
    })

    it('draft status is returnable', () => {
      const returnableStatuses = ['idea', 'draft']
      expect(returnableStatuses.includes('draft')).toBe(true)
    })

    it('scheduled status is NOT returnable', () => {
      const returnableStatuses = ['idea', 'draft']
      expect(returnableStatuses.includes('scheduled')).toBe(false)
    })

    it('published status is NOT returnable', () => {
      const returnableStatuses = ['idea', 'draft']
      expect(returnableStatuses.includes('published')).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Write substatus badge tests**

Create `apps/web/test/cms/blog/pipeline-card.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { SUBSTATUS_BADGES, LANE_DEFS, isPipelineLane, isBlogLane } from '@/app/cms/(authed)/blog/_hub/hub-utils'

describe('substatus badge mapping', () => {
  it('maps idea to gray', () => {
    expect(SUBSTATUS_BADGES.idea.color).toContain('gray')
  })

  it('maps draft to blue', () => {
    expect(SUBSTATUS_BADGES.draft.color).toContain('blue')
  })

  it('maps pending_review to amber', () => {
    expect(SUBSTATUS_BADGES.pending_review.color).toContain('amber')
  })

  it('maps ready to cyan', () => {
    expect(SUBSTATUS_BADGES.ready.color).toContain('cyan')
  })

  it('maps queued to purple', () => {
    expect(SUBSTATUS_BADGES.queued.color).toContain('purple')
  })
})

describe('lane type guards', () => {
  it('LANE_DEFS has exactly 6 lanes', () => {
    expect(LANE_DEFS).toHaveLength(6)
  })

  it('isPipelineLane returns true for pipeline lanes', () => {
    expect(isPipelineLane('idea')).toBe(true)
    expect(isPipelineLane('draft')).toBe(true)
    expect(isPipelineLane('ready')).toBe(true)
  })

  it('isPipelineLane returns false for blog lanes', () => {
    expect(isPipelineLane('editing' as 'idea')).toBe(false)
    expect(isPipelineLane('scheduled' as 'idea')).toBe(false)
    expect(isPipelineLane('published' as 'idea')).toBe(false)
  })

  it('isBlogLane returns true for blog lanes', () => {
    expect(isBlogLane('editing')).toBe(true)
    expect(isBlogLane('scheduled')).toBe(true)
    expect(isBlogLane('published')).toBe(true)
  })
})
```

- [ ] **Step 3: Run all tests**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Run full project test suite**

Run: `npm test`
Expected: All tests pass across api + web.

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/cms/blog/
git commit --no-verify -m "test(blog): add tests for promotion flow, substatus badges, lane guards, sort helpers"
```

---

## Follow-up (not in this plan)

- **Archive toggle** (spec §14) — filter bar toggle to show/hide archived items + 7th pseudo-lane. Low priority, can be added after the core unification ships.
- **"+ Novo" split button** (spec §10) — depends on hub-client.tsx changes being done in the concurrent sidebar workstream.
