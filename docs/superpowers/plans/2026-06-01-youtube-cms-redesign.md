# YouTube CMS Visual Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pixel-perfect redesign of 5 YouTube CMS screens (Observatory, AB Lab Detail, Performance, Library+Wizard, Mobile Tab Bar) with a shared motion/token engine, preserving the entire existing data layer untouched.

**Architecture:** A new CSS motion engine (`youtube-motion.css`) provides 8 keyframes, stagger system, responsive grids, and component classes scoped to `[data-cms-section="youtube"]`. Global tokens (motion, colors, breakpoints) are added to `globals.css`, while conflicting overrides stay scoped to the YouTube section. Each screen is refactored independently — existing 90 components are preserved, 36 new components are created, and 35 existing components are restyled.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, CSS custom properties, Fraunces (via `next/font/google`), Lucide React icons, Sonner toasts, `createPortal` for modals/drawers.

**Spec:** `docs/superpowers/specs/2026-06-01-youtube-cms-redesign-design.md`
**Design handoff:** `design_handoff_youtube_cms/` (HTML prototypes + 5 companion docs)

---

## Overview

**Phase 1 — Motor (sequential, ~3-4h):** Foundation layer — CSS tokens, motion system, Fraunces font, formatting helpers, component CSS classes (buttons, chips, toggles, sliders, tabs), YtPortal wrapper, accessibility utilities, YouTubeShell refactor, and build verification. All tasks are sequential because Phase 2 screens depend on the motor.

**Phase 2 — Telas (parallel, ~4-5h):** Four independent screen tracks execute in parallel — Observatory (8 tasks), AB Lab Detail (9 tasks), Performance (11 tasks), Library+Wizard (9 tasks). Each track builds new components, restyles existing ones, and assembles the final screen.

**Phase 3 — Polish (sequential, ~1-2h):** Chart adjustments, chart-utils dedup, development fixtures, feature flag wiring, accessibility audits, Definition of Done tests, and final build verification.

---

## Task Index

### Phase 1 — Motor (sequential)

| Task | Name | Files |
|------|------|-------|
| 1.1 | Global motion tokens in `globals.css` | M: `globals.css` |
| 1.2 | New color tokens in `globals.css` | M: `globals.css` |
| 1.3 | YouTube breakpoints in `globals.css` | M: `globals.css` |
| 1.4 | Create `youtube-motion.css` (keyframes, fade-in, stagger, grids) | C: `youtube-motion.css`, M: `layout.tsx` |
| 1.5 | Scoped token overrides (`data-cms-section`) | M: `youtube-motion.css`, M: `layout.tsx` |
| 1.6 | Fraunces font setup | M: `layout.tsx` |
| 1.7 | Formatting helpers + tests | C: `format.ts`, C: `format.test.ts` |
| 1.8 | Component CSS: btn, chip, seg-pill, ic-btn, card lift, affordances | M: `youtube-motion.css` |
| 1.9 | Toggle + slider CSS | M: `youtube-motion.css` |
| 1.10 | Tab CSS | M: `youtube-motion.css` |
| 1.11 | YtPortal component + test | C: `yt-portal.tsx`, C: `yt-portal.test.tsx` |
| 1.12 | onClickKeyHandler hook + test | C: `use-click-key-handler.ts`, C: test |
| 1.13 | useTabEdgeFades hook + CSS + test | C: `use-tab-edge-fades.ts`, M: `youtube-motion.css` |
| 1.14 | YouTubeShell refactor (10-item checklist) | M: `youtube-shell.tsx` |
| 1.15 | Build verification | (none — verification only) |

### Phase 2 — Telas (parallel tracks)

#### Track A — Observatory (2.1-2.8)

| Task | Name |
|------|------|
| 2.1 | Expand page.tsx queries (sparklines, heatmap, gaps, vs-you) |
| 2.2 | ChannelCard component (avatar, metrics, sparkline, shelf, open-hint) |
| 2.3 | ChannelDrawer (portal, 780px, cd-versus, cd-stats, cd-body) |
| 2.4 | VideoModal (portal, 520px, stats, compare, trend, A/B flag) |
| 2.5 | MudancasTab (filter bar, timeline, md-card, zoom modal) |
| 2.6 | OutliersTab (filter chips, legend, outlier-grid, cards) |
| 2.7 | InsightsTab (heatmap 7x24, tags, engagement, gaps) |
| 2.8 | Assembly: CompetitorDashboardV2 + feature flag |

#### Track B — AB Lab Detail (3.1-3.9)

| Task | Name |
|------|------|
| 3.1 | EarlyState components (EarlyBand, EarlyHero, EmptyChart) |
| 3.2 | isEarly dispatch in page.tsx |
| 3.3 | Gauge refactor (+size, +color, +reached) |
| 3.4 | HeroBand restyle (gauge 108px) |
| 3.5 | VariantTable + GatesPanel restyle |
| 3.6 | WinnerBanner restyle + ComoEstaAgora |
| 3.7 | PlayoffBanner restyle |
| 3.8 | Dialog migration to YtPortal |
| 3.9 | Assembly + tests |

#### Track C — Performance (4.1-4.11)

| Task | Name |
|------|------|
| 4.1 | BarList shared component |
| 4.2 | PSparkline consolidation (+niceLine) |
| 4.3 | Analytics tabs refactor (page-head, demo-switch) |
| 4.4 | Overview restyle (6 KPIs + sparklines, perf-top grid) |
| 4.5 | PerfNewChannel empty state |
| 4.6 | HealthCoach restyle (severity, impact) |
| 4.7 | Outliers restyle (list -> grid cards) |
| 4.8 | Demographics restyle (BarList) |
| 4.9 | SearchView rewrite (sort headers, affordances, toast) |
| 4.10 | NotesView component |
| 4.11 | Assembly + tests |

#### Track D — Library + Wizard (5.1-5.9)

| Task | Name |
|------|------|
| 5.1 | Longevity dots component (extract) |
| 5.2 | LongevityLegend component |
| 5.3 | lib-hover overlay |
| 5.4 | LibEmpty state |
| 5.5 | PipelinePickerDialog (portal) |
| 5.6 | Wizard step 3 pipeline button |
| 5.7 | Routing unification (toggle) |
| 5.8 | Mobile tab bar polish |
| 5.9 | Assembly + tests |

### Phase 3 — Polish (sequential)

| Task | Name |
|------|------|
| 6.1 | Chart prop adjustments (Gauge, Radar, Confidence, MultiLine) |
| 6.2 | chart-utils dedup |
| 6.3 | Development fixtures |
| 6.4 | Feature flag YT_REDESIGN_SCREENS wiring |
| 6.5 | A11y sweep (role="button", aria-sort, tabular-nums) |
| 6.6 | DoD tests (12 criteria) |
| 6.7 | Final build verification |

---

## Dependencies

```
Phase 1 (Motor) ──sequential──> Phase 2 (Telas) ──blocks──> Phase 3 (Polish)

Phase 2 (all independent, run in parallel):
  ┌── Track A: Observatory     (2.1 → 2.2 → ... → 2.8)
  ├── Track B: AB Lab Detail   (3.1 → 3.2 → ... → 3.9)
  ├── Track C: Performance     (4.1 → 4.2 → ... → 4.11)
  └── Track D: Library+Wizard  (5.1 → 5.2 → ... → 5.9)

Cross-track: NONE (tracks share only Phase 1 output)

External (not in this plan):
  Phase 0 bugs → blocks AB Lab "Retomar" button only (mitigated: disabled)
```

---

## File Map

> `C` = create, `M` = modify. Paths relative to `apps/web/src/`.

### Global + Layout (6 files)

| Op | File |
|----|------|
| M | `app/globals.css` |
| C | `app/cms/(authed)/youtube/youtube-motion.css` |
| M | `app/cms/(authed)/youtube/layout.tsx` |
| C | `app/cms/(authed)/youtube/_components/yt-portal.tsx` |
| M | `app/cms/(authed)/youtube/_components/youtube-shell.tsx` |
| C | `lib/youtube/format.ts` |

### Hooks (2 files)

| Op | File |
|----|------|
| C | `app/cms/(authed)/youtube/_hooks/use-tab-edge-fades.ts` |
| C | `app/cms/(authed)/youtube/_hooks/use-click-key-handler.ts` |

### Charts (7 files)

| Op | File |
|----|------|
| C | `app/cms/(authed)/youtube/_components/bar-list.tsx` |
| C | `app/cms/(authed)/youtube/_components/p-sparkline.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/_components/gauge.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/_components/radar-chart.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/_components/confidence-chart.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/_components/multi-line.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/_components/chart-utils.ts` |

### Observatory — 15 files

| Op | File |
|----|------|
| M | `app/cms/(authed)/youtube/competitors/page.tsx` |
| M | `app/cms/(authed)/youtube/competitors/_components/competitor-dashboard.tsx` |
| C | `app/cms/(authed)/youtube/competitors/_components/channel-card.tsx` |
| C | `app/cms/(authed)/youtube/competitors/_components/channel-drawer.tsx` |
| C | `app/cms/(authed)/youtube/competitors/_components/video-modal.tsx` |
| C | `app/cms/(authed)/youtube/competitors/_components/mudancas-tab.tsx` |
| C | `app/cms/(authed)/youtube/competitors/_components/mudancas-filter-bar.tsx` |
| C | `app/cms/(authed)/youtube/competitors/_components/change-timeline.tsx` |
| C | `app/cms/(authed)/youtube/competitors/_components/zoom-modal.tsx` |
| C | `app/cms/(authed)/youtube/competitors/_components/outliers-tab.tsx` |
| C | `app/cms/(authed)/youtube/competitors/_components/insights-tab.tsx` |
| C | `app/cms/(authed)/youtube/competitors/_components/competitor-heatmap.tsx` |
| C | `app/cms/(authed)/youtube/competitors/_components/gaps-card.tsx` |
| C | `app/cms/(authed)/youtube/competitors/_components/sparkline-chart.tsx` |
| C | `app/cms/(authed)/youtube/competitors/_components/types.ts` |

### AB Lab Detail — 13 files

| Op | File |
|----|------|
| C | `app/cms/(authed)/youtube/ab-lab/_components/early-detail.tsx` |
| C | `app/cms/(authed)/youtube/ab-lab/_components/early-band.tsx` |
| C | `app/cms/(authed)/youtube/ab-lab/_components/early-hero.tsx` |
| C | `app/cms/(authed)/youtube/ab-lab/_components/early-variant-table.tsx` |
| C | `app/cms/(authed)/youtube/ab-lab/_components/empty-chart.tsx` |
| C | `app/cms/(authed)/youtube/ab-lab/_components/como-esta-agora.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/[testId]/page.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/_components/hero-band.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/_components/variant-table.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/_components/gates-panel.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/_components/winner-banner.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/_components/playoff-banner.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/_components/settings-drawer.tsx` |

### Performance — 12 files

| Op | File |
|----|------|
| M | `app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs.tsx` |
| M | `app/cms/(authed)/youtube/analytics/_components/yt-overview.tsx` |
| M | `app/cms/(authed)/youtube/analytics/_components/yt-health-ring.tsx` |
| M | `app/cms/(authed)/youtube/analytics/_components/yt-health-coach.tsx` |
| M | `app/cms/(authed)/youtube/analytics/_components/yt-outliers-v2.tsx` |
| M | `app/cms/(authed)/youtube/analytics/_components/yt-demographics.tsx` |
| M | `app/cms/(authed)/youtube/analytics/_components/yt-search-terms.tsx` |
| M | `app/cms/(authed)/youtube/analytics/_components/yt-radar-chart.tsx` |
| M | `app/cms/(authed)/youtube/analytics/page.tsx` |
| C | `app/cms/(authed)/youtube/analytics/_components/perf-new-channel.tsx` |
| C | `app/cms/(authed)/youtube/analytics/_components/notes-view.tsx` |
| C | `app/cms/(authed)/youtube/analytics/_components/demo-switch.tsx` |

### Library + Wizard — 10 files

| Op | File |
|----|------|
| C | `app/cms/(authed)/youtube/ab-lab/_components/longevity.tsx` |
| C | `app/cms/(authed)/youtube/ab-lab/_components/longevity-legend.tsx` |
| C | `app/cms/(authed)/youtube/ab-lab/_components/lib-empty.tsx` |
| C | `app/cms/(authed)/youtube/ab-lab/_components/pipeline-picker-dialog.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/library/_components/library-dashboard.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/library/page.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/new/client.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/_components/step-variantes.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/_components/library-picker-dialog.tsx` |
| M | `app/cms/(authed)/youtube/ab-lab/_components/video-picker-dialog.tsx` |

### Fixtures + Tests — 7 files

| Op | File |
|----|------|
| C | `lib/youtube/fixtures/observatory-fixtures.ts` |
| C | `lib/youtube/fixtures/performance-fixtures.ts` |
| C | `lib/youtube/fixtures/ab-fixtures.ts` |
| C | `test/unit/youtube/format.test.ts` |
| C | `test/youtube/redesign-dod.test.ts` |
| C | `test/yt-portal.test.tsx` |
| C | `test/yt-click-key-handler.test.ts` |
| C | `test/yt-tab-edge-fades.test.ts` |

**Totals: 36 new files + 35 modified files = 71 files touched**

---

## Detailed Tasks

> Phase 1 tasks below include complete code blocks.
> Phase 2 and 3 detailed task code is in the session transcript (sub-agent outputs).
> Run with subagent-driven-development for optimal parallel execution.

<!-- Phase 1 tasks follow — produced by sub-agents with complete code blocks -->
<!-- Phase 2/3 tasks reference the design spec sections for implementation details -->
<!-- Each track (A/B/C/D) is independent and can be executed by a separate subagent -->
