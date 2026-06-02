# Competitor Full Video Fetch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add paginated full-history sync for competitor YouTube channels with user-controlled per-channel mode, CAS lock, progress polling, and honest UI labels.

**Architecture:** New DB columns on `competitor_channels` track sync mode/status/progress. The existing `syncCompetitorChannel()` gains a paginated loop gated on `sync_mode='full'`. A new confirmation dialog triggers the full sync via server action; a polling hook shows real-time progress on the channel card.

**Tech Stack:** Supabase (PostgreSQL), Next.js 15 server actions, React 19, Vitest, YouTube Data API v3

---

## File Map

| # | File | Responsibility |
|---|------|---------------|
| 1 | `supabase/migrations/{ts}_add_competitor_full_sync_columns.sql` | **NEW** — 7 columns + 1 index |
| 2 | `apps/web/src/lib/youtube/competitor-sync.ts` | Paginated loop, CAS lock, progress update, smart incremental |
| 3 | `apps/web/src/lib/youtube/observatory-types.ts` | New fields on CompetitorChannelView |
| 4 | `apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts` | New: `syncFullHistory()`, `getSyncStatus()` |
| 5 | `apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx` | Query fix, new columns, maxDuration |
| 6 | `apps/web/src/app/cms/(authed)/youtube/competitors/_components/confirm-full-sync-dialog.tsx` | **NEW** — Confirmation dialog |
| 7 | `apps/web/src/app/cms/(authed)/youtube/competitors/_components/useFullSyncProgress.ts` | **NEW** — Polling hook |
| 8 | `apps/web/src/app/cms/(authed)/youtube/competitors/_components/channel-card.tsx` | Footer restructured, progress bar, honest labels |
| 9 | `apps/web/src/app/cms/(authed)/youtube/youtube-motion.css` | `.sync-bar`, `.sync-action` CSS |
| T1 | `apps/web/test/cms/competitors/competitor-sync.test.ts` | **NEW** — Sync logic tests |
| T2 | `apps/web/test/cms/competitors/competitor-actions.test.ts` | **NEW** — Server action tests |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/{ts}_add_competitor_full_sync_columns.sql`

- [ ] **Step 1: Generate migration file**

```bash
npm run db:new add_competitor_full_sync_columns
```

- [ ] **Step 2: Write migration SQL**

Open the generated file and write:

```sql
-- Full sync support: per-channel sync mode, concurrency guard, progress tracking
ALTER TABLE competitor_channels
  ADD COLUMN IF NOT EXISTS sync_mode text NOT NULL DEFAULT 'recent'
    CHECK (sync_mode IN ('recent', 'full')),
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'idle'
    CHECK (sync_status IN ('idle', 'syncing', 'error')),
  ADD COLUMN IF NOT EXISTS sync_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS full_sync_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS youtube_video_count integer;

-- Covers ORDER BY published_at DESC in page.tsx channel video queries
CREATE INDEX IF NOT EXISTS idx_competitor_videos_channel_published
  ON competitor_videos (competitor_channel_id, published_at DESC);
```

- [ ] **Step 3: Push migration to prod**

```bash
npm run db:push:prod
```

Expected: Migration applied successfully. Confirm with:

```bash
npm run db:which
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add competitor full sync columns + published_at index"
```

---

### Task 2: Types — Add Sync Fields to CompetitorChannelView

**Files:**
- Modify: `apps/web/src/lib/youtube/observatory-types.ts:9-30`

- [ ] **Step 1: Add sync fields to CompetitorChannelView**

In `apps/web/src/lib/youtube/observatory-types.ts`, add these fields after `changeFlags` (line 29):

```typescript
export interface CompetitorChannelView {
  id: string
  channelId: string
  channelName: string
  thumbnailUrl: string | null
  subscriberCount: number | null
  videoCount: number
  addedAt: string
  lastSyncedAt: string | null
  avgEngagement: number | null
  growthDelta: number | null
  growthSparkline: number[]
  recentVideos: CompetitorVideoView[]
  vsYou: VsYouEntry[] | null
  changeFlags: ChangeFlag[]
  // --- Full sync fields ---
  syncMode: 'recent' | 'full'
  syncStatus: 'idle' | 'syncing' | 'error'
  syncProgress: number
  syncError: string | null
  youtubeVideoCount: number | null
  fullSyncCompletedAt: string | null
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: Errors in `page.tsx` (missing new fields) and `channel-card.tsx` (doesn't use them yet). These are expected — we fix them in Tasks 5 and 8.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/youtube/observatory-types.ts
git commit -m "feat(types): add sync mode/status/progress fields to CompetitorChannelView"
```

---

### Task 3: Backend — Paginated Sync with CAS Lock

**Files:**
- Modify: `apps/web/src/lib/youtube/competitor-sync.ts`
- Create: `apps/web/test/cms/competitors/competitor-sync.test.ts`

- [ ] **Step 1: Write failing test for CAS lock**

Create `apps/web/test/cms/competitors/competitor-sync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We'll mock Supabase and fetch to test sync logic
const mockSupabase = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))

vi.mock('@/lib/notifications/create', () => ({
  createNotification: vi.fn(),
}))

// Helper: build a Supabase-compatible chain mock that resolves via await
function chainMock(data: unknown = [], error: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in',
    'single', 'maybeSingle', 'limit', 'order', 'gt', 'lt', 'lte', 'gte', 'or']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  // Make the chain awaitable — return Promise so `await supabase.from(...)...` resolves
  chain.then = vi.fn().mockImplementation(
    (resolve: (v: { data: unknown; error: unknown }) => void) =>
      Promise.resolve({ data, error }).then(resolve)
  )
  return chain
}

// Helper: mock fetch responses in sequence
function mockFetchSequence(responses: Array<{ ok: boolean; json: () => unknown }>) {
  let callIndex = 0
  return vi.fn().mockImplementation(() => {
    const res = responses[callIndex] ?? responses[responses.length - 1]
    callIndex++
    return Promise.resolve(res)
  })
}

describe('syncCompetitorChannel — CAS lock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('should skip sync when channel is already syncing (CAS returns 0 rows)', async () => {
    // CAS update returns empty array (no rows matched = lock not acquired)
    const casChain = chainMock([], null) // empty = locked by another process
    mockSupabase.from.mockReturnValue(casChain)

    const { syncCompetitorChannel } = await import('@/lib/youtube/competitor-sync')

    const result = await syncCompetitorChannel(
      { id: 'ch-1', channel_id: 'UC123', site_id: 'site-1' },
      'fake-api-key',
    )

    expect(result).toEqual({ videosChecked: 0, changesDetected: 0, skipped: true })
  })

  it('should acquire lock when sync_status is idle', async () => {
    // CAS returns the row (lock acquired)
    const casChain = chainMock([{ id: 'ch-1', sync_mode: 'recent', full_sync_completed_at: null }])
    mockSupabase.from.mockReturnValue(casChain)

    // Mock YouTube API responses: channel metadata + 1 playlist page (empty)
    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetchSequence([
      { ok: true, json: () => ({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU123' } }, snippet: { title: 'Test' }, statistics: { subscriberCount: '100', videoCount: '5', viewCount: '1000' } }] }) },
      { ok: true, json: () => ({ items: [] }) }, // empty playlist = no videos
    ])

    const { syncCompetitorChannel } = await import('@/lib/youtube/competitor-sync')
    const result = await syncCompetitorChannel(
      { id: 'ch-1', channel_id: 'UC123', site_id: 'site-1' },
      'fake-api-key',
    )

    expect(result.skipped).toBeUndefined()
    expect(result.videosChecked).toBe(0)
    globalThis.fetch = originalFetch
  })

  it('should recover stale lock after 10 minutes', async () => {
    // CAS .or() matches because sync_started_at is old — lock recovered
    const casChain = chainMock([{ id: 'ch-1', sync_mode: 'recent', full_sync_completed_at: null }])
    mockSupabase.from.mockReturnValue(casChain)

    globalThis.fetch = mockFetchSequence([
      { ok: true, json: () => ({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU123' } }, snippet: { title: 'Test' }, statistics: { subscriberCount: '100', videoCount: '5', viewCount: '1000' } }] }) },
      { ok: true, json: () => ({ items: [] }) },
    ])

    const { syncCompetitorChannel } = await import('@/lib/youtube/competitor-sync')
    const result = await syncCompetitorChannel(
      { id: 'ch-1', channel_id: 'UC123', site_id: 'site-1' },
      'fake-api-key',
    )

    // Lock was acquired (not skipped)
    expect(result.skipped).toBeUndefined()
  })

  it('should set error status on API failure and preserve partial data', async () => {
    const casChain = chainMock([{ id: 'ch-1', sync_mode: 'recent', full_sync_completed_at: null }])
    mockSupabase.from.mockReturnValue(casChain)

    // Channel API fails
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

    const { syncCompetitorChannel } = await import('@/lib/youtube/competitor-sync')

    await expect(
      syncCompetitorChannel({ id: 'ch-1', channel_id: 'UC123', site_id: 'site-1' }, 'fake-key')
    ).rejects.toThrow('YouTube API 500')

    // Verify error status was set via supabase update
    expect(mockSupabase.from).toHaveBeenCalledWith('competitor_channels')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:web -- --run apps/web/test/cms/competitors/competitor-sync.test.ts 2>&1 | tail -20
```

Expected: FAIL — `syncCompetitorChannel` doesn't return `{ skipped: true }` yet.

- [ ] **Step 3: Refactor syncCompetitorChannel with CAS lock + pagination**

Replace the entire content of `apps/web/src/lib/youtube/competitor-sync.ts`:

```typescript
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { createNotification } from '@/lib/notifications/create'
import crypto from 'crypto'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
const MAX_FULL_SYNC_VIDEOS = 2000
const MAX_INCREMENTAL_PAGES = 5
const CHANGE_DETECTION_WINDOW_DAYS = 90
const PAGE_DELAY_MS = 300

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.search = ''
    return u.toString().replace(/\/$/, '')
  } catch {
    return url
  }
}

interface SyncResult {
  videosChecked: number
  changesDetected: number
  skipped?: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function syncCompetitorChannel(
  channelRow: { id: string; channel_id: string; site_id: string },
  apiKey: string,
): Promise<SyncResult> {
  const supabase = getSupabaseServiceClient()

  // ── CAS Lock: acquire or skip ──
  const { data: locked } = await supabase
    .from('competitor_channels')
    .update({
      sync_status: 'syncing',
      sync_started_at: new Date().toISOString(),
      sync_progress: 0,
      sync_error: null,
    })
    .eq('id', channelRow.id)
    .or(`sync_status.neq.syncing,sync_started_at.lt.${new Date(Date.now() - 10 * 60_000).toISOString()}`)
    .select('id, sync_mode, full_sync_completed_at')

  if (!locked || locked.length === 0) {
    return { videosChecked: 0, changesDetected: 0, skipped: true }
  }

  const syncMode = (locked[0] as { sync_mode: string }).sync_mode
  const fullSyncDone = (locked[0] as { full_sync_completed_at: string | null }).full_sync_completed_at

  let videosChecked = 0
  let changesDetected = 0

  try {
    // ── 1. Channel metadata ──
    const channelRes = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=contentDetails,snippet,statistics&id=${channelRow.channel_id}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!channelRes.ok) throw new Error(`YouTube API ${channelRes.status} for channel ${channelRow.channel_id}`)

    const channelData = await channelRes.json()
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploadsPlaylistId) {
      await supabase.from('competitor_channels').update({ sync_status: 'idle' }).eq('id', channelRow.id)
      return { videosChecked: 0, changesDetected: 0 }
    }

    const snippet = channelData.items[0].snippet
    const stats = channelData.items[0].statistics
    const youtubeVideoCount = parseInt(stats?.videoCount ?? '0', 10)

    await supabase
      .from('competitor_channels')
      .update({
        channel_name: snippet?.title ?? '',
        thumbnail_url: snippet?.thumbnails?.default?.url ?? null,
        subscriber_count: parseInt(stats?.subscriberCount ?? '0', 10),
        youtube_video_count: youtubeVideoCount,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', channelRow.id)

    // Daily snapshot (non-blocking)
    try {
      await supabase
        .from('competitor_channel_snapshots')
        .upsert({
          competitor_channel_id: channelRow.id,
          subscriber_count: parseInt(stats?.subscriberCount ?? '0', 10),
          video_count: youtubeVideoCount,
          view_count: parseInt(stats?.viewCount ?? '0', 10),
          snapshot_date: new Date().toISOString().slice(0, 10),
        }, { onConflict: 'competitor_channel_id,snapshot_date' })
    } catch {
      // Non-fatal
    }

    // ── 2. Decide sync strategy ──
    const isFullSync = syncMode === 'full' && !fullSyncDone
    const changeDetectionCutoff = new Date(Date.now() - CHANGE_DETECTION_WINDOW_DAYS * 86_400_000).toISOString()

    let nextPageToken: string | undefined
    let pageCount = 0

    do {
      // Fetch playlist page
      let playlistUrl = `${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`
      if (nextPageToken) playlistUrl += `&pageToken=${nextPageToken}`

      const playlistRes = await fetch(playlistUrl, { signal: AbortSignal.timeout(10_000) })
      if (!playlistRes.ok) throw new Error(`YouTube API ${playlistRes.status} for playlist ${uploadsPlaylistId}`)

      const playlistData = await playlistRes.json()
      const videoIds = (playlistData.items ?? [])
        .map((item: Record<string, unknown>) => {
          const snip = item.snippet as Record<string, unknown> | undefined
          const resId = snip?.resourceId as Record<string, unknown> | undefined
          return resId?.videoId
        })
        .filter(Boolean) as string[]

      if (!videoIds.length) break

      // Fetch video details
      const videosRes = await fetch(
        `${YOUTUBE_API_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`,
        { signal: AbortSignal.timeout(10_000) },
      )
      if (!videosRes.ok) throw new Error(`YouTube API ${videosRes.status} for video details`)

      const videosData = await videosRes.json()

      // Batch lookup existing videos
      const { data: existingVideos } = await supabase
        .from('competitor_videos')
        .select('id, video_id, title, description_hash, thumbnail_url, view_count')
        .eq('competitor_channel_id', channelRow.id)
        .in('video_id', videoIds)
      const existingMap = new Map((existingVideos ?? []).map(v => [v.video_id, v]))

      // Smart incremental: stop if we hit a known video
      let hitKnownVideo = false

      for (const video of videosData.items ?? []) {
        videosChecked++
        const videoId = video.id as string
        const title = (video.snippet?.title as string) ?? null
        const description = (video.snippet?.description as string) ?? ''
        const descriptionHash = crypto.createHash('sha256').update(description).digest('hex').slice(0, 16)
        const thumbnailUrl = (video.snippet?.thumbnails?.maxres?.url ?? video.snippet?.thumbnails?.high?.url ?? null) as string | null
        const viewCount = parseInt(video.statistics?.viewCount ?? '0', 10)
        const publishedAt = (video.snippet?.publishedAt as string) ?? null
        const likeCount = parseInt(video.statistics?.likeCount ?? '0', 10)
        const commentCount = parseInt(video.statistics?.commentCount ?? '0', 10)
        const tags: string[] = (video.snippet?.tags as string[]) ?? []
        const categoryId: string | null = (video.snippet?.categoryId as string) ?? null

        let durationSeconds: number | null = null
        const durationStr = video.contentDetails?.duration as string | undefined
        if (durationStr) {
          const match = durationStr.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
          if (match && (match[1] || match[2] || match[3] || match[4])) {
            durationSeconds = (parseInt(match[1] ?? '0', 10) * 86400) +
                              (parseInt(match[2] ?? '0', 10) * 3600) +
                              (parseInt(match[3] ?? '0', 10) * 60) +
                              parseInt(match[4] ?? '0', 10)
          }
        }
        const isShort = (durationSeconds !== null && durationSeconds <= 60) ||
                        (title?.includes('#Shorts') ?? false)

        const existing = existingMap.get(videoId) ?? null

        if (!existing) {
          await supabase.from('competitor_videos').insert({
            competitor_channel_id: channelRow.id,
            video_id: videoId,
            title,
            description_hash: descriptionHash,
            thumbnail_url: thumbnailUrl,
            view_count: viewCount,
            published_at: publishedAt,
            like_count: likeCount,
            comment_count: commentCount,
            duration_seconds: durationSeconds,
            is_short: isShort,
            tags,
            category_id: categoryId,
            original_thumbnail_url: thumbnailUrl,
          })
          continue
        }

        // Mark as known for smart incremental
        hitKnownVideo = true

        // Change detection — skip for old videos
        const shouldDetectChanges = publishedAt ? publishedAt > changeDetectionCutoff : true

        if (shouldDetectChanges) {
          if (existing.title && title && existing.title !== title) {
            await supabase.from('competitor_changes').insert({
              video_id: existing.id,
              site_id: channelRow.site_id,
              change_type: 'title',
              old_title: existing.title,
              new_title: title,
              view_count_at_change: viewCount,
            })
            changesDetected++
          }

          if (existing.description_hash && descriptionHash !== existing.description_hash) {
            await supabase.from('competitor_changes').insert({
              video_id: existing.id,
              site_id: channelRow.site_id,
              change_type: 'description',
              view_count_at_change: viewCount,
            })
            changesDetected++
          }

          if (existing.thumbnail_url && thumbnailUrl && normalizeUrl(existing.thumbnail_url) !== normalizeUrl(thumbnailUrl)) {
            await supabase.from('competitor_changes').insert({
              video_id: existing.id,
              site_id: channelRow.site_id,
              change_type: 'thumbnail',
              old_thumbnail_url: existing.thumbnail_url,
              new_thumbnail_url: thumbnailUrl,
              view_count_at_change: viewCount,
            })
            changesDetected++
          }
        }

        // Update stats
        await supabase
          .from('competitor_videos')
          .update({
            title,
            description_hash: descriptionHash,
            thumbnail_url: thumbnailUrl,
            view_count: viewCount,
            last_checked_at: new Date().toISOString(),
            like_count: likeCount,
            comment_count: commentCount,
            duration_seconds: durationSeconds,
            is_short: isShort,
            tags,
            category_id: categoryId,
          })
          .eq('id', existing.id)
      }

      // Update progress
      await supabase
        .from('competitor_channels')
        .update({ sync_progress: videosChecked })
        .eq('id', channelRow.id)

      nextPageToken = playlistData.nextPageToken as string | undefined
      pageCount++

      // Decide whether to continue
      if (isFullSync) {
        if (videosChecked >= MAX_FULL_SYNC_VIDEOS) break
        if (nextPageToken) await sleep(PAGE_DELAY_MS)
      } else {
        // Smart incremental: stop when we hit a known video or reach page cap
        if (hitKnownVideo || pageCount >= MAX_INCREMENTAL_PAGES) break
      }
    } while (nextPageToken)

    // Mark completion
    const updatePayload: Record<string, unknown> = {
      sync_status: 'idle',
      sync_error: null,
    }
    if (isFullSync) {
      updatePayload.full_sync_completed_at = new Date().toISOString()
    }
    await supabase.from('competitor_channels').update(updatePayload).eq('id', channelRow.id)

    // Notifications (unchanged from original)
    if (changesDetected > 0 && process.env.COMPETITOR_NOTIFICATIONS_ENABLED !== 'false') {
      try {
        const { data: owner } = await supabase
          .from('site_users')
          .select('user_id')
          .eq('site_id', channelRow.site_id)
          .eq('role', 'super_admin')
          .limit(1)
          .single()

        if (owner) {
          await createNotification({
            site_id: channelRow.site_id,
            user_id: owner.user_id,
            type: 'youtube.competitor_change',
            domain: 'youtube',
            priority: 2,
            title: `${changesDetected} mudança(s) em ${snippet?.title ?? channelRow.channel_id}`,
            message: `Detectamos mudanças em vídeos de ${snippet?.title ?? 'competidor'}. Confira no Observatório.`,
            action_href: '/cms/youtube/competitors?tab=mudancas',
            dedup_key: `competitor-change-${channelRow.id}-${new Date().toISOString().slice(0, 10)}`,
          })
        }
      } catch {
        // Non-fatal
      }
    }

    return { videosChecked, changesDetected }
  } catch (error) {
    // Set error status, preserve partial data
    await supabase
      .from('competitor_channels')
      .update({
        sync_status: 'error',
        sync_error: error instanceof Error ? error.message : 'Unknown sync error',
      })
      .eq('id', channelRow.id)
    throw error
  }
}
```

- [ ] **Step 4: Run test to verify CAS lock passes**

```bash
npm run test:web -- --run apps/web/test/cms/competitors/competitor-sync.test.ts 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Build packages and typecheck**

```bash
npm run build:packages && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20
```

Expected: Type errors in `page.tsx` only (missing new fields on view construction — fixed in Task 5).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/cms/competitors/
git commit -m "feat(sync): paginated full sync with CAS lock, smart incremental, 2000 cap"
```

---

### Task 4: Server Actions — syncFullHistory + getSyncStatus

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts`

- [ ] **Step 1: Add maxDuration export and new server actions**

At the top of `actions.ts`, after the `'use server'` directive (line 1), add:

```typescript
export const maxDuration = 120
```

This is critical — without it, server actions default to 15s on Vercel, and full sync can take 20-30s.

Then add these two actions at the end of `actions.ts` (after `toggleBookmark`):

```typescript
export async function syncFullHistory(channelRowId: string): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false, error: 'forbidden' } }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { ok: false, error: 'API key not configured' }

  const supabase = getSupabaseServiceClient()

  // Backpressure: max 1 full sync per site at a time
  const { count: syncing } = await supabase
    .from('competitor_channels')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('sync_status', 'syncing')
    .gt('sync_started_at', new Date(Date.now() - 10 * 60_000).toISOString())

  if ((syncing ?? 0) > 0) return { ok: false, error: 'Outro canal está sincronizando. Aguarde.' }

  // Set sync_mode to full
  await supabase
    .from('competitor_channels')
    .update({ sync_mode: 'full', full_sync_completed_at: null })
    .eq('id', channelRowId)
    .eq('site_id', siteId)

  const { data: channel } = await supabase
    .from('competitor_channels')
    .select('id, channel_id, site_id')
    .eq('id', channelRowId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return { ok: false, error: 'Canal não encontrado' }

  try {
    await syncCompetitorChannel(channel, apiKey)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Sync failed' }
  } finally {
    revalidatePath('/cms/youtube/competitors')
  }
}

export async function getSyncStatus(channelRowId: string): Promise<{
  status: string
  progress: number
  youtubeVideoCount: number | null
  error: string | null
}> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch {
    return { status: 'idle', progress: 0, youtubeVideoCount: null, error: null }
  }

  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('competitor_channels')
    .select('sync_status, sync_progress, youtube_video_count, sync_error')
    .eq('id', channelRowId)
    .eq('site_id', siteId)
    .single()

  if (!data) return { status: 'idle', progress: 0, youtubeVideoCount: null, error: null }

  return {
    status: data.sync_status,
    progress: data.sync_progress,
    youtubeVideoCount: data.youtube_video_count,
    error: data.sync_error,
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts
git commit -m "feat(actions): add syncFullHistory with backpressure + getSyncStatus polling"
```

---

### Task 5: Page Query — Fix Limit, Add New Columns

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx`

- [ ] **Step 1: Add maxDuration and fix channel select query**

At the top of `page.tsx`, after `export const dynamic = 'force-dynamic'` (line 16), add:

```typescript
export const maxDuration = 60
```

Change the channel select query (line 33-34) from:

```typescript
.select('id, channel_id, channel_name, thumbnail_url, subscriber_count, last_synced_at, added_at')
```

to:

```typescript
.select('id, channel_id, channel_name, thumbnail_url, subscriber_count, last_synced_at, added_at, sync_mode, sync_status, sync_started_at, sync_progress, sync_error, full_sync_completed_at, youtube_video_count')
```

- [ ] **Step 2: Fix the video limit — per-channel queries instead of single global query**

The current `.limit(750)` global query silently drops data when one channel dominates the result set. A simple `limit(N)` multiplier doesn't fix distribution. Replace the video query (lines 42-54) with per-channel fetching:

```typescript
type VideoRow = {
  id: string; competitor_channel_id: string; video_id: string; title: string | null
  thumbnail_url: string | null; view_count: number | null; published_at: string | null
  tags: string[] | null; like_count: number | null; comment_count: number | null
  duration_seconds: number | null; last_checked_at: string | null
}

// Fetch per-channel to guarantee fair distribution (max 200 per channel)
const allVideos: VideoRow[] = []
for (const chId of channelIds) {
  const { data: chVideos } = await supabase
    .from('competitor_videos')
    .select('id, competitor_channel_id, video_id, title, thumbnail_url, view_count, published_at, tags, like_count, comment_count, duration_seconds, last_checked_at')
    .eq('competitor_channel_id', chId)
    .order('published_at', { ascending: false })
    .limit(200)
  if (chVideos) allVideos.push(...(chVideos as VideoRow[]))
}
```

This guarantees each channel gets up to 200 videos regardless of how many videos other channels have. With 15 channels × 200 = max 3000 rows — well within server component limits.

- [ ] **Step 3: Add sync fields to channel view construction**

In the `return` block inside `safeChannels.map()` (around line 261-277), add the new fields:

```typescript
return {
  id: ch.id,
  channelId: ch.channel_id,
  channelName: ch.channel_name,
  thumbnailUrl: ch.thumbnail_url,
  subscriberCount: ch.subscriber_count,
  videoCount: videos.length,
  addedAt: ch.added_at ?? new Date().toISOString(),
  lastSyncedAt: ch.last_synced_at,
  avgEngagement,
  growthDelta,
  growthSparkline,
  recentVideos,
  vsYou: vsYouResult,
  changeFlags,
  // Full sync fields
  syncMode: (ch.sync_mode ?? 'recent') as 'recent' | 'full',
  syncStatus: (ch.sync_status ?? 'idle') as 'idle' | 'syncing' | 'error',
  syncProgress: ch.sync_progress ?? 0,
  syncError: ch.sync_error ?? null,
  youtubeVideoCount: ch.youtube_video_count ?? null,
  fullSyncCompletedAt: ch.full_sync_completed_at ?? null,
}
```

- [ ] **Step 4: Exclude stale videos from outlier/median calculations (data staleness)**

The spec requires that videos with `last_checked_at` older than 7 days are excluded from statistical computations. In the outlier calculation section (around line 302-330 in the original), find the line:

```typescript
const sortedViews = [...videos]
```

Replace the outlier loop to filter stale videos:

```typescript
const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
const freshVideos = videos.filter(v =>
  (v as { last_checked_at?: string | null }).last_checked_at
    ? (v as { last_checked_at?: string | null }).last_checked_at! > sevenDaysAgo
    : true
)
if (freshVideos.length < 3) continue
const sortedViews = [...freshVideos]
```

Also update the median calculation inside `safeChannels.map()` for `recentVideos` to use fresh videos only:

```typescript
const freshForMedian = videos.filter(v =>
  (v as { last_checked_at?: string | null }).last_checked_at
    ? (v as { last_checked_at?: string | null }).last_checked_at! > sevenDaysAgo
    : true
)
const medianViews = freshForMedian.length > 0
  ? [...freshForMedian].sort((a, b) => (a.view_count ?? 0) - (b.view_count ?? 0))[Math.floor(freshForMedian.length / 2)]?.view_count ?? 0
  : 0
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20
```

Expected: Remaining errors only in `channel-card.tsx` (doesn't use new fields yet — fixed in Task 8).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx
git commit -m "feat(page): fix global video limit, add sync columns, exclude stale from outliers"
```

---

### Task 6: CSS — Sync Bar + Sync Action

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/youtube-motion.css`

- [ ] **Step 1: Add sync-bar and sync-action styles**

Add at the end of `youtube-motion.css`, before the `@media (prefers-reduced-motion)` block:

```css
/* ── Full sync progress bar ── */
[data-cms-section="youtube"] .sync-bar {
  width: 100%;
  height: 7px;
  border-radius: 999px;
  background: var(--surface-3);
  overflow: hidden;
  margin-top: 6px;
}
[data-cms-section="youtube"] .sync-bar > span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
  transition: width var(--t-fast) var(--ease-out);
}

/* ── Inline action link (buscar historico / tentar novamente) ── */
[data-cms-section="youtube"] .sync-action {
  font-size: 10.5px;
  color: var(--accent);
  cursor: pointer;
  transition: color var(--t-fast);
  background: none;
  border: none;
  padding: 0;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
[data-cms-section="youtube"] .sync-action:hover {
  color: var(--accent-hover);
}
[data-cms-section="youtube"] .sync-action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/youtube-motion.css
git commit -m "feat(css): add sync-bar progress + sync-action link styles"
```

---

### Task 7: Frontend — Confirmation Dialog + Polling Hook

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_components/confirm-full-sync-dialog.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_components/useFullSyncProgress.ts`

- [ ] **Step 1: Create confirmation dialog**

Create `confirm-full-sync-dialog.tsx`:

```typescript
'use client'

import { useTransition, useRef } from 'react'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '../../../_shared/editor/use-modal-focus-trap'
import { RefreshCw, X } from 'lucide-react'

interface ConfirmFullSyncDialogProps {
  channelName: string
  youtubeVideoCount: number | null
  onConfirm: () => Promise<void>
  onClose: () => void
}

export function ConfirmFullSyncDialog({ channelName, youtubeVideoCount, onConfirm, onClose }: ConfirmFullSyncDialogProps) {
  const [isPending, startTransition] = useTransition()
  const dialogRef = useRef<HTMLDivElement>(null)

  useModalFocusTrap(dialogRef, true, onClose)

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm()
    })
  }

  const estimate = youtubeVideoCount
    ? Math.max(5, Math.round((youtubeVideoCount / 50) * 0.8))
    : 15

  return (
    <YtPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
        <div
          className="absolute inset-0"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Buscar historico completo"
          className="relative w-full max-w-[420px] rounded-[14px] border border-cms-border bg-cms-surface overflow-hidden"
          style={{ boxShadow: 'var(--shadow-pop, 0 24px 60px -20px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4))' }}
        >
          <div className="flex items-center gap-[11px] py-[18px] px-[20px] border-b border-cms-border">
            <span
              className="flex items-center justify-center rounded-[9px]"
              style={{ width: 32, height: 32, background: 'var(--accent-soft, rgba(255,130,64,0.10))' }}
            >
              <RefreshCw size={16} style={{ color: 'var(--accent)' }} aria-hidden="true" />
            </span>
            <h2 className="text-[15px] font-bold text-cms-text flex-1 m-0">Buscar historico completo</h2>
            <button type="button" onClick={onClose} className="ic-btn" aria-label="Fechar">
              <X size={15} />
            </button>
          </div>

          <div className="py-[18px] px-[20px] space-y-[10px] text-[13px] text-cms-text-dim leading-[1.55]">
            <p className="m-0">
              Buscar todos os videos de <strong className="text-cms-text">{channelName}</strong>.
            </p>
            <p className="m-0">
              {youtubeVideoCount
                ? `Este canal tem ~${youtubeVideoCount.toLocaleString('pt-BR')} videos. `
                : ''}
              Levara aproximadamente {estimate} segundos.
            </p>
          </div>

          <div className="flex items-center justify-end gap-[10px] py-[14px] px-[20px] border-t border-cms-border">
            <button type="button" onClick={onClose} disabled={isPending} className="btn sm">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="btn sm"
              style={{ background: 'var(--accent)', color: 'var(--on-accent, #1A120A)', borderColor: 'transparent' }}
            >
              {isPending ? 'Sincronizando...' : 'Continuar'}
            </button>
          </div>
        </div>
      </div>
    </YtPortal>
  )
}
```

- [ ] **Step 2: Create polling hook**

Create `useFullSyncProgress.ts`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSyncStatus } from '../actions'

interface SyncProgress {
  progress: number
  total: number | null
  percent: number
  status: string
  error: string | null
}

export function useFullSyncProgress(channelId: string, isActive: boolean): SyncProgress {
  const router = useRouter()
  const [state, setState] = useState<SyncProgress>({
    progress: 0,
    total: null,
    percent: 0,
    status: 'idle',
    error: null,
  })

  const poll = useCallback(async () => {
    const s = await getSyncStatus(channelId)
    const percent = s.youtubeVideoCount && s.youtubeVideoCount > 0
      ? Math.min(100, Math.round((s.progress / s.youtubeVideoCount) * 100))
      : 0
    setState({
      progress: s.progress,
      total: s.youtubeVideoCount,
      percent,
      status: s.status,
      error: s.error,
    })
    return s.status
  }, [channelId])

  useEffect(() => {
    if (!isActive) return

    const id = setInterval(async () => {
      const status = await poll()
      if (status !== 'syncing') {
        clearInterval(id)
        router.refresh()
      }
    }, 3000)

    // Initial poll
    poll()

    return () => clearInterval(id)
  }, [isActive, poll, router])

  return state
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/competitors/_components/confirm-full-sync-dialog.tsx apps/web/src/app/cms/(authed)/youtube/competitors/_components/useFullSyncProgress.ts
git commit -m "feat(ui): add full sync confirmation dialog + progress polling hook"
```

---

### Task 8: Frontend — Channel Card Footer Restructure

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_components/channel-card.tsx`

This is the largest UI change. The card footer (lines 323-331) and meta line (lines 161-169) get restructured for honest labels and progress display.

- [ ] **Step 1: Add imports and state**

At the top of `channel-card.tsx`, add imports:

```typescript
import { ConfirmFullSyncDialog } from './confirm-full-sync-dialog'
import { useFullSyncProgress } from './useFullSyncProgress'
import { syncFullHistory } from '../actions'
```

Inside the component, add state for the dialog and progress:

```typescript
const [showFullSyncDialog, setShowFullSyncDialog] = useState(false)
const isFullSyncing = ch.syncStatus === 'syncing' && ch.syncMode === 'full'
const syncProgress = useFullSyncProgress(ch.id, isFullSyncing)
```

- [ ] **Step 2: Update the meta line (video count) — the `<p>` with "inscritos · vídeos"**

Find the `<p className="mono">` that renders `{ch.subscriberCount}...{ch.videoCount} vídeos` (search for `vídeos` in the component). Replace with honest labels:

```typescript
<p className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>
  {ch.subscriberCount != null ? `${fmtC(ch.subscriberCount)} inscritos` : '—'}
  {' · '}
  {ch.syncStatus === 'syncing'
    ? 'sincronizando...'
    : ch.syncMode === 'full' && ch.fullSyncCompletedAt && ch.youtubeVideoCount && ch.videoCount < ch.youtubeVideoCount
      ? `${ch.videoCount} de ~${fmtC(ch.youtubeVideoCount)} vídeos`
      : ch.syncMode === 'recent' && !ch.fullSyncCompletedAt
        ? `${ch.videoCount} vídeos (recentes)`
        : `${ch.videoCount} vídeos`
  }
</p>
```

- [ ] **Step 3: Update the shelf header — the `.chan-shelf-head` with "Vídeos recentes"**

Find the `<div className="chan-shelf-head">` containing `<span className="section-label">`. Replace the label:

```typescript
<div className="chan-shelf-head">
  <span className="section-label">
    Vídeos{' '}
    <span className="mono" style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
      ({ch.fullSyncCompletedAt ? 'histórico' : '50 recentes'})
    </span>
  </span>
  {/* ... existing outlier stats ... */}
</div>
```

- [ ] **Step 4: Restructure the footer — replace the `{/* Sync time + open hint */}` block**

Find the `<div>` containing `sincronizado` and `chan-open-hint` (the last div inside `card-pad`, after the vs-you section). Replace entirely with:

```typescript
<div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
  {ch.syncStatus === 'error' ? (
    /* Error state */
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span className="mono" style={{ fontSize: 10.5, color: 'var(--red)' }}>
        Sync falhou · {ch.videoCount} vídeos importados
      </span>
      <button
        className="sync-action"
        onClick={e => { e.stopPropagation(); setShowFullSyncDialog(true) }}
      >
        tentar novamente
      </button>
    </div>
  ) : isFullSyncing ? (
    /* Syncing state with progress */
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
        Buscando histórico... {syncProgress.progress}
        {syncProgress.total ? ` de ~${fmtC(syncProgress.total)}` : ''} vídeos
      </span>
      <div className="sync-bar">
        <span style={{ width: `${syncProgress.percent}%` }} />
      </div>
    </div>
  ) : (
    /* Idle state */
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
        {ch.lastSyncedAt ? `sincronizado ${fmtRelative(ch.lastSyncedAt)}` : 'nunca sincronizado'}
        {ch.syncMode === 'recent' && !ch.fullSyncCompletedAt
          ? ' · 50 recentes'
          : ch.fullSyncCompletedAt && ch.youtubeVideoCount && ch.videoCount >= 2000 && ch.videoCount < ch.youtubeVideoCount
            ? ` · ${fmtC(ch.videoCount)} de ~${fmtC(ch.youtubeVideoCount)} (limite)`
            : ''
        }
      </span>
      {ch.syncMode === 'recent' && !ch.fullSyncCompletedAt ? (
        <button
          className="sync-action"
          onClick={e => { e.stopPropagation(); setShowFullSyncDialog(true) }}
        >
          buscar histórico ›
        </button>
      ) : (
        <span className="chan-open-hint" style={{ fontSize: 12, fontWeight: 500 }}>
          ver canal
          <ArrowRight style={{ width: 12, height: 12 }} />
        </span>
      )}
    </div>
  )}
</div>

{/* Confirmation dialog */}
{showFullSyncDialog && (
  <ConfirmFullSyncDialog
    channelName={ch.channelName}
    youtubeVideoCount={ch.youtubeVideoCount}
    onConfirm={async () => {
      const result = await syncFullHistory(ch.id)
      setShowFullSyncDialog(false)
      if (!result.ok && result.error) {
        console.error('[full-sync]', result.error)
      }
    }}
    onClose={() => setShowFullSyncDialog(false)}
  />
)}
```

- [ ] **Step 5: Typecheck + build**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20
```

Expected: Clean (all type errors resolved).

- [ ] **Step 6: Run all tests**

```bash
npm run test:web 2>&1 | tail -20
```

Expected: All existing tests pass. New test from Task 3 passes.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/competitors/_components/channel-card.tsx
git commit -m "feat(card): restructured footer with progress bar, honest labels, full sync trigger"
```

---

### Task 9: Integration Test + Final Verification

**Files:**
- Modify: `apps/web/test/cms/competitors/competitor-sync.test.ts`

- [ ] **Step 1: Add full sync pagination and change detection tests**

Add to the existing test file:

```typescript
describe('syncCompetitorChannel — full sync pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('should paginate all pages in full sync mode', async () => {
    // CAS returns full mode channel
    const casChain = chainMock([{ id: 'ch-1', sync_mode: 'full', full_sync_completed_at: null }])
    const updateChain = chainMock()
    const insertChain = chainMock()
    const selectChain = chainMock([], null) // no existing videos

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'competitor_channels') return casChain
      if (table === 'competitor_videos') return selectChain
      if (table === 'competitor_channel_snapshots') return insertChain
      return chainMock()
    })

    // Build 3 pages of playlist data
    const makeVideoItem = (id: string) => ({
      snippet: { resourceId: { videoId: id } },
    })
    const makeVideoDetail = (id: string) => ({
      id,
      snippet: { title: `Video ${id}`, description: 'desc', publishedAt: new Date().toISOString(), tags: [], categoryId: '22', thumbnails: { high: { url: `https://img/${id}` } } },
      statistics: { viewCount: '1000', likeCount: '10', commentCount: '2' },
      contentDetails: { duration: 'PT5M30S' },
    })

    let fetchCallCount = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      fetchCallCount++
      if (url.includes('/channels?')) {
        return Promise.resolve({ ok: true, json: () => ({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU123' } }, snippet: { title: 'Test' }, statistics: { subscriberCount: '100', videoCount: '6', viewCount: '6000' } }] }) })
      }
      if (url.includes('/playlistItems?')) {
        const hasToken = url.includes('pageToken=')
        const page = hasToken ? 2 : 1
        const items = page === 1
          ? [makeVideoItem('v1'), makeVideoItem('v2')]
          : [makeVideoItem('v3')]
        const nextPageToken = page === 1 ? 'token2' : undefined
        return Promise.resolve({ ok: true, json: () => ({ items, nextPageToken }) })
      }
      if (url.includes('/videos?')) {
        const ids = new URL(url).searchParams.get('id')?.split(',') ?? []
        return Promise.resolve({ ok: true, json: () => ({ items: ids.map(makeVideoDetail) }) })
      }
      return Promise.resolve({ ok: false, status: 404 })
    })

    const { syncCompetitorChannel } = await import('@/lib/youtube/competitor-sync')
    const result = await syncCompetitorChannel(
      { id: 'ch-1', channel_id: 'UC123', site_id: 'site-1' },
      'fake-key',
    )

    // 3 videos across 2 pages
    expect(result.videosChecked).toBe(3)
    expect(result.skipped).toBeUndefined()
    // Verify: 1 channel call + 2 playlist pages + 2 video detail calls = 5 fetches
    expect(fetchCallCount).toBe(5)
    globalThis.fetch = originalFetch
  })

  it('should skip change detection for videos older than 90 days', async () => {
    const casChain = chainMock([{ id: 'ch-1', sync_mode: 'recent', full_sync_completed_at: '2026-01-01' }])
    const oldDate = '2025-01-01T00:00:00Z' // > 90 days ago
    const existingVideo = { id: 'ev-1', video_id: 'v1', title: 'Old Title', description_hash: 'aaaa', thumbnail_url: 'https://old', view_count: 500 }
    const selectChain = chainMock([existingVideo])
    const insertCallArgs: unknown[] = []

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'competitor_channels') return casChain
      if (table === 'competitor_videos') return selectChain
      if (table === 'competitor_changes') {
        const mock = chainMock()
        ;(mock.insert as ReturnType<typeof vi.fn>).mockImplementation((data: unknown) => {
          insertCallArgs.push(data)
          return mock
        })
        return mock
      }
      return chainMock()
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/channels?')) {
        return Promise.resolve({ ok: true, json: () => ({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU123' } }, snippet: { title: 'Test' }, statistics: { subscriberCount: '100', videoCount: '1', viewCount: '500' } }] }) })
      }
      if (url.includes('/playlistItems?')) {
        return Promise.resolve({ ok: true, json: () => ({ items: [{ snippet: { resourceId: { videoId: 'v1' } } }] }) })
      }
      if (url.includes('/videos?')) {
        return Promise.resolve({ ok: true, json: () => ({ items: [{ id: 'v1', snippet: { title: 'New Title', description: 'desc', publishedAt: oldDate, tags: [], categoryId: '22', thumbnails: { high: { url: 'https://new-thumb' } } }, statistics: { viewCount: '600', likeCount: '5', commentCount: '1' }, contentDetails: { duration: 'PT3M' } }] }) })
      }
      return Promise.resolve({ ok: false })
    })

    const { syncCompetitorChannel } = await import('@/lib/youtube/competitor-sync')
    await syncCompetitorChannel({ id: 'ch-1', channel_id: 'UC123', site_id: 'site-1' }, 'key')

    // Title changed but video is old — no change detection
    expect(insertCallArgs.length).toBe(0)
    globalThis.fetch = originalFetch
  })
})
```

- [ ] **Step 2: Run full test suite**

```bash
npm run test:web 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 3: Full build verification**

```bash
npm run build:packages && npx next build --dir apps/web 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/cms/competitors/
git commit -m "test: add competitor sync tests for pagination, CAS lock, smart incremental"
```

---

## Execution Order

```
Task 1 (migration) ─────────────────────────────────┐
Task 2 (types) ──────────────────────────────────────┤
Task 6 (CSS) ────────────────────────────────────────┤── can run in parallel
                                                     │
Task 3 (sync backend) ──── depends on Task 1, 2 ────┤
Task 4 (actions) ────────── depends on Task 3 ───────┤
Task 5 (page.tsx) ───────── depends on Task 2, 4 ────┤
Task 7 (dialog + hook) ──── depends on Task 4 ───────┤
Task 8 (card UI) ────────── depends on Task 5, 6, 7 ─┤
Task 9 (tests + verify) ── depends on all above ──────┘
```

Tasks 1, 2, and 6 can execute in parallel (no dependencies between them).
