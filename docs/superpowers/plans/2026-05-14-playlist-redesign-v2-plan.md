# Playlist Redesign v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the CMS playlist editor with new video content type, V7 node design, filter system, print/export, and improved auto-layout.

**Architecture:** Foundation-first approach — types and pure functions first, then visual components bottom-up (node → edge → sidebar → filter bar → toolbar → canvas orchestrator → supporting components). 17 tasks, each producing a **compilable** commit. Component interface changes include their canvas.tsx call-site update in the same task to maintain TypeScript compilation at every commit. Filter state lives in canvas orchestrator and flows down via props. Print view is a separate hidden div toggled by `@media print` CSS.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, TypeScript 5, Vitest, Supabase PostgreSQL

**Spec:** `docs/superpowers/specs/2026-05-14-playlist-redesign-v2-design.md`

---

## File Map

### Modified Files

| File | Changes |
|------|---------|
| `apps/web/src/lib/playlists/types.ts` | Add `'video'` to `CONTENT_TYPES`, add `language` to `PlaylistItemEnriched`, add `FilterState` interface, add `FILTER_LANGUAGES` const |
| `apps/web/src/lib/playlists/queries.ts` | Update `resolveContentType()` to detect video via pipeline format, add `language` to enrichment, join `newsletter_types.locale`, add `language` to pipeline select |
| `apps/web/src/lib/playlists/canvas/utils.ts` | Change `NODE_WIDTH` from 160 to 250, update `fitAllNodes` default `nodeWidth` from 180 to 250 |
| `apps/web/src/lib/playlists/canvas/auto-layout.ts` | Update `LAYER_GAP_X=370`, `NODE_GAP_Y=103`, `ORPHAN_GAP_Y=140`, add `NODE_W=250`, add `DIMMED_OFFSET_Y=120` (exported) |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-node.tsx` | Full rewrite — left stripe, max-width 250px, 2-line clamp, language badge, 5 visual states, open button |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-edge.tsx` | Add circle marker for `related`, update stroke color from gray to purple, add opacity props for filter dimming |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/context-menu.tsx` | Full rewrite — header with type badge, 7 menu items with icons/shortcuts, footer with UUID/date |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-sidebar.tsx` | Add search input, grouped items, order numbers, language badges, dim/hide support |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-toolbar.tsx` | Replace single export button with export dropdown, add print button |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx` | Add `FilterState` to state, wire filter bar, pass view numbers to nodes/sidebar, integrate print div, update edge opacity, keyboard shortcuts for E/M/N |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-minimap.tsx` | Add video type color (#ef4444), update NODE_W from 160 to 250 |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/content-picker.tsx` | Add video tab, TYPE_DOT, TYPE_LABEL entries |

### New Files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/playlists/canvas/view-numbers.ts` | `computeViewNumbers()` + `matchesFilter()` pure functions |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/filter-bar.tsx` | Type chips, language chips, mode toggle (Dim/Hide/All) |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/print-view.tsx` | Light-theme list for `@media print` |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/export-menu.tsx` | Dropdown with Print / PNG / CSV / JSON |

### Test Files

| File | Tests |
|------|-------|
| `apps/web/test/lib/playlists/view-numbers.test.ts` | `computeViewNumbers()` and `matchesFilter()` |
| `apps/web/test/lib/playlists/auto-layout.test.ts` | Updated constants validation |
| `apps/web/test/lib/playlists/types.test.ts` | CONTENT_TYPES includes video, FilterState type check |
| `apps/web/test/lib/playlists/queries.test.ts` | normalizeLang, resolveContentType with video format |
| `apps/web/test/cms/playlist-node.test.tsx` | V7 node rendering, all 5 visual states |
| `apps/web/test/cms/playlist-filter-bar.test.tsx` | Chip toggling, counts, mode switching |
| `apps/web/test/cms/playlist-context-menu.test.tsx` | Menu items, keyboard shortcuts, actions |
| `apps/web/test/cms/playlist-export.test.tsx` | CSV/JSON generation, filter-aware numbering |

---

### Task 1: Types Foundation — video, language, FilterState

**Files:**
- Modify: `apps/web/src/lib/playlists/types.ts`
- Test: `apps/web/test/lib/playlists/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/playlists/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { CONTENT_TYPES, FILTER_LANGUAGES } from '@/lib/playlists/types'
import type { ContentType, FilterState, PlaylistItemEnriched } from '@/lib/playlists/types'

describe('playlist types', () => {
  it('CONTENT_TYPES includes video', () => {
    expect(CONTENT_TYPES).toContain('video')
  })

  it('CONTENT_TYPES has 4 entries', () => {
    expect(CONTENT_TYPES).toHaveLength(4)
    expect(CONTENT_TYPES).toEqual(['blog_post', 'newsletter', 'pipeline', 'video'])
  })

  it('FILTER_LANGUAGES is pt-br and en', () => {
    expect(FILTER_LANGUAGES).toEqual(['pt-br', 'en'])
  })

  it('ContentType union accepts video', () => {
    const ct: ContentType = 'video'
    expect(ct).toBe('video')
  })

  it('FilterState has correct shape', () => {
    const filter: FilterState = {
      types: new Set(['video', 'blog_post']),
      languages: new Set(['pt-br']),
      mode: 'dim',
      search: '',
    }
    expect(filter.types.has('video')).toBe(true)
    expect(filter.mode).toBe('dim')
  })

  it('PlaylistItemEnriched includes language field', () => {
    const item = {
      id: '1', playlist_id: '1', blog_post_id: null, newsletter_edition_id: null,
      pipeline_id: null, sort_order: 0, position_x: 0, position_y: 0, created_at: '',
      content_type: 'video' as ContentType, title: 'Test', status: null,
      category: null, metadata: null, is_ghost: false, other_playlist_count: 0,
      language: 'pt-br' as const,
    } satisfies PlaylistItemEnriched
    expect(item.language).toBe('pt-br')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/playlists/types.test.ts`
Expected: FAIL — `'video'` not in CONTENT_TYPES, `FILTER_LANGUAGES` and `FilterState` don't exist, `language` not on `PlaylistItemEnriched`

- [ ] **Step 3: Implement types changes**

In `apps/web/src/lib/playlists/types.ts`, make these changes:

1. Add `'video'` to CONTENT_TYPES:
```typescript
export const CONTENT_TYPES = ['blog_post', 'newsletter', 'pipeline', 'video'] as const
```

2. Add `FILTER_LANGUAGES` after CONTENT_TYPES:
```typescript
export const FILTER_LANGUAGES = ['pt-br', 'en'] as const
export type FilterLanguage = (typeof FILTER_LANGUAGES)[number]
```

3. Add `language` to `PlaylistItemEnriched`:
```typescript
export interface PlaylistItemEnriched extends PlaylistItemRow {
  content_type: ContentType | null
  title: string
  status: string | null
  category: string | null
  metadata: string | null
  is_ghost: boolean
  other_playlist_count: number
  language: 'pt-br' | 'en' | null
}
```

4. Add `FilterState` after `ActionResult`:
```typescript
export interface FilterState {
  types: Set<ContentType>
  languages: Set<FilterLanguage>
  mode: 'dim' | 'hide' | 'all'
  search: string
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/playlists/types.test.ts`
Expected: PASS — all 6 tests green

- [ ] **Step 5: Fix existing tests that reference PlaylistItemEnriched**

Search the codebase for tests that construct `PlaylistItemEnriched` objects. Every factory/fixture that builds one needs `language: null` added. Run `grep -rn 'PlaylistItemEnriched\|content_type.*blog_post\|content_type.*newsletter\|content_type.*pipeline\|is_ghost.*false\|other_playlist_count' apps/web/test/` to find them. Add `language: null` to each.

- [ ] **Step 6: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/playlists/types.ts apps/web/test/lib/playlists/types.test.ts
# Also add any test files modified in step 5
git commit -m "feat(playlists): add video content type, language field, and FilterState"
```

---

### Task 2: View Numbers — computeViewNumbers and matchesFilter

**Files:**
- Create: `apps/web/src/lib/playlists/canvas/view-numbers.ts`
- Test: `apps/web/test/lib/playlists/view-numbers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/playlists/view-numbers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeViewNumbers, matchesFilter } from '@/lib/playlists/canvas/view-numbers'
import type { PlaylistItemEnriched, FilterState } from '@/lib/playlists/types'

function makeItem(overrides: Partial<PlaylistItemEnriched> & { id: string; sort_order: number }): PlaylistItemEnriched {
  return {
    playlist_id: 'p1', blog_post_id: null, newsletter_edition_id: null,
    pipeline_id: null, position_x: 0, position_y: 0, created_at: '',
    content_type: 'blog_post', title: 'Test', status: null,
    category: null, metadata: null, is_ghost: false,
    other_playlist_count: 0, language: null,
    ...overrides,
  }
}

const ALL_FILTER: FilterState = { types: new Set(), languages: new Set(), mode: 'all', search: '' }

describe('matchesFilter', () => {
  it('matches everything when filter is empty (all mode)', () => {
    const item = makeItem({ id: '1', sort_order: 1 })
    expect(matchesFilter(item, ALL_FILTER)).toBe(true)
  })

  it('filters by content type', () => {
    const filter: FilterState = { types: new Set(['video']), languages: new Set(), mode: 'dim', search: '' }
    const blogItem = makeItem({ id: '1', sort_order: 1, content_type: 'blog_post' })
    const videoItem = makeItem({ id: '2', sort_order: 2, content_type: 'video' })
    expect(matchesFilter(blogItem, filter)).toBe(false)
    expect(matchesFilter(videoItem, filter)).toBe(true)
  })

  it('filters by language', () => {
    const filter: FilterState = { types: new Set(), languages: new Set(['pt-br']), mode: 'dim', search: '' }
    const ptItem = makeItem({ id: '1', sort_order: 1, language: 'pt-br' })
    const enItem = makeItem({ id: '2', sort_order: 2, language: 'en' })
    const noLangItem = makeItem({ id: '3', sort_order: 3, language: null })
    expect(matchesFilter(ptItem, filter)).toBe(true)
    expect(matchesFilter(enItem, filter)).toBe(false)
    expect(matchesFilter(noLangItem, filter)).toBe(false)
  })

  it('combines type and language filters (AND logic)', () => {
    const filter: FilterState = { types: new Set(['video']), languages: new Set(['pt-br']), mode: 'dim', search: '' }
    const match = makeItem({ id: '1', sort_order: 1, content_type: 'video', language: 'pt-br' })
    const wrongType = makeItem({ id: '2', sort_order: 2, content_type: 'blog_post', language: 'pt-br' })
    const wrongLang = makeItem({ id: '3', sort_order: 3, content_type: 'video', language: 'en' })
    expect(matchesFilter(match, filter)).toBe(true)
    expect(matchesFilter(wrongType, filter)).toBe(false)
    expect(matchesFilter(wrongLang, filter)).toBe(false)
  })

  it('filters by search term (case-insensitive)', () => {
    const filter: FilterState = { types: new Set(), languages: new Set(), mode: 'dim', search: 'react' }
    const match = makeItem({ id: '1', sort_order: 1, title: 'Learn React Hooks' })
    const noMatch = makeItem({ id: '2', sort_order: 2, title: 'Vue Composition API' })
    expect(matchesFilter(match, filter)).toBe(true)
    expect(matchesFilter(noMatch, filter)).toBe(false)
  })

  it('ghost items never match', () => {
    const item = makeItem({ id: '1', sort_order: 1, is_ghost: true })
    expect(matchesFilter(item, ALL_FILTER)).toBe(false)
  })
})

describe('computeViewNumbers', () => {
  it('returns sequential numbers for all items when no filter', () => {
    const items = [
      makeItem({ id: 'a', sort_order: 1000 }),
      makeItem({ id: 'b', sort_order: 2000 }),
      makeItem({ id: 'c', sort_order: 3000 }),
    ]
    const result = computeViewNumbers(items, ALL_FILTER)
    expect(result.get('a')).toBe(1)
    expect(result.get('b')).toBe(2)
    expect(result.get('c')).toBe(3)
  })

  it('renumbers based on filtered subset', () => {
    const items = [
      makeItem({ id: 'a', sort_order: 1000, content_type: 'video', language: 'pt-br' }),
      makeItem({ id: 'b', sort_order: 2000, content_type: 'blog_post', language: 'en' }),
      makeItem({ id: 'c', sort_order: 3000, content_type: 'video', language: 'pt-br' }),
    ]
    const filter: FilterState = { types: new Set(['video']), languages: new Set(), mode: 'dim', search: '' }
    const result = computeViewNumbers(items, filter)
    expect(result.get('a')).toBe(1)
    expect(result.get('b')).toBeNull()
    expect(result.get('c')).toBe(2)
  })

  it('respects sort_order for numbering, not array order', () => {
    const items = [
      makeItem({ id: 'c', sort_order: 3000, content_type: 'video' }),
      makeItem({ id: 'a', sort_order: 1000, content_type: 'video' }),
    ]
    const result = computeViewNumbers(items, ALL_FILTER)
    expect(result.get('a')).toBe(1)
    expect(result.get('c')).toBe(2)
  })

  it('returns empty map for empty items', () => {
    const result = computeViewNumbers([], ALL_FILTER)
    expect(result.size).toBe(0)
  })

  it('ghost items get null', () => {
    const items = [
      makeItem({ id: 'a', sort_order: 1000 }),
      makeItem({ id: 'b', sort_order: 2000, is_ghost: true }),
    ]
    const result = computeViewNumbers(items, ALL_FILTER)
    expect(result.get('a')).toBe(1)
    expect(result.get('b')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/playlists/view-numbers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement view-numbers.ts**

Create `apps/web/src/lib/playlists/canvas/view-numbers.ts`:

```typescript
import type { PlaylistItemEnriched, FilterState } from '../types'

export function matchesFilter(item: PlaylistItemEnriched, filter: FilterState): boolean {
  if (item.is_ghost) return false

  if (filter.types.size > 0 && (item.content_type === null || !filter.types.has(item.content_type))) {
    return false
  }

  if (filter.languages.size > 0 && (item.language === null || !filter.languages.has(item.language))) {
    return false
  }

  if (filter.search.length > 0 && !item.title.toLowerCase().includes(filter.search.toLowerCase())) {
    return false
  }

  return true
}

export function computeViewNumbers(
  items: PlaylistItemEnriched[],
  filter: FilterState,
): Map<string, number | null> {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)
  const result = new Map<string, number | null>()
  let counter = 1

  for (const item of sorted) {
    if (matchesFilter(item, filter)) {
      result.set(item.id, counter++)
    } else {
      result.set(item.id, null)
    }
  }

  return result
}
```

- [ ] **Step 4: Export from canvas barrel**

In `apps/web/src/lib/playlists/canvas/index.ts`, add:
```typescript
export { computeViewNumbers, matchesFilter } from './view-numbers'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/playlists/view-numbers.test.ts`
Expected: PASS — all 11 tests green

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/playlists/canvas/view-numbers.ts apps/web/src/lib/playlists/canvas/index.ts apps/web/test/lib/playlists/view-numbers.test.ts
git commit -m "feat(playlists): add computeViewNumbers and matchesFilter"
```

---

### Task 3: Queries — video resolution and language enrichment

**Files:**
- Modify: `apps/web/src/lib/playlists/queries.ts`
- Create: `apps/web/test/lib/playlists/queries.test.ts`

- [ ] **Step 1: Write the failing tests for normalizeLang and resolveContentType**

Create `apps/web/test/lib/playlists/queries.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

// normalizeLang is private, so we test it indirectly via a re-exported test helper.
// We also create a standalone test for the pure logic.
import { normalizeLang } from '@/lib/playlists/queries'

describe('normalizeLang', () => {
  it('normalizes pt-BR to pt-br', () => {
    expect(normalizeLang('pt-BR')).toBe('pt-br')
  })

  it('normalizes pt to pt-br', () => {
    expect(normalizeLang('pt')).toBe('pt-br')
  })

  it('normalizes en-US to en', () => {
    expect(normalizeLang('en-US')).toBe('en')
  })

  it('normalizes EN to en', () => {
    expect(normalizeLang('EN')).toBe('en')
  })

  it('returns null for null input', () => {
    expect(normalizeLang(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(normalizeLang(undefined)).toBeNull()
  })

  it('returns null for unknown locale', () => {
    expect(normalizeLang('fr')).toBeNull()
  })
})
```

Note: `normalizeLang` must be exported from `queries.ts` for testing. Mark it as `export` in the implementation step.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/playlists/queries.test.ts`
Expected: FAIL — `normalizeLang` not exported or not found

- [ ] **Step 3: Update ref interfaces**

In `queries.ts`, update `PipelineRef` to include `language`:
```typescript
interface PipelineRef {
  id: string
  title_pt: string | null
  title_en: string | null
  format: string | null
  stage: string | null
  version: number
  language: string | null
}
```

Add `NewsletterRef` join type to include locale:
```typescript
interface NewsletterRef {
  id: string
  subject: string
  status: string | null
  edition_kind: string | null
  newsletter_types: { locale: string } | null
}
```

- [ ] **Step 4: Update resolveContentType to accept pipeline format**

Replace the function (currently lines 103-108):
```typescript
function resolveContentType(
  item: PlaylistItemRow,
  pipelineMap: Map<string, PipelineRef>,
): ContentType | null {
  if (item.blog_post_id) return 'blog_post'
  if (item.newsletter_edition_id) return 'newsletter'
  if (item.pipeline_id) {
    const pl = pipelineMap.get(item.pipeline_id)
    if (pl?.format === 'video' || pl?.format === 'ig_reel') return 'video'
    return 'pipeline'
  }
  return null
}
```

- [ ] **Step 5: Update enrichment queries to fetch language data**

In `enrichItems()`, update the newsletter select (line 169) to join `newsletter_types`:
```typescript
newsletterIds.length > 0
  ? supabase
      .from('newsletter_editions')
      .select('id, subject, status, edition_kind, newsletter_types(locale)')
      .in('id', newsletterIds)
  : { data: [] },
```

Update the pipeline select (line 175) to include `language`:
```typescript
pipelineIds.length > 0
  ? supabase
      .from('content_pipeline')
      .select('id, title_pt, title_en, format, stage, version, language')
      .in('id', pipelineIds)
  : { data: [] },
```

- [ ] **Step 6: Update enrichment mapping to populate language**

In the `items.map()` block (line 201), update `resolveContentType` call to pass `pipelineMap`:
```typescript
const contentType = resolveContentType(item, pipelineMap)
```

Add `language` resolution to each content type branch:

```typescript
let language: 'pt-br' | 'en' | null = null

if (item.blog_post_id && blogMap.has(item.blog_post_id)) {
  const blog = blogMap.get(item.blog_post_id)!
  title = blog.blog_translations?.[0]?.title ?? 'Untitled'
  status = blog.status
  category = blog.category
  language = normalizeLang(blog.blog_translations?.[0]?.locale)
  refId = item.blog_post_id
} else if (item.newsletter_edition_id && newsletterMap.has(item.newsletter_edition_id)) {
  const nl = newsletterMap.get(item.newsletter_edition_id)!
  title = nl.subject
  status = nl.status
  metadata = nl.edition_kind
  language = normalizeLang((nl.newsletter_types as { locale: string } | null)?.locale)
  refId = item.newsletter_edition_id
} else if (item.pipeline_id && pipelineMap.has(item.pipeline_id)) {
  const pl = pipelineMap.get(item.pipeline_id)!
  title = pl.title_pt ?? pl.title_en ?? 'Untitled'
  status = pl.stage
  category = pl.format
  metadata = `v${pl.version}`
  language = normalizeLang(pl.language)
  refId = item.pipeline_id
}
```

Add the return to include `language`:
```typescript
return {
  ...item,
  content_type: contentType,
  title,
  status,
  category,
  metadata,
  is_ghost: isGhost,
  other_playlist_count: refId ? (crossCounts.get(refId) ?? 0) : 0,
  language,
}
```

- [ ] **Step 7: Add normalizeLang helper (exported for testing)**

Add at the top of the file (after imports). Export it so the test can import it directly:
```typescript
export function normalizeLang(locale: string | null | undefined): 'pt-br' | 'en' | null {
  if (!locale) return null
  const lower = locale.toLowerCase()
  if (lower === 'pt-br' || lower === 'pt') return 'pt-br'
  if (lower === 'en' || lower === 'en-us') return 'en'
  return null
}
```

- [ ] **Step 8: Run query tests**

Run: `cd apps/web && npx vitest run test/lib/playlists/queries.test.ts`
Expected: PASS — all 7 normalizeLang tests green

- [ ] **Step 9: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass. Existing test fixtures in other files may need `language: null` if not done in Task 1 Step 5.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/playlists/queries.ts apps/web/test/lib/playlists/queries.test.ts
git commit -m "feat(playlists): resolve video content type and enrich language"
```

---

### Task 4: Auto-Layout Constants + Canvas Utils

**Files:**
- Modify: `apps/web/src/lib/playlists/canvas/auto-layout.ts`
- Modify: `apps/web/src/lib/playlists/canvas/utils.ts`
- Test: `apps/web/test/lib/playlists/auto-layout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/playlists/auto-layout.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeAutoLayout } from '@/lib/playlists/canvas/auto-layout'
import type { PlaylistItemEnriched, PlaylistEdgeRow } from '@/lib/playlists/types'

function makeItem(id: string, sortOrder: number): PlaylistItemEnriched {
  return {
    id, playlist_id: 'p1', blog_post_id: null, newsletter_edition_id: null,
    pipeline_id: null, sort_order: sortOrder, position_x: 0, position_y: 0,
    created_at: '', content_type: 'blog_post', title: `Item ${id}`,
    status: null, category: null, metadata: null, is_ghost: false,
    other_playlist_count: 0, language: null,
  }
}

function makeEdge(source: string, target: string): PlaylistEdgeRow {
  return {
    id: `${source}-${target}`, playlist_id: 'p1',
    source_item_id: source, target_item_id: target,
    edge_type: 'sequence', label: null, created_at: '',
  }
}

describe('computeAutoLayout constants', () => {
  it('uses 370px horizontal gap between layers', () => {
    const items = [makeItem('a', 1), makeItem('b', 2)]
    const edges = [makeEdge('a', 'b')]
    const positions = computeAutoLayout(items, edges)
    const posA = positions.find(p => p.itemId === 'a')!
    const posB = positions.find(p => p.itemId === 'b')!
    expect(posB.x - posA.x).toBe(370)
  })

  it('uses 103px vertical gap within layers', () => {
    const items = [makeItem('a', 1), makeItem('b', 2), makeItem('c', 3)]
    const edges = [makeEdge('a', 'b'), makeEdge('a', 'c')]
    const positions = computeAutoLayout(items, edges)
    const layer1 = positions.filter(p => p.itemId === 'b' || p.itemId === 'c').sort((a, b) => a.y - b.y)
    expect(layer1[1]!.y - layer1[0]!.y).toBe(103)
  })

  it('positions all-disconnected items with NODE_GAP_Y (103px)', () => {
    // When ALL items are disconnected (no edges), auto-layout uses NODE_GAP_Y, not ORPHAN_GAP_Y.
    // ORPHAN_GAP_Y only applies to the orphan section BELOW connected layers.
    const items = [makeItem('a', 1), makeItem('b', 2)]
    const positions = computeAutoLayout(items, [])
    expect(positions[1]!.y - positions[0]!.y).toBe(103)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/playlists/auto-layout.test.ts`
Expected: FAIL — constants are old values (300, 110, 160)

- [ ] **Step 3: Update auto-layout.ts constants**

In `apps/web/src/lib/playlists/canvas/auto-layout.ts` (lines 3-6), replace:
```typescript
const NODE_W = 250
const LAYER_GAP_X = 370
const NODE_GAP_Y = 103
const ORPHAN_COLS = 4
const ORPHAN_GAP_Y = 140
export const DIMMED_OFFSET_Y = 120
```

- [ ] **Step 4: Export DIMMED_OFFSET_Y from canvas barrel**

In `apps/web/src/lib/playlists/canvas/index.ts`, update the auto-layout export:
```typescript
export { computeAutoLayout, DIMMED_OFFSET_Y } from './auto-layout'
```

- [ ] **Step 5: Update utils.ts NODE_WIDTH**

In `apps/web/src/lib/playlists/canvas/utils.ts`, change:
- Line 53: `const NODE_WIDTH = 250` (was 160)
- Line 107: `nodeWidth = 250` (was 180 — default param in `fitAllNodes`)

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/playlists/auto-layout.test.ts`
Expected: PASS

- [ ] **Step 7: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All existing tests pass (node position-based tests may need adjustments)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/playlists/canvas/auto-layout.ts apps/web/src/lib/playlists/canvas/index.ts apps/web/src/lib/playlists/canvas/utils.ts apps/web/test/lib/playlists/auto-layout.test.ts
git commit -m "feat(playlists): update layout constants for 250px nodes"
```

---

### Task 5: Node V7 — Full Rewrite

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-node.tsx`
- Test: `apps/web/test/cms/playlist-node.test.tsx`

- [ ] **Step 1: Write failing tests for the new node**

Create `apps/web/test/cms/playlist-node.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlaylistNode } from '@/app/cms/(authed)/playlists/[id]/_components/playlist-node'
import type { PlaylistItemEnriched, ContentType } from '@/lib/playlists/types'

function makeItem(overrides?: Partial<PlaylistItemEnriched>): PlaylistItemEnriched {
  return {
    id: 'item-1', playlist_id: 'p1', blog_post_id: 'bp1',
    newsletter_edition_id: null, pipeline_id: null,
    sort_order: 1000, position_x: 100, position_y: 200, created_at: '2026-01-01',
    content_type: 'blog_post', title: 'Test Blog Post', status: 'published',
    category: 'tech', metadata: null, is_ghost: false,
    other_playlist_count: 2, language: 'pt-br',
    ...overrides,
  }
}

const defaultProps = {
  isSelected: false,
  isDropTarget: false,
  isDimmed: false,
  isIdea: false,
  viewNumber: 1 as number | null,
  onPointerDown: vi.fn(),
  onHandlePointerDown: vi.fn(),
  onContextMenu: vi.fn(),
  onClick: vi.fn(),
  onOpenContent: vi.fn(),
}

describe('PlaylistNode V7', () => {
  it('renders type badge', () => {
    render(<PlaylistNode item={makeItem()} {...defaultProps} />)
    expect(screen.getByText('BLOG')).toBeTruthy()
  })

  it('renders language badge', () => {
    render(<PlaylistNode item={makeItem({ language: 'pt-br' })} {...defaultProps} />)
    expect(screen.getByText('PT')).toBeTruthy()
  })

  it('renders EN language badge', () => {
    render(<PlaylistNode item={makeItem({ language: 'en' })} {...defaultProps} />)
    expect(screen.getByText('EN')).toBeTruthy()
  })

  it('renders order number in stripe', () => {
    render(<PlaylistNode item={makeItem()} {...defaultProps} viewNumber={3} />)
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('renders --- when viewNumber is null', () => {
    render(<PlaylistNode item={makeItem()} {...defaultProps} viewNumber={null} />)
    expect(screen.getByText('---')).toBeTruthy()
  })

  it('renders cross-playlist count', () => {
    render(<PlaylistNode item={makeItem({ other_playlist_count: 2 })} {...defaultProps} />)
    expect(screen.getByText('+2 playlists')).toBeTruthy()
  })

  it('renders status with dot', () => {
    render(<PlaylistNode item={makeItem({ status: 'published' })} {...defaultProps} />)
    expect(screen.getByText(/published/)).toBeTruthy()
  })

  it('renders VIDEO badge for video type', () => {
    render(<PlaylistNode item={makeItem({ content_type: 'video' })} {...defaultProps} />)
    expect(screen.getByText('VIDEO')).toBeTruthy()
  })

  it('clamps title to 2 lines via CSS class', () => {
    const { container } = render(<PlaylistNode item={makeItem({ title: 'A very long title that should be clamped' })} {...defaultProps} />)
    const titleEl = container.querySelector('[data-testid="node-title"]') ?? container.querySelector('h4')
    expect(titleEl).toBeTruthy()
    expect(titleEl!.className).toContain('line-clamp-2')
  })

  it('sets max-width 250px', () => {
    const { container } = render(<PlaylistNode item={makeItem()} {...defaultProps} />)
    const nodeEl = container.querySelector('[data-node-id]')!
    expect(nodeEl.className).toContain('max-w-[250px]')
  })

  it('applies dimmed state styles', () => {
    const { container } = render(<PlaylistNode item={makeItem()} {...defaultProps} isDimmed={true} />)
    const nodeEl = container.querySelector('[data-node-id]')!
    expect(nodeEl.className).toContain('opacity-[0.12]')
    expect(nodeEl.className).toContain('pointer-events-none')
  })

  it('applies idea state styles', () => {
    const { container } = render(<PlaylistNode item={makeItem()} {...defaultProps} isIdea={true} />)
    const nodeEl = container.querySelector('[data-node-id]')!
    expect(nodeEl.className).toContain('opacity-55')
  })

  it('renders ghost item with dashed border', () => {
    const { container } = render(<PlaylistNode item={makeItem({ is_ghost: true, content_type: null })} {...defaultProps} />)
    const nodeEl = container.querySelector('[data-node-id]')!
    expect(nodeEl.className).toContain('border-dashed')
  })

  it('renders 4 connection handles', () => {
    const { container } = render(<PlaylistNode item={makeItem()} {...defaultProps} />)
    const handles = container.querySelectorAll('[data-handle-id]')
    expect(handles).toHaveLength(4)
  })

  it('fires onOpenContent when open button is clicked', () => {
    const onOpenContent = vi.fn()
    render(<PlaylistNode item={makeItem()} {...defaultProps} onOpenContent={onOpenContent} />)
    const openBtn = screen.getByLabelText('Open in editor')
    fireEvent.click(openBtn)
    expect(onOpenContent).toHaveBeenCalledWith('item-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/playlist-node.test.tsx`
Expected: FAIL — new props (`isDimmed`, `isIdea`, `viewNumber`, `onOpenContent`) don't exist

- [ ] **Step 3: Rewrite playlist-node.tsx**

Replace the entire content of `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-node.tsx`:

```tsx
'use client'

import type { PlaylistItemEnriched, ContentType } from '@/lib/playlists/types'

const TYPE_CONFIG: Record<ContentType, {
  gradient: [string, string]
  badge: string
  borderColor: string
  glowColor: string
}> = {
  video:      { gradient: ['#ef4444', '#dc2626'], badge: 'VIDEO', borderColor: '#ef4444', glowColor: 'rgba(239,68,68,0.20)' },
  blog_post:  { gradient: ['#6366f1', '#4f46e5'], badge: 'BLOG',  borderColor: '#6366f1', glowColor: 'rgba(99,102,241,0.20)' },
  newsletter: { gradient: ['#22c55e', '#16a34a'], badge: 'NEWS',  borderColor: '#22c55e', glowColor: 'rgba(34,197,94,0.20)' },
  pipeline:   { gradient: ['#a855f7', '#9333ea'], badge: 'PIPE',  borderColor: '#a855f7', glowColor: 'rgba(168,85,247,0.20)' },
}

const LANG_CONFIG = {
  'pt-br': { label: 'PT', bg: 'rgba(251,191,36,0.1)', color: '#fbbf24' },
  en:      { label: 'EN', bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' },
} as const

const NODE_W = 250
const STRIPE_W = 26

interface PlaylistNodeProps {
  item: PlaylistItemEnriched
  isSelected: boolean
  isDropTarget: boolean
  isDimmed: boolean
  isIdea: boolean
  viewNumber: number | null
  onPointerDown: (e: React.PointerEvent, itemId: string, x: number, y: number) => void
  onHandlePointerDown: (e: React.PointerEvent, itemId: string, x: number, y: number) => void
  onContextMenu: (e: React.MouseEvent, itemId: string) => void
  onClick: (e: Pick<React.MouseEvent, 'shiftKey'>, itemId: string) => void
  onOpenContent: (itemId: string) => void
}

export function PlaylistNode({
  item, isSelected, isDropTarget, isDimmed, isIdea, viewNumber,
  onPointerDown, onHandlePointerDown, onContextMenu, onClick, onOpenContent,
}: PlaylistNodeProps) {
  const typeConfig = item.content_type ? TYPE_CONFIG[item.content_type] : null
  const langConfig = item.language ? LANG_CONFIG[item.language] : null
  const borderColor = typeConfig?.borderColor ?? '#ffffff20'

  const stateClasses = isDimmed
    ? 'opacity-[0.12] saturate-[0.15] pointer-events-none'
    : isIdea
      ? 'opacity-55 saturate-[0.6]'
      : ''

  const selectionClasses = isSelected
    ? 'ring-2 ring-offset-1 ring-offset-transparent shadow-lg'
    : isDropTarget
      ? 'ring-2 ring-offset-1 ring-offset-transparent shadow-lg'
      : ''

  return (
    <div
      data-node-id={item.id}
      data-pos-x={item.position_x}
      data-pos-y={item.position_y}
      role="button"
      aria-label={`${typeConfig?.badge ?? 'Ghost'}: ${item.title}, ${item.status ?? 'removed'}`}
      tabIndex={0}
      className={`group absolute flex max-w-[250px] min-w-[200px] cursor-grab rounded-xl border-[1.5px] select-none transition-shadow ${stateClasses} ${selectionClasses} ${item.is_ghost ? 'border-dashed border-white/20 bg-white/[0.02]' : ''}`}
      style={{
        transform: `translate(${item.position_x}px, ${item.position_y}px)`,
        borderColor: item.is_ghost ? undefined : borderColor,
        boxShadow: isSelected
          ? `0 0 0 2.5px ${typeConfig?.glowColor ?? 'rgba(255,255,255,0.1)'}, 0 1px 3px rgba(0,0,0,0.3)`
          : '0 1px 3px rgba(0,0,0,0.3)',
      }}
      onPointerDown={e => onPointerDown(e, item.id, item.position_x, item.position_y)}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e, item.id) }}
      onClick={e => onClick(e, item.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick({ shiftKey: e.shiftKey }, item.id) } }}
    >
      {/* Connection handles */}
      {([
        { pos: 'top-[-6px] left-1/2 -translate-x-1/2', hx: item.position_x + NODE_W / 2, hy: item.position_y },
        { pos: 'bottom-[-6px] left-1/2 -translate-x-1/2', hx: item.position_x + NODE_W / 2, hy: item.position_y + 80 },
        { pos: 'left-[-6px] top-1/2 -translate-y-1/2', hx: item.position_x, hy: item.position_y + 40 },
        { pos: 'right-[-6px] top-1/2 -translate-y-1/2', hx: item.position_x + NODE_W, hy: item.position_y + 40 },
      ] as const).map((h, i) => (
        <div
          key={i}
          data-handle-id={item.id}
          className={`absolute ${h.pos} h-[11px] w-[11px] cursor-crosshair rounded-full border-[2.5px] border-[var(--bg,#0a0a12)] opacity-0 transition-all group-hover:scale-110 group-hover:opacity-100 hover:!scale-150`}
          style={{ backgroundColor: typeConfig?.borderColor ?? '#ffffff30' }}
          onPointerDown={e => onHandlePointerDown(e, item.id, h.hx, h.hy)}
        />
      ))}

      {/* Left stripe with order number */}
      <div
        className="flex w-[26px] flex-shrink-0 items-center justify-center rounded-l-[9px] text-xs font-bold text-white"
        style={{
          background: typeConfig
            ? `linear-gradient(180deg, ${typeConfig.gradient[0]}, ${typeConfig.gradient[1]})`
            : '#333',
          minHeight: '100%',
        }}
      >
        {viewNumber !== null ? viewNumber : '---'}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {/* Header */}
        {typeConfig && !item.is_ghost && (
          <div className="flex items-center gap-1.5 px-2 py-1 text-[0.62rem]" style={{ backgroundColor: `${typeConfig.borderColor}10` }}>
            <span className="rounded px-1 py-px text-[0.6rem] font-bold text-white" style={{ backgroundColor: typeConfig.borderColor }}>
              {typeConfig.badge}
            </span>
            {langConfig && (
              <span className="rounded px-1 py-px text-[0.6rem] font-semibold" style={{ backgroundColor: langConfig.bg, color: langConfig.color }}>
                {langConfig.label}
              </span>
            )}
            <span className="flex-1 truncate text-white/40">{item.category ?? ''}</span>
            {/* Open button */}
            <button
              type="button"
              aria-label="Open in editor"
              className="flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
              onClick={e => { e.stopPropagation(); onOpenContent(item.id) }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-2 py-1.5">
          <h4
            data-testid="node-title"
            className={`line-clamp-2 text-sm font-semibold leading-tight ${item.is_ghost ? 'text-white/30' : 'text-white'}`}
          >
            {item.title}
          </h4>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-1 border-t border-white/5 px-2 py-1 text-[0.62rem] text-white/40">
          {item.status && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.status === 'published' ? '#22c55e' : item.status === 'draft' ? '#fbbf24' : '#6b7280' }} />
              {item.status}
            </span>
          )}
          {item.other_playlist_count > 0 && (
            <>
              {item.status && <span className="text-white/20">&middot;</span>}
              <span>+{item.other_playlist_count} playlist{item.other_playlist_count > 1 ? 's' : ''}</span>
            </>
          )}
        </div>

        {/* Pipeline version badge — spec calls for step N/M progress bar, but
            pipeline metadata is "v3" (version number), not "step 3/7". Rendering
            a progress bar would require joining pipeline_workflows to get position/total,
            which is deferred. For now, show the version badge. */}
        {(item.content_type === 'pipeline' || item.content_type === 'video') && item.metadata && (
          <div className="px-2 pb-1.5">
            <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[0.55rem] font-semibold text-purple-400">
              {item.metadata}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/playlist-node.test.tsx`
Expected: PASS — all 15 tests green

- [ ] **Step 5: Update PlaylistNode call site in playlist-canvas.tsx to keep TypeScript compiling**

In `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx`, update the `PlaylistNode` rendering (around line 698-712) to pass the new required props with stub values. This keeps the build compiling while the full integration happens in Task 13.

Find the `PlaylistNode` render block and update it:
```tsx
{state.items.map(item => (
  <PlaylistNode
    key={item.id}
    item={item}
    isSelected={state.selectedItemIds.has(item.id)}
    isDropTarget={
      edgeDrag.dragEdge.active &&
      edgeDrag.dragEdge.sourceItemId !== item.id
    }
    isDimmed={false}
    isIdea={!item.is_ghost && item.status === 'idea'}
    viewNumber={null}
    onPointerDown={dragNode.handlePointerDown}
    onHandlePointerDown={edgeDrag.handleHandlePointerDown}
    onContextMenu={handleContextMenu}
    onClick={handleNodeClick}
    onOpenContent={() => {}}
  />
))}
```

- [ ] **Step 6: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass — TypeScript compiles because canvas passes all required props.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-node.tsx apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx apps/web/test/cms/playlist-node.test.tsx
git commit -m "feat(playlists): V7 node with stripe, language badge, 5 states"
```

---

### Task 6: Edge Updates — circle marker, opacity, purple related

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-edge.tsx`

- [ ] **Step 1: Update EDGE_STYLES**

Change `related` stroke from gray to purple and add new style property for circle marker:
```typescript
const EDGE_STYLES: Record<EdgeType, { stroke: string; glow: string; dash?: string; marker: 'arrow' | 'circle' | false; defaultLabel?: string }> = {
  sequence:     { stroke: '#818cf8', glow: 'rgba(129,140,248,0.25)', marker: 'arrow', defaultLabel: 'seq' },
  related:      { stroke: '#a855f7', glow: 'rgba(168,85,247,0.2)', dash: '5,3', marker: 'circle', defaultLabel: 'see also' },
  prerequisite: { stroke: '#fbbf24', glow: 'rgba(251,191,36,0.25)', marker: 'arrow', defaultLabel: 'read first' },
  continuation: { stroke: '#34d399', glow: 'rgba(52,211,153,0.25)', marker: 'arrow' },
}
```

- [ ] **Step 2: Add opacity prop to PlaylistEdge**

Update the interface and component to accept `opacity`:
```typescript
interface PlaylistEdgeProps {
  edge: PlaylistEdgeRow
  sourceItem: PlaylistItemEnriched
  targetItem: PlaylistItemEnriched
  isSelected: boolean
  opacity?: number
  onSelect: (edgeId: string) => void
}
```

Wrap the `<g>` element with the opacity style:
```typescript
<g role="button" aria-label={...} style={{ opacity: opacity ?? 1 }}>
```

- [ ] **Step 3: Update marker-end logic**

Replace the `markerEnd` prop on the visible edge path:
```typescript
markerEnd={
  style.marker === 'arrow'
    ? `url(#arrow-${isSelected ? 'selected' : edge.edge_type})`
    : style.marker === 'circle'
      ? 'url(#circle-related)'
      : undefined
}
```

- [ ] **Step 4: Add circle marker to EdgeArrowDefs**

Add the circle marker inside the `<defs>`:
```tsx
<marker id="circle-related" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
  <circle cx="4" cy="4" r="3" fill="none" stroke="#a855f7" strokeWidth="1.5" />
</marker>
```

- [ ] **Step 5: Update PlaylistEdge call site in playlist-canvas.tsx**

The new `opacity` prop is optional (defaults to 1), so no change needed in canvas.tsx for this task. The existing `<PlaylistEdge>` calls will still compile. Verify:

Run: `cd apps/web && npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-edge.tsx
git commit -m "feat(playlists): circle marker for related edges, opacity prop"
```

---

### Task 7: Context Menu — Full Rewrite

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/context-menu.tsx`
- Test: `apps/web/test/cms/playlist-context-menu.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/cms/playlist-context-menu.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlaylistContextMenu } from '@/app/cms/(authed)/playlists/[id]/_components/context-menu'

const defaultProps = {
  x: 100,
  y: 200,
  itemId: 'item-1',
  itemTitle: 'My Blog Post',
  contentType: 'blog_post' as const,
  viewNumber: 3,
  createdAt: '2026-01-15T10:00:00Z',
  onClose: vi.fn(),
  onOpenEditor: vi.fn(),
  onCopyId: vi.fn(),
  onAddEdge: vi.fn(),
  onSelectConnected: vi.fn(),
  onMoveToPosition: vi.fn(),
  onShowOtherPlaylists: vi.fn(),
  onRemove: vi.fn(),
}

describe('PlaylistContextMenu', () => {
  it('renders header with type badge and title', () => {
    render(<PlaylistContextMenu {...defaultProps} />)
    expect(screen.getByText('BLOG')).toBeTruthy()
    expect(screen.getByText('#3')).toBeTruthy()
    expect(screen.getByText('My Blog Post')).toBeTruthy()
  })

  it('renders all 7 menu items', () => {
    render(<PlaylistContextMenu {...defaultProps} />)
    expect(screen.getByText('Open in editor')).toBeTruthy()
    expect(screen.getByText('Copy ID')).toBeTruthy()
    expect(screen.getByText('Add edge from here')).toBeTruthy()
    expect(screen.getByText('Select connected')).toBeTruthy()
    expect(screen.getByText('Move to position…')).toBeTruthy()
    expect(screen.getByText('Other playlists')).toBeTruthy()
    expect(screen.getByText('Remove from playlist')).toBeTruthy()
  })

  it('renders remove item in red', () => {
    const { container } = render(<PlaylistContextMenu {...defaultProps} />)
    const removeBtn = screen.getByText('Remove from playlist').closest('button')!
    expect(removeBtn.className).toContain('text-red')
  })

  it('fires onOpenEditor when clicking Open in editor', () => {
    render(<PlaylistContextMenu {...defaultProps} />)
    fireEvent.click(screen.getByText('Open in editor'))
    expect(defaultProps.onOpenEditor).toHaveBeenCalled()
  })

  it('fires onRemove when clicking Remove from playlist', () => {
    render(<PlaylistContextMenu {...defaultProps} />)
    fireEvent.click(screen.getByText('Remove from playlist'))
    expect(defaultProps.onRemove).toHaveBeenCalled()
  })

  it('shows UUID in footer (truncated)', () => {
    render(<PlaylistContextMenu {...defaultProps} />)
    expect(screen.getByText(/item-1/)).toBeTruthy()
  })

  it('closes on Escape', () => {
    render(<PlaylistContextMenu {...defaultProps} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('applies backdrop blur', () => {
    const { container } = render(<PlaylistContextMenu {...defaultProps} />)
    const menu = container.querySelector('[data-testid="context-menu"]')!
    expect(menu.className).toContain('backdrop-blur')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/playlist-context-menu.test.tsx`
Expected: FAIL — `PlaylistContextMenu` export doesn't exist

- [ ] **Step 3: Rewrite context-menu.tsx**

Replace the entire content of `apps/web/src/app/cms/(authed)/playlists/[id]/_components/context-menu.tsx` with the new `PlaylistContextMenu` component. The component should:

- Accept props: `x, y, itemId, itemTitle, contentType, viewNumber, createdAt, onClose, onOpenEditor, onCopyId, onAddEdge, onSelectConnected, onMoveToPosition, onShowOtherPlaylists, onRemove`
- Render a 200px wide fixed-position menu with `backdrop-filter: blur(12px)` and `data-testid="context-menu"`
- **Header:** Type badge (colored per `TYPE_CONFIG`), `#N` view number, truncated title
- **Menu sections** separated by dividers:
  - Section 1: Open in editor, Copy ID
  - Section 2: Add edge from here, Select connected, Move to position…, Other playlists
  - Section 3: Remove from playlist (red text)
- Each item has a 12x12 SVG icon (inline, `stroke-width: 2.5`) and a shortcut label on the right
- **Footer:** UUID (monospace, truncated) + relative date
- ESC and click-outside close the menu
- Auto-repositions if off-screen (existing pattern from old context-menu)
- Also export the old `ContextMenu` as a compatibility shim OR update all call sites

Full component code:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import type { ContentType } from '@/lib/playlists/types'

const TYPE_COLORS: Record<ContentType, string> = {
  video: '#ef4444',
  blog_post: '#6366f1',
  newsletter: '#22c55e',
  pipeline: '#a855f7',
}

const TYPE_BADGES: Record<ContentType, string> = {
  video: 'VIDEO',
  blog_post: 'BLOG',
  newsletter: 'NEWS',
  pipeline: 'PIPE',
}

interface PlaylistContextMenuProps {
  x: number
  y: number
  itemId: string
  itemTitle: string
  contentType: ContentType | null
  viewNumber: number | null
  createdAt: string
  onClose: () => void
  onOpenEditor: () => void
  onCopyId: () => void
  onAddEdge: () => void
  onSelectConnected: () => void
  onMoveToPosition: () => void
  onShowOtherPlaylists: () => void
  onRemove: () => void
}

export function PlaylistContextMenu({
  x, y, itemId, itemTitle, contentType, viewNumber, createdAt,
  onClose, onOpenEditor, onCopyId, onAddEdge, onSelectConnected,
  onMoveToPosition, onShowOtherPlaylists, onRemove,
}: PlaylistContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.right > window.innerWidth) el.style.left = `${window.innerWidth - rect.width - 8}px`
    if (rect.bottom > window.innerHeight) el.style.top = `${window.innerHeight - rect.height - 8}px`
  }, [x, y])

  const badgeColor = contentType ? TYPE_COLORS[contentType] : '#666'
  const badgeLabel = contentType ? TYPE_BADGES[contentType] : '???'

  const relativeDate = formatRelative(createdAt)

  return (
    <div
      ref={ref}
      data-testid="context-menu"
      className="fixed z-50 w-[200px] rounded-xl border border-white/10 bg-[#14141f]/90 shadow-2xl shadow-black/60 backdrop-blur-xl"
      style={{ left: x, top: y }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-2">
        <span className="rounded px-1 py-px text-[0.55rem] font-bold text-white" style={{ backgroundColor: badgeColor }}>
          {badgeLabel}
        </span>
        <span className="text-[0.6rem] font-semibold text-white/50">#{viewNumber ?? '-'}</span>
        <span className="flex-1 truncate text-[0.6rem] text-white/60">{itemTitle}</span>
      </div>

      {/* Menu items */}
      <div className="py-1">
        <MenuItem label="Open in editor" shortcut="⌘↵" onClick={() => { onOpenEditor(); onClose() }} icon={<ExternalLinkIcon />} />
        <MenuItem label="Copy ID" shortcut="⌘C" onClick={() => { onCopyId(); onClose() }} icon={<ClipboardIcon />} />

        <div className="my-1 h-px bg-white/5" />

        <MenuItem label="Add edge from here" shortcut="E" onClick={() => { onAddEdge(); onClose() }} icon={<ArrowRightIcon />} />
        <MenuItem label="Select connected" shortcut="⌘A" onClick={() => { onSelectConnected(); onClose() }} icon={<NetworkIcon />} />
        <MenuItem label="Move to position…" shortcut="M" onClick={() => { onMoveToPosition(); onClose() }} icon={<MoveIcon />} />
        <MenuItem label="Other playlists" shortcut="N" onClick={() => { onShowOtherPlaylists(); onClose() }} icon={<ListIcon />} />

        <div className="my-1 h-px bg-white/5" />

        <MenuItem label="Remove from playlist" shortcut="⌫" onClick={() => { onRemove(); onClose() }} icon={<TrashIcon />} danger />
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 px-3 py-1.5 text-[0.5rem]">
        <p className="truncate font-mono text-white/25">{itemId}</p>
        <p className="text-white/20">{relativeDate}</p>
      </div>
    </div>
  )
}

function MenuItem({ label, shortcut, onClick, icon, danger }: {
  label: string; shortcut: string; onClick: () => void; icon: React.ReactNode; danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.65rem] transition-colors ${
        danger ? 'text-red-400 hover:bg-red-500/10' : 'text-white/70 hover:bg-white/5'
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <span className="text-[0.55rem] text-white/20">{shortcut}</span>
    </button>
  )
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const days = Math.floor(diffMs / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1mo ago' : `${months}mo ago`
}

/* 12x12 SVG icons with stroke-width 2.5 */
function ExternalLinkIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
}
function ClipboardIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
}
function ArrowRightIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
}
function NetworkIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" /><line x1="12" y1="8" x2="5" y2="16" /><line x1="12" y1="8" x2="19" y2="16" /></svg>
}
function MoveIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" /></svg>
}
function ListIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
}
function TrashIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run test/cms/playlist-context-menu.test.tsx`
Expected: PASS

- [ ] **Step 5: Keep old ContextMenu export as compatibility shim**

Canvas.tsx imports `ContextMenu` from `./context-menu`. To keep compilation working until Task 13 wires the new API, add a compatibility re-export at the bottom of context-menu.tsx:

```tsx
// Compatibility shim — removed in Task 13 when canvas switches to PlaylistContextMenu
interface ContextMenuLegacyProps {
  x: number
  y: number
  items: Array<{ label: string; onClick: () => void; variant?: string }>
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuLegacyProps) {
  return (
    <div
      className="fixed z-50 w-[160px] rounded-lg border border-white/10 bg-[#14141f]/90 p-1 shadow-xl backdrop-blur-xl"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => { item.onClick(); onClose() }}
          className={`flex w-full rounded px-3 py-1.5 text-left text-xs transition-colors ${
            item.variant === 'danger' ? 'text-red-400 hover:bg-red-500/10' : 'text-white/70 hover:bg-white/5'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass — canvas.tsx still imports `ContextMenu` which now comes from the shim.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/context-menu.tsx apps/web/test/cms/playlist-context-menu.test.tsx
git commit -m "feat(playlists): redesigned context menu with icons and shortcuts"
```

---

### Task 8: Filter Bar Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/filter-bar.tsx`
- Test: `apps/web/test/cms/playlist-filter-bar.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/cms/playlist-filter-bar.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '@/app/cms/(authed)/playlists/[id]/_components/filter-bar'
import type { FilterState, ContentType } from '@/lib/playlists/types'

const defaultFilter: FilterState = { types: new Set(), languages: new Set(), mode: 'all', search: '' }

const counts: Record<ContentType, number> = {
  video: 4,
  blog_post: 6,
  newsletter: 2,
  pipeline: 3,
}

const defaultProps = {
  filter: defaultFilter,
  counts,
  totalCount: 15,
  onChange: vi.fn(),
}

describe('FilterBar', () => {
  it('renders All chip with total count', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByText('All')).toBeTruthy()
    expect(screen.getByText('15')).toBeTruthy()
  })

  it('renders type chips with counts', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByText('Video')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('Blog')).toBeTruthy()
    expect(screen.getByText('6')).toBeTruthy()
  })

  it('renders language chips', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByText('PT-BR')).toBeTruthy()
    expect(screen.getByText('EN')).toBeTruthy()
  })

  it('renders mode toggle with 3 options', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByText('Dim')).toBeTruthy()
    expect(screen.getByText('Hide')).toBeTruthy()
  })

  it('calls onChange when type chip is clicked', () => {
    const onChange = vi.fn()
    render(<FilterBar {...defaultProps} onChange={onChange} />)
    fireEvent.click(screen.getByText('Video'))
    expect(onChange).toHaveBeenCalled()
    const newFilter = onChange.mock.calls[0][0] as FilterState
    expect(newFilter.types.has('video')).toBe(true)
  })

  it('calls onChange when language chip is clicked', () => {
    const onChange = vi.fn()
    render(<FilterBar {...defaultProps} onChange={onChange} />)
    fireEvent.click(screen.getByText('PT-BR'))
    expect(onChange).toHaveBeenCalled()
    const newFilter = onChange.mock.calls[0][0] as FilterState
    expect(newFilter.languages.has('pt-br')).toBe(true)
  })

  it('highlights active type chip', () => {
    const activeFilter: FilterState = { ...defaultFilter, types: new Set(['video' as ContentType]) }
    const { container } = render(<FilterBar {...defaultProps} filter={activeFilter} />)
    const videoChip = screen.getByText('Video').closest('button')!
    expect(videoChip.className).toContain('text-white')
  })

  it('clicking All clears type filter', () => {
    const onChange = vi.fn()
    const activeFilter: FilterState = { ...defaultFilter, types: new Set(['video' as ContentType]) }
    render(<FilterBar {...defaultProps} filter={activeFilter} onChange={onChange} />)
    fireEvent.click(screen.getByText('All'))
    expect(onChange).toHaveBeenCalled()
    const newFilter = onChange.mock.calls[0][0] as FilterState
    expect(newFilter.types.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/playlist-filter-bar.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement filter-bar.tsx**

Create `apps/web/src/app/cms/(authed)/playlists/[id]/_components/filter-bar.tsx`:

```tsx
'use client'

import type { FilterState, ContentType, FilterLanguage } from '@/lib/playlists/types'
import { CONTENT_TYPES, FILTER_LANGUAGES } from '@/lib/playlists/types'

const TYPE_CHIP_CONFIG: Record<ContentType, { label: string; activeColor: string }> = {
  video:      { label: 'Video', activeColor: 'bg-red-500 text-white' },
  blog_post:  { label: 'Blog',  activeColor: 'bg-indigo-500 text-white' },
  newsletter: { label: 'News',  activeColor: 'bg-green-500 text-white' },
  pipeline:   { label: 'Pipe',  activeColor: 'bg-purple-500 text-white' },
}

const LANG_CHIP_CONFIG: Record<FilterLanguage, { label: string; activeColor: string }> = {
  'pt-br': { label: 'PT-BR', activeColor: 'bg-amber-400/20 text-amber-400' },
  en:      { label: 'EN',    activeColor: 'bg-blue-400/20 text-blue-400' },
}

interface FilterBarProps {
  filter: FilterState
  counts: Record<ContentType, number>
  totalCount: number
  onChange: (filter: FilterState) => void
}

export function FilterBar({ filter, counts, totalCount, onChange }: FilterBarProps) {
  const toggleType = (type: ContentType) => {
    const next = new Set(filter.types)
    if (next.has(type)) next.delete(type); else next.add(type)
    onChange({ ...filter, types: next })
  }

  const toggleLanguage = (lang: FilterLanguage) => {
    const next = new Set(filter.languages)
    if (next.has(lang)) next.delete(lang); else next.add(lang)
    onChange({ ...filter, languages: next })
  }

  const clearTypes = () => onChange({ ...filter, types: new Set() })

  const setMode = (mode: FilterState['mode']) => onChange({ ...filter, mode })

  const allActive = filter.types.size === 0

  return (
    <div className="flex items-center gap-3 border-b border-white/10 bg-[#0a0a12] px-4 py-1.5">
      {/* Type chips */}
      <div className="flex items-center gap-1">
        <Chip
          label="All"
          count={totalCount}
          active={allActive}
          activeClass="bg-white/10 text-white"
          onClick={clearTypes}
        />
        {CONTENT_TYPES.map(type => (
          <Chip
            key={type}
            label={TYPE_CHIP_CONFIG[type].label}
            count={counts[type]}
            active={filter.types.has(type)}
            activeClass={TYPE_CHIP_CONFIG[type].activeColor}
            onClick={() => toggleType(type)}
          />
        ))}
      </div>

      <span className="h-4 w-px bg-white/10" />

      {/* Language chips */}
      <div className="flex items-center gap-1">
        {FILTER_LANGUAGES.map(lang => (
          <Chip
            key={lang}
            label={LANG_CHIP_CONFIG[lang].label}
            active={filter.languages.has(lang)}
            activeClass={LANG_CHIP_CONFIG[lang].activeColor}
            onClick={() => toggleLanguage(lang)}
          />
        ))}
      </div>

      <span className="h-4 w-px bg-white/10" />

      {/* Mode toggle */}
      <div className="flex items-center gap-0.5 rounded-md bg-white/5 p-0.5">
        {(['all', 'dim', 'hide'] as const).map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => setMode(mode)}
            className={`rounded px-2 py-0.5 text-[0.6rem] font-medium transition-colors ${
              filter.mode === mode
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            {mode === 'all' ? 'All' : mode === 'dim' ? 'Dim' : 'Hide'}
          </button>
        ))}
      </div>
    </div>
  )
}

function Chip({ label, count, active, activeClass, onClick }: {
  label: string; count?: number; active: boolean; activeClass: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.6rem] font-medium transition-colors ${
        active ? activeClass : 'text-white/30 hover:text-white/50'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`text-[0.55rem] ${active ? 'opacity-80' : 'opacity-50'}`}>{count}</span>
      )}
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/playlist-filter-bar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/filter-bar.tsx apps/web/test/cms/playlist-filter-bar.test.tsx
git commit -m "feat(playlists): add filter bar with type, language, and mode chips"
```

---

### Task 9: Sidebar Enhancements — search, groups, order numbers

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-sidebar.tsx`

- [ ] **Step 1: Update PlaylistSidebarProps**

Add new props:
```typescript
interface PlaylistSidebarProps {
  items: PlaylistItemEnriched[]
  selectedItemIds: Set<string>
  viewNumbers: Map<string, number | null>
  filter: FilterState
  onSelectItem: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
  onAddContent: () => void
  onSearchChange: (search: string) => void
}
```

- [ ] **Step 2: Add TYPE_LABELS and TYPE_DOT_COLORS entries for video**

```typescript
const TYPE_LABELS: Record<ContentType, string> = {
  blog_post: 'Blog',
  newsletter: 'Newsletter',
  pipeline: 'Pipeline',
  video: 'Video',
}

const TYPE_DOT_COLORS: Record<ContentType, string> = {
  blog_post: 'bg-indigo-500',
  newsletter: 'bg-green-500',
  pipeline: 'bg-purple-500',
  video: 'bg-red-500',
}
```

- [ ] **Step 3: Add debounced search input**

Below the header, add a search input with 200ms debounce per spec:
```tsx
const [localSearch, setLocalSearch] = useState(filter.search)
const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

const handleSearchChange = (value: string) => {
  setLocalSearch(value)
  if (debounceRef.current) clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(() => onSearchChange(value), 200)
}
```

Add the `useState` and `useRef` imports at the top.

Render the search input:
```tsx
<div className="px-3 py-1.5 border-b border-white/5">
  <input
    type="text"
    placeholder="Search items…"
    value={localSearch}
    onChange={e => handleSearchChange(e.target.value)}
    className="w-full rounded-md bg-white/5 px-2 py-1 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
  />
</div>
```

- [ ] **Step 4: Add order number and language badge to each item**

Update the list item rendering to show `viewNumbers.get(item.id)` and a language badge:
```tsx
{/* Order number */}
<span className="mt-0.5 w-5 flex-shrink-0 text-right text-[0.6rem] font-bold text-white/30">
  {viewNumbers.get(item.id) ?? '—'}
</span>
```

Language badge after the type label:
```tsx
{item.language && (
  <span className={`text-[0.55rem] font-semibold ${item.language === 'pt-br' ? 'text-amber-400' : 'text-blue-400'}`}>
    {item.language === 'pt-br' ? 'PT' : 'EN'}
  </span>
)}
```

- [ ] **Step 5: Apply dimmed/hidden states based on filter.mode**

Filter the sorted items based on mode:
```typescript
const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order)
const visibleItems = filter.mode === 'hide'
  ? sortedItems.filter(item => viewNumbers.get(item.id) !== null)
  : sortedItems
```

For dim mode, apply opacity to non-matching items:
```tsx
className={`... ${filter.mode === 'dim' && viewNumbers.get(item.id) === null ? 'opacity-30' : ''}`}
```

- [ ] **Step 6: Add grouping by content type**

When types or languages are active in the filter, group items in the sidebar under headers:

```tsx
const groups = useMemo(() => {
  const map = new Map<string, PlaylistItemEnriched[]>()
  for (const item of visibleItems) {
    const typeLabel = item.content_type ? TYPE_LABELS[item.content_type] : 'Unknown'
    const langLabel = item.language === 'pt-br' ? 'PT-BR' : item.language === 'en' ? 'EN' : ''
    const key = [typeLabel, langLabel].filter(Boolean).join(' — ')
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}, [visibleItems])

const hasActiveFilter = filter.types.size > 0 || filter.languages.size > 0
```

When `hasActiveFilter` is true, render grouped headings:
```tsx
{hasActiveFilter ? (
  [...groups.entries()].map(([groupLabel, groupItems]) => (
    <div key={groupLabel}>
      <div className="sticky top-0 bg-[#0a0a12] px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-wider text-white/25">
        {groupLabel} ({groupItems.length})
      </div>
      {groupItems.map(item => renderItem(item))}
    </div>
  ))
) : (
  visibleItems.map(item => renderItem(item))
)}
```

Extract the item rendering into a `renderItem` helper function to avoid duplication.

- [ ] **Step 7: Update PlaylistSidebar call site in playlist-canvas.tsx**

In `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx`, add filter state and update the sidebar rendering (around line 616-622):

Add filter state after the other `useState` calls (around line 78):
```typescript
const [filter, setFilter] = useState<FilterState>({
  types: new Set(),
  languages: new Set(),
  mode: 'all',
  search: '',
})
```

Add the import at the top:
```typescript
import type { FilterState } from '@/lib/playlists/types'
```

Update the sidebar call:
```tsx
<PlaylistSidebar
  items={state.items}
  selectedItemIds={state.selectedItemIds}
  viewNumbers={new Map()}
  filter={filter}
  onSelectItem={handleSidebarSelectItem}
  onRemoveItem={handleRemoveItem}
  onAddContent={() => setShowPicker(true)}
  onSearchChange={(search) => setFilter(prev => ({ ...prev, search }))}
/>
```

- [ ] **Step 8: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-sidebar.tsx apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx
git commit -m "feat(playlists): sidebar search, grouping, order numbers, language badges"
```

---

### Task 10: Export Menu + CSV/JSON Generation

**Files:**
- Create: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/export-menu.tsx`
- Test: `apps/web/test/cms/playlist-export.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/cms/playlist-export.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateCsv, generateJson } from '@/app/cms/(authed)/playlists/[id]/_components/export-menu'
import type { PlaylistItemEnriched } from '@/lib/playlists/types'

function makeItem(overrides: Partial<PlaylistItemEnriched> & { id: string }): PlaylistItemEnriched {
  return {
    playlist_id: 'p1', blog_post_id: null, newsletter_edition_id: null,
    pipeline_id: null, sort_order: 0, position_x: 0, position_y: 0,
    created_at: '', content_type: 'blog_post', title: 'Test', status: null,
    category: null, metadata: null, is_ghost: false,
    other_playlist_count: 0, language: null,
    ...overrides,
  }
}

describe('generateCsv', () => {
  it('produces CSV with headers', () => {
    const items = [
      makeItem({ id: 'a', title: 'First Video', content_type: 'video', language: 'pt-br', status: 'published' }),
      makeItem({ id: 'b', title: 'Second Blog', content_type: 'blog_post', language: 'en', status: 'draft' }),
    ]
    const viewNumbers = new Map([['a', 1], ['b', 2]]) as Map<string, number | null>
    const csv = generateCsv(items, viewNumbers)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('#,type,language,status,title,category,metadata,uuid')
    expect(lines[1]).toContain('1,video,pt-br,published,First Video')
    expect(lines[2]).toContain('2,blog_post,en,draft,Second Blog')
  })

  it('skips items with null view number', () => {
    const items = [
      makeItem({ id: 'a', title: 'Match' }),
      makeItem({ id: 'b', title: 'Skip' }),
    ]
    const viewNumbers = new Map([['a', 1], ['b', null]]) as Map<string, number | null>
    const csv = generateCsv(items, viewNumbers)
    expect(csv).not.toContain('Skip')
  })
})

describe('generateJson', () => {
  it('produces correct JSON structure', () => {
    const items = [
      makeItem({ id: 'a', title: 'First', content_type: 'video', language: 'pt-br', status: 'published' }),
    ]
    const viewNumbers = new Map([['a', 1]]) as Map<string, number | null>
    const json = generateJson(items, viewNumbers, 'Test Playlist', 'Video — PT-BR')
    const parsed = JSON.parse(json)
    expect(parsed.playlist).toBe('Test Playlist')
    expect(parsed.filter).toBe('Video — PT-BR')
    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0].order).toBe(1)
    expect(parsed.items[0].type).toBe('video')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/playlist-export.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement export-menu.tsx**

Create `apps/web/src/app/cms/(authed)/playlists/[id]/_components/export-menu.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { PlaylistItemEnriched } from '@/lib/playlists/types'

interface ExportMenuProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  playlistName: string
  filterLabel: string
  items: PlaylistItemEnriched[]
  viewNumbers: Map<string, number | null>
  onPrint: () => void
  onExportPng: () => void
  onClose: () => void
}

export function ExportMenu({
  anchorRef, playlistName, filterLabel, items, viewNumbers,
  onPrint, onExportPng, onClose,
}: ExportMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [showSubmenu, setShowSubmenu] = useState(false)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handleCsvExport = () => {
    const csv = generateCsv(items, viewNumbers)
    download(`${playlistName}.csv`, csv, 'text/csv')
    onClose()
  }

  const handleJsonExport = () => {
    const json = generateJson(items, viewNumbers, playlistName, filterLabel)
    download(`${playlistName}.json`, json, 'application/json')
    onClose()
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 w-[180px] rounded-xl border border-white/10 bg-[#14141f]/90 p-1 shadow-2xl shadow-black/60 backdrop-blur-xl"
      style={{
        top: (anchorRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
        right: window.innerWidth - (anchorRef.current?.getBoundingClientRect().right ?? 0),
      }}
    >
      <button type="button" onClick={() => { onPrint(); onClose() }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white/70 hover:bg-white/5">
        <PrintIcon /> Print List
        <span className="ml-auto text-[0.55rem] text-white/20">⌘P</span>
      </button>
      <button type="button" onClick={() => { onExportPng(); onClose() }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white/70 hover:bg-white/5">
        <ImageIcon /> Export PNG
      </button>
      <div className="my-1 h-px bg-white/5" />
      <button type="button" onClick={handleCsvExport} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white/70 hover:bg-white/5">
        <FileIcon /> Export CSV
      </button>
      <button type="button" onClick={handleJsonExport} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white/70 hover:bg-white/5">
        <FileIcon /> Export JSON
      </button>
    </div>
  )
}

export function generateCsv(
  items: PlaylistItemEnriched[],
  viewNumbers: Map<string, number | null>,
): string {
  const header = '#,type,language,status,title,category,metadata,uuid'
  const rows = items
    .filter(item => viewNumbers.get(item.id) !== null)
    .sort((a, b) => (viewNumbers.get(a.id) ?? 0) - (viewNumbers.get(b.id) ?? 0))
    .map(item => {
      const n = viewNumbers.get(item.id)!
      const escape = (s: string | null) => {
        if (!s) return ''
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
      }
      return [n, item.content_type ?? '', item.language ?? '', item.status ?? '', escape(item.title), escape(item.category), escape(item.metadata), item.id].join(',')
    })
  return [header, ...rows].join('\n')
}

export function generateJson(
  items: PlaylistItemEnriched[],
  viewNumbers: Map<string, number | null>,
  playlistName: string,
  filterLabel: string,
): string {
  const filtered = items
    .filter(item => viewNumbers.get(item.id) !== null)
    .sort((a, b) => (viewNumbers.get(a.id) ?? 0) - (viewNumbers.get(b.id) ?? 0))
    .map(item => ({
      order: viewNumbers.get(item.id)!,
      type: item.content_type,
      language: item.language,
      status: item.status,
      title: item.title,
      category: item.category,
      uuid: item.id,
    }))

  return JSON.stringify({
    playlist: playlistName,
    filter: filterLabel,
    exported_at: new Date().toISOString(),
    items: filtered,
  }, null, 2)
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function PrintIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
}
function ImageIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
}
function FileIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/playlist-export.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/export-menu.tsx apps/web/test/cms/playlist-export.test.tsx
git commit -m "feat(playlists): export menu with CSV, JSON, print, PNG"
```

---

### Task 11: Print View Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/print-view.tsx`

- [ ] **Step 1: Create print-view.tsx**

```tsx
'use client'

import type { PlaylistItemEnriched, ContentType } from '@/lib/playlists/types'

const TYPE_BADGES: Record<ContentType, string> = {
  video: 'VIDEO', blog_post: 'BLOG', newsletter: 'NEWS', pipeline: 'PIPE',
}

interface PrintViewProps {
  playlistName: string
  filterLabel: string
  items: PlaylistItemEnriched[]
  viewNumbers: Map<string, number | null>
}

export function PrintView({ playlistName, filterLabel, items, viewNumbers }: PrintViewProps) {
  const visibleItems = items
    .filter(item => viewNumbers.get(item.id) !== null)
    .sort((a, b) => (viewNumbers.get(a.id) ?? 0) - (viewNumbers.get(b.id) ?? 0))

  return (
    <div className="hidden print:block bg-white text-black p-8 text-sm">
      {/* Header */}
      <div className="mb-6 border-b-2 border-black pb-3">
        <h1 className="text-2xl font-bold">{playlistName}</h1>
        {filterLabel && <p className="text-gray-500 mt-1">{filterLabel}</p>}
        <p className="text-gray-400 text-xs mt-1">{new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}</p>
      </div>

      {/* Items */}
      <ol className="space-y-3">
        {visibleItems.map(item => {
          const num = viewNumbers.get(item.id)!
          const typeBadge = item.content_type ? TYPE_BADGES[item.content_type] : '???'
          const langBadge = item.language === 'pt-br' ? 'PT' : item.language === 'en' ? 'EN' : null

          return (
            <li key={item.id} className="flex items-start gap-3">
              <span className="w-8 text-right font-bold text-gray-400">#{num}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="rounded bg-gray-100 px-1 py-0.5 font-bold">{typeBadge}</span>
                  {langBadge && <span className="rounded bg-gray-100 px-1 py-0.5">{langBadge}</span>}
                  <span>● {item.status ?? 'unknown'}</span>
                </div>
                <p className="mt-0.5 font-medium">{item.title}</p>
                {item.metadata && <p className="text-xs text-gray-400">{item.metadata}</p>}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Footer */}
      <div className="mt-8 border-t border-gray-200 pt-3 text-xs text-gray-400">
        {visibleItems.length} items · Generated from CMS Playlist Editor
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add print CSS to global styles or a style tag**

The component uses `hidden print:block` which with Tailwind means: hidden on screen (`display: none`), visible when printing (`@media print { display: block }`). No additional global CSS needed for basic functionality. The canvas and toolbar should be hidden during print — add to the canvas wrapper:
```tsx
className="... print:hidden"
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/print-view.tsx
git commit -m "feat(playlists): print view component with light theme"
```

---

### Task 12: Toolbar Update — export dropdown + print button

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-toolbar.tsx`

- [ ] **Step 1: Update PlaylistToolbarProps**

Replace `onExport: () => void` with:
```typescript
onToggleExportMenu: () => void
onPrint: () => void
exportButtonRef: React.RefObject<HTMLButtonElement | null>
```

- [ ] **Step 2: Replace export button in toolbar**

Replace the single export button with a print button + export dropdown trigger:

```tsx
<ToolbarButton label="Print" shortcut="Cmd+P" onClick={onPrint}>
  <PrintIcon />
</ToolbarButton>
<ToolbarButton label="Export" onClick={onToggleExportMenu} ref={exportButtonRef}>
  <ExportIcon />
</ToolbarButton>
```

The `ToolbarButton` needs to support `ref` — update it to use `forwardRef` or pass the ref via the `exportButtonRef` prop directly to the button element.

- [ ] **Step 3: Add PrintIcon SVG**

```tsx
function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
}
```

- [ ] **Step 4: Update PlaylistToolbar call site in playlist-canvas.tsx**

In `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx`, update the toolbar rendering (around line 597-612).

Add refs and handlers near the other state:
```typescript
const [showExportMenu, setShowExportMenu] = useState(false)
const exportBtnRef = useRef<HTMLButtonElement>(null)

const handlePrint = useCallback(() => window.print(), [])
```

Update the toolbar call:
```tsx
<PlaylistToolbar
  playlistName={graph.playlist.name_en || graph.playlist.name_pt}
  status={graph.playlist.status}
  saveState={saveState}
  canUndo={canUndo()}
  canRedo={canRedo()}
  zoomPercent={Math.round(camera.zoom * 100)}
  onUndo={handleUndo}
  onRedo={handleRedo}
  onAutoLayout={handleAutoLayout}
  onZoomIn={handleZoomIn}
  onZoomOut={handleZoomOut}
  onZoomToFit={handleZoomToFit}
  onToggleExportMenu={() => setShowExportMenu(prev => !prev)}
  onPrint={handlePrint}
  exportButtonRef={exportBtnRef}
  onToggleSettings={() => setShowSettings(prev => !prev)}
/>
```

- [ ] **Step 5: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-toolbar.tsx apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx
git commit -m "feat(playlists): toolbar print button and export dropdown"
```

---

### Task 13: Canvas Orchestrator Integration

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx`

This is the largest task — it wires everything together. The canvas orchestrator needs:

- [ ] **Step 1: Add filter state and imports**

Update the React import to include `useMemo`:
```typescript
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
```

Add imports for the new components (some may already exist from earlier tasks — deduplicate):
```typescript
import { FilterBar } from './filter-bar'
import { PrintView } from './print-view'
import { ExportMenu } from './export-menu'
import { PlaylistContextMenu } from './context-menu'
import { computeViewNumbers, matchesFilter } from '@/lib/playlists/canvas/view-numbers'
import type { FilterState, ContentType } from '@/lib/playlists/types'
```

The `filter` state and `showExportMenu`/`exportBtnRef` were already added in earlier tasks (Tasks 9 and 12). Verify they exist; if not, add them:
```typescript
const [filter, setFilter] = useState<FilterState>({
  types: new Set(),
  languages: new Set(),
  mode: 'all',
  search: '',
})
const [showExportMenu, setShowExportMenu] = useState(false)
const exportBtnRef = useRef<HTMLButtonElement>(null)
```

- [ ] **Step 2: Compute view numbers and type counts**

Add memoized computations:
```typescript
const viewNumbers = useMemo(
  () => computeViewNumbers(state.items, filter),
  [state.items, filter],
)

const typeCounts = useMemo(() => {
  const counts: Record<ContentType, number> = { video: 0, blog_post: 0, newsletter: 0, pipeline: 0 }
  for (const item of state.items) {
    if (item.content_type && !item.is_ghost) counts[item.content_type]++
  }
  return counts
}, [state.items])
```

- [ ] **Step 3: Compute filter label for print/export**

```typescript
const filterLabel = useMemo(() => {
  const parts: string[] = []
  if (filter.types.size > 0) parts.push([...filter.types].map(t => t === 'blog_post' ? 'Blog' : t === 'newsletter' ? 'News' : t === 'pipeline' ? 'Pipe' : 'Video').join(', '))
  if (filter.languages.size > 0) parts.push([...filter.languages].map(l => l === 'pt-br' ? 'PT-BR' : 'EN').join(', '))
  return parts.join(' — ')
}, [filter])
```

- [ ] **Step 4: Wire FilterBar into the layout**

Insert `<FilterBar>` between the toolbar and the canvas area:
```tsx
<FilterBar
  filter={filter}
  counts={typeCounts}
  totalCount={state.items.filter(i => !i.is_ghost).length}
  onChange={setFilter}
/>
```

- [ ] **Step 5: Pass isDimmed/isIdea/viewNumber to PlaylistNode**

Update the node rendering in the canvas to compute and pass the new props. Import `DIMMED_OFFSET_Y`:
```typescript
import { DIMMED_OFFSET_Y } from '@/lib/playlists/canvas/auto-layout'
```

For each node, compute state and apply dimmed offset:
```typescript
const isDimmed = filter.mode === 'dim' && !matchesFilter(item, filter)
const isHidden = filter.mode === 'hide' && !matchesFilter(item, filter)
const isIdea = !item.is_ghost && item.status === 'idea'
```

Skip rendering hidden items. Dimmed items get a visual offset of +120px downward to create separation:
```tsx
{!isHidden && (() => {
  const offsetY = isDimmed ? DIMMED_OFFSET_Y : 0
  const adjustedItem = offsetY > 0 ? { ...item, position_y: item.position_y + offsetY } : item
  return (
    <PlaylistNode
      key={item.id}
      item={adjustedItem}
      isSelected={state.selectedItemIds.has(item.id)}
      isDropTarget={...}
      isDimmed={isDimmed}
      isIdea={isIdea}
      viewNumber={viewNumbers.get(item.id) ?? null}
      onPointerDown={...}
      onHandlePointerDown={...}
      onContextMenu={...}
      onClick={...}
      onOpenContent={handleOpenContent}
    />
  )
})()}
```

- [ ] **Step 6: Pass opacity to PlaylistEdge**

For each edge, compute opacity:
```typescript
const sourceHidden = filter.mode === 'hide' && !matchesFilter(sourceItem, filter)
const targetHidden = filter.mode === 'hide' && !matchesFilter(targetItem, filter)
if (sourceHidden || targetHidden) return null

const sourceDimmed = filter.mode === 'dim' && !matchesFilter(sourceItem, filter)
const targetDimmed = filter.mode === 'dim' && !matchesFilter(targetItem, filter)
const edgeOpacity = (sourceDimmed || targetDimmed) ? 0.04 : 1
```

Pass to edge:
```tsx
<PlaylistEdge ... opacity={edgeOpacity} />
```

- [ ] **Step 7: Wire sidebar search**

Update the sidebar rendering:
```tsx
<PlaylistSidebar
  items={state.items}
  selectedItemIds={state.selectedItemIds}
  viewNumbers={viewNumbers}
  filter={filter}
  onSelectItem={...}
  onRemoveItem={...}
  onAddContent={...}
  onSearchChange={(search) => setFilter(prev => ({ ...prev, search }))}
/>
```

- [ ] **Step 8: Wire export menu and print**

Add `handlePrint`:
```typescript
const handlePrint = useCallback(() => {
  window.print()
}, [])
```

Add `handleOpenContent`:
```typescript
const handleOpenContent = useCallback((itemId: string) => {
  const item = state.items.find(i => i.id === itemId)
  if (!item) return
  if (item.blog_post_id) router.push(`/cms/blog/${item.blog_post_id}`)
  else if (item.pipeline_id) router.push(`/cms/pipeline/${item.pipeline_id}`)
  else if (item.newsletter_edition_id) router.push(`/cms/newsletters`)
}, [state.items, router])
```

Update toolbar props:
```tsx
<PlaylistToolbar
  ...
  onToggleExportMenu={() => setShowExportMenu(prev => !prev)}
  onPrint={handlePrint}
  exportButtonRef={exportBtnRef}
/>
```

Render export menu when open:
```tsx
{showExportMenu && (
  <ExportMenu
    anchorRef={exportBtnRef}
    playlistName={graph.playlist.name_en}
    filterLabel={filterLabel}
    items={state.items}
    viewNumbers={viewNumbers}
    onPrint={handlePrint}
    onExportPng={handleExportPng}
    onClose={() => setShowExportMenu(false)}
  />
)}
```

- [ ] **Step 9: Wire context menu to new PlaylistContextMenu**

Replace the old context menu rendering with:
```tsx
{contextMenu && (() => {
  const item = state.items.find(i => i.id === contextMenu.itemId)
  if (!item) return null
  return (
    <PlaylistContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      itemId={item.id}
      itemTitle={item.title}
      contentType={item.content_type}
      viewNumber={viewNumbers.get(item.id) ?? null}
      createdAt={item.created_at}
      onClose={() => setContextMenu(null)}
      onOpenEditor={() => handleOpenContent(item.id)}
      onCopyId={() => navigator.clipboard.writeText(item.id)}
      onAddEdge={() => {
        setContextMenu(null)
        // Reuse existing edge creation: simulate handle pointer down from source center
        const nodeEl = document.querySelector(`[data-node-id="${item.id}"]`)
        if (nodeEl) {
          const rect = nodeEl.getBoundingClientRect()
          const syntheticEvent = new PointerEvent('pointerdown', {
            clientX: rect.right, clientY: rect.top + rect.height / 2,
          })
          nodeEl.querySelector('[data-handle-id]')?.dispatchEvent(syntheticEvent)
        }
      }}
      onSelectConnected={() => {
        setContextMenu(null)
        const connected = new Set<string>()
        const queue = [item.id]
        while (queue.length > 0) {
          const current = queue.pop()!
          if (connected.has(current)) continue
          connected.add(current)
          for (const edge of state.edges) {
            if (edge.source_item_id === current && !connected.has(edge.target_item_id)) queue.push(edge.target_item_id)
            if (edge.target_item_id === current && !connected.has(edge.source_item_id)) queue.push(edge.source_item_id)
          }
        }
        dispatch({ type: 'SET_SELECTION', itemIds: Array.from(connected), edgeIds: [] })
      }}
      onMoveToPosition={() => {
        setContextMenu(null)
        const input = window.prompt('Move to position #:', '')
        if (!input) return
        const pos = parseInt(input, 10)
        if (isNaN(pos) || pos < 1) return
        const sorted = [...state.items].sort((a, b) => a.sort_order - b.sort_order)
        const targetIdx = Math.min(pos - 1, sorted.length - 1)
        const newOrder = sorted.map(i => i.id)
        const currentIdx = newOrder.indexOf(item.id)
        if (currentIdx === -1) return
        newOrder.splice(currentIdx, 1)
        newOrder.splice(targetIdx, 0, item.id)
        dispatch({ type: 'REORDER_ITEMS', itemIds: newOrder })
      }}
      onShowOtherPlaylists={() => {
        setContextMenu(null)
        // Open the content picker with info about cross-playlist references
        // For now, copy the item info to clipboard as a quick reference
        navigator.clipboard.writeText(`${item.title} (${item.other_playlist_count} other playlists)`)
      }}
      onRemove={() => handleRemoveItem(item.id)}
    />
  )
})()}
```

- [ ] **Step 10: Add PrintView at the end of the component tree**

```tsx
<PrintView
  playlistName={graph.playlist.name_en}
  filterLabel={filterLabel}
  items={state.items}
  viewNumbers={viewNumbers}
/>
```

Add `print:hidden` to the main canvas wrapper div so it hides during print.

- [ ] **Step 11: Add keyboard shortcuts for Cmd+P, E, M, N**

In the existing keyboard handler (`handleKeyDown` inside the `useEffect`), add these cases. Place them after the existing `Escape` case:

```typescript
// Print shortcut
if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
  e.preventDefault()
  handlePrint()
}

// Cmd+Enter = open editor (spec shortcut for "Open in editor")
if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && state.selectedItemIds.size === 1) {
  e.preventDefault()
  const selectedId = [...state.selectedItemIds][0]!
  handleOpenContent(selectedId)
}

// Single-node shortcuts (only when one node is selected and no input is focused)
const target = e.target as HTMLElement
const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
if (!isInput && state.selectedItemIds.size === 1) {
  const selectedId = [...state.selectedItemIds][0]!
  if (e.key === 'e' || e.key === 'E') {
    // E = add edge from here (enter edge-creation mode from right handle)
    const nodeEl = document.querySelector(`[data-node-id="${selectedId}"]`)
    if (nodeEl) {
      const handles = nodeEl.querySelectorAll('[data-handle-id]')
      const rightHandle = handles[3] // right handle is 4th
      if (rightHandle) {
        const rect = rightHandle.getBoundingClientRect()
        rightHandle.dispatchEvent(new PointerEvent('pointerdown', {
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          bubbles: true,
        }))
      }
    }
  } else if (e.key === 'm' || e.key === 'M') {
    // Move to position
    const input = window.prompt('Move to position #:', '')
    if (!input) return
    const pos = parseInt(input, 10)
    if (isNaN(pos) || pos < 1) return
    const sorted = [...state.items].sort((a, b) => a.sort_order - b.sort_order)
    const targetIdx = Math.min(pos - 1, sorted.length - 1)
    const newOrder = sorted.map(i => i.id)
    const currentIdx = newOrder.indexOf(selectedId)
    if (currentIdx === -1) return
    newOrder.splice(currentIdx, 1)
    newOrder.splice(targetIdx, 0, selectedId)
    dispatch({ type: 'REORDER_ITEMS', itemIds: newOrder })
  } else if (e.key === 'n' || e.key === 'N') {
    // Show other playlists info
    const item = state.items.find(i => i.id === selectedId)
    if (item) navigator.clipboard.writeText(`${item.title} (${item.other_playlist_count} other playlists)`)
  }
}
```

Add `handleOpenContent` to the dependency array of the `useEffect`.

- [ ] **Step 12: Update fitAllNodes to respect filter**

When calling `zoomToFit()` or `fitAllNodes()`, pass only visible (non-hidden) items:
```typescript
const visibleItems = filter.mode === 'hide'
  ? state.items.filter(item => matchesFilter(item, filter))
  : state.items
```

- [ ] **Step 13: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass

- [ ] **Step 14: Remove ContextMenu legacy shim**

In `context-menu.tsx`, delete the `ContextMenu` function that was added in Task 7 Step 5 as a compatibility shim. Canvas.tsx now uses `PlaylistContextMenu` directly. Also update the import in canvas.tsx from:
```typescript
import { ContextMenu } from './context-menu'
```
to:
```typescript
// This import was already replaced in Step 9 by PlaylistContextMenu
```

Remove any remaining `ContextMenu` import if present.

- [ ] **Step 15: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass

- [ ] **Step 16: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx apps/web/src/app/cms/(authed)/playlists/[id]/_components/context-menu.tsx
git commit -m "feat(playlists): wire filter, view numbers, print, export into canvas"
```

---

### Task 14: Minimap — video color + NODE_W update

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-minimap.tsx`

- [ ] **Step 1: Add video color to typeColors**

In `playlist-minimap.tsx` (line 51-55), add video:
```typescript
const typeColors: Record<string, string> = {
  blog_post: '#818cf8',
  newsletter: '#34d399',
  pipeline: '#a78bfa',
  video: '#ef4444',
}
```

- [ ] **Step 2: Update NODE_W from 160 to 250**

Change line 25:
```typescript
const NODE_W = 250
```

- [ ] **Step 3: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-minimap.tsx
git commit -m "feat(playlists): minimap video color and 250px node width"
```

---

### Task 15: Content Picker — video tab + type maps

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/content-picker.tsx`

- [ ] **Step 1: Add video to TABS array**

In `content-picker.tsx` (line 8-13), add the video tab:
```typescript
const TABS = [
  { key: 'all', label: 'All' },
  { key: 'blog_post', label: 'Blog' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'video', label: 'Video' },
] as const
```

- [ ] **Step 2: Add video to TYPE_DOT and TYPE_LABEL**

```typescript
const TYPE_DOT: Record<string, string> = {
  blog_post: 'bg-indigo-500',
  newsletter: 'bg-green-500',
  pipeline: 'bg-purple-500',
  video: 'bg-red-500',
}

const TYPE_LABEL: Record<string, string> = {
  blog_post: 'Blog',
  newsletter: 'Newsletter',
  pipeline: 'Pipeline',
  video: 'Video',
}
```

- [ ] **Step 3: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/content-picker.tsx
git commit -m "feat(playlists): content picker video tab and type maps"
```

---

### Task 16: PNG Export — video color + 250px nodes

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx`

The inline PNG export handler (`handleExport` in canvas.tsx, referenced as `handleExportPng` from the ExportMenu) still uses `typeColors` without video and draws nodes at 160px wide. Rename `handleExport` → `handleExportPng` so the ExportMenu `onExportPng` prop wires correctly.

- [ ] **Step 1: Rename and update the PNG export handler**

Rename `handleExport` to `handleExportPng` in canvas.tsx and update these internals:

Add video to `typeColors`:
```typescript
const typeColors: Record<string, string> = {
  blog_post: '#818cf8',
  newsletter: '#34d399',
  pipeline: '#a855f7',
  video: '#ef4444',
}
```

Change the node width from 160 to 250:
```typescript
const nodeW = 250
```

Update `ctx.roundRect(x, y, 160, 70, 10)` to `ctx.roundRect(x, y, 250, 70, 10)`.

Add VIDEO to the badge mapping:
```typescript
const badge = item.content_type === 'blog_post' ? 'BLOG' : item.content_type === 'newsletter' ? 'NEWS' : item.content_type === 'pipeline' ? 'PIPE' : item.content_type === 'video' ? 'VIDEO' : ''
```

Update the related edge color from `'#6b7280'` to `'#a855f7'` (purple, matching the edge update):
```typescript
const edgeColors: Record<string, string> = {
  sequence: '#818cf8',
  related: '#a855f7',
  prerequisite: '#fbbf24',
  continuation: '#34d399',
}
```

- [ ] **Step 2: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx
git commit -m "feat(playlists): PNG export with video color and 250px nodes"
```

---

### Task 17: Visual Testing in Browser

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` in `apps/web`

- [ ] **Step 2: Navigate to a playlist**

Open a playlist in the browser. Check:
- Nodes render at 250px width with left stripe and order numbers
- Type colors: Video (red), Blog (indigo), Newsletter (green), Pipeline (purple)
- Language badges: PT (amber) and EN (blue) appear correctly
- Hover shows ↗ open button and connection handles

- [ ] **Step 3: Test filter bar**

- Click type chips — canvas should dim/hide non-matching nodes
- Click language chips — should filter by language
- Toggle Dim/Hide/All modes
- Verify order numbers renumber in the stripe when filtered
- Verify sidebar updates with filtered view

- [ ] **Step 4: Test context menu**

- Right-click a node — verify all 7 items, header with badge + title, footer with UUID
- Click "Open in editor" — should navigate to blog/pipeline/newsletter editor
- Click "Copy ID" — should copy UUID to clipboard
- Click "Select connected" — should highlight all connected nodes via BFS
- Press Escape — menu should close

- [ ] **Step 5: Test keyboard shortcuts**

- Select a node, press E — should open in editor
- Select a node, press M — should prompt for position number
- Select a node, press Backspace — should remove from playlist
- Press Cmd+P — should open print dialog
- Press Cmd+Z / Cmd+Shift+Z — undo/redo

- [ ] **Step 6: Test minimap**

- Verify minimap shows video nodes in red
- Verify minimap node widths match the wider 250px ratio
- Click minimap — viewport should navigate to clicked area

- [ ] **Step 7: Test content picker**

- Open content picker — verify Video tab exists
- Video tab should show red dot
- Verify filtering by tab works

- [ ] **Step 8: Test print**

- Click Print button or Cmd+P
- Verify light theme list appears in print preview
- Verify only filtered items appear with correct numbering

- [ ] **Step 9: Test export**

- Click Export → CSV — verify downloaded file contents
- Click Export → JSON — verify downloaded file structure
- Click Export → PNG — verify downloaded image has video nodes in red

- [ ] **Step 10: Test auto-layout**

- Click Auto-layout button
- Verify nodes don't overlap with new 370px horizontal gap
- Verify edges have space for labels
- Verify 250px wide nodes look correct

- [ ] **Step 11: Run full test suite one final time**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass

- [ ] **Step 12: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "feat(playlists): playlist redesign v2 complete"
```
