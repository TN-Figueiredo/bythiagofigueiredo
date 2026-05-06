# Timezone Handling Redesign

**Date:** 2026-05-06
**Status:** Design approved, pending implementation plan
**Scope:** CMS-wide timezone awareness — all scheduling, display, and calendar surfaces

## Problem

The admin is relocating from Brazil to Southeast Asia (UTC+7). The CMS currently has no consistent timezone handling:

1. **UTC date bug** — `new Date().toISOString().split('T')[0]` returns the UTC date, not the site date. After 21:00 BRT (00:00 UTC+1d), "today" jumps to tomorrow. This breaks the schedule calendar's today highlight, overdue detection, and agenda grouping.
2. **Browser-local rendering** — `scheduledDate.toLocaleTimeString()` in `contextual-banner.tsx` renders in the browser's timezone, so a newsletter scheduled for "May 7 at 14:30 BRT" displays as "May 8 at 12:30 AM" to an admin in Bangkok.
3. **Per-entry timezone picker** — The newsletter schedule modal (`schedule-modal.tsx`) defaults to `Intl.DateTimeFormat().resolvedOptions().timeZone` (browser local) and lets the user pick per-entry, creating inconsistency.
4. **No site timezone visibility** — There's no settings UI to view or change the site timezone, no dual-clock display, and no indication that schedules anchor to a specific timezone.
5. **Overdue false positives** — Blog posts near their slot time and already-sent newsletters can be flagged overdue because comparison uses UTC-derived "today."

## Design Principles

- **Site timezone is the single anchor.** All schedules (blog publishing, newsletter sending, YouTube sync, crons) anchor to `sites.timezone`. The admin's browser timezone is informational only.
- **Dual display everywhere.** Date+time displays show site time (bold, with BRT abbreviation badge) and local time (muted, with ICT abbreviation) side-by-side.
- **Relative times are untouched.** "2 hours ago", "in 3 days", countdown timers — these are timezone-agnostic and don't need changes.
- **Wall-clock storage.** `preferred_send_time` stays as `time without time zone`. Conversion to `timestamptz` happens at scheduling time via `computeScheduledAt(slotDate, sendTime, siteTimezone)`.

## Formatting Decision Matrix

| Display type | Example | Timezone treatment | Change needed |
|---|---|---|---|
| Relative time | "2h ago", "in 3 days" | Timezone-agnostic | None |
| Date only | "May 7, 2026" | Unambiguous at day scale | None |
| Countdown | "Sends in 4h 23m" | Computed from UTC diff | None |
| **Date + time** | "May 7 at 14:30" | **Site tz bold + local muted** | **Yes** |
| **Time only** | "14:30" | **Site tz badge + local in tooltip or inline** | **Yes** |
| "Today"/"Tomorrow" | Schedule calendar | **Computed from site tz, not browser** | **Yes — bug fix** |

## Schema Changes

### `sites.timezone` — already exists

```sql
-- Already in schema (migration 20260507000001):
"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL
```

No migration needed for the column. The timezone picker writes to this column.

### No new columns

`preferred_send_time` (`time without time zone`) on `newsletter_types` and `blog_cadence` remains as-is — wall-clock time in site timezone, converted at scheduling time. No per-entry timezone columns needed.

## New Utility: `formatSiteDateTime()`

**Location:** `apps/web/lib/cms/format-site-datetime.ts`

Centralized formatter for all absolute date+time displays in the CMS. Supplements (does NOT replace) existing relative formatters like `formatRelativeDate()` and `formatRelativeTime()`.

```typescript
interface FormatSiteDateTimeOpts {
  mode?: 'full' | 'short' | 'time-only'
  includeLocal?: boolean   // default true
  includeSeconds?: boolean // default false
}

interface FormatSiteDateTimeResult {
  primary: string    // "May 7, 2026 at 14:30 BRT"
  local: string      // "May 8 at 01:30 ICT"
  crossDay: boolean  // true when site date !== local date
  tooltip: string    // "2026-05-07T14:30:00-03:00 (America/Sao_Paulo)"
  tzAbbr: string     // "BRT"
  localTzAbbr: string // "ICT"
}

function formatSiteDateTime(
  date: Date | string,
  siteTimezone: string,
  opts?: FormatSiteDateTimeOpts
): FormatSiteDateTimeResult
```

Implementation uses `Intl.DateTimeFormat` with explicit `timeZone` parameter — no external date library needed.

### Timezone abbreviation helper

```typescript
function getTimezoneAbbr(timezone: string, date?: Date): string
```

Returns the dynamic abbreviation (BRT vs BRST, BST vs GMT, EST vs EDT) for a given timezone at a given instant. Uses `Intl.DateTimeFormat.formatToParts()` with `timeZoneName: 'short'`.

### "Today in site timezone" helper

```typescript
function todayInSiteTz(siteTimezone: string): string // "2026-05-07"
```

Replaces all instances of `new Date().toISOString().split('T')[0]` in schedule-related code. Uses `new Date().toLocaleDateString('sv-SE', { timeZone: siteTimezone })` which returns `YYYY-MM-DD` format.

## Component: `<DualTimeDisplay />`

**Location:** `apps/web/src/app/cms/(authed)/_components/dual-time-display.tsx`

Reusable component for rendering the dual-time pattern:

```tsx
interface DualTimeDisplayProps {
  date: Date | string
  siteTimezone: string
  mode?: 'full' | 'short' | 'time-only'
  showLocal?: boolean
}
```

Renders: **14:30 BRT** `·` 01:30 ICT `+1d`

- Site time: bold, BRT badge (small, rounded, indigo-tinted)
- Separator: `·` or dashed connector line (context-dependent)
- Local time: muted gray, ICT abbreviation
- Cross-day badge: `+1d` in amber when site date !== local date
- Hover tooltip: ISO 8601 + IANA timezone name

## Component: `<DualTimeBar />`

**Location:** `apps/web/src/app/cms/(authed)/_components/dual-time-bar.tsx`

For expanded contexts (settings, schedule details) where there's room for a full bar:

```
🌐 14:30 BRT ---- 10h ahead ---→ 🖥 00:30 +1d ICT
```

Globe icon, site time, dashed connector with offset label, device icon, local time.

## Surface 1/7: Settings — Timezone Picker

**File:** `apps/web/src/app/cms/(authed)/settings/` (new section in localization settings)

### UI

- Searchable dropdown with two groups: **Common** (5-6 popular IANA zones) and **All** (400+ IANA zones, filterable)
- Selected state shows: `America/Sao_Paulo` + `BRT` badge + `UTC-3`
- Live clocks side-by-side: "Site time now" (14:27, Tue May 6 BRT) vs "Your time now" (00:27 +1d, Wed May 7 ICT)
- Offset badge: "Your local time is 10 hours ahead of the site"
- Help text: "All scheduled content (posts, newsletters, YouTube sync) anchors to the site timezone."
- Save button writes to `sites.timezone`

### Data flow

Server action `updateSiteTimezone(siteId, timezone)`:
1. Validate `timezone` against `Intl.supportedValuesOf('timeZone')`
2. `UPDATE sites SET timezone = $1 WHERE id = $2`
3. `revalidateTag('seo-config')` (since site config changed)
4. Does NOT retroactively adjust existing `scheduled_at` values — those are already stored as `timestamptz` (absolute instants)

## Surface 2/7: Post Schedule Modal

**File:** `apps/web/src/app/cms/(authed)/blog/[id]/edit/` (schedule modal within post editor)

### Changes from current

- **Remove per-entry timezone picker.** Time input always interpreted in site timezone.
- Add `BRT` badge next to time input label
- Add `<DualTimeBar />` below inputs showing computed site vs local time
- If cross-day: amber callout "This publishes on May 8 in your timezone (May 7 site time)"
- Date validation: `min={todayInSiteTz(siteTimezone)}` instead of `getToday()`

### Data flow

`onConfirm(scheduledAt)` calls `computeScheduledAt(date, time, siteTimezone)` to produce UTC ISO. Same as today but timezone source changes from user-selected to site-level.

## Surface 3/7: Newsletter Schedule

**Files:**
- `apps/web/src/app/cms/(authed)/newsletters/_components/schedule-modal.tsx`
- `apps/web/src/app/cms/(authed)/newsletters/_components/contextual-banner.tsx`

### Schedule modal changes

- **Remove per-entry timezone dropdown.** Hardcode to site timezone.
- Default time from `newsletter_types.preferred_send_time` pre-filled
- Add `<DualTimeBar />` below inputs
- "Special" schedule: same pattern — date+time in site tz, converted via `computeScheduledAt`

### Contextual banner fix

**Bug:** `scheduledDate.toLocaleTimeString()` renders in browser timezone.

**Fix:** Use `formatSiteDateTime(scheduledAt, siteTimezone)` to render site time primary, local time secondary:

```
Scheduled for May 7, 2026 at 14:30 BRT · 00:30 +1d ICT · Sends in 4h 23m
```

## Surface 4/7: YouTube Schedule Cards

**File:** `apps/web/src/app/cms/(authed)/youtube/` (video sync cards)

### Changes

- Video `publishedAt` timestamps display with `<DualTimeDisplay />` in `time-only` or `short` mode
- "Next sync" indicator shows site time with local conversion
- No UTC date bug here (YouTube timestamps are ISO from API), but display consistency needed

## Surface 5/7: Blog Cadence Settings

**Files:**
- `apps/web/src/app/cms/(authed)/blog/_tabs/settings/` (cadence section)
- `apps/web/src/app/cms/(authed)/newsletters/_tabs/settings/` (shared `<DualTimeBar />`)

### Changes

- Per-locale cadence cards show "Publish Time: 08:00 BRT" with `<DualTimeBar />` below
- Blog Hub cadence card (collapsed): "Next: Mon, May 12 · 08:00 BRT" — compact inline
- Blog Hub cadence card (expanded): full `<DualTimeBar />` with "Next publish" date
- Cross-day edge: "22:00 BRT → 08:00 +1d ICT" clearly visualized
- Paused state: opacity 0.55, amber "Paused" badge
- Label says "Publish Time" (not "Send Time" — blog posts are published, not sent)

## Surface 6/7: Dashboard & CMS Timestamps

**Files:**
- `apps/web/src/app/cms/(authed)/_components/dashboard-connected.tsx`
- `apps/web/src/app/cms/(authed)/newsletters/_components/contextual-banner.tsx`
- Various content list components

### Dashboard "Coming Up" section

Each scheduled item gets `<DualTimeDisplay mode="short" />`:

```
How I Built My CLI Tool          Mon, May 12 · 08:00 BRT · 18:00 ICT
Weekly Digest #23                Wed, May 14 · 09:00 BRT · 19:00 ICT
```

### Content lists

- Timezone context appears only on scheduled/future rows (status = `scheduled`, `queued`)
- Published/draft rows keep existing relative times ("2h ago", "3 days ago")
- Audit log: site time primary column, local time secondary (same `<DualTimeDisplay />`)

### "Today" and "Tomorrow" labels

When dashboard shows "Today" or "Tomorrow" grouping headers, these are computed from site timezone via `todayInSiteTz()`. Subtle hint: "Today (site time)" to avoid confusion.

## Surface 7/7: Schedule Page & Content Calendar

**Files:**
- `apps/web/src/app/cms/(authed)/schedule/page.tsx`
- `apps/web/src/app/cms/(authed)/schedule/schedule-connected.tsx`
- `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/date-detail-popover.tsx`

### UTC date bug fix (critical)

**Current (broken):**
```typescript
// schedule-connected.tsx:69
function toDateString(d: Date): string {
  return d.toISOString().split('T')[0]!
}

// page.tsx:51
const today = new Date().toISOString().split('T')[0]!
```

**Fixed:**
```typescript
function toDateString(d: Date, siteTimezone: string): string {
  return d.toLocaleDateString('sv-SE', { timeZone: siteTimezone })
}

const today = todayInSiteTz(siteTimezone)
```

This fixes:
- Today highlight in week/month views
- Overdue detection (`slot_date < todayInSiteTz`)
- Agenda view date grouping
- Date detail popover "Today" badge
- "Today" computed on server in `page.tsx` AND on client in `schedule-connected.tsx`

### All instances to fix

| File | Line | Current | Fixed |
|---|---|---|---|
| `schedule/page.tsx` | 51 | `new Date().toISOString().split('T')[0]` | `todayInSiteTz(siteTimezone)` |
| `schedule/schedule-connected.tsx` | 69 | `d.toISOString().split('T')[0]` | `d.toLocaleDateString('sv-SE', { timeZone: siteTimezone })` |
| `newsletters/actions.ts` | 788 | `new Date().toISOString().slice(0, 10)` | `todayInSiteTz(siteTimezone)` |
| `newsletters/actions.ts` | 1593 | `new Date().toISOString().slice(0, 10)` | `todayInSiteTz(siteTimezone)` |
| `newsletters/_tabs/schedule/date-detail-popover.tsx` | 50 | `new Date().toISOString().slice(0, 10)` | `todayInSiteTz(siteTimezone)` |
| `newsletters/_hub/hub-queries.ts` | 52 | `new Date().toISOString().slice(0, 10)` | `todayInSiteTz(siteTimezone)` |
| `newsletters/_hub/hub-queries.ts` | 730 | `new Date().toISOString().slice(0, 10)` | `todayInSiteTz(siteTimezone)` |
| `newsletters/_components/schedule-modal.tsx` | 20 | `new Date().toISOString().slice(0, 10)` | `todayInSiteTz(siteTimezone)` |
| `newsletters/_components/schedule-modal.tsx` | 14 | `d.toISOString().slice(0, 10)` | `todayInSiteTz(siteTimezone)` +1d |
| `newsletters/_components/cadence-pattern-form.tsx` | 102 | `new Date().toISOString().slice(0, 10)` | `todayInSiteTz(siteTimezone)` |

### Week view changes

- "Today" cell gets indigo ring highlight based on site-tz today
- Each item shows time: "08:00 BRT" below the title
- Hover tooltip: full dual time + ISO 8601

### Agenda view changes

- Right-aligned time column with dual timezone: "08:00 BRT · 18:00 ICT"
- State preserved as inline text in subtitle (e.g., "Blog post · ready")
- "Today (site time)" hint on the today group header

### Date detail popover

- Widened to 300px for dual-time column
- Each entry: title | state | "08:00 BRT · 18:00 ICT"
- State as text in subtitle line

### Month view

- Compact: items show title only, tooltip on hover with dual time

### Overdue detection fix

**Current (broken):** `slot_date < todayUTC` + doesn't account for time-of-day.

**Fixed:** An item is overdue when:
- `slot_date < todayInSiteTz(siteTimezone)` — date has passed in site timezone
- AND the item is not yet published/sent (status check)
- Items scheduled for TODAY with a future send time are NOT overdue

For newsletters with `scheduled_at` (timestamptz), overdue = `scheduled_at < Date.now()` AND `status NOT IN ('sent', 'sending')`.

## Threading Site Timezone to Components

### Server components

`getSiteContext()` currently returns `{ siteId, orgId, defaultLocale, primaryDomain }`. We add `timezone`:

```typescript
export interface SiteContext {
  siteId: string
  orgId: string
  defaultLocale: string
  primaryDomain?: string
  timezone: string  // NEW — IANA timezone, e.g. "America/Sao_Paulo"
}
```

Middleware already resolves hostname → site. The middleware query or a follow-up fetch provides `sites.timezone` and sets it as `x-site-timezone` header.

### Client components

Client components receive `siteTimezone` as a prop from their parent server component. No client-side fetch needed — the value flows through the component tree.

For deeply nested components, a React context `SiteTimezoneContext` provides it without prop drilling:

```typescript
// apps/web/lib/cms/site-timezone-context.tsx
const SiteTimezoneContext = createContext<string>('America/Sao_Paulo')
export const SiteTimezoneProvider = SiteTimezoneContext.Provider
export const useSiteTimezone = () => useContext(SiteTimezoneContext)
```

CMS layout wraps children in `<SiteTimezoneProvider value={timezone}>`.

## Migration Strategy

### Phase 1: Foundation (no UI changes)

1. Add `timezone` to `SiteContext` + middleware `x-site-timezone` header
2. Create `formatSiteDateTime()` utility + `todayInSiteTz()` helper
3. Create `<DualTimeDisplay />` and `<DualTimeBar />` components
4. Create `SiteTimezoneContext` provider + `useSiteTimezone()` hook
5. Wire CMS layout to provide timezone context

### Phase 2: Bug fixes (UTC date computation)

6. Fix all `toISOString().split('T')[0]` instances (10 files) to use `todayInSiteTz()`
7. Fix overdue detection logic
8. Fix `contextual-banner.tsx` to use `formatSiteDateTime()`

### Phase 3: Dual-time display

9. Schedule calendar (week/agenda/month views) — add time column with `<DualTimeDisplay />`
10. Dashboard "Coming Up" section — add dual time
11. Content list timestamps — add dual time to scheduled rows
12. Newsletter schedule tab — add dual time to slot entries

### Phase 4: Schedule inputs

13. Remove per-entry timezone picker from newsletter `schedule-modal.tsx`
14. Add `<DualTimeBar />` to newsletter schedule modal
15. Add `<DualTimeBar />` to blog post schedule modal (if exists) or schedule actions
16. Blog cadence settings — add `<DualTimeBar />`

### Phase 5: Settings UI

17. Build timezone picker component (searchable dropdown, grouped)
18. Build live dual-clock cards
19. Wire `updateSiteTimezone` server action
20. Add to Settings → Localization page

## Testing Strategy

### Unit tests

- `formatSiteDateTime()` — cross-day detection, DST transitions, abbreviation accuracy
- `todayInSiteTz()` — edge cases: 23:59 BRT (02:59 UTC+1d), midnight exactly, DST switch day
- `computeScheduledAt()` — already tested, verify no regression

### Integration tests

- Schedule page: pass `today` as site-tz-derived string, verify correct highlight and overdue flags
- Newsletter contextual banner: scheduled edition renders site time, not browser time

### E2E tests (if applicable)

- Timezone picker: search, select, save, verify live clocks update
- Schedule an edition from "wrong" timezone browser, verify it anchors to site tz

## Non-Goals

- **Visitor-facing timezone.** Public pages (blog, newsletter archive) show dates without timezone context — this is for CMS admin surfaces only.
- **Per-user timezone preference.** One site timezone governs all. Admins see their local time as secondary info only.
- **Retroactive adjustment of existing `scheduled_at`.** These are already `timestamptz` (absolute instants) — changing site timezone doesn't move them.
- **Cron schedule adjustment.** Cron jobs (e.g., `0 8 * * *`) are defined in `vercel.json` and run in UTC. The site timezone is used only for computing `slot_date → scheduled_at` conversion and for display. Cron triggers remain UTC-based.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| DST transitions cause 1-hour drift in display | Low — display only, stored `timestamptz` is correct | `formatSiteDateTime()` uses `Intl.DateTimeFormat` which handles DST automatically |
| `Intl.supportedValuesOf('timeZone')` not available in older Node | Low — Node 18+ supports it | Fallback: hardcoded list of common IANA zones in picker |
| Changing site timezone confuses existing schedule displays | Medium — published_at timestamps don't move | Help text warns that changing timezone affects future scheduling only |
| Performance of `Intl.DateTimeFormat` in loops (content lists) | Low — create formatter once, reuse | Cache formatter instance per timezone per render |

## Visual Mockups

All 7 surfaces were iterated to 98+/100 quality via the visual companion brainstorming server. Mockups available at:

- `01-tz-picker-v2.html` — Settings timezone picker (v4 final)
- `02-post-schedule.html` — Post editor schedule modal (v3 final)
- `03-newsletter-schedule.html` — Newsletter schedule (v2 final)
- `04-youtube-schedule.html` — YouTube posting schedule (v2 final)
- `05-blog-cadence.html` — Blog cadence settings (v2 final)
- `06-dashboard-timestamps.html` — Dashboard & CMS timestamps (v2 final)
- `07-schedule-calendar.html` — Schedule page & content calendar (v2 final)

Located in `.superpowers/brainstorm/86676-1778103269/content/`.

## Design Language (Consistent Across All Surfaces)

| Element | Treatment |
|---|---|
| Site time | Bold, `#e2e8f0` |
| BRT badge | Small rounded pill, indigo-tinted (`rgba(99,102,241,0.15)` bg, `#818cf8` text) |
| Local time | Muted, `#64748b` |
| ICT abbreviation | In compact spaces (list columns, collapsed cards) |
| "your time" label | In expanded spaces (settings, modals, full bars) |
| Cross-day `+1d` | Amber (`#f59e0b`), only when site date !== local date |
| Dashed connector | `---- 10h ahead →` between site and local in expanded bars |
| Globe / Device icons | `🌐` for site, `🖥` for local in expanded bars |
| Tooltip | ISO 8601 + IANA name: `2026-05-07T14:30:00-03:00 (America/Sao_Paulo)` |
| "Today (site time)" | Subtle gray hint when "Today"/"Tomorrow" labels could be ambiguous |
