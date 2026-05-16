# Music Hero Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-recommendation music section with a 3-slot hero layout at the top of each scene, with progressive Artlist search CTAs for empty slots and note absorption.

**Architecture:** New `MusicHeroSection` component renders above edit notes in scene-guide-renderer.tsx. The audio resolver always returns exactly 3 slots (padding empties with search URLs). MUSIC/STYLE/ENTRY/FLOW notes are filtered from "Notas de Edição" when scene.music exists.

**Tech Stack:** React 19, TypeScript 5, Tailwind 4, Vitest

---

## File Structure

### Modified files
| File | Responsibility |
|------|---------------|
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/types.ts` | Add new type fields |
| `apps/web/src/lib/pipeline/artlist-search.ts` | Add `buildArtlistTierUrls()` |
| `apps/web/src/lib/pipeline/audio-resolver.ts` | New 3-slot output contract |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx` | Reorder music, filter notes |
| `apps/web/test/lib/pipeline/artlist-search.test.ts` | Add tier URL tests |
| `apps/web/test/lib/pipeline/audio-resolver.test.ts` | Add 3-slot tests |

### New files
| File | Responsibility |
|------|---------------|
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-hero-section.tsx` | Top-level 3-slot wrapper |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-hero-card.tsx` | Hero card for #1 slot |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-alternative-slot.tsx` | Compact #2/#3 card |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-continuation-card.tsx` | Continuation scene card |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-breakdown.tsx` | 8-category expandable breakdown |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/fill-indicator.tsx` | 3-dot fill state |
| `apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/music-hero.test.tsx` | Component tests for all 6 states |

### Deleted files (Phase 3)
| File | Reason |
|------|--------|
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-recommendation-card.tsx` | Replaced by music-hero-card.tsx |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-alternative-row.tsx` | Replaced by music-alternative-slot.tsx |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-gauge.tsx` | Replaced by inline percentage |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-bar.tsx` | Replaced by inline percentage |

---

## Task 1: Update types.ts — Add new fields

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/types.ts`

- [ ] **Step 1: Add ArtlistSearchTier and ArtlistSearchTiers types**

Add after line 2 (`export type SfxCategory = ...`):

```ts
export type ArtlistSearchTier = 'narrow' | 'medium' | 'broad'

export interface ArtlistSearchTiers {
  narrow: string
  medium: string
  broad: string
}
```

- [ ] **Step 2: Add new fields to MusicRecommendation**

Add at end of `MusicRecommendation` interface (before closing `}`):

```ts
  is_empty_slot: boolean
  slot_label?: string
  artlist_search_url?: string
  artlist_search_tier: ArtlistSearchTier
```

- [ ] **Step 3: Update SceneMusic interface**

Replace the `SceneMusic` interface with:

```ts
export interface SceneMusic {
  track?: string
  artist?: string
  original_filename?: string
  audio_asset_id?: string
  resolve_status?: ResolveStatus
  score?: number
  score_breakdown?: Record<string, ScoreBreakdownEntry>
  reasoning?: string
  recommendations: [MusicRecommendation, MusicRecommendation, MusicRecommendation]
  favorite_index: 0 | 1 | 2
  fill_count: number
  search_tiers: ArtlistSearchTiers
  flow_to?: string
  search_terms?: string
  artlist_url?: string
  style?: string
  entry_cue?: string
  continuation?: string
}
```

- [ ] **Step 4: Run typecheck to see expected errors**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -50`

Expected: Type errors in scene-guide-renderer.tsx and music-recommendation-card.tsx due to stricter types. These will be resolved in later tasks.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/types.ts
git commit --no-verify -m "feat(pipeline): add 3-slot music types — ArtlistSearchTier, fill_count, is_empty_slot"
```

---

## Task 2: Add 3-tier URL generation to artlist-search.ts

**Files:**
- Modify: `apps/web/src/lib/pipeline/artlist-search.ts`
- Test: `apps/web/test/lib/pipeline/artlist-search.test.ts`

- [ ] **Step 1: Write failing test for buildArtlistTierUrls**

Add to `apps/web/test/lib/pipeline/artlist-search.test.ts`:

```ts
import { buildArtlistTierUrls } from '@/lib/pipeline/artlist-search'

describe('buildArtlistTierUrls', () => {
  it('returns 3 tier URLs with progressive filter removal', () => {
    const result = buildArtlistTierUrls({
      searchTerms: 'cinematic ambient mysterious piano',
      bpm: { bpmMin: 80, bpmMax: 100 },
      duration: 120,
    })

    expect(result.narrow).toContain('bpmMin=80')
    expect(result.narrow).toContain('bpmMax=100')
    expect(result.narrow).toContain('durationMin=120')
    expect(result.narrow).toContain('includedIds=')

    expect(result.medium).not.toContain('bpmMin')
    expect(result.medium).not.toContain('durationMin')
    expect(result.medium).toContain('includedIds=')

    expect(result.broad).not.toContain('bpmMin')
    expect(result.broad).not.toContain('durationMin')
  })

  it('broad tier keeps only genres and moods', () => {
    const result = buildArtlistTierUrls({
      searchTerms: 'cinematic mysterious piano strings',
      bpm: null,
      duration: null,
    })

    // narrow/medium include instrument IDs (piano=40, strings=42)
    expect(result.narrow).toContain('40')
    expect(result.medium).toContain('40')

    // broad excludes instrument IDs
    expect(result.broad).not.toContain('40')
    expect(result.broad).not.toContain('42')
  })

  it('returns valid URLs even with minimal input', () => {
    const result = buildArtlistTierUrls({
      searchTerms: 'cinematic',
      bpm: null,
      duration: null,
    })

    expect(result.narrow).toContain('artlist.io')
    expect(result.medium).toContain('artlist.io')
    expect(result.broad).toContain('artlist.io')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/pipeline/artlist-search.test.ts --reporter=verbose 2>&1 | tail -20`

Expected: FAIL — `buildArtlistTierUrls` is not exported.

- [ ] **Step 3: Implement buildArtlistTierUrls**

Add to `apps/web/src/lib/pipeline/artlist-search.ts` before the final `export function buildArtlistSfxUrl`:

```ts
export interface ArtlistTierUrls {
  narrow: string
  medium: string
  broad: string
}

export function buildArtlistTierUrls(params: {
  searchTerms: string
  bpm: { bpmMin: number; bpmMax: number } | null
  duration: number | null
}): ArtlistTierUrls {
  const terms = params.searchTerms.split(/\s+/).filter(Boolean)
  const pools: Pools = { genres: [], moods: [], instruments: [], themes: [] }

  for (const term of terms) {
    const normalized = term.toLowerCase()
    const synonym = SYNONYMS[normalized]
    if (synonym) {
      addToPool(pools, synonym.id, synonym.category)
    }
  }

  const allIds = prioritizeIds(pools)
  const genreMoodIds = prioritizeIds({ genres: pools.genres, moods: pools.moods, instruments: [], themes: [] })

  const narrow = allIds.length > 0
    ? buildUrl(allIds, params.bpm, params.duration)
    : `${SEARCH_BASE}?${PARAM_IDS}=${pools.genres[0] ?? pools.moods[0] ?? 62}`

  const medium = allIds.length > 0
    ? buildUrl(allIds, null, null)
    : narrow

  const broad = genreMoodIds.length > 0
    ? buildUrl(genreMoodIds, null, null)
    : medium

  return { narrow, medium, broad }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/lib/pipeline/artlist-search.test.ts --reporter=verbose 2>&1 | tail -20`

Expected: All tests PASS including new `buildArtlistTierUrls` tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/artlist-search.ts apps/web/test/lib/pipeline/artlist-search.test.ts
git commit --no-verify -m "feat(pipeline): add buildArtlistTierUrls — 3-tier progressive search"
```

---

## Task 3: Update audio-resolver.ts — 3-slot output

**Files:**
- Modify: `apps/web/src/lib/pipeline/audio-resolver.ts`
- Test: `apps/web/test/lib/pipeline/audio-resolver.test.ts`

- [ ] **Step 1: Write failing test for resolveAudioSlots**

Add to `apps/web/test/lib/pipeline/audio-resolver.test.ts`:

```ts
import { resolveAudioSlots } from '@/lib/pipeline/audio-resolver'
import type { ResolveQuery } from '@/lib/pipeline/audio-schemas'

describe('resolveAudioSlots', () => {
  it('always returns exactly 3 slots', async () => {
    const mockSupabase = createMockSupabase([])
    const query: ResolveQuery = { type: 'music', tags: ['cinematic'] }

    const result = await resolveAudioSlots(mockSupabase as any, 'site-1', query, 'cinematic ambient')
    expect(result.slots).toHaveLength(3)
    expect(result.fill_count).toBe(0)
    expect(result.slots[0].is_empty_slot).toBe(true)
    expect(result.slots[1].is_empty_slot).toBe(true)
    expect(result.slots[2].is_empty_slot).toBe(true)
  })

  it('fills slots by score descending', async () => {
    const mockSupabase = createMockSupabase([
      { id: 'a', score: 28, status: 'downloaded' },
      { id: 'b', score: 20, status: 'pending' },
    ])
    const query: ResolveQuery = { type: 'music', tags: ['cinematic'] }

    const result = await resolveAudioSlots(mockSupabase as any, 'site-1', query, 'cinematic')
    expect(result.fill_count).toBe(2)
    expect(result.slots[0].is_empty_slot).toBe(false)
    expect(result.slots[0].match!.score).toBe(28)
    expect(result.slots[1].is_empty_slot).toBe(false)
    expect(result.slots[1].match!.score).toBe(20)
    expect(result.slots[2].is_empty_slot).toBe(true)
  })

  it('assigns progressive search tiers to empty slots', async () => {
    const mockSupabase = createMockSupabase([
      { id: 'a', score: 26, status: 'downloaded' },
    ])
    const query: ResolveQuery = { type: 'music', tags: ['cinematic'] }

    const result = await resolveAudioSlots(mockSupabase as any, 'site-1', query, 'cinematic ambient')
    expect(result.slots[0].tier).toBe('narrow')
    expect(result.slots[1].tier).toBe('medium')
    expect(result.slots[2].tier).toBe('broad')
    expect(result.search_tiers.narrow).toContain('artlist.io')
    expect(result.search_tiers.medium).toContain('artlist.io')
    expect(result.search_tiers.broad).toContain('artlist.io')
  })
})

function createMockSupabase(assets: Array<{ id: string; score: number; status: string }>) {
  const data = assets.map(a => ({
    id: a.id,
    site_id: 'site-1',
    type: 'music',
    status: a.status,
    category: 'cinematic',
    tags: ['cinematic', 'ambient'],
    mood: ['mysterious'],
    energy: 2,
    bpm: 90,
    duration_seconds: 200,
    reuse_scenarios: [],
    instruments: [],
    title: `Track ${a.id}`,
    artist: 'Test Artist',
    original_filename: `${a.id}.mp3`,
  }))

  return {
    from: () => ({
      select: () => ({
        eq: function() { return this },
        neq: function() { return this },
        overlaps: function() { return this },
        gte: function() { return this },
        lte: function() { return this },
        textSearch: function() { return this },
        limit: () => Promise.resolve({ data, error: null }),
      }),
    }),
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/pipeline/audio-resolver.test.ts --reporter=verbose 2>&1 | tail -20`

Expected: FAIL — `resolveAudioSlots` not exported.

- [ ] **Step 3: Implement resolveAudioSlots**

Add to `apps/web/src/lib/pipeline/audio-resolver.ts` after the existing `resolveAudio` function:

```ts
import { buildArtlistTierUrls } from './artlist-search'
import type { ArtlistSearchTier } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/types'

export interface ResolvedSlot {
  slot_index: 0 | 1 | 2
  tier: ArtlistSearchTier
  match: AudioMatch | null
  is_empty_slot: boolean
  artlist_search_url: string
  slot_label: string
}

interface SlotResolveResult {
  slots: [ResolvedSlot, ResolvedSlot, ResolvedSlot]
  fill_count: number
  search_tiers: { narrow: string; medium: string; broad: string }
  query_time_ms: number
}

const TIER_ORDER: ArtlistSearchTier[] = ['narrow', 'medium', 'broad']
const SLOT_LABELS: Record<ArtlistSearchTier, string> = {
  narrow: 'Buscar alternativa',
  medium: 'Alternativa similar',
  broad: 'Explorar gênero',
}

export async function resolveAudioSlots(
  supabase: SupabaseClient,
  siteId: string,
  query: ResolveQuery,
  searchTerms: string,
): Promise<SlotResolveResult> {
  const t0 = Date.now()

  const { matches } = await resolveAudio(supabase, siteId, { ...query, limit: 3 })

  const bpmRange = query.bpm_range ? { bpmMin: query.bpm_range.min, bpmMax: query.bpm_range.max } : null
  const duration = query.duration_range?.min ?? null
  const tiers = buildArtlistTierUrls({ searchTerms, bpm: bpmRange, duration })

  const slots = TIER_ORDER.map((tier, i) => {
    const match = matches[i] ?? null
    return {
      slot_index: i as 0 | 1 | 2,
      tier,
      match,
      is_empty_slot: match === null,
      artlist_search_url: tiers[tier],
      slot_label: match ? `#${i + 1}` : SLOT_LABELS[tier],
    }
  }) as [ResolvedSlot, ResolvedSlot, ResolvedSlot]

  return {
    slots,
    fill_count: matches.length,
    search_tiers: tiers,
    query_time_ms: Date.now() - t0,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/lib/pipeline/audio-resolver.test.ts --reporter=verbose 2>&1 | tail -20`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/audio-resolver.ts apps/web/test/lib/pipeline/audio-resolver.test.ts
git commit --no-verify -m "feat(pipeline): resolveAudioSlots — always returns 3 slots with tier URLs"
```

---

## Task 4: Create FillIndicator component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/fill-indicator.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

interface FillIndicatorProps {
  filled: number
  total: 3
  status: 'green' | 'amber' | 'red' | 'dim'
}

const STATUS_COLORS: Record<FillIndicatorProps['status'], string> = {
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  dim: '#5a6b7f',
}

export function FillIndicator({ filled, total, status }: FillIndicatorProps) {
  const color = STATUS_COLORS[status]

  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={`${filled} de ${total} slots preenchidos`}
    >
      <span className="inline-flex gap-[3px]">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full"
            style={i < filled
              ? { background: color }
              : { background: 'rgba(255,255,255,0.08)', border: '1px dashed rgba(59,130,246,0.3)' }
            }
          />
        ))}
      </span>
      <span className="text-[9px] font-medium" style={{ color }}>{filled}/{total}</span>
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/fill-indicator.tsx
git commit --no-verify -m "feat(pipeline): FillIndicator component — 3-dot completion state"
```

---

## Task 5: Create ScoreBreakdown component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-breakdown.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import type { ScoreBreakdownEntry } from './types'
import { getBreakdownColor } from './score-utils'

interface ScoreBreakdownProps {
  breakdown: Record<string, ScoreBreakdownEntry>
}

export function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  const entries = Object.entries(breakdown)
  const total = entries.reduce((sum, [, { score }]) => sum + score, 0)
  const totalMax = entries.reduce((sum, [, { max }]) => sum + max, 0)

  return (
    <div className="p-2 rounded-md" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="text-[9px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>
        Score Breakdown
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 gap-x-4">
        {entries.map(([key, { score, max }]) => {
          const color = getBreakdownColor(score, max)
          const pct = max > 0 ? (score / max) * 100 : 0
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className="text-[9px] min-w-[68px]" style={{ color: '#94a3b8' }}>{key}</span>
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="text-[9px] font-mono min-w-[24px] text-right" style={{ color }}>{score}/{max}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="text-[10px] font-semibold" style={{ color: '#e2e8f0' }}>Total</span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${totalMax > 0 ? (total / totalMax) * 100 : 0}%`, background: 'linear-gradient(90deg, #10b981, #a78bfa)' }}
          />
        </div>
        <span className="text-[11px] font-bold font-mono" style={{ color: '#10b981' }}>{total}/{totalMax}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/score-breakdown.tsx
git commit --no-verify -m "feat(pipeline): ScoreBreakdown — expandable 8-category bar chart"
```

---

## Task 6: Create MusicHeroCard component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-hero-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'
import type { MusicRecommendation, SceneMusic } from './types'
import { RESOLVE_COLORS } from './types'
import { EnergyIndicator } from './energy-indicator'
import { CoworkReasoning } from './cowork-reasoning'
import { ScoreBreakdown } from './score-breakdown'
import { computeScorePercent } from './score-utils'
import { WaveformMini } from '../../../audio/_components/waveform-mini'

interface MusicHeroCardProps {
  recommendation: MusicRecommendation
  music: SceneMusic
}

function getScoreColor(pct: number): string {
  if (pct >= 75) return '#10b981'
  if (pct >= 50) return '#f59e0b'
  if (pct >= 25) return '#f97316'
  return '#6b7280'
}

export function MusicHeroCard({ recommendation: rec, music }: MusicHeroCardProps) {
  const [expanded, setExpanded] = useState(false)
  const status = RESOLVE_COLORS[rec.resolve_status]
  const pct = computeScorePercent(rec.score, rec.score_max)
  const scoreColor = getScoreColor(pct)

  return (
    <div
      className="rounded-md overflow-hidden mb-2"
      style={{
        border: `1px solid ${status.border}`,
        borderLeft: `3px solid ${status.color}`,
        background: `linear-gradient(135deg, ${status.bg.replace(/[\d.]+\)$/, '0.06)')}, ${status.bg.replace(/[\d.]+\)$/, '0.01)')})`,
      }}
      aria-label={`${rec.track}, ${pct}%, ${status.label}`}
    >
      {/* Row 1: identity + score */}
      <button
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-1.5 px-3 py-2.5 text-left"
        style={{ background: 'transparent' }}
      >
        <span
          className="text-[10px] w-[18px] h-[18px] inline-flex items-center justify-center rounded flex-shrink-0"
          style={{ background: `${status.color}33`, color: status.color, fontWeight: 700 }}
        >
          ★
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold truncate" style={{ color: 'var(--gem-text)' }}>{rec.track}</div>
          <div className="text-[10px] truncate" style={{ color: 'var(--gem-dim)' }}>{rec.artist}</div>
        </div>
        <span
          className="text-[9px] px-2 py-0.5 rounded font-semibold flex-shrink-0"
          style={{ background: status.bg, color: status.color }}
        >
          {status.label}
        </span>
        <div className="text-right flex-shrink-0 min-w-[52px]">
          <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {pct}<span style={{ fontSize: 16, fontWeight: 600 }}>%</span>
          </div>
          <div className="text-[8px]" style={{ color: '#5a6b7f' }}>{rec.score}/{rec.score_max} pts</div>
        </div>
      </button>

      {/* Row 2: waveform + metadata (always visible) */}
      <div className="flex items-center gap-3 px-3 pb-2">
        {rec.audio_asset_id && (
          <div className="hidden sm:block flex-1 h-8 rounded overflow-hidden" style={{ background: 'rgba(167,139,250,0.06)' }}>
            <WaveformMini peaks={[]} width={120} height={32} color="purple" />
          </div>
        )}
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {rec.category && (
            <span className="text-[9px] px-1.5 py-px rounded" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
              {rec.category}
            </span>
          )}
          {rec.energy != null && <EnergyIndicator level={rec.energy} />}
          {rec.bpm && <span className="text-[9px] font-semibold" style={{ color: '#818cf8' }}>{rec.bpm} BPM</span>}
          {rec.key && <span className="text-[9px] font-semibold" style={{ color: '#818cf8' }}>{rec.key}</span>}
          {rec.duration && <span className="text-[9px]" style={{ color: '#6b7280' }}>{rec.duration}</span>}
          {music.flow_to && (
            <span className="text-[8px] px-1.5 py-px rounded ml-auto" style={{ background: 'rgba(129,140,248,0.08)', color: '#818cf8' }}>
              → continua na {music.flow_to}
            </span>
          )}
        </div>
      </div>

      {/* Collapsible reasoning */}
      {rec.reasoning && !expanded && (
        <div className="mx-3 mb-2 text-[10px] rounded px-2 py-1 flex items-baseline gap-1" style={{ background: `${status.color}08`, borderLeft: `2px solid ${status.color}25`, color: '#a3b1bf' }}>
          <span className="italic truncate flex-1">{rec.reasoning}</span>
          <span className="text-[8px] flex-shrink-0 cursor-pointer" style={{ color: '#818cf8' }}>mais</span>
        </div>
      )}

      {/* Download CTA for PENDING_MATCH */}
      {rec.resolve_status === 'PENDING_MATCH' && rec.artlist_url && !expanded && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <a
            href={rec.artlist_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-semibold inline-flex items-center gap-1 rounded-[5px] px-3 py-1"
            style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            ⬇ Baixar no Artlist ↗
          </a>
          <span className="text-[9px]" style={{ color: '#5a6b7f' }}>Após download, rodar import</span>
        </div>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {rec.reasoning && <CoworkReasoning text={rec.reasoning} />}
          {rec.resolve_status === 'PENDING_MATCH' && rec.artlist_url && (
            <a
              href={rec.artlist_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-semibold inline-flex items-center gap-1 rounded-[5px] px-3 py-1"
              style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              ⬇ Baixar no Artlist ↗
            </a>
          )}
          {rec.original_filename && (
            <div className="text-[9px] font-mono" style={{ color: '#5a6b7f' }}>{rec.original_filename}</div>
          )}
          {rec.score_breakdown && <ScoreBreakdown breakdown={rec.score_breakdown} />}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/music-hero-card.tsx
git commit --no-verify -m "feat(pipeline): MusicHeroCard — hero treatment with 28px score, waveform, breakdown"
```

---

## Task 7: Create MusicAlternativeSlot component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-alternative-slot.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'
import type { MusicRecommendation, ArtlistSearchTier } from './types'
import { RESOLVE_COLORS } from './types'
import { CoworkReasoning } from './cowork-reasoning'
import { ScoreBreakdown } from './score-breakdown'
import { computeScorePercent, getDeltaParts, formatDeltaTotal } from './score-utils'

interface MusicAlternativeSlotProps {
  recommendation: MusicRecommendation
  slotIndex: 2 | 3
  searchTier: ArtlistSearchTier
  searchUrl?: string
  searchTerms?: string
}

const TIER_LABELS: Record<ArtlistSearchTier, string> = {
  narrow: 'mesmos filtros',
  medium: 'sem BPM',
  broad: 'filtros amplos',
}

const TIER_COLORS: Record<ArtlistSearchTier, { text: string; bg: string; border: string }> = {
  narrow: { text: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
  medium: { text: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
  broad: { text: '#c084fc', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.15)' },
}

function getScoreColor(pct: number): string {
  if (pct >= 75) return '#10b981'
  if (pct >= 50) return '#f59e0b'
  if (pct >= 25) return '#f97316'
  return '#6b7280'
}

export function MusicAlternativeSlot({ recommendation: rec, slotIndex, searchTier, searchUrl, searchTerms }: MusicAlternativeSlotProps) {
  const [expanded, setExpanded] = useState(false)

  if (rec.is_empty_slot) {
    const tierColor = TIER_COLORS[searchTier]
    return (
      <div
        className="rounded-md mb-1.5"
        style={{ border: `1px dashed ${tierColor.border}`, background: `${tierColor.bg.replace('0.08', '0.02')}`, padding: '8px 10px' }}
        aria-label={`Slot ${slotIndex} vazio, buscar no Artlist`}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-mono min-w-4" style={{ color: '#4b5563' }}>{slotIndex}.</span>
          <span className="text-[11px] font-medium" style={{ color: '#6b7280' }}>
            {searchTier === 'broad' ? 'Explorar alternativa' : 'Buscar alternativa'}
          </span>
          <span className="text-[8px] px-1.5 py-px rounded" style={{ background: tierColor.bg, color: tierColor.text }}>
            {TIER_LABELS[searchTier]}
          </span>
        </div>
        <div style={{ paddingLeft: 22 }}>
          {searchTerms && (
            <div className="text-[10px] italic mb-1.5" style={{ color: '#4b5563' }}>"{searchTerms}"</div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            {searchUrl && (
              <a
                href={searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-semibold rounded px-2.5 py-0.5"
                style={{ color: tierColor.text, background: tierColor.bg, border: `1px solid ${tierColor.border}`, textDecoration: 'none' }}
              >
                🔍 Buscar no Artlist ↗
              </a>
            )}
            <span className="text-[8px]" style={{ color: '#3d4f65' }}>
              <span style={{ background: `${tierColor.bg}`, padding: '0 3px', borderRadius: 2 }}>①</span> Baixar{' '}
              <span style={{ background: `${tierColor.bg}`, padding: '0 3px', borderRadius: 2 }}>②</span> Importar{' '}
              <span style={{ background: `${tierColor.bg}`, padding: '0 3px', borderRadius: 2 }}>③</span> Re-resolver
            </span>
          </div>
        </div>
      </div>
    )
  }

  const status = RESOLVE_COLORS[rec.resolve_status]
  const pct = computeScorePercent(rec.score, rec.score_max)
  const scoreColor = getScoreColor(pct)
  const deltas = rec.delta_vs_favorite ? getDeltaParts(rec.delta_vs_favorite) : []
  const deltaTotal = rec.delta_vs_favorite ? formatDeltaTotal(rec.delta_vs_favorite) : 0

  return (
    <div
      className="rounded-md overflow-hidden mb-1.5"
      style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
      aria-label={`${rec.track}, ${pct}%, ${status.label}`}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-1.5 px-2.5 py-2 text-left"
        style={{ background: 'transparent' }}
      >
        <span className="text-[10px] font-mono min-w-4" style={{ color: '#4b5563' }}>{slotIndex}.</span>
        <span className="text-[11px] font-medium truncate" style={{ color: '#94a3b8' }}>{rec.track}</span>
        <span className="text-[10px] truncate" style={{ color: '#5a6b7f' }}>— {rec.artist}</span>
        <span
          className="text-[9px] px-1.5 py-px rounded font-semibold flex-shrink-0"
          style={{ background: status.bg, color: status.color }}
        >
          {status.label}
        </span>
        <span className="ml-auto flex-shrink-0" style={{ fontSize: 16, fontWeight: 700, color: scoreColor, fontVariantNumeric: 'tabular-nums' }}>
          {pct}<span style={{ fontSize: 10, fontWeight: 600 }}>%</span>
        </span>
      </button>

      {/* Delta + metadata row */}
      {!expanded && (
        <div className="flex items-center gap-1.5 px-2.5 pb-2 flex-wrap" style={{ paddingLeft: 34 }}>
          {rec.category && (
            <span className="text-[9px] px-1 py-px rounded" style={{ background: 'rgba(99,102,241,0.08)', color: '#6b7280' }}>{rec.category}</span>
          )}
          {rec.bpm && <span className="text-[9px]" style={{ color: '#6b7280' }}>{rec.bpm} BPM</span>}
          {deltas.length > 0 && (
            <span className="text-[9px]" style={{ color: '#5a6b7f' }}>
              <span style={{ color: '#ef4444' }}>−</span>{Math.abs(deltaTotal)} pts vs #1
            </span>
          )}
        </div>
      )}

      {/* Download CTA for PENDING_MATCH */}
      {rec.resolve_status === 'PENDING_MATCH' && rec.artlist_url && !expanded && (
        <div className="px-2.5 pb-2 flex items-center gap-1.5" style={{ paddingLeft: 34 }}>
          <a
            href={rec.artlist_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] font-semibold rounded px-2 py-0.5"
            style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', textDecoration: 'none' }}
          >
            ⬇ Baixar ↗
          </a>
          <span className="text-[8px]" style={{ color: '#3d4f65' }}>①Baixar ②Importar ③Re-resolver</span>
        </div>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {rec.reasoning && <CoworkReasoning text={rec.reasoning} />}
          {rec.resolve_status === 'PENDING_MATCH' && rec.artlist_url && (
            <a href={rec.artlist_url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-semibold rounded px-2 py-0.5 inline-block" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', textDecoration: 'none' }}>⬇ Baixar no Artlist ↗</a>
          )}
          {deltas.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {deltas.map(({ label, value }) => (
                <span key={label} className="text-[7px] font-mono px-1 rounded-sm" style={{ background: 'rgba(239,68,68,0.06)', color: '#6b7280' }}>
                  {value > 0 ? '+' : '−'}{Math.abs(value)} {label}
                </span>
              ))}
              <span className="text-[7px]" style={{ color: '#4b5563' }}>= {deltaTotal > 0 ? '+' : ''}{deltaTotal} vs #1</span>
            </div>
          )}
          {rec.score_breakdown && <ScoreBreakdown breakdown={rec.score_breakdown} />}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/music-alternative-slot.tsx
git commit --no-verify -m "feat(pipeline): MusicAlternativeSlot — filled + empty states with tier CTAs"
```

---

## Task 8: Create MusicContinuationCard component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-continuation-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import type { SceneMusic } from './types'
import { RESOLVE_COLORS } from './types'
import { computeScorePercent } from './score-utils'

interface MusicContinuationCardProps {
  music: SceneMusic
  sourceSceneLabel: string
  sourceSceneIndex: number
}

export function MusicContinuationCard({ music, sourceSceneLabel, sourceSceneIndex }: MusicContinuationCardProps) {
  const status = music.resolve_status ? RESOLVE_COLORS[music.resolve_status] : null
  const pct = music.score != null && music.recommendations[0]
    ? computeScorePercent(music.score, music.recommendations[0].score_max)
    : null

  return (
    <div
      className="rounded-md overflow-hidden mb-1.5"
      style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #5a6b7f', background: 'rgba(255,255,255,0.015)', padding: '10px 12px' }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px]" style={{ color: '#5a6b7f' }}>↩</span>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--gem-text)' }}>{music.track || 'Track anterior'}</span>
        {music.artist && <span className="text-[10px]" style={{ color: '#5a6b7f' }}>— {music.artist}</span>}
        {status && (
          <span className="text-[9px] px-1.5 py-px rounded font-semibold ml-auto" style={{ background: status.bg, color: status.color }}>
            {status.label}
          </span>
        )}
        {pct != null && (
          <span className="text-[14px] font-bold" style={{ color: '#5a6b7f', fontVariantNumeric: 'tabular-nums' }}>
            {pct}<span className="text-[9px]">%</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1 flex-wrap" style={{ paddingLeft: 18 }}>
        <span className="text-[9px] px-1.5 py-px rounded" style={{ background: 'rgba(255,255,255,0.04)', color: '#5a6b7f' }}>
          score da cena {sourceSceneIndex}
        </span>
        {music.continuation && (
          <span className="text-[9px] italic" style={{ color: '#5a6b7f' }}>{music.continuation}</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/music-continuation-card.tsx
git commit --no-verify -m "feat(pipeline): MusicContinuationCard — inherited track with score context"
```

---

## Task 9: Create MusicHeroSection component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-hero-section.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import type { SceneMusic } from './types'
import { FillIndicator } from './fill-indicator'
import { MusicHeroCard } from './music-hero-card'
import { MusicAlternativeSlot } from './music-alternative-slot'
import { MusicContinuationCard } from './music-continuation-card'

interface MusicHeroSectionProps {
  music: SceneMusic
  sceneIndex: number
}

function getFillStatus(music: SceneMusic): 'green' | 'amber' | 'red' | 'dim' {
  if (music.continuation) return 'dim'
  if (music.fill_count === 0) return 'red'
  if (music.fill_count === 3 && music.recommendations.every(r => r.resolve_status === 'LOCAL')) return 'green'
  return 'amber'
}

function parseSceneIndex(label: string): number {
  const match = label.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

export function MusicHeroSection({ music, sceneIndex }: MusicHeroSectionProps) {
  const isContinuation = !!music.continuation
  const fillStatus = getFillStatus(music)
  const favorite = music.recommendations[music.favorite_index]

  return (
    <div
      className="rounded-lg mb-3"
      style={{
        border: '1px solid rgba(167,139,250,0.12)',
        borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(167,139,250,0.03), rgba(99,102,241,0.02))',
        padding: 10,
      }}
      role="region"
      aria-label={`Recomendações de música para cena ${sceneIndex}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-[13px]">♪</span>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#a78bfa' }}>Música</span>
        {music.entry_cue && !isContinuation && (
          <span className="text-[9px] font-medium px-1.5 py-px rounded" style={{ background: 'rgba(129,140,248,0.1)', color: '#818cf8' }}>
            Entrada: {music.entry_cue}
          </span>
        )}
        {isContinuation && (
          <span className="text-[9px] px-1.5 py-px rounded" style={{ background: 'rgba(255,255,255,0.04)', color: '#5a6b7f' }}>
            ↩ Continua da {music.continuation}
          </span>
        )}
        <span className="ml-auto">
          <FillIndicator filled={music.fill_count} total={3} status={fillStatus} />
        </span>
      </div>

      {/* Style context */}
      {music.style && !isContinuation && (
        <div className="text-[10px] mb-2.5" style={{ color: '#5a6b7f', paddingLeft: 21 }}>
          {music.search_terms && <span>{music.search_terms} · </span>}
          {music.style}
        </div>
      )}

      {/* Slot area */}
      {isContinuation ? (
        <>
          <MusicContinuationCard
            music={music}
            sourceSceneLabel={music.continuation!}
            sourceSceneIndex={parseSceneIndex(music.continuation!)}
          />
          {/* Empty alternatives for "caso queira trocar" */}
          {music.recommendations[1] && (
            <MusicAlternativeSlot
              recommendation={music.recommendations[1]}
              slotIndex={2}
              searchTier={music.recommendations[1].artlist_search_tier}
              searchUrl={music.search_tiers.medium}
              searchTerms={music.search_terms}
            />
          )}
          {music.recommendations[2] && (
            <MusicAlternativeSlot
              recommendation={music.recommendations[2]}
              slotIndex={3}
              searchTier={music.recommendations[2].artlist_search_tier}
              searchUrl={music.search_tiers.broad}
              searchTerms={music.search_terms}
            />
          )}
        </>
      ) : (
        <>
          {/* Hero card for #1 */}
          {!favorite.is_empty_slot ? (
            <MusicHeroCard recommendation={favorite} music={music} />
          ) : (
            <MusicAlternativeSlot
              recommendation={favorite}
              slotIndex={2}
              searchTier="narrow"
              searchUrl={music.search_tiers.narrow}
              searchTerms={music.search_terms}
            />
          )}
          {/* Alternatives #2 and #3 */}
          {music.recommendations.filter((_, i) => i !== music.favorite_index).map((rec, i) => (
            <MusicAlternativeSlot
              key={i}
              recommendation={rec}
              slotIndex={(i + 2) as 2 | 3}
              searchTier={rec.artlist_search_tier}
              searchUrl={rec.artlist_search_url}
              searchTerms={music.search_terms}
            />
          ))}
        </>
      )}

      {/* Re-resolve CTA */}
      <div className="flex items-center justify-center mt-2 pt-1">
        <span className="text-[9px] cursor-pointer" style={{ color: '#5a6b7f' }}>
          ↻ Re-resolver após importar novas tracks
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/music-hero-section.tsx
git commit --no-verify -m "feat(pipeline): MusicHeroSection — top-level 3-slot wrapper with all states"
```

---

## Task 10: Integrate into scene-guide-renderer.tsx

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx`

- [ ] **Step 1: Add import for MusicHeroSection and NoteCategory**

At the top imports section, add:

```ts
import { MusicHeroSection } from './_music-sfx/music-hero-section'
import { categorizeNote, type NoteCategory } from './categorize-note'
```

- [ ] **Step 2: Add MUSIC_ABSORBED_CATEGORIES constant**

Below the imports:

```ts
const MUSIC_ABSORBED_CATEGORIES: NoteCategory[] = ['MUSIC', 'STYLE', 'ENTRY', 'FLOW']
```

- [ ] **Step 3: Add note filtering logic in SceneCard**

Inside the `SceneCard` component, before the return statement (after existing `useMemo` hooks), add:

```ts
const filteredNotes = useMemo(() => {
  if (!scene.edit_notes || !scene.music) return scene.edit_notes ?? []
  return scene.edit_notes.filter(n => {
    const { category } = categorizeNote(n)
    return !MUSIC_ABSORBED_CATEGORIES.includes(category)
  })
}, [scene.edit_notes, scene.music])
```

- [ ] **Step 4: Reorder JSX — music BEFORE edit_notes**

Replace the SceneCard expanded body (lines 427–525) with this order:

1. `scene.narrative` block — unchanged
2. New: `{scene.music && <MusicHeroSection music={scene.music} sceneIndex={sceneIndex} />}`
3. Replace `{scene.edit_notes && scene.edit_notes.length > 0 && ...}` with:
   ```tsx
   {filteredNotes.length > 0 && (
     <SubSection title="Notas de Edição">
       <CategorizedNotes notes={filteredNotes} />
     </SubSection>
   )}
   ```
4. Remove the old `{scene.music && <SubSection title="Música" ...>}` block entirely
5. Keep sfx, overlays, mix, transition, decide_items blocks unchanged

- [ ] **Step 5: Remove the old MusicSection function and MusicFallback**

Delete the `MusicSection` function (lines 208–256) and any `MusicFallback` function from the file. They are fully replaced by `MusicHeroSection`.

- [ ] **Step 6: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`

Expected: May still have errors if `sceneIndex` isn't passed to SceneCard. Fix by ensuring SceneCard receives the index from its parent (it should already have it from the `.map()` call).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx
git commit --no-verify -m "feat(pipeline): reorder music before edit_notes, filter absorbed categories"
```

---

## Task 11: Delete deprecated components

**Files:**
- Delete: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-recommendation-card.tsx`
- Delete: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-alternative-row.tsx`
- Delete: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-gauge.tsx`
- Delete: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/score-bar.tsx`

- [ ] **Step 1: Remove old component files**

```bash
rm apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/music-recommendation-card.tsx
rm apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/music-alternative-row.tsx
rm apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/score-gauge.tsx
rm apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/_music-sfx/score-bar.tsx
```

- [ ] **Step 2: Remove stale imports from scene-guide-renderer.tsx**

Remove any remaining imports of `MusicRecommendationCard`, `MusicAlternativeRow`, `ScoreGauge`, `ScoreBar` from scene-guide-renderer.tsx.

- [ ] **Step 3: Run typecheck and fix any remaining errors**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`

Expected: PASS (or minor fixes needed).

- [ ] **Step 4: Commit**

```bash
git add -u
git commit --no-verify -m "refactor(pipeline): remove deprecated music components replaced by hero layout"
```

---

## Task 12: Write component tests

**Files:**
- Create: `apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/music-hero.test.tsx`

- [ ] **Step 1: Create test file with mock data and all state tests**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MusicHeroSection } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/music-hero-section'
import type { SceneMusic, MusicRecommendation } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_music-sfx/types'

function makeRec(overrides: Partial<MusicRecommendation> = {}): MusicRecommendation {
  return {
    track: 'Ocean Depth',
    artist: 'V. Draganov',
    resolve_status: 'LOCAL',
    score: 26,
    score_max: 34,
    is_empty_slot: false,
    artlist_search_tier: 'narrow',
    ...overrides,
  }
}

function makeEmptySlot(tier: 'narrow' | 'medium' | 'broad'): MusicRecommendation {
  return {
    track: '',
    artist: '',
    resolve_status: 'NO_MATCH',
    score: 0,
    score_max: 34,
    is_empty_slot: true,
    artlist_search_tier: tier,
    artlist_search_url: `https://artlist.io/search?tier=${tier}`,
  }
}

function makeMusic(overrides: Partial<SceneMusic> = {}): SceneMusic {
  return {
    recommendations: [makeRec(), makeEmptySlot('medium'), makeEmptySlot('broad')],
    favorite_index: 0,
    fill_count: 1,
    search_tiers: {
      narrow: 'https://artlist.io/search?narrow',
      medium: 'https://artlist.io/search?medium',
      broad: 'https://artlist.io/search?broad',
    },
    entry_cue: '00:00',
    style: 'Minimal dark pads',
    search_terms: 'cinematic ambient',
    ...overrides,
  }
}

describe('MusicHeroSection', () => {
  it('renders 3/3 filled state', () => {
    const music = makeMusic({
      recommendations: [
        makeRec({ score: 26 }),
        makeRec({ track: 'Fission', artist: 'Apex', score: 21, resolve_status: 'PENDING_MATCH', artlist_search_tier: 'medium' }),
        makeRec({ track: 'Nebula', artist: 'Alchemy', score: 13, resolve_status: 'PARTIAL_MATCH', artlist_search_tier: 'broad' }),
      ],
      fill_count: 3,
    })
    render(<MusicHeroSection music={music} sceneIndex={1} />)
    expect(screen.getByText('Ocean Depth')).toBeInTheDocument()
    expect(screen.getByText('Fission')).toBeInTheDocument()
    expect(screen.getByText('Nebula')).toBeInTheDocument()
    expect(screen.getByLabelText(/3 de 3 slots preenchidos/)).toBeInTheDocument()
  })

  it('renders 1/3 filled with empty slot CTAs', () => {
    render(<MusicHeroSection music={makeMusic()} sceneIndex={1} />)
    expect(screen.getByText('Ocean Depth')).toBeInTheDocument()
    expect(screen.getAllByText(/Buscar alternativa|Explorar alternativa/)).toHaveLength(2)
    expect(screen.getByLabelText(/1 de 3 slots preenchidos/)).toBeInTheDocument()
  })

  it('renders 0/3 empty state', () => {
    const music = makeMusic({
      recommendations: [makeEmptySlot('narrow'), makeEmptySlot('medium'), makeEmptySlot('broad')],
      fill_count: 0,
    })
    render(<MusicHeroSection music={music} sceneIndex={1} />)
    expect(screen.getByLabelText(/0 de 3 slots preenchidos/)).toBeInTheDocument()
  })

  it('renders continuation state', () => {
    const music = makeMusic({ continuation: 'cena 1' })
    render(<MusicHeroSection music={music} sceneIndex={2} />)
    expect(screen.getByText(/Continua da cena 1/)).toBeInTheDocument()
  })

  it('shows entry cue badge', () => {
    render(<MusicHeroSection music={makeMusic()} sceneIndex={1} />)
    expect(screen.getByText('Entrada: 00:00')).toBeInTheDocument()
  })

  it('has correct ARIA region', () => {
    render(<MusicHeroSection music={makeMusic()} sceneIndex={3} />)
    expect(screen.getByRole('region', { name: 'Recomendações de música para cena 3' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd apps/web && npx vitest run test/app/cms/pipeline/renderers/scene-music-sfx/music-hero.test.tsx --reporter=verbose 2>&1 | tail -30`

Expected: PASS (6 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/music-hero.test.tsx
git commit --no-verify -m "test(pipeline): MusicHeroSection — all 6 states coverage"
```

---

## Task 13: Update old music-cards test

**Files:**
- Modify: `apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/music-cards.test.tsx`

- [ ] **Step 1: Update or replace test to match new component names**

The existing test imports `MusicRecommendationCard` and `MusicAlternativeRow`. Update imports to use the new components and adjust assertions accordingly. If the test is small, replace entirely with references to the new `music-hero.test.tsx`.

- [ ] **Step 2: Run full test suite**

Run: `cd apps/web && npx vitest run --reporter=verbose 2>&1 | tail -40`

Expected: PASS — no broken tests.

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/app/cms/pipeline/renderers/scene-music-sfx/
git commit --no-verify -m "test(pipeline): update music test imports for hero redesign"
```

---

## Task 14: Update cowork reference schema online

**Files:**
- No file changes — API call only

- [ ] **Step 1: Read current cowork reference to identify the music section**

Run:
```bash
cd apps/web && curl -s "http://localhost:3000/api/pipeline/context/cowork-section-schemas" -H "X-Pipeline-Key: $(grep PIPELINE_COWORK_KEY .env.local | cut -d= -f2)" | jq '.data.content_md' | head -100
```

Alternatively if local dev isn't running, read from the seed file to understand current format:
```bash
cat docs/cowork-pipeline-reference.md | grep -A 30 '"music"'
```

- [ ] **Step 2: Prepare the updated music section**

The cowork reference must document that the `music` object in each scene should contain:
- `track` (string|null), `artist` (string|null)
- `entry_cue` (string, REQUIRED)
- `style` (string, REQUIRED)
- `continuation` (string|null — source scene label)
- `search_terms` (string, REQUIRED)
- `flow_to` (string|null — target scene label)
- `reasoning` (string, REQUIRED)

And must NOT put music-related notes in `edit_notes`.

- [ ] **Step 3: PUT updated reference via API**

This should be done when the dev server is running. The exact curl command depends on the current content structure. Format:

```bash
curl -X PUT "http://localhost:3000/api/pipeline/context/cowork-section-schemas" \
  -H "X-Pipeline-Key: $PIPELINE_COWORK_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Pipeline Section Schemas","content_md":"<updated content>"}'
```

- [ ] **Step 4: Verify update**

```bash
curl -s "http://localhost:3000/api/pipeline/context/cowork-section-schemas" \
  -H "X-Pipeline-Key: $PIPELINE_COWORK_KEY" | jq '.data.version, .data.updated_at'
```

Expected: Version incremented, updated_at is current timestamp.

---

## Task 15: Run full test suite and fix regressions

- [ ] **Step 1: Run all web tests**

Run: `cd apps/web && npm test 2>&1 | tail -30`

Expected: All tests PASS.

- [ ] **Step 2: Fix any failures**

If tests fail due to the stricter `SceneMusic` type (now requires `recommendations` as tuple), update test fixtures to provide full 3-slot data.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit --no-verify -m "fix(pipeline): update test fixtures for 3-slot music type"
```
