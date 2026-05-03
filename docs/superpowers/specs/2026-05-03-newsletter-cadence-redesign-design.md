# Newsletter Cadence & Scheduling Redesign

## Problem Statement

The current newsletter scheduling system treats all editions equally and uses a simple "every N days" cadence model with a generic calendar date picker. This fails to serve real editorial workflows where:

1. Cadences follow patterns ("1st of every month", "every Monday and Thursday") not just intervals
2. Most editions should fill cadence slots, not pick arbitrary dates
3. "Special editions" (breaking news, announcements) need a separate flow that doesn't disrupt cadence
4. Missed cadence slots are a serious deliverability/consistency problem that needs DANGER-level visibility

## Scope

**Newsletter-only.** Blog posts do NOT have cadence — blog scheduling remains a simple calendar date picker (existing behavior). The `blog_cadence` table and blog Schedule tab calendar are unaffected by this redesign. All changes below apply exclusively to the newsletter domain.

## Architecture

The redesign introduces:
- **Rich cadence patterns** stored as JSONB replacing the `cadence_days` integer on `newsletter_types`
- **Edition kind** distinguishing cadence editions (slot-bound) from special editions (free-date)
- **Slot-first scheduling UX** where cadence editions select from pre-computed available slots
- **Slot state tracking** with clear visual states (empty, filled, missed, cancelled, sent, failed)
- **DANGER alerting** for missed/failed slots with multi-surface visibility

## Cadence Pattern Model

```typescript
type CadencePattern =
  | { type: 'daily' }
  | { type: 'daily_weekdays' }
  | { type: 'weekly'; days: Weekday[] }
  | { type: 'biweekly'; day: Weekday }
  | { type: 'every_n_days'; interval: number }
  | { type: 'monthly_day'; day: number }
  | { type: 'monthly_last_day' }
  | { type: 'monthly_weekday'; week: 1 | 2 | 3 | 4; day: Weekday }
  | { type: 'monthly_last_weekday'; day: Weekday }
  | { type: 'quarterly_day'; day: number; months: [number, number, number, number] }

type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
```

### Edge Cases

- `monthly_day(31)` in February → clamps to last day of month (28 or 29)
- `monthly_day(29)` in non-leap year February → clamps to 28
- DST transitions: send time is always wall clock in site timezone; UTC conversion happens at cron execution time, not at scheduling time

### Slot Generation

`generateCadenceSlots(pattern, opts)` is a pure function:
- Input: pattern + `{ from: string; maxSlots: number; pausedRanges?: Array<{from: string; to: string}> }`
- Output: `string[]` (ISO date strings)
- Slots during paused ranges are skipped (not generated, not counted as missed)
- Max computation: 90 slots for daily, 52 for weekly, 24 for monthly, 8 for quarterly

## Edition Kind

New column `edition_kind text NOT NULL DEFAULT 'cadence'` on `newsletter_editions`:

| Kind | Behavior |
|------|----------|
| `cadence` | Must claim a slot. Unique constraint: 1 cadence edition per type per slot_date (excluding cancelled/archived). Appears in cadence health metrics. |
| `special` | Free date via calendar picker. No slot claim. Does NOT affect cadence metrics. Visually distinct on calendar. |

### Unique Constraint

```sql
CREATE UNIQUE INDEX newsletter_editions_cadence_slot_unique
  ON newsletter_editions (newsletter_type_id, slot_date)
  WHERE edition_kind = 'cadence' AND status NOT IN ('cancelled', 'archived');
```

## Slot States (Calendar Visual)

Each calendar cell for a cadence slot has one of these states:

| State | Condition | Visual |
|-------|-----------|--------|
| `empty_future` | Slot date > today, no edition assigned | Dashed border, gray |
| `filled` | Edition assigned, status = scheduled/queued | Solid, type color |
| `sending` | Status = sending | Solid, yellow pulse |
| `sent` | Status = sent | Solid, green |
| `failed` | Status = failed | Solid red, ⚠ icon |
| `missed` | Slot date < today, no edition ever assigned, not paused | RED DANGER, ⚠ icon, bold |
| `cancelled` | Had edition but was cancelled | Orange, strikethrough |

Special editions appear on their scheduled date with a distinct indicator (star/diamond badge).

## Scheduling UX Flows

### Flow A: Schedule Cadence Edition (default)

When moving a cadence edition from `ready → scheduled`:

1. Modal opens showing **Slot Picker** (not calendar)
2. Header: "Agendar edição #004 · [Type Name]"
3. Body: List of next available slots (6 initially)
4. Each slot: radio button + date formatted + send time + timezone
5. "Ver mais" button loads +10 more slots (up to cap)
6. Footer: "Agendar como edição especial" link → switches to Flow B
7. Confirm → CAS update with slot_date claim

```
┌──────────────────────────────────────┐
│ Agendar edição #004                  │
│ Tech Newsletter · Mensal, dia 1      │
│                                      │
│ Selecione o slot:                    │
│                                      │
│  ○ 1 Jun 2026 · dom · 08:00 BRT     │
│  ○ 1 Jul 2026 · ter · 08:00 BRT     │
│  ○ 1 Ago 2026 · sáb · 08:00 BRT     │
│  ○ 1 Set 2026 · ter · 08:00 BRT     │
│  ○ 1 Out 2026 · qui · 08:00 BRT     │
│  ○ 1 Nov 2026 · dom · 08:00 BRT     │
│                                      │
│  [Ver mais]                          │
│                                      │
│ ── ou ──                             │
│ Agendar como edição especial →       │
│                                      │
│              [Cancelar] [Confirmar]   │
└──────────────────────────────────────┘
```

**All slots full:** Shows "Todos os slots dos próximos X meses estão preenchidos" + direct link to "Agendar como edição especial".

### Flow B: Schedule Special Edition

When user clicks "Agendar como edição especial" or the edition has `edition_kind = 'special'`:

1. Full calendar/date picker (existing modal with timezone)
2. If a cadence slot exists on the chosen date, warning: "Já existe uma edição de cadência agendada para este dia. Confirmar envio duplo?"
3. No slot_date claim — just `scheduled_at` timestamp

### Flow C: Unschedule

Moving `scheduled → ready`:
- Clears `scheduled_at` and `slot_date`
- Slot becomes `empty_future` again (available in picker)
- No "missed" state — only applies to past dates with no edition ever assigned

## Missed Slot Detection

A slot is "missed" when:
- `slot_date < today`
- No edition with `edition_kind='cadence'` and `slot_date = X` exists (any status)
- The cadence was NOT paused on that date

### DANGER Surfaces (3 places)

1. **Calendar cell**: Red background, ⚠ icon, "Missed" label
2. **Health strip metric**: "X Missed" counter in red (alongside Fill Rate, Next 7 Days, etc.)
3. **Tab badge**: Schedule tab shows red badge count of missed slots (current quarter)

## Cadence Configuration UX

In `/cms/newsletters/settings` per newsletter type:

1. Dropdown: pattern type (Daily, Weekdays, Weekly, Biweekly, Every N days, Monthly day, Monthly last day, Monthly weekday, Monthly last weekday, Quarterly)
2. Dynamic inputs based on selection:
   - Weekly → multi-select weekdays
   - Monthly day → number input (1-31)
   - Monthly weekday → week selector (1st/2nd/3rd/4th) + weekday selector
   - Quarterly → day + 4 month selectors
3. Preview: "Próximas datas: Jun 1, Jul 1, Ago 1, Set 1, Out 1, Nov 1"
4. Send time input (HH:MM) + timezone display (from site)
5. Validation: pattern must generate ≥ 1 slot in next 365 days

### Migration from cadence_days

- If `cadence_pattern IS NULL` but `cadence_days IS NOT NULL`:
  - Treated as `{ type: 'every_n_days', interval: cadence_days }`
  - Settings page shows this and allows switching to richer pattern
- Once `cadence_pattern` is set, it takes precedence over `cadence_days`

## Timezone Semantics

- `preferred_send_time` on `newsletter_types` is ALWAYS in site timezone (`sites.timezone`)
- Slot picker displays: "08:00 BRT" (or whatever the site timezone abbreviation is)
- Cron converts `slot_date + preferred_send_time + site_timezone → UTC` at execution time
- If DST changes between scheduling and sending, the send still happens at the correct wall clock time

## Concurrency (CAS)

Scheduling a cadence edition:
```sql
UPDATE newsletter_editions
SET status = 'scheduled',
    slot_date = $slot_date,
    scheduled_at = $computed_utc_timestamp,
    edition_kind = 'cadence'
WHERE id = $edition_id
  AND status = 'ready';
```

The unique partial index `newsletter_editions_cadence_slot_unique` prevents double-booking. If violated, the action returns `{ ok: false, error: 'slot_taken' }` and the UI refreshes available slots.

## Analytics Separation

- **Cadence metrics** (health score, fill rate, consistency): Only `edition_kind = 'cadence'`
- **Special edition metrics**: Tracked separately, shown in overview but not in cadence health
- **Deliverability metrics** (bounce rate, complaint rate): Both kinds contribute (it's the same sender reputation)

## State Machine

```
create → draft → ready ─┬─→ scheduled (cadence, with slot_date) ─→ sending → sent
                         │         ↕ (unschedule)                         ↓
                         │       ready                                   failed
                         │
                         └─→ scheduled (special, free date) ─→ sending → sent
                                   ↕ (unschedule)                      ↓
                                 ready                                failed

Any state → cancelled (terminal for slot purposes)
Any state → archived (terminal)
```

Valid transitions from `ready`:
- `ready → scheduled`: MUST choose slot (cadence) or date (special)
- Cannot go directly to `sending` — must be scheduled first

Valid transitions from `scheduled`:
- `scheduled → ready`: unschedule (frees slot)
- `scheduled → sending`: cron picks up (automated)
- `scheduled → cancelled`: manual cancel

## DB Schema Changes

### Migration 1: Add cadence_pattern and edition_kind

```sql
-- Add cadence_pattern JSONB to newsletter_types
ALTER TABLE newsletter_types
  ADD COLUMN IF NOT EXISTS cadence_pattern jsonb;

-- Add edition_kind to newsletter_editions
ALTER TABLE newsletter_editions
  ADD COLUMN IF NOT EXISTS edition_kind text NOT NULL DEFAULT 'cadence'
  CHECK (edition_kind IN ('cadence', 'special'));

-- Unique constraint: 1 cadence edition per type per slot
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_editions_cadence_slot_unique
  ON newsletter_editions (newsletter_type_id, slot_date)
  WHERE edition_kind = 'cadence' AND status NOT IN ('cancelled', 'archived');
```

### Migration 2: Backfill cadence_pattern from cadence_days

```sql
UPDATE newsletter_types
SET cadence_pattern = jsonb_build_object('type', 'every_n_days', 'interval', cadence_days)
WHERE cadence_days IS NOT NULL AND cadence_pattern IS NULL;
```

## Package Changes

`@tn-figueiredo/newsletter` gains:
- `CadencePattern` type export
- `generateCadenceSlots(pattern, opts)` function (replaces/extends `generateSlots`)
- `getNextSlot(pattern, after: string)` helper
- `isSlotDate(pattern, date: string)` validator
- `describePattern(pattern, locale)` → human-readable string ("Todo dia 1", "Seg e Qui")

The existing `generateSlots` (used by blog cadence) remains unchanged and is NOT affected by this redesign. Blog cadence uses the old interval-based model independently.

## Health Strip Changes (Schedule Tab)

Current: `Fill Rate | Next 7 Days | Conflicts | Active Types`

New: `Fill Rate | Next 7 Days | Missed (DANGER) | Failed (DANGER) | Active Types`

- "Missed" shows in red when > 0
- "Failed" shows in red when > 0
- Both contribute to overall health score degradation

## First-Run Experience

When cadence is configured but no editions exist:
- Schedule tab shows cadence calendar with empty future slots
- Empty state message: "Cadência configurada. Próximo slot: [date]. Crie uma edição e agende."
- CTA button: "Criar edição" → navigates to `/cms/newsletters/new`

## Send Window

`preferred_send_time` per type remains. The slot picker shows this time alongside each date. If the admin wants to override send time for a specific edition, they can do so after scheduling (edit the `scheduled_at` timestamp directly in the edition editor — future enhancement, not MVP).

## Newsletter Schedule Tab Calendar Changes

The calendar currently shows editions as colored bars with a status dot. With this redesign:

### Calendar Cell Rendering

Each cell may contain:
1. **Cadence slot indicators** — generated from the pattern for that type. One slot per type per date (if applicable).
2. **Edition cards** — actual editions scheduled on that date.
3. **Special edition cards** — visually distinct (star badge) from cadence cards.

### Visual Language

| Element | Appearance |
|---------|------------|
| Future empty cadence slot | Dashed border, type color at 30% opacity, type name label |
| Filled cadence slot | Solid background type color at 20%, edition subject, type dot |
| Sent cadence slot | Green left border, edition subject, ✓ icon |
| Missed cadence slot | Red background at 15%, red border, "Missed" label, ⚠ icon |
| Failed cadence slot | Red background, edition subject, ✗ icon |
| Cancelled cadence slot | Orange dashed border, strikethrough subject |
| Special edition | Type color dot + ★ badge, edition subject |

### Click Behavior

- Clicking a future empty slot → opens slot picker modal pre-selecting that slot
- Clicking a filled slot → navigates to edition editor
- Clicking a missed slot → opens "Create edition for this slot" flow
- Clicking a past sent slot → navigates to edition analytics

### Health Strip (revised)

```
Fill Rate | Next 7 Days | Missed ⚠ | Failed ⚠ | Active Types
  78%     |      3      |    2     |    0     |    3/4
```

- Missed > 0 → red background on that metric cell
- Failed > 0 → red background on that metric cell
- Both contribute negatively to Fill Rate percentage

## Newsletter Hub Integration

### Tab Badge

The "Schedule" tab in the newsletter hub gains a red badge showing missed slot count (current quarter). This ensures admins see the problem even if they don't visit the Schedule tab.

### Overview Tab

The overview health gauge dimensions gain a "Consistency" factor that accounts for cadence fill rate and missed slots. A newsletter with 2+ missed slots in the last quarter gets a health penalty.

## Open Decisions

None. All decisions resolved in this spec.

## Out of Scope (Future)

- Push notifications to admin for missed slots (Sprint 7+)
- AI-suggested best send time based on open rate analysis
- Auto-generation of draft editions for upcoming cadence slots
- Per-edition send time override (edition editor enhancement)
- Multi-timezone send (send at subscriber's local time)
- Blog cadence pattern upgrade — blog has no cadence concept; posts schedule via free date picker only
- Blog `blog_cadence` table refactor — existing interval-based model stays as-is for fill rate computation
