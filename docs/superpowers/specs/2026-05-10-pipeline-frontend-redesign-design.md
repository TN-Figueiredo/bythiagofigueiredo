# Pipeline Frontend Redesign — Gem System

**Date:** 2026-05-10
**Status:** Approved
**Scope:** Full visual redesign of `/cms/pipeline/*` views — Overview dashboard, Kanban boards, Item detail, Collections, List, Reference

## Context

The pipeline API is complete: 19 endpoints covering items CRUD, stages, checklist, collections, bulk ops, search, stats, context/reference, and dependencies. 123 active items with hooks, synopses, collections, and enriched metadata. The frontend is functional but visually basic — a Kanban board with minimal cards that don't leverage the available data.

The old standalone `dashboard.html` had "gold level" presentation: KPI stat cards, recommendations sections, playlist progress bars, production readiness checklists, and rich item detail views. The goal is to bring that visual quality into the real CMS while adding full interactivity.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Visual direction | Dashboard DNA | Pipeline gets its own visual identity within the CMS — richer data density, format-specific colors, gem-inspired card system |
| Card density | Rich (Gem System v4) | Every card shows: format icon, code, lang, priority, staleness, title, hook preview, tags, segmented checklist, VVS ring |
| Interactivity model | Context-appropriate | Inline for quick actions (checklist, advance), modal for medium edits (tags, metadata), page for complex content (body/roteiro) |
| Architecture approach | A+C combined | Design system foundation first (gem-design.ts), then component-by-component rewrite |
| Search | Inline on Overview | Removed as separate nav item, integrated as dropdown overlay on overview page |
| State management | No global store | Server state via SSR, client state only for optimistic UI, filters via URL search params |

## 1. Gem Design System (`lib/pipeline/gem-design.ts`)

### CSS Variables

Injected via className on the pipeline layout wrapper.

**Surfaces:**
- `--gem-surface`: #161d2d (card background)
- `--gem-surface-hi`: #1a2236 (enriched card gradient start)
- `--gem-border`: #222d40 (card borders)
- `--gem-well`: #0c1222 (kanban column background)

**Text:**
- `--gem-text`: #edf2f7 (primary)
- `--gem-muted`: #7a8ba3 (secondary — hooks, descriptions)
- `--gem-dim`: #4a5568 (tertiary — counts, timestamps)
- `--gem-faint`: #2a3650 (empty states)

**Semantic:**
- `--gem-done`: #10b981 (checklist completed segments)
- `--gem-warn`: #f59e0b (aging staleness, medium priority)
- `--gem-danger`: #ef4444 (stale items, blocked, critical priority)
- `--gem-accent`: #6366f1 (default accent, overridden per priority)

### Exported Functions

```typescript
getPriorityConfig(priority: number)
→ { accent, accentDim, accentBorder, label, className }
// Maps P1-P5 to CSS var overrides. Drives entire card personality.
// P5: red, P4: amber, P3: indigo, P2: sky, P1: slate

getStaleness(updatedAt: string)
→ { days: number, tier: 'ok' | 'warn' | 'old', className }
// ok: <7d, warn: 7-21d, old: >21d

getVvsTier(score: number)
→ { tier: 'low' | 'mid' | 'high' | 'max', color, strokeDashoffset }
// low: 0-30 (red), mid: 31-60 (amber), high: 61-90 (green), max: 91-100 (indigo)
// Returns precomputed SVG stroke-dashoffset for the ring

getFormatIcon(format: Format)
→ { icon: string, bgClass: string, label: string }
// video→🎬+rgba(red), blog→✍️+rgba(blue), newsletter→📧+rgba(purple),
// course→🎓+rgba(orange), campaign→📣+rgba(pink)

getLangConfig(language: Language)
→ { label: string, className: string }
// pt-br→PT/green, en→EN/blue, both→PT+EN/indigo

getCardState(item: PipelineItem)
→ 'raw' | 'enriched' | 'graduated' | 'archived'
// enriched: has hook OR body_content
// graduated: has any *_id FK set (youtube_video_id, blog_post_id, etc.)
// archived: is_archived flag

isBlocked(item: PipelineItem)
→ { blocked: boolean, blockers: string[] }
// Checks pipeline_dependencies for hard deps. Returns blocker codes.

getChecklistProgress(checklist: ChecklistItem[])
→ { done: number, total: number, segments: boolean[] }
// Segments array drives the segmented bar UI
```

## 2. Gem Card v4 — Component Spec

### 5 Visual States

| State | Trigger | Visual Treatment |
|-------|---------|------------------|
| **Raw** | No hook AND no body_content | Flat background, "sem hook definido" in italic, lower presence |
| **Enriched** | Has hook OR body_content | Gradient background + inner glow (accent-dim at top), hook with accent-colored border-left |
| **Graduated** | Has youtube_video_id, blog_post_id, newsletter_edition_id, or campaign_id set | Green "graduated" badge in header + emerald gradient bar at card bottom |
| **Blocked** | Has hard dependency in pipeline_dependencies | Red "blocked by {code}" tag in tags row |
| **Archived** | is_archived = true | opacity: 0.45, filter: saturate(0.3), recovers to 0.65 on hover |

### Card Anatomy (top to bottom)

1. **Priority bar** — 2px gradient from accent color to transparent (75%). P1 has 25% opacity.
2. **Header row** — format icon (18px with format-specific bg color), code (monospace, accent color, 10px), lang badge (semantic: PT=green, EN=blue, PT+EN=indigo), priority badge (P1-P5 with tier color), staleness (days + semantic dot: green/amber/red). For graduated items: "graduated" badge appears before staleness (both coexist, header flex-wraps if needed).
3. **Title** — 12px, semibold, -0.01em tracking, 2-line clamp.
4. **Hook** — 10px, muted color, 2-line clamp, left border in accent color. Raw items show "sem hook definido" with dashed border.
5. **Tags** — pill badges: playlist (amber), collection (purple), topic (cyan), "+N" overflow (slate), "blocked by X" (red). No wrap, overflow hidden.
6. **Footer** — separated by 1px border-top. Left: segmented checklist bar (4px segments, done=emerald with glow shadow, undone=dark with border). Right: VVS ring (26px SVG, 4 color tiers, 8px bold label centered).

### Interactions on Card

- **Click** → navigate to `/cms/pipeline/items/[id]`
- **Hover** → `border-color: var(--gem-accent-border)`, `translateY(-1px)`, no box-shadow (depth by color staircase only)
- **Transition** → `border-color 0.12s, transform 0.12s`

## 3. Views

### 3.1 Overview Dashboard (`/cms/pipeline`)

The command center. Fetches 4 parallel queries on server:

1. `GET /api/pipeline/stats` → KPI cards
2. Recommendations: "grave a seguir" + "top prioridade" (custom queries, see below)
3. `GET /api/pipeline/collections?type=playlist` → playlist cards with progress
4. Recent items: `content_pipeline ORDER BY updated_at DESC LIMIT 5` → activity feed

**Sections (top to bottom):**

- **KPI stat cards** (4-5 columns, responsive grid): Total Pipeline, In Progress (colored by format), High Priority (P4-P5 count), Scripts Ready (roteiro stage with body), Published
- **Search** — input field at top-right, debounced 300ms, calls `/api/pipeline/search`, results as dropdown overlay grouped by entity type (pipeline, blog_posts, newsletters, collections). Min 2 chars. Click navigates to item. Esc closes.
- **Recommendations** (2-column grid):
  - "Grave a seguir" — items in stage=roteiro with body written, ordered by priority DESC, updated_at ASC. Limit 3.
  - "Top 5 prioridade ALTA" — items with priority >= 4 not in final stages (scheduled/published/sent), ordered by priority DESC then stage position ASC.
- **Playlists** (auto-fill grid, minmax 280px) — collection card with: code, name, thesis (2-line clamp), progress bar (members past "idea" stage / total members), "Próximo: {code} — {title}" (first member in earliest non-idea stage).
- **Activity feed** — recent 5 updates: dot (format color) + description + relative timestamp.

### 3.2 Format Board (`/cms/pipeline/[format]`)

Kanban with Gem Cards. Columns from `WORKFLOWS[format]`.

**Filter bar** above columns: chip filters for collection, language, priority. URL search params (`?collection=&lang=&priority=`). Back-button friendly.

**Column header:** stage name (uppercase, 10px) + count badge (right-aligned).

**Column body:** gem cards stacked vertically, 6px gap. Empty state: "Nenhum em {stage}" in faint color, centered.

### 3.3 Item Detail (`/cms/pipeline/items/[id]`)

Split layout: content area (flex: 1) | sidebar (280px).

**Content area:**
- Breadcrumb: Pipeline / {format} / {code}
- Title (editable inline — click to edit, debounced save 500ms)
- Hook (editable inline, same pattern)
- Synopsis (editable inline)
- Body content viewer (read-only, scrollable, monospace for scripts). "Editar roteiro" button → dedicated edit page.

**Sidebar (4 cards stacked):**
1. **Stage card** — current stage badge + "há X dias". Stage timeline: completed stages (emerald bg + check), current (accent), pending (dashed border). Advance/Retreat buttons.
2. **Production checklist** — toggleable checkboxes (inline server action). Each with label + done state. Segmented bar summary at bottom.
3. **Validation (VVS)** — large ring (48px) + overall score. Breakdown: has_title, has_hook, has_synopsis, has_body, has_tags, checklist_pct, in_collection, metadata_complete.
4. **Details** — format, language, priority, tags (click → modal edit), collections (click → modal manage), dependencies.

### 3.4 List View (`/cms/pipeline/list`)

Table with gem-styled rows. Columns: Code (monospace), Title (primary + secondary lang), Format (icon), Stage (badge), Priority (colored), Lang (badge), VVS (mini ring), Checklist (mini bar). Sortable headers. Cursor pagination.

### 3.5 Collections (`/cms/pipeline/collections`)

Grid of collection cards (auto-fill, minmax 280px). Each card: code (monospace), name, type badge, thesis (2-line clamp), progress bar with count, "Próximo: {code} — {title}". Click → collection detail.

### 3.6 Collection Detail (`/cms/pipeline/collections/[id]`)

Collection header with metadata. Members displayed as Gem Cards in a vertical list, ordered by position. Add/remove member controls.

### 3.7 Reference & Topics

Minor styling updates to match gem theme. Functionality unchanged.

## 4. Interaction Model

| Action | Mode | Trigger | Revalidation |
|--------|------|---------|--------------|
| Toggle checklist | Inline | Click checkbox on detail sidebar | Optimistic + revalidatePath |
| Advance/Retreat stage | Inline | Button on detail sidebar or board context menu | Optimistic + revalidatePath('/cms/pipeline') |
| Edit title/hook/synopsis | Inline | Click-to-edit on detail content area | Debounced 500ms + revalidatePath |
| Edit tags | Modal | Click tags area on detail | revalidatePath on close |
| Edit metadata | Modal | Click metadata card on detail | revalidatePath on save |
| Edit body content | Page | "Editar roteiro" → /items/[id]/edit | revalidatePath + redirect back |
| Create item | Modal | "+ Novo" button on board/overview | revalidatePath + redirect to detail |
| Archive item | Modal | Confirm dialog from detail action menu | revalidatePath + redirect to board |
| Graduate item | Modal | Button on detail (final stages only) | revalidatePath + toast with entity link |
| Manage collections | Modal | Click collection tags on detail | revalidatePath on close |
| Board filters | Inline | Filter chips above columns | URL search params (client-only) |
| Search | Inline | Input on Overview | Debounced 300ms API call, dropdown overlay |

**Conflict handling:** If optimistic locking fails (409 version mismatch), show toast "Item atualizado por outro processo. Recarregando..." and refetch. Optimistic UI reverts on server action failure.

## 5. Navigation Changes

- **Remove** Search from sidebar nav (was `/cms/pipeline/search`)
- **Remove** `search/page.tsx`
- Search integrated as inline component on Overview page
- Nav badge counts: `SELECT format, count(*) FROM content_pipeline WHERE NOT is_archived GROUP BY format`, cached 60s via unstable_cache, revalidated on mutations

## 6. File Changes

### New (8 files)
- `lib/pipeline/gem-design.ts` — design system: CSS vars + 8 utility functions
- `_components/gem-card.tsx` — ~150 LOC, Gem System v4 card
- `_components/pipeline-overview.tsx` — ~250 LOC, Overview dashboard
- `_components/pipeline-filter-bar.tsx` — ~60 LOC, chip filters for board
- `_components/pipeline-search-dropdown.tsx` — ~80 LOC, debounced search with grouped results
- `_components/gem-vvs-ring.tsx` — ~30 LOC, reusable SVG ring component
- `items/[id]/edit/page.tsx` — ~40 LOC, body content edit page (server component)
- `_components/pipeline-body-editor.tsx` — ~100 LOC, full-width editor with auto-save

### Modified (11 files)
- `_components/pipeline-board.tsx` — uses GemCard + FilterBar
- `_components/pipeline-item-detail.tsx` — split layout with sidebar cards
- `_components/pipeline-list-table.tsx` — gem-styled rows
- `_components/collection-manager.tsx` — progress bars + thesis preview
- `_components/collection-detail.tsx` — gem cards for members
- `_components/reference-editor.tsx` — minor gem theme styling
- `page.tsx` (overview) — 4 parallel queries
- `[format]/page.tsx` — enriched data fetch with memberships + deps
- `items/[id]/page.tsx` — item + history + deps + collections + validation
- `list/page.tsx` — minor data enrichment
- `cms-sections.ts` — remove Search nav item

### Removed (4 files)
- `_components/pipeline-card.tsx` → replaced by gem-card.tsx
- `_components/pipeline-overview-cards.tsx` → replaced by pipeline-overview.tsx
- `_components/search-results.tsx` → replaced by pipeline-search-dropdown.tsx
- `search/page.tsx` → search integrated into overview

**Total: 8 new + 11 modified + 4 removed = 23 files touched, ~1,200 estimated LOC**

## 7. Loading, Error & Responsive

### Loading States

All pipeline pages use skeleton shimmer (pulsing opacity 1→0.4→1 over 1.5s) matching existing CMS pattern from `globals.css`.

| View | Skeleton |
|------|----------|
| Overview KPIs | 4-5 rectangular blocks (height 80px) in grid |
| Overview recommendations | 2 cards with 3 line placeholders each |
| Overview playlists | 4-6 card outlines with bar placeholder |
| Board columns | Column headers render immediately (from WORKFLOWS constant, no fetch). Card area shows 2-3 card-shaped skeletons per column. |
| Item detail | Left: 3 text block placeholders. Right sidebar: 4 card outlines. |
| List table | Header row renders immediately. 10 row placeholders with alternating widths. |

Implementation: React Suspense boundaries per section on Overview (KPIs load independently of playlists). Board and Detail use page-level loading.tsx.

### Error States

| Scenario | Behavior |
|----------|----------|
| Page data fetch fails | Next.js error.tsx boundary: "Erro ao carregar pipeline. Tentar novamente." with retry button (router.refresh). |
| Server action fails (non-conflict) | Toast: "Erro ao salvar. Tente novamente." Optimistic UI reverts. |
| Version conflict (409) | Toast: "Item atualizado por outro processo. Recarregando..." + router.refresh. |
| Search returns 0 results | Inline: "Nenhum resultado para '{query}'" below search input. |
| Empty board column | "Nenhum em {stage}" in --gem-faint color, centered, 10px. |
| Empty overview (0 items) | Full-width card: "Pipeline vazio. Crie seu primeiro item." with "+ Novo item" button. |

### Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| >= 1280px | Full layout: 7-column kanban, split detail, 5 KPI cards |
| 1024-1279px | Kanban scrolls horizontally (columns keep 280px width). Detail sidebar stacks below content. KPI grid wraps to 3+2. |
| 768-1023px | Kanban scrolls. Detail fully stacked. KPI grid 2 columns. Playlists 2 columns. |
| < 768px | Not primary target (CMS is desktop-first) but kanban still horizontally scrollable. Single column layout everywhere else. |

## 8. Cross-Cutting Details

### CSS Variable Coexistence

The pipeline section uses its own `--gem-*` CSS variables injected via a wrapper `<div className="gem-pipeline-theme">` around the pipeline layout. This sits INSIDE the CMS shell that provides `--theme-cms-*` vars.

```
CMS Shell (--theme-cms-bg: #1A1714, warm)
  └─ Pipeline Layout (--gem-surface: #161d2d, cool)
       └─ Components use --gem-* vars
```

The pipeline's cool-toned palette is intentional (Dashboard DNA decision). CMS-level elements (sidebar, top nav) keep warm theme. Only the main content area shifts to the gem palette. Transition feels natural because the sidebar already provides visual separation.

### Recommendations — Cross-Format Logic

"Grave a seguir" adapts per format present in the pipeline:

| Format | "Next to produce" logic |
|--------|------------------------|
| Video | stage = 'roteiro' AND has body_content (script written, ready to record) |
| Blog | stage = 'draft' AND has body_content (draft written, ready to review) |
| Newsletter | stage = 'draft' AND has body_content |
| Course | stage = 'outline' AND has body_content (outline done, ready for modules) |
| Campaign | stage = 'draft' AND has body_content |

The Overview shows recommendations merged across formats, with format icon on each item for disambiguation. "Top prioridade ALTA" is already format-agnostic (priority >= 4, not in final stages).

### Activity Feed Data Source

Source: `content_pipeline_history` table (populated by the `pipeline_record_stage_change` trigger + manual history entries from server actions).

```sql
SELECT h.*, p.code, p.title_pt, p.title_en, p.format
FROM content_pipeline_history h
JOIN content_pipeline p ON p.id = h.pipeline_id
WHERE p.site_id = $siteId
ORDER BY h.changed_at DESC
LIMIT 5
```

Display: format dot (color) + "{code} {event_type_label}" + relative time. Event types: stage_change ("moveu para {stage}"), created, archived, restored, graduated.

### Graduated + Staleness Overlap

Fix: graduated badge does NOT replace staleness. Both coexist. Header layout:

```
[🎬] ie8  [PT+EN]  [P3]  [graduated]  [●12d]
```

If card width is constrained, staleness wraps to line below graduated badge (flex-wrap on header).

### Tag Overflow Rule

Show max 3 tags. If item has more, the 3rd slot becomes "+N" badge. Priority order:
1. Playlist tag (always shown first if exists)
2. First topic tag
3. "+N" or second topic tag

### Edit Page (`/cms/pipeline/items/[id]/edit`)

Dedicated page for body_content editing. Full-width textarea/editor, no sidebar distraction.

**Layout:**
- Top bar: breadcrumb (Pipeline / {format} / {code} / Edit) + "Salvar" button + "Cancelar" link
- Editor area: full-width textarea, monospace font for scripts, min-height 60vh
- Auto-save indicator: "Salvo" / "Salvando..." / "Erro ao salvar"

**Behavior:**
- Auto-save with debounce (2000ms) via `updatePipelineItem(id, version, { body_content })`
- Manual save button for explicit control
- "Cancelar" returns to detail page without saving pending changes
- Optimistic locking: version tracked, 409 conflict shows merge dialog or force-save option

### Toast Notifications

Uses existing CMS toast system (if available) or a minimal implementation:
- Position: bottom-right, stacked
- Duration: 4s (auto-dismiss), persistent for errors
- Variants: success (emerald left border), error (red left border), info (indigo left border)
- No custom component needed if CMS already has `<Toaster>` — check existing patterns first

## 9. Visual References

Mockups saved in `.superpowers/brainstorm/70984-1778434852/content/`:
- `05-rich-card-v4-gem.html` — definitive Gem Card v4 with all 5 states + kanban preview
- `07-architecture-v2.html` — complete architecture map with data flows, interaction matrix, file tree
