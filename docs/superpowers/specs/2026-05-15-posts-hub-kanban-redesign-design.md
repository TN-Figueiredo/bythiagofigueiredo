# Posts Hub & Pipeline Blog — Kanban Redesign

**Date:** 2026-05-15
**Status:** Draft
**Mockup:** `.superpowers/brainstorm/77533-1778863366/content/09-dual-kanban.html`

## Problem

Clicking "Posts" in the CMS sidebar lands on an Overview tab (stats, tag breakdown, velocity chart) before reaching the kanban. This breaks the expected workflow — the user wants to work directly in the kanban. The overview content is useful but belongs in the Dashboard, not as a friction gate before the editorial board.

Secondary problems:
- Kanban cards are text-only — no cover images, no snippet, no word count progress
- Kanban columns are fixed at 220px (`w-[220px] shrink-0`) instead of filling available width
- Pipeline Blog gem cards also lack cover images despite `cover_image_url` existing in the DB
- No visible cross-view handoff between Pipeline Blog (creation) and Posts Hub (publishing)

## Scope

Two distinct kanbans share a rich card redesign:

| View | Route | Columns | Purpose |
|------|-------|---------|---------|
| Posts Hub | `/cms/blog` | Ready → Scheduled → Published | Publishing workflow |
| Pipeline Blog | `/cms/pipeline/blog_post` | Ideia → Rascunho → Pronto | Creation workflow |

Plus: Dashboard receives migrated Overview content as a "Blog Health" section.

## Out of Scope

- Analytics tab implementation (placeholder, no backing data yet)
- Pipeline formats other than `blog_post` (video, newsletter, course, campaign cards unchanged)
- Newsletter kanban (separate hub, unchanged)
- New DB migrations for `word_count` column — use `reading_time_min` as proxy

---

## Architecture Changes

### 1. Eliminate Overview Tab

**Current state:** `BlogTabId = 'overview' | 'editorial' | 'schedule' | 'analytics'`

**New state:** `BlogTabId = 'editorial' | 'schedule' | 'analytics'`

**Files affected:**

| File | Change |
|------|--------|
| `hub-types.ts` | Remove `'overview'` from `BlogTabId`, delete `OverviewTabData` type |
| `hub-client.tsx` | Remove overview from `TABS` array, set `defaultTab = 'editorial'`, remove overview tab panel |
| `hub-queries.ts` | Delete `fetchOverviewData()` function (~120 lines). Keep `fetchBlogSharedData()` and `fetchEditorialData()` |
| `_tabs/overview/overview-tab.tsx` | Delete entire file |
| `_tabs/overview/` directory | Delete (contains `overview-tab.tsx` + sub-components: `KpiStrip`, `TagBreakdown`, `RecentPublications`, `SparklineSvg`) |
| Server page component | Stop rendering overview tab panel, default `?tab=` to editorial |

**URL behavior:** `/cms/blog` (no `?tab=` param) now renders the editorial kanban. Existing bookmarks to `?tab=overview` should fallback to editorial.

### 2. Posts Hub — Tab Bar Restructure

**New tab bar:**

```
📋 Editorial (4)  |  📅 Schedule  |  📈 Analytics  |  ⚙️
```

- Editorial is the default (active on load)
- Badge count on Editorial shows stale drafts (existing `tabBadges.editorial`)
- Gear icon (`⚙️`) opens the existing `TagDrawer` in list/manage mode — right-aligned, separated from tabs via `ml-auto`

**KPI inline bar** (below tabs, above filters):

Merge velocity metrics from `EditorialTabData.velocity` into a compact horizontal strip:

```
Total: 12  |  Published: 8 ↑3  |  Throughput: 4/mo  |  Idea→Pub: 12d ↓2d  |  Bottleneck: None
```

This replaces the full `VelocityStrip` component. Data source: existing `fetchEditorialData()` velocity object (`throughput`, `avgIdeaToPublished`, `movedThisWeek`, `bottleneck`). Add `totalPosts` and `publishedCount` to the velocity object (trivial — counts from the same query).

### 3. Kanban Column Layout — Full Width

**Current:** `w-[220px] shrink-0` per column (660px total + gaps, horizontal scroll on wide screens)

**New:** `flex-1 min-w-[220px]` per column — columns grow to fill available width, minimum 220px before scroll kicks in.

**Files affected:**

| File | Change |
|------|--------|
| `kanban-column.tsx` | Replace `w-[220px] shrink-0` with `flex-1 min-w-[220px]` |
| `kanban-board.tsx` | Keep `flex gap-3` wrapper with `overflow-x-auto` (scrollbar activates only when viewport < 3 × 220px + gaps) |

### 4. Rich Card System — Posts Hub

**Current `PostCard` type** (16 fields) — missing: `coverImageUrl`, `wordCount` (proxy via `readingTimeMin`)

**New `PostCard` fields:**

```typescript
interface PostCard {
  // ... existing 16 fields (including readingTimeMin) ...
  coverImageUrl: string | null    // NEW — from blog_translations.cover_image_url ?? blog_posts.cover_image_url
  excerpt: string | null          // NEW — from blog_translations.excerpt (replaces snippet derived from content_mdx)
}
```

**Query changes in `hub-queries.ts` → `fetchEditorialData()`:**

Currently selects from `blog_translations`: `locale, title, slug, reading_time_min, content_mdx`

Add: `cover_image_url, excerpt`

Snippet derivation changes: use `excerpt` first, fallback to first 80 chars of `content_mdx`.

Cover image resolution: `blog_translations.cover_image_url` (locale-specific) ?? `blog_posts.cover_image_url` (fallback).

**Card visual anatomy (top to bottom):**

```
┌─────────────────────────────────────┐
│ ▓▓▓▓ COVER IMAGE (44px) ▓▓▓▓▓▓▓▓▓▓│  ← photo with gradient fade to card bg
│ ┌ ─ ─ OR gradient (24px) ─ ─ ─ ─ ┐ │  ← tag-colored gradient fallback
│ ┌ ─ ─ OR strip-only (3px) ─ ─ ─ ┐  │  ← minimal tag-colored strip
│ ⠿  [#BP-003] [✅ Approved] [🔴 BtS]│  ← drag grip (hover) + id + status + tag
│ Por que abandonei o Notion          │  ← title: 13px/600/#f1f5f9, 2-line clamp
│ Depois de 3 anos usando Notion...   │  ← snippet: 11px/#94a3b8, 2-line clamp
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░ 1240/2000w  │  ← progress bar (word count via reading_time)
│ 🇧🇷 PT  7 min        Ready 1d ago  │  ← locale + reading time + relative date
└─────────────────────────────────────┘
```

**3-tier cover system:**

| Tier | When | Height | Rendering |
|------|------|--------|-----------|
| Photo | `coverImageUrl` exists | 44px | `<img>` with `object-fit: cover` + gradient overlay fading to `#131B2E` |
| Gradient | No photo, has tag color | 24px | Tag-color gradient at 10% opacity + fade to card bg |
| Strip-only | Minimal fallback | 3px | Horizontal gradient from tag color to transparent |

**Status badge sequential tones:**

| Status | Color | Token |
|--------|-------|-------|
| `idea` | — | Not shown in Posts Hub (filtered out) |
| `draft` | — | Not shown in Posts Hub (filtered out) |
| `pending_review` | — | Not shown in Posts Hub (filtered out) |
| `ready` / `queued` | Slate #94a3b8 | Approved |
| `scheduled` | Purple #a78bfa | Scheduled (shown in Scheduled column only via footer) |
| `published` | Green #34d399 | Published |

**Word count progress bar:**

No `word_count` column exists. Use `reading_time_min * 200` as estimated word count (200 wpm standard). Target word count: hardcoded 2000w default (per-post override deferred to future iteration, would require a new DB column).

| Fill % | Color | Meaning |
|--------|-------|---------|
| 0–40% | Red #ef4444 | Early draft |
| 40–75% | Amber #f59e0b | In progress |
| 75–99% | Green #22c55e | Nearly done |
| 100% | Green→Cyan gradient | Complete |

**Tag-colored hover glow:**

Cards get a `data-tc` attribute matching the tag color family. On hover:
- Border shifts to tag color at 35% opacity
- Box shadow adds a subtle 6px tag-colored glow at 6% opacity
- Transition: `0.18s cubic-bezier(0.4,0,0.2,1)`

Color families: `red`, `blue`, `green`, `purple` (mapped from `blog_tags.color`).

**Hover actions (absolute positioned, top-right):**

Two icon buttons appear on hover: edit (pencil) + more (ellipsis). Blurred background (`backdrop-filter: blur(8px)`), dark overlay.

**Drag grip:** 6-dot vertical grip on left edge, appears on hover, `cursor: grab`.

### 5. Rich Card System — Pipeline Blog

**Current `GemCardItem`** — 25 fields, no `cover_image_url`.

**Add to `GemCardItem`:**

```typescript
interface GemCardItem {
  // ... existing fields ...
  coverImageUrl: string | null  // from content_pipeline.cover_image_url
}
```

**Query changes in `[format]/page.tsx`:**

Add `cover_image_url` to the `content_pipeline` select query.

**Card visual changes for Pipeline Blog (`gem-card.tsx`):**

Apply the same 3-tier cover system:
- Photo tier: use `coverImageUrl` from `content_pipeline`
- Gradient tier: use priority accent color (existing) or tag color
- Strip tier: existing priority bar (already 2px, keep as-is)

Keep the existing gem-card structure (priority bar, hook display, checklist progress, VVS ring) but add the cover image as the top element when available.

**Pipeline-specific card additions:**

- **"Promote to Posts Hub" button** — shown only on cards in `stage === 'ready'` (Pronto column):
  - Indigo-toned action button at bottom of card body
  - `→ Promote to Posts Hub` label
  - On click: triggers graduation flow (existing `blog_post_id` FK linkage)
  - Hover: brighter background + border glow

**Column accent colors (Pipeline Blog):**

| Column | Accent | Hex |
|--------|--------|-----|
| Ideia | Gray | #9ca3af |
| Rascunho | Indigo | #6366f1 |
| Pronto | Cyan | #06b6d4 |

**Column accent colors (Posts Hub):**

| Column | Accent | Hex |
|--------|--------|-----|
| Ready | Cyan | #06b6d4 |
| Scheduled | Purple | #a78bfa _(changed from current `#8b5cf6` for better contrast on dark bg)_ |
| Published | Green | #22c55e |

Cyan connects Pronto → Ready across views (same content, different workflow stage).

### 6. Cross-View Handoff

**Pipeline Pronto → Posts Hub Ready:**

The connection between Pipeline Blog and Posts Hub is made explicit through:

1. **Promote button on Pronto cards** — visible action to graduate pipeline items to the Posts Hub
2. **Shared cyan accent** — Pronto (#06b6d4) and Ready (#06b6d4) use the same color
3. **"Promoted from Pipeline" hint** — subtle note at the bottom of the Posts Hub Ready column indicating items can arrive from the pipeline
4. **Empty state guidance** — Pronto column shows "Finished items land here. Promote them to Posts Hub →"

The graduation flow already exists in the codebase (`blog_post_id` FK on `content_pipeline`). The promote button flow:

1. Click "→ Promote to Posts Hub" on a Pronto card
2. Confirmation modal appears showing: title, language, tag (pre-filled from pipeline item's `category` → matching `blog_tag`)
3. On confirm: creates a `blog_posts` row with `status: 'ready'`, links `content_pipeline.blog_post_id`, transfers `hook` → `excerpt`, `cover_image_url`, and `title_pt`/`title_en` → `blog_translations`
4. Card appears in Posts Hub Ready column on next data fetch
5. Pipeline card shows "graduated" badge (existing visual treatment)

### 7. Dashboard — Blog Health Section

**Target file:** `dashboard-connected.tsx` (577 lines)

**Placement:** After the "Last Newsletter Banner" and before the 3-column grid (Coming Up / Continue Editing / Recent Activity).

**Content migrated from Overview tab:**

| Widget | Source | Dashboard adaptation |
|--------|--------|---------------------|
| KPI cards | `KpiStrip` (4 metrics with sparklines) | Compact 4-card row: Total Posts, Published, Avg Reading Time, Draft Backlog — each with trend % |
| Tag breakdown | `TagBreakdown` | Horizontal bar chart showing posts per tag |
| Velocity chart | `SparklineSvg` velocity area chart | 8-week publishing velocity sparkline |
| Recent publications | `RecentPublications` top 5 | Compact list with title + date + tag |

**Layout:** Full-width card with `Blog Health` header, containing a 2-row layout:
- Row 1: 4 KPI mini-cards in a horizontal strip
- Row 2: 2-column grid — tag breakdown (left) + velocity chart with recent publications below (right)

**Data source:** New `fetchDashboardBlogHealth(siteId)` query that reuses the same computation logic from the deleted `fetchOverviewData()`. Cached with `['dashboard', 'blog-health']` tags, 120s revalidate.

### 8. Filter Bar Symmetry

Both views share a consistent filter bar structure:

```
[All] [Tag1 (5)] [Tag2 (3)] [Tag3 (2)] [+] | [ALL] [🇧🇷] [🇺🇸] [🔍]
```

- Tag filter chips from `TagFilterChips` component (existing, reusable)
- "+" button opens `TagDrawer` for quick tag creation
- Locale separator + locale toggle chips
- Search button (rightmost)

Pipeline Blog currently lacks locale filtering — add it for consistency since pipeline items have `language` field.

---

## Component Impact Summary

### New files

| File | Purpose |
|------|---------|
| `_components/dashboard-blog-health.tsx` | Blog Health dashboard section |
| `_components/dashboard-blog-health-queries.ts` | Data fetching for blog health (extracted from deleted overview) |

### Modified files

| File | Key changes |
|------|-------------|
| `hub-types.ts` | Remove `'overview'` from `BlogTabId`, delete `OverviewTabData`, add `coverImageUrl`/`excerpt` to `PostCard` |
| `hub-client.tsx` | Remove overview tab, default to editorial, add gear icon for tags |
| `hub-queries.ts` | Delete `fetchOverviewData()`, add `cover_image_url`/`excerpt` to editorial query, add total/published counts to velocity |
| `hub-utils.ts` | No changes needed |
| `editorial-tab.tsx` | Replace `VelocityStrip` with inline KPI bar |
| `kanban-board.tsx` | No structural changes (column layout change is in kanban-column) |
| `kanban-column.tsx` | `flex-1 min-w-[220px]` instead of `w-[220px] shrink-0`, add "Promoted from Pipeline" hint in Ready column |
| `kanban-card.tsx` | Major rewrite — add cover image, snippet, progress bar, tag glow, hover actions, drag grip |
| `gem-card.tsx` | Add cover image tier, add "Promote to Posts Hub" button on Pronto cards |
| `[format]/page.tsx` | Add `cover_image_url` to pipeline query |
| `pipeline-filter-bar.tsx` | Add locale filter chips |
| `dashboard-connected.tsx` | Add Blog Health section import and render |
| `cms-sections.ts` | No changes (sidebar navigation unchanged) |

### Deleted files

| File | Reason |
|------|--------|
| `_tabs/overview/overview-tab.tsx` | Tab eliminated |
| `_tabs/overview/` sub-components (`kpi-strip.tsx`, `tag-breakdown.tsx`, `recent-publications.tsx`) | KPI/tag/velocity widgets move to dashboard. Note: `SparklineSvg` lives in `_shared/` and is kept for reuse. |

---

## Data Flow

### Posts Hub Editorial

```
fetchBlogSharedData(siteId) → tags, badges, site config
fetchEditorialData(siteId, tagId?, locale?) → posts (with coverImageUrl, excerpt), velocity
  ↓
HubClient (tabs, filters, URL params)
  ↓
EditorialTab (client-side filtering, KPI bar)
  ↓
KanbanBoard (DndContext, 3 columns)
  ↓
KanbanColumn (Ready | Scheduled | Published, flex-1)
  ↓
KanbanCard (rich card with cover, snippet, progress, tag glow)
```

### Pipeline Blog

```
page.tsx query → pipeline items (with cover_image_url)
  ↓
PipelineBoard (DndContext, 3 stage columns)
  ↓
GemCard (with cover image tier, promote button on Pronto)
```

### Dashboard Blog Health

```
fetchDashboardBlogHealth(siteId) → KPIs, tag breakdown, velocity, recent pubs
  ↓
DashboardConnected → DashboardBlogHealth section
```

---

## Design Tokens

### Color System (dark theme layers)

| Layer | Hex | Usage |
|-------|-----|-------|
| Body | #030712 | Page background |
| Sidebar / Columns | #0a0f1a | Sidebar bg, column bg base |
| Column variants | #0d1117 / #0c1020 / #0a1219 | Subtle per-column differentiation |
| Card | #131B2E | Card background |
| Borders | #1e293b | Default borders |
| Hover borders | #334155 | Elevated borders |

### Typography

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Card title | 13px | 600 | #f1f5f9 |
| Card snippet | 11px | 400 | #94a3b8 |
| Card metadata | 9px | 400–600 | #475569 |
| Column header | 10px | 700 | Column accent |
| KPI label | 9px | 400 | #475569 |
| KPI value | 11px | 600 | #cbd5e1 |

### Tag Color Families

| Family | Primary | Glow (6%) | Border (35%) |
|--------|---------|-----------|--------------|
| Red | #ef4444 | rgba(239,68,68,0.06) | rgba(239,68,68,0.35) |
| Blue | #3b82f6 | rgba(59,130,246,0.06) | rgba(59,130,246,0.35) |
| Green | #22c55e | rgba(34,197,94,0.06) | rgba(34,197,94,0.35) |
| Purple | #a855f7 | rgba(168,85,247,0.06) | rgba(168,85,247,0.35) |

---

## Testing Strategy

### Unit tests

- `PostCard` type with new fields — Zod schema validation
- `mapStatusToColumn` — existing, unchanged
- Cover image resolution: `translation.cover_image_url ?? post.cover_image_url ?? null`
- Word count proxy: `readingTimeMin * 200`
- Progress bar color thresholds
- Tag color family mapping from `blog_tags.color` hex → family name
- URL fallback: `?tab=overview` → redirects to `?tab=editorial`

### Integration tests

- `fetchEditorialData` returns `coverImageUrl` and `excerpt`
- `fetchDashboardBlogHealth` returns valid KPI structure
- Dashboard renders Blog Health section when data is available
- Pipeline query includes `cover_image_url`

### Visual regression (manual)

- Rich card renders correctly in all 3 cover tiers
- Tag hover glow activates on each color family
- Progress bar colors change at correct thresholds
- Full-width columns fill available space
- Promote button appears only on Pipeline Pronto cards
- Dashboard Blog Health section layout at different breakpoints

---

## Migration Notes

- No DB migrations needed — all required columns already exist
- `reading_time_min` used as word count proxy (no new `word_count` column)
- Overview tab removal is backwards-compatible — URL param fallback handles `?tab=overview`
- `fetchOverviewData` logic is extracted (not duplicated) into dashboard query
- Existing `TagDrawer` reused via gear icon — no new tag management UI
