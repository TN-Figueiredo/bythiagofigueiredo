# A/B Lab Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the A/B Lab YouTube testing UI across 5 layers: Foundation, Charts, Dashboard+Settings, Detail (3 states), Wizard+ClickMoment.

**Architecture:** Evolve & Replace — each layer is independently shippable. Foundation defines shared types/primitives, Charts builds 10 SVG visualizations, Dashboard/Detail/Wizard compose them into full screens. All layers follow TDD.

**Tech Stack:** Next.js 15 + React 19 + Tailwind 4 + TypeScript 5 + Vitest + Custom SVG charts

**Spec:** `docs/superpowers/specs/2026-05-29-ab-lab-redesign.md`

**Estimated:** ~40h total, ~8400 LOC, ~35 new files, ~330 test scenarios

---

## Phase 1: Foundation (~4h)

**Base:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/`
**Test:** `apps/web/test/youtube/`
**Spec:** `docs/superpowers/specs/2026-05-29-ab-lab-redesign.md` section 2 + 8.1

---

### Task 1: CSS tokens + keyframe animations

**Modify:** `apps/web/src/app/globals.css`

- [ ] Add 4 new CSS custom properties to the `:root, [data-theme="dark"]` block
- [ ] Add matching light-theme overrides to the `[data-theme="light"]` block
- [ ] Add 4 new AB Lab keyframes after existing keyframes section
- [ ] Add reduced-motion blanket rule scoped to `.ab-lab`
- [ ] Add animation tokens to `@theme` block

```css
/* Inside :root, [data-theme="dark"] block, after existing cms vars */
--cms-bg-side: #100E0B;
--cms-surface-3: #262219;
--cms-cowork: #6E63F2;
--cms-cowork-subtle: rgba(110,99,242,.15);
```

```css
/* Inside [data-theme="light"] block */
--cms-bg-side: #EDE5D5;
--cms-surface-3: #E8DFC9;
--cms-cowork: #5B4FD9;
--cms-cowork-subtle: rgba(91,79,217,.10);
```

```css
/* After existing keyframes */
@keyframes ab-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes ab-fade-only {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes ab-slot-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}

@keyframes ab-drawer-in {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

/* AB Lab reduced motion */
@media (prefers-reduced-motion: reduce) {
  .ab-lab,
  .ab-lab * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

```css
/* Inside @theme block */
--animate-ab-fade-up: ab-fade-up 0.35s ease both;
--animate-ab-fade-only: ab-fade-only 0.3s ease both;
--animate-ab-slot-pulse: ab-slot-pulse 2s ease-in-out infinite;
--animate-ab-drawer-in: ab-drawer-in 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both;
```

**Run:** `npx tailwindcss --input apps/web/src/app/globals.css --content 'apps/web/src/app/**/*.tsx' 2>&1 | head -5` -- expects no errors.

**Commit:** `git add apps/web/src/app/globals.css && git commit -m "feat(ab-lab): add CSS tokens + keyframes for redesign foundation"`

---

### Task 2: ChartVariant hierarchy types

**Modify:** `apps/web/src/lib/youtube/ab-types.ts`

- [ ] Import `DisplayLabel` type (from ab-constants, but since ab-constants re-exports from here, define inline)
- [ ] Add `ChartVariant`, `StatsVariant`, `RankedVariant`, `FullChartVariant` interfaces

```typescript
// Append to ab-types.ts

/* --- Chart variant hierarchy (Layer 1 redesign) --- */
export type DisplayLabel = 'A' | 'B' | 'C' | 'D'

export interface ChartVariant {
  label: DisplayLabel
  color: string
}

export interface StatsVariant extends ChartVariant {
  ctr: number
  impressions: number
}

export interface RankedVariant extends ChartVariant {
  pBest: number
  pTop2: number
}

export interface FullChartVariant extends StatsVariant, RankedVariant {
  clicks: number
  linkClicks?: number
  linkCtr?: number
  retention?: number
}
```

**Run:** `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -3` -- expects `0 errors`.

**Commit:** `git add apps/web/src/lib/youtube/ab-types.ts && git commit -m "feat(ab-lab): add ChartVariant type hierarchy"`

---

### Task 3: Create ab-constants.ts

**Create:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-constants.ts`

- [ ] Export `DisplayLabel` re-export from ab-types
- [ ] Export `VARIANT_COLORS` record
- [ ] Export `TYPE_META` with Lucide icon names
- [ ] Export `toDisplayLabel()` and `variantColor()` functions
- [ ] Export 4 formatter functions with null/NaN guards

```typescript
// ab-constants.ts -- server-safe, no 'use client'
import type { TestType, DisplayLabel } from '@/lib/youtube/ab-types'
export type { TestType, DisplayLabel } from '@/lib/youtube/ab-types'

export const VARIANT_COLORS = {
  A: '#8A8F98',
  B: '#E8823C',
  C: '#3FA9C0',
  D: '#A77CE8',
} as const satisfies Record<DisplayLabel, string>

export const TYPE_META: Record<TestType, { icon: string; label: string; hint: string }> = {
  thumbnail: { icon: 'Image', label: 'Thumbnail', hint: 'Test different thumbnail images' },
  title:     { icon: 'Type', label: 'Title', hint: 'Test different video titles' },
  description: { icon: 'FileText', label: 'Description', hint: 'Test different descriptions' },
  combo:     { icon: 'Layers', label: 'Combo', hint: 'Test thumbnail + title combinations' },
} as const

export function toDisplayLabel(dbLabel: string, isOriginal?: boolean): DisplayLabel {
  if (isOriginal || dbLabel === 'original') return 'A'
  if (dbLabel === 'B' || dbLabel === 'C' || dbLabel === 'D') return dbLabel
  return 'B' // fallback
}

export function variantColor(dbLabel: string, isOriginal?: boolean): string {
  return VARIANT_COLORS[toDisplayLabel(dbLabel, isOriginal)]
}

const DASH = '—'

const numberFmt = new Intl.NumberFormat('pt-BR')
const dateFmt = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })

export function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return DASH
  return numberFmt.format(n)
}

export function formatPercent(n: number | null | undefined, decimals = 1): string {
  if (n == null || Number.isNaN(n)) return DASH
  return `${n.toFixed(decimals)}%`
}

export function formatDate(d: string | Date | null | undefined): string {
  if (d == null) return DASH
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return DASH
  return dateFmt.format(date)
}

export function formatCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return DASH
  if (n < 1_000) return String(n)
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  return `${(n / 1_000_000_000).toFixed(1)}B`
}
```

**Run:** `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -3` -- expects `0 errors`.

**Commit:** `git add 'apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-constants.ts' && git commit -m "feat(ab-lab): create ab-constants with display labels, colors, formatters"`

---

### Task 4: Write ab-constants.test.ts (~25 scenarios)

**Create:** `apps/web/test/youtube/ab-constants.test.ts`

- [ ] Write tests for `toDisplayLabel` (7 scenarios: original string, isOriginal flag, B/C/D passthrough, unknown fallback)
- [ ] Write tests for `variantColor` (4 scenarios: each label returns correct hex)
- [ ] Write tests for `formatNumber` (4 scenarios: normal, null, undefined, NaN)
- [ ] Write tests for `formatPercent` (4 scenarios: normal, decimals override, null, NaN)
- [ ] Write tests for `formatDate` (4 scenarios: string, Date, null, invalid)
- [ ] Write tests for `formatCompact` (6 scenarios: <1k, 1.5k, 1.2M, 1.5B, null, NaN)

```typescript
import { describe, it, expect } from 'vitest'
import {
  toDisplayLabel, variantColor, VARIANT_COLORS, TYPE_META,
  formatNumber, formatPercent, formatDate, formatCompact,
} from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-constants'

describe('toDisplayLabel', () => {
  it('maps "original" to A', () => { expect(toDisplayLabel('original')).toBe('A') })
  it('maps any label with isOriginal=true to A', () => { expect(toDisplayLabel('B', true)).toBe('A') })
  it('passes through B', () => { expect(toDisplayLabel('B')).toBe('B') })
  it('passes through C', () => { expect(toDisplayLabel('C')).toBe('C') })
  it('passes through D', () => { expect(toDisplayLabel('D')).toBe('D') })
  it('falls back to B for unknown', () => { expect(toDisplayLabel('X')).toBe('B') })
  it('falls back to B for empty string', () => { expect(toDisplayLabel('')).toBe('B') })
})

describe('variantColor', () => {
  it('returns slate for original', () => { expect(variantColor('original')).toBe('#8A8F98') })
  it('returns orange for B', () => { expect(variantColor('B')).toBe('#E8823C') })
  it('returns cyan for C', () => { expect(variantColor('C')).toBe('#3FA9C0') })
  it('returns violet for D', () => { expect(variantColor('D')).toBe('#A77CE8') })
})

describe('TYPE_META', () => {
  it('covers all 4 test types', () => {
    expect(Object.keys(TYPE_META)).toEqual(['thumbnail', 'title', 'description', 'combo'])
  })
  it('each entry has icon, label, hint', () => {
    for (const v of Object.values(TYPE_META)) {
      expect(v).toHaveProperty('icon')
      expect(v).toHaveProperty('label')
      expect(v).toHaveProperty('hint')
    }
  })
})

describe('formatNumber', () => {
  it('formats with pt-BR locale', () => { expect(formatNumber(1234)).toMatch(/1[\.\s]?234/) })
  it('returns dash for null', () => { expect(formatNumber(null)).toBe('—') })
  it('returns dash for undefined', () => { expect(formatNumber(undefined)).toBe('—') })
  it('returns dash for NaN', () => { expect(formatNumber(NaN)).toBe('—') })
})

describe('formatPercent', () => {
  it('formats with 1 decimal by default', () => { expect(formatPercent(12.34)).toBe('12.3%') })
  it('accepts custom decimals', () => { expect(formatPercent(12.345, 2)).toBe('12.35%') })
  it('returns dash for null', () => { expect(formatPercent(null)).toBe('—') })
  it('returns dash for NaN', () => { expect(formatPercent(NaN)).toBe('—') })
})

describe('formatDate', () => {
  it('formats ISO string', () => { expect(formatDate('2026-01-15')).toMatch(/Jan/) })
  it('formats Date object', () => { expect(formatDate(new Date('2026-06-01'))).toMatch(/Jun/) })
  it('returns dash for null', () => { expect(formatDate(null)).toBe('—') })
  it('returns dash for invalid date', () => { expect(formatDate('not-a-date')).toBe('—') })
})

describe('formatCompact', () => {
  it('shows raw number under 1k', () => { expect(formatCompact(999)).toBe('999') })
  it('formats thousands', () => { expect(formatCompact(1500)).toBe('1.5k') })
  it('formats millions', () => { expect(formatCompact(1_200_000)).toBe('1.2M') })
  it('formats billions', () => { expect(formatCompact(1_500_000_000)).toBe('1.5B') })
  it('returns dash for null', () => { expect(formatCompact(null)).toBe('—') })
  it('returns dash for NaN', () => { expect(formatCompact(NaN)).toBe('—') })
})
```

**Run:** `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --run test/youtube/ab-constants.test.ts` -- expects 25 passed.

**Commit:** `git add apps/web/test/youtube/ab-constants.test.ts && git commit -m "test(ab-lab): 25 scenarios for ab-constants"`

---

### Task 5: Create chart-utils.ts

**Create:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/chart-utils.ts`

- [ ] Export `CHART` constants object
- [ ] Export `toX()` with total<=1 guard
- [ ] Export `toY()` with min===max guard
- [ ] Export `niceLine()` Catmull-Rom to cubic Bezier
- [ ] Export `GridLines`, `XLabels`, `GradientDef`, `EndDot` SVG components

```typescript
// chart-utils.ts -- server-safe, no 'use client'
import React from 'react'

export const CHART = {
  W: 620, H: 200,
  padL: 34, padR: 14, padT: 18, padB: 26,
  font: 'JetBrains Mono, monospace',
  gridStroke: 'rgba(245,239,230,0.06)',
  axisColor: 'var(--cms-text-dim)',
  easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
} as const

type Cfg = { W?: number; H?: number; padL?: number; padR?: number; padT?: number; padB?: number }

function resolve(c?: Cfg) {
  return {
    W: c?.W ?? CHART.W, H: c?.H ?? CHART.H,
    padL: c?.padL ?? CHART.padL, padR: c?.padR ?? CHART.padR,
    padT: c?.padT ?? CHART.padT, padB: c?.padB ?? CHART.padB,
  }
}

export function toX(i: number, total: number, cfg?: Cfg): number {
  const c = resolve(cfg)
  if (total <= 1) return c.padL
  return c.padL + (i / (total - 1)) * (c.W - c.padL - c.padR)
}

export function toY(value: number, min: number, max: number, cfg?: Cfg): number {
  const c = resolve(cfg)
  const plotH = c.H - c.padT - c.padB
  if (min === max) return c.padT + plotH / 2
  return c.padT + (1 - (value - min) / (max - min)) * plotH
}

export function niceLine(pts: Array<{ x: number; y: number }>): string {
  const clean = pts.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
  if (clean.length === 0) return ''
  if (clean.length === 1) return `M${clean[0].x},${clean[0].y}`
  if (clean.length === 2) return `M${clean[0].x},${clean[0].y}L${clean[1].x},${clean[1].y}`

  const d: string[] = [`M${clean[0].x},${clean[0].y}`]
  for (let i = 0; i < clean.length - 1; i++) {
    const p0 = clean[Math.max(i - 1, 0)]
    const p1 = clean[i]
    const p2 = clean[i + 1]
    const p3 = clean[Math.min(i + 2, clean.length - 1)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d.push(`C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`)
  }
  return d.join('')
}

export interface GridLinesProps { min: number; max: number; ticks?: number; cfg?: Cfg }
export function GridLines({ min, max, ticks = 4, cfg }: GridLinesProps) {
  const c = resolve(cfg)
  const lines: React.ReactElement[] = []
  for (let i = 0; i <= ticks; i++) {
    const val = min + (i / ticks) * (max - min)
    const y = toY(val, min, max, cfg)
    lines.push(
      React.createElement('g', { key: i },
        React.createElement('line', { x1: c.padL, x2: c.W - c.padR, y1: y, y2: y, stroke: CHART.gridStroke, strokeWidth: 1 }),
        React.createElement('text', { x: c.padL - 4, y: y + 3, textAnchor: 'end', fill: CHART.axisColor, fontSize: 9, fontFamily: CHART.font }, val.toFixed(1)),
      ),
    )
  }
  return React.createElement('g', { 'aria-hidden': true }, ...lines)
}

export interface XLabelsProps { labels: string[]; cfg?: Cfg }
export function XLabels({ labels, cfg }: XLabelsProps) {
  const c = resolve(cfg)
  return React.createElement('g', { 'aria-hidden': true },
    ...labels.map((l, i) =>
      React.createElement('text', {
        key: i, x: toX(i, labels.length, cfg), y: c.H - 4,
        textAnchor: 'middle', fill: CHART.axisColor, fontSize: 9, fontFamily: CHART.font,
      }, l),
    ),
  )
}

export interface GradientDefProps { id: string; color: string; topOpacity?: number }
export function GradientDef({ id, color, topOpacity = 0.28 }: GradientDefProps) {
  return React.createElement('linearGradient', { id, x1: 0, x2: 0, y1: 0, y2: 1 },
    React.createElement('stop', { offset: '0%', stopColor: color, stopOpacity: topOpacity }),
    React.createElement('stop', { offset: '100%', stopColor: color, stopOpacity: 0 }),
  )
}

export interface EndDotProps { cx: number; cy: number; color: string; reached?: boolean }
export function EndDot({ cx, cy, color, reached }: EndDotProps) {
  const fill = reached ? 'var(--cms-green)' : color
  return React.createElement('g', null,
    React.createElement('circle', { cx, cy, r: 9, fill, opacity: 0.4 }),
    React.createElement('circle', { cx, cy, r: 5, fill }),
  )
}
```

**Run:** `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -3` -- expects `0 errors`.

**Commit:** `git add 'apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/chart-utils.ts' && git commit -m "feat(ab-lab): create chart-utils with SVG helpers"`

---

### Task 6: Write ab-chart-utils.test.ts (~15 scenarios)

**Create:** `apps/web/test/youtube/ab-chart-utils.test.ts`

- [ ] Test `toX` (4 scenarios: normal, total=1, first/last positions)
- [ ] Test `toY` (4 scenarios: normal, min===max center, top/bottom)
- [ ] Test `niceLine` (5 scenarios: empty, 1 point, 2 points, 3+ points smooth, NaN filtered)
- [ ] Test `CHART` constants exist (2 scenarios)

```typescript
import { describe, it, expect } from 'vitest'
import { toX, toY, niceLine, CHART } from '@/app/cms/(authed)/youtube/ab-lab/_components/chart-utils'

describe('CHART constants', () => {
  it('has expected dimensions', () => { expect(CHART.W).toBe(620); expect(CHART.H).toBe(200) })
  it('has font string', () => { expect(CHART.font).toContain('JetBrains') })
})

describe('toX', () => {
  it('returns padL when total is 1', () => { expect(toX(0, 1)).toBe(CHART.padL) })
  it('returns padL for first point', () => { expect(toX(0, 5)).toBe(CHART.padL) })
  it('returns W-padR for last point', () => { expect(toX(4, 5)).toBe(CHART.W - CHART.padR) })
  it('distributes evenly', () => {
    const mid = toX(1, 3)
    expect(mid).toBeGreaterThan(CHART.padL)
    expect(mid).toBeLessThan(CHART.W - CHART.padR)
  })
})

describe('toY', () => {
  it('returns padT for max value', () => { expect(toY(100, 0, 100)).toBe(CHART.padT) })
  it('returns H-padB for min value', () => { expect(toY(0, 0, 100)).toBe(CHART.H - CHART.padB) })
  it('centers when min===max', () => {
    const y = toY(50, 50, 50)
    const center = CHART.padT + (CHART.H - CHART.padT - CHART.padB) / 2
    expect(y).toBe(center)
  })
  it('maps midpoint correctly', () => {
    const y = toY(50, 0, 100)
    const center = CHART.padT + (CHART.H - CHART.padT - CHART.padB) / 2
    expect(y).toBeCloseTo(center, 1)
  })
})

describe('niceLine', () => {
  it('returns empty string for no points', () => { expect(niceLine([])).toBe('') })
  it('returns M for single point', () => { expect(niceLine([{ x: 10, y: 20 }])).toBe('M10,20') })
  it('returns ML for two points', () => { expect(niceLine([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe('M0,0L10,10') })
  it('returns Catmull-Rom curves for 3+ points', () => {
    const d = niceLine([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }])
    expect(d).toMatch(/^M.*C.*C/)
  })
  it('filters NaN/Infinity', () => {
    const d = niceLine([{ x: NaN, y: 0 }, { x: 5, y: 5 }, { x: 10, y: Infinity }])
    expect(d).toBe('M5,5')
  })
})
```

**Run:** `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --run test/youtube/ab-chart-utils.test.ts` -- expects 15 passed.

**Commit:** `git add apps/web/test/youtube/ab-chart-utils.test.ts && git commit -m "test(ab-lab): 15 scenarios for chart-utils"`

---

### Task 7: Create ab-primitives.tsx (VChip, Badge, InfoTip, TypeBadge)

**Create:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-primitives.tsx`

- [ ] Add `'use client'` directive
- [ ] Implement `VChip` with colored square + letter, `aria-label`, optional `role="button"`
- [ ] Implement `Badge` with 6 tone variants (neutral, accent, green, amber, cowork, live)
- [ ] Implement `InfoTip` with `?` trigger, `role="tooltip"`, Escape closes
- [ ] Implement `TypeBadge` wrapping Badge + Lucide icon lookup

```tsx
'use client'

import React, { useState, useCallback, useId } from 'react'
import type { DisplayLabel, TestType } from './ab-constants'
import { VARIANT_COLORS, TYPE_META } from './ab-constants'
import * as icons from 'lucide-react'

/* --- VChip --- */
export interface VChipProps {
  label: DisplayLabel
  size?: number
  ring?: boolean
  onClick?: () => void
}

export function VChip({ label, size = 22, ring, onClick }: VChipProps) {
  const color = VARIANT_COLORS[label]
  const Tag = onClick ? 'button' : 'span'
  return React.createElement(Tag, {
    'aria-label': `Variant ${label}`,
    ...(onClick ? { role: 'button', onClick, type: 'button' as const } : {}),
    className: 'inline-flex items-center justify-center rounded font-mono font-bold text-white shrink-0',
    style: {
      width: size, height: size, fontSize: size * 0.55, backgroundColor: color,
      ...(ring ? { boxShadow: `0 0 0 2px ${color}44` } : {}),
    },
  }, label)
}

/* --- Badge --- */
const BADGE_TONES = {
  neutral: 'bg-cms-surface text-cms-text-muted',
  accent:  'bg-cms-accent-subtle text-cms-accent',
  green:   'bg-cms-green-subtle text-cms-green',
  amber:   'bg-cms-amber-subtle text-cms-amber',
  cowork:  'text-[var(--cms-cowork)]',
  live:    'bg-cms-red-subtle text-cms-red',
} as const

export type BadgeTone = keyof typeof BADGE_TONES

export interface BadgeProps {
  tone?: BadgeTone
  children: React.ReactNode
  dot?: boolean
  className?: string
}

export function Badge({ tone = 'neutral', children, dot, className = '' }: BadgeProps) {
  const toneClass = tone === 'cowork'
    ? `bg-[var(--cms-cowork-subtle)] ${BADGE_TONES.cowork}`
    : BADGE_TONES[tone]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium tracking-wide uppercase ${toneClass} ${className}`}>
      {dot && <span className="size-1.5 rounded-full bg-current animate-ab-slot-pulse" />}
      {children}
    </span>
  )
}

/* --- InfoTip --- */
export interface InfoTipProps { text: string }

export function InfoTip({ text }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
  }, [])

  return (
    <span className="relative inline-flex" onKeyDown={handleKey}>
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center size-4 rounded-full text-3xs text-cms-text-dim border border-cms-border-subtle hover:text-cms-text-muted cursor-help"
      >?</button>
      {open && (
        <span id={id} role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-lg bg-cms-surface text-2xs text-cms-text shadow-popover whitespace-nowrap z-tooltip animate-ab-fade-up"
        >{text}</span>
      )}
    </span>
  )
}

/* --- TypeBadge --- */
export interface TypeBadgeProps { type: TestType }

export function TypeBadge({ type }: TypeBadgeProps) {
  const meta = TYPE_META[type]
  const Icon = (icons as Record<string, React.ComponentType<{ size?: number }>>)[meta.icon]
  return (
    <Badge tone="neutral" className="gap-1.5">
      {Icon && <Icon size={11} />}
      {meta.label}
    </Badge>
  )
}
```

**Run:** `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -3` -- expects `0 errors`.

---

### Task 8: ab-primitives.tsx continued (remaining 8 components)

**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-primitives.tsx`

- [ ] Append `Seg` (generic segmented control, `role="radiogroup"`, roving tabindex)
- [ ] Append `Toggle` (`role="switch"`, `aria-checked`)
- [ ] Append `NumberField` (`role="spinbutton"`, `aria-valuenow/min/max`)
- [ ] Append `CheckRow` (native checkbox inside label)
- [ ] Append `Slider` (native range input, `aria-valuetext`)
- [ ] Append `CfgRow` (settings row layout)
- [ ] Append `SectionLabel` (semantic heading via `as` prop)
- [ ] Append `Legend` (color swatches)

```tsx
/* --- Seg --- */
export interface SegProps<T extends string> {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  labels?: Partial<Record<T, string>>
}

export function Seg<T extends string>({ options, value, onChange, labels }: SegProps<T>) {
  return (
    <div role="radiogroup" className="inline-flex rounded-lg bg-cms-surface p-0.5 gap-0.5">
      {options.map(opt => (
        <button key={opt} type="button" role="radio" aria-checked={opt === value}
          onClick={() => onChange(opt)} tabIndex={opt === value ? 0 : -1}
          className={`px-2.5 py-1 text-2xs font-medium rounded-md transition-colors duration-150 ${opt === value ? 'bg-cms-accent text-white' : 'text-cms-text-muted hover:text-cms-text'}`}
        >{labels?.[opt] ?? opt}</button>
      ))}
    </div>
  )
}

/* --- Toggle --- */
export interface ToggleProps { checked: boolean; onChange: (v: boolean) => void; id?: string }

export function Toggle({ checked, onChange, id }: ToggleProps) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${checked ? 'bg-cms-accent' : 'bg-cms-surface'}`}
    >
      <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform duration-200 ${checked ? 'translate-x-4' : ''}`} />
    </button>
  )
}

/* --- NumberField --- */
export interface NumberFieldProps { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }

export function NumberField({ value, onChange, min = 0, max = 100, step = 1, suffix }: NumberFieldProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(value + step)) }
    if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - step)) }
  }
  return (
    <div className="inline-flex items-center gap-1" role="spinbutton" aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}
      aria-valuetext={suffix ? `${value} ${suffix}` : String(value)} tabIndex={0} onKeyDown={handleKey}>
      <button type="button" onClick={() => onChange(clamp(value - step))} className="size-6 rounded bg-cms-surface text-cms-text-muted hover:text-cms-text flex items-center justify-center" aria-label="Decrease">-</button>
      <span className="min-w-[2.5rem] text-center text-xs font-mono">{value}{suffix && <span className="text-cms-text-dim ml-0.5">{suffix}</span>}</span>
      <button type="button" onClick={() => onChange(clamp(value + step))} className="size-6 rounded bg-cms-surface text-cms-text-muted hover:text-cms-text flex items-center justify-center" aria-label="Increase">+</button>
    </div>
  )
}

/* --- CheckRow --- */
export interface CheckRowProps { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }

export function CheckRow({ checked, onChange, label, hint }: CheckRowProps) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 py-1.5 cursor-pointer group">
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-cms-border accent-cms-accent transition-colors duration-150" />
      <span className="flex-1">
        <span className="text-xs text-cms-text">{label}</span>
        {hint && <span className="block text-2xs text-cms-text-dim mt-0.5">{hint}</span>}
      </span>
    </label>
  )
}

/* --- Slider --- */
export interface SliderProps { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string }

export function Slider({ value, onChange, min = 0, max = 100, step = 1, format }: SliderProps) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-valuetext={format ? format(value) : String(value)}
        className="flex-1 h-1 rounded-full appearance-none bg-cms-surface accent-cms-accent" />
      <span className="text-xs font-mono text-cms-text-muted min-w-[2.5rem] text-right">{format ? format(value) : value}</span>
    </div>
  )
}

/* --- CfgRow --- */
export interface CfgRowProps { label: string; htmlFor?: string; children: React.ReactNode; hint?: string }

export function CfgRow({ label, htmlFor, children, hint }: CfgRowProps) {
  const id = useId()
  const labelId = htmlFor ?? id
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex-1 min-w-0">
        <label id={labelId} htmlFor={htmlFor} className="text-xs text-cms-text">{label}</label>
        {hint && <p className="text-2xs text-cms-text-dim mt-0.5">{hint}</p>}
      </div>
      <div aria-labelledby={labelId}>{children}</div>
    </div>
  )
}

/* --- SectionLabel --- */
export interface SectionLabelProps { children: React.ReactNode; as?: 'h2' | 'h3' | 'h4' | 'div'; right?: React.ReactNode }

export function SectionLabel({ children, as: Tag = 'h3', right }: SectionLabelProps) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <Tag className="text-xs font-semibold uppercase tracking-wider text-cms-text-dim">{children}</Tag>
      {right && <div>{right}</div>}
    </div>
  )
}

/* --- Legend --- */
export interface LegendProps { items: Array<{ label: string; color: string }> }

export function Legend({ items }: LegendProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map(it => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-2xs text-cms-text-muted">
          <span className="size-2.5 rounded-sm shrink-0" style={{ backgroundColor: it.color }} aria-hidden="true" />
          {it.label}
        </span>
      ))}
    </div>
  )
}
```

**Run:** `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -3` -- expects `0 errors`.

**Commit:** `git add 'apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-primitives.tsx' && git commit -m "feat(ab-lab): 12 shared primitive components"`

---

### Task 9: Write ab-primitives.test.tsx (~56 scenarios, 2 files)

**Create:** `apps/web/test/youtube/ab-primitives-basic.test.tsx` (VChip, Badge, InfoTip, TypeBadge -- ~24 scenarios)
**Create:** `apps/web/test/youtube/ab-primitives-controls.test.tsx` (Seg, Toggle, NumberField, CheckRow, Slider, CfgRow, SectionLabel, Legend -- ~32 scenarios)

- [ ] Test VChip renders letter, aria-label, role=button when onClick, ring style (5)
- [ ] Test Badge renders children, 6 tones, dot animation class (7)
- [ ] Test InfoTip shows tooltip on click, hides on Escape, has role=tooltip (5)
- [ ] Test TypeBadge renders icon + label for each TestType (4+1=5)
- [ ] Test Seg role=radiogroup, aria-checked, onClick fires onChange, roving tabindex (6)
- [ ] Test Toggle role=switch, aria-checked, click toggles (4)
- [ ] Test NumberField role=spinbutton, aria-valuenow, clamps to min/max, ArrowUp/Down (6)
- [ ] Test CheckRow renders label+hint, checkbox toggles (4)
- [ ] Test Slider renders range input, aria-valuetext with format (4)
- [ ] Test CfgRow renders label + children, htmlFor wiring (3)
- [ ] Test SectionLabel renders heading tag via as prop, right content (4)
- [ ] Test Legend renders swatches with colors (3)

```tsx
// ab-primitives-basic.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VChip, Badge, InfoTip, TypeBadge } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-primitives'

describe('VChip', () => {
  it('renders the label letter', () => { render(<VChip label="A" />); expect(screen.getByText('A')).toBeDefined() })
  it('has aria-label', () => { render(<VChip label="B" />); expect(screen.getByLabelText('Variant B')).toBeDefined() })
  it('renders as button when onClick provided', () => {
    const fn = vi.fn()
    render(<VChip label="C" onClick={fn} />)
    fireEvent.click(screen.getByRole('button'))
    expect(fn).toHaveBeenCalledOnce()
  })
  it('renders as span when no onClick', () => { const { container } = render(<VChip label="D" />); expect(container.querySelector('button')).toBeNull() })
  it('applies ring style', () => { const { container } = render(<VChip label="A" ring />); expect(container.firstElementChild?.getAttribute('style')).toContain('box-shadow') })
})

describe('Badge', () => {
  it('renders children', () => { render(<Badge>Active</Badge>); expect(screen.getByText('Active')).toBeDefined() })
  it('applies neutral tone by default', () => { const { container } = render(<Badge>X</Badge>); expect(container.firstElementChild?.className).toContain('bg-cms-surface') })
  it('applies accent tone', () => { const { container } = render(<Badge tone="accent">X</Badge>); expect(container.firstElementChild?.className).toContain('bg-cms-accent-subtle') })
  it('applies green tone', () => { const { container } = render(<Badge tone="green">X</Badge>); expect(container.firstElementChild?.className).toContain('bg-cms-green-subtle') })
  it('applies amber tone', () => { const { container } = render(<Badge tone="amber">X</Badge>); expect(container.firstElementChild?.className).toContain('bg-cms-amber-subtle') })
  it('applies live tone', () => { const { container } = render(<Badge tone="live">X</Badge>); expect(container.firstElementChild?.className).toContain('bg-cms-red-subtle') })
  it('renders dot with pulse class', () => { const { container } = render(<Badge dot>X</Badge>); expect(container.querySelector('.animate-ab-slot-pulse')).not.toBeNull() })
})

describe('InfoTip', () => {
  it('shows ? button', () => { render(<InfoTip text="Help" />); expect(screen.getByText('?')).toBeDefined() })
  it('shows tooltip on click', () => {
    render(<InfoTip text="Explanation" />)
    fireEvent.click(screen.getByText('?'))
    expect(screen.getByRole('tooltip')).toBeDefined()
    expect(screen.getByText('Explanation')).toBeDefined()
  })
  it('hides tooltip on Escape', () => {
    render(<InfoTip text="Help" />)
    fireEvent.click(screen.getByText('?'))
    expect(screen.getByRole('tooltip')).toBeDefined()
    fireEvent.keyDown(screen.getByText('?').parentElement!, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
  it('has aria-describedby when open', () => {
    render(<InfoTip text="Help" />)
    fireEvent.click(screen.getByText('?'))
    const btn = screen.getByText('?')
    expect(btn.getAttribute('aria-describedby')).toBeTruthy()
  })
  it('no aria-describedby when closed', () => {
    render(<InfoTip text="Help" />)
    expect(screen.getByText('?').getAttribute('aria-describedby')).toBeNull()
  })
})

describe('TypeBadge', () => {
  it('renders thumbnail label', () => { render(<TypeBadge type="thumbnail" />); expect(screen.getByText('Thumbnail')).toBeDefined() })
  it('renders title label', () => { render(<TypeBadge type="title" />); expect(screen.getByText('Title')).toBeDefined() })
  it('renders description label', () => { render(<TypeBadge type="description" />); expect(screen.getByText('Description')).toBeDefined() })
  it('renders combo label', () => { render(<TypeBadge type="combo" />); expect(screen.getByText('Combo')).toBeDefined() })
})
```

```tsx
// ab-primitives-controls.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Seg, Toggle, NumberField, CheckRow, Slider, CfgRow, SectionLabel, Legend } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-primitives'

describe('Seg', () => {
  const opts = ['a', 'b', 'c'] as const
  it('renders radiogroup', () => { render(<Seg options={opts} value="a" onChange={() => {}} />); expect(screen.getByRole('radiogroup')).toBeDefined() })
  it('marks selected as aria-checked', () => {
    render(<Seg options={opts} value="b" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'b' }).getAttribute('aria-checked')).toBe('true')
  })
  it('marks others as not checked', () => {
    render(<Seg options={opts} value="b" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'a' }).getAttribute('aria-checked')).toBe('false')
  })
  it('calls onChange on click', () => {
    const fn = vi.fn()
    render(<Seg options={opts} value="a" onChange={fn} />)
    fireEvent.click(screen.getByRole('radio', { name: 'c' }))
    expect(fn).toHaveBeenCalledWith('c')
  })
  it('uses custom labels', () => { render(<Seg options={opts} value="a" onChange={() => {}} labels={{ a: 'Alpha' }} />); expect(screen.getByText('Alpha')).toBeDefined() })
  it('selected has tabIndex 0, others -1', () => {
    render(<Seg options={opts} value="b" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'b' }).tabIndex).toBe(0)
    expect(screen.getByRole('radio', { name: 'a' }).tabIndex).toBe(-1)
  })
})

describe('Toggle', () => {
  it('has role=switch', () => { render(<Toggle checked={false} onChange={() => {}} />); expect(screen.getByRole('switch')).toBeDefined() })
  it('reflects aria-checked=true', () => { render(<Toggle checked onChange={() => {}} />); expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true') })
  it('reflects aria-checked=false', () => { render(<Toggle checked={false} onChange={() => {}} />); expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false') })
  it('calls onChange with opposite value', () => {
    const fn = vi.fn()
    render(<Toggle checked={false} onChange={fn} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(fn).toHaveBeenCalledWith(true)
  })
})

describe('NumberField', () => {
  it('has role=spinbutton', () => { render(<NumberField value={5} onChange={() => {}} />); expect(screen.getByRole('spinbutton')).toBeDefined() })
  it('shows current value', () => { render(<NumberField value={7} onChange={() => {}} />); expect(screen.getByText('7')).toBeDefined() })
  it('increments on + click', () => {
    const fn = vi.fn()
    render(<NumberField value={5} onChange={fn} />)
    fireEvent.click(screen.getByLabelText('Increase'))
    expect(fn).toHaveBeenCalledWith(6)
  })
  it('decrements on - click', () => {
    const fn = vi.fn()
    render(<NumberField value={5} onChange={fn} />)
    fireEvent.click(screen.getByLabelText('Decrease'))
    expect(fn).toHaveBeenCalledWith(4)
  })
  it('clamps to max', () => {
    const fn = vi.fn()
    render(<NumberField value={10} max={10} onChange={fn} />)
    fireEvent.click(screen.getByLabelText('Increase'))
    expect(fn).toHaveBeenCalledWith(10)
  })
  it('has aria-valuenow', () => { render(<NumberField value={3} onChange={() => {}} />); expect(screen.getByRole('spinbutton').getAttribute('aria-valuenow')).toBe('3') })
})

describe('CheckRow', () => {
  it('renders label text', () => { render(<CheckRow checked={false} onChange={() => {}} label="Auto" />); expect(screen.getByText('Auto')).toBeDefined() })
  it('renders hint', () => { render(<CheckRow checked={false} onChange={() => {}} label="X" hint="Details" />); expect(screen.getByText('Details')).toBeDefined() })
  it('toggles checkbox', () => {
    const fn = vi.fn()
    render(<CheckRow checked={false} onChange={fn} label="Auto" />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(fn).toHaveBeenCalledWith(true)
  })
  it('checkbox reflects checked state', () => {
    render(<CheckRow checked onChange={() => {}} label="X" />)
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
  })
})

describe('Slider', () => {
  it('renders range input', () => { render(<Slider value={50} onChange={() => {}} />); expect(screen.getByRole('slider')).toBeDefined() })
  it('shows formatted value', () => { render(<Slider value={95} onChange={() => {}} format={v => `${v}%`} />); expect(screen.getByText('95%')).toBeDefined() })
  it('calls onChange with number', () => {
    const fn = vi.fn()
    render(<Slider value={50} onChange={fn} />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '75' } })
    expect(fn).toHaveBeenCalledWith(75)
  })
  it('has aria-valuetext', () => {
    render(<Slider value={50} onChange={() => {}} format={v => `${v}%`} />)
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('50%')
  })
})

describe('CfgRow', () => {
  it('renders label', () => { render(<CfgRow label="Duration"><span>ctrl</span></CfgRow>); expect(screen.getByText('Duration')).toBeDefined() })
  it('renders children', () => { render(<CfgRow label="X"><span>ctrl</span></CfgRow>); expect(screen.getByText('ctrl')).toBeDefined() })
  it('renders hint', () => { render(<CfgRow label="X" hint="Help"><span>c</span></CfgRow>); expect(screen.getByText('Help')).toBeDefined() })
})

describe('SectionLabel', () => {
  it('renders as h3 by default', () => { const { container } = render(<SectionLabel>Title</SectionLabel>); expect(container.querySelector('h3')?.textContent).toBe('Title') })
  it('renders as h2 when specified', () => { const { container } = render(<SectionLabel as="h2">Title</SectionLabel>); expect(container.querySelector('h2')).not.toBeNull() })
  it('renders right content', () => { render(<SectionLabel right={<span>R</span>}>T</SectionLabel>); expect(screen.getByText('R')).toBeDefined() })
  it('renders as div', () => { const { container } = render(<SectionLabel as="div">T</SectionLabel>); expect(container.querySelector('div div')).not.toBeNull() })
})

describe('Legend', () => {
  it('renders all items', () => { render(<Legend items={[{ label: 'A', color: '#888' }, { label: 'B', color: '#f00' }]} />); expect(screen.getByText('A')).toBeDefined(); expect(screen.getByText('B')).toBeDefined() })
  it('applies color to swatch', () => {
    const { container } = render(<Legend items={[{ label: 'X', color: '#abc' }]} />)
    const swatch = container.querySelector('[aria-hidden="true"]')
    expect(swatch?.getAttribute('style')).toContain('#abc')
  })
  it('renders empty for no items', () => { const { container } = render(<Legend items={[]} />); expect(container.querySelectorAll('span > span').length).toBe(0) })
})
```

**Run:** `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --run test/youtube/ab-primitives-basic.test.tsx test/youtube/ab-primitives-controls.test.tsx` -- expects 56 passed.

**Commit:** `git add apps/web/test/youtube/ab-primitives-basic.test.tsx apps/web/test/youtube/ab-primitives-controls.test.tsx && git commit -m "test(ab-lab): 56 scenarios for ab-primitives"`

---

### Task 10: Create index.ts barrel export

**Create:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/index.ts`

- [ ] Re-export from ab-constants, chart-utils, ab-primitives

```typescript
export * from './ab-constants'
export * from './chart-utils'
export * from './ab-primitives'
```

**Run:** `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -3` -- expects `0 errors`.

**Commit:** `git add 'apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/index.ts' && git commit -m "feat(ab-lab): barrel export for foundation components"`

---

### Task 11: Split actions.ts into queries.ts + actions.ts

**Create:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/queries.ts`
**Modify:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`

- [ ] Move 5 read functions to `queries.ts` (no `'use server'` directive): `getAbTestsForSite`, `getTestResults`, `getAbSiteSettings`, `getEligibleVideosForPicker`, `getVideoTestHistory`
- [ ] Keep `fetchAbBriefingData` and `fetchAbTestVariants` in `actions.ts` (called from client via `startTransition`)
- [ ] Keep all mutation functions in `actions.ts`
- [ ] Update imports in all consumers: `ab-lab-dashboard.tsx`, `ab-test-detail.tsx`, `ab-settings-panel.tsx`, `ab-video-picker.tsx`, `ab-video-history.tsx`
- [ ] `queries.ts` has NO directive -- pure async functions that can be called from server components directly

```typescript
// queries.ts -- no 'use server', reads only
import { getSiteContext } from '@/lib/site/site-context'
import { getSupabaseServerClient } from '@/lib/supabase/server'
// ... (move the 5 functions with their full implementation)
```

**Run:** `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -3` -- expects `0 errors`.
**Run:** `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --run` -- expects all existing tests still pass.

**Commit:** `git add 'apps/web/src/app/cms/(authed)/youtube/ab-lab/queries.ts' 'apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts' 'apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/'*.tsx && git commit -m "refactor(ab-lab): split actions.ts into queries.ts + actions.ts"`

---

### Task 12: Add Zod schemas to ab-schemas.ts

**Modify:** `apps/web/src/lib/youtube/ab-schemas.ts`

- [ ] Add `AbTestConfigSchema` matching `AbTestConfig` interface
- [ ] Add `AbTestSiteSettingsSchema` matching `AbTestSiteSettings` interface
- [ ] Add `createAbTestSchema` for test creation validation
- [ ] Add `updateSettingsSchema` for settings updates

```typescript
// Append to existing ab-schemas.ts

export const AbTestConfigSchema = z.object({
  max_duration_days: z.number().int().min(7).max(28),
  confidence_threshold: z.number().min(0.80).max(0.99),
  burn_in_days: z.number().int().min(0).max(3),
  auto_apply_winner: z.boolean(),
  rotation_pattern: z.enum(['abba', 'round_robin', 'random']),
  stability_threshold: z.number().int().min(1).max(10),
})

export const AbTestSiteSettingsSchema = z.object({
  default_duration_days: z.number().int().min(7).max(28),
  default_confidence: z.number().min(0.80).max(0.99),
  default_auto_apply: z.boolean(),
  default_burn_in_days: z.number().int().min(0).max(3),
  ctr_drop_trigger: z.object({
    enabled: z.boolean(),
    threshold_percent: z.number().min(1).max(100),
    min_days_below: z.number().int().min(1).max(30),
  }),
  post_publish_trigger: z.object({
    enabled: z.boolean(),
    delay_hours: z.number().min(1).max(168),
    requires_pipeline_thumbs: z.boolean(),
  }),
  notifications: z.object({
    test_completed: z.boolean(),
    test_auto_paused: z.boolean(),
    ctr_drop_alert: z.boolean(),
    daily_digest: z.boolean(),
  }),
})

export const createAbTestSchema = z.object({
  site_id: z.string().uuid(),
  youtube_video_id: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  test_type: TestTypeSchema.optional(),
  config: AbTestConfigSchema.partial().optional(),
})

export const updateSettingsSchema = AbTestSiteSettingsSchema.partial()
```

**Run:** `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --run test/youtube/ab-schemas.test.ts` -- expects existing + new pass.
**Run:** `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -3` -- expects `0 errors`.

**Commit:** `git add apps/web/src/lib/youtube/ab-schemas.ts && git commit -m "feat(ab-lab): add Zod schemas for test config and site settings"`

---

### Phase 1 Verification Gates

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run build:packages
npm run test:web
cd apps/web && npx tsc --noEmit
```

All must pass. Then the layer is complete and Phase 2 (Charts) can begin.

**Files created (6):**
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-constants.ts`
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-primitives.tsx`
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/chart-utils.ts`
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/index.ts`
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/queries.ts`
- `apps/web/test/youtube/ab-constants.test.ts`
- `apps/web/test/youtube/ab-chart-utils.test.ts`
- `apps/web/test/youtube/ab-primitives-basic.test.tsx`
- `apps/web/test/youtube/ab-primitives-controls.test.tsx`

**Files modified (3):**
- `apps/web/src/app/globals.css`
- `apps/web/src/lib/youtube/ab-types.ts`
- `apps/web/src/lib/youtube/ab-schemas.ts`
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`

---

## Phase 2: Charts (~8h)

**Depends on:** Phase 1 (Foundation) must be complete
**LOC:** ~1400 new, ~442 deleted (3 replaced), 1 modified

### Prerequisites

Phase 1 files must exist and export:
- `ab-constants.ts` -- `DisplayLabel`, `VARIANT_COLORS`, `toDisplayLabel()`, `variantColor()`, formatters
- `chart-utils.ts` -- `CHART`, `toX()`, `toY()`, `niceLine()`, `GridLines`, `XLabels`, `GradientDef`, `EndDot`
- `ab-primitives.tsx` -- `VChip`, `Legend`
- `index.ts` -- barrel export

Base path: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/`
Test path: `apps/web/test/`

---

### Task 13: confidence-chart.tsx (~150 LOC, ~45min)

Replaces `ab-confidence-trend.tsx` (175 LOC). Catmull-Rom spline + gradient area fill + dashed target line.

#### 13.1 RED -- Write failing tests first

File: `apps/web/test/ab-charts.test.tsx`

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

// Lucide mock -- all tests in this file share it
vi.mock('lucide-react', () =>
  new Proxy({}, {
    get: (_, name) =>
      name === '__esModule' ? true
        : (props: Record<string, unknown>) => <svg data-testid={`icon-${String(name)}`} {...props} />,
  }),
)

import { ConfidenceChart } from '@/app/cms/(authed)/youtube/ab-lab/_components/confidence-chart'

afterEach(() => cleanup())

describe('ConfidenceChart', () => {
  it('renders SVG with correct viewBox', () => {
    const { container } = render(<ConfidenceChart data={[50, 65, 78]} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 620 200')
  })

  it('renders dashed target line at default 95%', () => {
    const { container } = render(<ConfidenceChart data={[50, 60]} />)
    const lines = container.querySelectorAll('line[stroke-dasharray]')
    const targetLine = Array.from(lines).find(l => l.getAttribute('stroke') === '#22c55e')
    expect(targetLine).toBeTruthy()
  })

  it('renders custom target line', () => {
    const { container } = render(<ConfidenceChart data={[50]} target={80} />)
    const texts = container.querySelectorAll('text')
    const targetLabel = Array.from(texts).find(t => t.textContent === '80%')
    expect(targetLabel).toBeTruthy()
  })

  it('renders placeholder when data is empty', () => {
    const { container } = render(<ConfidenceChart data={[]} />)
    const text = container.querySelector('text')
    expect(text?.textContent).toContain('No data')
  })

  it('renders single dot for 1-point data', () => {
    const { container } = render(<ConfidenceChart data={[42]} />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(1)
    // No path should be rendered for single point
    const path = container.querySelector('path[d]')
    expect(path?.getAttribute('d') || '').not.toContain('C') // no cubic bezier
  })

  it('filters NaN values from data', () => {
    const { container } = render(<ConfidenceChart data={[50, NaN, 70, NaN, 90]} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    // Should render without error
  })

  it('EndDot turns green when last value >= target', () => {
    const { container } = render(<ConfidenceChart data={[50, 70, 96]} target={95} />)
    const circles = container.querySelectorAll('circle')
    const lastCircle = circles[circles.length - 1]
    // EndDot uses green fill when reached
    expect(lastCircle?.getAttribute('fill')).toContain('#22c55e')
  })

  it('includes sr-only data table', () => {
    const { container } = render(<ConfidenceChart data={[50, 60, 70]} />)
    const table = container.querySelector('table.sr-only')
    expect(table).toBeTruthy()
    const rows = table?.querySelectorAll('tr')
    // header + 3 data rows
    expect(rows?.length).toBe(4)
  })
})
```

#### 13.2 GREEN -- Implement component

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/confidence-chart.tsx`

Implement the full `ConfidenceChart` component with: SVG viewBox `0 0 620 200`, NaN filtering via `useMemo`, empty state placeholder text, Catmull-Rom spline via `niceLine()`, gradient area fill, dashed green target line at configurable threshold, `EndDot` that turns green when reached, tooltip hitboxes with hover state, sr-only data table for accessibility.

#### 13.3 REFACTOR -- Verify

```bash
npm run test:web -- --run test/ab-charts.test.tsx
```

---

### Task 14: multi-line.tsx (~170 LOC, ~45min)

Replaces `ab-daily-ctr-chart.tsx` (140 LOC). Multi-series Catmull-Rom lines, vertical crosshair tooltip.

#### 14.1 RED -- Append to ab-charts.test.tsx

```tsx
import { MultiLine } from '@/app/cms/(authed)/youtube/ab-lab/_components/multi-line'

describe('MultiLine', () => {
  const colors = { A: '#8A8F98', B: '#E8823C', C: '#3FA9C0', D: '#A77CE8' } as const

  it('renders one path per series', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [3, 4, 5], B: [2, 3, 4] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    const paths = container.querySelectorAll('path[stroke]')
    expect(paths.length).toBe(2)
  })

  it('renders end dots per series', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [3, 4, 5], B: [2, 3, 4] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(2)
  })

  it('auto-scales Y with 0.6 padding', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [10, 20], B: [15, 25] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
  })

  it('uses shortest common length for different-length series', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [1, 2, 3, 4, 5], B: [10, 20, 30] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    // Both paths should exist
    const paths = container.querySelectorAll('path[stroke]')
    expect(paths.length).toBe(2)
  })

  it('renders sr-only table', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [3, 4], B: [5, 6] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    expect(container.querySelector('table.sr-only')).toBeTruthy()
  })

  it('renders nothing for empty series', () => {
    const { container } = render(
      <MultiLine series={{} as Record<DisplayLabel, number[]>} colors={colors} />,
    )
    const text = container.querySelector('text')
    expect(text?.textContent).toContain('No data')
  })
})
```

#### 14.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/multi-line.tsx`

Implement `MultiLine` component with: per-series Catmull-Rom paths via `niceLine()`, auto-scaled Y axis with 0.6 range padding, shortest-common-length alignment for different-length series, end dots per series, vertical crosshair tooltip on hover, sr-only data table, empty state text.

---

### Task 15: abba-timeline.tsx (~100 LOC, ~30min)

Replaces `ab-rotation-timeline.tsx` (127 LOC). Flex row of colored letter blocks.

#### 15.1 RED -- Append to ab-charts.test.tsx

```tsx
import { ABBATimeline } from '@/app/cms/(authed)/youtube/ab-lab/_components/abba-timeline'

describe('ABBATimeline', () => {
  it('renders correct number of blocks', () => {
    const { container } = render(
      <ABBATimeline seq={['A', 'B', 'B', 'A']} total={4} done={2} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    const blocks = container.querySelectorAll('[data-block]')
    expect(blocks.length).toBe(4)
  })

  it('marks done blocks with full color', () => {
    const { container } = render(
      <ABBATimeline seq={['A', 'B']} total={2} done={1} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    const blocks = container.querySelectorAll('[data-block]')
    expect(blocks[0]?.getAttribute('style')).toContain('#8A8F98')
  })

  it('marks pending blocks with low opacity', () => {
    const { container } = render(
      <ABBATimeline seq={['A', 'B']} total={2} done={0} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    const blocks = container.querySelectorAll('[data-block]')
    expect(blocks[0]?.getAttribute('style')).toContain('opacity')
  })

  it('shows footer with cycle count', () => {
    const { getByText } = render(
      <ABBATimeline seq={['A', 'B', 'B', 'A']} total={4} done={2} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    expect(getByText(/2\/4/)).toBeTruthy()
  })

  it('highlights next variant block with dashed border', () => {
    const { container } = render(
      <ABBATimeline
        seq={['A', 'B', 'B', 'A']} total={4} done={2}
        colors={{ A: '#8A8F98', B: '#E8823C' }}
        nextVariant="B"
      />,
    )
    const dashed = container.querySelector('[data-next]')
    expect(dashed).toBeTruthy()
  })

  it('enables horizontal scroll for 50+ blocks', () => {
    const seq = Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? 'A' : 'B') as DisplayLabel)
    const { container } = render(
      <ABBATimeline seq={seq} total={60} done={30} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    const wrapper = container.querySelector('[data-scroll]')
    expect(wrapper).toBeTruthy()
  })
})
```

#### 15.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/abba-timeline.tsx`

Implement `ABBATimeline` component with: flex row of colored blocks (`data-block`), done blocks at full opacity, pending at 0.4 opacity, next block with dashed border (`data-next`), footer with cycle count text, horizontal scroll wrapper (`data-scroll`) when total >= 50.

---

### Task 16: gauge.tsx (~110 LOC, ~30min)

Radial SVG arc with centered text overlay.

#### 16.1 RED -- Append to ab-charts.test.tsx

```tsx
import { Gauge } from '@/app/cms/(authed)/youtube/ab-lab/_components/gauge'

describe('Gauge', () => {
  it('renders with role="meter"', () => {
    const { container } = render(<Gauge value={75} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter).toBeTruthy()
    expect(meter?.getAttribute('aria-valuenow')).toBe('75')
  })

  it('sets aria-valuemin and aria-valuemax', () => {
    const { container } = render(<Gauge value={50} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuemin')).toBe('0')
    expect(meter?.getAttribute('aria-valuemax')).toBe('100')
  })

  it('clamps value to 0-100', () => {
    const { container } = render(<Gauge value={150} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuenow')).toBe('100')
  })

  it('treats NaN as 0', () => {
    const { container } = render(<Gauge value={NaN} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuenow')).toBe('0')
  })

  it('turns green when value >= target', () => {
    const { container } = render(<Gauge value={96} target={95} />)
    const arc = container.querySelector('[data-arc]')
    expect(arc?.getAttribute('stroke')).toBe('var(--cms-green)')
  })

  it('renders value text', () => {
    const { getByText } = render(<Gauge value={88} />)
    expect(getByText('88%')).toBeTruthy()
  })
})
```

#### 16.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/gauge.tsx`

Implement `Gauge` component with: `role="meter"` with `aria-valuenow/min/max`, SVG circular track + colored arc, value clamped to 0-100 (NaN treated as 0), arc turns green when value >= target, target tick mark, centered text overlay with percentage.

---

### Task 17: credible-interval.tsx (~120 LOC, ~30min)

95% CI bands with mean dot per variant (CSS layout, not SVG).

#### 17.1 RED -- Append to ab-charts.test.tsx

```tsx
import { CredibleInterval } from '@/app/cms/(authed)/youtube/ab-lab/_components/credible-interval'

describe('CredibleInterval', () => {
  const variants: StatsVariant[] = [
    { label: 'A', color: '#8A8F98', ctr: 0.05, impressions: 10000 },
    { label: 'B', color: '#E8823C', ctr: 0.07, impressions: 10000 },
  ]

  it('renders one row per variant', () => {
    const { container } = render(<CredibleInterval variants={variants} />)
    const rows = container.querySelectorAll('[data-ci-row]')
    expect(rows.length).toBe(2)
  })

  it('skips variants with 0 impressions', () => {
    const withZero = [...variants, { label: 'C' as DisplayLabel, color: '#3FA9C0', ctr: 0.04, impressions: 0 }]
    const { container } = render(<CredibleInterval variants={withZero} />)
    const rows = container.querySelectorAll('[data-ci-row]')
    expect(rows.length).toBe(2)
  })

  it('highlights leader with ring on VChip', () => {
    const { container } = render(<CredibleInterval variants={variants} leader="B" />)
    const ring = container.querySelector('[data-leader-ring]')
    expect(ring).toBeTruthy()
  })

  it('renders single variant without error', () => {
    const { container } = render(
      <CredibleInterval variants={[variants[0]!]} />,
    )
    const rows = container.querySelectorAll('[data-ci-row]')
    expect(rows.length).toBe(1)
  })

  it('renders mean dot for each row', () => {
    const { container } = render(<CredibleInterval variants={variants} />)
    const dots = container.querySelectorAll('[data-mean-dot]')
    expect(dots.length).toBe(2)
  })
})
```

#### 17.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/credible-interval.tsx`

Implement `CredibleInterval` component with: one row per variant (`data-ci-row`), 95% CI computed from `sqrt(p*(1-p)/n)`, variants with 0 impressions skipped, proportional band positioning, mean dot (`data-mean-dot`), leader ring (`data-leader-ring`), animated transitions.

---

### Task 18: rank-bars.tsx (~80 LOC, ~20min)

Horizontal bars for P(best) or P(top-2) sorted descending.

#### 18.1 RED -- Append to ab-charts.test.tsx

```tsx
import { RankBars } from '@/app/cms/(authed)/youtube/ab-lab/_components/rank-bars'

describe('RankBars', () => {
  const variants = [
    { label: 'A' as DisplayLabel, color: '#8A8F98', pBest: 0.15, pTop2: 0.45 },
    { label: 'B' as DisplayLabel, color: '#E8823C', pBest: 0.85, pTop2: 0.95 },
  ]

  it('renders bars sorted descending by pBest', () => {
    const { container } = render(<RankBars variants={variants} />)
    const labels = container.querySelectorAll('[data-rank-label]')
    expect(labels[0]?.textContent).toBe('B')
    expect(labels[1]?.textContent).toBe('A')
  })

  it('uses pTop2 when metric is pTop2', () => {
    const { container } = render(<RankBars variants={variants} metric="pTop2" />)
    const bars = container.querySelectorAll('[data-rank-bar]')
    expect(bars.length).toBe(2)
  })

  it('gives 0% bars a minimum 2px width', () => {
    const zeroVariants = [
      { label: 'A' as DisplayLabel, color: '#8A8F98', pBest: 0, pTop2: 0 },
    ]
    const { container } = render(<RankBars variants={zeroVariants} />)
    const bar = container.querySelector('[data-rank-bar]')
    expect(bar?.getAttribute('style')).toContain('2px')
  })

  it('clamps values over 100 to 100%', () => {
    const over = [
      { label: 'A' as DisplayLabel, color: '#8A8F98', pBest: 1.5, pTop2: 0.5 },
    ]
    const { container } = render(<RankBars variants={over} />)
    const bar = container.querySelector('[data-rank-bar]')
    expect(bar).toBeTruthy()
  })
})
```

#### 18.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/rank-bars.tsx`

Implement `RankBars` component with: horizontal bars sorted descending by selected metric, `data-rank-label` and `data-rank-bar` attributes, minimum 2px width for 0% bars, gradient fill, animated transitions.

---

### Task 19: radar-chart.tsx (~160 LOC, ~45min)

Spider chart with 5 axes, one polygon per variant.

#### 19.1 RED -- Append to ab-charts.test.tsx

```tsx
import { RadarChart } from '@/app/cms/(authed)/youtube/ab-lab/_components/radar-chart'

describe('RadarChart', () => {
  const variants = [
    { label: 'A' as DisplayLabel, color: '#8A8F98', ctr: 0.05, impressions: 10000,
      clicks: 500, pBest: 0.3, pTop2: 0.6, linkCtr: 0.02, retention: 0.45 },
    { label: 'B' as DisplayLabel, color: '#E8823C', ctr: 0.07, impressions: 10000,
      clicks: 700, pBest: 0.7, pTop2: 0.9, linkCtr: 0.03, retention: 0.55 },
  ]

  it('renders 4 grid rings', () => {
    const { container } = render(<RadarChart variants={variants} />)
    const polygons = container.querySelectorAll('polygon[data-grid]')
    expect(polygons.length).toBe(4)
  })

  it('renders one data polygon per variant', () => {
    const { container } = render(<RadarChart variants={variants} />)
    const polygons = container.querySelectorAll('polygon[data-variant]')
    expect(polygons.length).toBe(2)
  })

  it('renders nothing with fewer than 2 axes', () => {
    const { container } = render(
      <RadarChart
        variants={variants}
        axes={[{ key: 'ctr', label: 'CTR' }]}
      />,
    )
    expect(container.querySelector('svg')).toBeNull()
  })

  it('renders axis labels', () => {
    const { getByText } = render(<RadarChart variants={variants} />)
    expect(getByText('CTR')).toBeTruthy()
    expect(getByText('Win prob')).toBeTruthy()
  })

  it('handles axisMax=0 by mapping to center', () => {
    const zeroVariants = [
      { ...variants[0]!, ctr: 0, clicks: 0, pBest: 0, pTop2: 0 },
    ]
    const { container } = render(<RadarChart variants={zeroVariants} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
```

#### 19.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/radar-chart.tsx`

Implement `RadarChart` component with: 5 default axes (CTR, Retention, Link CTR, Win prob, Reach), 4 grid rings (`data-grid`), one data polygon per variant (`data-variant`), axis labels, vertex dots, returns null for fewer than 2 axes, handles axisMax=0 gracefully.

---

### Task 20: funnel-row.tsx (~80 LOC, ~20min)

3-stage horizontal funnel per variant.

#### 20.1 RED -- Append to ab-charts.test.tsx

```tsx
import { FunnelRow } from '@/app/cms/(authed)/youtube/ab-lab/_components/funnel-row'

describe('FunnelRow', () => {
  it('renders 3 stages with linkClicks', () => {
    const { container } = render(
      <FunnelRow variant={{ impressions: 1000, clicks: 50, linkClicks: 10, color: '#E8823C' }} />,
    )
    const bars = container.querySelectorAll('[data-funnel-bar]')
    expect(bars.length).toBe(3)
  })

  it('renders 2 stages without linkClicks', () => {
    const { container } = render(
      <FunnelRow variant={{ impressions: 1000, clicks: 50, color: '#E8823C' }} />,
    )
    const bars = container.querySelectorAll('[data-funnel-bar]')
    expect(bars.length).toBe(2)
  })

  it('uses minimum 3px for 0-impression stage', () => {
    const { container } = render(
      <FunnelRow variant={{ impressions: 0, clicks: 0, color: '#E8823C' }} />,
    )
    const bars = container.querySelectorAll('[data-funnel-bar]')
    expect(bars.length).toBe(2)
  })

  it('renders labels for each stage', () => {
    const { getByText } = render(
      <FunnelRow variant={{ impressions: 1000, clicks: 50, linkClicks: 10, color: '#E8823C' }} />,
    )
    expect(getByText('Impressions')).toBeTruthy()
    expect(getByText('Clicks')).toBeTruthy()
    expect(getByText('Link clicks')).toBeTruthy()
  })
})
```

#### 20.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/funnel-row.tsx`

Implement `FunnelRow` component with: 2-3 stages (Impressions, Clicks, optional Link clicks), proportional bars (`data-funnel-bar`), minimum 3px width, decreasing opacity per stage, animated transitions.

---

### Task 21: bayes-curves.tsx (~180 LOC, ~45min)

Gaussian PDF curves with full normalization.

#### 21.1 RED -- Write math tests + component tests

File: `apps/web/test/ab-chart-math.test.ts`

```ts
import { describe, it, expect } from 'vitest'

describe('Gaussian PDF math', () => {
  const gauss = (x: number, mean: number, sd: number) =>
    (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mean) / sd) ** 2)

  it('peaks at mean', () => {
    const peak = gauss(0.05, 0.05, 0.01)
    const offPeak = gauss(0.06, 0.05, 0.01)
    expect(peak).toBeGreaterThan(offPeak)
  })

  it('returns 0 height for sd=0', () => {
    expect(Number.isFinite(gauss(0.05, 0.05, 0))).toBe(false)
  })

  it('symmetric around mean', () => {
    const left = gauss(0.04, 0.05, 0.01)
    const right = gauss(0.06, 0.05, 0.01)
    expect(left).toBeCloseTo(right, 10)
  })

  it('higher impressions produce taller, narrower peaks', () => {
    const sdHigh = Math.sqrt(0.05 * 0.95 / 10000)
    const sdLow = Math.sqrt(0.05 * 0.95 / 1000)
    const peakHigh = gauss(0.05, 0.05, sdHigh)
    const peakLow = gauss(0.05, 0.05, sdLow)
    expect(peakHigh).toBeGreaterThan(peakLow)
  })

  it('produces finite values for extreme CTR (p=0.001)', () => {
    const sd = Math.sqrt(0.001 * 0.999 / 10000)
    const val = gauss(0.001, 0.001, sd)
    expect(Number.isFinite(val)).toBe(true)
  })
})

describe('Credible interval math', () => {
  it('computes 95% CI bounds correctly', () => {
    const p = 0.05
    const n = 10000
    const sd = Math.sqrt(p * (1 - p) / n)
    const lo = p - 1.96 * sd
    const hi = p + 1.96 * sd
    expect(lo).toBeGreaterThan(0)
    expect(hi).toBeLessThan(1)
    expect(hi - lo).toBeCloseTo(2 * 1.96 * sd, 6)
  })

  it('handles p=0 (no clicks)', () => {
    const p = 0
    const n = 1000
    const sd = Math.sqrt(p * (1 - p) / n)
    expect(sd).toBe(0)
  })

  it('handles p=1 (all clicks)', () => {
    const p = 1
    const n = 1000
    const sd = Math.sqrt(p * (1 - p) / n)
    expect(sd).toBe(0)
  })

  it('n=0 should produce NaN sd', () => {
    const p = 0.05
    const sd = Math.sqrt(p * (1 - p) / 0)
    expect(Number.isFinite(sd)).toBe(false)
  })
})

describe('Z-score edge cases', () => {
  it('z=0 for identical CTRs', () => {
    const pA = 0.05, pB = 0.05, n = 10000
    const pPool = (pA * n + pB * n) / (2 * n)
    const se = Math.sqrt(pPool * (1 - pPool) * (1/n + 1/n))
    const z = (pB - pA) / se
    expect(z).toBe(0)
  })

  it('handles division by zero in se', () => {
    const se = Math.sqrt(0 * 1 * (1/100 + 1/100))
    expect(se).toBe(0)
  })

  it('large z produces p-value near 0', () => {
    const pA = 0.03, pB = 0.10, n = 50000
    const pPool = (pA * n + pB * n) / (2 * n)
    const se = Math.sqrt(pPool * (1 - pPool) * (2/n))
    const z = (pB - pA) / se
    expect(z).toBeGreaterThan(5)
  })
})

describe('Rank probability math', () => {
  it('pBest sums to ~1 across variants', () => {
    const probs = [0.7, 0.2, 0.1]
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5)
  })

  it('pTop2 >= pBest for every variant', () => {
    const pBest = 0.7
    const pTop2 = 0.9
    expect(pTop2).toBeGreaterThanOrEqual(pBest)
  })
})
```

Append BayesCurves component tests to `ab-charts.test.tsx`:

```tsx
import { BayesCurves } from '@/app/cms/(authed)/youtube/ab-lab/_components/bayes-curves'

describe('BayesCurves', () => {
  const variants: StatsVariant[] = [
    { label: 'A', color: '#8A8F98', ctr: 0.05, impressions: 10000 },
    { label: 'B', color: '#E8823C', ctr: 0.07, impressions: 10000 },
  ]

  it('renders one path per variant', () => {
    const { container } = render(<BayesCurves variants={variants} />)
    const paths = container.querySelectorAll('path[data-curve]')
    expect(paths.length).toBe(2)
  })

  it('renders dashed mean lines', () => {
    const { container } = render(<BayesCurves variants={variants} />)
    const meanLines = container.querySelectorAll('line[data-mean]')
    expect(meanLines.length).toBe(2)
  })

  it('skips variants with sd<=0', () => {
    const withZeroSD: StatsVariant[] = [
      ...variants,
      { label: 'C' as DisplayLabel, color: '#3FA9C0', ctr: 0, impressions: 1000 },
    ]
    const { container } = render(<BayesCurves variants={withZeroSD} />)
    const paths = container.querySelectorAll('path[data-curve]')
    expect(paths.length).toBe(2) // C skipped because ctr=0 => sd=0
  })

  it('skips variants with n=0', () => {
    const zeroN: StatsVariant[] = [
      { label: 'A' as DisplayLabel, color: '#8A8F98', ctr: 0.05, impressions: 0 },
    ]
    const { container } = render(<BayesCurves variants={zeroN} />)
    const paths = container.querySelectorAll('path[data-curve]')
    expect(paths.length).toBe(0)
  })

  it('renders sr-only table', () => {
    const { container } = render(<BayesCurves variants={variants} />)
    expect(container.querySelector('table.sr-only')).toBeTruthy()
  })

  it('renders gradient fill per curve', () => {
    const { container } = render(<BayesCurves variants={variants} />)
    const defs = container.querySelectorAll('linearGradient')
    expect(defs.length).toBeGreaterThanOrEqual(2)
  })
})
```

#### 21.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/bayes-curves.tsx`

Implement `BayesCurves` component with: Gaussian PDF computation, 90-sample curve per variant, global normalization, gradient fill per curve (`data-curve`), dashed mean lines (`data-mean`), skip variants with sd<=0 or n=0, sr-only data table, empty state.

---

### Task 22: dots.tsx (~40 LOC, ~10min)

Simple progress dots.

#### 22.1 RED -- Append to ab-charts.test.tsx

```tsx
import { Dots } from '@/app/cms/(authed)/youtube/ab-lab/_components/dots'

describe('Dots', () => {
  it('renders correct number of dots', () => {
    const { container } = render(<Dots total={5} done={3} />)
    const dots = container.querySelectorAll('[data-dot]')
    expect(dots.length).toBe(5)
  })

  it('fills done dots with color', () => {
    const { container } = render(<Dots total={3} done={2} color="#E8823C" />)
    const dots = container.querySelectorAll('[data-dot]')
    expect(dots[0]?.getAttribute('style')).toContain('#E8823C')
    expect(dots[1]?.getAttribute('style')).toContain('#E8823C')
  })

  it('renders nothing when total=0', () => {
    const { container } = render(<Dots total={0} done={0} />)
    const dots = container.querySelectorAll('[data-dot]')
    expect(dots.length).toBe(0)
  })

  it('clamps done to total', () => {
    const { container } = render(<Dots total={3} done={10} />)
    const dots = container.querySelectorAll('[data-dot]')
    const filled = Array.from(dots).filter(d => !d.getAttribute('style')?.includes('--cms-surface-3'))
    expect(filled.length).toBe(3)
  })

  it('has role="meter" with aria attributes', () => {
    const { container } = render(<Dots total={5} done={3} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuenow')).toBe('3')
    expect(meter?.getAttribute('aria-valuemin')).toBe('0')
    expect(meter?.getAttribute('aria-valuemax')).toBe('5')
  })
})
```

#### 22.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/dots.tsx`

Implement `Dots` component with: `role="meter"` + aria attributes, `data-dot` per dot, done clamped to total, colored fill for done dots, `var(--cms-surface-3)` for pending, returns null when total=0.

---

### Task 23: Update variant-heatmap-table.tsx imports (~5min)

- [ ] Replace local `VARIANT_COLORS` with import from `ab-constants`
- [ ] Update cell rendering to use inline `style={{ color }}` instead of Tailwind class names

Verify: after import changes, `next build` still passes.

---

### Task 24: Delete old files + update imports in ab-test-detail.tsx (~30min)

#### 24.1 Delete old chart files

```bash
rm apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-confidence-trend.tsx
rm apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-daily-ctr-chart.tsx
rm apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-rotation-timeline.tsx
```

#### 24.2 Update imports in ab-test-detail.tsx

- [ ] Replace `AbConfidenceTrend` with `ConfidenceChart` (data mapped to `evaluations.map(e => e.confidence * 100)`)
- [ ] Replace `AbRotationTimeline` with `ABBATimeline` (seq mapped via `toDisplayLabel`)
- [ ] Replace `AbDailyCtrChart` with `MultiLine` (series built from variant timeline data)
- [ ] Delete local `normalCdf` duplicate; import from `@/lib/youtube/ab-statistics`

#### 24.3 Update barrel export

Add all new charts to `_components/index.ts`:

```ts
export { ConfidenceChart } from './confidence-chart'
export { MultiLine } from './multi-line'
export { ABBATimeline } from './abba-timeline'
export { Gauge } from './gauge'
export { CredibleInterval } from './credible-interval'
export { RankBars } from './rank-bars'
export { RadarChart } from './radar-chart'
export { FunnelRow } from './funnel-row'
export { BayesCurves } from './bayes-curves'
export { Dots } from './dots'
```

---

### Task 25: Phase 2 verification gates

Run in sequence:

```bash
# 1. Run chart tests
npm run test:web -- --run test/ab-charts.test.tsx test/ab-chart-math.test.ts

# 2. Run all AB tests to ensure no regressions
npm run test:web -- --run test/ab-*.test.ts test/ab-*.test.tsx

# 3. Build packages (in case chart-utils is in packages/)
npm run build:packages

# 4. TypeCheck + Next build (pre-commit will also verify)
npx tsc --noEmit -p apps/web/tsconfig.json
```

**Pass criteria:**
- All 68+ chart test scenarios pass
- No `any` types in new files
- All 10 chart components export from `index.ts`
- `ab-test-detail.tsx` renders with new chart imports
- Old 3 chart files deleted
- `variant-heatmap-table.tsx` uses `VARIANT_COLORS` from `ab-constants`

**Phase 2 summary:**

| # | File | Action | LOC | Time |
|---|------|--------|-----|------|
| 13 | `confidence-chart.tsx` | Create (replaces ab-confidence-trend) | ~150 | 45min |
| 14 | `multi-line.tsx` | Create (replaces ab-daily-ctr-chart) | ~170 | 45min |
| 15 | `abba-timeline.tsx` | Create (replaces ab-rotation-timeline) | ~100 | 30min |
| 16 | `gauge.tsx` | Create | ~110 | 30min |
| 17 | `credible-interval.tsx` | Create | ~120 | 30min |
| 18 | `rank-bars.tsx` | Create | ~80 | 20min |
| 19 | `radar-chart.tsx` | Create | ~160 | 45min |
| 20 | `funnel-row.tsx` | Create | ~80 | 20min |
| 21 | `bayes-curves.tsx` | Create | ~180 | 45min |
| 22 | `dots.tsx` | Create | ~40 | 10min |
| 23 | `variant-heatmap-table.tsx` | Modify imports | ~5 | 5min |
| 24 | `ab-test-detail.tsx` | Update imports + usage | ~30 | 30min |
| 25 | Verification gate | -- | -- | 15min |
| -- | `ab-charts.test.tsx` | Create (~50 scenarios) | ~250 | -- |
| -- | `ab-chart-math.test.ts` | Create (~18 scenarios) | ~120 | -- |
| -- | 3 old chart files | Delete | -442 | 5min |
| **Total** | | | **~1400 new** | **~8h** |

---

## Phase 3: Dashboard + Settings (~8h)

**Prerequisites:** Phase 1 (ab-constants.ts, ab-primitives.tsx, chart-utils.ts, index.ts barrel, queries.ts split, ab-schemas.ts, globals.css keyframes) and Phase 2 (10 chart components) must be complete and passing.

**Base paths:**
- Types: `apps/web/src/lib/youtube/ab-types.ts`
- Queries: `apps/web/src/app/cms/(authed)/youtube/ab-lab/queries.ts` (created in Phase 1)
- Components: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/`
- Tests: `apps/web/test/`

---

### Task 26: Add new types to ab-types.ts (~20min)

**Test first** in `test/ab-dashboard-types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { DashboardStats, AbTestDraft, SuggestedVideo, LearningsData, LearningsTag, EligibleVideo, AbTestCardView } from '@/lib/youtube/ab-types'

describe('Dashboard types', () => {
  it('DashboardStats has all required fields', () => {
    const s: DashboardStats = { activeTests: 2, avgConfidence: 87, winRate: 60, avgLift: 12.3 }
    expect(s.activeTests).toBe(2)
    expect(s.avgConfidence).toBeGreaterThanOrEqual(0)
    expect(s.avgConfidence).toBeLessThanOrEqual(100)
  })
  it('AbTestCardView lift is percentage', () => {
    const c = { lift: 15.2 } as AbTestCardView
    expect(c.lift).toBeGreaterThan(0)
  })
  it('SuggestedVideo grade is A-F', () => {
    const g: SuggestedVideo['grade'] = 'D'
    expect(['A','B','C','D','F']).toContain(g)
  })
  it('LearningsTag negative flag defaults undefined', () => {
    const t: LearningsTag = { tag: 'face-close', wins: 3, avgLift: 8, kind: 'thumb' }
    expect(t.negative).toBeUndefined()
  })
  it('AbTestDraft step is 0-4', () => {
    const d = { step: 2 } as AbTestDraft
    expect(d.step).toBeGreaterThanOrEqual(0)
    expect(d.step).toBeLessThanOrEqual(4)
  })
})
```

**Implement:** Append 7 interfaces to `ab-types.ts` exactly as spec section 4.1 defines (DashboardStats, AbTestDraft, SuggestedVideo, LearningsTag, LearningsData, EligibleVideo, AbTestCardView). Import `DisplayLabel` from `_components/ab-constants` and `TestType`/`AbTestStatus` locally.

---

### Task 27: Add computed helpers to queries.ts (~45min)

**Test first** in `test/ab-dashboard-queries.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toCardView, toLatestDraft, computeDashboardStats } from '@cms-ab/queries'

describe('toCardView', () => {
  it('maps raw test to AbTestCardView with correct leader', () => {
    const test = makeTestWithVariants({ confidence: 0.92, variants: 2 })
    const card = toCardView(test)
    expect(card.leader).toBe('A')  // original is always A
    expect(card.leaderColor).toBe('#8A8F98')
    expect(card.confidence).toBeGreaterThan(0)
  })
  it('calculates lift as ((leaderCtr - baselineCtr) / baselineCtr) * 100', () => {
    const test = makeTestWithVariants({ variantCtr: [5.0, 6.0] })
    const card = toCardView(test)
    expect(card.lift).toBeCloseTo(20) // (6-5)/5*100
  })
  it('returns 0 lift when baseline CTR is 0', () => {
    const test = makeTestWithVariants({ variantCtr: [0, 0] })
    expect(toCardView(test).lift).toBe(0)
  })
  it('computes dayOf from started_at', () => {
    const test = makeTestWithVariants({ startedDaysAgo: 5 })
    expect(toCardView(test).dayOf).toBe(5)
  })
})

describe('toLatestDraft', () => {
  it('returns null for empty array', () => {
    expect(toLatestDraft([])).toBeNull()
  })
  it('picks most recent by created_at', () => {
    const drafts = [makeTestWithVariants({ createdAt: '2026-01-01' }), makeTestWithVariants({ createdAt: '2026-05-01' })]
    expect(toLatestDraft(drafts)!.createdAgo).toContain('ago')
  })
})

describe('computeDashboardStats', () => {
  it('returns all zeros when no tests', () => {
    const s = computeDashboardStats([], [])
    expect(s).toEqual({ activeTests: 0, avgConfidence: 0, winRate: 0, avgLift: 0 })
  })
  it('excludes playoff children from stats', () => {
    const completed = [makeTestWithVariants({ playoffTestId: 'x', confidence: 0.99 })]
    const s = computeDashboardStats([], completed)
    expect(s.winRate).toBe(0)
  })
  it('calculates winRate as percentage', () => {
    const completed = [makeTestWithVariants({ hasWinner: true }), makeTestWithVariants({ hasWinner: false })]
    expect(computeDashboardStats([], completed).winRate).toBe(50)
  })
})
```

**Implement:** Add `toCardView`, `toLatestDraft`, `computeDashboardStats` as pure exported functions in `queries.ts`. They consume `AbTestWithVariants` and produce the view types. Use `toDisplayLabel`/`variantColor` from `ab-constants`. Import `calculateBayesianConfidence` from `ab-statistics.ts` for leader detection.

---

### Task 28: Add getLearnings and getSuggestedVideos queries (~45min)

**Test first** in `test/ab-dashboard-queries.test.ts` (append):

```ts
describe('getLearnings', () => {
  it('returns null when fewer than 3 completed tests', async () => {
    mockSupabase({ completedCount: 2 })
    expect(await getLearnings('site-1')).toBeNull()
  })
  it('aggregates tags by kind and counts wins', async () => {
    mockSupabase({ completedCount: 5, tags: [{ tag: 'face-close', wins: 3 }] })
    const l = await getLearnings('site-1')
    expect(l!.tags[0].wins).toBe(3)
  })
  it('marks negative tags', async () => {
    mockSupabase({ completedCount: 5, tags: [{ tag: 'no-face', avgLift: -5, negative: true }] })
    const l = await getLearnings('site-1')
    expect(l!.tags.find(t => t.negative)).toBeTruthy()
  })
})

describe('getSuggestedVideos', () => {
  it('returns max 5 results', async () => {
    mockSupabase({ eligibleVideos: 10 })
    const s = await getSuggestedVideos('site-1')
    expect(s.length).toBeLessThanOrEqual(5)
  })
  it('only includes videos below channel median CTR', async () => {
    mockSupabase({ videos: [{ ctr: 2, median: 5 }, { ctr: 8, median: 5 }] })
    const s = await getSuggestedVideos('site-1')
    expect(s.every(v => v.ctr < v.channelMedianCtr)).toBe(true)
  })
  it('assigns grade based on CTR ratio', async () => {
    mockSupabase({ videos: [{ ctr: 1, median: 5 }] })
    const s = await getSuggestedVideos('site-1')
    expect(['D', 'F']).toContain(s[0].grade)
  })
})
```

**Implement:** Two async functions in `queries.ts`. `getLearnings` queries completed tests with `winner_variant_id IS NOT NULL`, extracts `metadata.thumbnail_tags`, aggregates by tag, computes win counts and avg lift per tag. `getSuggestedVideos` joins `youtube_videos` with channel stats, filters below-median CTR, assigns letter grades (A/B/C/D/F based on CTR-to-median ratio thresholds), caps at 5.

---

### Task 29: Build KPI component (~30min)

**Test first** in `test/ab-dashboard.test.tsx`:

```ts
describe('KPI', () => {
  it('renders label and formatted value', () => {
    render(<KPI label="Active tests" value={3} />)
    expect(screen.getByText('Active tests')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
  it('shows suffix when provided', () => {
    render(<KPI label="Win rate" value={60} suffix="%" />)
    expect(screen.getByText('%')).toBeInTheDocument()
  })
  it('renders delta with TrendingUp icon when positive', () => {
    render(<KPI label="Lift" value={12} delta={3.2} />)
    expect(screen.getByText('+3.2')).toBeInTheDocument()
  })
  it('hides sparkline when data is empty', () => {
    const { container } = render(<KPI label="X" value={0} spark={[]} />)
    expect(container.querySelector('svg.sparkline')).toBeNull()
  })
  it('sparkline SVG is aria-hidden', () => {
    const { container } = render(<KPI label="X" value={0} spark={[1,2,3]} />)
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeTruthy()
  })
})
```

**Implement:** `kpi.tsx` -- card with JetBrains Mono 700 30px value, optional inline SVG sparkline (120x28, polyline from `spark` array, absolute bottom-right), optional delta badge with Lucide TrendingUp/TrendingDown icon.

---

### Task 30: Build ActiveTestCard (~45min)

**Test first** (append to `test/ab-dashboard.test.tsx`):

```ts
describe('ActiveTestCard', () => {
  it('renders as article with tabIndex 0', () => {
    render(<ActiveTestCard test={makeCardView()} onOpen={vi.fn()} />)
    expect(screen.getByRole('article')).toHaveAttribute('tabIndex', '0')
  })
  it('calls onOpen on Enter key', async () => {
    const onOpen = vi.fn()
    render(<ActiveTestCard test={makeCardView()} onOpen={onOpen} />)
    await userEvent.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalled()
  })
  it('renders TypeBadge and day counter', () => {
    render(<ActiveTestCard test={makeCardView({ type: 'combo', dayOf: 7 })} onOpen={vi.fn()} />)
    expect(screen.getByText('Combo')).toBeInTheDocument()
    expect(screen.getByText('D7')).toBeInTheDocument()
  })
  it('title clamps to 2 lines', () => {
    const { container } = render(<ActiveTestCard test={makeCardView()} onOpen={vi.fn()} />)
    expect(container.querySelector('.line-clamp-2')).toBeTruthy()
  })
  it('leader thumbnail gets accent outline', () => {
    const card = makeCardView({ leaderIndex: 1 })
    const { container } = render(<ActiveTestCard test={card} onOpen={vi.fn()} />)
    const thumbs = container.querySelectorAll('[data-variant-thumb]')
    expect(thumbs[1]?.className).toContain('ring')
  })
  it('footer shows confidence, leader VChip+lift, next rotation', () => {
    render(<ActiveTestCard test={makeCardView({ confidence: 88, lift: 12.3 })} onOpen={vi.fn()} />)
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('+12.3%')).toBeInTheDocument()
  })
  it('shows playoff round badge when hasPlayoff', () => {
    render(<ActiveTestCard test={makeCardView({ hasPlayoff: true, roundNumber: 2 })} onOpen={vi.fn()} />)
    expect(screen.getByText('Round 2')).toBeInTheDocument()
  })
})
```

**Implement:** `active-test-card.tsx` -- `<article>` with click/keyboard handlers, Badge row (TypeBadge + live day counter + playoff round), 2-line clamp title, mini thumbnail grid (leader gets accent ring-2), footer 3-stat grid on `--cms-bg-side`.

---

### Task 31: Build CompletedRow (~30min)

**Test first:**

```ts
describe('CompletedRow', () => {
  it('renders as Link to detail page', () => {
    render(<CompletedRow test={makeCompleted()} onOpen={vi.fn()} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', expect.stringContaining('/ab-lab/'))
  })
  it('shows VChip for winner with green lift', () => {
    render(<CompletedRow test={makeCompleted({ winner: 'B', lift: 15 })} onOpen={vi.fn()} />)
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('+15.0%')).toBeInTheDocument()
  })
  it('shows amber badge for inconclusive', () => {
    render(<CompletedRow test={makeCompleted({ winner: null })} onOpen={vi.fn()} />)
    expect(screen.getByText('Inconclusive')).toBeInTheDocument()
  })
  it('renders 78px thumbnail', () => {
    const { container } = render(<CompletedRow test={makeCompleted()} onOpen={vi.fn()} />)
    expect(container.querySelector('img')).toHaveAttribute('width', '78')
  })
})
```

**Implement:** `completed-row.tsx` evolving `ab-test-completed-row.tsx`. Add 78px thumbnail, VChip for winner, use `toDisplayLabel` from ab-constants, green lift text or amber "Inconclusive" badge.

---

### Task 32: Build DraftsBlock (~25min)

**Test first:**

```ts
describe('DraftsBlock', () => {
  it('renders collapsed when chevron clicked', async () => {
    render(<DraftsBlock draft={makeDraft()} onContinue={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /drafts/i }))
    expect(screen.queryByText('Continue setup')).toBeNull()
  })
  it('trigger has aria-expanded', () => {
    render(<DraftsBlock draft={makeDraft()} onContinue={vi.fn()} />)
    expect(screen.getByRole('button', { name: /drafts/i })).toHaveAttribute('aria-expanded', 'true')
  })
  it('shows step progress', () => {
    render(<DraftsBlock draft={makeDraft({ step: 2 })} onContinue={vi.fn()} />)
    expect(screen.getByText('Stopped at step 2 of 5')).toBeInTheDocument()
  })
  it('calls onContinue when button clicked', async () => {
    const fn = vi.fn()
    render(<DraftsBlock draft={makeDraft()} onContinue={fn} />)
    await userEvent.click(screen.getByText('Continue setup'))
    expect(fn).toHaveBeenCalled()
  })
})
```

**Implement:** `drafts-block.tsx` -- collapsible card (default open), `<button>` trigger with `aria-expanded`, chevron rotates -90deg via CSS, body shows 86px thumbnail + title + step progress + "Continue setup" CTA.

---

### Task 33: Build LearningsPanel (~30min)

**Test first:**

```ts
describe('LearningsPanel', () => {
  it('shows "Complete 3+ tests" when data is null', () => {
    render(<LearningsPanel learnings={null} />)
    expect(screen.getByText(/Complete 3\+ tests/)).toBeInTheDocument()
  })
  it('renders win bars with role=meter', () => {
    render(<LearningsPanel learnings={makeLearnings({ tags: 3 })} />)
    expect(screen.getAllByRole('meter').length).toBe(3)
  })
  it('negative tags have strikethrough', () => {
    render(<LearningsPanel learnings={makeLearnings({ negativeTag: true })} />)
    expect(screen.getByText('no-text').className).toContain('line-through')
  })
  it('shows expand button when >20 tags', () => {
    render(<LearningsPanel learnings={makeLearnings({ tags: 25 })} />)
    expect(screen.getByText(/Show \d+ more/)).toBeInTheDocument()
  })
})
```

**Implement:** `learnings-panel.tsx` -- Card with Sparkles icon header, tag list with 5-segment win bars (`role="meter"`), avgLift colored green/red, strikethrough for negative tags, "Show N more" expand, insight box from top tags. Null learnings renders empty message.

---

### Task 34: Build EmptyState + SuggestedCard (~30min)

**Test first:**

```ts
describe('EmptyState', () => {
  it('tier 1: renders 3 SuggestedCards when 3+ suggestions', () => {
    render(<EmptyState suggested={makeSuggestions(3)} onCreate={vi.fn()} />)
    expect(screen.getAllByRole('article').length).toBe(3)
  })
  it('tier 3: renders single CTA when 0 suggestions', () => {
    render(<EmptyState suggested={[]} onCreate={vi.fn()} />)
    expect(screen.getByText('Start Your First Test')).toBeInTheDocument()
    expect(screen.queryByRole('article')).toBeNull()
  })
  it('hero has gradient background and Beaker watermark', () => {
    const { container } = render(<EmptyState suggested={makeSuggestions(3)} onCreate={vi.fn()} />)
    expect(container.querySelector('[data-hero]')).toBeTruthy()
  })
})

describe('SuggestedCard', () => {
  it('grade D gets red pill', () => {
    render(<SuggestedCard video={makeSuggestion({ grade: 'D' })} onCreate={vi.fn()} />)
    expect(screen.getByText('D').className).toContain('red')
  })
  it('grade B gets green pill', () => {
    render(<SuggestedCard video={makeSuggestion({ grade: 'B' })} onCreate={vi.fn()} />)
    expect(screen.getByText('B').className).toContain('green')
  })
  it('CTA reads "Test {type}"', () => {
    render(<SuggestedCard video={makeSuggestion({ suggest: 'thumbnail' })} onCreate={vi.fn()} />)
    expect(screen.getByText('Test thumbnail')).toBeInTheDocument()
  })
  it('shows 3 mini stats', () => {
    render(<SuggestedCard video={makeSuggestion()} onCreate={vi.fn()} />)
    expect(screen.getByText(/CTR/)).toBeInTheDocument()
    expect(screen.getByText(/median/i)).toBeInTheDocument()
  })
})
```

**Implement:** `empty-state.tsx` with 3 tiers based on `suggested.length`. `suggested-card.tsx` -- 16:9 thumbnail area, grade overlay pill (D=red, C=amber, B+=green), mini stats row, reason box, CTA button.

---

### Task 35: Evolve ab-lab-dashboard.tsx (~45min)

**Test first** (append):

```ts
describe('AbLabDashboard shell', () => {
  it('renders KPI strip when completed tests exist', () => {
    render(<AbLabDashboard {...makeProps({ completed: 2 })} />)
    expect(screen.getByText('Active tests')).toBeInTheDocument()
    expect(screen.getByText('Win rate')).toBeInTheDocument()
  })
  it('renders EmptyState when no tests and no draft', () => {
    render(<AbLabDashboard {...makeProps({ active: 0, draft: 0, completed: 0 })} />)
    expect(screen.getByText('Start Your First Test')).toBeInTheDocument()
  })
  it('passes computed stats to KPI strip', () => {
    render(<AbLabDashboard {...makeProps({ completed: 3, winRate: 66 })} />)
    expect(screen.getByText('66%')).toBeInTheDocument()
  })
  it('renders ActiveTestCards in 2-col grid', () => {
    const { container } = render(<AbLabDashboard {...makeProps({ active: 3 })} />)
    expect(container.querySelector('.lg\\:grid-cols-2')).toBeTruthy()
  })
  it('completed section renders alongside LearningsPanel', () => {
    render(<AbLabDashboard {...makeProps({ completed: 5 })} />)
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })
  it('settings button opens SettingsDrawer', async () => {
    render(<AbLabDashboard {...makeProps()} />)
    await userEvent.click(screen.getByLabelText('Settings'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
  it('has animate-ab-fade-up class on root', () => {
    const { container } = render(<AbLabDashboard {...makeProps()} />)
    expect(container.firstChild?.className).toContain('animate-ab-fade-up')
  })
})
```

**Implement:** Full rewrite of `ab-lab-dashboard.tsx` internals. New props: `stats: DashboardStats`, `cards: AbTestCardView[]`, `draft: AbTestDraft | null`, `learnings: LearningsData | null`, `suggested: SuggestedVideo[]`. Layout: Header (h2 + subtitle + quota Badge + Filter/Settings/New Test buttons) > KPI strip (4-col) > DraftsBlock > Active grid (2-col) > Completed+Learnings (1.4fr 1fr). Conditional EmptyState when no data. Remove inline stat computation (now in `computeDashboardStats`). Delete `AbVideoPicker` import (picker functionality moves to wizard).

---

### Task 36: Build SettingsDrawer (~45min)

**Test first** in `test/ab-settings-drawer.test.tsx`:

```ts
describe('SettingsDrawer', () => {
  it('has role=dialog and aria-modal', () => {
    render(<SettingsDrawer settings={defaults} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })
  it('Escape closes', async () => {
    const onClose = vi.fn()
    render(<SettingsDrawer settings={defaults} onSave={onClose} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
  it('focus trap: Tab cycles within panel', async () => {
    render(<SettingsDrawer settings={defaults} onSave={vi.fn()} onClose={vi.fn()} />)
    const close = screen.getByLabelText('Close')
    close.focus()
    expect(document.activeElement).toBe(close)
  })
  it('auto-saves after 500ms debounce', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn()
    render(<SettingsDrawer settings={defaults} onSave={onSave} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('switch', { name: /auto-apply/i }))
    expect(onSave).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(onSave).toHaveBeenCalledWith({ default_auto_apply: false })
    vi.useRealTimers()
  })
  it('CTR drop sub-fields appear when toggle ON', async () => {
    render(<SettingsDrawer settings={defaults} onSave={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('switch', { name: /pause on ctr drop/i }))
    expect(screen.getByRole('spinbutton', { name: /threshold/i })).toBeInTheDocument()
  })
  it('CTR drop alert checkbox disabled when pause toggle OFF', () => {
    render(<SettingsDrawer settings={defaults} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByLabelText('CTR drop alert')).toBeDisabled()
  })
  it('footer shows "Saved automatically" in status region', () => {
    render(<SettingsDrawer settings={defaults} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Saved automatically')
  })
  it('renders 3 sections: Automation, Defaults, Notifications', () => {
    render(<SettingsDrawer settings={defaults} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Automation')).toBeInTheDocument()
    expect(screen.getByText('Defaults')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })
  it('shows skeleton when settings is null', () => {
    render(<SettingsDrawer settings={null} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('switch')).toBeNull()
  })
  it('error state shows retry button and reverts', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockRejectedValue(new Error('fail'))
    render(<SettingsDrawer settings={defaults} onSave={onSave} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('switch', { name: /auto-apply/i }))
    vi.advanceTimersByTime(500)
    await vi.runAllTimersAsync()
    expect(screen.getByText('Failed to save')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
    vi.useRealTimers()
  })
})
```

**Implement:** `settings-drawer.tsx` evolving `ab-settings-panel.tsx`. Slide-over with `role="dialog" aria-modal="true"`, W `min(440px, 100%)`, fixed right, z-95. Backdrop blur(3px). 3 sections using SectionLabel + CfgRow/Toggle/NumberField/CheckRow/Slider from ab-primitives. Auto-save via 500ms debounced `useEffect` that diffs against last-saved state, calls `onSave(changedFields)` via `useTransition`. Focus trap (Tab wraps first-to-last, Escape closes, focus returns to trigger). Footer `role="status" aria-live="polite"`.

---

### Task 37: Update page.tsx with new data fetching (~20min)

**Test first** (append to dashboard test):

```ts
describe('page.tsx data contract', () => {
  it('passes computed stats and cardViews to dashboard', () => {
    const active = [makeTestWithVariants()]
    const completed = [makeTestWithVariants({ hasWinner: true })]
    const stats = computeDashboardStats(active, completed)
    const cards = active.map(toCardView)
    expect(stats.activeTests).toBe(1)
    expect(cards[0].leader).toBeDefined()
  })
})
```

**Implement:** Update `page.tsx` to call `getLearnings(siteId)` and `getSuggestedVideos(siteId)` in parallel alongside existing queries. Compute `stats = computeDashboardStats(active, completed)`, `cards = active.map(toCardView)`, `draft = toLatestDraft(drafts)`. Pass new props to `AbLabDashboard`. Remove `eligibleVideos` prop (picker moves to wizard in Phase 5).

---

### Task 38: Test fixtures and helpers (~15min)

Shared factory in `test/helpers/ab-fixtures.ts`:

```ts
export function makeTestWithVariants(overrides?) { /* ... */ }
export function makeCardView(overrides?) { /* ... */ }
export function makeCompleted(overrides?) { /* ... */ }
export function makeDraft(overrides?) { /* ... */ }
export function makeLearnings(overrides?) { /* ... */ }
export function makeSuggestions(count) { /* ... */ }
export function makeSuggestion(overrides?) { /* ... */ }
export function makeProps(overrides?) { /* assembles full AbLabDashboardProps */ }
```

**Phase 3 file summary:**

| Action | File | Est. LOC |
|--------|------|----------|
| Modify | `lib/youtube/ab-types.ts` | +65 |
| Modify | `ab-lab/queries.ts` | +180 |
| Create | `_components/kpi.tsx` | ~80 |
| Create | `_components/active-test-card.tsx` | ~150 |
| Evolve | `_components/completed-row.tsx` (from ab-test-completed-row.tsx) | ~100 |
| Create | `_components/drafts-block.tsx` | ~70 |
| Create | `_components/learnings-panel.tsx` | ~120 |
| Create | `_components/empty-state.tsx` + `_components/suggested-card.tsx` | ~180 |
| Evolve | `_components/ab-lab-dashboard.tsx` (full rewrite internals) | ~200 |
| Evolve | `_components/settings-drawer.tsx` (from ab-settings-panel.tsx) | ~280 |
| Modify | `ab-lab/page.tsx` | ~30 |
| Delete | `_components/ab-video-picker.tsx` | -187 |
| Create | `test/ab-dashboard-types.test.ts` | ~30 |
| Create | `test/ab-dashboard-queries.test.ts` | ~120 |
| Create | `test/ab-dashboard.test.tsx` | ~200 |
| Create | `test/ab-settings-drawer.test.tsx` | ~120 |
| Create | `test/helpers/ab-fixtures.ts` | ~80 |

**Total:** ~1500 LOC new, ~187 LOC deleted, 4 evolved. ~52 test scenarios across 4 test files.

**Verification gates:** `npm run test:web` all green, `npm run build:packages`, `next build` passes, zero `any`, all new components have `aria-*` per spec.

---

## Phase 4: Detail Views (~10h)

**Goal:** Replace the monolithic `ab-test-detail.tsx` (569L) with a discriminated-union router dispatching to three state-specific detail views (Active, Winner, Playoff), each composed from shared section components.

**Depends on:** Phases 1-3 completed (ab-constants.ts, chart-utils.ts, ab-primitives.tsx, all 10 chart components, dashboard components). If Phase 1 files do not exist yet, create them as stubs with the types/exports this layer needs.

**Spec:** `docs/superpowers/specs/2026-05-29-ab-lab-redesign.md` sections 5.1-5.5 and 8.4

**Key paths:**
- Types: `apps/web/src/lib/youtube/ab-types.ts`
- Pure logic: `apps/web/src/lib/youtube/ab-gates.ts` (NEW)
- Components: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/` (8 new, 1 evolved)
- Page: `apps/web/src/app/cms/(authed)/youtube/ab-lab/[testId]/page.tsx`
- Tests: `apps/web/test/youtube/` (6 new test files)

---

### Task 39: Discriminated union types in ab-types.ts + test (~1h)

**Test file:** `apps/web/test/youtube/ab-detail-types.test.ts` (~12 scenarios)

- [ ] **Step 1: Write tests first**

```typescript
// apps/web/test/youtube/ab-detail-types.test.ts
import { describe, it, expect } from 'vitest'
import type { AbTestDetailView, AbTestActiveView, AbTestWinnerView, AbTestPlayoffView, GateResult, LiveMonitor } from '@/lib/youtube/ab-types'

describe('AbTestDetailView discriminated union', () => {
  it('narrows to ActiveView when status is active', () => {
    const view = { status: 'active' } as AbTestDetailView
    if (view.status === 'active') {
      // TS should see confirmedData, liveData, outcome?: never
      expect(view.status).toBe('active')
    }
  })
  it('narrows to WinnerView when status is completed and outcome is winner', () => { /* ... */ })
  it('narrows to PlayoffView when status is completed and outcome is playoff', () => { /* ... */ })
  it('ActiveView has outcome?: never to force first-branch narrowing', () => { /* type-level */ })
  it('GateResult has name, passed, value, hint?', () => { /* structural */ })
  it('LiveMonitor is optional on WinnerView', () => { /* structural */ })
  // + 6 more: field mapping tests (confidenceTarget, durationDays, hasPlayoff, totalRounds, daily shape, variantThumbs shape)
})
```

- [ ] **Step 2: Add types to ab-types.ts**

Add after existing types: `AbTestBaseView` (id, videoTitle, flag: TestType, status, variants: FullChartVariant[], variantThumbs, confTrend, daily, abbaSeq, cycles, durationDays, confidenceTarget, totalRounds, hasPlayoff). Then `AbTestActiveView extends AbTestBaseView` with `status: 'active'`, `outcome?: never`, `confirmedData`, `liveData`. Then `AbTestWinnerView extends AbTestBaseView` with `status: 'completed'`, `outcome: 'winner'`, `winnerLabel`, `lift`, `confidence`, `resultMeta`, `monitor?: LiveMonitor`, `learning?: string`. Then `AbTestPlayoffView extends AbTestBaseView` with `status: 'completed'`, `outcome: 'playoff'`, `playoffTestId`, `startsIn`, `finalists`, `confidenceReached`. Union: `AbTestDetailView = AbTestActiveView | AbTestWinnerView | AbTestPlayoffView`. Also add `GateResult` type and `LiveMonitor` interface.

- [ ] **Step 3: Verify tests pass** -- `npm run test:web -- --reporter=verbose ab-detail-types`

---

### Task 40: computeGates() pure function + test (~45min)

**Test file:** `apps/web/test/youtube/ab-gates.test.ts` (~15 scenarios)

- [ ] **Step 1: Write tests first**

```typescript
// apps/web/test/youtube/ab-gates.test.ts
import { describe, it, expect } from 'vitest'
import { computeGates } from '@/lib/youtube/ab-gates'
import type { GateInput } from '@/lib/youtube/ab-gates'

function makeInput(overrides?: Partial<GateInput>): GateInput {
  return { confidence: 0.97, threshold: 0.95, minImpressions: [1200, 1500],
    daysSinceStart: 10, confirmedCycles: 16, burnInDays: 2, variantCount: 2,
    eligibleCycles: 14, consecutiveConfident: 3, stabilityThreshold: 3, ...overrides }
}

describe('computeGates', () => {
  it('returns 6 gates', () => { expect(computeGates(makeInput())).toHaveLength(6) })
  it('all pass when all criteria met', () => { expect(computeGates(makeInput()).every(g => g.passed)).toBe(true) })
  it('confidence gate fails below threshold', () => { const g = computeGates(makeInput({ confidence: 0.80 })); expect(g[0].passed).toBe(false) })
  it('impressions gate fails when any variant < 1000', () => { /* minImpressions: [500, 1500] */ })
  it('duration gate fails before 7 days', () => { /* daysSinceStart: 3 */ })
  it('cycles gate fails below 14', () => { /* confirmedCycles: 8 */ })
  it('burn-in gate passes when burnInDays is 0', () => { /* edge case */ })
  it('burn-in gate fails when no eligible cycles after burn-in', () => { /* eligibleCycles: 0, burnInDays: 2 */ })
  it('stability gate fails when consecutive < threshold', () => { /* consecutiveConfident: 1 */ })
  it('each gate has name, passed, value, hint', () => { /* structural check on all 6 */ })
  // + 5 edge cases: boundary values, single variant, zero impressions
})
```

- [ ] **Step 2: Create ab-gates.ts**

`apps/web/src/lib/youtube/ab-gates.ts` -- export `GateInput` interface and `computeGates(input: GateInput): GateResult[]` pure function. Logic mirrors the 6 gates from `ab-evaluate/route.ts` lines 107-113 but as a pure function with no DB access. Gate names: `confidence`, `min_impressions`, `min_duration`, `min_cycles`, `burn_in`, `stability`.

- [ ] **Step 3: Refactor ab-evaluate cron** to import `computeGates()` instead of inline gate array. Verify existing `ab-cron-evaluate.test.ts` still passes.

- [ ] **Step 4: Verify** -- `npm run test:web -- --reporter=verbose ab-gates`

---

### Task 41: Shared detail components + tests (~2.5h)

**Test file:** `apps/web/test/youtube/ab-detail-shared.test.tsx` (~18 scenarios)

- [ ] **Step 1: Write tests for all 4 shared components**

Test `DetailHeader`: renders breadcrumb link to `/cms/youtube/ab-lab`, shows title, shows TypeBadge, shows signal toggle only for active status, shows Duplicate/Archive/Download for completed. Test `LockCountdown`: renders progress bar with correct width%, shows "X days remaining", handles edge case of 0 days. Test `HeroBand`: renders 4-cell grid, shows Gauge, shows leader VChip, shows lift text, shows trend indicator. Test `GatesPanel`: renders 2x3 grid, shows "{n}/6 passed" header, shows green check for passed gates, shows clock for pending, uses `role="list"` semantics.

- [ ] **Step 2: Create detail-header.tsx**

Props: `title: string`, `flag: TestType`, `status: AbTestStatus`, `roundNumber: number`, `totalRounds: number`, `hasPlayoff: boolean`, `signalToggle?: { mode: 'confirmed' | 'live'; onToggle: () => void }`, `actions?: ReactNode`. Breadcrumb uses `Link` to `/cms/youtube/ab-lab`. Badge row: TypeBadge from ab-primitives, round counter (`"Round {n}/{total}"`) if totalRounds > 1, status badge (color-coded). Right side: signal toggle (Seg component with confirmed/live options + InfoTip) for active, or action buttons slot.

- [ ] **Step 3: Create lock-countdown.tsx**

Props: `dayOf: number`, `durationDays: number`, `confidence: number`, `confidenceTarget: number`, `cyclesCompleted: number`. Lock icon + "Test locked" text. Progress bar div with `width: ${(dayOf/durationDays)*100}%`. Countdown: `Math.ceil((confidenceTarget - confidence) / 0.025)` estimated days. Cycles remaining text.

- [ ] **Step 4: Create hero-band.tsx**

Props: `confidence: number`, `confidenceTarget: number`, `leader: { label: DisplayLabel; color: string }`, `lift: number`, `trend: 'up' | 'flat' | 'down'`. 4-cell CSS grid (`grid-cols-4`, responsive `grid-cols-2` at 1024px, `grid-cols-1` at 760px). Cell 1: Gauge chart. Cell 2: VChip of leader. Cell 3: lift percentage (green text). Cell 4: trend arrow icon.

- [ ] **Step 5: Create variant-table.tsx**

Props: `variants: FullChartVariant[]`, `metric: 'pBest' | 'pTop2'`, `winnerId?: string`. 6-column table with `role="table"`. Columns: thumb, variant label, CTR, vs A (lift), chance to win (bar), expand chevron. Leader row tinted. Expandable rows (one-at-a-time via local state) show impressions, clicks, link CTR, retention, AI briefing. Rows: `tabIndex={0}`, Enter/Space toggles `aria-expanded`.

- [ ] **Step 6: Create gates-panel.tsx**

Props: `gates: GateResult[]`. 2x3 CSS grid. Header: `"{n}/6 passed"` with green text when all pass. Each cell: icon (check or clock), gate name, value string, optional hint. Uses `role="list"` + `role="listitem"`.

- [ ] **Step 7: Verify** -- `npm run test:web -- --reporter=verbose ab-detail-shared`

---

### Task 42: ActiveDetail component + test (~1.5h)

**Test file:** `apps/web/test/youtube/ab-detail-active.test.tsx` (~10 scenarios)

- [ ] **Step 1: Write tests**

Test 10-section layout renders all section headings. Test signal toggle swaps between confirmed/live data (mock two dataset objects, toggle state, verify chart props change). Test LockCountdown appears with correct progress. Test VariantTable uses `metric="pBest"`. Test GatesPanel renders with computed gates. Test responsive: section order preserved.

- [ ] **Step 2: Create active-detail.tsx**

Props: `view: AbTestActiveView`. Local state: `signal: 'confirmed' | 'live'`. Derives `data = signal === 'confirmed' ? view.confirmedData : view.liveData`. 10 sections in order: DetailHeader (with signal toggle), LockCountdown, HeroBand, H + VariantTable, ConfidenceChart + RadarChart grid, CredibleInterval + RankBars card, MultiLine daily CTR, ABBATimeline + FunnelRow grid, GatesPanel (gates from `computeGates()`), ClickMoment placeholder div.

- [ ] **Step 3: Verify** -- `npm run test:web -- --reporter=verbose ab-detail-active`

---

### Task 43: Winner + Playoff components + tests (~2h)

**Test file:** `apps/web/test/youtube/ab-detail-winner.test.tsx` (~10 scenarios)
**Test file:** `apps/web/test/youtube/ab-detail-playoff.test.tsx` (~10 scenarios)

- [ ] **Step 1: Write winner tests**

Test WinnerBanner renders trophy icon, winner VChip, lift %, confidence, 3 HeroStats. Test LiveMonitor conditionally hidden when `monitor` undefined. Test WinnerDetail 8-section layout. Test "Why X won" section renders CredibleInterval + RankBars. Test Final Scoreboard shows winner badge.

- [ ] **Step 2: Create winner-banner.tsx**

Props: `winnerLabel: DisplayLabel`, `winnerColor: string`, `lift: number`, `confidence: number`, `stats: { ctrBefore: number; ctrAfter: number; totalImpressions: number; abbaCycles: number; monthlyExtraClicks: number }`. Green-bordered card. Left: Trophy + VChip + lift (JetBrains Mono 38px) + confidence. Right: 3 stat cells.

- [ ] **Step 3: Create live-monitor.tsx**

Props: `monitor: LiveMonitor` (liveCtr, sparkline, liftVsOriginal, checkpoints D+7/14/30). Conditionally rendered. Left: big CTR number, sparkline, lift badge. Right: 3 checkpoint cells with check/clock icons.

- [ ] **Step 4: Create winner-detail.tsx**

Props: `view: AbTestWinnerView`. 8 sections: DetailHeader (no toggle, action buttons), WinnerBanner, "Why X won" (CredibleInterval + RankBars), LiveMonitor (conditional), ConfidenceChart + Learning card, Final Scoreboard (VariantTable with winnerId), ClickMoment placeholder.

- [ ] **Step 5: Write playoff tests**

Test PlayoffBanner renders bracket visualization with 3-column grid, finalists highlighted, dimmed non-finalists, center arrow, Round 2 thumbnails. Test `role="img"` and `aria-label`. Test PlayoffDetail 5-section layout. Test VariantTable uses `metric="pTop2"`. Test inconclusive banner shows amber background with correct confidence text.

- [ ] **Step 6: Create playoff-banner.tsx**

Props: `finalists: { label: DisplayLabel; color: string; ctr: number; thumbnailUrl: string | null }[]`, `allVariants: { label: DisplayLabel; isFinalist: boolean; thumbnailUrl: string | null }[]`, `startsIn: string`, `reason: string`. Purple-bordered card. Header: Swords icon + "Playoff created automatically" + countdown + scheduled badge. 3-column bracket: Round 1 variants (finalists full opacity, others dimmed) | center arrow | Round 2 finalists with thumbnails + CTR. Footer: Target icon + reason. `role="img"` + descriptive `aria-label`.

- [ ] **Step 7: Create playoff-detail.tsx**

Props: `view: AbTestPlayoffView`. 5 sections: DetailHeader (Inconclusive badge amber, no toggle), Inconclusive Banner (amber, Info icon, confidence reached vs 95%), PlayoffBanner, "Why inconclusive" (CredibleInterval + RankBars pTop2), VariantTable with `metric="pTop2"`.

- [ ] **Step 8: Verify** -- `npm run test:web -- --reporter=verbose ab-detail-winner ab-detail-playoff`

---

### Task 44: toDetailView() mapper + router page + test (~2h)

**Test file:** `apps/web/test/youtube/ab-detail-mapper.test.ts` (~15 scenarios)

- [ ] **Step 1: Write mapper tests**

Test `toDetailView()` returns `AbTestActiveView` for active test with correct field mappings. Test it returns `AbTestWinnerView` for completed test with winner. Test it returns `AbTestPlayoffView` for completed/inconclusive test with playoff_test_id. Test `confirmedData` uses only confirmed cycles, `liveData` includes estimated. Test `daily` maps to `Record<DisplayLabel, number[]>`. Test `variantThumbs` built correctly. Test `confTrend` computed from progressive cycle aggregation. Test field mappings: `confidenceTarget` from `confidence_threshold`, `durationDays` from `max_duration_days`, `hasPlayoff` from `!!playoff_test_id`, `totalRounds` from round_number. Test Bayesian probabilities (pBest, pTop2) populated on variants. Test edge: single variant returns early. Test edge: no confirmed cycles returns empty trends.

- [ ] **Step 2: Add toDetailView() to actions.ts**

New function `toDetailView(results: AbTestResults): AbTestDetailView`. Discriminates: if `test.status === 'active'` or `'paused'` return ActiveView; if `completed_reason === 'inconclusive' && playoff_test_id` return PlayoffView; else return WinnerView. Maps all fields from `AbTestResults` flat shape to the view-model shape. Computes `confirmedData` / `liveData` for active tests (confirmed uses backfill_status=confirmed cycles only, live adds estimated). Uses `toDisplayLabel()` from ab-constants. Calls `calculateBayesianConfidence()` for probabilities.

- [ ] **Step 3: Update [testId]/page.tsx**

Replace `<AbTestDetail results={results} />` with: call `toDetailView(results)` to get the view, then dispatch: `view.status === 'active'` renders `<ActiveDetail>`, `view.outcome === 'winner'` renders `<WinnerDetail>`, default renders `<PlayoffDetail>`. Import all three. Keep `dynamic = 'force-dynamic'`.

- [ ] **Step 4: Delete ab-variant-card.tsx** (153L, replaced by variant-table.tsx)

- [ ] **Step 5: Full verification**

```bash
npm run test:web -- --reporter=verbose ab-detail ab-gates
npm run build:packages
npx next build  # or rely on pre-commit
```

---

### Task 45: Final Phase 4 verification gate (~15min)

- [ ] All 6 test files pass (~75 scenarios total)
- [ ] `npm run build:packages` succeeds
- [ ] TypeScript strict: discriminated union narrows without `as` casts in page.tsx
- [ ] No `any` types introduced
- [ ] All new components have `aria-*` attributes per spec
- [ ] `ab-variant-card.tsx` deleted, no remaining imports
- [ ] Existing `ab-cron-evaluate.test.ts` still passes after `computeGates` refactor

---

## Phase 5: Wizard + ClickMoment (~10h)

**Base path:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/`
**Adapter path:** `apps/web/src/lib/youtube/`
**Test path:** `apps/web/test/youtube/`

### Prerequisites

Phases 1-4 must be complete. This plan assumes `ab-constants.ts` (VChip, variantColor, VARIANT_COLORS), `ab-primitives.tsx` (VChip, Seg, Toggle, Slider, CfgRow, NumberField, Badge, SectionLabel), and `ab-types.ts` (AbTestDetailView discriminated union) exist from prior phases.

---

### Task 46: Create ab-wizard-adapter.ts (~1h)

**File:** `apps/web/src/lib/youtube/ab-wizard-adapter.ts`

#### 46a. Write tests first

**File:** `apps/web/test/youtube/ab-wizard-adapters.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { wizardConfigToAbConfig, initWizardConfig, toClickMomentData } from '@/lib/youtube/ab-wizard-adapter'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'

describe('wizardConfigToAbConfig', () => {
  it('converts confidence integer 95 to decimal 0.95', () => {
    const result = wizardConfigToAbConfig({ confidence: 95, duration: 14, autoApply: true, burnIn: 2, rotation: 'abba', playoff: false })
    expect(result.confidence_threshold).toBe(0.95)
  })
  it('maps camelCase duration to snake_case max_duration_days', () => { /* ... */ })
  it('passes rotation through unchanged', () => { /* ... */ })
})

describe('initWizardConfig', () => {
  it('converts default_confidence 0.95 to integer 95', () => {
    const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
    expect(wc.confidence).toBe(95)
  })
  it('defaults rotation to abba and playoff to true', () => { /* ... */ })
})

describe('toClickMomentData', () => {
  it('maps AbTestDetailView variants to ClickMomentVariant[]', () => { /* ... */ })
  it('maps WizardState with CTR=0 for all variants', () => { /* ... */ })
  it('carries leader/winner from detail view overload', () => { /* ... */ })
})
```

7 test scenarios total.

#### 46b. Implement adapter

Export 4 pure functions: `wizardConfigToAbConfig(cfg: WizardConfig): Partial<AbTestConfig>`, `initWizardConfig(settings: AbTestSiteSettings): WizardConfig`, `launchAbTest(state: WizardState, siteId: string): Promise<{ok: boolean; error?: string}>`, `toClickMomentData` (two overloads). `launchAbTest` calls `createAbTest` -> `uploadVariant`/`createTextVariant` sequentially for B/C/D -> `startAbTest`. Wrap in try/catch returning `{ok: false, error}`.

---

### Task 47: Refactor wizard shell to useReducer (~1.5h)

**File:** `_components/ab-create-wizard.tsx` (evolve from 1312L to ~400L)

#### 47a. Write tests first

**File:** `apps/web/test/youtube/ab-wizard-shell.test.tsx`

```ts
// @vitest-environment happy-dom
describe('WizardShell', () => {
  it('renders 5 step indicators with correct aria-current', () => { /* ... */ })
  it('marks past steps as clickable, future steps as inert', () => { /* ... */ })
  it('navigates back on Back button click', () => { /* ... */ })
  it('closes on Escape keydown', () => { /* ... */ })
  it('disables Next until step validation passes', () => { /* ... */ })
  it('shows "Launch test" with Play icon on step 4', () => { /* ... */ })
  it('shows "Skip" on step 1 when Cowork not opened', () => { /* ... */ })
  it('applies role=dialog aria-modal=true', () => { /* ... */ })
  it('goes fullscreen at <=760px (no step labels)', () => { /* ... */ })
  it('dispatches SET_STEP on past-step click', () => { /* ... */ })
})
```

10 test scenarios.

#### 47b. Implement reducer

Define `WizardState` interface and `WizardAction` discriminated union (`SET_STEP | SET_TYPE | SET_HYPOTHESIS | SET_COWORK_OPENED | SET_TITLE | SET_VARIANTS | UPDATE_CONFIG`). Replace the 16 `useState` calls with single `useReducer(wizardReducer, initialState)`. Shell keeps: modal overlay (`backdrop-filter: blur(6px)`), 5-step rail (circle indicators connected by 1px lines), footer with Back/Next, Escape handler, focus trap. Each step rendered via `switch(state.step)` delegating to extracted step components (Tasks 48-51).

---

### Task 48: Extract step-tipo.tsx (~0.5h)

**File:** `_components/step-tipo.tsx`

Tests included in `ab-wizard-steps.test.tsx` (Task 57). 2x2 radiogroup grid with 4 type cards (combo/thumbnail/title/description). Each card: icon box + title + description + optional Badge ("recommended" on combo, "one-off" on description). Click dispatches `SET_TYPE` and auto-advances after 180ms `setTimeout`. Arrow key navigation. `aria-checked` on selected card.

---

### Task 49: Extract step-variantes.tsx (~1.5h)

**File:** `_components/step-variantes.tsx`

Conditional `TakesStrip` (5-frame grid from video takes, shown for combo/thumbnail). `VariantRow` per variant (A/B/C/D): header with VChip + label + badges (locked for A, "generated by Cowork" when applicable). Body grid: thumb slot (image for A, drop zone for B/C/D with drag-and-drop + file input) + title input with `{length}/100` counter (red at 101+). Briefing accordion for Cowork metadata. Description accordion for combo/description types. Next disabled when 0 challenger variants uploaded. Receives state + dispatch from parent.

---

### Task 50: Extract step-config.tsx (~0.75h)

**File:** `_components/step-config.tsx`

Two-column grid (`1fr 280px`). Left column: 6 CfgRow controls -- duration Slider (7-28), confidence Slider (80-99%), auto-apply Toggle, burn-in Slider (0-3), rotation Seg (ABBA/Sequential/Random), playoff Toggle. Right column: sticky estimate card computing time-to-significance, ABBA cycles, YouTube quota/day from current config values. Stacks to single column at <=760px. All values dispatched via `UPDATE_CONFIG`.

---

### Task 51: Extract step-revisar.tsx (~0.5h)

**File:** `_components/step-revisar.tsx`

Success banner summarizing: variant count, type, rotation, duration, confidence, playoff status. Embedded `<ClickMoment>` preview assembled from wizard state via `toClickMomentData(wizardState)`. Read-only, no edits. Missing thumbnails show gradient placeholders; missing titles show "Untitled". Confirmation prompt before launch.

---

### Task 52: Create yt-thumb.tsx (~0.75h)

**File:** `_components/yt-thumb.tsx`

Renders `<Image>` when `thumbUrl` exists. Otherwise renders: gradient bg (`linear-gradient` from `thumbBg` color) + radial subject glow + `repeating-linear-gradient` texture + overlay text centered. Duration chip bottom-right (JetBrains Mono, `bg-black/80`). Optional label badge top-left via Badge from ab-primitives. `mini` prop hides overlay + duration. Fallback solid `#1a1814` when both `thumbUrl` and `thumbBg` missing. Props: `{ thumbUrl?: string; thumbBg?: string; overlayText?: string; duration?: string; label?: string; mini?: boolean; className?: string }`.

---

### Task 53: Create context-renderers.tsx (~1h)

**File:** `_components/context-renderers.tsx`

4 exported components sharing `ContextRendererProps = { thumbUrl?: string; thumbBg?: string; title: string; channelName: string; views: string; age: string; duration: string; label?: string }`.

- **HomeCard:** Full-width YTThumb + 12px gap + avatar circle + title (2-line clamp) + channel + meta row (views + age).
- **SearchRow:** Horizontal layout, 340px YTThumb left + stacked text right (title + channel + description snippet + meta).
- **SidebarRow:** Compact horizontal, 168px YTThumb + 2-line title clamp + channel + meta. `font-size: 13px`.
- **MobilePhone:** iPhone-shaped frame (`width: 375px, border-radius: 40px`) with notch element, radius-0 YTThumb + compact meta below.

---

### Task 54: Create behavior-strip.tsx (~0.5h)

**File:** `_components/behavior-strip.tsx`

Props: `{ label: string; color: string; ctr: number; maxCtr: number; isLeader?: boolean; isBaseline?: boolean; delta?: number }`. Renders: VChip (with colored ring if leader) + proportional CTR bar (`width = ctr/maxCtr * 100%`, CSS transition 0.6s) + CTR value (JetBrains Mono 700 15px) + relative delta for non-A variants (`relLift = ((delta/baseline.ctr)*100).toFixed(0)`, green positive / red negative). Bar uses variant color from VARIANT_COLORS.

---

### Task 55: Create feed-view.tsx (~1h)

**File:** `_components/feed-view.tsx`

Simulated YouTube Home feed. Dark bg grid (3-col, 2-col at <=760px, 1-col at <=620px). 5 hardcoded `DECOY_VIDEOS` array at `opacity: 0.62` with `aria-hidden="true"`. User's video at center slot with highlight border (`2px solid {color}` + glow `box-shadow`) and "your video" Badge. Variant selector below: radiogroup of buttons per variant with CTR badge. `DecoyVideo` type: `{ title: string; channelName: string; views: string; age: string; thumbBg: string; thumbOverlay: string; duration: string }`. Each decoy rendered via HomeCard with `mini` YTThumb.

---

### Task 56: Create click-moment.tsx (~1h)

**File:** `_components/click-moment.tsx`

Centerpiece component used in step-revisar and all 3 detail views. Props: `{ variants: ClickMomentVariant[]; leaderId?: string; winnerId?: string }`.

**Header:** Fraunces italic "The click moment" + Seg toggle (Compare | Feed).

**Context switcher:** 4 icon buttons (LayoutGrid/Search/ListVideo/Smartphone). Active gets accent border + subtle bg. State: `context: 'home' | 'search' | 'sidebar' | 'mobile'`.

**Compare mode:** Grid of variant cards. Each card = context-appropriate renderer (HomeCard/SearchRow/SidebarRow/MobilePhone) + BehaviorStrip below. Leader card gets colored border + badge (Trophy for winner, TrendingUp for leader). Grid columns: home=2-col, search/sidebar=1-col, mobile=`auto-fit minmax(300px, 1fr)`.

**Feed mode:** Renders `<FeedView>` with current variant data.

---

### Task 57: Write tests (~68 scenarios across 4 files) (~1.5h)

#### ab-wizard-adapters.test.ts (7 scenarios) -- covered in Task 46a

#### ab-wizard-shell.test.tsx (10 scenarios) -- covered in Task 47a

#### ab-wizard-steps.test.tsx (12 scenarios)

```ts
// @vitest-environment happy-dom
describe('StepTipo', () => {
  it('renders 4 type cards in 2x2 grid', () => { /* ... */ })
  it('shows recommended badge on combo card', () => { /* ... */ })
  it('auto-advances after 180ms on click', () => { /* vi.useFakeTimers() */ })
  it('supports arrow key navigation', () => { /* ... */ })
})
describe('StepVariantes', () => {
  it('shows TakesStrip for thumbnail type', () => { /* ... */ })
  it('hides TakesStrip for title type', () => { /* ... */ })
  it('disables Next with 0 challengers', () => { /* ... */ })
  it('shows title counter red at 101+ chars', () => { /* ... */ })
})
describe('StepConfig', () => {
  it('renders 6 CfgRow controls', () => { /* ... */ })
  it('shows sticky estimate card', () => { /* ... */ })
})
describe('StepRevisar', () => {
  it('renders success banner with variant count', () => { /* ... */ })
  it('embeds ClickMoment preview', () => { /* ... */ })
})
```

#### ab-click-moment.test.tsx (39 scenarios)

```ts
// @vitest-environment happy-dom
describe('YTThumb', () => {
  it('renders Image when thumbUrl provided', () => { /* ... */ })
  it('renders gradient+glow+texture when no thumbUrl', () => { /* ... */ })
  it('renders solid #1a1814 when both missing', () => { /* ... */ })
  it('hides overlay and duration in mini mode', () => { /* ... */ })
  it('shows duration chip with JetBrains Mono', () => { /* ... */ })
  it('shows label badge top-left', () => { /* ... */ })
})
describe('ContextRenderers', () => {
  it('HomeCard renders full-width thumb + meta', () => { /* ... */ })
  it('SearchRow renders 340px thumb + stacked text', () => { /* ... */ })
  it('SidebarRow renders 168px thumb + 2-line title', () => { /* ... */ })
  it('MobilePhone renders iPhone frame with notch', () => { /* ... */ })
  // 4 tests x accessibility (alt text, semantic structure) = 4 more
})
describe('BehaviorStrip', () => {
  it('renders CTR bar proportional to maxCtr', () => { /* ... */ })
  it('shows green delta for positive lift', () => { /* ... */ })
  it('shows red delta for negative lift', () => { /* ... */ })
  it('hides delta for baseline variant', () => { /* ... */ })
  it('renders leader ring on VChip when isLeader', () => { /* ... */ })
  it('uses JetBrains Mono 700 15px for CTR value', () => { /* ... */ })
  it('animates bar width with 0.6s transition', () => { /* ... */ })
})
describe('FeedView', () => {
  it('renders 5 decoy videos at opacity 0.62', () => { /* ... */ })
  it('marks decoys as aria-hidden', () => { /* ... */ })
  it('highlights user video with glow border', () => { /* ... */ })
  it('shows "your video" badge', () => { /* ... */ })
  it('renders variant selector as radiogroup', () => { /* ... */ })
})
describe('ClickMoment', () => {
  it('renders header with "The click moment"', () => { /* ... */ })
  it('toggles between Compare and Feed modes via Seg', () => { /* ... */ })
  it('switches context on button click (home/search/sidebar/mobile)', () => { /* ... */ })
  it('renders HomeCard in home context compare mode', () => { /* ... */ })
  it('renders SearchRow in search context', () => { /* ... */ })
  it('renders SidebarRow in sidebar context', () => { /* ... */ })
  it('renders MobilePhone in mobile context', () => { /* ... */ })
  it('shows Trophy badge on winner card', () => { /* ... */ })
  it('shows TrendingUp badge on leader card', () => { /* ... */ })
  it('renders FeedView in feed mode', () => { /* ... */ })
})
```

---

### Task 58: Delete wizard-variant-card.tsx + update imports (~0.25h)

Delete `_components/wizard-variant-card.tsx` (136L). The import in `ab-create-wizard.tsx` (line 8) is already removed by Task 47b's refactor which replaces all variant rendering with `step-variantes.tsx`. Delete `apps/web/test/youtube/wizard-variant-card.test.tsx`. Verify no other files import `WizardVariantCard` (confirmed: only `ab-create-wizard.tsx` imports it).

---

### Phase 5 Dependency Order

```
Task 46 (adapter)  ──────────────────────────────────┐
Task 52 (yt-thumb) ───┐                              │
Task 53 (renderers) ──┤── Task 54 (behavior-strip) ──┤
                      │                              │
                      ├── Task 55 (feed-view) ───────┤
                      │                              │
                      └── Task 56 (click-moment) ────┤
                                                     │
Task 48 (step-tipo) ──┐                              │
Task 49 (step-var) ───┤── Task 47 (wizard shell) ───┤
Task 50 (step-cfg) ───┤                              │
Task 51 (step-rev) ───┘── uses click-moment ─────────┘
                                                     │
Task 57 (tests) ─────────────────────────────────────┘
Task 58 (delete) ── after Task 47
```

Parallelizable: Tasks 46, 48, 49, 50, 52 can run simultaneously. Tasks 53, 54 depend on 52. Tasks 55, 56 depend on 53+54. Task 51 depends on 56. Task 47 depends on 48-51. Task 57 spans all. Task 58 after Task 47.
