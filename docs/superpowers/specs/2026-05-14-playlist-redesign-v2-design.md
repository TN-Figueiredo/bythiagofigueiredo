# Playlist Redesign v2 — Visual Planning Tool

**Date:** 2026-05-14
**Status:** Approved
**Scope:** `apps/web/src/app/cms/(authed)/playlists/[id]/_components/`, `apps/web/src/lib/playlists/`

---

## Summary

Complete redesign of the CMS playlist editor — a canvas-based visual tool for organizing content (videos, blog posts, newsletters, pipeline items) into sequences. This is an internal planning tool, not a public-facing feature. The primary output is **print** (light-theme list view for filtered content) and **on-screen flow comprehension**.

Key changes from v1:
- New `video` content type (separated from `pipeline`)
- Node redesign with left order stripe, max-width, 2-line clamp, 5 visual states
- Language badges (PT-BR / EN) per item
- Full filter system (type + language + dim/hide/all modes)
- Per-view renumbering (client-side only, DB sort_order unchanged)
- Redesigned context menu with icons and shortcuts
- Print/export experience (list, PNG, CSV/JSON)
- Updated auto-layout constants

---

## 1. Content Type Changes

### 1.1 New `video` Type

Videos currently live under `pipeline` content type. They become a first-class content type.

```typescript
// types.ts
export const CONTENT_TYPES = ['blog_post', 'newsletter', 'pipeline', 'video'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]
```

**Resolution strategy (no migration needed):** The `content_pipeline` table already has a `format` column (e.g. `'video'`, `'blog_post'`, `'ig_reel'`). Update `resolveContentType()` in `queries.ts` to check `pipelineMap.get(item.pipeline_id)?.format === 'video'` and return `'video'` instead of `'pipeline'`. No schema change to `playlist_items` is required — the distinction is derived at query time from the joined pipeline data.

### 1.2 Language Field

Each playlist item needs a language indicator. Derived at query time from joined content tables:
1. **Blog posts:** `blog_translations.locale` (already fetched via `blog_translations!inner(title, locale)`)
2. **Newsletter editions:** `newsletter_types.locale` via join (`newsletter_editions` → `newsletter_types.locale`; values: `'pt-BR'` / `'en'`)
3. **Pipeline items:** `content_pipeline.language` column (values: `'pt-br'` / `'en'` / `'both'`; already in schema, needs adding to select)
4. **Videos:** same as pipeline — `content_pipeline.language` (videos are pipeline rows with `format = 'video'`)

The `PlaylistItemEnriched` type gains:

```typescript
export interface PlaylistItemEnriched extends PlaylistItemRow {
  content_type: ContentType | null
  title: string
  status: string | null
  category: string | null
  metadata: string | null
  is_ghost: boolean
  other_playlist_count: number
  language: 'pt-br' | 'en' | null  // NEW
}
```

**Acceptance criteria:**
- [ ] `CONTENT_TYPES` array includes `'video'`
- [ ] Enrichment query resolves video vs pipeline correctly
- [ ] `language` field populated on all enriched items
- [ ] No DB schema change for `playlist_items` table (language derived at query time)

---

## 2. Node Redesign (V7)

### 2.1 Layout Structure

```
+--+----------------------------------------------+
|  |  [TYPE] category          [↗]                |  <- header (26px left stripe)
|#N|  Title line one that might be long enough     |
|  |  to wrap to a second line with elli...        |  <- body (2-line clamp)
|  |                                               |
|  |  ● published  ·  +2 playlists                |  <- footer
|  |  ▓▓▓▓▓▓▓░░░ step 3/7                        |  <- progress (pipeline only)
+--+----------------------------------------------+
```

**Max-width: 250px.** Titles that exceed 2 lines get `text-overflow: ellipsis` via `-webkit-line-clamp: 2`.

### 2.2 Left Stripe

- Width: 26px
- Contains order number centered vertically, white text, bold
- Gradient background matching content type color (see 2.3)
- Non-matching items (when filtered) show "---" instead of a number

### 2.3 Content Type Colors

| Type | Color | Gradient | Badge |
|------|-------|----------|-------|
| VIDEO | Red 500 | `#ef4444` -> `#dc2626` | `VIDEO` |
| BLOG | Indigo 500 | `#6366f1` -> `#4f46e5` | `BLOG` |
| NEWS | Green 500 | `#22c55e` -> `#16a34a` | `NEWS` |
| PIPE | Purple 500 | `#a855f7` -> `#9333ea` | `PIPE` |

```typescript
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
```

### 2.4 Language Badges

Language badges use neutral warm/cool tones to avoid conflict with type colors:

| Language | Background | Text Color |
|----------|-----------|------------|
| PT-BR | `rgba(251,191,36,0.1)` | `#fbbf24` (Amber 400) |
| EN | `rgba(59,130,246,0.1)` | `#60a5fa` (Blue 400) |

Displayed in the header row after the type badge. Short labels: `PT` and `EN`.

### 2.5 Visual States

| State | Border | Opacity | Extra |
|-------|--------|---------|-------|
| **Normal** | 1.5px solid, type-colored | 100% | box-shadow: `0 1px 3px rgba(0,0,0,0.3)` |
| **Hover** | 2px solid, type-colored | 100% | Enhanced shadow with type-colored glow; `↗` button + connection handles appear |
| **Selected** | 2px solid + 2.5px outer ring (type color at 20%) | 100% | Enhanced shadow |
| **Idea** (early pipeline) | 1.5px dashed, type-colored | 55% | Desaturated badges, `filter: saturate(0.6)` |
| **Dimmed** (filtered out) | unchanged | 12% | `filter: saturate(0.15)`, `pointer-events: none` |

### 2.6 Hover Elements

- **Open button (↗):** Appears top-right of header on hover. Navigates to the original content editor (blog post editor, pipeline detail, etc.)
- **Connection handles:** 4 cardinal points (top, right, bottom, left). Type-colored dots, 8px diameter. `cursor: crosshair`. Appear on hover with scale-in transition.

### 2.7 Footer

- **Status:** Colored dot + label (e.g., `● published`, `● draft`)
- **Cross-playlist count:** `+N playlists` when item appears in other playlists
- **Progress bar:** Only for pipeline items. Shows step N/M as a thin bar below footer text.

### 2.8 Order Number

- Shows current position in the **active filtered view** (e.g., when filtered to "Video PT-BR", items renumber #1 through #6)
- Non-matching items show "---" in the stripe
- Global `sort_order` in DB is never modified by filtering

**Acceptance criteria:**
- [ ] Node max-width is 250px, title clamps at 2 lines
- [ ] Left stripe shows order number with correct gradient
- [ ] All 4 content type colors render correctly
- [ ] Language badges appear in header (PT/EN)
- [ ] 5 visual states implemented and distinguishable
- [ ] Open button navigates to correct editor
- [ ] Handles appear on hover at 4 cardinal points
- [ ] Footer shows status, cross-playlist count, and progress bar (pipeline)
- [ ] Order number re-indexes based on active filter

---

## 3. Context Menu

### 3.1 Structure

Right-click on a node opens a context menu. Width: 200px. `backdrop-filter: blur(12px)`.

**Header:** Type badge (colored) + `#N` + truncated title (single line, ellipsis)

**Menu items** (each with 12x12 SVG icon, `stroke-width: 2.5`):

| Item | Icon | Shortcut | Notes |
|------|------|----------|-------|
| Open in editor | External link | `Cmd+Enter` | Navigates to content editor |
| Copy ID | Clipboard | `Cmd+C` | Copies `playlist_item.id` to clipboard |
| --- separator --- | | | |
| Add edge from here | Arrow right | `E` | Enters edge-creation mode |
| Select connected | Network | `Cmd+A` | Selects all nodes connected via edges |
| Move to position... | Move | `M` | Opens position input dialog |
| Other playlists | List | `N` | Shows list of other playlists containing this item |
| --- separator --- | | | |
| Remove from playlist | Trash | `Backspace` | Danger style (red text, red hover bg) |

**Footer:** Full UUID (monospace, truncated with copy-on-click) + date added (relative)

### 3.2 Implementation Notes

- Replace current simple `ContextMenuItem[]` array with structured sections (header, items with icons/shortcuts, footer)
- Keyboard shortcuts should work when context menu is open AND when a node is selected without the menu
- Menu auto-repositions to stay within viewport (existing behavior, keep)

**Acceptance criteria:**
- [ ] Context menu renders with header (type badge + order + title)
- [ ] All 8 menu items present with correct icons and shortcuts
- [ ] Separators divide logical groups
- [ ] Footer shows UUID and date
- [ ] Danger item styled in red
- [ ] `backdrop-filter: blur(12px)` applied
- [ ] Width is 200px
- [ ] Keyboard shortcuts functional

---

## 4. Filter System

### 4.1 Filter Bar

Positioned below the toolbar, above the canvas. Contains:

**Type chips:**

| Chip | Color when active | Shows count |
|------|------------------|-------------|
| All | White/neutral | Total items |
| Video | Red 500 bg | Video count |
| Blog | Indigo 500 bg | Blog count |
| News | Green 500 bg | News count |
| Pipe | Purple 500 bg | Pipe count |

**Language chips:**

| Chip | Color when active |
|------|------------------|
| PT-BR | Amber 400 |
| EN | Blue 400 |

**Mode toggle** (3-way): `Dim` | `Hide` | `All`

- **Dim:** Non-matching items at 12% opacity + `saturate(0.15)`, `pointer-events: none`
- **Hide:** Non-matching items removed from canvas entirely
- **All:** Everything visible, no filtering effect

Chips have active (filled bg, white text) and inactive (transparent bg, muted text) states. Multiple type chips can be active simultaneously. Language chips are independent toggles.

### 4.2 Sidebar Enhancements

The sidebar gains:

1. **Search input** at top (filters by title, debounced 200ms)
2. **Grouped items** by active filter combination (e.g., "Video -- PT-BR (6)")
3. **Order numbers** (#1-#N) synchronized with canvas view numbering
4. **Dimmed groups** for non-matching items (when mode is Dim)
5. **Language badge** (PT/EN) per item in the list
6. **Hidden groups** removed from list (when mode is Hide)

### 4.3 Canvas Behavior

| Mode | Matching items | Non-matching items | Edges |
|------|---------------|-------------------|-------|
| All | Normal render | Normal render | Normal |
| Dim | Normal render | 12% opacity, desaturated, no interaction | Edges to dimmed nodes at 4% opacity |
| Hide | Normal render | Removed from DOM | Edges to hidden nodes removed |

### 4.4 View-Local Renumbering

When a filter is active, matching items renumber #1 through #N based on their `sort_order` position relative to each other. Non-matching items show "---" in the order stripe.

This is **client-side only**. The DB `sort_order` column is never modified by filtering. The renumbered sequence is what appears in print output.

```typescript
function computeViewNumbers(
  items: PlaylistItemEnriched[],
  filter: FilterState,
): Map<string, number | null> {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)
  const matching = sorted.filter(item => matchesFilter(item, filter))
  const result = new Map<string, number | null>()
  for (const item of sorted) {
    const idx = matching.indexOf(item)
    result.set(item.id, idx >= 0 ? idx + 1 : null)
  }
  return result
}
```

### 4.5 Filter State Type

```typescript
interface FilterState {
  types: Set<ContentType>      // empty = all types
  languages: Set<'pt-br' | 'en'> // empty = all languages
  mode: 'dim' | 'hide' | 'all'
  search: string               // sidebar search term
}
```

**Acceptance criteria:**
- [ ] Filter bar renders below toolbar with type and language chips
- [ ] Chip counts are accurate and update on content changes
- [ ] Mode toggle switches between Dim/Hide/All
- [ ] Dim mode: non-matching at 12% opacity, no pointer events, edges at 4%
- [ ] Hide mode: non-matching fully removed from canvas and sidebar
- [ ] All mode: everything visible
- [ ] Sidebar search filters by title
- [ ] Sidebar items grouped by active filter
- [ ] Order numbers in sidebar match canvas renumbering
- [ ] Renumbering is client-side only; DB `sort_order` unchanged

---

## 5. Auto-Layout Improvements

Keep the custom implementation (no React Flow migration). Update spacing constants only.

### 5.1 Constants

| Constant | Old Value | New Value | Rationale |
|----------|-----------|-----------|-----------|
| `NODE_W` | (implicit) | `250` | Match new max-width |
| `LAYER_GAP_X` | `300` | `370` | 250 node + 120 for arrows/labels |
| `NODE_GAP_Y` | `110` | `103` | 80 node height + 23 breathing room |
| `ORPHAN_COLS` | `4` | `4` | Unchanged |
| `ORPHAN_GAP_Y` | `160` | `140` | Tighter orphan grid |
| `DIMMED_OFFSET_Y` | N/A | `+120` | Dimmed nodes positioned below active ones |

### 5.2 Zoom Adaptive Fit

Auto-fit on load calculates bounds with 60px padding on all sides.

| Item Count | Target Zoom |
|------------|-------------|
| ~5 items | ~85% |
| ~20 items | ~45-55% |
| 50+ items | ~25-35% |

**Zoom range:** 25% -- 200%

Fit button (`Cmd+0`) always recalculates to fit all visible (non-hidden) items.

### 5.3 Dimmed Node Layout

When filter mode is `Dim`, dimmed (non-matching) nodes shift down by `DIMMED_OFFSET_Y` (120px) from their natural layout position. This creates visual separation between active and dimmed content without removing dimmed nodes from the graph.

### 5.4 Algorithm

Keep existing Kahn's topological sort + barycenter cross-minimization (8 sweeps) + adjacent swap post-processing. Only spacing constants change.

**Acceptance criteria:**
- [ ] `LAYER_GAP_X` is 370px
- [ ] `NODE_GAP_Y` is 103px
- [ ] `ORPHAN_GAP_Y` is 140px
- [ ] Auto-fit on load with 60px padding
- [ ] Zoom range 25%-200%
- [ ] Fit button recalculates for visible items only
- [ ] Dimmed nodes offset by 120px below active ones

---

## 6. Edge Visibility

### 6.1 Edge Styles

| Edge Type | Stroke Color | Style | Marker | Label |
|-----------|-------------|-------|--------|-------|
| `sequence` | Indigo (`#818cf8`) | Solid | Arrowhead | `seq` |
| `related` | Purple (`#a855f7`) | Dashed | Circle | (custom or "see also") |
| `prerequisite` | Amber (`#fbbf24`) | Solid | Arrowhead | (custom or "read first") |
| `continuation` | Green (`#34d399`) | Solid | Arrowhead | (custom) |

### 6.2 Dimmed Edge Behavior

Edges connecting to dimmed nodes render at **4% opacity**. Edges connecting to hidden nodes are removed from the SVG entirely.

### 6.3 Edge Label Space

The 120px horizontal gap between nodes (from `LAYER_GAP_X = 370 - NODE_W = 250`) provides dedicated space for edge labels without overlap.

### 6.4 Related Edge Marker

`related` edges use a circle end-marker instead of an arrowhead to visually distinguish bidirectional associations from directional flow.

```typescript
// Add to EdgeArrowDefs
<marker id="circle-related" markerWidth="8" markerHeight="8" refX="4" refY="4">
  <circle cx="4" cy="4" r="3" fill="none" stroke="#a855f7" strokeWidth="1.5" />
</marker>
```

**Acceptance criteria:**
- [ ] 4 edge types render with correct colors and styles
- [ ] `related` uses circle marker, others use arrowhead
- [ ] Edges to dimmed nodes at 4% opacity
- [ ] Edges to hidden nodes removed
- [ ] Edge labels fit within 120px gap

---

## 7. Print/Export

### 7.1 Print List (Cmd+P)

Light theme numbered list. Respects active filters (only matching items printed, renumbered).

**Layout per item:**

```
#1  [VIDEO]  [PT]  ● published
    Title of the content item here
    https://youtube.com/watch?v=abc123
```

**Page structure:**
- **Header:** Playlist name + active filter description (e.g., "Video -- PT-BR") + print date
- **Body:** Numbered list with type badge, language badge, status, title, metadata (URL for videos/blogs, pipeline step for pipeline items)
- **Pagination:** CSS `@media print` with page breaks

Implementation: Render a hidden `<div>` with `@media print` styles. `Cmd+P` triggers `window.print()`.

### 7.2 Export Canvas PNG

Captures current canvas viewport (dark or light theme) as a PNG image including nodes, edges, and order numbers.

Implementation: Use `html-to-image` or canvas API to capture the SVG + HTML node overlay.

### 7.3 Export CSV/JSON

Ordered list with metadata. Respects active filters (only matching items exported, renumbered).

**CSV columns:** `#`, `type`, `language`, `status`, `title`, `url`, `pipeline_step`, `category`, `uuid`

**JSON structure:**
```json
{
  "playlist": "Playlist Name",
  "filter": "Video -- PT-BR",
  "exported_at": "2026-05-14T12:00:00Z",
  "items": [
    {
      "order": 1,
      "type": "video",
      "language": "pt-br",
      "status": "published",
      "title": "...",
      "url": "...",
      "uuid": "..."
    }
  ]
}
```

### 7.4 Toolbar Changes

The existing single "Export image" button becomes a dropdown with 3 options:
- Print List (Cmd+P)
- Export PNG
- Export CSV / Export JSON

**Acceptance criteria:**
- [ ] Print produces light-theme list with filter-aware renumbering
- [ ] Print header shows playlist name, filter, date
- [ ] PNG export captures full canvas with nodes and edges
- [ ] CSV export has correct columns and respects filters
- [ ] JSON export matches schema above
- [ ] Toolbar export button becomes dropdown with 3 options

---

## 8. Organizational Model

### 8.1 One Playlist, All Types

A single playlist can contain all content types (video, blog, newsletter, pipeline) and all languages. There are no separate playlists per type or language.

### 8.2 Filters Control the View

Filters narrow the visible/printed view but never split the underlying data. The user builds one comprehensive playlist and uses filters to extract focused views (e.g., "show me only my PT-BR videos in order").

### 8.3 Purpose

- **Not public-facing.** Playlists are an internal CMS planning tool.
- **Primary output is print.** The filtered list view, printed on paper or exported to CSV, is how the user consumes the organized sequence.
- **Secondary output is visual flow.** The canvas with edges helps the user understand relationships and plan content order.

**Acceptance criteria:**
- [ ] A single playlist accepts items of any content type
- [ ] No UI enforces content type or language homogeneity
- [ ] Print is the primary export path (prominent in toolbar)

---

## 9. Files Affected

### Modified

| File | Changes |
|------|---------|
| `lib/playlists/types.ts` | Add `'video'` to `CONTENT_TYPES`, add `language` to `PlaylistItemEnriched`, add `FilterState` type |
| `lib/playlists/queries.ts` | Update `resolveContentType()` to accept pipeline format for video detection; add `language` to pipeline select; join `newsletter_types.locale` for newsletters; add `language` to blog/newsletter/pipeline enrichment maps; populate `language` field on `PlaylistItemEnriched` |
| `lib/playlists/canvas/utils.ts` | Update `NODE_WIDTH` from 160 to 250; update `fitAllNodes` default nodeWidth |
| `lib/playlists/canvas/auto-layout.ts` | Update constants: `LAYER_GAP_X=370`, `NODE_GAP_Y=103`, `ORPHAN_GAP_Y=140`, add `NODE_W=250`, add `DIMMED_OFFSET_Y=120` |
| `playlists/[id]/_components/playlist-node.tsx` | Full rewrite: left stripe, max-width, 2-line clamp, 5 states, language badge, open button, footer, progress bar |
| `playlists/[id]/_components/context-menu.tsx` | Full rewrite: header, icons, shortcuts, footer, 200px width, blur backdrop |
| `playlists/[id]/_components/playlist-toolbar.tsx` | Add export dropdown (print/PNG/CSV/JSON) |
| `playlists/[id]/_components/playlist-sidebar.tsx` | Add search, grouped items, language badges, order numbers, dimmed groups |
| `playlists/[id]/_components/playlist-edge.tsx` | Update `related` to circle marker, add opacity logic for dimmed/hidden |
| `playlists/[id]/_components/playlist-canvas.tsx` | Integrate filter state, view numbering, dimmed/hidden rendering, print div |

### New

| File | Purpose |
|------|---------|
| `playlists/[id]/_components/filter-bar.tsx` | Type chips, language chips, mode toggle |
| `playlists/[id]/_components/print-view.tsx` | Light-theme print layout with `@media print` styles |
| `playlists/[id]/_components/export-menu.tsx` | Dropdown with Print/PNG/CSV/JSON options |
| `lib/playlists/canvas/view-numbers.ts` | `computeViewNumbers()` function for filter-aware renumbering |

---

## 10. Non-Goals

- No React Flow migration (keep custom canvas)
- No public-facing playlist rendering
- No drag-and-drop reordering in sidebar (use sort_order or Move to position from context menu)
- No real-time collaboration
- No playlist sharing/embedding outside CMS
