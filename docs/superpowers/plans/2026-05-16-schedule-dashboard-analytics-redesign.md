# CMS Schedule, Dashboard & Analytics Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign three CMS pages (Dashboard, Schedule, Analytics) into a cohesive "morning check-in" trio, restructure sidebar navigation, and add in-content link click tracking.

**Architecture:** RSC data-fetching shell → focused client components. Existing `schedule-connected.tsx`, old dashboard monolith, and old analytics tabs replaced with smaller, testable components. CSS custom properties for the design system tokens. DB migration adds 2 columns to existing tables.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, Supabase (PostgreSQL), Vitest + @testing-library/react, `@tn-figueiredo/newsletter` (generateSlots), `@tn-figueiredo/cms-ui` (CmsTopbar, formatRelativeTime)

**Estimated time:** ~12–16h across 19 tasks

**Parallelism:** Tasks 1–2 are foundation (must go first). After that, Tasks 3–8 (Schedule), Tasks 6–14 (Dashboard), and Tasks 10–19 (Analytics) can run in parallel on separate worktrees since they touch different directories.

---

## Task Overview

| # | Group | Component | Files Created/Modified |
|---|-------|-----------|----------------------|
| 1 | Foundation | CSS Tokens | `globals.css` |
| 2 | Foundation | Sidebar Change | `cms-sections.ts` + test |
| 3 | Schedule | Data Queries + Helpers | `lib/schedule/schedule-queries.ts` + test |
| 4 | Schedule | Page Server Component | `schedule/page.tsx` (replace), delete old files |
| 5 | Schedule | Calendar Grid | `_components/schedule-calendar.tsx`, `calendar-grid.tsx`, `calendar-cell.tsx` + test |
| 6 | Schedule | Item Chip + Tooltip | `_components/schedule-item.tsx` + test |
| 7 | Schedule | Metrics Strip + Backlog | `_components/metrics-strip.tsx`, `schedule-backlog.tsx` + test |
| 8 | Schedule | Integration Test | `test/cms/schedule/schedule-page.test.tsx` |
| 9 | Dashboard | Queries Helper | `_components/dashboard-queries.ts` + test |
| 10 | Dashboard | Types + Greeting | `dashboard-types.ts`, `dashboard-greeting.ts` + test |
| 11 | Dashboard | KPI Grid + Sparkline | `dashboard-kpi-grid.tsx` + test |
| 12 | Dashboard | Needs Attention | `dashboard-needs-attention.tsx` + test |
| 13 | Dashboard | This Week Strip | `dashboard-week-strip.tsx` + test |
| 14 | Dashboard | Quick Actions + Activity Feed | `dashboard-quick-actions.tsx`, `dashboard-activity-feed.tsx` + test |
| 15 | Dashboard | Header + Period Selector | `dashboard-header.tsx` + test |
| 16 | Dashboard | Page Wiring | `page.tsx` (replace) |
| 17–25 | Analytics | See Part 3 file | `lib/analytics/*`, `analytics/_components/*`, migration |

**Analytics tasks (10 tasks) are in:** `docs/superpowers/plans/2026-05-16-schedule-dashboard-analytics-part3-analytics.md`

---

## Part 1: Foundation

### Task 1: Design System CSS Tokens

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add the CMS redesign token block at the end of globals.css**

Append after the last existing block:

```css
/* CMS REDESIGN TOKENS — indigo-dark design system */
:root {
  --bg-0: #101124;
  --bg-1: #141530;
  --bg-2: #1a1b3a;
  --bg-3: #212247;
  --bg-4: #2a2c55;

  --t1: #f1f5f9;
  --t2: #cbd5e1;
  --t3: #94a3b8;
  --t4: #7d8ba0;
  --t5: #5a6a80;

  --bdr-0: #1a1b30;
  --bdr-1: #252640;
  --bdr-2: #333460;
  --bdr-3: #444570;

  --color-blog: #34d399;
  --color-newsletter: #a78bfa;
  --color-video: #fb7185;
  --color-link: #38bdf8;
  --color-int: #60a5fa;

  --acc: #818cf8;

  --color-blog-bg: #34d3991f;
  --color-newsletter-bg: #a78bfa1f;
  --color-video-bg: #fb71851f;
  --color-link-bg: #38bdf81f;
  --color-int-bg: #60a5fa1f;

  --color-blog-bdr: #34d39966;
  --color-newsletter-bdr: #a78bfa66;
  --color-video-bdr: #fb718566;
  --color-link-bdr: #38bdf866;
  --color-int-bdr: #60a5fa66;
}
```

- [ ] **Step 2: Verify CSS parses without errors**

```bash
npm run build -w apps/web 2>&1 | grep -iE "error|warning" | head -10
```

Expected: no CSS-related errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(cms): add redesign design system tokens"
```

---

### Task 2: Sidebar Navigation Change

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`
- Test: `apps/web/test/cms/_shared/cms-sections.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/test/cms/_shared/cms-sections.test.ts
import { describe, it, expect } from 'vitest'
import { buildCmsSections } from '@/app/cms/(authed)/_shared/cms-sections'

describe('buildCmsSections — redesign', () => {
  const sections = buildCmsSections()

  it('has no section labelled Insights', () => {
    expect(sections.find(s => s.label === 'Insights')).toBeUndefined()
  })

  it('Overview section has Analytics as third item', () => {
    const overview = sections.find(s => s.label === 'Overview')!
    expect(overview.items[2].label).toBe('Analytics')
    expect(overview.items[2].href).toBe('/cms/analytics')
  })

  it('total section count is 4', () => {
    expect(sections.length).toBe(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/test/cms/_shared/cms-sections.test.ts
```

Expected: FAIL (Insights section still exists, Analytics not at items[2]).

- [ ] **Step 3: Implement — move Analytics to Overview, remove Insights section**

In `cms-sections.ts`, add to Overview items array after Schedule:

```ts
{ icon: icon(TrendingUp), label: 'Analytics', href: '/cms/analytics', minRole: 'editor' },
```

Remove the entire Insights section object (last entry in the array).

- [ ] **Step 4: Run tests**

```bash
npx vitest run apps/web/test/cms/_shared/cms-sections.test.ts apps/web/test/cms/social-navigation.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/cms-sections.ts apps/web/test/cms/_shared/cms-sections.test.ts
git commit -m "feat(cms): move Analytics to Overview, remove Insights section"
```

---

## Part 2: Unified Schedule

### Task 3: Schedule Data Queries + Helpers

**Files:**
- Create: `apps/web/lib/schedule/schedule-queries.ts`
- Test: `apps/web/test/cms/schedule/schedule-queries.test.ts`

- [ ] **Step 1: Create types + query functions**

Create `apps/web/lib/schedule/schedule-queries.ts` with:
- Types: `ContentType`, `ItemStatus`, `CalendarItem`, `CadenceSlot`, `ScheduleMetrics`, `BacklogItem`, `ScheduleCalendarData`
- Functions: `fetchBlogItems()`, `fetchNewsletterItems()`, `fetchVideoItems()`, `fetchScheduleData()` (orchestrator)
- Key details:
  - Blog: query `blog_posts` with status in ('scheduled','published'), join `blog_translations` for title
  - Newsletter: query `newsletter_editions` + use `generateSlots()` from `@tn-figueiredo/newsletter` for cadence
  - Video: query `content_pipeline` where `format='video'` and `stage IN ('scheduled','published')`
  - Metrics: computed from items + cadenceSlots (publishedThisMonth, scheduledAhead, cadenceHealthPct, overdueCount)

See detailed code in the design spec section 2 and the sub-agent output for exact implementation.

- [ ] **Step 2: Write unit tests for metrics computation**

Test: correct published count (only current month), scheduled ahead (only future dates), cadence health percentage, overdue detection.

- [ ] **Step 3: Run tests**

```bash
npx vitest run apps/web/test/cms/schedule/schedule-queries.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/schedule/ apps/web/test/cms/schedule/schedule-queries.test.ts
git commit -m "feat(schedule): add unified schedule query layer"
```

---

### Task 4: Schedule Page Server Component

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/schedule/page.tsx` (full replace)
- Delete: `apps/web/src/app/cms/(authed)/schedule/actions.ts`
- Delete: `apps/web/src/app/cms/(authed)/schedule/schedule-connected.tsx`

- [ ] **Step 1: Replace page.tsx with RSC shell**

New page.tsx:
- Async RSC with `searchParams: Promise<{ month?: string }>`
- Calls `fetchScheduleData(supabase, siteId, month, timezone)`
- Passes data to `<ScheduleCalendar>` client component
- Includes `<Suspense>` with skeleton fallback
- Uses `getSupabaseServiceClient()`, `getSiteContext()`, `requireSiteScope()`

- [ ] **Step 2: Delete old files**

```bash
rm apps/web/src/app/cms/(authed)/schedule/actions.ts
rm apps/web/src/app/cms/(authed)/schedule/schedule-connected.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -A apps/web/src/app/cms/(authed)/schedule/
git commit -m "feat(schedule): replace with read-only RSC page shell"
```

---

### Task 5: Calendar Grid Components

**Files:**
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/schedule-calendar.tsx`
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/calendar-grid.tsx`
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/calendar-cell.tsx`
- Test: `apps/web/test/cms/schedule/calendar-grid.test.tsx`

- [ ] **Step 1: Create `schedule-calendar.tsx` — client shell with month navigation**

`'use client'` component. Uses `useRouter` + `useSearchParams` for month nav. Renders: `<MetricsStrip>`, month header with prev/next/today buttons, `<CalendarGrid>`, `<ScheduleBacklog>`.

- [ ] **Step 2: Create `calendar-grid.tsx` — 7-col Mon→Sun layout**

Builds grid cells array (blanks + days), determines this-week range, creates lookup maps for items/cadenceSlots by dateKey, renders day headers + cells.

- [ ] **Step 3: Create `calendar-cell.tsx` — status encoding + today progress bar**

Shows day number, up to 3 `<ScheduleItemChip>` per cell, overflow "+N more" indicator, cadence ghost slots with "+ Fill" affordance on hover, today progress bar, week-band styling via `box-shadow`.

- [ ] **Step 4: Write grid layout tests**

Test: correct offset for months, total cells always multiple of 7, this-week detection.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/schedule/_components/ apps/web/test/cms/schedule/calendar-grid.test.tsx
git commit -m "feat(schedule): add calendar grid components"
```

---

### Task 6: Schedule Item Chip + Tooltip

**Files:**
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/schedule-item.tsx`
- Test: `apps/web/test/cms/schedule/schedule-item.test.tsx`

- [ ] **Step 1: Create item chip with status visual encoding**

4 status styles: published (solid bg 12%), scheduled (solid left-border 3px), queued (dashed left-border), overdue (red left-border). Hover shows tooltip with title/type/time/status. Tooltip flips `right-0` on `colIndex >= 5`.

- [ ] **Step 2: Write tests**

Test: renders title, links to editUrl, shows tooltip on hover, hides on leave, tooltip flips on col >= 5, correct color per type.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/schedule/_components/schedule-item.tsx apps/web/test/cms/schedule/schedule-item.test.tsx
git commit -m "feat(schedule): add item chip with status encoding + tooltip"
```

---

### Task 7: Metrics Strip + Backlog

**Files:**
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/metrics-strip.tsx`
- Create: `apps/web/src/app/cms/(authed)/schedule/_components/schedule-backlog.tsx`
- Test: `apps/web/test/cms/schedule/metrics-strip.test.tsx`

- [ ] **Step 1: Create metrics strip (4 stat cards)**

Published this month (green), Scheduled ahead (violet), Cadence health % (color-coded by threshold), Overdue (red border when > 0).

- [ ] **Step 2: Create backlog section**

Collapsed by default, expand on click. Groups items by type with colored headings. Shows total count badge.

- [ ] **Step 3: Write tests**

Test: metrics values render, overdue card has red styling, backlog starts collapsed, expands on click, groups correctly.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/schedule/_components/metrics-strip.tsx apps/web/src/app/cms/(authed)/schedule/_components/schedule-backlog.tsx apps/web/test/cms/schedule/metrics-strip.test.tsx
git commit -m "feat(schedule): add metrics strip + collapsible backlog"
```

---

### Task 8: Schedule Integration Test

**Files:**
- Create: `apps/web/test/cms/schedule/schedule-page.test.tsx`

- [ ] **Step 1: Write integration test rendering ScheduleCalendar with mock data**

Test: month heading renders, metrics values present, item titles visible, items link to edit URLs, cadence slot fill link present, backlog collapsed by default, expands on click, nav buttons present.

- [ ] **Step 2: Run full schedule test suite**

```bash
npx vitest run apps/web/test/cms/schedule/
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/cms/schedule/schedule-page.test.tsx
git commit -m "test(schedule): add integration test for unified calendar"
```

---

## Part 2b: Dashboard Command Center

### Task 9: Dashboard Queries Helper

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_components/dashboard-queries.ts`
- Test: `apps/web/test/cms/dashboard-queries.test.ts`

- [ ] **Step 1: Create queries with `unstable_cache` for KPIs, attention, week strip, activity feed**

4 exported functions:
- `fetchDashboardKpis(siteId, period)` → 11 parallel Supabase queries, returns KpiQueryResult with sparklines
- `fetchNeedsAttention(siteId)` → P1 (overdue posts, stale drafts), P2 (approaching deadlines), P3 (stale pipeline ideas)
- `fetchThisWeekStrip(siteId, timezone)` → Mon-Sun with dots per day
- `fetchActivityFeed(siteId)` → last 30 audit_log entries

- [ ] **Step 2: Write tests (mock supabase chain)**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_components/dashboard-queries.ts apps/web/test/cms/dashboard-queries.test.ts
git commit -m "feat(dashboard): add command center query layer"
```

---

### Task 10: Dashboard Types + Greeting Helper

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_components/dashboard-types.ts`
- Create: `apps/web/src/app/cms/(authed)/_components/dashboard-greeting.ts`
- Test: `apps/web/test/cms/dashboard-greeting.test.ts`

- [ ] **Step 1: Create types file consolidating all dashboard interfaces**

- [ ] **Step 2: Create greeting helper**

`getGreeting(timezone)` → returns "Bom dia" (5-11), "Boa tarde" (12-17), "Boa noite" (18-4).
`formatTodayLabel(timezone)` → Portuguese date string.

- [ ] **Step 3: Write tests at boundary hours**

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_components/dashboard-types.ts apps/web/src/app/cms/(authed)/_components/dashboard-greeting.ts apps/web/test/cms/dashboard-greeting.test.ts
git commit -m "feat(dashboard): add types + time-aware greeting helper"
```

---

### Task 11: KPI Grid + Sparkline

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_components/dashboard-kpi-grid.tsx`
- Test: `apps/web/test/cms/dashboard-kpi-grid.test.tsx`

- [ ] **Step 1: Create KpiGrid component — 5 cards with inline SVG sparklines**

Cards: Total Views, Publicados, Assinantes, Link Clicks, Receita. Each shows 22px value, trend arrow, 48px SVG polyline sparkline.

- [ ] **Step 2: Write tests**

- [ ] **Step 3: Commit**

---

### Task 12: Needs Attention Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_components/dashboard-needs-attention.tsx`
- Test: `apps/web/test/cms/dashboard-needs-attention.test.tsx`

- [ ] **Step 1: Create NeedsAttention — P1/P2/P3 priority list with colored borders**

Empty state: "Tudo em ordem" + checkmark. Max 3 visible, expand button for more.

- [ ] **Step 2: Write tests**

- [ ] **Step 3: Commit**

---

### Task 13: This Week Strip

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_components/dashboard-week-strip.tsx`
- Test: `apps/web/test/cms/dashboard-week-strip.test.tsx`

- [ ] **Step 1: Create WeekStrip — 7 day columns with dots, today glow, click tooltip**

- [ ] **Step 2: Write tests**

- [ ] **Step 3: Commit**

---

### Task 14: Quick Actions + Activity Feed

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_components/dashboard-quick-actions.tsx`
- Create: `apps/web/src/app/cms/(authed)/_components/dashboard-activity-feed.tsx`
- Test: `apps/web/test/cms/dashboard-activity-feed.test.tsx`

- [ ] **Step 1: Create QuickActions — 3 static cards (New Post, New Edition, Pipeline Item)**

- [ ] **Step 2: Create ActivityFeed — Portuguese action labels, emoji icons, relative time**

- [ ] **Step 3: Write tests**

- [ ] **Step 4: Commit**

---

### Task 15: Dashboard Header + Period Selector

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_components/dashboard-header.tsx`
- Test: `apps/web/test/cms/dashboard-header.test.tsx`

- [ ] **Step 1: Create sticky header with greeting + period selector (7d/30d/90d)**

Uses `backdrop-blur-[12px]`, `useSearchParams` for period state.

- [ ] **Step 2: Write tests**

- [ ] **Step 3: Commit**

---

### Task 16: Dashboard Page Wiring

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/page.tsx` (full replace)

- [ ] **Step 1: Replace page.tsx with two-column RSC layout**

`Promise.all` fetches KPIs + attention + weekStrip + activityFeed + blogHealth. Main column: KpiGrid → NeedsAttention → WeekStrip → QuickActions. Aside (340px): ActivityFeed with scroll mask.

- [ ] **Step 2: Run full test suite**

```bash
npm run test:web
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/page.tsx
git commit -m "feat(dashboard): wire command center layout with all sections"
```

---

## Part 3: Analytics Redesign

> **Full detailed tasks (10 tasks, ~2295 lines) are in:**
> `docs/superpowers/plans/2026-05-16-schedule-dashboard-analytics-part3-analytics.md`

Summary of analytics tasks:

| Task | Component |
|------|-----------|
| 17 | Analytics Helpers (link-classifier, engagement-score, insights-engine) |
| 18 | Analytics Queries (KPI, funnel, top links, destination, source, chart) |
| 19 | KPI Row + Sparkline components |
| 20 | Content Funnel (proportional flex 2.5/1.8/1.2/0.8/0.5) |
| 21 | Top Links Table + Destination/Source panels |
| 22 | Clicks Chart (pure SVG, ghost bars, avg line, gridlines) |
| 23 | Insights Strip (3 rule-based cards) |
| 24 | Header + Page Wiring (5 tabs, lazy loading, period selector) |
| 25 | In-Content Link Tracking (navigator.sendBeacon, 5s dedup) |
| 26 | DB Migration (source column on newsletter_subscriptions, dest_url + link_type on content_events) |

---

## Final Verification

After all tasks complete:

```bash
npm run test:web                    # All tests pass
npm run typecheck -w apps/web       # No TypeScript errors
npm run dev -w apps/web             # Smoke test all 3 pages in browser
```

Verify in browser:
- `/cms` → Command Center with KPIs, attention, week strip, quick actions, activity feed
- `/cms/schedule` → Monthly calendar with blog/newsletter/video items, cadence slots, metrics
- `/cms/analytics` → KPI row, funnel, link table, destinations/sources, chart, insights
- Sidebar: Overview section has Dashboard → Schedule → Analytics (no more INSIGHTS section)
