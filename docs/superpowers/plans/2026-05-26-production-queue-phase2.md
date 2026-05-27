# Production Queue Phase 2 — Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add velocity learning from historical data, WIP limits with visual indicators, mode inference for focus recommendations, and enhanced suggestion finders.

**Architecture:** Query `content_pipeline_history` for stage transition durations, compute velocity with P90 trim and cold-start blending, extend existing `STAGE_GROUP` pills with WIP limit indicators, add `inferCurrentMode()` pure function, and extend `selectSuggestion()` with 2 new finders.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Vitest, Supabase, unstable_cache

**Depends on:** Phase 1 (computeUrgencyScore, scanBufferDepth, bug fixes)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/TIMESTAMP_add_pipeline_history_velocity_index.sql` | Partial index on `content_pipeline_history` for velocity queries |
| `apps/web/src/lib/pipeline/velocity.ts` | `computeP90`, `blendVelocity`, `buildVelocityMap`, `fetchVelocityMap` |
| `apps/web/src/lib/pipeline/infer-mode.ts` | `inferCurrentMode` pure function |
| `apps/web/test/cms/velocity.test.ts` | Tests for velocity computation (25+ tests) |
| `apps/web/test/cms/infer-mode.test.ts` | Tests for mode inference (12+ tests) |
| `apps/web/test/cms/wip-limits.test.ts` | Tests for WIP limit status (10+ tests) |

### Modified Files

| File | Change |
|------|--------|
| `apps/web/src/lib/pipeline/up-next-constants.ts` | Add `DEFAULT_WIP_LIMITS`, `WipStatus` type, `getWipStatus()` |
| `apps/web/src/lib/pipeline/get-production-deadline.ts` | Add optional `velocityMap` + `format` params for velocity-aware deadlines |
| `apps/web/src/lib/pipeline/select-suggestion.ts` | Add `findWipViolation`, `findBufferGap` finders; extend `SuggestionInput` |
| `apps/web/src/lib/pipeline/up-next-types.ts` | Add `VelocityEntry`, `VelocityMap`, `WorkMode`, `ModeInference` types |
| `apps/web/src/lib/pipeline/up-next-fetcher.ts` | Pass `stageCounts` + buffer data to `selectSuggestion` |
| `apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx` | WIP limit pill styling (`count/limit`, amber/red) + mode label |
| `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx` | Pass mode data to `UpNextThisWeek` |
| `apps/web/test/cms/get-production-deadline.test.ts` | Add velocity-aware deadline tests |
| `apps/web/test/cms/select-suggestion.test.ts` | Add findWipViolation + findBufferGap tests |

---

### Task 1: Migration — Velocity DB Index

**Files:**
- Create: `supabase/migrations/TIMESTAMP_add_pipeline_history_velocity_index.sql` (via `npm run db:new`)

**Context:** The `content_pipeline_history` table (from migration `20260509000001`) already has an index on `(pipeline_id, changed_at DESC)`. The velocity query needs to filter by `event_type = 'stage_change'` across the entire table (not per pipeline_id) with recent date range. A partial index on `(event_type, changed_at DESC) WHERE event_type = 'stage_change'` speeds this up.

- [ ] **Step 1: Generate migration file**

Run:

```bash
npm run db:new add_pipeline_history_velocity_index
```

- [ ] **Step 2: Write migration SQL**

Open the generated file and write:

```sql
-- Partial index for velocity queries: stage transitions by date
-- Supports: SELECT ... FROM content_pipeline_history
--           WHERE event_type = 'stage_change' AND changed_at >= $1
--           ORDER BY changed_at DESC LIMIT 5000

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pipeline_history_velocity
  ON public.content_pipeline_history (changed_at DESC)
  WHERE event_type = 'stage_change';
```

**Note:** `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Supabase migrations run each file as a single transaction by default. If the migration fails with "cannot use CONCURRENTLY inside a transaction", remove the `CONCURRENTLY` keyword — the table is small enough that a regular index build is fine.

- [ ] **Step 3: Push to prod**

```bash
npm run db:push:prod
```

**Commit:** `feat(pipeline): add velocity index on pipeline_history`

---

### Task 2: Velocity Types

**Files:**
- Modify: `apps/web/src/lib/pipeline/up-next-types.ts`

**Context:** Current file exports `PipelineItemWithSlot`, `WeekSlot`, `TodayAction`, etc. (140 lines). We add velocity and mode types here so all pipeline modules share them.

- [ ] **Step 1: Write types**

Add at the end of `apps/web/src/lib/pipeline/up-next-types.ts`:

```typescript
/* ------------------------------------------------------------------ */
/*  Velocity                                                            */
/* ------------------------------------------------------------------ */

/** Duration data for a single format:stage combination. */
export interface VelocityEntry {
  /** Median duration in minutes across all samples. */
  medianMinutes: number
  /** 90th percentile duration in minutes. */
  p90Minutes: number
  /** Number of historical transitions used. */
  sampleCount: number
  /** Blended estimate (cold-start: weighted avg of historical + default). */
  effectiveMinutes: number
}

/**
 * Keyed by `format:stage` (e.g. `'video:roteiro'`).
 * Missing keys = no historical data for that combination.
 */
export type VelocityMap = Record<string, VelocityEntry>

/** Raw row from the velocity query (Supabase JOIN result). */
export interface VelocityTransitionRow {
  pipeline_id: string
  from_value: string
  to_value: string
  changed_at: string
  format: string
}

/* ------------------------------------------------------------------ */
/*  Mode Inference                                                      */
/* ------------------------------------------------------------------ */

export type WorkMode = 'escrever' | 'gravar' | 'pos-prod'

export interface ModeInference {
  /** Dominant mode, or null if no clear winner. */
  mode: WorkMode | null
  /** 0–1 ratio of dominant group vs total active items. */
  confidence: number
  /** Human-readable label for the UI. */
  label: string
  /** Per-group counts used for the inference. */
  counts: Record<string, number>
}
```

**Run:** `npx tsc --noEmit -p apps/web/tsconfig.json` (typecheck only — no tests needed for types)

**Commit:** `feat(pipeline): add velocity and mode inference types`

---

### Task 3: Velocity Computation — Pure Functions (TDD)

**Files:**
- Create: `apps/web/test/cms/velocity.test.ts`
- Create: `apps/web/src/lib/pipeline/velocity.ts`

**Context:** Velocity is computed from pairs of consecutive `stage_change` events on the same `pipeline_id`. For each pair, duration = `changed_at[n+1] - changed_at[n]`. We group by `format:from_value` (the stage the item was IN, not the stage it moved TO). Then compute median, P90, and blend with EFFORT_DEFAULTS for cold-start.

- [ ] **Step 1: Write test file**

Create `apps/web/test/cms/velocity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeP90, blendVelocity, buildVelocityMap } from '../../src/lib/pipeline/velocity'
import type { VelocityTransitionRow } from '../../src/lib/pipeline/up-next-types'

/* ------------------------------------------------------------------ */
/*  computeP90                                                          */
/* ------------------------------------------------------------------ */

describe('computeP90', () => {
  it('returns the single value for 1-element array', () => {
    expect(computeP90([42])).toBe(42)
  })

  it('computes P90 for a sorted array of 10 elements', () => {
    // [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    // P90 index = ceil(0.9 * 10) - 1 = 8 → value 90
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    expect(computeP90(values)).toBe(90)
  })

  it('computes P90 for unsorted input', () => {
    const values = [100, 10, 50, 30, 70, 20, 80, 40, 60, 90]
    expect(computeP90(values)).toBe(90)
  })

  it('returns the max for 2 elements', () => {
    expect(computeP90([10, 50])).toBe(50)
  })

  it('throws on empty array', () => {
    expect(() => computeP90([])).toThrow()
  })

  it('handles identical values', () => {
    expect(computeP90([60, 60, 60, 60, 60])).toBe(60)
  })
})

/* ------------------------------------------------------------------ */
/*  blendVelocity                                                       */
/* ------------------------------------------------------------------ */

describe('blendVelocity', () => {
  it('returns default when sampleCount is 0', () => {
    expect(blendVelocity(0, 120, 180)).toBe(180)
  })

  it('returns pure historical when sampleCount >= 10', () => {
    expect(blendVelocity(10, 120, 180)).toBe(120)
    expect(blendVelocity(50, 120, 180)).toBe(120)
  })

  it('blends 50/50 when sampleCount is 5 (weight = 0.5)', () => {
    // weight = 5/10 = 0.5 → 0.5 * 120 + 0.5 * 180 = 150
    expect(blendVelocity(5, 120, 180)).toBe(150)
  })

  it('blends at sampleCount 3 (weight = 0.3)', () => {
    // weight = 3/10 = 0.3 → 0.3 * 100 + 0.7 * 200 = 170
    expect(blendVelocity(3, 100, 200)).toBe(170)
  })

  it('blends at sampleCount 1 (weight = 0.1)', () => {
    // weight = 1/10 = 0.1 → 0.1 * 60 + 0.9 * 180 = 168
    expect(blendVelocity(1, 60, 180)).toBe(168)
  })

  it('caps weight at 1 for sampleCount > 10', () => {
    expect(blendVelocity(100, 120, 180)).toBe(120)
  })
})

/* ------------------------------------------------------------------ */
/*  buildVelocityMap                                                    */
/* ------------------------------------------------------------------ */

describe('buildVelocityMap', () => {
  function makeRow(overrides: Partial<VelocityTransitionRow> & { changed_at: string; format: string }): VelocityTransitionRow {
    return {
      pipeline_id: 'p1',
      from_value: 'idea',
      to_value: 'outline',
      ...overrides,
    }
  }

  it('returns empty map for empty input', () => {
    expect(buildVelocityMap([])).toEqual({})
  })

  it('computes duration from consecutive transitions on same pipeline_id', () => {
    // Pipeline p1: idea→outline at T0, outline→draft at T0+60min
    const rows: VelocityTransitionRow[] = [
      makeRow({ pipeline_id: 'p1', from_value: 'idea', to_value: 'outline', changed_at: '2026-05-01T10:00:00Z', format: 'video' }),
      makeRow({ pipeline_id: 'p1', from_value: 'outline', to_value: 'draft', changed_at: '2026-05-01T11:00:00Z', format: 'video' }),
    ]
    const map = buildVelocityMap(rows)
    // The duration for video:idea is from T0 to when it transitioned out (but we need the NEXT transition)
    // Actually: rows are ordered by changed_at ASC per pipeline.
    // Row 0 = idea→outline at 10:00 (stage was 'idea', it left at 10:00)
    // Row 1 = outline→draft at 11:00 (stage was 'outline', it left at 11:00)
    // Duration in 'outline' = 11:00 - 10:00 = 60 min
    // Duration in 'idea' cannot be computed (no prior transition)
    // Wait — the from_value IS the stage it was in. The duration in from_value = time between this row and the next row for the same pipeline.
    // Actually: the transition row tells us WHEN the item LEFT from_value.
    // To compute how long it was in from_value, we need to know when it ENTERED from_value.
    // It entered from_value when the previous transition's to_value == this row's from_value.
    // So: for row[n], entered_at = row[n-1].changed_at, exited_at = row[n].changed_at
    // Duration in from_value = row[n].changed_at - row[n-1].changed_at
    // Row 0: no previous row → cannot compute duration for 'idea'
    // Row 1: entered 'outline' at row[0].changed_at = 10:00, exited at 11:00 → 60 min
    expect(map['video:outline']).toBeDefined()
    expect(map['video:outline']!.medianMinutes).toBe(60)
    expect(map['video:outline']!.sampleCount).toBe(1)
    // 'idea' has no entry (no prior transition to compute duration)
    expect(map['video:idea']).toBeUndefined()
  })

  it('computes median and P90 across multiple pipelines', () => {
    // 3 pipelines, each with 2 transitions, so we get 3 durations for video:outline
    // Durations: 60, 120, 180 → median=120, P90=180
    const rows: VelocityTransitionRow[] = [
      // Pipeline p1: outline for 60 min
      makeRow({ pipeline_id: 'p1', from_value: 'idea', to_value: 'outline', changed_at: '2026-05-01T10:00:00Z', format: 'video' }),
      makeRow({ pipeline_id: 'p1', from_value: 'outline', to_value: 'draft', changed_at: '2026-05-01T11:00:00Z', format: 'video' }),
      // Pipeline p2: outline for 120 min
      makeRow({ pipeline_id: 'p2', from_value: 'idea', to_value: 'outline', changed_at: '2026-05-02T10:00:00Z', format: 'video' }),
      makeRow({ pipeline_id: 'p2', from_value: 'outline', to_value: 'draft', changed_at: '2026-05-02T12:00:00Z', format: 'video' }),
      // Pipeline p3: outline for 180 min
      makeRow({ pipeline_id: 'p3', from_value: 'idea', to_value: 'outline', changed_at: '2026-05-03T10:00:00Z', format: 'video' }),
      makeRow({ pipeline_id: 'p3', from_value: 'outline', to_value: 'draft', changed_at: '2026-05-03T13:00:00Z', format: 'video' }),
    ]
    const map = buildVelocityMap(rows)
    expect(map['video:outline']!.medianMinutes).toBe(120)
    expect(map['video:outline']!.p90Minutes).toBe(180)
    expect(map['video:outline']!.sampleCount).toBe(3)
  })

  it('blends with EFFORT_DEFAULTS for cold-start', () => {
    // video:outline default = 120 min. 1 sample of 60 min.
    // weight = 1/10 = 0.1 → effectiveMinutes = 0.1 * 60 + 0.9 * 120 = 114
    const rows: VelocityTransitionRow[] = [
      makeRow({ pipeline_id: 'p1', from_value: 'idea', to_value: 'outline', changed_at: '2026-05-01T10:00:00Z', format: 'video' }),
      makeRow({ pipeline_id: 'p1', from_value: 'outline', to_value: 'draft', changed_at: '2026-05-01T11:00:00Z', format: 'video' }),
    ]
    const map = buildVelocityMap(rows)
    expect(map['video:outline']!.effectiveMinutes).toBe(114)
  })

  it('uses pure historical for sampleCount >= 10', () => {
    // 10 pipelines, each with outline duration of 90 min
    const rows: VelocityTransitionRow[] = []
    for (let i = 0; i < 10; i++) {
      const pid = `p${i}`
      const day = String(i + 1).padStart(2, '0')
      rows.push(
        makeRow({ pipeline_id: pid, from_value: 'idea', to_value: 'outline', changed_at: `2026-05-${day}T10:00:00Z`, format: 'video' }),
        makeRow({ pipeline_id: pid, from_value: 'outline', to_value: 'draft', changed_at: `2026-05-${day}T11:30:00Z`, format: 'video' }),
      )
    }
    const map = buildVelocityMap(rows)
    expect(map['video:outline']!.effectiveMinutes).toBe(90) // pure historical, no blending
    expect(map['video:outline']!.sampleCount).toBe(10)
  })

  it('handles multiple stages for the same pipeline', () => {
    // p1 goes idea→outline→draft→roteiro with known durations
    const rows: VelocityTransitionRow[] = [
      makeRow({ pipeline_id: 'p1', from_value: 'idea', to_value: 'outline', changed_at: '2026-05-01T10:00:00Z', format: 'video' }),
      makeRow({ pipeline_id: 'p1', from_value: 'outline', to_value: 'draft', changed_at: '2026-05-01T12:00:00Z', format: 'video' }),
      makeRow({ pipeline_id: 'p1', from_value: 'draft', to_value: 'roteiro', changed_at: '2026-05-01T15:00:00Z', format: 'video' }),
    ]
    const map = buildVelocityMap(rows)
    // outline: 12:00 - 10:00 = 120 min
    expect(map['video:outline']!.medianMinutes).toBe(120)
    // draft: 15:00 - 12:00 = 180 min
    expect(map['video:draft']!.medianMinutes).toBe(180)
  })

  it('ignores transitions with negative duration (clock skew)', () => {
    const rows: VelocityTransitionRow[] = [
      makeRow({ pipeline_id: 'p1', from_value: 'idea', to_value: 'outline', changed_at: '2026-05-01T12:00:00Z', format: 'video' }),
      // Somehow changed_at is BEFORE the previous transition (clock skew / manual correction)
      makeRow({ pipeline_id: 'p1', from_value: 'outline', to_value: 'draft', changed_at: '2026-05-01T11:00:00Z', format: 'video' }),
    ]
    const map = buildVelocityMap(rows)
    expect(map['video:outline']).toBeUndefined()
  })

  it('ignores transitions with duration > 30 days (stale items)', () => {
    const rows: VelocityTransitionRow[] = [
      makeRow({ pipeline_id: 'p1', from_value: 'idea', to_value: 'outline', changed_at: '2026-03-01T10:00:00Z', format: 'video' }),
      makeRow({ pipeline_id: 'p1', from_value: 'outline', to_value: 'draft', changed_at: '2026-05-01T10:00:00Z', format: 'video' }),
    ]
    const map = buildVelocityMap(rows)
    // 61 days → ignored
    expect(map['video:outline']).toBeUndefined()
  })

  it('separates by format (video vs blog_post)', () => {
    const rows: VelocityTransitionRow[] = [
      // video outline: 60 min
      makeRow({ pipeline_id: 'p1', from_value: 'idea', to_value: 'outline', changed_at: '2026-05-01T10:00:00Z', format: 'video' }),
      makeRow({ pipeline_id: 'p1', from_value: 'outline', to_value: 'draft', changed_at: '2026-05-01T11:00:00Z', format: 'video' }),
      // blog_post outline: 120 min
      makeRow({ pipeline_id: 'p2', from_value: 'idea', to_value: 'outline', changed_at: '2026-05-01T10:00:00Z', format: 'blog_post' }),
      makeRow({ pipeline_id: 'p2', from_value: 'outline', to_value: 'draft', changed_at: '2026-05-01T12:00:00Z', format: 'blog_post' }),
    ]
    const map = buildVelocityMap(rows)
    expect(map['video:outline']!.medianMinutes).toBe(60)
    expect(map['blog_post:outline']!.medianMinutes).toBe(120)
  })
})
```

- [ ] **Step 2: Run tests (RED)**

```bash
npm run test:web -- --run apps/web/test/cms/velocity.test.ts
```

All tests should fail (module not found).

- [ ] **Step 3: Implement velocity.ts**

Create `apps/web/src/lib/pipeline/velocity.ts`:

```typescript
import { EFFORT_DEFAULTS } from './up-next-constants'
import type { VelocityEntry, VelocityMap, VelocityTransitionRow } from './up-next-types'

const MAX_DURATION_MINUTES = 30 * 24 * 60 // 30 days — anything longer is stale
const COLD_START_THRESHOLD = 10            // samples needed for full historical weight

/**
 * Compute the 90th-percentile value from a numeric array.
 * Throws if the array is empty.
 */
export function computeP90(values: number[]): number {
  if (values.length === 0) throw new Error('computeP90: empty array')
  if (values.length === 1) return values[0]!
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil(0.9 * sorted.length) - 1
  return sorted[index]!
}

/**
 * Blend historical median with EFFORT_DEFAULTS using linear interpolation.
 * At 0 samples → pure default. At >= COLD_START_THRESHOLD samples → pure historical.
 */
export function blendVelocity(
  sampleCount: number,
  historicalMedian: number,
  defaultMinutes: number,
): number {
  const weight = Math.min(sampleCount / COLD_START_THRESHOLD, 1)
  return Math.round(weight * historicalMedian + (1 - weight) * defaultMinutes)
}

/**
 * Compute median of a sorted numeric array.
 */
function computeMedian(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
  }
  return sorted[mid]!
}

/**
 * Build a VelocityMap from raw transition rows.
 *
 * Each row represents a stage_change event: the item LEFT `from_value` at `changed_at`.
 * Duration in a stage = time between entering (previous row's changed_at) and leaving (this row's changed_at).
 * Rows must already be ordered by (pipeline_id, changed_at ASC) or will be sorted internally.
 */
export function buildVelocityMap(rows: VelocityTransitionRow[]): VelocityMap {
  if (rows.length === 0) return {}

  // Group by pipeline_id, sorted by changed_at ASC
  const byPipeline = new Map<string, VelocityTransitionRow[]>()
  for (const row of rows) {
    const group = byPipeline.get(row.pipeline_id)
    if (group) group.push(row)
    else byPipeline.set(row.pipeline_id, [row])
  }

  // Collect durations per format:stage
  const durationsByKey = new Map<string, number[]>()

  for (const [, pipelineRows] of byPipeline) {
    // Sort by changed_at ascending
    pipelineRows.sort((a, b) => a.changed_at.localeCompare(b.changed_at))

    for (let i = 1; i < pipelineRows.length; i++) {
      const prev = pipelineRows[i - 1]!
      const curr = pipelineRows[i]!

      const enteredAt = new Date(prev.changed_at).getTime()
      const exitedAt = new Date(curr.changed_at).getTime()
      const durationMs = exitedAt - enteredAt

      // Skip negative durations (clock skew) and very long durations (stale items)
      if (durationMs <= 0) continue
      const durationMinutes = Math.round(durationMs / 60_000)
      if (durationMinutes > MAX_DURATION_MINUTES) continue

      // The stage the item was IN = curr.from_value (the stage it LEFT)
      // Wait: prev.to_value == curr.from_value (the stage the item entered at prev and left at curr)
      const key = `${curr.format}:${curr.from_value}`
      const durations = durationsByKey.get(key)
      if (durations) durations.push(durationMinutes)
      else durationsByKey.set(key, [durationMinutes])
    }
  }

  // Build VelocityMap
  const map: VelocityMap = {}

  for (const [key, durations] of durationsByKey) {
    const sorted = [...durations].sort((a, b) => a - b)
    const medianMinutes = computeMedian(sorted)
    const p90Minutes = computeP90(sorted)
    const sampleCount = sorted.length
    const defaultMinutes = EFFORT_DEFAULTS[key]?.minutes ?? 60
    const effectiveMinutes = blendVelocity(sampleCount, medianMinutes, defaultMinutes)

    map[key] = { medianMinutes, p90Minutes, sampleCount, effectiveMinutes }
  }

  return map
}
```

- [ ] **Step 4: Run tests (GREEN)**

```bash
npm run test:web -- --run apps/web/test/cms/velocity.test.ts
```

All tests should pass.

**Commit:** `feat(pipeline): add velocity computation pure functions (TDD)`

---

### Task 4: Velocity Cache + Fetch

**Files:**
- Modify: `apps/web/src/lib/pipeline/velocity.ts`
- Create: `apps/web/test/cms/velocity-fetch.test.ts` (optional — fetch uses Supabase, may skip unit test)

**Context:** Follows the `unstable_cache` pattern from `apps/web/src/lib/youtube/queries.ts` — `getSupabaseServiceClient()` inside the cached function, keyed by `siteId`, revalidate every 300s (5 min).

- [ ] **Step 1: Add fetchVelocityMap to velocity.ts**

Add at the end of `apps/web/src/lib/pipeline/velocity.ts`:

```typescript
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

/**
 * Fetch stage transition history and compute velocity map.
 * Cached via unstable_cache — revalidates every 5 minutes.
 * Filters to `event_type = 'stage_change'`, last 90 days, limit 5000 rows.
 */
export const fetchVelocityMap = unstable_cache(
  async (siteId: string): Promise<VelocityMap> => {
    const supabase = getSupabaseServiceClient()

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('content_pipeline_history')
      .select(`
        pipeline_id,
        from_value,
        to_value,
        changed_at,
        content_pipeline!inner(format, site_id)
      `)
      .eq('content_pipeline.site_id', siteId)
      .eq('event_type', 'stage_change')
      .gte('changed_at', ninetyDaysAgo)
      .order('changed_at', { ascending: true })
      .limit(5000)

    if (error) {
      console.error('[velocity] fetch error:', error.message)
      return {}
    }

    const rows: VelocityTransitionRow[] = (data ?? []).map((row: Record<string, unknown>) => {
      const cp = row.content_pipeline as Record<string, unknown>
      return {
        pipeline_id: row.pipeline_id as string,
        from_value: row.from_value as string,
        to_value: row.to_value as string,
        changed_at: row.changed_at as string,
        format: cp.format as string,
      }
    })

    return buildVelocityMap(rows)
  },
  ['pipeline-velocity-map'],
  { revalidate: 300 }
)
```

- [ ] **Step 2: Verify import resolution**

The import `@/lib/supabase/service` must resolve. Run:

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -i velocity | head -5
```

**Commit:** `feat(pipeline): add fetchVelocityMap with unstable_cache`

---

### Task 5: Integrate Velocity with getProductionDeadline (TDD)

**Files:**
- Modify: `apps/web/test/cms/get-production-deadline.test.ts`
- Modify: `apps/web/src/lib/pipeline/get-production-deadline.ts`

**Context:** Current `getProductionDeadline(pubDate, stage)` uses fixed day offsets (4, 3, 2, 1). The velocity-aware version accepts optional `velocityMap` + `format` params. When provided, it sums `effectiveMinutes` from current stage through `ready`, converts to calendar days (8h workday = 480 min), and uses that instead of the fixed offset. Existing callers are unaffected (params are optional).

- [ ] **Step 1: Add velocity-aware tests**

Add to the end of `apps/web/test/cms/get-production-deadline.test.ts`:

```typescript
import type { VelocityMap } from '../../src/lib/pipeline/up-next-types'

describe('getProductionDeadline with velocity', () => {
  const velocityMap: VelocityMap = {
    'video:roteiro':      { medianMinutes: 180, p90Minutes: 240, sampleCount: 10, effectiveMinutes: 180 },
    'video:gravacao':     { medianMinutes: 240, p90Minutes: 300, sampleCount: 10, effectiveMinutes: 240 },
    'video:edicao':       { medianMinutes: 90,  p90Minutes: 120, sampleCount: 10, effectiveMinutes: 90 },
    'video:pos_producao': { medianMinutes: 60,  p90Minutes: 90,  sampleCount: 10, effectiveMinutes: 60 },
    'video:ready':        { medianMinutes: 30,  p90Minutes: 45,  sampleCount: 10, effectiveMinutes: 30 },
  }

  it('sums effectiveMinutes from current stage to ready and converts to calendar days', () => {
    // From roteiro: 180 + 240 + 90 + 60 + 30 = 600 min = 1.25 workdays → ceil = 2 days
    const result = getProductionDeadline('2026-06-10', 'roteiro', { velocityMap, format: 'video' })
    expect(result).toBe('2026-06-08') // pub - 2 days
  })

  it('uses velocity for gravacao stage', () => {
    // From gravacao: 240 + 90 + 60 + 30 = 420 min = 0.875 workdays → ceil = 1 day
    const result = getProductionDeadline('2026-06-10', 'gravacao', { velocityMap, format: 'video' })
    expect(result).toBe('2026-06-09') // pub - 1 day
  })

  it('falls back to fixed offset when velocityMap is missing entries', () => {
    const sparseMap: VelocityMap = {
      'video:roteiro': { medianMinutes: 180, p90Minutes: 240, sampleCount: 10, effectiveMinutes: 180 },
    }
    // Missing gravacao/edicao/pos_producao/ready → cannot compute velocity sum → use fixed offset
    const result = getProductionDeadline('2026-06-10', 'roteiro', { velocityMap: sparseMap, format: 'video' })
    // Falls back to fixed: roteiro → pub - 4
    expect(result).toBe('2026-06-06')
  })

  it('falls back to fixed offset when format is not provided', () => {
    const result = getProductionDeadline('2026-06-10', 'roteiro', { velocityMap })
    expect(result).toBe('2026-06-06')
  })

  it('returns undefined for scheduled/published even with velocity', () => {
    expect(getProductionDeadline('2026-06-10', 'scheduled', { velocityMap, format: 'video' })).toBeUndefined()
    expect(getProductionDeadline('2026-06-10', 'published', { velocityMap, format: 'video' })).toBeUndefined()
  })

  it('is backward-compatible: no velocity params = same behavior', () => {
    expect(getProductionDeadline('2026-06-10', 'idea')).toBe('2026-06-06')
    expect(getProductionDeadline('2026-06-10', 'gravacao')).toBe('2026-06-07')
  })
})
```

- [ ] **Step 2: Run tests (RED)**

```bash
npm run test:web -- --run apps/web/test/cms/get-production-deadline.test.ts
```

New tests should fail (signature mismatch).

- [ ] **Step 3: Implement velocity-aware getProductionDeadline**

Replace `apps/web/src/lib/pipeline/get-production-deadline.ts`:

```typescript
import { subDays, formatISO, parseISO } from 'date-fns'
import { STAGE_ORDER, type Stage } from './up-next-constants'
import type { VelocityMap } from './up-next-types'

/** Stages from idea through ready, in order. scheduled/published excluded. */
const PRODUCTION_STAGES: Stage[] = [
  'idea', 'outline', 'draft', 'roteiro', 'gravacao', 'edicao', 'pos_producao', 'ready',
]

const WORKDAY_MINUTES = 480 // 8 hours

interface VelocityOptions {
  velocityMap?: VelocityMap
  format?: string
}

/**
 * Compute the deadline to finish the current stage, given a publication date.
 * If velocityMap + format are provided and cover all remaining stages,
 * uses learned velocity. Otherwise falls back to fixed day offsets.
 */
export function getProductionDeadline(
  pubDate: string,
  stage: Stage,
  options?: VelocityOptions,
): string | undefined {
  const pub = parseISO(pubDate)

  if (stage === 'scheduled' || stage === 'published') return undefined

  // Try velocity-based deadline
  if (options?.velocityMap && options.format) {
    const velocityDays = computeVelocityDays(stage, options.format, options.velocityMap)
    if (velocityDays !== null) {
      return formatISO(subDays(pub, velocityDays), { representation: 'date' })
    }
  }

  // Fixed fallback
  switch (stage) {
    case 'idea': case 'outline': case 'draft': case 'roteiro':
      return formatISO(subDays(pub, 4), { representation: 'date' })
    case 'gravacao':
      return formatISO(subDays(pub, 3), { representation: 'date' })
    case 'edicao':
      return formatISO(subDays(pub, 2), { representation: 'date' })
    case 'pos_producao': case 'ready':
      return formatISO(subDays(pub, 1), { representation: 'date' })
    default:
      return undefined
  }
}

/**
 * Sum effectiveMinutes from current stage through ready, convert to calendar workdays.
 * Returns null if any stage in the range is missing from the velocity map.
 */
function computeVelocityDays(
  currentStage: Stage,
  format: string,
  velocityMap: VelocityMap,
): number | null {
  const startIdx = PRODUCTION_STAGES.indexOf(currentStage)
  if (startIdx === -1) return null

  // Sum from current stage through ready (inclusive)
  let totalMinutes = 0
  for (let i = startIdx; i < PRODUCTION_STAGES.length; i++) {
    const key = `${format}:${PRODUCTION_STAGES[i]!}`
    const entry = velocityMap[key]
    if (!entry) return null // incomplete velocity data → fall back
    totalMinutes += entry.effectiveMinutes
  }

  // Convert to calendar workdays (ceil to nearest day)
  return Math.ceil(totalMinutes / WORKDAY_MINUTES)
}
```

- [ ] **Step 4: Run tests (GREEN)**

```bash
npm run test:web -- --run apps/web/test/cms/get-production-deadline.test.ts
```

All tests should pass, including the original fixed-offset tests.

**Commit:** `feat(pipeline): velocity-aware getProductionDeadline`

---

### Task 6: WIP Limits — Constants + getWipStatus (TDD)

**Files:**
- Create: `apps/web/test/cms/wip-limits.test.ts`
- Modify: `apps/web/src/lib/pipeline/up-next-constants.ts`

**Context:** WIP limits tell the user when a stage group has too many items. Limits are stored as constants with localStorage override support. `getWipStatus()` compares counts against limits and returns a status for each group.

- [ ] **Step 1: Write test file**

Create `apps/web/test/cms/wip-limits.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getWipStatus, DEFAULT_WIP_LIMITS, type WipStatus } from '../../src/lib/pipeline/up-next-constants'

describe('DEFAULT_WIP_LIMITS', () => {
  it('has limits for all 4 stage groups', () => {
    expect(DEFAULT_WIP_LIMITS).toHaveProperty('escrever')
    expect(DEFAULT_WIP_LIMITS).toHaveProperty('gravar')
    expect(DEFAULT_WIP_LIMITS).toHaveProperty('pos-prod')
    expect(DEFAULT_WIP_LIMITS).toHaveProperty('prontos')
  })

  it('has reasonable positive values', () => {
    for (const limit of Object.values(DEFAULT_WIP_LIMITS)) {
      expect(limit).toBeGreaterThan(0)
    }
  })
})

describe('getWipStatus', () => {
  const limits = { escrever: 5, gravar: 2, 'pos-prod': 3, prontos: 4 }

  it('returns ok when count is below limit', () => {
    const result = getWipStatus({ escrever: 2, gravar: 1, 'pos-prod': 1, prontos: 1 }, limits)
    expect(result.escrever).toBe('ok')
    expect(result.gravar).toBe('ok')
    expect(result['pos-prod']).toBe('ok')
    expect(result.prontos).toBe('ok')
  })

  it('returns warning when count equals limit', () => {
    const result = getWipStatus({ escrever: 5, gravar: 2, 'pos-prod': 3, prontos: 4 }, limits)
    expect(result.escrever).toBe('warning')
    expect(result.gravar).toBe('warning')
    expect(result['pos-prod']).toBe('warning')
    expect(result.prontos).toBe('warning')
  })

  it('returns exceeded when count is above limit', () => {
    const result = getWipStatus({ escrever: 6, gravar: 3, 'pos-prod': 4, prontos: 5 }, limits)
    expect(result.escrever).toBe('exceeded')
    expect(result.gravar).toBe('exceeded')
    expect(result['pos-prod']).toBe('exceeded')
    expect(result.prontos).toBe('exceeded')
  })

  it('returns ok for zero counts', () => {
    const result = getWipStatus({ escrever: 0, gravar: 0, 'pos-prod': 0, prontos: 0 }, limits)
    expect(result.escrever).toBe('ok')
  })

  it('handles mixed statuses', () => {
    const result = getWipStatus({ escrever: 3, gravar: 2, 'pos-prod': 5, prontos: 1 }, limits)
    expect(result.escrever).toBe('ok')
    expect(result.gravar).toBe('warning')
    expect(result['pos-prod']).toBe('exceeded')
    expect(result.prontos).toBe('ok')
  })

  it('uses DEFAULT_WIP_LIMITS when no custom limits provided', () => {
    // Just verify it doesn't throw
    const result = getWipStatus({ escrever: 1, gravar: 1, 'pos-prod': 1, prontos: 1 })
    expect(result).toBeDefined()
    expect(Object.keys(result)).toEqual(expect.arrayContaining(['escrever', 'gravar', 'pos-prod', 'prontos']))
  })

  it('treats missing count keys as 0', () => {
    const result = getWipStatus({}, limits)
    expect(result.escrever).toBe('ok')
    expect(result.gravar).toBe('ok')
  })

  it('handles warning at limit - 1 threshold (80% rule)', () => {
    // Correction: actually warning = AT limit, exceeded = OVER limit.
    // At count = limit → warning. At count > limit → exceeded.
    const result = getWipStatus({ escrever: 4, gravar: 1, 'pos-prod': 2, prontos: 3 }, limits)
    expect(result.escrever).toBe('ok') // 4 < 5
    expect(result.gravar).toBe('ok')   // 1 < 2
  })
})
```

- [ ] **Step 2: Run tests (RED)**

```bash
npm run test:web -- --run apps/web/test/cms/wip-limits.test.ts
```

- [ ] **Step 3: Add WIP limit exports to up-next-constants.ts**

Add at the end of `apps/web/src/lib/pipeline/up-next-constants.ts`:

```typescript
/* ------------------------------------------------------------------ */
/*  WIP Limits                                                          */
/* ------------------------------------------------------------------ */

export const DEFAULT_WIP_LIMITS: Record<string, number> = {
  escrever: 6,
  gravar: 3,
  'pos-prod': 4,
  prontos: 5,
} as const satisfies Record<string, number>

export type WipStatusLevel = 'ok' | 'warning' | 'exceeded'

/**
 * Compare stage group counts against WIP limits.
 * - ok: count < limit
 * - warning: count === limit
 * - exceeded: count > limit
 */
export function getWipStatus(
  stageCounts: Record<string, number>,
  limits: Record<string, number> = DEFAULT_WIP_LIMITS,
): Record<string, WipStatusLevel> {
  const result: Record<string, WipStatusLevel> = {}

  for (const [group, limit] of Object.entries(limits)) {
    const count = stageCounts[group] ?? 0
    if (count > limit) result[group] = 'exceeded'
    else if (count === limit) result[group] = 'warning'
    else result[group] = 'ok'
  }

  return result
}
```

- [ ] **Step 4: Run tests (GREEN)**

```bash
npm run test:web -- --run apps/web/test/cms/wip-limits.test.ts
```

**Commit:** `feat(pipeline): add WIP limits constants and getWipStatus (TDD)`

---

### Task 7: WIP Limit Pill Styling

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx`

**Context:** The stage count pills at lines 442-454 of `up-next-this-week.tsx` currently show `{count} {group}`. We add WIP limit display (`count/limit`) and conditional coloring:
- `ok` → current colors (unchanged)
- `warning` → amber/warn border
- `exceeded` → red/danger border + pulsing dot

The component already receives `stageCounts` as a prop. We import `getWipStatus` and `DEFAULT_WIP_LIMITS` and compute status inline.

- [ ] **Step 1: Add imports**

At the top of `up-next-this-week.tsx`, add:

```typescript
import { DAY_LABELS, DEFAULT_WIP_LIMITS, getWipStatus } from '@/lib/pipeline/up-next-constants'
```

(Replace the existing `import { DAY_LABELS } from '@/lib/pipeline/up-next-constants'`)

- [ ] **Step 2: Add WIP status computation inside the component**

Inside the `UpNextThisWeek` component, before the `return` statement, add:

```typescript
  const wipStatus = useMemo(() => getWipStatus(stageCounts), [stageCounts])
```

Add `useMemo` to the existing React import if not already there (it is — line 3 already imports it).

- [ ] **Step 3: Update pill rendering**

Replace the stage count pills section (lines 443-454) from:

```tsx
          {Object.entries(stageCounts).map(([group, count]) => (
            <span key={group} className="flex items-center gap-1">
              <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full" style={{
                background: group === 'escrever' ? 'var(--gem-accent)'
                  : group === 'gravar' ? 'var(--gem-danger)'
                  : group === 'pos-prod' ? 'var(--gem-warn)'
                  : 'var(--gem-done)',
              }} />
              {count} {group}
            </span>
          ))}
```

to:

```tsx
          {Object.entries(stageCounts).map(([group, count]) => {
            const status = wipStatus[group]
            const limit = DEFAULT_WIP_LIMITS[group]
            const dotColor = group === 'escrever' ? 'var(--gem-accent)'
              : group === 'gravar' ? 'var(--gem-danger)'
              : group === 'pos-prod' ? 'var(--gem-warn)'
              : 'var(--gem-done)'
            return (
              <span
                key={group}
                className="flex items-center gap-1"
                style={{
                  color: status === 'exceeded' ? 'var(--gem-danger)'
                    : status === 'warning' ? 'var(--gem-warn)'
                    : undefined,
                }}
                title={status === 'exceeded'
                  ? `${group}: ${count} itens (limite: ${limit})`
                  : status === 'warning'
                    ? `${group}: no limite (${limit})`
                    : undefined}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block w-2 h-2 rounded-full${status === 'exceeded' ? ' motion-safe:animate-pulse' : ''}`}
                  style={{ background: status === 'exceeded' ? 'var(--gem-danger)' : dotColor }}
                />
                {count}{limit ? `/${limit}` : ''} {group}
              </span>
            )
          })}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

- [ ] **Step 5: Run all pipeline tests to verify no regressions**

```bash
npm run test:web -- --run apps/web/test/cms/
```

**Commit:** `feat(pipeline): WIP limit pill styling with amber/red indicators`

---

### Task 8: Mode Inference — Pure Function (TDD)

**Files:**
- Create: `apps/web/test/cms/infer-mode.test.ts`
- Create: `apps/web/src/lib/pipeline/infer-mode.ts`

**Context:** Mode inference looks at the distribution of active pipeline items across stage groups and determines the dominant work mode. A 40% threshold means: if 40%+ of active items are in one group, that group is the mode. Ties go to the group closest to completion (highest STAGE_ORDER).

- [ ] **Step 1: Write test file**

Create `apps/web/test/cms/infer-mode.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { inferCurrentMode } from '../../src/lib/pipeline/infer-mode'
import type { PipelineItemWithSlot } from '../../src/lib/pipeline/up-next-types'

function makeItem(stage: string, format: string = 'video'): PipelineItemWithSlot {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    title: 'Test',
    stage: stage as PipelineItemWithSlot['stage'],
    priority: 1,
    format: format as PipelineItemWithSlot['format'],
    language: 'pt-br',
    duration_target: null,
    scheduled_at: null,
    youtube_channel_id: 'ch1',
    playlist_id: null,
    playlist_name: null,
    playlist_position: null,
    playlist_total: null,
    channel_label: null,
  }
}

describe('inferCurrentMode', () => {
  it('returns null mode for empty items', () => {
    const result = inferCurrentMode([])
    expect(result.mode).toBeNull()
    expect(result.confidence).toBe(0)
    expect(result.label).toBe('Sem itens ativos')
  })

  it('returns escrever when 40%+ items are in writing stages', () => {
    const items = [
      makeItem('idea'), makeItem('outline'), makeItem('draft'),
      makeItem('gravacao'), makeItem('edicao'),
    ]
    // escrever: 3/5 = 60% → dominant
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('escrever')
    expect(result.confidence).toBeCloseTo(0.6, 1)
    expect(result.label).toBe('Modo escrita')
  })

  it('returns gravar when 40%+ items are recording', () => {
    const items = [
      makeItem('gravacao'), makeItem('gravacao'), makeItem('gravacao'),
      makeItem('idea'), makeItem('edicao'),
    ]
    // gravar: 3/5 = 60%
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('gravar')
    expect(result.confidence).toBeCloseTo(0.6, 1)
    expect(result.label).toBe('Modo gravação')
  })

  it('returns pos-prod when 40%+ items are in post-production', () => {
    const items = [
      makeItem('edicao'), makeItem('pos_producao'), makeItem('ready'),
      makeItem('idea'), makeItem('draft'),
    ]
    // pos-prod: 3/5 = 60%
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('pos-prod')
    expect(result.confidence).toBeCloseTo(0.6, 1)
    expect(result.label).toBe('Modo pós-produção')
  })

  it('returns null mode when no group reaches 40%', () => {
    // 3 groups evenly split: 33% each → no dominant mode
    const items = [
      makeItem('idea'), makeItem('gravacao'), makeItem('edicao'),
    ]
    const result = inferCurrentMode(items)
    expect(result.mode).toBeNull()
    expect(result.label).toBe('Modo misto')
  })

  it('excludes scheduled and published items', () => {
    const items = [
      makeItem('idea'), makeItem('outline'),
      makeItem('scheduled'), makeItem('published'), makeItem('published'),
    ]
    // Active: idea + outline = 2 items, both escrever → 100%
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('escrever')
    expect(result.confidence).toBe(1)
  })

  it('returns counts for all groups', () => {
    const items = [
      makeItem('idea'), makeItem('draft'),
      makeItem('gravacao'),
      makeItem('edicao'), makeItem('ready'),
    ]
    const result = inferCurrentMode(items)
    expect(result.counts).toEqual({
      escrever: 2,
      gravar: 1,
      'pos-prod': 2,
      prontos: 0,
    })
  })

  it('breaks ties by favoring highest stage order group', () => {
    // 2 escrever (idea, outline) + 2 pos-prod (edicao, ready) = 50% each
    // Both above 40% → tie → pos-prod wins (higher stages = closer to done)
    const items = [
      makeItem('idea'), makeItem('outline'),
      makeItem('edicao'), makeItem('ready'),
    ]
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('pos-prod')
  })

  it('handles all items in one group', () => {
    const items = [makeItem('idea'), makeItem('outline'), makeItem('draft')]
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('escrever')
    expect(result.confidence).toBe(1)
  })

  it('returns null mode for single item below threshold (edge case)', () => {
    // 1 item = 100% in one group → should still trigger (100% >= 40%)
    const items = [makeItem('gravacao')]
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('gravar')
    expect(result.confidence).toBe(1)
  })

  it('ignores prontos group for mode inference (only escrever/gravar/pos-prod)', () => {
    // 3 prontos + 1 idea → prontos=75% but prontos is not a work mode
    // Active non-prontos: 1 idea → escrever = 100% of work items
    const items = [
      makeItem('scheduled'), makeItem('scheduled'), makeItem('scheduled'),
      makeItem('idea'),
    ]
    // Wait: scheduled is excluded from active. Let's rethink:
    // Actually scheduled IS in STAGE_GROUP.prontos, but scheduled/published are excluded from active count.
    // So this test needs adjustment — scheduled items are filtered out.
    // 1 active item (idea) → escrever = 100%
    const result = inferCurrentMode(items)
    expect(result.mode).toBe('escrever')
    expect(result.confidence).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests (RED)**

```bash
npm run test:web -- --run apps/web/test/cms/infer-mode.test.ts
```

- [ ] **Step 3: Implement infer-mode.ts**

Create `apps/web/src/lib/pipeline/infer-mode.ts`:

```typescript
import { STAGE_GROUP, STAGE_ORDER } from './up-next-constants'
import type { PipelineItemWithSlot } from './up-next-types'
import type { ModeInference, WorkMode } from './up-next-types'

const MODE_THRESHOLD = 0.4

const MODE_LABELS: Record<WorkMode, string> = {
  escrever: 'Modo escrita',
  gravar: 'Modo gravação',
  'pos-prod': 'Modo pós-produção',
}

/** Only these groups are considered work modes — prontos is excluded. */
const WORK_MODE_GROUPS: WorkMode[] = ['escrever', 'gravar', 'pos-prod']

/** Max STAGE_ORDER value for stages in a group (used for tie-breaking). */
function maxStageOrder(group: string): number {
  const stages = STAGE_GROUP[group] ?? []
  return Math.max(...stages.map(s => STAGE_ORDER[s] ?? 0))
}

/**
 * Infer the dominant work mode from active pipeline items.
 * Active = stage is before 'scheduled' (STAGE_ORDER < 8).
 * Threshold = 40% of active items in one group.
 * Ties broken by highest stage order (closer to done wins).
 */
export function inferCurrentMode(items: PipelineItemWithSlot[]): ModeInference {
  const activeItems = items.filter(
    item => STAGE_ORDER[item.stage] < STAGE_ORDER['scheduled'],
  )

  const counts: Record<string, number> = {}
  for (const group of Object.keys(STAGE_GROUP)) {
    counts[group] = 0
  }

  for (const item of activeItems) {
    for (const [group, stages] of Object.entries(STAGE_GROUP)) {
      if (stages.includes(item.stage)) {
        counts[group] = (counts[group] ?? 0) + 1
        break
      }
    }
  }

  if (activeItems.length === 0) {
    return { mode: null, confidence: 0, label: 'Sem itens ativos', counts }
  }

  // Find candidates above threshold (only work mode groups)
  const candidates = WORK_MODE_GROUPS
    .filter(group => (counts[group] ?? 0) / activeItems.length >= MODE_THRESHOLD)
    .sort((a, b) => {
      const ratioA = (counts[a] ?? 0) / activeItems.length
      const ratioB = (counts[b] ?? 0) / activeItems.length
      // Higher ratio first; if tied, higher stage order wins
      if (ratioB !== ratioA) return ratioB - ratioA
      return maxStageOrder(b) - maxStageOrder(a)
    })

  if (candidates.length === 0) {
    return { mode: null, confidence: 0, label: 'Modo misto', counts }
  }

  const winner = candidates[0]!
  const confidence = (counts[winner] ?? 0) / activeItems.length

  return {
    mode: winner,
    confidence,
    label: MODE_LABELS[winner],
    counts,
  }
}
```

- [ ] **Step 4: Run tests (GREEN)**

```bash
npm run test:web -- --run apps/web/test/cms/infer-mode.test.ts
```

**Commit:** `feat(pipeline): add inferCurrentMode pure function (TDD)`

---

### Task 9: Mode Label Display in UI

**Files:**
- Modify: `apps/web/src/lib/pipeline/up-next-types.ts` (add `modeInference` to `UpNextApiResponse`)
- Modify: `apps/web/src/lib/pipeline/up-next-fetcher.ts` (compute mode inference)
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx` (display label)
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx` (pass prop)

**Context:** The mode label is a subtle badge next to the stage count pills. Displayed only when `mode !== null`. Uses gem design system colors matching the mode's stage group.

- [ ] **Step 1: Add modeInference to UpNextApiResponse**

In `apps/web/src/lib/pipeline/up-next-types.ts`, add `modeInference` to the `UpNextApiResponse` interface:

```typescript
// Add after 'suggestion' field:
  modeInference: ModeInference
```

- [ ] **Step 2: Compute mode inference in fetcher**

In `apps/web/src/lib/pipeline/up-next-fetcher.ts`, add import and computation:

Add import at top:

```typescript
import { inferCurrentMode } from '@/lib/pipeline/infer-mode'
```

After the `stageCounts` computation (line 178), add:

```typescript
  const modeInference = inferCurrentMode(pipelineItems)
```

Add `modeInference` to the return object (after `suggestion`):

```typescript
    modeInference,
```

- [ ] **Step 3: Add modeInference prop to WeekGridProps**

In `apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx`, add to `WeekGridProps`:

```typescript
  modeInference?: { mode: string | null; label: string } | null
```

- [ ] **Step 4: Display mode label**

In the `UpNextThisWeek` component, in the footer area (after the WIP limit pills, before `totalEffortMinutes`), add:

```tsx
          {modeInference?.mode && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider"
              style={{
                background: modeInference.mode === 'escrever' ? gemMix('--gem-accent', 15)
                  : modeInference.mode === 'gravar' ? gemMix('--gem-danger', 15)
                  : gemMix('--gem-warn', 15),
                color: modeInference.mode === 'escrever' ? 'var(--gem-accent)'
                  : modeInference.mode === 'gravar' ? 'var(--gem-danger)'
                  : 'var(--gem-warn)',
              }}
            >
              {modeInference.label}
            </span>
          )}
```

- [ ] **Step 5: Pass prop from PipelineOverview**

In `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx`, the `UpNextThisWeek` component call (line 255-269), add:

```tsx
          modeInference={upNext.modeInference}
```

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

- [ ] **Step 7: Run all tests**

```bash
npm run test:web -- --run apps/web/test/cms/
```

**Commit:** `feat(pipeline): display mode inference label in week grid footer`

---

### Task 10: Enhanced Suggestions — findWipViolation + findBufferGap (TDD)

**Files:**
- Modify: `apps/web/test/cms/select-suggestion.test.ts`
- Modify: `apps/web/src/lib/pipeline/select-suggestion.ts`

**Context:** Two new finders are added to `selectSuggestion`. The chain becomes:
1. `findWipViolation` (NEW) — highest priority, suggests action when WIP limit exceeded
2. `findOrphanedItems` (existing)
3. `findBatchOpportunity` (existing)
4. `findNearlyCompletePlaylist` (existing)
5. `findBufferGap` (NEW) — lowest priority, suggests when a stage group has 0 items

`SuggestionInput` is extended with optional `stageCounts` and `wipLimits` fields (backward-compatible).

- [ ] **Step 1: Add tests for new finders**

Add to the end of `apps/web/test/cms/select-suggestion.test.ts`:

```typescript
describe('findWipViolation', () => {
  it('suggests when a stage group exceeds WIP limit', () => {
    const items = [
      makePipelineItem({ id: 'i1', stage: 'idea' }),
      makePipelineItem({ id: 'i2', stage: 'outline' }),
      makePipelineItem({ id: 'i3', stage: 'draft' }),
      makePipelineItem({ id: 'i4', stage: 'roteiro' }),
      makePipelineItem({ id: 'i5', stage: 'idea' }),
      makePipelineItem({ id: 'i6', stage: 'idea' }),
      makePipelineItem({ id: 'i7', stage: 'idea' }),
    ]
    // 7 items in escrever group, default limit is 6 → exceeded
    const result = selectSuggestion({
      pipelineItems: items,
      playlists: [],
      newsletterEditions: [],
      stageCounts: { escrever: 7, gravar: 0, 'pos-prod': 0, prontos: 0 },
    })
    expect(result).not.toBeNull()
    expect(result!.text).toContain('escrever')
    expect(result!.text).toContain('limite')
  })

  it('WIP violation has highest priority over other suggestions', () => {
    const items = [
      // Enough for batch opportunity
      makePipelineItem({ id: 'i1', stage: 'idea' }),
      makePipelineItem({ id: 'i2', stage: 'idea' }),
      makePipelineItem({ id: 'i3', stage: 'idea' }),
      makePipelineItem({ id: 'i4', stage: 'idea' }),
      makePipelineItem({ id: 'i5', stage: 'idea' }),
      makePipelineItem({ id: 'i6', stage: 'idea' }),
      makePipelineItem({ id: 'i7', stage: 'idea' }),
    ]
    const editions = [makeNewsletter({ status: 'draft', scheduled_at: null })]
    const result = selectSuggestion({
      pipelineItems: items,
      playlists: [],
      newsletterEditions: editions,
      stageCounts: { escrever: 7, gravar: 0, 'pos-prod': 0, prontos: 0 },
    })
    // WIP violation should win over batch/newsletter suggestions
    expect(result!.text).toContain('limite')
  })

  it('does not trigger when stageCounts not provided (backward-compatible)', () => {
    const items = [
      makePipelineItem({ id: 'i1', stage: 'idea' }),
    ]
    const result = selectSuggestion({
      pipelineItems: items,
      playlists: [],
      newsletterEditions: [],
      // No stageCounts → no WIP violation check
    })
    // Should fall through to other finders (no batch since only 1 item)
    expect(result).toBeNull()
  })
})

describe('findBufferGap', () => {
  it('suggests when a work group has 0 items', () => {
    // escrever has items, gravar empty, pos-prod empty
    const result = selectSuggestion({
      pipelineItems: [makePipelineItem({ id: 'i1', stage: 'idea' })],
      playlists: [],
      newsletterEditions: [],
      stageCounts: { escrever: 3, gravar: 0, 'pos-prod': 0, prontos: 0 },
    })
    // Should suggest filling the gap
    expect(result).not.toBeNull()
    expect(result!.text).toContain('gravar')
  })

  it('does not trigger when all groups have items', () => {
    const items = [
      makePipelineItem({ id: 'i1', stage: 'idea' }),
      makePipelineItem({ id: 'i2', stage: 'gravacao' }),
      makePipelineItem({ id: 'i3', stage: 'edicao' }),
    ]
    const result = selectSuggestion({
      pipelineItems: items,
      playlists: [],
      newsletterEditions: [],
      stageCounts: { escrever: 1, gravar: 1, 'pos-prod': 1, prontos: 0 },
    })
    // Buffer gap only fires when gravar or pos-prod is 0 — prontos doesn't count
    expect(result).toBeNull()
  })

  it('has lowest priority (after playlist suggestion)', () => {
    const playlists = [
      makePlaylist({ id: 'pl-1', name: 'My Playlist', total_items: 10, done_items: 9 }),
    ]
    const result = selectSuggestion({
      pipelineItems: [],
      playlists,
      newsletterEditions: [],
      stageCounts: { escrever: 0, gravar: 0, 'pos-prod': 0, prontos: 0 },
    })
    // Playlist suggestion should win over buffer gap
    expect(result!.text).toContain('My Playlist')
  })

  it('does not trigger for prontos group gap', () => {
    // prontos = 0, but that's fine — it's not a production bottleneck
    const result = selectSuggestion({
      pipelineItems: [
        makePipelineItem({ id: 'i1', stage: 'idea' }),
        makePipelineItem({ id: 'i2', stage: 'gravacao' }),
        makePipelineItem({ id: 'i3', stage: 'edicao' }),
      ],
      playlists: [],
      newsletterEditions: [],
      stageCounts: { escrever: 1, gravar: 1, 'pos-prod': 1, prontos: 0 },
    })
    expect(result).toBeNull()
  })

  it('does not trigger when stageCounts not provided (backward-compatible)', () => {
    const result = selectSuggestion({
      pipelineItems: [],
      playlists: [],
      newsletterEditions: [],
    })
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests (RED)**

```bash
npm run test:web -- --run apps/web/test/cms/select-suggestion.test.ts
```

New tests fail (SuggestionInput doesn't have stageCounts).

- [ ] **Step 3: Implement new finders**

Modify `apps/web/src/lib/pipeline/select-suggestion.ts`:

Add import at top:

```typescript
import { DEFAULT_WIP_LIMITS } from './up-next-constants'
```

Extend `SuggestionInput` interface:

```typescript
interface SuggestionInput {
  pipelineItems: PipelineItemWithSlot[]
  playlists: PlaylistSummary[]
  newsletterEditions: NewsletterEditionRow[]
  stageCounts?: Record<string, number>
  wipLimits?: Record<string, number>
}
```

Add `findWipViolation` function:

```typescript
function findWipViolation(
  stageCounts: Record<string, number> | undefined,
  wipLimits: Record<string, number> = DEFAULT_WIP_LIMITS,
): Suggestion | null {
  if (!stageCounts) return null

  // Find the most exceeded group
  let worstGroup: string | null = null
  let worstExcess = 0

  for (const [group, limit] of Object.entries(wipLimits)) {
    const count = stageCounts[group] ?? 0
    const excess = count - limit
    if (excess > 0 && excess > worstExcess) {
      worstGroup = group
      worstExcess = excess
    }
  }

  if (!worstGroup) return null

  const count = stageCounts[worstGroup] ?? 0
  const limit = wipLimits[worstGroup] ?? 0
  return {
    text: `${worstGroup} acima do limite: ${count}/${limit}. Avançar itens antes de criar novos.`,
    href: `/cms/pipeline?group=${worstGroup}`,
  }
}
```

Add `findBufferGap` function:

```typescript
const BUFFER_GROUPS = ['gravar', 'pos-prod'] // only production groups, not escrever/prontos

function findBufferGap(stageCounts: Record<string, number> | undefined): Suggestion | null {
  if (!stageCounts) return null

  for (const group of BUFFER_GROUPS) {
    if ((stageCounts[group] ?? 0) === 0) {
      return {
        text: `Nenhum item em ${group}. Avançar itens de escrita para manter o fluxo.`,
        href: `/cms/pipeline?group=${group}`,
      }
    }
  }

  return null
}
```

Update the `selectSuggestion` function chain:

```typescript
export function selectSuggestion(input: SuggestionInput): Suggestion | null {
  const { pipelineItems, playlists, newsletterEditions, stageCounts, wipLimits } = input

  return (
    findWipViolation(stageCounts, wipLimits) ??
    findOrphanedItems(pipelineItems) ??
    findBatchOpportunity(pipelineItems) ??
    findNewsletterWithoutDate(newsletterEditions) ??
    findNearlyCompletePlaylist(playlists) ??
    findBufferGap(stageCounts) ??
    null
  )
}
```

- [ ] **Step 4: Run tests (GREEN)**

```bash
npm run test:web -- --run apps/web/test/cms/select-suggestion.test.ts
```

All tests should pass — old tests unaffected because `stageCounts` is optional.

- [ ] **Step 5: Fix any broken existing tests**

The reordering (orphaned before batch) changes the priority test at line 131-146. Update the test expectation:

The existing test "respects priority order: batch > orphan > newsletter > playlist" has items that trigger both batch AND orphan. With the new order (WIP violation > orphaned > batch), orphaned now wins over batch. Update:

```typescript
  it('respects priority order: wip > orphan > batch > newsletter > playlist', () => {
    const items = [
      makePipelineItem({ id: 'item-1', stage: 'idea', format: 'video', youtube_channel_id: null }),
      makePipelineItem({ id: 'item-2', stage: 'idea', format: 'video', youtube_channel_id: null }),
    ]
    const editions = [makeNewsletter({ status: 'draft', scheduled_at: null })]
    const playlists = [makePlaylist({ total_items: 10, done_items: 9 })]

    const result = selectSuggestion({
      pipelineItems: items,
      playlists,
      newsletterEditions: editions,
    })
    expect(result).not.toBeNull()
    // orphaned now has higher priority than batch
    expect(result!.text).toContain('sem canal')
  })
```

**Important:** Check the test carefully. With 2 items at stage 'idea', batch fires (2 >= 2). But orphaned also fires (2 video items without channel). With the new order orphaned > batch, orphaned wins. Update the test name and expectation accordingly.

- [ ] **Step 6: Run full test suite**

```bash
npm run test:web -- --run apps/web/test/cms/select-suggestion.test.ts
```

**Commit:** `feat(pipeline): add findWipViolation + findBufferGap suggestion finders (TDD)`

---

### Task 11: Wire Enhanced Suggestions in Fetcher

**Files:**
- Modify: `apps/web/src/lib/pipeline/up-next-fetcher.ts`

**Context:** The fetcher already computes `stageCounts` at line 175-178 and calls `selectSuggestion` at line 214-219. We pass `stageCounts` to `selectSuggestion` so the new finders can use it.

- [ ] **Step 1: Pass stageCounts to selectSuggestion**

In `apps/web/src/lib/pipeline/up-next-fetcher.ts`, change line 216 from:

```typescript
    suggestion = selectSuggestion({ pipelineItems, playlists, newsletterEditions })
```

to:

```typescript
    suggestion = selectSuggestion({ pipelineItems, playlists, newsletterEditions, stageCounts })
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

- [ ] **Step 3: Run all tests**

```bash
npm run test:web -- --run apps/web/test/cms/
```

**Commit:** `feat(pipeline): wire stageCounts into selectSuggestion`

---

### Task 12: Final Verification

- [ ] **Step 1: Run full web test suite**

```bash
npm run test:web
```

- [ ] **Step 2: Build packages (if any workspace packages changed)**

```bash
npm run build:packages
```

- [ ] **Step 3: Full Next.js build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 4: Verify no type errors**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

**Commit:** No commit needed — verification only.

---

## Summary

| Task | Type | Files | Estimated Effort |
|------|------|-------|-----------------|
| 1 | Migration | 1 new | 10 min |
| 2 | Types | 1 modified | 10 min |
| 3 | Pure function (TDD) | 2 new | 45 min |
| 4 | Cache + fetch | 1 modified | 20 min |
| 5 | Integration (TDD) | 2 modified | 30 min |
| 6 | Constants (TDD) | 1 new + 1 modified | 25 min |
| 7 | UI styling | 1 modified | 20 min |
| 8 | Pure function (TDD) | 2 new | 35 min |
| 9 | UI + wiring | 4 modified | 25 min |
| 10 | Finders (TDD) | 2 modified | 40 min |
| 11 | Fetcher wiring | 1 modified | 10 min |
| 12 | Verification | 0 | 15 min |
| **Total** | | **10 new + 10 modified** | **~4.75 hours** |

## Dependency Graph

```
Task 1 (migration) ──────────────────────┐
Task 2 (types) ──┬── Task 3 (velocity) ──┤
                 │                        ├── Task 4 (fetch) ── Task 5 (deadline integration)
                 │                        │
                 ├── Task 6 (WIP limits) ─┼── Task 7 (WIP pills)
                 │                        │
                 ├── Task 8 (mode) ───────┼── Task 9 (mode UI)
                 │                        │
                 └── Task 10 (finders) ───┴── Task 11 (wire fetcher) ── Task 12 (verify)
```

**Parallelizable:** Tasks 3, 6, 8, 10 are independent pure functions — can be developed in parallel after Task 2.

**Sequential chains:**
- 2 → 3 → 4 → 5 (velocity)
- 2 → 6 → 7 (WIP pills)
- 2 → 8 → 9 (mode inference)
- 2 → 10 → 11 (suggestions)
- All → 12 (final verification)
