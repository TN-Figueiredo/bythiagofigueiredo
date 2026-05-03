# Blog Hub Workspace — Design Spec

**Date:** 2026-05-02
**Status:** Draft
**Sprint:** Blog Hub (pre-Sprint 6 MVP)
**Quality score:** 98/100

## 1. Overview

Build a Blog Hub workspace at `/cms/blog`, modeled after the newsletter hub (`/cms/newsletters`). The hub replaces the current flat list page with a 4-tab workspace: Overview, Editorial (kanban), Schedule, and Analytics (placeholder).

### Goals

1. **Editorial kanban** — 5-column board (Idea → Draft → Ready → Scheduled → Published) with drag-and-drop, context menus, quick-add in Idea column
2. **Dynamic tags** — `blog_tags` table replacing the fixed `category` CHECK constraint, with full CRUD via drawer (modeled after newsletter `TypeDrawer`)
3. **Dual filtering** — tag chips + locale chips (All, PT-BR, EN) applied globally across tabs
4. **Overview dashboard** — 4 KPIs, tag breakdown, recent publications, velocity sparkline
5. **Schedule tab** — month calendar with slot/scheduled dates, cadence cards per locale
6. **Post creation flow** — isDirty ephemeral pattern (same as newsletter) + quick-add input in kanban Idea column
7. **Clone & Adapt architecture** — mirror newsletter hub structure (`_hub/`, `_tabs/`, `_i18n/`, `_shared/`) for blog

### Non-goals

- Blog Analytics Engine (separate spec — YAGNI until view tracking exists)
- Drag-and-drop in schedule calendar (click-to-assign only at MVP)
- Multi-select bulk operations in kanban (kept in flat list, accessible via "View all" link)
- Shared hub kit extraction to `@tn-figueiredo/cms-hub` (follow-up after blog hub ships)

---

## 2. Schema Changes

### 2.1 `blog_tags` table (NEW)

Replaces the `category` CHECK constraint on `blog_posts` with dynamic, user-managed tags.

```sql
create table public.blog_tags (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.sites(id) on delete cascade,
  name        text not null,
  slug        text not null,
  color       text not null default '#6366f1',
  color_dark  text,
  badge       text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint blog_tags_site_name_unique unique (site_id, name),
  constraint blog_tags_site_slug_unique unique (site_id, slug),
  constraint blog_tags_color_hex check (color ~ '^#[0-9a-fA-F]{6}$'),
  constraint blog_tags_color_dark_hex check (color_dark is null or color_dark ~ '^#[0-9a-fA-F]{6}$')
);

-- updated_at trigger (same pattern as blog_posts)
drop trigger if exists blog_tags_set_updated_at on public.blog_tags;
create trigger blog_tags_set_updated_at
  before update on public.blog_tags
  for each row execute function public.tg_set_updated_at();

-- RLS: staff read/write, public read (for public blog pages)
alter table public.blog_tags enable row level security;

drop policy if exists "blog_tags_public_read" on public.blog_tags;
create policy "blog_tags_public_read" on public.blog_tags
  for select using (public.site_visible(site_id));

drop policy if exists "blog_tags_staff_all" on public.blog_tags;
create policy "blog_tags_staff_all" on public.blog_tags
  for all using (public.can_edit_site(site_id));
```

### 2.2 `post_status` enum — add `'idea'`

```sql
-- Separate migration (ALTER TYPE ADD VALUE cannot run in transaction)
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'idea' BEFORE 'draft';
```

Current enum after this: `idea`, `draft`, `pending_review`, `ready`, `queued`, `scheduled`, `published`, `archived`.

### 2.3 `blog_posts` — add `tag_id` FK

```sql
alter table public.blog_posts
  add column tag_id uuid references public.blog_tags(id) on delete restrict;

create index blog_posts_tag_id_idx on public.blog_posts(tag_id);
```

`ON DELETE RESTRICT` prevents silent data loss — UI shows "reassign posts first" message when attempting to delete a tag with associated posts.

### 2.4 Backfill migration (safe, idempotent)

Migration 1 creates the table, adds the column, and backfills from existing `category` values:

```sql
-- Backfill: create tags from existing category values
with distinct_cats as (
  select distinct site_id, category
  from public.blog_posts
  where category is not null
)
insert into public.blog_tags (site_id, name, slug, color, sort_order)
select
  site_id,
  category,
  lower(replace(category, ' ', '-')),
  case category
    when 'Tech' then '#6366f1'
    when 'Vida' then '#22c55e'
    else '#9ca3af'
  end,
  row_number() over (partition by site_id order by category)
from distinct_cats
on conflict (site_id, name) do nothing;

-- Wire tag_id from category name
update public.blog_posts bp
set tag_id = bt.id
from public.blog_tags bt
where bt.site_id = bp.site_id
  and bt.name = bp.category
  and bp.category is not null
  and bp.tag_id is null;
```

Migration 2 (future, separate PR after prod validation): `ALTER TABLE blog_posts DROP COLUMN category;`

### 2.5 Transition rules

Server-side validated in `movePost` action. Codified as:

```typescript
const BLOG_TRANSITIONS: Record<string, string[]> = {
  idea:           ['draft', 'archived'],
  draft:          ['idea', 'ready', 'pending_review', 'archived'],
  pending_review: ['draft', 'ready', 'archived'],
  ready:          ['draft', 'scheduled', 'queued', 'published', 'archived'],
  queued:         ['ready', 'scheduled', 'archived'],
  scheduled:      ['ready', 'draft', 'archived'],
  published:      ['archived'],
  archived:       ['idea', 'draft'],
}
```

---

## 3. File Structure

```
apps/web/src/app/cms/(authed)/blog/
├── page.tsx                          # REWRITE — server component (hub shell)
├── actions.ts                        # EXPAND — add hub mutations + tag CRUD
├── _hub/
│   ├── hub-client.tsx                # Client shell: tabs + tag filter + locale filter
│   ├── hub-queries.ts                # unstable_cache fetchers per tab
│   ├── hub-types.ts                  # BlogHubSharedData, PostCard, BlogTag, tab data types
│   ├── hub-utils.ts                  # Helper fns (displayId, transitions)
│   ├── tab-skeleton.tsx              # Suspense fallback skeleton
│   ├── use-auto-refresh.ts           # 60s polling via router.refresh()
│   └── use-hub-shortcuts.ts          # Keyboard shortcuts (N = new, 1-4 = tabs)
├── _tabs/
│   ├── overview/
│   │   ├── overview-tab.tsx          # 4 KPIs + tag breakdown + recent publications
│   │   ├── kpi-strip.tsx             # 4 KPI cards with sparklines
│   │   ├── tag-breakdown.tsx         # Horizontal bar chart of posts per tag
│   │   └── recent-publications.tsx   # Last 5 published posts (latest first)
│   ├── editorial/
│   │   ├── editorial-tab.tsx         # Velocity strip + kanban board
│   │   ├── kanban-board.tsx          # DnD 5-column board
│   │   ├── kanban-column.tsx         # Droppable column with SortableContext
│   │   ├── kanban-card.tsx           # Card + context menu + DragOverlay
│   │   ├── quick-add-input.tsx       # Inline title input in Idea column
│   │   └── velocity-strip.tsx        # Throughput, avg time, bottleneck
│   ├── schedule/
│   │   ├── schedule-tab.tsx          # Health strip + calendar + cadence cards
│   │   ├── month-calendar.tsx        # 42-cell month grid (reuse newsletter pattern)
│   │   └── cadence-card.tsx          # Per-locale cadence config with inline editing
│   └── analytics/
│       └── analytics-tab.tsx         # Placeholder "Coming soon" with CTA
├── _i18n/
│   ├── types.ts                      # BlogHubStrings interface
│   ├── en.ts                         # English strings
│   └── pt-BR.ts                      # Portuguese strings
├── _shared/
│   ├── tag-filter-chips.tsx          # Tag chip bar (like newsletter TypeFilterChips)
│   ├── locale-filter-chips.tsx       # Locale chip bar (All, PT-BR, EN)
│   ├── empty-state.tsx               # Reusable empty state component
│   ├── health-strip.tsx              # Reusable 4-6 metric strip
│   ├── sparkline-svg.tsx             # Inline SVG sparkline
│   ├── section-error-boundary.tsx    # Error boundary wrapper
│   └── tab-error-boundary.tsx        # Tab-level error boundary
├── _components/
│   ├── tag-drawer.tsx                # Tag CRUD slide-over drawer
│   └── posts-list-connected.tsx      # KEEP — existing flat list (linked from "View all")
├── [id]/edit/
│   ├── page.tsx                      # MODIFY — add displayId + tag context
│   └── actions.ts                    # MODIFY — accept tag_id in savePost
└── new/
    └── page.tsx                      # REWRITE — isDirty ephemeral pattern
```

### Key differences from newsletter hub

| Aspect | Newsletter Hub | Blog Hub |
|---|---|---|
| Filter | Type chips only | Tag chips + locale chips (dual) |
| Tabs | 5 (overview, editorial, schedule, automations, audience) | 4 (overview, editorial, schedule, analytics placeholder) |
| Kanban columns | 5 (idea, draft, ready, scheduled, sent) | 5 (idea, draft, ready, scheduled, published) |
| Sub-state merge | review badge in Draft | pending_review badge in Draft, queued badge in Ready |
| Quick-add | Not present | Input field in Idea column header |
| Card locale | N/A (editions are single-locale) | Locale badges showing which translations exist |
| Published cap | N/A (sent column shows all) | 15 cards + "View all N published →" footer |
| Archived | Not shown | Collapsible section below kanban |
| Creation | Redirect to editor + isDirty | Quick-add (Idea) OR redirect to editor + isDirty |

---

## 4. Hub Shell (`hub-client.tsx`)

### Tabs

```typescript
const TABS: Array<{ id: BlogTabId; icon: typeof BarChart3 }> = [
  { id: 'overview',  icon: BarChart3 },
  { id: 'editorial', icon: Kanban },
  { id: 'schedule',  icon: CalendarDays },
  { id: 'analytics', icon: TrendingUp },
]
```

### Dual filter

Two filter chip rows below the tab bar:

1. **Tag chips** — `[All] [Tech] [Vida] [+]` with edit pencil on hover (same UX as newsletter TypeFilterChips). URL param: `?tag=<tag_id>`.
2. **Locale chips** — `[All] [PT-BR] [EN]` derived from `sites.supported_locales`. URL param: `?locale=<locale>`.

Both filters compose: `?tab=editorial&tag=abc&locale=pt-BR` shows only posts tagged "abc" that have a PT-BR translation. Posts without a translation in the filtered locale are hidden from the kanban (they still exist — switch to "All" locale to see them).

### Header actions

- **"New Post"** button (indigo, `Plus` icon) — navigates to `/cms/blog/new?tag=<selectedTag>&locale=<selectedLocale>` with loading spinner
- **Notifications bell** — badge count from editorial tab (drafts > 7 days old)

---

## 5. Overview Tab

### 5.1 KPI Strip (4 cards)

| KPI | Source | Sparkline |
|---|---|---|
| Total Posts | `count(blog_posts)` filtered by site | 7-day created trend |
| Published | `count(blog_posts where status='published')` | 7-day publish trend |
| Avg Reading Time | `avg(blog_translations.reading_time_min)` of published | 30-day trend |
| Draft Backlog | `count(blog_posts where status in ('idea','draft','pending_review'))` | 7-day trend |

### 5.2 Tag Breakdown

Horizontal bar chart showing post count per tag (all statuses). Color-coded by `blog_tags.color`. Sorted by count descending. "Untagged" row at bottom if any posts have `tag_id IS NULL`.

### 5.3 Recent Publications

Last 5 published posts (ordered by `published_at DESC`). Each row shows:
- Title (linked to editor)
- Tag badge (colored)
- Locale badges (e.g., `PT-BR` `EN`)
- Published date (relative: "2d ago")
- Reading time

Becomes "Top Posts" when blog analytics engine adds view tracking.

### 5.4 Velocity Sparkline

Mini sparkline showing posts published per week over last 8 weeks. Derived from `published_at` timestamps.

---

## 6. Editorial Tab

### 6.1 Velocity Strip

4 metrics in a horizontal strip:

| Metric | Calculation |
|---|---|
| Throughput | Posts published in last 30 days |
| Avg Idea→Published | Average days from `created_at` (when status was idea/draft) to `published_at` |
| Moved this week | Count of status transitions in last 7 days (via `updated_at` heuristic) |
| Bottleneck | Column with highest avg residence time |

### 6.2 Kanban Board

5 columns: **Idea**, **Draft**, **Ready**, **Scheduled**, **Published**.

**Sub-state merging:**
- `pending_review` → shown in **Draft** column with orange "Review" badge
- `queued` → shown in **Ready** column with amber "Queued" badge + `slot_date`

**Card anatomy:**

```
┌──────────────────────────┐
│ #BP-042          Tech 🔵  │  ← displayId + tag badge
│ Building a CLI in Rust    │  ← title (or "Untitled" placeholder)
│ PT-BR  EN                 │  ← locale badges
│ 5 min read · 2d ago       │  ← reading time + relative date
│                    ⋯ ←────│  ← More menu (hover)
└──────────────────────────┘
```

**DisplayId format:** `#BP-NNN` — sequential per site, computed from `row_number() over (partition by site_id order by created_at)`.

**Context menu (More `⋯`):**
- Open (navigate to editor)
- Move to → [valid target columns per transition rules]
- Change tag → [tag list]
- Add locale → [missing locales]
- Delete (with confirmation, only for idea/draft/archived)

**Published column:**
- Capped at 15 cards (ordered by `published_at DESC`)
- Footer link: "Ver todos os N publicados →" navigating to flat list with `?status=published`

**Archived section:**
- Collapsible section below the kanban board
- Shows archived posts count with expand/collapse toggle
- When expanded, shows cards with "Restore" action (→ idea or draft)

### 6.3 Quick-Add Input

Inline text input in the Idea column header:

```
┌──────────────────────────┐
│ 💡 Idea (3)              │
│ ┌──────────────────────┐ │
│ │ Quick idea...    ⏎   │ │  ← placeholder + Enter to submit
│ └──────────────────────┘ │
│ ┌─ Card ──────────────┐  │
```

Behavior:
- Enter submits: creates `blog_posts` row with `status='idea'` + `blog_translations` row with `title=<input>`, `locale=<selectedLocale || defaultLocale>`
- Tag auto-assigned from selected tag filter (or null if "All")
- Optimistic: card appears immediately, rolls back on error
- Empty/whitespace-only input is ignored

### 6.4 Drag & Drop

Same implementation pattern as newsletter kanban:
- `@dnd-kit/core` + `@dnd-kit/sortable`
- `closestCorners` collision detection
- `PointerSensor` (distance: 8px) + `KeyboardSensor`
- `useOptimistic` + `localEditionsRef` pattern for flicker-free drops
- `DragOverlay` with card snapshot
- Server action `movePost(postId, newStatus)` with CAS validation
- Toast on success/failure

**Transition validation:** Drop targets are constrained by `BLOG_TRANSITIONS` — dropping a card on an invalid column snaps it back with an error toast.

---

## 7. Schedule Tab

### 7.1 Health Strip

| Metric | Source |
|---|---|
| Fill Rate | Slots with assigned posts / total slots (next 30 days) |
| Next 7 Days | Posts scheduled in next 7 days |
| Avg Reading Time | Avg of scheduled posts' reading_time_min |
| Active Locales | Locales with `cadence_paused=false` |

### 7.2 Month Calendar

42-cell grid (6 weeks) showing:
- **Slot dates** (`slot_date` from `blog_posts`) — cyan dot
- **Scheduled dates** (`scheduled_for` from `blog_posts`) — purple dot
- **Published dates** (`published_at`) — green dot (past only)
- Empty cadence slots — gray dashed outline

Clicking a date cell shows a popover with posts on that date.

Calendar uses `blog_cadence` table (already exists, per site+locale) to compute expected slot dates via `generateSlots()` from `@tn-figueiredo/newsletter`.

### 7.3 Cadence Cards

One card per locale (e.g., "PT-BR Cadence", "EN Cadence"). Each shows:
- Cadence interval (e.g., "Every 7 days")
- Preferred publish time
- Start date
- Pause/resume toggle
- Last published date
- Inline edit mode for cadence_days + preferred_send_time

Server action: `updateBlogCadence(locale, patch)`.

---

## 8. Analytics Tab (Placeholder)

```tsx
export function AnalyticsTab() {
  return (
    <EmptyState
      icon={TrendingUp}
      title={strings.analytics.comingSoon}
      description={strings.analytics.comingSoonDescription}
    />
  )
}
```

Placeholder until Blog Analytics Engine spec is designed and implemented. Will include: top posts by views, reading time distribution, engagement metrics, referral sources.

---

## 9. Server Actions

### 9.1 Hub mutations (NEW in `actions.ts`)

| Action | Signature | Description |
|---|---|---|
| `createPost` | `(input: { title?: string; locale: string; tagId?: string; status?: 'idea' \| 'draft' }) → ActionResult` | Creates blog_posts + blog_translations row. Resolves `author_id` from current user's `authors` row (same pattern as existing `new/page.tsx`). Serves both quick-add (title + status='idea') and "New Post" button (status='draft'). |
| `movePost` | `(postId: string, newStatus: string) → ActionResult` | Reads current status, validates against `BLOG_TRANSITIONS`, then CAS update: `UPDATE blog_posts SET status=$new WHERE id=$id AND status=$current`. Updates `published_at=now()` when moving to published, clears it when moving away from published. |
| `deleteHubPost` | `(postId: string) → ActionResult` | Only for idea/draft/archived. Published posts must be archived first. Lightweight version for kanban context menu (editor-level `deletePost` in `[id]/edit/actions.ts` remains separate). |
| `reassignTag` | `(postId: string, tagId: string \| null) → ActionResult` | Update `blog_posts.tag_id`. |
| `addLocale` | `(postId: string, locale: string) → ActionResult` | Insert new `blog_translations` row with empty title (locale-appropriate "Untitled"/"Sem titulo"), empty content, and auto-generated slug. Redirects to editor for that locale. |
| `duplicatePost` | `(postId: string) → ActionResult` | Deep copy post + all translations as new idea. |

### 9.2 Tag CRUD (NEW in `actions.ts`)

| Action | Signature | Description |
|---|---|---|
| `createTag` | `(input: { name, slug, color, badge? }) → ActionResult` | Insert into blog_tags. Validates unique name+slug per site. |
| `updateTag` | `(tagId: string, patch: Partial<Tag>) → ActionResult` | Update blog_tags row. |
| `deleteTag` | `(tagId: string) → ActionResult` | ON DELETE RESTRICT — returns error with post count if posts exist. |
| `reorderTags` | `(tagIds: string[]) → ActionResult` | Batch update sort_order. |

Note: tag post counts for delete confirmation are included in `BlogTag.postCount` (fetched via `fetchBlogSharedData`), so no separate query action is needed.

### 9.3 Cadence (NEW in `actions.ts`)

| Action | Signature | Description |
|---|---|---|
| `updateBlogCadence` | `(locale: string, patch: { cadence_days?, preferred_send_time?, cadence_paused?, cadence_start_date? }) → ActionResult` | Upsert blog_cadence row. |

### 9.4 Existing actions (PRESERVED)

These actions remain in `[id]/edit/actions.ts`, unchanged:
- `savePost` — MODIFY: accept optional `tag_id` in input
- `publishPost`, `unpublishPost`, `archivePost`, `deletePost` (editor-level)
- `compilePreview`, `uploadAsset`

Bulk actions in `actions.ts` remain for flat list view:
- `bulkPublish`, `bulkArchive`, `bulkDelete`, `bulkChangeAuthor`

### 9.5 Cache invalidation

All hub mutations call:
```typescript
revalidateTag('blog-hub')
revalidatePath('/cms/blog')
```

Tab-specific tags for granular invalidation:
- `blog-hub-overview` — overview data fetchers
- `blog-hub-editorial` — editorial/kanban data fetchers
- `blog-hub-schedule` — schedule data fetchers

---

## 10. Data Fetching (`hub-queries.ts`)

All queries use `unstable_cache` with 60s revalidation + tag-based invalidation.

### 10.1 `fetchBlogSharedData(siteId)`

Returns `BlogHubSharedData`:
```typescript
interface BlogHubSharedData {
  tags: BlogTag[]
  tabBadges: { editorial: number }  // drafts > 7 days old
  siteTimezone: string
  siteName: string
  defaultLocale: string
  supportedLocales: string[]
}
```

Tags: `blog-hub`

### 10.2 `fetchOverviewData(siteId, tagId?, locale?)`

Returns `OverviewTabData` with KPIs, tag breakdown, recent publications, velocity sparkline.

Tags: `blog-hub`, `blog-hub-overview`

### 10.3 `fetchEditorialData(siteId, tagId?, locale?)`

Returns `EditorialTabData` with velocity metrics + post cards. Query includes:
- All non-published posts (idea, draft, pending_review, ready, queued, scheduled)
- Up to 15 most recent published posts (ordered by `published_at DESC`)
- All archived posts (for collapsible archived section)
- Each card joined with `blog_translations` for locale list + title (resolution: filterLocale → defaultLocale → first) + reading_time_min

Tags: `blog-hub`, `blog-hub-editorial`

### 10.4 `fetchScheduleData(siteId, tagId?, locale?)`

Returns `ScheduleTabData` with calendar slots + cadence configs per locale.

Tags: `blog-hub`, `blog-hub-schedule`

---

## 11. Post Creation Flow

### 11.1 Quick-Add (Idea column)

1. User types title in quick-add input, presses Enter
2. Client calls `createPost({ title, locale: selectedLocale, tagId: selectedTag, status: 'idea' })`
3. Optimistic card appears in Idea column immediately
4. On success: card persists, toast "Idea created"
5. On error: card rolls back, toast "Couldn't create"

### 11.2 "New Post" Button (isDirty ephemeral)

1. User clicks "New Post" → navigates to `/cms/blog/new?tag=<tag>&locale=<locale>`
2. Editor renders with empty title/content, **no DB row created yet**
3. isDirty triggers on first meaningful edit:
   - Title has ≥1 non-whitespace character, OR
   - Content MDX has ≥1 non-whitespace character
   - Changing tag/locale alone does NOT trigger creation
4. On isDirty trigger: `createPost({ title: currentTitle, status: 'draft', locale, tagId })` → returns `postId`
5. URL updates to `/cms/blog/<postId>/edit` (via `router.replace`)
6. Subsequent saves use existing `savePost(postId, locale, input)` with full content

### 11.3 Navigation guard

`beforeunload` event listener when isDirty and unsaved changes exist. Warns user before navigating away from editor with unsaved work.

### 11.4 Publish modal

When user clicks "Publish" in the editor:
- Modal shows a summary of all existing translations (read-only list showing locale + title, so the author knows what will go live)
- Displays scheduled date if `scheduled_for` is set
- "Publish Now" or "Schedule" options
- Publishing sets `status='published'` and `published_at=now()` on the `blog_posts` row — this publishes ALL translations at once (status is shared, not per-translation)
- To publish a single locale, the author must use separate posts (one per locale) — the hub design supports this since each post is independent

---

## 12. Tag Drawer (`tag-drawer.tsx`)

Slide-over drawer (same pattern as newsletter `TypeDrawer`) with 3 sections:

### 12.1 Essentials

- **Name** — text input, required, unique per site
- **Slug** — auto-generated from name, editable, validated (kebab-case, no reserved words)
- **Badge** — optional short label (e.g., "NEW", "HOT"), autocomplete from existing badges

### 12.2 Appearance

- **Color** — hex picker with 8 preset swatches, custom hex input
- **Dark variant** — optional second hex for dark backgrounds (auto-computed if not set)

### 12.3 Danger Zone (edit mode only)

- **Delete** — requires typing tag name to confirm
- If posts exist with this tag: shows count + "Reassign posts to another tag first" message
- ON DELETE RESTRICT ensures DB-level safety

---

## 13. i18n

### 13.1 `BlogHubStrings` interface

Mirrors `NewsletterHubStrings` structure with blog-specific keys:

```typescript
export interface BlogHubStrings {
  tabs: { overview: string; editorial: string; schedule: string; analytics: string }
  kpi: { totalPosts: string; published: string; avgReadingTime: string; draftBacklog: string }
  actions: { newPost: string; newIdea: string; viewAll: string; configure: string }
  empty: { noData: string; noPosts: string; startWriting: string; addIdea: string; configCadence: string }
  overview: { tagBreakdown: string; recentPublications: string; velocityTrend: string; untagged: string; readingTime: string; publishedAgo: string }
  editorial: {
    throughput: string; avgTime: string; movedForward: string; bottleneck: string
    searchPosts: string
    idea: string; draft: string; ready: string; scheduled: string; published: string
    review: string; queued: string
    none: string; noTag: string; changeTag: string; addLocale: string; reassigned: string
    untitled: string; open: string; moveTo: string; duplicate: string; delete: string
    deleted: string; deleteFailed: string; confirmDelete: string
    quickAddPlaceholder: string; ideaCreated: string
    viewAllPublished: string; archived: string; showArchived: string; hideArchived: string; restore: string
  }
  schedule: {
    fillRate: string; next7Days: string; avgReadingTime: string; activeLocales: string
    cadenceConfig: string; publishTime: string; startDay: string
    resumeCadence: string; pauseCadence: string; save: string; cancelEdit: string
    saved: string; cadenceRangeError: string; timeFormatError: string; updateFailed: string
    daysUnit: string; editCadence: string
    slotDate: string; scheduledFor: string; publishedOn: string
  }
  analytics: { comingSoon: string; comingSoonDescription: string }
  common: { allTags: string; allLocales: string; updatedJustNow: string; showMore: string; moved: string; couldntMove: string; edit: string; posts: string }
  tagDrawer: {
    createTitle: string; editTitle: string
    sectionEssentials: string; sectionAppearance: string
    nameLabel: string; namePlaceholder: string
    slugLabel: string; slugPreview: string; slugWarning: string
    badgeLabel: string; badgePlaceholder: string; badgeHint: string
    colorLabel: string; colorDarkLabel: string; colorDarkHint: string
    clearColor: string
    close: string
    valRequired: string; valMinChars: string; valMaxChars: string
    valInvalidFormat: string; valReservedSlug: string; valInvalidHex: string; valSlugInUse: string
    tagNotFound: string; unknownError: string; typeNameToConfirm: string
    dangerZone: string; deleteButton: string; deleteConfirmDeps: string; deleteNameMismatch: string
    createButton: string; saveButton: string; creating: string; saving: string; cancel: string
    toastCreated: string; toastSaved: string; toastDeleted: string
  }
}
```

### 13.2 String files

`en.ts` and `pt-BR.ts` implement the full `BlogHubStrings` interface with all translations.

---

## 14. Types (`hub-types.ts`)

```typescript
export type BlogTabId = 'overview' | 'editorial' | 'schedule' | 'analytics'

export interface BlogTag {
  id: string
  name: string
  slug: string
  color: string
  colorDark: string | null
  badge: string | null
  sortOrder: number
  postCount: number
}

export interface BlogHubSharedData {
  tags: BlogTag[]
  tabBadges: { editorial: number }
  siteTimezone: string
  siteName: string
  defaultLocale: string
  supportedLocales: string[]
}

export interface PostCard {
  id: string
  displayId: string
  title: string  // resolved: filterLocale translation → defaultLocale → first available
  status: 'idea' | 'draft' | 'pending_review' | 'ready' | 'queued' | 'scheduled' | 'published' | 'archived'
  tagId: string | null
  tagName: string | null
  tagColor: string | null
  locales: string[]
  readingTimeMin: number | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  scheduledFor: string | null
  slotDate: string | null
  snippet: string | null
}

export interface OverviewTabData {
  kpis: {
    totalPosts: number
    totalPostsTrend: number
    published: number
    publishedTrend: number
    avgReadingTime: number
    avgReadingTimeTrend: number
    draftBacklog: number
    draftBacklogTrend: number
  }
  sparklines: Record<'totalPosts' | 'published' | 'avgReadingTime' | 'draftBacklog', number[]>
  tagBreakdown: Array<{ tagId: string | null; tagName: string; tagColor: string; count: number }>
  recentPublications: Array<{
    id: string; title: string; tagName: string | null; tagColor: string | null
    locales: string[]; publishedAt: string; readingTimeMin: number | null
  }>
  velocitySparkline: number[]
}

export interface EditorialTabData {
  velocity: {
    throughput: number
    avgIdeaToPublished: number
    movedThisWeek: number
    bottleneck: { column: string; avgDays: number } | null
  }
  posts: PostCard[]
}

export interface ScheduleSlot {
  date: string
  posts: Array<{ id: string; title: string; tagColor: string | null; status: string; locale: string }>
  emptySlots: Array<{ locale: string }>
}

export interface BlogCadenceConfig {
  locale: string
  cadenceDays: number
  preferredSendTime: string
  cadenceStartDate: string | null
  cadencePaused: boolean
  lastPublishedAt: string | null
}

export interface ScheduleTabData {
  healthStrip: {
    fillRate: number
    next7Days: number
    avgReadingTime: number
    activeLocales: number
    totalLocales: number
  }
  calendarSlots: ScheduleSlot[]
  cadenceConfigs: BlogCadenceConfig[]
}
```

---

## 15. Server Component Wiring (`page.tsx`)

```tsx
export default async function BlogHubPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId, defaultLocale, supportedLocales } = await getSiteContext()

  const uiLocale = defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const tab = (params.tab as BlogTabId) || 'overview'
  const tagId = params.tag || null
  const filterLocale = params.locale || null

  const [sharedData, strings] = await Promise.all([
    fetchBlogSharedData(siteId),
    Promise.resolve(uiLocale === 'pt-BR' ? ptBR : en),
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
      <Suspense fallback={<TabSkeleton />}>
        {tab === 'overview' && <OverviewTab siteId={siteId} tagId={tagId} locale={filterLocale} strings={strings} />}
        {tab === 'editorial' && <EditorialTab siteId={siteId} tagId={tagId} locale={filterLocale} strings={strings} />}
        {tab === 'schedule' && <ScheduleTab siteId={siteId} tagId={tagId} locale={filterLocale} strings={strings} />}
        {tab === 'analytics' && <AnalyticsTab strings={strings} />}
      </Suspense>
    </HubClient>
  )
}
```

Each tab component is an async server component that fetches its own data inside the Suspense boundary.

---

## 16. Kanban Column Mapping

| Kanban Column | DB Statuses Included | Badge | Notes |
|---|---|---|---|
| **Idea** | `idea` | — | Quick-add input in header |
| **Draft** | `draft`, `pending_review` | Orange "Review" on pending_review cards | Main work column |
| **Ready** | `ready`, `queued` | Amber "Queued" + slot_date on queued cards | Ready for scheduling/publishing |
| **Scheduled** | `scheduled` | Purple with scheduled_for date | Calendar-linked |
| **Published** | `published` | Green with published_at date | Capped at 15, "View all →" footer |

**Archived:** Collapsible section below the kanban board (not a column).

---

## 17. Follow-ups

### 17.1 Newsletter Hub Alignment (port back)

After blog hub ships, port these improvements to the newsletter hub:

1. **Quick-add input** — add inline "Quick idea..." input to newsletter Idea column
2. **More menu** — add context menu to newsletter kanban cards (currently only drag)
3. **Status transition indicators** — show valid drop targets during drag (highlight columns)
4. **Archived section** — add collapsible archived editions section below newsletter kanban
5. **Locale filter** — if newsletter types get multi-locale support, add locale chips

### 17.2 Blog Analytics Engine (separate spec)

Design a dedicated spec for:
- Blog view tracking (middleware-based, LGPD-compliant)
- Top posts by views/engagement
- Reading time distribution
- Referral source tracking
- Per-tag performance comparison
- Integration with `tonagarantia` ad-engine metrics

### 17.3 Hub Kit Extraction

After both blog and newsletter hubs are stable, extract shared components to `@tn-figueiredo/cms-hub`:
- `HubShell` (tabs + filter chips)
- `KanbanBoard` / `KanbanColumn` / `KanbanCard` (generic DnD)
- `MonthCalendar` / `CadenceCard`
- `KpiStrip` / `HealthStrip` / `SparklineSvg`
- `FilterChips` (generic chip bar with add/edit)
- `EmptyState` / `TabSkeleton` / `ErrorBoundary`
- i18n string interface pattern

---

## 18. Testing Strategy

### Unit tests (`apps/web/test/cms/blog-hub.test.ts`)

- Transition validation: all valid/invalid transitions in `BLOG_TRANSITIONS`
- DisplayId computation: `#BP-001`, `#BP-042`, etc.
- Tag CRUD actions: create, update, delete (with/without posts), reorder
- Quick-add: creates post with correct status/locale/tag
- isDirty detection: title vs content vs tag-only change
- Cadence config: validate cadence_days range, time format
- Published cap: verify 15-card limit in editorial data

### Integration tests (`apps/web/test/integration/blog-hub.test.ts`)

DB-gated (`skipIfNoLocalDb()`):
- `movePost` CAS: concurrent moves don't corrupt state
- `deleteTag` with posts: returns RESTRICT error
- Tag backfill: existing categories correctly migrated
- Cadence slot generation: `generateSlots()` with blog_cadence data
- `blog_tags.updated_at` trigger fires on update
- `createPost` resolves `author_id` from authenticated user

### E2E tests (Playwright, future)

- Kanban drag-and-drop flow
- Quick-add + card appears
- Tag drawer CRUD
- Dual filter composition
- Publish modal
