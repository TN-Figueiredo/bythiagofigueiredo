# YouTube Schedule Day-Chips UX — Design Spec

**Date:** 2026-05-26
**Status:** Approved, ready for implementation

---

## Context

The YouTube posting schedule in CMS Settings currently requires adding individual windows one at a time — each window is one row: one day + one hour + one label + a remove button. Configuring Mon/Wed/Fri at 10h requires clicking "+ Add window" three times and filling each row separately.

The approved improvement replaces per-window rows with per-group rows, where each row carries a set of day-chips that can be toggled independently.

---

## Approved Approach: Day-Chips per Schedule Group

### Current flow

N individual rows, each with: day-select + hour-input + label-input + × button.

### New flow

Each row is a **schedule group** — a set of day-chips (toggle buttons) + shared hour + shared label.

---

## Data Model

No DB changes. The `sync_schedules` column remains `jsonb` storing `SyncScheduleEntry[]`, where each entry is:

```ts
{ day: DayOfWeek; hour: number; tz: string; label: string }
```

Day-chips are a UI-only abstraction. Groups are exploded back to individual entries on save.

---

## Grouping Algorithm (load)

When loading existing `SyncScheduleEntry[]` into the UI:

1. Group entries by composite key `hour:tz`
2. Entries sharing the same `hour + tz` become one group with multiple checked days
3. Label: first non-empty label in the group wins
4. Entries with a unique `hour:tz` become a single-day group

---

## Exploding Algorithm (save)

When converting groups back to `SyncScheduleEntry[]`:

1. Each group produces N entries — one per checked day
2. All entries in the group share the same `hour`, `tz`, and `label`
3. Empty groups (zero days checked) are silently dropped

Duplicate detection is handled downstream by Zod `superRefine` on save, not at the group level.

---

## UI Layout per Group

```
[Mon][Tue][Wed][Thu][Fri][Sat][Sun]  [hour input: 10] h  [label input: "Videos semanais"]  [×]
```

- Day chips are toggle buttons — pressed state uses indigo accent
- Hours can differ between groups (each group is an independent time slot)
- Labels are per group, not per day
- At least one day must be checked per group; groups with zero days are auto-dropped on save
- No limit on the number of groups or days per group

`+ Add group` creates a new empty group with `hour: 10`, the user's default timezone, and no days checked.

---

## Up-Next Integration

No changes required. The save path writes the same `sync_schedules` JSONB format as before. `generateWeekSlots()`, `hydrateWeekSlots()`, and `deriveScheduleLabel()` all consume `SyncScheduleEntry[]` directly and remain unchanged.

---

## Files to Modify

| Action | Path | Purpose |
|--------|------|---------|
| New | `apps/web/src/lib/youtube/schedule-group.ts` | Grouping + exploding utility functions |
| New | `apps/web/test/youtube/schedule-group.test.ts` | TDD tests for grouping and exploding |
| Modified | `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx` | Replace per-window rows with day-chip groups inside `YouTubeChannelCard` |

---

## Out of Scope

- No DB migration
- No changes to `generateWeekSlots` or `hydrateWeekSlots`
- No changes to the up-next grid component
- No changes to the API route
