# Remove Collections Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dead Collections feature (content_collections + content_pipeline_memberships) from the entire codebase — UI, API, schemas, server actions, tests, and database.

**Architecture:** Collections was an organizational grouping concept (playlist/category/series/arc/launch) that was never used in production. It has zero rows in prod. The real Playlists feature (`/cms/playlists`) uses its own independent tables (`playlists`, `playlist_items`, `playlist_edges`) and is unaffected by this removal. The `computeValidationScore` function loses its `in_collection` factor (5 points) and needs weight redistribution.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase, Zod, Vitest

---

## Compile-Safe Execution Order

> **Critical:** TypeScript strict mode with object literals means BOTH sides of a type dependency must change in the same commit. Removing a required field from an interface while callers still pass it causes "may only specify known properties" errors. Removing it from callers while the interface still requires it causes "property missing" errors. Each task below is designed as ONE independently-compilable commit.

---

## File Map

### Files to DELETE entirely (7 files)
- `apps/web/src/app/cms/(authed)/pipeline/collections/page.tsx` — collections list page
- `apps/web/src/app/cms/(authed)/pipeline/collections/[id]/page.tsx` — collection detail page
- `apps/web/src/app/cms/(authed)/pipeline/_components/collection-manager.tsx` — collection grid component
- `apps/web/src/app/cms/(authed)/pipeline/_components/collection-detail.tsx` — collection detail component
- `apps/web/src/app/api/pipeline/collections/route.ts` — collections list/create API
- `apps/web/src/app/api/pipeline/collections/[id]/route.ts` — collection CRUD API
- `apps/web/src/app/api/pipeline/collections/[id]/members/route.ts` — membership management API

### Files to MODIFY (30 files)
- `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts:7,37` — remove sidebar entry + FolderOpen import
- `apps/web/src/lib/pipeline/schemas.ts:10-11,113-123,153` — remove collection schemas
- `apps/web/src/lib/pipeline/validation.ts:13,28,32,39,49,60,62,69` — remove in_collection, redistribute weight
- `apps/web/src/lib/pipeline/queries.ts:44,98-100` — remove collection filter from applyPipelineFilters
- `apps/web/src/app/cms/(authed)/pipeline/actions.ts:9,304-371` — remove collection actions + imports
- `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx:36,55,65,80,95,239` — remove collections prop/filter
- `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-filter-bar.tsx:6-10,30,37,62-63,128,132` — remove collection filter
- `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx:36,75,259,877-881` — remove collections prop/display
- `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-search-dropdown.tsx:11,57,128-139` — remove collections from search
- `apps/web/src/app/cms/(authed)/pipeline/_components/gem-card.tsx:38,67-68,74` — remove collection_code
- `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx:26-34,48,71,138-161` — remove playlists section
- `apps/web/src/app/cms/(authed)/pipeline/page.tsx:19,38-50,62` — remove playlistsRes query + playlists prop
- `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx:22,30,44-48,54,66,74,81` — remove collections query/extraction/prop
- `apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx:27,30,52-53,62,71` — remove memberships query/prop
- `apps/web/src/app/api/pipeline/route.ts:18-22,35-37` — remove collection endpoints from API docs
- `apps/web/src/app/api/pipeline/search/route.ts:41-46,54` — remove collections from search results
- `apps/web/src/app/api/pipeline/topics/[code]/route.ts:27-42,50` — remove collection lookup
- `apps/web/src/app/api/pipeline/items/route.ts:24,33` — remove memberships SELECT + collection filter param
- `apps/web/src/app/api/pipeline/items/[id]/route.ts:20` — remove memberships from item detail SELECT
- `apps/web/src/app/api/pipeline/items/[id]/advance/route.ts:84-88,98` — remove memberships count query + param
- `apps/web/src/app/api/pipeline/items/bulk/route.ts:59,84-90` — remove move_collection operation
- `apps/web/src/app/cms/(authed)/blog/_hub/hub-queries.ts:350,383` — remove collection_code from query + mapping
- `apps/web/src/app/cms/(authed)/blog/_hub/hub-types.ts:116` — remove collection_code from PipelineCardItem
- `apps/web/test/lib/pipeline-schemas.test.ts:11,84-103` — remove CollectionCreateSchema import + tests
- `apps/web/test/lib/pipeline-validation.test.ts:15,35,58,76` — remove memberships_count from test inputs
- `apps/web/test/integration/pipeline.test.ts:13,23-25,162-198` — remove collection membership test + cleanup
- `apps/web/test/api/pipeline-search.test.ts:75-87` — remove collection filter test
- `apps/web/test/app/cms/pipeline/gem-card.test.tsx:30,87` — remove collection_code from test fixtures
- `apps/web/test/app/cms/pipeline/pipeline-filter-bar.test.tsx:13-14,21` — remove collections prop from test renders
- `apps/web/test/app/cms/pipeline/pipeline-search-dropdown.test.tsx:29,41,52` — remove collections from mock data
- `apps/web/test/cms/pipeline-item-detail.test.tsx:53,80` — remove collections prop from test renders
- `apps/web/test/cms/blog/hub-utils.test.ts:51,101` — remove collection_code from test fixtures
- `apps/web/test/cms/pipeline-board.test.tsx:40,53,69,75-84` — remove collections prop + collection_code + filter test

### Files to CREATE (1 file)
- `supabase/migrations/<timestamp>_drop_collections.sql` — migration to drop tables

---

### Task 1: Remove sidebar navigation entry + delete collection files

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts:7,37`
- Delete: `apps/web/src/app/cms/(authed)/pipeline/collections/page.tsx`
- Delete: `apps/web/src/app/cms/(authed)/pipeline/collections/[id]/page.tsx`
- Delete: `apps/web/src/app/cms/(authed)/pipeline/_components/collection-manager.tsx`
- Delete: `apps/web/src/app/cms/(authed)/pipeline/_components/collection-detail.tsx`
- Delete: `apps/web/src/app/api/pipeline/collections/route.ts`
- Delete: `apps/web/src/app/api/pipeline/collections/[id]/route.ts`
- Delete: `apps/web/src/app/api/pipeline/collections/[id]/members/route.ts`

> **Why first:** Collection files import `GemCardItem` (with `collection_code`) and `CollectionCreateSchema` from schemas.ts. Later tasks remove those exports/fields, so deleting these files first prevents orphaned import errors. No non-collection files import from these files.

- [ ] **Step 1: Remove the Collections menu item**

In `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`, delete line 37:
```typescript
        { icon: icon(FolderOpen), label: 'Collections', href: '/cms/pipeline/collections', minRole: 'editor' },
```

- [ ] **Step 2: Remove the FolderOpen import**

`FolderOpen` is ONLY used by the Collections entry. In the lucide-react import block (line 7), remove `FolderOpen` from:
```typescript
  FileText, Mail, Megaphone, Image, Link2, ListMusic,
  Kanban, Video, GraduationCap, FolderOpen, BookOpen, Microscope, Headphones,
```
Change to:
```typescript
  FileText, Mail, Megaphone, Image, Link2, ListMusic,
  Kanban, Video, GraduationCap, BookOpen, Microscope, Headphones,
```

- [ ] **Step 3: Delete all dedicated collection files**

```bash
rm "apps/web/src/app/cms/(authed)/pipeline/collections/page.tsx"
rm "apps/web/src/app/cms/(authed)/pipeline/collections/[id]/page.tsx"
rmdir "apps/web/src/app/cms/(authed)/pipeline/collections/[id]"
rmdir "apps/web/src/app/cms/(authed)/pipeline/collections"

rm "apps/web/src/app/cms/(authed)/pipeline/_components/collection-manager.tsx"
rm "apps/web/src/app/cms/(authed)/pipeline/_components/collection-detail.tsx"

rm apps/web/src/app/api/pipeline/collections/route.ts
rm "apps/web/src/app/api/pipeline/collections/[id]/route.ts"
rm "apps/web/src/app/api/pipeline/collections/[id]/members/route.ts"
rmdir "apps/web/src/app/api/pipeline/collections/[id]"
rmdir apps/web/src/app/api/pipeline/collections
```

- [ ] **Step 4: Commit**

```bash
git add -A "apps/web/src/app/cms/(authed)/_shared/cms-sections.ts" "apps/web/src/app/cms/(authed)/pipeline/collections/" "apps/web/src/app/cms/(authed)/pipeline/_components/collection-manager.tsx" "apps/web/src/app/cms/(authed)/pipeline/_components/collection-detail.tsx" apps/web/src/app/api/pipeline/collections/
git commit -m "chore: remove Collections nav + delete collection pages/components/APIs"
```

---

### Task 2: Remove in_collection from validation score + all callers

**Files:**
- Modify: `apps/web/src/lib/pipeline/validation.ts` — remove memberships_count input + in_collection weight
- Modify: `apps/web/src/app/api/pipeline/items/[id]/advance/route.ts:84-88,98` — remove memberships query + param
- Modify: `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx:54` — remove memberships_count from call
- Modify: `apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx:62` — remove memberships_count from call

> **Why together:** `memberships_count` is a REQUIRED field in `ValidationInput`. Removing it from the type while callers still pass it (or vice versa) causes TS errors.

- [ ] **Step 1: Rewrite validation.ts**

Replace the entire `apps/web/src/lib/pipeline/validation.ts` with:

```typescript
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
  format: Format
}

const WEIGHTS = {
  has_title: 20,
  has_hook: 15,
  has_synopsis: 10,
  has_body: 20,
  has_tags: 10,
  checklist_pct: 15,
  metadata_complete: 10,
}

export function computeValidationScore(input: ValidationInput): ValidationScore {
  const has_title = Boolean(input.title_pt || input.title_en)
  const has_hook = Boolean(input.hook)
  const has_synopsis = Boolean(input.synopsis)
  const has_body = Boolean(input.body_content)
  const has_tags = input.tags.length > 0

  const doneCount = input.production_checklist.filter((c) => c.done).length
  const totalCount = input.production_checklist.length
  const checklist_pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const schema = FORMAT_METADATA_SCHEMAS[input.format]
  const metaResult = schema.safeParse(input.format_metadata)
  const hasMetaValues = Object.values(input.format_metadata).some((v) => v !== undefined && v !== null && v !== '')
  const metadata_complete = metaResult.success && hasMetaValues

  const breakdown = { has_title, has_hook, has_synopsis, has_body, has_tags, checklist_pct, metadata_complete }

  const overall = Math.round(
    (has_title ? WEIGHTS.has_title : 0) +
    (has_hook ? WEIGHTS.has_hook : 0) +
    (has_synopsis ? WEIGHTS.has_synopsis : 0) +
    (has_body ? WEIGHTS.has_body : 0) +
    (has_tags ? WEIGHTS.has_tags : 0) +
    (checklist_pct / 100) * WEIGHTS.checklist_pct +
    (metadata_complete ? WEIGHTS.metadata_complete : 0)
  )

  return { overall, breakdown, computed_at: new Date().toISOString() }
}
```

Key changes: removed `in_collection` from breakdown, removed `memberships_count` from ValidationInput, redistributed 5 points from `in_collection` to `has_tags` (5→10). Total still sums to 100.

- [ ] **Step 2: Remove memberships query from advance route**

In `apps/web/src/app/api/pipeline/items/[id]/advance/route.ts`, delete lines 84-88:
```typescript
  const { count: membershipsCount } = await supabase
    .from('content_pipeline_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('pipeline_id', id)

```

And in the same file, remove `memberships_count: membershipsCount ?? 0,` from the computeValidationScore call (line 98).

- [ ] **Step 3: Remove memberships_count from format page validation call**

In `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx` line 54, delete:
```typescript
      format_metadata: item.format_metadata ?? {}, memberships_count: memberships.length, format: item.format as Format,
```
Replace with:
```typescript
      format_metadata: item.format_metadata ?? {}, format: item.format as Format,
```

- [ ] **Step 4: Remove memberships_count from item detail page validation call**

In `apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx`, change lines 59-63:
```typescript
  const score = computeValidationScore({
    title_pt: item.title_pt, title_en: item.title_en, hook: item.hook, synopsis: item.synopsis,
    body_content: item.body_content, tags: item.tags ?? [], production_checklist: item.production_checklist ?? [],
    format_metadata: item.format_metadata ?? {}, memberships_count: collections.length, format: item.format as Format,
  })
```
to:
```typescript
  const score = computeValidationScore({
    title_pt: item.title_pt, title_en: item.title_en, hook: item.hook, synopsis: item.synopsis,
    body_content: item.body_content, tags: item.tags ?? [], production_checklist: item.production_checklist ?? [],
    format_metadata: item.format_metadata ?? {}, format: item.format as Format,
  })
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/validation.ts "apps/web/src/app/api/pipeline/items/[id]/advance/route.ts" "apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx" "apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx"
git commit -m "chore: remove in_collection from validation score, redistribute weight to tags"
```

---

### Task 3: Remove collection_code from GemCard + format page + board filter

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/gem-card.tsx:38,67-68,74`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx:65,80,95`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx:30,44-48,66`

> **Why together:** `collection_code` is in the `GemCardItem` interface. The format page builds objects matching it and `pipeline-board.tsx` accesses `item.collection_code` in its filter. All three sides must change atomically.

- [ ] **Step 1: Remove collection_code from GemCardItem interface**

In `gem-card.tsx`, delete line 38:
```typescript
  collection_code: string | null
```

- [ ] **Step 2: Remove collection tag logic from GemCard**

Replace the tags construction block (lines 66-74):
```typescript
  const tags: Array<{ label: string; className: string }> = []
  if (item.collection_code) {
    tags.push({ label: item.collection_code, className: 'bg-amber-900/50 text-amber-300' })
  }
  for (const t of item.tags) {
    if (tags.length >= 3) break
    tags.push({ label: t, className: 'bg-cyan-900/50 text-cyan-300' })
  }
  const overflowCount = (item.collection_code ? 1 : 0) + item.tags.length - tags.length
```

with:
```typescript
  const tags: Array<{ label: string; className: string }> = []
  for (const t of item.tags) {
    if (tags.length >= 3) break
    tags.push({ label: t, className: 'bg-cyan-900/50 text-cyan-300' })
  }
  const overflowCount = item.tags.length - tags.length
```

- [ ] **Step 3: Remove memberships join + extraction from format page**

In `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx`:

Remove `content_pipeline_memberships(role, content_collections(code, name))` from the items SELECT (line 30). Change:
```typescript
        is_archived, format_metadata, cover_image_url, blog_posts(status),
        content_pipeline_memberships(role, content_collections(code, name))
```
to:
```typescript
        is_archived, format_metadata, cover_image_url, blog_posts(status)
```

Delete the membership extraction block (lines 44-48):
```typescript
    const memberships = (item.content_pipeline_memberships ?? []) as unknown as Array<{ role: string | null; content_collections: { code: string; name: string } | { code: string; name: string }[] | null }>
    let collectionCode: string | null = null
    for (const m of memberships) {
      const col = Array.isArray(m.content_collections) ? m.content_collections[0] : m.content_collections
      if (col?.code) { collectionCode = col.code; break }
    }
```

Remove `collection_code: collectionCode,` from the return object (line 66). Change:
```typescript
      dependencies: [], collection_code: collectionCode,
```
to:
```typescript
      dependencies: [],
```

- [ ] **Step 4: Remove collection_code filter from PipelineBoard**

In `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx`:

Delete line 65:
```typescript
  const collectionFilter = searchParams.get('collection')
```

Delete line 80:
```typescript
    if (collectionFilter && item.collection_code !== collectionFilter) return false
```

Replace `hasActiveFilters` (line 95):
```typescript
  const hasActiveFilters = !!(collectionFilter || langFilter || priorityFilter || linkFilter)
```
→
```typescript
  const hasActiveFilters = !!(langFilter || priorityFilter || linkFilter)
```

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/pipeline/_components/gem-card.tsx" "apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx" "apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx"
git commit -m "chore: remove collection_code from pipeline cards and board filter"
```

---

### Task 4: Remove collection_code from Blog Hub

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/_hub/hub-types.ts:116`
- Modify: `apps/web/src/app/cms/(authed)/blog/_hub/hub-queries.ts:350,383`

> **Note:** `collection_code` is NOT a column in the `content_pipeline` table (no migration adds it). The blog hub query selects it but Supabase silently ignores unknown columns. This is a dormant bug being cleaned up.

- [ ] **Step 1: Remove collection_code from PipelineCardItem type**

In `apps/web/src/app/cms/(authed)/blog/_hub/hub-types.ts`, delete line 116:
```typescript
  collection_code: string | null
```

- [ ] **Step 2: Remove collection_code from hub query SELECT**

In `apps/web/src/app/cms/(authed)/blog/_hub/hub-queries.ts`, change line 350 from:
```typescript
        is_archived, collection_code,
```
to:
```typescript
        is_archived,
```

- [ ] **Step 3: Remove collection_code from hub query mapping**

In the same file, delete line 383:
```typescript
      collection_code: (item as Record<string, unknown>).collection_code as string | null,
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/blog/_hub/hub-types.ts" "apps/web/src/app/cms/(authed)/blog/_hub/hub-queries.ts"
git commit -m "chore: remove dormant collection_code from blog hub"
```

---

### Task 5: Remove collection filter chain (FilterBar + Board + format page)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-filter-bar.tsx` — full rewrite
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx:36,55,239`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx:22,74,81`

> **Why together:** FilterBar accepts `collections` prop from Board, Board accepts from format page. Removing from any one side while the others still pass/expect it causes TS errors.

- [ ] **Step 1: Rewrite PipelineFilterBar without collections**

Replace the entire `pipeline-filter-bar.tsx` with:
```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type FilterKey = 'lang' | 'priority' | 'link'

const PRIORITY_OPTIONS = [
  { value: '5', label: 'P5' },
  { value: '4', label: 'P4' },
  { value: '3', label: 'P3' },
  { value: '2', label: 'P2' },
]

const LANG_OPTIONS = [
  { value: 'pt-br', label: 'PT' },
  { value: 'en', label: 'EN' },
  { value: 'both', label: 'PT+EN' },
]

const LINK_OPTIONS = [
  { value: 'linked', label: 'Com blog post' },
  { value: 'unlinked', label: 'Sem blog post' },
]

export function PipelineFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeLang = searchParams.get('lang')
  const activePriority = searchParams.get('priority')
  const activeLink = searchParams.get('link')

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenFilter(null)
      }
    }
    if (openFilter) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openFilter])

  function setFilter(key: FilterKey, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.replace(`${pathname}?${params.toString()}`)
    setOpenFilter(null)
  }

  function getOptions(key: FilterKey) {
    if (key === 'lang') return LANG_OPTIONS
    if (key === 'link') return LINK_OPTIONS
    return PRIORITY_OPTIONS
  }

  function renderChip(key: FilterKey, label: string, active: string | null) {
    const isOpen = openFilter === key
    const options = getOptions(key)

    return (
      <div className="relative" key={key}>
        <button
          onClick={() => setOpenFilter(isOpen ? null : key)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className="text-xs px-2.5 py-1 rounded-full border transition-colors"
          style={{
            borderColor: active ? 'var(--gem-accent)' : 'var(--gem-border)',
            backgroundColor: active ? 'rgba(99,102,241,0.1)' : 'transparent',
            color: active ? 'var(--gem-text)' : 'var(--gem-muted)',
          }}
        >
          {label}{active && `: ${active}`}
        </button>

        {isOpen && (
          <div
            role="listbox"
            aria-label={`Filter by ${label}`}
            className="absolute top-full mt-1 left-0 rounded-lg border p-1 z-50 min-w-32 shadow-lg"
            style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          >
            {active && (
              <button
                role="option"
                aria-selected={false}
                onClick={() => setFilter(key, null)}
                className="w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-white/5 transition-colors"
                style={{ color: 'var(--gem-dim)' }}
              >
                Clear
              </button>
            )}
            {options.map((o) => (
              <button
                key={o.value}
                role="option"
                aria-selected={active === o.value}
                onClick={() => setFilter(key, o.value)}
                className="w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-white/5 transition-colors"
                style={{
                  color: active === o.value ? 'var(--gem-accent)' : 'var(--gem-text)',
                  fontWeight: active === o.value ? 600 : 400,
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const hasFilters = activeLang || activePriority || activeLink

  return (
    <div ref={containerRef} className="flex items-center gap-2 mb-3">
      {renderChip('lang', 'Language', activeLang)}
      {renderChip('priority', 'Priority', activePriority)}
      {renderChip('link', 'Vínculo', activeLink)}
      {hasFilters && (
        <button
          onClick={() => {
            const params = new URLSearchParams()
            router.replace(`${pathname}?${params.toString()}`)
          }}
          className="text-[10px] px-2 py-0.5 rounded hover:bg-white/5 transition-colors"
          style={{ color: 'var(--gem-dim)' }}
        >
          Clear all
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Remove collections prop from PipelineBoard**

In `pipeline-board.tsx`:

> Note: `collectionFilter`, `item.collection_code` access, and `hasActiveFilters` were already removed in Task 3. This step only removes the `collections` prop and its usage.

Remove `collections` from props interface (line 36):
```typescript
interface PipelineBoardProps {
  format: Format
  items: GemCardItem[]
  collections: Array<{ code: string; name: string }>
}
```
→
```typescript
interface PipelineBoardProps {
  format: Format
  items: GemCardItem[]
}
```

Remove from destructuring (line 55):
```typescript
export function PipelineBoard({ format, items, collections }: PipelineBoardProps) {
```
→
```typescript
export function PipelineBoard({ format, items }: PipelineBoardProps) {
```

Replace FilterBar call (line 239):
```typescript
        <PipelineFilterBar collections={collections} />
```
→
```typescript
        <PipelineFilterBar />
```

- [ ] **Step 3: Remove collectionsRes from format page**

In `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx`:

Replace the `Promise.all` structure (line 22):
```typescript
  const [itemsRes, collectionsRes] = await Promise.all([
```
→
```typescript
  const { data: itemsData } = await
```

Remove the entire `collectionsRes` query arm (the second element in Promise.all):
```typescript
    supabase
      .from('content_collections')
      .select('code, name')
      .eq('site_id', siteId)
      .eq('type', 'playlist'),
  ])
```
→ (remove entirely, close the single query properly)

The items query now becomes a standalone call without Promise.all:
```typescript
  const { data: itemsData } = await supabase
    .from('content_pipeline')
    .select(`
      id, code, title_pt, title_en, stage, priority, language, tags,
      production_checklist, version, sort_order, format, hook, body_content, updated_at,
      youtube_video_id, blog_post_id, newsletter_edition_id, campaign_id, social_post_id,
      is_archived, format_metadata, cover_image_url, blog_posts(status)
    `)
    .eq('site_id', siteId)
    .eq('format', format)
    .eq('is_archived', false)
    .order('sort_order', { ascending: true })
```

Update `boardItems` mapping to use `itemsData`:
```typescript
  const boardItems = (itemsData ?? []).map((item) => {
```

Delete line 74 (collections mapping):
```typescript
  const collections = (collectionsRes.data ?? []).map((c) => ({ code: c.code, name: c.name ?? c.code }))
```

Replace line 81:
```typescript
        <PipelineBoard format={format as Format} items={boardItems} collections={collections} />
```
→
```typescript
        <PipelineBoard format={format as Format} items={boardItems} />
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-filter-bar.tsx" "apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx" "apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx"
git commit -m "chore: remove collection filter from pipeline board"
```

---

### Task 6: Remove collections from PipelineItemDetail + item detail page

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx:36,75,259,877-881`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx:30,52-53,71`

> **Why together:** PipelineItemDetail accepts `collections` prop; the item detail page passes it.

- [ ] **Step 1: Remove Collection interface from PipelineItemDetail**

Delete line 36:
```typescript
interface Collection { id: string; code: string; name: string; type: string }
```

- [ ] **Step 2: Remove collections from Props**

Replace lines 73-78:
```typescript
interface Props {
  item: ItemData
  collections: Collection[]
  history: HistoryEntry[]
  dependencies: Dependency[]
}
```
with:
```typescript
interface Props {
  item: ItemData
  history: HistoryEntry[]
  dependencies: Dependency[]
}
```

- [ ] **Step 3: Remove collections from function signature**

Replace line 259:
```typescript
export function PipelineItemDetail({ item: initialItem, collections, history, dependencies }: Props) {
```
with:
```typescript
export function PipelineItemDetail({ item: initialItem, history, dependencies }: Props) {
```

- [ ] **Step 4: Remove collection badges rendering**

Delete lines 877-881:
```tsx
          {collections.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {collections.map((c) => <span key={c.id} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">{c.name}</span>)}
            </div>
          )}
```

- [ ] **Step 5: Remove memberships query from item detail page**

In `apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx`, replace lines 27-31:
```typescript
  const [itemRes, historyRes, membershipsRes, depsRes] = await Promise.all([
    supabase.from('content_pipeline').select('*').eq('id', id).eq('site_id', siteId).single(),
    supabase.from('content_pipeline_history').select('*').eq('pipeline_id', id).order('changed_at', { ascending: false }).limit(20),
    supabase.from('content_pipeline_memberships').select('collection_id, content_collections(id, code, name, type)').eq('pipeline_id', id),
    supabase.from('content_pipeline_dependencies').select('dependency_type, depends_on_pipeline:depends_on_id(code)').eq('pipeline_id', id),
  ])
```
with:
```typescript
  const [itemRes, historyRes, depsRes] = await Promise.all([
    supabase.from('content_pipeline').select('*').eq('id', id).eq('site_id', siteId).single(),
    supabase.from('content_pipeline_history').select('*').eq('pipeline_id', id).order('changed_at', { ascending: false }).limit(20),
    supabase.from('content_pipeline_dependencies').select('dependency_type, depends_on_pipeline:depends_on_id(code)').eq('pipeline_id', id),
  ])
```

- [ ] **Step 6: Remove collections extraction**

Delete lines 52-53:
```typescript
  interface MembershipWithCollection { content_collections: { id: string; code: string; name: string; type: string } | null }
  const collections = ((membershipsRes.data ?? []) as unknown as MembershipWithCollection[]).map((m) => m.content_collections).filter((c): c is NonNullable<typeof c> => c !== null)
```

- [ ] **Step 7: Remove collections prop from render**

Replace line 71:
```typescript
        <PipelineItemDetail item={enrichedItem} collections={collections} history={historyRes.data ?? []} dependencies={dependencies} />
```
with:
```typescript
        <PipelineItemDetail item={enrichedItem} history={historyRes.data ?? []} dependencies={dependencies} />
```

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx" "apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx"
git commit -m "chore: remove collections from item detail"
```

---

### Task 7: Remove playlists from PipelineOverview + overview page

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx:26-34,48,71,138-161`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/page.tsx:19,38-50,62`

> **Why together:** PipelineOverview accepts `playlists` prop; the overview page passes it.

- [ ] **Step 1: Remove PlaylistData interface from PipelineOverview**

Delete lines 26-34:
```typescript
interface PlaylistData {
  id: string
  code: string
  name: string
  description: string | null
  progress: number
  total: number
  nextItem: { code: string; title: string } | null
}
```

- [ ] **Step 2: Remove playlists from props**

Replace lines 45-50:
```typescript
interface PipelineOverviewProps {
  stats: Stats
  recommendations: { nextToRecord: RecommendationItem[]; topPriority: RecommendationItem[] }
  playlists: PlaylistData[]
  activity: ActivityEntry[]
}
```
with:
```typescript
interface PipelineOverviewProps {
  stats: Stats
  recommendations: { nextToRecord: RecommendationItem[]; topPriority: RecommendationItem[] }
  activity: ActivityEntry[]
}
```

- [ ] **Step 3: Remove playlists from function signature**

Replace line 71:
```typescript
export function PipelineOverview({ stats, recommendations, playlists, activity }: PipelineOverviewProps) {
```
with:
```typescript
export function PipelineOverview({ stats, recommendations, activity }: PipelineOverviewProps) {
```

- [ ] **Step 4: Remove playlists section JSX**

Delete lines 138-161 (the entire `{playlists.length > 0 && (...)}` block with playlist cards and progress bars).

- [ ] **Step 5: Remove playlistsRes query from overview page**

In `apps/web/src/app/cms/(authed)/pipeline/page.tsx`, replace lines 15-21:
```typescript
  const [statsRes, nextToRecordRes, topPriorityRes, playlistsRes, activityRes] = await Promise.all([
    ...
    supabase.from('content_collections').select(`id, code, name, description, type, content_pipeline_memberships(role, content_pipeline(id, code, title_pt, stage))`).eq('site_id', siteId).eq('type', 'playlist').order('position'),
    ...
  ])
```
Remove the `playlistsRes` from the destructuring and remove the content_collections query from Promise.all:
```typescript
  const [statsRes, nextToRecordRes, topPriorityRes, activityRes] = await Promise.all([
    supabase.from('content_pipeline').select('id, format, stage, priority, is_archived', { count: 'exact' }).eq('site_id', siteId).eq('is_archived', false),
    supabase.from('content_pipeline').select('id, code, title_pt, format, priority, updated_at').eq('site_id', siteId).eq('is_archived', false).not('body_content', 'is', null).in('stage', ['roteiro', 'draft', 'outline']).order('priority', { ascending: false }).order('updated_at', { ascending: true }).limit(3),
    supabase.from('content_pipeline').select('id, code, title_pt, format, priority, stage, updated_at').eq('site_id', siteId).eq('is_archived', false).gte('priority', 4).not('stage', 'in', '(scheduled,published,sent)').order('priority', { ascending: false }).limit(5),
    supabase.from('content_pipeline_history').select('id, event_type, to_value, changed_at, pipeline_id, content_pipeline(code, format)').eq('content_pipeline.site_id', siteId).order('changed_at', { ascending: false }).limit(5),
  ])
```

- [ ] **Step 6: Remove playlists data transformation**

Delete lines 38-50 (the `PlaylistMembership` interface and `playlists` mapping).

- [ ] **Step 7: Remove playlists prop from PipelineOverview render**

Replace line 62:
```typescript
        <PipelineOverview stats={stats} recommendations={recommendations} playlists={playlists} activity={activity} />
```
with:
```typescript
        <PipelineOverview stats={stats} recommendations={recommendations} activity={activity} />
```

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx" "apps/web/src/app/cms/(authed)/pipeline/page.tsx"
git commit -m "chore: remove playlists from pipeline overview"
```

---

### Task 8: Remove collections from PipelineSearch + search API

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-search-dropdown.tsx:11,57,128-139`
- Modify: `apps/web/src/app/api/pipeline/search/route.ts:41-46,54`

- [ ] **Step 1: Remove collections from SearchResult interface**

In `pipeline-search-dropdown.tsx`, replace lines 7-12:
```typescript
interface SearchResult {
  pipeline: Array<{ id: string; code: string; title_pt: string | null; title_en: string | null; format: string; stage: string }>
  blog_posts: Array<{ id: string; title: string; slug: string; status: string }>
  newsletters: Array<{ id: string; subject: string; status: string }>
  collections: Array<{ id: string; code: string; name: string; type: string }>
}
```
with:
```typescript
interface SearchResult {
  pipeline: Array<{ id: string; code: string; title_pt: string | null; title_en: string | null; format: string; stage: string }>
  blog_posts: Array<{ id: string; title: string; slug: string; status: string }>
  newsletters: Array<{ id: string; subject: string; status: string }>
}
```

- [ ] **Step 2: Remove collections from hasResults check**

Replace line 57:
```typescript
  const hasResults = results && (results.pipeline.length > 0 || results.blog_posts.length > 0 || results.newsletters.length > 0 || results.collections.length > 0)
```
with:
```typescript
  const hasResults = results && (results.pipeline.length > 0 || results.blog_posts.length > 0 || results.newsletters.length > 0)
```

- [ ] **Step 3: Remove collections results section**

Delete lines 128-139 (the entire `{results.collections.length > 0 && (...)}` block with collection links).

- [ ] **Step 4: Remove collections from search API route**

In `apps/web/src/app/api/pipeline/search/route.ts`, delete lines 41-46:
```typescript
  const { data: collections } = await supabase
    .from('content_collections')
    .select('id, code, name, type')
    .eq('site_id', auth.siteId)
    .or(`name.ilike.%${safeQ}%,code.ilike.%${safeQ}%`)
    .limit(10)
```

And remove line 54 from the response:
```typescript
      collections: collections ?? [],
```

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-search-dropdown.tsx" apps/web/src/app/api/pipeline/search/route.ts
git commit -m "chore: remove collections from pipeline search"
```

---

### Task 9: Clean up remaining API routes

**Files:**
- Modify: `apps/web/src/app/api/pipeline/route.ts:18-22,35-37` — remove collection API docs
- Modify: `apps/web/src/app/api/pipeline/topics/[code]/route.ts:27-42,50` — remove collection lookup
- Modify: `apps/web/src/app/api/pipeline/items/route.ts:24,33` — remove memberships SELECT + filter
- Modify: `apps/web/src/app/api/pipeline/items/[id]/route.ts:20` — remove memberships from SELECT
- Modify: `apps/web/src/app/api/pipeline/items/bulk/route.ts:59,84-90` — remove move_collection

- [ ] **Step 1: Remove collection endpoints from API docs**

In `apps/web/src/app/api/pipeline/route.ts`, delete lines 18-22:
```typescript
      { method: 'GET', path: '/api/pipeline/collections', description: 'List collections' },
      { method: 'GET', path: '/api/pipeline/collections/:id', description: 'Get collection with members' },
      { method: 'POST', path: '/api/pipeline/collections', description: 'Create collection' },
      { method: 'PUT', path: '/api/pipeline/collections/:id', description: 'Update collection' },
      { method: 'DELETE', path: '/api/pipeline/collections/:id', description: 'Delete collection' },
```

And delete lines 35-37:
```typescript
      { method: 'GET', path: '/api/pipeline/collections/:id/members', description: 'List collection members' },
      { method: 'POST', path: '/api/pipeline/collections/:id/members', description: 'Add members to collection' },
      { method: 'DELETE', path: '/api/pipeline/collections/:id/members', description: 'Remove member from collection' },
```

- [ ] **Step 2: Remove collections from topics API**

In `apps/web/src/app/api/pipeline/topics/[code]/route.ts`, delete lines 27-42:
```typescript
  const { data: collection } = await supabase
    .from('content_collections')
    .select('id, code, name, type')
    .eq('site_id', auth.siteId)
    .eq('code', code)
    .maybeSingle()

  let collectionMembers: unknown[] = []
  if (collection) {
    const { data } = await supabase
      .from('content_pipeline_memberships')
      .select('position, content_pipeline(id, code, title_pt, format, stage)')
      .eq('collection_id', collection.id)
      .order('position')
    collectionMembers = data ?? []
  }
```

And delete line 50:
```typescript
      collection: collection ? { ...collection, members: collectionMembers } : null,
```

> **Note:** The Cowork pipeline reference doc does NOT reference the topics `collection` field, so safe for the Cowork consumer.

- [ ] **Step 3: Remove collection from items list route**

In `apps/web/src/app/api/pipeline/items/route.ts`, change line 24:
```typescript
    .select('*, content_pipeline_memberships(collection_id)', { count: 'exact' })
```
to:
```typescript
    .select('*', { count: 'exact' })
```

And remove line 33:
```typescript
    collection: params.get('collection') || undefined,
```

- [ ] **Step 4: Remove memberships from items detail route**

In `apps/web/src/app/api/pipeline/items/[id]/route.ts`, change line 20:
```typescript
    .select('*, content_pipeline_memberships(collection_id, position, role, content_collections(id, code, name, type))')
```
to:
```typescript
    .select('*')
```

- [ ] **Step 5: Remove move_collection from bulk route**

In `apps/web/src/app/api/pipeline/items/bulk/route.ts`, delete line 59 (validation case):
```typescript
    } else if (op.op === 'move_collection') {
      validated.push({ op })
    }
```

And delete lines 84-90 (execution case):
```typescript
      } else if (op.op === 'move_collection') {
        const { error } = await supabase
          .from('content_pipeline_memberships')
          .upsert({ pipeline_id: op.id, collection_id: op.data.collection_id, position: op.data.position }, { onConflict: 'pipeline_id,collection_id' })
        if (error) { results.push({ id: op.id, ok: false, error: error.message }); continue }
        results.push({ id: op.id, ok: true })
      }
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/pipeline/
git commit -m "chore: remove collections from all API routes"
```

---

### Task 10: Remove collection schemas, actions, and query helpers

**Files:**
- Modify: `apps/web/src/lib/pipeline/schemas.ts:10-11,113-123,153`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/actions.ts:9,304-371`
- Modify: `apps/web/src/lib/pipeline/queries.ts:44,98-100`

> **Why last among source files:** `actions.ts` imports `CollectionCreateSchema` and `CollectionUpdateSchema` from `schemas.ts`. Both must be removed in the same commit. We place this AFTER API/page cleanup because earlier tasks don't directly import these schemas.

- [ ] **Step 1: Remove collection types and schemas**

In `apps/web/src/lib/pipeline/schemas.ts`:

Delete lines 10-11:
```typescript
export const COLLECTION_TYPES = ['playlist', 'category', 'series', 'arc', 'launch'] as const
export type CollectionType = (typeof COLLECTION_TYPES)[number]
```

Delete lines 113-123:
```typescript
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
```

Remove the `move_collection` entry from BulkOperationSchema (line 153):
```typescript
    z.object({ op: z.literal('move_collection'), id: z.string().uuid(), data: z.object({ collection_id: z.string().uuid(), position: z.number().int() }) }),
```

- [ ] **Step 2: Remove collection imports and actions**

In `apps/web/src/app/cms/(authed)/pipeline/actions.ts`, change line 9:
```typescript
import { PipelineItemCreateSchema, PipelineItemUpdateSchema, CollectionCreateSchema, CollectionUpdateSchema } from '@/lib/pipeline/schemas'
```
to:
```typescript
import { PipelineItemCreateSchema, PipelineItemUpdateSchema } from '@/lib/pipeline/schemas'
```

Delete lines 304-371 (functions `createCollection`, `updateCollection`, `addToCollection`, `removeFromCollection`).

- [ ] **Step 3: Remove collection filter from queries**

In `apps/web/src/lib/pipeline/queries.ts`:

Delete `collection?: string` from the filters interface (line 44).

Delete lines 98-100:
```typescript
  if (filters.collection) {
    query = query.filter('content_pipeline_memberships.collection_id', 'eq', filters.collection)
  }
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/pipeline/schemas.ts "apps/web/src/app/cms/(authed)/pipeline/actions.ts" apps/web/src/lib/pipeline/queries.ts
git commit -m "chore: remove collection schemas, actions, and query helpers"
```

---

### Task 11: Update all tests

**Files:**
- Modify: `apps/web/test/lib/pipeline-schemas.test.ts:11,84-103`
- Modify: `apps/web/test/lib/pipeline-validation.test.ts:15,35,58,76`
- Modify: `apps/web/test/integration/pipeline.test.ts:13,23-25,162-198`
- Modify: `apps/web/test/api/pipeline-search.test.ts:75-87`
- Modify: `apps/web/test/app/cms/pipeline/gem-card.test.tsx:30,87`
- Modify: `apps/web/test/app/cms/pipeline/pipeline-filter-bar.test.tsx:13-14,21`
- Modify: `apps/web/test/app/cms/pipeline/pipeline-search-dropdown.test.tsx:29,41,52`
- Modify: `apps/web/test/cms/pipeline-item-detail.test.tsx:53,80`
- Modify: `apps/web/test/cms/blog/hub-utils.test.ts:51,101`
- Modify: `apps/web/test/cms/pipeline-board.test.tsx:40,53,69,75-84`

- [ ] **Step 1: Remove CollectionCreateSchema tests**

In `apps/web/test/lib/pipeline-schemas.test.ts`:

Remove `CollectionCreateSchema` from the import block (line 11).

Delete lines 84-103 (the entire `describe('CollectionCreateSchema', ...)` block).

- [ ] **Step 2: Update validation score tests**

In `apps/web/test/lib/pipeline-validation.test.ts`:

Remove `memberships_count` from ALL test inputs (4 occurrences at lines 15, 35, 58, 76). Simply delete each `memberships_count: N,` line.

Remove `in_collection` assertions if any exist.

> Note: The "returns 100 for fully complete item" test still passes because `has_tags` now awards 10 points (up from 5), exactly compensating for the removed `in_collection` (5 points).

- [ ] **Step 3: Remove collection membership integration test**

In `apps/web/test/integration/pipeline.test.ts`:

Delete `const createdCollectionIds: string[] = []` (line 13).

Delete the collection cleanup block in afterAll (lines 23-25):
```typescript
    if (createdCollectionIds.length) {
      await db.from('content_collections').delete().in('id', createdCollectionIds)
    }
```

Delete the entire collection membership test (lines 162-198).

- [ ] **Step 4: Remove collection filter test from pipeline-search test**

In `apps/web/test/api/pipeline-search.test.ts`, delete the test at lines 75-87:
```typescript
  it('applyPipelineFilters applies collection filter', async () => {
    ...
  })
```

- [ ] **Step 5: Remove collection_code from gem-card test fixtures**

In `apps/web/test/app/cms/pipeline/gem-card.test.tsx`, remove all `collection_code: null` lines from test item fixtures (lines 30, 87).

- [ ] **Step 6: Remove collections prop from PipelineFilterBar tests**

In `apps/web/test/app/cms/pipeline/pipeline-filter-bar.test.tsx`:

Line 13: Update test description from `'renders filter chips for collection, language, priority'` to `'renders filter chips for language, priority, link'`.

Lines 14 and 21: Remove `collections` prop from render calls:
```typescript
    render(<PipelineFilterBar collections={[{ code: 'playlist-a', name: 'Playlist A' }]} />)
```
→
```typescript
    render(<PipelineFilterBar />)
```

Line 15: Replace assertion:
```typescript
    expect(screen.getByText('Collection')).toBeDefined()
```
→
```typescript
    expect(screen.getByText('Vínculo')).toBeDefined()
```

- [ ] **Step 7: Remove collections from PipelineSearchDropdown test mocks**

In `apps/web/test/app/cms/pipeline/pipeline-search-dropdown.test.tsx`, remove `collections: []` from all mock response data (lines 29, 41, 52):

```typescript
json: async () => ({ data: { pipeline: [...], blog_posts: [], newsletters: [], collections: [] } }),
```
→
```typescript
json: async () => ({ data: { pipeline: [...], blog_posts: [], newsletters: [] } }),
```

Apply to all 3 occurrences.

- [ ] **Step 8: Remove collections prop from PipelineItemDetail tests**

In `apps/web/test/cms/pipeline-item-detail.test.tsx`, remove `collections={[]}` from both render calls (lines 53, 80):

```typescript
        collections={[]}
```
Delete these lines from both test cases.

- [ ] **Step 9: Remove collection_code from hub-utils test fixtures**

In `apps/web/test/cms/blog/hub-utils.test.ts`, remove all `collection_code: null` lines from test fixtures (lines 51, 101).

- [ ] **Step 10: Remove collections from pipeline-board test**

In `apps/web/test/cms/pipeline-board.test.tsx`:
- Remove `collection_code: null` from the `makeItem` base fixture (line 40)
- Remove `collections={[]}` from all `<PipelineBoard>` render calls (lines 53, 69)
- Delete the entire collection filter test (lines 75-84):
```typescript
  it('filters by collection_code when collection query param is set', async () => {
    ...
  })
```

- [ ] **Step 11: Commit**

```bash
git add apps/web/test/
git commit -m "chore: update tests for collections removal"
```

---

### Task 12: TypeScript verification + test suite

- [ ] **Step 1: Run TypeScript type-check**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -50`
Expected: 0 errors

If errors found, fix each one. Common issues:
- Unused imports that were only needed for collection code
- Props type mismatches where collections were removed from interfaces
- Object literal excess property errors

- [ ] **Step 2: Run test suite**

Run: `npm run test:web`
Expected: All tests pass.

- [ ] **Step 3: Fix any failures**

If tests fail, investigate and fix. Most likely causes:
- Snapshot tests that reference collection UI elements
- Import errors from deleted files
- Validation score expected values (has_tags now worth 10 instead of 5)

- [ ] **Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix: resolve type/test errors from collections removal"
```

---

### Task 13: Create database migration

**Files:**
- Create: `supabase/migrations/<timestamp>_drop_collections.sql`

- [ ] **Step 1: Create the migration**

Run: `npm run db:new drop_collections`

- [ ] **Step 2: Write the migration SQL**

```sql
-- Drop collection tables (never used in production — zero rows)
-- Junction table first (has FK to content_collections)
DROP TABLE IF EXISTS public.content_pipeline_memberships CASCADE;
DROP TABLE IF EXISTS public.content_collections CASCADE;
```

- [ ] **Step 3: Verify migration locally (if DB is running)**

Run: `npm run db:reset` (only if local DB available)
Expected: Clean reset with no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "chore: drop content_collections and content_pipeline_memberships tables"
```

---

### Task 14: Final verification

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: 0 errors

- [ ] **Step 2: Full test suite**

Run: `npm run test:web`
Expected: All pass

- [ ] **Step 3: Start dev server and verify UI**

Run: `npm run dev --workspace apps/web`

Manual checks:
1. `/cms/pipeline` — overview loads without playlists section, no errors
2. `/cms/pipeline/video` — board loads, filters work (no Collection filter chip)
3. Click any pipeline item — detail page loads without collection badges
4. Pipeline search works (no Collections section in results)
5. Sidebar has no "Collections" entry
6. `/cms/pipeline/collections` — returns 404
7. `/cms/playlists` — still works (independent feature, unaffected)

- [ ] **Step 4: Grep for orphaned references**

```bash
grep -rn 'content_collections\|content_pipeline_memberships\|CollectionCreate\|CollectionUpdate\|collection_code\|COLLECTION_TYPES\|CollectionType\|in_collection\|memberships_count\|FolderOpen' apps/web/src/ apps/web/test/ --include='*.ts' --include='*.tsx'
```

Expected: Zero matches (only the migration file should reference these).
