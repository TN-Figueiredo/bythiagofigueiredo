# Linktree CMS Editor & Analytics

**Date:** 2026-05-20
**Status:** Draft
**Depends on:** `2026-05-19-linktree-design.md` (linktree page, already shipped)
**Sprint:** Pre-5d — Linktree CMS + Analytics

---

## 1. Context

The linktree page (`go.bythiagofigueiredo.com`) is live and serving content from DB-driven auto-sections plus a `sites.linktree_config` JSONB column for editable sections. Two gaps remain:

1. **No CMS editor** — the `linktree_config` column can only be updated via raw SQL. Staff need a form to edit highlight cards, taglines, blog descriptions, and shared links.
2. **No analytics** — unlike short links (which have full click tracking via `link_clicks` + `link_daily_metrics`), the linktree page has zero instrumentation. No pageview tracking, no per-link click tracking.

This spec adds both, plus a dashboard hero card that surfaces linktree stats inside the existing `/cms/links` page.

---

## 2. Scope

| Feature | Description |
|---------|-------------|
| **CMS Editor** | Form at `/cms/linktree` to edit `linktree_config` with live preview |
| **Linktree Analytics** | Full analytics at `/cms/linktree/analytics` — pageviews, per-link clicks, device/geo/referrer breakdown |
| **Dashboard Hero** | Linktree card pinned at top of `/cms/links` with 4 KPI stat cards |
| **Click Tracking** | Client-side beacon to track which links visitors click within the linktree |
| **Pageview Tracking** | Server-side pageview recording when the linktree loads |

### Out of Scope

- A/B testing of linktree layouts
- Custom link styling per-link
- Linktree page redesign (already shipped)
- CSV export (future feature across all analytics)

---

## 3. Architecture

### 3.1 Data Model

#### Existing: `sites.linktree_config` JSONB

Already in production (migration `20260519000006`). Zod schema in `apps/web/src/app/go/linktree/_lib/types.ts`:

```typescript
LinktreeConfigSchema = {
  highlight: {
    active: boolean,
    badge_pt, badge_en, title_pt, title_en,
    desc_pt, desc_en, cta_pt, cta_en, url: string
  },
  tagline_pt, tagline_en: string,
  blog_desc_pt, blog_desc_en: string,
  shared_links: Array<{
    label_pt, label_en, url, icon: string
  }>
}
```

#### New: `linktree_events` Table

A dedicated table for linktree tracking events (pageviews + per-link clicks). Reusing `link_clicks` was considered but rejected — linktree links aren't `tracked_links` rows and forcing them into that schema would require nullable foreign keys and confusing semantics.

```sql
CREATE TABLE public.linktree_events (
  id          uuid DEFAULT gen_random_uuid() NOT NULL,
  site_id     uuid NOT NULL REFERENCES sites(id),
  event_type  text NOT NULL,  -- 'pageview' | 'link_click'
  link_key    text,           -- null for pageviews; section:identifier for clicks
  visitor_id  text,
  is_unique   boolean DEFAULT false NOT NULL,
  is_bot      boolean DEFAULT false NOT NULL,
  device_type text,           -- CHECK: mobile, desktop, tablet, other
  browser     text,
  os          text,
  country     text,
  region      text,
  city        text,
  referrer_url    text,
  referrer_domain text,
  referrer_source text,       -- CHECK: direct, search, social, email, referral, other
  ip          text,
  user_agent  text,
  language    text,
  created_at  timestamptz DEFAULT now() NOT NULL
) PARTITION BY RANGE (created_at);
```

**Partition strategy:** Monthly range partitions on `created_at`, matching `link_clicks` pattern. Create 3 months ahead using the same `create_monthly_partitions` approach.

**`link_key` format:** `{section}:{identifier}` where section is one of:
- `highlight` — the highlight CTA card
- `blog:{locale}:{slug}` — blog post link
- `newsletter:{locale}:{slug}` — newsletter link
- `youtube:{locale}:{handle}` — YouTube channel link
- `shared:{index}` — shared link by array index
- `social:{platform}` — social media profile link
- `latest:blog:{slug}` — "What's New" blog entry
- `latest:youtube:{id}` — "What's New" YouTube video

#### New: `linktree_daily_metrics` Table

Pre-aggregated daily metrics, same pattern as `link_daily_metrics`:

```sql
CREATE TABLE public.linktree_daily_metrics (
  id               uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  site_id          uuid NOT NULL REFERENCES sites(id),
  date             date NOT NULL,
  weekday          smallint NOT NULL,  -- 0-6
  pageviews        integer DEFAULT 0 NOT NULL,
  unique_visitors  integer DEFAULT 0 NOT NULL,
  link_clicks      integer DEFAULT 0 NOT NULL,
  bot_views        integer DEFAULT 0 NOT NULL,
  -- Device breakdown (pageviews)
  mobile_views     integer DEFAULT 0 NOT NULL,
  desktop_views    integer DEFAULT 0 NOT NULL,
  tablet_views     integer DEFAULT 0 NOT NULL,
  -- Referrer source breakdown (pageviews)
  ref_direct       integer DEFAULT 0 NOT NULL,
  ref_search       integer DEFAULT 0 NOT NULL,
  ref_social       integer DEFAULT 0 NOT NULL,
  ref_email        integer DEFAULT 0 NOT NULL,
  ref_referral     integer DEFAULT 0 NOT NULL,
  ref_other        integer DEFAULT 0 NOT NULL,
  -- JSONB breakdowns
  countries        jsonb DEFAULT '{}' NOT NULL,     -- {"BR": 283, "US": 28, ...}
  hourly_views     jsonb DEFAULT '[0,0,...,0]' NOT NULL,  -- 24-element array
  link_clicks_by_key jsonb DEFAULT '{}' NOT NULL,   -- {"highlight": 45, "shared:0": 23, ...}
  CONSTRAINT linktree_daily_metrics_site_date_key UNIQUE (site_id, date)
);
```

#### New: `linktree_aggregation_watermark` Row

Reuse the existing `link_aggregation_watermark` table — add a row with `id = 'linktree'`:

```sql
INSERT INTO link_aggregation_watermark (id, last_processed_at)
VALUES ('linktree', now())
ON CONFLICT (id) DO NOTHING;
```

### 3.2 RLS Policies

```sql
-- Anon insert (tracking from public visitors)
CREATE POLICY linktree_events_anon_insert ON linktree_events
  FOR INSERT TO anon WITH CHECK (public.site_visible(site_id));

-- Staff read
CREATE POLICY linktree_events_staff_read ON linktree_events
  FOR SELECT TO authenticated USING (public.can_view_site(site_id));

-- Daily metrics: staff read only
CREATE POLICY linktree_daily_metrics_staff_read ON linktree_daily_metrics
  FOR SELECT TO authenticated USING (public.can_view_site(site_id));
```

### 3.3 Aggregation Cron

Extend the existing hourly aggregation cron (`/api/cron/links-aggregate`) to also process `linktree_events` into `linktree_daily_metrics`. The watermark pattern is:

1. Read `link_aggregation_watermark` where `id = 'linktree'`
2. Query `linktree_events` where `created_at > last_processed_at`
3. Upsert into `linktree_daily_metrics` (aggregate by site_id + date)
4. Update watermark to latest `created_at`

### 3.4 Indexes

```sql
-- Event queries
CREATE INDEX idx_linktree_events_site_time ON linktree_events (site_id, created_at DESC);
CREATE INDEX idx_linktree_events_visitor_dedup ON linktree_events (site_id, visitor_id, created_at)
  WHERE visitor_id IS NOT NULL;
CREATE INDEX idx_linktree_events_type ON linktree_events (event_type, created_at DESC);

-- Daily metrics
CREATE INDEX idx_linktree_daily_site_date ON linktree_daily_metrics (site_id, date DESC);
```

---

## 4. CMS Editor (`/cms/linktree`)

### 4.1 Layout

**Split layout:** Form panel (60%) + Live Preview panel (40%, fixed 400px).

- **Top bar:** Back arrow → `/cms/links`, title "Editar Linktree", "Porta de Entrada" badge (amber), green status dot + `go.bythiagofigueiredo.com` domain link, save status text ("Salvo há X min"), unsaved changes amber badge, Cancelar + Salvar (⌘S) buttons.
- **Form panel:** Scrollable, contains 3 collapsible sections.
- **Preview panel:** Sticky, shows live linktree preview with locale toggle (PT/EN) and theme toggle. "Auto"/"Editável" badges distinguish auto-generated vs editable content. Refresh and "Open in new tab" buttons in preview header.

### 4.2 Form Sections

#### Section 1: Geral (General)

| Field | Type | Max chars | Notes |
|-------|------|-----------|-------|
| Tagline PT | `<input>` | 120 | Required. Character counter. |
| Tagline EN | `<input>` | 120 | Required. Character counter. |
| Blog Desc PT | `<textarea>` | 300 | 3 rows. Character counter. |
| Blog Desc EN | `<textarea>` | 300 | 3 rows. Character counter. |

All fields show `PT` / `EN` language badges.

#### Section 2: Highlight Card

Toggle switch at section header: "Ativo" / "Inativo". When inactive, section collapses and card hides in preview.

| Field | Type | Max chars |
|-------|------|-----------|
| URL | `<input type="url">` | — |
| Badge PT / Badge EN | `<input>` side-by-side | 30 |
| Título PT / Título EN | `<input>` side-by-side | 80 |
| Descrição PT | `<textarea>` | 200 |
| Descrição EN | `<textarea>` | 200 |
| CTA PT / CTA EN | `<input>` side-by-side | 40 |

#### Section 3: Shared Links

Reorderable list using `@dnd-kit/sortable` (already installed). Each link card:

| Field | Type |
|-------|------|
| Icon | Icon picker (Feather icons grid, searchable) |
| Label PT / Label EN | `<input>` side-by-side |
| URL | `<input type="url">` |

- Drag handle (GripVertical) on left edge
- Delete button (trash icon) on right edge
- "Adicionar link" button at bottom
- Maximum 10 shared links

### 4.3 Live Preview

The preview panel renders the actual linktree component with overridden config data. Implementation:

1. Import the existing `LinktreeClient` component from `app/go/linktree/_components/`
2. Pass current form state as `configOverride` prop
3. Wrap in a scaled-down container (transform: scale) to fit 400px width
4. Add locale toggle (PT/EN tabs) and theme toggle in preview header

The preview uses the same data the public linktree uses — real blog posts, real YouTube data, real social links — but with the editable fields replaced by form state.

### 4.4 Server Actions

File: `apps/web/src/app/cms/(authed)/linktree/actions.ts`

```typescript
'use server'

export async function saveLinktreeConfig(
  config: z.input<typeof LinktreeConfigSchema>
): Promise<ActionResult>
// 1. Zod safeParse
// 2. requireEditScope()
// 3. getSiteContext() → siteId
// 4. getSupabaseServiceClient().from('sites').update({ linktree_config }).eq('id', siteId)
// 5. revalidateTag('linktree-config')
// 6. revalidatePath('/cms/linktree')
// 7. revalidatePath('/go/linktree')  ← public page cache bust

export async function getLinktreeConfig(): Promise<ActionResult<{ config: LinktreeConfig }>>
// Read current config from sites table
```

### 4.5 File Structure

```
apps/web/src/app/cms/(authed)/linktree/
├── page.tsx                    # Server component, fetches config
├── actions.ts                  # Server actions
├── _components/
│   ├── linktree-editor.tsx     # Main client component (form + preview split)
│   ├── general-section.tsx     # Tagline + blog desc fields
│   ├── highlight-section.tsx   # Highlight card fields with toggle
│   ├── shared-links-section.tsx # Reorderable links with dnd-kit
│   ├── icon-picker.tsx         # Feather icon grid picker
│   └── editor-preview.tsx      # Live preview panel wrapper
└── analytics/
    └── page.tsx                # Analytics page (see §5)
```

### 4.6 CMS Navigation

Add to `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`, in the Content section after "Video":

```typescript
{ icon: icon(Link2), label: 'Linktree', href: '/cms/linktree', minRole: 'editor' },
```

---

## 5. Linktree Analytics (`/cms/linktree/analytics`)

### 5.1 Page Structure

Top-to-bottom layout matching the approved mockup:

1. **Top bar** — Back arrow, "Analytics — Linktree" title, "Porta de Entrada" badge, period pills (7d/30d/90d/12m), "Ver Linktree" and "Editar" action buttons
2. **4 KPI cards** — Total Views, Last 30 Days (+% change), Unique Visitors (% of total), **Engagement Rate** (link clicks / pageviews)
3. **Daily pageviews chart** — SVG line chart, dual series (pageviews + unique visitors dashed)
4. **"Clicks por Link" section** — Ranked table of all linktree links by click count
5. **Distribution section** — 2×2 grid: Device donut, Browser bars, OS bars, Referrer bars
6. **Hourly heatmap** — 7×24 grid (Seg–Dom), Brazilian timezone
7. **Geolocation & Insights** — Countries with horizontal bars + flags, AI insights cards

### 5.2 KPI Cards

| KPI | Source | Calculation |
|-----|--------|-------------|
| Total de Views | `linktree_daily_metrics` | `SUM(pageviews)` for selected period |
| Últimos 30 dias | `linktree_daily_metrics` | `SUM(pageviews)` last 30d, % change vs prior 30d |
| Visitantes Únicos | `linktree_daily_metrics` | `SUM(unique_visitors)`, show % of total views |
| Engagement | `linktree_daily_metrics` | `SUM(link_clicks) / SUM(pageviews) × 100%`, show "X clicks / Y views" subtitle |

### 5.3 "Clicks por Link" Table

The unique feature. Displays all linktree links ranked by click count within the selected period.

| Column | Source |
|--------|--------|
| Rank (#) | Row number by click count |
| Link label | Derived from `link_key` → resolve to display name |
| Section badge | Color-coded: PT (green), EN (cyan), Highlight (orange), What's New (indigo), Shared (purple), Social (rose) |
| Clicks | From `linktree_daily_metrics.link_clicks_by_key` aggregated |
| % of total | `link_clicks / total_link_clicks × 100` |
| % bar | Visual horizontal bar scaled to max |
| Trend | Compare current period vs prior period: ↑ / ↓ / = |

**Footer row:** Total clicks, 100%.

**`link_key` → Display name resolution:**
- `highlight` → Highlight card CTA text (from config)
- `blog:pt:slug` → Blog post title (from DB)
- `newsletter:en:slug` → Newsletter edition title
- `youtube:pt:handle` → "YouTube @handle"
- `shared:0` → Shared link label (from config by index)
- `social:instagram` → "Instagram"
- `latest:blog:slug` → Blog post title + "What's New" badge

### 5.4 Component Reuse

From `@tn-figueiredo/links-admin`:

| Component | Reuse | Adaptation |
|-----------|-------|------------|
| `AnalyticsOverview` | Partial | Replace 4th KPI (Top Country → Engagement). Use `dailyClicks` data shape for line chart, rename to "Views". |
| `AnalyticsCharts` | Full | Pass device/browser/OS/referrer data from `linktree_events`. Reuse hourly heatmap. |
| `ClickMap` | Full | Pass geo data from `linktree_daily_metrics.countries`. |
| `AiInsightsPanel` | Full | Pass insights from `getLinktreeInsights()`. |

**New component:** `LinktreeClicksTable` — the "Clicks por Link" ranked table with section badges, % bars, and trend arrows.

### 5.5 Data Fetching

File: `apps/web/src/app/cms/(authed)/linktree/analytics/page.tsx`

```typescript
// Parallel queries:
const [dailyMetrics, rawEvents, config, insights] = await Promise.all([
  // 1. linktree_daily_metrics for selected period
  supabase.from('linktree_daily_metrics')
    .select('*').eq('site_id', siteId)
    .gte('date', dateFrom).lte('date', dateTo),

  // 2. linktree_events for device/browser/OS/referrer breakdown
  supabase.from('linktree_events')
    .select('country, device_type, browser, os, referrer_domain, created_at')
    .eq('site_id', siteId).eq('event_type', 'pageview')
    .gte('created_at', dateFrom).limit(5000),

  // 3. Current config (for link label resolution)
  getLinktreeConfig(),

  // 4. AI insights
  getLinktreeInsights(siteId, dateFrom, dateTo),
])
```

**Date range handling:** URL param `?period=7d|30d|90d|365d` (default: 30d), matching existing pattern.

### 5.6 AI Insights

Threshold-based heuristics matching existing pattern in `links/actions.ts`:

1. **Traffic trend:** Compare last 7d vs prior 7d pageviews → trending up/down if >20% change
2. **Engagement trend:** Compare engagement rates between periods
3. **Top performer:** Identify which link has highest click-through
4. **Low CTR warning:** Flag sections with <5% of total clicks
5. **Top referrer insight:** Identify dominant traffic source

---

## 6. Dashboard Hero (`/cms/links`)

### 6.1 Placement

Pinned at top of `/cms/links` page, above the short links section. Full-width card with "Porta de Entrada" amber badge.

### 6.2 Content

| Element | Source |
|---------|--------|
| Title | "Linktree" + "Porta de Entrada" badge |
| Domain | `go.bythiagofigueiredo.com` as clickable link |
| Stat: Pageviews | `SUM(pageviews)` all time from `linktree_daily_metrics` |
| Stat: 30d | `SUM(pageviews)` last 30 days |
| Stat: Únicos | `SUM(unique_visitors)` all time |
| Stat: Top País | Mode country from `linktree_daily_metrics.countries` |
| Actions | "Analytics" button → `/cms/linktree/analytics`, "Editar" button → `/cms/linktree` |

### 6.3 Data Query

Add to the existing `/cms/links` page data fetching:

```typescript
const linktreeStats = await supabase.from('linktree_daily_metrics')
  .select('pageviews, unique_visitors, countries')
  .eq('site_id', siteId)
```

Aggregate client-side for the 4 stat cards.

---

## 7. Click & Pageview Tracking

### 7.1 Pageview Recording (Client-Side Beacon)

The linktree page uses ISR (`revalidate=3600`), so server-side tracking would miss most visits (served from CDN cache). **Client-side beacon is the primary and only pageview method:**

```typescript
// In linktree-client.tsx, on mount:
useEffect(() => {
  navigator.sendBeacon('/api/go/linktree/track', JSON.stringify({ type: 'pageview' }))
}, [])
```

The tracking API route (§7.3) handles all server-side logic: visitor ID generation (`SHA256(ip|ua|YYYY-MM-DD)`), 30s dedup, bot detection, device/geo classification. The beacon just sends `{ type: 'pageview' }` — all enrichment happens server-side from request headers.

### 7.2 Per-Link Click Recording (Client-Side)

Add `onClick` handlers to all clickable links in the linktree. The handler fires a beacon before the browser navigates:

```typescript
function trackClick(linkKey: string) {
  navigator.sendBeacon(
    '/api/go/linktree/track',
    JSON.stringify({ type: 'link_click', key: linkKey })
  )
}
```

Components to instrument:
- `LinkRow` — add `onClick={() => trackClick(linkKey)}`
- `HighlightCard` — add `onClick={() => trackClick('highlight')}`
- Social bar links — add `onClick={() => trackClick(`social:${platform}`)}`

### 7.3 Tracking API Route

File: `apps/web/src/app/api/go/linktree/track/route.ts`

```typescript
export async function POST(req: Request) {
  // 1. Parse body: { type, key? }
  // 2. Extract headers (IP, UA, geo, referrer)
  // 3. Generate visitor ID
  // 4. Bot detection
  // 5. Device/browser/OS classification
  // 6. 30s dedup check
  // 7. Insert into linktree_events
  // Return 204 No Content
}
```

Rate limit: 30 requests per 60s per IP (matching content tracking pattern).

### 7.4 Reuse from Existing Infrastructure

| Function | Source | Reuse |
|----------|--------|-------|
| `generateVisitorId(ip, ua)` | `lib/links/click-recorder.ts` | Extract to shared util |
| `isBot(ua)` | `lib/request/bot-patterns.ts` | Direct import |
| `classifyDevice(ua)` | `packages/links/src/core/device-classifier.ts` | Direct import |
| `resolveGeo(headers)` | `lib/request/geo.ts` | Direct import |
| `classifyReferrer(domain)` | `lib/links/click-recorder.ts` | Extract to shared util |

---

## 8. Migration Plan

Single migration file created via `npm run db:new linktree_analytics`:

1. Create `linktree_events` partitioned table + 3 monthly partitions
2. Create `linktree_daily_metrics` table
3. Add indexes
4. Add RLS policies
5. Insert watermark row
6. Create partition management function for `linktree_events`

---

## 9. Testing Strategy

### Unit Tests
- Zod schema validation for `LinktreeConfigSchema` (edge cases: empty strings, max lengths, missing fields)
- `link_key` → display name resolution
- AI insights threshold logic
- Visitor ID generation + dedup logic

### Integration Tests (requires local DB)
- `saveLinktreeConfig` action: validates, persists, revalidates
- `linktree_events` insert via tracking API route
- `linktree_daily_metrics` aggregation from events
- RLS: anon can insert events, authenticated staff can read, anon cannot read

### Component Tests
- `LinktreeClicksTable` renders correct ranks, badges, percentages
- `LinktreeEditor` form state → preview sync
- Shared links reorder via dnd-kit
- Icon picker selection

---

## 10. Approved Mockups

Visual references (approved in brainstorming session):

| Screen | File | Status |
|--------|------|--------|
| Dashboard Hero | `.superpowers/brainstorm/15839-1779281992/content/links-dashboard-v5.html` | Approved |
| CMS Editor | `.superpowers/brainstorm/15839-1779281992/content/linktree-editor-v2.html` | Approved (V2.1) |
| Analytics | `.superpowers/brainstorm/15839-1779281992/content/linktree-analytics-v1.html` | Approved (with 11 fixes) |

---

## 11. Implementation Order

1. **Migration** — Create tables, indexes, RLS, watermark
2. **Tracking API** — `/api/go/linktree/track` route + instrument linktree page
3. **Aggregation** — Extend cron to process `linktree_events`
4. **CMS Editor** — Form, server actions, live preview, nav entry
5. **Analytics Page** — Data fetching, component composition, clicks table
6. **Dashboard Hero** — Linktree card on `/cms/links`
7. **Tests** — Unit + integration tests for all layers
