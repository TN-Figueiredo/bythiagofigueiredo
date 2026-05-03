# Newsletter Cadence & Scheduling Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simple "every N days" cadence model with rich pattern-based cadence, slot-first scheduling UX, edition kind (cadence vs special), and DANGER alerting for missed slots.

**Architecture:** New `cadence_pattern` JSONB on `newsletter_types`, `edition_kind` column on `newsletter_editions`, pure `generateCadenceSlots` function, slot picker modal for cadence editions, calendar visual overhaul with 6 slot states.

**Tech Stack:** TypeScript, Next.js 15, Supabase PostgreSQL, React 19, Tailwind 4, Vitest

---

### Task 1: Database Migrations

**Files:**
- Create: `supabase/migrations/20260503000001_newsletter_cadence_pattern.sql`
- Create: `supabase/migrations/20260503000002_newsletter_cadence_backfill.sql`

- [ ] **Step 1: Create migration 1 — schema changes**

```sql
-- Add cadence_pattern JSONB to newsletter_types
ALTER TABLE newsletter_types
  ADD COLUMN IF NOT EXISTS cadence_pattern jsonb;

-- Add edition_kind to newsletter_editions  
ALTER TABLE newsletter_editions
  ADD COLUMN IF NOT EXISTS edition_kind text NOT NULL DEFAULT 'cadence';

-- CHECK constraint for edition_kind
ALTER TABLE newsletter_editions
  ADD CONSTRAINT newsletter_editions_edition_kind_check
  CHECK (edition_kind IN ('cadence', 'special'));

-- Unique constraint: 1 cadence edition per type per slot (excluding cancelled/archived)
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_editions_cadence_slot_unique
  ON newsletter_editions (newsletter_type_id, slot_date)
  WHERE edition_kind = 'cadence' AND status NOT IN ('cancelled', 'archived');
```

- [ ] **Step 2: Create migration 2 — backfill**

```sql
-- Backfill cadence_pattern from existing cadence_days
UPDATE newsletter_types
SET cadence_pattern = jsonb_build_object('type', 'every_n_days', 'interval', cadence_days)
WHERE cadence_days IS NOT NULL AND cadence_pattern IS NULL;
```

- [ ] **Step 3: Commit**

---

### Task 2: CadencePattern Types + generateCadenceSlots Pure Function + Tests

**Files:**
- Create: `apps/web/src/lib/newsletter/cadence-pattern.ts`
- Create: `apps/web/src/lib/newsletter/cadence-slots.ts`
- Create: `apps/web/src/lib/newsletter/cadence-slots.test.ts`

- [ ] **Step 1: Write CadencePattern types**

```typescript
// apps/web/src/lib/newsletter/cadence-pattern.ts
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type CadencePattern =
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

export interface CadenceSlotOpts {
  from: string // ISO date string (YYYY-MM-DD)
  maxSlots: number
  pausedRanges?: Array<{ from: string; to: string }>
}

export interface SlotState {
  date: string
  state: 'empty_future' | 'filled' | 'sending' | 'sent' | 'failed' | 'missed' | 'cancelled'
  editionId?: string
  editionSubject?: string
}
```

- [ ] **Step 2: Write failing tests for generateCadenceSlots**

Cover: daily, daily_weekdays, weekly, biweekly, every_n_days, monthly_day (with Feb clamping), monthly_last_day, monthly_weekday, monthly_last_weekday, quarterly_day, paused ranges.

- [ ] **Step 3: Implement generateCadenceSlots**

Pure function. For monthly_day with day > daysInMonth: clamp. For paused ranges: skip dates within ranges.

- [ ] **Step 4: Write helper functions**

- `getNextSlot(pattern, after: string): string | null`
- `isSlotDate(pattern, date: string): boolean`
- `describePattern(pattern, locale: 'en' | 'pt-BR'): string`

- [ ] **Step 5: Run tests, verify all pass**

- [ ] **Step 6: Commit**

---

### Task 3: i18n Strings for New UI

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_i18n/en.ts`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_i18n/pt-BR.ts`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_i18n/types.ts`

- [ ] **Step 1: Add schedule modal/slot picker strings to types**

```typescript
// In scheduleModal or new slotPicker section:
slotPicker: {
  title: string
  subtitle: string
  selectSlot: string
  showMore: string
  allSlotsFull: string
  scheduleAsSpecial: string
  or: string
  confirm: string
  cancel: string
  slotTaken: string
  missed: string
  failed: string
}
cadenceConfig: {
  patternType: string
  daily: string
  dailyWeekdays: string
  weekly: string
  biweekly: string
  everyNDays: string
  monthlyDay: string
  monthlyLastDay: string
  monthlyWeekday: string
  monthlyLastWeekday: string
  quarterly: string
  preview: string
  nextDates: string
  sendTime: string
  noSlotsIn365: string
}
```

- [ ] **Step 2: Add en.ts values**

- [ ] **Step 3: Add pt-BR.ts values**

- [ ] **Step 4: Commit**

---

### Task 4: Hub Types Update — Slot States + Edition Kind

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-types.ts`

- [ ] **Step 1: Update ScheduleSlot to include slot state**

```typescript
export interface ScheduleSlot {
  date: string
  slots: Array<{
    typeId: string
    typeName: string
    typeColor: string
    state: 'empty_future' | 'filled' | 'sending' | 'sent' | 'failed' | 'missed' | 'cancelled'
    editionId?: string
    editionSubject?: string
    editionDisplayId?: string
    editionKind?: 'cadence' | 'special'
  }>
  specialEditions: Array<{
    id: string
    displayId: string
    subject: string
    typeColor: string
    typeName: string | null
    status: string
  }>
}
```

- [ ] **Step 2: Update ReadyEdition to include edition_kind**

- [ ] **Step 3: Update ScheduleTabData health strip**

Add `missed: number` and `failed: number` to health strip.

- [ ] **Step 4: Commit**

---

### Task 5: Hub Queries Update — Cadence Slot State Computation

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts`

- [ ] **Step 1: Import generateCadenceSlots and CadencePattern**

- [ ] **Step 2: Update fetchScheduleData to compute slot states**

For each newsletter type with a cadence_pattern:
1. Generate expected slots for the calendar range
2. Cross-reference with actual editions (by slot_date + type)
3. Determine state: missed (past + no edition + not paused), filled, sent, failed, empty_future, cancelled

- [ ] **Step 3: Compute missed and failed counts for health strip**

- [ ] **Step 4: Commit**

---

### Task 6: Slot Picker Modal Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/slot-picker-modal.tsx`

- [ ] **Step 1: Create SlotPickerModal component**

Props: `open`, `editionId`, `editionDisplayId`, `typeName`, `patternDescription`, `availableSlots: Array<{date, dayOfWeek, time, timezone}>`, `onConfirmSlot(date)`, `onSwitchToSpecial()`, `onCancel()`, `strings`

UI: Radio list of slots (6 initial), "Ver mais" button, "Agendar como edição especial" link, Confirm/Cancel.

- [ ] **Step 2: Add "all slots full" empty state**

- [ ] **Step 3: Commit**

---

### Task 7: Server Actions Update — CAS Scheduling + Edition Kind

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`

- [ ] **Step 1: Create scheduleEditionToSlot action**

CAS: update with slot_date, catch unique violation → return `{ ok: false, error: 'slot_taken' }`.

- [ ] **Step 2: Create scheduleEditionAsSpecial action**

Sets `edition_kind = 'special'`, uses `scheduled_at` without `slot_date`.

- [ ] **Step 3: Update moveEdition to handle unschedule**

When moving from `scheduled → ready`: clear both `scheduled_at` AND `slot_date`.

- [ ] **Step 4: Add getAvailableSlots action**

Computes next N available cadence slots for a given newsletter type (for the slot picker).

- [ ] **Step 5: Commit**

---

### Task 8: Calendar Visual Overhaul — Slot States + DANGER

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/month-calendar.tsx`

- [ ] **Step 1: Update calendar cell rendering for new slot states**

Replace single edition list with slot-state-aware rendering:
- `missed` → red bg, ⚠ icon, "Missed" label
- `empty_future` → dashed border, type color 30%
- `filled` → solid, type color
- `sent` → green left border, ✓
- `failed` → red bg, ✗
- `cancelled` → orange dashed, strikethrough
- Special editions → ★ badge

- [ ] **Step 2: Update click behavior**

- Future empty → pre-select that slot in picker
- Missed → open "create for this slot" flow
- Filled → navigate to editor
- Sent → navigate to analytics

- [ ] **Step 3: Commit**

---

### Task 9: Health Strip + Tab Badge DANGER States

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/schedule-tab.tsx`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-client.tsx`

- [ ] **Step 1: Update health strip to show Missed and Failed with red styling**

- [ ] **Step 2: Add red badge to Schedule tab for missed count**

- [ ] **Step 3: Commit**

---

### Task 10: Kanban Integration — Slot Picker on Ready→Scheduled

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_tabs/editorial/kanban-board.tsx`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/schedule-tab.tsx`

- [ ] **Step 1: Replace schedule modal with slot picker modal in kanban**

When dropping from ready → scheduled: open SlotPickerModal instead of ScheduleModal.

- [ ] **Step 2: Wire slot picker to scheduleEditionToSlot action**

- [ ] **Step 3: Wire "special edition" fallback to existing ScheduleModal**

- [ ] **Step 4: Wire slot picker in schedule tab (date click → pre-select slot)**

- [ ] **Step 5: Commit**

---

### Task 11: Cadence Configuration Form

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_components/cadence-pattern-form.tsx`
- Modify: Settings page (existing cadence config area)

- [ ] **Step 1: Create CadencePatternForm component**

Dropdown for pattern type + dynamic inputs per type + preview of next 6 dates.

- [ ] **Step 2: Wire to updateCadencePattern action**

- [ ] **Step 3: Add validation (must generate ≥1 slot in 365 days)**

- [ ] **Step 4: Commit**

---

### Task 12: Integration Tests + Final Verification

**Files:**
- Create: `apps/web/src/lib/newsletter/cadence-slots.test.ts` (already in Task 2)
- Modify: existing newsletter test files as needed

- [ ] **Step 1: Run full test suite**

- [ ] **Step 2: Fix any type errors or broken tests**

- [ ] **Step 3: Final commit**
