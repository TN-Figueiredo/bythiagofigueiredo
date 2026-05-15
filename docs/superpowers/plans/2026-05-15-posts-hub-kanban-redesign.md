# Posts Hub & Pipeline Blog — Kanban Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the kanban the default screen when clicking Posts, enrich cards with cover images/snippets/progress bars, make columns full-width, add a Pipeline→Posts handoff, and migrate Overview stats to the Dashboard.

**Architecture:** Two parallel kanban views (Posts Hub + Pipeline Blog) share a rich card visual system. The Overview tab is eliminated — its data migrates to a new Dashboard Blog Health section. The editorial kanban becomes the default tab. Pipeline Pronto cards get a "Promote to Posts Hub" button.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, @dnd-kit, Vitest, Supabase

**Spec:** `docs/superpowers/specs/2026-05-15-posts-hub-kanban-redesign-design.md`

---

### Task 1: Update PostCard type and BlogTabId

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/_hub/hub-types.ts`
- Test: `apps/web/test/cms/blog-hub.test.ts`

- [ ] **Step 1: Write failing test for new PostCard fields**

Add to `apps/web/test/cms/blog-hub.test.ts`:

```typescript
describe('PostCard type shape', () => {
  it('should include coverImageUrl and excerpt fields', () => {
    const card: PostCard = {
      id: 'test-id',
      displayId: '#BP-001',
      title: 'Test Post',
      status: 'ready',
      tagId: null,
      tagName: null,
      tagColor: null,
      tagNameTranslations: null,
      locales: ['en'],
      readingTimeMin: 5,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      publishedAt: null,
      scheduledFor: null,
      slotDate: null,
      snippet: 'A short excerpt',
      coverImageUrl: 'https://example.com/img.jpg',
      excerpt: 'Full excerpt from DB',
    }
    expect(card.coverImageUrl).toBe('https://example.com/img.jpg')
    expect(card.excerpt).toBe('Full excerpt from DB')
  })

  it('should allow null for coverImageUrl and excerpt', () => {
    const card: PostCard = {
      id: 'test-id',
      displayId: '#BP-001',
      title: 'Test Post',
      status: 'draft',
      tagId: null,
      tagName: null,
      tagColor: null,
      tagNameTranslations: null,
      locales: ['pt-BR'],
      readingTimeMin: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      publishedAt: null,
      scheduledFor: null,
      slotDate: null,
      snippet: null,
      coverImageUrl: null,
      excerpt: null,
    }
    expect(card.coverImageUrl).toBeNull()
    expect(card.excerpt).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- --run test/cms/blog-hub.test.ts`
Expected: FAIL — `coverImageUrl` and `excerpt` do not exist on `PostCard`

- [ ] **Step 3: Update hub-types.ts**

In `apps/web/src/app/cms/(authed)/blog/_hub/hub-types.ts`:

1. Change line 1 from:
```typescript
export type BlogTabId = 'overview' | 'editorial' | 'schedule' | 'analytics'
```
to:
```typescript
export type BlogTabId = 'editorial' | 'schedule' | 'analytics'
```

2. Add two fields to `PostCard` after line 40 (`snippet: string | null`):
```typescript
  coverImageUrl: string | null
  excerpt: string | null
```

3. Delete the entire `OverviewTabData` interface (lines 43-67).

4. Add `totalPosts` and `publishedCount` to the `EditorialTabData.velocity` type. Change the velocity type from:
```typescript
  velocity: {
    throughput: number
    avgIdeaToPublished: number
    movedThisWeek: number
    bottleneck: { column: string; avgDays: number } | null
  }
```
to:
```typescript
  velocity: {
    throughput: number
    avgIdeaToPublished: number
    movedThisWeek: number
    bottleneck: { column: string; avgDays: number } | null
    totalPosts: number
    publishedCount: number
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:web -- --run test/cms/blog-hub.test.ts`
Expected: PASS — new fields compile, existing tests still pass

- [ ] **Step 5: Fix any type errors in files importing OverviewTabData**

Search for imports of `OverviewTabData` and remove them:
```bash
grep -rn "OverviewTabData" apps/web/src/ --include="*.ts" --include="*.tsx"
```

Files to update:
- `hub-queries.ts` — remove `OverviewTabData` from import line
- `_tabs/overview/overview-tab.tsx` — will be deleted in Task 3

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/_hub/hub-types.ts apps/web/test/cms/blog-hub.test.ts
git commit -m "feat(blog): update PostCard with coverImageUrl/excerpt, remove overview tab id"
```

---

### Task 2: Update editorial query to include cover image and excerpt

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/_hub/hub-queries.ts`

- [ ] **Step 1: Update fetchEditorialData query**

In `hub-queries.ts`, find the `fetchEditorialData` function. In its Supabase query for `blog_posts`, update the `blog_translations` select to include `cover_image_url, excerpt`:

Change the select from:
```
blog_translations(locale, title, slug, reading_time_min, content_mdx)
```
to:
```
blog_translations(locale, title, slug, reading_time_min, content_mdx, cover_image_url, excerpt)
```

Also add `cover_image_url` to the top-level `blog_posts` select (for the fallback).

- [ ] **Step 2: Update PostCard mapping in fetchEditorialData**

In the same function, where each post row is mapped to a `PostCard`, update the mapping to include the new fields. Find the section where `snippet` is derived and replace it:

Change snippet derivation from:
```typescript
snippet: bestTrans?.content_mdx?.slice(0, 80) ?? null,
```
to:
```typescript
snippet: bestTrans?.excerpt ?? bestTrans?.content_mdx?.slice(0, 80) ?? null,
coverImageUrl: bestTrans?.cover_image_url ?? row.cover_image_url ?? null,
excerpt: bestTrans?.excerpt ?? null,
```

- [ ] **Step 3: Add totalPosts and publishedCount to velocity computation**

In the velocity computation section of `fetchEditorialData`, add counts. After the existing velocity metrics, add:

```typescript
totalPosts: rows.length,
publishedCount: rows.filter(r => r.status === 'published').length,
```

- [ ] **Step 4: Delete fetchOverviewData function**

Remove the entire `fetchOverviewData` export (approximately lines 16-22 of the cache wrapper plus the full function body). Also remove `OverviewTabData` from the import at the top of the file.

- [ ] **Step 5: Run tests**

Run: `npm run test:web -- --run test/cms/blog-hub.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/_hub/hub-queries.ts
git commit -m "feat(blog): add cover_image_url/excerpt to editorial query, remove fetchOverviewData"
```

---

### Task 3: Eliminate Overview tab and make Editorial the default

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/_hub/hub-client.tsx`
- Modify: `apps/web/src/app/cms/(authed)/blog/page.tsx`
- Delete: `apps/web/src/app/cms/(authed)/blog/_tabs/overview/overview-tab.tsx`
- Delete: `apps/web/src/app/cms/(authed)/blog/_tabs/overview/kpi-strip.tsx`
- Delete: `apps/web/src/app/cms/(authed)/blog/_tabs/overview/tag-breakdown.tsx`
- Delete: `apps/web/src/app/cms/(authed)/blog/_tabs/overview/recent-publications.tsx`

- [ ] **Step 1: Update TABS array in hub-client.tsx**

In `hub-client.tsx`, change lines 14-19 from:
```typescript
const TABS: Array<{ id: BlogTabId; icon: typeof BarChart3 }> = [
  { id: 'overview', icon: BarChart3 },
  { id: 'editorial', icon: Kanban },
  { id: 'schedule', icon: CalendarDays },
  { id: 'analytics', icon: TrendingUp },
]
```
to:
```typescript
const TABS: Array<{ id: BlogTabId; icon: typeof BarChart3 }> = [
  { id: 'editorial', icon: Kanban },
  { id: 'schedule', icon: CalendarDays },
  { id: 'analytics', icon: TrendingUp },
]
```

Remove the `BarChart3` import from lucide-react since it's no longer used.

- [ ] **Step 2: Update switchTab default logic**

In `hub-client.tsx`, find the `switchTab` callback (line 76-91). Change the default tab check from:
```typescript
if (tab === 'overview') params.delete('tab')
```
to:
```typescript
if (tab === 'editorial') params.delete('tab')
```

- [ ] **Step 3: Add gear icon to tab bar**

In `hub-client.tsx`, add a `Settings` import from lucide-react. Then after the TABS `.map()` closing (after line 203 `})`), add a gear button before the closing `</div>` of the tab bar:

```tsx
        <button
          onClick={handleAddTag}
          aria-label="Manage tags"
          className="ml-auto flex shrink-0 items-center border-b-2 border-transparent px-3 py-2.5 text-gray-600 transition-colors hover:text-gray-300"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
```

Note: `handleAddTag` already exists and opens the TagDrawer — we're reusing it.

- [ ] **Step 4: Update server page component**

In `apps/web/src/app/cms/(authed)/blog/page.tsx`, find the `TabContent` component. Remove the `overview` case from the switch statement. Change the default tab resolution:

Where it resolves `tab` from searchParams, change:
```typescript
const tab = (searchParams.tab as BlogTabId) ?? 'overview'
```
to:
```typescript
const raw = searchParams.tab as string | undefined
const tab: BlogTabId = (raw === 'editorial' || raw === 'schedule' || raw === 'analytics') ? raw : 'editorial'
```

This also handles the URL fallback: `?tab=overview` now falls through to `editorial`.

Remove the import of `OverviewTab` and `fetchOverviewData`.

- [ ] **Step 5: Delete overview directory files**

```bash
rm apps/web/src/app/cms/\(authed\)/blog/_tabs/overview/overview-tab.tsx
rm apps/web/src/app/cms/\(authed\)/blog/_tabs/overview/kpi-strip.tsx
rm apps/web/src/app/cms/\(authed\)/blog/_tabs/overview/tag-breakdown.tsx
rm apps/web/src/app/cms/\(authed\)/blog/_tabs/overview/recent-publications.tsx
rmdir apps/web/src/app/cms/\(authed\)/blog/_tabs/overview
```

- [ ] **Step 6: Run tests and typecheck**

```bash
npm run test:web -- --run test/cms/blog-hub.test.ts test/cms/blog-hub-components.test.tsx test/cms/blog-hub-hooks.test.ts
```

Fix any compilation errors from removed imports.

- [ ] **Step 7: Commit**

```bash
git add -A apps/web/src/app/cms/\(authed\)/blog/
git commit -m "feat(blog): eliminate overview tab, make editorial default, add gear icon"
```

---

### Task 4: Replace VelocityStrip with inline KPI bar

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/editorial-tab.tsx`
- Test: `apps/web/test/cms/blog-hub-components.test.tsx`

- [ ] **Step 1: Write test for KPI bar**

Add to `apps/web/test/cms/blog-hub-components.test.tsx`:

```typescript
describe('EditorialTab KPI bar', () => {
  const mockData: EditorialTabData = {
    velocity: {
      throughput: 4,
      avgIdeaToPublished: 12,
      movedThisWeek: 2,
      bottleneck: null,
      totalPosts: 12,
      publishedCount: 8,
    },
    posts: [],
  }

  it('renders KPI metrics inline', () => {
    render(<EditorialTab data={mockData} />)
    expect(screen.getByText('12')).toBeInTheDocument() // totalPosts
    expect(screen.getByText('8')).toBeInTheDocument() // publishedCount
    expect(screen.getByText('4/mo')).toBeInTheDocument() // throughput
    expect(screen.getByText('12d')).toBeInTheDocument() // avgIdeaToPublished
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- --run test/cms/blog-hub-components.test.tsx`
Expected: FAIL — VelocityStrip doesn't render these inline KPIs

- [ ] **Step 3: Replace VelocityStrip with KPI bar in editorial-tab.tsx**

In `editorial-tab.tsx`, remove the `VelocityStrip` import (line 10) and the `SectionErrorBoundary` wrapping it (lines 165-167).

Replace with an inline KPI bar:

```tsx
      {/* KPI bar */}
      <div className="flex items-center rounded-lg border border-indigo-500/8 bg-indigo-500/3 px-3 py-2">
        <div className="flex items-center gap-1 border-r border-gray-800 px-2.5">
          <span className="text-[9px] text-gray-500">Total</span>
          <span className="text-[11px] font-semibold text-gray-300">{data.velocity.totalPosts}</span>
        </div>
        <div className="flex items-center gap-1 border-r border-gray-800 px-2.5">
          <span className="text-[9px] text-gray-500">Published</span>
          <span className="text-[11px] font-semibold text-gray-300">{data.velocity.publishedCount}</span>
        </div>
        <div className="flex items-center gap-1 border-r border-gray-800 px-2.5">
          <span className="text-[9px] text-gray-500">Throughput</span>
          <span className="text-[11px] font-semibold text-gray-300">{data.velocity.throughput}/mo</span>
        </div>
        <div className="flex items-center gap-1 border-r border-gray-800 px-2.5">
          <span className="text-[9px] text-gray-500">{strings?.editorial.ideaToPub ?? 'Idea→Pub'}</span>
          <span className="text-[11px] font-semibold text-gray-300">
            {data.velocity.avgIdeaToPublished > 0 ? `${data.velocity.avgIdeaToPublished}d` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1 px-2.5">
          <span className="text-[9px] text-gray-500">Bottleneck</span>
          <span className="text-[11px] font-semibold text-gray-400">
            {data.velocity.bottleneck?.column ?? (strings?.editorial.none ?? 'None')}
          </span>
        </div>
      </div>
```

- [ ] **Step 4: Run tests**

Run: `npm run test:web -- --run test/cms/blog-hub-components.test.tsx`
Expected: PASS

- [ ] **Step 5: Update existing VelocityStrip test expectations**

In `blog-hub-components.test.tsx`, find any existing `VelocityStrip` tests and update them to test the new inline KPI bar format, or remove them if they test the old component directly.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/_tabs/editorial/editorial-tab.tsx apps/web/test/cms/blog-hub-components.test.tsx
git commit -m "feat(blog): replace VelocityStrip with inline KPI bar"
```

---

### Task 5: Full-width kanban columns

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-column.tsx`
- Modify: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-card.tsx` (overlay width)
- Test: `apps/web/test/cms/blog-hub-components.test.tsx`

- [ ] **Step 1: Write test for flex-1 column class**

Add to `apps/web/test/cms/blog-hub-components.test.tsx`:

```typescript
describe('KanbanColumn full-width', () => {
  it('uses flex-1 instead of fixed width', () => {
    render(<KanbanColumn id="ready" title="Ready" cards={[]} />)
    const col = screen.getByLabelText(/Ready column/)
    expect(col.className).toContain('flex-1')
    expect(col.className).toContain('min-w-[220px]')
    expect(col.className).not.toContain('w-[220px]')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- --run test/cms/blog-hub-components.test.tsx`
Expected: FAIL — column still has `w-[220px] shrink-0`

- [ ] **Step 3: Update kanban-column.tsx**

In `kanban-column.tsx` line 59, change:
```typescript
      className={`flex w-[220px] shrink-0 flex-col rounded-lg border bg-gray-950 transition-all duration-200 ${
```
to:
```typescript
      className={`flex flex-1 min-w-[220px] flex-col rounded-lg border bg-gray-950 transition-all duration-200 ${
```

- [ ] **Step 4: Update KanbanCardOverlay width**

In `kanban-card.tsx` line 668, update the overlay to not have a fixed width since columns are now flexible:
```typescript
    <div className="w-[280px] rotate-2 rounded-lg border border-indigo-500/50 bg-gray-900 p-3 shadow-2xl shadow-indigo-500/10">
```

- [ ] **Step 5: Run tests**

Run: `npm run test:web -- --run test/cms/blog-hub-components.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/_tabs/editorial/kanban-column.tsx apps/web/src/app/cms/\(authed\)/blog/_tabs/editorial/kanban-card.tsx apps/web/test/cms/blog-hub-components.test.tsx
git commit -m "feat(blog): full-width kanban columns with flex-1"
```

---

### Task 6: Rich card redesign — cover image, snippet, progress bar, tag glow

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-card.tsx`
- Test: `apps/web/test/cms/blog-hub-components.test.tsx`

This is the largest task — a major rewrite of the card component.

- [ ] **Step 1: Write tests for rich card features**

Add to `apps/web/test/cms/blog-hub-components.test.tsx`:

```typescript
describe('KanbanCard rich features', () => {
  const baseCard: PostCard = {
    id: 'card-1',
    displayId: '#BP-001',
    title: 'Test Post Title',
    status: 'ready',
    tagId: 'tag-1',
    tagName: 'Behind the Scenes',
    tagColor: '#ef4444',
    tagNameTranslations: null,
    locales: ['pt-BR'],
    readingTimeMin: 7,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-05-14T00:00:00Z',
    publishedAt: null,
    scheduledFor: null,
    slotDate: null,
    snippet: 'A short excerpt from the post content...',
    coverImageUrl: 'https://example.com/cover.jpg',
    excerpt: 'A short excerpt from the post content...',
  }

  it('renders cover image when coverImageUrl is present', () => {
    render(<KanbanCard card={baseCard} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg')
  })

  it('renders gradient fallback when no cover image but has tag color', () => {
    const card = { ...baseCard, coverImageUrl: null }
    const { container } = render(<KanbanCard card={card} />)
    const gradientDiv = container.querySelector('[data-testid="card-gradient"]')
    expect(gradientDiv).toBeInTheDocument()
  })

  it('renders strip-only when no cover and no tag color', () => {
    const card = { ...baseCard, coverImageUrl: null, tagColor: null }
    const { container } = render(<KanbanCard card={card} />)
    const strip = container.querySelector('[data-testid="card-strip"]')
    expect(strip).toBeInTheDocument()
  })

  it('renders snippet text', () => {
    render(<KanbanCard card={baseCard} />)
    expect(screen.getByText('A short excerpt from the post content...')).toBeInTheDocument()
  })

  it('renders word count progress bar', () => {
    render(<KanbanCard card={baseCard} />)
    // readingTimeMin=7, estimated words = 7*200 = 1400, target 2000 = 70%
    const progressLabel = screen.getByText(/1400\/2000w/)
    expect(progressLabel).toBeInTheDocument()
  })

  it('applies tag-colored hover glow via data-tc attribute', () => {
    const { container } = render(<KanbanCard card={baseCard} />)
    const cardEl = container.querySelector('[data-tc="red"]')
    expect(cardEl).toBeInTheDocument()
  })

  it('maps tag color to correct color family', () => {
    const blueCard = { ...baseCard, tagColor: '#3b82f6' }
    const { container } = render(<KanbanCard card={blueCard} />)
    expect(container.querySelector('[data-tc="blue"]')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run test/cms/blog-hub-components.test.tsx`
Expected: FAIL — current card has none of these features

- [ ] **Step 3: Add helper functions to kanban-card.tsx**

Add these helpers near the top of `kanban-card.tsx` (after the imports, before the component):

```typescript
const WORD_COUNT_TARGET = 2000

function estimateWordCount(readingTimeMin: number | null): number {
  return (readingTimeMin ?? 0) * 200
}

function progressPercent(readingTimeMin: number | null): number {
  const words = estimateWordCount(readingTimeMin)
  return Math.min(100, Math.round((words / WORD_COUNT_TARGET) * 100))
}

function progressColorClass(pct: number): string {
  if (pct >= 100) return 'bg-gradient-to-r from-green-500 to-cyan-500 shadow-[0_0_4px_rgba(34,197,94,0.3)]'
  if (pct >= 75) return 'bg-green-500 shadow-[0_0_3px_rgba(34,197,94,0.3)]'
  if (pct >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

function tagColorFamily(hex: string | null): string | null {
  if (!hex) return null
  const lower = hex.toLowerCase()
  if (lower.includes('ef4444') || lower.includes('f87171') || lower.includes('dc2626')) return 'red'
  if (lower.includes('3b82f6') || lower.includes('60a5fa') || lower.includes('2563eb')) return 'blue'
  if (lower.includes('22c55e') || lower.includes('4ade80') || lower.includes('16a34a')) return 'green'
  if (lower.includes('a855f7') || lower.includes('8b5cf6') || lower.includes('7c3aed')) return 'purple'
  return null
}

function statusBadge(status: PostCard['status']): { label: string; className: string } | null {
  switch (status) {
    case 'ready':
    case 'queued':
      return { label: 'Approved', className: 'bg-slate-400/10 text-slate-400' }
    case 'published':
      return { label: 'Published', className: 'bg-emerald-400/10 text-emerald-400' }
    default:
      return null
  }
}
```

- [ ] **Step 4: Rewrite the card render**

Replace the card JSX inside the `KanbanCard` component's main `<div>` (the content between the opening `<div ref={setNodeRef}...>` and its corresponding `</div>`, before the context menu). The new card structure:

```tsx
        {/* 3-tier cover system */}
        {card.coverImageUrl ? (
          <div className="relative h-[44px] w-full overflow-hidden rounded-t-lg">
            <img src={card.coverImageUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 from-[20%] to-transparent" />
          </div>
        ) : card.tagColor ? (
          <div className="relative h-[24px] overflow-hidden rounded-t-lg" data-testid="card-gradient">
            <div className="absolute inset-0 opacity-10" style={{ background: `linear-gradient(135deg, ${card.tagColor}, ${card.tagColor}80)` }} />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent" />
          </div>
        ) : (
          <div
            className="h-[3px] rounded-t-lg"
            data-testid="card-strip"
            style={{ background: `linear-gradient(90deg, ${card.tagColor ?? '#475569'}, transparent 50%)` }}
          />
        )}

        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-gray-900/60">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
          </div>
        )}

        {/* Drag grip (hover) */}
        <div className="absolute left-1 top-1/2 flex -translate-y-1/2 flex-col items-center gap-[2px] opacity-0 transition-opacity group-hover:opacity-100">
          {[...Array(6)].map((_, i) => (
            <span key={i} className="h-[3px] w-[3px] rounded-full bg-gray-600" />
          ))}
        </div>

        {/* Hover actions */}
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); handleClick() }}
            aria-label={s?.open ?? 'Open'}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-md border border-gray-700/50 bg-gray-900/90 text-gray-400 backdrop-blur-sm hover:bg-gray-800 hover:text-gray-200"
          >
            <Pencil className="h-[10px] w-[10px]" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
            aria-label={s?.moreActions ?? 'More actions'}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-md border border-gray-700/50 bg-gray-900/90 text-gray-400 backdrop-blur-sm hover:bg-gray-800 hover:text-gray-200"
          >
            <MoreVertical className="h-[10px] w-[10px]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-3 pb-3 pt-2.5">
          {/* Header row: id + status badge + tag */}
          <div className="mb-1.5 flex items-center justify-between gap-1">
            {isOptimistic ? (
              <span className="flex shrink-0 items-center gap-1 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[8px] font-bold text-indigo-400">
                <Sparkles className="h-2.5 w-2.5" /> NEW
              </span>
            ) : (
              <span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-[8px] font-bold tabular-nums text-gray-500">
                {card.displayId}
              </span>
            )}
            <div className="flex items-center gap-1">
              {statusBadge(card.status) && (
                <span className={`rounded px-1.5 py-0.5 text-[8px] font-semibold ${statusBadge(card.status)!.className}`}>
                  {statusBadge(card.status)!.label}
                </span>
              )}
              {/* Tag badge (existing inline dropdown) */}
              <div className="relative" ref={tagDropdownRef}>
                {/* ... keep existing tag badge button and dropdown JSX unchanged ... */}
              </div>
            </div>
          </div>

          {/* Title — 13px/600 */}
          <p className={`text-[13px] font-semibold leading-snug line-clamp-2 ${card.title ? 'text-gray-100' : 'italic text-gray-600'}`}>
            {card.title || (s?.untitled ?? 'Untitled')}
          </p>

          {/* Snippet — 11px */}
          {card.snippet && (
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400 line-clamp-2">
              {card.snippet}
            </p>
          )}

          {/* Word count progress bar */}
          {card.readingTimeMin != null && card.readingTimeMin > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full ${progressColorClass(progressPercent(card.readingTimeMin))}`}
                  style={{ width: `${progressPercent(card.readingTimeMin)}%` }}
                />
              </div>
              <span className={`text-[9px] tabular-nums whitespace-nowrap ${
                progressPercent(card.readingTimeMin) >= 100 ? 'text-green-400' : 'text-gray-500'
              }`}>
                {progressPercent(card.readingTimeMin) >= 100 ? '✓ ' : ''}
                {estimateWordCount(card.readingTimeMin)}/{WORD_COUNT_TARGET}w
              </span>
            </div>
          )}

          {/* Footer row */}
          <div className="mt-2 flex items-center gap-1.5 border-t border-gray-800/40 pt-2 text-[9px] text-gray-600">
            {card.locales.map((loc) => (
              <span key={loc} className={`rounded px-1 py-0.5 text-[8px] font-medium uppercase ${localeColorClass(loc)}`}>
                {LOCALE_FLAGS[loc] ?? ''} {loc.toUpperCase()}
              </span>
            ))}
            {card.readingTimeMin != null && (
              <span className="tabular-nums">{card.readingTimeMin} min</span>
            )}
            <time className="ml-auto">{formatRelativeDate(card.updatedAt)}</time>
            {card.slotDate && (
              <span className="rounded bg-purple-500/10 px-1 py-0.5 text-[8px] text-purple-400">
                {new Date(card.slotDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
```

- [ ] **Step 5: Update the outer card div with tag glow classes**

Replace the outer card `<div>` className to include `data-tc` and tag-glow hover styling:

```tsx
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          role="button"
          tabIndex={0}
          data-tc={tagColorFamily(card.tagColor)}
          aria-label={`${card.displayId} ${card.title || (s?.untitled ?? 'Untitled')}`}
          aria-busy={isLoading}
          onClick={handleClick}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isLoading) { e.preventDefault(); handleClick() }
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!isOptimistic) setContextMenu({ x: e.clientX, y: e.clientY })
          }}
          className={`group relative overflow-hidden rounded-lg border shadow-sm transition-all duration-200 ${
            isOptimistic
              ? 'animate-fade-in border-indigo-500/60 bg-indigo-950/20 ring-1 ring-indigo-500/20'
              : confirmed
                ? 'border-emerald-500/60 bg-emerald-950/10 ring-1 ring-emerald-500/20'
                : isDragging
                  ? 'border-indigo-500/30 bg-indigo-950/20 opacity-40'
                  : isLoading
                    ? 'pointer-events-none border-indigo-500/40 bg-indigo-950/10'
                    : 'cursor-pointer border-gray-800 bg-[#131B2E] hover:-translate-y-0.5 hover:shadow-lg'
          }`}
        >
```

- [ ] **Step 6: Add tag-glow CSS**

Since Tailwind 4 supports arbitrary `data-*` selectors, add a `<style>` tag or inline the styles. The simplest approach is to use inline `onMouseEnter`/`onMouseLeave` handlers:

```typescript
  const glowFamily = tagColorFamily(card.tagColor)
  const glowColors: Record<string, { border: string; shadow: string }> = {
    red: { border: 'rgba(239,68,68,0.35)', shadow: '0 6px 20px rgba(239,68,68,0.06), 0 2px 6px rgba(0,0,0,0.3)' },
    blue: { border: 'rgba(59,130,246,0.35)', shadow: '0 6px 20px rgba(59,130,246,0.06), 0 2px 6px rgba(0,0,0,0.3)' },
    green: { border: 'rgba(34,197,94,0.35)', shadow: '0 6px 20px rgba(34,197,94,0.06), 0 2px 6px rgba(0,0,0,0.3)' },
    purple: { border: 'rgba(168,85,247,0.35)', shadow: '0 6px 20px rgba(168,85,247,0.06), 0 2px 6px rgba(0,0,0,0.3)' },
  }
```

Then add `onMouseEnter`/`onMouseLeave` to the outer card div (only when not dragging/loading/optimistic):

```typescript
          onMouseEnter={(e) => {
            if (glowFamily && !isOptimistic && !isDragging && !isLoading) {
              const glow = glowColors[glowFamily]
              if (glow) {
                e.currentTarget.style.borderColor = glow.border
                e.currentTarget.style.boxShadow = glow.shadow
              }
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = ''
            e.currentTarget.style.boxShadow = ''
          }}
```

- [ ] **Step 7: Run tests**

Run: `npm run test:web -- --run test/cms/blog-hub-components.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/_tabs/editorial/kanban-card.tsx apps/web/test/cms/blog-hub-components.test.tsx
git commit -m "feat(blog): rich kanban cards with cover image, snippet, progress bar, tag glow"
```

---

### Task 7: Pipeline gem-card cover image and Promote button

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/gem-card.tsx`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx`
- Test: `apps/web/test/cms/pipeline-gem-card.test.tsx` (new or existing)

- [ ] **Step 1: Add coverImageUrl to GemCardItem interface**

In `gem-card.tsx`, add to the `GemCardItem` interface after `version: number` (line 41):

```typescript
  cover_image_url: string | null
```

- [ ] **Step 2: Add cover_image_url to pipeline query**

In `[format]/page.tsx`, add `cover_image_url` to the select string (line 25):

Change:
```
id, code, title_pt, title_en, stage, priority, language, tags,
```
to:
```
id, code, title_pt, title_en, stage, priority, language, tags, cover_image_url,
```

And in the mapping (line 56-69), add:
```typescript
      cover_image_url: item.cover_image_url ?? null,
```

- [ ] **Step 3: Add cover image rendering to GemCard**

In `gem-card.tsx`, add a cover image section after the opening `<div>` and before the priority bar (line 96). Replace the priority bar section:

```tsx
      {/* Cover image tier */}
      {item.cover_image_url ? (
        <>
          <div className="relative h-[44px] w-full overflow-hidden rounded-t-lg -mt-3 -mx-3 mb-2">
            <img src={item.cover_image_url} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--gem-surface)] from-[20%] to-transparent" />
          </div>
          {/* Priority bar below cover */}
          <div
            className="h-0.5 -mx-3 mb-2"
            style={{
              background: `linear-gradient(to right, ${priority.accent}, transparent 75%)`,
              opacity: item.priority <= 1 ? 0.25 : 1,
            }}
          />
        </>
      ) : (
        /* Original priority bar */
        <div
          className="h-0.5 -mx-3 -mt-3 mb-2 rounded-t-lg"
          style={{
            background: `linear-gradient(to right, ${priority.accent}, transparent 75%)`,
            opacity: item.priority <= 1 ? 0.25 : 1,
          }}
        />
      )}
```

- [ ] **Step 4: Add Promote button for Pronto stage**

Add the `onPromote` prop to `GemCardProps`:

```typescript
interface GemCardProps {
  item: GemCardItem
  isDragging?: boolean
  onNavigate?: () => void
  onPromote?: (itemId: string) => void
}
```

Update the function signature:
```typescript
export const GemCard = memo(function GemCard({ item, isDragging: _isDragging, onNavigate, onPromote }: GemCardProps) {
```

Add the promote button before the graduated emerald bar (before line 203):

```tsx
      {/* Promote to Posts Hub — only on ready/pronto stage */}
      {item.stage === 'ready' && !isGraduated && onPromote && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPromote(item.id) }}
          className="mx-0 mt-2 flex w-full items-center gap-1 rounded-md border border-indigo-500/15 bg-indigo-500/8 px-2.5 py-1.5 text-[9px] font-semibold text-indigo-400 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/15 hover:text-indigo-300"
        >
          <span className="text-[11px]">&rarr;</span> Promote to Posts Hub
        </button>
      )}
```

- [ ] **Step 5: Wire onPromote in PipelineBoard**

In `pipeline-board.tsx`, add a `handlePromote` callback that navigates to the graduation flow. This depends on existing graduation logic — find it and wire it through the `GemCard` → `SortableGemCard` props chain.

- [ ] **Step 6: Run tests**

```bash
npm run test:web -- --run test/cms/pipeline
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/
git commit -m "feat(pipeline): add cover image to gem cards, promote button on Pronto stage"
```

---

### Task 8: "Promoted from Pipeline" hint in Ready column

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-column.tsx`

- [ ] **Step 1: Add hint to Ready column**

In `kanban-column.tsx`, after the card list `</SortableContext>` block (line 123) and before the published footer, add a hint for the Ready column:

```tsx
      {/* Ready column: Promoted from Pipeline hint */}
      {id === 'ready' && (
        <div className="border-t border-gray-800/50 px-3 py-2 text-[9px] text-gray-600">
          <span className="opacity-30">&larr;</span> Promoted from Pipeline
        </div>
      )}
```

- [ ] **Step 2: Run tests**

```bash
npm run test:web -- --run test/cms/blog-hub-components.test.tsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/_tabs/editorial/kanban-column.tsx
git commit -m "feat(blog): add Promoted from Pipeline hint to Ready column"
```

---

### Task 9: Dashboard Blog Health section

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_components/dashboard-blog-health.tsx`
- Create: `apps/web/src/app/cms/(authed)/_components/dashboard-blog-health-queries.ts`
- Modify: `apps/web/src/app/cms/(authed)/_components/dashboard-connected.tsx`
- Test: `apps/web/test/cms/dashboard-blog-health.test.tsx`

- [ ] **Step 1: Write test for BlogHealthSection**

Create `apps/web/test/cms/dashboard-blog-health.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlogHealthSection, type BlogHealthData } from '@/app/cms/(authed)/_components/dashboard-blog-health'

describe('BlogHealthSection', () => {
  const mockData: BlogHealthData = {
    totalPosts: 12,
    totalPostsTrend: 15.2,
    published: 8,
    publishedTrend: 20.0,
    avgReadingTime: 6,
    avgReadingTimeTrend: -5.3,
    draftBacklog: 4,
    draftBacklogTrend: 10.0,
    tagBreakdown: [
      { tagName: 'Behind the Scenes', tagColor: '#ef4444', count: 5 },
      { tagName: 'Control', tagColor: '#3b82f6', count: 3 },
    ],
    velocitySparkline: [2, 3, 1, 4, 3, 2, 5, 4],
    recentPublications: [
      { id: '1', title: 'Test Post', tagName: 'BtS', tagColor: '#ef4444', publishedAt: '2026-05-10T00:00:00Z' },
    ],
  }

  it('renders KPI values', () => {
    render(<BlogHealthSection data={mockData} />)
    expect(screen.getByText('12')).toBeInTheDocument() // totalPosts
    expect(screen.getByText('8')).toBeInTheDocument() // published
  })

  it('renders tag breakdown', () => {
    render(<BlogHealthSection data={mockData} />)
    expect(screen.getByText('Behind the Scenes')).toBeInTheDocument()
    expect(screen.getByText('Control')).toBeInTheDocument()
  })

  it('renders recent publications', () => {
    render(<BlogHealthSection data={mockData} />)
    expect(screen.getByText('Test Post')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Create BlogHealthSection component**

Create `apps/web/src/app/cms/(authed)/_components/dashboard-blog-health.tsx`:

```typescript
'use client'

import { SparklineSvg } from '../blog/_shared/sparkline-svg'

export interface BlogHealthData {
  totalPosts: number
  totalPostsTrend: number
  published: number
  publishedTrend: number
  avgReadingTime: number
  avgReadingTimeTrend: number
  draftBacklog: number
  draftBacklogTrend: number
  tagBreakdown: Array<{ tagName: string; tagColor: string; count: number }>
  velocitySparkline: number[]
  recentPublications: Array<{
    id: string
    title: string
    tagName: string | null
    tagColor: string | null
    publishedAt: string
  }>
}

function MiniKpi({ label, value, trend }: { label: string; value: number | string; trend?: number }) {
  const trendStr = trend != null && trend !== 0
    ? `${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`
    : null

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-slate-500">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-semibold tabular-nums text-slate-200">{value}</span>
        {trendStr && (
          <span className={`text-[9px] ${trend! > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trendStr}
          </span>
        )}
      </div>
    </div>
  )
}

export function BlogHealthSection({ data }: { data: BlogHealthData }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5" data-testid="blog-health">
      <h3 className="mb-4 text-sm font-semibold text-slate-200">Blog Health</h3>

      {/* KPI mini-strip */}
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MiniKpi label="Total Posts" value={data.totalPosts} trend={data.totalPostsTrend} />
        <MiniKpi label="Published" value={data.published} trend={data.publishedTrend} />
        <MiniKpi label="Avg Reading" value={`${data.avgReadingTime} min`} trend={data.avgReadingTimeTrend} />
        <MiniKpi label="Draft Backlog" value={data.draftBacklog} trend={data.draftBacklogTrend} />
      </div>

      {/* Tag breakdown + velocity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Tag breakdown */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">By Tag</h4>
          <div className="space-y-1.5">
            {data.tagBreakdown.map((tag) => (
              <div key={tag.tagName} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.tagColor }} />
                <span className="flex-1 text-xs text-slate-300">{tag.tagName}</span>
                <span className="text-xs tabular-nums text-slate-500">{tag.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Velocity + Recent */}
        <div>
          {data.velocitySparkline.length >= 2 && (
            <div className="mb-3">
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Velocity</h4>
              <SparklineSvg data={data.velocitySparkline} width={200} height={32} color="#6366f1" variant="area" />
            </div>
          )}
          {data.recentPublications.length > 0 && (
            <div>
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recent</h4>
              <ul className="space-y-1">
                {data.recentPublications.slice(0, 5).map((pub) => (
                  <li key={pub.id} className="flex items-center gap-2 text-xs text-slate-300">
                    {pub.tagColor && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: pub.tagColor }} />}
                    <span className="truncate">{pub.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create query function**

Create `apps/web/src/app/cms/(authed)/_components/dashboard-blog-health-queries.ts`:

```typescript
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { BlogHealthData } from './dashboard-blog-health'

export const fetchDashboardBlogHealth = unstable_cache(
  async (siteId: string): Promise<BlogHealthData | null> => {
    const supabase = getSupabaseServiceClient()

    const { data: posts } = await supabase
      .from('blog_posts')
      .select('id, status, tag_id, created_at, published_at, blog_tags(name, color), blog_translations(reading_time_min)')
      .eq('site_id', siteId)

    if (!posts || posts.length === 0) return null

    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000

    const published = posts.filter((p) => p.status === 'published')
    const drafts = posts.filter((p) => p.status === 'idea' || p.status === 'draft' || p.status === 'pending_review')

    const publishedRecent = published.filter((p) => p.published_at && new Date(p.published_at).getTime() > thirtyDaysAgo)
    const publishedPrev = published.filter((p) => p.published_at && new Date(p.published_at).getTime() > sixtyDaysAgo && new Date(p.published_at).getTime() <= thirtyDaysAgo)

    const readingTimes = posts.flatMap((p) => {
      const trans = p.blog_translations as Array<{ reading_time_min: number | null }> | null
      return trans?.map((t) => t.reading_time_min).filter((r): r is number => r != null) ?? []
    })
    const avgReading = readingTimes.length > 0 ? Math.round(readingTimes.reduce((a, b) => a + b, 0) / readingTimes.length) : 0

    const tagMap = new Map<string, { name: string; color: string; count: number }>()
    for (const p of posts) {
      const tag = p.blog_tags as unknown as { name: string; color: string } | null
      const key = tag?.name ?? 'Untagged'
      const existing = tagMap.get(key)
      if (existing) {
        existing.count++
      } else {
        tagMap.set(key, { name: key, color: tag?.color ?? '#475569', count: 1 })
      }
    }

    // 8-week velocity sparkline
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const sparkline: number[] = []
    for (let w = 7; w >= 0; w--) {
      const weekStart = now - (w + 1) * weekMs
      const weekEnd = now - w * weekMs
      sparkline.push(
        published.filter((p) => p.published_at && new Date(p.published_at).getTime() >= weekStart && new Date(p.published_at).getTime() < weekEnd).length,
      )
    }

    const recentPubs = published
      .filter((p) => p.published_at)
      .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())
      .slice(0, 5)

    const pctChange = (current: number, previous: number) =>
      previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100

    return {
      totalPosts: posts.length,
      totalPostsTrend: 0,
      published: published.length,
      publishedTrend: pctChange(publishedRecent.length, publishedPrev.length),
      avgReadingTime: avgReading,
      avgReadingTimeTrend: 0,
      draftBacklog: drafts.length,
      draftBacklogTrend: 0,
      tagBreakdown: Array.from(tagMap.values())
        .sort((a, b) => b.count - a.count)
        .map((t) => ({ tagName: t.name, tagColor: t.color, count: t.count })),
      velocitySparkline: sparkline,
      recentPublications: recentPubs.map((p) => {
        const tag = p.blog_tags as unknown as { name: string; color: string } | null
        const trans = (p.blog_translations as Array<{ reading_time_min: number | null }> | null)?.[0]
        return {
          id: p.id,
          title: `Post ${p.id.slice(0, 8)}`,
          tagName: tag?.name ?? null,
          tagColor: tag?.color ?? null,
          publishedAt: p.published_at!,
        }
      }),
    }
  },
  ['dashboard-blog-health'],
  { tags: ['dashboard', 'blog-health'], revalidate: 120 },
)
```

- [ ] **Step 4: Wire into DashboardConnected**

In `dashboard-connected.tsx`, add to the `DashboardData` interface:

```typescript
  blogHealth?: BlogHealthData | null
```

Import the component:
```typescript
import { BlogHealthSection, type BlogHealthData } from './dashboard-blog-health'
```

In the `DashboardConnected` render, after `{lastNewsletter && <NewsletterBanner newsletter={lastNewsletter} />}` (line 530), add:

```tsx
      {/* Blog Health */}
      {data.blogHealth && <BlogHealthSection data={data.blogHealth} />}
```

- [ ] **Step 5: Wire query in the dashboard server page**

Find the dashboard page.tsx server component and call `fetchDashboardBlogHealth(siteId)` alongside other data fetches, passing the result as `blogHealth` in the `DashboardData`.

- [ ] **Step 6: Run tests**

```bash
npm run test:web -- --run test/cms/dashboard-blog-health.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/_components/dashboard-blog-health.tsx apps/web/src/app/cms/\(authed\)/_components/dashboard-blog-health-queries.ts apps/web/src/app/cms/\(authed\)/_components/dashboard-connected.tsx apps/web/test/cms/dashboard-blog-health.test.tsx
git commit -m "feat(dashboard): add Blog Health section with KPIs, tag breakdown, velocity"
```

---

### Task 10: Update kanban column accent colors

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-board.tsx`

- [ ] **Step 1: Update Scheduled column color**

In `kanban-board.tsx` line 27, change:
```typescript
  { id: 'scheduled', key: 'scheduled' as const, color: '#8b5cf6' },
```
to:
```typescript
  { id: 'scheduled', key: 'scheduled' as const, color: '#a78bfa' },
```

- [ ] **Step 2: Run tests**

```bash
npm run test:web -- --run test/cms/blog-hub-components.test.tsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/_tabs/editorial/kanban-board.tsx
git commit -m "fix(blog): update scheduled column color to #a78bfa for dark bg contrast"
```

---

### Task 11: Final integration test and typecheck

**Files:**
- All modified files

- [ ] **Step 1: Run full test suite**

```bash
npm run test:web
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

- [ ] **Step 3: Fix any failures**

Address type errors from removed Overview types, updated PostCard shape, or new component interfaces.

- [ ] **Step 4: Run API tests too**

```bash
npm run test:api
```

- [ ] **Step 5: Final commit if any fixes**

```bash
git add -A
git commit -m "fix(blog): resolve type errors and test failures from kanban redesign"
```

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | Update PostCard type + BlogTabId | 5 min |
| 2 | Update editorial query (cover, excerpt, velocity) | 10 min |
| 3 | Eliminate Overview tab, default to Editorial | 10 min |
| 4 | Replace VelocityStrip with KPI bar | 10 min |
| 5 | Full-width kanban columns | 5 min |
| 6 | Rich card redesign (cover, snippet, progress, glow) | 30 min |
| 7 | Pipeline gem-card cover + Promote button | 15 min |
| 8 | "Promoted from Pipeline" hint in Ready column | 3 min |
| 9 | Dashboard Blog Health section | 20 min |
| 10 | Column accent color update | 2 min |
| 11 | Final integration test + typecheck | 10 min |

**Total estimated: ~2 hours**
