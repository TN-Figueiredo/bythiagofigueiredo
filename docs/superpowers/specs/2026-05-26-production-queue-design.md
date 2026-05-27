# Production Queue — Design Spec

**Date:** 2026-05-26
**Status:** Approved design, pending implementation
**Replaces:** Current "Up Next" publish-calendar paradigm
**Review:** 3 rounds, 24 sub-agents, 8 domain-verified spec sections

## Philosophy

The Up Next grid transforms from a "publish calendar" (what goes live this week) into a **production queue** (what to work on next). If 2 months are already scheduled, Up Next shows what to prepare for month 3+.

---

## 1. Buffer Depth Scanning

### Algorithm

Loop `generateWeekSlots` + `hydrateWeekSlots` 16 times, advancing `weekStart` by 7 days per iteration. Partition non-rest slots by format (`video`, `blog_post`, `newsletter`). Compute coverage over a 4-week sliding window anchored at each format's first empty slot.

```typescript
interface BufferDepthResult {
  format: 'video' | 'blog_post' | 'newsletter'
  coverage: number          // 0.0–1.0
  level: 'green' | 'yellow' | 'red'
  firstEmptyDate: string | null
  totalSlots: number
  filledSlots: number
  windowWeeks: number       // always 4
}

function scanBufferDepth(input: {
  syncSchedules: SyncScheduleWithChannel[]
  blogCadence: BlogCadenceRow | null
  newsletterEditions: NewsletterEditionRow[]  // 16-week fetch
  pipelineItems: PipelineItemWithSlot[]
  siteTimezone: string
  today: string
  horizonWeeks?: number  // default 16
  windowWeeks?: number   // default 4
}): BufferDepthResult[]
```

**Coverage thresholds:**

| Coverage | Level | Meaning |
|----------|-------|---------|
| >= 75% | green | Healthy pipeline |
| 40–74% | yellow | Gaps emerging |
| < 40% | red | Critical shortage |

### Required Fixes

**Blog cadence while-loop** (`generate-week-slots.ts:103-127`): Currently produces at most 1 slot per call. The while-loop advances `nextPub` to `>= todayDate` then checks if that single date falls `inWeek`. For weeks 3-16, it never finds a match.

**Fix:** After fast-forwarding past `todayDate`, continue advancing `nextPub` until `> weekEndDate`, emitting a slot for each date that falls within `[weekStartDate, weekEndDate]`.

**Newsletter fetch window** (`up-next-fetcher.ts:62-67`): Currently fetches a 2-week window. The buffer scanner needs a separate 16-week query: `.gte('scheduled_at', today).lt('scheduled_at', today + 112 days)`. Keep `fetchUpNextData` unchanged — the scanner owns its own data requirements.

### Data Flow

| Component | Status |
|-----------|--------|
| `generateWeekSlots()` | Reuse, call 16x with advancing weekStart |
| `hydrateWeekSlots()` | Reuse unchanged |
| `fetchUpNextData()` | Unchanged — scanner has own entry point |
| Newsletter editions query | New query with 16-week window |
| `scanBufferDepth()` | New pure function |

**Implementability: 72/100** — blog cadence fix touches production-critical slot generation, needs careful test coverage.

---

## 2. Urgency Formula

### Current State

Two independent ranking systems exist:
1. `calculateTodayActions` — categorical urgency (`overdue|today|tomorrow|this_week`), coarse bucket sort
2. `suggestForSlot` — `stageScore = STAGE_ORDER[stage] * 10`, no deadline awareness

Neither produces a continuous numeric score.

### Formula

```
score = daysUntilDeadline / stageRatio
```

- `daysUntilDeadline` = `diffInCalendarDays(deadline, today)` — can be negative
- `deadline` = `getProductionDeadline(pubDate, item.stage)` — stage-specific lead time
- `stagesRemaining` = `STAGE_ORDER['scheduled'] - STAGE_ORDER[item.stage]` — range 1-8
- `stageRatio` = `stagesRemaining / totalStages` — range (0, 1]
- `totalStages` = 8 (stages before `scheduled`)
- **Effort removed from formula** — used only as same-score tiebreaker

Lower score = more urgent.

```typescript
interface UrgencyScore {
  score: number
  daysUntilDeadline: number
  stageRatio: number
  stagesRemaining: number
  totalStages: number
  deadline: string
  effort: 'deep' | 'medium' | 'quick'
  effortMinutes: number
}

function computeUrgencyScore(
  item: Pick<PipelineItemWithSlot, 'stage' | 'format' | 'duration_target'>,
  pubDate: string,
  today: string,
): UrgencyScore | null
```

### Edge Cases

| Condition | Behavior |
|-----------|----------|
| `stagesRemaining === 0` | `score = +Infinity` (not actionable) |
| `daysUntilDeadline <= 0` | Keep raw negative score (preserves relative ordering among overdue items) |
| `getProductionDeadline` returns `undefined` | Return `null` |
| No assigned pubDate (orphan) | Cannot be scored — appears in separate unscheduled backlog |

### Sort Order

```
primary:     urgencyScore ASC (lower = more urgent)
tiebreaker1: effort tier ASC (deep > medium > quick)
tiebreaker2: priority DESC
tiebreaker3: pubDate ASC
```

### Integration

- Add `urgencyScore: number` to `TodayAction` (keep categorical `urgency` for UI badges)
- Replace multi-key sort in `calculateTodayActions` (lines 349-376)
- `suggestForSlot` adopts urgencyScore for deadline-aware ranking

### Known Tension

`getProductionDeadline` lead times are video-centric (gravacao/edicao don't apply to blog/newsletter). May need format-aware `totalStages` counting only applicable stages in Phase 2.

**Implementability: 88/100**

---

## 3. Today Actions (Queue View)

### Transformation

Replace cadence-gap approach with urgency-sorted production queue. Show top N items ranked by urgency score, grouped by urgency level:

- **Overdue** (deadline passed) — red badge
- **Today** (deadline is today) — amber badge
- **This week** (deadline within 7 days) — default
- **Upcoming** (beyond 7 days) — dimmed

Items without pubDate appear in a separate "Unscheduled Backlog" section below.

---

## 4. Pinned Queue (Working Today)

### Migration

Table `working_today` with RLS, pin/unpin RPCs, cap enforcement.

```sql
CREATE TABLE IF NOT EXISTS public.working_today (
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_item_id uuid        NOT NULL REFERENCES public.content_pipeline(id) ON DELETE CASCADE,
  pinned_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pipeline_item_id)
);

CREATE INDEX IF NOT EXISTS idx_working_today_user_date
  ON public.working_today (user_id, pinned_at);
```

**RLS:** User-scoped (`user_id = auth.uid()`). INSERT requires `is_staff()`.

**Pin RPC** (`pin_working_today(p_item_id, p_max DEFAULT 3)`):
1. Purge stale entries (`pinned_at::date < current_date`)
2. Check count against cap (`LEAST(p_max, 5)`)
3. Idempotent insert (`ON CONFLICT DO NOTHING`)
4. Returns JSON with pin status

**Unpin RPC** (`unpin_working_today(p_item_id)`): Simple delete with auth check.

### Auto-clear

On-load purge — no cron needed. Both the pin RPC and the Up Next API fetch run:
```sql
DELETE FROM working_today WHERE user_id = auth.uid() AND pinned_at::date < current_date;
```

### Cap Enforcement (3 layers)

| Layer | Mechanism |
|-------|-----------|
| UI | Disable pin button at `pins.length >= cap` |
| Server action | Count check before RPC |
| RPC | Atomic `v_count >= v_cap` inside transaction |

Hard ceiling: `LEAST(p_max, 5)` prevents cap > 5 regardless of client input.

### Auto-suggest

When `pinnedItems.length === 0`, show top 2 urgency-ranked items as ghost cards with "Pin" action. Does NOT auto-insert — "suggest, don't auto-assign."

### TypeScript

```typescript
interface WorkingTodayPin {
  user_id: string
  pipeline_item_id: string
  pinned_at: string
}

// Server actions
async function pinWorkingToday(itemId: string): Promise<ActionResult>
async function unpinWorkingToday(itemId: string): Promise<ActionResult>
async function getWorkingTodayPins(): Promise<PinnedItem[]>
```

**Implementability: 92/100**

---

## 5. Velocity Learning

### Data Source

`content_pipeline_history` records stage transitions via `trg_pipeline_stage_change` trigger. Key columns: `pipeline_id`, `from_value`, `to_value`, `changed_at`, `event_type`.

**Critical:** Filter `event_type = 'stage_change'` only — API routes also insert `stage_changed`/`graduated` for the same transition, causing double-counting.

### New Index

```sql
CREATE INDEX IF NOT EXISTS idx_pipeline_history_velocity
  ON public.content_pipeline_history (event_type, changed_at DESC)
  WHERE event_type = 'stage_change';
```

### Query

Fetch last 90 days of `stage_change` events, JOIN `content_pipeline` for `format` and `site_id`. Group by `pipeline_id`, compute duration between consecutive `changed_at` timestamps for each `from_value -> to_value` pair. Aggregate by `format:stage` key.

### Interfaces

```typescript
interface VelocityEntry {
  medianMinutes: number
  p90Minutes: number
  sampleCount: number
  effectiveMinutes: number  // blended cold-start result
}

type VelocityMap = Record<string, VelocityEntry>  // key: "video:roteiro"
```

### Cold Start Blending

```typescript
const COLD_START_MIN = 5
const COLD_START_MAX = 20

function blendVelocity(learned: number, default_: number, samples: number): number {
  if (samples >= COLD_START_MAX) return learned
  if (samples < COLD_START_MIN) return default_
  const t = (samples - COLD_START_MIN) / (COLD_START_MAX - COLD_START_MIN)
  const w = 0.25 + 0.75 * t
  return Math.round(w * learned + (1 - w) * default_)
}
```

Defaults from existing `EFFORT_DEFAULTS` in `up-next-constants.ts` (21 entries, all format:stage combos).

### P90 Outlier Trim

Sort durations ascending, keep only <= P90 index, compute median of trimmed set.

### Integration with `getProductionDeadline()`

Add optional `velocityMap` and `format` params (backward-compatible). Sum `effectiveMinutes` from current stage through `ready`, convert to calendar days (8h workday).

### Cache

```typescript
import { unstable_cache } from 'next/cache'

const fetchVelocityMap = unstable_cache(
  async (siteId: string): Promise<VelocityMap> => { /* query + compute */ },
  ['velocity-map'],
  { tags: ['pipeline', 'velocity'], revalidate: 3600 }
)
```

Invalidate via `revalidateTag('velocity')` on stage-change API routes.

### Known Limitations

- No `format`/`site_id` on history table — requires JOIN (acceptable for small table)
- System is ~17 days old — likely < 5 completed items per format:stage. Will run on 100% defaults initially
- Wall-clock time, not work time — weekends inflate durations. P90 trim mitigates.

**Implementability: 82/100**

---

## 6. WIP Limits

### Existing Infrastructure

`STAGE_GROUP` already exists in `up-next-constants.ts` with exact groups:

| Group | Stages | Default Limit |
|-------|--------|---------------|
| `escrever` | idea, outline, draft, roteiro | 5 |
| `gravar` | gravacao | 2 |
| `pos-prod` | edicao, pos_producao, ready | 3 |
| `prontos` | scheduled | unlimited |

`stageCounts` already computed in `up-next-fetcher.ts:175-178` and rendered as colored dot pills.

### Implementation

```typescript
type StageGroupId = 'escrever' | 'gravar' | 'pos-prod' | 'prontos'

const DEFAULT_WIP_LIMITS: Record<StageGroupId, number | null> = {
  escrever: 5,
  gravar: 2,
  'pos-prod': 3,
  prontos: null,
}

type WipStatus = 'ok' | 'amber' | 'red'

function getWipStatus(count: number, limit: number | null): WipStatus {
  if (limit === null) return 'ok'
  if (count >= limit * 2) return 'red'
  if (count >= limit) return 'amber'
  return 'ok'
}
```

**Storage:** localStorage key `pipeline:wip-limits` — `Partial<Record<StageGroupId, number | null>>` merged over defaults.

**UI:** Extend existing stage-count pills with conditional amber/red styling and `count/limit` display.

**Suggestion integration:** `findWipViolation` runs client-side (limits are localStorage), slots in as position 1 of the suggestion priority chain.

**Implementability: 88/100**

---

## 7. Mode Inference

### Algorithm

```typescript
type WorkMode = 'escrever' | 'gravar' | 'pos-prod'

interface ModeInferenceResult {
  mode: WorkMode | null
  confidence: number  // 0.0–1.0
  label: string | null
  counts: Record<WorkMode, number>
}

function inferCurrentMode(input: {
  items: Array<{ stage: Stage; urgency?: string }>
}): ModeInferenceResult
```

Count urgent items by `STAGE_GROUP`. If one group has > 40% of items, it's the dominant mode. Display as subtle label: "Modo Escrita (65%)".

### Urgency Bypass

Overdue and today items always show regardless of mode filtering.

### Phase 2

Manual selector with 4 segments: `[Auto] [Escrita] [Gravacao] [Pos]`. Stored in localStorage `pipeline:mode-override`.

**Implementability: 82/100**

---

## 8. Deadline Notifications

### Cron Endpoint

**Route:** `apps/web/src/app/api/cron/pipeline-deadline-digest/route.ts`
**Schedule:** `0 7 * * *` (daily 07:00 UTC)
**Auth:** `Bearer ${CRON_SECRET}`

**Logic:**
1. Fetch active pipeline items (`stage NOT IN ('scheduled', 'published')`, `scheduled_at IS NOT NULL`)
2. Derive deadlines via `getProductionDeadline()`
3. Bucket into: overdue, due_tomorrow, due_in_3_days
4. Dedup via `sent_emails` table
5. Send single digest email via `ResendEmailAdapter`
6. Insert in-app notification

### Email Template

`apps/web/src/emails/pipeline-deadline-digest.tsx` using existing `EmailShell`, `EmailButton`, `EmailDivider`, `EmailFooter`, `EmailMonogram`. Three sections with color-coded accent borders (red/orange/yellow). Bilingual pt-BR/en.

### Dedup

Partial unique index on existing `sent_emails` table:
```sql
CREATE UNIQUE INDEX sent_emails_pipeline_digest_daily
  ON sent_emails (site_id, template_name, (sent_at AT TIME ZONE 'UTC')::date)
  WHERE template_name = 'pipeline-deadline-digest';
```

Insert uses `ON CONFLICT DO NOTHING` — same pattern as contact autoreply dedup.

### In-App Badge

Extend existing `SidebarBadgeData` with `pipeline` field:
```typescript
pipeline: {
  overdue: number
  dueSoon: number
  urgency: UrgencyBadge | null
}
```

Reuses existing `computeUrgencyColor()`, `UrgencyTooltip`, `BadgePortal` from sidebar badge system.

### Not Used

`@tn-figueiredo/notifications` (v0.1.0) — designed for Expo push, not email digests. The `sent_emails` table is the correct mechanism.

**Implementability: 92/100**

---

## 9. Suggestions Panel

### Current Chain (verified)

```typescript
selectSuggestion(input) =
  findBatchOpportunity()    // 2+ items in same stage
  ?? findOrphanedItems()    // items with no channel
  ?? findNewsletterWithoutDate()
  ?? findNearlyCompletePlaylist()
```

### New Chain

```typescript
selectSuggestion(input) =
  findWipViolation()        // NEW — over-limit stage groups
  ?? findOrphanedItems()    // moved up from #2
  ?? findBatchOpportunity() // demoted from #1 to #3
  ?? findNearlyCompletePlaylist()
  ?? findBufferGap()        // NEW — format with <40% coverage
```

**New finders:**
- `findWipViolation(items, config)` — runs client-side (limits in localStorage)
- `findBufferGap(weekSlots, nextWeekEmpty, threshold)` — uses `nextWeekEmpty` already in `UpNextApiResponse`

**Interface change:** `SuggestionInput` needs `weekSlots` and `nextWeekEmpty` — both already computed in the fetcher at call site.

**Implementability: 82/100**

---

## 10. Layout & Mobile Strategy

### Desktop (>= 1024px) — 5 Sections

```
+================================================================+
| [CmsTopbar: "Production Queue"]                          ~40px |
+================================================================+
| SECTION 1: Health Header                                 ~48px |
| [Video: 3/5] [Blog: 1/2] [News: 0/1]       WIP: 4/6         |
+----------------------------------------------------------------+
| SECTION 2: Pinned Queue (collapsible)              0-5 x ~80px |
| [v] Pinned (2)                                                 |
| +--card--+ +--card--+                                          |
+----------------------------------------------------------------+
| SECTION 3: Urgency Queue (scrollable)                          |
| -- Overdue (1) -- +--card--+                                   |
| -- Today (2) ---- +--card--+ +--card--+                        |
| -- This Week (3)  +--card--+ +--card--+ +--card--+             |
+----------------------------------------------------------------+
| SECTION 4: Week Grid (collapsed if buffer >= 80%)    ~200px    |
| [>] Week Grid  4/7 filled                                     |
+----------------------------------------------------------------+
| SECTION 5: Suggestions + Activity (collapsible)      ~280px    |
+================================================================+
```

**Total:** ~700-1400px depending on content (under 1600px target).

### Mobile (< 1024px) — Tab-based

```
[Queue] [Grid] [Health]
```

- **Queue tab:** Pinned cards + urgency groups (stacked)
- **Grid tab:** Week grid (h-scroll, 840px) + slot assignment
- **Health tab:** Buffer pills + WIP + suggestions + playlist panel

### Collapse/Expand Behavior

| Section | Default | Collapse trigger |
|---------|---------|-----------------|
| Pinned queue | Expanded | User click (chevron) |
| Urgency queue | Expanded | Never (scrollable) |
| Week grid | Collapsed if buffer >= 80% | User click or threshold |
| Suggestions | Collapsed | User click (existing) |
| Activity | Collapsed | User click (existing) |

### Components Reused

| Section | Existing Component | Modifications |
|---------|-------------------|---------------|
| Buffer pills | NEW | Compute from scanBufferDepth |
| WIP indicators | Extend existing stage-count pills | Add amber/red styling |
| Pinned queue | Reuse `ActionCard` | Add collapsible wrapper |
| Urgency queue | Reuse `ActionCard` | Group by urgency level with headers |
| Week grid | `UpNextThisWeek` | Add collapsible wrapper |
| Suggestions | `PlaylistSuggestionPanel` | Already collapsible |
| Mobile tabs | NEW | Tab container with state |

### Design System

Custom `gem-design.ts` — CSS custom properties, `gemMix()` utility, Lucide icons, `motion-safe:transition-*`, `min-h-[44px]` touch targets. No shadcn/Radix dependency.

**Implementability: 68/100** — most existing components reusable, but mobile tabs and buffer pills are new.

---

## 11. Bug Fixes (Ship with Phase 1)

### Bug 1: `scheduledAt` timezone drift (HIGH PRIORITY)

**File:** `apps/web/src/app/api/pipeline/up-next/route.ts:58-61`

`new Date('2026-05-28T09:00:00')` is local time on dev but UTC on Vercel. Creates 3h drift.

**Fix:**
```typescript
import { fromZonedTime } from 'date-fns-tz'

const localDateStr = `${slotDay}T${slotHour || '00:00'}:00`
const utcDate = fromZonedTime(localDateStr, SITE_TIMEZONE)
const scheduledAt = formatInTimeZone(utcDate, SITE_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX")
```

### Bug 2: Phantom blog action non-UUID ID

**File:** `apps/web/src/lib/pipeline/calculate-today-actions.ts:227`

`id: 'blog-cadence-2026-05-28'` fails `z.string().uuid()` validation on slot assignment.

**Fix:** Add `isPhantom?: boolean` to `TodayAction`. Set `isPhantom: true` when no real item exists. UI disables "assign to slot" and shows "Create blog post first" CTA.

### Bug 3: `sync_enabled` filter missing

**File:** `apps/web/src/lib/pipeline/up-next-fetcher.ts:49-53`

All other consumers (5 crons) filter `.eq('sync_enabled', true)`. Fetcher doesn't.

**Fix:** Add `.eq('sync_enabled', true)` to the channels query.

### Bug 4: `doneToday` counts backward transitions

**File:** `apps/web/src/lib/pipeline/up-next-fetcher.ts:69-75,141`

No direction filter on history query. Retreats (`ready -> draft`) count as progress.

**Fix:** Add `event_type = 'stage_change'` filter, fetch `from_value`/`to_value`, filter to `STAGE_ORDER[from] < STAGE_ORDER[to]`.

**Confidence: 92/100** — all 4 bugs verified with exact line numbers.

---

## 12. Implementation Phases

### Phase 1 — Core Queue (~20h)

- Bug fixes 1-4 (ship immediately)
- Urgency formula (`computeUrgencyScore`)
- Today Actions queue view (urgency-grouped)
- Buffer depth scanning (`scanBufferDepth`)
- Buffer health pills in header
- Blog cadence multi-week fix

### Phase 2 — Intelligence (~15h)

- Velocity learning (query, blend, cache)
- WIP limits (client-side, pill styling)
- Mode inference
- Enhanced suggestions (WIP violation, buffer gap finders)

### Phase 3 — Engagement (~10h)

- Pinned queue (migration, RPC, UI)
- Deadline notification cron + email template
- Sidebar badge integration
- Mobile tabs
- Week grid conditional collapse

---

## 13. New DB Objects Summary

| Object | Type | Phase | Migration |
|--------|------|-------|-----------|
| `working_today` | Table + RLS + RPCs | 3 | Yes |
| Velocity index | Partial index on history | 2 | Yes |
| Digest dedup index | Partial index on sent_emails | 3 | Yes |
| Total migrations | | | 3 |

---

## 14. Data Flow (Final)

```
fetchUpNextData() → 7 parallel queries (existing)
  + velocityQuery (Phase 2, cached 1h)
  + workingTodayQuery (Phase 3)

→ scanBufferDepth() per content type (Phase 1)
    → generateWeekSlots() x16 (fixed blog cadence)
    → hydrateWeekSlots() x16
    → computeCoverage()

→ computeUrgencyScore() per item (Phase 1)
→ sortByUrgency() → urgency queue (Phase 1)

→ inferCurrentMode() → focus label (Phase 2)
→ checkWipLimits() → header badges (Phase 2)
→ selectSuggestion() → suggestion banner (Phase 2)

→ getWorkingTodayPins() → pinned section (Phase 3)
```

All new computations are pure functions on existing data except:
- Velocity: cached query (Phase 2)
- Pinned queue: 1 new table (Phase 3)
- Notifications: 1 new cron (Phase 3)
