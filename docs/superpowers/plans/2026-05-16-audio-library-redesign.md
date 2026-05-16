# Audio Library Visual Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely overhaul the Pipeline Audio Library CMS page with visible waveforms, information-dense cards, a two-tier filter sidebar, table view with density modes, polished detail panel, and cohesive transitions.

**Architecture:** Replace existing single-mode grid with a unified three-column layout (filter sidebar | content grid/table | detail panel). Extract a unified `WaveformDisplay` component with 3 variants (card/table/detail). All new components use GEM design tokens via CSS custom properties injected by the server page component. State persisted to URL search params for shareability.

**Tech Stack:** React 19, Next.js 15, TypeScript 5, Tailwind 4, SVG waveform rendering, `useSearchParams` for URL persistence, `React.memo` + `useMemo` for perf, IntersectionObserver for stagger gating.

---

## File Map

### New files to create:
| File | Responsibility |
|------|----------------|
| `_components/waveform-display.tsx` | Unified waveform (card/table/detail variants) |
| `_components/audio-card.tsx` | Grid card component (AudioCardV2) |
| `_components/audio-grid-v2.tsx` | Grid container with stagger animation |
| `_components/audio-filters-v2.tsx` | Two-tier filter sidebar |
| `_components/audio-table-v2.tsx` | Table with density, column picker, virtual scroll |
| `_components/audio-detail-v2.tsx` | Tabbed detail panel |
| `_components/audio-empty.tsx` | Empty & no-results states |
| `_components/audio-toast.tsx` | Toast notification system |
| `_components/audio-skeleton.tsx` | Loading skeletons |
| `_helpers/audio-helpers.ts` | Pure utilities (energyColor, formatDuration, similarity scoring) |
| `_helpers/use-audio-filters.ts` | Filter state hook with URL sync |
| `test/components/pipeline/audio/waveform-display.test.ts` | WaveformDisplay tests |
| `test/components/pipeline/audio/audio-card.test.tsx` | Card tests |
| `test/components/pipeline/audio/audio-helpers.test.ts` | Helper utility tests |
| `test/components/pipeline/audio/use-audio-filters.test.ts` | Filter hook tests |

### Files to modify:
| File | Change |
|------|--------|
| `audio-library.tsx` | Replace with new layout orchestrator |
| `page.tsx` | Update imports, add new keyframe CSS vars |
| `globals.css` | Add `card-in`, `toast-in` keyframes |

### Files to deprecate (keep but stop importing):
| File | Replaced by |
|------|-------------|
| `waveform-mini.tsx` | `waveform-display.tsx` variant="table" |
| `waveform.tsx` | `waveform-display.tsx` variant="detail" (keep `resamplePeaks` export) |
| `audio-filters.tsx` | `audio-filters-v2.tsx` |
| `audio-table.tsx` | `audio-table-v2.tsx` |
| `audio-detail.tsx` | `audio-detail-v2.tsx` |

---

## Task 1: Audio Helpers (Pure Utilities)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_helpers/audio-helpers.ts`
- Test: `apps/web/test/components/pipeline/audio/audio-helpers.test.ts`

- [ ] **Step 1: Write failing tests for energy color helper**

```ts
// apps/web/test/components/pipeline/audio/audio-helpers.test.ts
import { describe, it, expect } from 'vitest'
import { energyColor, formatDuration, categoryConfig, ENERGY_COLORS } from
  '@/app/cms/(authed)/pipeline/audio/_helpers/audio-helpers'

describe('energyColor', () => {
  it('returns green for level 1', () => {
    expect(energyColor(1)).toBe('#22c55e')
  })
  it('returns green for level 2', () => {
    expect(energyColor(2)).toBe('#22c55e')
  })
  it('returns yellow for level 3', () => {
    expect(energyColor(3)).toBe('#eab308')
  })
  it('returns orange for level 4', () => {
    expect(energyColor(4)).toBe('#f97316')
  })
  it('returns red for level 5', () => {
    expect(energyColor(5)).toBe('#ef4444')
  })
  it('returns dim gray for null/undefined', () => {
    expect(energyColor(null)).toBe('#5a6b7f')
  })
})

describe('formatDuration', () => {
  it('formats seconds to m:ss', () => {
    expect(formatDuration(65)).toBe('1:05')
  })
  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0:00')
  })
  it('handles large values', () => {
    expect(formatDuration(3661)).toBe('61:01')
  })
  it('returns dash for null', () => {
    expect(formatDuration(null)).toBe('—')
  })
})

describe('categoryConfig', () => {
  it('returns config for cinematic', () => {
    const cfg = categoryConfig('cinematic')
    expect(cfg.badgeBg).toBe('rgba(99,102,241,0.12)')
    expect(cfg.badgeColor).toBe('#818cf8')
    expect(cfg.hoverAccent).toBe('#7c3aed')
  })
  it('returns fallback for unknown category', () => {
    const cfg = categoryConfig('unknown-thing')
    expect(cfg.badgeBg).toContain('rgba')
    expect(cfg.badgeColor).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/components/pipeline/audio/audio-helpers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement audio-helpers.ts**

```ts
// apps/web/src/app/cms/(authed)/pipeline/audio/_helpers/audio-helpers.ts

export const ENERGY_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#22c55e',
  3: '#eab308',
  4: '#f97316',
  5: '#ef4444',
}

export function energyColor(level: number | null | undefined): string {
  if (level == null) return '#5a6b7f'
  return ENERGY_COLORS[level] ?? '#5a6b7f'
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface CategoryStyle {
  badgeBg: string
  badgeColor: string
  hoverAccent: string
  dotColor: string
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  cinematic: { badgeBg: 'rgba(99,102,241,0.12)', badgeColor: '#818cf8', hoverAccent: '#7c3aed', dotColor: '#818cf8' },
  ambient: { badgeBg: 'rgba(14,165,233,0.12)', badgeColor: '#38bdf8', hoverAccent: '#0ea5e9', dotColor: '#38bdf8' },
  electronic: { badgeBg: 'rgba(168,85,247,0.12)', badgeColor: '#c084fc', hoverAccent: '#a855f7', dotColor: '#c084fc' },
  impact: { badgeBg: 'rgba(239,68,68,0.12)', badgeColor: '#f87171', hoverAccent: '#0ea5e9', dotColor: '#f87171' },
  drop: { badgeBg: 'rgba(245,158,11,0.12)', badgeColor: '#fbbf24', hoverAccent: '#f59e0b', dotColor: '#fbbf24' },
  riser: { badgeBg: 'rgba(16,185,129,0.12)', badgeColor: '#34d399', hoverAccent: '#10b981', dotColor: '#34d399' },
}

const FALLBACK_STYLE: CategoryStyle = {
  badgeBg: 'rgba(107,114,128,0.12)',
  badgeColor: '#9ca3af',
  hoverAccent: '#6b7280',
  dotColor: '#9ca3af',
}

export function categoryConfig(category: string | null | undefined): CategoryStyle {
  if (!category) return FALLBACK_STYLE
  return CATEGORY_STYLES[category.toLowerCase()] ?? FALLBACK_STYLE
}

export function similarityScore(a: {
  category?: string | null
  tags?: string[]
  music_key?: string | null
  bpm?: number | null
  energy?: number | null
  instruments?: string[]
  mood?: string[]
}, b: typeof a): number {
  let score = 0
  if (a.category && a.category === b.category) score += 30
  const sharedTags = (a.tags ?? []).filter(t => (b.tags ?? []).includes(t))
  score += Math.min(sharedTags.length * 5, 30)
  if (a.music_key && a.music_key === b.music_key) score += 15
  if (a.bpm != null && b.bpm != null && Math.abs(a.bpm - b.bpm) <= 10) score += 15
  if (a.energy != null && b.energy != null && Math.abs(a.energy - b.energy) <= 1) score += 10
  const sharedInst = (a.instruments ?? []).filter(i => (b.instruments ?? []).includes(i))
  score += Math.min(sharedInst.length * 3, 15)
  const sharedMood = (a.mood ?? []).filter(m => (b.mood ?? []).includes(m))
  score += Math.min(sharedMood.length * 5, 20)
  return Math.min(score, 100)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/components/pipeline/audio/audio-helpers.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/audio/_helpers/audio-helpers.ts \
        apps/web/test/components/pipeline/audio/audio-helpers.test.ts
git commit -m "feat(audio): add pure utility helpers — energyColor, formatDuration, categoryConfig, similarityScore"
```

---

## Task 2: WaveformDisplay Unified Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/waveform-display.tsx`
- Test: `apps/web/test/components/pipeline/audio/waveform-display.test.ts`
- Read: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/waveform.tsx` (reuse `resamplePeaks`)

- [ ] **Step 1: Write failing tests**

```ts
// apps/web/test/components/pipeline/audio/waveform-display.test.ts
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { WaveformDisplay } from
  '@/app/cms/(authed)/pipeline/audio/_components/waveform-display'

describe('WaveformDisplay', () => {
  describe('variant="table"', () => {
    it('renders SVG with correct dimensions', () => {
      const { container } = render(
        <WaveformDisplay variant="table" peaks={[0.5, 0.8, 0.3]} />
      )
      const svg = container.querySelector('svg')
      expect(svg).toBeTruthy()
      expect(svg?.getAttribute('width')).toBe('56')
      expect(svg?.getAttribute('height')).toBe('20')
    })

    it('renders flat line shimmer when peaks empty', () => {
      const { container } = render(
        <WaveformDisplay variant="table" peaks={[]} />
      )
      const rects = container.querySelectorAll('rect')
      expect(rects.length).toBe(1) // single flat line
    })
  })

  describe('variant="card"', () => {
    it('renders shimmer bars when peaks empty', () => {
      const { container } = render(
        <WaveformDisplay variant="card" peaks={[]} />
      )
      const rects = container.querySelectorAll('rect')
      expect(rects.length).toBeGreaterThan(10) // shimmer bars
    })

    it('applies energy color tinting', () => {
      const { container } = render(
        <WaveformDisplay variant="card" peaks={[0.5, 0.8]} energy={5} />
      )
      const wrapper = container.firstElementChild as HTMLElement
      expect(wrapper.style.getPropertyValue('--energy-color')).toBe('#ef4444')
    })
  })

  describe('variant="detail"', () => {
    it('renders mirrored bars with reflection', () => {
      const peaks = Array.from({ length: 50 }, (_, i) => i / 50)
      const { container } = render(
        <WaveformDisplay variant="detail" peaks={peaks} />
      )
      const rects = container.querySelectorAll('rect')
      // Each peak produces 2 rects (upper + lower reflection)
      expect(rects.length).toBeGreaterThan(50)
    })

    it('shows duration label when provided', () => {
      const { getByText } = render(
        <WaveformDisplay variant="detail" peaks={[0.5]} duration={185} />
      )
      expect(getByText('3:05')).toBeTruthy()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run test/components/pipeline/audio/waveform-display.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement WaveformDisplay**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/audio/_components/waveform-display.tsx
'use client'

import { memo, useId } from 'react'
import { resamplePeaks } from './waveform'
import { energyColor } from '../_helpers/audio-helpers'

type Variant = 'card' | 'table' | 'detail'
type AudioType = 'music' | 'sfx'

interface WaveformDisplayProps {
  variant: Variant
  peaks: number[]
  energy?: number | null
  type?: AudioType
  duration?: number | null
}

const VARIANT_CONFIG = {
  card: { height: 64, barWidth: 4, gap: 2, defaultBars: 32 },
  table: { height: 20, barWidth: 2, gap: 1, defaultBars: 14 },
  detail: { height: 72, barWidth: 5, gap: 1, defaultBars: 60 },
} as const

const SHIMMER_HEIGHTS_CARD = [10, 18, 28, 22, 36, 44, 32, 24, 38, 18, 28, 14, 20, 30, 12, 22, 16]
const SHIMMER_HEIGHTS_DETAIL = [20, 34, 48, 40, 56, 62, 50, 38, 52, 28]

const BASE_COLORS = { music: '#a78bfa', sfx: '#22d3ee' } as const

function WaveformDisplayInner({ variant, peaks, energy, type = 'music', duration }: WaveformDisplayProps) {
  const id = useId()
  const config = VARIANT_CONFIG[variant]
  const baseColor = BASE_COLORS[type]
  const eColor = energyColor(energy)
  const hasPeaks = peaks.length > 0

  if (variant === 'table') {
    return (
      <svg width="56" height="20" aria-hidden="true" style={{ display: 'block' }}>
        {!hasPeaks ? (
          <rect
            x="6" y="9" width="44" height="2" rx="1"
            fill="url(#flat-line)" opacity="0.4"
            style={{ animation: 'pulse-subtle 2s ease-in-out infinite' }}
          >
            <defs>
              <linearGradient id={`${id}-flat`}>
                <stop offset="0%" stopColor="transparent" />
                <stop offset="50%" stopColor="#5a6b7f" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </rect>
        ) : (
          <>
            <defs>
              <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={baseColor} />
                <stop offset="100%" stopColor={type === 'sfx' ? '#06b6d4' : '#6366f1'} />
              </linearGradient>
            </defs>
            {resamplePeaks(peaks, 14).map((p, i) => {
              const h = Math.max(2, p * 16)
              const x = 1 + i * 4
              return (
                <g key={i} opacity={0.6 + p * 0.4}>
                  <rect x={x} y={10 - h / 2} width={2} height={h} rx={1} fill={`url(#${id}-g)`} />
                </g>
              )
            })}
          </>
        )}
      </svg>
    )
  }

  // Card and Detail variants
  const isCard = variant === 'card'
  const barCount = isCard ? config.defaultBars : Math.min(Math.max(40, config.defaultBars), 80)
  const totalWidth = barCount * (config.barWidth + config.gap)
  const cy = config.height / 2

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: config.height,
    borderRadius: isCard ? undefined : 6,
    overflow: 'hidden',
    '--energy-color': eColor,
    background: `linear-gradient(135deg, color-mix(in srgb, ${baseColor} 10%, #0c1222), color-mix(in srgb, ${eColor} ${isCard ? '5' : '8'}%, #0c1222))`,
  } as React.CSSProperties

  if (!hasPeaks) {
    const shimmerHeights = isCard ? SHIMMER_HEIGHTS_CARD : SHIMMER_HEIGHTS_DETAIL
    return (
      <div style={wrapperStyle}>
        <svg width="100%" height={config.height} preserveAspectRatio="none" aria-hidden="true"
          viewBox={`0 0 ${shimmerHeights.length * (config.barWidth + config.gap)} ${config.height}`}
        >
          <defs>
            <linearGradient id={`${id}-sh`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {shimmerHeights.map((h, i) => {
            const x = i * (config.barWidth + config.gap)
            const scaledH = (h / 64) * (config.height - 8)
            return (
              <rect key={i} x={x} y={cy - scaledH / 2} width={config.barWidth} height={scaledH} rx={2}
                fill={`url(#${id}-sh)`}
                style={{ animation: `pulse-subtle 1.5s ease-in-out infinite`, animationDelay: `${i * 0.08}s` }}
              />
            )
          })}
        </svg>
        {variant === 'detail' && (
          <span style={{
            position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
            fontSize: 8, color: '#5a6b7f',
          }}>
            Waveform available after download
          </span>
        )}
      </div>
    )
  }

  const resampled = resamplePeaks(peaks, barCount)

  return (
    <div style={wrapperStyle}>
      <svg width="100%" height={config.height} preserveAspectRatio="none" aria-hidden="true"
        viewBox={`0 0 ${totalWidth} ${config.height}`}
      >
        <defs>
          <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={baseColor} />
            <stop offset="100%" stopColor={eColor} stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {resampled.map((p, i) => {
          const maxH = cy - 4
          const h = Math.max(2, p * maxH)
          const x = i * (config.barWidth + config.gap)
          const opacity = 0.4 + p * 0.6
          return (
            <g key={i}>
              <rect x={x} y={cy - h} width={config.barWidth} height={h} rx={2}
                fill={`url(#${id}-bar)`} opacity={opacity} />
              <rect x={x} y={cy} width={config.barWidth} height={h * (variant === 'detail' ? 0.5 : 0.3)} rx={2}
                fill={`url(#${id}-bar)`} opacity={opacity * (variant === 'detail' ? 0.3 : 0.2)} />
            </g>
          )
        })}
      </svg>
      {variant === 'detail' && duration != null && (
        <span style={{
          position: 'absolute', bottom: 4, right: 8,
          fontSize: 10, color: '#5a6b7f', fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.floor(duration / 60)}:{Math.round(duration % 60).toString().padStart(2, '0')}
        </span>
      )}
    </div>
  )
}

export const WaveformDisplay = memo(WaveformDisplayInner)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/components/pipeline/audio/waveform-display.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/audio/_components/waveform-display.tsx \
        apps/web/test/components/pipeline/audio/waveform-display.test.ts
git commit -m "feat(audio): unified WaveformDisplay component with card/table/detail variants"
```

---

## Task 3: Audio Card Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-card.tsx`
- Test: `apps/web/test/components/pipeline/audio/audio-card.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// apps/web/test/components/pipeline/audio/audio-card.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { AudioCard } from '@/app/cms/(authed)/pipeline/audio/_components/audio-card'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'

const mockAsset: AudioAssetRow = {
  id: '1', asset_id: 'test-001', site_id: 's1', type: 'music',
  track_name: 'Epic Journey', artist: 'Test Artist', category: 'cinematic',
  status: 'downloaded', energy: 4, bpm: 128, music_key: 'D',
  duration_seconds: 185, tags: ['epic', 'trailer'], mood: ['powerful'],
  instruments: ['strings', 'drums'], peaks: [0.2, 0.5, 0.8, 0.4],
  original_filename: 'epic.mp3', source: 'artlist',
  created_at: '2026-01-01', updated_at: '2026-01-01', version: 1,
} as AudioAssetRow

describe('AudioCard', () => {
  it('renders track name and artist', () => {
    const { getByText } = render(
      <AudioCard asset={mockAsset} selected={false} onSelect={vi.fn()} />
    )
    expect(getByText('Epic Journey')).toBeTruthy()
    expect(getByText(/Test Artist/)).toBeTruthy()
  })

  it('shows energy dots matching energy level', () => {
    const { container } = render(
      <AudioCard asset={mockAsset} selected={false} onSelect={vi.fn()} />
    )
    const dots = container.querySelectorAll('[data-energy-dot]')
    expect(dots.length).toBe(5)
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <AudioCard asset={mockAsset} selected={false} onSelect={onSelect} />
    )
    fireEvent.click(container.firstElementChild!)
    expect(onSelect).toHaveBeenCalledWith('1')
  })

  it('applies selected styles', () => {
    const { container } = render(
      <AudioCard asset={mockAsset} selected={true} onSelect={vi.fn()} />
    )
    const card = container.firstElementChild as HTMLElement
    expect(card.style.borderWidth).toBe('2px')
  })

  it('renders pending state with shimmer', () => {
    const pending = { ...mockAsset, status: 'pending' as const, peaks: [] }
    const { getByText } = render(
      <AudioCard asset={pending} selected={false} onSelect={vi.fn()} />
    )
    expect(getByText(/Metadata available after download/)).toBeTruthy()
  })

  it('renders retired state with reduced opacity', () => {
    const retired = { ...mockAsset, status: 'retired' as const }
    const { container } = render(
      <AudioCard asset={retired} selected={false} onSelect={vi.fn()} />
    )
    const card = container.firstElementChild as HTMLElement
    expect(card.style.opacity).toBe('0.55')
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run test/components/pipeline/audio/audio-card.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement AudioCard**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-card.tsx
'use client'

import { memo } from 'react'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'
import { WaveformDisplay } from './waveform-display'
import { energyColor, formatDuration, categoryConfig } from '../_helpers/audio-helpers'

interface AudioCardProps {
  asset: AudioAssetRow
  selected: boolean
  onSelect: (id: string) => void
}

const STATUS_DOT: Record<string, string> = {
  downloaded: '#10b981',
  pending: '#f59e0b',
  retired: '#6b7280',
}

function AudioCardInner({ asset, selected, onSelect }: AudioCardProps) {
  const isRetired = asset.status === 'retired'
  const isPending = asset.status === 'pending'
  const eColor = energyColor(asset.energy)
  const catCfg = categoryConfig(asset.category)
  const peaks = (asset.peaks as number[]) ?? []

  return (
    <div
      role="article"
      tabIndex={0}
      onClick={() => onSelect(asset.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(asset.id) } }}
      aria-label={`${asset.track_name ?? asset.asset_id}, ${asset.type}, ${asset.bpm ? `${asset.bpm} BPM` : ''}, energy ${asset.energy ?? 'unknown'}, ${asset.status}`}
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        border: selected ? '2px solid var(--gem-accent)' : '1px solid var(--gem-border)',
        borderWidth: selected ? '2px' : '1px',
        background: 'var(--gem-surface)',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
        opacity: isRetired ? 0.55 : 1,
        filter: isRetired ? 'saturate(0.3)' : undefined,
        boxShadow: selected ? '0 0 0 1px rgba(99,102,241,0.2), 0 4px 20px rgba(99,102,241,0.1)' : undefined,
        '--card-accent': catCfg.hoverAccent,
      } as React.CSSProperties}
    >
      {/* Energy bar */}
      <div style={{
        height: 2,
        background: `linear-gradient(to right, ${eColor}, transparent 70%)`,
        opacity: isPending ? 0.25 : 1,
      }} />

      {/* Waveform hero */}
      <div style={{ padding: '8px 12px 0', position: 'relative' }}>
        <WaveformDisplay
          variant="card"
          peaks={peaks}
          energy={asset.energy}
          type={asset.type as 'music' | 'sfx'}
        />
        {/* Duration badge */}
        {asset.duration_seconds != null && (
          <span style={{
            position: 'absolute', bottom: 4, right: 10,
            fontSize: 10, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
            color: isRetired ? 'rgba(148,163,184,0.35)' : 'rgba(237,242,247,0.65)',
            background: 'rgba(12,18,34,0.8)', padding: '1px 7px', borderRadius: 4,
          }}>
            {formatDuration(asset.duration_seconds)}
          </span>
        )}
        {/* Status badge (pending/retired only) */}
        {(isPending || isRetired) && (
          <span style={{
            position: 'absolute', top: 14, left: 22, fontSize: 9, fontWeight: 600,
            padding: '1px 7px', borderRadius: 4,
            color: isPending ? '#f59e0b' : '#6b7280',
            background: isPending ? 'rgba(245,158,11,0.1)' : 'rgba(107,114,128,0.12)',
          }}>
            {isPending ? 'pending' : 'retired'}
          </span>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '10px 12px 12px' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 14 }}>{asset.type === 'music' ? '🎵' : '🔊'}</span>
          <span style={{
            fontSize: 12, fontWeight: 600, color: 'var(--gem-text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {asset.track_name ?? asset.asset_id}
          </span>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: STATUS_DOT[asset.status] ?? '#6b7280',
          }} />
        </div>

        {/* Artist + category */}
        <div style={{
          fontSize: 10, color: 'var(--gem-dim)', marginBottom: 8,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {asset.artist ?? '—'}
          {asset.category && (
            <span style={{
              fontSize: 9, padding: '0 5px', borderRadius: 3, fontWeight: 500,
              marginLeft: 4, verticalAlign: 'middle',
              background: catCfg.badgeBg, color: catCfg.badgeColor,
            }}>
              {asset.category}
            </span>
          )}
        </div>

        {/* Pending message */}
        {isPending && !peaks.length && (
          <div style={{ fontSize: 10, color: 'var(--gem-dim)', fontStyle: 'italic', marginBottom: 8 }}>
            Metadata available after download
          </div>
        )}

        {/* Metadata line */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 10,
          color: 'var(--gem-muted)', marginBottom: 8, flexWrap: 'wrap',
        }}>
          {asset.bpm && (
            <span style={{ color: '#818cf8', fontWeight: 600 }}>{asset.bpm} BPM</span>
          )}
          {asset.bpm && asset.music_key && <span style={{ color: 'var(--gem-dim)', fontSize: 7 }}>·</span>}
          {asset.music_key && (
            <span style={{ color: '#818cf8', fontWeight: 600 }}>{asset.music_key}</span>
          )}
          {(asset.bpm || asset.music_key) && <span style={{ color: 'var(--gem-dim)', fontSize: 7 }}>·</span>}
          {/* Energy dots */}
          <span style={{ fontSize: 11, letterSpacing: 1 }}>
            {[1, 2, 3, 4, 5].map(level => (
              <span
                key={level}
                data-energy-dot
                style={{
                  color: (asset.energy ?? 0) >= level ? energyColor(level) : 'var(--gem-well)',
                }}
              >●</span>
            ))}
          </span>
        </div>

        {/* Tags */}
        {asset.tags && asset.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {asset.tags.slice(0, 3).map(tag => (
              <span key={tag} style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, lineHeight: 1.4,
                background: asset.type === 'music' ? 'rgba(124,58,237,0.1)' : 'rgba(14,165,233,0.1)',
                color: asset.type === 'music' ? '#a78bfa' : '#7dd3fc',
              }}>
                {tag}
              </span>
            ))}
            {asset.tags.length > 3 && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(107,114,128,0.08)', color: '#6b7280' }}>
                +{asset.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const AudioCard = memo(AudioCardInner)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/components/pipeline/audio/audio-card.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-card.tsx \
        apps/web/test/components/pipeline/audio/audio-card.test.tsx
git commit -m "feat(audio): AudioCard component with energy tint, metadata chips, status states"
```

---

## Task 4: Filter State Hook with URL Sync

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_helpers/use-audio-filters.ts`
- Test: `apps/web/test/components/pipeline/audio/use-audio-filters.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// apps/web/test/components/pipeline/audio/use-audio-filters.test.ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudioFilters, serializeFilters, deserializeFilters } from
  '@/app/cms/(authed)/pipeline/audio/_helpers/use-audio-filters'

describe('serializeFilters', () => {
  it('serializes type filter', () => {
    const params = serializeFilters({ type: 'music' })
    expect(params.get('type')).toBe('music')
  })
  it('serializes energy range', () => {
    const params = serializeFilters({ energy_min: 3, energy_max: 5 })
    expect(params.get('energy_min')).toBe('3')
    expect(params.get('energy_max')).toBe('5')
  })
  it('omits null/empty values', () => {
    const params = serializeFilters({ type: null, q: '' })
    expect(params.toString()).toBe('')
  })
})

describe('deserializeFilters', () => {
  it('parses type from URL params', () => {
    const params = new URLSearchParams('type=sfx&bpm_min=100')
    const filters = deserializeFilters(params)
    expect(filters.type).toBe('sfx')
    expect(filters.bpm_min).toBe(100)
  })
  it('returns defaults for empty params', () => {
    const filters = deserializeFilters(new URLSearchParams())
    expect(filters.type).toBeNull()
    expect(filters.sort).toBe('newest')
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run test/components/pipeline/audio/use-audio-filters.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the hook**

```ts
// apps/web/src/app/cms/(authed)/pipeline/audio/_helpers/use-audio-filters.ts
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export interface AudioFilterState {
  q: string | null
  type: 'music' | 'sfx' | null
  status: 'downloaded' | 'pending' | 'retired' | null
  category: string | null
  energy_min: number | null
  energy_max: number | null
  bpm_min: number | null
  bpm_max: number | null
  dur: string | null
  key: string | null
  mode: 'major' | 'minor' | null
  mood: string[] | null
  instruments: string[] | null
  sort: string
}

const DEFAULTS: AudioFilterState = {
  q: null, type: null, status: null, category: null,
  energy_min: null, energy_max: null, bpm_min: null, bpm_max: null,
  dur: null, key: null, mode: null, mood: null, instruments: null, sort: 'newest',
}

export function serializeFilters(partial: Partial<AudioFilterState>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(partial)) {
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue
    if (k === 'sort' && v === 'newest') continue
    params.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  return params
}

export function deserializeFilters(params: URLSearchParams): AudioFilterState {
  const numOrNull = (key: string) => {
    const v = params.get(key)
    return v ? parseInt(v, 10) : null
  }
  const csvOrNull = (key: string) => {
    const v = params.get(key)
    return v ? v.split(',').filter(Boolean) : null
  }
  return {
    q: params.get('q') || null,
    type: (params.get('type') as AudioFilterState['type']) || null,
    status: (params.get('status') as AudioFilterState['status']) || null,
    category: params.get('category') || null,
    energy_min: numOrNull('energy_min'),
    energy_max: numOrNull('energy_max'),
    bpm_min: numOrNull('bpm_min'),
    bpm_max: numOrNull('bpm_max'),
    dur: params.get('dur') || null,
    key: params.get('key') || null,
    mode: (params.get('mode') as AudioFilterState['mode']) || null,
    mood: csvOrNull('mood'),
    instruments: csvOrNull('instruments'),
    sort: params.get('sort') || 'newest',
  }
}

export function useAudioFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [filters, setFiltersLocal] = useState<AudioFilterState>(() => deserializeFilters(searchParams))
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const setFilters = useCallback((updater: Partial<AudioFilterState> | ((prev: AudioFilterState) => AudioFilterState)) => {
    setFiltersLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const params = serializeFilters(next)
        const qs = params.toString()
        router.replace(qs ? `?${qs}` : '?', { scroll: false })
      }, 300)
      return next
    })
  }, [router])

  const clearAll = useCallback(() => {
    setFiltersLocal(DEFAULTS)
    router.replace('?', { scroll: false })
  }, [router])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'sort') return v !== 'newest'
    return v != null && v !== '' && !(Array.isArray(v) && v.length === 0)
  }).length

  return { filters, setFilters, clearAll, activeCount }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/components/pipeline/audio/use-audio-filters.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/audio/_helpers/use-audio-filters.ts \
        apps/web/test/components/pipeline/audio/use-audio-filters.test.ts
git commit -m "feat(audio): useAudioFilters hook with URL persistence and debounced sync"
```

---

## Task 5: Filters Sidebar V2

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-filters-v2.tsx`

- [ ] **Step 1: Create audio-filters-v2.tsx**

This is a large UI component. Create it with the two-tier architecture:
- Sticky header: search (with `/` hotkey), active pills, sort dropdown
- Scrollable body: Type segmented, Status segmented, Category chips, Energy bar, BPM inputs + presets, Duration chips
- Advanced collapsible: Key piano layout, Mood chips, Instruments chips

Key implementation details:
- All filter changes call `setFilters` from the hook (Task 4)
- Category/Mood/Instrument chips derive counts from `assets` array via `useMemo`
- Zero-count chips: `opacity: 0.35`, `pointerEvents: 'none'`, `aria-disabled`
- Energy bar: click one segment = exact, click two different = min/max range
- BPM presets: Slow (60-90), Mid (90-130), Fast (130-180)
- ARIA: combobox for search, slider for energy, listbox for multi-selects
- Custom 4px scrollbar styling

The component receives:
```ts
interface AudioFiltersV2Props {
  filters: AudioFilterState
  setFilters: (partial: Partial<AudioFilterState>) => void
  clearAll: () => void
  activeCount: number
  assets: AudioAssetRow[]
  availableTags: string[]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-filters-v2.tsx
git commit -m "feat(audio): two-tier filters sidebar with URL sync, energy bar, collapsible advanced"
```

---

## Task 6: Grid Container V2

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-grid-v2.tsx`

- [ ] **Step 1: Create grid container**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-grid-v2.tsx
'use client'

import { useRef, useEffect } from 'react'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'
import { AudioCard } from './audio-card'

interface AudioGridV2Props {
  assets: AudioAssetRow[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function AudioGridV2({ assets, selectedId, onSelect }: AudioGridV2Props) {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gridRef.current) return
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          el.style.animationPlayState = 'running'
          observer.unobserve(el)
        }
      }
    }, { threshold: 0.1 })

    const cards = gridRef.current.querySelectorAll('[data-card-animate]')
    cards.forEach(card => observer.observe(card))
    return () => observer.disconnect()
  }, [assets])

  if (assets.length === 0) return null

  return (
    <div
      ref={gridRef}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 340px))',
        gap: 14,
      }}
    >
      {assets.map((asset, i) => (
        <div
          key={asset.id}
          data-card-animate
          style={{
            animation: 'fade-in-up 0.3s ease-out both',
            animationDelay: `${Math.min(i * 30, 300)}ms`,
            animationPlayState: 'paused',
          }}
        >
          <AudioCard
            asset={asset}
            selected={asset.id === selectedId}
            onSelect={onSelect}
          />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-grid-v2.tsx
git commit -m "feat(audio): grid container with IntersectionObserver stagger animation"
```

---

## Task 7: Table View V2

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-table-v2.tsx`

- [ ] **Step 1: Create table component**

Key implementation details:
- Columns: checkbox, waveform (WaveformDisplay variant="table"), name (primary + secondary line), type badge, category dot+label, energy dots, BPM, duration, key badge, artist, status badge
- Toolbar: result count, density toggle (compact/default/comfortable), column picker popover
- Sort via `useMemo` on header click, `aria-sort` attributes
- Bulk action bar when checked.size > 0: Set Tag, Set Category, Set Status, Export JSON, Delete
- `React.memo` on row component
- Missing data renders `—` at opacity 0.4
- Density stored in a `density` state variable: changes padding on `td` and waveform height
- Column picker: simple popover with checkboxes, stored in state (persisted via localStorage in a follow-up)

Props interface:
```ts
interface AudioTableV2Props {
  assets: AudioAssetRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRefetch?: () => void
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-table-v2.tsx
git commit -m "feat(audio): table view with density modes, column picker, bulk actions, inline waveform"
```

---

## Task 8: Detail Panel V2

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-detail-v2.tsx`

- [ ] **Step 1: Create detail panel**

Key implementation details:
- Width: 360px fixed, slides in from right (200ms cubic-bezier(0.16, 1, 0.3, 1))
- Header: title (15px bold), subtitle (artist · slug · version), quick stats pills (BPM, duration, key, type, status), Edit + Close buttons
- Waveform: `<WaveformDisplay variant="detail" />` with full 72px height
- Tabs: Details | Usage | Related | Raw — via local `activeTab` state
- Details tab: Classification, Audio (energy bar visual), Instruments/Tags/Mood chips (click-to-filter), Notes, Compatibility
- Related tab: top 5 by `similarityScore()` from helpers
- Edit mode: inline inputs (no modals), version-based optimistic concurrency, 409 conflict handling
- Chips are interactive: clicking one calls `setFilters` from the parent to apply as filter
- Keyboard: Escape cancels edit mode first, then closes panel
- Focus trap when panel is open

Props interface:
```ts
interface AudioDetailV2Props {
  assetId: string
  allAssets: AudioAssetRow[]
  onClose: () => void
  onFilter: (partial: Partial<AudioFilterState>) => void
  fullWidth?: boolean
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-detail-v2.tsx
git commit -m "feat(audio): detail panel with tabs, related tracks, inline edit, click-to-filter chips"
```

---

## Task 9: Empty States and Skeleton

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-empty.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-skeleton.tsx`

- [ ] **Step 1: Create empty states**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-empty.tsx
'use client'

interface AudioEmptyProps {
  variant: 'no-assets' | 'no-results'
  onImport?: () => void
  onClearFilters?: () => void
}

export function AudioEmpty({ variant, onImport, onClearFilters }: AudioEmptyProps) {
  if (variant === 'no-assets') {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px' }}>
        <div style={{ fontSize: 36, opacity: 0.3, marginBottom: 12 }}>🎵</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gem-text)', marginBottom: 4 }}>
          No audio assets yet
        </div>
        <div style={{ fontSize: 12, color: 'var(--gem-muted)', marginBottom: 16 }}>
          Import your first tracks to start building your audio library.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button
            onClick={onImport}
            style={{
              fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 5,
              background: 'var(--gem-accent)', color: 'white', border: 'none', cursor: 'pointer',
            }}
          >
            Import JSON
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: 28, opacity: 0.4, marginBottom: 8 }}>🎼</div>
      <div style={{ fontSize: 12, color: 'var(--gem-muted)', marginBottom: 4 }}>
        No tracks match your current filters
      </div>
      <div style={{ fontSize: 11, color: 'var(--gem-dim)', marginBottom: 8 }}>
        Try removing some filters or broadening your search
      </div>
      <button
        onClick={onClearFilters}
        style={{
          fontSize: 11, color: 'var(--gem-accent)', background: 'none', border: 'none',
          cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2,
        }}
      >
        Clear all filters
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create skeleton loading**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-skeleton.tsx
'use client'

export function AudioGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 340px))',
      gap: 14,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--gem-border)', background: 'var(--gem-surface)',
        }}>
          <div style={{
            height: 64, background: 'var(--gem-well)',
            animation: 'shimmer 1.5s infinite',
            animationDelay: `${i * 0.2}s`,
            backgroundImage: 'linear-gradient(90deg, var(--gem-well) 25%, var(--gem-surface) 50%, var(--gem-well) 75%)',
            backgroundSize: '200% 100%',
          }} />
          <div style={{ padding: '10px 12px 12px' }}>
            <div style={{ height: 12, width: '80%', borderRadius: 4, background: 'var(--gem-well)', marginBottom: 6,
              animation: 'shimmer 1.5s infinite', backgroundImage: 'linear-gradient(90deg, var(--gem-well) 25%, var(--gem-surface) 50%, var(--gem-well) 75%)', backgroundSize: '200% 100%',
            }} />
            <div style={{ height: 10, width: '60%', borderRadius: 4, background: 'var(--gem-well)', marginBottom: 10,
              animation: 'shimmer 1.5s infinite', backgroundImage: 'linear-gradient(90deg, var(--gem-well) 25%, var(--gem-surface) 50%, var(--gem-well) 75%)', backgroundSize: '200% 100%',
            }} />
            <div style={{ height: 10, width: '40%', borderRadius: 4, background: 'var(--gem-well)',
              animation: 'shimmer 1.5s infinite', backgroundImage: 'linear-gradient(90deg, var(--gem-well) 25%, var(--gem-surface) 50%, var(--gem-well) 75%)', backgroundSize: '200% 100%',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AudioFilterSkeleton() {
  return (
    <div style={{
      width: 280, borderRadius: 10, padding: 14,
      border: '1px solid var(--gem-border)', background: 'var(--gem-surface)',
    }}>
      {[120, 80, 100, 60, 90].map((w, i) => (
        <div key={i} style={{
          height: 28, width: w, borderRadius: 6, background: 'var(--gem-well)', marginBottom: 12,
          animation: 'shimmer 1.5s infinite',
          backgroundImage: 'linear-gradient(90deg, var(--gem-well) 25%, var(--gem-surface) 50%, var(--gem-well) 75%)',
          backgroundSize: '200% 100%',
        }} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-empty.tsx \
        apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-skeleton.tsx
git commit -m "feat(audio): empty states and skeleton loading components"
```

---

## Task 10: Toast System

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-toast.tsx`

- [ ] **Step 1: Create toast component**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-toast.tsx
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'delete'
  message: string
  onUndo?: () => void
}

interface ToastItemProps {
  toast: Toast
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [countdown, setCountdown] = useState(5)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    const duration = toast.type === 'success' ? 3000 : 5000
    const dismiss = setTimeout(() => onDismiss(toast.id), duration)

    if (toast.type === 'delete') {
      timerRef.current = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    }

    return () => { clearTimeout(dismiss); clearInterval(timerRef.current) }
  }, [toast, onDismiss])

  const borderColor = toast.type === 'error'
    ? 'color-mix(in srgb, var(--gem-danger) 30%, var(--gem-border))'
    : toast.type === 'delete'
      ? 'color-mix(in srgb, var(--gem-warn) 30%, var(--gem-border))'
      : 'var(--gem-border)'

  return (
    <div style={{
      background: 'var(--gem-surface)', border: `1px solid ${borderColor}`,
      borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
      animation: 'fade-in-up 0.3s ease-out', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      fontSize: 11, color: 'var(--gem-text)', minWidth: 240, maxWidth: 360,
    }}>
      <span style={{ flexShrink: 0 }}>
        {toast.type === 'success' && '✓'}
        {toast.type === 'error' && '✕'}
        {toast.type === 'delete' && '🗑'}
      </span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      {toast.type === 'error' && (
        <button onClick={() => onDismiss(toast.id)} style={{
          fontSize: 10, color: 'var(--gem-danger)', background: 'none',
          border: 'none', cursor: 'pointer', fontWeight: 600,
        }}>Retry</button>
      )}
      {toast.type === 'delete' && toast.onUndo && (
        <button onClick={toast.onUndo} style={{
          fontSize: 10, color: 'var(--gem-warn)', background: 'none',
          border: 'none', cursor: 'pointer', fontWeight: 600,
        }}>Undo ({countdown}s)</button>
      )}
    </div>
  )
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev.slice(-2), { ...toast, id }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, dismissToast }
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', gap: 8, zIndex: 200,
    }}>
      {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  )
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-toast.tsx
git commit -m "feat(audio): toast notification system with undo countdown"
```

---

## Task 11: Wire Everything — AudioLibrary Orchestrator

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-library.tsx`

- [ ] **Step 1: Rewrite audio-library.tsx as the new orchestrator**

Replace the entire file with the new three-column layout:
- Filter sidebar (AudioFiltersV2) — 280px, sticky, collapsible on mobile
- Content area (AudioGridV2 or AudioTableV2) — flex:1, with view toggle toolbar
- Detail panel (AudioDetailV2) — 360px, conditional render

Key wiring:
- `useAudioFilters()` hook at the top for state + URL sync
- Pass `filters` + `setFilters` to all children
- Existing fetch/pagination logic (refetch, loadMore, abort controllers) stays but uses new filter state
- View mode toggle: two buttons (Grid / Table) in the toolbar
- Keyboard shortcuts preserved: `/` search, `g`+`t` toggle, `j`/`k` navigate, `Escape` close
- `useToasts()` for bulk action feedback
- `<ToastContainer>` rendered at bottom
- Loading: `<AudioGridSkeleton>` during initial load
- Empty: `<AudioEmpty>` when no assets or no filter results

Layout CSS:
```css
display: flex; height: calc(100vh - 4rem); overflow: hidden;
```
- Filter column: `width: 280px; flex-shrink: 0; position: sticky; top: 0;`
- Content column: `flex: 1; overflow-y: auto; padding: 24px;`
- Detail column: `width: 360px; flex-shrink: 0;` (conditional)

- [ ] **Step 2: Update page.tsx imports**

Update `page.tsx` to remove old `AudioSkeleton` (replaced by new skeleton components). The `AudioLibrary` import stays the same (same file, new implementation).

- [ ] **Step 3: Add keyframes to globals.css**

Add to `apps/web/src/app/globals.css` inside the existing `@keyframes` section:

```css
@keyframes card-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes toast-in {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

- [ ] **Step 4: Verify full TypeScript compilation**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 5: Run all web tests**

Run: `npm run test:web`
Expected: All existing tests pass (new components don't break old tests; old component files still exist but are no longer imported)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-library.tsx \
        apps/web/src/app/cms/(authed)/pipeline/audio/page.tsx \
        apps/web/src/app/globals.css
git commit -m "feat(audio): wire new three-column layout orchestrator with all v2 components"
```

---

## Task 12: Update Existing Tests

**Files:**
- Modify: `apps/web/test/cms/pipeline/audio/audio-library.test.tsx`

- [ ] **Step 1: Update test imports and assertions**

The `audio-library.test.tsx` test file likely renders `AudioLibrary` with mocked props. The component signature (`initialAssets` + `stats`) hasn't changed, but internal rendering has. Update assertions to match new DOM structure:
- Cards now have `role="article"` and `data-energy-dot` attributes
- Filter sidebar structure changed
- View toggle buttons exist in toolbar

Update mocks for `useSearchParams` and `useRouter` since the new hook uses them.

- [ ] **Step 2: Run the specific test file**

Run: `npx vitest run test/cms/pipeline/audio/audio-library.test.tsx`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `npm run test:web`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/cms/pipeline/audio/
git commit -m "test(audio): update audio library tests for v2 component structure"
```

---

## Task 13: Visual QA and Polish

**Files:** Various — fix any visual issues found during manual testing

- [ ] **Step 1: Start dev server**

Run: `npm run dev -w apps/web`
Navigate to: `http://localhost:3000/cms/pipeline/audio`

- [ ] **Step 2: Verify grid view**

Check:
- Waveform visible on all cards (no blank areas)
- Energy color tinting matches energy level
- BPM/key highlighted in accent color
- Tags render as pills
- Hover: card lifts with shadow
- Status dots correct colors
- Pending cards show shimmer + italic text
- Retired cards dimmed

- [ ] **Step 3: Verify filter sidebar**

Check:
- Search with `/` hotkey
- Type/Status segmented controls toggle
- Category chips with counts
- Energy bar selection (single + range)
- BPM presets populate inputs
- Advanced section collapses/expands
- Active pills appear with dismiss
- "Clear all" resets everything
- URL params update (check browser URL bar)

- [ ] **Step 4: Verify table view**

Check:
- Toggle Grid ↔ Table works
- Inline waveform SVG visible
- Sort by clicking headers
- Density toggle changes row height
- Bulk select + action bar appears
- Column picker shows/hides columns

- [ ] **Step 5: Verify detail panel**

Check:
- Click card → panel slides in from right
- Tabs switch content (Details, Usage, Related, Raw)
- Edit mode: fields become inputs
- Save with version conflict shows banner
- Close: Escape or ✕ button
- Chips clickable (applies filter)
- Related tab shows similar tracks

- [ ] **Step 6: Verify responsive**

Check at <900px:
- Filter sidebar collapses to button + drawer
- Detail panel becomes full-width overlay
At <600px:
- Grid becomes single column

- [ ] **Step 7: Fix any issues found, commit**

```bash
git add -A
git commit -m "fix(audio): visual QA polish pass"
```

---

## Summary

| Task | Component | Est. Time |
|------|-----------|-----------|
| 1 | Audio helpers (pure utils) | 5 min |
| 2 | WaveformDisplay unified | 15 min |
| 3 | AudioCard | 15 min |
| 4 | useAudioFilters hook | 10 min |
| 5 | Filters Sidebar V2 | 25 min |
| 6 | Grid Container V2 | 5 min |
| 7 | Table View V2 | 25 min |
| 8 | Detail Panel V2 | 25 min |
| 9 | Empty + Skeleton | 10 min |
| 10 | Toast system | 10 min |
| 11 | Orchestrator wiring | 20 min |
| 12 | Update tests | 15 min |
| 13 | Visual QA | 20 min |
| **Total** | | **~3.5 hours** |
