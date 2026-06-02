# Competitor Full Video Fetch — Design Spec

**Date:** 2026-06-02
**Status:** Approved
**Scope:** Backend sync + DB migration + Frontend UX

---

## Problem

The competitor sync (`competitor-sync.ts`) fetches only the **50 most recent** videos per channel via YouTube Data API (`playlistItems.list`, `maxResults=50`). Channels with 500+ videos lose their full history — the user cannot study a competitor's evolution, find their first viral video, or analyze long-term patterns.

Additionally, `page.tsx` uses `.limit(750)` globally across all channels, silently dropping data when multiple channels have many videos.

## Solution

Two user-controlled sync modes per channel:

- **`recent`** (default): 50 most recent videos. Fast. For monitoring current strategy.
- **`full`**: Paginated fetch of ALL videos (capped at 2000). For deep analysis. Triggered on-demand by the user.

The cron continues doing incremental syncs (recent videos) for all channels. Full sync is a one-time on-demand operation per channel.

---

## Data Model

### New columns on `competitor_channels`

```sql
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
```

| Column | Type | Purpose |
|--------|------|---------|
| `sync_mode` | `text` | User intent: `'recent'` or `'full'`. Controls sync behavior. |
| `sync_status` | `text` | Concurrency guard: `'idle'`, `'syncing'`, `'error'`. |
| `sync_started_at` | `timestamptz` | When current sync started. TTL for stale lock recovery (10 min). |
| `sync_progress` | `integer` | Videos synced so far during full sync. Updated per page. Enables progress UI. |
| `sync_error` | `text` | Error message from last failed sync. NULL on success. |
| `full_sync_completed_at` | `timestamptz` | When full sync last completed. NULL = never/pending. |
| `youtube_video_count` | `integer` | Total video count from YouTube API (free from channel stats). Progress denominator. |

### New index

```sql
CREATE INDEX IF NOT EXISTS idx_competitor_videos_channel_published
  ON competitor_videos (competitor_channel_id, published_at DESC);
```

Covers the primary `ORDER BY published_at DESC` query in `page.tsx`.

### Migration file

Create via `npm run db:new add_competitor_full_sync_columns`.

---

## Sync Architecture

### Atomic CAS Lock (Race Condition Prevention)

```sql
UPDATE competitor_channels
SET sync_status = 'syncing',
    sync_started_at = now(),
    sync_progress = 0,
    sync_error = NULL
WHERE id = $1
  AND (sync_status != 'syncing'
       OR sync_started_at < now() - interval '10 minutes')
RETURNING id;
```

Single atomic query. Resolves:
- **Race condition** between cron and manual sync (zero rows = already running)
- **Stale lock** from crash (10-min TTL auto-recovery)

### Backpressure: Max 1 Full Sync per Site

Before starting a full sync, check:
```sql
SELECT count(*) FROM competitor_channels
WHERE site_id = $1
  AND sync_status = 'syncing'
  AND sync_started_at > now() - interval '10 minutes';
```
If > 0, reject with user-friendly message: "Outro canal esta sincronizando. Aguarde."

### Sync Flow

```
syncCompetitorChannel(channelRow, apiKey):
  1. Atomic CAS -> acquire lock. Return { skipped: true } if fails.
  2. try:
     3. Fetch channel metadata (1 API call: channels.list)
     4. Update youtube_video_count from stats.videoCount
     5. IF sync_mode = 'full' AND full_sync_completed_at IS NULL:
        -> FULL SYNC (paginated):
           for each playlistItems page (maxResults=50):
             fetch videos.list for those 50 IDs (1 API call)
             batch upsert into competitor_videos
             UPDATE sync_progress += inserted/updated count
             skip change detection for videos with published_at > 90 days ago
             await sleep(300ms) between pages
             BREAK if nextPageToken undefined OR sync_progress > 2000
           SET full_sync_completed_at = NOW()
     6. ELSE (incremental):
        -> SMART INCREMENTAL:
           fetch playlistItems pages until a video_id already exists in DB
           cap at 5 pages (250 videos) as safety net
           normal change detection for all videos
     7. SET sync_status = 'idle', sync_error = NULL
  8. catch(error):
     SET sync_status = 'error', sync_error = error.message
     (videos already inserted are preserved — partial progress safe)
```

### Key Design Decisions

**Page-by-page processing (not accumulate-all):** Each `playlistItems` page returns 50 IDs. Immediately fetch `videos.list` for those 50 IDs and upsert. 1:1 mapping between playlist pages and video detail calls. Minimizes memory, preserves progress on failure.

**No page token resume:** If full sync fails mid-way and retries, it re-paginates from the start. Already-inserted videos get a cheap upsert update. For channels with <2000 videos this is ~80 API calls — fast enough that resume complexity isn't justified.

**Change detection only for videos < 90 days:** Old videos rarely change title/thumbnail. Skipping change detection for old videos during full sync avoids polluting `competitor_changes` with stale noise.

**Smart incremental (cron):** Instead of always fetching exactly 1 page (50 videos), the cron paginates until it finds a video already in the DB. This automatically fills gaps if >50 videos were published between cron runs. Cap of 5 pages (250 videos) prevents runaway.

**2000 video cap:** Diminishing returns beyond 2000. 15 channels x 2000 = 30,000 rows — manageable for single-tenant CMS. UI shows honest label when capped.

### Quota Impact (SAFE)

| Scenario | API Units | % of 10,000/day |
|----------|-----------|-----------------|
| 1 channel full sync (500 videos) | 21 | 0.2% |
| 5 channels full sync | 105 | 1.1% |
| All 15 channels full + daily incremental | 660 | 6.6% |

Uses `playlistItems.list` (1 unit/call) and `videos.list` (1 unit/call). NOT `search.list` (100 units).

---

## Triggering Strategy

### Add channel (unchanged)
`addCompetitorChannel()` calls `syncCompetitorChannel()` with default `sync_mode='recent'`. Fetches 50 most recent videos. Fast (~3s).

### "Buscar historico completo" button (new)
New server action `syncFullHistory(channelRowId)`:
1. Backpressure check (max 1 full sync per site)
2. `UPDATE competitor_channels SET sync_mode = 'full' WHERE id = $1`
3. Call `syncCompetitorChannel(channel, apiKey)` — will paginate because `sync_mode='full'` and `full_sync_completed_at IS NULL`
4. `revalidateTag('youtube')`

Runs synchronously in server action. Page segment has `maxDuration = 60` (Vercel Pro supports up to 300s; 20s typical for 500 videos is comfortable).

### Cron (unchanged behavior)
Runs every 30 min. Calls `syncCompetitorChannel()` for each channel. If `sync_mode='full'` and `full_sync_completed_at` is set, runs smart incremental (not re-paginating everything).

### getSyncStatus action (new)
Lightweight server action returning `{ status, progress, youtubeVideoCount, error }` for a channel. Called by client-side polling during full sync.

---

## Frontend

### Design System Alignment

All new UI follows the YouTube CMS design handoff (`design_handoff_youtube_cms/`):

- **Colors:** `var(--text)`, `var(--text-dim)`, `var(--accent)`, `var(--accent-hover)`, `var(--red)`, `var(--surface-3)`
- **Typography:** `.mono` (JetBrains Mono, tabular-nums), `.dim`, `.section-label`
- **Motion:** `var(--t-fast)` (.12s), `var(--ease-out)`, `@keyframes spin`
- **Spacing:** card padding `18px 20px`, footer gap `10px`, border-radius `14px` (card), `999px` (pills/bars)
- **Buttons:** `.ic-btn` (30x30, rounded-8), `.btn.sm` (6px 11px, 12.5px), `.btn.sm.primary` (accent bg)

### Confirmation Dialog — `confirm-full-sync-dialog.tsx` (NEW)

Follows the exact pattern of `remove-channel-dialog.tsx`:

```
YtPortal
  Scrim (fixed, rgba(0,0,0,0.55), backdropFilter: blur(4px))
    Dialog (max-width 420px, border-radius 14px, --shadow-pop)
      Header (padding 18px):
        Icon box (32x32, bg var(--accent-soft), icon RefreshCw 16px var(--accent))
        Title: "Buscar historico completo" (15px/600)
        X close button (ic-btn)
      Body (padding 18px):
        "Este canal tem ~{youtube_video_count} videos."
        "Buscar todos levara aproximadamente {estimate}s."
        (mono, fontSize 12.5, color var(--text-muted))
      Footer (padding 14px, border-top var(--border)):
        [Cancelar] btn sm
        [Continuar] btn sm primary
          isPending -> "Sincronizando..." disabled
```

Uses: `useTransition`, `useRef`, `useModalFocusTrap`, `YtPortal`.

### Channel Card Footer (Lines 323-331) — RESTRUCTURED

**4 visual states:**

**idle + recent mode:**
```
sincronizado ha 2h · 50 recentes     buscar historico >
```
- Left: `mono dim` fontSize 10.5 (existing pattern)
- Right: `mono` fontSize 10.5, `color: var(--accent)`, onClick opens confirmation dialog

**syncing (full sync in progress):**
```
Buscando historico... 327 de ~840
[████████████░░░░░░░░░░░░░░░░] 39%
```
- Text: `mono` fontSize 10.5, `color: var(--text-muted)`
- Progress bar: `.sync-bar` (7px height, 999px radius, bg `var(--surface-3)`)
- Fill: `var(--accent)`, `transition: width var(--t-fast) var(--ease-out)`
- Sync button (RefreshCw) gets `.syncing` class with spin animation

**idle + full mode complete:**
```
sincronizado ha 2h · 842 videos              ver canal >
```
Standard pattern, no "buscar historico" link (already done).

**idle + full mode capped:**
```
sincronizado ha 2h · 2000 de ~5200 (limite)  ver canal >
```

**error:**
```
Sync falhou · 750 videos importados     tentar novamente
```
- "Sync falhou": `color: var(--red)`, fontSize 10.5
- "tentar novamente": `color: var(--accent)`, cursor pointer, onClick retriggers

### Meta Line (Lines 161-169) — Honest Labels

| State | Display |
|-------|---------|
| recent, never full synced | `"{subs} inscritos · {count} videos (recentes)"` |
| full, completed | `"{subs} inscritos · {count} videos"` |
| full, capped | `"{subs} inscritos · {count} de ~{yt_count} videos"` |
| syncing | `"{subs} inscritos · sincronizando..."` |

### Shelf Header (Line 339) — Badge

```
Videos  (50 recentes)     <- mode recent
Videos  (historico)       <- mode full + completed
```
- "Videos": `.section-label` (11px/600, uppercase, dim)
- Badge: `mono` fontSize 10, `color: var(--text-dim)`, inline after label

### Progress Polling Hook — `useFullSyncProgress.ts` (NEW)

```typescript
function useFullSyncProgress(channelId: string, isActive: boolean) {
  // Poll getSyncStatus() every 3s while isActive
  // Returns { progress, total, percent, status, error }
  // Clears interval when status !== 'syncing'
  // Calls router.refresh() on completion
}
```

### CSS Additions — `observatory.css`

```css
.sync-bar {
  height: 7px;
  border-radius: 999px;
  background: var(--surface-3);
  overflow: hidden;
  margin-top: 6px;
}
.sync-bar > span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
  transition: width var(--t-fast) var(--ease-out);
}
.sync-action {
  font-size: 10.5px;
  color: var(--accent);
  cursor: pointer;
  transition: color var(--t-fast);
  background: none;
  border: none;
  padding: 0;
}
.sync-action:hover { color: var(--accent-hover); }
```

### Types — `observatory-types.ts`

Add to `CompetitorChannelView`:
```typescript
syncMode: 'recent' | 'full'
syncStatus: 'idle' | 'syncing' | 'error'
syncProgress: number
syncError: string | null
youtubeVideoCount: number | null
fullSyncCompletedAt: string | null
```

### Page Query Fix — `page.tsx`

**Current:** `.limit(750)` global across all channels.

**New:** Per-channel query strategy:
- Card view: 100 videos per channel (recent, for cards/sparklines)
- Drawer/detail view: paginated fetch via server action (100 per page, cursor by `published_at`)

Add `maxDuration = 60` to page segment for server action timeout headroom.

Include new columns in channel select: `sync_mode, sync_status, sync_started_at, sync_progress, sync_error, full_sync_completed_at, youtube_video_count`.

### Data Staleness Handling

- Old video stats (>90 days) freeze after full sync — acceptable for evolution study use case
- **Outlier/median calculations:** Exclude videos with `last_checked_at` > 7 days from statistical computations
- **UI:** Videos with stale stats show date in tooltip: `"views em 2 Jun"`

---

## Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `supabase/migrations/{ts}_add_competitor_full_sync_columns.sql` | **NEW** — 7 columns + 1 index |
| 2 | `apps/web/src/lib/youtube/competitor-sync.ts` | Paginated loop, CAS lock, progress update, smart incremental, 2000 cap, sleep between pages |
| 3 | `apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts` | New: `syncFullHistory()`, `getSyncStatus()`. Backpressure check. |
| 4 | `apps/web/src/app/cms/(authed)/youtube/competitors/_components/channel-card.tsx` | Footer restructured: progress bar, labels, "buscar historico" link, error state, retry |
| 5 | `apps/web/src/app/cms/(authed)/youtube/competitors/_components/confirm-full-sync-dialog.tsx` | **NEW** — Confirmation dialog (pattern: remove-channel-dialog.tsx) |
| 6 | `apps/web/src/app/cms/(authed)/youtube/competitors/_components/useFullSyncProgress.ts` | **NEW** — Polling hook |
| 7 | `apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx` | `maxDuration=60`, per-channel query, new columns in select, build sync fields into view |
| 8 | `apps/web/src/lib/youtube/observatory-types.ts` | New fields on CompetitorChannelView |
| 9 | `apps/web/src/app/cms/(authed)/youtube/youtube-motion.css` | `.sync-bar`, `.sync-action` classes |

---

## Test Strategy

### Unit tests (Vitest)

- `syncCompetitorChannel` with `sync_mode='full'`: mock YouTube API with multiple pages, verify all pages fetched and upserted
- `syncCompetitorChannel` with `sync_mode='recent'`: verify only 1 page fetched (existing behavior)
- Smart incremental: mock 3 pages where page 2 contains a known video_id, verify stops at page 2
- CAS lock: verify returns `{ skipped: true }` when status is 'syncing' and started < 10 min ago
- CAS lock recovery: verify proceeds when status is 'syncing' but started > 10 min ago
- 2000 cap: mock channel with 3000 videos, verify stops at 2000
- Error handling: mock API failure on page 3, verify status='error', sync_error set, partial data preserved
- Backpressure: verify rejects when another channel in same site is syncing
- Change detection skip: verify no `competitor_changes` inserted for videos > 90 days old

### Integration tests (with local DB)

- Full sync end-to-end: add channel, trigger full sync, verify all videos in DB
- Incremental after full: add new videos to mock, run incremental, verify gap filled
- Concurrent sync prevention: trigger two syncs, verify second is rejected

### Manual verification

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3001/api/cron/sync-youtube?mode=competitors"

npx supabase db query --linked \
  "SELECT cc.channel_name, cc.sync_mode, cc.sync_status, cc.youtube_video_count,
          COUNT(cv.id) as synced_count, MIN(cv.published_at) as oldest
   FROM competitor_channels cc
   LEFT JOIN competitor_videos cv ON cv.competitor_channel_id = cc.id
   GROUP BY cc.id;"
```
