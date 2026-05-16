# Analytics Overhaul — Replace ViewStats + VidIQ ($14/mo savings)

**Date:** 2026-05-16
**Status:** Approved
**Mockup:** `/apps/web/public/_mockups.html` (v8.1, scored 106/110)

---

## Summary

Replace ViewStats ($5/mo) and VidIQ ($9/mo) with native CMS analytics covering 6 modules:

1. Replace 3 "Coming Soon" tabs in `/cms/analytics` (Content, Links, Audience)
2. Add "Analytics" tab to existing `/cms/youtube` layout (5 sub-tabs)
3. Add YouTube Summary Card + AI Insights to Dashboard (`/cms`)
4. Fix `linkClicks: 0` bug in Social Insights

---

## Architecture

### Data Sources

| Module | Table(s) | API |
|--------|----------|-----|
| Content | `content_metrics`, `content_events` | Internal queries |
| Links | `link_clicks`, `link_daily_metrics`, `tracked_links` | Internal queries |
| Audience | `content_events` (country, device_type, referrer_src) | Internal queries |
| YouTube | — | YouTube Analytics API v2 (`yt-analytics.readonly`) |
| Social fix | `social_posts` → `tracked_links` → `link_clicks` | Internal join |
| Dashboard | Aggregation of above | Internal + YT API |

### YouTube Analytics API v2

- **Scope:** `https://www.googleapis.com/auth/yt-analytics.readonly`
- **Quota:** 1 unit/query, 10,000 units/day
- **Endpoint:** `youtubeAnalytics.reports.query`
- **Key metrics:** views, estimatedMinutesWatched, averageViewDuration, averageViewPercentage, subscribersGained, subscribersLost, impressions, impressionClickThroughRate, likes, comments, shares
- **Key dimensions:** day, video, country, ageGroup, gender, deviceType, insightTrafficSourceType, insightTrafficSourceDetail

### Caching Strategy

YouTube API responses cached server-side (30min TTL for dashboard, 5min for full analytics tab). Daily aggregates persisted in `youtube_daily_metrics` table to avoid re-querying historical data.

---

## Module 1: Analytics → Content Tab

**Route:** `/cms/analytics?tab=content`
**Replaces:** `ComingSoonStub`
**Data:** `content_metrics` + `content_events`

### Components

1. **Period Selector** (shared across all analytics tabs)
   - Pills: 7d / 30d / 90d / Custom
   - Compare toggle (role="switch"): vs previous period
   - Date range display

2. **KPI Row** (4 cards)
   - Posts Published (count + delta)
   - Avg Read Depth (% + delta in pp)
   - Avg Time on Page (mm:ss + delta in seconds)
   - Reads Complete (count + delta %)
   - Each with sparkline (7-point polyline)

3. **Daily Views Chart**
   - Area chart with gradient fill
   - Previous period overlay (dashed line)
   - Annotation markers (post published events)
   - X-axis date labels, Y-axis value labels
   - CSV export button

4. **Top Posts Table**
   - Columns: Post, Status, Views, Unique, Depth, Avg Time, Reads 100%
   - Search input + sort select
   - Sticky first column for horizontal scroll
   - Sortable by views/depth/time

5. **Pattern Insight Card**
   - Green left-border card
   - Auto-detected pattern with CTA ("New Post →")

---

## Module 2: Analytics → Links Tab

**Route:** `/cms/analytics?tab=links`
**Replaces:** `ComingSoonStub`
**Data:** `link_clicks` + `link_daily_metrics` + `tracked_links`

### Components

1. **KPI Row** (5 cards)
   - Total Clicks, Unique Clicks, Conversions, Conv. Rate, Active Links

2. **Links Table**
   - Columns: Link, Source, Clicks, Unique, Conv, Country, Device
   - Search + source filter + sort
   - "Create UTM Link" CTA button

3. **UTM Campaign Attribution Table**
   - Columns: Campaign, Medium, Clicks, Conv, Rate

4. **Top Referrer Domains**
   - Horizontal progress bars (relative-to-max scaling)
   - Top 4 domains with click counts

---

## Module 3: Analytics → Audience Tab

**Route:** `/cms/analytics?tab=audience`
**Replaces:** `ComingSoonStub`
**Data:** `content_events` (country, device_type, referrer_src, read_depth, time_on_page)

### Components

1. **Country Donut Chart**
   - SVG donut with stroke-dasharray segments
   - Legend with dot + label + percentage

2. **Device Donut Chart**
   - Mobile / Desktop / Tablet breakdown

3. **Traffic Sources**
   - Progress bars (relative-to-max)
   - Google Search, Direct, Newsletter, YouTube, Social

4. **Cross-System Funnel: YouTube → Blog → Newsletter**
   - Proportional bars: YT Views → Blog Clicks → NL Signups → Purchases
   - Drop-off percentages between stages
   - Opportunity insight with CTA ("Edit YT Descriptions →")

5. **Best Time to Publish** (multi-channel heatmaps)
   - 3 mini heatmaps: YouTube, Blog, Newsletter
   - Day × time slot grid with intensity colors
   - Peak time annotation per channel

---

## Module 4: YouTube → Analytics Tab

**Route:** `/cms/youtube` layout → new "Analytics" tab
**Data:** YouTube Analytics API v2

### Sub-tab: Overview

1. **Channel Health Score** (0-100)
   - Ring visualization (SVG circle with dasharray)
   - Composite from: CTR (A), Retention (B+), Growth (B), Engagement (B), Frequency (D)

2. **Radar Chart** (5-axis pentagon)
   - Axes: CTR, Retention, Growth, Engagement, Frequency
   - Filled polygon with vertex dots (colored by grade)
   - Weakest axis highlighted in red

3. **KPI Grid** (6 + 3 cards)
   - Row 1: Views, Watch Time, Subs Net, Impressions, CTR, Avg Duration
   - Row 2: Likes, Comments, Shares

4. **Retention Curve** (avg of last 10 videos)
   - Bezier path with hook-drop shape
   - Annotations: hook zone (amber highlight), 70% mark, mid-point, end
   - Context: "Hook drop: 30pp in first 30s"

5. **Impressions → Subscriber Funnel**
   - 4-step: Impressions → Clicks (CTR%) → Views → New Subscribers
   - Industry benchmark context

6. **API Quota Monitor**
   - Current usage / 10K daily limit

### Sub-tab: Grades & CTR

1. **Video Performance Table**
   - Grade badge (A/B/C/D) based on first-7-day performance vs channel avg
   - Grading: ≥2× = A, 1.2–2× = B, 0.7–1.2× = C, <0.7× = D
   - Columns: Grade, Thumb, Title, CTR, Views (7d), Avg %, Score (multiplier)
   - A/B test button per row

2. **Pattern Insight**
   - Detected thumbnail patterns (faces vs text-heavy)
   - CTA to A/B Lab

3. **Empty State**
   - Shown when <3 videos older than 7 days

### Sub-tab: Outliers

1. **Outlier Timeline** (scatter plot, 6 months)
   - Y-axis: performance multiplier (0.5× to 3×+)
   - Dot size = magnitude of outlier
   - Color: green (positive), red (negative), blue (normal)

2. **Outlier Detail Cards**
   - Positive outlier: green border, stats, "Write Follow-up" + "Deep Dive" CTAs
   - Negative outlier: red border, stats, "A/B Test" + "Analyze" CTAs

### Sub-tab: YT Demographics

1. **Age & Gender**
   - Stacked horizontal bars per age group (blue=male, pink=female)

2. **Top Countries**
   - Progress bars with flag emojis

3. **Device Type Donut**
   - Mobile, Desktop, TV, Tablet

4. **Subscriber Sources Table**
   - Source, Subs count, percentage

5. **Best Posting Time Heatmap**
   - 5 time slots × 7 days
   - Peak cell highlighted with outline + ★

### Sub-tab: Search Terms (VidIQ parity)

1. **KPI Row** (3 cards)
   - Search Views, Search % of Total, Unique Terms

2. **Search Terms Table**
   - Columns: #, Term, Views, Watch Time, Avg Duration, Impressions CTR, Trend (mini sparkline)
   - Search/filter + sort (Views/Watch Time/CTR)

3. **High-Opportunity Terms**
   - Terms with high volume but no video from channel
   - "Draft Video Idea →" CTA

4. **Rising Terms (7d)**
   - Terms gaining momentum with % growth

5. **Term → Video Mapping**
   - Which videos rank for each term
   - Cannibalization detection (multiple videos on same term)

---

## Module 5: Dashboard Additions

**Route:** `/cms` (existing Dashboard page)
**Placement:** Below existing BlogHealth, above WeekStrip

### YouTube Summary Card

- Compact health ring (80px)
- Inline stats: Views (30d), Subs, CTR, Avg %
- Milestone progress ("2,000 subs — 23 away")
- Active A/B test status (if any)
- "Full Analytics →" link

### AI Insights Strip

- 3 insight types with colored left borders:
  - **Anomaly** (green): Video performance spike detection
  - **Pattern** (amber): Cross-module correlation (e.g., newsletter CTA count → open rate)
  - **Opportunity** (blue): Actionable suggestion (e.g., upload frequency)
- Each has action buttons (Write Follow-up, Apply to Next, Dismiss)

---

## Module 6: Social Insights Fix

**Route:** `/cms/social/insights`
**Bug:** `linkClicks: 0` hardcoded on line 103

### Root Cause

Missing join: `social_posts.short_link_id` → `tracked_links.id` → `link_clicks` (SUM).

### Fix Query

```sql
SELECT sp.id, sp.platform, sp.published_at,
  COALESCE(SUM(lc.id IS NOT NULL), 0) AS link_clicks
FROM social_posts sp
LEFT JOIN tracked_links tl ON tl.id = sp.short_link_id
LEFT JOIN link_clicks lc ON lc.link_id = tl.id
  AND lc.clicked_at >= sp.published_at
WHERE sp.site_id = $1
GROUP BY sp.id
```

### New Components (in addition to fix)

1. **Platform Breakdown** (3 cards)
   - Clicks by Platform (progress bars)
   - Clicks/Post by Platform (ranked list)
   - Best Content Types (ranked list)

2. **Link Clicks Over Time** (30d multi-line chart)
   - Separate line per platform

3. **Best Post Spotlight**
   - Top performing post with platform + click count

---

## Shared Components

### PeriodSelector

```typescript
interface PeriodSelectorProps {
  activePeriod: '7d' | '30d' | '90d' | 'custom'
  compareEnabled: boolean
  onPeriodChange: (period: string) => void
  onCompareToggle: (enabled: boolean) => void
  dateRange: { start: string; end: string }
}
```

Used by: Content, Links, Audience tabs.

### KpiCard

```typescript
interface KpiCardProps {
  label: string
  value: string | number
  delta?: { value: string; direction: 'up' | 'down' | 'neutral' }
  sparkline?: number[]
  format?: 'number' | 'percent' | 'duration'
}
```

### InsightCard

```typescript
interface InsightCardProps {
  type: 'pattern' | 'anomaly' | 'opportunity'
  message: ReactNode
  actions: { label: string; href?: string; onClick?: () => void; variant: 'primary' | 'outline' }[]
}
```

### ProgressBar (relative-to-max)

```typescript
interface ProgressBarProps {
  items: { label: string; value: number; color: string }[]
  // Automatically scales max item to 100% width
}
```

---

## Design Tokens

All components use existing CMS theme tokens:

```css
--bg-0: #15141a   /* page bg */
--bg-1: #1c1b22   /* topbar/nav bg */
--bg-2: #232229   /* card bg */
--bg-3: #2a2930   /* nested card / hover bg */
--bdr-1: #35343b  /* borders */
--t1: #e8e6ed     /* primary text */
--t2: #c4c2cb     /* secondary text */
--t3: #9b99a5     /* tertiary text */
--t5: #8f8d9a     /* muted labels (4.77:1 on bg-2) */
--acc: #FF8240    /* accent / CTAs */
```

Grade colors: green (#34d399), blue (#60a5fa), amber (#fbbf24), red (#f87171)

---

## Accessibility Requirements

- Skip navigation link
- `<nav>` landmark for tab bar
- `<main>` landmark for content
- ARIA tabs pattern with roving tabindex + keyboard (ArrowRight/Left, Home, End)
- `role="switch"` on compare toggle with Enter/Space keyboard support
- `scope="col"` on all table headers
- `aria-hidden="true"` on decorative emojis
- `role="img"` + `aria-label` on all SVG visualizations
- Focus-visible outlines (2px solid accent, 2px offset)
- WCAG AA contrast: all text ≥4.5:1 (verified)

---

## Performance

- Server Components for data fetching (streaming with Suspense)
- Skeleton loading states during fetch
- YouTube API calls cached 30min (dashboard) / 5min (analytics tab)
- Daily YouTube aggregates persisted to avoid historical re-queries
- content_events queries use existing indexes (site_id, created_at)
- link_clicks queries use partitioned table (monthly)

---

## Non-Goals

- Real-time / live view count (not useful for 15-video channel)
- Competitor benchmarking (single channel)
- Revenue/RPM tracking (below monetization threshold)
- Custom date picker UI (just pills + pre-validated custom params)
- SEO title/description scoring (low value at current scale)

---

## Implementation Order

1. Shared components (PeriodSelector, KpiCard, InsightCard, ProgressBar)
2. YouTube Analytics data layer (API client, caching, daily aggregation)
3. Content tab (simplest — uses existing tables)
4. Links tab (uses existing link_clicks infrastructure)
5. Audience tab (uses content_events with new aggregation queries)
6. Social Insights fix (single query change + new platform breakdown)
7. YouTube Analytics tab (5 sub-tabs, most complex)
8. Dashboard additions (YouTube summary + AI insights)
