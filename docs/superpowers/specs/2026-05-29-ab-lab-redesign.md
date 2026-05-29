---
title: A/B Lab Redesign -- Design Spec
date: 2026-05-29
status: approved
author: Claude Opus + Thiago Figueiredo
---

# A/B Lab Redesign -- Design Spec

## Table of Contents

- [1. Overview](#1-overview)
- [2. Foundation Layer](#2-foundation-layer)
  - [2.1 Design Tokens](#21-design-tokens)
  - [2.2 Type System](#22-type-system)
  - [2.3 Shared Primitives](#23-shared-primitives)
  - [2.4 Chart Utilities](#24-chart-utilities)
  - [2.5 Architecture Changes](#25-architecture-changes)
  - [2.6 Animations](#26-animations)
- [3. Charts (10 Components)](#3-charts-10-components)
  - [3.1 ConfidenceChart](#31-confidencechart)
  - [3.2 MultiLine](#32-multiline)
  - [3.3 Gauge](#33-gauge)
  - [3.4 CredibleInterval](#34-credibleinterval)
  - [3.5 RankBars](#35-rankbars)
  - [3.6 RadarChart](#36-radarchart)
  - [3.7 ABBATimeline](#37-abbatimeline)
  - [3.8 FunnelRow](#38-funnelrow)
  - [3.9 BayesCurves](#39-bayescurves)
  - [3.10 Dots](#310-dots)
- [4. Dashboard + Settings](#4-dashboard--settings)
  - [4.1 New Types](#41-new-types)
  - [4.2 Dashboard Components (8)](#42-dashboard-components-8)
  - [4.3 Settings Drawer](#43-settings-drawer)
  - [4.4 Responsive (4 breakpoints)](#44-responsive-4-breakpoints)
- [5. Detail Views](#5-detail-views)
  - [5.1 Type System](#51-type-system)
  - [5.2 Shared Components](#52-shared-components)
  - [5.3 Active Detail](#53-active-detail)
  - [5.4 Winner Detail](#54-winner-detail)
  - [5.5 Playoff Detail](#55-playoff-detail)
- [6. Wizard + ClickMoment](#6-wizard--clickmoment)
  - [6.1 Wizard Shell](#61-wizard-shell)
  - [6.2 Five Steps](#62-five-steps)
  - [6.3 Adapters](#63-adapters)
  - [6.4 ClickMoment Module](#64-clickmoment-module)
- [7. Test Matrix (~330 scenarios)](#7-test-matrix-330-scenarios)
- [8. Migration Plan](#8-migration-plan)
  - [8.1 Foundation (Layer 1)](#81-foundation-layer-1)
  - [8.2 Charts (Layer 2)](#82-charts-layer-2)
  - [8.3 Dashboard + Settings (Layer 3)](#83-dashboard--settings-layer-3)
  - [8.4 Detail (Layer 4)](#84-detail-layer-4)
  - [8.5 Wizard + ClickMoment (Layer 5)](#85-wizard--clickmoment-layer-5)
  - [8.6 Total Estimates](#86-total-estimates)
- [9. Visual Mockups](#9-visual-mockups)
- [10. Next Steps](#10-next-steps)

---

## 1. Overview

The A/B Lab is a YouTube A/B testing tool embedded in the CMS. It lets creators run controlled experiments on thumbnails, titles, descriptions, and combos, then analyze statistical results to pick winners.

**This redesign covers:** Dashboard (list view), Detail page (3 states: active, winner, playoff), Wizard (5 steps), Settings drawer, ClickMoment interaction, and 10 chart components.

**Design principles:**
- **Result first** -- surface outcomes and actionable data before raw numbers.
- **Actionable density** -- every pixel earns its place; no decorative chrome.
- **Teaches in context** -- tooltips and hints explain statistical concepts (CTR, P-best, burn-in) where they appear.

**Approach: Evolve & Replace** -- layer-by-layer migration over the existing UI, zero downtime. Each layer is independently shippable.

**Implementation order:** Foundation -> Charts -> Dashboard + Settings -> Detail -> Wizard + ClickMoment

**Language:** English UI. Technical terms kept as-is (CTR, P-best, burn-in).

---

## 2. Foundation Layer

### 2.1 Design Tokens

4 new CSS custom properties added to `globals.css`:

| Token | Dark | Light | Notes |
|---|---|---|---|
| `--cms-bg-side` | `#100E0B` | `#EDE5D5` | bg only |
| `--cms-surface-3` | `#262219` | `#E8DFC9` | bg only |
| `--cms-cowork` | `#6E63F2` | `#5B4FD9` | 5.1:1 on #140f08 |
| `--cms-cowork-subtle` | `rgba(110,99,242,.15)` | `rgba(91,79,217,.10)` | bg only |

Global rules: card radius `rounded-xl` (10px), minimum touch target 44x44px, `@media (prefers-reduced-motion: reduce)` disables all AB Lab animations (scoped to `.ab-lab`).

### 2.2 Type System

DB stores `'original'|'B'|'C'|'D'`. UI displays `'A'|'B'|'C'|'D'`. These are different domains.

```typescript
// ab-constants.ts -- server-safe, no 'use client'
import type { TestType } from '@/lib/youtube/ab-types'
export type { TestType } from '@/lib/youtube/ab-types'

export type DisplayLabel = 'A' | 'B' | 'C' | 'D'

export const VARIANT_COLORS = {
  A: '#8A8F98', B: '#E8823C', C: '#3FA9C0', D: '#A77CE8',
} as const satisfies Record<DisplayLabel, string>

export function toDisplayLabel(dbLabel: string, isOriginal?: boolean): DisplayLabel
export function variantColor(dbLabel: string, isOriginal?: boolean): string
```

`TYPE_META` maps each `TestType` to `{ icon: LucideIcon; label: string; hint: string }` with compile-time Lucide icon name validation via `keyof typeof icons`.

**Chart variant type hierarchy** (in `ab-types.ts`):

```typescript
export interface ChartVariant { label: DisplayLabel; color: string }
export interface StatsVariant extends ChartVariant { ctr: number; impressions: number }
export interface RankedVariant extends ChartVariant { pBest: number; pTop2: number }
export interface FullChartVariant extends StatsVariant, RankedVariant {
  clicks: number; linkClicks?: number; linkCtr?: number; retention?: number
}
```

**Wizard config** (in wizard shell):

```typescript
interface WizardConfig {
  duration: number       // 7-28 days
  confidence: number     // 80-99 (integer %, stored as 0.xx in DB)
  autoApply: boolean
  burnIn: number         // 0-3 days
  rotation: 'abba' | 'round_robin' | 'random'  // matches DB enum
  playoff: boolean
}
```

**Formatters** (all accept `null | undefined | NaN` → return `'—'`):

```typescript
export function formatNumber(n: number | null | undefined): string    // Intl.NumberFormat('pt-BR')
export function formatPercent(n: number | null, decimals?: number): string  // toFixed + '%'
export function formatDate(d: string | Date | null): string           // Intl.DateTimeFormat('en')
export function formatCompact(n: number | null): string               // <1k as-is, <1M→x.xk, <1B→x.xM
```

### 2.3 Shared Primitives

12 components in `ab-primitives.tsx` (`'use client'`). Barrel exported via `_components/index.ts`.

| Component | Role | Key A11y |
|---|---|---|
| **VChip** | Variant identity chip (colored square with letter) | `aria-label="Variant {label}"`, `role="button"` when clickable |
| **Badge** | Status pill (6 tones: neutral, accent, green, amber, cowork, live) | Informational, color supplemented by text |
| **InfoTip** | `?` trigger with tooltip | `role="tooltip"`, `aria-describedby`, Escape closes, hoverable (WCAG 1.4.13) |
| **TypeBadge** | Test type indicator wrapping Badge + Lucide icon | Purely informational |
| **Seg** | Segmented control (generic `<T extends string>`) | `role="radiogroup"`, roving tabindex, arrow key cycling |
| **Toggle** | Boolean switch | `role="switch"`, `aria-checked`, Space/Enter toggles |
| **NumberField** | Stepper with +/- buttons | `role="spinbutton"`, `aria-valuenow/min/max/text`, Up/Down arrows |
| **CheckRow** | Checkbox with label and hint | Native `<input type="checkbox">` inside `<label>` (not `<button>`) |
| **Slider** | Range input with display value | Native `<input type="range">`, `aria-valuetext` |
| **CfgRow** | Settings row (label left, control right) | `htmlFor`/`aria-labelledby` wiring to child control |
| **SectionLabel** | Section header with optional right content | Semantic heading via `as` prop (`h2`/`h3`/`h4`/`div`) |
| **Legend** | Color swatch + label list for charts | Decorative swatches |

### 2.4 Chart Utilities

`chart-utils.ts` (server-safe):

```typescript
export const CHART = {
  W: 620, H: 200,
  padL: 34, padR: 14, padT: 18, padB: 26,
  font: 'JetBrains Mono, monospace',
  gridStroke: 'rgba(245,239,230,0.06)',
  axisColor: 'var(--cms-text-dim)',
  easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
} as const
```

| Function/Component | Purpose | Guards |
|---|---|---|
| `toX(i, total, cfg?)` | Index -> X position | `total <= 1` -> return `padL` |
| `toY(value, min, max, cfg?)` | Value -> Y position (inverted) | `min === max` -> center |
| `niceLine(pts)` | Catmull-Rom to cubic Bezier SVG path | 0 pts -> `""`, NaN/Infinity filtered |
| `GridLines` | Horizontal grid lines + Y-axis labels | SVG element, no state |
| `XLabels` | X-axis labels | SVG element, no state |
| `GradientDef` | SVG `<linearGradient>` definition | Configurable opacity |
| `EndDot` | Endpoint dot (green when `reached`) | Inner r=5, outer r=9 at 0.4 opacity |

### 2.5 Architecture Changes

- **Split `actions.ts`:** Mutations stay (`'use server'`). Reads move to `queries.ts` (no directive). `fetchAbBriefingData` and `fetchAbTestVariants` stay in `actions.ts` (called from client via `startTransition`).
- **Barrel export:** `_components/index.ts` re-exports `ab-constants`, `ab-primitives`, `chart-utils`.
- **Zod validation:** New `ab-schemas.ts` with `AbTestConfigSchema`, `AbTestSiteSettingsSchema`, `createAbTestSchema`, `updateSettingsSchema`.
- **Dedupe `normalCdf`:** Delete local copy from `ab-test-detail.tsx`, import from `ab-statistics.ts`.
- **Extract wizard steps:** `ab-create-wizard.tsx` (1312 LOC) splits into `step-tipo.tsx` (~120), `step-variantes.tsx` (~250), `step-config.tsx` (~150), `step-revisar.tsx` (~80). Shell retains ~712 LOC.

### 2.6 Animations

4 keyframes in `globals.css`:

| Keyframe | Effect |
|---|---|
| `ab-fade-up` | `opacity:0 + translateY(8px)` -> visible |
| `ab-fade-only` | `opacity:0` -> `opacity:1` (backdrop overlay) |
| `ab-slot-pulse` | `opacity 1 -> 0.5 -> 1` (live badge dot) |
| `ab-drawer-in` | `translateX(100%)` -> `translateX(0)` |

Transition catalogue: Seg buttons (0.15s ease), Toggle track/knob (0.2s ease), CheckRow checkbox (0.15s ease), Card hover (0.18s ease), bar animations (0.6s cubic-bezier), Gauge arc (0.8s cubic-bezier), chevron rotate (0.2s ease).

**Reduced motion:** Blanket rule scoped to `.ab-lab` sets `animation-duration` and `transition-duration` to `0.01ms`. **Exit animations:** None -- all drawers/tooltips/modals use instant removal.

---

## 3. Charts (10 Components)

### 3.1 ConfidenceChart

Catmull-Rom spline (`niceLine`) plotting daily confidence 0-100% with gradient area fill beneath. Dashed green target line (default 95%). `EndDot` turns green when last value >= target.

```typescript
interface ConfidenceChartProps {
  data: number[]
  target?: number    // default 95
  height?: number    // default 200
  accent?: string    // default var(--cms-accent)
}
```

SVG viewBox `0 0 620 H`. Area: `GradientDef` topOpacity 0.28 to 0. Invisible `<rect>` hitboxes per point trigger tooltip ("Day N: X%"). Entry: stroke-dashoffset path-length to 0, 0.8s. Edge: empty shows placeholder, 1 point renders dot only, filters NaN/null.

### 3.2 MultiLine

Replaces `ab-daily-ctr-chart`. Overlaid Catmull-Rom lines keyed by `DisplayLabel`, one per variant with distinct colors.

```typescript
interface MultiLineProps {
  series: Record<DisplayLabel, number[]>
  colors: Record<DisplayLabel, string>
  height?: number    // default 220
  unit?: string      // Y suffix, default "%"
  labels?: string[]  // X labels
}
```

Y auto-scales with 0.6 padding. Vertical dashed crosshair at hovered X showing all variant values. End dots r=3.4. Entry: stroke-dashoffset 0.8s, staggered 100ms per series. Edge: different-length series use shortest common; NaN breaks path via `moveTo`.

### 3.3 Gauge

Radial arc with centered text overlay showing confidence percentage.

```typescript
interface GaugeProps {
  value: number    // 0-100
  target?: number  // default 95
  size?: number    // default 132
  color?: string   // default var(--cms-accent)
}
```

Track circle strokeWidth 8. Arc uses `strokeDasharray: C*frac C`. Tick mark at target angle. Arc turns `--cms-green` when value >= target. Overlay: JetBrains Mono 700 24px value + 8px "confidence" eyebrow. Entry: dasharray 0 to target, 0.8s. A11y: `role="meter"` with `aria-valuenow/min/max`. Edge: NaN becomes 0, clamp to 0-100.

### 3.4 CredibleInterval

Horizontal 95% CI bands with mean dot per variant. Frequentist approximation: `sd = sqrt(p*(1-p)/n)`, bounds at +/-1.96*sd.

```typescript
interface CredibleIntervalProps {
  variants: StatsVariant[]
  leader?: DisplayLabel
}
```

CSS layout (not SVG). Band: `linear-gradient(90deg, color33, color55, color33)` with 1px border. Mean dot W:11 H:11 with box-shadow halo. VChip with ring for leader. Entry: bands expand from center, 0.6s. Edge: sd=0 or n=0 skips row; single variant renders one row.

### 3.5 RankBars

Horizontal bars showing P(best) or P(top-2) probability per variant, sorted descending.

```typescript
interface RankBarsProps {
  variants: RankedVariant[]
  metric?: 'pBest' | 'pTop2'  // default 'pBest'
}
```

Fill: `linear-gradient(90deg, colorcc, color)`. Width transitions 0.6s. Entry: width 0 to target. Edge: 0% gets min 2px, values clamped to 100.

### 3.6 RadarChart

Spider/radar with 5 axes (CTR, Retention, Link CTR, Win prob, Reach). One polygon per variant, filled at 0.13 opacity.

```typescript
interface RadarChartProps {
  variants: FullChartVariant[]
  axes?: { key: string; label: string }[]
  size?: number  // default 280
}
```

4 grid polygon rings at 0.25/0.5/0.75/1.0. Per-axis normalization: `frac = value / axisMax`. Vertices get r=2.6 dots. Entry: polygons scale from center 0 to 1, 0.6s. Edge: <2 axes renders nothing; axisMax=0 maps to center.

### 3.7 ABBATimeline

Replaces `ab-rotation-timeline`. Colored blocks in flex row showing ABBA rotation sequence with letter labels.

```typescript
interface ABBATimelineProps {
  seq: DisplayLabel[]
  total: number; done: number
  colors: Record<string, string>
  nextVariant?: DisplayLabel; nextIn?: string
}
```

Done blocks: full color with dark text. Pending: `--cms-surface-hover` at 0.4 opacity. Next: dashed accent border. Footer: "N/M ABBA cycles completed" + "next rotation in...". No entry animation. Edge: 50+ blocks enable horizontal scroll with 24px min-width.

### 3.8 FunnelRow

3-stage horizontal funnel per variant: Impressions (100%), Views/CTR, Link clicks.

```typescript
interface FunnelRowProps {
  variant: { impressions: number; clicks: number; linkClicks?: number; color: string }
}
```

Bar height 14px, borderRadius 4. Fill width: `max(3, min(100, pct))%`. Entry: bars grow from 0, 0.4s. Edge: 0 impressions shows min 3px bars; undefined linkClicks hides stage 3.

### 3.9 BayesCurves

Gaussian PDF curves showing posterior CTR distributions. Full normalization: `g(x) = (1/(sd*sqrt(2*PI))) * exp(-0.5*((x-mean)/sd)^2)`, globally normalized so tallest curve fills chart height (high-impression variants peak taller).

```typescript
interface BayesCurvesProps {
  variants: StatsVariant[]
  height?: number  // default 200
}
```

90 sample points per curve. Per-curve `GradientDef` fill (topOpacity 0.22). Dashed vertical mean line + peak label. Entry: fade in + scaleY from 0, 0.6s. Edge: sd<=0 or n=0 or p in {0,1} skips variant entirely; `hi-lo < 1e-10` adds epsilon guard.

### 3.10 Dots

Minimal progress indicator: filled/unfilled circles.

```typescript
interface DotsProps { total: number; done: number; color?: string }
```

Flex row, gap 4. Each dot W:7 H:7 borderRadius 99. Done: bg color. Undone: `--cms-surface-3`. A11y: `role="meter"` with aria-value attributes. No animation. Edge: total=0 renders nothing; done>total clamps.

### Shared Chart Patterns

**Tooltip pattern.** Used by ConfidenceChart, MultiLine, BayesCurves. State: `useState<number|null>(null)`. Invisible `<rect>` hitboxes per data point, full chart height. Tooltip `<g>`: bg rect with rx=6, `--cms-surface-3`, feDropShadow filter. Clamped to chart bounds. Crosshair (MultiLine only): dashed vertical line. `aria-hidden="true"` on tooltip -- data lives in sr-only table.

**Entry animation pattern.** All use `cubic-bezier(0.2, 0.7, 0.2, 1)`. Technique: `useEffect` sets `mounted=true`, CSS transitions from initial to target. Line charts: stroke-dashoffset. Bars: width 0 to value. Polygons/curves: scale/fade. `prefers-reduced-motion: reduce` skips all animations, mounting with final values directly.

**sr-only data table.** All SVG charts with hover tooltips include a visually hidden `<table className="sr-only">` after the SVG containing all data points in tabular form. Screen readers and keyboard users access data cell-by-cell. Follows W3C accessible SVG chart pattern.

**Chart migration plan.** Replace 3: `ab-confidence-trend.tsx` (175 LOC) becomes `confidence-chart.tsx`, `ab-daily-ctr-chart.tsx` (140 LOC) becomes `multi-line.tsx`, `ab-rotation-timeline.tsx` (127 LOC) becomes `abba-timeline.tsx`. Create 7: `gauge.tsx`, `credible-interval.tsx`, `rank-bars.tsx`, `radar-chart.tsx`, `funnel-row.tsx`, `bayes-curves.tsx`, `dots.tsx`. Keep 1: `variant-heatmap-table.tsx` (update color imports only). All charts import from `chart-utils.ts` + `ab-constants.ts`. Total: ~1400-1700 new LOC + ~200 LOC tests (68 scenarios).

---

## 4. Dashboard + Settings

### 4.1 New Types

Add to `lib/youtube/ab-types.ts`:

```ts
export interface DashboardStats {
  activeTests: number
  avgConfidence: number     // 0-100
  winRate: number           // 0-100, completed tests with winner
  avgLift: number           // avg CTR lift % across winners
}

export interface AbTestDraft {
  id: string
  videoTitle: string
  flag: string
  type: TestType
  step: number              // wizard step 0-4
  createdAgo: string        // "yesterday", "2 days ago"
  thumbnailUrl: string | null
}

export interface SuggestedVideo {
  videoId: string; title: string; flag: string
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  ctr: number; channelMedianCtr: number; impressions: number
  reason: string; suggest: TestType; confidence: number
  thumbBg?: string; overlay?: string
}

export interface LearningsTag {
  tag: string; wins: number; avgLift: number
  kind: 'thumb' | 'title'; negative?: boolean
}

export interface LearningsData {
  testsRun: number; tags: LearningsTag[]
  cumulativeMonthly: number   // estimated extra clicks/month
}

export interface EligibleVideo {
  id: string; title: string; thumbnailUrl: string | null
  durationSeconds: number; channelHandle: string
  hasActiveTest: boolean; previousLift: number | null
  sourcePipelineId: string | null
}

export interface AbTestCardView {
  id: string; videoTitle: string; flag: string
  type: TestType; status: AbTestStatus
  leader: DisplayLabel; leaderColor: string; leaderPBest: number
  confidence: number; confidenceTarget: number
  lift: number                     // ((leaderCtr - baselineCtr) / baselineCtr) * 100
  dayOf: number; maxDurationDays: number
  nextRotationIn: string; nextVariant: DisplayLabel
  roundNumber: number; totalRounds: number; hasPlayoff: boolean
  variants: { label: DisplayLabel; color: string; thumbnailUrl: string | null; is_original: boolean }[]
  confTrend?: number[]
}
```

**Computed field helpers** (add to `queries.ts`):

| Helper | Signature | Notes |
|--------|-----------|-------|
| `toCardView` | `(test: AbTestWithVariants) => AbTestCardView` | Maps raw test to display-ready shape; all computation server-side |
| `toLatestDraft` | `(drafts: AbTestWithVariants[]) => AbTestDraft \| null` | Picks most recent by `created_at`, returns null if empty |
| `computeDashboardStats` | `(active, completed) => DashboardStats` | Averages across arrays; 0 tests = all zeros |
| `getLearnings` | `async (siteId) => LearningsData \| null` | Aggregates tag wins from completed tests; null when <3 completed |
| `getSuggestedVideos` | `async (siteId) => SuggestedVideo[]` | Queries videos below channel median CTR; max 5 results |

page.tsx transforms raw data before passing to the client shell -- client components are pure renderers with no business logic.

### 4.2 Dashboard Components (8)

All `'use client'`, inside `_components/`. Root shell has `className="animate-ab-fade-up"`.

**Layout:** Header > KPI Strip > DraftsBlock > Active Tests > Completed + Learnings. When `active.length === 0 && !draft`, render EmptyState instead.

| Component | Props | Behavior |
|-----------|-------|----------|
| **KPI** | `label, value, suffix?, delta?, spark?, color?, icon?` | Card with JetBrains Mono 700 30px value, optional sparkline (SVG 120x28, absolute bottom-right, `aria-hidden`), optional delta with TrendingUp/Down icon. Strip: 4-col grid (Active tests, Avg confidence w/ sparkline, Win rate w/ delta, Avg CTR lift). |
| **ActiveTestCard** | `test: AbTestCardView, onOpen` | `<article>` card, clickable (tabIndex=0, Enter/Space). Badge row (TypeBadge + live day counter + optional playoff round). Title 2-line clamp. Mini thumbnails grid (leader gets accent outline). Footer: 3-stat grid (confidence, leader VChip+lift, next rotation) on `--cms-bg-side`. |
| **CompletedRow** | `test: AbTestWithVariants, onOpen` | `<Link>` row with hover bg (CSS-only). 78px thumbnail, ellipsis title, TypeBadge. Right: winner = VChip + green lift + confidence; inconclusive = amber badge. Completed section in Card with "view all" link, grid alongside Learnings at `1.4fr 1fr`. |
| **DraftsBlock** | `draft: AbTestDraft, onContinue` | Collapsible Card (default open). `<button>` trigger with `aria-expanded`, chevron rotates -90deg when closed. Body: 86px thumbnail, title, "Stopped at step N of 5", "Continue setup" primary button. |
| **LearningsPanel** | `learnings: LearningsData` | Card with Sparkles icon header. Tag list: text + 5 win bars (`role="meter"`) + avgLift (green/red). Negative tags: strikethrough + red bars. 20+ tags: "Show N more" expand. Insight box from top positive+negative tags. Empty: "Complete 3+ tests" message. |
| **EmptyState** | `suggested: SuggestedVideo[], onCreate` | 3 tiers: (1) 3+ suggestions = hero + 3-col SuggestedCards, (2) 1-2 = hero + auto-fit grid, (3) 0 = simplified hero + single CTA. Hero: gradient bg, Beaker watermark, Badge "Suggested by Intelligence Engine". |
| **SuggestedCard** | `video: SuggestedVideo, onCreate` | Card with 16:9 thumbnail area, grade overlay pill (D=red, C=amber, B+=green), JetBrains Mono grade text. Body: title, 3 mini stats (current CTR, channel median, impressions), reason box with Info icon, primary CTA "Test {type}". |
| **Dashboard (shell)** | `DashboardProps` | Header (h2 "A/B Lab", subtitle, quota Badge, Filter/Settings/New Test buttons). Orchestrates conditional rendering of all sub-components. |

### 4.3 Settings Drawer

Slide-over panel evolving `ab-settings-panel.tsx` to `settings-drawer.tsx`.

**Panel:** `role="dialog" aria-modal="true"`, W: `min(440px, 100%)`, fixed right, z-index 95. Backdrop: `rgba(6,5,4,0.55)` + blur(3px). Entry: `ab-drawer-in 0.28s cubic-bezier(0.2,0.7,0.2,1)`. No exit animation.

**3 sections:**

1. **Automation** (SecHead icon=Zap)
   - "Pause on CTR drop" toggle -- when ON reveals sub-fields (borderLeft 2px accent, `animate-ab-fade-up`): drop threshold NumberField (5-60%, default 20), consecutive days NumberField (1-14d, default 7).
   - "Auto-test after publish" toggle -- when ON reveals: delay NumberField (0-168h, default 48), CheckRow "Only if pipeline has alternative thumbs".

2. **Defaults** (SecHead icon=Beaker)
   - Max duration `<select>` (7/14/21/28 days), confidence target Slider (80-99%), auto-apply winner Toggle, burn-in NumberField (0-5d).

3. **Notifications** (SecHead icon=Mail)
   - 4 CheckRows: test completed (default on), test auto-paused (default on), CTR drop alert (conditionally **disabled** when "Pause on CTR drop" is off, with hint text), daily digest (default off).

**Auto-save:** Local state mirrors props on mount. 500ms debounced `useEffect` computes diff, calls `onSave(changedFields)` via `useTransition`. Footer states: idle (check + "Saved automatically"), saving (spinner), error (revert to last good state + "Failed to save" + retry button). Footer text in `<span role="status" aria-live="polite">`.

**Focus trap:** On open, focus moves to close button. Tab cycles within panel (first=close X, last=footer Close). Shift+Tab wraps backward. Escape closes. On close, focus returns to trigger button. Settings prop null renders skeleton.

### 4.4 Responsive (4 breakpoints)

| Breakpoint | Dashboard | Settings |
|------------|-----------|----------|
| >=1024px | KPI 4-col, active 2-col, completed+learnings `1.4fr 1fr`, suggested 3-col | W:440px slide-over |
| <=1024px | KPI 2-col, active 1-col, completed stacks above learnings full-width | W:440px |
| <=760px | Header wraps (buttons below title, "New test" full-width), suggested 1-col, padding 16px | W:100%, borderLeft:none, close button 44x44, padding 16px |
| <=620px | KPI 1-col (sparklines hidden), all single-column, ActiveTestCard footer stats overflow-x auto, DraftsBlock thumbnail 60px | W:100%, reduced padding |

---

## 5. Detail Views

### 5.1 Type System

`AbTestDetailView` is a discriminated union: `AbTestActiveView | AbTestWinnerView | AbTestPlayoffView`. All extend `AbTestBaseView` (id, videoTitle, flag, type, status, variants, variantThumbs, confTrend, daily, abbaSeq, cycles, durationDays).

**Two-level narrowing dispatch:** first check `view.status === 'active'` (returns ActiveDetail), then `view.outcome === 'winner'` (WinnerDetail) or default (PlayoffDetail). ActiveView declares `outcome?: never` so TS narrows correctly after the first branch.

**GateStatus** (`ab-gates.ts`): shared pure function `computeGates(input: GateInput): GateResult[]` used by both `ab-evaluate` cron and `toDetailView()`. Six gates: confidence, impressions/var, duration, cycles, burn-in, stability. No DB storage needed -- recomputed on read.

**LiveMonitor** is optional on `AbTestWinnerView` (`monitor?: LiveMonitor`). Phase 1: always undefined (section hidden). Phase 2: post-completion monitoring cron populates it.

**Field name mappings:** `rotation_pattern` uses DB enum values (`'abba' | 'round_robin' | 'random'`, not `'sequential'`). `confidenceTarget` maps from `confidence_threshold`. `durationDays` maps from `max_duration_days`. `hasPlayoff` computed from `!!playoff_test_id`. `totalRounds` derived from parent/playoff relationship. `daily` maps cycles by variant_id to `Record<DisplayLabel, number[]>`.

### 5.2 Shared Components

**DetailHeader** -- breadcrumb back link ("A/B Lab"), title with flag, badge row (TypeBadge, round counter if multi-round, state-specific status badge). Right side: signal toggle (confirmed/live Seg + InfoTip) for active only; Duplicate/Archive/Download actions for completed states.

**VariantTable** -- 6-column grid: thumb | variant | CTR | vs A | chance to win (bar) | expand chevron. Sorted by metric desc (`pBest` default, `pTop2` for playoff). Leader row tinted with variant color. Expandable rows (one at a time) reveal impressions, clicks, link CTR, retention, and AI briefing with tags. `role="table"` semantics; rows have `tabIndex={0}`, Enter/Space toggles `aria-expanded`.

**GatesPanel** -- 2x3 grid of 6 resolution criteria. Each gate shows pass (green check) or pending (clock icon) with value and optional hint. Header counter: "{n}/6 passed" (green when all pass).

**H** (section heading) -- flex row: icon (17px accent) + h3 (Fraunces 19px 600) + optional InfoTip + optional sub text. Right slot for legends or controls.

### 5.3 Active Detail

Ten sections in order:

1. **DetailHeader** with signal toggle (confirmed/live)
2. **LockCountdown** -- lock icon, "Test locked" message, progress bar (dayOf/durationDays), countdown (estimated days remaining via `(target - confidence) / 2.5`), cycles left
3. **HeroBand** -- 4-cell grid: confidence Gauge, current leader VChip, CTR lift (green), trend indicator (up/flat/down). Responsive: 2x2 at 1024px, 1-col at 760px
4. **Variant Scoreboard** -- H heading + VariantTable (pBest metric)
5. **Confidence + Radar** -- 1fr 1fr grid: ConfidenceChart (confTrend + target line) and RadarChart (variant X-ray)
6. **CTR Range + Win Probability** -- Card with CredibleInterval (left 1.2fr) and RankBars pBest (right 1fr)
7. **Daily CTR** -- MultiLine chart per variant with legend
8. **Rotation + Funnel** -- 1fr 1fr grid: ABBATimeline and FunnelRow per variant
9. **GatesPanel** -- 6 auto-resolution criteria
10. **ClickMoment** -- bottom CTA

**Signal toggle:** both confirmed and live datasets are pre-computed by `toDetailView()` into `confirmedData` and `liveData` objects (daily, confTrend, variants). Toggle is local state; swapping passes the alternate dataset to all charts without refetch.

### 5.4 Winner Detail

Eight sections:

1. **DetailHeader** -- no signal toggle; Duplicate/Archive/Download actions
2. **Winner Banner** -- green-bordered card. Left cell: Trophy icon, VChip of winner (size 34, ring), lift percentage (JetBrains Mono 38px green), confidence. Right cell: 3 HeroStats (CTR before/after, total impressions with ABBA cycles count, estimated monthly extra clicks)
3. **"Why X won"** -- CredibleInterval showing non-overlapping CTR bands + RankBars (pBest) with explanatory text
4. **Live Monitor** (conditional, hidden when `monitor` undefined) -- live CTR big number, sparkline trend, lift badge vs original. Right side: post-application checkpoints at D+7/14/30 (check/clock icons, CTR or pending dash). Note about auto-reopen if CTR drops
5. **Confidence + Learning** -- 1fr 1fr grid: ConfidenceChart and Learning card (accent background, "Insight:" bold, saved to learning base)
6. **Final Scoreboard** -- VariantTable with winner badge (Trophy icon)
7. **ClickMoment**

### 5.5 Playoff Detail

Five sections:

1. **DetailHeader** -- Inconclusive badge (amber), no signal toggle
2. **Inconclusive Banner** -- amber background, Info icon, "Round 1 closed without a clear winner", confidence reached vs 95% threshold
3. **Playoff Banner** -- purple-bordered card. Header: Swords icon, "Playoff created automatically", startsIn countdown, scheduled badge. Bracket visualization: 3-column grid (Round 1 variants with finalists highlighted at full opacity, non-finalists dimmed; center arrow; Round 2 finalists with thumbnails and CTR). Footer: Target icon + reason text. Bracket has `role="img"` with descriptive aria-label
4. **"Why inconclusive"** -- 1fr 1fr grid: CredibleInterval (overlapping CTR bands) and RankBars using `pTop2` metric showing each variant's probability of finishing top 2
5. **Variant Table** -- VariantTable with `metric="pTop2"` (not pBest)

---

## 6. Wizard + ClickMoment

### 6.1 Wizard Shell

Modal `min(900px, 100%)`, fixed overlay with `backdrop-filter: blur(6px)`. 5-step rail at top: circle indicators (past = green check, current = accent, future = dim) connected by 1px lines. Past steps are clickable; future steps are inert. State managed by a single `useReducer` dispatching `WizardAction` variants (`SET_STEP`, `SET_TYPE`, `SET_HYPOTHESIS`, `SET_COWORK_OPENED`, `SET_TITLE`, `SET_VARIANTS`, `UPDATE_CONFIG`), replacing the existing 12 `useState` calls. Focus trap and `Escape` closes. `role="dialog" aria-modal="true"`. Footer shows Back/Next (step 4: "Launch test" with Play icon; step 1 without Cowork: "Skip"). Responsive: fullscreen at <=760px (border-radius 0, labels hidden, circles only); padding reduced at <=620px.

### 6.2 Five Steps

**Step 0 -- Type.** 2x2 radiogroup grid of 4 type cards (combo/thumbnail/title/description). Each card has icon box, title, description, and optional badge (`recommended` on combo, `one-off` on description). Click selects and auto-advances to step 1 after 180ms delay. Arrow keys navigate; `aria-checked` tracks selection.

**Step 1 -- Ideas.** Cowork integration banner (Sparkles icon + "Brainstorm with Cowork"). Optional hypothesis textarea (`maxLength={2000}`, counter appears at 1500+). Context chips panel showing what Cowork receives (Video+thumbnail, Metrics, Previous tests, Your hypothesis). Skip hint when Cowork not opened. Footer button reads "Skip" instead of "Next" until Cowork is used.

**Step 2 -- Variants.** Conditional `TakesStrip` (5-frame grid from video takes, shown for combo/thumbnail types; hidden if no frames extracted). `VariantRow` per variant (A/B/C/D): header with VChip + label + badges (locked for A, "generated by Cowork" when applicable). Body is a grid: thumb slot (image for A, drop zone for B/C/D) + title input with `{length}/100` counter (red at 101+, normal at 100). Briefing accordion for Cowork-generated rationale + tags. Description accordion for combo/description types (optional, collapsible). Next disabled when 0 challenger variants uploaded.

**Step 3 -- Config.** Two-column grid (`1fr 280px`). Left: 6 `CfgRow` controls -- duration slider (7-28 days), confidence slider (80-99%), auto-apply toggle, burn-in slider (0-3 days), rotation Seg (ABBA/Sequential/Random), playoff toggle. Right: sticky estimate card showing time-to-significance, ABBA cycles, and YouTube quota/day. Responsive: stacks to single column at <=760px.

**Step 4 -- Review.** Success banner summarizing variant count, type, rotation, duration, confidence, and playoff status. Embedded `<ClickMoment>` preview assembled from wizard state. Read-only -- no edits, confirmation before launch. Missing thumbnails show gradient placeholders; missing titles show "Untitled".

### 6.3 Adapters

Four adapter functions in `lib/youtube/ab-wizard-adapter.ts`:

- **`wizardConfigToAbConfig(cfg)`** -- Maps camelCase wizard fields to snake_case DB fields. Converts `confidence` integer (95) to decimal (0.95) via `/100`. `rotation` passes through unchanged.
- **`initWizardConfig(settings)`** -- Seeds `WizardConfig` from `AbTestSiteSettings`. Converts `default_confidence` decimal (0.95) to integer (95) via `Math.round(x * 100)`. `rotation` and `playoff` default to `'abba'` and `true` (not yet in settings).
- **`launchAbTest(state, siteId)`** -- Multi-step sequence: (1) create test as draft, (2) upload/create variants sequentially for B/C/D, (3) start test (draft to active). Returns `{ok, error?}`.
- **`toClickMomentData`** -- Two overloads: from `AbTestDetailView` (maps existing variant fields, carries leader/winner) and from `WizardState` (maps titles/blob URLs, CTR = 0 since no data yet).

### 6.4 ClickMoment Module

Centerpiece YouTube preview, used in wizard Review and all 3 detail states (active/playoff/completed).

**Header:** Fraunces "The click moment" title + `Seg` toggle (Compare | Feed).

**Context switcher:** 4 buttons -- Home (LayoutGrid), Search (Search), Suggested (ListVideo), Mobile (Smartphone). Active gets accent border + subtle bg.

**Compare mode** renders a grid of variant cards (home: 2-col, search/sidebar: 1-col, mobile: auto-fit 300px). Each card contains the context-appropriate renderer + `BehaviorStrip` below. Leader card gets colored border + badge (Trophy for winner, TrendingUp for leader).

**Context renderers:** `HomeCard` (full-width thumb + avatar + title + meta), `SearchRow` (horizontal: 340px thumb + stacked text), `SidebarRow` (compact horizontal: 168px thumb + 2-line title), `MobilePhone` (iPhone frame with notch, radius-0 thumb + compact meta).

**YTThumb:** Renders `<Image>` when `thumbUrl` exists; otherwise renders gradient bg + radial subject glow + repeating-linear-gradient texture + overlay text. Duration chip bottom-right (JetBrains Mono). Optional label badge top-left. `mini` prop hides overlay + duration. Fallback solid `#1a1814` when both `thumbUrl` and `thumbBg` are missing.

**BehaviorStrip:** VChip (with leader ring) + proportional CTR bar (width = `ctr/maxCtr * 100%`, animated 0.6s) + CTR value (JetBrains Mono 700 15px) + relative delta for non-A variants (green positive, red negative, `relLift = ((delta/baseline.ctr)*100).toFixed(0)`).

**FeedView:** Simulated YouTube Home feed. Dark bg grid (3-col, responsive to 2-col at <=760px, 1-col at <=620px). 5 hardcoded `DecoyVideo` entries at `opacity: 0.62` (`aria-hidden="true"`), positioned around the user's video at center slot. User's video gets a highlight border (`2px solid {color}` + glow shadow) and a "your video" badge. Variant selector (button per variant, radiogroup pattern) with CTR badge. `DecoyVideo` interface: `{title, channelName, views, age, thumbBg, thumbOverlay, duration}`.

---

## 7. Test Matrix (~330 scenarios)

| File | Scenarios | Focus |
|------|-----------|-------|
| `ab-constants.test.ts` | ~25 | Status/color maps, threshold constants, label helpers, edge values |
| `ab-chart-utils.test.ts` | ~15 | Axis formatting, tooltip builders, color assignment, empty data guards |
| `ab-chart-math.test.ts` | ~18 | Z-score, p-value, confidence intervals, MDE, sample size calc, division-by-zero |
| `ab-primitives.test.tsx` | ~56 | StatusBadge, ConfidenceBar, MetricCard, VariantRow, EmptyState -- all variants, a11y attrs, conditional renders |
| `ab-charts.test.tsx` | ~50 | ConversionChart, TimeSeriesChart, DistributionChart -- renders with data, empty state, loading skeleton, axis labels, responsive breakpoints, tooltip content |
| `ab-dashboard.test.tsx` | ~40 | List filtering, status tabs, sort order, empty states, pagination, playoff grouping, bulk actions, search debounce |
| `ab-settings-drawer.test.tsx` | ~12 | Open/close, traffic split validation, MDE input bounds, save callback, dirty-state warning |
| `ab-detail-active.test.tsx` | ~15 | Live metrics display, progress bar, pause/resume actions, time elapsed |
| `ab-detail-winner.test.tsx` | ~12 | Winner banner, promote CTA, final stats lock, rollback option |
| `ab-detail-playoff.test.tsx` | ~10 | Playoff bracket render, round progression, source variant lineage |
| `ab-variant-table.test.tsx` | ~18 | Column sort, row highlighting for leader, confidence column formatting, control baseline |
| `ab-gates.test.ts` | ~12 | Minimum sample gate, minimum duration gate, significance threshold gate, combined gate logic |
| `ab-detail-helpers.test.ts` | ~10 | Status derivation, winner detection, lift calculation, duration formatting |
| `ab-wizard-shell.test.tsx` | ~10 | Step navigation, validation gating per step, cancel confirmation, progress indicator |
| `ab-wizard-steps.test.tsx` | ~12 | Each step form: variant naming, traffic split, goal selection, review summary |
| `ab-click-moment.test.tsx` | ~8 | Click tracking hook, debounced events, moment capture timestamp |
| `ab-wizard-adapters.test.ts` | ~7 | Form-to-API payload mapping, defaults population, partial update merge |

**Infrastructure:**

- `@vitest-environment happy-dom` for all `.tsx` files
- `afterEach(() => cleanup())` in every component suite
- Global Lucide mock: `vi.mock('lucide-react', () => iconProxy)` -- returns generic SVG stubs
- `getBoundingClientRect` mock for chart dimension tests (Recharts layout)
- `vi.useFakeTimers()` for debounce tests (dashboard search, click moment), `advanceTimersByTime` to assert timing
- Supabase client mocked at module level; no network calls in unit tests
- Shared fixtures: `makeExperiment()`, `makeVariant()`, `makeTimeSeries()` factory helpers

---

## 8. Migration Plan

Implementation follows a strict 5-layer dependency order. Each layer must pass verification gates before the next begins.

**Why this order:** Layer 1 defines `DisplayLabel` and `ChartVariant` types consumed by everything. Layer 2 charts depend on `chart-utils.ts` from Layer 1. Layer 3 dashboard uses charts from Layer 2. Layer 4 detail uses all previous layers. Layer 5 wizard reuses ClickMoment from Layer 4.

### 8.1 Foundation (Layer 1) — ~4h

**Create (5 new files):**
- `_components/ab-constants.ts` — `DisplayLabel`, `toDisplayLabel()`, `variantColor()`, `VARIANT_COLORS`, `TYPE_META`, formatters (formatNumber/Percent/Date/Compact). Dedupes from: `ab-daily-ctr-chart.tsx:11`, `ab-rotation-timeline.tsx:27`, `variant-heatmap-table.tsx:10`, `ab-test-card.tsx:32`, `ab-test-completed-row.tsx:19`, `ab-test-detail.tsx:34`, `ab-video-history.tsx:12`, `ab-variant-card.tsx:14`, `ab-test-detail.tsx:20` (normalCdf → import from ab-statistics.ts)
- `_components/ab-primitives.tsx` — 12 shared components: VChip, Badge (6 tones), InfoTip, TypeBadge, Seg (radiogroup), Toggle (role=switch), NumberField (spinbutton), CheckRow (label+hidden input), Slider, CfgRow, SectionLabel, Legend
- `_components/chart-utils.ts` — CHART constants, toX/toY (with division guards), niceLine (Catmull-Rom), GridLines, XLabels, GradientDef, EndDot
- `_components/index.ts` — barrel export
- `lib/youtube/ab-schemas.ts` additions — createAbTestSchema, updateSettingsSchema (Zod)

**Split:** `actions.ts` → `queries.ts` (reads: getAbTestsForSite, getTestResults, getAbSiteSettings, getEligibleVideosForPicker, getVideoTestHistory) + `actions.ts` (mutations + fetchAbBriefingData/fetchAbTestVariants which STAY as 'use server' — called from client via startTransition)

**Add to globals.css:** 4 keyframes (ab-fade-up, ab-fade-only, ab-slot-pulse, ab-drawer-in) + reduced-motion blanket

**Estimated:** ~800 LOC new (ab-primitives ~400, chart-utils ~200, ab-constants ~100, rest ~100). 9 files modified (import updates).

### 8.2 Charts (Layer 2) — ~8h

| Current file | Action | New file |
|---|---|---|
| `ab-confidence-trend.tsx` (175L) | **Replace** | `confidence-chart.tsx` — Catmull-Rom + area fill gradient + META target |
| `ab-daily-ctr-chart.tsx` (140L) | **Replace** | `multi-line.tsx` — multi-series smooth lines |
| `ab-rotation-timeline.tsx` (127L) | **Replace** | `abba-timeline.tsx` — colored blocks with variant letters |
| `variant-heatmap-table.tsx` (80L) | **Update** | Import VARIANT_COLORS from ab-constants |

**7 new chart components:** `gauge.tsx`, `credible-interval.tsx`, `rank-bars.tsx`, `radar-chart.tsx`, `funnel-row.tsx`, `bayes-curves.tsx`, `dots.tsx`

**Estimated:** ~1400 LOC new, 442L deleted (3 replaced files), 1 modified.

### 8.3 Dashboard + Settings (Layer 3) — ~8h

**Evolved (4):** `ab-lab-dashboard.tsx` (full rewrite internals), `ab-settings-panel.tsx` → `settings-drawer.tsx` (slide-over + auto-save), `ab-test-card.tsx` → `active-test-card.tsx` (footer stats + mini thumbs), `ab-test-completed-row.tsx` → `completed-row.tsx` (thumbnail + VChip)

**New (5):** `kpi.tsx`, `drafts-block.tsx`, `learnings-panel.tsx`, `empty-state.tsx` + `suggested-card.tsx`

**New types in ab-types.ts:** DashboardStats, AbTestDraft, SuggestedVideo, LearningsData, LearningsTag, EligibleVideo, AbTestCardView

**New queries:** toCardView(), toLatestDraft(), computeDashboardStats(), getLearnings(), getSuggestedVideos()

**Deleted (1):** `ab-video-picker.tsx` (187L)

**Estimated:** ~1500 LOC new, 187L deleted, 4 evolved.

### 8.4 Detail (Layer 4) — ~10h

**Evolved (1):** `ab-test-detail.tsx` (569L) → router shell + 3 state components

**New (8):** `detail-header.tsx`, `lock-countdown.tsx`, `hero-band.tsx`, `variant-table.tsx`, `gates-panel.tsx`, `winner-banner.tsx`, `live-monitor.tsx`, `playoff-banner.tsx`

**New shared:** `lib/youtube/ab-gates.ts` — `computeGates()` pure function (shared between cron and detail)

**New types:** AbTestDetailView discriminated union (Active | Winner | Playoff), GateStatus, LiveMonitor, toDetailView() mapper

**Deleted (1):** `ab-variant-card.tsx` (153L)

**Estimated:** ~2500 LOC new, 153L deleted.

### 8.5 Wizard + ClickMoment (Layer 5) — ~10h

**Evolved (1):** `ab-create-wizard.tsx` (1312L) → shell ~400L with useReducer

**Extracted (4):** `step-tipo.tsx` (~120L), `step-variantes.tsx` (~250L), `step-config.tsx` (~150L), `step-revisar.tsx` (~80L)

**New ClickMoment (6):** `click-moment.tsx` (~300L), `yt-thumb.tsx` (~80L), `feed-view.tsx` (~150L), `behavior-strip.tsx` (~60L), `context-renderers.tsx` (~200L), `ch-avatar.tsx` (~15L)

**New adapters:** `lib/youtube/ab-wizard-adapter.ts` — wizardConfigToAbConfig(), initWizardConfig(), launchAbTest(), toClickMomentData()

**Deleted (1):** `wizard-variant-card.tsx` (136L)

**Estimated:** ~2200 LOC new (wizard ~600 + ClickMoment ~800 + adapters ~100), 136L deleted.

### 8.6 Totals

| Metric | Count |
|---|---|
| New files created | ~35 |
| Files evolved/modified | ~15 |
| Files deleted | 6 (~1,100 LOC removed) |
| New implementation LOC | ~8,400 |
| New test LOC | ~1,200 (~330 scenarios) |
| Total estimated hours | ~40h |

**Visual breaking change:** Variant colors change intentionally per redesign handoff. Existing: B=#3b82f6 (blue), C=#a855f7 (purple), D=#14b8a6 (teal). New: A=#8A8F98 (slate), B=#E8823C (orange), C=#3FA9C0 (cyan), D=#A77CE8 (violet). This is a design decision, not a bug — the handoff specifies the new palette.

### Verification gates per layer
- All tests pass (`npm run test:web`)
- `npm run build:packages` succeeds
- `next build` succeeds (pre-commit validates)
- No `any` types introduced
- All new components have `aria-*` attributes per spec
- **Layer 1:** barrel export imports resolve from all consumers
- **Layer 2:** old chart consumers switch to new imports without breakage
- **Layer 4:** discriminated union dispatch narrows correctly (TypeScript strict)
- **Layer 5:** wizard launch sequence (create → upload → start) completes end-to-end

---

## 9. Visual Mockups

7 high-fidelity HTML mockups in `.superpowers/brainstorm/` validated through multi-agent audit cycles (60-100+ sub-agents total). Each mockup uses exact data from `design/ablab/data.js`, pixel-perfect CSS matching the Claude.ai design prototype.

| # | Screen | File | Score | Key Features |
|---|--------|------|-------|-------------|
| 1 | Dashboard Active | mockup-dashboard-v2.html | ~96 | CMS chrome, KPI strip, active cards with YTThumb, learnings panel |
| 2 | Dashboard Empty | mockup-dashboard-empty.html | ~96 | Hero card, 3 suggested videos with grades |
| 3 | Detail Active | mockup-detail-active.html | ~93 | HeroBand, VariantTable, ConfidenceChart SVG, CredibleInterval, RankBars, ABBATimeline, FunnelRow, ClickMoment 4 cards |
| 4 | Detail Winner | mockup-detail-winner.html | ~90 | Winner banner, "Why B won", live monitor checkpoints, ClickMoment A vs B |
| 5 | Detail Playoff | mockup-detail-playoff.html | ~90 | Amber banner, bracket visualization, P-top2 RankBars |
| 6 | Wizard Step 2 | mockup-wizard.html | ~93 | TakesStrip, 4 VariantRows, briefings, upload zones |
| 7 | Settings Drawer | mockup-settings.html | ~93 | 3 sections, conditional sub-fields, auto-save, CheckRows |

All mockups include breadcrumb navigation, responsive breakpoints, hover states, and aria attributes. Scores reflect cumulative audit findings across layout fidelity, data accuracy, accessibility, and interaction completeness. Mockups serve as the pixel-reference contract for implementation -- every component, spacing value, and color token in the build phase traces back to these files.

---

## 10. Next Steps

Implementation plan following the 5-layer migration order:

### Layer 1: Foundation (estimated ~4h)
1. Create `ab-constants.ts` with unified `VARIANT_COLORS`, `TYPE_META`, formatters, and `DisplayLabel` type
2. Create `chart-utils.ts` with SVG helpers (`toX`, `toY`, `niceLine`, `GridLines`, `XLabels`, `GradientDef`, `EndDot`)
3. Create `ab-primitives.tsx` with 12 shared components (VChip, Badge, InfoTip, TypeBadge, Seg, Toggle, NumberField, CheckRow, Slider, CfgRow, SectionLabel, Legend)
4. Create `ab-schemas.ts` with Zod validation schemas
5. Add 4 keyframe animations to `globals.css` (scoped to `.ab-lab`)
6. Split `actions.ts` into `queries.ts` (reads) + `actions.ts` (mutations)
7. Write `ab-constants.test.ts` (~25 scenarios) and `ab-chart-utils.test.ts` (~15 scenarios)

### Layer 2: Charts (estimated ~8h)
1. Build `confidence-chart.tsx` replacing `ab-confidence-trend.tsx`
2. Build `multi-line.tsx` replacing `ab-daily-ctr-chart.tsx`
3. Build `abba-timeline.tsx` replacing `ab-rotation-timeline.tsx`
4. Create 7 new chart components: `gauge.tsx`, `credible-interval.tsx`, `rank-bars.tsx`, `radar-chart.tsx`, `funnel-row.tsx`, `bayes-curves.tsx`, `dots.tsx`
5. Update `variant-heatmap-table.tsx` to import from `ab-constants.ts`
6. Write `ab-charts.test.tsx` (~50 scenarios) and `ab-chart-math.test.ts` (~18 scenarios)

### Layer 3: Dashboard + Settings (estimated ~8h)
1. Add new types to `ab-types.ts` (DashboardStats, AbTestCardView, SuggestedVideo, LearningsData, etc.)
2. Add computed helpers to `queries.ts` (toCardView, computeDashboardStats, getLearnings, getSuggestedVideos)
3. Build 8 dashboard components (KPI, ActiveTestCard, CompletedRow, DraftsBlock, LearningsPanel, EmptyState, SuggestedCard, Dashboard shell)
4. Evolve `ab-settings-panel.tsx` to `settings-drawer.tsx` with focus trap and auto-save
5. Write `ab-dashboard.test.tsx` (~40 scenarios) and `ab-settings-drawer.test.tsx` (~12 scenarios)

### Layer 4: Detail Views (estimated ~10h)
1. Define discriminated union types (AbTestActiveView, AbTestWinnerView, AbTestPlayoffView)
2. Create `ab-gates.ts` with `computeGates()` pure function
3. Build shared components (DetailHeader, VariantTable, GatesPanel, H)
4. Build Active Detail (10 sections with signal toggle)
5. Build Winner Detail (8 sections with live monitor placeholder)
6. Build Playoff Detail (5 sections with bracket visualization)
7. Write detail tests (~47 scenarios across 5 test files)

### Layer 5: Wizard + ClickMoment (estimated ~10h)
1. Refactor wizard shell to `useReducer` (replace 12 `useState` calls)
2. Extract 4 step components (step-type-select, step-variants-editor, step-config, step-review)
3. Create 4 adapter functions in `ab-wizard-adapter.ts`
4. Build ClickMoment module (6 files: provider, hook, types, 3 slot components)
5. Build context renderers (HomeCard, SearchRow, SidebarRow, MobilePhone) + FeedView
6. Write wizard + ClickMoment tests (~37 scenarios across 3 test files)

### Verification gates per layer
- All tests pass (`npm run test:web`)
- `npm run build:packages` succeeds
- `next build` succeeds (pre-commit validates)
- No `any` types introduced
- All new components have `aria-*` attributes per spec
