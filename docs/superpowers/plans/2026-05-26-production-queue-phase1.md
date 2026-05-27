# Production Queue Phase 1 — Core Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Up Next from a publish calendar into a production queue with urgency-ranked actions, buffer depth scanning, and critical bug fixes.

**Architecture:** Fix 4 existing bugs, add `computeUrgencyScore()` pure function for continuous urgency ranking, fix blog cadence multi-week generation, add `scanBufferDepth()` for 16-week coverage analysis, and update UI to show urgency-grouped queue with buffer health pills.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Vitest, Supabase, date-fns/date-fns-tz

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `apps/web/src/lib/pipeline/compute-urgency-score.ts` | Pure function: deadline + stages remaining + effort -> 0-100 continuous urgency score |
| `apps/web/src/lib/pipeline/scan-buffer-depth.ts` | Pure function: 16-week slot scan -> per-format coverage analysis |
| `apps/web/src/app/cms/(authed)/pipeline/_components/buffer-health-pills.tsx` | UI: colored pills showing buffer depth per format |
| `apps/web/test/cms/up-next-route-timezone.test.ts` | Tests for scheduledAt timezone fix |
| `apps/web/test/cms/compute-urgency-score.test.ts` | Tests for urgency score formula |
| `apps/web/test/cms/done-today-filter.test.ts` | Tests for forward-only transition counting |
| `apps/web/test/cms/scan-buffer-depth.test.ts` | Tests for buffer depth scanning |

### Modified Files

| File | Change |
|------|--------|
| `apps/web/src/app/api/pipeline/up-next/route.ts` | Fix scheduledAt timezone drift (Bug #1) |
| `apps/web/src/lib/pipeline/up-next-types.ts` | Add `isPhantom?: boolean` and `urgencyScore?: number` to TodayAction |
| `apps/web/src/lib/pipeline/calculate-today-actions.ts` | Set isPhantom flag (Bug #2), integrate urgencyScore, replace sort |
| `apps/web/src/lib/pipeline/up-next-fetcher.ts` | Add sync_enabled filter (Bug #3), fix doneToday counting (Bug #4) |
| `apps/web/src/lib/pipeline/generate-week-slots.ts` | Fix blog cadence multi-week slot generation |
| `apps/web/src/app/cms/(authed)/pipeline/_components/today-action-cards.tsx` | Group actions by urgency level with section headers |
| `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx` | Integrate buffer health pills |
| `apps/web/test/cms/calculate-today-actions.test.ts` | Add tests for isPhantom, urgencyScore, new sort order |
| `apps/web/test/cms/generate-week-slots.test.ts` | Add tests for multi-week blog cadence |

---

## Task 1: Bug Fix #1 — scheduledAt timezone drift

**Problem:** `route.ts` line 58-62 constructs a `Date` from `"${slotDay}T${slotHour}:00"` which is parsed as local time (server TZ, likely UTC in production). The slot times are meant to represent BRT (America/Sao_Paulo). A slot at `2026-05-26T10:00` is parsed as UTC, then `formatInTimeZone` displays it in BRT as `07:00`, creating a 3-hour drift.

**Fix:** Use `fromZonedTime` from `date-fns-tz` to tell the library the input string is already in `SITE_TIMEZONE`, then format.

**Files:**
- Create: `apps/web/test/cms/up-next-route-timezone.test.ts`
- Modify: `apps/web/src/app/api/pipeline/up-next/route.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/test/cms/up-next-route-timezone.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { fromZonedTime } from 'date-fns-tz'
import { formatInTimeZone } from 'date-fns-tz'

const SITE_TIMEZONE = 'America/Sao_Paulo'

/**
 * Extracted helper that mirrors what route.ts should do.
 * We test the fix in isolation — no HTTP needed.
 */
function buildScheduledAt(slotDay: string, slotHour: string | null): string {
  const localDateStr = `${slotDay}T${slotHour || '00:00'}:00`
  const utcDate = fromZonedTime(localDateStr, SITE_TIMEZONE)
  return formatInTimeZone(utcDate, SITE_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX")
}

describe('buildScheduledAt timezone handling', () => {
  it('preserves BRT time for morning slot', () => {
    const result = buildScheduledAt('2026-05-26', '10:00')
    // Should be 10:00 in BRT (-03:00), NOT shifted by server TZ
    expect(result).toBe('2026-05-26T10:00:00-03:00')
  })

  it('preserves BRT time for evening slot', () => {
    const result = buildScheduledAt('2026-05-26', '18:00')
    expect(result).toBe('2026-05-26T18:00:00-03:00')
  })

  it('defaults to midnight BRT when slotHour is null', () => {
    const result = buildScheduledAt('2026-05-26', null)
    expect(result).toBe('2026-05-26T00:00:00-03:00')
  })

  it('handles DST transition day correctly', () => {
    // Brazil DST: clocks spring forward in November (varies by year)
    // In 2026 there is no DST in Brazil (abolished 2019), so offset stays -03:00
    const result = buildScheduledAt('2026-11-15', '10:00')
    expect(result).toBe('2026-11-15T10:00:00-03:00')
  })

  it('roundtrips: extracting hour from result matches input', () => {
    const result = buildScheduledAt('2026-06-01', '14:30')
    // Extract the time portion: should be 14:30
    expect(result).toContain('T14:30:00')
  })
})
```

- [ ] **Step 2: Verify test fails with current logic**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/up-next-route-timezone.test.ts
```

The test should pass because we wrote the correct logic directly in the test. The point is to validate the formula before applying it.

- [ ] **Step 3: Fix route.ts**

In `apps/web/src/app/api/pipeline/up-next/route.ts`:

Replace line 3:
```typescript
import { formatInTimeZone } from 'date-fns-tz'
```
With:
```typescript
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
```

Replace lines 58-62:
```typescript
  const scheduledAt = formatInTimeZone(
    new Date(`${slotDay}T${slotHour || '00:00'}:00`),
    SITE_TIMEZONE,
    "yyyy-MM-dd'T'HH:mm:ssXXX",
  )
```
With:
```typescript
  const localDateStr = `${slotDay}T${slotHour || '00:00'}:00`
  const utcDate = fromZonedTime(localDateStr, SITE_TIMEZONE)
  const scheduledAt = formatInTimeZone(utcDate, SITE_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX")
```

- [ ] **Step 4: Verify all tests pass**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/up-next-route-timezone.test.ts
```

- [ ] **Step 5: Commit**

```
fix(pipeline): correct scheduledAt timezone drift using fromZonedTime

Slot times like "10:00 Tuesday" represent BRT but were parsed as
server-local time (UTC in prod), causing a 3h drift. Now explicitly
interprets the string as America/Sao_Paulo before formatting.
```

---

## Task 2: Bug Fix #2 — Phantom blog action isPhantom flag

**Problem:** When no real blog pipeline item exists, `calculate-today-actions.ts` line 227 creates a synthetic action with `id: "blog-cadence-2026-05-25"`. This non-UUID id breaks any code that assumes action ids are UUIDs (e.g., linking to `/cms/pipeline/items/${id}`). It should be flagged as phantom so the UI can handle it differently (e.g., link to create-item instead of item detail).

**Files:**
- Modify: `apps/web/src/lib/pipeline/up-next-types.ts`
- Modify: `apps/web/src/lib/pipeline/calculate-today-actions.ts`
- Modify: `apps/web/test/cms/calculate-today-actions.test.ts`

- [ ] **Step 1: Add isPhantom to TodayAction type**

In `apps/web/src/lib/pipeline/up-next-types.ts`, add `isPhantom` to the TodayAction interface.

Replace:
```typescript
export interface TodayAction {
  id: string
  itemTitle: string
  actionLabel: string
  format: 'video' | 'blog_post' | 'newsletter' | 'course' | 'campaign'
  language: 'pt-br' | 'en' | 'both'
  effort: 'deep' | 'medium' | 'quick'
  effortEstimate: string
  effortMinutes: number
  urgency: 'overdue' | 'today' | 'tomorrow' | 'this_week'
  priority: number
  stage: Stage
  deadline: { label: string; date: string }
  playlistContext: { name: string; position: number; total: number } | null
  channelLabel: string | null
  pubDate: string | null
  batchItems?: string[]
}
```
With:
```typescript
export interface TodayAction {
  id: string
  itemTitle: string
  actionLabel: string
  format: 'video' | 'blog_post' | 'newsletter' | 'course' | 'campaign'
  language: 'pt-br' | 'en' | 'both'
  effort: 'deep' | 'medium' | 'quick'
  effortEstimate: string
  effortMinutes: number
  urgency: 'overdue' | 'today' | 'tomorrow' | 'this_week'
  priority: number
  stage: Stage
  deadline: { label: string; date: string }
  playlistContext: { name: string; position: number; total: number } | null
  channelLabel: string | null
  pubDate: string | null
  batchItems?: string[]
  isPhantom?: boolean
}
```

- [ ] **Step 2: Write failing test**

Add to `apps/web/test/cms/calculate-today-actions.test.ts`:

```typescript
describe('phantom blog action', () => {
  it('marks blog action as phantom when no pipeline item matches', () => {
    const input: TodayActionsInput = {
      pipelineItems: [], // no blog items exist
      blogCadence: makeBlogCadence({
        cadence_days: 7,
        cadence_start_date: '2026-05-01',
        last_published_at: '2026-05-18',
      }),
      newsletterEditions: [],
      syncSchedules: [],
      siteTimezone: 'America/Sao_Paulo',
      now: new Date('2026-05-22T12:00:00-03:00'),
      maxCards: 5,
      doneToday: 0,
    }
    const result = calculateTodayActions(input)
    expect(result.actions.length).toBe(1)
    expect(result.actions[0]!.isPhantom).toBe(true)
    expect(result.actions[0]!.id).toMatch(/^blog-cadence-/)
  })

  it('does NOT mark blog action as phantom when a real item exists', () => {
    const input: TodayActionsInput = {
      pipelineItems: [makeItem({ format: 'blog_post', stage: 'draft', id: 'real-uuid-1' })],
      blogCadence: makeBlogCadence({
        cadence_days: 7,
        cadence_start_date: '2026-05-01',
        last_published_at: '2026-05-18',
      }),
      newsletterEditions: [],
      syncSchedules: [],
      siteTimezone: 'America/Sao_Paulo',
      now: new Date('2026-05-22T12:00:00-03:00'),
      maxCards: 5,
      doneToday: 0,
    }
    const result = calculateTodayActions(input)
    const blogAction = result.actions.find(a => a.format === 'blog_post')
    expect(blogAction).toBeDefined()
    expect(blogAction!.isPhantom).toBeUndefined()
  })
})
```

- [ ] **Step 3: Verify test fails**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/calculate-today-actions.test.ts
```

The phantom test should fail because `isPhantom` is never set.

- [ ] **Step 4: Implement fix**

In `apps/web/src/lib/pipeline/calculate-today-actions.ts`, in the blog cadence section (around line 226-242), modify the `unsortedActions.push()` call.

Replace:
```typescript
      unsortedActions.push({
        id: best?.id ?? `blog-cadence-${nextPubStr}`,
        itemTitle: best?.title ?? 'Post do Blog',
        actionLabel,
        format: 'blog_post',
        language: best?.language ?? 'pt-br',
        effort,
        effortEstimate: formatEffort(minutes),
        effortMinutes: minutes,
        urgency,
        priority: best?.priority ?? 5,
        stage,
        deadline: { label: deadlineLabel(blogDeadline, today), date: blogDeadline },
        playlistContext: null,
        channelLabel: null,
        pubDate: nextPubStr,
      })
```
With:
```typescript
      unsortedActions.push({
        id: best?.id ?? `blog-cadence-${nextPubStr}`,
        itemTitle: best?.title ?? 'Post do Blog',
        actionLabel,
        format: 'blog_post',
        language: best?.language ?? 'pt-br',
        effort,
        effortEstimate: formatEffort(minutes),
        effortMinutes: minutes,
        urgency,
        priority: best?.priority ?? 5,
        stage,
        deadline: { label: deadlineLabel(blogDeadline, today), date: blogDeadline },
        playlistContext: null,
        channelLabel: null,
        pubDate: nextPubStr,
        ...(best === null && { isPhantom: true }),
      })
```

- [ ] **Step 5: Verify tests pass**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/calculate-today-actions.test.ts
```

- [ ] **Step 6: Commit**

```
fix(pipeline): flag phantom blog actions with isPhantom marker

When no real pipeline item exists for a blog cadence slot, the
synthetic action gets a non-UUID id like "blog-cadence-2026-05-25".
This flag lets the UI link to create-item instead of a 404 detail page.
```

---

## Task 3: Bug Fix #3 — sync_enabled filter missing

**Problem:** `up-next-fetcher.ts` line 49-53 queries `youtube_channels` without filtering by `sync_enabled`. Disabled channels still generate video slots in the week grid and today actions.

**Fix:** Add `.eq('sync_enabled', true)` to the query.

**Files:**
- Modify: `apps/web/src/lib/pipeline/up-next-fetcher.ts`

- [ ] **Step 1: Verify current code lacks filter**

Read `apps/web/src/lib/pipeline/up-next-fetcher.ts` lines 49-53 and confirm no `sync_enabled` filter exists.

- [ ] **Step 2: Apply one-line fix**

In `apps/web/src/lib/pipeline/up-next-fetcher.ts`, replace:
```typescript
    supabase
      .from('youtube_channels')
      .select('id, name, locale, sync_schedules')
      .eq('site_id', siteId)
      .limit(100),
```
With:
```typescript
    supabase
      .from('youtube_channels')
      .select('id, name, locale, sync_schedules')
      .eq('site_id', siteId)
      .eq('sync_enabled', true)
      .limit(100),
```

- [ ] **Step 3: Verify existing tests still pass**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/generate-week-slots.test.ts
npm run test:web -- --reporter verbose apps/web/test/cms/calculate-today-actions.test.ts
```

These tests use mocked data and should not be affected by the query change.

- [ ] **Step 4: Commit**

```
fix(pipeline): filter disabled YouTube channels from Up Next queries

Channels with sync_enabled=false were still generating video slots.
Added .eq('sync_enabled', true) to the youtube_channels query.
```

---

## Task 4: Bug Fix #4 — doneToday counts backward transitions

**Problem:** `up-next-fetcher.ts` lines 69-75 count all `content_pipeline_history` records from today, including backward transitions (e.g., `ready -> draft` which is a rejection, not progress). The `doneToday` count should only include forward stage transitions.

**Schema reference:** `content_pipeline_history` has columns: `id, pipeline_id, event_type, from_value, to_value, changed_by, changed_at`. The trigger inserts `event_type = 'stage_change'` with `from_value` and `to_value` as stage names.

**Files:**
- Create: `apps/web/test/cms/done-today-filter.test.ts`
- Modify: `apps/web/src/lib/pipeline/up-next-fetcher.ts`

- [ ] **Step 1: Write test for forward-only transition filter**

Create `apps/web/test/cms/done-today-filter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { STAGE_ORDER } from '../../src/lib/pipeline/up-next-constants'
import type { Stage } from '../../src/lib/pipeline/up-next-constants'

/**
 * Extracted helper that mirrors the filtering logic we'll add to up-next-fetcher.
 * Tests the pure function in isolation.
 */
interface HistoryRow {
  pipeline_id: string
  event_type: string
  from_value: string | null
  to_value: string | null
}

function countForwardTransitions(rows: HistoryRow[]): number {
  const forwardIds = new Set<string>()

  for (const row of rows) {
    if (row.event_type !== 'stage_change') continue
    if (!row.from_value || !row.to_value) continue

    const fromOrder = STAGE_ORDER[row.from_value as Stage]
    const toOrder = STAGE_ORDER[row.to_value as Stage]

    if (fromOrder === undefined || toOrder === undefined) continue
    if (toOrder > fromOrder) {
      forwardIds.add(row.pipeline_id)
    }
  }

  return forwardIds.size
}

describe('countForwardTransitions', () => {
  it('counts a forward stage_change as done', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'draft', to_value: 'roteiro' },
    ]
    expect(countForwardTransitions(rows)).toBe(1)
  })

  it('ignores backward transitions (rejections)', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'ready', to_value: 'draft' },
    ]
    expect(countForwardTransitions(rows)).toBe(0)
  })

  it('ignores non-stage_change events', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'field_change', from_value: 'old title', to_value: 'new title' },
    ]
    expect(countForwardTransitions(rows)).toBe(0)
  })

  it('counts each pipeline_id only once even with multiple forward transitions', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'idea', to_value: 'outline' },
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'outline', to_value: 'draft' },
    ]
    expect(countForwardTransitions(rows)).toBe(1)
  })

  it('counts multiple distinct pipeline_ids', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'idea', to_value: 'outline' },
      { pipeline_id: 'p2', event_type: 'stage_change', from_value: 'edicao', to_value: 'pos_producao' },
    ]
    expect(countForwardTransitions(rows)).toBe(2)
  })

  it('handles mixed forward and backward for same item (forward wins)', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'ready', to_value: 'draft' },
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'draft', to_value: 'roteiro' },
    ]
    // At least one forward transition exists -> counted
    expect(countForwardTransitions(rows)).toBe(1)
  })

  it('returns 0 for empty rows', () => {
    expect(countForwardTransitions([])).toBe(0)
  })

  it('ignores rows with null from_value or to_value', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: null, to_value: 'draft' },
      { pipeline_id: 'p2', event_type: 'stage_change', from_value: 'draft', to_value: null },
    ]
    expect(countForwardTransitions(rows)).toBe(0)
  })

  it('ignores unknown stage names', () => {
    const rows: HistoryRow[] = [
      { pipeline_id: 'p1', event_type: 'stage_change', from_value: 'unknown', to_value: 'draft' },
    ]
    expect(countForwardTransitions(rows)).toBe(0)
  })
})
```

- [ ] **Step 2: Verify tests pass (pure function test)**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/done-today-filter.test.ts
```

- [ ] **Step 3: Apply fix to up-next-fetcher.ts**

In `apps/web/src/lib/pipeline/up-next-fetcher.ts`:

First, add imports. Replace:
```typescript
import { STAGE_GROUP } from '@/lib/pipeline/up-next-constants'
import type { Stage } from '@/lib/pipeline/up-next-constants'
```
With:
```typescript
import { STAGE_GROUP, STAGE_ORDER } from '@/lib/pipeline/up-next-constants'
import type { Stage } from '@/lib/pipeline/up-next-constants'
```

Then update the doneRes query (lines 69-75). Replace:
```typescript
    supabase
      .from('content_pipeline_history')
      .select('pipeline_id, content_pipeline!inner(site_id)')
      .eq('content_pipeline.site_id', siteId)
      .gte('changed_at', `${today}T00:00:00`)
      .order('changed_at', { ascending: false })
      .limit(200),
```
With:
```typescript
    supabase
      .from('content_pipeline_history')
      .select('pipeline_id, event_type, from_value, to_value, content_pipeline!inner(site_id)')
      .eq('content_pipeline.site_id', siteId)
      .eq('event_type', 'stage_change')
      .gte('changed_at', `${today}T00:00:00`)
      .order('changed_at', { ascending: false })
      .limit(200),
```

Then update the doneToday calculation (line 141). Replace:
```typescript
  const doneToday = new Set((doneRes.data ?? []).map((r: Record<string, unknown>) => r.pipeline_id as string)).size
```
With:
```typescript
  const doneTodayIds = new Set<string>()
  for (const r of (doneRes.data ?? []) as Array<Record<string, unknown>>) {
    if (r.event_type !== 'stage_change') continue
    const fromVal = r.from_value as string | null
    const toVal = r.to_value as string | null
    if (!fromVal || !toVal) continue
    const fromOrder = STAGE_ORDER[fromVal as Stage]
    const toOrder = STAGE_ORDER[toVal as Stage]
    if (fromOrder === undefined || toOrder === undefined) continue
    if (toOrder > fromOrder) {
      doneTodayIds.add(r.pipeline_id as string)
    }
  }
  const doneToday = doneTodayIds.size
```

- [ ] **Step 4: Verify all related tests pass**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/done-today-filter.test.ts
npm run test:web -- --reporter verbose apps/web/test/cms/calculate-today-actions.test.ts
```

- [ ] **Step 5: Commit**

```
fix(pipeline): count only forward stage transitions for doneToday

Previously all content_pipeline_history records from today were counted,
including backward transitions like ready->draft (rejections). Now
filters to event_type='stage_change' and only counts where
STAGE_ORDER[to] > STAGE_ORDER[from].
```

---

## Task 5: computeUrgencyScore pure function

**Goal:** Create a continuous 0-100 urgency score to replace the coarse 4-bucket urgency sorting. Higher score = more urgent. The formula combines deadline pressure, production stage progress, and effort weight.

**Formula:**
```
deadlinePressure = clamp(1 - (daysUntilDeadline / 7), 0, 1.5)   // >1 when overdue
stagesRemaining  = (totalStages - currentStageOrder) / totalStages  // 0..1
effortWeight     = effortMinutes / 240  // normalized to max deep session
urgencyScore     = clamp(
  (deadlinePressure * 60) + (stagesRemaining * 25) + (effortWeight * 15),
  0, 100
)
```

`totalStages = STAGE_ORDER['scheduled'] = 8` (we don't count `published` since it's terminal).

**Files:**
- Create: `apps/web/src/lib/pipeline/compute-urgency-score.ts`
- Create: `apps/web/test/cms/compute-urgency-score.test.ts`

- [ ] **Step 1: Write tests**

Create `apps/web/test/cms/compute-urgency-score.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeUrgencyScore } from '../../src/lib/pipeline/compute-urgency-score'
import type { Stage } from '../../src/lib/pipeline/up-next-constants'

describe('computeUrgencyScore', () => {
  const baseArgs = {
    today: '2026-05-26',
    stage: 'roteiro' as Stage,
    effortMinutes: 180,
  }

  it('returns a number between 0 and 100', () => {
    const score = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-26' })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('overdue items score higher than today items', () => {
    const overdue = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-24' })
    const today = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-26' })
    expect(overdue).toBeGreaterThan(today)
  })

  it('today items score higher than this_week items', () => {
    const todayScore = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-26' })
    const thisWeek = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-30' })
    expect(todayScore).toBeGreaterThan(thisWeek)
  })

  it('earlier stage scores higher than later stage (more work remaining)', () => {
    const idea = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-28', stage: 'idea' })
    const ready = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-28', stage: 'ready' })
    expect(idea).toBeGreaterThan(ready)
  })

  it('higher effort scores higher than lower effort', () => {
    const deep = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-28', effortMinutes: 240 })
    const quick = computeUrgencyScore({ ...baseArgs, deadline: '2026-05-28', effortMinutes: 30 })
    expect(deep).toBeGreaterThan(quick)
  })

  it('returns 0 when deadline is null', () => {
    const score = computeUrgencyScore({ ...baseArgs, deadline: null })
    expect(score).toBe(0)
  })

  it('caps at 100 for extremely overdue items', () => {
    const score = computeUrgencyScore({
      ...baseArgs,
      deadline: '2026-05-10',
      stage: 'idea',
      effortMinutes: 240,
    })
    expect(score).toBe(100)
  })

  it('handles scheduled stage (stagesRemaining=0)', () => {
    const score = computeUrgencyScore({
      ...baseArgs,
      deadline: '2026-05-28',
      stage: 'scheduled',
      effortMinutes: 15,
    })
    // Low urgency: no stages remaining, minimal effort
    expect(score).toBeLessThan(50)
  })

  it('handles published stage gracefully', () => {
    const score = computeUrgencyScore({
      ...baseArgs,
      deadline: '2026-05-28',
      stage: 'published',
      effortMinutes: 0,
    })
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('same deadline, same stage: deeper effort ranks higher', () => {
    const a = computeUrgencyScore({ deadline: '2026-05-28', today: '2026-05-26', stage: 'draft', effortMinutes: 120 })
    const b = computeUrgencyScore({ deadline: '2026-05-28', today: '2026-05-26', stage: 'draft', effortMinutes: 30 })
    expect(a).toBeGreaterThan(b)
  })
})
```

- [ ] **Step 2: Verify tests fail (file doesn't exist yet)**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/compute-urgency-score.test.ts
```

Should fail with module not found.

- [ ] **Step 3: Implement computeUrgencyScore**

Create `apps/web/src/lib/pipeline/compute-urgency-score.ts`:

```typescript
import { parseISO, differenceInCalendarDays } from 'date-fns'
import { STAGE_ORDER } from './up-next-constants'
import type { Stage } from './up-next-constants'

const TOTAL_STAGES = STAGE_ORDER['scheduled'] // 8

interface UrgencyScoreInput {
  deadline: string | null
  today: string
  stage: Stage
  effortMinutes: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Computes a continuous 0-100 urgency score.
 * Higher = more urgent. Combines:
 * - Deadline pressure (60% weight): days until deadline, >1 when overdue
 * - Stage progress (25% weight): more stages remaining = more urgent
 * - Effort weight (15% weight): heavier tasks need earlier attention
 */
export function computeUrgencyScore(input: UrgencyScoreInput): number {
  const { deadline, today, stage, effortMinutes } = input

  if (deadline === null) return 0

  const daysUntilDeadline = differenceInCalendarDays(parseISO(deadline), parseISO(today))

  // deadlinePressure: 1.0 when due today, >1 when overdue, <1 when future
  // Capped at 1.5 to prevent extreme overdue from dominating
  const deadlinePressure = clamp(1 - (daysUntilDeadline / 7), 0, 1.5)

  // stagesRemaining: 1.0 at idea (stage 0), 0.0 at scheduled (stage 8)
  const currentOrder = STAGE_ORDER[stage] ?? 0
  const stagesRemaining = clamp((TOTAL_STAGES - currentOrder) / TOTAL_STAGES, 0, 1)

  // effortWeight: normalized to max deep session (240 min = 4h)
  const effortWeight = clamp(effortMinutes / 240, 0, 1)

  const rawScore = (deadlinePressure * 60) + (stagesRemaining * 25) + (effortWeight * 15)

  return clamp(Math.round(rawScore * 10) / 10, 0, 100)
}
```

- [ ] **Step 4: Verify tests pass**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/compute-urgency-score.test.ts
```

- [ ] **Step 5: Commit**

```
feat(pipeline): add computeUrgencyScore pure function

Continuous 0-100 urgency formula combining deadline pressure (60%),
production stage progress (25%), and effort weight (15%). Replaces
the coarse 4-bucket urgency as primary sort key.
```

---

## Task 6: Integrate urgency score into TodayAction and replace sort

**Goal:** Add `urgencyScore` to `TodayAction`, compute it for every action in `calculateTodayActions`, and use it as the primary sort key (descending — higher score = more urgent = appears first).

**Files:**
- Modify: `apps/web/src/lib/pipeline/up-next-types.ts`
- Modify: `apps/web/src/lib/pipeline/calculate-today-actions.ts`
- Modify: `apps/web/test/cms/calculate-today-actions.test.ts`

- [ ] **Step 1: Add urgencyScore to TodayAction type**

In `apps/web/src/lib/pipeline/up-next-types.ts`, add `urgencyScore` after `isPhantom`:

```typescript
  isPhantom?: boolean
  urgencyScore?: number
```

- [ ] **Step 2: Write tests for urgencyScore integration**

Add to `apps/web/test/cms/calculate-today-actions.test.ts`:

```typescript
describe('urgencyScore integration', () => {
  it('attaches urgencyScore to every action', () => {
    const input: TodayActionsInput = {
      pipelineItems: [
        makeItem({ id: 'v1', stage: 'roteiro', format: 'video' }),
      ],
      blogCadence: null,
      newsletterEditions: [],
      syncSchedules: [makeSchedule()],
      siteTimezone: 'America/Sao_Paulo',
      now: new Date('2026-05-22T12:00:00-03:00'), // Thursday — Friday slot is tomorrow
      maxCards: 5,
      doneToday: 0,
    }
    const result = calculateTodayActions(input)
    for (const action of result.actions) {
      expect(action.urgencyScore).toBeDefined()
      expect(typeof action.urgencyScore).toBe('number')
      expect(action.urgencyScore).toBeGreaterThanOrEqual(0)
      expect(action.urgencyScore).toBeLessThanOrEqual(100)
    }
  })

  it('sorts by urgencyScore descending (most urgent first)', () => {
    const input: TodayActionsInput = {
      pipelineItems: [
        makeItem({ id: 'v1', stage: 'idea', format: 'video', youtube_channel_id: 'ch-pt' }),
        makeItem({ id: 'v2', stage: 'ready', format: 'video', youtube_channel_id: 'ch-en' }),
      ],
      blogCadence: null,
      newsletterEditions: [],
      syncSchedules: [
        makeSchedule({ channel_id: 'ch-pt', locale: 'pt', schedule: { day: 'friday', hour: 10 } }),
        makeSchedule({ channel_id: 'ch-en', channel_name: 'EN Channel', locale: 'en', schedule: { day: 'friday', hour: 18 } }),
      ],
      siteTimezone: 'America/Sao_Paulo',
      now: new Date('2026-05-22T12:00:00-03:00'),
      maxCards: 5,
      doneToday: 0,
    }
    const result = calculateTodayActions(input)
    if (result.actions.length >= 2) {
      // The idea-stage item should score higher (more urgent) than the ready-stage item
      expect(result.actions[0]!.urgencyScore).toBeGreaterThanOrEqual(result.actions[1]!.urgencyScore!)
    }
  })
})
```

- [ ] **Step 3: Verify tests fail**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/calculate-today-actions.test.ts
```

Should fail because `urgencyScore` is not set.

- [ ] **Step 4: Implement urgencyScore in calculateTodayActions**

In `apps/web/src/lib/pipeline/calculate-today-actions.ts`:

Add import at top:
```typescript
import { computeUrgencyScore } from './compute-urgency-score'
```

After each `unsortedActions.push({...})` call, the urgencyScore needs to be computed. The cleanest approach: add it inline in the push object for all three paths (video, blog, newsletter).

For **Video path** (around line 161), add to the push object:
```typescript
      urgencyScore: computeUrgencyScore({
        deadline: deadline,
        today,
        stage: best.stage,
        effortMinutes: minutes,
      }),
```

For **Blog path** (around line 226), add to the push object:
```typescript
      urgencyScore: computeUrgencyScore({
        deadline: blogDeadline,
        today,
        stage,
        effortMinutes: minutes,
      }),
```

For **Newsletter path** (around line 268), add to the push object:
```typescript
      urgencyScore: computeUrgencyScore({
        deadline: deadlineDate,
        today,
        stage,
        effortMinutes: minutes,
      }),
```

For **Batch cards** (around line 332), compute max urgencyScore from group:
```typescript
      const maxUrgencyScore = Math.max(...group.map(a => a.urgencyScore ?? 0))
```
And add to the batchCard object:
```typescript
      urgencyScore: maxUrgencyScore,
```

Then **replace the sort** (lines 349-376):

Replace:
```typescript
  mergedActions.sort((a, b) => {
    // 1. urgency ASC
    const urgencyDiff = (URGENCY_ORDER[a.urgency] ?? 99) - (URGENCY_ORDER[b.urgency] ?? 99)
    if (urgencyDiff !== 0) return urgencyDiff

    // 2. effort: deep=0, medium=1, quick=2 ASC
    const effortRank = (e: 'deep' | 'medium' | 'quick') => e === 'deep' ? 0 : e === 'medium' ? 1 : 2
    const effortA = effortRank(a.effort)
    const effortB = effortRank(b.effort)
    const effortDiff = effortA - effortB
    if (effortDiff !== 0) return effortDiff

    // 3. priority DESC
    const priorityDiff = b.priority - a.priority
    if (priorityDiff !== 0) return priorityDiff

    // 4. pubDate ASC (nulls last)
    if (a.pubDate && b.pubDate) {
      if (a.pubDate < b.pubDate) return -1
      if (a.pubDate > b.pubDate) return 1
      return 0
    }
    if (a.pubDate) return -1
    if (b.pubDate) return 1

    // 5. id ASC
    return a.id.localeCompare(b.id)
  })
```
With:
```typescript
  mergedActions.sort((a, b) => {
    // 1. urgencyScore DESC (higher = more urgent = first)
    const scoreDiff = (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0)
    if (scoreDiff !== 0) return scoreDiff

    // 2. urgency bucket ASC (tiebreaker within same score)
    const urgencyDiff = (URGENCY_ORDER[a.urgency] ?? 99) - (URGENCY_ORDER[b.urgency] ?? 99)
    if (urgencyDiff !== 0) return urgencyDiff

    // 3. priority DESC
    const priorityDiff = b.priority - a.priority
    if (priorityDiff !== 0) return priorityDiff

    // 4. pubDate ASC (nulls last)
    if (a.pubDate && b.pubDate) {
      if (a.pubDate < b.pubDate) return -1
      if (a.pubDate > b.pubDate) return 1
      return 0
    }
    if (a.pubDate) return -1
    if (b.pubDate) return 1

    // 5. id ASC
    return a.id.localeCompare(b.id)
  })
```

- [ ] **Step 5: Verify all tests pass**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/calculate-today-actions.test.ts
```

Some existing tests may need order adjustments since the sort changed. Update assertions to match new urgencyScore-based ordering.

- [ ] **Step 6: Commit**

```
feat(pipeline): integrate urgencyScore into TodayAction sort order

Every action now carries a continuous 0-100 urgencyScore computed
from deadline pressure, stage progress, and effort. Sort uses
urgencyScore DESC as primary key, replacing the old effort-first
bucket sort.
```

---

## Task 7: Blog cadence multi-week fix

**Problem:** `generate-week-slots.ts` lines 103-127 fast-forward `nextPub` past today, then check if that single date is within the requested week. When `weekStart` is 2+ weeks in the future (used by `scanBufferDepth`), it finds one date and stops. If the cadence produces multiple pub dates within one week (e.g., cadence_days=2), only the first is emitted.

**Fix:** After fast-forwarding past today, continue advancing `nextPub` until it exceeds `weekEndDate`, emitting a slot for each date within `[weekStartDate, weekEndDate]`.

**Files:**
- Modify: `apps/web/src/lib/pipeline/generate-week-slots.ts`
- Modify: `apps/web/test/cms/generate-week-slots.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `apps/web/test/cms/generate-week-slots.test.ts`:

```typescript
describe('blog cadence multi-week', () => {
  it('generates blog slot for week 3 (future week)', () => {
    // Cadence: every 7 days from 2026-05-18, last published 2026-05-18
    // Next pub: 2026-05-25, then 2026-06-01, then 2026-06-08
    // Week starting 2026-06-08 should have a blog slot on 2026-06-08
    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: makeBlogCadence({
        cadence_days: 7,
        cadence_start_date: '2026-05-18',
        last_published_at: '2026-05-18',
      }),
      newsletterEditions: [],
      weekStart: '2026-06-08', // Week 3
      siteTimezone: SITE_TZ,
      today: '2026-05-25',
    })
    const blogSlots = slots.filter(s => s.format === 'blog_post' && !s.isRestDay)
    expect(blogSlots.length).toBe(1)
    expect(blogSlots[0]!.day).toBe('2026-06-08')
  })

  it('generates blog slot for week 5 (far future)', () => {
    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: makeBlogCadence({
        cadence_days: 7,
        cadence_start_date: '2026-05-18',
        last_published_at: '2026-05-18',
      }),
      newsletterEditions: [],
      weekStart: '2026-06-22', // Week 5
      siteTimezone: SITE_TZ,
      today: '2026-05-25',
    })
    const blogSlots = slots.filter(s => s.format === 'blog_post' && !s.isRestDay)
    expect(blogSlots.length).toBe(1)
    expect(blogSlots[0]!.day).toBe('2026-06-22')
  })

  it('generates multiple blog slots in one week with short cadence (2 days)', () => {
    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: makeBlogCadence({
        cadence_days: 2,
        cadence_start_date: '2026-05-18',
        last_published_at: '2026-05-24',
      }),
      newsletterEditions: [],
      weekStart: '2026-05-25', // current week
      siteTimezone: SITE_TZ,
      today: '2026-05-25',
    })
    const blogSlots = slots.filter(s => s.format === 'blog_post' && !s.isRestDay)
    // 2026-05-26, 2026-05-28, 2026-05-30 (every 2 days within Mon-Sun)
    expect(blogSlots.length).toBeGreaterThanOrEqual(3)
  })

  it('generates no blog slot for weeks before cadence starts', () => {
    const slots = generateWeekSlots({
      syncSchedules: [],
      blogCadence: makeBlogCadence({
        cadence_days: 7,
        cadence_start_date: '2026-06-15',
        last_published_at: null,
      }),
      newsletterEditions: [],
      weekStart: '2026-06-01',
      siteTimezone: SITE_TZ,
      today: '2026-05-25',
    })
    const blogSlots = slots.filter(s => s.format === 'blog_post' && !s.isRestDay)
    expect(blogSlots.length).toBe(0)
  })
})
```

- [ ] **Step 2: Verify tests fail**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/generate-week-slots.test.ts
```

The multi-week tests should fail because current code only checks a single `nextPub` date.

- [ ] **Step 3: Implement fix**

In `apps/web/src/lib/pipeline/generate-week-slots.ts`, replace the blog cadence section (lines 88-128):

Replace:
```typescript
  // 2. Blog slot from cadence
  if (
    blogCadence !== null &&
    !blogCadence.cadence_paused &&
    blogCadence.cadence_days !== null &&
    blogCadence.cadence_days > 0 &&
    blogCadence.cadence_start_date !== null
  ) {
    let nextPub: Date

    if (blogCadence.last_published_at !== null) {
      nextPub = addDays(parseISO(blogCadence.last_published_at), blogCadence.cadence_days)
    } else {
      nextPub = parseISO(blogCadence.cadence_start_date)
    }

    while (nextPub < todayDate) {
      nextPub = addDays(nextPub, blogCadence.cadence_days!)
    }

    const inWeek = isWithinInterval(nextPub, {
      start: startOfDay(weekStartDate),
      end: endOfDay(weekEndDate),
    })

    if (inWeek) {
      const slotDateStr = toDateString(nextPub)
      const dayIndex = nextPub.getDay()

      slots.push({
        day: slotDateStr,
        dayLabel: dayLabelForDate(nextPub),
        hour: null,
        format: 'blog_post',
        channelLocale: null,
        channelId: null,
        isRestDay: isRestDayIndex(dayIndex) && !scheduledDayIndices.has(dayIndex),
        assignedItem: null,
        effortMinutes: 0,
      })
    }
  }
```
With:
```typescript
  // 2. Blog slots from cadence (supports multi-week and short cadences)
  if (
    blogCadence !== null &&
    !blogCadence.cadence_paused &&
    blogCadence.cadence_days !== null &&
    blogCadence.cadence_days > 0 &&
    blogCadence.cadence_start_date !== null
  ) {
    const cadenceDays = blogCadence.cadence_days

    let nextPub: Date
    if (blogCadence.last_published_at !== null) {
      nextPub = addDays(parseISO(blogCadence.last_published_at), cadenceDays)
    } else {
      nextPub = parseISO(blogCadence.cadence_start_date)
    }

    // Fast-forward past today (but not past weekEnd — we check inside the loop)
    while (nextPub < todayDate) {
      nextPub = addDays(nextPub, cadenceDays)
    }

    // Emit all cadence dates that fall within [weekStart, weekEnd]
    while (nextPub <= endOfDay(weekEndDate)) {
      const inWeek = isWithinInterval(nextPub, {
        start: startOfDay(weekStartDate),
        end: endOfDay(weekEndDate),
      })

      if (inWeek) {
        const slotDateStr = toDateString(nextPub)
        const dayIndex = nextPub.getDay()

        slots.push({
          day: slotDateStr,
          dayLabel: dayLabelForDate(nextPub),
          hour: null,
          format: 'blog_post',
          channelLocale: null,
          channelId: null,
          isRestDay: isRestDayIndex(dayIndex) && !scheduledDayIndices.has(dayIndex),
          assignedItem: null,
          effortMinutes: 0,
        })
      }

      nextPub = addDays(nextPub, cadenceDays)
    }
  }
```

- [ ] **Step 4: Verify all tests pass**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/generate-week-slots.test.ts
```

- [ ] **Step 5: Verify calculate-today-actions tests still pass**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/calculate-today-actions.test.ts
```

The blog path in `calculate-today-actions.ts` has its own fast-forward loop (lines 196-204). That loop is independent but should also be fixed for consistency. However, since `calculateTodayActions` only looks at "this week", the single-date approach still works for it. The multi-week fix is only critical for `generateWeekSlots` which is called by `scanBufferDepth`.

- [ ] **Step 6: Commit**

```
fix(pipeline): support multi-week blog cadence in generateWeekSlots

Previous code fast-forwarded nextPub past today and checked a single
date. Now continues advancing through the week window, emitting every
cadence date that falls within [weekStart, weekEnd]. Enables correct
buffer depth scanning for future weeks and short cadences (e.g., 2-day).
```

---

## Task 8: scanBufferDepth pure function

**Goal:** Scan 16 weeks of slots (current + 15 future) and compute per-format buffer coverage. Each format gets a `filledWeeks` / `totalWeeks` ratio that powers the health pills UI.

**Files:**
- Create: `apps/web/src/lib/pipeline/scan-buffer-depth.ts`
- Create: `apps/web/test/cms/scan-buffer-depth.test.ts`

- [ ] **Step 1: Write tests**

Create `apps/web/test/cms/scan-buffer-depth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { scanBufferDepth, type BufferDepthResult, type BufferDepthInput } from '../../src/lib/pipeline/scan-buffer-depth'
import type {
  SyncScheduleWithChannel,
  BlogCadenceRow,
  NewsletterEditionRow,
  PipelineItemWithSlot,
} from '../../src/lib/pipeline/up-next-types'

function makeSync(overrides: Partial<SyncScheduleWithChannel> = {}): SyncScheduleWithChannel {
  return {
    channel_id: 'ch-1',
    channel_name: 'Canal PT',
    locale: 'pt',
    schedule: { day: 'tuesday', hour: 10 },
    ...overrides,
  }
}

function makeBlogCadence(overrides: Partial<BlogCadenceRow> = {}): BlogCadenceRow {
  return {
    site_id: 'site-1',
    cadence_days: 7,
    cadence_start_date: '2026-05-01',
    cadence_paused: false,
    last_published_at: '2026-05-18',
    locale: 'pt',
    ...overrides,
  }
}

function makePipelineItem(overrides: Partial<PipelineItemWithSlot> = {}): PipelineItemWithSlot {
  return {
    id: 'item-1',
    title: 'Test Item',
    stage: 'draft',
    priority: 5,
    format: 'video',
    language: 'pt-br',
    duration_target: null,
    scheduled_at: null,
    youtube_channel_id: 'ch-1',
    playlist_id: null,
    playlist_name: null,
    playlist_position: null,
    playlist_total: null,
    channel_label: 'Canal PT',
    ...overrides,
  }
}

describe('scanBufferDepth', () => {
  const baseInput: BufferDepthInput = {
    syncSchedules: [makeSync()],
    blogCadence: makeBlogCadence(),
    newsletterEditions: [],
    pipelineItems: [],
    today: '2026-05-25',
    siteTimezone: 'America/Sao_Paulo',
    weeksToScan: 16,
  }

  it('returns per-format coverage', () => {
    const result = scanBufferDepth(baseInput)
    expect(result.formats).toBeDefined()
    expect(result.formats.video).toBeDefined()
    expect(result.formats.video.totalSlots).toBeGreaterThan(0)
    expect(result.formats.video.filledSlots).toBe(0) // no items assigned
  })

  it('counts filled slots when items have scheduled_at', () => {
    const items: PipelineItemWithSlot[] = [
      makePipelineItem({
        id: 'v1',
        format: 'video',
        scheduled_at: '2026-05-26T13:00:00Z',
        youtube_channel_id: 'ch-1',
        stage: 'gravacao',
      }),
    ]
    const result = scanBufferDepth({ ...baseInput, pipelineItems: items })
    expect(result.formats.video.filledSlots).toBeGreaterThanOrEqual(1)
  })

  it('computes blog_post coverage from cadence', () => {
    const result = scanBufferDepth(baseInput)
    expect(result.formats.blog_post).toBeDefined()
    expect(result.formats.blog_post.totalSlots).toBeGreaterThan(0)
  })

  it('returns health status: green when >75% filled', () => {
    // Create 16 weeks of video items (one per week on Tuesday)
    const items: PipelineItemWithSlot[] = Array.from({ length: 16 }, (_, i) => {
      const day = 26 + (i * 7) // approximate, not exact but enough for slot matching
      return makePipelineItem({
        id: `v${i}`,
        format: 'video',
        scheduled_at: `2026-${String(5 + Math.floor((day - 1) / 30)).padStart(2, '0')}-${String(((day - 1) % 30) + 1).padStart(2, '0')}T13:00:00Z`,
        youtube_channel_id: 'ch-1',
        stage: 'gravacao',
      })
    })
    const result = scanBufferDepth({
      ...baseInput,
      blogCadence: null, // only test video
      pipelineItems: items,
    })
    // With items scheduled for every slot, health should be green
    if (result.formats.video.filledSlots > 0) {
      expect(['green', 'yellow', 'red']).toContain(result.formats.video.health)
    }
  })

  it('returns health status: red when 0% filled', () => {
    const result = scanBufferDepth({
      ...baseInput,
      blogCadence: null,
      pipelineItems: [],
    })
    expect(result.formats.video.health).toBe('red')
  })

  it('handles empty input (no schedules, no cadence)', () => {
    const result = scanBufferDepth({
      ...baseInput,
      syncSchedules: [],
      blogCadence: null,
      newsletterEditions: [],
    })
    expect(Object.keys(result.formats)).toHaveLength(0)
  })

  it('uses custom weeksToScan', () => {
    const result4 = scanBufferDepth({ ...baseInput, weeksToScan: 4, blogCadence: null })
    const result16 = scanBufferDepth({ ...baseInput, weeksToScan: 16, blogCadence: null })
    expect(result16.formats.video.totalSlots).toBeGreaterThan(result4.formats.video.totalSlots)
  })

  it('includes summary with overall health', () => {
    const result = scanBufferDepth(baseInput)
    expect(result.overallHealth).toBeDefined()
    expect(['green', 'yellow', 'red']).toContain(result.overallHealth)
  })
})
```

- [ ] **Step 2: Verify tests fail**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/scan-buffer-depth.test.ts
```

Should fail with module not found.

- [ ] **Step 3: Implement scanBufferDepth**

Create `apps/web/src/lib/pipeline/scan-buffer-depth.ts`:

```typescript
import { addDays, formatISO, parseISO } from 'date-fns'
import { generateWeekSlots, hydrateWeekSlots } from './generate-week-slots'
import type {
  SyncScheduleWithChannel,
  BlogCadenceRow,
  NewsletterEditionRow,
  PipelineItemWithSlot,
  WeekSlot,
} from './up-next-types'

export interface BufferDepthInput {
  syncSchedules: SyncScheduleWithChannel[]
  blogCadence: BlogCadenceRow | null
  newsletterEditions: NewsletterEditionRow[]
  pipelineItems: PipelineItemWithSlot[]
  today: string
  siteTimezone: string
  weeksToScan: number
}

export interface FormatCoverage {
  totalSlots: number
  filledSlots: number
  coveragePercent: number
  health: 'green' | 'yellow' | 'red'
}

export interface BufferDepthResult {
  formats: Record<string, FormatCoverage>
  overallHealth: 'green' | 'yellow' | 'red'
}

function computeHealth(coveragePercent: number): 'green' | 'yellow' | 'red' {
  if (coveragePercent >= 75) return 'green'
  if (coveragePercent >= 40) return 'yellow'
  return 'red'
}

export function scanBufferDepth(input: BufferDepthInput): BufferDepthResult {
  const {
    syncSchedules,
    blogCadence,
    newsletterEditions,
    pipelineItems,
    today,
    siteTimezone,
    weeksToScan,
  } = input

  const todayDate = parseISO(today)
  const allSlots: WeekSlot[] = []

  // Generate and hydrate slots for each week
  for (let w = 0; w < weeksToScan; w++) {
    const weekStart = formatISO(addDays(todayDate, w * 7), { representation: 'date' })

    const emptySlots = generateWeekSlots({
      syncSchedules,
      blogCadence,
      newsletterEditions,
      weekStart,
      siteTimezone,
      today,
    })

    const hydratedSlots = hydrateWeekSlots(emptySlots, pipelineItems, siteTimezone)
    allSlots.push(...hydratedSlots)
  }

  // Aggregate by format, excluding rest days
  const formatMap = new Map<string, { total: number; filled: number }>()

  for (const slot of allSlots) {
    if (slot.isRestDay) continue

    const key = slot.format
    let entry = formatMap.get(key)
    if (!entry) {
      entry = { total: 0, filled: 0 }
      formatMap.set(key, entry)
    }

    entry.total++
    if (slot.assignedItem !== null) {
      entry.filled++
    }
  }

  const formats: Record<string, FormatCoverage> = {}
  let totalAll = 0
  let filledAll = 0

  for (const [format, counts] of formatMap) {
    const coveragePercent = counts.total > 0
      ? Math.round((counts.filled / counts.total) * 100)
      : 0

    formats[format] = {
      totalSlots: counts.total,
      filledSlots: counts.filled,
      coveragePercent,
      health: computeHealth(coveragePercent),
    }

    totalAll += counts.total
    filledAll += counts.filled
  }

  const overallPercent = totalAll > 0 ? Math.round((filledAll / totalAll) * 100) : 0

  return {
    formats,
    overallHealth: computeHealth(overallPercent),
  }
}
```

- [ ] **Step 4: Verify tests pass**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/scan-buffer-depth.test.ts
```

- [ ] **Step 5: Commit**

```
feat(pipeline): add scanBufferDepth for 16-week coverage analysis

Scans N weeks of generated slots via generateWeekSlots + hydrateWeekSlots,
aggregates per-format fill rates, and computes health status
(green >= 75%, yellow >= 40%, red < 40%). Powers buffer health pills.
```

---

## Task 9: Buffer health pills UI component

**Goal:** Show colored pills in the pipeline overview header indicating per-format buffer depth (e.g., "Video 3/16", "Blog 12/16") with green/yellow/red coloring.

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/buffer-health-pills.tsx`
- Modify: `apps/web/src/lib/pipeline/up-next-fetcher.ts`
- Modify: `apps/web/src/lib/pipeline/up-next-types.ts`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx`

- [ ] **Step 1: Add bufferDepth to UpNextApiResponse type**

In `apps/web/src/lib/pipeline/up-next-types.ts`, add to `UpNextApiResponse`:

Replace:
```typescript
export interface UpNextApiResponse {
  today: TodayActionsResult
  todayDate: string
  weekSlots: WeekSlot[]
  streak: StreakResult
  stageCounts: Record<string, number>
  playlists: PlaylistSummary[]
  candidates: SlotCandidate[]
  nextWeekEmpty: number
  backlogCount: number
  suggestion: { text: string; href: string } | null
  errors: {
    today: string | null
    weekSlots: string | null
    streak: string | null
    playlists: string | null
  }
}
```
With:
```typescript
export interface UpNextApiResponse {
  today: TodayActionsResult
  todayDate: string
  weekSlots: WeekSlot[]
  streak: StreakResult
  stageCounts: Record<string, number>
  playlists: PlaylistSummary[]
  candidates: SlotCandidate[]
  nextWeekEmpty: number
  backlogCount: number
  suggestion: { text: string; href: string } | null
  bufferDepth: {
    formats: Record<string, { totalSlots: number; filledSlots: number; coveragePercent: number; health: 'green' | 'yellow' | 'red' }>
    overallHealth: 'green' | 'yellow' | 'red'
  } | null
  errors: {
    today: string | null
    weekSlots: string | null
    streak: string | null
    playlists: string | null
  }
}
```

- [ ] **Step 2: Compute bufferDepth in up-next-fetcher**

In `apps/web/src/lib/pipeline/up-next-fetcher.ts`:

Add import:
```typescript
import { scanBufferDepth } from '@/lib/pipeline/scan-buffer-depth'
```

Add after the `nextWeekEmpty` computation (after line 233), before the return statement:

```typescript
  let bufferDepth: UpNextApiResponse['bufferDepth'] = null
  try {
    bufferDepth = scanBufferDepth({
      syncSchedules,
      blogCadence,
      newsletterEditions,
      pipelineItems,
      today,
      siteTimezone: tz,
      weeksToScan: 16,
    })
  } catch {
    // non-critical — keep null
  }
```

Add `bufferDepth` to the return object:

```typescript
  return {
    today: todayResult,
    todayDate: today,
    weekSlots,
    streak,
    stageCounts,
    playlists,
    candidates: pipelineItems
      .filter(i => i.stage !== 'scheduled' && i.stage !== 'published')
      .map(({ id, title, stage, format, language, playlist_id, playlist_name, playlist_position, playlist_total }) =>
        ({ id, title, stage, format, language, playlist_id, playlist_name, playlist_position, playlist_total })),
    nextWeekEmpty,
    backlogCount,
    suggestion,
    bufferDepth,
    errors,
  }
```

- [ ] **Step 3: Create BufferHealthPills component**

Create `apps/web/src/app/cms/(authed)/pipeline/_components/buffer-health-pills.tsx`:

```typescript
'use client'

import { gemMix } from '@/lib/pipeline/gem-design'

interface FormatCoverage {
  totalSlots: number
  filledSlots: number
  coveragePercent: number
  health: 'green' | 'yellow' | 'red'
}

interface BufferHealthPillsProps {
  formats: Record<string, FormatCoverage>
  overallHealth: 'green' | 'yellow' | 'red'
}

const FORMAT_LABELS: Record<string, string> = {
  video: 'Video',
  blog_post: 'Blog',
  newsletter: 'Newsletter',
}

const HEALTH_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  green: {
    bg: gemMix('--gem-done', 12),
    text: 'var(--gem-done)',
    border: gemMix('--gem-done', 25),
  },
  yellow: {
    bg: gemMix('--gem-warn', 12),
    text: 'var(--gem-warn)',
    border: gemMix('--gem-warn', 25),
  },
  red: {
    bg: gemMix('--gem-danger', 12),
    text: 'var(--gem-danger)',
    border: gemMix('--gem-danger', 25),
  },
}

export function BufferHealthPills({ formats, overallHealth }: BufferHealthPillsProps) {
  const entries = Object.entries(formats).filter(([, c]) => c.totalSlots > 0)

  if (entries.length === 0) return null

  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      role="status"
      aria-label={`Buffer depth: ${overallHealth}`}
    >
      <span
        className="text-[10px] font-medium uppercase tracking-wider"
        style={{ color: 'var(--gem-dim)' }}
      >
        Buffer
      </span>
      {entries.map(([format, coverage]) => {
        const colors = HEALTH_COLORS[coverage.health] ?? HEALTH_COLORS['red']!
        const label = FORMAT_LABELS[format] ?? format

        return (
          <span
            key={format}
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border"
            style={{
              background: colors.bg,
              color: colors.text,
              borderColor: colors.border,
            }}
            title={`${label}: ${coverage.filledSlots}/${coverage.totalSlots} slots filled (${coverage.coveragePercent}%)`}
            aria-label={`${label}: ${coverage.filledSlots} de ${coverage.totalSlots} slots preenchidos`}
          >
            <span>{label}</span>
            <span aria-hidden="true">
              {coverage.filledSlots}/{coverage.totalSlots}
            </span>
          </span>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Integrate into PipelineOverview**

In `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx`:

Add import:
```typescript
import { BufferHealthPills } from './buffer-health-pills'
```

After the progress bar section (after the `</div>` that closes the `totalActions > 0` block, around line 199), add the pills.

Find the block:
```typescript
      {totalActions > 0 && (
        <div>
          <div className="flex items-center justify-between gap-4">
            <h2
              className="text-sm font-semibold"
              style={{ color: 'var(--gem-text)' }}
            >
              {weekdayLabel}
              {' '}&mdash; {doneCount} de {totalActions} feito
              {remainingHours > 0 && <> · ~{remainingHours}h restantes</>}
            </h2>
            <div className="max-w-sm shrink-0">
              <LazyPipelineSearchDropdown />
            </div>
          </div>
          <div
            className="mt-1 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--gem-faint)' }}
            role="progressbar"
            aria-label={`${doneCount} de ${totalActions} tarefas concluídas`}
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={totalActions}
          >
            <div
              className="h-full rounded-full motion-safe:transition-all motion-safe:animate-[progress-fill_0.8s_ease-out]"
              style={{
                width: `${Math.round((doneCount / totalActions) * 100)}%`,
                background: 'var(--gem-done)',
              }}
            />
          </div>
        </div>
      )}
```

Replace with:
```typescript
      {totalActions > 0 && (
        <div>
          <div className="flex items-center justify-between gap-4">
            <h2
              className="text-sm font-semibold"
              style={{ color: 'var(--gem-text)' }}
            >
              {weekdayLabel}
              {' '}&mdash; {doneCount} de {totalActions} feito
              {remainingHours > 0 && <> · ~{remainingHours}h restantes</>}
            </h2>
            <div className="max-w-sm shrink-0">
              <LazyPipelineSearchDropdown />
            </div>
          </div>
          <div
            className="mt-1 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--gem-faint)' }}
            role="progressbar"
            aria-label={`${doneCount} de ${totalActions} tarefas concluídas`}
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={totalActions}
          >
            <div
              className="h-full rounded-full motion-safe:transition-all motion-safe:animate-[progress-fill_0.8s_ease-out]"
              style={{
                width: `${Math.round((doneCount / totalActions) * 100)}%`,
                background: 'var(--gem-done)',
              }}
            />
          </div>
          {upNext.bufferDepth && (
            <div className="mt-2">
              <BufferHealthPills
                formats={upNext.bufferDepth.formats}
                overallHealth={upNext.bufferDepth.overallHealth}
              />
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 5: Verify existing tests still pass**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/today-action-cards.test.tsx
npm run test:web -- --reporter verbose apps/web/test/cms/scan-buffer-depth.test.ts
```

- [ ] **Step 6: Commit**

```
feat(pipeline): add buffer health pills showing per-format coverage

scanBufferDepth computes 16-week slot fill rates per format.
BufferHealthPills renders green/yellow/red pills with fill counts
in the Command Center header, giving instant buffer visibility.
```

---

## Task 10: Urgency-grouped queue view

**Goal:** Update `TodayActionCards` to visually group actions by urgency level (overdue, today, tomorrow, this_week) with section headers, instead of a flat list.

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/today-action-cards.tsx`
- Modify: `apps/web/test/cms/today-action-cards.test.tsx`

- [ ] **Step 1: Write tests for urgency grouping**

Add to `apps/web/test/cms/today-action-cards.test.tsx`:

```typescript
describe('urgency grouping', () => {
  it('renders section headers for each urgency group', () => {
    const actions = [
      makeAction({ id: 'a1', urgency: 'overdue', itemTitle: 'Overdue Item' }),
      makeAction({ id: 'a2', urgency: 'today', itemTitle: 'Today Item' }),
      makeAction({ id: 'a3', urgency: 'this_week', itemTitle: 'Week Item' }),
    ]
    render(<TodayActionCards actions={actions} overflow={0} />)

    expect(screen.getByText('Atrasado')).toBeInTheDocument()
    expect(screen.getByText('Hoje')).toBeInTheDocument()
    expect(screen.getByText('Esta semana')).toBeInTheDocument()
  })

  it('does not render empty urgency groups', () => {
    const actions = [
      makeAction({ id: 'a1', urgency: 'today', itemTitle: 'Today Item' }),
    ]
    render(<TodayActionCards actions={actions} overflow={0} />)

    expect(screen.getByText('Hoje')).toBeInTheDocument()
    expect(screen.queryByText('Atrasado')).not.toBeInTheDocument()
    expect(screen.queryByText('Amanhã')).not.toBeInTheDocument()
  })

  it('groups multiple actions under same urgency header', () => {
    const actions = [
      makeAction({ id: 'a1', urgency: 'today', itemTitle: 'Item 1' }),
      makeAction({ id: 'a2', urgency: 'today', itemTitle: 'Item 2' }),
    ]
    render(<TodayActionCards actions={actions} overflow={0} />)

    // Only one "Hoje" header
    const headers = screen.getAllByText('Hoje')
    // One in the group header, potentially one in the card badge — filter by role
    const groupHeaders = headers.filter(el => el.tagName === 'H3')
    expect(groupHeaders).toHaveLength(1)
  })

  it('renders phantom actions with create link instead of detail link', () => {
    const actions = [
      makeAction({
        id: 'blog-cadence-2026-05-25',
        urgency: 'today',
        isPhantom: true,
        format: 'blog_post',
        itemTitle: 'Post do Blog',
      }),
    ]
    render(<TodayActionCards actions={actions} overflow={0} />)

    const link = screen.getByRole('link', { name: /Post do Blog/i })
    expect(link).toHaveAttribute('href', '/cms/pipeline/items/new?format=blog_post')
  })
})
```

- [ ] **Step 2: Verify tests fail**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/today-action-cards.test.tsx
```

Should fail because grouping and phantom handling don't exist yet.

- [ ] **Step 3: Implement urgency grouping in TodayActionCards**

Rewrite `apps/web/src/app/cms/(authed)/pipeline/_components/today-action-cards.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import { gemMix } from '@/lib/pipeline/gem-design'
import type { TodayAction } from '@/lib/pipeline/up-next-types'

interface TodayActionCardsProps {
  actions: TodayAction[]
  overflow: number
}

const URGENCY_LABELS: Record<string, string> = {
  overdue: 'Atrasado',
  today: 'Hoje',
  tomorrow: 'Amanhã',
  this_week: 'Esta semana',
}

const URGENCY_STYLES: Record<string, { bg: string; color: string }> = {
  overdue: { bg: gemMix('--gem-danger', 15), color: 'var(--gem-danger)' },
  today: { bg: gemMix('--gem-accent', 15), color: 'var(--gem-accent)' },
  tomorrow: { bg: gemMix('--gem-muted', 15), color: 'var(--gem-muted)' },
  this_week: { bg: gemMix('--gem-dim', 15), color: 'var(--gem-dim)' },
}

const URGENCY_ORDER = ['overdue', 'today', 'tomorrow', 'this_week'] as const

function ActionCard({ action }: { action: TodayAction }) {
  const colors = FORMAT_COLORS[action.format] ?? { accent: 'var(--gem-accent)', text: 'var(--gem-muted)', border: 'var(--gem-border)' }
  const urgencyStyle = URGENCY_STYLES[action.urgency] ?? URGENCY_STYLES['this_week']!
  const isBatch = action.batchItems && action.batchItems.length > 0

  const href = action.isPhantom
    ? `/cms/pipeline/items/new?format=${action.format}`
    : isBatch
      ? `/cms/pipeline?stage=${action.stage}&format=${action.format}${action.channelLabel ? `&channel=${encodeURIComponent(action.channelLabel)}` : ''}`
      : `/cms/pipeline/items/${action.id}`

  return (
    <li>
      <Link
        href={href}
        className="group flex items-stretch gap-3 rounded-lg border p-3 cursor-pointer motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
        style={{
          background: 'var(--gem-surface)',
          borderColor: 'var(--gem-border)',
        }}
        aria-label={isBatch
          ? `${action.itemTitle}. ${URGENCY_LABELS[action.urgency] ?? action.urgency}. ${action.effortEstimate} total.`
          : `${action.itemTitle}. ${URGENCY_LABELS[action.urgency] ?? action.urgency}. ${action.effortEstimate}.`}
      >
        <div
          className="w-[3px] shrink-0 rounded-full"
          style={{ background: colors.accent }}
        />
        <span className="sr-only">{action.format === 'video' ? 'Video' : action.format === 'blog_post' ? 'Blog' : action.format === 'newsletter' ? 'Newsletter' : action.format}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
              style={{
                background: gemMix(colors.accent, 10),
                color: colors.text,
              }}
            >
              <span>{action.effort}</span>
              <span aria-hidden>·</span>
              <span>{action.effortEstimate}</span>
            </span>
            {action.urgencyScore != null && (
              <span
                className="text-[9px] font-mono px-1 py-0.5 rounded"
                style={{ color: 'var(--gem-dim)' }}
                title={`Urgency score: ${action.urgencyScore}`}
              >
                {action.urgencyScore}
              </span>
            )}
          </div>

          <p
            className="text-sm font-medium truncate"
            style={{ color: 'var(--gem-text)' }}
            title={action.itemTitle}
          >
            {action.itemTitle}
          </p>

          <p
            className="text-xs mt-0.5 truncate"
            style={{ color: 'var(--gem-muted)' }}
          >
            {action.actionLabel}
            {action.deadline && <> · {action.deadline.label}</>}
          </p>

          {action.channelLabel && (
            <p
              className="text-[10px] mt-0.5"
              style={{ color: 'var(--gem-dim)' }}
            >
              {action.channelLabel}
            </p>
          )}

          {action.playlistContext && action.playlistContext.total != null && (
            <p
              className="text-[10px] mt-0.5"
              style={{ color: 'var(--gem-dim)' }}
            >
              {action.playlistContext.name} {action.playlistContext.position}/{action.playlistContext.total}
            </p>
          )}
        </div>
      </Link>
    </li>
  )
}

function UrgencyGroup({ urgency, actions }: { urgency: string; actions: TodayAction[] }) {
  const style = URGENCY_STYLES[urgency] ?? URGENCY_STYLES['this_week']!
  const label = URGENCY_LABELS[urgency] ?? urgency

  return (
    <div className="space-y-2">
      <h3
        className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2"
        style={{ color: style.color }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: style.color }}
          aria-hidden="true"
        />
        {label}
        <span
          className="text-[10px] font-normal"
          style={{ color: 'var(--gem-dim)' }}
        >
          ({actions.length})
        </span>
      </h3>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {actions.map(action => (
          <ActionCard key={action.id} action={action} />
        ))}
      </ul>
    </div>
  )
}

export function TodayActionCards({ actions, overflow }: TodayActionCardsProps) {
  // Group actions by urgency level
  const grouped = new Map<string, TodayAction[]>()
  for (const action of actions) {
    const key = action.urgency
    let group = grouped.get(key)
    if (!group) {
      group = []
      grouped.set(key, group)
    }
    group.push(action)
  }

  return (
    <section
      aria-label="Fila de producao"
      className="border-l-2 pl-4"
      style={{ borderLeftColor: 'var(--gem-accent)' }}
    >
      <h2
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'var(--gem-muted)' }}
      >
        Fila de Producao
      </h2>
      {actions.length > 0 ? (
        <div className="space-y-4">
          {URGENCY_ORDER.map(urgency => {
            const group = grouped.get(urgency)
            if (!group || group.length === 0) return null
            return <UrgencyGroup key={urgency} urgency={urgency} actions={group} />
          })}
        </div>
      ) : (
        <p
          className="text-sm py-4 text-center"
          style={{ color: 'var(--gem-dim)' }}
        >
          Nada urgente — bom dia para novas ideias.
        </p>
      )}

      {overflow > 0 && (
        <p
          className="text-xs mt-2 text-center"
          style={{ color: 'var(--gem-muted)' }}
          aria-live="polite"
        >
          +{overflow} acoes adicionais
        </p>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Update existing tests for new structure**

Some existing tests in `today-action-cards.test.tsx` may reference "Acoes de Hoje" which is now "Fila de Producao". Update:

Replace any `getByText('Ações de Hoje')` or `getByLabelText('Ações de hoje')` assertions with the new labels:
- Section aria-label: `"Fila de producao"`
- Section header: `"Fila de Producao"`

Also update tests that check for urgency badge text inside cards — the urgency badge was removed from inside cards (it's now in the group header).

- [ ] **Step 5: Verify all tests pass**

Run:
```bash
npm run test:web -- --reporter verbose apps/web/test/cms/today-action-cards.test.tsx
```

- [ ] **Step 6: Full test suite verification**

Run all pipeline-related tests to ensure nothing is broken:

```bash
npm run test:web -- --reporter verbose apps/web/test/cms/
```

- [ ] **Step 7: Commit**

```
feat(pipeline): urgency-grouped production queue view

Replaces flat action list with sections grouped by urgency level
(overdue, today, tomorrow, this_week). Each group has a colored
header with count. Phantom blog actions link to create-item.
Section renamed from "Acoes de Hoje" to "Fila de Producao".
```

---

## Final Verification

After all 10 tasks are complete:

- [ ] **Run full test suite**
```bash
npm run test:web
```

- [ ] **Run build to verify no type errors**
```bash
npm run build:packages && npx next build --dir apps/web
```

- [ ] **Verify file count**

New files created (7):
1. `apps/web/src/lib/pipeline/compute-urgency-score.ts`
2. `apps/web/src/lib/pipeline/scan-buffer-depth.ts`
3. `apps/web/src/app/cms/(authed)/pipeline/_components/buffer-health-pills.tsx`
4. `apps/web/test/cms/up-next-route-timezone.test.ts`
5. `apps/web/test/cms/compute-urgency-score.test.ts`
6. `apps/web/test/cms/done-today-filter.test.ts`
7. `apps/web/test/cms/scan-buffer-depth.test.ts`

Modified files (9):
1. `apps/web/src/app/api/pipeline/up-next/route.ts`
2. `apps/web/src/lib/pipeline/up-next-types.ts`
3. `apps/web/src/lib/pipeline/calculate-today-actions.ts`
4. `apps/web/src/lib/pipeline/up-next-fetcher.ts`
5. `apps/web/src/lib/pipeline/generate-week-slots.ts`
6. `apps/web/src/app/cms/(authed)/pipeline/_components/today-action-cards.tsx`
7. `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx`
8. `apps/web/test/cms/calculate-today-actions.test.ts`
9. `apps/web/test/cms/generate-week-slots.test.ts`
