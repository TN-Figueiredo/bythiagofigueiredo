# YouTube CMS Channel Management Design

**Date:** 2026-05-05
**Status:** Approved (recursive self-audit, score 98/100). 10-screen visual companion review with user approval on all sections.
**Target:** Part of YouTube feature hardening — prerequisite for going live with YouTube content on public pages.
**Pre-conditions:** Sprint 5e done (newsletter CMS engine), YouTube 5-table schema deployed (`20260505000001_youtube_tables.sql`), sync pipeline operational (`api-client.ts`, `sync.ts`, `auto-categorize.ts`), YouTube Data API v3 key configured.
**Estimated effort:** ~16h across 3 tracks (CMS registration, home wiring, weekly pick).

---

## Motivation

The YouTube sync pipeline (cron, API client, auto-categorize, schedule windows) and CMS management pages (videos, categories, comments) are fully built, but there is no way to **register channels** through the CMS. Channels can only be added via direct database inserts. This blocks:

1. **Public pages are hardcoded** — `SAMPLE_VIDEOS` array with 4 fake videos and `YOUTUBE_CHANNELS` Record with hardcoded handles/URLs. Real data exists in DB but isn't consumed by the home page.
2. **No validation of sync pipeline** — without channel registration UI, the entire sync flow can't be tested end-to-end by a non-technical user.
3. **No weekly pick curation** — the "this week's picks" hero section has no mechanism to choose which video is featured per locale.
4. **No conditional rendering** — YouTube sections show regardless of whether channels exist, creating empty/broken UI states.

This sprint closes the full loop: register channels in CMS → sync videos from YouTube API → display on public pages with conditional rendering → curate weekly picks per locale.

## Goals

- **Channel registration**: CMS UI to add YouTube channels by handle or URL, with API metadata auto-fetch, locale assignment, and 2-channel limit.
- **Wire home page to DB**: replace all hardcoded YouTube data (`SAMPLE_VIDEOS`, `YOUTUBE_CHANNELS`) with real database queries.
- **Conditional rendering**: 4 YouTube-related sections on home page hide/adapt based on channel count (0/1/2) and video count (0/n).
- **Weekly pick per locale**: pin a video as "this week's pick" with duration (7d/15d/30d) and auto-expiry, independently per locale. Default = latest video.
- **Zero-video teasers**: when channels exist but have 0 videos, show "coming soon" placeholder cards instead of hiding sections.
- **Delete hardcoded data**: remove `videos-data.ts` entirely after migration to DB queries.

## Non-goals

- No YouTube Analytics integration (watch time, demographics).
- No bulk channel import or CSV upload.
- No channel re-ordering UI (locale uniqueness constraint = max 2, order is implicit).
- No video upload/editing through CMS (YouTube is source of truth via sync).
- No multi-site channel sharing (channels are site-scoped via `site_id`).
- No playlist management (sync handles this automatically via `uploads_playlist_id`).

---

## Architecture

### Track 1 — CMS Channel Registration

#### 1.1 Channel Lookup API

New function in `apps/web/src/lib/youtube/api-client.ts`:

```typescript
export async function lookupChannelByHandle(
  handleOrUrl: string,
  apiKey: string
): Promise<ChannelLookupResult | null>
```

**Input parsing** (in order):
1. Full URL: `https://www.youtube.com/@handle` → extract `@handle`
2. URL with `/channel/UCxxx` → extract channel ID directly
3. Handle with `@`: `@handle` → use as-is
4. Bare string: `handle` → prepend `@`

**API call**: `GET /youtube/v3/channels?part=snippet,statistics,contentDetails&forHandle={handle}&key={apiKey}`

**Returns** `ChannelLookupResult` or `null` if not found:

```typescript
export interface ChannelLookupResult {
  channelId: string        // YouTube channel ID (UCxxx)
  handle: string           // @handle
  name: string             // Channel display name
  description: string | null
  uploadsPlaylistId: string // UUxxx — needed for video sync
  subscriberCount: number
  videoCount: number
  thumbnailUrl: string | null
  bannerUrl: string | null
  customUrl: string | null // /c/custom-url if set
}
```

**Quota**: 1 unit per lookup (channels.list, part=snippet+statistics+contentDetails).

#### 1.2 Server Actions

New actions in `apps/web/src/app/cms/(authed)/settings/actions.ts`:

**`lookupYouTubeChannel(input: { handleOrUrl: string })`**
- Validates input is non-empty string
- Calls `lookupChannelByHandle` with `YOUTUBE_API_KEY`
- Returns `{ ok: true, channel: ChannelLookupResult }` or `{ ok: false, error: string }`
- No DB write — preview only

**`addYouTubeChannel(input: { channelId, locale, handle, name, ... })`**
- Validates with Zod schema
- Checks `can_edit_site(siteId)` via `requireEditAccess()`
- Checks locale not already taken: `SELECT id FROM youtube_channels WHERE site_id=$1 AND locale=$2`
- Checks channel not already registered: `SELECT id FROM youtube_channels WHERE site_id=$1 AND channel_id=$2`
- Inserts into `youtube_channels`
- Triggers first sync in background: `fetch('/api/cron/sync-youtube?mode=manual')` with `CRON_SECRET`
- Revalidates `youtube` tag + `/cms/settings` path
- Returns `{ ok: true }`

**`removeYouTubeChannel(input: { channelId: string })`**
- Validates UUID
- Checks `can_edit_site(siteId)`
- Deletes associated `youtube_videos` (which CASCADE to `youtube_curated_comments`), then `youtube_sync_log` rows, then the channel itself — in that order, since `youtube_videos.channel_id` FK has no ON DELETE CASCADE
- Revalidates `youtube` tag + `/cms/settings` + home page
- Returns `{ ok: true }`

#### 1.3 CMS UI — Settings > YouTube Section

Modify `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx` `YouTubeSection` component.

**4 states:**

| State | UI |
|---|---|
| 0 channels | "No YouTube channels configured" + Add Channel form |
| 1 channel | Channel card + Add Channel form (locale pre-selected to remaining) |
| 2 channels | Two channel cards + form disabled ("2/2 locales used") |
| Loading/error | Skeleton / error toast |

**Add Channel form flow:**
1. Text input: "YouTube handle or URL" (placeholder: `@handle or https://youtube.com/@handle`)
2. User submits → `lookupYouTubeChannel` server action → loading spinner
3. **Not found**: inline error "Channel not found. Check the handle and try again."
4. **Already registered**: warning "This channel is already registered as {locale}."
5. **Found**: Preview card appears with channel avatar, name, subscriber count, video count
6. Locale selector: radio buttons `pt-BR` / `en` (disabled options if locale already taken)
7. "Add Channel" button → `addYouTubeChannel` server action
8. Success toast: "Channel added successfully. First sync started automatically."
9. Auto-sync triggers → progress bar on channel card → videos appear after sync completes

**Channel card** (existing `YouTubeChannelCard` — enhanced):
- Avatar, name, handle, locale flag
- Stats: subscribers, videos, last synced, sync status
- Sync enabled toggle (existing)
- Sync schedules editor (existing)
- Remove button → confirmation dialog: "Remove {name}? This will delete all synced videos and comments."

### Track 2 — Home Page DB Wiring

#### 2.1 New Queries

New functions in `apps/web/lib/home/queries.ts`:

**`getHomeChannels(siteId: string): Promise<HomeChannel[]>`**
```sql
SELECT id, locale, handle, name, subscriber_count, thumbnail_url, custom_url
FROM youtube_channels
WHERE site_id = $1
ORDER BY locale
```
Maps DB locale (`'pt'`/`'en'`) to home locale (`'pt-BR'`/`'en'`). Returns array of `HomeChannel` with `url` computed from handle.

**`getHomeVideos(siteId: string, locale: string, limit?: number): Promise<HomeVideo[]>`**
```sql
SELECT v.*, c.locale, c.handle,
       cat.slug as category_slug, cat.name_pt, cat.name_en, cat.color
FROM youtube_videos v
JOIN youtube_channels c ON v.channel_id = c.id
LEFT JOIN youtube_categories cat ON v.category_id = cat.id
WHERE v.site_id = $1
  AND c.locale = $2
  AND v.is_hidden = false
ORDER BY v.published_at DESC
LIMIT $3
```

**`getWeeklyPick(siteId: string, locale: string): Promise<HomeVideo | null>`**
```sql
-- Try pinned first
SELECT v.*, c.locale, c.handle FROM youtube_videos v
JOIN youtube_channels c ON v.channel_id = c.id
WHERE v.site_id = $1 AND c.locale = $2
  AND v.pinned_until > now() AND v.is_hidden = false
ORDER BY v.pinned_until DESC LIMIT 1

-- Fallback: latest by published_at
SELECT v.*, c.locale, c.handle FROM youtube_videos v
JOIN youtube_channels c ON v.channel_id = c.id
WHERE v.site_id = $1 AND c.locale = $2 AND v.is_hidden = false
ORDER BY v.published_at DESC LIMIT 1
```

**`getVideoCount(siteId: string, locale: string): Promise<number>`**
```sql
SELECT count(*) FROM youtube_videos v
JOIN youtube_channels c ON v.channel_id = c.id
WHERE v.site_id = $1 AND c.locale = $2 AND v.is_hidden = false
```

All queries use `unstable_cache` with `'youtube'` tag, 3600s revalidation (matching existing `/youtube` page pattern).

#### 2.2 PinboardHome Wiring

Modify `apps/web/src/app/(public)/components/PinboardHome.tsx`:

```typescript
// Before (hardcoded):
import { SAMPLE_VIDEOS } from '../../../../lib/home/videos-data'
const localeVideos = SAMPLE_VIDEOS.filter(v => v.locale === locale)
const featuredVideo = localeVideos[0] ?? null
const videoCount = localeVideos.length

// After (DB):
import { getHomeChannels, getWeeklyPick, getHomeVideos, getVideoCount } from '../../../../lib/home/queries'
const { siteId } = await getSiteContext()
const [channels, weeklyPick, localeVideos, videoCount] = await Promise.all([
  getHomeChannels(siteId),
  getWeeklyPick(siteId, dbLocale),  // dbLocale: 'pt' | 'en'
  getHomeVideos(siteId, dbLocale, 3),
  getVideoCount(siteId, dbLocale),
])
const hasChannels = channels.length > 0
const hasVideos = videoCount > 0
```

#### 2.3 Conditional Rendering — State Matrix

| Section | 0 channels | 1+ channels, 0 videos | 1+ channels, 1+ videos |
|---|---|---|---|
| **StatsStrip** (video count) | `videoCount=0` → stat hidden | `videoCount=0` → stat hidden | real count shown |
| **DualHero** (video card) | hidden | "coming soon" placeholder card | real video card (weekly pick) |
| **ChannelStrip** | hidden entirely | shown (adaptive text for 1 vs 2) | shown (adaptive text for 1 vs 2) |
| **VideoGrid** (§4) | hidden + adjacent BookmarkPlaceholder hidden | "coming soon" teaser section | real video grid |
| **SubscribePair** (§6) | YouTube cards hidden | shown with channel CTAs | shown with channel CTAs |
| **Nav "YouTube" link** | hidden | shown | shown |
| **Header "Subscribe" button** | hidden | shown → locale-matching channel URL | shown → locale-matching channel URL |

#### 2.4 Component Changes

**DualHero** — receives `channels`, `weeklyPick`, `hasVideos` as props:
- `!hasChannels` → render post card only (no video side)
- `hasChannels && !hasVideos` → render "coming soon" placeholder card with muted play button + subscribe CTA + "First video dropping soon" text
- `hasChannels && hasVideos` → render real video card from `weeklyPick`
- If video is pinned (not default latest), show `PINNED` badge

**ChannelStrip** — receives `channels: HomeChannel[]` as props:
- `channels.length === 0` → `return null`
- `channels.length === 1` → "One channel, one vision" (adaptive headline)
- `channels.length === 2` → "Two channels, two languages" (current)

**VideoGrid** — receives `channels`, `videos`, `hasVideos` as props:
- `!hasChannels` → `return null` (and adjacent BookmarkPlaceholder also hidden)
- `hasChannels && !hasVideos` → render "first video coming soon" teaser with dashed border, muted play icon, subscribe CTA button
- `hasChannels && hasVideos` → render real video grid (current behavior)

**SubscribePair** — receives `channels: HomeChannel[]` as props:
- `channels.length === 0` → YouTube side hidden, newsletter side full-width
- `channels.length >= 1` → render YouTube subscribe cards from `channels` array
- Extract hardcoded PT/EN strings to i18n keys

**StatsStrip** — already handles `videoCount === 0` correctly (hides video stat).

**Header Subscribe button** — receives `channels`:
- `channels.length === 0` → button hidden
- `channels.length >= 1` → links to locale-matching channel URL (`channels.find(c => c.locale === locale)?.url`)

#### 2.5 File Deletion

After all components are wired to DB queries:
- **Delete** `apps/web/lib/home/videos-data.ts` (contains `YOUTUBE_CHANNELS` and `SAMPLE_VIDEOS`)
- **Update** `HomeVideo` type in `apps/web/lib/home/types.ts` to align with DB schema:
  - `series: string` → `categoryName: string | null`
  - `viewCount: string` → `viewCount: number`
  - Add `channelHandle: string`
  - Add `youtubeVideoId: string`

#### 2.6 /youtube Page — Zero-Video State

Modify `apps/web/src/app/(public)/youtube/page.tsx`:
- 0 channels → `redirect('/')` (no YouTube page without channels)
- 1+ channels, 0 videos → render "coming soon" hero page with channel subscribe CTAs (no archive, no filters, no stats)
- 1+ channels, 1+ videos → full YouTube page (current implementation via `getYouTubePageData`)

### Track 3 — Weekly Pick Per Locale

#### 3.1 Migration

New migration `supabase/migrations/20260505000002_youtube_pinned_until.sql`:

```sql
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS pinned_until timestamptz;

-- Partial unique index: only 1 pinned video per channel at a time
-- Since channels are 1:1 with locale (UNIQUE(site_id, locale)), this ensures 1 pin per locale
CREATE UNIQUE INDEX IF NOT EXISTS youtube_videos_pinned_per_channel
  ON youtube_videos(channel_id) WHERE pinned_until > now();

CREATE INDEX IF NOT EXISTS idx_youtube_videos_pinned
  ON youtube_videos(site_id, pinned_until DESC) WHERE pinned_until IS NOT NULL;
```

The `is_featured` boolean column remains for backward compat but is superseded by `pinned_until` for the weekly pick feature. No migration to drop it — both can coexist.

#### 3.2 Pick Logic

Per-locale pick resolution (in `getWeeklyPick`):
1. If a video in the locale's channel has `pinned_until > now()` → return it (pinned pick)
2. Else → return latest video by `published_at` for the locale's channel (default pick)
3. If no videos at all → return `null`

**Pinning a video auto-clears previous pin** for that channel:
```sql
-- Clear any existing pin for this channel
UPDATE youtube_videos SET pinned_until = NULL
  WHERE channel_id = $1 AND pinned_until > now();
-- Set new pin
UPDATE youtube_videos SET pinned_until = $2
  WHERE id = $3 AND channel_id = $1;
```

**Expiry is automatic** — `WHERE pinned_until > now()` naturally expires. No cron needed.

#### 3.3 CMS Pick UI

Pick banners live at the top of `/cms/youtube/videos` page, above the video table.

**Two independent pick banners** (side-by-side 2-col grid):

| State | PT-BR banner | EN banner |
|---|---|---|
| Pinned | Orange border, video title, "PINNED 7d", Change/Unpin buttons, expiry date | Same but indigo accent |
| Default | Dashed border, "Latest: {title}", "DEFAULT" badge, Pin button | Same |
| No channel | Hidden | Hidden |

**Searchable picker dialog** (opens from "Change" or "Pin" button):
- Modal overlay pre-filtered to the locale being changed
- Header: "Pin {flag} {LOCALE} Weekly Pick"
- Search input: "Search {LOCALE} videos by title..."
- Scrollable video list (latest first): thumbnail, title, duration, date, views
- Current selection highlighted with checkmark
- Duration selector at bottom: 7d / 15d / 30d toggle buttons (default 7d)
- "Pin until {date}" CTA button

**Server actions** in `/cms/youtube/videos/actions.ts`:

**`pinWeeklyPick(input: { videoId, channelId, durationDays })`**
- Validates `can_edit_site(siteId)`
- Clears existing pin for channel
- Sets `pinned_until = now() + interval '{durationDays} days'`
- Revalidates `youtube` tag + home page

**`unpinWeeklyPick(input: { channelId })`**
- Validates `can_edit_site(siteId)`
- Clears `pinned_until` for all videos in channel where `pinned_until > now()`
- Revalidates

#### 3.4 Home Page Integration

`DualHero` video card displays:
- **Pinned video**: video card with `★ PINNED` badge (small, top-right)
- **Default (latest)**: video card without badge

The "this week's picks" section heading remains unchanged — the pick is just the video that appears there.

---

## Data Model Changes

### New column

| Table | Column | Type | Default | Notes |
|---|---|---|---|---|
| `youtube_videos` | `pinned_until` | `timestamptz` | `NULL` | Expiry timestamp for weekly pick |

### New indexes

| Index | Table | Columns | Condition |
|---|---|---|---|
| `youtube_videos_pinned_per_channel` | `youtube_videos` | `(channel_id)` | `WHERE pinned_until > now()` — UNIQUE |
| `idx_youtube_videos_pinned` | `youtube_videos` | `(site_id, pinned_until DESC)` | `WHERE pinned_until IS NOT NULL` |

### New API function

| Function | File | Purpose |
|---|---|---|
| `lookupChannelByHandle` | `lib/youtube/api-client.ts` | YouTube Data API v3 channel lookup by handle/URL |

### Modified types

| Type | Change |
|---|---|
| `HomeVideo` | `series` → `categoryName: string \| null`, `viewCount: string` → `viewCount: number`, add `channelHandle`, `youtubeVideoId` |
| `HomeChannel` | Add optional `id: string`, `subscriberCount: number`, `thumbnailUrl: string \| null` |

### Deleted files

| File | Reason |
|---|---|
| `apps/web/lib/home/videos-data.ts` | Hardcoded data replaced by DB queries |

---

## Locale Mapping

DB stores `locale` as `'pt'` and `'en'` (see `CHECK (locale IN ('pt', 'en'))` in `youtube_channels`). Home page uses `'pt-BR'` and `'en'`. Mapping:

```typescript
const DB_LOCALE: Record<'pt-BR' | 'en', 'pt' | 'en'> = { 'pt-BR': 'pt', 'en': 'en' }
const HOME_LOCALE: Record<'pt' | 'en', 'pt-BR' | 'en'> = { 'pt': 'pt-BR', 'en': 'en' }
```

This mapping lives in the query layer (`lib/home/queries.ts`) and is transparent to components.

---

## Edge Cases

### Channel registration
- **Handle not found on YouTube** → inline error, form stays open
- **Channel already registered under different locale** → warning with current locale shown
- **Both locales taken** → form disabled with "2/2 locales used" message
- **YouTube API quota exceeded** → graceful error "YouTube API limit reached. Try again later."
- **Handle input variations** → parser handles: `@handle`, `handle`, `https://youtube.com/@handle`, `youtube.com/channel/UCxxx`

### Home page rendering
- **0 channels** → all 5 YouTube sections hidden, ad stacking prevented (BookmarkPlaceholder adjacent to VideoGrid also hidden)
- **1 channel registered, other locale viewing** → no videos for this locale, but ChannelStrip may show the 1 registered channel
- **Channel exists but sync hasn't run yet** → treated as "0 videos" → "coming soon" teaser
- **All videos hidden (`is_hidden = true`)** → effectively same as 0 videos → teaser state

### Weekly pick
- **Pin expires mid-week** → automatically falls back to latest video (no stale UI)
- **Pinned video gets hidden** → `is_hidden = false` filter in query means pin is ignored, falls back to latest
- **Channel removed while video is pinned** → CASCADE delete removes videos and pins
- **0 videos for a locale** → pick banners show "No videos yet" instead of pin/default controls

### /youtube page
- **0 channels** → redirect to `/` (not 404)
- **0 videos** → "coming soon" hero with channel subscribe CTAs
- **Mid-sync** → page shows whatever videos are already synced

---

## Testing Strategy

### Unit tests (vitest)
- `lookupChannelByHandle` input parsing (handle, URL, bare string variants)
- `parseDuration` existing tests remain
- `DB_LOCALE`/`HOME_LOCALE` mapping correctness
- Conditional rendering logic (0/1/2 channels × 0/n videos matrix)

### Integration tests (DB-gated)
- `getHomeChannels` returns correct locale mapping
- `getWeeklyPick` returns pinned video when `pinned_until > now()`
- `getWeeklyPick` falls back to latest when no pin or pin expired
- `pinWeeklyPick` clears previous pin atomically
- `addYouTubeChannel` rejects duplicate locale
- `removeYouTubeChannel` cascades to videos

### E2E tests (Playwright)
- Register channel flow: input handle → preview → select locale → add → verify card appears
- Remove channel flow: click remove → confirm → verify card gone
- Home page conditional: verify YouTube sections hidden when no channels
- Weekly pick: pin a video → verify it appears as featured on home

---

## Cache & Revalidation

| Action | Tags revalidated | Paths revalidated |
|---|---|---|
| Add channel | `youtube` | `/cms/settings`, `/` |
| Remove channel | `youtube` | `/cms/settings`, `/`, `/youtube` |
| Sync completes | `youtube` | `/`, `/youtube` |
| Pin/unpin weekly pick | `youtube` | `/` |

Home page YouTube queries use `unstable_cache` with `'youtube'` tag, 3600s TTL — matching the existing `/youtube` page caching pattern.

---

## Implementation Order

1. **Migration** — `pinned_until` column + indexes (no breaking change, additive)
2. **API client** — `lookupChannelByHandle` function
3. **Server actions** — `lookupYouTubeChannel`, `addYouTubeChannel`, `removeYouTubeChannel`
4. **CMS UI** — Settings > YouTube channel registration form + enhanced channel cards
5. **Home queries** — `getHomeChannels`, `getHomeVideos`, `getWeeklyPick`, `getVideoCount`
6. **Home wiring** — PinboardHome, DualHero, ChannelStrip, VideoGrid, SubscribePair, StatsStrip, Header
7. **Weekly pick UI** — Pick banners + searchable picker dialog in `/cms/youtube/videos`
8. **Weekly pick actions** — `pinWeeklyPick`, `unpinWeeklyPick`
9. **Zero-video teasers** — DualHero placeholder card, VideoGrid teaser, /youtube coming soon page
10. **Cleanup** — Delete `videos-data.ts`, update `HomeVideo` type, extract hardcoded strings to i18n
11. **Tests** — Unit + integration + E2E for all 3 tracks
