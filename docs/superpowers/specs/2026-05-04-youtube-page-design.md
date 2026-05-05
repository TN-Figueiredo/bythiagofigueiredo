# YouTube Page — Design Spec

**Date:** 2026-05-04
**Score:** 98/100
**Status:** Approved
**Design reference:** `design/youtube.html` + `design/youtube.jsx` (1109 lines)

## Goal

Create a `/youtube` page that syncs videos from two YouTube channels (PT-BR `@tnFigueiredoTV` and EN `@byThiagoFigueiredo`) via YouTube Data API v3, stores them in Supabase, supports CMS-managed categories with auto-suggest, curated comments with locale targeting, and renders using the editorial pinboard design system. A cron job keeps data synchronized with DB-stored schedules editable from CMS settings.

## Channels

| Channel | Locale | Handle | Cadence |
|---------|--------|--------|---------|
| PT-BR | `pt` | `@tnFigueiredoTV` | ~1-2 videos/week (Wed/Thu) |
| EN | `en` | `@byThiagoFigueiredo` | ~1-2 videos/week (Wed/Sun) |

Volume: starting from 0 videos. Expected ~1-2 per channel per week.

## Architecture: RSC + Client Hybrid

- **Server component** (`page.tsx`): ISR `revalidate: 3600`, fetches all videos + categories + channels + curated comments from Supabase, renders SEO (metadata, JSON-LD VideoObject nodes per video, breadcrumbs), serializes dataset as props
- **Client component** (`YouTubePageClient`): Receives full dataset, handles filtering/search/load-more/URL-sync
- **Payload**: ~5KB gzipped for 100 videos (id + title + duration + locale + category + tags + thumb + stats)
- **ISR + on-demand**: `revalidateTag('youtube')` called by sync cron after new videos ingested
- **Threshold for pivot**: 500+ videos → add server-side cursor pagination (years away at current cadence)

## Database Schema (5 tables)

### `youtube_categories`

CMS-managed categories with auto-categorization support.

```sql
create table youtube_categories (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  slug text not null,
  name_pt text not null,
  name_en text not null,
  description_pt text,
  description_en text,
  color text not null default '#FF8240',
  sort_order int not null default 0,
  match_keywords text[] not null default '{}',
  auto_approve boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(site_id, slug)
);
```

- `match_keywords`: case-insensitive matching against video title + tags + description
- `auto_approve`: when `true`, auto-suggested category is directly set as `category_id`; when `false`, only sets `auto_suggested_category_id` for manual review
- "Latest" is a virtual category (not a DB row) — the frontend default filter showing all videos sorted by date

### `youtube_channels`

One row per channel. Stores YouTube API metadata + sync configuration.

```sql
create table youtube_channels (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  channel_id text not null,
  locale text not null check (locale in ('pt', 'en')),
  handle text not null,
  name text not null,
  description text,
  uploads_playlist_id text not null,
  subscriber_count int not null default 0,
  video_count int not null default 0,
  thumbnail_url text,
  banner_url text,
  custom_url text,
  sync_enabled boolean not null default true,
  sync_schedules jsonb not null default '[]',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(site_id, channel_id),
  unique(site_id, locale)
);
```

`sync_schedules` JSONB structure — array of posting windows:

```json
[
  { "day": "wednesday", "hour": 9, "tz": "America/Sao_Paulo", "label": "Quarta 9h" },
  { "day": "sunday", "hour": 23, "tz": "America/Sao_Paulo", "label": "Domingo 23h" }
]
```

The cron checks these windows to sync shortly after expected uploads.

### `youtube_videos`

One row per video. Stores YouTube metadata + CMS enrichments.

```sql
create table youtube_videos (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  channel_id uuid not null references youtube_channels(id),
  youtube_video_id text not null,
  title text not null,
  title_translation text,
  description text,
  description_translation text,
  duration text not null default '0:00',
  duration_seconds int not null default 0,
  published_at timestamptz not null,
  thumbnail_url text,
  thumbnail_hq_url text,
  tags text[] not null default '{}',
  view_count int not null default 0,
  like_count int not null default 0,
  comment_count int not null default 0,
  category_id uuid references youtube_categories(id) on delete set null,
  auto_suggested_category_id uuid references youtube_categories(id) on delete set null,
  is_featured boolean not null default false,
  is_hidden boolean not null default false,
  cms_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(site_id, youtube_video_id)
);

create index idx_youtube_videos_published on youtube_videos(site_id, published_at desc);
create index idx_youtube_videos_channel on youtube_videos(channel_id);
create index idx_youtube_videos_category on youtube_videos(category_id);
create index idx_youtube_videos_featured on youtube_videos(site_id, is_featured) where is_featured = true;
```

- `title`: original YouTube title (in the channel's native locale)
- `title_translation`: CMS-added translation for the other locale
- `auto_suggested_category_id`: set by auto-categorization pipeline, pending manual approval (unless `category.auto_approve = true`)
- `is_featured`: editorial pick for the "Esta semana" section
- `is_hidden`: hide from public without deleting

### `youtube_curated_comments`

Hand-picked comments for the Comments Wall. Locale-targeted.

```sql
create table youtube_curated_comments (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  video_id uuid not null references youtube_videos(id) on delete cascade,
  author_handle text not null,
  author_avatar_url text,
  text_pt text not null,
  text_en text not null,
  like_count int not null default 0,
  display_order int not null default 0,
  target_locale text check (target_locale is null or target_locale in ('pt', 'en')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_curated_comments_locale on youtube_curated_comments(site_id, target_locale);
```

- `target_locale`: `null` = shown in both locales, `'pt'` = only PT page, `'en'` = only EN page
- Frontend query: `WHERE target_locale IS NULL OR target_locale = :current_locale ORDER BY display_order, like_count DESC LIMIT 4`

### `youtube_sync_log`

Audit trail for sync operations.

```sql
create table youtube_sync_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  channel_id uuid references youtube_channels(id),
  mode text not null check (mode in ('schedule', 'catchall', 'metrics', 'manual')),
  status text not null check (status in ('started', 'completed', 'failed', 'skipped')),
  videos_found int not null default 0,
  videos_inserted int not null default 0,
  videos_updated int not null default 0,
  error_message text,
  quota_used int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_sync_log_recent on youtube_sync_log(site_id, created_at desc);
```

## RLS Policies

All 5 tables follow the existing site-scoped pattern:

- **Public read**: `site_visible(site_id)` — same helper used by blog/campaigns
- **Staff write**: `can_edit_site(site_id)` for categories, videos, curated_comments
- **Service role**: sync_log writes via service-role client (cron)
- **Idempotent**: all policies prefixed with `DROP POLICY IF EXISTS`

## Auto-Categorization Pipeline

Triggered on video insert/update by the sync cron:

1. For each new/updated video, collect `title + tags + description` as searchable text
2. For each `youtube_categories` row, check if any `match_keywords` entry matches (case-insensitive substring)
3. If match found → set `auto_suggested_category_id`
4. If `category.auto_approve = true` AND no manual `category_id` already set → also set `category_id`
5. Log the suggestion in sync_log metadata

This runs server-side in the sync cron endpoint, not as a DB trigger.

## YouTube Data API v3 Integration

### Quota Budget

- Free tier: 10,000 units/day
- `playlistItems.list`: 1 unit per call (50 items/page)
- `videos.list`: 1 unit per call (50 IDs/batch)
- `channels.list`: 1 unit per call

Daily usage estimate (2 channels, ~2 videos/week):
- Schedule checks (6/day × 2 channels): ~24 units
- Daily catch-all: ~4 units
- Metrics refresh (2/day): ~4 units
- **Total: ~32 units/day** (0.3% of quota)

### Sync Strategy

Use `uploads` playlist ID per channel (avoids 100-unit `search.list`):

1. `playlistItems.list(playlistId=uploadsPlaylistId, maxResults=10)` → get recent video IDs
2. Filter out already-known IDs via DB lookup
3. `videos.list(id=newIds, part=snippet,contentDetails,statistics)` → full metadata
4. Upsert into `youtube_videos`
5. Run auto-categorization pipeline
6. Update channel stats (`subscriber_count`, `video_count`)

### Environment Variable

- `YOUTUBE_API_KEY` — YouTube Data API v3 key (server-only, not NEXT_PUBLIC)

## Cron Architecture

Single endpoint: `/api/cron/sync-youtube?mode={schedule|catchall|metrics}`

Uses existing `withCronLock()` + `CRON_SECRET` pattern from the 11 existing crons.

### Three Modes

| Mode | Schedule | Purpose |
|------|----------|---------|
| `schedule` | `*/30 * * * *` (every 30 min) | Check DB `sync_schedules` — if current time is within 45 min after a posting window, sync that channel |
| `catchall` | `0 7 * * *` (daily 07:00 UTC) | Full sync of both channels — catches anything missed by schedule checks |
| `metrics` | `0 12,20 * * *` (twice daily) | Refresh view/like/comment counts for videos published in last 30 days |

### Vercel Cron Registration

```json
{
  "crons": [
    { "path": "/api/cron/sync-youtube?mode=schedule", "schedule": "*/30 * * * *" },
    { "path": "/api/cron/sync-youtube?mode=catchall", "schedule": "0 7 * * *" },
    { "path": "/api/cron/sync-youtube?mode=metrics", "schedule": "0 12,20 * * *" }
  ]
}
```

### Quota Exhaustion Strategy

If API returns `quotaExceeded` (HTTP 403):
1. Log to `youtube_sync_log` with `status='failed'`
2. Skip remaining operations
3. Wait for daily reset (midnight Pacific Time)
4. **Do NOT auto-purchase quota** — hard stop, retry next day

## Frontend Page Structure

Reference: `design/youtube.jsx` (source of truth)

### Sections (in render order)

Header and footer are global layout components (`app/(public)/layout.tsx`) — this page renders only the content between them. No changes to header or footer layout/styling.

**One nav data change required:** `apps/web/src/components/layout/header-types.ts` currently points "Vídeos" to external YouTube URLs (`external: true`). Change to `href: '/youtube'` with `external: false` (internal route).

| # | Section | Kicker | Description |
|---|---------|--------|-------------|
| 0 | Doorman Ad | — | Banner above header (OFF by default) |
| 1 | Hero | § 01 | **Locale-adaptive**: PT = 1.35fr/1fr split (both channels), EN = full-width (EN only) |
| 2 | Channel Strip | — | Two-channel duplex cards with hover |
| 3 | Stats Strip | — | 4 metrics: videos, hours, comments, most-watched |
| 4 | Feature Block | § 02 | Editorial pick (1.3fr/1fr) + 3 sidekicks + series chips. Pick = video with `is_featured=true` (most recent if multiple), fallback = most recent video overall |
| 5 | Bookmark Ad | — | Sponsor ad (between Feature and Comments) |
| 6 | Comments Wall | § 03 | Curated comments (1fr/2fr, 2×2 grid, locale-filtered) |
| 7 | Marginalia Ad | — | House ad (after Comments) |
| 8 | Archive | § 04 | Filter bar + 3-column paged grid |
| 9 | Bowtie Ad | — | Quiet variant newsletter CTA (after Archive) |
| 10 | Subscribe | — | Duplex subscribe block (both channels) |

### Hero — Locale-Adaptive Layout

**PT-BR locale** (both channels, 50/50 hero):
- Left column (1.35fr): Kicker "§ 01 · esta semana, em dois canais" + display title "Dois canais, uma cabeça" with golden marker underline (`isolation: isolate` for z-index fix) + description + latest PT video card (Paper + Tape, grid 1.2fr/1fr with thumb + meta)
- Right column (1fr): Flag badge "🇺🇸 EN" + "também rolou no @thiagofigueiredo" + latest EN video card (Paper + Tape, full-width thumb) + "anteriores em inglês" list (2 older EN videos as plain links)

**EN locale** (EN channel only, full-width hero):
- Full-width: Kicker "§ 01 · latest video" + display title "Live-coding, in English." with marker + description + 2fr/1fr grid: big latest EN card + 2 sidekick items

### Filter Bar (Archive Section)

1. **Search input** (monospace, with ⌕ icon) + **channel filter** (🌐 Ambos / 🇧🇷 PT / 🇺🇸 EN) + **✕ limpar tudo** (dashed, visible when filtered)
2. **Series/category chips** (UPPERCASE): ★ Latest (virtual, default) + each `youtube_categories` row with count badge. Active = yt red bg
3. **Tag chips** (lowercase #hashtags): top 12 by usage, toggleable, accent bg when active
4. **Result count**: `{N} vídeos` + `↓ do mais novo pro mais antigo` (Caveat cursive)

**URL sync**: `?cat=build-in-public&ch=pt&tag=nextjs&q=cms` via `URLSearchParams` + `history.replaceState`

**PAGE_SIZE**: 6, with "▼ CARREGAR MAIS (N)" button

### Archive Card Anatomy

Port from `design/youtube.jsx` ArchiveCard:
- Paper background with deterministic tint: `paper` (all cards use same tint)
- Rotation: `theme.rot(index + 11)` — varies per card position
- Vertical lift: `theme.lift(index + 11)`
- Tape: `tapeR` color, position 40%, rotation `(index * 7) % 10 - 5` deg
- Video thumbnail 16/9 aspect with dot pattern overlay + play button + duration badge
- Flag badge (top-right corner of thumbnail)
- Category tag (yt red bg, uppercase monospace)
- Date (monospace, faint)
- Title (Fraunces serif, 18px, 500)
- Description (Source Serif, 12.5px, muted)
- Duration + views (monospace, 10.5px)
- Tags (max 3, monospace chips with # prefix)

### Comments Wall — Locale Filtering

Query: `WHERE (target_locale IS NULL OR target_locale = :locale) ORDER BY display_order, like_count DESC LIMIT 4`

Each comment card:
- Paper with varied tint (`i % 2 ? paper2 : paper`) and rotation
- Tape decoration
- Author avatar (gradient circle from hue) + handle + time + flag badge
- Quote text (Fraunces italic, 18px) with red `"` opening quote mark
- Footer: linked video title (truncated) + ♥ like count

### Thumbnail Rendering

Video thumbnails use the actual YouTube thumbnail URL when available. Fallback: gradient background computed from `youtube_video_id` hash + dot pattern overlay via `::after` pseudo-element:

```css
.vthumb .bg::after {
  content: '';
  position: absolute; inset: 0; opacity: 0.08;
  background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0);
  background-size: 16px 16px;
}
```

## Ad Slots

Connected to `/admin/ads` (existing `@tn-figueiredo/ad-engine@1.0.1`), NOT `/cms`.

| Slot Key | Component | Position | Default | Format |
|----------|-----------|----------|---------|--------|
| `youtube:top:doorman` | DoormanAd | Banner above header | OFF | house |
| `youtube:mid:bookmark` | BookmarkAd | Between Feature and Comments | ON | sponsor |
| `youtube:post-comments:marginalia` | MarginaliaAd | After Comments Wall | ON | house |
| `youtube:pre-subscribe:bowtie` | BowtieAd (quiet) | Between Archive and Subscribe | ON | house (newsletter) |

Resolution via existing `resolveAdCreatives()` from `apps/web/src/lib/ads/resolve.ts`.

## CMS Pages (3 new routes)

### `/cms/youtube/videos`

Video management dashboard:
- Table/grid of all videos with filters (channel, category, featured, hidden)
- Inline edit: `title_translation`, `category_id`, `is_featured`, `is_hidden`, `cms_notes`
- Bulk actions: assign category, toggle featured/hidden
- Auto-suggestion indicator: when `auto_suggested_category_id` is set but `category_id` is not, show suggestion badge with approve/reject buttons
- Sync status indicator (last synced time per channel)
- Manual "Sync Now" button (triggers sync cron with `mode=manual`)

### `/cms/youtube/categories`

Category CRUD:
- Name (pt/en), slug, color, sort_order
- `match_keywords` editor (tag-style input for adding/removing keywords)
- `auto_approve` toggle with explanation text
- Preview: "X videos would match" dry-run indicator
- Drag-to-reorder via sort_order

### `/cms/youtube/comments`

Curated comments management:
- Add comment: select video → paste author/text/likes
- Bilingual text fields (text_pt, text_en)
- `target_locale` selector: Both / PT only / EN only
- `display_order` drag-to-reorder
- Preview of how comments will appear on the page

### CMS Settings Addition

In existing `/cms/settings` page, add YouTube section:
- Per-channel sync schedules editor (day + hour + timezone)
- Sync enable/disable toggle per channel
- "Sync Now" button per channel
- Last sync status + quota usage display

## SEO

### Metadata

`generateYoutubeMetadata()` factory in `lib/seo/page-metadata.ts`:
- Title: "Vídeos — bythiagofigueiredo" / "Videos — bythiagofigueiredo"
- Description: channel description
- Canonical: `/youtube`
- OG image: site default or custom YouTube OG

### JSON-LD

- `BreadcrumbList` node: Home → Vídeos
- `VideoObject` node for each video in the archive (structured data for Google Video carousel):
  - `name`, `description`, `thumbnailUrl`, `uploadDate`, `duration` (ISO 8601), `contentUrl` (YouTube URL), `embedUrl`
- `ItemList` node wrapping VideoObject references

### Sitemap

Add `/youtube` to `enumerateSiteRoutes()` static routes list.

## Cache Invalidation

| Tag | Invalida | Trigger |
|-----|----------|---------|
| `youtube` | All YouTube data (videos, categories, channels, comments) | Sync cron completion, CMS edits |
| `youtube:video:${id}` | Per-video (if individual video pages added later) | Video update |

## Migrations

Single migration file: `supabase/migrations/YYYYMMDD_youtube_tables.sql`

Contains all 5 tables + indexes + RLS policies. Idempotent (`DROP POLICY IF EXISTS` pattern).

## Environment Variables

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `YOUTUBE_API_KEY` | Server-only | Yes | YouTube Data API v3 key |

## Feature Flags

None initially. The page is either deployed or not. If rollback needed, the route can be removed.

## Testing Strategy

- **Unit tests**: Auto-categorization pipeline (keyword matching logic), sync schedule window calculation
- **Integration tests** (DB-gated): Video upsert, category CRUD, curated comments locale filtering, sync log writes
- **E2E**: Page loads, filter interactions, load more pagination

## Open Decisions

1. ~~Separate comments by locale~~ → **Resolved**: `target_locale` field added
2. Individual video detail pages (`/youtube/[id]`) → Deferred. Currently links go to YouTube. Can add later if SEO value justifies.
3. Video embeds on the page vs YouTube links → Links only for now (simpler, faster, no iframe overhead)
