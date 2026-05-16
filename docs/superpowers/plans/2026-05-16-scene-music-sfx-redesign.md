# Scene Music & SFX Recommendation UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Music/SFX sections in `scene-guide-renderer.tsx` from flat status badges into a recommendation engine UI with score gauges, editorial reasoning, alternatives with delta notes, and Artlist search links.

**Architecture:** Extract 6 new sub-components (`ScoreGauge`, `EnergyIndicator`, `CoworkReasoning`, `MusicRecommendationCard`, `MusicAlternativeRow`, `SFXItemCard`) into a co-located `_music-sfx/` directory next to the renderer. Rewrite `AudioSummary` to split music/SFX progress. All data is pre-resolved by Cowork — purely presentational, no API calls.

**Tech Stack:** React 19, TypeScript 5, Tailwind 4, Vitest + React Testing Library

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/types.ts` | Create | Shared interfaces (`SceneMusic`, `SceneSFX`, constants) |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-utils.ts` | Create | Color logic, gauge math, delta helpers |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-gauge.tsx` | Create | SVG donut mini-component |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/energy-indicator.tsx` | Create | 1-5 dot display |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/cowork-reasoning.tsx` | Create | Italic blockquote |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-recommendation-card.tsx` | Create | Starred favorite card |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-alternative-row.tsx` | Create | Compact alternative row |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/sfx-item-card.tsx` | Create | SFX row card |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/audio-summary.tsx` | Create | Split progress bars (replaces inline) |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/index.ts` | Create | Barrel exports |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx` | Modify | Import new components, wire into SceneCard |
| `apps/web/src/lib/pipeline/artlist-search.ts` | Modify | Add `buildArtlistSfxUrl` export |
| `apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/score-utils.test.ts` | Create | Unit tests for color/gauge/delta logic |
| `apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/score-gauge.test.tsx` | Create | Render tests for SVG gauge |
| `apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/sfx-item-card.test.tsx` | Create | Render tests for each SFX state |
| `apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/music-cards.test.tsx` | Create | Render tests for music cards |
| `apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/audio-summary.test.tsx` | Create | Integration test for split progress |
| `docs/cowork-pipeline-reference.md` | Modify | Update JSON schemas + examples |

---

### Task 1: Shared Types & Constants

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/types.ts`

- [ ] **Step 1: Create the `_music-sfx` directory and types file**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/types.ts

export type ResolveStatus = 'LOCAL' | 'PENDING_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH'

export type SfxCategory = 'IMPACT' | 'RISER' | 'DROP' | 'TRANSITION' | 'AMBIENT' | 'FOLEY'

export const SCORE_MAX = 34

export interface ScoreBreakdownEntry {
  score: number
  max: number
}

export interface MusicRecommendation {
  track: string
  artist: string
  original_filename?: string
  audio_asset_id?: string
  resolve_status: ResolveStatus
  score: number
  score_max: number
  score_breakdown?: Record<string, ScoreBreakdownEntry>
  reasoning?: string
  delta_vs_favorite?: Record<string, number>
  category?: string
  energy?: number
  bpm?: number
  key?: string
  duration?: string
  artlist_url?: string
}

export interface SceneMusic {
  track?: string
  artist?: string
  original_filename?: string
  audio_asset_id?: string
  resolve_status?: ResolveStatus
  score?: number
  score_breakdown?: Record<string, ScoreBreakdownEntry>
  reasoning?: string
  recommendations?: MusicRecommendation[]
  favorite_index?: number
  search_terms?: string
  artlist_url?: string
  style?: string
  entry_cue?: string
  continuation?: string
}

export interface SceneSFX {
  timestamp: string
  description: string
  search_terms?: string
  audio_asset_id?: string
  resolve_status?: ResolveStatus
  sfx_category?: SfxCategory
  original_filename?: string
  score?: number
  score_max?: number
  artlist_url?: string
}

export const RESOLVE_COLORS: Record<ResolveStatus, { label: string; color: string; bg: string; border: string }> = {
  LOCAL: { label: '✓ Local', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
  PENDING_MATCH: { label: '⏳ Download', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' },
  PARTIAL_MATCH: { label: '~ Partial', color: '#f97316', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.3)' },
  NO_MATCH: { label: '🔗 Search', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)' },
}

export const SFX_CATEGORY_COLORS: Record<SfxCategory, { bg: string; color: string }> = {
  IMPACT: { bg: 'rgba(239,68,68,0.1)', color: '#f87171' },
  RISER: { bg: 'rgba(16,185,129,0.1)', color: '#34d399' },
  DROP: { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24' },
  TRANSITION: { bg: 'rgba(14,165,233,0.1)', color: '#38bdf8' },
  AMBIENT: { bg: 'rgba(107,114,128,0.1)', color: '#9ca3af' },
  FOLEY: { bg: 'rgba(107,114,128,0.1)', color: '#9ca3af' },
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/types.ts
git commit -m "feat(pipeline): add shared types for music/SFX recommendation UI"
```

---

### Task 2: Score Utility Functions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-utils.ts`
- Test: `apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/score-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/score-utils.test.ts
import { describe, it, expect } from 'vitest'
import {
  getScoreColor,
  getBreakdownColor,
  computeGaugeDasharray,
  computeScorePercent,
  formatDeltaNotes,
} from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-utils'

describe('getScoreColor', () => {
  it('returns green for 100%', () => {
    expect(getScoreColor(34, 34)).toBe('#10b981')
  })

  it('returns green for >=75%', () => {
    expect(getScoreColor(26, 34)).toBe('#10b981')
  })

  it('returns amber for 50-74%', () => {
    expect(getScoreColor(17, 34)).toBe('#f59e0b')
  })

  it('returns orange for 25-49%', () => {
    expect(getScoreColor(10, 34)).toBe('#f97316')
  })

  it('returns gray for <25%', () => {
    expect(getScoreColor(5, 34)).toBe('#6b7280')
  })
})

describe('getBreakdownColor', () => {
  it('returns bright green for full score (N/N)', () => {
    expect(getBreakdownColor(8, 8)).toBe('#10b981')
  })

  it('returns light green for >50%', () => {
    expect(getBreakdownColor(5, 8)).toBe('#34d399')
  })

  it('returns amber for <=50% and >0', () => {
    expect(getBreakdownColor(2, 6)).toBe('#f59e0b')
  })

  it('returns dim gray for 0/N', () => {
    expect(getBreakdownColor(0, 8)).toBe('#4b5563')
  })
})

describe('computeGaugeDasharray', () => {
  it('returns correct dasharray for 50%', () => {
    const result = computeGaugeDasharray(17, 34)
    expect(result.filled).toBeCloseTo(47, 0)
    expect(result.empty).toBeCloseTo(47, 0)
  })

  it('returns full arc for 100%', () => {
    const result = computeGaugeDasharray(34, 34)
    expect(result.filled).toBeCloseTo(94, 0)
    expect(result.empty).toBeCloseTo(0, 0)
  })

  it('returns empty arc for 0', () => {
    const result = computeGaugeDasharray(0, 34)
    expect(result.filled).toBe(0)
    expect(result.empty).toBeCloseTo(94, 0)
  })
})

describe('computeScorePercent', () => {
  it('returns rounded percentage', () => {
    expect(computeScorePercent(26, 34)).toBe(76)
  })

  it('returns 0 for 0 score', () => {
    expect(computeScorePercent(0, 34)).toBe(0)
  })

  it('returns 100 for max score', () => {
    expect(computeScorePercent(34, 34)).toBe(100)
  })
})

describe('formatDeltaNotes', () => {
  it('formats negative deltas with category labels', () => {
    const delta = { tags: -2, mood: -2, reuse_scenarios: -4 }
    const result = formatDeltaNotes(delta)
    expect(result).toContain('tags −2')
    expect(result).toContain('mood −2')
    expect(result).toContain('reuse −4')
  })

  it('returns empty string for empty delta', () => {
    expect(formatDeltaNotes({})).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatDeltaNotes(undefined)).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/scene-music-sfx/score-utils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-utils.ts

const CIRCUMFERENCE = 94 // 2 * Math.PI * 15 ≈ 94.2

export function getScoreColor(score: number, max: number): string {
  if (max === 0) return '#6b7280'
  const pct = score / max
  if (pct >= 0.75) return '#10b981'
  if (pct >= 0.50) return '#f59e0b'
  if (pct >= 0.25) return '#f97316'
  return '#6b7280'
}

export function getBreakdownColor(score: number, max: number): string {
  if (max === 0) return '#4b5563'
  if (score === 0) return '#4b5563'
  if (score === max) return '#10b981'
  if (score / max > 0.5) return '#34d399'
  return '#f59e0b'
}

export function computeGaugeDasharray(score: number, max: number): { filled: number; empty: number } {
  if (max === 0) return { filled: 0, empty: CIRCUMFERENCE }
  const ratio = Math.min(score / max, 1)
  const filled = ratio * CIRCUMFERENCE
  return { filled, empty: CIRCUMFERENCE - filled }
}

export function computeScorePercent(score: number, max: number): number {
  if (max === 0) return 0
  return Math.round((score / max) * 100)
}

const CATEGORY_SHORT: Record<string, string> = {
  category: 'cat',
  tags: 'tags',
  mood: 'mood',
  energy: 'energy',
  bpm_in_range: 'bpm',
  duration_in_range: 'dur',
  reuse_scenarios: 'reuse',
  instruments: 'inst',
  description: 'desc',
}

export function formatDeltaNotes(delta: Record<string, number> | undefined): string {
  if (!delta) return ''
  const parts: string[] = []
  for (const [key, value] of Object.entries(delta)) {
    if (value === 0) continue
    const label = CATEGORY_SHORT[key] ?? key
    const sign = value > 0 ? '+' : '−'
    parts.push(`${label} ${sign}${Math.abs(value)}`)
  }
  return parts.join(', ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/scene-music-sfx/score-utils.test.ts`
Expected: All 14 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/score-utils.ts apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/score-utils.test.ts
git commit -m "feat(pipeline): score utility functions with color gradients and gauge math"
```

---

### Task 3: ScoreGauge SVG Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-gauge.tsx`
- Test: `apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/score-gauge.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/score-gauge.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ScoreGauge } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-gauge'

describe('ScoreGauge', () => {
  it('renders SVG with correct percentage text', () => {
    const { container } = render(<ScoreGauge score={26} max={34} />)
    const text = container.querySelector('text')
    expect(text?.textContent).toBe('76%')
  })

  it('renders green stroke for high score', () => {
    const { container } = render(<ScoreGauge score={30} max={34} />)
    const circle = container.querySelectorAll('circle')[1]
    expect(circle?.getAttribute('stroke')).toBe('#10b981')
  })

  it('renders amber stroke for mid score', () => {
    const { container } = render(<ScoreGauge score={18} max={34} />)
    const circle = container.querySelectorAll('circle')[1]
    expect(circle?.getAttribute('stroke')).toBe('#f59e0b')
  })

  it('renders without crashing for 0 score', () => {
    const { container } = render(<ScoreGauge score={0} max={34} />)
    const text = container.querySelector('text')
    expect(text?.textContent).toBe('0%')
  })

  it('applies size prop', () => {
    const { container } = render(<ScoreGauge score={20} max={34} size={48} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('48')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/scene-music-sfx/score-gauge.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-gauge.tsx

import { computeGaugeDasharray, computeScorePercent, getScoreColor } from './score-utils'

interface ScoreGaugeProps {
  score: number
  max: number
  size?: number
}

export function ScoreGauge({ score, max, size = 36 }: ScoreGaugeProps) {
  const pct = computeScorePercent(score, max)
  const color = getScoreColor(score, max)
  const { filled, empty } = computeGaugeDasharray(score, max)
  const r = 15
  const cx = size / 2
  const cy = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={3}
      />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={`${filled} ${empty}`}
        strokeDashoffset={94 / 4}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={cx} y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={size <= 36 ? 9 : 11}
        fontWeight={700}
      >
        {pct}%
      </text>
    </svg>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/scene-music-sfx/score-gauge.test.tsx`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/score-gauge.tsx apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/score-gauge.test.tsx
git commit -m "feat(pipeline): ScoreGauge SVG donut component"
```

---

### Task 4: EnergyIndicator & CoworkReasoning

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/energy-indicator.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/cowork-reasoning.tsx`

- [ ] **Step 1: Write EnergyIndicator**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/energy-indicator.tsx

interface EnergyIndicatorProps {
  level: number // 1-5
}

export function EnergyIndicator({ level }: EnergyIndicatorProps) {
  const clamped = Math.max(1, Math.min(5, Math.round(level)))
  return (
    <span className="inline-flex items-center gap-px" title={`Energy ${clamped}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="inline-block w-[5px] h-[5px] rounded-full"
          style={{
            background: i < clamped ? '#818cf8' : 'rgba(255,255,255,0.1)',
          }}
        />
      ))}
    </span>
  )
}
```

- [ ] **Step 2: Write CoworkReasoning**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/cowork-reasoning.tsx

interface CoworkReasoningProps {
  text: string
  variant?: 'default' | 'no-match'
}

export function CoworkReasoning({ text, variant = 'default' }: CoworkReasoningProps) {
  const bgColor = variant === 'no-match'
    ? 'rgba(192,132,252,0.06)'
    : 'rgba(129,140,248,0.06)'
  const borderColor = variant === 'no-match'
    ? 'rgba(192,132,252,0.2)'
    : 'rgba(129,140,248,0.15)'
  const textColor = variant === 'no-match' ? '#c084fc' : '#a5b4fc'

  return (
    <div
      className="text-[10px] italic leading-snug px-2 py-1.5 rounded"
      style={{ background: bgColor, borderLeft: `2px solid ${borderColor}`, color: textColor }}
    >
      {text}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/energy-indicator.tsx apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/cowork-reasoning.tsx
git commit -m "feat(pipeline): EnergyIndicator and CoworkReasoning micro-components"
```

---

### Task 5: MusicRecommendationCard (Favorite)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-recommendation-card.tsx`
- Test: `apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/music-cards.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/music-cards.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MusicRecommendationCard } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-recommendation-card'
import type { MusicRecommendation } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/types'

const LOCAL_TRACK: MusicRecommendation = {
  track: 'Ocean Depth',
  artist: 'Veaceslav Draganov',
  original_filename: 'Veaceslav Draganov - Ocean Depth.wav',
  resolve_status: 'LOCAL',
  score: 26,
  score_max: 34,
  score_breakdown: {
    category: { score: 5, max: 5 },
    tags: { score: 6, max: 8 },
    mood: { score: 4, max: 6 },
    energy: { score: 3, max: 3 },
    bpm_in_range: { score: 3, max: 3 },
    duration_in_range: { score: 2, max: 2 },
    reuse_scenarios: { score: 0, max: 4 },
    instruments: { score: 3, max: 3 },
  },
  reasoning: 'Dark ambient pads match the cinematic tone needed for the hook.',
  energy: 2,
  bpm: 90,
  key: 'E3',
  duration: '3:42',
}

describe('MusicRecommendationCard', () => {
  it('renders track name and artist', () => {
    render(<MusicRecommendationCard recommendation={LOCAL_TRACK} isFavorite />)
    expect(screen.getByText('Ocean Depth')).toBeTruthy()
    expect(screen.getByText(/Veaceslav Draganov/)).toBeTruthy()
  })

  it('shows star badge when favorite', () => {
    const { container } = render(<MusicRecommendationCard recommendation={LOCAL_TRACK} isFavorite />)
    expect(container.textContent).toContain('★')
  })

  it('shows resolve status badge', () => {
    const { container } = render(<MusicRecommendationCard recommendation={LOCAL_TRACK} isFavorite />)
    expect(container.textContent).toContain('✓ Local')
  })

  it('shows score gauge', () => {
    const { container } = render(<MusicRecommendationCard recommendation={LOCAL_TRACK} isFavorite />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(container.textContent).toContain('76%')
  })

  it('expands to show score breakdown on click', () => {
    const { container } = render(<MusicRecommendationCard recommendation={LOCAL_TRACK} isFavorite />)
    const button = container.querySelector('button')
    fireEvent.click(button!)
    expect(container.textContent).toContain('category')
    expect(container.textContent).toContain('5/5')
  })

  it('shows reasoning text', () => {
    render(<MusicRecommendationCard recommendation={LOCAL_TRACK} isFavorite />)
    expect(screen.getByText(/Dark ambient pads/)).toBeTruthy()
  })

  it('shows PENDING_MATCH with download CTA always visible', () => {
    const pending: MusicRecommendation = { ...LOCAL_TRACK, resolve_status: 'PENDING_MATCH' }
    const { container } = render(<MusicRecommendationCard recommendation={pending} isFavorite />)
    expect(container.textContent).toContain('⏳ Download')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/scene-music-sfx/music-cards.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-recommendation-card.tsx
'use client'

import { useState } from 'react'
import type { MusicRecommendation } from './types'
import { RESOLVE_COLORS } from './types'
import { ScoreGauge } from './score-gauge'
import { EnergyIndicator } from './energy-indicator'
import { CoworkReasoning } from './cowork-reasoning'
import { getBreakdownColor } from './score-utils'

interface MusicRecommendationCardProps {
  recommendation: MusicRecommendation
  isFavorite: boolean
  isNoMatch?: boolean
}

export function MusicRecommendationCard({ recommendation: rec, isFavorite, isNoMatch }: MusicRecommendationCardProps) {
  const [expanded, setExpanded] = useState(false)
  const status = RESOLVE_COLORS[rec.resolve_status]
  const isNoMatchCard = isNoMatch || rec.resolve_status === 'NO_MATCH'

  const borderColor = isFavorite ? status.border : 'rgba(255,255,255,0.06)'
  const bgColor = isFavorite
    ? `${status.bg.replace('0.15', '0.04')}`
    : 'rgba(255,255,255,0.02)'

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{ border: `1px solid ${borderColor}`, background: bgColor }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
        style={{ background: 'transparent' }}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {isFavorite && (
            <span
              className="text-[9px] px-1 rounded font-bold flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}
            >
              ★
            </span>
          )}
          <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--gem-text)' }}>
            {rec.track}
          </span>
          <span className="text-[10px] truncate flex-shrink" style={{ color: 'var(--gem-dim)' }}>
            — {rec.artist}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="text-[9px] px-1.5 py-px rounded font-semibold"
            style={{ background: status.bg, color: status.color }}
          >
            {status.label}
          </span>
          <ScoreGauge score={rec.score} max={rec.score_max} />
        </div>
      </button>

      {rec.reasoning && !expanded && (
        <div className="px-2.5 pb-2 -mt-0.5">
          <CoworkReasoning text={rec.reasoning} variant={isNoMatchCard ? 'no-match' : 'default'} />
        </div>
      )}

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {rec.reasoning && (
            <CoworkReasoning text={rec.reasoning} variant={isNoMatchCard ? 'no-match' : 'default'} />
          )}

          {rec.original_filename && (
            <div className="text-[10px] font-mono" style={{ color: 'var(--gem-dim)' }}>
              📁 {rec.original_filename}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap text-[9px]" style={{ color: 'var(--gem-dim)' }}>
            {rec.key && <span style={{ color: '#818cf8' }}>{rec.key}</span>}
            {rec.bpm && <span style={{ color: '#818cf8' }}>{rec.bpm} BPM</span>}
            {rec.duration && <span style={{ color: '#818cf8' }}>{rec.duration}</span>}
            {rec.energy != null && <EnergyIndicator level={rec.energy} />}
            {rec.category && (
              <span className="px-1.5 py-px rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                {rec.category}
              </span>
            )}
          </div>

          {rec.score_breakdown && (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              {Object.entries(rec.score_breakdown).map(([key, { score, max }]) => (
                <span key={key} className="text-[9px] font-mono" style={{ color: getBreakdownColor(score, max) }}>
                  {key} {score}/{max}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/scene-music-sfx/music-cards.test.tsx`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/music-recommendation-card.tsx apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/music-cards.test.tsx
git commit -m "feat(pipeline): MusicRecommendationCard with expandable score breakdown"
```

---

### Task 6: MusicAlternativeRow

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-alternative-row.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-alternative-row.tsx
'use client'

import { useState } from 'react'
import type { MusicRecommendation } from './types'
import { RESOLVE_COLORS } from './types'
import { ScoreGauge } from './score-gauge'
import { EnergyIndicator } from './energy-indicator'
import { CoworkReasoning } from './cowork-reasoning'
import { formatDeltaNotes, getBreakdownColor } from './score-utils'

interface MusicAlternativeRowProps {
  recommendation: MusicRecommendation
  index: number // 1-based display index
}

export function MusicAlternativeRow({ recommendation: rec, index }: MusicAlternativeRowProps) {
  const [expanded, setExpanded] = useState(false)
  const status = RESOLVE_COLORS[rec.resolve_status]
  const deltaText = formatDeltaNotes(rec.delta_vs_favorite)

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
        style={{ background: 'transparent' }}
      >
        <span className="text-[10px] font-mono flex-shrink-0" style={{ color: '#6b7280' }}>
          {index}.
        </span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[11px] truncate" style={{ color: 'var(--gem-muted)' }}>
            {rec.track}
          </span>
          <span className="text-[10px] truncate" style={{ color: 'var(--gem-dim)' }}>
            — {rec.artist}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {rec.energy != null && <EnergyIndicator level={rec.energy} />}
          <span
            className="text-[9px] px-1.5 py-px rounded font-semibold"
            style={{ background: status.bg, color: status.color }}
          >
            {status.label}
          </span>
          <ScoreGauge score={rec.score} max={rec.score_max} size={28} />
        </div>
      </button>

      {!expanded && deltaText && (
        <div className="px-2.5 pb-1.5 -mt-0.5">
          <span className="text-[9px] font-mono" style={{ color: '#f97316' }}>
            Δ {deltaText}
          </span>
        </div>
      )}

      {!expanded && rec.reasoning && (
        <div className="px-2.5 pb-1.5">
          <span className="text-[9px] italic" style={{ color: 'var(--gem-dim)' }}>
            {rec.reasoning}
          </span>
        </div>
      )}

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {rec.reasoning && <CoworkReasoning text={rec.reasoning} />}
          {rec.original_filename && (
            <div className="text-[10px] font-mono" style={{ color: 'var(--gem-dim)' }}>📁 {rec.original_filename}</div>
          )}
          <div className="flex items-center gap-2 flex-wrap text-[9px]" style={{ color: 'var(--gem-dim)' }}>
            {rec.key && <span style={{ color: '#818cf8' }}>{rec.key}</span>}
            {rec.bpm && <span style={{ color: '#818cf8' }}>{rec.bpm} BPM</span>}
            {rec.duration && <span style={{ color: '#818cf8' }}>{rec.duration}</span>}
            {rec.category && (
              <span className="px-1.5 py-px rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                {rec.category}
              </span>
            )}
          </div>
          {deltaText && (
            <span className="text-[9px] font-mono" style={{ color: '#f97316' }}>Δ {deltaText}</span>
          )}
          {rec.score_breakdown && (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              {Object.entries(rec.score_breakdown).map(([key, { score, max }]) => (
                <span key={key} className="text-[9px] font-mono" style={{ color: getBreakdownColor(score, max) }}>
                  {key} {score}/{max}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/music-alternative-row.tsx
git commit -m "feat(pipeline): MusicAlternativeRow with delta notes and expand"
```

---

### Task 7: SFXItemCard

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/sfx-item-card.tsx`
- Test: `apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/sfx-item-card.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/sfx-item-card.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SFXItemCard } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/sfx-item-card'
import type { SceneSFX } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/types'

describe('SFXItemCard', () => {
  it('renders LOCAL state with filename and score', () => {
    const sfx: SceneSFX = {
      timestamp: '00:06',
      description: 'Impact leve — marca entrada do talking head',
      resolve_status: 'LOCAL',
      sfx_category: 'IMPACT',
      original_filename: 'Deep Low Impact.wav',
      score: 30,
      score_max: 34,
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    expect(container.textContent).toContain('00:06')
    expect(container.textContent).toContain('Impact leve')
    expect(container.textContent).toContain('Deep Low Impact.wav')
    expect(container.textContent).toContain('IMPACT')
    expect(container.textContent).toContain('✓ Local')
  })

  it('renders NO_MATCH with search link', () => {
    const sfx: SceneSFX = {
      timestamp: '00:17',
      description: 'SFX bass drop — marca fim do hook',
      resolve_status: 'NO_MATCH',
      sfx_category: 'DROP',
      search_terms: 'bass drop impact',
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    expect(container.textContent).toContain('🔗 Search')
    const link = container.querySelector('a')
    expect(link).toBeTruthy()
    expect(link?.href).toContain('artlist.io')
  })

  it('renders PARTIAL_MATCH with filename and search fallback', () => {
    const sfx: SceneSFX = {
      timestamp: '00:11',
      description: 'Riser sutil 2s — build tensão',
      resolve_status: 'PARTIAL_MATCH',
      sfx_category: 'RISER',
      original_filename: 'Short Riser.wav',
      score: 15,
      score_max: 34,
      search_terms: 'subtle riser 2s',
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    expect(container.textContent).toContain('~ Partial')
    expect(container.textContent).toContain('Short Riser.wav')
    const link = container.querySelector('a')
    expect(link).toBeTruthy()
  })

  it('renders category pill with correct color', () => {
    const sfx: SceneSFX = {
      timestamp: '00:03',
      description: 'Ambient wind loop',
      resolve_status: 'LOCAL',
      sfx_category: 'AMBIENT',
      original_filename: 'Wind.wav',
      score: 20,
      score_max: 34,
    }
    const { container } = render(<SFXItemCard sfx={sfx} />)
    expect(container.textContent).toContain('AMBIENT')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/scene-music-sfx/sfx-item-card.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/sfx-item-card.tsx

import type { SceneSFX } from './types'
import { RESOLVE_COLORS, SFX_CATEGORY_COLORS } from './types'
import { computeScorePercent, getScoreColor } from './score-utils'

const SFX_SEARCH_BASE = 'https://artlist.io/royalty-free-sound-effects'

function buildSfxSearchUrl(terms: string): string {
  const encoded = encodeURIComponent(terms).replace(/%20/g, '+')
  return `${SFX_SEARCH_BASE}?search=${encoded}`
}

interface SFXItemCardProps {
  sfx: SceneSFX
}

export function SFXItemCard({ sfx }: SFXItemCardProps) {
  const resolveStatus = sfx.resolve_status ? RESOLVE_COLORS[sfx.resolve_status] : null
  const categoryColor = sfx.sfx_category ? SFX_CATEGORY_COLORS[sfx.sfx_category] : null
  const hasFile = sfx.original_filename && sfx.resolve_status !== 'NO_MATCH'
  const showSearch = sfx.resolve_status === 'NO_MATCH' || sfx.resolve_status === 'PARTIAL_MATCH'
  const searchUrl = sfx.search_terms ? buildSfxSearchUrl(sfx.search_terms) : (sfx.artlist_url ?? null)
  const borderColor = sfx.resolve_status === 'NO_MATCH' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)'

  return (
    <div
      className="rounded-md px-2.5 py-1.5"
      style={{ border: `1px solid ${borderColor}`, background: 'rgba(255,255,255,0.02)' }}
    >
      <div className="flex gap-2 items-start">
        <span className="font-mono text-[10px] flex-shrink-0 mt-0.5" style={{ color: '#818cf8' }}>
          {sfx.timestamp}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {categoryColor && sfx.sfx_category && (
              <span
                className="text-[8px] font-bold uppercase px-1.5 py-px rounded"
                style={{ background: categoryColor.bg, color: categoryColor.color }}
              >
                {sfx.sfx_category}
              </span>
            )}
            <span className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>
              {sfx.description}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {hasFile && (
              <span className="text-[9px] font-semibold" style={{ color: 'var(--gem-text)' }}>
                {sfx.original_filename}
              </span>
            )}
            {resolveStatus && (
              <span
                className="text-[9px] px-1.5 py-px rounded font-semibold"
                style={{ background: resolveStatus.bg, color: resolveStatus.color }}
              >
                {resolveStatus.label}
              </span>
            )}
            {sfx.score != null && sfx.score_max != null && (
              <span
                className="text-[9px] font-bold"
                style={{ color: getScoreColor(sfx.score, sfx.score_max) }}
              >
                {computeScorePercent(sfx.score, sfx.score_max)}%
              </span>
            )}
            {showSearch && searchUrl && (
              <a
                href={searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-medium transition-colors hover:underline"
                style={{ color: '#fbbf24' }}
              >
                ↗ Buscar SFX
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/scene-music-sfx/sfx-item-card.test.tsx`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/sfx-item-card.tsx apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/sfx-item-card.test.tsx
git commit -m "feat(pipeline): SFXItemCard with category pills and Artlist search links"
```

---

### Task 8: AudioSummary Redesign

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/audio-summary.tsx`
- Test: `apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/audio-summary.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/audio-summary.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AudioSummaryV2 } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/audio-summary'
import type { SceneMusic, SceneSFX } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/types'

interface Scene {
  music?: SceneMusic
  sfx?: SceneSFX[]
  [key: string]: unknown
}

const SCENES: Scene[] = [
  {
    music: { track: 'A', resolve_status: 'LOCAL', continuation: undefined },
    sfx: [
      { timestamp: '00:03', description: 'x', resolve_status: 'LOCAL' },
      { timestamp: '00:06', description: 'y', resolve_status: 'NO_MATCH' },
    ],
  },
  {
    music: { track: 'B', resolve_status: 'PENDING_MATCH' },
    sfx: [{ timestamp: '00:01', description: 'z', resolve_status: 'PARTIAL_MATCH' }],
  },
  {
    music: { continuation: 'Continues from Beat 0' },
    sfx: [],
  },
]

describe('AudioSummaryV2', () => {
  it('computes split percentages for music', () => {
    const { container } = render(<AudioSummaryV2 scenes={SCENES as any} />)
    expect(container.textContent).toContain('Música')
  })

  it('computes split percentages for SFX', () => {
    const { container } = render(<AudioSummaryV2 scenes={SCENES as any} />)
    expect(container.textContent).toContain('SFX')
  })

  it('counts continuations separately', () => {
    const { container } = render(<AudioSummaryV2 scenes={SCENES as any} />)
    expect(container.textContent).toContain('1 cont')
  })

  it('renders stat counts as spans', () => {
    const { container } = render(<AudioSummaryV2 scenes={SCENES as any} />)
    expect(container.textContent).toContain('1 local')
    expect(container.textContent).toContain('1 download')
  })

  it('returns null when no audio data', () => {
    const { container } = render(<AudioSummaryV2 scenes={[{ number: 1 }] as any} />)
    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/scene-music-sfx/audio-summary.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/audio-summary.tsx
'use client'

import { useMemo } from 'react'
import type { SceneMusic, SceneSFX } from './types'

const CONTINUES_RE = /^Continues\b|\(continues?\)$|\(continua\)$/i

function isContinuation(music: SceneMusic): boolean {
  if (music.continuation && CONTINUES_RE.test(music.continuation)) return true
  if (music.search_terms && CONTINUES_RE.test(music.search_terms)) return true
  return false
}

interface Scene {
  music?: SceneMusic
  sfx?: SceneSFX[]
  [key: string]: unknown
}

interface Stats {
  total: number
  local: number
  pending: number
  partial: number
  noMatch: number
  continuations: number
}

function computeStats(scenes: Scene[]): { music: Stats; sfx: Stats } {
  const music: Stats = { total: 0, local: 0, pending: 0, partial: 0, noMatch: 0, continuations: 0 }
  const sfx: Stats = { total: 0, local: 0, pending: 0, partial: 0, noMatch: 0, continuations: 0 }

  for (const scene of scenes) {
    if (scene.music) {
      if (isContinuation(scene.music)) {
        music.continuations++
      } else {
        music.total++
        const s = scene.music.resolve_status
        if (s === 'LOCAL') music.local++
        else if (s === 'PENDING_MATCH') music.pending++
        else if (s === 'PARTIAL_MATCH') music.partial++
        else if (s === 'NO_MATCH') music.noMatch++
      }
    }
    if (scene.sfx) {
      for (const fx of scene.sfx) {
        sfx.total++
        const s = fx.resolve_status
        if (s === 'LOCAL') sfx.local++
        else if (s === 'PENDING_MATCH') sfx.pending++
        else if (s === 'PARTIAL_MATCH') sfx.partial++
        else if (s === 'NO_MATCH') sfx.noMatch++
      }
    }
  }

  return { music, sfx }
}

function ProgressBar({ stats }: { stats: Stats }) {
  if (stats.total === 0) return null
  const pctLocal = (stats.local / stats.total) * 100
  const pctPending = (stats.pending / stats.total) * 100
  const pctPartial = (stats.partial / stats.total) * 100
  const resolved = stats.local + stats.pending + stats.partial
  const pctResolved = Math.round((resolved / stats.total) * 100)

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.06)' }}>
        {pctLocal > 0 && <div className="h-full" style={{ width: `${pctLocal}%`, background: '#10b981' }} />}
        {pctPending > 0 && <div className="h-full" style={{ width: `${pctPending}%`, background: '#f59e0b' }} />}
        {pctPartial > 0 && <div className="h-full" style={{ width: `${pctPartial}%`, background: '#f97316' }} />}
      </div>
      <span className="text-[10px] font-bold flex-shrink-0" style={{ color: pctResolved === 100 ? '#10b981' : 'var(--gem-accent)' }}>
        {pctResolved}%
      </span>
    </div>
  )
}

function StatChips({ stats }: { stats: Stats }) {
  return (
    <div className="flex gap-2.5 flex-wrap">
      {stats.local > 0 && <span className="text-[9px]" style={{ color: '#10b981' }}>✓ {stats.local} local</span>}
      {stats.pending > 0 && <span className="text-[9px]" style={{ color: '#f59e0b' }}>⏳ {stats.pending} download</span>}
      {stats.partial > 0 && <span className="text-[9px]" style={{ color: '#f97316' }}>~ {stats.partial} parcial</span>}
      {stats.noMatch > 0 && <span className="text-[9px]" style={{ color: '#3b82f6' }}>🔗 {stats.noMatch} buscar</span>}
    </div>
  )
}

export function AudioSummaryV2({ scenes }: { scenes: Scene[] }) {
  const { music, sfx } = useMemo(() => computeStats(scenes), [scenes])

  if (music.total === 0 && sfx.total === 0 && music.continuations === 0) return null

  return (
    <div className="rounded-md p-2.5 space-y-2" style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}>
      {(music.total > 0 || music.continuations > 0) && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gem-dim)' }}>
              Música
            </span>
            {music.continuations > 0 && (
              <span className="text-[9px]" style={{ color: 'var(--gem-dim)' }}>↩ {music.continuations} cont</span>
            )}
          </div>
          <ProgressBar stats={music} />
          <StatChips stats={music} />
        </div>
      )}

      {sfx.total > 0 && (
        <div className="space-y-1">
          <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gem-dim)' }}>
            SFX
          </span>
          <ProgressBar stats={sfx} />
          <StatChips stats={sfx} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/scene-music-sfx/audio-summary.test.tsx`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/audio-summary.tsx apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/audio-summary.test.tsx
git commit -m "feat(pipeline): AudioSummaryV2 with split music/SFX progress bars"
```

---

### Task 9: Barrel Index

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/index.ts`

- [ ] **Step 1: Write the barrel exports**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/index.ts
export type { SceneMusic, SceneSFX, MusicRecommendation, ResolveStatus, SfxCategory } from './types'
export { RESOLVE_COLORS, SFX_CATEGORY_COLORS, SCORE_MAX } from './types'
export { ScoreGauge } from './score-gauge'
export { EnergyIndicator } from './energy-indicator'
export { CoworkReasoning } from './cowork-reasoning'
export { MusicRecommendationCard } from './music-recommendation-card'
export { MusicAlternativeRow } from './music-alternative-row'
export { SFXItemCard } from './sfx-item-card'
export { AudioSummaryV2 } from './audio-summary'
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/index.ts
git commit -m "feat(pipeline): barrel exports for _music-sfx module"
```

---

### Task 10: Add `buildArtlistSfxUrl` to artlist-search.ts

**Files:**
- Modify: `apps/web/src/lib/pipeline/artlist-search.ts:326-335`

- [ ] **Step 1: Add the export at the end of the file**

After the existing `parseArtlistSfxRef` function (line 335), add:

```typescript
export function buildArtlistSfxUrl(searchTerms: string): string | null {
  const trimmed = searchTerms.trim()
  if (!trimmed) return null
  const encoded = encodeURIComponent(trimmed).replace(/%20/g, '+')
  return `${SFX_BASE}?search=${encoded}`
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/pipeline/artlist-search.ts
git commit -m "feat(pipeline): add buildArtlistSfxUrl export for SFX search links"
```

---

### Task 11: Wire Components into scene-guide-renderer.tsx

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx`

This is the integration task. Replace the inline `AudioSummary`, `SceneMusic` interface, `SceneSFX` interface, and the music/SFX rendering blocks.

- [ ] **Step 1: Update imports (top of file)**

Replace lines 1-10 with:

```typescript
'use client'

import { useState, useMemo, useRef } from 'react'
import type { RendererProps } from '../section-content'
import { TagPill, OptionalBadge, getTagColor } from './tokens'
import { tokenizeText } from './parse-tokens'
import { categorizeNote, type CategorizedNote } from './categorize-note'
import { parseArtlistSearch, parseArtlistSfxRef, buildArtlistMusicUrl } from '@/lib/pipeline/artlist-search'
import {
  type SceneMusic,
  type SceneSFX,
  RESOLVE_COLORS,
  MusicRecommendationCard,
  MusicAlternativeRow,
  SFXItemCard,
  AudioSummaryV2,
} from './_music-sfx'
```

- [ ] **Step 2: Remove old interfaces and AudioSummary**

Delete the following from the file:
- The old `type ResolveStatus` (line 10)
- The old `interface SceneMusic` (lines 12-24)
- The old `interface SceneSFX` (lines 26-32)
- The old `RESOLVE_BADGES` constant (lines 87-92) — replaced by `RESOLVE_COLORS` from import
- The old `AudioSummary` component (lines 263-317) — replaced by `AudioSummaryV2`
- The old `isContinuationTrack` function (lines 228-234) — move to shared if still needed by music section, or keep a local copy for the fallback text rendering
- The old `shouldShowArtlistLink` and `MusicArtlistLink` (lines 236-259) — integrated into new cards

Keep `isContinuationTrack` and `CONTINUES_RE` locally (still used for the fallback text rendering path when no `recommendations` array exists).

- [ ] **Step 3: Replace the music section rendering in SceneCard**

Find the existing music block (approx lines 403-449) and replace with:

```tsx
{scene.music && (
  <SubSection title="Música">
    {scene.music.recommendations && scene.music.recommendations.length > 0 ? (
      <MusicSection music={scene.music} />
    ) : (
      <MusicFallback music={scene.music} />
    )}
  </SubSection>
)}
```

- [ ] **Step 4: Add the MusicSection component above SceneCard**

```tsx
function MusicSection({ music }: { music: SceneMusic }) {
  const recs = music.recommendations ?? []
  const favIndex = music.favorite_index ?? 0
  const favorite = recs[favIndex]

  if (isContinuationTrack(music)) {
    return (
      <div className="flex items-center gap-2 py-1 px-1 rounded" style={{ borderLeft: '2px solid rgba(107,114,128,0.3)' }}>
        <span className="text-[11px]" style={{ color: 'var(--gem-dim)' }}>
          ↩ Continuação da cena anterior
        </span>
        {music.continuation && !CONTINUES_RE.test(music.continuation) && (
          <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>— {music.continuation}</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {favorite && (
        <MusicRecommendationCard recommendation={favorite} isFavorite />
      )}
      {recs.map((rec, i) => {
        if (i === favIndex) return null
        return <MusicAlternativeRow key={i} recommendation={rec} index={i < favIndex ? i + 1 : i} />
      })}
      <MusicArtlistFallback music={music} />
      <MusicDetails music={music} />
    </div>
  )
}

function MusicArtlistFallback({ music }: { music: SceneMusic }) {
  if (music.resolve_status === 'LOCAL' && !music.artlist_url) return null
  if (isContinuationTrack(music)) return null

  const url = music.artlist_url ?? (music.search_terms ? buildArtlistMusicUrl(music.search_terms) : null)
  if (!url) return null

  return (
    <div className="flex items-center gap-2 pt-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[9px] font-medium transition-colors hover:underline"
        style={{ color: '#c084fc' }}
      >
        🔍 Buscar outra no Artlist ↗
      </a>
    </div>
  )
}

function MusicDetails({ music }: { music: SceneMusic }) {
  if (!music.style && !music.entry_cue && !music.continuation) return null

  return (
    <div className="pt-1.5 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {music.style && (
        <div className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>
          <span style={{ color: 'var(--gem-dim)' }}>Estilo: </span>{tokenizeText(music.style)}
        </div>
      )}
      {music.entry_cue && (
        <div className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>
          <span style={{ color: 'var(--gem-dim)' }}>Entrada: </span>{tokenizeText(music.entry_cue)}
        </div>
      )}
      {music.continuation && !isContinuationTrack(music) && (
        <div className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>
          <span style={{ color: 'var(--gem-dim)' }}>Continuação: </span>{tokenizeText(music.continuation)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Add the MusicFallback component (backwards-compatible with old data)**

```tsx
function MusicFallback({ music }: { music: SceneMusic }) {
  const resolveStatus = music.resolve_status ? RESOLVE_COLORS[music.resolve_status] : null

  return (
    <div className="space-y-0.5" style={{ color: 'var(--gem-muted)' }}>
      {music.track && (
        <div className="flex items-center gap-1.5">
          <span className="font-medium" style={{ color: 'var(--gem-text)' }}>{music.track}</span>
          {music.artist && <span style={{ color: 'var(--gem-dim)' }}>— {music.artist}</span>}
          {resolveStatus && (
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
              background: resolveStatus.bg, color: resolveStatus.color,
            }}>
              {resolveStatus.label}
            </span>
          )}
        </div>
      )}
      {!music.track && resolveStatus && (
        <span style={{
          fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
          background: resolveStatus.bg, color: resolveStatus.color,
        }}>
          {resolveStatus.label}
        </span>
      )}
      {isContinuationTrack(music) && (
        <div className="text-[9px] italic" style={{ color: 'var(--gem-dim)' }}>↩ Continuação da cena anterior</div>
      )}
      {music.search_terms && <div><span style={{ color: 'var(--gem-dim)' }}>Busca: </span>{tokenizeText(music.search_terms)}</div>}
      {music.style && <div><span style={{ color: 'var(--gem-dim)' }}>Estilo: </span>{tokenizeText(music.style)}</div>}
      {music.entry_cue && <div><span style={{ color: 'var(--gem-dim)' }}>Entrada: </span>{tokenizeText(music.entry_cue)}</div>}
      {music.continuation && !isContinuationTrack(music) && (
        <div><span style={{ color: 'var(--gem-dim)' }}>Continuação: </span>{tokenizeText(music.continuation)}</div>
      )}
      <MusicArtlistFallback music={music} />
    </div>
  )
}
```

- [ ] **Step 6: Replace the SFX section rendering in SceneCard**

Find the existing SFX block (approx lines 452-488) and replace with:

```tsx
{scene.sfx && scene.sfx.length > 0 && (
  <SubSection title="SFX">
    <div className="space-y-1">
      {scene.sfx.map((fx, i) => (
        <SFXItemCard key={i} sfx={fx} />
      ))}
    </div>
  </SubSection>
)}
```

- [ ] **Step 7: Replace AudioSummary usage**

Find `<AudioSummary scenes={scenes} />` (line 573) and replace with:

```tsx
<AudioSummaryV2 scenes={scenes} />
```

- [ ] **Step 8: Remove the old RESOLVE_BADGES references**

Delete the `RESOLVE_BADGES` constant and ensure nothing else references it. The `RESOLVE_COLORS` import from `_music-sfx` replaces it. If other parts of the renderer (like the old inline SFX rendering) referenced `RESOLVE_BADGES`, those are now removed by the SFX replacement above.

- [ ] **Step 9: Run all existing tests**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/`
Expected: All tests PASS (existing scene-guide-renderer tests still work due to backwards-compatible `MusicFallback`)

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx
git commit -m "feat(pipeline): wire music/SFX recommendation cards into scene-guide-renderer"
```

---

### Task 12: Run Full Test Suite & Fix Regressions

- [ ] **Step 1: Run the full web test suite**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass. If any fail, fix the import paths or type mismatches.

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors. If the old `SceneMusic`/`SceneSFX` types had fewer fields, the new broader types from `_music-sfx/types.ts` are compatible (all new fields are optional).

- [ ] **Step 3: Commit fixes if any**

```bash
git add -u
git commit -m "fix(pipeline): resolve test regressions from music/SFX redesign"
```

---

### Task 13: Update Cowork Pipeline Reference

**Files:**
- Modify: `docs/cowork-pipeline-reference.md` (lines 289-370, 850-866)

- [ ] **Step 1: Update music object schema in the reference doc**

Find the music field documentation section and add the new fields:

```markdown
#### music (object)

| Field | Type | Description |
|-------|------|-------------|
| track | string | Track name |
| artist | string | Artist name |
| original_filename | string? | Local file name (e.g., "Artist - Track.wav") |
| audio_asset_id | string? | UUID from audio_assets table |
| resolve_status | enum? | `LOCAL` \| `PENDING_MATCH` \| `PARTIAL_MATCH` \| `NO_MATCH` |
| score | number? | Resolver score (0-34) |
| score_breakdown | object? | Per-category scores: `{ category: { score, max }, tags: { score, max }, ... }` |
| reasoning | string? | **NEW** — Cowork's editorial reasoning for this pick |
| recommendations | array? | **NEW** — Ranked alternatives (see below) |
| favorite_index | number? | **NEW** — Index of starred favorite in recommendations (default 0) |
| search_terms | string | Space-separated search keywords |
| artlist_url | string? | Pre-built Artlist search URL |
| style | string | Description of desired sound |
| entry_cue | string | When/how the track enters |
| continuation | string? | Cross-beat continuation instruction |

##### recommendations[] item

| Field | Type | Description |
|-------|------|-------------|
| track | string | Track name |
| artist | string | Artist name |
| original_filename | string? | Local filename |
| audio_asset_id | string? | UUID |
| resolve_status | enum | `LOCAL` \| `PENDING_MATCH` \| `PARTIAL_MATCH` \| `NO_MATCH` |
| score | number | Resolver score (0-34) |
| score_max | number | Always 34 |
| score_breakdown | object? | Per-category scores |
| reasoning | string? | One-liner: why consider this alternative |
| delta_vs_favorite | object? | Score difference vs favorite: `{ tags: -2, mood: -2 }` |
| category | string? | e.g., "cinematic", "ambient" |
| energy | number? | 1-5 |
| bpm | number? | Beats per minute |
| key | string? | Musical key (e.g., "E3") |
| duration | string? | Duration formatted (e.g., "3:42") |
| artlist_url | string? | Direct song URL on Artlist |
```

- [ ] **Step 2: Update SFX object schema**

```markdown
#### sfx[] item

| Field | Type | Description |
|-------|------|-------------|
| timestamp | string | When the SFX plays (e.g., "00:06") |
| description | string | What the SFX does |
| search_terms | string? | Search keywords for Artlist |
| audio_asset_id | string? | UUID from audio_assets |
| resolve_status | enum? | `LOCAL` \| `PENDING_MATCH` \| `PARTIAL_MATCH` \| `NO_MATCH` |
| sfx_category | enum? | **NEW** — `IMPACT` \| `RISER` \| `DROP` \| `TRANSITION` \| `AMBIENT` \| `FOLEY` |
| original_filename | string? | **NEW** — Matched file name |
| score | number? | **NEW** — Resolver score (0-34) |
| score_max | number? | **NEW** — Always 34 |
| artlist_url | string? | **NEW** — Direct SFX search URL |
```

- [ ] **Step 3: Update example JSON block**

Add a `recommendations` array to the example music object and `sfx_category`/`score` to SFX items. (Use the actual Beat 0 example from the mockup.)

- [ ] **Step 4: Commit**

```bash
git add docs/cowork-pipeline-reference.md
git commit -m "docs(pipeline): update music/SFX schema with recommendations and sfx_category"
```

- [ ] **Step 5: Re-seed pipeline schemas to DB**

Run: `cd apps/web && node scripts/seed-pipeline-schemas.mjs`
Expected: Success message with updated schema version.

---

### Task 14: Visual QA

- [ ] **Step 1: Start dev server**

Run: `cd apps/web && npm run dev`

- [ ] **Step 2: Navigate to a pipeline item with scene-guide data**

Open the CMS pipeline view with a content item that has `scene-guide` sections. Verify:
- AudioSummaryV2 renders split bars (Música / SFX)
- Old data (no `recommendations`) falls back to `MusicFallback` rendering
- Expanding cards shows score breakdown with gradient colors
- SFX category pills render with correct colors
- Artlist links open in new tab

- [ ] **Step 3: Test with new-format data**

Use browser devtools or a test pipeline item to inject `recommendations` array into a scene's music object. Verify:
- Favorite card shows star, reasoning, gauge
- Alternatives show delta notes
- Click to expand works
- NO_MATCH shows editorial guidance in purple

- [ ] **Step 4: Commit any visual polish fixes**

```bash
git add -u
git commit -m "fix(pipeline): visual polish for music/SFX recommendation cards"
```
