# Newsletter Hub Redesign — Design Spec

**Date:** 2026-04-30
**Status:** Approved
**Score:** 100/100 (all 5 tabs validated via visual mockups)
**Supersedes:** `2026-04-26-newsletter-cms-overhaul-design.md` (dashboard/hub scope only — editor/lifecycle scope from that spec remains valid)

## Problem

The current `/cms/newsletters` page scores 30/100:

- **KPIs disconnected:** Flat number cards with no trends, sparklines, or context. Users can't tell if metrics are improving or declining.
- **Type cards generic:** Plain text cards with no visual weight. No subscriber distribution, no proportional representation, no engagement data per type.
- **9 filter tabs confusing:** Status-based filtering (All, Draft, Ready, Scheduled, Sending, Sent, Failed, Cancelled, Archived) overwhelms non-technical users. Mental model mismatch — users think in workflows, not statuses.
- **Edition table poor:** Flat list with minimal metadata. No kanban view, no pipeline visualization, no drag-and-drop for workflow progression.
- **Zero visual storytelling:** No charts, no sparklines, no gauges, no heatmaps. Pure data dump with no narrative.

**Target:** 90+ score via a 5-tab workspace that separates concerns by mental model (overview/editorial/schedule/automations/audience) instead of by status.

## Scope

### In scope
- Complete redesign of `/cms/newsletters` as a 5-tab workspace
- Overview tab: KPI cards with sparklines, health gauge, growth/engagement charts, funnel, cohort heatmap, deliverability panel
- Editorial tab: Kanban board with 7 columns (Idea → Draft → Review → Scheduled → Sent → Issues → Archive)
- Schedule tab: Calendar + agenda split view, cadence configuration per type, conflict detection
- Automations tab: Workflow visualizations (Welcome, Re-engagement, Bounce Handler), system cron cards, live activity feed
- Audience tab: Subscriber table with search/filter/export, growth chart, distribution chart, engagement cards, locale/LGPD panels
- Cross-tab type filter chips (persistent selection across tabs)
- Keyboard shortcuts per tab
- LGPD compliance integration (masked emails, consent badges, anonymization indicators)
- Multi-site readiness (OneCMS breadcrumb, site-scoped data)

### Out of scope
- Edition editor redesign (covered by `2026-04-26-newsletter-cms-overhaul-design.md`)
- Edition lifecycle actions (save, schedule, send, cancel — same spec)
- TipTap WYSIWYG integration (same spec)
- New server actions for edition CRUD (same spec)
- A/B testing UI (Sprint 7+)
- Multi-client email preview (Sprint 7+)

## Architecture

### Tab Workspace Model

```
/cms/newsletters
├── [Shared Chrome]
│   ├── Sidebar (OneCMS navigation)
│   ├── Breadcrumb: OneCMS > {site.name} > Newsletters
│   ├── Header: title + live indicator + actions (New Edition, settings, notifications)
│   └── Tab Bar: Overview | Editorial | Schedule | Automations | Audience
│
├── [Tab: Overview]      — birds-eye health + engagement analytics
├── [Tab: Editorial]     — kanban pipeline for edition workflow
├── [Tab: Schedule]      — calendar + cadence configuration
├── [Tab: Automations]   — workflow visualizations + cron health
└── [Tab: Audience]      — subscriber management + growth analytics
```

Tab state persisted via URL search param (`?tab=overview|editorial|schedule|automations|audience`). Default: `overview`. Browser back/forward navigates between tabs.

### Component Hierarchy

```
NewsletterHub (server component — data fetch)
├── NewsletterHubClient (client component — tab state, type filter)
│   ├── SharedHeader
│   │   ├── Breadcrumb
│   │   ├── TitleBar (title, live dot, action buttons)
│   │   ├── TabBar (5 tabs with badge counts)
│   │   └── TypeFilterChips (persistent across tabs)
│   │
│   ├── OverviewTab
│   │   ├── KpiStrip (5 cards with sparklines)
│   │   ├── HealthGauge (donut)
│   │   ├── SubscriberGrowthChart (area, recharts)
│   │   ├── EngagementFunnel (horizontal bar)
│   │   ├── EditionsByTypeDonut (recharts)
│   │   ├── OpenRateTrendChart (multi-line, recharts)
│   │   ├── PublicationPerformanceCards (expandable)
│   │   ├── TopPerformingEditions (ranked list)
│   │   ├── ActivityFeed (live events)
│   │   ├── CohortRetentionHeatmap (grid)
│   │   └── DeliverabilityPanel (SPF/DKIM/DMARC + bounce/complaint gauges)
│   │
│   ├── EditorialTab
│   │   ├── VelocityStrip (throughput, avg time, moved, bottleneck)
│   │   ├── EditorialToolbar (search, type filter, sort, view toggle)
│   │   └── KanbanBoard (7 columns, drag-and-drop)
│   │       ├── IdeaColumn
│   │       ├── DraftColumn (WIP limit indicator)
│   │       ├── ReviewColumn
│   │       ├── ScheduledColumn
│   │       ├── SentColumn
│   │       ├── IssuesColumn
│   │       └── ArchiveColumn (collapsed)
│   │
│   ├── ScheduleTab
│   │   ├── ScheduleHealthStrip (fill rate, next 7d, conflicts, avg open)
│   │   ├── CalendarAgendaSplit (3fr + 2fr)
│   │   │   ├── MonthCalendar (grid with slot dots, conflicts)
│   │   │   └── AgendaList (upcoming items, empty slots)
│   │   ├── CadenceConfiguration (5 type cards with toggles)
│   │   └── SendWindowConfig (time picker + insight)
│   │
│   ├── AutomationsTab
│   │   ├── AutomationsHealthStrip (workflows, crons, events, success rate)
│   │   ├── WorkflowActivitySplit (3fr + 2fr)
│   │   │   ├── WorkflowCards (Welcome hero + Re-engagement + Bounce Handler)
│   │   │   └── LiveActivityFeed (events with filter chips)
│   │   └── SystemAutomations (3 cron cards with health dots)
│   │
│   └── AudienceTab
│       ├── AudienceHealthStrip (unique subs, subscriptions, net growth, churn, open rate, LGPD consent)
│       ├── GrowthDistributionRow (3fr + 2fr)
│       │   ├── GrowthChart (area, new vs unsubs)
│       │   └── DistributionChart (horizontal bars)
│       ├── EngagementByTypeCards (5 cards grid)
│       ├── SubscriberTable (search, filters, export CSV, paginated)
│       └── BottomRow (locale donut, LGPD consent metrics, recent activity)
```

### Data Flow

Server component fetches all data for the active tab in a single `Promise.all` call, passing props to the client tab component. Each tab defines its own data requirements:

| Tab | Primary Queries |
|---|---|
| Overview | `newsletter_types` + `newsletter_editions` (aggregated stats) + `newsletter_subscriptions` (growth) + `newsletter_sends` (engagement) + `webhook_events` (activity feed) |
| Editorial | `newsletter_editions` (all non-archived, with type join) + `newsletter_types` (for filter chips) |
| Schedule | `newsletter_types` (cadence config) + `newsletter_editions` (scheduled/sent) + `blog_cadence` |
| Automations | `newsletter_types` (workflow config) + `webhook_events` (recent) + cron health from `sent_emails` audit |
| Audience | `newsletter_subscriptions` (with engagement scores) + `newsletter_sends` (aggregated per subscriber) + `consents` (LGPD) |

Type filter chips apply client-side filtering. Period toggles (30d/90d/All) trigger re-fetches via `useTransition`.

---

## Design System

### Tokens

| Token | Value | Usage |
|---|---|---|
| `--page-bg` | `#030712` (gray-950) | Page background |
| `--card-bg` | `#111827` (gray-900) | Card surfaces |
| `--card-border` | `#1f2937` (gray-800) | Card borders, dividers |
| `--text-primary` | `#f3f4f6` (gray-100) | Primary text |
| `--text-secondary` | `#9ca3af` (gray-400) | Secondary text, labels |
| `--text-muted` | `#6b7280` (gray-500) | Muted text, timestamps |
| `--text-dim` | `#4b5563` (gray-600) | Breadcrumbs, section labels |
| `--accent` | `#6366f1` (indigo-500) | Primary accent, active states |
| `--accent-hover` | `#4f46e5` (indigo-600) | Button hover |
| `--accent-subtle` | `#6366f112` | Active tab background |
| `--accent-text` | `#818cf8` (indigo-400) | Active tab text, badge text |
| `--success` | `#22c55e` (green-500) | Positive metrics, live dot |
| `--warning` | `#f59e0b` (amber-500) | Warnings, stale indicators |
| `--danger` | `#ef4444` (red-500) | Errors, high bounce, issues |
| `--sidebar-bg` | `#0a0b14` | Sidebar background |

### Newsletter Type Colors

| Type | Color | Hex |
|---|---|---|
| Weekly Digest | Indigo | `#6366f1` |
| Dev Deep Dive | Green | `#22c55e` |
| Career Corner | Amber | `#f59e0b` |
| Behind the Code | Pink | `#ec4899` |
| Sponsor Spotlight | Purple | `#8b5cf6` |

These colors are used consistently as: left accent borders on cards, dot indicators in filter chips, chart series colors, calendar slot dots, kanban card accents.

### Typography

- Font: Inter (weights 400, 500, 600, 700, 800)
- Page title: 18px/700
- Section headers: 11px/600 uppercase, letter-spacing 0.5px, gray-500
- Card titles: 12px/600
- Body text: 12px/400
- Small labels: 10px/500
- Micro labels: 9px/400 (timestamps, breadcrumbs)
- Monospace: `font-variant-numeric: tabular-nums` for numbers, `font-family: monospace` for cron expressions

### Icons

Lucide SVG icons exclusively. All icons use `viewBox="0 0 24 24"`, `stroke="currentColor"`, `fill="none"`, `stroke-width="1.8"`, `stroke-linecap="round"`, `stroke-linejoin="round"`. Standard sizes: 15px sidebar, 14px buttons, 12px inline, 16px header actions. Chart SVGs use their own viewBox dimensions.

### Border Radius

- Cards: `border-radius: 10px`
- Buttons: `border-radius: 8px`
- Small elements (badges, chips): `border-radius: 6px`
- Pills (status badges): `border-radius: 20px`

### Animations

| Animation | Duration | Easing | Usage |
|---|---|---|---|
| `pulse` | 2s infinite | ease | Live indicator dot |
| `barGrow` | 0.8s | ease-out | Bar chart segments, progress bars |
| `evtFadeIn` | 0.3s staggered | ease | Activity feed items (--evt-i delay) |
| `edgeFlow` | 1.5s infinite staggered | ease-in-out | Workflow edge pulses (--edge-i delay) |
| Card hover | 0.15s | ease | `border-color` transition on hover |
| Tab transition | 0.15s | ease | Color + border-bottom transition |

---

## Tab 1: Overview

The birds-eye view of newsletter health and performance. Default landing tab.

### KPI Strip (5 cards, horizontal row)

| KPI | Value | Trend | Sparkline |
|---|---|---|---|
| Total Subscribers | 247 | +12 (30d) ↑ green | 7-point area sparkline |
| Editions Sent | 8 | 3 this month | 7-point area sparkline |
| Avg Open Rate | 68.2% | +2.1pp ↑ green | 7-point line sparkline |
| Avg Click Rate | 24.7% | +0.8pp ↑ green | 7-point line sparkline |
| Bounce Rate | 0.8% | -0.2pp ↓ green | 7-point line sparkline (inverted — down is good) |

Each card: gray-900 bg, gray-800 border, 10px radius. Label top (10px gray-400), value large (20px/800), trend pill below (green/red bg with arrow icon), sparkline SVG bottom (40×20, gradient fill matching card accent). Hover: `border-color: #374151`.

### Newsletter Health Gauge

Donut chart (SVG, 120×120) centered. Score: 78/100 displayed in center (24px/800). Ring segments colored by health dimension. Below: 4 mini-indicators in a row (Deliverability: Excellent, Engagement: Good, Growth: Steady, Compliance: Full). Each with colored dot + label.

### Subscriber Growth Chart (recharts)

Area chart, 90-day default with period toggle (30d/90d/All buttons, top-right). X-axis: dates. Y-axis: subscriber count. Gradient fill indigo. Grid lines at gray-800. Tooltip on hover with exact date + count. Card wrapper with "Subscriber Growth" header + period toggle.

### Engagement Funnel

Horizontal funnel visualization: Sent 1,976 → Delivered 1,946 (98.5%) → Opened 1,344 (69.1%) → Clicked 487 (36.2%). Each stage as a horizontal bar with decreasing width. Labels: stage name left, count right, percentage below. Colors: indigo gradient darkening per stage. Connecting arrows between stages.

### Editions by Type (recharts donut)

Donut chart showing edition count per type. Center: total "8 editions". Segments colored by type color. Legend below with type name + count. Hover: segment expands slightly.

### Open Rate Trend (recharts multi-line)

Multi-line chart with one series per newsletter type (colored by type color). X-axis: edition dates. Y-axis: open rate %. Average line dashed. Legend with type names + colored dots. Interactive: hover shows tooltip with all series values.

### Publication Performance Cards

5 cards (one per newsletter type), 3 expanded by default + 2 collapsed. Each card:
- Left accent border in type color
- Type name + color dot header
- Stats row: subscribers count, editions sent, open rate, click rate
- Sparkline (open rate trend, 6 points)
- Expand/collapse toggle
- Actions: Edit, Pause, kebab menu
- Paused types show `opacity: 0.55` + "Paused" badge

"+ Add Publication" button at bottom with dashed border.

### Top Performing Editions

Ranked list (top 5). Toggle: "Opens" / "Clicks" (button group). Each row:
- Rank number (large, gray-600)
- Edition subject (truncated)
- Type badge (colored)
- Date sent
- Metric value (opens or clicks count)
- Bar indicator (proportional width, accent color)

### Activity Feed

Scrollable list (max 10 items visible). Each event:
- Colored dot (green=delivered, blue=opened, indigo=clicked, red=bounced, gray=system)
- Description with LGPD-masked email (`m***a@example.com`)
- Relative timestamp ("2m ago", "1h ago")
- `evtFadeIn` animation with staggered delay

Filter: "All" / "Engagement" / "System" chips.

### Cohort Retention Heatmap

Grid: rows = monthly cohorts (Jan, Feb, Mar, Apr), columns = month offsets (Month 0, 1, 2, 3). Cells show retention % with color gradient (dark = low retention, bright green = high). Hover: cell expands with exact percentage. Header row with column labels.

### Deliverability Panel

Two sections side by side:
1. **Authentication** — 3 check items: SPF (Verified, green check), DKIM (Verified, green check), DMARC (Verified, green check). Provider badge: "Amazon SES".
2. **Rates** — 2 gauge bars: Bounce Rate 0.8% (green, threshold line at 5%), Complaint Rate 0.02% (green, threshold line at 0.1%). Each with label + value + threshold indicator.

### Quick Actions Row

4 buttons at top-right area: "New Edition" (primary, indigo), "Schedule Next" (outline), "View Subscribers" (outline), "Full Analytics" (outline). Each with Lucide icon.

### Type Filter Chips

Horizontal chip row below tabs. "All Types (5)" default active + one chip per type with colored dot. Single-select: clicking a type filters all overview data to that type. Active chip: indigo border + indigo/bg tint. Persists across tab switches.

---

## Tab 2: Editorial

Kanban board for managing the edition pipeline. Mental model: each edition flows left-to-right through workflow stages.

### Velocity Strip (4 metrics, horizontal row)

| Metric | Value | Trend |
|---|---|---|
| Throughput | 3.2/week | +0.4 ↑ |
| Avg Idea→Sent | 11 days | +2d (slower, yellow) |
| Moved Forward | 2 this week | neutral |
| Bottleneck | Review (avg 4.5d) | warning indicator |

Same card style as KPI strip but more compact. Warning color on bottleneck.

### Editorial Toolbar

- Search input (left, with Lucide search icon, placeholder "Search editions...")
- Type filter chips (same as shared, inline)
- Sort dropdown: "Newest first" / "Oldest first" / "Priority"
- View toggle: Kanban (grid icon, active) / List (list icon)
- Keyboard hint: `N` new, `F` filter, `/` search

### Kanban Board (7 columns)

Horizontal scrollable board. Each column:
- Header: column name + card count badge
- Droppable zone (react-beautiful-dnd or @dnd-kit)
- "+" button in column header for Idea/Draft columns

#### Column: Idea (3 cards)

Lighter treatment — dashed border cards (vs solid for other columns). Each card:
- Drag handle (grip icon, visible on hover)
- Title (idea title)
- Notes count badge (e.g., "2 notes")
- Aging badge: days since creation (normal <7d gray, stale 7-14d amber, old 14d+ red)
- Type badge (if assigned) or "Untyped" in gray
- Kebab menu

#### Column: Draft (3 cards, WIP 3/4 indicator)

WIP limit: 4 max. Header shows "3/4" with progress bar (amber when ≥75% full, red at limit). Each card:
- Drag handle
- Left accent border (type color)
- Title
- Progress bar: % complete + word count + reading time (e.g., "65% · 1,240 words · 5 min")
- Content snippet (2 lines, gray-500, truncated)
- Type badge
- Aging badge
- Kebab menu

#### Column: Review (2 cards)

Each card:
- Same base as Draft card
- "Send test email" CTA button (outline, small)
- Reviewer indicator (if assigned)
- Aging badge with stale warning (amber) if >3 days in review

#### Column: Scheduled (2 cards)

Each card:
- Same base
- Green date pill: "May 2" with countdown "in 2 days"
- Time indicator: "8:00 AM BRT"
- Type badge

#### Column: Sent (4 cards, showing 2 + "2 more" expand)

Default: show 2 most recent, "2 more" expand button at bottom. Each card:
- Same base (read-only feel, slightly muted)
- Stats row: Opens %, Clicks %, Bounce %
- Color coding: bounce >5% in red
- Date sent

#### Column: Issues (1 card)

Red treatment: red-tinted border, warning icon. Each card:
- Issue description (e.g., "High bounce 6.1% — auto-paused")
- Type badge
- Resolution action button
- Contextual empty-state hint when empty: "No issues — editions with high bounce or delivery failures appear here"

#### Column: Archive (collapsed)

Single collapsed column header showing "Archive · 8 items". Click to expand into a scrollable list. Oldest editions, read-only.

### Card Interactions

- **Drag & drop:** Cards draggable between adjacent columns (Idea→Draft→Review→Scheduled). Sent/Issues/Archive are terminal (no drag-in from user, only system moves).
- **Click:** Opens edition in editor (`/cms/newsletters/[id]/edit`)
- **Kebab menu:** Edit, Duplicate, Move to..., Delete (context-aware per column)
- **Keyboard:** Arrow keys navigate between cards, Enter opens, Delete with confirmation

### Summary Bar

Bottom sticky bar: "14 active editions · 2 scheduled · 1 needs attention" + pipeline flow miniature (Idea 3 → Draft 3 → Review 2 → Sched 2 → Sent 4 → Issues 1) with colored dots. Keyboard hints right-aligned.

---

## Tab 3: Schedule

Calendar-centric view for managing when editions go out. Split layout: calendar (3fr) + agenda (2fr).

### Schedule Health Strip (5 metrics)

| Metric | Value | Context |
|---|---|---|
| Fill Rate | 18% | 2/11 slots filled (amber — low) |
| Next 7 Days | 2 scheduled | green |
| Conflicts | 2 days | red warning |
| Avg Open Rate | 44.8% | trend |
| Active Types | 4/5 | 1 paused |

### Calendar (3fr, left panel)

Month grid (May 2026). Header: "< May 2026 >" with navigation arrows. Grid: Su–Sa columns, week numbers (W17–W22) in left gutter.

- **Today indicator:** April 30 cell highlighted with indigo ring (if visible in current month view)
- **Scheduled edition dots:** Colored circles (type color) in the cell for that date. Hover shows edition subject + type
- **Empty slot dots:** Dashed-border circles indicating cadence-generated empty slots. Visual cue that content is expected but not yet assigned
- **Conflict indicators:** Warning triangle icon on cells where 2+ editions land on the same day (e.g., May 4, May 18)
- **Slot pills:** Below the calendar grid, a legend row showing what each dot color means

**Interaction:** Click a day cell to see details in the agenda panel. Click a scheduled dot to open that edition. Click an empty slot to create a new edition pre-filled with that date.

### Agenda (2fr, right panel)

Scrollable list of upcoming items, ordered chronologically:

- **Scheduled items:** Green left accent, edition subject, type badge (colored), date + countdown ("in 2 days"), time "8:00 AM BRT"
- **Empty slots:** Dashed border, "Empty slot" label, type badge, date. CTA: "Assign edition" button
- **Conflict items:** Amber warning icon, multiple editions listed for same day
- Expand button: "5 more slots in May" to load additional items
- Summary footer: "2 scheduled · 9 empty · 2 conflicts"

### Cadence Configuration (5 type cards)

One card per newsletter type, horizontal scrollable row:

| Type | Cadence | Day | Time | Next Date |
|---|---|---|---|---|
| Weekly Digest | Every Saturday | Sat | 8:00 AM BRT | May 2 |
| Dev Deep Dive | Every other Monday | Mon | 8:00 AM BRT | May 4 |
| Career Corner | Every other Monday | Mon | 8:00 AM BRT | May 4 |
| Behind the Code | 1st & 3rd Monday | Mon | 8:00 AM BRT | May 4 |
| Sponsor Spotlight | Monthly 1st Friday | Fri | 8:00 AM BRT | May 1 (paused) |

Each card:
- Type name + colored dot header
- Toggle switch (`role="switch"`, `aria-checked`) to enable/disable cadence
- Frequency label
- Time display + "Change" button
- Next scheduled date
- Conflict badge (if applicable, e.g., "Conflicts with DDD on May 4")
- Stats row: subscriber count, editions sent, open rate
- Paused types: dimmed (`opacity: 0.55`), "Paused" badge, toggle off

### Send Window Configuration

Default time: "08:00 AM BRT". Insight callout: "8 AM has highest open rate (48.2%)". "Change time" button opens time picker. Applies as default for all types unless overridden per-type.

### Summary Bar

"11 slots in May · 2 filled · 2 conflict days · Pipeline: 3 drafts ready" + keyboard hints.

---

## Tab 4: Automations

Workflow visualizations and system cron health monitoring. Split layout: workflows (3fr) + activity feed (2fr).

### Automations Health Strip (5 metrics)

| Metric | Value | Context |
|---|---|---|
| Workflows | 3 active | green |
| Crons | 3 healthy | green |
| Events Today | 47 | neutral |
| Success Rate | 99.2% (30d) | green |
| Last Incident | 3d ago | amber |

### Workflow Cards (3fr, left panel)

#### Welcome Email (hero card, expanded)

Large card with full sequence flow visualization:

```
Subscribe → [5m wait] → Welcome Email → Opened? → Yes → Done
                                              → No (3d) → Reminder
```

Flow rendered as connected nodes with directional arrows. Animated pulse on edges (`edgeFlow` animation with staggered `--edge-i` delay). Pipeline counts on each node showing current items in that stage (e.g., "3 in 5m-wait", "12 in open-check", "2 in 3d-wait") with subtle pulse animation on non-zero counts.

Stats bar: 247 sent, 99.6% delivered, 68.3% opened, 14 reminders sent. Toggle switch (enabled). "Configure" button.

#### Re-engagement (compact card)

Mini-flow: `90d inactive → "We miss you" email → Re-engaged?`
Stats: 23 sent, 34.8% re-engaged. Active status (green dot). Toggle switch.

#### Bounce Handler (compact card)

Mini-flow: `Monitor bounces → ≥5% threshold → Pause type`
Warning status (amber dot). Incident callout: "Apr 27: Sponsor Spotlight paused at 5.2%" (red-tinted background). Toggle switch.

### Live Activity Feed (2fr, right panel)

Scrollable event list (10 items visible). Each event:
- Colored dot: Welcome (indigo), Delivered (green), Opened (blue), Clicked (teal), Bounce (red), System (gray)
- Description with LGPD-masked email
- Relative timestamp
- `evtFadeIn` animation with stagger

Filter chips: "All" / "Webhooks" / "Crons" (single-select).

Legend row at top showing dot colors + labels.

### System Automations (3 cron cards, below split)

Horizontal row of 3 cards:

| Cron | Expression | Frequency | LGPD |
|---|---|---|---|
| Scheduled Send | `0 8 * * *` | Daily 8:00 AM | — |
| Tracking Anonymization | `0 4 * * *` | Daily 4:00 AM | LGPD badge |
| Webhook Purge | `0 5 * * 0` | Weekly (Sundays) | — |

Each card:
- Name + icon
- Cron expression in monospace
- Frequency label
- LGPD badge (where applicable, shield icon + "LGPD")
- Health dots: 7 circles representing last 7 runs (green=success, red=failure, gray=pending). Hover on dot shows date + status. Scale animation on hover.
- "History" button to view full run log

### Summary Bar

"6 automations · 3 workflows active · 3 crons healthy · 1 incident (3d ago)" + keyboard hints (Enter: Open, C: Configure, L: View log).

---

## Tab 5: Audience

Subscriber management, growth analytics, and LGPD compliance overview.

### Audience Health Strip (6 metrics)

| Metric | Value | Context |
|---|---|---|
| Unique Subscribers | 580 | total |
| Subscriptions | 742 across 5 types | total (1.28 avg types/person) |
| Net Growth (30d) | +34 | green |
| Churn Rate | 2.1% | neutral |
| Avg Open Rate | 44.8% | trend |
| LGPD Consent | 98.2% | green, shield icon |

### Growth + Distribution Row (3fr + 2fr)

#### Growth Chart (3fr, recharts area)

30-day view. Two series: New subscribers (green area fill) and Unsubscribes (red area fill, below axis or separate lighter treatment). X-axis: dates. Y-axis: count. "Today" vertical marker line. Legend: "New subscribers avg 2.1/day" + "Unsubscribes avg 0.3/day". Grid at gray-800.

#### Distribution Chart (2fr, horizontal bars)

Horizontal bar chart showing subscription distribution across types:

| Type | Share | Count |
|---|---|---|
| Weekly Digest | 33.3% | 247 |
| Career Corner | 25.5% | 189 |
| Dev Deep Dive | 17.8% | 132 |
| Behind the Code | 13.2% | 98 |
| Sponsor Spotlight | 10.2% | 76 (paused, dimmed) |

Bars colored by type color. `barGrow` animation (0.8s ease-out). Overlap note below: "580 unique · avg 1.28 types/person".

### Engagement by Type (5 cards grid)

5 cards in a responsive grid row (one per type). Each card:
- Left accent border (type color, 3px)
- Type name + colored dot
- Subscriber count
- Stats: Open rate, Click rate, Bounce rate
- Sparkline SVG (open rate trend, 6 points, type color)
- Paused type (Sponsor Spotlight): `opacity: 0.55`, "Paused" badge, bounce rate in red (5.2%)

### Subscriber Table

#### Toolbar
- Search input: "Search by email..." with Lucide search icon
- Filter chips: All (580), Active (548), At risk (18), Bounced (6), Unsubscribed (8) — single-select, active chip indigo
- Export CSV button (outline, download icon)

#### Table (8 columns)

| Column | Sortable | Content |
|---|---|---|
| Subscriber | Yes (aria-sort) | Avatar initials circle (aria-hidden) + LGPD-masked email (m***a@example.com) + full name below |
| Types | No | Colored tag badges for subscribed types |
| Subscribed | Yes | Date (e.g., "Mar 15, 2026") |
| Opens (30d) | Yes | Number |
| Clicks (30d) | Yes | Number |
| Engagement | Yes | Score bar (0-100, colored: green >70, amber 40-70, red <40) with `barGrow` animation |
| Status | No | Badge: Active (green), At risk (amber), Bounced (red), Unsubscribed (gray) |
| Actions | No | Kebab menu (View profile, Export data, Remove) |

- Zebra striping: alternating row backgrounds (`#111827` / `#0d1117`)
- Sortable columns: `tabindex="0"`, `aria-sort="ascending|descending|none"`, `focus-visible` ring
- Hover row highlight

#### Pagination
"Showing **1–10** of **580** subscribers" + page navigation (1, 2, 3 ... 58, > next). 10 per page.

### Bottom Row (3 columns)

#### Locale Distribution (donut chart, SVG)
Donut (r=14, C=87.96): 73% pt-BR (423 subscribers, indigo segment, dasharray 64.21) + 27% en (157 subscribers, teal segment, dasharray 23.75). Center: total "580". Legend below with colored dots + label + count.

#### LGPD Consent Metrics
4 metrics:
- Newsletter consent: 100% (green)
- Analytics consent: 72.4% (amber)
- Anonymized subscribers: 8 (gray)
- Consent version: v2.0 (badge)

Shield icon + "LGPD" header. Each metric as a row with label + value.

#### Recent Activity
5 events with `evtFadeIn` stagger animation. Same format as other activity feeds: colored dot + description + masked email + timestamp.

### Summary Bar

`role="status"` for screen readers. "580 subscribers · 742 subscriptions · 34 net growth (30d)". Keyboard hints: Enter: View, S: Search, E: Export.

---

## Cross-Tab Patterns

### Shared Chrome

All 5 tabs share:
1. **Sidebar** (200px, `#0a0b14` bg): OneCMS navigation with sections (Content, Newsletters active, Campaigns, Settings). Logo top-left. User avatar bottom.
2. **Breadcrumb**: `OneCMS > {site.name} > Newsletters` (9px, gray-500, Lucide chevron separators)
3. **Header row**: "Newsletters" title (18px/700) + live update indicator (green pulsing dot + "Updated just now" in 9px gray-500) + action buttons right (New Edition primary, settings icon, notifications bell with red dot)
4. **Tab bar**: 5 tabs with icons. Active tab: indigo bottom border (2px) + indigo text. Inactive: gray-500 text + transparent border. Badge counts on Editorial (active editions) and Automations (if incidents).
5. **Type filter chips**: Below tab bar. Persistent selection across tabs. "All Types (5)" + one per type with colored dot.

### Health/KPI Strip Pattern

Every tab opens with a horizontal strip of 4-6 metric cards. Consistent styling:
- Gray-900 bg, gray-800 border, 10px radius
- Label: 10px gray-400, uppercase
- Value: 16-20px/700-800
- Trend/context: 9px with colored pill or text
- Fixed height per strip, responsive horizontal scroll on small screens

### Summary Bar Pattern

Every tab closes with a sticky bottom bar:
- Gray-900 bg, gray-800 top border
- Key summary stats left-aligned
- Keyboard shortcut hints right-aligned (monospace, kbd-styled)
- `role="status"` for screen reader announcements

### LGPD Compliance

- **Email masking:** All subscriber emails displayed as `m***a@example.com` (first char + *** + last char before @). Applied client-side via utility function. Full email never sent to client except in export flows.
- **LGPD badges:** Shield icon + "LGPD" label on: Tracking Anonymization cron, consent metrics panel, any feature touching PII.
- **Consent version:** Displayed as "v2.0" badge where consent data is shown.
- **Anonymized count:** Shown in Audience tab LGPD panel (8 anonymized subscribers).
- **Tracking consent gating:** Open/click tracking data only shown for subscribers with `tracking_consent=true`.

### Multi-Site Readiness

- Breadcrumb dynamically shows current site name from `getSiteContext()`
- All queries scoped by `site_id` from middleware headers
- Newsletter type colors stored per-type in DB (`newsletter_types.color` column), not hardcoded
- Type names, cadence configs, and subscriber data all site-scoped
- No hardcoded references to "bythiagofigueiredo" — all labels from DB

### Accessibility

- All interactive elements have `focus-visible` outlines (2px `#818cf8`, offset 2px)
- Tab bar uses `role="tablist"` / `role="tab"` / `role="tabpanel"` with `aria-selected`
- Toggle switches use `role="switch"` with `aria-checked`
- Sortable table columns: `tabindex="0"`, `aria-sort`, keyboard-navigable
- Summary bars: `role="status"` for live region announcements
- Avatar initials circles: `aria-hidden="true"` (decorative)
- Color never used as sole differentiator — always paired with text labels or icons
- Chart data available in table format via "View as table" toggle (screen reader accessible)

### Keyboard Shortcuts

| Context | Key | Action |
|---|---|---|
| Global | `N` | New Edition |
| Global | `1-5` | Switch tab (1=Overview, 5=Audience) |
| Editorial | `F` | Focus filter |
| Editorial | `/` | Focus search |
| Editorial | Arrow keys | Navigate kanban cards |
| Editorial | `Enter` | Open selected edition |
| Audience | `S` | Focus search |
| Audience | `E` | Export CSV |
| Automations | `C` | Configure selected workflow |
| Automations | `L` | View log for selected |

Shortcuts only active when no input/textarea is focused. Displayed in summary bars with `<kbd>` styling.

---

## Data Model Requirements

### New Columns/Tables

No new tables needed — this redesign consumes existing Sprint 5e tables. Required columns that may need addition:

| Table | Column | Type | Purpose |
|---|---|---|---|
| `newsletter_types` | `color` | `text` | Already exists (Sprint 5e). Type accent color hex. |
| `newsletter_types` | `sort_order` | `int` | Already exists. Display ordering. |
| `newsletter_editions` | `idea_notes` | `text` | New. Free-text notes for Idea-stage editions. |
| `newsletter_editions` | `idea_created_at` | `timestamptz` | New. Tracks when edition entered Idea stage (for aging). |
| `newsletter_editions` | `review_entered_at` | `timestamptz` | New. Tracks when edition entered Review stage (for bottleneck detection). |

### Computed Metrics (not stored, calculated at query time)

- **Engagement score per subscriber:** Weighted formula from opens (40%) + clicks (40%) + recency (20%) over 30d window
- **Newsletter health score:** Composite of deliverability (25%), engagement (25%), growth (25%), compliance (25%)
- **Pipeline velocity:** Avg days between status transitions over rolling 30d
- **Cohort retention:** Monthly cohort × month-offset matrix from `newsletter_subscriptions.created_at` + `newsletter_sends.opened_at`
- **Fill rate:** Scheduled editions / total cadence-generated slots in current month

### Key Queries (by tab)

**Overview:**
```sql
-- KPI strip
SELECT count(*) as total_subs FROM newsletter_subscriptions WHERE site_id = $1 AND status = 'active';
SELECT count(*) as editions_sent FROM newsletter_editions WHERE site_id = $1 AND status = 'sent';
-- Sparklines: 7-point aggregated from newsletter_sends grouped by week
-- Funnel: aggregate from newsletter_sends (sent → delivered → opened → clicked)
-- Cohort: pivot on newsletter_subscriptions.created_at month × newsletter_sends.opened_at month
```

**Editorial:**
```sql
-- All editions in pipeline (non-archived), with type join
SELECT e.*, t.name as type_name, t.color as type_color
FROM newsletter_editions e
LEFT JOIN newsletter_types t ON e.type_id = t.id
WHERE e.site_id = $1 AND e.status != 'archived'
ORDER BY e.updated_at DESC;
```

**Schedule:**
```sql
-- Cadence config per type
SELECT * FROM newsletter_types WHERE site_id = $1 ORDER BY sort_order;
-- Scheduled editions for calendar
SELECT e.id, e.subject, e.slot_date, e.status, t.color
FROM newsletter_editions e
JOIN newsletter_types t ON e.type_id = t.id
WHERE e.site_id = $1 AND e.slot_date BETWEEN $2 AND $3;
```

**Audience:**
```sql
-- Subscriber list with engagement
SELECT s.*, 
  count(ns.id) FILTER (WHERE ns.opened_at IS NOT NULL AND ns.sent_at > now() - interval '30d') as opens_30d,
  count(nce.id) FILTER (WHERE nce.clicked_at > now() - interval '30d') as clicks_30d
FROM newsletter_subscriptions s
LEFT JOIN newsletter_sends ns ON ns.subscriber_email = s.email
LEFT JOIN newsletter_click_events nce ON nce.send_id = ns.id
WHERE s.site_id = $1
GROUP BY s.id
ORDER BY s.created_at DESC
LIMIT 10 OFFSET $2;
```

---

## Charting Library

**recharts** (already installed in `apps/web`). Used for:
- Subscriber Growth area chart (Overview + Audience)
- Open Rate Trend multi-line chart (Overview)
- Editions by Type donut (Overview)
- Locale distribution donut rendered as inline SVG (simple 2-segment donut, recharts overhead not justified)

Sparklines and health gauge rendered as inline SVGs (too small/custom for recharts overhead). Funnel and heatmap are custom components (HTML/CSS grid with calculated widths/colors).

---

## Migration from Current Page

The current `/cms/newsletters` page (`page.tsx` + `newsletters-connected.tsx`) is replaced entirely. Existing components reused where applicable:

| Current Component | Disposition |
|---|---|
| `type-cards.tsx` | Replaced by Publication Performance cards (Overview) + Cadence cards (Schedule) |
| `type-modal.tsx` | Kept — invoked from Publication Performance "Edit" action |
| `schedule-modal.tsx` | Kept — invoked from Scheduled column cards and calendar clicks |
| `delete-confirm-modal.tsx` | Kept — invoked from kebab menus across tabs |
| `toast-provider.tsx` | Kept — wraps entire hub |
| `use-keyboard-shortcuts.ts` | Extended with per-tab shortcuts |
| `newsletters-connected.tsx` | Replaced by `NewsletterHubClient` with tab state management |

New components to create:
- `NewsletterHubClient` (tab orchestrator)
- `OverviewTab` + sub-components (KpiStrip, HealthGauge, SubscriberGrowthChart, EngagementFunnel, etc.)
- `EditorialTab` + `KanbanBoard` + `KanbanColumn` + `KanbanCard`
- `ScheduleTab` + `MonthCalendar` + `AgendaList` + `CadenceCard`
- `AutomationsTab` + `WorkflowCard` + `CronCard` + `ActivityFeed`
- `AudienceTab` + `SubscriberTable` + `GrowthChart` + `DistributionChart` + `EngagementCard`
- Shared: `HealthStrip`, `SummaryBar`, `TypeFilterChips`, `SparklineSvg`

---

## Visual Mockups

All 5 tabs have approved HTML mockups at 100/100 score:

| Tab | File | Score |
|---|---|---|
| Overview | `.superpowers/brainstorm/1543-1777564091/content/tab-overview-v3.html` | 100/100 |
| Editorial | `.superpowers/brainstorm/1543-1777564091/content/tab-editorial.html` | 100/100 |
| Schedule | `.superpowers/brainstorm/1543-1777564091/content/tab-schedule.html` | 100/100 |
| Automations | `.superpowers/brainstorm/1543-1777564091/content/tab-automations.html` | 100/100 |
| Audience | `.superpowers/brainstorm/1543-1777564091/content/tab-audience.html` | 100/100 |

Open in browser for pixel-perfect reference during implementation.

---

## Open Decisions

None — all decisions resolved during brainstorming. Key decisions made:

1. **5-tab workspace** over single scrollable page or collapsible sections
2. **Kanban board** for editorial (not table/list as primary view)
3. **Calendar + agenda split** for schedule (not timeline or list)
4. **Workflow visualizations** for automations (not just config panels)
5. **recharts** for charts (already installed, not adding chart.js or visx)
6. **Inline SVG sparklines** for small chart elements (not recharts for sparklines)
7. **Email masking client-side** (LGPD compliance without server-side complexity for display)
8. **URL search param** for tab state (not React state — enables deep linking and browser navigation)
9. **@dnd-kit** preferred for kanban drag-and-drop (lighter than react-beautiful-dnd, actively maintained)
