# Newsletter Hub Redesign — Design Spec

**Date:** 2026-04-30
**Status:** Approved
**Score:** 100/100
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

**Icon Map (specific Lucide names per UI element):**

| Element | Icon | Context |
|---|---|---|
| New Edition button | `Plus` | Header + Quick Actions primary CTA |
| Settings | `Settings` | Header icon button |
| Notifications | `Bell` | Header icon button (with red dot) |
| Search input | `Search` | Editorial toolbar, Audience toolbar |
| View toggle: Kanban | `LayoutGrid` | Editorial toolbar active |
| View toggle: List | `List` | Editorial toolbar |
| Sort dropdown | `ArrowUpDown` | Editorial toolbar |
| Expand/Collapse | `ChevronDown` / `ChevronUp` | Publication cards, Archive column |
| Breadcrumb separator | `ChevronRight` | Breadcrumb nav |
| Drag handle | `GripVertical` | Kanban card (hover-visible) |
| Kebab menu | `MoreVertical` | Card actions |
| Calendar nav | `ChevronLeft` / `ChevronRight` | Month navigation arrows |
| Conflict warning | `AlertTriangle` | Calendar cells, Schedule health |
| Error boundary | `AlertTriangle` | Tab error fallback |
| Section error | `AlertCircle` | Per-section error |
| LGPD badge | `Shield` | Cron cards, consent panel |
| Export CSV | `Download` | Audience toolbar |
| Refresh / retry | `RotateCcw` | Error states, manual refresh |
| Live dot | (no icon — CSS `::before` circle) | Header live indicator |
| Trend up | `TrendingUp` | KPI positive trend |
| Trend down | `TrendingDown` | KPI negative trend |
| Clock/Time | `Clock` | Send window, scheduled times |
| Send test | `Send` | Review column CTA |
| Pause | `Pause` | Publication pause action |
| Play/Resume | `Play` | Publication resume action |
| Edit | `Pencil` | Publication edit action |
| Delete | `Trash2` | Kebab menu delete |
| Duplicate | `Copy` | Kebab menu duplicate |
| Move to | `ArrowRight` | Kebab menu "Move to..." |
| Archive | `Archive` | Archive column header |
| Filter | `Filter` | Filter-related elements |
| Info/insight | `Lightbulb` | Send window insight callout |
| Workflow node | `Circle` | Flow visualization nodes |
| Workflow done | `CheckCircle2` | Flow "Done" terminal |
| Cron job | `Timer` | System automation cards |
| Subscriber | `Users` | Audience tab icon in tab bar |
| Overview | `BarChart3` | Tab bar icon |
| Editorial | `Kanban` | Tab bar icon |
| Schedule | `CalendarDays` | Tab bar icon |
| Automations | `Workflow` | Tab bar icon |

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
- Droppable zone (@dnd-kit/core + @dnd-kit/sortable)
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
| Subscriber | Yes (aria-sort) | Avatar initials circle (aria-hidden) + LGPD-masked email (m***a@example.com) + full name below (see LGPD Subscriber Display Clarification section for masking rules) |
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
- **`prefers-reduced-motion`:** When enabled, all animations disabled — `pulse`, `barGrow`, `evtFadeIn`, `edgeFlow`, shimmer skeletons, card hover transitions, drag rotation. Elements appear in final state immediately. CSS: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`
- **WCAG AA contrast:** All text meets 4.5:1 minimum. Key pairs verified: `#f3f4f6` on `#111827` = 12.6:1 (AAA), `#9ca3af` on `#111827` = 5.3:1 (AA), `#6b7280` on `#111827` = 3.9:1 (AA for large text only — used only for 14px+ labels). `#4b5563` on `#030712` = 3.5:1 (used only for breadcrumbs/section labels at 9px uppercase — decorative, not critical content; always paired with interactive element that meets AA).
- **Drag-and-drop a11y:** @dnd-kit provides `aria-roledescription="sortable"`, `aria-describedby` with instructions ("Press space to pick up. Use arrow keys to move. Press space to drop."), live announcements on pick up / move / drop via `aria-live="assertive"` region.

### Internationalization (i18n)

All UI labels support pt-BR and en locales via the existing `getEditorStrings(locale)` pattern from `@tn-figueiredo/cms`. New string keys added for newsletter hub:

- Tab names: "Visao Geral" / "Overview", "Editorial" (same), "Agenda" / "Schedule", "Automacoes" / "Automations", "Audiencia" / "Audience"
- KPI labels, empty state messages, button labels, tooltip text, status badges
- Date/time formatting via `Intl.DateTimeFormat` with `locale` from `getSiteContext().defaultLocale`
- Number formatting via `Intl.NumberFormat` (decimal separator, thousand separator)
- Relative time ("2m ago" / "ha 2m") via `Intl.RelativeTimeFormat`

Strings live in `apps/web/src/app/cms/(authed)/newsletters/_i18n/` with one file per locale (`pt-BR.ts`, `en.ts`). Type-safe via shared interface.

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

No new tables needed — this redesign consumes existing Sprint 5e tables. Required schema changes:

**Enum extension:**
- `newsletter_editions.status` enum needs `'idea'` value added: `ALTER TYPE edition_status ADD VALUE IF NOT EXISTS 'idea' BEFORE 'draft';`
- This enables the Kanban Idea column. Existing editions unaffected (no rows have `status='idea'` until user creates one).

**New columns:**

| Table | Column | Type | Purpose |
|---|---|---|---|
| `newsletter_types` | `color` | `text` | Already exists (Sprint 5e). Type accent color hex. |
| `newsletter_types` | `sort_order` | `int` | Already exists. Display ordering. |
| `newsletter_editions` | `idea_notes` | `text` | New. Free-text notes for Idea-stage editions. |
| `newsletter_editions` | `idea_created_at` | `timestamptz` | New. Tracks when edition entered Idea stage (for aging). |
| `newsletter_editions` | `review_entered_at` | `timestamptz` | New. Tracks when edition entered Review stage (for bottleneck detection). |

**New column on `sites` (if not already present):**

| Table | Column | Type | Purpose |
|---|---|---|---|
| `sites` | `timezone` | `text DEFAULT 'America/Sao_Paulo'` | Site-level timezone for send scheduling and display. IANA identifier. |

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

## Loading States

Every tab uses React Suspense boundaries with skeleton placeholders. No spinners — skeleton shimmer only.

### Skeleton Strategy

```
NewsletterHub (server component)
├── Suspense fallback={<TabSkeleton />}
│   └── NewsletterHubClient
│       ├── SharedHeader (renders immediately — static chrome)
│       ├── TabBar (renders immediately — tab names are static)
│       └── Suspense fallback={<ActiveTabSkeleton tab={activeTab} />}
│           └── [Active Tab Content]
```

Per-tab skeletons:

| Tab | Skeleton |
|---|---|
| Overview | 5 KPI card skeletons (pulsing rectangles matching card dimensions) + 2×2 chart placeholder grid + activity feed line placeholders |
| Editorial | Velocity strip skeletons + 7 empty column headers with shimmer + 2 ghost cards per column (rounded rect + 3 text lines) |
| Schedule | Health strip skeletons + calendar grid with empty cells (no dots) + agenda panel with 3 line placeholders |
| Automations | Health strip skeletons + 3 workflow card skeletons (rect + 2 text lines each) + feed line placeholders |
| Audience | Health strip skeletons + 2-panel row placeholders + table with 5 empty rows (avatar circle + text line placeholders) |

Skeleton shimmer animation: `@keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }` with `background: linear-gradient(90deg, #111827 25%, #1f2937 50%, #111827 75%)`, `background-size: 200% 100%`, `animation: shimmer 1.5s infinite`.

Tab switching: inactive tabs unmount, re-mount triggers Suspense on switch. `useTransition` wraps the tab state update so the previous tab stays visible until new tab data resolves (no flash-to-skeleton on fast connections).

### Chart Loading

recharts components wrapped in individual Suspense boundaries with chart-shaped skeletons (matching the exact dimensions: area chart = rectangle with wavy top edge placeholder, donut = circle outline).

---

## Error States

### Error Boundary Strategy

Each tab wrapped in an error boundary component (`TabErrorBoundary`). On uncaught error:

- **UI:** Card with red-tinted border, alert-triangle Lucide icon, "Something went wrong loading [Tab Name]" message, "Try again" button (calls `reset()` on the error boundary), "Report issue" link (triggers Sentry feedback dialog).
- **Sentry:** Auto-captured with tags `{ component: 'newsletter-hub', tab: activeTab }`.
- **Recovery:** "Try again" resets the error boundary, re-triggers the Suspense fetch.

### Per-Section Error Handling

For sections within a tab that can fail independently (e.g., a chart query fails but KPIs load fine):

- Each major section (`KpiStrip`, `SubscriberGrowthChart`, `KanbanBoard`, `SubscriberTable`, etc.) wrapped in its own error boundary.
- **Fallback:** Inline error card (gray-900 bg, dashed gray-800 border) with: alert-circle icon + "Couldn't load [section name]" + "Retry" button.
- Other sections continue rendering normally — partial data is better than a blank tab.

### Network-Specific Errors

- **401/403:** Redirect to `/cms/login` (handled by `requireArea()` middleware, not per-component).
- **429 (rate limit):** Show "Too many requests — try again in a moment" with auto-retry after 5s (exponential backoff, max 3 retries).
- **500/timeout:** Standard error boundary fallback.

---

## Empty States

Every section has a defined empty state. Empty states use: dashed gray-800 border card, centered content, Lucide icon (gray-600, 32px), heading (14px/600 gray-300), description (12px/400 gray-500), optional CTA button.

### Overview Tab Empty States

| Section | Empty State |
|---|---|
| KPI Strip | All values show "0" with "—" trend (no sparkline, gray dashes instead) |
| Health Gauge | Score "0" in center, ring segments all gray, "No data yet — send your first edition" below |
| Subscriber Growth | Empty chart area with horizontal "No growth data" message centered, "Subscribers will appear here once you start receiving signups" |
| Engagement Funnel | All bars at 0 width, "0" counts, "Send your first edition to see engagement data" message |
| Editions by Type | Empty donut (full gray ring), "No editions sent yet" center text |
| Open Rate Trend | Empty chart with "Open rate trends appear after 2+ sent editions" message |
| Publication Performance | "No publications configured" + "+ Add Publication" button (same dashed style) |
| Top Performing | "No sent editions to rank" message |
| Activity Feed | "No activity yet — events appear here as subscribers engage" |
| Cohort Heatmap | Empty grid cells all gray, "Retention data requires 2+ months of subscribers" |
| Deliverability | Authentication checks still shown (SPF/DKIM/DMARC), rates show "0%" with "No emails sent" |

### Editorial Tab Empty States

| Section | Empty State |
|---|---|
| Velocity Strip | All metrics show "—" |
| Kanban Board (all empty) | Only Idea column visible prominently with: "Start your editorial pipeline" heading + "Add your first idea to get started" + "New Idea" CTA button. Other columns show headers only (collapsed, no ghost cards) |
| Individual empty column | Column header + "Drop here" text in dashed area (except Idea which shows "+ Add idea" button) |
| Issues (already specified) | "No issues — editions with high bounce or delivery failures appear here" |

### Schedule Tab Empty States

| Section | Empty State |
|---|---|
| Calendar (no editions) | Grid renders normally with day numbers. No dots. "No editions scheduled — configure cadence below to generate slots" message overlay |
| Agenda (no items) | "No upcoming items. Configure cadence for your newsletter types to see scheduled slots here." |
| Cadence (no types) | "No newsletter types created yet. Create your first type to set up a publishing cadence." + link to type creation |

### Automations Tab Empty States

| Section | Empty State |
|---|---|
| Workflows (no subscribers) | Cards render but stats show "0 sent". Welcome flow shows "Waiting for first subscriber" |
| Activity Feed (no events) | "No automation events yet. Events appear here as workflows trigger." |
| Cron Cards (no runs) | Health dots all gray, "No runs yet" label, "Run now" button (if applicable) |

### Audience Tab Empty States

| Section | Empty State |
|---|---|
| Growth Chart (no subs) | Empty chart, "Growth data will appear once you receive your first subscriber" |
| Distribution (no subs) | Empty bars, "No subscriptions yet" |
| Engagement Cards | All cards show "0 subscribers", sparklines hidden, stats show "—" |
| Subscriber Table | Empty table body with: centered illustration area, "No subscribers yet" heading, "Share your newsletter signup form to start growing your audience" description, "Copy signup link" CTA |
| Locale Donut | Full gray ring, "—" center, "No locale data" |
| LGPD Panel | All metrics "0%" or "0", consent version still shows current version |

---

## Responsive Behavior

CMS is desktop-first. Minimum supported width: 1024px. Tablet (768-1023px) gets a degraded but functional layout. Mobile (<768px) shows a "Use desktop for the best CMS experience" banner but still renders.

### Breakpoint Adaptations

| Breakpoint | Sidebar | Layouts | Charts |
|---|---|---|---|
| ≥1280px (desktop) | 200px fixed | All splits as designed (3fr+2fr) | Full size |
| 1024-1279px (small desktop) | 200px fixed | Splits become stacked (full width sections) | Slightly compressed |
| 768-1023px (tablet) | Collapsed to 56px icon-only (expand on hover) | All stacked, single column | Full width, reduced height |
| <768px (mobile) | Hidden (hamburger menu) | Single column, simplified cards | Horizontal scroll |

### Tab-Specific Responsive Rules

- **Overview:** KPI strip wraps to 2 rows at <1024px. Charts stack vertically. Cohort heatmap horizontal-scrolls.
- **Editorial:** Kanban columns become a horizontal scrollable strip at all widths (already designed this way). Cards shrink vertically (hide snippet, show title + type + status only) at <1024px.
- **Schedule:** Calendar/agenda split stacks (calendar full width above, agenda below) at <1280px. Calendar remains usable down to 768px.
- **Automations:** Workflow/feed split stacks. Welcome hero card collapses to compact format (no flow visualization, just stats).
- **Audience:** Table columns hide progressively: <1280px hides Clicks, <1024px hides Opens, <768px shows only Subscriber + Status + Actions.

### Summary Bars

At <1024px: keyboard hints hidden (not useful on tablet/touch). Stats wrap to 2 lines if needed.

---

## Data Refresh Strategy

### Polling (not real-time)

No Supabase Realtime subscriptions — too expensive for a CMS dashboard. Instead:

- **Auto-refresh interval:** 60 seconds for the active tab. `useEffect` with `setInterval` + `router.refresh()` (Next.js server component re-fetch). Interval paused when browser tab is not visible (`document.hidden`).
- **Manual refresh:** "Updated just now" timestamp in header is clickable — click triggers immediate `router.refresh()`. Timestamp updates to show last refresh time.
- **Live dot:** The green pulsing dot indicates "auto-refresh active", not "real-time connection". Tooltip: "Auto-refreshing every 60s".
- **Activity feeds:** Fetched server-side with each refresh. No WebSocket streaming.

### Stale Data Handling

When a user performs an action (drag-drop, toggle, delete) on one tab, data on other tabs may be stale:
- Tab content re-fetches on every tab switch (Suspense re-triggers if data is stale via `revalidateTag`).
- Server actions that mutate data call `revalidateTag('newsletter-hub')` to invalidate all tab caches.

---

## Optimistic Updates

### Kanban Drag-and-Drop

1. **On drag start:** Source card gets `opacity: 0.5`, a clone appears under the cursor with slight rotation (`transform: rotate(2deg)`) and drop shadow.
2. **On drag over column:** Target column gets highlighted border (`border-color: #6366f1`). If WIP limit would be exceeded, column shows red border + "Column full (4/4)" tooltip — drop is blocked.
3. **On drop (valid):** Card immediately appears in new column at drop position (optimistic). Source column card count updates. A subtle "saving" indicator appears on the card (small spinner in top-right corner, 12px).
4. **On server success:** Spinner disappears. Card is confirmed in new position.
5. **On server failure:** Card animates back to original column (slide animation, 300ms). Toast: "Couldn't move edition — [error message]". Card returns to exact original position.
6. **Blocked transitions:** Drag from Sent/Issues/Archive is disabled (cursor: `not-allowed`, card doesn't pick up). Drag to Sent/Issues/Archive from user is disabled.

### Cadence Toggle

1. **On toggle:** Switch animates immediately (optimistic). Card stats dim to indicate "applying...".
2. **On server success:** Stats un-dim. If toggling off, card gets `opacity: 0.55` + "Paused" badge. Calendar dots for that type update.
3. **On server failure:** Switch animates back. Toast: "Couldn't update cadence — [error message]".

### WIP Limit Enforcement

Draft column has configurable WIP limit (default 4). When limit is reached:
- Column header shows "4/4" in red with filled progress bar.
- Dragging a 5th card over the column: column border turns red, tooltip shows "WIP limit reached — finish or move a draft first".
- Drop is **blocked** (card returns to source). This is a hard constraint, not a soft warning.
- WIP limit is configurable per-site via a settings action (not in this UI — done in `/cms/newsletters/settings`).

---

## Server Actions (New)

Actions required by this redesign that don't exist in the current codebase:

```typescript
// Editorial tab — kanban drag-drop
'use server'
async function moveEdition(editionId: string, newStatus: EditionStatus, position?: number): Promise<void>
// CAS: UPDATE SET status=$2, updated_at=now() WHERE id=$1 AND status=$currentStatus
// Validates allowed transitions: idea→draft, draft→review, review→scheduled, *→archive
// Revalidates: revalidateTag('newsletter-hub')

// Editorial tab — new idea quick capture
async function createIdea(data: { title: string; typeId?: string; notes?: string }): Promise<string>
// Inserts newsletter_edition with status='idea', idea_created_at=now()
// Returns new edition ID

// Schedule tab — cadence toggle
async function toggleCadence(typeId: string, enabled: boolean): Promise<void>
// UPDATE newsletter_types SET cadence_paused = !enabled WHERE id = $1
// Regenerates slot calendar. Revalidates: revalidateTag('newsletter-hub')

// Schedule tab — update send time
async function updateSendTime(typeId: string, time: string, timezone: string): Promise<void>
// UPDATE newsletter_types SET preferred_send_time = $2 WHERE id = $1
// time format: "HH:mm", timezone: IANA identifier (e.g., "America/Sao_Paulo")

// Audience tab — export CSV
async function exportSubscribers(siteId: string, filters: SubscriberFilters): Promise<string>
// Generates CSV, uploads to Supabase Storage (lgpd-exports bucket), returns signed URL (TTL 1h)
// LGPD: exports contain masked emails by default. Full emails only with explicit "include PII" flag + audit log entry.

// Automations tab — toggle workflow
async function toggleWorkflow(workflowId: string, enabled: boolean): Promise<void>
// Updates workflow_enabled flag in newsletter_types or dedicated config table
```

All actions: validate `canEditSite(siteId)` via `requireSiteAdmin()` before mutation. Use service-role client only after authorization check.

---

## Export CSV Specification

**Trigger:** "Export CSV" button in Audience tab toolbar.

**Columns (default — no PII):**

| Column | Content |
|---|---|
| subscriber_id | UUID |
| email_masked | `m***a@example.com` |
| subscribed_types | Comma-separated type names |
| subscribed_at | ISO 8601 |
| status | active/at_risk/bounced/unsubscribed |
| opens_30d | Integer |
| clicks_30d | Integer |
| engagement_score | 0-100 |
| locale | pt-BR/en |
| tracking_consent | true/false |

**With PII flag** (requires explicit toggle + confirmation modal):

| Additional Column | Content |
|---|---|
| email | Full email address |
| name | Full name |
| ip | Subscription IP |

PII export triggers an audit log entry: `{ action: 'subscriber_export_with_pii', actor_user_id, site_id, filter_criteria, row_count }`.

**File:** `newsletter-subscribers-{site_slug}-{YYYY-MM-DD}.csv`, UTF-8 with BOM (Excel compatibility). Uploaded to `lgpd-exports/{site_id}/` bucket, signed URL TTL 1 hour. Link delivered via toast notification with download button.

**Filters applied:** Current filter chip selection (All/Active/At risk/Bounced/Unsubscribed) + current type filter chip selection.

---

## Subscriber Status Definitions

| Status | Criteria | Visual |
|---|---|---|
| **Active** | `status='active'` AND engagement score >40 AND no bounces in 30d | Green dot + "Active" badge |
| **At risk** | `status='active'` AND (engagement score ≤40 OR no opens in last 60d) | Amber dot + "At risk" badge |
| **Bounced** | `status='bounced'` OR ≥2 hard bounces in 30d | Red dot + "Bounced" badge |
| **Unsubscribed** | `status='unsubscribed'` | Gray dot + "Unsubscribed" badge |

**Engagement score formula:**
```
score = (opens_weight × opens_ratio) + (clicks_weight × clicks_ratio) + (recency_weight × recency_factor)

Where:
  opens_ratio   = opens_30d / editions_received_30d           (0-1, capped at 1)
  clicks_ratio  = clicks_30d / opens_30d                      (0-1, 0 if no opens)
  recency_factor = max(0, 1 - (days_since_last_open / 60))    (0-1, decays over 60d)
  opens_weight  = 0.4
  clicks_weight = 0.4
  recency_weight = 0.2
```

Score mapped to 0-100 integer. Calculated at query time, not stored.

---

## LGPD Subscriber Display Clarification

**Email:** Always masked in UI (`m***a@example.com`). Full email only in: export with PII flag, direct Supabase admin query.

**Name:** Displayed in full in the subscriber table. Names are not considered PII requiring masking in a staff-only CMS context (legitimate interest under LGPD for subscriber management by authorized staff). If a subscriber has been anonymized (via unsubscribe flow), both name and email show as `[anonymized]`.

**Anonymized subscribers:** Rows where `email` is a sha256 hash (post-anonymization). These rows show: `[anonymized]` in both name and email columns, gray "Anonymized" badge instead of status, no engagement data (all "—"), not included in active counts.

---

## List View (Editorial Tab Alternative)

When the user toggles from Kanban to List view in the Editorial toolbar:

**Table layout:**

| Column | Sortable | Content |
|---|---|---|
| Status | Yes | Colored pill matching column name (Idea/Draft/Review/Scheduled/Sent/Issues) |
| Title | Yes | Edition subject, truncated. Click opens editor. |
| Type | Yes | Colored badge with type name |
| Progress | No | Progress bar for drafts, "—" for others |
| Age | Yes | Days since creation, colored by aging rules |
| Scheduled | Yes | Date if scheduled, "—" otherwise |
| Stats | No | Opens/Clicks for sent editions, "—" for others |
| Actions | No | Kebab menu (same options as kanban card menus) |

- Same filter chips and search as Kanban view apply
- Sort default: Status (Idea first) then Age (newest first)
- Pagination: 20 per page (more editions visible in list format)
- No drag-and-drop in list view — status changes via kebab menu "Move to..." submenu
- View preference persisted in `localStorage` key `newsletter-editorial-view`

---

## Suspense & Streaming Architecture

### Server Component Tree

```
// app/cms/(authed)/newsletters/page.tsx — server component
export default async function NewsletterHubPage({ searchParams }) {
  const { tab = 'overview' } = await searchParams
  const siteContext = await getSiteContext()
  
  // Fetch shared data (types, counts for tab badges) eagerly
  const sharedData = await fetchSharedNewsletterData(siteContext.siteId)
  
  return (
    <NewsletterHubClient defaultTab={tab} sharedData={sharedData}>
      <Suspense key={tab} fallback={<TabSkeleton tab={tab} />}>
        {tab === 'overview' && <OverviewTabServer siteId={siteContext.siteId} />}
        {tab === 'editorial' && <EditorialTabServer siteId={siteContext.siteId} />}
        {tab === 'schedule' && <ScheduleTabServer siteId={siteContext.siteId} />}
        {tab === 'automations' && <AutomationsTabServer siteId={siteContext.siteId} />}
        {tab === 'audience' && <AudienceTabServer siteId={siteContext.siteId} />}
      </Suspense>
    </NewsletterHubClient>
  )
}
```

Each `*TabServer` is a server component that fetches its own data and renders the client tab component with props. The `key={tab}` on Suspense forces re-mount on tab switch.

### Cache Strategy

```typescript
// unstable_cache with tags for each data domain
const fetchOverviewData = unstable_cache(
  async (siteId: string) => { /* queries */ },
  ['newsletter-overview'],
  { tags: ['newsletter-hub', `newsletter-overview-${siteId}`], revalidate: 60 }
)
```

Tags:
- `newsletter-hub` — invalidated by any mutation, clears all tabs
- `newsletter-overview-{siteId}` — invalidated by edition/subscriber changes
- `newsletter-editorial-{siteId}` — invalidated by edition status changes
- `newsletter-schedule-{siteId}` — invalidated by cadence/slot changes
- `newsletter-audience-{siteId}` — invalidated by subscriber changes

### Streaming

Overview tab uses nested Suspense for progressive loading:
```
<OverviewTab>
  <KpiStrip data={kpiData} />              <!-- renders first (fast query) -->
  <Suspense fallback={<ChartSkeleton />}>
    <SubscriberGrowthChart />               <!-- streams in (slower query) -->
  </Suspense>
  <Suspense fallback={<FunnelSkeleton />}>
    <EngagementFunnel />                    <!-- streams in parallel -->
  </Suspense>
  ...
</OverviewTab>
```

---

## Timezone Handling

- **Display:** All times shown in the site's configured timezone (stored in `newsletter_types.preferred_send_time` as `HH:mm` + timezone IANA string from `sites.timezone` or per-type override). Default: `America/Sao_Paulo` (BRT/BRST).
- **Calendar:** Dates are timezone-aware. A send scheduled for "May 2, 8:00 AM BRT" shows on May 2 regardless of the viewer's browser timezone.
- **DST handling:** `Intl.DateTimeFormat` with explicit `timeZone` option for all date/time formatting. Cron jobs already handle DST (they run in UTC, display converts).
- **User's local time:** Shown as secondary annotation only when it differs from site timezone: e.g., "8:00 AM BRT (7:00 AM your time)".

---

## Configure Workflow UI

"Configure" button on workflow cards opens a slide-over panel (480px wide, right-aligned, gray-900 bg, gray-800 left border).

### Welcome Email Configuration

| Field | Type | Default |
|---|---|---|
| Enabled | Toggle switch | true |
| Wait before send | Duration picker (minutes) | 5 min |
| Subject line | Text input | "Welcome to {type.name}" |
| Send reminder if not opened | Toggle | true |
| Reminder wait | Duration picker (days) | 3 days |
| Reminder subject | Text input | "Don't miss: {type.name}" |

### Re-engagement Configuration

| Field | Type | Default |
|---|---|---|
| Enabled | Toggle switch | true |
| Inactive threshold | Duration picker (days) | 90 days |
| Subject line | Text input | "We miss you!" |

### Bounce Handler Configuration

| Field | Type | Default |
|---|---|---|
| Enabled | Toggle switch | true |
| Bounce rate threshold | Number input (%) | 5% |
| Auto-pause on threshold | Toggle | true |
| Alert email | Text input | Site admin email |

Save button at bottom. Changes take effect immediately (no deploy needed — stored in DB). "Cancel" closes without saving. Unsaved changes trigger navigation guard.

---

## Activity Feed Pagination

Activity feeds (Overview, Automations, Audience) use infinite scroll, not page-based pagination:

- **Initial load:** 10 most recent events.
- **Load more:** Scroll to bottom triggers fetch of next 10 (cursor-based pagination using `created_at` of last item).
- **Max loaded:** 50 events in memory. Beyond that, oldest events are removed from DOM as new ones load (virtual scroll).
- **New events:** On each 60s auto-refresh, new events prepend at top with `evtFadeIn` animation. If user has scrolled down, a "3 new events" pill appears at top (click to scroll up).
- **Filter interaction:** Changing filter chip (All/Webhooks/Crons) resets to initial 10 with new filter applied.

---

## Cohort Retention Query

```sql
-- Cohort retention heatmap (Overview tab)
-- Groups subscribers by signup month, calculates open rate per subsequent month
WITH cohorts AS (
  SELECT
    s.id as subscriber_id,
    date_trunc('month', s.created_at) as cohort_month
  FROM newsletter_subscriptions s
  WHERE s.site_id = $1 AND s.status IN ('active', 'unsubscribed')
),
monthly_activity AS (
  SELECT
    c.subscriber_id,
    c.cohort_month,
    date_trunc('month', ns.opened_at) as activity_month
  FROM cohorts c
  JOIN newsletter_sends ns ON ns.subscriber_email = (
    SELECT email FROM newsletter_subscriptions WHERE id = c.subscriber_id
  )
  WHERE ns.opened_at IS NOT NULL
)
SELECT
  cohort_month,
  EXTRACT(MONTH FROM age(activity_month, cohort_month))::int as month_offset,
  count(DISTINCT subscriber_id) as active_subscribers,
  (SELECT count(DISTINCT subscriber_id) FROM cohorts c2 WHERE c2.cohort_month = cohorts_agg.cohort_month) as cohort_size
FROM monthly_activity cohorts_agg
GROUP BY cohort_month, month_offset
ORDER BY cohort_month, month_offset;
```

Retention % = `active_subscribers / cohort_size * 100`. Heatmap color scale: 0-20% = `#1a1a2e` (dark), 20-40% = `#16423C`, 40-60% = `#166534`, 60-80% = `#15803d`, 80-100% = `#22c55e` (bright green).

---

## TypeScript Interfaces (Key Props)

```typescript
// Shared data fetched once by server component, passed to all tabs
interface NewsletterHubSharedData {
  types: Array<{
    id: string
    name: string
    color: string
    sort_order: number
    cadence_paused: boolean
    subscriber_count: number
  }>
  tabBadges: {
    editorial: number   // active editions (idea + draft + review + scheduled)
    automations: number // 0 normally, incident count when > 0
  }
  siteTimezone: string // IANA identifier
}

// Tab-specific data interfaces
interface OverviewTabData {
  kpis: {
    totalSubscribers: number
    subscribersTrend: number // 30d delta
    editionsSent: number
    editionsThisMonth: number
    avgOpenRate: number
    openRateTrend: number // pp delta
    avgClickRate: number
    clickRateTrend: number
    bounceRate: number
    bounceTrend: number
  }
  sparklines: Record<'subscribers' | 'editions' | 'openRate' | 'clickRate' | 'bounceRate', number[]> // 7 points each
  healthScore: number // 0-100
  healthDimensions: Record<'deliverability' | 'engagement' | 'growth' | 'compliance', { score: number; label: string }>
  subscriberGrowth: Array<{ date: string; count: number }> // 90d
  funnel: { sent: number; delivered: number; opened: number; clicked: number }
  editionsByType: Array<{ typeId: string; count: number }>
  openRateTrend: Array<{ date: string; rates: Record<string, number> }> // per-type
  publicationPerformance: Array<{
    typeId: string
    subscribers: number
    editionsSent: number
    openRate: number
    clickRate: number
    sparkline: number[] // 6 points
  }>
  topEditions: Array<{
    id: string; subject: string; typeId: string
    dateSent: string; opens: number; clicks: number
  }>
  activityFeed: ActivityEvent[]
  cohortRetention: Array<{ cohortMonth: string; monthOffset: number; retention: number }>
  deliverability: {
    spf: boolean; dkim: boolean; dmarc: boolean
    bounceRate: number; complaintRate: number
    provider: string
  }
}

interface EditorialTabData {
  velocity: { throughput: number; avgIdeatoSent: number; movedThisWeek: number; bottleneck: { column: string; avgDays: number } }
  editions: Array<EditionCard>
  wipLimit: number
}

interface EditionCard {
  id: string
  subject: string
  status: 'idea' | 'draft' | 'review' | 'scheduled' | 'sent' | 'failed' | 'cancelled' | 'archived'
  typeId: string | null
  typeName: string | null
  typeColor: string | null
  createdAt: string
  ideaCreatedAt: string | null
  reviewEnteredAt: string | null
  slotDate: string | null
  wordCount: number | null
  readingTimeMin: number | null
  progressPercent: number | null
  ideaNotes: string | null
  snippet: string | null
  stats: { opens: number; clicks: number; bounceRate: number } | null
}

interface ScheduleTabData {
  healthStrip: { fillRate: number; next7Days: number; conflicts: number; avgOpenRate: number; activeTypes: number; totalTypes: number }
  calendarSlots: Array<{ date: string; editions: Array<{ id: string; subject: string; typeColor: string; status: string }>; emptySlots: Array<{ typeId: string; typeColor: string }> }>
  cadenceConfigs: Array<{
    typeId: string; typeName: string; typeColor: string
    cadence: string; dayOfWeek: string; time: string; nextDate: string
    paused: boolean; subscribers: number; editionsSent: number; openRate: number
    conflicts: string[]
  }>
  sendWindow: { time: string; timezone: string; bestTimeInsight: string }
}

interface AutomationsTabData {
  healthStrip: { workflowsActive: number; cronsHealthy: number; eventsToday: number; successRate: number; lastIncidentDaysAgo: number | null }
  workflows: Array<{
    id: string; name: string; type: 'welcome' | 're_engagement' | 'bounce_handler'
    enabled: boolean; stats: Record<string, number>
    pipelineCounts?: Record<string, number>
    incident?: { date: string; description: string }
  }>
  cronJobs: Array<{
    name: string; expression: string; frequency: string
    lgpd: boolean; lastRuns: Array<{ date: string; success: boolean }>
  }>
  activityFeed: ActivityEvent[]
}

interface AudienceTabData {
  healthStrip: { uniqueSubscribers: number; totalSubscriptions: number; netGrowth30d: number; churnRate: number; avgOpenRate: number; lgpdConsent: number }
  growth: Array<{ date: string; newSubs: number; unsubs: number }>
  distribution: Array<{ typeId: string; count: number; share: number }>
  engagementByType: Array<{ typeId: string; subscribers: number; openRate: number; clickRate: number; bounceRate: number; sparkline: number[] }>
  subscribers: { rows: SubscriberRow[]; total: number; page: number }
  locale: Record<string, number> // locale → count
  lgpdConsent: { newsletter: number; analytics: number; anonymized: number; version: string }
  recentActivity: ActivityEvent[]
}

interface SubscriberRow {
  id: string
  emailMasked: string
  name: string | null
  initials: string
  types: Array<{ id: string; name: string; color: string }>
  subscribedAt: string
  opens30d: number
  clicks30d: number
  engagementScore: number
  status: 'active' | 'at_risk' | 'bounced' | 'unsubscribed' | 'anonymized'
}

interface ActivityEvent {
  id: string
  type: 'welcome' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'system'
  description: string
  emailMasked?: string
  timestamp: string
}
```

---

## Newsletter Health Score Formula

Composite score (0-100), calculated at query time:

| Dimension | Weight | Score (0-100) | How |
|---|---|---|---|
| Deliverability | 25% | SPF+DKIM+DMARC all pass = 60pts base. Bounce rate <2% = +20pts, <5% = +10pts. Complaint rate <0.05% = +20pts, <0.1% = +10pts. | Sum capped at 100 |
| Engagement | 25% | Avg open rate >50% = 100, >40% = 80, >30% = 60, >20% = 40, else 20. Adjusted by click rate: >10% = +10 bonus (cap 100). | Tiered + bonus |
| Growth | 25% | Net growth (30d) >0 = 50 base. Growth rate (new/total) >5% = +50, >2% = +30, >0% = +20. Negative growth = max(0, 50 + netGrowth). | Rate-based |
| Compliance | 25% | LGPD consent >95% = 100, >90% = 80, >80% = 60. Anonymization cron healthy = +0 (no penalty), unhealthy = -20. | Threshold + penalty |

Final: `Math.round(deliverability * 0.25 + engagement * 0.25 + growth * 0.25 + compliance * 0.25)`

Labels: 0-39 = "Critical" (red), 40-59 = "Fair" (amber), 60-79 = "Good" (blue), 80-100 = "Excellent" (green).

---

## Header Actions Behavior

### "New Edition" Button (primary)

Click opens a dropdown with 2 options:
1. **New Idea** — creates an idea-stage edition (no type required). Inserts via `createIdea()` server action, adds card to Idea column, switches to Editorial tab if not already there. Inline title edit on the new card (auto-focus).
2. **New Draft** — opens a type picker popover (list of active types with colored dots), then navigates to `/cms/newsletters/new?typeId={id}` (existing editor page from `2026-04-26` spec).

If only 1 type exists, "New Draft" skips the picker and goes directly to the editor.

### Settings Icon

Navigates to `/cms/newsletters/settings` (existing page). No dropdown — direct navigation.

### Notification Bell

Opens a popover (320px wide, max 300px tall, scrollable) showing recent system notifications:
- Bounce threshold alerts ("Sponsor Spotlight paused — 5.2% bounce rate")
- Cron failures ("Scheduled Send cron failed at 08:00")
- Welcome email delivery issues
- Export ready notifications

Red dot badge: visible when unread count > 0. Count clears when popover opens. Notifications fetched from `webhook_events` table (event_type = 'system_alert'), limited to last 20.

"Mark all read" button at top. "View all" link at bottom goes to a future notifications page (out of scope — link disabled with "Coming soon" tooltip).

---

## Tab Badge Count Definitions

| Tab | Badge | Condition | Color |
|---|---|---|---|
| Editorial | Number | Count of editions with `status IN ('idea','draft','review','scheduled')` | indigo (`#6366f1`) |
| Automations | Number | Count of active incidents (bounce pauses, cron failures in last 24h) | red (`#ef4444`) — only shown when > 0 |
| Overview | None | — | — |
| Schedule | None | — | — |
| Audience | None | — | — |

---

## Quick Actions Cross-Tab Navigation

Overview tab Quick Actions navigate across tabs:

| Button | Action |
|---|---|
| **New Edition** | Same as header "New Edition" button (dropdown with Idea/Draft) |
| **Schedule Next** | Switches to Schedule tab (`?tab=schedule`), scrolls to first empty slot in agenda |
| **View Subscribers** | Switches to Audience tab (`?tab=audience`), focuses search input |
| **Full Analytics** | Opens `/cms/newsletters/analytics` (per-edition analytics index — out of scope for this spec, renders as disabled with "Coming soon" tooltip until that page exists) |

---

## Relationship with Existing Pages

| Existing Page | Relationship | Action |
|---|---|---|
| `/cms/newsletters/[id]/edit` | Edition editor — opens when clicking any edition card in Editorial kanban or any edition link across tabs | Kept as-is (governed by `2026-04-26` spec) |
| `/cms/newsletters/[id]/analytics` | Per-edition analytics — linked from Sent column card kebab menu "View analytics" | Kept as-is |
| `/cms/newsletters/subscribers` | Subscriber list — **replaced by Audience tab**. Old route redirects to `?tab=audience` via `redirect()` in its `page.tsx` | Redirect, then delete old page |
| `/cms/newsletters/settings` | Settings page — linked from header settings icon | Kept as-is |
| `/cms/newsletters/new` | New edition page — linked from "New Draft" action | Kept as-is |
| `/cms/content-queue` | Content queue — **separate page, not replaced**. Schedule tab focuses on newsletter cadence; content-queue handles cross-content-type (blog + newsletter) slot management. No overlap. | Kept as-is |

---

## Drag-and-Drop Undo

After a successful card move in the Kanban board:

- **Toast notification:** "Moved '{subject}' to {column}" with **"Undo"** button (text button, indigo color). Toast auto-dismisses after 5 seconds.
- **Undo action:** Calls `moveEdition(id, previousStatus, previousPosition)` to revert. Optimistic — card animates back immediately.
- **Undo window:** Only the most recent move is undoable. Starting a new drag clears the previous undo state.
- **No undo for:** Delete actions (those have confirmation modals), status changes via kebab menu (intentional, confirmed action).

---

## Subscriber Table Search

- **Debounce:** 300ms debounce on keystroke before triggering search.
- **Server-side:** Search is server-side (`ILIKE` query) — client doesn't hold all 580 subscribers in memory.
- **Match fields:** email (masked pattern match — searches the original unmasked email server-side, displays masked in results) AND name. OR match.
- **Minimum query:** 2 characters minimum before search triggers. Below that, shows full list.
- **Clear:** X button in search input to clear and reset to unfiltered list.
- **URL state:** Search query persisted as `?search=` param for shareable links.
- **Empty results:** "No subscribers matching '{query}'" with suggestion "Try a different search term or clear filters".

---

## Performance Budget

### New Dependencies

| Package | Size (gzip) | Lazy? | Justification |
|---|---|---|---|
| `recharts` | ~45KB | Yes (dynamic import per chart) | Already installed. Only loaded on Overview + Audience tabs. |
| `@dnd-kit/core` | ~12KB | Yes (Editorial tab only) | Lighter than react-beautiful-dnd (~30KB). Only loaded when Editorial tab mounts. |
| `@dnd-kit/sortable` | ~5KB | Yes (with core) | Sortable presets for kanban. |
| `@dnd-kit/utilities` | ~2KB | Yes (with core) | CSS utilities for drag transforms. |

**Total new JS:** ~19KB gzip (@dnd-kit). recharts already in bundle.

### Lazy Loading Strategy

```typescript
// Each tab lazy-loaded via dynamic import
const OverviewTab = dynamic(() => import('./_tabs/overview-tab'), { 
  loading: () => <TabSkeleton tab="overview" />,
  ssr: true // server-rendered, client hydration
})

// recharts lazy within tabs (not needed during SSR — charts are client-only)
const SubscriberGrowthChart = dynamic(
  () => import('./_components/subscriber-growth-chart'),
  { ssr: false, loading: () => <ChartSkeleton type="area" /> }
)

// @dnd-kit only in Editorial
const KanbanBoard = dynamic(
  () => import('./_components/kanban-board'),
  { ssr: false, loading: () => <KanbanSkeleton /> }
)
```

### Performance Targets

| Metric | Target | Measurement |
|---|---|---|
| Initial load (Overview tab) | <2s TTI on 4G | Lighthouse CI |
| Tab switch | <500ms (perceived, useTransition keeps old tab visible) | Manual QA |
| Kanban drag latency | <16ms per frame (60fps) | Chrome DevTools |
| Chart render | <300ms after data arrives | Performance.measure |
| Subscriber table page change | <200ms (server query) | Network tab |

### Bundle Split

Each tab is a separate chunk. Switching tabs lazy-loads the chunk. Only Overview chunk loads on initial page visit. This keeps initial bundle lean despite the feature richness.

---

## Testing Strategy

### Unit Tests (vitest)

| Component/Module | Test Focus | Count (est.) |
|---|---|---|
| `maskEmail()` utility | Edge cases: short emails, no @, unicode, anonymized | 8 |
| `calculateEngagementScore()` | Formula correctness, edge cases (0 opens, 0 editions, max score) | 10 |
| `calculateHealthScore()` | Dimension scoring, composite, label thresholds | 8 |
| `generateSlots()` re-export | Cadence slot generation for Schedule calendar | Already tested in `@tn-figueiredo/newsletter` |
| `KpiCard` | Renders value, trend, sparkline, inverted bounce | 5 |
| `TypeFilterChips` | Selection state, "All" reset, colored dots | 4 |
| `HealthStrip` | Renders N metric cards, handles 0 values, responsive | 3 |
| `SummaryBar` | Renders stats, keyboard hints, role="status" | 2 |
| `SubscriberStatusBadge` | All 5 statuses, correct colors | 5 |

### Integration Tests (vitest + DB, gated by `HAS_LOCAL_DB`)

| Test Suite | Coverage |
|---|---|
| `moveEdition` server action | Valid transitions, CAS conflict, blocked transitions, revalidation |
| `createIdea` server action | Insert with/without type, idea_created_at set |
| `toggleCadence` server action | Pause/unpause, revalidation |
| `exportSubscribers` server action | Default (masked) export, PII export + audit log, filter application |
| Audience query with engagement score | Score calculation matches formula, sort correctness |
| Cohort retention query | Correct pivot, handles 0-subscriber months |

### E2E Tests (Playwright)

| Spec File | Coverage |
|---|---|
| `newsletter-hub-tabs.spec.ts` | Tab switching via click + keyboard (1-5), URL param persistence, back/forward |
| `newsletter-hub-kanban.spec.ts` | Drag card between columns, WIP limit block, undo toast, list view toggle |
| `newsletter-hub-schedule.spec.ts` | Calendar navigation, cadence toggle, conflict display |
| `newsletter-hub-audience.spec.ts` | Search debounce, filter chips, export CSV, pagination, sort |
| `newsletter-hub-empty.spec.ts` | All tabs with zero data — verify empty states render |

### Accessibility Tests (Playwright + AxeBuilder)

Run AxeBuilder on each tab. Existing pattern from Sprint 5c (`e2e/a11y/`). Focus: tab ARIA roles, sortable table, toggle switches, drag-drop announcements.

---

## Key Decisions (Resolved)

1. **5-tab workspace** over single scrollable page or collapsible sections
2. **Kanban board** for editorial (not table/list as primary view, list available as toggle)
3. **Calendar + agenda split** for schedule (not timeline or list)
4. **Workflow visualizations** for automations (not just config panels)
5. **recharts** for charts (already installed, not adding chart.js or visx)
6. **Inline SVG sparklines** for small chart elements (not recharts for sparklines)
7. **Email masking client-side** (LGPD compliance without server-side complexity for display)
8. **URL search param** for tab state (not React state — enables deep linking and browser navigation)
9. **@dnd-kit** for kanban drag-and-drop (lighter than react-beautiful-dnd, actively maintained, better React 19 compat)
10. **Polling at 60s** over Supabase Realtime (cost/complexity tradeoff for CMS dashboard)
11. **Skeleton shimmer** over spinners for loading states (feels faster, less jarring)
12. **Infinite scroll** for activity feeds over pagination (continuous engagement event stream)
13. **Slide-over panel** for workflow configuration over modal (more space, non-blocking)
