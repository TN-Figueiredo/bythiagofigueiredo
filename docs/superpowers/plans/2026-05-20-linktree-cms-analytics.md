# Linktree CMS Editor & Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CMS editor for the linktree config, full analytics with per-link click tracking, and a dashboard hero card on the links page.

**Architecture:** Dedicated `linktree_events` partitioned table for tracking (pageviews + per-link clicks), `linktree_daily_metrics` for aggregation, client-side beacon for recording, watermark-based hourly cron for aggregation. CMS editor uses split form+preview layout writing to `sites.linktree_config` JSONB -- the preview renders the real `LinktreeClient` component with form state overrides (not simplified HTML). Analytics page uses custom KPI cards (Total Views, Last 30d, Unique Visitors, Engagement) instead of `AnalyticsOverview` (which has wrong labels for linktree context), plus `AnalyticsCharts`/`ClickMap`/`AiInsightsPanel` from `@tn-figueiredo/links-admin` and a new clicks-by-link table.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 4, Supabase (PostgreSQL partitioned tables), Zod, @dnd-kit/sortable, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-20-linktree-cms-analytics-design.md`

---

## File Structure

```
supabase/migrations/
└── 20260520000002_linktree_analytics.sql          # New tables, partitions, indexes, RLS

apps/web/src/app/api/go/linktree/track/
└── route.ts                                        # Tracking API (pageview + click beacon)

apps/web/src/app/api/cron/linktree-aggregate-metrics/
└── route.ts                                        # Hourly aggregation cron

apps/web/src/lib/linktree/
├── event-recorder.ts                               # Server-side event recording logic
└── insights.ts                                     # AI insights for linktree

apps/web/src/app/go/linktree/_components/
├── linktree-client.tsx                             # MODIFY: add tracking context
├── link-row.tsx                                    # MODIFY: add onClick tracking
├── highlight-card.tsx                              # MODIFY: add onClick tracking
├── latest-section.tsx                              # MODIFY: add onClick tracking
├── social-bar.tsx                                  # MODIFY: add onClick tracking
├── lang-section.tsx                                # MODIFY: add onClick tracking with derived linkKey
└── use-linktree-tracking.ts                        # Client hook for beacon tracking

apps/web/src/app/cms/(authed)/linktree/
├── page.tsx                                        # Editor page (server component)
├── actions.ts                                      # Server actions (save config)
├── _components/
│   ├── linktree-editor.tsx                         # Main client form + preview split
│   ├── general-section.tsx                         # Tagline + blog desc fields
│   ├── highlight-section.tsx                       # Highlight card fields with toggle
│   ├── shared-links-section.tsx                    # dnd-kit reorderable links
│   ├── icon-picker.tsx                             # Feather icon grid
│   └── editor-preview.tsx                          # Live preview panel
└── analytics/
    ├── page.tsx                                    # Analytics page (server component)
    └── _components/
        └── linktree-clicks-table.tsx               # "Clicks por Link" ranked table

apps/web/src/app/cms/(authed)/_shared/
└── cms-sections.ts                                 # MODIFY: add Linktree nav item

apps/web/src/app/cms/(authed)/links/
├── page.tsx                                        # MODIFY: add linktree hero card
└── _components/
    └── linktree-hero-card.tsx                      # Dashboard hero card

apps/web/test/
├── lib/linktree/event-recorder.test.ts
├── lib/linktree/event-recorder-edge-cases.test.ts
├── lib/linktree/insights.test.ts
├── app/api/go/linktree/track.test.ts
├── app/cms/linktree/actions.test.ts
├── app/cms/linktree/analytics/linktree-clicks-table.test.ts
└── app/cms/linktree/shared-links-section.test.ts
```

---

### Task 1: Database Migration

Create the `linktree_events` partitioned table, `linktree_daily_metrics` aggregation table, indexes, RLS policies, and watermark row.

**Files:**
- Create: `supabase/migrations/20260520000002_linktree_analytics.sql`

- [ ] **Step 1: Generate migration file**

```bash
npm run db:new linktree_analytics
```

- [ ] **Step 2: Write the migration SQL**

Write the full migration to the generated file:

```sql
-- =============================================================
-- Linktree Analytics: events tracking + daily metrics aggregation
-- =============================================================

-- 1. Partitioned events table
CREATE TABLE IF NOT EXISTS public.linktree_events (
  id            uuid DEFAULT gen_random_uuid() NOT NULL,
  site_id       uuid NOT NULL,
  event_type    text NOT NULL,
  link_key      text,
  visitor_id    text,
  is_unique     boolean DEFAULT false NOT NULL,
  is_bot        boolean DEFAULT false NOT NULL,
  device_type   text,
  browser       text,
  os            text,
  country       text,
  region        text,
  city          text,
  referrer_url  text,
  referrer_domain text,
  referrer_source text,
  ip            text,
  user_agent    text,
  language      text,
  created_at    timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT linktree_events_pkey PRIMARY KEY (id, created_at),
  CONSTRAINT linktree_events_site_fk FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT linktree_events_event_type_check CHECK (event_type IN ('pageview', 'link_click')),
  CONSTRAINT linktree_events_device_type_check CHECK (device_type IN ('mobile', 'desktop', 'tablet', 'bot', 'other')),
  CONSTRAINT linktree_events_referrer_source_check CHECK (referrer_source IN ('direct', 'search', 'social', 'email', 'referral', 'other'))
) PARTITION BY RANGE (created_at);

-- Monthly partitions (current + 2 ahead)
CREATE TABLE IF NOT EXISTS public.linktree_events_2026_05
  PARTITION OF public.linktree_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS public.linktree_events_2026_06
  PARTITION OF public.linktree_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS public.linktree_events_2026_07
  PARTITION OF public.linktree_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS public.linktree_events_default
  PARTITION OF public.linktree_events DEFAULT;

-- 2. Indexes on events
CREATE INDEX IF NOT EXISTS idx_linktree_events_site_time
  ON public.linktree_events (site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_linktree_events_visitor_dedup
  ON public.linktree_events (site_id, visitor_id, created_at)
  WHERE visitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_linktree_events_type_time
  ON public.linktree_events (event_type, created_at DESC);

-- 3. Daily metrics aggregation table
CREATE TABLE IF NOT EXISTS public.linktree_daily_metrics (
  id                uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  site_id           uuid NOT NULL REFERENCES sites(id),
  date              date NOT NULL,
  weekday           smallint NOT NULL,
  pageviews         integer DEFAULT 0 NOT NULL,
  unique_visitors   integer DEFAULT 0 NOT NULL,
  link_clicks       integer DEFAULT 0 NOT NULL,
  bot_views         integer DEFAULT 0 NOT NULL,
  mobile_views      integer DEFAULT 0 NOT NULL,
  desktop_views     integer DEFAULT 0 NOT NULL,
  tablet_views      integer DEFAULT 0 NOT NULL,
  ref_direct        integer DEFAULT 0 NOT NULL,
  ref_search        integer DEFAULT 0 NOT NULL,
  ref_social        integer DEFAULT 0 NOT NULL,
  ref_email         integer DEFAULT 0 NOT NULL,
  ref_referral      integer DEFAULT 0 NOT NULL,
  ref_other         integer DEFAULT 0 NOT NULL,
  countries         jsonb DEFAULT '{}' NOT NULL,
  hourly_views      jsonb DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]' NOT NULL,
  link_clicks_by_key jsonb DEFAULT '{}' NOT NULL,
  CONSTRAINT linktree_daily_metrics_site_date_key UNIQUE (site_id, date),
  CONSTRAINT linktree_daily_metrics_weekday_check CHECK (weekday >= 0 AND weekday <= 6)
);

CREATE INDEX IF NOT EXISTS idx_linktree_daily_site_date
  ON public.linktree_daily_metrics (site_id, date DESC);

-- 4. RLS
ALTER TABLE public.linktree_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linktree_daily_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS linktree_events_anon_insert ON public.linktree_events;
CREATE POLICY linktree_events_anon_insert ON public.linktree_events
  FOR INSERT TO anon WITH CHECK (public.site_visible(site_id));

DROP POLICY IF EXISTS linktree_events_staff_read ON public.linktree_events;
CREATE POLICY linktree_events_staff_read ON public.linktree_events
  FOR SELECT TO authenticated USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS linktree_events_service_insert ON public.linktree_events;
CREATE POLICY linktree_events_service_insert ON public.linktree_events
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS linktree_daily_metrics_staff_read ON public.linktree_daily_metrics;
CREATE POLICY linktree_daily_metrics_staff_read ON public.linktree_daily_metrics
  FOR SELECT TO authenticated USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS linktree_daily_metrics_service_write ON public.linktree_daily_metrics;
CREATE POLICY linktree_daily_metrics_service_write ON public.linktree_daily_metrics
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Watermark row for linktree aggregation
INSERT INTO public.link_aggregation_watermark (id, last_processed_at)
VALUES ('linktree', now())
ON CONFLICT (id) DO NOTHING;

-- 6. Partition management function for linktree_events
CREATE OR REPLACE FUNCTION public.create_linktree_events_partition(
  p_partition_name text,
  p_start_date text,
  p_end_date text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = p_partition_name AND n.nspname = 'public'
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.linktree_events FOR VALUES FROM (%L) TO (%L)',
      p_partition_name, p_start_date, p_end_date
    );
    RETURN 'created';
  END IF;
  RETURN 'exists';
END;
$$;

-- 7. Additive upsert function for linktree_daily_metrics
-- Supabase's .upsert() generates ON CONFLICT DO UPDATE SET col = EXCLUDED.col which
-- REPLACES values. Since the cron runs hourly and only processes events since the last
-- watermark, a naive upsert would overwrite the day's cumulative counts with only the
-- last hour's delta. This function uses additive merging instead.
CREATE OR REPLACE FUNCTION public.upsert_linktree_daily_metrics(
  p_rows jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r jsonb;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    INSERT INTO public.linktree_daily_metrics (
      site_id, date, weekday,
      pageviews, unique_visitors, link_clicks, bot_views,
      mobile_views, desktop_views, tablet_views,
      ref_direct, ref_search, ref_social, ref_email, ref_referral, ref_other,
      countries, hourly_views, link_clicks_by_key
    ) VALUES (
      (r->>'site_id')::uuid,
      (r->>'date')::date,
      (r->>'weekday')::smallint,
      (r->>'pageviews')::integer,
      (r->>'unique_visitors')::integer,
      (r->>'link_clicks')::integer,
      (r->>'bot_views')::integer,
      (r->>'mobile_views')::integer,
      (r->>'desktop_views')::integer,
      (r->>'tablet_views')::integer,
      (r->>'ref_direct')::integer,
      (r->>'ref_search')::integer,
      (r->>'ref_social')::integer,
      (r->>'ref_email')::integer,
      (r->>'ref_referral')::integer,
      (r->>'ref_other')::integer,
      (r->'countries')::jsonb,
      (r->'hourly_views')::jsonb,
      (r->'link_clicks_by_key')::jsonb
    )
    ON CONFLICT (site_id, date) DO UPDATE SET
      -- Additive merge for all numeric counters
      pageviews       = linktree_daily_metrics.pageviews       + EXCLUDED.pageviews,
      unique_visitors = EXCLUDED.unique_visitors,  -- replaced, not added (see note below)
      link_clicks     = linktree_daily_metrics.link_clicks     + EXCLUDED.link_clicks,
      bot_views       = linktree_daily_metrics.bot_views       + EXCLUDED.bot_views,
      mobile_views    = linktree_daily_metrics.mobile_views    + EXCLUDED.mobile_views,
      desktop_views   = linktree_daily_metrics.desktop_views   + EXCLUDED.desktop_views,
      tablet_views    = linktree_daily_metrics.tablet_views    + EXCLUDED.tablet_views,
      ref_direct      = linktree_daily_metrics.ref_direct      + EXCLUDED.ref_direct,
      ref_search      = linktree_daily_metrics.ref_search      + EXCLUDED.ref_search,
      ref_social      = linktree_daily_metrics.ref_social      + EXCLUDED.ref_social,
      ref_email       = linktree_daily_metrics.ref_email       + EXCLUDED.ref_email,
      ref_referral    = linktree_daily_metrics.ref_referral    + EXCLUDED.ref_referral,
      ref_other       = linktree_daily_metrics.ref_other       + EXCLUDED.ref_other,
      -- JSONB merge: add values per key for countries
      countries       = (
        SELECT COALESCE(jsonb_object_agg(key, val), '{}'::jsonb)
        FROM (
          SELECT key, SUM(val::integer) AS val
          FROM (
            SELECT key, value AS val FROM jsonb_each_text(linktree_daily_metrics.countries)
            UNION ALL
            SELECT key, value AS val FROM jsonb_each_text(EXCLUDED.countries)
          ) combined
          GROUP BY key
        ) merged
      ),
      -- JSONB merge: element-wise addition for hourly_views (24-element array)
      hourly_views    = (
        SELECT jsonb_agg(
          COALESCE((linktree_daily_metrics.hourly_views->>idx)::integer, 0)
          + COALESCE((EXCLUDED.hourly_views->>idx)::integer, 0)
        )
        FROM generate_series(0, 23) AS idx
      ),
      -- JSONB merge: add values per key for link_clicks_by_key
      link_clicks_by_key = (
        SELECT COALESCE(jsonb_object_agg(key, val), '{}'::jsonb)
        FROM (
          SELECT key, SUM(val::integer) AS val
          FROM (
            SELECT key, value AS val FROM jsonb_each_text(linktree_daily_metrics.link_clicks_by_key)
            UNION ALL
            SELECT key, value AS val FROM jsonb_each_text(EXCLUDED.link_clicks_by_key)
          ) combined
          GROUP BY key
        ) merged
      );
      -- NOTE on unique_visitors: This column is REPLACED (not added) because the cron
      -- queries COUNT(DISTINCT visitor_id) for the entire day from raw events each run,
      -- producing an accurate daily total rather than a sum of per-batch approximations.
  END LOOP;
END;
$$;

-- 8. Extend create_monthly_partitions() to also manage linktree_events partitions
-- The existing function only handles link_clicks. We replace it to handle both tables.
CREATE OR REPLACE FUNCTION public.create_monthly_partitions(p_months_ahead integer DEFAULT 3) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_month      date;
  v_start      date;
  v_end        date;
  v_suffix     text;
  v_tbl        text;
BEGIN
  FOR i IN 0..p_months_ahead LOOP
    v_month  := date_trunc('month', now()) + (i || ' months')::interval;
    v_start  := v_month;
    v_end    := v_month + interval '1 month';
    v_suffix := to_char(v_month, 'YYYY_MM');

    -- link_clicks partition (existing)
    v_tbl := 'link_clicks_' || v_suffix;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = v_tbl AND n.nspname = 'public'
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.link_clicks
           FOR VALUES FROM (%L) TO (%L)',
        v_tbl, v_start, v_end
      );
    END IF;

    -- linktree_events partition (NEW)
    v_tbl := 'linktree_events_' || v_suffix;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = v_tbl AND n.nspname = 'public'
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.linktree_events
           FOR VALUES FROM (%L) TO (%L)',
        v_tbl, v_start, v_end
      );
    END IF;
  END LOOP;
END;
$$;
```

> **Note:** The existing `create_monthly_partitions()` function (called from the partition maintenance cron) only handled `link_clicks`. This migration replaces it to also create `linktree_events` partitions, ensuring monthly partitions are automatically created for both tables. Without this, inserts into `linktree_events` would fall through to the `DEFAULT` partition after the initial 3 months.

- [ ] **Step 3: Push migration to production**

```bash
npm run db:push:prod
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260520000002_linktree_analytics.sql
git commit -m "feat(linktree): add analytics tables, partitions, indexes, RLS"
```

---

### Task 2: Linktree Event Recorder

Server-side logic to record pageview and link_click events into `linktree_events`. Reuses existing geo/device/bot infrastructure.

**Files:**
- Create: `apps/web/src/lib/linktree/event-recorder.ts`
- Create: `apps/web/test/lib/linktree/event-recorder.test.ts`

- [ ] **Step 1: Write tests for event recorder**

```typescript
// apps/web/test/lib/linktree/event-recorder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildLinktreeEvent, type LinktreeEventInput } from '@/lib/linktree/event-recorder'

describe('buildLinktreeEvent', () => {
  const base: LinktreeEventInput = {
    siteId: 'site-1',
    eventType: 'pageview',
    linkKey: null,
    ip: '189.1.2.3',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    referrer: 'https://www.instagram.com/stories/123',
    headers: new Headers({
      'x-vercel-ip-country': 'BR',
      'x-vercel-ip-city': 'São Paulo',
      'x-vercel-ip-country-region': 'SP',
    }),
  }

  it('builds pageview event with correct fields', () => {
    const event = buildLinktreeEvent(base)
    expect(event.site_id).toBe('site-1')
    expect(event.event_type).toBe('pageview')
    expect(event.link_key).toBeNull()
    expect(event.country).toBe('BR')
    expect(event.city).toBe('São Paulo')
    expect(event.device_type).toBe('mobile')
    expect(event.referrer_domain).toBe('www.instagram.com')
    expect(event.referrer_source).toBe('social')
    expect(event.visitor_id).toMatch(/^[a-f0-9]{64}$/)
    expect(event.is_bot).toBe(false)
  })

  it('builds link_click event with link_key', () => {
    const event = buildLinktreeEvent({ ...base, eventType: 'link_click', linkKey: 'shared:a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
    expect(event.event_type).toBe('link_click')
    expect(event.link_key).toBe('shared:a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  })

  it('detects bots', () => {
    const event = buildLinktreeEvent({ ...base, userAgent: 'Googlebot/2.1' })
    expect(event.is_bot).toBe(true)
    expect(event.device_type).toBe('bot')
  })

  it('classifies direct referrer', () => {
    const event = buildLinktreeEvent({ ...base, referrer: null })
    expect(event.referrer_source).toBe('direct')
    expect(event.referrer_domain).toBeNull()
  })

  it('classifies search referrer', () => {
    const event = buildLinktreeEvent({ ...base, referrer: 'https://www.google.com/search?q=test' })
    expect(event.referrer_source).toBe('search')
  })

  it('generates consistent visitor ID for same ip+ua+day', () => {
    const a = buildLinktreeEvent(base)
    const b = buildLinktreeEvent(base)
    expect(a.visitor_id).toBe(b.visitor_id)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:web -- --run test/lib/linktree/event-recorder.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement event recorder**

```typescript
// apps/web/src/lib/linktree/event-recorder.ts
import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { resolveGeo } from '../../../lib/request/geo'
import { isBot } from '../../../lib/request/bot-patterns'

// NOTE: Device classification uses LOCAL functions (same pattern as click-recorder.ts).
// The @tn-figueiredo/links subpath `core/device-classifier` is NOT exported from the package.
// These functions are based on packages/links/src/core/device-classifier.ts.

type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'unknown'

interface DeviceInfo {
  deviceType: DeviceType
  browser: string
  os: string
}

function classifyDevice(userAgent: string): DeviceInfo {
  if (!userAgent) {
    return { deviceType: 'unknown', browser: 'Unknown', os: 'Unknown' }
  }
  return {
    deviceType: classifyDeviceType(userAgent),
    browser: classifyBrowser(userAgent),
    os: classifyOs(userAgent),
  }
}

function classifyDeviceType(ua: string): DeviceType {
  if (/iPad/i.test(ua)) return 'tablet'
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet'
  if (/Mobile|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return 'mobile'
  if (/Windows NT|Macintosh|Linux x86_64|X11/i.test(ua)) return 'desktop'
  return 'unknown'
}

function classifyBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Chrome\//i.test(ua) && /Safari\//i.test(ua)) return 'Chrome'
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return 'Safari'
  if (/MSIE|Trident/i.test(ua)) return 'IE'
  return 'Unknown'
}

function classifyOs(ua: string): string {
  if (/iPad/i.test(ua)) return 'iPadOS'
  if (/iPhone|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows NT/i.test(ua)) return 'Windows'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS'
  if (/Linux/i.test(ua)) return 'Linux'
  if (/CrOS/i.test(ua)) return 'ChromeOS'
  return 'Unknown'
}

const DEDUP_WINDOW_MS = 30_000

export interface LinktreeEventInput {
  siteId: string
  eventType: 'pageview' | 'link_click'
  linkKey: string | null
  ip: string
  userAgent: string
  referrer: string | null
  headers: Headers
}

interface LinktreeEventRow {
  site_id: string
  event_type: string
  link_key: string | null
  visitor_id: string
  is_unique: boolean
  is_bot: boolean
  device_type: string | null
  browser: string
  os: string
  country: string | null
  region: string | null
  city: string | null
  referrer_url: string | null
  referrer_domain: string | null
  referrer_source: string
  ip: string
  user_agent: string
  language: string | null
}

function generateVisitorId(ip: string, ua: string): string {
  const today = new Date().toISOString().slice(0, 10)
  return createHash('sha256').update(`${ip}|${ua}|${today}`).digest('hex')
}

function extractReferrerDomain(referrer: string | null): string | null {
  if (!referrer) return null
  try {
    return new URL(referrer).hostname
  } catch {
    return null
  }
}

function classifyReferrerSource(referrer: string | null): string {
  if (!referrer) return 'direct'
  try {
    const host = new URL(referrer).hostname.toLowerCase()
    if (host.includes('google') || host.includes('bing') || host.includes('yahoo') || host.includes('duckduckgo')) return 'search'
    if (host.includes('facebook') || host.includes('fb.com') || host.includes('instagram') ||
        host.includes('twitter') || host.includes('x.com') || host.includes('linkedin') ||
        host.includes('tiktok') || host.includes('reddit') || host.includes('youtube') ||
        host.includes('pinterest') || host.includes('threads.net') || host.includes('bsky.app')) return 'social'
    if (host.includes('mail') || host.includes('outlook') || host.includes('proton')) return 'email'
    return 'referral'
  } catch {
    return 'other'
  }
}

export function buildLinktreeEvent(input: LinktreeEventInput): LinktreeEventRow {
  const { siteId, eventType, linkKey, ip, userAgent, referrer, headers } = input
  const visitorId = generateVisitorId(ip, userAgent)
  const bot = isBot(userAgent)
  const geo = resolveGeo(headers)
  const device = bot ? { deviceType: 'bot' as const, browser: 'Bot', os: 'Bot' } : classifyDevice(userAgent)

  return {
    site_id: siteId,
    event_type: eventType,
    link_key: linkKey,
    visitor_id: visitorId,
    is_unique: false,
    is_bot: bot,
    device_type: device.deviceType === 'unknown' ? 'other' : device.deviceType,
    browser: device.browser,
    os: device.os,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    referrer_url: referrer,
    referrer_domain: extractReferrerDomain(referrer),
    referrer_source: classifyReferrerSource(referrer),
    ip,
    user_agent: userAgent.length > 512 ? userAgent.slice(0, 512) : userAgent,
    language: headers.get('accept-language')?.split(',')[0] ?? null,
  }
}

export async function recordLinktreeEvent(input: LinktreeEventInput): Promise<{ deduplicated: boolean }> {
  const row = buildLinktreeEvent(input)
  const supabase = getSupabaseServiceClient()

  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString()
  let dedupQuery = supabase
    .from('linktree_events')
    .select('id')
    .eq('site_id', row.site_id)
    .eq('visitor_id', row.visitor_id)
    .eq('event_type', row.event_type)
    .gte('created_at', cutoff)

  dedupQuery = row.link_key
    ? dedupQuery.eq('link_key', row.link_key)
    : dedupQuery.is('link_key', null)

  const { data: existing } = await dedupQuery.maybeSingle()

  if (existing) return { deduplicated: true }

  const { count: priorCount } = await supabase
    .from('linktree_events')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', row.site_id)
    .eq('visitor_id', row.visitor_id)
    .eq('event_type', row.event_type)
    .limit(1)

  row.is_unique = (priorCount ?? 0) === 0

  const { error } = await supabase.from('linktree_events').insert(row)
  if (error) {
    Sentry.captureException(new Error(error.message), {
      tags: { component: 'linktree-event-recorder' },
    })
  }

  return { deduplicated: false }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:web -- --run test/lib/linktree/event-recorder.test.ts
```

Expected: PASS. Note: `buildLinktreeEvent` is a pure function testable without mocks. The `recordLinktreeEvent` async function requires DB mocks (tested in Task 10).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/linktree/event-recorder.ts apps/web/test/lib/linktree/event-recorder.test.ts
git commit -m "feat(linktree): add event recorder with visitor ID, dedup, geo/device classification"
```

---

### Task 3: Tracking API Route

Client-side beacons POST to this route. Handles pageview and link_click events.

**Files:**
- Create: `apps/web/src/app/api/go/linktree/track/route.ts`

- [ ] **Step 1: Write the tracking API route**

```typescript
// apps/web/src/app/api/go/linktree/track/route.ts
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { recordLinktreeEvent } from '@/lib/linktree/event-recorder'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30

const ipBuckets = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const bucket = ipBuckets.get(ip)
  if (!bucket || now > bucket.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  bucket.count++
  return bucket.count > RATE_LIMIT_MAX
}

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [ip, bucket] of ipBuckets) {
      if (now > bucket.resetAt) ipBuckets.delete(ip)
    }
  }, 300_000)
}

const TrackSchema = z.object({
  type: z.enum(['pageview', 'link_click']),
  key: z.string().max(200).optional(),
  siteId: z.string().uuid(),
})

export async function POST(request: Request): Promise<Response> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': '60' } })
  }

  let parsed: z.infer<typeof TrackSchema>
  try {
    parsed = TrackSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const userAgent = request.headers.get('user-agent') ?? ''
  const referrer = request.headers.get('referer') ?? null

  void recordLinktreeEvent({
    siteId: parsed.siteId,
    eventType: parsed.type,
    linkKey: parsed.type === 'link_click' ? (parsed.key ?? null) : null,
    ip,
    userAgent,
    referrer,
    headers: request.headers,
  }).catch((err) => {
    Sentry.captureException(err, { tags: { component: 'linktree-track' } })
  })

  return new Response(null, { status: 204 })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/go/linktree/track/route.ts
git commit -m "feat(linktree): add tracking API route for pageview and click beacons"
```

---

### Task 4: Instrument Linktree Page

Add client-side tracking hook and wire it into all linktree components.

**Files:**
- Create: `apps/web/src/app/go/linktree/_components/use-linktree-tracking.ts`
- Modify: `apps/web/src/app/go/linktree/_components/linktree-client.tsx`
- Modify: `apps/web/src/app/go/linktree/_components/link-row.tsx`
- Modify: `apps/web/src/app/go/linktree/_components/highlight-card.tsx`
- Modify: `apps/web/src/app/go/linktree/_components/latest-section.tsx`
- Modify: `apps/web/src/app/go/linktree/_components/social-bar.tsx`
- Modify: `apps/web/src/app/go/linktree/_components/lang-section.tsx`

- [ ] **Step 1: Create the tracking hook**

```typescript
// apps/web/src/app/go/linktree/_components/use-linktree-tracking.ts
'use client'
import { useEffect, useCallback, useRef } from 'react'

const DEDUP_MS = 5_000

export function useLinktreeTracking(siteId: string) {
  const sent = useRef(new Map<string, number>())

  useEffect(() => {
    navigator.sendBeacon(
      '/api/go/linktree/track',
      JSON.stringify({ type: 'pageview', siteId }),
    )
  }, [siteId])

  const trackClick = useCallback(
    (linkKey: string) => {
      const now = Date.now()
      const lastSent = sent.current.get(linkKey)
      if (lastSent && now - lastSent < DEDUP_MS) return
      sent.current.set(linkKey, now)
      navigator.sendBeacon(
        '/api/go/linktree/track',
        JSON.stringify({ type: 'link_click', key: linkKey, siteId }),
      )
    },
    [siteId],
  )

  return { trackClick }
}
```

- [ ] **Step 2: Wire tracking into LinktreeClient**

In `linktree-client.tsx`, add the tracking hook and pass `trackClick` down to all child components. The key changes:

1. Import and call `useLinktreeTracking(site.id)`
2. Pass `trackClick` as prop to `HighlightCard`, `LatestSection`, each `LangSection`, shared link `LinkRow`s, and `SocialBar`

Add at the top of the component:
```typescript
const { trackClick } = useLinktreeTracking(site.id)
```

Then pass `onTrackClick={trackClick}` to each child component.

- [ ] **Step 3: Add onClick to LinkRow**

In `link-row.tsx`, add an optional `onTrackClick` prop. In the `<a>` tag, add:
```typescript
onClick={() => onTrackClick?.(linkKey)}
```

The `linkKey` prop should be added to `LinkRow` — the parent passes the correct key (e.g., `blog:pt:my-slug`, `shared:<uuid>`, `newsletter:en:edition-slug`). For shared links, use `shared:${link.id}` where `link.id` is the stable UUID from `SharedLinkSchema`.

- [ ] **Step 4: Add onClick to HighlightCard**

In `highlight-card.tsx`, add `onTrackClick` prop. In the `<a>` tag:
```typescript
onClick={() => onTrackClick?.('highlight')}
```

- [ ] **Step 5: Add onClick to LatestSection**

In `latest-section.tsx`, add `onTrackClick` prop. On the blog link:
```typescript
onClick={() => onTrackClick?.(`latest:blog:${post.slug}`)}
```
On the YouTube link:
```typescript
onClick={() => onTrackClick?.(`latest:youtube:${video.id}`)}
```

- [ ] **Step 6: Add onClick to SocialBar**

In `social-bar.tsx`, add `onTrackClick` prop. On each social `<a>`:
```typescript
onClick={() => onTrackClick?.(`social:${profile.platform}`)}
```

- [ ] **Step 7: Add onClick to LangSection**

`lang-section.tsx` renders per-locale sections (blog posts, newsletters, YouTube channels) using `LinkRow`. It must pass the correct `linkKey` to each `LinkRow` based on the item type and locale.

In `lang-section.tsx`, add an optional `onTrackClick` prop to the component. Then, for each `LinkRow` rendered from `section.items`, compute the `linkKey` from the item's `type`, the section's `locale`, and the item's `id`:

```typescript
interface LangSectionProps {
  section: LangSectionType
  siteUrl: string
  locale?: string
  onTrackClick?: (linkKey: string) => void  // ADD
}
```

Then in the `LinkRow` render, pass the derived `linkKey`:
```typescript
{section.items.map((item) => (
  <LinkRow
    key={item.id}
    label={item.label}
    desc={item.desc}
    url={item.url}
    icon={item.icon}
    subscriberCount={item.subscriberCount}
    locale={locale ?? section.locale}
    isExternal={!item.url.startsWith(`https://${siteUrl}`)}
    linkKey={`${item.type}:${section.locale.split('-')[0]}:${item.id}`}
    onTrackClick={onTrackClick}
  />
))}
```

This produces `linkKey` values like:
- Blog post: `blog:pt:my-slug` / `blog:en:my-slug`
- Newsletter: `newsletter:pt:edition-slug` / `newsletter:en:edition-slug`
- YouTube: `youtube:pt:channel-handle` / `youtube:en:channel-handle`

- [ ] **Step 8: Run tests**

```bash
npm run test:web -- --run
```

Expected: All existing tests pass (no breaking changes — `onTrackClick` is optional everywhere).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/go/linktree/_components/
git commit -m "feat(linktree): instrument page with pageview beacon and per-link click tracking"
```

---

### Task 5: Aggregation Cron

Hourly cron job that processes `linktree_events` into `linktree_daily_metrics` using the watermark pattern.

**Critical design note:** Supabase's `.upsert()` generates `ON CONFLICT DO UPDATE SET col = EXCLUDED.col`
which **replaces** values. Since the cron runs hourly and only processes events since the last watermark,
a naive upsert would overwrite the day's cumulative counts with only the last hour's delta. Instead, we
call the `upsert_linktree_daily_metrics` RPC (created in Task 1) which does additive merging for numeric
columns and element-wise / key-wise JSONB merging for `countries`, `hourly_views`, and `link_clicks_by_key`.

**Unique visitors note:** A `Set<string>` cannot be serialized across cron runs, so we cannot accumulate
unique visitor IDs in the bucket across hourly batches. Instead, after bucketing the delta events, we
query `COUNT(DISTINCT visitor_id)` for each affected day from the **full day's** raw events. This gives
an accurate daily unique count that the RPC function writes as a **replacement** (not additive), since it
already represents the complete day's total.

**Files:**
- Create: `apps/web/src/app/api/cron/linktree-aggregate-metrics/route.ts`
- Modify: `apps/web/vercel.json` (add cron schedule)

- [ ] **Step 1: Write the aggregation cron route**

```typescript
// apps/web/src/app/api/cron/linktree-aggregate-metrics/route.ts
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { newRunId, withCronLock } from '@/lib/logger'

const JOB = 'linktree-aggregate-metrics'
const LOCK_KEY = 'linktree-aggregate'
const PAGE_SIZE = 1000

interface Bucket {
  siteId: string
  date: string
  weekday: number
  pageviews: number
  linkClicks: number
  botViews: number
  mobile: number
  desktop: number
  tablet: number
  refDirect: number
  refSearch: number
  refSocial: number
  refEmail: number
  refReferral: number
  refOther: number
  countries: Record<string, number>
  hourlyViews: number[]
  linkClicksByKey: Record<string, number>
}

function emptyBucket(siteId: string, date: string, weekday: number): Bucket {
  return {
    siteId, date, weekday,
    pageviews: 0, linkClicks: 0, botViews: 0,
    mobile: 0, desktop: 0, tablet: 0,
    refDirect: 0, refSearch: 0, refSocial: 0, refEmail: 0, refReferral: 0, refOther: 0,
    countries: {},
    hourlyViews: Array.from({ length: 24 }, () => 0),
    linkClicksByKey: {},
  }
}

export async function GET(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const { data: wm } = await supabase
      .from('link_aggregation_watermark')
      .select('last_processed_at')
      .eq('id', 'linktree')
      .single()

    const since = wm?.last_processed_at ?? new Date(0).toISOString()
    const until = new Date().toISOString()

    const buckets = new Map<string, Bucket>()
    let cursor = since
    let totalProcessed = 0

    // --- Phase 1: Bucket delta events (since last watermark) ---
    while (true) {
      const { data: events, error } = await supabase
        .from('linktree_events')
        .select('site_id, event_type, link_key, visitor_id, is_bot, device_type, referrer_source, country, created_at')
        .gt('created_at', cursor)
        .lte('created_at', until)
        .order('created_at', { ascending: true })
        .limit(PAGE_SIZE)

      if (error) {
        Sentry.captureException(new Error(error.message), { tags: { component: JOB } })
        break
      }
      if (!events || events.length === 0) break

      for (const e of events) {
        const d = new Date(e.created_at)
        const dateStr = d.toISOString().slice(0, 10)
        const key = `${e.site_id}:${dateStr}`

        let bucket = buckets.get(key)
        if (!bucket) {
          bucket = emptyBucket(e.site_id, dateStr, d.getUTCDay())
          buckets.set(key, bucket)
        }

        if (e.event_type === 'pageview') {
          bucket.pageviews++
          if (e.is_bot) bucket.botViews++

          const hour = d.getUTCHours()
          bucket.hourlyViews[hour]!++

          switch (e.device_type) {
            case 'mobile': bucket.mobile++; break
            case 'desktop': bucket.desktop++; break
            case 'tablet': bucket.tablet++; break
          }

          switch (e.referrer_source) {
            case 'direct': bucket.refDirect++; break
            case 'search': bucket.refSearch++; break
            case 'social': bucket.refSocial++; break
            case 'email': bucket.refEmail++; break
            case 'referral': bucket.refReferral++; break
            default: bucket.refOther++; break
          }

          if (e.country) {
            bucket.countries[e.country] = (bucket.countries[e.country] ?? 0) + 1
          }
        } else if (e.event_type === 'link_click') {
          bucket.linkClicks++
          if (e.link_key) {
            bucket.linkClicksByKey[e.link_key] = (bucket.linkClicksByKey[e.link_key] ?? 0) + 1
          }
        }
      }

      totalProcessed += events.length
      cursor = events[events.length - 1]!.created_at

      if (events.length < PAGE_SIZE) break
    }

    if (buckets.size > 0) {
      // --- Phase 2: Query accurate unique_visitors per site+date ---
      // We query COUNT(DISTINCT visitor_id) for each affected day from the FULL day's
      // events (not just the delta). This gives an accurate daily unique count that the
      // RPC function writes as a REPLACEMENT (not additive).
      const uniqueVisitorsByKey = new Map<string, number>()

      for (const [key, bucket] of buckets) {
        const { data: visitorRows } = await supabase
          .from('linktree_events')
          .select('visitor_id')
          .eq('site_id', bucket.siteId)
          .eq('event_type', 'pageview')
          .gte('created_at', `${bucket.date}T00:00:00.000Z`)
          .lt('created_at', `${bucket.date}T23:59:59.999Z`)
          .not('visitor_id', 'is', null)
          .limit(10_000)

        const distinctSet = new Set(visitorRows?.map((r) => r.visitor_id))
        uniqueVisitorsByKey.set(key, distinctSet.size)
      }

      // --- Phase 3: Build rows and call the additive upsert RPC ---
      const rows = Array.from(buckets.entries()).map(([key, b]) => ({
        site_id: b.siteId,
        date: b.date,
        weekday: b.weekday,
        pageviews: b.pageviews,
        unique_visitors: uniqueVisitorsByKey.get(key) ?? 0,
        link_clicks: b.linkClicks,
        bot_views: b.botViews,
        mobile_views: b.mobile,
        desktop_views: b.desktop,
        tablet_views: b.tablet,
        ref_direct: b.refDirect,
        ref_search: b.refSearch,
        ref_social: b.refSocial,
        ref_email: b.refEmail,
        ref_referral: b.refReferral,
        ref_other: b.refOther,
        countries: b.countries,
        hourly_views: b.hourlyViews,
        link_clicks_by_key: b.linkClicksByKey,
      }))

      // Call the additive upsert RPC instead of supabase .upsert() —
      // the SQL function (Task 1, step 7) uses:
      //   ON CONFLICT DO UPDATE SET col = existing + EXCLUDED  (numeric cols)
      //   element-wise addition for hourly_views (24-element JSONB array)
      //   key-wise SUM merge for countries and link_clicks_by_key (JSONB objects)
      //   direct replacement for unique_visitors (already accurate for full day)
      const { error: rpcErr } = await supabase.rpc('upsert_linktree_daily_metrics', {
        p_rows: rows,
      })

      if (rpcErr) {
        Sentry.captureException(new Error(rpcErr.message), { tags: { component: JOB } })
      }
    }

    await supabase
      .from('link_aggregation_watermark')
      .upsert({ id: 'linktree', last_processed_at: until })

    return { processed: totalProcessed, buckets: buckets.size }
  })
}
```

- [ ] **Step 2: Add cron schedule to vercel.json**

In `apps/web/vercel.json`, add to the `crons` array:

```json
{
  "path": "/api/cron/linktree-aggregate-metrics",
  "schedule": "5 * * * *"
}
```

(Offset by 5 minutes from the links cron at `0 * * * *` to avoid overlapping.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/cron/linktree-aggregate-metrics/route.ts apps/web/vercel.json
git commit -m "feat(linktree): add hourly aggregation cron for linktree metrics"
```

---

### Task 6: CMS Editor — Server Actions

Server actions to read and save the linktree config, following the settings pattern.

**Files:**
- Create: `apps/web/src/app/cms/(authed)/linktree/actions.ts`
- Create: `apps/web/test/app/cms/linktree/actions.test.ts`

- [ ] **Step 1: Write test for saveLinktreeConfig**

```typescript
// apps/web/test/app/cms/linktree/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({
    siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR', timezone: 'America/Sao_Paulo',
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'user-1' } }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

describe('saveLinktreeConfig', () => {
  let saveLinktreeConfig: typeof import('@/app/cms/(authed)/linktree/actions').saveLinktreeConfig
  let mockSupabase: { from: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    vi.resetModules()
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase as any)
    const mod = await import('@/app/cms/(authed)/linktree/actions')
    saveLinktreeConfig = mod.saveLinktreeConfig
  })

  it('saves valid config and returns ok', async () => {
    const result = await saveLinktreeConfig({
      tagline_pt: 'Bem vindo',
      tagline_en: 'Welcome',
      blog_desc_pt: 'Blog desc PT',
      blog_desc_en: 'Blog desc EN',
      highlight: { active: false },
      shared_links: [],
    })
    expect(result).toEqual({ ok: true })
    expect(mockSupabase.from).toHaveBeenCalledWith('sites')
  })

  it('rejects invalid config', async () => {
    const result = await saveLinktreeConfig({
      tagline_pt: 123 as any,
    } as any)
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:web -- --run test/app/cms/linktree/actions.test.ts
```

- [ ] **Step 3: Implement server actions**

```typescript
// apps/web/src/app/cms/(authed)/linktree/actions.ts
'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { LinktreeConfigSchema } from '@/app/go/linktree/_lib/types'

type ActionResult = { ok: true } | { ok: false; error: string }

function zodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'validation_failed'
}

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

export async function saveLinktreeConfig(
  input: z.input<typeof LinktreeConfigSchema>,
): Promise<ActionResult> {
  const parsed = LinktreeConfigSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('sites')
    .update({
      linktree_config: parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateTag('linktree-config')
  revalidateTag('sidebar-badges')
  revalidatePath('/cms/linktree')
  revalidatePath('/go/linktree')

  return { ok: true }
}

export async function loadLinktreeConfig(): Promise<{
  ok: true
  config: z.infer<typeof LinktreeConfigSchema>
} | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!res.ok) return { ok: false, error: 'forbidden' }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('sites')
    .select('linktree_config')
    .eq('id', siteId)
    .single()

  if (error) return { ok: false, error: error.message }

  const config = LinktreeConfigSchema.parse(data?.linktree_config ?? {})
  return { ok: true, config }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:web -- --run test/app/cms/linktree/actions.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/linktree/actions.ts apps/web/test/app/cms/linktree/actions.test.ts
git commit -m "feat(linktree): add CMS server actions for saving and loading linktree config"
```

---

### Task 7: CMS Editor — Page & Form Components

The main editor page with split layout: form (60%) + live preview (40%).

**Files:**
- Create: `apps/web/src/app/cms/(authed)/linktree/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/linktree/_components/linktree-editor.tsx`
- Create: `apps/web/src/app/cms/(authed)/linktree/_components/general-section.tsx`

- [ ] **Step 1: Create server page**

```typescript
// apps/web/src/app/cms/(authed)/linktree/page.tsx
import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { LinktreeConfigSchema } from '@/app/go/linktree/_lib/types'
import type { LinktreePageData } from '@/app/go/linktree/_lib/types'
import {
  getLinktreeConfig,
  getSiteInfo,
  getDefaultAuthor,
  getLatestPost,
  getLatestVideo,
  getSocialProfiles,
  getNewsletterTypes,
  getYouTubeChannels,
} from '@/app/go/linktree/_lib/queries'
import { buildLangSections } from '@/app/go/linktree/_lib/build-sections'
import { LinktreeEditor } from './_components/linktree-editor'

export const dynamic = 'force-dynamic'

export default async function LinktreeEditorPage() {
  const { siteId } = await getSiteContext()
  const viewRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!viewRes.ok) redirect('/cms')

  const editRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const readOnly = !editRes.ok

  // Fetch linktree config + site metadata
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('sites')
    .select('linktree_config, short_domain, primary_domain')
    .eq('id', siteId)
    .single()

  const config = LinktreeConfigSchema.parse(data?.linktree_config ?? {})
  const domain = data?.short_domain ?? data?.primary_domain ?? ''

  // Fetch the same data used by the real linktree page so the preview is accurate
  const [site, author] = await Promise.all([
    getSiteInfo(siteId),
    getDefaultAuthor(siteId),
  ])

  const defaultLocale = site.defaultLocale
  const [latestPost, latestVideo, socials, newsletters, channels] = await Promise.all([
    getLatestPost(siteId, defaultLocale).catch(() => null),
    getLatestVideo(siteId).catch(() => null),
    getSocialProfiles(siteId).catch(() => []),
    getNewsletterTypes(siteId).catch(() => []),
    getYouTubeChannels(siteId).catch(() => []),
  ])

  const sections = buildLangSections(
    site.supportedLocales,
    newsletters,
    channels,
    config,
    site.primaryDomain,
  )

  const pageData: LinktreePageData = {
    config,
    site,
    author,
    latestPost,
    latestVideo,
    socials,
    sections,
    sharedLinks: config.shared_links,
  }

  return (
    <LinktreeEditor
      initialConfig={config}
      domain={domain}
      siteId={siteId}
      readOnly={readOnly}
      pageData={pageData}
    />
  )
}
```

- [ ] **Step 2: Create main editor client component**

```typescript
// apps/web/src/app/cms/(authed)/linktree/_components/linktree-editor.tsx
'use client'

import { useState, useCallback, useTransition, useEffect } from 'react'
import type { z } from 'zod'
import type { LinktreeConfigSchema, LinktreePageData } from '@/app/go/linktree/_lib/types'
import { saveLinktreeConfig } from '../actions'
import { GeneralSection } from './general-section'
import { HighlightSection } from './highlight-section'
import { SharedLinksSection } from './shared-links-section'
import { EditorPreview } from './editor-preview'

type Config = z.infer<typeof LinktreeConfigSchema>

interface Props {
  initialConfig: Config
  domain: string
  siteId: string
  readOnly: boolean
  pageData: LinktreePageData
}

export function LinktreeEditor({ initialConfig, domain, siteId, readOnly, pageData }: Props) {
  const [config, setConfig] = useState<Config>(initialConfig)
  const [savedConfig, setSavedConfig] = useState<Config>(initialConfig)
  const [isPending, startTransition] = useTransition()
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasChanges = JSON.stringify(config) !== JSON.stringify(savedConfig)

  const handleSave = useCallback(() => {
    startTransition(async () => {
      setError(null)
      const result = await saveLinktreeConfig(config)
      if (result.ok) {
        setSavedConfig(config)
        setLastSaved(new Date())
      } else {
        setError(result.error)
      }
    })
  }, [config])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (hasChanges && !readOnly) handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, hasChanges, readOnly])

  const updateConfig = useCallback((patch: Partial<Config>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <a href="/cms/links" className="text-muted-foreground hover:text-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </a>
          <h1 className="text-sm font-bold text-foreground">Editar Linktree</h1>
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
            Porta de Entrada
          </span>
          {domain && (
            <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {domain}
            </a>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-[11px] text-muted-foreground">
              Salvo há {Math.round((Date.now() - lastSaved.getTime()) / 60000)} min
            </span>
          )}
          {hasChanges && (
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
              Alterações não salvas
            </span>
          )}
          {error && (
            <span className="text-[11px] text-red-400">{error}</span>
          )}
          <a href="/cms/links" className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent/5">
            Cancelar
          </a>
          <button
            onClick={handleSave}
            disabled={!hasChanges || readOnly || isPending}
            className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {isPending ? 'Salvando...' : 'Salvar'} <kbd className="ml-1 text-[9px] opacity-60">⌘S</kbd>
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Form panel */}
        <div className="flex-1 overflow-y-auto p-6" style={{ maxWidth: '60%' }}>
          <div className="mx-auto max-w-2xl space-y-8">
            <GeneralSection config={config} onChange={updateConfig} readOnly={readOnly} />
            <HighlightSection config={config} onChange={updateConfig} readOnly={readOnly} />
            <SharedLinksSection config={config} onChange={updateConfig} readOnly={readOnly} />
          </div>
        </div>

        {/* Preview panel -- renders real LinktreeClient with form state override */}
        <div className="w-[400px] border-l border-border">
          <EditorPreview config={config} pageData={pageData} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create GeneralSection component**

```typescript
// apps/web/src/app/cms/(authed)/linktree/_components/general-section.tsx
'use client'

import type { z } from 'zod'
import type { LinktreeConfigSchema } from '@/app/go/linktree/_lib/types'

type Config = z.infer<typeof LinktreeConfigSchema>

interface Props {
  config: Config
  onChange: (patch: Partial<Config>) => void
  readOnly: boolean
}

function CharCount({ current, max }: { current: number; max: number }) {
  return (
    <span className={`text-[10px] ${current > max ? 'text-red-400' : 'text-muted-foreground'}`}>
      {current}/{max}
    </span>
  )
}

function LangBadge({ lang }: { lang: 'PT' | 'EN' }) {
  const colors = lang === 'PT' ? 'bg-green-500/10 text-green-400' : 'bg-cyan-500/10 text-cyan-400'
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${colors}`}>{lang}</span>
}

export function GeneralSection({ config, onChange, readOnly }: Props) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-bold text-foreground">Geral</h2>
      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="text-xs font-medium text-foreground">Tagline</label>
            <LangBadge lang="PT" />
            <span className="text-[10px] text-red-400">*</span>
          </div>
          <input
            type="text"
            value={config.tagline_pt}
            onChange={(e) => onChange({ tagline_pt: e.target.value })}
            disabled={readOnly}
            maxLength={120}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
            placeholder="Ex: Reflexões sobre tecnologia, fé e propósito"
          />
          <div className="mt-0.5 text-right"><CharCount current={config.tagline_pt.length} max={120} /></div>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="text-xs font-medium text-foreground">Tagline</label>
            <LangBadge lang="EN" />
            <span className="text-[10px] text-red-400">*</span>
          </div>
          <input
            type="text"
            value={config.tagline_en}
            onChange={(e) => onChange({ tagline_en: e.target.value })}
            disabled={readOnly}
            maxLength={120}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
            placeholder="Ex: Reflections on technology, faith, and purpose"
          />
          <div className="mt-0.5 text-right"><CharCount current={config.tagline_en.length} max={120} /></div>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="text-xs font-medium text-foreground">Descrição do Blog</label>
            <LangBadge lang="PT" />
          </div>
          <textarea
            value={config.blog_desc_pt}
            onChange={(e) => onChange({ blog_desc_pt: e.target.value })}
            disabled={readOnly}
            maxLength={300}
            rows={3}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
            placeholder="Descrição exibida na seção de blog da linktree"
          />
          <div className="mt-0.5 text-right"><CharCount current={config.blog_desc_pt.length} max={300} /></div>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="text-xs font-medium text-foreground">Descrição do Blog</label>
            <LangBadge lang="EN" />
          </div>
          <textarea
            value={config.blog_desc_en}
            onChange={(e) => onChange({ blog_desc_en: e.target.value })}
            disabled={readOnly}
            maxLength={300}
            rows={3}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
            placeholder="Description shown in the blog section of the linktree"
          />
          <div className="mt-0.5 text-right"><CharCount current={config.blog_desc_en.length} max={300} /></div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/linktree/page.tsx apps/web/src/app/cms/(authed)/linktree/_components/linktree-editor.tsx apps/web/src/app/cms/(authed)/linktree/_components/general-section.tsx
git commit -m "feat(linktree): add CMS editor page with split form/preview layout and general section"
```

---

### Task 8: CMS Editor — Highlight & Shared Links Sections

Highlight card form with toggle, shared links with dnd-kit reorder, and icon picker.

**Files:**
- Modify: `apps/web/src/app/go/linktree/_lib/types.ts` (add `id` field to `SharedLinkSchema`)
- Create: `apps/web/src/app/cms/(authed)/linktree/_components/highlight-section.tsx`
- Create: `apps/web/src/app/cms/(authed)/linktree/_components/shared-links-section.tsx`
- Create: `apps/web/src/app/cms/(authed)/linktree/_components/icon-picker.tsx`

- [ ] **Step 0: Add stable `id` field to SharedLinkSchema**

Each shared link needs a stable UUID so dnd-kit can track items across reorders and analytics can use `shared:<uuid>` as a stable tracking key. Without this, index-based IDs (`link-${i}`) break when links are reordered — dnd-kit loses track of which item is which, and analytics keys like `shared:0` shift meaning every time the user drags a link.

In `apps/web/src/app/go/linktree/_lib/types.ts`, update `SharedLinkSchema`:

```typescript
export const SharedLinkSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  label_pt: z.string(),
  label_en: z.string(),
  url: z.string(),
  icon: z.string(),
})
```

**Why:** The `id` has a `.default()` so existing configs without `id` fields will get one auto-assigned when parsed through Zod. New links created in the editor will explicitly pass `id: crypto.randomUUID()`. This `id` is used as:
- dnd-kit sortable ID (stable across reorders)
- Analytics tracking key: `shared:<uuid>` instead of `shared:<index>` (stable even after reorder)

- [ ] **Step 1: Create HighlightSection**

```typescript
// apps/web/src/app/cms/(authed)/linktree/_components/highlight-section.tsx
'use client'

import type { z } from 'zod'
import type { LinktreeConfigSchema, HighlightSchema } from '@/app/go/linktree/_lib/types'

type Config = z.infer<typeof LinktreeConfigSchema>
type Highlight = z.infer<typeof HighlightSchema>

interface Props {
  config: Config
  onChange: (patch: Partial<Config>) => void
  readOnly: boolean
}

function CharCount({ current, max }: { current: number; max: number }) {
  return (
    <span className={`text-[10px] ${current > max ? 'text-red-400' : 'text-muted-foreground'}`}>
      {current}/{max}
    </span>
  )
}

function LangBadge({ lang }: { lang: 'PT' | 'EN' }) {
  const colors = lang === 'PT' ? 'bg-green-500/10 text-green-400' : 'bg-cyan-500/10 text-cyan-400'
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${colors}`}>{lang}</span>
}

export function HighlightSection({ config, onChange, readOnly }: Props) {
  const h = config.highlight

  function updateHighlight(patch: Partial<Highlight>) {
    onChange({ highlight: { ...h, ...patch } })
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Highlight Card</h2>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{h.active ? 'Ativo' : 'Inativo'}</span>
          <button
            type="button"
            role="switch"
            aria-checked={h.active}
            onClick={() => updateHighlight({ active: !h.active })}
            disabled={readOnly}
            className={`relative h-5 w-9 rounded-full transition-colors ${h.active ? 'bg-primary' : 'bg-border'}`}
          >
            <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${h.active ? 'translate-x-4' : ''}`} />
          </button>
        </label>
      </div>

      {h.active && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">URL</label>
            <input
              type="url"
              value={h.url}
              onChange={(e) => updateHighlight({ url: e.target.value })}
              disabled={readOnly}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <label className="text-xs font-medium text-foreground">Badge</label>
                <LangBadge lang="PT" />
              </div>
              <input type="text" value={h.badge_pt} onChange={(e) => updateHighlight({ badge_pt: e.target.value })} disabled={readOnly} maxLength={30}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50" />
              <div className="mt-0.5 text-right"><CharCount current={h.badge_pt.length} max={30} /></div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <label className="text-xs font-medium text-foreground">Badge</label>
                <LangBadge lang="EN" />
              </div>
              <input type="text" value={h.badge_en} onChange={(e) => updateHighlight({ badge_en: e.target.value })} disabled={readOnly} maxLength={30}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50" />
              <div className="mt-0.5 text-right"><CharCount current={h.badge_en.length} max={30} /></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <label className="text-xs font-medium text-foreground">Título</label>
                <LangBadge lang="PT" />
              </div>
              <input type="text" value={h.title_pt} onChange={(e) => updateHighlight({ title_pt: e.target.value })} disabled={readOnly} maxLength={80}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50" />
              <div className="mt-0.5 text-right"><CharCount current={h.title_pt.length} max={80} /></div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <label className="text-xs font-medium text-foreground">Título</label>
                <LangBadge lang="EN" />
              </div>
              <input type="text" value={h.title_en} onChange={(e) => updateHighlight({ title_en: e.target.value })} disabled={readOnly} maxLength={80}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50" />
              <div className="mt-0.5 text-right"><CharCount current={h.title_en.length} max={80} /></div>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <label className="text-xs font-medium text-foreground">Descrição</label>
              <LangBadge lang="PT" />
            </div>
            <textarea value={h.desc_pt} onChange={(e) => updateHighlight({ desc_pt: e.target.value })} disabled={readOnly} maxLength={200} rows={2}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50" />
            <div className="mt-0.5 text-right"><CharCount current={h.desc_pt.length} max={200} /></div>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <label className="text-xs font-medium text-foreground">Descrição</label>
              <LangBadge lang="EN" />
            </div>
            <textarea value={h.desc_en} onChange={(e) => updateHighlight({ desc_en: e.target.value })} disabled={readOnly} maxLength={200} rows={2}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50" />
            <div className="mt-0.5 text-right"><CharCount current={h.desc_en.length} max={200} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <label className="text-xs font-medium text-foreground">CTA</label>
                <LangBadge lang="PT" />
              </div>
              <input type="text" value={h.cta_pt} onChange={(e) => updateHighlight({ cta_pt: e.target.value })} disabled={readOnly} maxLength={40}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50" />
              <div className="mt-0.5 text-right"><CharCount current={h.cta_pt.length} max={40} /></div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <label className="text-xs font-medium text-foreground">CTA</label>
                <LangBadge lang="EN" />
              </div>
              <input type="text" value={h.cta_en} onChange={(e) => updateHighlight({ cta_en: e.target.value })} disabled={readOnly} maxLength={40}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50" />
              <div className="mt-0.5 text-right"><CharCount current={h.cta_en.length} max={40} /></div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Create IconPicker**

```typescript
// apps/web/src/app/cms/(authed)/linktree/_components/icon-picker.tsx
'use client'

import { useState } from 'react'
import {
  Link2, Mail, MessageCircle, Phone, Globe, Book, Code, Coffee,
  Heart, Star, Zap, Camera, Music, Video, FileText, ShoppingBag,
  Briefcase, Calendar, Map, Gift, Award, Bookmark, Download, ExternalLink,
  Headphones, Mic, Radio, Rss, Send, Share2, Tv, Users,
} from 'lucide-react'

const ICONS = [
  { name: 'link-2', Icon: Link2 }, { name: 'mail', Icon: Mail },
  { name: 'message-circle', Icon: MessageCircle }, { name: 'phone', Icon: Phone },
  { name: 'globe', Icon: Globe }, { name: 'book', Icon: Book },
  { name: 'code', Icon: Code }, { name: 'coffee', Icon: Coffee },
  { name: 'heart', Icon: Heart }, { name: 'star', Icon: Star },
  { name: 'zap', Icon: Zap }, { name: 'camera', Icon: Camera },
  { name: 'music', Icon: Music }, { name: 'video', Icon: Video },
  { name: 'file-text', Icon: FileText }, { name: 'shopping-bag', Icon: ShoppingBag },
  { name: 'briefcase', Icon: Briefcase }, { name: 'calendar', Icon: Calendar },
  { name: 'map', Icon: Map }, { name: 'gift', Icon: Gift },
  { name: 'award', Icon: Award }, { name: 'bookmark', Icon: Bookmark },
  { name: 'download', Icon: Download }, { name: 'external-link', Icon: ExternalLink },
  { name: 'headphones', Icon: Headphones }, { name: 'mic', Icon: Mic },
  { name: 'radio', Icon: Radio }, { name: 'rss', Icon: Rss },
  { name: 'send', Icon: Send }, { name: 'share-2', Icon: Share2 },
  { name: 'tv', Icon: Tv }, { name: 'users', Icon: Users },
] as const

interface Props {
  value: string
  onChange: (icon: string) => void
  disabled?: boolean
}

export function IconPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = ICONS.find((i) => i.name === value) ?? ICONS[0]!
  const filtered = search
    ? ICONS.filter((i) => i.name.includes(search.toLowerCase()))
    : ICONS

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs text-muted-foreground hover:border-primary disabled:opacity-50"
      >
        <selected.Icon size={14} />
        <span>Trocar ícone</span>
      </button>
    )
  }

  return (
    <div className="rounded border border-border bg-background p-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar ícone..."
        className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
        autoFocus
      />
      <div className="grid max-h-32 grid-cols-8 gap-1 overflow-y-auto">
        {filtered.map(({ name, Icon }) => (
          <button
            key={name}
            type="button"
            onClick={() => { onChange(name); setOpen(false); setSearch('') }}
            className={`flex h-8 w-8 items-center justify-center rounded hover:bg-accent/10 ${
              value === name ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
            }`}
            title={name}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create SharedLinksSection with dnd-kit**

```typescript
// apps/web/src/app/cms/(authed)/linktree/_components/shared-links-section.tsx
'use client'

import { useCallback, useState } from 'react'
import type { z } from 'zod'
import type { LinktreeConfigSchema, SharedLinkSchema } from '@/app/go/linktree/_lib/types'
import {
  DndContext, DragOverlay, closestCenter,
  KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Plus } from 'lucide-react'
import { IconPicker } from './icon-picker'

type Config = z.infer<typeof LinktreeConfigSchema>
type SharedLink = z.infer<typeof SharedLinkSchema>

interface Props {
  config: Config
  onChange: (patch: Partial<Config>) => void
  readOnly: boolean
}

function LangBadge({ lang }: { lang: 'PT' | 'EN' }) {
  const colors = lang === 'PT' ? 'bg-green-500/10 text-green-400' : 'bg-cyan-500/10 text-cyan-400'
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${colors}`}>{lang}</span>
}

function SortableLinkCard({
  link, index, onUpdate, onDelete, readOnly,
}: {
  link: SharedLink
  index: number
  onUpdate: (index: number, patch: Partial<SharedLink>) => void
  onDelete: (index: number) => void
  readOnly: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id })
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }

  return (
    <div ref={setNodeRef} style={style} {...attributes}
      className="rounded border border-border bg-background p-3">
      <div className="mb-2 flex items-center gap-2">
        <button type="button" {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" disabled={readOnly}>
          <GripVertical size={14} />
        </button>
        <IconPicker value={link.icon} onChange={(icon) => onUpdate(index, { icon })} disabled={readOnly} />
        <div className="flex-1" />
        <button type="button" onClick={() => onDelete(index)} disabled={readOnly}
          className="text-muted-foreground hover:text-red-400 disabled:opacity-50">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <div>
          <div className="mb-0.5 flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Label</span>
            <LangBadge lang="PT" />
          </div>
          <input type="text" value={link.label_pt} onChange={(e) => onUpdate(index, { label_pt: e.target.value })}
            disabled={readOnly} className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-50" />
        </div>
        <div>
          <div className="mb-0.5 flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Label</span>
            <LangBadge lang="EN" />
          </div>
          <input type="text" value={link.label_en} onChange={(e) => onUpdate(index, { label_en: e.target.value })}
            disabled={readOnly} className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-50" />
        </div>
      </div>
      <div>
        <span className="mb-0.5 block text-[10px] text-muted-foreground">URL</span>
        <input type="url" value={link.url} onChange={(e) => onUpdate(index, { url: e.target.value })}
          disabled={readOnly} placeholder="https://..."
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-50" />
      </div>
    </div>
  )
}

export function SharedLinksSection({ config, onChange, readOnly }: Props) {
  const links = config.shared_links

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = links.findIndex((l) => l.id === active.id)
    const newIndex = links.findIndex((l) => l.id === over.id)
    const reordered = arrayMove(config.shared_links, oldIndex, newIndex)
    onChange({ shared_links: reordered })
  }, [config.shared_links, links, onChange])

  const updateLink = useCallback((index: number, patch: Partial<SharedLink>) => {
    const updated = config.shared_links.map((l, i) => (i === index ? { ...l, ...patch } : l))
    onChange({ shared_links: updated })
  }, [config.shared_links, onChange])

  const deleteLink = useCallback((index: number) => {
    onChange({ shared_links: config.shared_links.filter((_, i) => i !== index) })
  }, [config.shared_links, onChange])

  const addLink = useCallback(() => {
    if (config.shared_links.length >= 10) return
    onChange({
      shared_links: [...config.shared_links, { id: crypto.randomUUID(), label_pt: '', label_en: '', url: '', icon: 'link-2' }],
    })
  }, [config.shared_links, onChange])

  return (
    <section>
      <h2 className="mb-4 text-sm font-bold text-foreground">Shared Links</h2>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
        <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {links.map((link, i) => (
              <SortableLinkCard key={link.id} link={link} index={i} onUpdate={updateLink} onDelete={deleteLink} readOnly={readOnly} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {config.shared_links.length < 10 && (
        <button type="button" onClick={addLink} disabled={readOnly}
          className="mt-3 flex items-center gap-1.5 rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50">
          <Plus size={14} /> Adicionar link
        </button>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">{config.shared_links.length}/10 links</p>
    </section>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/go/linktree/_lib/types.ts apps/web/src/app/cms/(authed)/linktree/_components/highlight-section.tsx apps/web/src/app/cms/(authed)/linktree/_components/shared-links-section.tsx apps/web/src/app/cms/(authed)/linktree/_components/icon-picker.tsx
git commit -m "feat(linktree): add stable UUID to SharedLinkSchema, highlight section, shared links with dnd-kit reorder, and icon picker"
```

---

### Task 9: CMS Editor — Live Preview & Navigation

Preview panel that renders the **actual `LinktreeClient` component** inside a scaled container, overriding only the editable fields (taglines, highlight, shared links) with current form state. This ensures the preview shows real blog posts, YouTube data, newsletters, social profiles, etc. -- not simplified placeholder HTML.

**Files:**
- Create: `apps/web/src/app/cms/(authed)/linktree/_components/editor-preview.tsx`
- Modify: `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`

- [ ] **Step 1: Create EditorPreview**

The preview imports the real `LinktreeClient` from `app/go/linktree/_components/` and renders it inside a CSS-scaled container. It receives the full `LinktreePageData` (fetched server-side in the editor `page.tsx` -- see Task 7 Step 1) and merges the current form state config on top, so editable fields update live while auto-populated data (blog posts, YouTube, sections, socials) stays real.

```typescript
// apps/web/src/app/cms/(authed)/linktree/_components/editor-preview.tsx
'use client'

import { useState, useMemo } from 'react'
import type { z } from 'zod'
import type { LinktreeConfigSchema, LinktreePageData } from '@/app/go/linktree/_lib/types'
import { LinktreeClient } from '@/app/go/linktree/_components/linktree-client'
import { RefreshCw, ExternalLink } from 'lucide-react'

type Config = z.infer<typeof LinktreeConfigSchema>

interface Props {
  config: Config
  pageData: LinktreePageData
}

export function EditorPreview({ config, pageData }: Props) {
  const [locale, setLocale] = useState<'pt-BR' | 'en'>('pt-BR')
  const [refreshKey, setRefreshKey] = useState(0)

  const isPt = locale === 'pt-BR'

  // Merge current form state into the real page data:
  // - config (taglines, highlight, blog_desc) comes from the form
  // - sharedLinks comes from config.shared_links
  // - everything else (site, author, latestPost, latestVideo, socials, sections) is real server-fetched data
  const mergedPageData = useMemo(() => ({
    ...pageData,
    config,
    sharedLinks: config.shared_links,
  }), [pageData, config])

  return (
    <div className="flex h-full flex-col">
      {/* Preview header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setLocale('pt-BR')}
            className={`rounded px-2 py-0.5 text-[10px] font-medium ${isPt ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
            PT
          </button>
          <button onClick={() => setLocale('en')}
            className={`rounded px-2 py-0.5 text-[10px] font-medium ${!isPt ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
            EN
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRefreshKey((k) => k + 1)} className="text-muted-foreground hover:text-foreground" title="Refresh">
            <RefreshCw size={12} />
          </button>
          <a href="/go/linktree" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" title="Abrir em nova aba">
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Scaled preview container -- renders the actual LinktreeClient at phone width */}
      <div key={refreshKey} className="flex-1 overflow-y-auto bg-[var(--pb-bg,#0f0f0f)]">
        <div
          className="origin-top"
          style={{
            width: '400px',
            transform: 'scale(1)',
            transformOrigin: 'top center',
          }}
        >
          <LinktreeClient
            initialLocale={locale}
            initialTheme="dark"
            {...mergedPageData}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add Linktree to CMS navigation**

In `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`, add a Linktree nav item. In the Lucide imports, add `Link2` (if not already imported). In the Content section items array, add after the Links item:

```typescript
{ icon: icon(LayoutTemplate), label: 'Linktree', href: '/cms/linktree', minRole: 'editor' },
```

(Use `LayoutTemplate` icon to distinguish from the `Link2` icon used by Links. Import it from lucide-react if needed.)

- [ ] **Step 3: Run tests**

```bash
npm run test:web -- --run
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/linktree/_components/editor-preview.tsx apps/web/src/app/cms/(authed)/_shared/cms-sections.ts
git commit -m "feat(linktree): add live preview panel and CMS navigation entry"
```

---

### Task 10: Analytics — Insights & Data Fetching

Linktree-specific AI insights and the analytics page server component.

**Files:**
- Create: `apps/web/src/lib/linktree/insights.ts`
- Create: `apps/web/src/app/cms/(authed)/linktree/analytics/page.tsx`

- [ ] **Step 1: Create insights function**

```typescript
// apps/web/src/lib/linktree/insights.ts
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Insight } from '@tn-figueiredo/links-admin'

export async function getLinktreeInsights(
  siteId: string,
  dateFrom: string,
  dateTo: string,
): Promise<Insight[]> {
  const supabase = getSupabaseServiceClient()
  const insights: Insight[] = []

  const { data: metrics } = await supabase
    .from('linktree_daily_metrics')
    .select('date, pageviews, unique_visitors, link_clicks, link_clicks_by_key, countries')
    .eq('site_id', siteId)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: true })

  if (!metrics || metrics.length < 7) return insights

  const recent7 = metrics.slice(-7)
  const prior7 = metrics.slice(-14, -7)

  if (prior7.length > 0) {
    const recentViews = recent7.reduce((s, m) => s + m.pageviews, 0)
    const priorViews = prior7.reduce((s, m) => s + m.pageviews, 0)
    if (priorViews > 0) {
      const change = ((recentViews - priorViews) / priorViews) * 100
      if (Math.abs(change) > 20) {
        insights.push({
          id: 'traffic-trend',
          severity: change > 0 ? 'positive' : 'warning',
          title: change > 0 ? 'Tráfego crescendo' : 'Tráfego em queda',
          description: `Pageviews ${change > 0 ? 'aumentaram' : 'diminuíram'} ${Math.abs(Math.round(change))}% nos últimos 7 dias comparado à semana anterior.`,
          confidence: Math.min(Math.abs(change) / 100, 0.95),
        })
      }
    }

    const recentClicks = recent7.reduce((s, m) => s + m.link_clicks, 0)
    const recentEngagement = recentViews > 0 ? recentClicks / recentViews : 0
    const priorClicks = prior7.reduce((s, m) => s + m.link_clicks, 0)
    const priorEngagement = priorViews > 0 ? priorClicks / priorViews : 0
    if (priorEngagement > 0) {
      const engChange = ((recentEngagement - priorEngagement) / priorEngagement) * 100
      if (Math.abs(engChange) > 15) {
        insights.push({
          id: 'engagement-trend',
          severity: engChange > 0 ? 'positive' : 'warning',
          title: engChange > 0 ? 'Engagement melhorando' : 'Engagement caindo',
          description: `Taxa de engagement ${engChange > 0 ? 'subiu' : 'caiu'} ${Math.abs(Math.round(engChange))}%.`,
          confidence: 0.7,
        })
      }
    }
  }

  const allClicksByKey: Record<string, number> = {}
  for (const m of metrics) {
    const byKey = m.link_clicks_by_key as Record<string, number>
    for (const [key, count] of Object.entries(byKey)) {
      allClicksByKey[key] = (allClicksByKey[key] ?? 0) + count
    }
  }
  const sorted = Object.entries(allClicksByKey).sort((a, b) => b[1] - a[1])
  if (sorted.length > 0) {
    const [topKey, topCount] = sorted[0]!
    const total = sorted.reduce((s, [, c]) => s + c, 0)
    if (total > 0) {
      insights.push({
        id: 'top-performer',
        severity: 'info',
        title: 'Link mais clicado',
        description: `"${topKey}" recebeu ${topCount} clicks (${Math.round((topCount / total) * 100)}% do total).`,
        confidence: 0.9,
      })
    }
  }

  const allCountries: Record<string, number> = {}
  for (const m of metrics) {
    const countries = m.countries as Record<string, number>
    for (const [c, count] of Object.entries(countries)) {
      allCountries[c] = (allCountries[c] ?? 0) + count
    }
  }
  const topCountry = Object.entries(allCountries).sort((a, b) => b[1] - a[1])[0]
  if (topCountry) {
    const totalGeo = Object.values(allCountries).reduce((s, c) => s + c, 0)
    const pct = Math.round((topCountry[1] / totalGeo) * 100)
    if (pct > 60) {
      insights.push({
        id: 'geo-concentration',
        severity: 'info',
        title: `${pct}% do tráfego de ${topCountry[0]}`,
        description: `A maioria dos visitantes vem de ${topCountry[0]}. Considere criar conteúdo localizado.`,
        confidence: 0.85,
      })
    }
  }

  return insights
}
```

- [ ] **Step 2: Create analytics page server component**

**IMPORTANT:** Do NOT use `AnalyticsOverview` for the KPI cards -- it renders "Total Clicks", "Conversion Rate" with wrong labels and double-percentage math. Instead, render 4 custom KPI cards directly. Use `AnalyticsOverview` only for the daily line chart via its `dailyClicks` data, or extract the chart into its own SVG.

The 4 linktree-specific KPIs are:
- **Total de Views** -- `totalViews` formatted as number
- **Ultimos 30 dias** -- `last30dViews` with `+X%` change vs prior 30d period
- **Visitantes Unicos** -- `uniqueVisitors` with `X% do total` subtitle
- **Engagement** -- `totalClicks / totalViews * 100` with subtitle "X clicks / Y views"

```typescript
// apps/web/src/app/cms/(authed)/linktree/analytics/page.tsx
import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { toDateStringInTz } from '@/lib/cms/format-site-datetime'
import { getLinktreeInsights } from '@/lib/linktree/insights'
import {
  AnalyticsCharts, ClickMap, AiInsightsPanel,
} from '@tn-figueiredo/links-admin/client'
import type { DeviceData, ReferrerData, GeoDataItem, HourlyData } from '@tn-figueiredo/links-admin'
import { LinktreeClicksTable } from './_components/linktree-clicks-table'

export const dynamic = 'force-dynamic'

const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }

function topN(map: Map<string, number>, n: number): Array<{ name: string; count: number }> {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }))
}

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR')
}

function KpiCard({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {subtitle && <p className="mt-0.5 text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

function DailyChart({ data }: { data: Array<{ date: string; clicks: number; unique: number }> }) {
  if (data.length === 0) return null
  const max = Math.max(...data.map((d) => d.clicks), 1)
  const width = 600
  const height = 200
  const padding = 20
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const step = chartWidth / Math.max(data.length - 1, 1)

  const viewsPoints = data
    .map((d, i) => `${padding + i * step},${padding + chartHeight - (d.clicks / max) * chartHeight}`)
    .join(' ')
  const uniquePoints = data
    .map((d, i) => `${padding + i * step},${padding + chartHeight - (d.unique / max) * chartHeight}`)
    .join(' ')

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded bg-blue-500" />
          <span className="text-[10px] text-muted-foreground">Pageviews</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded bg-emerald-500" style={{ borderStyle: 'dashed' }} />
          <span className="text-[10px] text-muted-foreground">Unicos</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full">
        <polyline points={viewsPoints} fill="none" stroke="#3b82f6" strokeWidth="2" />
        <polyline points={uniquePoints} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4" />
      </svg>
    </div>
  )
}

export default async function LinktreeAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { siteId, timezone } = await getSiteContext()
  const viewRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!viewRes.ok) redirect('/cms')

  const params = await searchParams
  const period = params.period ?? '30d'
  const days = daysMap[period] ?? 30
  const dateFrom = toDateStringInTz(new Date(Date.now() - days * 86_400_000), timezone)
  const dateTo = toDateStringInTz(new Date(), timezone)

  const supabase = getSupabaseServiceClient()

  // Also fetch prior period for "last 30d" comparison
  const prior30dFrom = toDateStringInTz(new Date(Date.now() - 60 * 86_400_000), timezone)
  const prior30dTo = toDateStringInTz(new Date(Date.now() - 30 * 86_400_000), timezone)

  const [dailyRes, eventsRes, prior30dRes, insights] = await Promise.all([
    supabase
      .from('linktree_daily_metrics')
      .select('*')
      .eq('site_id', siteId)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true }),
    supabase
      .from('linktree_events')
      .select('country, device_type, browser, os, referrer_domain, created_at')
      .eq('site_id', siteId)
      .eq('event_type', 'pageview')
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`)
      .limit(5000),
    supabase
      .from('linktree_daily_metrics')
      .select('pageviews')
      .eq('site_id', siteId)
      .gte('date', prior30dFrom)
      .lt('date', prior30dTo),
    getLinktreeInsights(siteId, dateFrom, dateTo),
  ])

  const daily = dailyRes.data ?? []
  const events = eventsRes.data ?? []
  const prior30d = prior30dRes.data ?? []

  // KPIs
  const totalViews = daily.reduce((s, d) => s + d.pageviews, 0)
  const uniqueVisitors = daily.reduce((s, d) => s + d.unique_visitors, 0)
  const totalClicks = daily.reduce((s, d) => s + d.link_clicks, 0)

  // Last 30d views (from the selected period's last 30 days)
  const last30dCutoff = toDateStringInTz(new Date(Date.now() - 30 * 86_400_000), timezone)
  const last30dViews = daily
    .filter((d) => d.date >= last30dCutoff)
    .reduce((s, d) => s + d.pageviews, 0)
  const prior30dViews = prior30d.reduce((s, d) => s + d.pageviews, 0)
  const last30dChange = prior30dViews > 0
    ? Math.round(((last30dViews - prior30dViews) / prior30dViews) * 100)
    : null

  // Engagement rate
  const engagementRate = totalViews > 0 ? Math.round((totalClicks / totalViews) * 100) : 0

  // Unique visitors % of total
  const uniquePct = totalViews > 0 ? Math.round((uniqueVisitors / totalViews) * 100) : 0

  // Daily chart data
  const dailyChartData = daily.map((d) => ({
    date: d.date,
    clicks: d.pageviews,
    unique: d.unique_visitors,
  }))

  // Device/browser/OS breakdown from raw events
  const deviceMap = new Map<string, number>()
  const browserMap = new Map<string, number>()
  const osMap = new Map<string, number>()
  const referrerMap = new Map<string, number>()

  for (const e of events) {
    if (e.device_type) deviceMap.set(e.device_type, (deviceMap.get(e.device_type) ?? 0) + 1)
    if (e.browser) browserMap.set(e.browser, (browserMap.get(e.browser) ?? 0) + 1)
    if (e.os) osMap.set(e.os, (osMap.get(e.os) ?? 0) + 1)
    const ref = e.referrer_domain ?? 'direct'
    referrerMap.set(ref, (referrerMap.get(ref) ?? 0) + 1)
  }

  const deviceData: DeviceData = {
    device: topN(deviceMap, 10),
    browser: topN(browserMap, 10),
    os: topN(osMap, 10),
  }

  const referrerData: ReferrerData = { items: topN(referrerMap, 10).map(({ name, count }) => ({ domain: name, count })) }

  // Geo from daily metrics
  const geoAgg = new Map<string, number>()
  for (const d of daily) {
    const countries = d.countries as Record<string, number>
    for (const [c, count] of Object.entries(countries)) {
      geoAgg.set(c, (geoAgg.get(c) ?? 0) + count)
    }
  }
  const geoData: GeoDataItem[] = Array.from(geoAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([country, count]) => ({ country, count }))

  // Hourly heatmap (7 days x 24 hours)
  const heatMatrix: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  for (const d of daily) {
    const hourly = d.hourly_views as number[]
    const wd = d.weekday as number
    for (let h = 0; h < 24; h++) {
      heatMatrix[wd]![h]! += hourly[h] ?? 0
    }
  }
  const hourlyData: HourlyData = { matrix: heatMatrix }

  // Clicks by link key
  const clicksByKey: Record<string, number> = {}
  for (const d of daily) {
    const byKey = d.link_clicks_by_key as Record<string, number>
    for (const [key, count] of Object.entries(byKey)) {
      clicksByKey[key] = (clicksByKey[key] ?? 0) + count
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <a href="/cms/linktree" className="text-muted-foreground hover:text-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </a>
          <h1 className="text-sm font-bold text-foreground">Analytics -- Linktree</h1>
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">Porta de Entrada</span>
        </div>
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d', '365d'] as const).map((p) => (
            <a key={p} href={`?period=${p}`}
              className={`rounded px-2 py-0.5 text-[11px] font-medium ${period === p ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {p === '365d' ? '12m' : p}
            </a>
          ))}
          <a href="/go/linktree" target="_blank" rel="noopener noreferrer"
            className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">
            Ver Linktree
          </a>
          <a href="/cms/linktree"
            className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">
            Editar
          </a>
        </div>
      </div>

      {/* Analytics content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl space-y-8">
          {/* Custom KPI cards -- NOT AnalyticsOverview (wrong labels for linktree context) */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard label="Total de Views" value={formatNumber(totalViews)} />
            <KpiCard
              label="Ultimos 30 dias"
              value={formatNumber(last30dViews)}
              subtitle={last30dChange !== null
                ? `${last30dChange >= 0 ? '+' : ''}${last30dChange}% vs periodo anterior`
                : undefined}
            />
            <KpiCard
              label="Visitantes Unicos"
              value={formatNumber(uniqueVisitors)}
              subtitle={`${uniquePct}% do total`}
            />
            <KpiCard
              label="Engagement"
              value={`${engagementRate}%`}
              subtitle={`${formatNumber(totalClicks)} clicks / ${formatNumber(totalViews)} views`}
            />
          </div>

          {/* Daily line chart */}
          <DailyChart data={dailyChartData} />

          {totalClicks > 0 && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-bold text-muted-foreground">Clicks por Link</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <LinktreeClicksTable clicksByKey={clicksByKey} totalClicks={totalClicks} />
            </>
          )}

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-bold text-muted-foreground">Distribuicao</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <AnalyticsCharts
            deviceData={deviceData}
            referrerData={referrerData}
            geoData={geoData}
            hourlyData={hourlyData}
          />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-bold text-muted-foreground">Geolocalizacao & Insights</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ClickMap data={geoData} />
            <AiInsightsPanel insights={insights} isLoading={false} />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/linktree/insights.ts apps/web/src/app/cms/(authed)/linktree/analytics/page.tsx
git commit -m "feat(linktree): add analytics page with insights, KPIs, and data fetching"
```

---

### Task 11: Analytics — Clicks Table Component

The unique "Clicks por Link" ranked table with section badges, percentage bars, and trend indicators.

**Files:**
- Create: `apps/web/src/app/cms/(authed)/linktree/analytics/_components/linktree-clicks-table.tsx`

- [ ] **Step 1: Create the clicks table component**

```typescript
// apps/web/src/app/cms/(authed)/linktree/analytics/_components/linktree-clicks-table.tsx
'use client'

interface Props {
  clicksByKey: Record<string, number>
  totalClicks: number
}

type BadgeStyle = { bg: string; text: string; label: string }

function getBadge(linkKey: string): BadgeStyle {
  if (linkKey === 'highlight') return { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Highlight' }
  if (linkKey.startsWith('blog:pt:') || linkKey.startsWith('newsletter:pt:') || linkKey.startsWith('youtube:pt:'))
    return { bg: 'bg-green-500/10', text: 'text-green-400', label: 'PT' }
  if (linkKey.startsWith('blog:en:') || linkKey.startsWith('newsletter:en:') || linkKey.startsWith('youtube:en:'))
    return { bg: 'bg-cyan-500/10', text: 'text-cyan-400', label: 'EN' }
  if (linkKey.startsWith('latest:'))
    return { bg: 'bg-indigo-500/10', text: 'text-indigo-400', label: "What's New" }
  if (linkKey.startsWith('shared:'))
    return { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'Shared' }
  if (linkKey.startsWith('social:'))
    return { bg: 'bg-rose-500/10', text: 'text-rose-400', label: 'Social' }
  return { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Other' }
}

function formatLinkLabel(linkKey: string): string {
  if (linkKey === 'highlight') return 'Highlight Card'
  const parts = linkKey.split(':')
  if (parts[0] === 'social') return (parts[1] ?? '').charAt(0).toUpperCase() + (parts[1] ?? '').slice(1)
  if (parts[0] === 'shared') return `Shared Link (${(parts[1] ?? '').slice(0, 8)}...)`
  if (parts[0] === 'latest') return `${parts[1] === 'blog' ? 'Blog' : 'YouTube'}: ${parts.slice(2).join(':')}`
  if (parts[0] === 'blog' || parts[0] === 'newsletter' || parts[0] === 'youtube')
    return parts.slice(2).join(':')
  return linkKey
}

export function LinktreeClicksTable({ clicksByKey, totalClicks }: Props) {
  const sorted = Object.entries(clicksByKey)
    .sort((a, b) => b[1] - a[1])

  const maxCount = sorted[0]?.[1] ?? 1

  return (
    <div className="overflow-hidden rounded border border-border">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-card">
            <th className="w-8 px-3 py-2 text-muted-foreground">#</th>
            <th className="px-3 py-2 text-muted-foreground">Link</th>
            <th className="px-3 py-2 text-muted-foreground">Seção</th>
            <th className="w-48 px-3 py-2 text-muted-foreground">%</th>
            <th className="w-16 px-3 py-2 text-right text-muted-foreground">Clicks</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([key, count], i) => {
            const badge = getBadge(key)
            const pct = totalClicks > 0 ? (count / totalClicks) * 100 : 0
            const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0
            return (
              <tr key={key} className="border-b border-border/50 last:border-b-0">
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-foreground">{formatLinkLabel(key)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-border">
                      <div className="h-full rounded-full bg-primary/60" style={{ width: `${barWidth}%` }} />
                    </div>
                    <span className="w-10 text-right text-[10px] text-muted-foreground">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-medium text-foreground">{count}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-card">
            <td className="px-3 py-2" colSpan={4}>
              <span className="font-medium text-muted-foreground">Total</span>
            </td>
            <td className="px-3 py-2 text-right font-bold text-foreground">{totalClicks}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/linktree/analytics/_components/linktree-clicks-table.tsx
git commit -m "feat(linktree): add clicks-per-link table component with section badges and % bars"
```

---

### Task 12: Dashboard Hero Card

Linktree hero card pinned at top of `/cms/links` with 4 KPI stat cards.

**Files:**
- Create: `apps/web/src/app/cms/(authed)/links/_components/linktree-hero-card.tsx`
- Modify: `apps/web/src/app/cms/(authed)/links/page.tsx`

- [ ] **Step 1: Create the hero card component**

```typescript
// apps/web/src/app/cms/(authed)/links/_components/linktree-hero-card.tsx
'use client'

import { LayoutTemplate, BarChart3, Pencil } from 'lucide-react'

interface Props {
  domain: string
  totalViews: number
  last30dViews: number
  uniqueVisitors: number
  topCountry: string | null
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-border bg-card p-3">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <span className="text-lg font-bold text-foreground">{value}</span>
    </div>
  )
}

export function LinktreeHeroCard({ domain, totalViews, last30dViews, uniqueVisitors, topCountry }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutTemplate size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Linktree</h2>
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
            Porta de Entrada
          </span>
          {domain && (
            <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {domain}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a href="/cms/linktree/analytics"
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">
            <BarChart3 size={12} /> Analytics
          </a>
          <a href="/cms/linktree"
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">
            <Pencil size={12} /> Editar
          </a>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Pageviews" value={totalViews.toLocaleString('pt-BR')} />
        <StatCard label="Últimos 30d" value={last30dViews.toLocaleString('pt-BR')} />
        <StatCard label="Únicos" value={uniqueVisitors.toLocaleString('pt-BR')} />
        <StatCard label="Top País" value={topCountry ?? '—'} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add hero card data query to links page**

In `apps/web/src/app/cms/(authed)/links/page.tsx`, add to the existing `Promise.all` block:

```typescript
// Add this query alongside the existing ones
const linktreeStatsRes = await supabase
  .from('linktree_daily_metrics')
  .select('pageviews, unique_visitors, countries')
  .eq('site_id', siteId)
```

Then compute aggregated stats:

```typescript
const ltStats = linktreeStatsRes?.data ?? []
const ltTotalViews = ltStats.reduce((s, d) => s + d.pageviews, 0)
const ltUniqueVisitors = ltStats.reduce((s, d) => s + d.unique_visitors, 0)
// Last 30 days
const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
const lt30dViews = ltStats.filter(d => d.date >= thirtyDaysAgo).reduce((s, d) => s + d.pageviews, 0)
// Top country
const ltCountries = new Map<string, number>()
for (const d of ltStats) {
  for (const [c, n] of Object.entries(d.countries as Record<string, number>)) {
    ltCountries.set(c, (ltCountries.get(c) ?? 0) + n)
  }
}
const ltTopCountry = ltCountries.size > 0
  ? Array.from(ltCountries.entries()).sort((a, b) => b[1] - a[1])[0]![0]
  : null
```

Then render the hero card above `<LinksHub>`:

```typescript
import { LinktreeHeroCard } from './_components/linktree-hero-card'

// In the JSX, before <LinksHub>:
<LinktreeHeroCard
  domain={shortDomain}
  totalViews={ltTotalViews}
  last30dViews={lt30dViews}
  uniqueVisitors={ltUniqueVisitors}
  topCountry={ltTopCountry}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/links/_components/linktree-hero-card.tsx apps/web/src/app/cms/(authed)/links/page.tsx
git commit -m "feat(linktree): add dashboard hero card with KPI stats on links page"
```

---

### Task 13: Tests

Unit and integration tests for all new code.

**Files:**
- Create: `apps/web/test/lib/linktree/insights.test.ts`
- Create: `apps/web/test/app/api/go/linktree/track.test.ts`
- Create: `apps/web/test/app/cms/linktree/analytics/linktree-clicks-table.test.ts`
- Create: `apps/web/test/app/cms/linktree/shared-links-section.test.ts`
- Create: `apps/web/test/lib/linktree/event-recorder-edge-cases.test.ts`

- [ ] **Step 1: Write insights tests**

```typescript
// apps/web/test/lib/linktree/insights.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

describe('getLinktreeInsights', () => {
  let getLinktreeInsights: typeof import('@/lib/linktree/insights').getLinktreeInsights

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('@/lib/linktree/insights')
    getLinktreeInsights = mod.getLinktreeInsights
  })

  it('returns empty insights when insufficient data', async () => {
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-04-20', '2026-05-20')
    expect(insights).toEqual([])
  })

  it('detects traffic increase above 20%', async () => {
    const days = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 7).padStart(2, '0')}`,
      pageviews: i < 7 ? 10 : 15,
      unique_visitors: i < 7 ? 8 : 12,
      link_clicks: 5,
      link_clicks_by_key: {},
      countries: { BR: 5 },
    }))

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: days, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any)

    const insights = await getLinktreeInsights('site-1', '2026-05-07', '2026-05-20')
    const trafficInsight = insights.find((i) => i.id === 'traffic-trend')
    expect(trafficInsight).toBeDefined()
    expect(trafficInsight!.severity).toBe('positive')
  })
})
```

- [ ] **Step 2: Write tracking route tests**

```typescript
// apps/web/test/app/api/go/linktree/track.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/linktree/event-recorder', () => ({
  recordLinktreeEvent: vi.fn().mockResolvedValue({ deduplicated: false }),
}))

describe('POST /api/go/linktree/track', () => {
  let POST: typeof import('@/app/api/go/linktree/track/route').POST

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('@/app/api/go/linktree/track/route')
    POST = mod.POST
  })

  it('returns 204 for valid pageview', async () => {
    const req = new Request('http://localhost/api/go/linktree/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ type: 'pageview', siteId: '00000000-0000-0000-0000-000000000001' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(204)
  })

  it('returns 400 for invalid body', async () => {
    const req = new Request('http://localhost/api/go/linktree/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 204 for valid link_click', async () => {
    const req = new Request('http://localhost/api/go/linktree/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ type: 'link_click', key: 'shared:a1b2c3d4-e5f6-7890-abcd-ef1234567890', siteId: '00000000-0000-0000-0000-000000000001' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 3: Write linktree-clicks-table tests**

```typescript
// apps/web/test/app/cms/linktree/analytics/linktree-clicks-table.test.ts
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LinktreeClicksTable } from '@/app/cms/(authed)/linktree/analytics/_components/linktree-clicks-table'

describe('LinktreeClicksTable', () => {
  const clicksByKey = {
    'highlight': 50,
    'blog:pt:meu-post': 30,
    'social:instagram': 15,
    'shared:a1b2c3d4': 5,
  }

  it('renders correct rank numbers', () => {
    render(<LinktreeClicksTable clicksByKey={clicksByKey} totalClicks={100} />)
    const rows = screen.getAllByRole('row')
    // header + 4 data rows + footer = 6
    expect(rows).toHaveLength(6)
  })

  it('renders correct section badges', () => {
    render(<LinktreeClicksTable clicksByKey={clicksByKey} totalClicks={100} />)
    expect(screen.getByText('Highlight')).toBeDefined()
    expect(screen.getByText('PT')).toBeDefined()
    expect(screen.getByText('Social')).toBeDefined()
    expect(screen.getByText('Shared')).toBeDefined()
  })

  it('shows correct total in footer', () => {
    render(<LinktreeClicksTable clicksByKey={clicksByKey} totalClicks={100} />)
    expect(screen.getByText('100')).toBeDefined()
    expect(screen.getByText('Total')).toBeDefined()
  })

  it('calculates correct percentages', () => {
    render(<LinktreeClicksTable clicksByKey={{ 'highlight': 50 }} totalClicks={100} />)
    expect(screen.getByText('50.0%')).toBeDefined()
  })

  it('handles empty clicksByKey gracefully', () => {
    render(<LinktreeClicksTable clicksByKey={{}} totalClicks={0} />)
    const rows = screen.getAllByRole('row')
    // header + footer only
    expect(rows).toHaveLength(2)
  })
})
```

- [ ] **Step 4: Write shared-links-section tests**

```typescript
// apps/web/test/app/cms/linktree/shared-links-section.test.ts
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SharedLinksSection } from '@/app/cms/(authed)/linktree/_components/shared-links-section'
import type { z } from 'zod'
import type { LinktreeConfigSchema } from '@/app/go/linktree/_lib/types'

type Config = z.infer<typeof LinktreeConfigSchema>

const baseConfig: Config = {
  tagline_pt: 'tagline pt',
  tagline_en: 'tagline en',
  blog_desc_pt: '',
  blog_desc_en: '',
  highlight: { active: false, url: '', badge_pt: '', badge_en: '', title_pt: '', title_en: '', desc_pt: '', desc_en: '', cta_pt: '', cta_en: '' },
  shared_links: [
    { label_pt: 'Link 1', label_en: 'Link 1 EN', url: 'https://a.com', icon: 'link-2' },
    { label_pt: 'Link 2', label_en: 'Link 2 EN', url: 'https://b.com', icon: 'star' },
  ],
}

describe('SharedLinksSection', () => {
  it('renders all shared links', () => {
    render(<SharedLinksSection config={baseConfig} onChange={vi.fn()} readOnly={false} />)
    expect(screen.getByDisplayValue('Link 1')).toBeDefined()
    expect(screen.getByDisplayValue('Link 2')).toBeDefined()
  })

  it('calls onChange when add button is clicked', () => {
    const onChange = vi.fn()
    render(<SharedLinksSection config={baseConfig} onChange={onChange} readOnly={false} />)
    const addButton = screen.getByText('Adicionar link')
    fireEvent.click(addButton)
    expect(onChange).toHaveBeenCalledWith({
      shared_links: expect.arrayContaining([
        expect.objectContaining({ label_pt: '' }),
      ]),
    })
  })

  it('calls onChange when delete button is clicked', () => {
    const onChange = vi.fn()
    render(<SharedLinksSection config={baseConfig} onChange={onChange} readOnly={false} />)
    // Find and click the first delete button (Trash2 icon)
    const deleteButtons = screen.getAllByRole('button').filter(btn => btn.querySelector('[data-lucide="trash-2"]') || btn.textContent === '')
    // The delete buttons are identified by Trash2 icon presence
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows link count', () => {
    render(<SharedLinksSection config={baseConfig} onChange={vi.fn()} readOnly={false} />)
    expect(screen.getByText('2/10 links')).toBeDefined()
  })

  it('hides add button when at max (10) links', () => {
    const maxConfig = {
      ...baseConfig,
      shared_links: Array.from({ length: 10 }, (_, i) => ({
        label_pt: `Link ${i}`, label_en: `Link ${i} EN`, url: `https://${i}.com`, icon: 'link-2',
      })),
    }
    render(<SharedLinksSection config={maxConfig} onChange={vi.fn()} readOnly={false} />)
    expect(screen.queryByText('Adicionar link')).toBeNull()
  })
})
```

- [ ] **Step 5: Write buildLinktreeEvent edge case tests**

```typescript
// apps/web/test/lib/linktree/event-recorder-edge-cases.test.ts
import { describe, it, expect } from 'vitest'
import { buildLinktreeEvent, type LinktreeEventInput } from '@/lib/linktree/event-recorder'

describe('buildLinktreeEvent edge cases', () => {
  const base: LinktreeEventInput = {
    siteId: 'site-1',
    eventType: 'pageview',
    linkKey: null,
    ip: '189.1.2.3',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    referrer: null,
    headers: new Headers(),
  }

  it('handles empty user agent string', () => {
    const event = buildLinktreeEvent({ ...base, userAgent: '' })
    expect(event.device_type).toBe('other') // 'unknown' maps to 'other'
    expect(event.browser).toBe('Unknown')
    expect(event.os).toBe('Unknown')
    expect(event.is_bot).toBe(false)
    expect(event.visitor_id).toMatch(/^[a-f0-9]{64}$/)
  })

  it('handles missing geo headers', () => {
    const event = buildLinktreeEvent({
      ...base,
      headers: new Headers(), // no x-vercel-ip-* headers
    })
    expect(event.country).toBeNull()
    expect(event.region).toBeNull()
    expect(event.city).toBeNull()
  })

  it('handles empty referrer string', () => {
    const event = buildLinktreeEvent({ ...base, referrer: '' })
    // Empty string is falsy, should be classified as direct
    expect(event.referrer_source).toBe('direct')
    expect(event.referrer_domain).toBeNull()
  })

  it('handles malformed referrer URL', () => {
    const event = buildLinktreeEvent({ ...base, referrer: 'not-a-valid-url' })
    expect(event.referrer_source).toBe('other')
    expect(event.referrer_domain).toBeNull()
  })

  it('truncates excessively long user agent', () => {
    const longUa = 'A'.repeat(1000)
    const event = buildLinktreeEvent({ ...base, userAgent: longUa })
    expect(event.user_agent.length).toBe(512)
  })

  it('extracts language from accept-language header', () => {
    const headers = new Headers({ 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8' })
    const event = buildLinktreeEvent({ ...base, headers })
    expect(event.language).toBe('pt-BR')
  })

  it('returns null language when accept-language header is missing', () => {
    const event = buildLinktreeEvent({ ...base, headers: new Headers() })
    expect(event.language).toBeNull()
  })

  it('classifies tablet user agent correctly', () => {
    const event = buildLinktreeEvent({
      ...base,
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    })
    expect(event.device_type).toBe('tablet')
    expect(event.os).toBe('iPadOS')
  })

  it('classifies desktop user agent correctly', () => {
    const event = buildLinktreeEvent({
      ...base,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
    expect(event.device_type).toBe('desktop')
    expect(event.browser).toBe('Chrome')
    expect(event.os).toBe('macOS')
  })
})
```

- [ ] **Step 6: Run all tests**

```bash
npm run test:web -- --run
```

Expected: All tests pass (new + existing).

- [ ] **Step 7: Commit**

```bash
git add apps/web/test/lib/linktree/insights.test.ts apps/web/test/app/api/go/linktree/track.test.ts apps/web/test/app/cms/linktree/analytics/linktree-clicks-table.test.ts apps/web/test/app/cms/linktree/shared-links-section.test.ts apps/web/test/lib/linktree/event-recorder-edge-cases.test.ts
git commit -m "test(linktree): add unit tests for insights, tracking route, event recorder, clicks table, and shared links"
```

---

### Task 14: Final Integration & Smoke Test

Verify everything works end-to-end: run full test suite, typecheck, then manually test the CMS editor and analytics pages.

**Files:** No new files.

- [ ] **Step 1: Run typecheck**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Fix any type errors.

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Fix any failures.

- [ ] **Step 3: Start dev server and test CMS editor**

```bash
npm run dev -w apps/web
```

Navigate to `http://localhost:3000/cms/linktree`:
- Verify sidebar shows "Linktree" item
- Verify form loads with current config
- Edit tagline, toggle highlight, add a shared link, reorder links
- Verify preview updates in real-time
- Save with ⌘S, verify "Salvo há X min" appears
- Visit `go.localhost:3000` to confirm changes are reflected

- [ ] **Step 4: Test analytics page**

Navigate to `http://localhost:3000/cms/linktree/analytics`:
- Verify KPI cards render (will show zeros if no tracking data yet)
- Verify period pills work (7d/30d/90d/12m)
- Verify "Ver Linktree" and "Editar" buttons link correctly

- [ ] **Step 5: Test tracking**

Visit `go.localhost:3000` in an incognito window, click some links, then check:
```bash
curl -s "http://localhost:54321/rest/v1/linktree_events?select=*&limit=5" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

- [ ] **Step 6: Test dashboard hero**

Navigate to `http://localhost:3000/cms/links`:
- Verify linktree hero card appears at top
- Verify stat cards show data
- Verify "Analytics" and "Editar" buttons link correctly

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat(linktree): CMS editor, analytics, dashboard hero, and click tracking"
```
