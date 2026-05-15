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

**Drag-and-drop reordering within a lane** is supported only for pipeline lanes (Ideia, Rascunho, Pronto) using the existing integer `sort_order` column (midpoint insertion with 1000-step initial gaps). When `sort_order` is set, it overrides the default sort. Blog lanes (Em Edição, Agendado, Publicado) use the timestamp-based sorts above and do not support manual reordering.

### 2.4 Tab Order

The Blog Hub has three tabs. Their order reflects the workflow priority — you manage content first, plan scheduling second, review results third:

| Position | Tab | Purpose |
|----------|-----|---------|
| 1 | **Editorial** | The unified 6-lane kanban. Primary workspace. |
| 2 | **Schedule** | Calendar view of upcoming publications. Planning. |
| 3 | **Analytics** | Content performance metrics. Review. |

This order is unchanged from the current implementation.

### 2.5 Layout and Dimensions

**Lane width:** Each lane has a fixed `min-width: 220px` and `max-width: 320px`. Lanes flex-grow equally within the available container width. On a typical 1440px display with a 256px sidebar, 6 lanes fit comfortably at ~280px each.

**Horizontal scroll:** The lane container uses `overflow-x: auto`. If the viewport is too narrow for all 6 lanes at `min-width`, the container scrolls horizontally. A subtle horizontal scrollbar is always visible (not auto-hide) to signal scrollability. On desktop with 6 lanes at 220px minimum, scroll only triggers below ~1580px total viewport width (including sidebar).

**Lane height:** Each lane uses `overflow-y: auto` with `max-height: calc(100vh - 200px)` (accounting for header, tabs, filter bar, velocity strip). Cards scroll vertically within each lane.

**Promotion boundary:** A 2px vertical divider between lanes 3 and 4, colored `indigo-500/30`, with a small label "Publicação →" centered vertically. It occupies ~16px of horizontal space and is not a lane itself.

### 2.6 Responsive Behavior

This is a single-user CMS (not a team tool), so mobile optimization is practical, not critical. Strategy:

| Breakpoint | Layout |
|------------|--------|
| `≥1280px` (lg) | 6 lanes side-by-side, no horizontal scroll needed |
| `1024px–1279px` (md) | 6 lanes at `min-width`, horizontal scroll enabled |
| `768px–1023px` (sm) | Horizontal scroll with touch-friendly swipe. Lane header becomes sticky at top during vertical scroll. |
| `<768px` (xs) | Single-lane view with a lane selector dropdown at the top. Shows one lane at a time. Swipe left/right to switch. |

### 2.7 Empty States

Each lane shows a contextual empty state when it has zero items:

| Lane | Empty message | CTA |
|------|--------------|-----|
| **Ideia** | "Nenhuma ideia ainda" | "+ Nova Ideia" button → inline creation form |
| **Rascunho** | "Nenhum rascunho em progresso" | — |
| **Pronto** | "Nenhum item pronto para promover" | — |
| **Em Edição** | "Nenhum post em edição" | "+ Novo Post" button → `/cms/blog/new` |
| **Agendado** | "Nenhum post agendado" | — |
| **Publicado** | "Nenhum post publicado" | — |

Empty lanes render at `min-width` (220px) with the message centered, 50% opacity, and a dashed border. They do NOT collapse — maintaining visual lane position is important for spatial orientation.

### 2.8 Loading States

The unified board has two independent data sources that may resolve at different times:

1. **Initial load:** A skeleton with 6 lane outlines, each containing 3 shimmer card placeholders (pipeline cards are slightly shorter than post cards). The promotion boundary divider renders immediately.
2. **Partial load:** If pipeline data resolves first, lanes 1–3 render real cards while lanes 4–6 show shimmer. And vice versa. Each half is wrapped in its own `<Suspense>` boundary.
3. **Revalidation:** On mutation (move, promote, etc.), the affected lane's cards show a subtle pulse animation during the `useTransition` pending state. Cards don't disappear — optimistic state holds until server confirms.

### 2.9 Pagination (Publicado Lane)

The "Publicado" lane grows indefinitely as content is published. To prevent performance degradation:

- **Initial load:** Fetch the 30 most recent published posts (sorted by `published_at DESC`).
- **"Mostrar mais":** A button at the bottom of the Publicado lane loads the next 30 posts on click. This is client-side pagination (not infinite scroll — avoids accidental DOM explosion).
- **Lane count badge:** Shows `30 de 142` when paginated, `142` when all loaded.
- **Other lanes:** No pagination needed — pipeline items and in-progress/scheduled posts are small finite sets.

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

A post in "Em Edição" can be returned to pipeline via context menu "Devolver ao Pipeline".

**New server action** in `blog/actions.ts`:

```typescript
export async function returnToPipeline(
  postId: string,
): Promise<{ ok: true } | { ok: false; error: string }>
```

This action:
- Resolves `siteId` via `getSiteContext()` (same pattern as all other actions in the file)
- Verifies `requireEditScope(siteId)`
- Checks the post status is `idea` or `draft` (safety guard — rejects if scheduled/published)
- Looks up the linked `content_pipeline` row via `blog_post_id`
- In a single transaction: deletes the `blog_posts` row + clears `content_pipeline.blog_post_id`
- Revalidates both `blog-hub` and `pipeline-blog` cache tags
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
- **Pipeline provenance** — if linked to a pipeline item, a small `↗ blog-xxx` code pill links back to the source item
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
| Remove `posts/` directory (board, cards, editor, tabs, sidebar) | 21 files | −2,428 |
| Remove `pipeline/[format]/page.tsx` blog_post route | 1 file | −84 |
| Remove `pipeline/_components/pipeline-board.tsx` | 1 file | −310 |
| Remove `blog/_tabs/editorial/kanban-board.tsx` | 1 file | −336 |
| Remove `blog/_tabs/editorial/kanban-column.tsx` | 1 file | −148 |
| Simplify `blog/_tabs/editorial/kanban-card.tsx` | 1 file | −400 (refactor) |
| New `UnifiedBoard` + `KanbanLane` + `PromotionModal` | 3 files | +550 |
| New `PipelineCard` (extracted, slimmed) | 1 file | +180 |
| New `PostCard` (extracted, slimmed) | 1 file | +220 |
| Update `blog/page.tsx` data fetching | 1 file | +50 |
| Update `hub-utils.ts` / `hub-types.ts` / i18n | 4 files | +120 |
| **Net** | | **≈ −2,586** |

> **Note:** The `posts/` directory contains 21 files including a full post editor (tabs, sidebar, detail page) totaling 2,428 LOC. The canonical post editor lives at `/cms/blog/[id]/edit` — the `posts/[id]` editor is the legacy path being removed. All editor functionality is preserved in the blog route.

---

## 6. Velocity KPI Strip

The current editorial tab displays a KPI bar above the kanban with: Total posts, Published count, Throughput/mo, Avg idea-to-published days, and Bottleneck column. This is **preserved and extended** to span the full unified lifecycle:

| Metric | Current source | Extended source |
|--------|---------------|-----------------|
| **Total** | `blog_posts` count | `content_pipeline (blog_post)` + `blog_posts` count |
| **In Pipeline** | *(new)* | `content_pipeline` count where `blog_post_id IS NULL` |
| **Published** | `blog_posts` where `status = 'published'` | No change |
| **Throughput** | Published per month | No change |
| **Avg Idea→Pub** | `blog_posts.created_at` to `published_at` | Extended: `content_pipeline.created_at` to `blog_posts.published_at` (full lifecycle) |
| **Bottleneck** | Column with highest avg dwell time | Extended across all 6 lanes |

The KPI strip renders above the kanban (below the filter bar) as a horizontal row of 5 stat cards, same as today.

---

## 7. Data Fetching

### 7.1 Server Component (blog/page.tsx)

The Blog Hub RSC fetches both data sources in parallel:

```typescript
const [sharedData, editorialData, pipelineData] = await Promise.all([
  fetchBlogSharedData(siteId),
  fetchEditorialData(siteId, tagId, locale),
  fetchPipelineData(siteId, 'blog_post'),
])
```

### 7.2 `fetchPipelineData` (New Query)

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

### 7.3 `buildUnifiedLanes` (Client-Side Merge)

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

### 7.4 `fetchEditorialData` — Status Filter Fix

**Critical:** The current `fetchEditorialData` in `hub-queries.ts` filters `.in('status', ['ready', 'queued', 'scheduled', 'published'])`. This **excludes** `idea` and `draft` posts — which means posts created via "Promote" (status `idea`) won't appear in the kanban.

**Fix required:** Extend the status filter to include all non-archived statuses:

```typescript
.in('status', ['idea', 'draft', 'pending_review', 'ready', 'queued', 'scheduled', 'published'])
```

This is a prerequisite for the "Em Edição" lane to work correctly. Without it, promoted posts vanish until manually moved to `ready`.

### 7.5 Performance: Remove `force-dynamic`


The current `blog/page.tsx` uses `export const dynamic = 'force-dynamic'` which kills all caching. Replace with:
- `unstable_cache` on each data query (already used by `fetchBlogSharedData` and `fetchEditorialData`)
- `revalidateTag('blog-hub')` and `revalidateTag('pipeline-blog')` on mutations
- Remove the `force-dynamic` export entirely

### 7.6 Filtering

The existing filter bar is extended with a unified scope:

| Filter | Applies to | Implementation |
|--------|-----------|----------------|
| **Tag** | Blog lanes only | Server-side `.eq('tag_id', tagId)` |
| **Locale** | Blog lanes only | Server-side `.contains('blog_translations.locale', [locale])` |
| **Search** | All lanes | Client-side text match on title/code/hook |
| **Priority** | Pipeline lanes only | Client-side filter on priority level |

Filters that don't apply to a lane type simply show all items in those lanes (e.g., filtering by tag doesn't hide pipeline cards).

### 7.7 URL State Persistence

The current hub persists `tab`, `tag`, and `locale` in URL search params via `hub-client.tsx`. The new filters follow the same pattern:

| Param | Values | Default |
|-------|--------|---------|
| `tab` | `editorial`, `schedule`, `analytics` | `editorial` |
| `tag` | tag ID or omitted | all tags |
| `locale` | `pt-BR`, `en`, etc. or omitted | all locales |
| `q` | search string | omitted |
| `priority` | `1`, `2`, `3`, `4`, `5` or omitted | all priorities |

All filter state is reflected in the URL for shareability and browser back/forward support. `q` uses a 300ms debounce before updating the URL to avoid excessive history entries.

---

## 8. Drag-and-Drop Rules

### 8.1 Within-Lane Drag

- **Pipeline lanes (1–3):** Reorder via integer `sort_order` (midpoint insertion: `Math.floor((prev + next) / 2)`). Uses existing `reorderPipelineItem` server action.
- **Blog lanes (4–6):** No manual reorder. Sort is timestamp-based (see §2.3).

### 8.2 Cross-Lane Drag

The current pipeline uses `advancePipelineItem` and `retreatPipelineItem` for one-step sequential transitions (idea→draft→ready). For the unified kanban, a new `movePipelineItemToStage` action is needed to support arbitrary stage jumping via drag (e.g., idea directly to ready, skipping draft).

| From → To | Allowed? | Behavior |
|-----------|----------|----------|
| Pipeline lane → Pipeline lane | Yes | Updates `stage` via `movePipelineItemToStage` action (new) |
| Pipeline lane → Blog lane | **No** | Blocked. Must use Promote button/menu. Toast: "Use 'Promover' para criar um post." |
| Blog lane → Blog lane | Yes | Updates `status` via `movePost` action (validates via `isValidTransition`) |
| Blog lane → Pipeline lane | **No** | Blocked. Must use "Devolver ao Pipeline" menu. Toast: "Use 'Devolver ao Pipeline' no menu do card." |

### 8.3 Visual Feedback

- **Valid drop zone:** Lane header pulses, border highlights with lane accent color
- **Invalid drop zone (cross-boundary):** Lane dims with a subtle red-gray overlay, cursor shows `not-allowed`
- **Drag overlay:** Semi-transparent card follows cursor (existing behavior from both boards)

---

## 9. Bulk Operations

### 9.1 Selection

- **Cmd+Click** (Mac) / **Ctrl+Click** (Windows): Toggle single card selection
- **Shift+Click**: Range select within a lane
- Selection only works within the same card type (can't mix pipeline + post cards)
- Selected cards show a checkmark overlay and a blue ring

### 9.2 Floating Action Bar

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

### 9.3 Bulk Promotion

When multiple Pronto cards are selected and "Promote all" is clicked:

1. A single modal opens showing the list of items to promote (titles only)
2. One shared locale selection applies to all items (same locale for all)
3. Each item creates a separate `blog_posts` row via individual `createPostFromPipeline` calls (not batched — ensures each gets its own translation row and audit trail)
4. **Sequential execution** — items promote one by one. A progress indicator shows "Promoting 2 of 5..."
5. **Partial failure:** If item 3 of 5 fails, items 1-2 remain promoted, item 3 shows an error toast, items 4-5 are skipped. The user can retry the failed items individually.
6. On completion: "5 items promoted" success toast (or "3 of 5 promoted, 2 failed" if partial)

---

## 10. The "+ Novo" Button

Top-right of the Editorial tab, a split button:

- **Primary action:** "Novo Post" — navigates to `/cms/blog/new` (existing new post page)
- **Dropdown:**
  - "Novo Post" — `/cms/blog/new`
  - "Nova Ideia no Pipeline" — opens inline creation form in the Ideia lane (title + priority + language)

---

## 11. Accessibility (WCAG 2.1 AA)

### 11.1 ARIA Structure

```html
<div role="grid" aria-label="Blog editorial kanban">
  <div role="row">
    <div role="gridcell" aria-label="Ideia — 3 items"> ... </div>
    <div role="gridcell" aria-label="Rascunho — 5 items"> ... </div>
    ...
  </div>
</div>
```

### 11.2 Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus between lanes |
| `↑` / `↓` | Move between cards within a lane |
| `←` / `→` | Move focus to adjacent lane (same card index) |
| `Space` | Enter drag mode on focused card |
| `Enter` | Open card (navigate to detail/edit page) |
| `Escape` | Cancel drag mode / close modal / deselect |
| `Cmd+A` | Select all cards in focused lane |

### 11.3 Focus Management

- Focus trap in modals (Promotion, Schedule)
- Return focus to triggering element on modal close
- Skip-link at top of kanban: "Skip to lane [name]"

### 11.4 Color & Contrast

- All text meets 4.5:1 contrast ratio against backgrounds
- Substatus badges use both color AND text label (not color-only)
- Promotion boundary uses both color (indigo divider) AND a label ("⟫ Publicação")

---

## 12. Routes and Redirects

### 12.1 Affected Routes

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

### 12.2 Redirect Implementation

Add a `next.config.ts` redirect:

```typescript
redirects: async () => [
  { source: '/cms/posts', destination: '/cms/blog', permanent: true },
  { source: '/cms/posts/:path*', destination: '/cms/blog', permanent: true },
  { source: '/cms/pipeline/blog_post', destination: '/cms/blog', permanent: true },
]
```

---

## 13. Optimistic Update Strategy

The unified board manages two independent data sources, each needing its own optimistic strategy:

### 13.1 Pipeline Lanes (useOptimistic)

Pipeline moves (stage changes, reorder) use a local `useOptimistic` hook on the pipeline items array. On drag-end:
1. Immediately update the item's `stage` or `sort_order` in the optimistic state
2. Fire the server action (`movePipelineItem` / `reorderPipelineItem`)
3. On success: `revalidateTag('pipeline-blog')` refreshes server state
4. On failure: Revert optimistic state, show toast

### 13.2 Blog Lanes (useOptimistic)

Blog post moves use a separate `useOptimistic` hook on the posts array. Same pattern as above, using `movePost` server action.

### 13.3 Cross-Boundary (Promotion)

Promotion is **not optimistic** — it always waits for the server because:
- It creates a new DB row (can't generate a real ID client-side)
- It requires locale selection (user interaction blocks instant feedback anyway)
- The modal provides visual feedback via loading state on the "Promover" button

After successful promotion:
1. Remove item from pipeline optimistic state
2. Add new post to blog optimistic state (using the returned `postId`)
3. Both caches revalidate

### 13.4 Return to Pipeline

Also **not optimistic** — waits for server confirmation before removing the post card and re-showing the pipeline item. Same rationale: cross-table operation with destructive side.

---

## 14. Archived Items

Archived items (both `content_pipeline.is_archived = true` and `blog_posts.status = 'archived'`) are **not shown in the kanban by default**. They are accessible via:

### 14.1 Archive Toggle

A toggle in the filter bar: "Mostrar arquivados" (off by default). When enabled:
- Archived pipeline items appear in their original lane with 45% opacity and desaturated styling (matching current `GemCard` archived treatment)
- Archived blog posts appear in a 7th pseudo-lane "Arquivados" appended after "Publicado", styled with gray accent color

When disabled (default): archived items are completely hidden from the kanban.

### 14.2 Archive URL State

The toggle persists as `?archived=1` in the URL. Default is omitted (not archived).

---

## 15. i18n

The current Blog Hub uses a `BlogHubStrings` pattern with `en` and `pt-BR` string maps loaded at the RSC level. All new UI labels must follow this pattern:

### 15.1 New String Keys

```typescript
// Added to BlogHubStrings.editorial
lanes: {
  idea: string           // "Ideia" / "Idea"
  draft: string          // "Rascunho" / "Draft"
  ready: string          // "Pronto" / "Ready"
  editing: string        // "Em Edição" / "In Editing"
  scheduled: string      // "Agendado" / "Scheduled"
  published: string      // "Publicado" / "Published"
}
promotion: {
  title: string          // "Promover para Blog" / "Promote to Blog"
  selectLocales: string  // "Idiomas" / "Languages"
  scheduleToggle: string // "Agendar publicação" / "Schedule publication"
  promote: string        // "Promover" / "Promote"
  promoteSchedule: string // "Promover e Agendar" / "Promote & Schedule"
  cancel: string         // "Cancelar" / "Cancel"
}
substatus: {
  idea: string           // "Ideia" / "Idea"
  draft: string          // "Rascunho" / "Draft"
  pendingReview: string  // "Em Revisão" / "In Review"
  ready: string          // "Pronto" / "Ready"
  queued: string         // "Na Fila" / "Queued"
}
```

### 15.2 Pipeline Card Labels

Pipeline card labels (code, priority, staleness) are already language-agnostic (use icons/numbers). The only text needing i18n is the "Promote to Posts Hub" button, which becomes `strings.promotion.promote`.

---

## 16. Navigation: Pipeline Detail Breadcrumb

When a user clicks a pipeline card in the unified kanban, they navigate to `/cms/pipeline/items/{id}`. Currently, that page's breadcrumb reads `Pipeline > Items > {code}`.

**Change:** Add a `?from=blog` query parameter when navigating from the blog hub. The pipeline detail page reads this param and adjusts the breadcrumb to `Blog > Pipeline > {code}`, with the "Blog" link pointing to `/cms/blog`. This ensures back-navigation returns to the correct context.

If `?from` is absent or equals `pipeline`, the breadcrumb stays as-is (for users navigating from other pipeline views).

---

## 17. Error States

| Scenario | Behavior |
|----------|----------|
| Pipeline fetch fails | Pipeline lanes show "Erro ao carregar pipeline" with retry button. Blog lanes render normally. |
| Blog fetch fails | Blog lanes show "Erro ao carregar posts" with retry button. Pipeline lanes render normally. |
| Promotion fails | Toast error "Falha ao promover: [message]". Pipeline item stays in Pronto lane. No partial state. |
| Drag to invalid target | Card snaps back to origin with shake animation. Toast hint. |
| Concurrent edit conflict | Optimistic update reverts. Toast: "Outro usuário modificou este item. Atualizando..." |

---

## 18. Testing Strategy

### 18.1 Unit Tests

| Component | Tests | Focus |
|-----------|-------|-------|
| `buildUnifiedLanes` | 6 | Correct filtering + sorting per lane |
| `renderCard` delegation | 4 | Pipeline vs Post card selection by lane |
| Sort functions | 6 | Priority × timestamp ordering correctness for each lane |
| `isValidTransition` (existing) | 8 | All valid + invalid transitions |
| Substatus badge mapping | 5 | Correct color/label per status |
| Promotion modal validation | 4 | At least one locale required, date validation |
| Lane width constraints | 3 | Min/max width, horizontal scroll trigger |
| Empty state rendering | 6 | Correct message per lane, CTA buttons present |
| Pagination ("Publicado") | 3 | Initial 30 load, "show more" appends, count badge format |
| Archive toggle | 2 | Archived items hidden by default, shown when toggled |

### 18.2 Integration Tests

| Flow | Tests | Focus |
|------|-------|-------|
| Slow promotion | 2 | Pipeline item → blog post with locale. Verify `blog_post_id` linkage. |
| Fast track promotion | 2 | Pipeline item → scheduled post. Verify `scheduled_for` set. |
| Return to pipeline | 2 | Delete blog post, clear `blog_post_id`. Verify item reappears. |
| Cross-boundary drag blocked | 1 | Verify drag from pipeline to blog lane is rejected |
| Bulk publish | 1 | Multi-select + publish. Verify all status changes. |
| Filter by tag | 1 | Blog lanes filter, pipeline lanes unaffected |
| `fetchEditorialData` status filter | 1 | Verify `idea` and `draft` posts are returned (§7.4 fix) |
| Breadcrumb `?from=blog` | 1 | Pipeline detail shows "Blog > Pipeline > {code}" breadcrumb |
| URL state roundtrip | 1 | Set filters → reload → filters preserved |

### 18.3 Existing Tests Preserved

All existing tests in `apps/web/test/` for `blog/actions.ts` (bulk publish/archive/delete, `createPostFromPipeline`) continue to work without changes to their test setup.

---

## 19. Migration Checklist

1. **Fix `fetchEditorialData`** — extend status filter to include `idea`, `draft` (§7.4)
2. Add `fetchPipelineData` query to `hub-queries.ts`
3. Update `blog/page.tsx` — remove `force-dynamic`, add pipeline data fetch, dual Suspense
4. Update `hub-types.ts` — add `UnifiedLanes`, `PipelineItem`, lane sort types
5. Update `hub-utils.ts` — add substatus badge mapping, lane sort helpers, lane definitions
6. Create `KanbanLane` shared component (with min/max width constraints)
7. Create `UnifiedBoard` component with 6 lanes + promotion boundary + responsive layout
8. Extract `PipelineCard` from `gem-card.tsx` (keep original for pipeline detail)
9. Extract `PostCard` from `kanban-card.tsx` (add provenance pill, remove board logic)
10. Create `PromotionModal` component
11. Create `BulkActionBar` floating component
12. Add `movePipelineItemToStage` server action (arbitrary stage jump for DnD, extends current advance/retreat pattern)
13. Extend `createPostFromPipeline` with optional `scheduledFor` parameter
14. Add `returnToPipeline` server action
15. Add i18n string keys to `_i18n/en.ts` and `_i18n/pt-BR.ts`
16. Add `?from=blog` breadcrumb logic to pipeline detail page
17. Add archive toggle to filter bar
18. Add pagination to "Publicado" lane (initial 30, load more)
19. Extend velocity KPI strip with pipeline metrics
20. Add `next.config.ts` redirects for removed routes
21. Delete `posts/` directory
22. Delete `pipeline/[format]/page.tsx` blog_post-specific handling
23. Write tests per §18

---

## 20. Files Changed

### New files
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/unified-board.tsx`
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-lane.tsx`
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/pipeline-card.tsx`
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/post-card.tsx`
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/promotion-modal.tsx`
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/bulk-action-bar.tsx`

### Modified files
- `apps/web/src/app/cms/(authed)/blog/page.tsx` — add pipeline data fetch, remove `force-dynamic`, dual Suspense
- `apps/web/src/app/cms/(authed)/blog/_hub/hub-queries.ts` — add `fetchPipelineData`, fix `fetchEditorialData` status filter
- `apps/web/src/app/cms/(authed)/blog/_hub/hub-types.ts` — add `UnifiedLanes`, `PipelineItem`, lane types
- `apps/web/src/app/cms/(authed)/blog/_hub/hub-utils.ts` — add substatus badges, lane sort helpers, lane definitions
- `apps/web/src/app/cms/(authed)/blog/actions.ts` — extend `createPostFromPipeline`, add `returnToPipeline`
- `apps/web/src/app/cms/(authed)/blog/_i18n/en.ts` — add lane, promotion, substatus, empty state strings
- `apps/web/src/app/cms/(authed)/blog/_i18n/pt-BR.ts` — add lane, promotion, substatus, empty state strings
- `apps/web/src/app/cms/(authed)/blog/_i18n/types.ts` — extend `BlogHubStrings` with new keys
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/editorial-tab.tsx` — extend velocity KPI strip
- `apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx` — add `?from=blog` breadcrumb logic
- `apps/web/next.config.ts` — add redirects

### Deleted files
- `apps/web/src/app/cms/(authed)/posts/` (entire directory — 21 files, 2,428 LOC)
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-board.tsx` (replaced by unified-board)
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-column.tsx` (replaced by kanban-lane)
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/kanban-card.tsx` (replaced by post-card)

### Preserved as-is
- `apps/web/src/app/cms/(authed)/pipeline/items/[id]/` (pipeline detail page — modified only breadcrumb)
- `apps/web/src/app/cms/(authed)/pipeline/_components/gem-card.tsx` (used by pipeline detail)
- `apps/web/src/lib/pipeline/workflows.ts`
- `apps/web/src/lib/pipeline/schemas.ts`
