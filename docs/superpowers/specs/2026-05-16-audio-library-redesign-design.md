# Audio Library Visual Redesign — Design Spec

**Date:** 2026-05-16
**Status:** Approved (all 6 sections)
**Scope:** Pipeline > Audio Library CMS page — full visual overhaul

---

## Overview

Complete visual redesign of the Pipeline Audio Library page. The current implementation has invisible waveforms, generic cards with excessive whitespace, and underutilized metadata. This spec addresses 6 interconnected areas that together deliver a polished, information-dense audio management experience.

**Key files affected:**
- `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-library.tsx`
- `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-filters.tsx`
- `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-table.tsx`
- `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-detail.tsx`
- `apps/web/src/app/cms/(authed)/pipeline/audio/_components/waveform-mini.tsx`
- `apps/web/src/app/cms/(authed)/pipeline/audio/_components/waveform.tsx`
- `apps/web/src/app/cms/(authed)/pipeline/audio/page.tsx`
- `apps/web/src/lib/pipeline/audio-schemas.ts`

---

## Design Tokens

All components use the GEM dark theme tokens:

| Token | Value | Usage |
|-------|-------|-------|
| `--gem-surface` | `#161d2d` | Card/panel backgrounds |
| `--gem-surface-hi` | `#1a2236` | Elevated surfaces, header bg |
| `--gem-border` | `#222d40` | All borders |
| `--gem-well` | `#0c1222` | Page background, recessed areas |
| `--gem-text` | `#edf2f7` | Primary text |
| `--gem-muted` | `#7a8ba3` | Secondary text |
| `--gem-dim` | `#5a6b7f` | Tertiary text, hints |
| `--gem-accent` | `#6366f1` | Active states, selections |
| `--gem-done` | `#10b981` | Success/ready status |
| `--gem-warn` | `#f59e0b` | Pending status |
| `--gem-danger` | `#ef4444` | Destructive/error states |

**Energy color scale:**
- Level 1-2: `#22c55e` (green)
- Level 3: `#eab308` (yellow)
- Level 4: `#f97316` (orange)
- Level 5: `#ef4444` (red)

**Type base colors:**
- Music: `#a78bfa` (purple)
- SFX: `#22d3ee` (cyan)

---

## 1. Grid Cards (`AudioCardV2`)

### Layout
- Grid: `repeat(auto-fill, minmax(280px, 340px))`, gap `14px`
- Card: `border-radius: 8px`, `border: 1px solid var(--gem-border)`, `overflow: hidden`

### Structure (top to bottom)
1. **Energy bar** — 2px height, `linear-gradient(to right, var(--energy-color), transparent 70%)`
2. **Waveform hero** — 64px height, padding `8px 12px 0`, energy-tinted background gradient
3. **Card body** — padding `10px 12px 12px`

### Waveform Hero
- SVG bars: `width: 3px`, `rx: 1`, mirrored above/below centerline (y=24)
- Gradient fill: category accent color -> energy color at stop-opacity 0.5-0.6
- Default opacity 0.85, hover opacity 1.0
- Duration badge: absolute bottom-right, `font-size: 10px`, bg `rgba(12,18,34,0.8)`, `border-radius: 4px`
- Status badge (pending/retired only): absolute top-left, `font-size: 9px`

### Card Body
- **Title row:** type emoji (14px) + track name (12px, weight 600, truncated) + status dot (7px circle)
- **Artist line:** 10px, `var(--gem-dim)`, with inline category badge(s)
- **Category badge:** 9px, padding `0 5px`, `border-radius: 3px`, per-category color scheme
- **Metadata line:** flex wrap, 10px, BPM + key highlighted in `#818cf8` weight 600, energy dots (filled = energy color, empty = `var(--gem-well)`)
- **Tags:** pills 10px, padding `2px 8px`, `border-radius: 10px`

### Category Colors
| Category | Badge bg | Text | Hover accent |
|----------|----------|------|--------------|
| Cinematic | `rgba(99,102,241,0.12)` | `#818cf8` | `#7c3aed` |
| Ambient | `rgba(14,165,233,0.12)` | `#38bdf8` | `#0ea5e9` |
| Electronic | `rgba(168,85,247,0.12)` | `#c084fc` | `#a855f7` |
| Impact | `rgba(239,68,68,0.12)` | `#f87171` | `#0ea5e9` |
| Drop | `rgba(245,158,11,0.12)` | `#fbbf24` | — |
| Riser | `rgba(16,185,129,0.12)` | `#34d399` | — |

### Interaction States
- **Hover:** translateY(-2px), `box-shadow: 0 8px 24px rgba(0,0,0,0.25)`, border-color -> `var(--card-accent)`, transition 0.15s ease
- **Selected:** border 2px `var(--gem-accent)`, `box-shadow: 0 0 0 1px rgba(99,102,241,0.2)`
- **Retired:** opacity 0.55, `filter: saturate(0.3)`, neutral waveform colors

### Pending State
- Replace SVG with shimmer animation (mask-image waveform shape)
- Shimmer: `background-size: 200% 100%`, animation 2.5s infinite
- Italic text "Metadata available after download"

### Responsive
- Desktop: auto-fill minmax(280px, 340px)
- Mobile (<600px): single column `1fr`

### Accessibility
- `tabindex="0"`, `role="article"` per card
- `aria-label` includes: title, type, BPM, key, energy, status
- `aria-live="polite"` region for keyboard navigation announcements
- `@media (prefers-reduced-motion: reduce)` disables transitions + shimmer

---

## 2. Filters Sidebar

### Architecture
Three-tier sticky panel: `280px` wide, `position: sticky; top: 24px`, `max-height: calc(100vh - 8rem)`.

1. **Sticky header** (flex-shrink: 0) — search input, active filter pills, sort dropdown
2. **Scrollable body** (flex: 1, overflow-y: auto) — primary filters + advanced collapsible
3. **Advanced section** — collapsed by default, badge shows "N active" count

### Primary Filters
| Section | Type | Notes |
|---------|------|-------|
| Search | text input | `/` hotkey, tag autocomplete hint after comma |
| Active Pills | dynamic row | max 2 lines, "+N more" overflow, per-pill dismiss |
| Sort | select dropdown | Newest, BPM asc/desc, Energy asc/desc, Duration asc/desc, Name A-Z |
| Type | segmented control | All / Music / SFX with counts |
| Status | segmented control | All / Ready / Pending / Retired with counts |
| Category | multi-select chips | colored dot + count, zero-state dimming (opacity 0.35) |
| Energy | connected bar (5 segments) | click one = exact, click two = range |
| BPM | dual inputs + presets | Slow 60-90, Mid 90-130, Fast 130-180 |
| Duration | chip buttons | <30s, 30s-2m, 2-5m, >5m, Custom... |

### Advanced Filters (collapsible)
| Section | Type |
|---------|------|
| Key | 12-note piano layout + Major/Minor/Any |
| Mood | multi-select chips with counts |
| Instruments | multi-select chips with counts |

### Zero-State Behavior
- Chips with 0 count: `opacity: 0.35`, `pointer-events: none`, `aria-disabled="true"`
- Already-selected chips at 0 count: remain active (no auto-removal)

### URL Persistence
```
?type=music&energy_min=3&energy_max=5&category=cinematic&bpm_min=80&bpm_max=140
&dur=30-120&key=D&mode=major&mood=epic,dramatic&inst=strings&sort=bpm_asc&q=search+term
```
- Write debounced 300ms via `router.replace()` (no back-button pollution)
- Filter count recompute debounced 100ms
- Hydrate from URL on page load

### Responsive
| Breakpoint | Behavior |
|---|---|
| >1200px | Full 280px sidebar |
| 900-1200px | Compressed 240px, BPM preset labels hidden |
| <900px | Collapse to top bar + "Filters" button opens slide-over drawer (320px) |
| <600px | Drawer full-width, 44px touch targets |

### Accessibility
- Energy bar: `role="slider"`, `aria-valuemin="1"`, `aria-valuemax="5"`
- Multi-selects: `role="listbox"`, `aria-multiselectable="true"`
- Chips: `role="option"`, `aria-selected`, `aria-label="Cinematic, 32 tracks"`
- Active pills: `aria-live="polite"`
- Keyboard: `/` = search, arrows within rows, Space/Enter toggle, Escape close

---

## 3. Table View (`AudioLibraryTableView`)

### Columns
| Column | Width | Sortable | Notes |
|--------|-------|----------|-------|
| Checkbox | 32px | No | Bulk select |
| Waveform | 64px | No | Inline SVG 56x20px |
| Name | min 180px | Yes | Primary + secondary line (source · asset_id) |
| Type | 44px | No | Emoji in 24x24 badge |
| Category | 100px | No | Colored dot + label |
| Energy | 70px | No | 5 dots (5x5px) colored by level |
| BPM | 55px | Yes | Tabular-nums |
| Duration | 55px | Yes | mm:ss format |
| Key | 55px | No | Badge format "D maj" |
| Artist | 110px | No | Truncated |
| Status | 80px | No | Dot + label badge |

Hidden by default: Instruments, Tags, Mood, Source, Priority, Created.

### Toolbar
- Result count left, density toggle + column picker right
- Density modes: Compact (padding 5px 10px), Default (8px 10px), Comfortable (10px 10px)
- Column picker: popover 200px wide, drag-reorder handles, Name locked

### Inline Waveform
- Music: 14 bars, width 2px, gap 4px, purple gradient
- SFX: 8 bars, width 3px, spike-attack profile, cyan gradient
- Pending: flat 2px line at opacity 0.3
- Retired: bars in `var(--gem-dim)` at opacity 0.3

### Interaction States
- Row hover: bg `var(--gem-surface-hi)`, transition 0.1s
- Selected: bg `color-mix(in srgb, #6366f1 8%, #161d2d)`
- Header sort: color `var(--gem-accent)`, arrow indicator
- Column resize handle: ::after pseudo, visible on hover

### Bulk Action Bar
- Shown when any row checked
- Actions: Set Tag, Set Category, Set Status, Export JSON, Delete
- Delete requires confirmation modal + 5s undo timer
- bg: `color-mix(in srgb, var(--gem-accent) 8%, var(--gem-surface))`

### Performance
- `React.memo()` on row component
- `useMemo()` for sort computation
- Virtual scrolling at 500+ rows (10-row overscan)
- Column widths/visibility/density persisted to localStorage

### Keyboard
- j/k or arrows for navigation, Space toggles checkbox, Enter opens detail
- Shift+Click range select, Cmd+A select all, Escape deselect

---

## 4. Visual Polish & Transitions

### Page Layout
- Full-viewport, no page scroll: `height: calc(100vh - topbar_height)`
- Three-column flex: `280px filter | flex:1 content | 360px detail`
- Each zone scrolls independently

### Key Transitions
| Element | Duration | Easing |
|---------|----------|--------|
| View switch (Grid/Table) fade | 75ms + 75ms | ease-out |
| Detail panel open | 200ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Detail panel close | 150ms | ease-in-out |
| Filter panel toggle | 200ms | ease-in-out |
| Card hover lift | 150ms | ease-out |
| Card entrance stagger | index x 30ms (max 300ms) | cubic-bezier(0.34, 1.56, 0.64, 1) |

### Loading States
- **Initial:** skeleton cards with shimmer (gradient 200% background-size, 1.5s infinite)
- **Filter change:** overlay only if >300ms delay, content at opacity 0.3 + blur(2px)
- **Detail panel:** opens immediately with skeleton placeholders, data fills in

### Empty States
- **No assets:** icon + "No audio assets yet" + "Import JSON" primary button
- **No filter results:** icon + "No tracks match" + "Clear all filters" link

### Toast System
- Position: bottom-center, 24px from edge, max stack 3
- Entrance: translateY(10px) -> 0, 300ms spring
- Success: 3s auto-dismiss; Error: 5s + "Retry"; Delete: 5s with countdown undo

### Reduced Motion
- Disables: stagger animations, panel slides, shimmer, spinner rotation
- Keeps: color transitions, focus rings, state changes

---

## 5. Detail Panel

### Layout
- Width: 360px fixed (>= 900px), full-width overlay (< 900px)
- Max height: 820px
- Structure: Header (sticky) -> Waveform (sticky) -> Tabs (sticky) -> Content (scrollable)
- `border-radius: 10px`, `border: 1px solid var(--gem-border)`

### Header
- Title: 15px, weight 700
- Subtitle: 11px, `var(--gem-dim)` (artist, slug, version)
- Quick stats pills: BPM, duration, key, type, status (10px)
- Actions: Edit button + Close (x)

### Waveform
- SVG viewBox `0 0 328 72`, height 72px
- Bars: 5px wide, rx 2, spaced every 8px
- Upper bars: variable opacity 0.2-1.0
- Lower reflection: same bars from y=38, opacity 0.2-0.35
- Gradient: violet (#a78bfa) -> indigo (#6366f1) -> violet at 0.3

### Tabs
- Details | Usage | Related | Raw
- Active: weight 600, `border-bottom: 2px solid var(--gem-accent)`
- Usage tab: blue dot badge when items exist

### Details Tab Sections
| Section | Content |
|---------|---------|
| Classification | Category badge, genre, artist, source link |
| Audio | Energy (5-bar visual), BPM, Key (full name), time sig, tempo feel |
| Instruments | Interactive chip list (click-to-filter) |
| Tags | Interactive chip list (click-to-filter) |
| Mood | Interactive chip list (click-to-filter) |
| Notes | Free-text in `var(--gem-well)` box |
| Compatibility | Pairs-with (green) + Avoid-with (red) |

### Related Tab
- Top 5 similar tracks with match %
- Scoring: category +30, shared tags +5 each (max 30), same key +15, BPM ±10 +15, energy ±1 +10, shared instruments +3 each (max 15), shared mood +5 each (max 20)

### Edit Mode
- Inline editing (no modals/prompts)
- Category -> select, Tags/Mood/Instruments -> chip-input with autocomplete
- Energy -> 5-button selector, Status -> segmented control
- Save conflict (409): inline banner "Refresh & merge" / "Force save"

### Chip Interactions
- Click-to-filter: applies value as filter in sidebar without closing panel
- Hover: border -> `var(--gem-accent)`, transition 0.12s

---

## 6. Waveform Responsive System (`WaveformDisplay`)

Unified component replacing both `WaveformMini` and `Waveform`.

### Variants

| Variant | Width | Height | Bars | Bar width | Gap | Background |
|---------|-------|--------|------|-----------|-----|------------|
| card | 100% (fill) | 64px | ~32 | 4px | 2px | Energy gradient |
| table | 56px (fixed) | 20px | 14 | 2px | 1px | None |
| detail | 100% (fill) | 72px | 40-80 | 5px | 1px | Energy gradient |

All bars: `rx="2"`, SVG `preserveAspectRatio="none"` (card/detail).

### Shimmer Placeholder (peaks.length === 0)

**Card:** 15-17 bars with preset natural waveform heights (NOT random). Pulse animation: opacity 0.2 -> 0.5, 1.5s ease-in-out infinite, stagger 0.08s per bar. Fill: `color-mix(in srgb, #6366f1 15%, transparent)`.

**Table:** Single centered horizontal line (80% width, 2px height). Flat pulse animation 2s infinite.

**Detail:** 10 shimmer bars + text label "Waveform available after download" (8px, centered).

### Energy Color Tinting
- Bar gradient: `linear-gradient(to bottom, baseColor, energyColor)` with opacity 0.6 on energy stop
- Background gradient: `linear-gradient(135deg, color-mix(baseColor 10%, #0c1222), color-mix(energyColor 5-10%, #0c1222))`
- SFX: always cyan `#22d3ee`, no energy tinting

### Performance
- SVG rects only (no path/canvas)
- `React.memo()` — re-renders only on peaks/variant/energy change
- `resamplePeaks()` O(n) linear interpolation (exported, used externally)
- Gradient IDs via `useId()` (SSR-safe, no collision)
- ResizeObserver on card/detail (debounced 150ms), table exempt
- Bar count adapts: `Math.floor(containerWidth / (barWidth + gap))`

### Migration
- `WaveformMini` -> `<WaveformDisplay variant="table" />`
- `Waveform` -> `<WaveformDisplay variant="detail" />`
- New: `<WaveformDisplay variant="card" />`
- `resamplePeaks()` must remain exported

---

## Implementation Order

1. **WaveformDisplay** — unified component (foundation for cards + table + detail)
2. **Grid Cards** — AudioCardV2 with WaveformDisplay variant="card"
3. **Filters Sidebar** — two-tier architecture with URL persistence
4. **Table View** — columns, density, virtual scrolling, inline waveform
5. **Detail Panel** — tabs, metadata, edit mode, related tracks
6. **Visual Polish** — transitions, loading states, empty states, toasts

---

## Non-Goals

- Light mode (dark theme only)
- Audio playback controls (separate concern)
- Click-to-seek on waveform (future enhancement)
- Drag-and-drop reordering

---

## Dependencies

- Existing `audio-schemas.ts` types (extend, don't replace)
- `@vercel/blob` for audio file storage
- Pipeline permanent key (`PIPELINE_COWORK_KEY`) for Cowork integration
- `buildArtlistMusicUrl()` from `lib/pipeline/artlist-search.ts` (already implemented)
