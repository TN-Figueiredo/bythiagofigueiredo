# Content Analytics & Read Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock analytics with real view tracking + localStorage-based read progress indicators on blog post cards (YouTube-style red bars), powering MostReadSidebar with actual view counts and enabling unread-first content suggestions.

**Architecture:** Two complementary layers: (1) server-side `content_events` table with `/api/track/content` endpoint + daily aggregation cron into `content_metrics` + denormalized `blog_posts.view_count`, and (2) client-side `useContentTracking` hook + `ReadProgressStore` (localStorage) + `ReadableCard` visual wrapper. LGPD hybrid model: view/depth/referrer always-on (legítimo interesse, no PII), user_agent gated by analytics consent.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL 17), Zod validation, React 19, Vitest, Tailwind 4

**Spec:** `docs/superpowers/specs/2026-05-04-content-analytics-read-tracking-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260504000001_content_tracking.sql` | `content_events` + `content_metrics` tables, indexes, RLS, RPCs |
| `supabase/migrations/20260504000002_blog_posts_view_count.sql` | `view_count` + `read_complete_count` columns on `blog_posts` |
| `apps/web/lib/tracking/config.ts` | Feature flag check, constants (thresholds, rate limits) |
| `apps/web/lib/tracking/events.ts` | Zod schema for tracking events, TypeScript types |
| `apps/web/lib/tracking/referrer.ts` | `classifyReferrer()` — URL → referrer source category |
| `apps/web/lib/tracking/bot-patterns.ts` | Bot UA patterns for aggregation exclusion |
| `apps/web/lib/tracking/read-progress-store.ts` | localStorage `IReadProgressStore` wrapper |
| `apps/web/lib/tracking/use-content-tracking.ts` | React hook — emits view/progress/complete events |
| `apps/web/src/app/api/track/content/route.ts` | POST endpoint — validates, rate-limits, inserts |
| `apps/web/src/app/api/cron/aggregate-content-metrics/route.ts` | Daily aggregation cron |
| `apps/web/src/app/api/cron/purge-content-events/route.ts` | 90-day retention purge cron |
| `apps/web/src/components/blog/readable-card.tsx` | Client wrapper — reads localStorage, renders red bar/badge |

### Modified files
| File | Change |
|------|--------|
| `apps/web/lib/home/queries.ts` | `getMostReadPosts` → query by `view_count DESC` with cold-start fallback |
| `apps/web/src/app/(public)/blog/[slug]/blog-article-client.tsx` | Add `useContentTracking` hook call |
| `apps/web/src/app/(public)/blog/[slug]/page.tsx` | Pass `siteId`, `postId` to `BlogArticleClient` |
| `apps/web/src/app/(public)/components/BlogGrid.tsx` | Wrap cards in `ReadableCard` |
| `apps/web/src/app/(public)/components/MostReadSidebar.tsx` | Add read indicators + counter (client wrapper) |
| `apps/web/src/app/(public)/components/TagCategoryGrid.tsx` | Add read indicators + counter |
| `apps/web/src/components/blog/related-posts-grid.tsx` | Unread-first reordering, render 3 from 6 |
| `apps/web/lib/blog/related-posts.ts` | Increase default limit from 3 to 6 |
| `apps/web/src/app/cms/(authed)/blog/_tabs/analytics/analytics-tab.tsx` | Replace placeholder with real analytics UI |
| `apps/web/src/app/cms/(authed)/analytics/actions.ts` | Replace `totalViews: 0` with real aggregate |
| `apps/web/src/app/cms/(authed)/_components/dashboard-connected.tsx` | Wire real `view_count` into top content |

### Test files
| File | Tests |
|------|-------|
| `apps/web/test/lib/tracking/referrer.test.ts` | classifyReferrer unit tests |
| `apps/web/test/lib/tracking/read-progress-store.test.ts` | localStorage CRUD + cleanup |
| `apps/web/test/lib/tracking/bot-patterns.test.ts` | UA matching |
| `apps/web/test/lib/tracking/events-route.test.ts` | API endpoint validation, rate limiting |
| `apps/web/test/lib/tracking/content-tracking-hook.test.ts` | Hook lifecycle, event emission |
| `apps/web/test/components/blog/readable-card.test.tsx` | Visual indicator states |
| `apps/web/test/integration/content-tracking.test.ts` | DB-gated RPC tests (aggregate, purge) |

---

## Task 1: Database migrations

**Files:**
- Create: `supabase/migrations/20260504000001_content_tracking.sql`
- Create: `supabase/migrations/20260504000002_blog_posts_view_count.sql`

- [ ] **Step 1: Write content_tracking migration**

```sql
-- supabase/migrations/20260504000001_content_tracking.sql

-- ============================================================
-- content_events — raw tracking event stream
-- ============================================================
CREATE TABLE IF NOT EXISTS content_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES sites(id),
  session_id    text NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('blog','campaign','newsletter_archive')),
  resource_id   uuid NOT NULL,
  event_type    text NOT NULL CHECK (event_type IN ('view','read_progress','read_complete')),
  anonymous_id  text NOT NULL,
  locale        text,
  referrer_src  text CHECK (referrer_src IS NULL OR referrer_src IN ('direct','google','newsletter','social','other')),
  read_depth    smallint CHECK (read_depth IS NULL OR (read_depth >= 0 AND read_depth <= 100)),
  time_on_page  smallint CHECK (time_on_page IS NULL OR (time_on_page >= 0 AND time_on_page <= 3600)),
  has_consent   boolean NOT NULL DEFAULT false,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_events_resource ON content_events(resource_type, resource_id, created_at);
CREATE INDEX idx_content_events_site_date ON content_events(site_id, created_at);
CREATE INDEX idx_content_events_anon ON content_events(anonymous_id, resource_id);

-- RLS
ALTER TABLE content_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_events_anon_insert" ON content_events;
CREATE POLICY "content_events_anon_insert" ON content_events
  FOR INSERT TO anon WITH CHECK (public.site_visible(site_id));

DROP POLICY IF EXISTS "content_events_staff_read" ON content_events;
CREATE POLICY "content_events_staff_read" ON content_events
  FOR SELECT TO authenticated USING (public.is_staff());

-- ============================================================
-- content_metrics — daily aggregation
-- ============================================================
CREATE TABLE IF NOT EXISTS content_metrics (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             uuid NOT NULL REFERENCES sites(id),
  resource_type       text NOT NULL,
  resource_id         uuid NOT NULL,
  date                date NOT NULL,
  views               int NOT NULL DEFAULT 0,
  unique_views        int NOT NULL DEFAULT 0,
  reads_complete      int NOT NULL DEFAULT 0,
  avg_read_depth      smallint NOT NULL DEFAULT 0,
  avg_time_sec        smallint NOT NULL DEFAULT 0,
  referrer_direct     int NOT NULL DEFAULT 0,
  referrer_google     int NOT NULL DEFAULT 0,
  referrer_newsletter int NOT NULL DEFAULT 0,
  referrer_social     int NOT NULL DEFAULT 0,
  referrer_other      int NOT NULL DEFAULT 0,
  UNIQUE(resource_type, resource_id, date)
);

CREATE INDEX idx_content_metrics_site ON content_metrics(site_id, date);
CREATE INDEX idx_content_metrics_resource ON content_metrics(resource_type, resource_id, date);

-- RLS
ALTER TABLE content_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_metrics_staff_read" ON content_metrics;
CREATE POLICY "content_metrics_staff_read" ON content_metrics
  FOR SELECT TO authenticated USING (public.is_staff());

-- ============================================================
-- aggregate_content_events — daily aggregation RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.aggregate_content_events(p_date date DEFAULT current_date - 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aggregated int;
  v_updated int;
BEGIN
  -- Aggregate events into content_metrics
  INSERT INTO content_metrics (
    site_id, resource_type, resource_id, date,
    views, unique_views, reads_complete,
    avg_read_depth, avg_time_sec,
    referrer_direct, referrer_google, referrer_newsletter, referrer_social, referrer_other
  )
  SELECT
    site_id, resource_type, resource_id, p_date,
    count(*) FILTER (WHERE event_type = 'view'),
    count(DISTINCT anonymous_id) FILTER (WHERE event_type = 'view'),
    count(*) FILTER (WHERE event_type = 'read_complete'),
    coalesce(avg(read_depth) FILTER (WHERE event_type = 'read_progress' AND read_depth IS NOT NULL), 0)::smallint,
    coalesce(avg(time_on_page) FILTER (WHERE event_type = 'read_progress' AND time_on_page IS NOT NULL), 0)::smallint,
    count(*) FILTER (WHERE referrer_src = 'direct' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'google' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'newsletter' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'social' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'other' AND event_type = 'view')
  FROM content_events
  WHERE created_at >= p_date::timestamptz
    AND created_at < (p_date + interval '1 day')::timestamptz
    AND (user_agent IS NULL OR user_agent NOT SIMILAR TO '%(Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Bytespider|GPTBot|ClaudeBot|anthropic-ai|CCBot|PerplexityBot)%')
  GROUP BY site_id, resource_type, resource_id
  ON CONFLICT (resource_type, resource_id, date) DO UPDATE SET
    views = EXCLUDED.views,
    unique_views = EXCLUDED.unique_views,
    reads_complete = EXCLUDED.reads_complete,
    avg_read_depth = EXCLUDED.avg_read_depth,
    avg_time_sec = EXCLUDED.avg_time_sec,
    referrer_direct = EXCLUDED.referrer_direct,
    referrer_google = EXCLUDED.referrer_google,
    referrer_newsletter = EXCLUDED.referrer_newsletter,
    referrer_social = EXCLUDED.referrer_social,
    referrer_other = EXCLUDED.referrer_other;

  GET DIAGNOSTICS v_aggregated = ROW_COUNT;

  -- Update denormalized counts on blog_posts
  UPDATE blog_posts bp SET
    view_count = coalesce(agg.total_views, 0),
    read_complete_count = coalesce(agg.total_reads, 0)
  FROM (
    SELECT resource_id,
           sum(views) AS total_views,
           sum(reads_complete) AS total_reads
    FROM content_metrics
    WHERE resource_type = 'blog'
    GROUP BY resource_id
  ) agg
  WHERE bp.id = agg.resource_id
    AND (bp.view_count IS DISTINCT FROM coalesce(agg.total_views, 0)
      OR bp.read_complete_count IS DISTINCT FROM coalesce(agg.total_reads, 0));

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'date', p_date,
    'metrics_upserted', v_aggregated,
    'posts_updated', v_updated
  );
END;
$$;

-- ============================================================
-- purge_content_events — 90-day retention
-- ============================================================
CREATE OR REPLACE FUNCTION public.purge_content_events(p_older_than_days int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM content_events
  WHERE created_at < now() - (p_older_than_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('purged', v_deleted);
END;
$$;
```

- [ ] **Step 2: Write blog_posts view_count migration**

```sql
-- supabase/migrations/20260504000002_blog_posts_view_count.sql

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS read_complete_count int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_blog_posts_view_count ON blog_posts(view_count DESC)
  WHERE status = 'published';
```

- [ ] **Step 3: Push migrations to prod**

```bash
npm run db:push:prod
```

Expected: prompted with YES, migrations applied successfully.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260504000001_content_tracking.sql supabase/migrations/20260504000002_blog_posts_view_count.sql
git commit -m "feat(tracking): add content_events + content_metrics tables and blog_posts.view_count"
```

---

## Task 2: Tracking library — types, config, referrer, bot patterns

**Files:**
- Create: `apps/web/lib/tracking/config.ts`
- Create: `apps/web/lib/tracking/events.ts`
- Create: `apps/web/lib/tracking/referrer.ts`
- Create: `apps/web/lib/tracking/bot-patterns.ts`
- Create: `apps/web/test/lib/tracking/referrer.test.ts`
- Create: `apps/web/test/lib/tracking/bot-patterns.test.ts`

- [ ] **Step 1: Write referrer tests**

```typescript
// apps/web/test/lib/tracking/referrer.test.ts
import { describe, it, expect } from 'vitest'
import { classifyReferrer } from '../../../lib/tracking/referrer'

describe('classifyReferrer', () => {
  it('returns direct for null referrer', () => {
    expect(classifyReferrer(null, '')).toBe('direct')
  })

  it('returns direct for empty string', () => {
    expect(classifyReferrer('', '')).toBe('direct')
  })

  it('returns google for Google search', () => {
    expect(classifyReferrer('https://www.google.com/search?q=test', '')).toBe('google')
  })

  it('returns google for Bing search', () => {
    expect(classifyReferrer('https://www.bing.com/search?q=test', '')).toBe('google')
  })

  it('returns google for DuckDuckGo', () => {
    expect(classifyReferrer('https://duckduckgo.com/?q=test', '')).toBe('google')
  })

  it('returns newsletter for newsletter domain', () => {
    expect(classifyReferrer('https://bythiagofigueiredo.com/newsletter/archive/1', '')).toBe('newsletter')
  })

  it('returns newsletter for utm_source=newsletter', () => {
    expect(classifyReferrer('https://other.com', 'https://bythiagofigueiredo.com/blog/test?utm_source=newsletter')).toBe('newsletter')
  })

  it('returns social for twitter.com', () => {
    expect(classifyReferrer('https://twitter.com/someone/status/123', '')).toBe('social')
  })

  it('returns social for x.com', () => {
    expect(classifyReferrer('https://x.com/someone/status/123', '')).toBe('social')
  })

  it('returns social for linkedin.com', () => {
    expect(classifyReferrer('https://www.linkedin.com/feed', '')).toBe('social')
  })

  it('returns social for reddit.com', () => {
    expect(classifyReferrer('https://www.reddit.com/r/nextjs', '')).toBe('social')
  })

  it('returns other for unknown domain', () => {
    expect(classifyReferrer('https://someotherblog.com/article', '')).toBe('other')
  })

  it('handles malformed URLs gracefully', () => {
    expect(classifyReferrer('not-a-url', '')).toBe('other')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:web -- --bail test/lib/tracking/referrer.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write bot-patterns tests**

```typescript
// apps/web/test/lib/tracking/bot-patterns.test.ts
import { describe, it, expect } from 'vitest'
import { isBot } from '../../../lib/tracking/bot-patterns'

describe('isBot', () => {
  it('detects Googlebot', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true)
  })

  it('detects bingbot', () => {
    expect(isBot('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe(true)
  })

  it('detects GPTBot', () => {
    expect(isBot('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) GPTBot/1.0')).toBe(true)
  })

  it('detects ClaudeBot', () => {
    expect(isBot('ClaudeBot/1.0')).toBe(true)
  })

  it('allows normal Chrome UA', () => {
    expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0')).toBe(false)
  })

  it('allows null UA', () => {
    expect(isBot(null)).toBe(false)
  })
})
```

- [ ] **Step 4: Write config.ts**

```typescript
// apps/web/lib/tracking/config.ts

export const CONTENT_TRACKING_ENABLED =
  process.env.CONTENT_TRACKING_ENABLED !== 'false'

export const READ_INDICATORS_ENABLED =
  process.env.NEXT_PUBLIC_READ_INDICATORS_ENABLED !== 'false'

export const VIEW_DELAY_MS = 3_000
export const READ_COMPLETE_THRESHOLD = 95
export const DEDUP_WINDOW_MS = 30 * 60_000
export const COLD_START_THRESHOLD = 10
export const CLEANUP_MAX_AGE_DAYS = 365

export const RATE_LIMIT_WINDOW_MS = 60_000
export const RATE_LIMIT_MAX = 30
```

- [ ] **Step 5: Write events.ts**

```typescript
// apps/web/lib/tracking/events.ts
import { z } from 'zod'

export const ResourceType = z.enum(['blog', 'campaign', 'newsletter_archive'])
export type ResourceType = z.infer<typeof ResourceType>

export const EventType = z.enum(['view', 'read_progress', 'read_complete'])
export type EventType = z.infer<typeof EventType>

export const ReferrerSrc = z.enum(['direct', 'google', 'newsletter', 'social', 'other'])
export type ReferrerSrc = z.infer<typeof ReferrerSrc>

export const TrackingEventSchema = z.object({
  sessionId: z.string().min(1),
  siteId: z.string().uuid(),
  resourceType: ResourceType,
  resourceId: z.string().uuid(),
  eventType: EventType,
  anonymousId: z.string().min(1),
  locale: z.string().optional(),
  referrerSrc: ReferrerSrc.optional(),
  readDepth: z.number().int().min(0).max(100).optional(),
  timeOnPage: z.number().int().min(0).max(3600).optional(),
  hasConsent: z.boolean(),
})

export const TrackingRequestSchema = z.object({
  events: z.array(TrackingEventSchema).min(1).max(5),
})

export type TrackingEvent = z.infer<typeof TrackingEventSchema>
export type TrackingRequest = z.infer<typeof TrackingRequestSchema>

export interface TrackingConfig {
  siteId: string
  resourceType: ResourceType
  resourceId: string
  locale: string
  isPreview?: boolean
}
```

- [ ] **Step 6: Write referrer.ts**

```typescript
// apps/web/lib/tracking/referrer.ts
import type { ReferrerSrc } from './events'

const SEARCH_RE = /google\.|bing\.|yahoo\.|duckduckgo\.|baidu\./
const SOCIAL_RE = /twitter\.|x\.com|facebook\.|instagram\.|linkedin\.|threads\.net|reddit\./
const NEWSLETTER_DOMAIN = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'

export function classifyReferrer(
  referrer: string | null,
  currentUrl: string,
): ReferrerSrc {
  if (!referrer) return 'direct'

  try {
    const host = new URL(referrer).hostname
    if (SEARCH_RE.test(host)) return 'google'
    if (host.includes(NEWSLETTER_DOMAIN)) return 'newsletter'
    if (SOCIAL_RE.test(host)) return 'social'
  } catch {
    // malformed referrer URL — check UTM then fall through to 'other'
  }

  try {
    if (currentUrl) {
      const utm = new URL(currentUrl).searchParams.get('utm_source')
      if (utm === 'newsletter') return 'newsletter'
    }
  } catch {
    // ignore
  }

  return referrer ? 'other' : 'direct'
}
```

- [ ] **Step 7: Write bot-patterns.ts**

```typescript
// apps/web/lib/tracking/bot-patterns.ts

const BOT_RE =
  /Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Bytespider|GPTBot|ClaudeBot|anthropic-ai|CCBot|PerplexityBot|Amazonbot|facebookexternalhit|Twitterbot/i

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return BOT_RE.test(userAgent)
}
```

- [ ] **Step 8: Run tests**

```bash
npm run test:web -- --bail test/lib/tracking/referrer.test.ts test/lib/tracking/bot-patterns.test.ts
```
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/tracking/ apps/web/test/lib/tracking/referrer.test.ts apps/web/test/lib/tracking/bot-patterns.test.ts
git commit -m "feat(tracking): add tracking lib — types, config, referrer parser, bot patterns"
```

---

## Task 3: Read progress store (localStorage)

**Files:**
- Create: `apps/web/lib/tracking/read-progress-store.ts`
- Create: `apps/web/test/lib/tracking/read-progress-store.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// apps/web/test/lib/tracking/read-progress-store.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ReadProgressStore } from '../../../lib/tracking/read-progress-store'

const mockStorage = new Map<string, string>()
const localStorageMock = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
}

vi.stubGlobal('localStorage', localStorageMock)

describe('ReadProgressStore', () => {
  beforeEach(() => mockStorage.clear())

  it('returns null for unread post', () => {
    const store = new ReadProgressStore()
    expect(store.getProgress('post-1')).toBeNull()
  })

  it('sets and retrieves progress', () => {
    const store = new ReadProgressStore()
    store.setProgress('post-1', 50)
    const result = store.getProgress('post-1')
    expect(result).not.toBeNull()
    expect(result!.depth).toBe(50)
  })

  it('only increases depth (never decreases)', () => {
    const store = new ReadProgressStore()
    store.setProgress('post-1', 75)
    store.setProgress('post-1', 30)
    expect(store.getProgress('post-1')!.depth).toBe(75)
  })

  it('updates depth when higher', () => {
    const store = new ReadProgressStore()
    store.setProgress('post-1', 50)
    store.setProgress('post-1', 80)
    expect(store.getProgress('post-1')!.depth).toBe(80)
  })

  it('getAllRead returns all entries', () => {
    const store = new ReadProgressStore()
    store.setProgress('a', 100)
    store.setProgress('b', 50)
    const all = store.getAllRead()
    expect(all.size).toBe(2)
  })

  it('isRead returns true for depth >= 95', () => {
    const store = new ReadProgressStore()
    store.setProgress('post-1', 95)
    expect(store.isRead('post-1')).toBe(true)
  })

  it('isRead returns false for depth < 95', () => {
    const store = new ReadProgressStore()
    store.setProgress('post-1', 94)
    expect(store.isRead('post-1')).toBe(false)
  })

  it('cleanup removes entries older than maxAgeDays', () => {
    const store = new ReadProgressStore()
    store.setProgress('recent', 100)

    // Manually insert an old entry
    const raw = JSON.parse(mockStorage.get('btf_read_progress') ?? '{}')
    raw['old-post'] = { d: 100, t: Math.floor(Date.now() / 1000) - 400 * 86400 }
    mockStorage.set('btf_read_progress', JSON.stringify(raw))

    store.cleanup(365)
    expect(store.getProgress('old-post')).toBeNull()
    expect(store.getProgress('recent')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:web -- --bail test/lib/tracking/read-progress-store.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```typescript
// apps/web/lib/tracking/read-progress-store.ts

const STORAGE_KEY = 'btf_read_progress'

type Entry = { d: number; t: number }
type StoreData = Record<string, Entry>

export interface ReadProgress {
  depth: number
  timestamp: number
}

export class ReadProgressStore {
  private read(): StoreData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return {}
      return JSON.parse(raw) as StoreData
    } catch {
      return {}
    }
  }

  private write(data: StoreData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // storage full or unavailable — silently fail
    }
  }

  getProgress(resourceId: string): ReadProgress | null {
    const data = this.read()
    const entry = data[resourceId]
    if (!entry) return null
    return { depth: entry.d, timestamp: entry.t }
  }

  setProgress(resourceId: string, depth: number): void {
    const data = this.read()
    const existing = data[resourceId]
    if (existing && existing.d >= depth) return
    data[resourceId] = { d: depth, t: Math.floor(Date.now() / 1000) }
    this.write(data)
  }

  isRead(resourceId: string): boolean {
    const p = this.getProgress(resourceId)
    return p !== null && p.depth >= 95
  }

  getAllRead(): Map<string, ReadProgress> {
    const data = this.read()
    const map = new Map<string, ReadProgress>()
    for (const [id, entry] of Object.entries(data)) {
      map.set(id, { depth: entry.d, timestamp: entry.t })
    }
    return map
  }

  cleanup(maxAgeDays: number): void {
    const data = this.read()
    const cutoff = Math.floor(Date.now() / 1000) - maxAgeDays * 86400
    let changed = false
    for (const [id, entry] of Object.entries(data)) {
      if (entry.t < cutoff) {
        delete data[id]
        changed = true
      }
    }
    if (changed) this.write(data)
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:web -- --bail test/lib/tracking/read-progress-store.test.ts
```
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/tracking/read-progress-store.ts apps/web/test/lib/tracking/read-progress-store.test.ts
git commit -m "feat(tracking): add ReadProgressStore — localStorage wrapper for read progress"
```

---

## Task 4: API endpoint `/api/track/content`

**Files:**
- Create: `apps/web/src/app/api/track/content/route.ts`
- Create: `apps/web/test/lib/tracking/events-route.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// apps/web/test/lib/tracking/events-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn(() => Promise.resolve({ error: null }))
const mockFrom = vi.fn(() => ({ insert: mockInsert }))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/track/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

const validEvent = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  siteId: '22222222-2222-4222-8222-222222222222',
  resourceType: 'blog' as const,
  resourceId: '33333333-3333-4333-8333-333333333333',
  eventType: 'view' as const,
  anonymousId: '44444444-4444-4444-8444-444444444444',
  hasConsent: false,
}

describe('POST /api/track/content', () => {
  beforeEach(() => vi.clearAllMocks())

  async function callRoute(body: unknown, headers: Record<string, string> = {}) {
    vi.resetModules()
    const { POST } = await import('../../src/app/api/track/content/route')
    return POST(makeRequest(body, headers))
  }

  it('returns 204 for valid view event', async () => {
    const res = await callRoute({ events: [validEvent] })
    expect(res.status).toBe(204)
    expect(mockFrom).toHaveBeenCalledWith('content_events')
  })

  it('strips user_agent when hasConsent is false', async () => {
    await callRoute({ events: [validEvent] })
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].user_agent).toBeNull()
  })

  it('includes user_agent when hasConsent is true', async () => {
    await callRoute(
      { events: [{ ...validEvent, hasConsent: true }] },
      { 'user-agent': 'Mozilla/5.0 Chrome/125' },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].user_agent).toBe('Mozilla/5.0 Chrome/125')
  })

  it('returns 400 for missing events array', async () => {
    const res = await callRoute({})
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid event_type', async () => {
    const res = await callRoute({ events: [{ ...validEvent, eventType: 'hover' }] })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid resourceType', async () => {
    const res = await callRoute({ events: [{ ...validEvent, resourceType: 'page' }] })
    expect(res.status).toBe(400)
  })

  it('returns 400 for events exceeding max 5', async () => {
    const events = Array.from({ length: 6 }, () => validEvent)
    const res = await callRoute({ events })
    expect(res.status).toBe(400)
  })

  it('returns 204 when CONTENT_TRACKING_ENABLED is false', async () => {
    process.env.CONTENT_TRACKING_ENABLED = 'false'
    const res = await callRoute({ events: [validEvent] })
    expect(res.status).toBe(204)
    expect(mockFrom).not.toHaveBeenCalled()
    delete process.env.CONTENT_TRACKING_ENABLED
  })

  it('returns 429 when rate limit exceeded', async () => {
    const { POST } = await import('../../src/app/api/track/content/route')
    for (let i = 0; i < 30; i++) {
      await POST(makeRequest({ events: [validEvent] }, { 'x-forwarded-for': '10.0.0.99' }))
    }
    const res = await POST(makeRequest({ events: [validEvent] }, { 'x-forwarded-for': '10.0.0.99' }))
    expect(res.status).toBe(429)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:web -- --bail test/lib/tracking/events-route.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```typescript
// apps/web/src/app/api/track/content/route.ts
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { TrackingRequestSchema } from '@/lib/tracking/events'
import {
  CONTENT_TRACKING_ENABLED,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
} from '@/lib/tracking/config'

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

export async function POST(request: Request): Promise<Response> {
  if (!CONTENT_TRACKING_ENABLED) {
    return new Response(null, { status: 204 })
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  let parsed: { events: Array<Record<string, unknown>> }
  try {
    parsed = TrackingRequestSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const userAgent = request.headers.get('user-agent')
  const supabase = getSupabaseServiceClient()

  const rows = parsed.events.map((e) => ({
    session_id: e.sessionId,
    site_id: e.siteId,
    resource_type: e.resourceType,
    resource_id: e.resourceId,
    event_type: e.eventType,
    anonymous_id: e.anonymousId,
    locale: e.locale ?? null,
    referrer_src: e.referrerSrc ?? null,
    read_depth: e.readDepth ?? null,
    time_on_page: e.timeOnPage ?? null,
    has_consent: e.hasConsent,
    user_agent: e.hasConsent ? userAgent : null,
  }))

  const { error } = await supabase.from('content_events').insert(rows)
  if (error) {
    Sentry.captureException(new Error(error.message), {
      tags: { component: 'content-tracking' },
      extra: { eventCount: rows.length, ip },
    })
  }

  return new Response(null, { status: 204 })
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:web -- --bail test/lib/tracking/events-route.test.ts
```
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/track/content/route.ts apps/web/test/lib/tracking/events-route.test.ts
git commit -m "feat(tracking): add POST /api/track/content endpoint with rate limiting"
```

---

## Task 5: Cron routes — aggregation + purge

**Files:**
- Create: `apps/web/src/app/api/cron/aggregate-content-metrics/route.ts`
- Create: `apps/web/src/app/api/cron/purge-content-events/route.ts`

- [ ] **Step 1: Write aggregation cron route**

```typescript
// apps/web/src/app/api/cron/aggregate-content-metrics/route.ts
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock } from '@/lib/logger'

const JOB = 'aggregate-content-metrics'
const LOCK_KEY = 'cron:aggregate-content'

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = crypto.randomUUID()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const { data, error } = await supabase.rpc('aggregate_content_events')

    if (error) throw error

    revalidateTag('most-read')
    revalidateTag('content-analytics')

    return { status: 'ok' as const, ...(data as Record<string, unknown>) }
  })
}
```

- [ ] **Step 2: Write purge cron route**

```typescript
// apps/web/src/app/api/cron/purge-content-events/route.ts
import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock } from '@/lib/logger'

const JOB = 'purge-content-events'
const LOCK_KEY = 'cron:purge-content-events'

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = crypto.randomUUID()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const { data, error } = await supabase.rpc('purge_content_events')
    if (error) throw error
    return { status: 'ok' as const, ...(data as Record<string, unknown>) }
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/cron/aggregate-content-metrics/route.ts apps/web/src/app/api/cron/purge-content-events/route.ts
git commit -m "feat(tracking): add aggregation + purge cron routes"
```

---

## Task 6: Client hook `useContentTracking`

**Files:**
- Create: `apps/web/lib/tracking/use-content-tracking.ts`
- Create: `apps/web/test/lib/tracking/content-tracking-hook.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// apps/web/test/lib/tracking/content-tracking-hook.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'

const mockFetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('navigator', { sendBeacon: vi.fn(() => true), webdriver: false })

const mockStorage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
})
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => mockStorage.get('ss_' + k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set('ss_' + k, v),
  removeItem: (k: string) => mockStorage.delete('ss_' + k),
})

let mockProgress = 0
vi.mock('@/components/blog/scroll-context', () => ({
  useScrollState: () => ({ progress: mockProgress, activeSection: null, sectionProgress: new Map(), visible: true }),
}))

vi.mock('@/components/lgpd/cookie-banner-context', () => ({
  useCookieConsent: () => ({
    consent: { analytics: false, anonymousId: 'anon-test-id' },
  }),
}))

describe('useContentTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockStorage.clear()
    mockProgress = 0
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not emit events when isPreview is true', async () => {
    const { useContentTracking } = await import('../../../lib/tracking/use-content-tracking')
    renderHook(() =>
      useContentTracking({
        siteId: 'site-1',
        resourceType: 'blog',
        resourceId: 'post-1',
        locale: 'en',
        isPreview: true,
      }),
    )
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('emits view event after 3 seconds', async () => {
    const { useContentTracking } = await import('../../../lib/tracking/use-content-tracking')
    renderHook(() =>
      useContentTracking({
        siteId: 'site-1',
        resourceType: 'blog',
        resourceId: 'post-1',
        locale: 'en',
      }),
    )
    await act(async () => { vi.advanceTimersByTime(3100) })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events[0].eventType).toBe('view')
  })

  it('skips bot detection when navigator.webdriver is true', async () => {
    Object.defineProperty(navigator, 'webdriver', { value: true, writable: true })
    const { useContentTracking } = await import('../../../lib/tracking/use-content-tracking')
    renderHook(() =>
      useContentTracking({
        siteId: 'site-1',
        resourceType: 'blog',
        resourceId: 'post-1',
        locale: 'en',
      }),
    )
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(mockFetch).not.toHaveBeenCalled()
    Object.defineProperty(navigator, 'webdriver', { value: false, writable: true })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:web -- --bail test/lib/tracking/content-tracking-hook.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// apps/web/lib/tracking/use-content-tracking.ts
'use client'

import { useEffect, useRef } from 'react'
import { useScrollState } from '@/components/blog/scroll-context'
import { useCookieConsent } from '@/components/lgpd/cookie-banner-context'
import { ReadProgressStore } from './read-progress-store'
import { classifyReferrer } from './referrer'
import type { TrackingConfig, TrackingEvent } from './events'
import {
  VIEW_DELAY_MS,
  READ_COMPLETE_THRESHOLD,
  DEDUP_WINDOW_MS,
  CLEANUP_MAX_AGE_DAYS,
  READ_INDICATORS_ENABLED,
} from './config'

const TRACK_URL = '/api/track/content'

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function sendEvents(events: TrackingEvent[]): void {
  try {
    fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // silent
  }
}

function beaconEvents(events: TrackingEvent[]): void {
  try {
    const payload = JSON.stringify({ events })
    if (navigator.sendBeacon) {
      navigator.sendBeacon(TRACK_URL, new Blob([payload], { type: 'application/json' }))
    } else {
      fetch(TRACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // silent
  }
}

export function useContentTracking(config: TrackingConfig): void {
  const { progress } = useScrollState()
  const { consent } = useCookieConsent()
  const sessionIdRef = useRef(generateSessionId())
  const startTimeRef = useRef(Date.now())
  const viewSentRef = useRef(false)
  const completeSentRef = useRef(false)
  const maxDepthRef = useRef(0)
  const storeRef = useRef<ReadProgressStore | null>(null)

  useEffect(() => {
    if (config.isPreview) return
    if (typeof navigator !== 'undefined' && (navigator as { webdriver?: boolean }).webdriver) return
    if (!READ_INDICATORS_ENABLED) return

    storeRef.current = new ReadProgressStore()
    storeRef.current.cleanup(CLEANUP_MAX_AGE_DAYS)
  }, [config.isPreview])

  // View event after 3s
  useEffect(() => {
    if (config.isPreview) return
    if (typeof navigator !== 'undefined' && (navigator as { webdriver?: boolean }).webdriver) return

    const dedupKey = `btf_view_sent:${config.resourceId}`
    const lastSent = sessionStorage.getItem(dedupKey)
    if (lastSent && Date.now() - Number(lastSent) < DEDUP_WINDOW_MS) {
      viewSentRef.current = true
      return
    }

    const timer = setTimeout(() => {
      if (viewSentRef.current) return
      viewSentRef.current = true
      sessionStorage.setItem(dedupKey, String(Date.now()))

      const anonymousId =
        consent?.anonymousId ||
        localStorage.getItem('lgpd_anon_id') ||
        generateSessionId()

      sendEvents([{
        sessionId: sessionIdRef.current,
        siteId: config.siteId,
        resourceType: config.resourceType,
        resourceId: config.resourceId,
        eventType: 'view',
        anonymousId,
        locale: config.locale,
        referrerSrc: classifyReferrer(document.referrer, window.location.href),
        hasConsent: consent?.analytics ?? false,
      }])
    }, VIEW_DELAY_MS)

    return () => clearTimeout(timer)
  }, [config.isPreview, config.siteId, config.resourceType, config.resourceId, config.locale, consent])

  // Track scroll progress
  useEffect(() => {
    if (config.isPreview) return
    if (typeof navigator !== 'undefined' && (navigator as { webdriver?: boolean }).webdriver) return

    const depthPercent = Math.round(progress * 100)
    if (depthPercent > maxDepthRef.current) {
      maxDepthRef.current = depthPercent
    }

    // Update localStorage at thresholds
    const store = storeRef.current
    if (store) {
      const thresholds = [25, 50, 75, 100]
      for (const t of thresholds) {
        if (depthPercent >= t) {
          store.setProgress(config.resourceId, t)
        }
      }
    }

    // Emit read_complete when crossing threshold
    if (depthPercent >= READ_COMPLETE_THRESHOLD && !completeSentRef.current) {
      completeSentRef.current = true
      if (store) store.setProgress(config.resourceId, 100)

      const anonymousId =
        consent?.anonymousId ||
        localStorage.getItem('lgpd_anon_id') ||
        generateSessionId()

      sendEvents([{
        sessionId: sessionIdRef.current,
        siteId: config.siteId,
        resourceType: config.resourceType,
        resourceId: config.resourceId,
        eventType: 'read_complete',
        anonymousId,
        readDepth: depthPercent,
        locale: config.locale,
        hasConsent: consent?.analytics ?? false,
      }])
    }
  }, [progress, config, consent])

  // Page close — send read_progress via beacon
  useEffect(() => {
    if (config.isPreview) return
    if (typeof navigator !== 'undefined' && (navigator as { webdriver?: boolean }).webdriver) return

    const handleClose = () => {
      const anonymousId =
        consent?.anonymousId ||
        localStorage.getItem('lgpd_anon_id') ||
        generateSessionId()

      const timeOnPage = Math.min(
        Math.round((Date.now() - startTimeRef.current) / 1000),
        3600,
      )

      beaconEvents([{
        sessionId: sessionIdRef.current,
        siteId: config.siteId,
        resourceType: config.resourceType,
        resourceId: config.resourceId,
        eventType: 'read_progress',
        anonymousId,
        readDepth: maxDepthRef.current,
        timeOnPage,
        locale: config.locale,
        referrerSrc: classifyReferrer(document.referrer, window.location.href),
        hasConsent: consent?.analytics ?? false,
      }])
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handleClose()
    })
    window.addEventListener('pagehide', handleClose)

    return () => {
      document.removeEventListener('visibilitychange', handleClose)
      window.removeEventListener('pagehide', handleClose)
    }
  }, [config, consent])
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:web -- --bail test/lib/tracking/content-tracking-hook.test.ts
```
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/tracking/use-content-tracking.ts apps/web/test/lib/tracking/content-tracking-hook.test.ts
git commit -m "feat(tracking): add useContentTracking hook with view/progress/complete lifecycle"
```

---

## Task 7: ReadableCard component + visual indicators

**Files:**
- Create: `apps/web/src/components/blog/readable-card.tsx`
- Create: `apps/web/test/components/blog/readable-card.test.tsx`

- [ ] **Step 1: Write tests**

```typescript
// apps/web/test/components/blog/readable-card.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

const mockStorage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
})

describe('ReadableCard', () => {
  beforeEach(() => mockStorage.clear())

  it('renders children without indicator when not read', async () => {
    const { ReadableCard } = await import('../../../src/components/blog/readable-card')
    render(
      <ReadableCard postId="p1">
        <div data-testid="child">content</div>
      </ReadableCard>,
    )
    expect(screen.getByTestId('child')).toBeDefined()
    expect(screen.queryByTestId('read-bar')).toBeNull()
  })

  it('renders red bar when partially read', async () => {
    mockStorage.set('btf_read_progress', JSON.stringify({ 'p2': { d: 50, t: Date.now() / 1000 } }))
    const { ReadableCard } = await import('../../../src/components/blog/readable-card')
    render(
      <ReadableCard postId="p2">
        <div>content</div>
      </ReadableCard>,
    )
    const bar = screen.getByTestId('read-bar')
    expect(bar).toBeDefined()
    expect(bar.style.width).toBe('50%')
  })

  it('renders full bar + badge when fully read', async () => {
    mockStorage.set('btf_read_progress', JSON.stringify({ 'p3': { d: 100, t: Date.now() / 1000 } }))
    const { ReadableCard } = await import('../../../src/components/blog/readable-card')
    render(
      <ReadableCard postId="p3">
        <div>content</div>
      </ReadableCard>,
    )
    const bar = screen.getByTestId('read-bar')
    expect(bar.style.width).toBe('100%')
    expect(screen.getByTestId('read-badge')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:web -- --bail test/components/blog/readable-card.test.tsx
```

- [ ] **Step 3: Write implementation**

```typescript
// apps/web/src/components/blog/readable-card.tsx
'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { ReadProgressStore } from '@/lib/tracking/read-progress-store'
import { READ_INDICATORS_ENABLED } from '@/lib/tracking/config'

type Props = {
  postId: string
  children: ReactNode
  dimTitle?: boolean
}

export function ReadableCard({ postId, children, dimTitle = true }: Props) {
  const [depth, setDepth] = useState(0)

  useEffect(() => {
    if (!READ_INDICATORS_ENABLED) return
    const store = new ReadProgressStore()
    const p = store.getProgress(postId)
    if (p) setDepth(p.depth)
  }, [postId])

  const isRead = depth >= 95
  const hasProgress = depth > 0

  return (
    <div style={{ position: 'relative' }}>
      {isRead && (
        <div
          data-testid="read-badge"
          className="font-mono"
          style={{
            position: 'absolute',
            top: 24,
            right: 12,
            zIndex: 10,
            background: 'rgba(0,0,0,0.75)',
            color: '#ccc',
            fontSize: 9,
            padding: '2px 7px',
            borderRadius: 3,
            letterSpacing: '0.05em',
            pointerEvents: 'none',
          }}
        >
          ✓ lido
        </div>
      )}
      <div style={isRead && dimTitle ? { opacity: 0.6 } : undefined}>
        {children}
      </div>
      {hasProgress && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 3,
            background: 'var(--pb-line)',
            // Position after the image area (below the aspect-ratio div)
            // This will be placed via CSS to sit between image and content
          }}
        >
          <div
            data-testid="read-bar"
            style={{
              width: `${Math.min(depth, 100)}%`,
              height: '100%',
              background: 'var(--pb-yt, #FF3333)',
              borderRadius: depth < 100 ? '0 2px 2px 0' : undefined,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:web -- --bail test/components/blog/readable-card.test.tsx
```
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/blog/readable-card.tsx apps/web/test/components/blog/readable-card.test.tsx
git commit -m "feat(tracking): add ReadableCard component with YouTube-style progress bar"
```

---

## Task 8: Wire tracking into blog post page

**Files:**
- Modify: `apps/web/src/app/(public)/blog/[slug]/blog-article-client.tsx`
- Modify: `apps/web/src/app/(public)/blog/[slug]/page.tsx`

- [ ] **Step 1: Add props to BlogArticleClient**

In `apps/web/src/app/(public)/blog/[slug]/blog-article-client.tsx`, add `siteId` and `postId` to Props and call the hook:

Add to imports:
```typescript
import { useContentTracking } from '@/lib/tracking/use-content-tracking'
```

Add to Props type:
```typescript
  siteId: string
  postId: string
```

Add hook call at top of component body (before useState):
```typescript
useContentTracking({
  siteId,
  resourceType: 'blog',
  resourceId: postId,
  locale,
  isPreview: typeof window !== 'undefined' && (window.location.pathname.includes('/cms/') || new URLSearchParams(window.location.search).has('preview')),
})
```

- [ ] **Step 2: Pass siteId and postId from page.tsx**

In `apps/web/src/app/(public)/blog/[slug]/page.tsx`, find where `BlogArticleClient` is rendered and add the props. The `siteId` comes from `getSiteContext()` and `postId` from the loaded post data.

Add to the `BlogArticleClient` usage:
```typescript
siteId={siteId}
postId={postData.post.id}
```

- [ ] **Step 3: Run full test suite**

```bash
npm run test:web
```
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/\[slug\]/blog-article-client.tsx apps/web/src/app/\(public\)/blog/\[slug\]/page.tsx
git commit -m "feat(tracking): wire useContentTracking into blog post page"
```

---

## Task 9: Visual indicators on BlogGrid + MostReadSidebar + TagCategoryGrid

**Files:**
- Modify: `apps/web/src/app/(public)/components/BlogGrid.tsx`
- Modify: `apps/web/src/app/(public)/components/MostReadSidebar.tsx`
- Modify: `apps/web/src/app/(public)/components/TagCategoryGrid.tsx`

- [ ] **Step 1: Wrap BlogGrid cards in ReadableCard**

In `apps/web/src/app/(public)/components/BlogGrid.tsx`:

Add import:
```typescript
import { ReadableCard } from '../../../../components/blog/readable-card'
```

Wrap the card content inside the existing `<div key={post.id}>` wrapper. The `ReadableCard` wraps the `<PaperCard>` element:

```tsx
<div key={post.id} style={{ position: 'relative', paddingTop: 16 }}>
  <ReadableCard postId={post.id}>
    <PaperCard index={i} variant={...}>
      {/* existing content unchanged */}
    </PaperCard>
  </ReadableCard>
  {/* star badge unchanged */}
</div>
```

- [ ] **Step 2: Add read counter + indicators to MostReadSidebar**

Create a client wrapper `MostReadSidebarClient` that reads localStorage and reorders posts. In `MostReadSidebar.tsx`:

Convert to a server component that renders a client wrapper. The client wrapper:
1. Reads `btf_read_progress` from localStorage after hydration
2. Reorders: unread first, read after
3. Shows counter "3 de 5 lidos" in header
4. Applies `opacity: 0.55` + "· ✓" to read items

- [ ] **Step 3: Add read counter to TagCategoryGrid**

Similar pattern: client wrapper reads localStorage, shows "X de Y lidos" next to each tag name.

- [ ] **Step 4: Run full test suite**

```bash
npm run test:web
```
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/components/BlogGrid.tsx apps/web/src/app/\(public\)/components/MostReadSidebar.tsx apps/web/src/app/\(public\)/components/TagCategoryGrid.tsx
git commit -m "feat(tracking): add read progress indicators to BlogGrid, MostReadSidebar, TagCategoryGrid"
```

---

## Task 10: MostReadSidebar — real view_count query + cold start

**Files:**
- Modify: `apps/web/lib/home/queries.ts`

- [ ] **Step 1: Rewrite getMostReadPosts**

Replace the pseudo-random algorithm with a real query:

```typescript
export async function getMostReadPosts(locale: string, limit = 5): Promise<HomePost[]> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  // Check if we have enough real data
  const { data: maxRow } = await db
    .from('blog_posts')
    .select('view_count')
    .eq('status', 'published')
    .lte('published_at', now)
    .order('view_count', { ascending: false })
    .limit(1)
    .single()

  const maxViews = (maxRow?.view_count as number) ?? 0

  // Cold start fallback: use pseudo-random if not enough views yet
  if (maxViews < COLD_START_THRESHOLD) {
    const posts = await getLatestPosts(locale, 20)
    if (posts.length === 0) return []
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    )
    const seeded = posts.map((p, i) => ({
      post: p,
      score: ((i + 1) * 37 + dayOfYear * 13) % 97,
    }))
    seeded.sort((a, b) => b.score - a.score)
    return seeded.slice(0, limit).map(s => s.post)
  }

  // Real ranking by view_count
  const { data, error } = await db
    .from('blog_translations')
    .select(`
      slug, locale, title, excerpt, reading_time_min, cover_image_url,
      blog_posts!inner(id, published_at, category, is_featured, status, view_count,
        blog_tags(name, color, color_dark)
      )
    `)
    .eq('locale', locale)
    .eq('blog_posts.status', 'published')
    .lte('blog_posts.published_at', now)
    .order('view_count', { referencedTable: 'blog_posts', ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map(mapRowToHomePost)
}
```

Add import at top of file:
```typescript
import { COLD_START_THRESHOLD } from '../tracking/config'
```

- [ ] **Step 2: Run tests**

```bash
npm run test:web
```
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/home/queries.ts
git commit -m "feat(tracking): wire getMostReadPosts to real view_count with cold-start fallback"
```

---

## Task 11: Related posts — unread-first + increase limit

**Files:**
- Modify: `apps/web/lib/blog/related-posts.ts`
- Modify: `apps/web/src/components/blog/related-posts-grid.tsx`

- [ ] **Step 1: Increase related posts limit to 6**

In `apps/web/lib/blog/related-posts.ts`, change the default limit parameter from 3 to 6:

```typescript
export async function getRelatedPosts(
  siteId: string,
  locale: string,
  postId: string,
  category: string | null,
  limit = 6,  // was 3
): Promise<RelatedPost[]> {
```

- [ ] **Step 2: Add client-side unread-first filtering to RelatedPostsGrid**

In `apps/web/src/components/blog/related-posts-grid.tsx`, add a client wrapper that:
1. Reads localStorage for read progress
2. Separates posts into unread vs read
3. Takes first 3 (unread prioritized)
4. Wraps each card in `ReadableCard`

- [ ] **Step 3: Run tests**

```bash
npm run test:web
```
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/blog/related-posts.ts apps/web/src/components/blog/related-posts-grid.tsx
git commit -m "feat(tracking): related posts unread-first reordering + increase fetch limit to 6"
```

---

## Task 12: CMS blog analytics tab + dashboard integration

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/_tabs/analytics/analytics-tab.tsx`
- Modify: `apps/web/src/app/cms/(authed)/analytics/actions.ts`
- Modify: `apps/web/src/app/cms/(authed)/_components/dashboard-connected.tsx`
- Modify: `apps/web/src/app/cms/(authed)/blog/_i18n/types.ts`
- Modify: `apps/web/src/app/cms/(authed)/blog/_i18n/en.ts`
- Modify: `apps/web/src/app/cms/(authed)/blog/_i18n/pt-BR.ts`

- [ ] **Step 1: Add fetchContentAnalytics server action**

In `apps/web/src/app/cms/(authed)/analytics/actions.ts`:

Add a new function `fetchContentAnalytics` that queries `content_metrics` grouped by period and returns top posts with views/reads/depth/time/referrer data.

Replace `totalViews: 0` (line 158) with a real aggregate query:
```typescript
const { count: totalViewsCount } = await supabase
  .from('blog_posts')
  .select('view_count', { count: 'exact', head: false })
  .eq('site_id', siteId)
  .eq('status', 'published')

const totalViews = (totalViewsCount ?? []).reduce(
  (sum: number, row: { view_count: number }) => sum + row.view_count, 0
)
```

- [ ] **Step 2: Update i18n strings**

Add analytics strings for the new tab to `types.ts`, `en.ts`, and `pt-BR.ts`:
- `analytics.totalViews`, `analytics.readsComplete`, `analytics.avgDepth`, `analytics.avgTime`
- `analytics.topPosts`, `analytics.source`, `analytics.period7d`, etc.

- [ ] **Step 3: Replace AnalyticsTab placeholder**

Rewrite `analytics-tab.tsx` with:
- KPI strip (4 cards): Total Views, Reads Complete, Avg. Read Depth, Avg. Time
- Top Posts table with referrer bars
- Period selector (7d / 30d / 90d / All)
- Server action integration via `useEffect` + `useState`

- [ ] **Step 4: Wire real view_count into dashboard**

In `dashboard-connected.tsx`, replace the hardcoded `views: 3 - i` in the top content section with real `view_count` from blog_posts query.

- [ ] **Step 5: Run full test suite**

```bash
npm run test:web
```
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/
git commit -m "feat(tracking): replace analytics placeholder with real content analytics tab + dashboard views"
```

---

## Task 13: Integration tests (DB-gated)

**Files:**
- Create: `apps/web/test/integration/content-tracking.test.ts`

- [ ] **Step 1: Write DB-gated integration tests**

```typescript
// apps/web/test/integration/content-tracking.test.ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb, getLocalJwtSecret } from '../helpers/db-skip'

const SUPABASE_URL = 'http://127.0.0.1:54321'

describe.skipIf(skipIfNoLocalDb())('content_tracking RPCs', () => {
  const service = createClient(SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU')

  it('aggregate_content_events creates metrics rows', async () => {
    // Seed a site and blog post
    const { data: site } = await service.from('sites').select('id').limit(1).single()
    expect(site).not.toBeNull()

    // Insert test events
    const postId = crypto.randomUUID()
    await service.from('content_events').insert([
      {
        site_id: site!.id,
        session_id: crypto.randomUUID(),
        resource_type: 'blog',
        resource_id: postId,
        event_type: 'view',
        anonymous_id: 'test-anon-1',
        referrer_src: 'google',
        has_consent: false,
      },
      {
        site_id: site!.id,
        session_id: crypto.randomUUID(),
        resource_type: 'blog',
        resource_id: postId,
        event_type: 'read_complete',
        anonymous_id: 'test-anon-1',
        read_depth: 100,
        has_consent: false,
      },
    ])

    // Run aggregation for today
    const { data, error } = await service.rpc('aggregate_content_events', {
      p_date: new Date().toISOString().split('T')[0],
    })
    expect(error).toBeNull()
    expect(data.metrics_upserted).toBeGreaterThan(0)

    // Verify content_metrics row
    const { data: metrics } = await service
      .from('content_metrics')
      .select('*')
      .eq('resource_id', postId)
      .single()
    expect(metrics).not.toBeNull()
    expect(metrics!.views).toBe(1)
    expect(metrics!.reads_complete).toBe(1)

    // Cleanup
    await service.from('content_events').delete().eq('resource_id', postId)
    await service.from('content_metrics').delete().eq('resource_id', postId)
  })

  it('purge_content_events removes old events', async () => {
    const { data: site } = await service.from('sites').select('id').limit(1).single()

    await service.from('content_events').insert({
      site_id: site!.id,
      session_id: crypto.randomUUID(),
      resource_type: 'blog',
      resource_id: crypto.randomUUID(),
      event_type: 'view',
      anonymous_id: 'old-anon',
      has_consent: false,
      created_at: new Date(Date.now() - 100 * 86400000).toISOString(),
    })

    const { data, error } = await service.rpc('purge_content_events', {
      p_older_than_days: 90,
    })
    expect(error).toBeNull()
    expect(data.purged).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run integration tests (if local DB available)**

```bash
HAS_LOCAL_DB=1 npm run test:web -- --bail test/integration/content-tracking.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/integration/content-tracking.test.ts
git commit -m "test(tracking): add DB-gated integration tests for aggregate + purge RPCs"
```

---

## Task 14: Final wiring — remove mock engagement, run full suite

**Files:**
- Modify: `apps/web/src/components/blog/mock-data.ts`
- Modify: `apps/web/src/app/(public)/blog/[slug]/page.tsx`

- [ ] **Step 1: Remove MOCK_ENGAGEMENT usage**

In `page.tsx`, find where `MOCK_ENGAGEMENT` is used and either:
- Wire to real `view_count` from the loaded post data, or
- Remove the mock display if engagement stats (views/likes) aren't part of this feature's scope

Keep `AUTHOR_THIAGO` and `MOCK_COMMENTS` — those are separate features.

- [ ] **Step 2: Run full test suite**

```bash
npm test
```
Expected: ALL PASS (both api + web)

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(tracking): remove mock engagement, wire real view counts throughout"
```

---

## Dependency Graph

```
Task 1 (migrations) ──────────────────────────────────────┐
                                                           │
Task 2 (lib: types, config, referrer, bots) ──┐           │
                                               │           │
Task 3 (read-progress-store) ─────────────────┤           │
                                               ├── Task 6 (hook) ── Task 8 (wire into page)
Task 4 (API endpoint) ────────────────────────┘                           │
                                                                          ├── Task 9 (visual indicators)
Task 5 (crons) ── depends on Task 1                                       │
                                                                          ├── Task 10 (MostReadSidebar query)
Task 7 (ReadableCard) ── depends on Task 3 ───────────────────────────────┤
                                                                          ├── Task 11 (related posts)
                                                                          │
Task 12 (CMS analytics) ── depends on Task 1 ────────────────────────────┘
                                                                          │
Task 13 (integration tests) ── depends on Task 1 ────────────────────────┤
                                                                          │
Task 14 (final wiring) ── depends on all ─────────────────────────────────┘
```

**Parallelizable groups:**
- **Group A:** Tasks 2, 3, 4, 7 (can run in parallel — independent libs)
- **Group B:** Tasks 5, 12 (depend only on Task 1)
- **Group C:** Tasks 6, 8, 9, 10, 11 (depend on Group A)
- **Group D:** Tasks 13, 14 (depend on everything)
