# CMS Schedule, Dashboard & Analytics Redesign

**Date:** 2026-05-16
**Scope:** Unified Schedule calendar, Dashboard Command Center, Analytics link-tracking redesign, sidebar restructure
**Mockups:** `.superpowers/brainstorm/17957-1778962242/content/` (unified-schedule-v7.html, dashboard-command-center.html, analytics-redesign.html)

---

## Overview

Three pages redesigned as a cohesive "morning check-in" trio in the OVERVIEW sidebar section:

1. **Dashboard** → Command Center with KPIs, attention items, weekly strip, quick actions, activity feed
2. **Schedule** → Read-only monthly calendar combining Blog, Newsletter, and Video in a single view
3. **Analytics** → Comprehensive link-tracking & engagement analytics with funnel, chart, insights

The INSIGHTS sidebar section is removed; Analytics moves to OVERVIEW after Schedule.

---

## 1. Sidebar Navigation Changes

### Current → New Structure

```
OVERVIEW                              OVERVIEW
├── Dashboard (/cms)                  ├── Dashboard (/cms)
├── Schedule (/cms/schedule)          ├── Schedule (/cms/schedule)
                                      ├── Analytics (/cms/analytics)  ← moved here
CONTENT                               CONTENT
├── Blog                              ├── (unchanged)
...                                   ...
INSIGHTS (removed)
├── Analytics (/cms/analytics)
```

### Implementation

File: `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`

- Add Analytics (`TrendingUp` icon, `/cms/analytics`, minRole: `editor`) to the OVERVIEW section items array, after Schedule.
- Remove the INSIGHTS section object entirely.

---

## 2. Unified Schedule

### Route & Layout

- **Route:** `/cms/schedule` (existing page, full redesign)
- **Layout:** Full-width calendar grid, read-only (no editing — configuration stays in Blog/Newsletter/YouTube modules)
- **Data window:** Current month ± 1 month (prev/next navigation)

### Data Sources

| Content Type | Source | Pipeline Filter |
|-------------|--------|-----------------|
| Blog posts | `posts` table | `status IN ('scheduled','published')` + cadence slots |
| Newsletters | `newsletter_editions` table + `generateSlots()` from `@tn-figueiredo/newsletter` | `status IN ('scheduled','published','queued')` |
| Videos | `pipeline_items` table | `category = 'video'` AND `stage IN ('AGENDADO','PUBLICADO')` |

### Status Encoding

| Status | Visual Treatment |
|--------|-----------------|
| Published | Solid type-color background at 12% opacity |
| Scheduled | Solid left-border (3px) in type color + time badge |
| Queued | Dashed left-border (3px) in type color |
| Overdue | Red left-border (3px) — missed schedule |
| Cadence slot (empty) | Ghost block at 55% opacity, same type color |

### Content Type Colors

| Type | Color | CSS Variable |
|------|-------|-------------|
| Blog | `#34d399` | `--color-blog` |
| Newsletter | `#a78bfa` | `--color-newsletter` |
| Video | `#fb7185` | `--color-video` |

### Calendar Grid

- 7-column grid (Mon–Sun), 5–6 row weeks
- Each cell shows date number + up to 3 content items (overflow → "+N more" indicator with enhanced visibility)
- **Today:** highlighted background (`--bg-3`), subtle ring glow, progress bar showing day % elapsed
- **This-week band:** full row highlighted with `box-shadow: inset 0 0 0 1px var(--acc)` at 20% opacity
- **Cell overflow:** vertical scroll with CSS scroll-mask (fade at bottom edge)
- **Tooltip:** On hover/focus — shows full item details (title, type, time, status). On columns 6–7 (last two of the 7-column grid), tooltip anchors to the right edge instead of left, preventing viewport overflow. Implemented via `.cell:nth-child(7n+6) .tooltip, .cell:nth-child(7n) .tooltip { right: 0; left: auto; }`

### Cadence Slots

- Blog: per-locale cadence (e.g., "2 posts/week pt-BR, 1 post/week en") generates ghost slots on expected days
- Newsletter: `generateSlots()` from the newsletter package fills expected edition slots
- Ghost slots show at 55% opacity with type color
- On hover: `::after` content shows "+ Fill" affordance linking to respective module's create page

### Metrics Strip (Above Calendar)

Horizontal strip showing current month stats:

| Metric | Source |
|--------|--------|
| Published this month | Count of items with `published_at` in current month |
| Scheduled ahead | Items with `scheduled_at` > now |
| Cadence health | Percentage of cadence slots filled vs expected |
| Overdue | Items past scheduled date without publish |

### Backlog Section (Below Calendar)

Collapsed-by-default section showing:
- Items with `status = 'draft'` that have no scheduled date
- Grouped by type (Blog / Newsletter / Video)
- Each shows title + days since last edit
- Purpose: quick visibility into "what's ready to schedule"

### Interactions

| Action | Behavior |
|--------|----------|
| Click item | Navigate to item's edit page in respective module |
| Click cadence slot | Navigate to respective module's create page |
| Click "+N more" | Expand cell to show all items (modal or inline expand) |
| Hover item | Show tooltip with full details |
| Month nav arrows | Load adjacent month data |
| Today button | Scroll/navigate to current date |

### Component Architecture

```
app/cms/(authed)/schedule/
├── page.tsx                    # RSC — month param, data fetch
├── _components/
│   ├── schedule-calendar.tsx   # Grid layout + month nav
│   ├── schedule-cell.tsx       # Day cell with items
│   ├── schedule-item.tsx       # Individual content item chip
│   ├── schedule-tooltip.tsx    # Hover detail tooltip
│   ├── schedule-metrics.tsx    # Top metrics strip
│   ├── schedule-backlog.tsx    # Collapsed draft section
│   └── cadence-slot.tsx        # Ghost slot component
└── _helpers/
    ├── schedule-queries.ts     # Supabase queries for all content types
    ├── cadence-calculator.ts   # Generates expected slots from cadence config
    └── schedule-types.ts       # Shared types
```

---

## 3. Dashboard (Command Center)

### Route & Layout

- **Route:** `/cms` (existing dashboard page, full redesign)
- **Layout:** Two-column on desktop (main 1fr + aside 340px). Single column on mobile.
- **Header:** Sticky, backdrop-filter blur(12px), shows greeting + current date + global period selector

### Header

```
"Bom dia, Thiago" (time-aware greeting)
Friday, 16 May 2026
[Period: 7d ▾]
```

### KPI Grid (5 Cards)

Horizontal row of 5 metric cards:

| KPI | Source | Display |
|-----|--------|---------|
| Total Views | `content_metrics.views` | Number + delta arrow + sparkline |
| Published | `posts` + `newsletter_editions` + `pipeline_items` | Count in period + delta |
| Subscribers | `newsletter_subscriptions` | Total + net growth |
| Link Clicks | `link_clicks` + `content_events` | Sum + delta |
| Revenue | `ad_slot_metrics.revenue` | R$ amount + delta (or "—" if ad disabled) |

Each card: 22px bold value, 10px uppercase label, trend arrow (green/red), 48px sparkline.

### Needs Attention Section

Priority-ordered list of items requiring action:

| Priority | Type | Example |
|----------|------|---------|
| P1 (red bar) | Overdue | "Newsletter 'Weekly Digest' was due yesterday" |
| P2 (amber bar) | Approaching | "Blog cadence: 0/2 posts this week (pt-BR)" |
| P3 (blue bar) | Opportunity | "3 pipeline items ready to graduate" |

- Left-border colored by priority
- Each row: icon + description + time context + action link
- Max 5 items shown, expandable
- Empty state: "All clear — nothing needs attention" with checkmark icon

### This Week Strip

7-day horizontal strip (Mon–Sun):

- Each day: date label + stacked content dots (colored by type)
- Today: highlighted column with glow ring
- Hover day: shows tooltip with item titles
- Click day: navigates to Schedule page with that date focused
- Published items: solid dots. Scheduled: ring dots. Overdue: pulsing red dot.

### Quick Actions (3-Card Grid)

| Card | Icon | Action |
|------|------|--------|
| New Post | FileText | → `/cms/blog?action=new` |
| New Edition | Mail | → `/cms/newsletters?action=new` |
| Pipeline Item | Kanban | → `/cms/pipeline?action=new` |

Simple cards with icon + label. Hover: background lift + border accent.

### Activity Feed (Right Column)

Chronological feed of recent events:

- Source: `audit_log` table + `content_events` (filtered to meaningful actions)
- Shows: avatar/icon + action description + relative timestamp
- Types: published, scheduled, edited, commented, subscriber joined, link milestone
- Max height: viewport - header - padding, overflow scroll with fade mask
- Empty state: "No recent activity"

### Data Sources

| Source | Used For |
|--------|----------|
| `content_metrics` | Views KPI, sparkline data |
| `posts` | Published count, cadence health, overdue detection |
| `newsletter_editions` | Published count, overdue detection |
| `newsletter_subscriptions` | Subscriber KPI |
| `pipeline_items` | Pipeline graduation opportunities |
| `link_clicks` + `link_daily_metrics` | Link clicks KPI |
| `ad_slot_metrics` | Revenue KPI |
| `audit_log` | Activity feed |

### Component Architecture

```
app/cms/(authed)/(dashboard)/
├── page.tsx                      # RSC — period param, parallel data fetch
├── _components/
│   ├── dashboard-header.tsx      # Greeting + date + period selector
│   ├── dashboard-kpi-grid.tsx    # 5 KPI cards
│   ├── needs-attention.tsx       # Priority-ordered action items
│   ├── this-week-strip.tsx       # 7-day horizontal strip
│   ├── quick-actions.tsx         # 3-card action grid
│   ├── activity-feed.tsx         # Right column feed
│   └── sparkline.tsx             # Reusable mini chart component
└── _helpers/
    ├── dashboard-queries.ts      # Parallel Supabase queries
    ├── attention-rules.ts        # Priority detection logic
    └── greeting.ts               # Time-aware greeting
```

---

## 4. Analytics (Redesigned)

### Route & Layout

- **Route:** `/cms/analytics` (existing page, full redesign)
- **Layout:** Sticky header with 5 horizontal tabs + period selector dropdown
- **Period selector:** 7d | 30d | 90d | Custom (date range picker)
- **Comparison:** All metrics show delta vs previous equivalent period

### Tab Structure

| Tab | Focus |
|-----|-------|
| **Overview** | Cross-module funnel, link tracking, top content, insights |
| **Content** | Per-post performance (views, read depth, referrer, locale) |
| **Links** | Deep-dive link tracking (shortlinks, in-content, UTM breakdown) |
| **Audience** | Subscriber lifecycle (growth, cohorts, retention, churn) |
| **Revenue** | Monetization (ad performance, campaign conversions, RPM) |

### Overview Tab (Primary Design)

#### KPI Row (6 Cards)

| Metric | Source | Display |
|--------|--------|---------|
| Total Views | `content_metrics.views` | Number + trend + sparkline |
| Link Clicks | `link_clicks` + `content_events[link_click]` | Sum + trend + sparkline |
| Avg Read Depth | `content_metrics.read_depth_pct` (existing column from content-tracking spec) | Percentage + trend |
| NL Open Rate | `newsletter_sends.opened / sent` | % + trend (benchmarked vs 38% industry) |
| Subscribers | `newsletter_subscriptions` | Total + net growth |
| Unique Visitors | `content_metrics.unique_visitors` | Deduplicated + trend |

Card treatment: 24px bold value, 10px uppercase label, trend arrow, 48px sparkline with peak dot highlight.

#### Content Funnel

Five-stage horizontal funnel with proportional visual narrowing:

```
Views (flex: 2.5) → Read 50%+ (1.8) → Clicked Link (1.2) → NL Opened (0.8) → Subscribed (0.5)
```

- Each stage: absolute count + percentage of previous stage
- Drop-off annotations between steps (e.g., "−42% drop") — clickable to filter content causing drop
- Data pipeline:
  - Views: `content_metrics.views`
  - Read 50%+: `content_metrics` where `read_depth_pct >= 50`
  - Clicked Link: `content_events` where `event_type = 'link_click'` (deduplicated by session)
  - NL Opened: `newsletter_sends` where `opened = true`
  - Subscribed: `newsletter_subscriptions` created in period

#### Top Clicked Links Table

| Column | Description |
|--------|-------------|
| Link | Truncated destination URL with favicon |
| Type | Badge: In-house (`--int`, sky-blue) / External (`--color-link`) / go/ (`--color-blog`) |
| Clicks | Count + CTR |
| Source | Content piece that drove the click |
| Share | Proportional-width bar relative to #1 |

Type classification:
- **In-house:** `dest_url` domain matches own domain → `--int` (#60a5fa)
- **External:** third-party domain → `--color-link` (#38bdf8)
- **go/:** shortlink via links engine → `--color-blog` (#34d399) — green distinguishes user-created shortlinks from passive internal/external

Top 10 shown, "View all →" links to Links tab.

#### Where Clicks Go (2×2 Grid)

| Card | Color | Filter |
|------|-------|--------|
| In-house | `--int` sky-blue | `dest_url` matches own domains |
| External | `--color-link` | Third-party domains |
| YouTube | red (YT brand) | youtube.com / youtu.be |
| Affiliate | amber | Known affiliate params/domains |

Each card: count + percentage of total clicks. Note: YouTube and Affiliate are subsets of External — the 2×2 grid provides a high-level destination breakdown while the table above provides per-link granularity with the 3-type badge system.

#### Where Clicks Come From (Source List)

Vertical list with colored left-border:

| Source | Border Color | Data Source |
|--------|-------------|-------------|
| Blog posts | `--color-blog` | `content_events` where `source_type = 'blog'` |
| Newsletter editions | `--color-newsletter` | `newsletter_click_events` |
| Video descriptions | `--color-video` | `link_clicks` where referrer contains youtube |
| Social posts | `--acc` | `link_clicks` where referrer matches social domains |

#### Clicks Over Time (Bar Chart)

- Y-axis: labeled gridlines (auto-scaled)
- X-axis: 5 evenly-spaced date labels
- Bars: solid color current period
- Ghost bars: previous period at 15% opacity (behind current)
- Dashed horizontal line: period average (amber)
- Tooltip on hover/focus: "{date}: {value} clicks"
- Accessibility: bars have `tabindex="0"`, tooltip on focus
- Responsive: collapses to 15 bars on narrow viewports

#### Insights Strip (3 Cards)

| Card | Indicator | Purpose |
|------|-----------|---------|
| Biggest Leak | Red dot | Largest funnel drop-off + action |
| Winning Pattern | Green dot | What's working + replication advice |
| Opportunity | Indigo dot | Untapped potential + suggestion |

Clickable cards → navigate to relevant filtered view.

Rule-based engine examples:
- Leak: "Read depth dropped 15% on posts > 2000 words — add mid-article CTAs"
- Pattern: "Posts with 2+ internal links get 3× more click-throughs"
- Opportunity: "Tuesday newsletters have 12% higher open rate — shift schedule"

### New Tracking Requirements

#### Blog In-Content Link Click Tracking

Currently untracked. Implementation:
- Client-side: intercept `<a>` clicks within `.prose` content area
- Fire `content_events` insert: `event_type='link_click'`, `dest_url`, `link_type`, `content_id`, `session_id`
- Use `navigator.sendBeacon` for reliability on navigation-away
- Deduplicate: same session + same link within 5s = 1 click

#### Subscriber Source Attribution

- Add `source` column to `newsletter_subscriptions` (nullable text)
- Capture `document.referrer` at signup, classify: blog, social, direct, newsletter, video
- Migration: existing rows get `source = 'unknown'`

#### Campaign Conversion Events

- Track: `campaign_view` → `campaign_start` → `campaign_submit`
- Store in `content_events`
- Enables Revenue tab conversion funnel

### Component Architecture

```
app/cms/(authed)/analytics/
├── page.tsx                    # RSC — period param, initial fetch
├── _components/
│   ├── analytics-header.tsx    # Sticky tabs + period selector
│   ├── analytics-overview.tsx  # Overview tab (default)
│   ├── analytics-content.tsx   # Content tab (lazy)
│   ├── analytics-links.tsx     # Links tab (lazy)
│   ├── analytics-audience.tsx  # Audience tab (lazy)
│   ├── analytics-revenue.tsx   # Revenue tab (lazy)
│   ├── kpi-row.tsx
│   ├── content-funnel.tsx
│   ├── top-links-table.tsx
│   ├── clicks-destination.tsx
│   ├── clicks-source.tsx
│   ├── top-content.tsx
│   ├── clicks-chart.tsx
│   └── insights-strip.tsx
└── _helpers/
    ├── analytics-queries.ts
    ├── engagement-score.ts
    ├── link-classifier.ts
    └── insights-engine.ts
```

### Performance

- Non-default tabs lazy-loaded via `React.lazy` + `Suspense`
- KPI row + funnel use RSC for instant first paint
- Charts: client components with `useTransition` for streaming
- `link_daily_metrics` for chart data (pre-aggregated)
- Period change triggers parallel fetches for all visible sections

---

## 5. Shared Design System

### Color Tokens (CSS Custom Properties)

**Content type palette:**

| Type | Accent | Background (12% opacity) | Border (38/40 hex alpha) |
|------|--------|--------------------------|--------------------------|
| Blog | `#34d399` | `#10b98112` | `#10b98138` |
| Newsletter | `#a78bfa` | `#8b5cf612` | `#8b5cf638` |
| Video | `#fb7185` | `#f43f5e12` | `#f43f5e38` |
| Link | `#38bdf8` | `#0ea5e912` | `#0ea5e938` |
| Internal | `#60a5fa` | `#3b82f615` | `#3b82f640` |

**UI chrome:** Accent `#818cf8` (deliberately separated from data-encoding colors).

**Background depth (5 levels):**

```
--bg-0: #101124  (page base)
--bg-1: #141530  (cards)
--bg-2: #1a1b3a  (hover / elevated)
--bg-3: #212247  (active / today)
--bg-4: #2a2c55  (tooltip / popover)
```

**Text tiers (5 levels):**

```
--t1: #f1f5f9  (titles, values)
--t2: #cbd5e1  (body)
--t3: #94a3b8  (descriptions)
--t4: #7d8ba0  (labels, timestamps — WCAG AA compliant on --bg-1)
--t5: #5a6a80  (disabled / placeholder)
```

**Border tiers (4 levels):**

```
--bdr-0: #1a1b30  (card border, dividers)
--bdr-1: #252640  (inner dividers)
--bdr-2: #333460  (hover emphasis)
--bdr-3: #444570  (active / focus fallback)
```

### Typography

| Role | Size | Weight |
|------|------|--------|
| Page title | 19px | 700 |
| Section header | 13px | 700 |
| KPI value | 22-24px | 700 |
| Body | 12px | 500 |
| Metadata | 10-11px | 500-600 |
| Labels | 9-10px | 600-700, uppercase |

### Shared Patterns

- **Card:** `bg-1`, `border: 1px solid bdr-0`, `border-radius: 8px`, `box-shadow: inset 0 1px 0 rgba(255,255,255,0.03)`
- **Sticky header:** `backdrop-filter: blur(12px)`, `background: color-mix(in srgb, var(--bg-1) 96%, transparent)`
- **Interactions:** hover → bg-2 (0.12s), focus → `outline: 2px solid var(--acc); offset: 2px`, active → bg-3
- **Skeleton:** shimmer gradient animation (left-to-right, 1.5s infinite)
- **Empty state:** centered muted icon (24px, --t4) + title (--t2) + description (--t4)

### Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| > 1100px | Full layout — sidebar + content |
| 768–1100px | Collapsed sidebar, wider content |
| < 768px | Mobile — stacked, bottom nav |

### Accessibility

- `@media (prefers-reduced-motion: reduce)` — disables all transitions/animations
- Focus indicators always visible
- All text tiers pass WCAG AA against expected background
- Chart bars have `tabindex="0"` with tooltip on focus
- Tooltip flips on edge columns to prevent viewport clipping

---

## 6. Pages Affected

| Page | Action |
|------|--------|
| `/cms` (Dashboard) | Full redesign → Command Center |
| `/cms/schedule` | Full redesign → Unified Calendar |
| `/cms/analytics` | Full redesign → Link-tracking analytics |
| Sidebar (`cms-sections.ts`) | Move Analytics to OVERVIEW, remove INSIGHTS section |

---

## 7. Database Changes Required

| Change | Table | Description |
|--------|-------|-------------|
| New event types | `content_events` | `link_click` events with `dest_url`, `link_type`, `session_id` |
| New column | `newsletter_subscriptions` | `source TEXT DEFAULT 'unknown'` |
| New event types | `content_events` | `campaign_view`, `campaign_start`, `campaign_submit` |

No new tables required — all tracking fits existing `content_events` schema pattern.

---

## 8. Out of Scope

- Editing content from Schedule (read-only calendar)
- Cadence configuration (stays in Blog/Newsletter settings)
- AI-generated insights (future enhancement — rule-based engine for v1)
- Module-specific analytics tabs (Blog, Newsletter, YouTube keep their own)
- Mobile-native gestures (standard responsive web)
