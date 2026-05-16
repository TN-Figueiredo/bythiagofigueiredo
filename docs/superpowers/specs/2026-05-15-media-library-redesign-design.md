# Media Library Redesign — Design Spec

**Date:** 2026-05-15
**Status:** Approved
**Scope:** `/cms/media` standalone page + `MediaGalleryModal` shared picker
**Mockup:** `.superpowers/brainstorm/41430-1778885660/content/option-b-v5.html`

## 1. Motivation

The current Media Library (`/cms/media`) has several problems:

1. **Visual quality** — hardcoded slate/gray hex colors instead of `cms-*` design tokens; inconsistent with the rest of the CMS
2. **No type differentiation** — cover images, avatars, inline images, OG images, and orphans all look identical in the grid
3. **Missing features** — no bulk select, no inline editing (alt text, tags, folder), no detail panel, no usage tracking display, no sort controls, no view modes, no storage visualization
4. **`media_asset_usage` not populated** — the critical usage tracking table exists in the DB but is only populated from ~5 of ~12 gallery-select call sites, making orphan detection unreliable
5. **Dual surface gap** — the standalone page and the modal picker diverge in features and styling

## 2. Current State

### What Exists

| Layer | Status |
|-------|--------|
| DB schema (`media_assets`, `media_asset_usage`) | Complete — 7 indexes, RLS, RPCs |
| Server actions (10 total) | Complete — list, get, upload, update, softDelete, bulkDelete, restore, stats, trackUsage, removeUsage |
| lib/media (upload pipeline, processing, validation, hash, SVG sanitize) | Complete |
| Cron cleanup (7-day grace → 30-day hard delete) | Complete |
| Standalone page UI | Basic — grid + search + folder filter only |
| Modal picker UI | More complete — crop, double-click, dimension warnings |
| Crop presets (6) | Complete — avatar, blog-cover, og-image, newsletter-header, site-logo, free |

### Server Actions Available but No UI

- `bulkDeleteMediaAssetsAction` — no bulk select UI
- `restoreMediaAssetAction` — no trash/restore UI
- `updateMediaAssetAction` — no inline edit UI
- `getMediaStatsAction` — returns orphanCount, folderBreakdown, softDeletedCount but page only shows total count + size

### Usage Tracking Gaps

**Tracked:** author avatar, author about photo, blog inline image, newsletter inline image, ad campaign media
**NOT tracked:** blog cover image, blog OG image, newsletter type OG, site logo, site default OG, pipeline item images, ad slot creatives

## 3. Design Direction

Approved mockup: **Option B — Visual & Contextual** (Figma/Dribbble-inspired). A single-page application feel with:

- Unified Linear-style toolbar (select-all, search, filter pills, sort, column density, view toggle)
- Type-colored cards with left accent borders and contextual badges
- Slide-in detail panel with tabbed metadata (Details / Usage / History)
- Storage bar with animated segments and color legend
- Full keyboard navigation, lightbox with prev/next, context menu, shift-select

### Design Tokens Migration

The redesign MUST use `cms-*` semantic tokens from `@tn-figueiredo/cms-ui/styles.css` instead of hardcoded hex colors:

| Mockup Variable | CMS Token |
|----------------|-----------|
| `--bg-root: #0b1120` | `bg-cms-bg` |
| `--bg-card: #111a2e` | `bg-cms-surface` |
| `--bg-card-hover: #162040` | `bg-cms-surface-hover` |
| `--bg-elevated: #1a2744` | `bg-cms-surface` with elevated variant |
| `--border: #1e2d4a` | `border-cms-border` |
| `--border-subtle: #162040` | `border-cms-border-subtle` |
| `--accent: #7c3aed` | `bg-cms-accent` / `text-cms-accent` |
| `--text: #e8edf5` | `text-cms-text` |
| `--text-muted: #7b8ba5` | `text-cms-text-muted` |
| `--text-dim: #4a5568` | `text-cms-text-dim` |

Type-specific colors remain as direct Tailwind classes: `text-blue-500`, `text-purple-500`, `text-green-500`, `text-orange-500`, `text-red-500`.

## 4. Architecture

### Component Tree

```
/cms/media/page.tsx (server component — getSiteContext, fetch initial data)
└── MediaLibraryPage (client component — full page layout)
    ├── StorageBar
    │   └── StorageLegend
    ├── MediaToolbar
    │   ├── SelectAllCheckbox
    │   ├── SearchInput (with result count)
    │   ├── FilterPills (type filters with counts)
    │   ├── SortDropdown
    │   ├── ColumnDensity
    │   └── ViewToggle (grid/list)
    ├── MediaContentArea
    │   ├── MediaGrid
    │   │   └── MediaCard[] (type-colored, with quick actions)
    │   ├── MediaList
    │   │   └── MediaListRow[] (with type badges)
    │   ├── SkeletonGrid (loading state)
    │   └── EmptyState (context-aware per filter)
    ├── DetailPanel (slide-in)
    │   ├── DetailPreview (with lightbox trigger)
    │   ├── DetailTabs (Details / Usage / History)
    │   ├── MetadataGrid (copyable values)
    │   ├── TagEditor
    │   ├── AltTextEditor
    │   └── DetailActions (Copy URL / Replace / Delete)
    ├── BulkActionBar (fixed bottom, spring animation)
    ├── Lightbox (with prev/next navigation)
    ├── DeleteConfirmModal (with undo toast)
    ├── ContextMenu (right-click on cards)
    ├── UploadProgress (bottom-left indicator)
    ├── DropOverlay (drag & drop)
    ├── KeyboardShortcutsPanel
    └── ToastContainer
```

### Shared Modal Updates

`MediaGalleryModal` will be updated to reuse the same `MediaGrid` and `MediaCard` components with a `compact` prop that:
- Hides the storage bar, detail panel, bulk bar, and keyboard shortcuts
- Disables context menu and lightbox (double-click-to-select behavior preserved)
- Shows a simplified toolbar (search + folder filter only)
- Retains type-colored cards and filter pills for visual consistency

### File Organization

```
apps/web/src/app/cms/(authed)/media/
├── page.tsx                          # Server component (unchanged shell)
├── actions.ts                        # Server actions (unchanged)
├── media-library-page.tsx            # NEW — full page client component
└── _components/
    ├── storage-bar.tsx               # Storage visualization + legend
    ├── media-toolbar.tsx             # Unified toolbar
    ├── media-grid.tsx                # Grid view
    ├── media-card.tsx                # Individual card
    ├── media-list.tsx                # List view + rows
    ├── detail-panel.tsx              # Slide-in detail panel
    ├── detail-tabs.tsx               # Tabbed content (Details/Usage/History)
    ├── media-lightbox.tsx            # Lightbox with prev/next
    ├── bulk-action-bar.tsx           # Bulk operations bar
    ├── delete-confirm-modal.tsx      # Delete with undo
    ├── context-menu.tsx              # Right-click actions
    ├── upload-progress.tsx           # Upload indicator
    ├── drop-overlay.tsx              # Drag & drop overlay
    ├── empty-state.tsx               # Context-aware empty state
    ├── skeleton-grid.tsx             # Loading skeleton
    └── keyboard-shortcuts.tsx        # Shortcuts panel

apps/web/src/app/cms/(authed)/_shared/media/
├── media-gallery-modal.tsx           # REFACTORED — uses shared components
├── media-upload-tab.tsx              # UNCHANGED
├── media-crop-editor.tsx             # UNCHANGED
├── types.ts                          # EXTENDED — new type color map, view types
├── use-media-gallery.ts             # UNCHANGED
└── _i18n/                           # EXTENDED — new strings for redesign
```

## 5. Component Specifications

### 5.1 MediaCard

Each card displays:
- **Image thumbnail** with shimmer loading + error fallback
- **4px left type-colored border** (blue=cover, green=inline, purple=avatar, orange=OG, red=unused)
- **Hover overlay** with quick actions: Preview (lightbox), Download, Copy URL, Delete
- **Avatar variant**: circular 120px image with radial gradient background and author name
- **Info section**: filename (with search highlight), inline type badge, "NEW" badge (≤3 days), usage line, dimensions + size
- **Orphan variant**: red border, pulsing shadow, "Unused · X days ago" usage line
- **Checked state**: accent border + purple overlay
- **Selected state**: accent glow ring

Props: `item: MediaAsset`, `type: MediaAssetType`, `checked: boolean`, `selected: boolean`, `onSelect`, `onCheck`, `onQuickAction`, `searchQuery?: string`

### 5.2 DetailPanel

380px wide slide-in from right with spring animation. Three tabs:

**Details tab:**
- Metadata grid: Filename (copyable), Dimensions (copyable), Size (copyable), Ratio, MIME (copyable), Uploaded date, Uploaded by
- Tags section: pills with remove + "Add tag" button (calls `updateMediaAssetAction`)
- Alt text section: textarea with auto-save (debounced 500ms, calls `updateMediaAssetAction`)
- Folder selector: dropdown to reassign folder (calls `updateMediaAssetAction`)

**Usage tab:**
- For normal assets: list of "Referenced in" links with resource type badge
- For orphans: warning card with "Unused for X days — auto-deletes in Y days"
- Data from `media_asset_usage` join

**History tab:**
- Timeline with connected dots showing: Upload event, EXIF strip, SHA-256 dedup check
- Future: will show edit events when audit log integration is added

**Actions bar at bottom:**
- Copy URL (primary) — copies `blobUrl` to clipboard
- Replace — opens upload flow targeting the same asset ID
- Delete (danger) — opens delete confirmation modal

### 5.3 StorageBar

- Label: "Blob Storage" with used/total display
- Track: color-coded segments per type, animated from 0 on mount
- Legend: colored dots with type labels below the bar
- Data: from `getMediaStatsAction` folderBreakdown, mapped to types

### 5.4 MediaToolbar

Single-row unified toolbar (Linear-style) containing:
1. Select-all checkbox (unchecked / indeterminate / checked)
2. Search input with `⌘K` shortcut hint, clear button, live result count
3. Filter pills: All, Covers, Inline, Avatars, OG, Unused — with dynamic counts per search query
4. Sort dropdown: Newest, Oldest, Largest, Smallest, Name A-Z
5. Column density: 2 / 3 / 4 columns
6. View toggle: Grid / List

### 5.5 Lightbox

- Full-screen overlay with checkerboard transparency background
- Scale-in animation on open
- Previous/Next arrows (circular buttons with backdrop blur)
- Left/Right keyboard navigation
- Counter ("3 / 12")
- Disabled arrows at edges
- Filename + dimensions display
- Close on click outside, Escape, or X button

### 5.6 BulkActionBar

Fixed bottom bar with spring slide-up animation when `checked.size > 0`:
- Selection count ("X selected")
- Deselect all link
- Actions: Download, Tag, Delete (danger)
- Shift+Click range selection support

### 5.7 Keyboard Navigation

| Key | Action |
|-----|--------|
| `⌘K` | Focus search |
| `↑↓←→` | Navigate cards (column-aware) |
| `Enter` | Open detail panel |
| `Space` | Toggle selection |
| `Escape` | Close panel → Clear search → Close lightbox |
| `Delete` / `Backspace` | Delete selected/checked |
| `?` | Toggle shortcuts panel |
| `Shift+Click` | Range select |
| `←→` (in lightbox) | Previous/next image |

## 6. Data Layer Changes

### 6.1 Fix Usage Tracking (CRITICAL)

Add `trackMediaUsageAction` calls to all missing gallery-select flows:

| Surface | File | Field | Resource Type |
|---------|------|-------|---------------|
| Blog cover image | `images-tab.tsx` | `cover_image` | `blog_post` |
| Blog OG image | `images-tab.tsx` | `og_image` | `blog_post` |
| Newsletter type OG | `type-drawer.tsx` | `og_image` | `newsletter_type` |
| Site logo | `gallery-url-field.tsx` | `logo_url` | `site` |
| Site default OG | `gallery-url-field.tsx` | `og_image` | `site` |
| Pipeline item | `pipeline-item-detail.tsx` | `cover_image` | `pipeline_item` |
| Pipeline item | `pipeline-item-detail.tsx` | `thumbnail` | `pipeline_item` |

Each `onSelect` callback must call `trackMediaUsageAction` with the appropriate `resourceType`, `resourceId`, and `fieldName`.

### 6.2 New Query: Asset Type Resolution

Assets don't have an explicit `type` column. Type is derived from the combination of `folder` and `media_asset_usage`:

```typescript
const FOLDER_TO_TYPE: Record<string, MediaAssetType> = {
  authors: 'avatar',
  og: 'og',
  blog: 'cover',       // default for blog folder; overridden to 'inline' if usage.field_name is 'inline_image'
  branding: 'cover',
  newsletters: 'inline',
  pipeline: 'inline',
  ads: 'inline',
  links: 'inline',
  general: 'inline',
};

function resolveAssetType(
  asset: MediaAsset,
  usageCount: number,
  primaryFieldName?: string | null
): MediaAssetType {
  if (usageCount === 0) return 'orphan';
  if (asset.folder === 'authors') return 'avatar';
  if (asset.folder === 'og') return 'og';
  if (asset.folder === 'blog' && primaryFieldName === 'inline_image') return 'inline';
  return FOLDER_TO_TYPE[asset.folder] ?? 'inline';
}
```

The `primaryFieldName` comes from the first row of `media_asset_usage` for the asset, fetched via a LEFT JOIN in the list query.

This requires joining `media_asset_usage` in the list query. Add an optimized view or modify `listMediaAssets` to include a `usage_count` and `primary_usage_type` computed column.

### 6.3 Enhanced Stats Query

`getMediaStatsAction` already returns `folderBreakdown` and `orphanCount`. Map this to type-based breakdown for the storage bar:

```typescript
type TypeBreakdown = Record<MediaAssetType, { count: number; sizeBytes: number }>;
```

### 6.4 No Schema Migrations Needed

The existing `media_assets` and `media_asset_usage` tables are sufficient. No new columns, tables, or migrations required.

## 7. State Management

Single `useReducer` in `MediaLibraryPage` managing:

```typescript
interface MediaLibraryState {
  filter: 'all' | MediaAssetType;
  search: string;
  sort: 'newest' | 'oldest' | 'largest' | 'smallest' | 'name';
  view: 'grid' | 'list';
  cols: 2 | 3 | 4;
  selectedId: string | null;
  checked: Set<string>;
  lightboxId: string | null;
  detailTab: 'details' | 'usage' | 'history';
  isLoading: boolean;
}
```

Data fetching via server actions with `useTransition` for non-blocking UI updates. Cursor-based pagination preserved (24 items per page, "Load more" button).

## 8. Accessibility

- All interactive elements have `focus-visible` outlines (2px accent)
- `aria-label` on grid (`role="grid"`), list (`role="list"`), search (`role="searchbox"`), detail panel (`role="complementary"`)
- `aria-live="polite"` region for screen reader announcements (toast messages, filter changes)
- `prefers-reduced-motion: reduce` disables all animations/transitions
- Custom tooltips (`data-tip`) on toolbar buttons replace native `title` attributes
- Keyboard navigation is fully operational without mouse

## 9. Responsive Behavior

| Breakpoint | Changes |
|------------|---------|
| ≤1200px | 2-column grid, narrower detail panel (320px) |
| ≤900px | Collapsed sidebar (60px icon-only), reduced padding, hidden column density, smaller search |
| ≤640px | Single-column grid, hidden filter pills, detail panel becomes full-width overlay |

## 10. i18n

Extend existing `MediaGalleryStrings` interface with new keys for:
- Toolbar: sort options, column density labels, view toggle labels
- Detail panel: tab names, section titles, copy confirmation, metadata labels
- Bulk bar: selection count, action labels
- Lightbox: counter format, navigation labels
- Empty states: per-filter messages
- Storage bar: label, legend items
- Context menu: action labels
- Keyboard shortcuts: descriptions

Both `en.ts` and `pt-BR.ts` must be updated.

## 11. Testing Strategy

### Unit Tests
- `resolveAssetType` — type derivation logic
- Filter/sort/search state reducer
- `highlightMatch` — search text highlighting

### Integration Tests (HAS_LOCAL_DB)
- Usage tracking: verify `trackMediaUsageAction` creates rows
- Bulk delete: verify soft-delete + restore flow
- Stats query: verify type breakdown computation
- Orphan detection: verify assets with 0 usage rows are flagged

### Component Tests (Vitest + Testing Library)
- MediaCard renders correct type badge and border color
- DetailPanel shows usage/orphan warning appropriately
- BulkActionBar appears/disappears based on selection count
- Keyboard navigation moves focus correctly
- Search result count updates live

### Visual Regression (optional, future)
- Snapshot tests for card variants (cover, avatar, inline, OG, orphan)
- Responsive layout at each breakpoint

## 12. Migration Plan

### Phase 1: Component Scaffolding
Build all new components in `_components/` alongside the current `media-library-connected.tsx`. The old component remains as fallback.

### Phase 2: Data Layer
Fix usage tracking gaps (section 6.1). Add type resolution logic. Enhance stats query.

### Phase 3: Wiring
Replace `media-library-connected.tsx` with `media-library-page.tsx`. Update `MediaGalleryModal` to use shared components.

### Phase 4: Cleanup
Remove `media-library-connected.tsx` and any dead code. Run full test suite.

## 13. Out of Scope

- Trash/restore view (server action exists, UI deferred to future sprint)
- Tag autocomplete (requires new index/query)
- Drag-to-reorder cards
- Multi-file upload queue UI (backend supports batch, UI deferred)
- Video/audio media support
- AI-generated alt text
- Image editing (crop/resize/filter) beyond the existing crop presets
