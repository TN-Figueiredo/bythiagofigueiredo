# Up Next Week Grid Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove auto-assignment from the weekly grid so slots are empty by default, persist user-assigned items across reloads via hydration, fix the picker so it doesn't clip, and align the optimistic update with hydration logic.

**Architecture:** Two-phase slot construction: `generateWeekSlots()` builds empty schedule structure, then `hydrateWeekSlots()` matches pipeline items with `scheduled_at` to their corresponding slots by day + hour + format + channelId. The `WeekSlotPicker` always portals to `document.body` with `position: fixed` and viewport clamping on scroll/resize. The optimistic update in `pipeline-overview.tsx` is updated to match by `hour` + `channelId` for consistency with hydration.

**Commit safety:** Tasks are ordered so every intermediate commit compiles independently. Additive changes (new functions, type extensions) come before breaking changes (removing fields, rewiring consumers). Task 1 adds `hydrateWeekSlots()` and the `SlotCandidate.language` field (additive). Task 2 atomically removes auto-assignment AND wires the fetcher to two-phase (breaking + consumer update in one commit).

**Known limitation:** If a user-assigned item is later published or archived, the fetcher filters it out and the slot silently reverts to empty. This is acceptable for MVP — a "completed" visual treatment is a follow-up.

**Tech Stack:** React 19, Next.js 15, SWR, date-fns, date-fns-tz, Vitest + @testing-library/react, Tailwind 4, CSS custom properties (`--gem-*`)

---

## Visual: Before vs After

```
BEFORE (auto-assignment — wrong):
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│  Seg 25 │  Ter 26 │  Qua 27 │  Qui 28 │  Sex 29 │  Sab 30 │  Dom 31 │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│    —    │▓▓▓▓▓▓▓▓▓│    —    │    —    │    —    │(opcional)│(opcional)│
│         │ Auto:   │         │         │         │         │         │
│         │"Video X"│         │         │         │         │         │
│         │ edicao  │         │         │         │         │         │
│         │  [🔄]   │         │         │         │         │         │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
  System picks "most progressed" item → user confused: "de onde pega isso?"

AFTER (empty by default — user controls):
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│  Seg 25 │  Ter 26 │  Qua 27 │  Qui 28 │  Sex 29 │  Sab 30 │  Dom 31 │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│    —    │┌───────┐│    —    │    —    │    —    │(opcional)│(opcional)│
│         ││slot   ││         │         │         │         │         │
│         ││vazio  ││         │         │         │         │         │
│         │└───────┘│         │         │         │         │         │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
  User clicks "slot vazio" → picker opens as portal (never clips):

  ┌──────────────────────────┐  ← fixed position, viewport-clamped
  │ 🔍 Buscar item...        │     recalculates on scroll/resize
  ├──────────────────────────┤
  │ ● Video X        edicao  │  ← filtered by format + language
  │ ● Video Y        roteiro │     sorted by stage (most progressed first)
  │ ● Video Z        draft   │
  └──────────────────────────┘

  After assigning → persists across reload:
┌─────────┬─────────┬─────────┬...
│  Seg 25 │  Ter 26 │  Qua 27 │
├─────────┼─────────┼─────────┤
│    —    │▓▓▓▓▓▓▓▓▓│    —    │  ← item stays after SWR revalidation
│         │ User:   │         │     because hydrateWeekSlots() matches
│         │"Video X"│         │     scheduled_at to slot day+hour+format+channel
│         │ edicao  │         │
│         │  [🔄]   │         │
└─────────┴─────────┴─────────┘
```

---

## File Map

| Action | File | Task | Responsibility |
|--------|------|------|----------------|
| Modify | `apps/web/src/lib/pipeline/generate-week-slots.ts` | 1, 2 | Add `hydrateWeekSlots()` (T1), then remove `findBestItem()` + `pipelineItems` param (T2) |
| Modify | `apps/web/src/lib/pipeline/up-next-types.ts` | 1 | Add `language` to `SlotCandidate` |
| Modify | `apps/web/src/lib/pipeline/up-next-fetcher.ts` | 2 | Two-phase: `generateWeekSlots()` → `hydrateWeekSlots()` |
| Modify | `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx` | 3 | Fix optimistic update to match by `hour` |
| Modify | `apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx` | 3 | Add `hour` to picker state for multi-channel slot disambiguation |
| Modify | `apps/web/src/app/cms/(authed)/pipeline/_components/week-slot-picker.tsx` | 4 | Always-portal positioning, language filter, arrow-key nav, `pointerdown`, responsive width |
| Modify | `apps/web/test/cms/generate-week-slots.test.ts` | 1, 2 | Add hydration tests (T1), remove auto-assignment tests (T2) |
| Modify | `apps/web/test/cms/week-slot-picker.test.tsx` | 4 | Update mock + helper, add portal/language/clamping tests |

**NOT changed:**
- `up-next-this-week.tsx` `overflow-x-auto` — keep it (mobile needs horizontal scroll; portal escapes it)
- `route.ts` — API route unchanged

---

### Task 1: Add `hydrateWeekSlots()` and update `SlotCandidate` type (additive — nothing breaks)

**Files:**
- Modify: `apps/web/src/lib/pipeline/generate-week-slots.ts` (add function)
- Modify: `apps/web/src/lib/pipeline/up-next-types.ts` (add `language` to `SlotCandidate`)
- Modify: `apps/web/test/cms/generate-week-slots.test.ts` (add tests)

When the user assigns an item via the picker, the API sets `scheduled_at` on the pipeline item. On next fetch/revalidation, `hydrateWeekSlots()` matches items with `scheduled_at` to their corresponding empty slots so the assignment survives reload.

**Matching rules:**
- `item.format === slot.format`
- `item.scheduled_at` day portion matches `slot.day` (defensive: reject non-string or too-short values)
- If slot has `hour`: `item.scheduled_at` hour portion matches `slot.hour`
- If slot has `channelId`: `item.youtube_channel_id === slot.channelId` (critical for multi-channel same-day)
- Skip rest day slots, skip already-assigned slots
- Each item can only match one slot (dedup via `usedIds` Set)

- [ ] **Step 1: Add `language` to `SlotCandidate` type**

In `apps/web/src/lib/pipeline/up-next-types.ts`, change line 122:

```typescript
export type SlotCandidate = Pick<PipelineItemWithSlot, 'id' | 'title' | 'stage' | 'format' | 'language'>
```

Note: `UpNextApiResponse.candidates` (line 131) already includes `language`. This aligns `SlotCandidate` with the API response type.

- [ ] **Step 2: Write failing tests for `hydrateWeekSlots()`**

Add imports at the top of `apps/web/test/cms/generate-week-slots.test.ts`:

```typescript
import { generateWeekSlots, hydrateWeekSlots } from '../../src/lib/pipeline/generate-week-slots'
import type { WeekSlot } from '../../src/lib/pipeline/up-next-types'
```

(Replace the existing `generateWeekSlots` import.)

Add a new `describe` block after the existing one:

```typescript
describe('hydrateWeekSlots', () => {
  it('matches a pipeline item with scheduled_at to the correct slot', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', title: 'My Video', stage: 'edicao', format: 'video',
      youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).toEqual({ id: 'v1', title: 'My Video', stage: 'edicao' })
    expect(result[0].effortMinutes).toBe(90)
  })

  it('does not match item when day differs', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-27T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).toBeNull()
  })

  it('does not match item when format differs', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'b1', format: 'blog_post', youtube_channel_id: null,
      scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).toBeNull()
  })

  it('does not match item when hour differs on a slot that has hour', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T14:00:00',
    })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).toBeNull()
  })

  it('does not match item to wrong channel on same-day same-hour slots', () => {
    const slots: WeekSlot[] = [
      {
        day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
        channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
        assignedItem: null, effortMinutes: 0,
      },
      {
        day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
        channelLocale: 'en', channelId: 'ch-en', isRestDay: false,
        assignedItem: null, effortMinutes: 0,
      },
    ]
    const items = [makePipelineItem({
      id: 'v1', title: 'PT Video', youtube_channel_id: 'ch-pt',
      scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem?.id).toBe('v1')
    expect(result[1].assignedItem).toBeNull()
  })

  it('matches blog slot with hour=null by day+format only', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-25', dayLabel: 'Seg', hour: null, format: 'blog_post',
      channelLocale: null, channelId: null, isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'b1', title: 'Blog Post', stage: 'draft', format: 'blog_post',
      youtube_channel_id: null, scheduled_at: '2026-05-25T00:00:00',
    })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).toEqual({ id: 'b1', title: 'Blog Post', stage: 'draft' })
  })

  it('matches newsletter slot by day+format', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-27', dayLabel: 'Qua', hour: null, format: 'newsletter',
      channelLocale: null, channelId: null, isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'nl1', title: 'Newsletter', stage: 'draft', format: 'newsletter',
      youtube_channel_id: null, scheduled_at: '2026-05-27T14:00:00',
    })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).toEqual({ id: 'nl1', title: 'Newsletter', stage: 'draft' })
  })

  it('does not assign same item to two slots', () => {
    const slots: WeekSlot[] = [
      {
        day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
        channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
        assignedItem: null, effortMinutes: 0,
      },
      {
        day: '2026-05-26', dayLabel: 'Ter', hour: '14:00', format: 'video',
        channelLocale: 'en', channelId: 'ch-en', isRestDay: false,
        assignedItem: null, effortMinutes: 0,
      },
    ]
    const items = [makePipelineItem({
      id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items)
    const assigned = result.filter(s => s.assignedItem !== null)
    expect(assigned).toHaveLength(1)
    expect(assigned[0].hour).toBe('10:00')
  })

  it('assigns first matching item when multiple items match same slot', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [
      makePipelineItem({ id: 'v1', title: 'First', stage: 'edicao', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00' }),
      makePipelineItem({ id: 'v2', title: 'Second', stage: 'gravacao', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00' }),
    ]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem?.id).toBe('v1')
  })

  it('skips items without scheduled_at', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({ id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: null })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).toBeNull()
  })

  it('skips items with malformed scheduled_at (too short)', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({ id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05' })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).toBeNull()
  })

  it('skips rest day slots', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-30', dayLabel: 'Sab', hour: null, format: 'video',
      channelLocale: null, channelId: null, isRestDay: true,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({ id: 'v1', scheduled_at: '2026-05-30T00:00:00' })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).toBeNull()
  })

  it('preserves slot that already has an assignedItem', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: { id: 'existing', title: 'Already Here', stage: 'gravacao' },
      effortMinutes: 240,
    }]
    const items = [makePipelineItem({
      id: 'different', title: 'New Item', stage: 'edicao',
      youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem?.id).toBe('existing')
    expect(result[0].effortMinutes).toBe(240)
  })

  it('does not match channel-less item to channel-specific slot', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', youtube_channel_id: null, scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).toBeNull()
  })

  it('returns effortMinutes 0 for items at published stage', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', stage: 'published', youtube_channel_id: 'ch-pt',
      scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).not.toBeNull()
    expect(result[0].effortMinutes).toBe(0)
  })

  it('returns effortMinutes 0 for items at scheduled stage or later', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', stage: 'scheduled', youtube_channel_id: 'ch-pt',
      scheduled_at: '2026-05-26T10:00:00',
    })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).not.toBeNull()
    expect(result[0].effortMinutes).toBe(0)
  })

  it('matches item with timezone-aware scheduled_at (trailing Z)', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const items = [makePipelineItem({
      id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00Z',
    })]

    const result = hydrateWeekSlots(slots, items)
    expect(result[0].assignedItem).not.toBeNull()
  })

  it('does not mutate input slots array', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const original = JSON.parse(JSON.stringify(slots))
    const items = [makePipelineItem({
      id: 'v1', youtube_channel_id: 'ch-pt', scheduled_at: '2026-05-26T10:00:00',
    })]

    hydrateWeekSlots(slots, items)
    expect(slots).toEqual(original)
  })

  it('returns empty array when slots is empty', () => {
    expect(hydrateWeekSlots([], [makePipelineItem()])).toEqual([])
  })

  it('returns unchanged slots when pipelineItems is empty', () => {
    const slots: WeekSlot[] = [{
      day: '2026-05-26', dayLabel: 'Ter', hour: '10:00', format: 'video',
      channelLocale: 'pt', channelId: 'ch-pt', isRestDay: false,
      assignedItem: null, effortMinutes: 0,
    }]
    const result = hydrateWeekSlots(slots, [])
    expect(result[0].assignedItem).toBeNull()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run test/cms/generate-week-slots.test.ts`
Expected: FAIL — `hydrateWeekSlots` is not exported.

- [ ] **Step 4: Implement `hydrateWeekSlots()`**

In `apps/web/src/lib/pipeline/generate-week-slots.ts`, add the helper and function **after** `generateWeekSlots()`:

```typescript
function getEffortMinutes(format: string, stage: Stage): number {
  if (STAGE_ORDER[stage] >= STAGE_ORDER['scheduled']) return 0
  return EFFORT_DEFAULTS[`${format}:${stage}`]?.minutes ?? 30
}

export function hydrateWeekSlots(
  slots: WeekSlot[],
  pipelineItems: PipelineItemWithSlot[],
): WeekSlot[] {
  const usedIds = new Set<string>()

  return slots.map(slot => {
    if (slot.assignedItem) return slot
    if (slot.isRestDay) return slot

    const match = pipelineItems.find(item => {
      if (usedIds.has(item.id)) return false
      if (!item.scheduled_at || typeof item.scheduled_at !== 'string' || item.scheduled_at.length < 10) return false
      if (item.format !== slot.format) return false

      const scheduledDay = item.scheduled_at.slice(0, 10)
      if (scheduledDay !== slot.day) return false

      if (slot.hour && item.scheduled_at.length >= 16) {
        const scheduledHour = item.scheduled_at.slice(11, 16)
        if (scheduledHour !== slot.hour) return false
      }

      if (slot.channelId && item.youtube_channel_id !== slot.channelId) return false

      return true
    })

    if (!match) return slot
    usedIds.add(match.id)

    return {
      ...slot,
      assignedItem: { id: match.id, title: match.title, stage: match.stage },
      effortMinutes: getEffortMinutes(match.format, match.stage),
    }
  })
}
```

Note: The `scheduled_at` guard now validates type and minimum length before slicing. This prevents runtime errors from malformed data.

- [ ] **Step 5: Run tests**

Run: `cd apps/web && npx vitest run test/cms/generate-week-slots.test.ts`
Expected: ALL tests pass (both `generateWeekSlots` and `hydrateWeekSlots` suites).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/pipeline/generate-week-slots.ts apps/web/src/lib/pipeline/up-next-types.ts apps/web/test/cms/generate-week-slots.test.ts
git commit -m "feat(pipeline): add hydrateWeekSlots + SlotCandidate.language — match user-assigned items to slots"
```

---

### Task 2: Remove auto-assignment and wire two-phase fetcher (atomic — one commit)

**Files:**
- Modify: `apps/web/src/lib/pipeline/generate-week-slots.ts`
- Modify: `apps/web/src/lib/pipeline/up-next-fetcher.ts:4,144-147`
- Modify: `apps/web/test/cms/generate-week-slots.test.ts`

This task removes `pipelineItems` from `generateWeekSlots()` AND wires the fetcher to the two-phase pattern in a single commit, so the codebase never enters a non-compiling state.

- [ ] **Step 1: Update tests — remove auto-assignment tests, drop `pipelineItems` from all calls**

In `apps/web/test/cms/generate-week-slots.test.ts`:

1. **Delete** the test named `'assigns most-progressed pipeline item to matching slot'`.
2. **Delete** the test named `'does not assign same item to two slots'`.
3. In **every remaining** `generateWeekSlots()` call, remove the `pipelineItems` property (every call passes `pipelineItems: []`). There are ~12 calls.
4. **Add** this test at the end of the `generateWeekSlots` describe block:

```typescript
it('all slots have assignedItem null and effortMinutes 0', () => {
  const slots = generateWeekSlots({
    syncSchedules: [makeSyncSchedule({ schedule: { day: 'tuesday', hour: 10 } })],
    blogCadence: makeBlogCadence(),
    newsletterEditions: [makeNewsletterEdition()],
    weekStart: WEEK_START,
    siteTimezone: SITE_TZ,
    today: TODAY,
  })

  const contentSlots = slots.filter(s => !s.isRestDay)
  expect(contentSlots.length).toBeGreaterThan(0)
  for (const slot of slots) {
    expect(slot.assignedItem).toBeNull()
    expect(slot.effortMinutes).toBe(0)
  }
})
```

- [ ] **Step 2: Remove auto-assignment from `generateWeekSlots()`**

In `apps/web/src/lib/pipeline/generate-week-slots.ts`:

1. **Remove** `pipelineItems` from the `GenerateWeekSlotsInput` interface (line 17).
2. **Delete** `const SCHEDULED_ORDER = STAGE_ORDER['scheduled']` (line 23).
3. **Delete** the old `getEffortMinutes()` function (lines 45-48) — the new one is already below `generateWeekSlots()` from Task 1.
4. **Delete** `findBestItem()` function (lines 50-63).
5. In `generateWeekSlots()` body:
   - **Delete** destructuring of `pipelineItems` from `input` (line 70).
   - **Delete** `const assignedItemIds = new Set<string>()` (line 81).
6. In the **video slot section**, remove candidate filtering and assignment. The slot push becomes:

```typescript
slots.push({
  day: slotDateStr,
  dayLabel: dayLabelForDate(slotDate),
  hour: `${String(sync.schedule.hour).padStart(2, '0')}:00`,
  format: 'video',
  channelLocale: sync.locale,
  channelId: sync.channel_id,
  isRestDay: false,
  assignedItem: null,
  effortMinutes: 0,
})
```

7. In the **blog slot section**, same treatment. The slot push becomes:

```typescript
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
```

- [ ] **Step 3: Wire two-phase in the fetcher**

In `apps/web/src/lib/pipeline/up-next-fetcher.ts`, change line 4 from:

```typescript
import { generateWeekSlots } from '@/lib/pipeline/generate-week-slots'
```

To:

```typescript
import { generateWeekSlots, hydrateWeekSlots } from '@/lib/pipeline/generate-week-slots'
```

Change lines 144-147 from:

```typescript
weekSlots = generateWeekSlots({
  syncSchedules, blogCadence, newsletterEditions, pipelineItems,
  weekStart, siteTimezone: tz, today,
})
```

To:

```typescript
const emptySlots = generateWeekSlots({
  syncSchedules, blogCadence, newsletterEditions,
  weekStart, siteTimezone: tz, today,
})
weekSlots = hydrateWeekSlots(emptySlots, pipelineItems)
```

- [ ] **Step 4: Run tests and typecheck**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20 && npx vitest run`
Expected: No type errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/generate-week-slots.ts apps/web/src/lib/pipeline/up-next-fetcher.ts apps/web/test/cms/generate-week-slots.test.ts
git commit -m "refactor(pipeline): remove auto-assignment, wire two-phase slot construction"
```

---

### Task 3: Fix multi-channel slot disambiguation

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx:52-65`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx:122,233-254`

Two related bugs: (A) the optimistic update in `pipeline-overview.tsx` matches slots by `day + format` but ignores `hour`, potentially assigning to the wrong slot in multi-channel same-day scenarios; (B) the picker state in `up-next-this-week.tsx` doesn't track `hour`, so when resolving which slot to open the picker for, it picks the first match instead of the correct one.

- [ ] **Step 1: Add `hour` to picker state in `up-next-this-week.tsx`**

In `apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx`:

1. Update the picker state type (line 122):

From:
```typescript
const [pickerSlot, setPickerSlot] = useState<{ day: string; format: WeekSlot['format']; previousItemId?: string } | null>(null)
```

To:
```typescript
const [pickerSlot, setPickerSlot] = useState<{ day: string; format: WeekSlot['format']; hour: string | null; previousItemId?: string } | null>(null)
```

2. Update `SlotChip`'s `onEmptyClick` callback type (line 34):

From:
```typescript
onEmptyClick?: (day: string, format: WeekSlot['format']) => void
```

To:
```typescript
onEmptyClick?: (day: string, format: WeekSlot['format'], hour: string | null) => void
```

3. Update `SlotChip`'s `onSwapClick` callback type (line 35):

From:
```typescript
onSwapClick?: (day: string, format: WeekSlot['format'], previousItemId: string) => void
```

To:
```typescript
onSwapClick?: (day: string, format: WeekSlot['format'], hour: string | null, previousItemId: string) => void
```

4. Update the empty slot button's `onClick` (line 110):

From:
```typescript
onClick={() => onEmptyClick?.(slot.day, slot.format)}
```

To:
```typescript
onClick={() => onEmptyClick?.(slot.day, slot.format, slot.hour)}
```

5. Update the swap button's `onClick` (line 86):

From:
```typescript
onClick={(e) => { e.preventDefault(); onSwapClick(slot.day, slot.format, slot.assignedItem!.id) }}
```

To:
```typescript
onClick={(e) => { e.preventDefault(); onSwapClick(slot.day, slot.format, slot.hour, slot.assignedItem!.id) }}
```

6. Update the `onEmptyClick` handler in the render (line 247-249):

From:
```typescript
onEmptyClick={(day, format) => {
  triggerRef.current = document.activeElement as HTMLButtonElement | null
  setPickerSlot({ day, format })
}}
```

To:
```typescript
onEmptyClick={(day, format, hour) => {
  triggerRef.current = document.activeElement as HTMLButtonElement | null
  setPickerSlot({ day, format, hour })
}}
```

7. Update the `onSwapClick` handler (line 251-253):

From:
```typescript
onSwapClick={onAssignSlot ? (day, format, previousItemId) => {
  triggerRef.current = document.activeElement as HTMLButtonElement | null
  setPickerSlot({ day, format, previousItemId })
} : undefined}
```

To:
```typescript
onSwapClick={onAssignSlot ? (day, format, hour, previousItemId) => {
  triggerRef.current = document.activeElement as HTMLButtonElement | null
  setPickerSlot({ day, format, hour, previousItemId })
} : undefined}
```

8. Update the picker slot resolution (line 260-266) to also match by `hour`:

From:
```typescript
slot={daySlots.find(s =>
  s.format === pickerSlot.format && (
    pickerSlot.previousItemId
      ? s.assignedItem?.id === pickerSlot.previousItemId
      : !s.assignedItem
  )
) ?? { day: pickerSlot.day, format: pickerSlot.format, hour: null, effortMinutes: 0, assignedItem: null, isRestDay: false, dayLabel: '', channelLocale: null, channelId: null }}
```

To:
```typescript
slot={daySlots.find(s =>
  s.format === pickerSlot.format && s.hour === pickerSlot.hour && (
    pickerSlot.previousItemId
      ? s.assignedItem?.id === pickerSlot.previousItemId
      : !s.assignedItem
  )
) ?? { day: pickerSlot.day, format: pickerSlot.format, hour: pickerSlot.hour, effortMinutes: 0, assignedItem: null, isRestDay: false, dayLabel: '', channelLocale: null, channelId: null }}
```

- [ ] **Step 2: Update the optimistic update in `pipeline-overview.tsx`**

In `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx`, replace the `optimistic` construction inside `handleAssignSlot` (lines 51-65) with:

```typescript
const optimistic: UpNextApiResponse = {
  ...prev,
  weekSlots: prev.weekSlots.map(s => {
    if (previousItemId && s.day === slotDay && s.format === candidate.format && s.assignedItem?.id === previousItemId) {
      return { ...s, assignedItem: newItem }
    }
    if (previousItemId && s.assignedItem?.id === previousItemId) {
      return { ...s, assignedItem: null }
    }
    if (s.day === slotDay && s.format === candidate.format && s.hour === slotHour && !s.assignedItem) {
      return { ...s, assignedItem: newItem }
    }
    return s
  }),
}
```

Changes on the third condition: added `s.hour === slotHour` to match the specific time slot. This aligns with `hydrateWeekSlots()` matching logic so the optimistic update targets the exact same slot that hydration would.

- [ ] **Step 3: Verify tests pass**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass. The `up-next-this-week.test.tsx` swap test at line 221 already passes `slotHour` through the onAssignSlot mock.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx apps/web/src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx
git commit -m "fix(pipeline): disambiguate multi-channel slots by hour in optimistic update and picker state"
```

---

### Task 4: Fix picker portal positioning + language filter + mobile/a11y

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/week-slot-picker.tsx`
- Modify: `apps/web/test/cms/week-slot-picker.test.tsx`

Note: `SlotCandidate` already has `language` from Task 1.

- [ ] **Step 1: Update test infrastructure — mock, helper, type import**

In `apps/web/test/cms/week-slot-picker.test.tsx`:

1. **Update the mock** at lines 13-18 to include `LOCALE_TO_LANGUAGE`:

```typescript
vi.mock('@/lib/pipeline/up-next-constants', () => ({
  STAGE_ORDER: {
    idea: 0, outline: 1, draft: 2, roteiro: 3,
    gravacao: 4, edicao: 5, pos_producao: 6, ready: 7, scheduled: 8, published: 9,
  },
  LOCALE_TO_LANGUAGE: { pt: 'pt-br', en: 'en' },
}))
```

2. **Update the import** to include `SlotCandidate`:

```typescript
import type { WeekSlot, SlotCandidate } from '../../src/lib/pipeline/up-next-types'
```

3. **Replace `makeCandidate()` helper** (lines 38-48) to use `SlotCandidate` with `language`:

```typescript
function makeCandidate(overrides: Partial<SlotCandidate> = {}): SlotCandidate {
  return {
    id: 'c-1',
    title: 'Meu Video',
    stage: 'roteiro',
    format: 'video',
    language: 'pt-br',
    ...overrides,
  }
}
```

Remove the local `Candidate` type alias.

- [ ] **Step 2: Add new tests**

Append these tests to the `WeekSlotPicker` describe block:

```typescript
it('filters candidates by language compatibility with slot locale', () => {
  const ptSlot = makeSlot({ channelLocale: 'pt' })
  const candidates = [
    makeCandidate({ id: '1', title: 'PT Video', language: 'pt-br' }),
    makeCandidate({ id: '2', title: 'EN Video', language: 'en' }),
    makeCandidate({ id: '3', title: 'Both Video', language: 'both' }),
  ]

  render(
    <WeekSlotPicker slot={ptSlot} candidates={candidates} onAssign={onAssign} onClose={onClose} />
  )

  expect(screen.getByText('PT Video')).toBeDefined()
  expect(screen.queryByText('EN Video')).toBeNull()
  expect(screen.getByText('Both Video')).toBeDefined()
})

it('shows all candidates when slot has no channelLocale (blog/newsletter)', () => {
  const blogSlot = makeSlot({ format: 'blog_post', channelLocale: null, channelId: null })
  const candidates = [
    makeCandidate({ id: '1', title: 'PT Post', format: 'blog_post', language: 'pt-br' }),
    makeCandidate({ id: '2', title: 'EN Post', format: 'blog_post', language: 'en' }),
  ]

  render(
    <WeekSlotPicker slot={blogSlot} candidates={candidates} onAssign={onAssign} onClose={onClose} />
  )

  expect(screen.getByText('PT Post')).toBeDefined()
  expect(screen.getByText('EN Post')).toBeDefined()
})

it('renders with fixed positioning when anchorRef is provided', () => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  anchor.getBoundingClientRect = () => ({
    top: 100, left: 50, bottom: 130, right: 200,
    width: 150, height: 30, x: 50, y: 100, toJSON: () => ({}),
  })

  render(
    <WeekSlotPicker
      slot={makeSlot()} candidates={[makeCandidate()]}
      onAssign={onAssign} onClose={onClose}
      anchorRef={{ current: anchor }}
    />
  )

  const dialog = screen.getByRole('dialog')
  expect(dialog.className).toContain('fixed')
  expect(dialog.style.top).toBe('134px')
  expect(dialog.style.left).toBe('50px')
  document.body.removeChild(anchor)
})

it('clamps picker left when anchor is near right viewport edge', () => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  Object.defineProperty(window, 'innerWidth', { value: 300, writable: true, configurable: true })
  anchor.getBoundingClientRect = () => ({
    top: 100, left: 200, bottom: 130, right: 350,
    width: 150, height: 30, x: 200, y: 100, toJSON: () => ({}),
  })

  render(
    <WeekSlotPicker
      slot={makeSlot()} candidates={[makeCandidate()]}
      onAssign={onAssign} onClose={onClose}
      anchorRef={{ current: anchor }}
    />
  )

  const dialog = screen.getByRole('dialog')
  expect(parseInt(dialog.style.left)).toBeLessThanOrEqual(44)
  document.body.removeChild(anchor)
})

it('flips picker above anchor when near bottom viewport edge', () => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  Object.defineProperty(window, 'innerHeight', { value: 200, writable: true, configurable: true })
  anchor.getBoundingClientRect = () => ({
    top: 150, left: 50, bottom: 180, right: 200,
    width: 150, height: 30, x: 50, y: 150, toJSON: () => ({}),
  })

  render(
    <WeekSlotPicker
      slot={makeSlot()} candidates={[makeCandidate()]}
      onAssign={onAssign} onClose={onClose}
      anchorRef={{ current: anchor }}
    />
  )

  const dialog = screen.getByRole('dialog')
  // top = 180+4 = 184, pickerMaxHeight=280, 184+280 > 200-8 → flip above
  // top = 150 - 280 - 4 = -134, clamped to 8
  expect(dialog.style.top).toBe('8px')
  document.body.removeChild(anchor)
})

it('repositions on scroll event', async () => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  let anchorTop = 100
  anchor.getBoundingClientRect = () => ({
    top: anchorTop, left: 50, bottom: anchorTop + 30, right: 200,
    width: 150, height: 30, x: 50, y: anchorTop, toJSON: () => ({}),
  })

  render(
    <WeekSlotPicker
      slot={makeSlot()} candidates={[makeCandidate()]}
      onAssign={onAssign} onClose={onClose}
      anchorRef={{ current: anchor }}
    />
  )

  const dialog = screen.getByRole('dialog')
  const initialTop = dialog.style.top

  anchorTop = 50
  fireEvent.scroll(window)

  await vi.waitFor(() => {
    expect(dialog.style.top).not.toBe(initialTop)
  })
  document.body.removeChild(anchor)
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/cms/week-slot-picker.test.tsx`
Expected: FAIL — language filter not implemented, positioning not updated.

- [ ] **Step 4: Rewrite picker positioning, add language filter, improve mobile/a11y**

In `apps/web/src/app/cms/(authed)/pipeline/_components/week-slot-picker.tsx`:

1. **Add** `LOCALE_TO_LANGUAGE` to the constants import:

```typescript
import { STAGE_ORDER, LOCALE_TO_LANGUAGE } from '@/lib/pipeline/up-next-constants'
```

2. **Replace** the `pos` state (line 27) with:

```typescript
const [pos, setPos] = useState({ top: 0, left: 0 })
const [ready, setReady] = useState(false)
```

3. **Replace** the candidate filter (lines 29-34) with a `useMemo`-wrapped version with language matching:

```typescript
const filtered = useMemo(() =>
  candidates
    .filter(item => {
      if (item.format !== slot.format) return false
      if (STAGE_ORDER[item.stage as Stage] >= STAGE_ORDER['scheduled']) return false
      if (!item.title.toLowerCase().includes(query.toLowerCase())) return false
      if (slot.channelLocale) {
        const slotLang = LOCALE_TO_LANGUAGE[slot.channelLocale] ?? slot.channelLocale
        if (item.language !== 'both' && item.language !== slotLang) return false
      }
      return true
    })
    .sort((a, b) => (STAGE_ORDER[b.stage as Stage] ?? 0) - (STAGE_ORDER[a.stage as Stage] ?? 0))
    .slice(0, 8),
  [candidates, slot.format, slot.channelLocale, query]
)
```

Add `useMemo` to the React import at the top of the file.

4. **Replace** the positioning effect (lines 88-98) with scroll/resize-aware repositioning:

```typescript
useEffect(() => {
  if (!anchorRef?.current) return
  let rafId = 0

  function reposition() {
    if (!anchorRef?.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const pickerWidth = 256
    const pickerMaxHeight = 280

    let top = rect.bottom + 4
    let left = rect.left

    if (left + pickerWidth > window.innerWidth - 8) {
      left = window.innerWidth - pickerWidth - 8
    }
    if (left < 8) left = 8

    if (top + pickerMaxHeight > window.innerHeight - 8) {
      top = rect.top - pickerMaxHeight - 4
      if (top < 8) top = 8
    }

    setPos({ top, left })
    setReady(true)
  }

  function handleScrollOrResize() {
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(reposition)
  }

  reposition()
  window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true })
  window.addEventListener('resize', handleScrollOrResize)
  return () => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('scroll', handleScrollOrResize, true)
    window.removeEventListener('resize', handleScrollOrResize)
  }
}, [anchorRef])
```

5. **Replace** the `usePortal` check and dialog div (lines 120-133):

```typescript
const usePortal = !!anchorRef?.current
const dialog = (
  <div
    ref={containerRef}
    className="fixed z-50 w-64 max-w-[calc(100vw-16px)] rounded-lg border shadow-lg"
    style={{
      background: 'var(--gem-surface-hi)',
      borderColor: 'var(--gem-border)',
      top: pos.top,
      left: pos.left,
      visibility: usePortal && !ready ? 'hidden' : 'visible',
    }}
    role="dialog"
    aria-modal="true"
    aria-label="Escolher item para slot"
    aria-describedby="picker-context"
  >
```

6. **Update** the click-outside handler to use `pointerdown` (supports touch + mouse):

Change:
```typescript
document.addEventListener('mousedown', handleClickOutside)
return () => document.removeEventListener('mousedown', handleClickOutside)
```

To:
```typescript
document.addEventListener('pointerdown', handleClickOutside)
return () => document.removeEventListener('pointerdown', handleClickOutside)
```

7. **Replace** the search input's `outline-none` with a proper focus ring:

Change:
```typescript
className="w-full rounded-md px-2 py-1.5 outline-none"
```

To:
```typescript
className="w-full rounded-md px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)]"
```

8. **Add** arrow-key navigation for the candidate list. Add a `highlightedIndex` state alongside `query`:

```typescript
const [highlightedIndex, setHighlightedIndex] = useState(-1)
```

Reset it when query changes:
```typescript
onChange={(e) => { setQuery(e.target.value); setHighlightedIndex(-1) }}
```

Add `onKeyDown` to the input:
```typescript
onKeyDown={(e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    setHighlightedIndex(i => Math.min(i + 1, filtered.length - 1))
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    setHighlightedIndex(i => Math.max(i - 1, 0))
  } else if (e.key === 'Enter' && highlightedIndex >= 0 && filtered[highlightedIndex]) {
    e.preventDefault()
    handleSelect(filtered[highlightedIndex].id)
  }
}}
```

On each candidate button, add visual highlight when index matches:
```typescript
style={{
  color: 'var(--gem-text)',
  background: i === highlightedIndex ? 'color-mix(in srgb, var(--gem-text) 8%, transparent)' : undefined,
}}
```

Where `i` is the index from `.map((item, i) => ...)`.

9. Keep the portal return at the bottom unchanged:

```typescript
if (usePortal) return createPortal(dialog, document.body)
return dialog
```

- [ ] **Step 5: Run tests**

Run: `cd apps/web && npx vitest run test/cms/week-slot-picker.test.tsx`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/week-slot-picker.tsx apps/web/test/cms/week-slot-picker.test.tsx
git commit -m "fix(pipeline): always-portal picker with viewport clamping, language filter, arrow-key nav, touch support"
```

---

### Task 5: Full verification

**Files:** None (verification only)

- [ ] **Step 1: Run all web tests**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run TypeScript check**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 3: Build**

Run: `npm run build:packages && cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 4: Visual smoke test**

Start dev server and verify in browser:
1. Week grid shows empty slots by default (no auto-assigned items)
2. Clicking "slot vazio" opens picker — picker does NOT clip behind other sections
3. Picker filters by format AND language (PT channel slot only shows PT/both items)
4. Assigning an item → optimistic update shows it immediately
5. Refreshing the page → item persists (hydration matches `scheduled_at`)
6. Swap button on filled slot opens picker, selecting new item replaces old one
7. On mobile width (< 600px), grid scrolls horizontally, picker fits within viewport
8. Arrow keys navigate the candidate list, Enter selects
9. Past days have reduced opacity but remain legible (0.4 minimum)
10. Tap on mobile opens picker correctly (`pointerdown` dismiss works on touch)

- [ ] **Step 5: Commit if any fixups needed**

Only commit if verification revealed issues not caught by earlier tasks.
