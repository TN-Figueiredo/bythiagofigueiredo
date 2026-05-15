# Content–Pipeline Unification: Blog Hub Redesign

**Date:** 2026-05-15
**Status:** Draft
**Scope:** Merge the separate Blog kanban and Pipeline blog_post kanban into a single unified 6-lane content hub at `/cms/blog`.

> **Out of scope:** Sidebar/navigation restructuring (handled concurrently in a separate workstream). This spec focuses exclusively on the Blog Hub page, its components, data layer, and routes.

---

## 1. Problem Statement

Blog post management is currently split across three separate views:

| View | Route | Lanes | Data source |
|------|-------|-------|-------------|
| Pipeline > Blog | `/cms/pipeline/blog_post` | Ideia / Rascunho / Pronto | `content_pipeline` |
| Content > Posts | `/cms/posts` | Ready / Scheduled / Published | `blog_posts` |
| Content > Blog Hub | `/cms/blog` | Ready / Scheduled / Published | `blog_posts` |

This forces the user to jump between three pages to track a single piece of content from idea to publication. "Ready"/"Pronto" appears in two different boards with different semantics. The pipeline board shows content before it becomes a blog post; the blog boards show it after.

**Goal:** One page, one kanban, full lifecycle — from raw idea to published post.

---

## 2. Unified 6-Lane Kanban

### 2.1 Lane Definitions

```
 Pipeline data (content_pipeline)          Blog data (blog_posts)
┌──────────┬──────────┬──────────┐ ⟫ ┌──────────┬──────────┬──────────┐
│  Ideia   │ Rascunho │  Pronto  │ ⟫ │Em Edição │ Agendado │Publicado │
│          │          │          │ ⟫ │          │          │          │
│  idea    │  draft   │  ready   │ ⟫ │ mixed*   │scheduled │published │
└──────────┴──────────┴──────────┘ ⟫ └──────────┴──────────┴──────────┘
                                  ⟫
                          Promotion boundary
```

\* "Em Edição" aggregates blog posts with statuses: `idea`, `draft`, `pending_review`, `ready`, `queued`. These are shown as substatus badges on each card.

The promotion boundary (`⟫`) is a visual divider in the kanban. Crossing it requires a promotion action (not a simple drag) because it creates a new `blog_posts` row from a `content_pipeline` item.

### 2.2 Lane Display Order

Lanes are displayed left-to-right following the natural production workflow. This order is fixed and not user-configurable:

| Position | Lane | Rationale |
|----------|------|-----------|
| 1 | **Ideia** | Starting point — raw content ideas enter here |
| 2 | **Rascunho** | Active writing/development of the idea |
| 3 | **Pronto** | Pipeline work complete, awaiting promotion to blog |
| 4 | **Em Edição** | Post created, editorial work (formatting, SEO, locale) |
| 5 | **Agendado** | Scheduled for publication on a specific date |
| 6 | **Publicado** | Live on the site |

This mirrors the left-to-right reading direction and the chronological content lifecycle: ideation → development → readiness → editorial → scheduling → publication.

### 2.3 Card Sort Order Within Lanes

Each lane uses a sort order optimized for **what the user needs to see first** in that stage of the workflow:

| Lane | Primary sort | Secondary sort | Rationale |
|------|-------------|----------------|-----------|
| **Ideia** | `priority` DESC | `created_at` ASC | Highest-priority ideas surface first. Among same priority, oldest idea first to prevent staleness. |
| **Rascunho** | `priority` DESC | `updated_at` DESC | Active drafts: highest priority first, most recently touched at top (continue momentum). |
| **Pronto** | `priority` DESC | `updated_at` ASC | Ready to promote: highest priority first, longest-waiting item surfaces (prevent bottleneck). |
| **Em Edição** | `updated_at` DESC | — | Most recently edited post at top — the one you were just working on. |
| **Agendado** | `scheduled_for` ASC | — | Nearest publication date first — urgency-based, shows what's coming up next. |
| **Publicado** | `published_at` DESC | — | Most recently published at top — latest content, reverse chronological. |

**Drag-and-drop reordering within a lane** is supported only for pipeline lanes (Ideia, Rascunho, Pronto) using the existing fractional `sort_order` column. When `sort_order` is set, it overrides the default sort. Blog lanes (Em Edição, Agendado, Publicado) use the timestamp-based sorts above and do not support manual reordering.

### 2.4 Tab Order

The Blog Hub has three tabs. Their order reflects the workflow priority — you manage content first, plan scheduling second, review results third:

| Position | Tab | Purpose |
|----------|-----|---------|
| 1 | **Editorial** | The unified 6-lane kanban. Primary workspace. |
| 2 | **Schedule** | Calendar view of upcoming publications. Planning. |
| 3 | **Analytics** | Content performance metrics. Review. |

This order is unchanged from the current implementation.

---

## 3. Promotion Flow

### 3.1 Promotion Boundary

The boundary between "Pronto" (lane 3) and "Em Edição" (lane 4) is not a simple drag. It requires:

1. **Locale selection** — the user must choose which locale(s) the blog post will target (e.g., `pt-BR`, `en`). This is required because `blog_translations` needs at least one locale row.
2. **Blog post creation** — a new row in `blog_posts` + `blog_translations`, copying data from the pipeline item.

### 3.2 Two Promotion Paths

**Slow path — "Promote":**
- Triggered by: "Promote" button on Pronto cards, or context menu "Promover para Blog"
- Shows: Locale selection modal only
- Result: Creates post with status `idea` in "Em Edição" lane
- The pipeline item gets `blog_post_id` linked

**Fast track — "Promote & Schedule":**
- Triggered by: Context menu "Promover e Agendar"
- Shows: Locale + date/time picker modal
- Result: Creates post with status `scheduled` in "Agendado" lane
- The pipeline item gets `blog_post_id` linked

### 3.3 Promotion Modal

```
┌─────────────────────────────────────┐
│  Promover para Blog                 │
│                                     │
│  Título: "Como Usar IA no Dia-a-Dia"│
│  Código: blog-como-usar-ia          │
│                                     │
│  Idiomas:                           │
│  ☑ pt-BR (padrão)                   │
│  ☐ en                               │
│                                     │
│  [ ] Agendar publicação             │
│      📅 ____/____/______  ⏰ __:__  │
│                                     │
│  [Cancelar]           [Promover →]  │
└─────────────────────────────────────┘
```

When "Agendar publicação" is checked, the date/time picker appears and the button changes to "Promover e Agendar →".

### 3.4 `createPostFromPipeline` — Existing Action

The existing server action in `blog/actions.ts` handles promotion:

```typescript
createPostFromPipeline(siteId: string, pipelineItemId: string, locale: string)
```

This action:
- Copies `title`, `hook`, `body_content`, `category`, `cover_image_url` from the pipeline item
- Creates `blog_posts` row with status `idea`
- Creates `blog_translations` row with the selected locale
- Sets `content_pipeline.blog_post_id` to link the items
- Revalidates `/cms/blog`

**Extension needed:** Add optional `scheduledFor?: string` parameter. When provided, set status to `scheduled` and `scheduled_for` to the given timestamp instead of `idea`.

### 3.5 Return to Pipeline

A post in "Em Edição" can be returned to pipeline via context menu "Devolver ao Pipeline". This:
- Deletes the `blog_posts` row (only if status is `idea` or `draft` — safety guard)
- Clears `content_pipeline.blog_post_id`
- The pipeline item reappears in its original lane

### 3.6 Atomicity

All promotion and return operations run inside a Supabase RPC transaction. On failure: full rollback, toast error, no partial state.

---

## 4. Card Variants

The unified kanban renders two card types based on lane position.

### 4.1 Pipeline Card (Lanes 1–3: Ideia, Rascunho, Pronto)

Renders the existing `GemCard` component (currently at `pipeline/_components/gem-card.tsx`, 246 LOC, memoized). Displays:

- **Header row:** Format icon, code (`blog-xxx`), language badge, priority badge, staleness indicator
- **Cover image** (if present) with gradient overlay
- **Priority bar** — gradient accent based on priority level
- **Title** — 2-line clamp
- **Hook** — 2-line clamp with accent left border (or "sem hook definido" placeholder)
- **Tags** — collection code + pipeline tags (max 3, overflow count)
- **Footer:** Segmented checklist progress bar + VVS ring
- **Promote button** — only on "Pronto" lane, only if not already graduated

**Click navigation:** → `/cms/pipeline/items/{id}` (pipeline detail page, preserved as-is)

**Context menu (3 actions):**
1. Abrir item
2. Mover para... (submenu: other pipeline stages)
3. Arquivar

**Pronto lane adds:**
4. Promover para Blog
5. Promover e Agendar

### 4.2 Post Card (Lanes 4–6: Em Edição, Agendado, Publicado)

Renders the existing `KanbanCard` component (currently at `blog/_tabs/editorial/kanban-card.tsx`, 842 LOC). Displays:

- **Cover image** with gradient
- **Display ID** (#BP-001)
- **Title** — 2-line clamp
- **Substatus badge** — (only in "Em Edição" lane) colored pill showing actual status: idea, draft, pending_review, ready, queued
- **Tag** — category tag with color
- **Locale flags** — flag emoji + code for each locale
- **Reading time** — estimated word count / target indicator
- **Scheduled date** — (only in "Agendado" lane) formatted date/time
- **Social dots** — indicators for configured social platforms
- **Relative timestamp** — "2h", "3d", etc.

**Click navigation:** → `/cms/blog/{id}/edit` (post editor)

**Context menu (8 actions):**
1. Editar
2. Mover para... (submenu: valid status transitions per `BLOG_TRANSITIONS`)
3. Gerenciar tags
4. Gerenciar idiomas
5. Duplicar
6. Agendar publicação
7. Devolver ao Pipeline (only if linked to a pipeline item, only if status is idea/draft)
8. Excluir (only if status is draft/archived)

### 4.3 Substatus Badges (Em Edição Lane)

Posts in lane 4 have varying internal statuses. To keep orientation clear without adding more lanes, each card shows a colored badge:

| Status | Badge color | Label |
|--------|------------|-------|
| `idea` | gray | Ideia |
| `draft` | blue | Rascunho |
| `pending_review` | amber | Em Revisão |
| `ready` | cyan | Pronto |
| `queued` | purple | Na Fila |

---

## 5. Shared Component Architecture

### 5.1 Component Tree

```
UnifiedBoard (new)
├── LaneDivider (visual boundary marker between lane 3–4)
├── KanbanLane × 6 (shared, replaces both pipeline columns + blog columns)
│   ├── LaneHeader (count badge, color indicator)
│   └── SortableContext (@dnd-kit)
│       ├── PipelineCard (lanes 1–3) — extracted from current GemCard
│       └── PostCard (lanes 4–6) — extracted from current KanbanCard
├── PromotionModal (locale + optional schedule picker)
├── BulkActionBar (floating, appears on multi-select)
└── FilterBar (tag, locale, search — shared across all lanes)
```

### 5.2 KanbanLane (Shared)

A single `KanbanLane` component replaces both `DroppableColumn` (pipeline) and `KanbanColumn` (blog):

```typescript
interface KanbanLaneProps {
  id: string                          // lane identifier
  title: string                       // display label
  color: string                       // accent color
  count: number                       // item count for header badge
  children: React.ReactNode           // card components
  droppable: boolean                  // whether drag-drop is enabled for this lane
  maxWidth?: number                   // optional width constraint
}
```

### 5.3 Card Rendering Delegation

The `UnifiedBoard` maps items to the correct card component based on the lane:

```typescript
function renderCard(lane: LaneId, item: PipelineItem | PostCard) {
  if (lane === 'idea' || lane === 'draft' || lane === 'ready') {
    return <PipelineCard item={item as PipelineItem} />
  }
  return <PostCard item={item as PostCard} />
}
```

### 5.4 LOC Impact

| Action | Files | LOC |
|--------|-------|-----|
| Remove `posts/` directory (page, board, card) | 3 files | −278 |
| Remove `pipeline/[format]/page.tsx` blog_post route | 1 file | −84 |
| Remove `pipeline/_components/pipeline-board.tsx` | 1 file | −310 |
| Remove `blog/_tabs/editorial/kanban-board.tsx` | 1 file | −336 |
| Simplify `blog/_tabs/editorial/kanban-card.tsx` | 1 file | −400 (refactor) |
| New `UnifiedBoard` + `KanbanLane` + `PromotionModal` | 3 files | +550 |
| New `PipelineCard` (extracted, slimmed) | 1 file | +180 |
| New `PostCard` (extracted, slimmed) | 1 file | +220 |
| Update `blog/page.tsx` data fetching | 1 file | +50 |
| Update `hub-utils.ts` / `hub-types.ts` | 2 files | +40 |
| **Net** | | **≈ −370** |

---

## 6. Data Fetching

### 6.1 Server Component (blog/page.tsx)

The Blog Hub RSC fetches both data sources in parallel:

```typescript
const [sharedData, editorialData, pipelineData] = await Promise.all([
  fetchBlogSharedData(siteId),
  fetchEditorialData(siteId, tagId, locale),
  fetchPipelineData(siteId, 'blog_post'),
])
```

### 6.2 `fetchPipelineData` (New Query)

```typescript
export const fetchPipelineData = unstable_cache(
  async (siteId: string, format: string) => {
    const supabase = getSupabaseServiceClient()
    const { data } = await supabase
      .from('content_pipeline')
      .select('id, code, title_pt, title_en, format, stage, language, priority, hook, body_content, tags, production_checklist, updated_at, created_at, blog_post_id, cover_image_url, validation_score, dependencies:pipeline_dependencies(dependency_type, depends_on_pipeline:content_pipeline!pipeline_dependencies_depends_on_id_fkey(code)), collection_code, sort_order, version, is_archived, youtube_video_id, newsletter_edition_id, campaign_id, social_post_id, linked_post_status')
      .eq('site_id', siteId)
      .eq('format', format)
      .eq('is_archived', false)
      .is('blog_post_id', null)        // Only ungraduated items
      .in('stage', ['idea', 'draft', 'ready'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
    return data ?? []
  },
  ['pipeline-blog'],
  { tags: ['pipeline-blog'], revalidate: 60 },
)
```

The `.is('blog_post_id', null)` filter ensures graduated pipeline items (already linked to a blog post) don't appear in lanes 1–3.

### 6.3 `buildUnifiedLanes` (Client-Side Merge)

```typescript
function buildUnifiedLanes(pipelineItems: PipelineItem[], posts: PostCard[]): UnifiedLanes {
  return {
    idea:      pipelineItems.filter(i => i.stage === 'idea'),
    draft:     pipelineItems.filter(i => i.stage === 'draft'),
    ready:     pipelineItems.filter(i => i.stage === 'ready'),
    editing:   posts.filter(p => ['idea','draft','pending_review','ready','queued'].includes(p.status)),
    scheduled: posts.filter(p => p.status === 'scheduled'),
    published: posts.filter(p => p.status === 'published'),
  }
}
```

Each lane's items are pre-sorted by the query (pipeline) or sorted client-side (blog) according to the rules in §2.3.

### 6.4 Performance: Remove `force-dynamic`

The current `blog/page.tsx` uses `export const dynamic = 'force-dynamic'` which kills all caching. Replace with:
- `unstable_cache` on each data query (already used by `fetchBlogSharedData` and `fetchEditorialData`)
- `revalidateTag('blog-hub')` and `revalidateTag('pipeline-blog')` on mutations
- Remove the `force-dynamic` export entirely

### 6.5 Filtering

The existing filter bar is extended with a unified scope:

| Filter | Applies to | Implementation |
|--------|-----------|----------------|
| **Tag** | Blog lanes only | Server-side `.eq('tag_id', tagId)` |
| **Locale** | Blog lanes only | Server-side `.contains('blog_translations.locale', [locale])` |
| **Search** | All lanes | Client-side text match on title/code/hook |
| **Priority** | Pipeline lanes only | Client-side filter on priority level |

Filters that don't apply to a lane type simply show all items in those lanes (e.g., filtering by tag doesn't hide pipeline cards).

---

## 7. Drag-and-Drop Rules

### 7.1 Within-Lane Drag

- **Pipeline lanes (1–3):** Reorder via fractional `sort_order`. Uses existing `reorderPipelineItem` server action.
- **Blog lanes (4–6):** No manual reorder. Sort is timestamp-based (see §2.3).

### 7.2 Cross-Lane Drag

| From → To | Allowed? | Behavior |
|-----------|----------|----------|
| Pipeline lane → Pipeline lane | Yes | Updates `stage` via `movePipelineItem` action |
| Pipeline lane → Blog lane | **No** | Blocked. Must use Promote button/menu. Toast: "Use 'Promover' para criar um post." |
| Blog lane → Blog lane | Yes | Updates `status` via `movePost` action (validates via `isValidTransition`) |
| Blog lane → Pipeline lane | **No** | Blocked. Must use "Devolver ao Pipeline" menu. Toast: "Use 'Devolver ao Pipeline' no menu do card." |

### 7.3 Visual Feedback

- **Valid drop zone:** Lane header pulses, border highlights with lane accent color
- **Invalid drop zone (cross-boundary):** Lane dims with a subtle red-gray overlay, cursor shows `not-allowed`
- **Drag overlay:** Semi-transparent card follows cursor (existing behavior from both boards)

---

## 8. Bulk Operations

### 8.1 Selection

- **Cmd+Click** (Mac) / **Ctrl+Click** (Windows): Toggle single card selection
- **Shift+Click**: Range select within a lane
- Selection only works within the same card type (can't mix pipeline + post cards)
- Selected cards show a checkmark overlay and a blue ring

### 8.2 Floating Action Bar

When 1+ cards are selected, a floating bar appears at the bottom:

```
┌──────────────────────────────────────────────────────┐
│  3 selected   [Move to...]  [Publish]  [Archive]  [×]│
└──────────────────────────────────────────────────────┘
```

**Pipeline cards selected:**
- Move to... (Ideia / Rascunho / Pronto)
- Promote all (only if all are in Pronto — opens batch locale modal)
- Archive

**Post cards selected:**
- Move to... (valid shared transitions)
- Publish (uses existing `bulkPublish`)
- Archive (uses existing `bulkArchive`)
- Delete (uses existing `bulkDelete`, only drafts/archived)

---

## 9. The "+ Novo" Button

Top-right of the Editorial tab, a split button:

- **Primary action:** "Novo Post" — navigates to `/cms/blog/new` (existing new post page)
- **Dropdown:**
  - "Novo Post" — `/cms/blog/new`
  - "Nova Ideia no Pipeline" — opens inline creation form in the Ideia lane (title + priority + language)

---

## 10. Accessibility (WCAG 2.1 AA)

### 10.1 ARIA Structure

```html
<div role="grid" aria-label="Blog editorial kanban">
  <div role="row">
    <div role="gridcell" aria-label="Ideia — 3 items"> ... </div>
    <div role="gridcell" aria-label="Rascunho — 5 items"> ... </div>
    ...
  </div>
</div>
```

### 10.2 Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus between lanes |
| `↑` / `↓` | Move between cards within a lane |
| `←` / `→` | Move focus to adjacent lane (same card index) |
| `Space` | Enter drag mode on focused card |
| `Enter` | Open card (navigate to detail/edit page) |
| `Escape` | Cancel drag mode / close modal / deselect |
| `Cmd+A` | Select all cards in focused lane |

### 10.3 Focus Management

- Focus trap in modals (Promotion, Schedule)
- Return focus to triggering element on modal close
- Skip-link at top of kanban: "Skip to lane [name]"

### 10.4 Color & Contrast

- All text meets 4.5:1 contrast ratio against backgrounds
- Substatus badges use both color AND text label (not color-only)
- Promotion boundary uses both color (indigo divider) AND a label ("⟫ Publicação")

---

## 11. Routes and Redirects

### 11.1 Affected Routes

| Current route | Action | Redirect to |
|---------------|--------|------------|
| `/cms/blog` | **Keep** — this is the unified hub | — |
| `/cms/blog/[id]/edit` | **Keep** — post editor | — |
| `/cms/blog/new` | **Keep** — new post page | — |
| `/cms/posts` | **Remove** | 301 → `/cms/blog` |
| `/cms/pipeline/blog_post` | **Remove** | 301 → `/cms/blog` |
| `/cms/pipeline/items/[id]` | **Keep** — pipeline detail page | — |
| `/cms/pipeline` | **Keep** — overview for non-blog formats | — |
| `/cms/pipeline/[format]` for video/newsletter/campaign/course | **Keep** — only blog_post is absorbed | — |

### 11.2 Redirect Implementation

Add a `next.config.ts` redirect:

```typescript
redirects: async () => [
  { source: '/cms/posts', destination: '/cms/blog', permanent: true },
  { source: '/cms/posts/:path*', destination: '/cms/blog', permanent: true },
  { source: '/cms/pipeline/blog_post', destination: '/cms/blog', permanent: true },
]
```

---

## 12. Error States

| Scenario | Behavior |
|----------|----------|
| Pipeline fetch fails | Pipeline lanes show "Erro ao carregar pipeline" with retry button. Blog lanes render normally. |
| Blog fetch fails | Blog lanes show "Erro ao carregar posts" with retry button. Pipeline lanes render normally. |
| Promotion fails | Toast error "Falha ao promover: [message]". Pipeline item stays in Pronto lane. No partial state. |
| Drag to invalid target | Card snaps back to origin with shake animation. Toast hint. |
| Concurrent edit conflict | Optimistic update reverts. Toast: "Outro usuário modificou este item. Atualizando..." |

---

## 13. Testing Strategy

### 13.1 Unit Tests

| Component | Tests | Focus |
|-----------|-------|-------|
| `buildUnifiedLanes` | 6 | Correct filtering + sorting per lane |
| `renderCard` delegation | 4 | Pipeline vs Post card selection by lane |
| Sort functions | 6 | Priority × timestamp ordering correctness for each lane |
| `isValidTransition` (existing) | 8 | All valid + invalid transitions |
| Substatus badge mapping | 5 | Correct color/label per status |
| Promotion modal validation | 4 | At least one locale required, date validation |

### 13.2 Integration Tests

| Flow | Tests | Focus |
|------|-------|-------|
| Slow promotion | 2 | Pipeline item → blog post with locale. Verify `blog_post_id` linkage. |
| Fast track promotion | 2 | Pipeline item → scheduled post. Verify `scheduled_for` set. |
| Return to pipeline | 2 | Delete blog post, clear `blog_post_id`. Verify item reappears. |
| Cross-boundary drag blocked | 1 | Verify drag from pipeline to blog lane is rejected |
| Bulk publish | 1 | Multi-select + publish. Verify all status changes. |
| Filter by tag | 1 | Blog lanes filter, pipeline lanes unaffected |

### 13.3 Existing Tests Preserved

All existing tests in `apps/web/test/` for `blog/actions.ts` (bulk publish/archive/delete, `createPostFromPipeline`) continue to work without changes to their test setup.

---

## 14. Migration Checklist

1. Add `fetchPipelineData` query to `hub-queries.ts`
2. Update `blog/page.tsx` — remove `force-dynamic`, add pipeline data fetch
3. Create `UnifiedBoard` component with 6 lanes
4. Extract `PipelineCard` from `gem-card.tsx` (keep original for pipeline detail)
5. Extract `PostCard` from `kanban-card.tsx` (simplify: remove board logic)
6. Create `PromotionModal` component
7. Create `KanbanLane` shared component
8. Update `hub-utils.ts` — add substatus badge mapping, update lane definitions
9. Update `hub-types.ts` — add unified lane types
10. Extend `createPostFromPipeline` with optional `scheduledFor` parameter
11. Add `returnToPipeline` server action
12. Add bulk selection + floating action bar
13. Add `next.config.ts` redirects for removed routes
14. Delete `posts/` directory
15. Delete `pipeline/[format]/page.tsx` blog_post-specific handling
16. Write tests per §13

---

## 15. Files Changed

### New files
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/unified-board.tsx`
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-lane.tsx`
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/pipeline-card.tsx`
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/post-card.tsx`
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/promotion-modal.tsx`
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/bulk-action-bar.tsx`

### Modified files
- `apps/web/src/app/cms/(authed)/blog/page.tsx` — add pipeline data fetch, remove `force-dynamic`
- `apps/web/src/app/cms/(authed)/blog/_hub/hub-queries.ts` — add `fetchPipelineData`
- `apps/web/src/app/cms/(authed)/blog/_hub/hub-types.ts` — add `UnifiedLanes`, `PipelineItem` types
- `apps/web/src/app/cms/(authed)/blog/_hub/hub-utils.ts` — add substatus badges, lane sort helpers
- `apps/web/src/app/cms/(authed)/blog/actions.ts` — extend `createPostFromPipeline`, add `returnToPipeline`
- `apps/web/next.config.ts` — add redirects

### Deleted files
- `apps/web/src/app/cms/(authed)/posts/` (entire directory)
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-board.tsx` (replaced by unified-board)
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-card.tsx` (replaced by post-card)

### Preserved as-is
- `apps/web/src/app/cms/(authed)/pipeline/items/[id]/` (pipeline detail page)
- `apps/web/src/app/cms/(authed)/pipeline/_components/gem-card.tsx` (used by pipeline detail)
- `apps/web/src/lib/pipeline/workflows.ts`
- `apps/web/src/lib/pipeline/schemas.ts`
