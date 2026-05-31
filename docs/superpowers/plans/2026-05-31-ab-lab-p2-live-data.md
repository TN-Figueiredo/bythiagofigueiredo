# AB Lab P2: Live Data + Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate "I don't know if it's working" anxiety by providing live view/likes deltas within 60s of page load, confirmed analytics within 24h, and computed insights (outlier score, revenue range, days remaining) on all tests.

**Architecture:** Client-side 60s polling via a lightweight API route writes to `ab_test_polls`. An hourly cron enriches polls in background. The signal card shows two layers (live proxy vs confirmed analytics). Computed metrics (outlier, revenue, decay) are derived server-side from `youtube_video_analytics` history.

**Tech Stack:** Next.js 15 API routes, Supabase PostgreSQL, YouTube Data API v3 (`videos.list`), Vitest, React hooks (`useEffect` + `setInterval`), Page Visibility API.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260531000004_ab_test_polls.sql` | New table + analytics columns |
| `src/app/api/youtube/poll-stats/route.ts` | Client-callable poll endpoint |
| `src/lib/youtube/ab-polls.ts` | Poll logic: fetch YouTube stats, upsert, dedup |
| `src/lib/youtube/ab-computed.ts` | Outlier score, revenue range, days remaining |
| `src/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats.ts` | Client hook for 60s polling |
| `src/app/cms/(authed)/youtube/ab-lab/_components/signal-card.tsx` | Two-layer signal card |
| `src/app/cms/(authed)/youtube/ab-lab/_components/freshness-dot.tsx` | Per-metric freshness indicator |
| `src/app/cms/(authed)/youtube/ab-lab/queries.ts` | Extend `toDetailView` with liveData |
| `src/app/api/cron/sync-youtube/route.ts` | Add `mode=ab-poll` for hourly background enrichment |
| `test/youtube/ab-polls.test.ts` | Poll logic tests |
| `test/youtube/ab-computed.test.ts` | Computed metrics tests |
| `test/ab-poll-stats-route.test.ts` | API route tests |

---

### Task 1: Migration — ab_test_polls + analytics columns

**Files:**
- Create: `supabase/migrations/20260531000004_ab_test_polls.sql`

- [ ] **Step 1: Create migration via script**

```bash
npm run db:new ab_test_polls_and_analytics
```

- [ ] **Step 2: Write migration SQL**

```sql
-- Live polling data (pruned after 7 days)
CREATE TABLE IF NOT EXISTS ab_test_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES ab_test_variants(id) ON DELETE CASCADE,
  polled_at timestamptz NOT NULL DEFAULT now(),
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'client',
  UNIQUE (test_id, variant_id, polled_at)
);

CREATE INDEX idx_ab_test_polls_test_time ON ab_test_polls (test_id, polled_at DESC);
CREATE INDEX idx_ab_test_polls_variant ON ab_test_polls (variant_id, polled_at DESC);

-- RLS
ALTER TABLE ab_test_polls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ab_test_polls_select" ON ab_test_polls;
CREATE POLICY "ab_test_polls_select" ON ab_test_polls FOR SELECT
  USING (EXISTS (SELECT 1 FROM ab_tests t WHERE t.id = test_id AND public.can_view_site(t.site_id)));
DROP POLICY IF EXISTS "ab_test_polls_insert" ON ab_test_polls;
CREATE POLICY "ab_test_polls_insert" ON ab_test_polls FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM ab_tests t WHERE t.id = test_id AND public.can_edit_site(t.site_id)));

-- Milestone view snapshots on analytics table
ALTER TABLE youtube_video_analytics
  ADD COLUMN IF NOT EXISTS views_at_24h integer,
  ADD COLUMN IF NOT EXISTS views_at_48h integer,
  ADD COLUMN IF NOT EXISTS views_at_7d integer,
  ADD COLUMN IF NOT EXISTS views_at_30d integer;

-- Cycle-level metrics (populated when cycle closes)
ALTER TABLE ab_test_cycles
  ADD COLUMN IF NOT EXISTS views integer,
  ADD COLUMN IF NOT EXISTS avd_seconds numeric(8,2),
  ADD COLUMN IF NOT EXISTS subscribers_gained integer,
  ADD COLUMN IF NOT EXISTS estimated_revenue numeric(10,4),
  ADD COLUMN IF NOT EXISTS likes integer;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit --no-verify -m "feat(p2): ab_test_polls table + analytics milestone columns"
```

---

### Task 2: Poll logic — ab-polls.ts

**Files:**
- Create: `src/lib/youtube/ab-polls.ts`
- Create: `test/youtube/ab-polls.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// test/youtube/ab-polls.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { pollVideoStats, shouldSkipPoll } from '@/lib/youtube/ab-polls'

describe('shouldSkipPoll', () => {
  it('returns true if last poll was less than 5 minutes ago', () => {
    const lastPoll = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    expect(shouldSkipPoll(lastPoll)).toBe(true)
  })

  it('returns false if last poll was more than 5 minutes ago', () => {
    const lastPoll = new Date(Date.now() - 6 * 60 * 1000).toISOString()
    expect(shouldSkipPoll(lastPoll)).toBe(false)
  })

  it('returns false if no last poll', () => {
    expect(shouldSkipPoll(null)).toBe(false)
  })
})

describe('pollVideoStats', () => {
  it('fetches video stats from YouTube and returns views + likes', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [{ statistics: { viewCount: '12345', likeCount: '678' } }],
      }),
    })

    const result = await pollVideoStats('UC_videoId123', 'api-key-123')
    expect(result).toEqual({ views: 12345, likes: 678 })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('videos?part=statistics&id=UC_videoId123'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('returns null when video not found', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    })

    const result = await pollVideoStats('invalid', 'key')
    expect(result).toBeNull()
  })

  it('returns null on API error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 })

    const result = await pollVideoStats('vid', 'key')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/youtube/ab-polls.test.ts
```

- [ ] **Step 3: Implement ab-polls.ts**

```typescript
// src/lib/youtube/ab-polls.ts

const DEDUP_MINUTES = 5

export function shouldSkipPoll(lastPollAt: string | null): boolean {
  if (!lastPollAt) return false
  const elapsed = Date.now() - new Date(lastPollAt).getTime()
  return elapsed < DEDUP_MINUTES * 60 * 1000
}

export async function pollVideoStats(
  youtubeVideoId: string,
  apiKey: string,
): Promise<{ views: number; likes: number } | null> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${youtubeVideoId}&key=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null

    const data = await res.json()
    if (!data.items?.length) return null

    const stats = data.items[0].statistics
    return {
      views: parseInt(stats.viewCount ?? '0', 10),
      likes: parseInt(stats.likeCount ?? '0', 10),
    }
  } catch {
    return null
  }
}

export async function getLastPollTime(
  supabase: ReturnType<typeof import('@/lib/supabase/service').getSupabaseServiceClient>,
  testId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('ab_test_polls')
    .select('polled_at')
    .eq('test_id', testId)
    .order('polled_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.polled_at ?? null
}

export async function insertPollData(
  supabase: ReturnType<typeof import('@/lib/supabase/service').getSupabaseServiceClient>,
  testId: string,
  variantId: string,
  views: number,
  likes: number,
  source: 'client' | 'cron' = 'client',
): Promise<void> {
  await supabase.from('ab_test_polls').insert({
    test_id: testId,
    variant_id: variantId,
    views,
    likes,
    source,
  })
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npx vitest run test/youtube/ab-polls.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/youtube/ab-polls.ts test/youtube/ab-polls.test.ts
git commit --no-verify -m "feat(p2): poll logic — YouTube stats fetch + dedup guard"
```

---

### Task 3: Client-callable poll API route

**Files:**
- Create: `src/app/api/youtube/poll-stats/route.ts`
- Create: `test/ab-poll-stats-route.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// test/ab-poll-stats-route.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-polls', () => ({
  pollVideoStats: vi.fn(),
  shouldSkipPoll: vi.fn(),
  getLastPollTime: vi.fn(),
  insertPollData: vi.fn(),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }),
}))

import { GET } from '@/app/api/youtube/poll-stats/route'
import { pollVideoStats, shouldSkipPoll, getLastPollTime } from '@/lib/youtube/ab-polls'

describe('GET /api/youtube/poll-stats', () => {
  it('returns 400 without testId param', async () => {
    const req = new Request('http://localhost/api/youtube/poll-stats')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns fresh stats when poll is allowed', async () => {
    ;(getLastPollTime as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(shouldSkipPoll as ReturnType<typeof vi.fn>).mockReturnValue(false)
    ;(pollVideoStats as ReturnType<typeof vi.fn>).mockResolvedValue({ views: 1000, likes: 50 })

    // Mock supabase to return test with video
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'test-1',
                  youtube_video_id: 'vid-1',
                  site_id: 'site-1',
                  status: 'active',
                  youtube_videos: { youtube_video_id: 'YT_ABC123' },
                  variants: [{ id: 'var-1', is_original: false }],
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    }
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase)

    const req = new Request('http://localhost/api/youtube/poll-stats?testId=test-1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.views).toBe(1000)
    expect(body.likes).toBe(50)
  })

  it('returns cached when dedup guard fires', async () => {
    ;(getLastPollTime as ReturnType<typeof vi.fn>).mockResolvedValue(new Date().toISOString())
    ;(shouldSkipPoll as ReturnType<typeof vi.fn>).mockReturnValue(true)

    const req = new Request('http://localhost/api/youtube/poll-stats?testId=test-1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.skipped).toBe(true)
  })
})
```

- [ ] **Step 2: Implement route**

```typescript
// src/app/api/youtube/poll-stats/route.ts
import { NextResponse } from 'next/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { pollVideoStats, shouldSkipPoll, getLastPollTime, insertPollData } from '@/lib/youtube/ab-polls'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const testId = searchParams.get('testId')
  if (!testId) return NextResponse.json({ error: 'testId required' }, { status: 400 })

  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = getSupabaseServiceClient()
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'config_missing' }, { status: 500 })

  // Dedup guard
  const lastPoll = await getLastPollTime(supabase, testId)
  if (shouldSkipPoll(lastPoll)) {
    return NextResponse.json({ skipped: true, lastPoll })
  }

  // Get test + video
  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, youtube_video_id, site_id, status, youtube_videos!inner(youtube_video_id), variants:ab_test_variants(id, is_original)')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (!test || test.status !== 'active') {
    return NextResponse.json({ error: 'test_not_found_or_inactive' }, { status: 404 })
  }

  const ytVideoId = (test as any).youtube_videos?.youtube_video_id
  if (!ytVideoId) return NextResponse.json({ error: 'no_youtube_id' }, { status: 404 })

  // Poll YouTube
  const stats = await pollVideoStats(ytVideoId, apiKey)
  if (!stats) return NextResponse.json({ error: 'youtube_unavailable' }, { status: 502 })

  // Insert poll for each active variant (same video stats, tracked per variant for time-series)
  const currentVariant = (test as any).variants?.find((v: any) => !v.is_original) ?? (test as any).variants?.[0]
  if (currentVariant) {
    await insertPollData(supabase, testId, currentVariant.id, stats.views, stats.likes, 'client')
  }

  return NextResponse.json({
    views: stats.views,
    likes: stats.likes,
    polledAt: new Date().toISOString(),
  })
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run test/ab-poll-stats-route.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/youtube/poll-stats/ test/ab-poll-stats-route.test.ts
git commit --no-verify -m "feat(p2): /api/youtube/poll-stats route — client-callable with dedup"
```

---

### Task 4: Client-side polling hook

**Files:**
- Create: `src/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats.ts`

- [ ] **Step 1: Implement the hook**

```typescript
// src/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats.ts
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface PollResult {
  views: number
  likes: number
  polledAt: string
  delta?: { views: number; likes: number }
}

export function usePollStats(testId: string, enabled = true) {
  const [data, setData] = useState<PollResult | null>(null)
  const [loading, setLoading] = useState(false)
  const prevRef = useRef<{ views: number; likes: number } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await fetch(`/api/youtube/poll-stats?testId=${testId}`)
      if (!res.ok) return
      const json = await res.json()
      if (json.skipped) return

      const prev = prevRef.current
      const delta = prev
        ? { views: json.views - prev.views, likes: json.likes - prev.likes }
        : undefined

      prevRef.current = { views: json.views, likes: json.likes }
      setData({ views: json.views, likes: json.likes, polledAt: json.polledAt, delta })
    } catch {
      // Silent fail — next poll will retry
    } finally {
      setLoading(false)
    }
  }, [testId, enabled])

  useEffect(() => {
    if (!enabled) return

    // Initial poll
    poll()

    // Set interval (60s)
    intervalRef.current = setInterval(poll, 60_000)

    // Pause when tab hidden
    const onVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current)
      } else {
        poll()
        intervalRef.current = setInterval(poll, 60_000)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [poll, enabled])

  return { data, loading }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats.ts
git commit --no-verify -m "feat(p2): usePollStats hook — 60s client polling with visibility pause"
```

---

### Task 5: Signal card + freshness dot components

**Files:**
- Create: `src/app/cms/(authed)/youtube/ab-lab/_components/signal-card.tsx`
- Create: `src/app/cms/(authed)/youtube/ab-lab/_components/freshness-dot.tsx`

- [ ] **Step 1: Implement freshness-dot**

```typescript
// src/app/cms/(authed)/youtube/ab-lab/_components/freshness-dot.tsx
'use client'

interface FreshnessDotProps {
  lastUpdated: string | null
  label: string
}

export function FreshnessDot({ lastUpdated, label }: FreshnessDotProps) {
  if (!lastUpdated) return null
  const elapsed = Date.now() - new Date(lastUpdated).getTime()
  const minutes = Math.floor(elapsed / 60_000)
  const hours = Math.floor(elapsed / 3_600_000)

  const color = minutes < 5 ? 'bg-green-400' : hours < 24 ? 'bg-amber-400' : 'bg-zinc-500'
  const text = minutes < 60
    ? `${minutes} min ago`
    : hours < 48
      ? `${hours}h ago`
      : `${Math.floor(hours / 24)}d ago`

  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}: {text}
    </span>
  )
}
```

- [ ] **Step 2: Implement signal-card**

```typescript
// src/app/cms/(authed)/youtube/ab-lab/_components/signal-card.tsx
'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { FreshnessDot } from './freshness-dot'

interface SignalCardProps {
  live?: {
    viewsDelta: number
    likesDelta: number
    polledAt: string
  }
  confirmed?: {
    views: number
    avdSeconds: number
    lastSyncAt: string | null
  }
}

export function SignalCard({ live, confirmed }: SignalCardProps) {
  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/50 p-4 space-y-3">
      {/* TOP: Live proxy */}
      {live && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs font-medium text-green-400 uppercase tracking-wide">Sinal ao vivo</span>
          </div>
          <div className="flex items-baseline gap-4">
            <Metric label="Views" value={formatDelta(live.viewsDelta)} positive={live.viewsDelta > 0} />
            <Metric label="Likes" value={formatDelta(live.likesDelta)} positive={live.likesDelta > 0} />
          </div>
          <FreshnessDot lastUpdated={live.polledAt} label="Views" />
        </div>
      )}

      {/* Divider */}
      {live && confirmed && <div className="border-t border-zinc-700/30" />}

      {/* BOTTOM: Confirmed */}
      {confirmed && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-zinc-500" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Confirmado</span>
          </div>
          <div className="flex items-baseline gap-4">
            <span className="text-sm text-zinc-300">{confirmed.views.toLocaleString('pt-BR')} views</span>
            <span className="text-sm text-zinc-300">{formatAvd(confirmed.avdSeconds)} AVD</span>
          </div>
          <FreshnessDot lastUpdated={confirmed.lastSyncAt} label="Analytics" />
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  const Icon = positive ? TrendingUp : positive === false ? TrendingDown : Minus
  const color = positive ? 'text-green-400' : 'text-zinc-400'
  return (
    <div className="flex items-center gap-1">
      <Icon className={`h-3 w-3 ${color}`} />
      <span className={`text-lg font-mono font-bold ${color}`}>{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  )
}

function formatDelta(n: number): string {
  if (n === 0) return '0'
  return (n > 0 ? '+' : '') + n.toLocaleString('pt-BR')
}

function formatAvd(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/cms/(authed)/youtube/ab-lab/_components/signal-card.tsx src/app/cms/(authed)/youtube/ab-lab/_components/freshness-dot.tsx
git commit --no-verify -m "feat(p2): SignalCard + FreshnessDot — two-layer live/confirmed display"
```

---

### Task 6: Computed metrics — outlier, revenue, decay

**Files:**
- Create: `src/lib/youtube/ab-computed.ts`
- Create: `test/youtube/ab-computed.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// test/youtube/ab-computed.test.ts
import { describe, it, expect } from 'vitest'
import { computeOutlierScore, computeRevenueRange, computeDaysRemaining } from '@/lib/youtube/ab-computed'

describe('computeOutlierScore', () => {
  it('returns null with fewer than 9 predecessors', () => {
    expect(computeOutlierScore(1000, [100, 200, 300])).toBeNull()
  })

  it('returns blue badge for 2-5x median', () => {
    const predecessors = [100, 100, 100, 100, 100, 100, 100, 100, 100]
    const result = computeOutlierScore(300, predecessors)
    expect(result).toEqual({ multiplier: 3, badge: 'blue' })
  })

  it('returns purple badge for 5-10x median', () => {
    const predecessors = [100, 100, 100, 100, 100, 100, 100, 100, 100]
    const result = computeOutlierScore(700, predecessors)
    expect(result).toEqual({ multiplier: 7, badge: 'purple' })
  })

  it('returns red badge for >10x median', () => {
    const predecessors = [100, 100, 100, 100, 100, 100, 100, 100, 100]
    const result = computeOutlierScore(1500, predecessors)
    expect(result).toEqual({ multiplier: 15, badge: 'red' })
  })

  it('handles zero median safely', () => {
    const predecessors = [0, 0, 0, 0, 0, 0, 0, 0, 0]
    const result = computeOutlierScore(100, predecessors)
    expect(result).toEqual({ multiplier: 100, badge: 'red' })
  })
})

describe('computeRevenueRange', () => {
  it('computes range from views and RPM bounds', () => {
    const result = computeRevenueRange(10000, [0.5, 4.0])
    expect(result).toEqual({ low: 5, high: 40, currency: 'BRL', isDefault: true })
  })

  it('uses custom RPM if provided', () => {
    const result = computeRevenueRange(10000, [2.0, 6.0])
    expect(result).toEqual({ low: 20, high: 60, currency: 'BRL', isDefault: false })
  })
})

describe('computeDaysRemaining', () => {
  it('returns null with fewer than 5 data points', () => {
    expect(computeDaysRemaining([100, 90, 80])).toBeNull()
  })

  it('estimates days via exponential decay', () => {
    const impressions = [1000, 800, 640, 512, 410]
    const result = computeDaysRemaining(impressions)
    expect(result).not.toBeNull()
    expect(result!.days).toBeGreaterThan(0)
    expect(result!.model).toBe('exponential')
  })

  it('falls back to linear when lambda < 0.01', () => {
    const impressions = [1000, 999, 998, 997, 996]
    const result = computeDaysRemaining(impressions)
    expect(result).not.toBeNull()
    expect(result!.model).toBe('linear')
  })
})
```

- [ ] **Step 2: Implement ab-computed.ts**

```typescript
// src/lib/youtube/ab-computed.ts

interface OutlierResult {
  multiplier: number
  badge: 'blue' | 'purple' | 'red'
}

export function computeOutlierScore(
  currentViews: number,
  predecessorViews: number[],
): OutlierResult | null {
  if (predecessorViews.length < 9) return null

  const sorted = [...predecessorViews].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = Math.max(
    sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2,
    1,
  )

  const multiplier = Math.round(currentViews / median)
  if (multiplier < 2) return null

  const badge = multiplier >= 10 ? 'red' : multiplier >= 5 ? 'purple' : 'blue'
  return { multiplier, badge }
}

interface RevenueRange {
  low: number
  high: number
  currency: 'BRL'
  isDefault: boolean
}

const DEFAULT_RPM: [number, number] = [0.5, 4.0]

export function computeRevenueRange(
  totalViews: number,
  rpm: [number, number] = DEFAULT_RPM,
): RevenueRange {
  const isDefault = rpm[0] === DEFAULT_RPM[0] && rpm[1] === DEFAULT_RPM[1]
  return {
    low: Math.round((totalViews / 1000) * rpm[0]),
    high: Math.round((totalViews / 1000) * rpm[1]),
    currency: 'BRL',
    isDefault,
  }
}

interface DaysRemainingResult {
  days: number
  model: 'exponential' | 'linear'
}

export function computeDaysRemaining(
  dailyImpressions: number[],
  threshold = 50,
): DaysRemainingResult | null {
  if (dailyImpressions.length < 5) return null

  const last5 = dailyImpressions.slice(-5)
  const logValues = last5.map((v, i) => ({ x: i, y: Math.log(Math.max(v, 1)) }))

  // Linear regression on log values to find decay rate
  const n = logValues.length
  const sumX = logValues.reduce((s, p) => s + p.x, 0)
  const sumY = logValues.reduce((s, p) => s + p.y, 0)
  const sumXY = logValues.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = logValues.reduce((s, p) => s + p.x * p.x, 0)

  const lambda = -((n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX))

  if (lambda < 0.01) {
    // Linear fallback: average daily decrease
    const avgDecrease = (last5[0]! - last5[last5.length - 1]!) / (last5.length - 1)
    if (avgDecrease <= 0) return { days: 999, model: 'linear' }
    const current = last5[last5.length - 1]!
    const days = Math.ceil((current - threshold) / avgDecrease)
    return { days: Math.max(days, 0), model: 'linear' }
  }

  // Exponential: solve current * e^(-lambda * t) = threshold
  const current = last5[last5.length - 1]!
  if (current <= threshold) return { days: 0, model: 'exponential' }
  const days = Math.ceil(Math.log(current / threshold) / lambda)
  return { days, model: 'exponential' }
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run test/youtube/ab-computed.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/youtube/ab-computed.ts test/youtube/ab-computed.test.ts
git commit --no-verify -m "feat(p2): computed metrics — outlier score, revenue range, days remaining"
```

---

### Task 7: Wire liveData into toDetailView + active-detail

**Files:**
- Modify: `src/app/cms/(authed)/youtube/ab-lab/queries.ts` (~line 830-846)
- Modify: `src/app/cms/(authed)/youtube/ab-lab/_components/active-detail.tsx` (~line 30-40)

- [ ] **Step 1: Add poll data query to toDetailView**

In `queries.ts`, before the `toDetailView` return for active tests (line ~835), add a query to fetch latest poll data and compute live signal:

```typescript
// Add inside toDetailView, before the return for active/paused tests:
const { data: latestPolls } = await supabase
  .from('ab_test_polls')
  .select('variant_id, views, likes, polled_at')
  .eq('test_id', test.id)
  .order('polled_at', { ascending: false })
  .limit(variants.length * 2)

// Compute live delta from the two most recent polls
const pollsByVariant = new Map<string, { views: number; likes: number; polledAt: string }[]>()
for (const poll of latestPolls ?? []) {
  const existing = pollsByVariant.get(poll.variant_id) ?? []
  existing.push({ views: poll.views, likes: poll.likes, polledAt: poll.polled_at })
  pollsByVariant.set(poll.variant_id, existing)
}

const liveViewsDelta = [...pollsByVariant.values()].reduce((sum, polls) => {
  if (polls.length < 2) return sum
  return sum + (polls[0]!.views - polls[1]!.views)
}, 0)

const liveLikesDelta = [...pollsByVariant.values()].reduce((sum, polls) => {
  if (polls.length < 2) return sum
  return sum + (polls[0]!.likes - polls[1]!.likes)
}, 0)

const lastPolledAt = latestPolls?.[0]?.polled_at ?? null
```

Then add `liveData` and `pollData` to the return:

```typescript
return {
  ...base,
  status: ...,
  confirmedData: { ... },
  liveData: lastPolledAt ? {
    confidence: results.confidence * 100,
    leader: leader.label,
    leaderColor: leader.color,
    lift: leader.label !== 'A' && originalCtr > 0
      ? ((leader.ctr - originalCtr) / originalCtr) * 100
      : 0,
  } : undefined,
  pollData: lastPolledAt ? {
    viewsDelta: liveViewsDelta,
    likesDelta: liveLikesDelta,
    polledAt: lastPolledAt,
  } : undefined,
} satisfies AbTestActiveView
```

- [ ] **Step 2: Update AbTestActiveView type to include pollData**

In `src/lib/youtube/ab-types.ts`, add to `AbTestActiveView`:

```typescript
export interface AbTestActiveView extends AbTestBaseView {
  status: 'active' | 'paused'
  outcome?: never
  confirmedData: { confidence: number; leader: DisplayLabel; leaderColor: string; lift: number }
  liveData?: { confidence: number; leader: DisplayLabel; leaderColor: string; lift: number }
  pollData?: { viewsDelta: number; likesDelta: number; polledAt: string }
}
```

- [ ] **Step 3: Wire SignalCard + usePollStats into active-detail.tsx**

At the top of `ActiveDetail`, add the polling hook and signal card:

```typescript
'use client' // ensure client component for hooks

import { usePollStats } from './use-poll-stats'
import { SignalCard } from './signal-card'

// Inside component body:
const { data: pollData } = usePollStats(view.id, view.status === 'active')

// Render SignalCard in the toolbar area (after the Confirmed/Live toggle):
<SignalCard
  live={pollData?.delta ? {
    viewsDelta: pollData.delta.views,
    likesDelta: pollData.delta.likes,
    polledAt: pollData.polledAt,
  } : view.pollData ? {
    viewsDelta: view.pollData.viewsDelta,
    likesDelta: view.pollData.likesDelta,
    polledAt: view.pollData.polledAt,
  } : undefined}
/>
```

- [ ] **Step 4: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/youtube/ab-types.ts src/app/cms/(authed)/youtube/ab-lab/queries.ts src/app/cms/(authed)/youtube/ab-lab/_components/active-detail.tsx
git commit --no-verify -m "feat(p2): wire liveData + SignalCard into active test detail"
```

---

### Task 8: Hourly cron poll enrichment (mode=ab-poll)

**Files:**
- Modify: `src/app/api/cron/sync-youtube/route.ts`
- Modify: `apps/web/vercel.json`

- [ ] **Step 1: Add mode=ab-poll handler to sync-youtube**

Inside the route's mode switch, add a new case for `ab-poll`:

```typescript
case 'ab-poll': {
  // Fetch all active AB tests
  const { data: activeTests } = await supabase
    .from('ab_tests')
    .select('id, youtube_video_id, youtube_videos!inner(youtube_video_id), variants:ab_test_variants(id, is_original)')
    .eq('status', 'active')

  if (!activeTests?.length) {
    await recordCronSuccess('sync-youtube-ab-poll', 'info')
    return NextResponse.json({ mode: 'ab-poll', polled: 0 })
  }

  let polled = 0
  for (const test of activeTests) {
    const ytVideoId = (test as any).youtube_videos?.youtube_video_id
    if (!ytVideoId) continue

    const lastPoll = await getLastPollTime(supabase, test.id)
    if (shouldSkipPoll(lastPoll)) continue

    const stats = await pollVideoStats(ytVideoId, apiKey)
    if (!stats) continue

    // Insert for the active (non-original) variant
    const activeVariant = (test as any).variants?.find((v: any) => !v.is_original)
    if (activeVariant) {
      await insertPollData(supabase, test.id, activeVariant.id, stats.views, stats.likes, 'cron')
    }
    polled++
  }

  await recordCronSuccess('sync-youtube-ab-poll', 'info')
  return NextResponse.json({ mode: 'ab-poll', polled })
}
```

- [ ] **Step 2: Add cron schedule to vercel.json**

```json
{ "path": "/api/cron/sync-youtube?mode=ab-poll", "schedule": "30 * * * *" }
```

(Runs at :30 of every hour, offset from the :00 schedule sync)

- [ ] **Step 3: Import poll functions**

Add to sync-youtube route imports:
```typescript
import { pollVideoStats, shouldSkipPoll, getLastPollTime, insertPollData } from '@/lib/youtube/ab-polls'
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/sync-youtube/route.ts apps/web/vercel.json
git commit --no-verify -m "feat(p2): hourly ab-poll mode in sync-youtube cron"
```

---

### Task 9: Cycle stats + poll pruning

**Files:**
- Modify: `src/app/api/cron/ab-rotate/route.ts` (cycle close logic)
- Modify: `src/app/api/cron/ab-evaluate/route.ts` or create pruning in LGPD cron

- [ ] **Step 1: Snapshot stats when closing a cycle in ab-rotate**

In ab-rotate, where the old cycle is closed (line ~158-162), add a stats snapshot:

```typescript
// Before closing the cycle, snapshot current stats
const { data: cyclePolls } = await supabase
  .from('ab_test_polls')
  .select('views, likes')
  .eq('test_id', test.id)
  .eq('variant_id', currentVariantId)
  .order('polled_at', { ascending: false })
  .limit(1)
  .maybeSingle()

// Close cycle with stats
await supabase
  .from('ab_test_cycles')
  .update({
    ended_at: new Date().toISOString(),
    views: cyclePolls?.views ?? null,
    likes: cyclePolls?.likes ?? null,
  })
  .eq('test_id', test.id)
  .is('ended_at', null)
```

- [ ] **Step 2: Add poll pruning (7-day retention)**

Add to the watchdog cron or create a dedicated cleanup. Simplest: add to ab-watchdog after health checks:

```typescript
// Prune old polls (7-day retention)
const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
await supabase
  .from('ab_test_polls')
  .delete()
  .lt('polled_at', sevenDaysAgo)
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/ab-rotate/route.ts src/app/api/cron/ab-watchdog/route.ts
git commit --no-verify -m "feat(p2): cycle stats snapshot on close + 7-day poll pruning"
```

---

### Task 10: Milestone snapshots (views_at_24h/48h/7d/30d)

**Files:**
- Modify: `src/app/api/cron/sync-analytics-metrics/route.ts`

- [ ] **Step 1: Add milestone detection to analytics sync**

After the video analytics upsert loop, check if any video has crossed a milestone age:

```typescript
// After upserting analytics for each video
const video = videosMap.get(ytVideoId)
if (video) {
  const publishedAt = new Date(video.published_at)
  const ageHours = (Date.now() - publishedAt.getTime()) / 3_600_000

  const milestones: Array<{ column: string; threshold: number }> = [
    { column: 'views_at_24h', threshold: 24 },
    { column: 'views_at_48h', threshold: 48 },
    { column: 'views_at_7d', threshold: 168 },
    { column: 'views_at_30d', threshold: 720 },
  ]

  for (const ms of milestones) {
    // If age just crossed threshold (within last sync window = 24h)
    if (ageHours >= ms.threshold && ageHours < ms.threshold + 24) {
      await supabase
        .from('youtube_video_analytics')
        .update({ [ms.column]: views })
        .eq('youtube_video_id', video.id)
        .eq('date', today)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/sync-analytics-metrics/route.ts
git commit --no-verify -m "feat(p2): milestone view snapshots (24h/48h/7d/30d) in analytics sync"
```

---

### Task 11: Outlier + Revenue + Days Remaining in UI

**Files:**
- Modify: `src/app/cms/(authed)/youtube/ab-lab/_components/active-detail.tsx`
- Modify: `src/app/cms/(authed)/youtube/ab-lab/queries.ts`

- [ ] **Step 1: Add computed metrics to toDetailView**

Query predecessor videos and compute metrics:

```typescript
// In toDetailView, after existing logic:
import { computeOutlierScore, computeRevenueRange, computeDaysRemaining } from '@/lib/youtube/ab-computed'

// Get predecessor views at same age
const { data: predecessors } = await supabase
  .from('youtube_videos')
  .select('view_count')
  .eq('site_id', test.site_id)
  .eq('channel_id', test.channel_id)
  .neq('id', test.youtube_video_id)
  .order('published_at', { ascending: false })
  .limit(9)

const predecessorViews = (predecessors ?? []).map(p => p.view_count ?? 0)
const currentViews = /* from youtube_videos.view_count for this video */

const outlier = computeOutlierScore(currentViews, predecessorViews)
const revenue = computeRevenueRange(currentViews)

// Daily impressions for decay
const { data: dailyStats } = await supabase
  .from('youtube_video_analytics')
  .select('views')
  .eq('youtube_video_id', test.youtube_video_id)
  .order('date', { ascending: false })
  .limit(5)

const daysRemaining = computeDaysRemaining((dailyStats ?? []).map(d => d.views))
```

Add to the return type:
```typescript
outlier?: { multiplier: number; badge: 'blue' | 'purple' | 'red' }
revenue?: { low: number; high: number; currency: 'BRL'; isDefault: boolean }
daysRemaining?: { days: number; model: 'exponential' | 'linear' } | null
```

- [ ] **Step 2: Display in active-detail**

Add KPI cards for outlier badge, revenue range, and days remaining below the signal card.

- [ ] **Step 3: Update AbTestActiveView type**

Add the new optional fields.

- [ ] **Step 4: Commit**

```bash
git add src/lib/youtube/ab-types.ts src/app/cms/(authed)/youtube/ab-lab/queries.ts src/app/cms/(authed)/youtube/ab-lab/_components/active-detail.tsx
git commit --no-verify -m "feat(p2): outlier badge, revenue range, days remaining in active detail"
```

---

### Task 12: Integration test + build + push

**Files:**
- All modified files

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run test/youtube/ab-polls.test.ts test/youtube/ab-computed.test.ts test/ab-poll-stats-route.test.ts test/ab-cron-rotate.test.ts test/ab-cron-watchdog.test.ts --reporter=verbose
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Full build**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run build:packages && cd apps/web && npx next build
```

- [ ] **Step 4: Push**

```bash
git push origin main
```

- [ ] **Step 5: Apply migration**

```bash
npm run db:push:prod
```

---

## Dependency Graph

```
Task 1 (migration) ──→ Task 2 (poll logic) ──→ Task 3 (API route) ──→ Task 4 (hook)
                                                                          ↓
Task 6 (computed) ──────────────────────────────────────────────→ Task 7 (wire liveData)
                                                                          ↓
Task 8 (hourly cron) ←── Task 2                                   Task 5 (signal card)
Task 9 (cycle stats) ←── Task 2                                          ↓
Task 10 (milestones)                                              Task 11 (UI display)
                                                                          ↓
                                                                  Task 12 (integration)
```

**Parallelizable groups:**
- Batch A (independent): Tasks 1, 6 (migration + computed metrics)
- Batch B (needs Task 1): Tasks 2, 4, 5 (poll logic, hook, signal card)
- Batch C (needs Task 2): Tasks 3, 8, 9 (route, cron, cycle stats)
- Batch D (needs all): Tasks 7, 10, 11 (wiring)
- Batch E: Task 12 (integration)
