# YouTube Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `/youtube` page that syncs videos from two YouTube channels via API, stores in Supabase, supports CMS-managed categories with auto-categorization, curated locale-targeted comments, and renders using the editorial pinboard design system.

**Architecture:** RSC server component fetches all data via ISR (revalidate: 3600), passes to a client component that handles filtering/search/load-more/URL-sync. Sync cron runs on 3 schedules (posting windows, daily catch-all, metrics refresh). CMS pages manage categories, videos, and curated comments.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, Supabase, YouTube Data API v3, Vitest, existing `@tn-figueiredo/ad-engine@1.0.1`

**Design reference:** `design/youtube.jsx` (1109 lines) — the source of truth for all frontend styling, layout, and component structure.

---

## File Structure

```
supabase/migrations/
  20260505000001_youtube_tables.sql           # 5 tables + indexes + RLS

apps/web/
├── src/
│   ├── lib/youtube/
│   │   ├── types.ts                          # DB row types + frontend view types
│   │   ├── api-client.ts                     # YouTube Data API v3 wrapper
│   │   ├── auto-categorize.ts                # Keyword matching pipeline
│   │   ├── schedule-window.ts                # Posting-window time checker
│   │   ├── sync.ts                           # Sync orchestrator (fetch + upsert + categorize)
│   │   └── queries.ts                        # Supabase read queries for frontend
│   ├── app/
│   │   ├── (public)/youtube/
│   │   │   ├── page.tsx                      # Server component (data fetch + SEO)
│   │   │   ├── youtube-page-client.tsx        # Client root (filtering state + URL sync)
│   │   │   ├── youtube-hero.tsx               # Locale-adaptive hero (PT split / EN full)
│   │   │   ├── youtube-channel-strip.tsx      # Channel duplex cards
│   │   │   ├── youtube-stats-strip.tsx        # 4-metric strip
│   │   │   ├── youtube-feature-block.tsx      # Editorial pick + 3 sidekicks
│   │   │   ├── youtube-comments-wall.tsx      # Curated comments 2×2 grid
│   │   │   ├── youtube-archive.tsx            # Filter bar + archive grid + load more
│   │   │   ├── youtube-archive-card.tsx       # Single archive card
│   │   │   ├── youtube-subscribe.tsx          # Duplex subscribe CTA
│   │   │   └── youtube-types.ts               # Client-side prop types
│   │   ├── api/cron/sync-youtube/
│   │   │   └── route.ts                      # Cron endpoint (3 modes)
│   │   └── cms/(authed)/youtube/
│   │       ├── videos/
│   │       │   ├── page.tsx                  # Video management dashboard
│   │       │   └── actions.ts                # Video server actions
│   │       ├── categories/
│   │       │   ├── page.tsx                  # Category CRUD
│   │       │   └── actions.ts                # Category server actions
│   │       └── comments/
│   │           ├── page.tsx                  # Curated comments CRUD
│   │           └── actions.ts                # Comments server actions
│   └── components/layout/
│       └── header-types.ts                   # MODIFY: YouTube nav → internal /youtube
├── lib/
│   └── seo/
│       ├── page-metadata.ts                  # MODIFY: add generateYoutubeMetadata()
│       └── enumerator.ts                     # MODIFY: add /youtube to static routes
├── test/
│   └── youtube/
│       ├── auto-categorize.test.ts           # Unit: keyword matching
│       ├── schedule-window.test.ts           # Unit: posting window checker
│       ├── api-client.test.ts                # Unit: API response parsing
│       └── sync.test.ts                      # Unit: sync orchestrator
└── vercel.json                               # MODIFY: add 3 cron entries
```

---

### Task 1: Database Migration — 5 Tables + RLS

**Files:**
- Create: `supabase/migrations/20260505000001_youtube_tables.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- YouTube tables: categories, channels, videos, curated_comments, sync_log

-- ─── youtube_categories ───
CREATE TABLE IF NOT EXISTS youtube_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id),
  slug text NOT NULL,
  name_pt text NOT NULL,
  name_en text NOT NULL,
  description_pt text,
  description_en text,
  color text NOT NULL DEFAULT '#FF8240',
  sort_order int NOT NULL DEFAULT 0,
  match_keywords text[] NOT NULL DEFAULT '{}',
  auto_approve boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, slug)
);

ALTER TABLE youtube_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube_categories_public_read" ON youtube_categories;
CREATE POLICY "youtube_categories_public_read" ON youtube_categories
  FOR SELECT USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "youtube_categories_staff_write" ON youtube_categories;
CREATE POLICY "youtube_categories_staff_write" ON youtube_categories
  FOR ALL TO authenticated USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ─── youtube_channels ───
CREATE TABLE IF NOT EXISTS youtube_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id),
  channel_id text NOT NULL,
  locale text NOT NULL CHECK (locale IN ('pt', 'en')),
  handle text NOT NULL,
  name text NOT NULL,
  description text,
  uploads_playlist_id text NOT NULL,
  subscriber_count int NOT NULL DEFAULT 0,
  video_count int NOT NULL DEFAULT 0,
  thumbnail_url text,
  banner_url text,
  custom_url text,
  sync_enabled boolean NOT NULL DEFAULT true,
  sync_schedules jsonb NOT NULL DEFAULT '[]',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, channel_id),
  UNIQUE(site_id, locale)
);

ALTER TABLE youtube_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube_channels_public_read" ON youtube_channels;
CREATE POLICY "youtube_channels_public_read" ON youtube_channels
  FOR SELECT USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "youtube_channels_staff_write" ON youtube_channels;
CREATE POLICY "youtube_channels_staff_write" ON youtube_channels
  FOR ALL TO authenticated USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ─── youtube_videos ───
CREATE TABLE IF NOT EXISTS youtube_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id),
  channel_id uuid NOT NULL REFERENCES youtube_channels(id),
  youtube_video_id text NOT NULL,
  title text NOT NULL,
  title_translation text,
  description text,
  description_translation text,
  duration text NOT NULL DEFAULT '0:00',
  duration_seconds int NOT NULL DEFAULT 0,
  published_at timestamptz NOT NULL,
  thumbnail_url text,
  thumbnail_hq_url text,
  tags text[] NOT NULL DEFAULT '{}',
  view_count int NOT NULL DEFAULT 0,
  like_count int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  category_id uuid REFERENCES youtube_categories(id) ON DELETE SET NULL,
  auto_suggested_category_id uuid REFERENCES youtube_categories(id) ON DELETE SET NULL,
  is_featured boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  cms_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, youtube_video_id)
);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_published ON youtube_videos(site_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel ON youtube_videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_category ON youtube_videos(category_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_featured ON youtube_videos(site_id, is_featured) WHERE is_featured = true;

ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube_videos_public_read" ON youtube_videos;
CREATE POLICY "youtube_videos_public_read" ON youtube_videos
  FOR SELECT USING (public.site_visible(site_id) AND is_hidden = false);

DROP POLICY IF EXISTS "youtube_videos_staff_read_all" ON youtube_videos;
CREATE POLICY "youtube_videos_staff_read_all" ON youtube_videos
  FOR SELECT TO authenticated USING (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "youtube_videos_staff_write" ON youtube_videos;
CREATE POLICY "youtube_videos_staff_write" ON youtube_videos
  FOR ALL TO authenticated USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ─── youtube_curated_comments ───
CREATE TABLE IF NOT EXISTS youtube_curated_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id),
  video_id uuid NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE,
  author_handle text NOT NULL,
  author_avatar_url text,
  text_pt text NOT NULL,
  text_en text NOT NULL,
  like_count int NOT NULL DEFAULT 0,
  display_order int NOT NULL DEFAULT 0,
  target_locale text CHECK (target_locale IS NULL OR target_locale IN ('pt', 'en')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curated_comments_locale ON youtube_curated_comments(site_id, target_locale);

ALTER TABLE youtube_curated_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube_curated_comments_public_read" ON youtube_curated_comments;
CREATE POLICY "youtube_curated_comments_public_read" ON youtube_curated_comments
  FOR SELECT USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "youtube_curated_comments_staff_write" ON youtube_curated_comments;
CREATE POLICY "youtube_curated_comments_staff_write" ON youtube_curated_comments
  FOR ALL TO authenticated USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ─── youtube_sync_log ───
CREATE TABLE IF NOT EXISTS youtube_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id),
  channel_id uuid REFERENCES youtube_channels(id),
  mode text NOT NULL CHECK (mode IN ('schedule', 'catchall', 'metrics', 'manual')),
  status text NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
  videos_found int NOT NULL DEFAULT 0,
  videos_inserted int NOT NULL DEFAULT 0,
  videos_updated int NOT NULL DEFAULT 0,
  error_message text,
  quota_used int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_recent ON youtube_sync_log(site_id, created_at DESC);

ALTER TABLE youtube_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube_sync_log_staff_read" ON youtube_sync_log;
CREATE POLICY "youtube_sync_log_staff_read" ON youtube_sync_log
  FOR SELECT TO authenticated USING (public.can_edit_site(site_id));
```

- [ ] **Step 2: Validate migration locally (if DB running)**

Run: `npm run db:reset` (if local Supabase is up)

- [ ] **Step 3: Push to prod**

Run: `npm run db:push:prod`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260505000001_youtube_tables.sql
git commit -m "feat(youtube): add 5 tables — categories, channels, videos, comments, sync_log"
```

---

### Task 2: Types — Shared DB Row Types + Frontend View Types

**Files:**
- Create: `apps/web/src/lib/youtube/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
export interface YouTubeChannelRow {
  id: string
  site_id: string
  channel_id: string
  locale: 'pt' | 'en'
  handle: string
  name: string
  description: string | null
  uploads_playlist_id: string
  subscriber_count: number
  video_count: number
  thumbnail_url: string | null
  banner_url: string | null
  custom_url: string | null
  sync_enabled: boolean
  sync_schedules: SyncScheduleEntry[]
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface SyncScheduleEntry {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  hour: number
  tz: string
  label: string
}

export interface YouTubeCategoryRow {
  id: string
  site_id: string
  slug: string
  name_pt: string
  name_en: string
  description_pt: string | null
  description_en: string | null
  color: string
  sort_order: number
  match_keywords: string[]
  auto_approve: boolean
  created_at: string
  updated_at: string
}

export interface YouTubeVideoRow {
  id: string
  site_id: string
  channel_id: string
  youtube_video_id: string
  title: string
  title_translation: string | null
  description: string | null
  description_translation: string | null
  duration: string
  duration_seconds: number
  published_at: string
  thumbnail_url: string | null
  thumbnail_hq_url: string | null
  tags: string[]
  view_count: number
  like_count: number
  comment_count: number
  category_id: string | null
  auto_suggested_category_id: string | null
  is_featured: boolean
  is_hidden: boolean
  cms_notes: string | null
  created_at: string
  updated_at: string
}

export interface YouTubeCuratedCommentRow {
  id: string
  site_id: string
  video_id: string
  author_handle: string
  author_avatar_url: string | null
  text_pt: string
  text_en: string
  like_count: number
  display_order: number
  target_locale: 'pt' | 'en' | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface YouTubeSyncLogRow {
  id: string
  site_id: string
  channel_id: string | null
  mode: 'schedule' | 'catchall' | 'metrics' | 'manual'
  status: 'started' | 'completed' | 'failed' | 'skipped'
  videos_found: number
  videos_inserted: number
  videos_updated: number
  error_message: string | null
  quota_used: number
  started_at: string
  completed_at: string | null
  created_at: string
}

// ── Frontend view types (serialized from server → client) ──

export interface YouTubeVideoView {
  id: string
  youtubeVideoId: string
  title: string
  titleTranslation: string | null
  description: string | null
  descriptionTranslation: string | null
  duration: string
  durationSeconds: number
  publishedAt: string
  thumbnailUrl: string | null
  thumbnailHqUrl: string | null
  tags: string[]
  viewCount: number
  likeCount: number
  commentCount: number
  locale: 'pt' | 'en'
  channelHandle: string
  categorySlug: string | null
  categoryName: string | null
  categoryColor: string | null
  isFeatured: boolean
}

export interface YouTubeChannelView {
  id: string
  locale: 'pt' | 'en'
  handle: string
  name: string
  description: string | null
  subscriberCount: number
  videoCount: number
  thumbnailUrl: string | null
  url: string
}

export interface YouTubeCategoryView {
  slug: string
  namePt: string
  nameEn: string
  color: string
  count: number
}

export interface YouTubeCuratedCommentView {
  id: string
  videoId: string
  videoTitle: string
  videoYoutubeId: string
  authorHandle: string
  authorAvatarUrl: string | null
  textPt: string
  textEn: string
  likeCount: number
  channelLocale: 'pt' | 'en'
  publishedAt: string | null
}

export interface YouTubePageData {
  videos: YouTubeVideoView[]
  channels: YouTubeChannelView[]
  categories: YouTubeCategoryView[]
  comments: YouTubeCuratedCommentView[]
  totalVideoCount: number
  totalDurationSeconds: number
}

export type SyncMode = 'schedule' | 'catchall' | 'metrics' | 'manual'
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/youtube/types.ts
git commit -m "feat(youtube): add shared types for DB rows and frontend views"
```

---

### Task 3: Auto-Categorization Pipeline (TDD)

**Files:**
- Create: `apps/web/test/youtube/auto-categorize.test.ts`
- Create: `apps/web/src/lib/youtube/auto-categorize.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest'
import { autoCategorize } from '@/lib/youtube/auto-categorize'
import type { YouTubeCategoryRow } from '@/lib/youtube/types'

const makeCategory = (overrides: Partial<YouTubeCategoryRow> = {}): YouTubeCategoryRow => ({
  id: 'cat-1',
  site_id: 'site-1',
  slug: 'build-in-public',
  name_pt: 'Build in Public',
  name_en: 'Build in Public',
  description_pt: null,
  description_en: null,
  color: '#FF8240',
  sort_order: 0,
  match_keywords: ['build in public', 'live coding', 'building'],
  auto_approve: false,
  created_at: '',
  updated_at: '',
  ...overrides,
})

describe('autoCategorize', () => {
  const categories = [
    makeCategory({ id: 'cat-bip', slug: 'build-in-public', match_keywords: ['build in public', 'live coding'] }),
    makeCategory({ id: 'cat-setup', slug: 'dev-setup', match_keywords: ['setup', 'home office', 'desk tour'], auto_approve: true }),
    makeCategory({ id: 'cat-debug', slug: 'debugging', match_keywords: ['bug', 'debug', 'fix'] }),
  ]

  it('matches title case-insensitively', () => {
    const result = autoCategorize(
      { title: 'My LIVE CODING session', tags: [], description: '' },
      categories,
    )
    expect(result?.categoryId).toBe('cat-bip')
  })

  it('matches tags', () => {
    const result = autoCategorize(
      { title: 'Untitled', tags: ['home office', 'gear'], description: '' },
      categories,
    )
    expect(result?.categoryId).toBe('cat-setup')
  })

  it('matches description', () => {
    const result = autoCategorize(
      { title: 'Untitled', tags: [], description: 'How I fixed a nasty bug in production' },
      categories,
    )
    expect(result?.categoryId).toBe('cat-debug')
  })

  it('returns null when no match', () => {
    const result = autoCategorize(
      { title: 'Random vlog', tags: ['travel'], description: 'Some description' },
      categories,
    )
    expect(result).toBeNull()
  })

  it('returns first match by sort_order', () => {
    const overlapping = [
      makeCategory({ id: 'cat-a', slug: 'a', match_keywords: ['coding'], sort_order: 1 }),
      makeCategory({ id: 'cat-b', slug: 'b', match_keywords: ['coding'], sort_order: 0 }),
    ]
    const result = autoCategorize(
      { title: 'Live coding', tags: [], description: '' },
      overlapping,
    )
    expect(result?.categoryId).toBe('cat-b')
  })

  it('reports autoApprove flag from matched category', () => {
    const result = autoCategorize(
      { title: 'My desk tour and setup', tags: [], description: '' },
      categories,
    )
    expect(result?.categoryId).toBe('cat-setup')
    expect(result?.autoApprove).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/web && npx vitest run test/youtube/auto-categorize.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement auto-categorize**

```typescript
import type { YouTubeCategoryRow } from './types'

interface VideoInput {
  title: string
  tags: string[]
  description: string
}

interface CategorizeResult {
  categoryId: string
  autoApprove: boolean
}

export function autoCategorize(
  video: VideoInput,
  categories: YouTubeCategoryRow[],
): CategorizeResult | null {
  const searchable = [video.title, ...video.tags, video.description]
    .join(' ')
    .toLowerCase()

  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order)

  for (const cat of sorted) {
    const matched = cat.match_keywords.some(
      (kw) => searchable.includes(kw.toLowerCase()),
    )
    if (matched) {
      return { categoryId: cat.id, autoApprove: cat.auto_approve }
    }
  }

  return null
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd apps/web && npx vitest run test/youtube/auto-categorize.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/youtube/auto-categorize.test.ts apps/web/src/lib/youtube/auto-categorize.ts
git commit -m "feat(youtube): auto-categorization pipeline with keyword matching"
```

---

### Task 4: Schedule Window Checker (TDD)

**Files:**
- Create: `apps/web/test/youtube/schedule-window.test.ts`
- Create: `apps/web/src/lib/youtube/schedule-window.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { isInPostingWindow } from '@/lib/youtube/schedule-window'
import type { SyncScheduleEntry } from '@/lib/youtube/types'

describe('isInPostingWindow', () => {
  afterEach(() => { vi.useRealTimers() })

  const schedule: SyncScheduleEntry[] = [
    { day: 'wednesday', hour: 9, tz: 'America/Sao_Paulo', label: 'Quarta 9h' },
    { day: 'sunday', hour: 23, tz: 'America/Sao_Paulo', label: 'Domingo 23h' },
  ]

  it('returns true when within 45 min after posting window', () => {
    // Wednesday 9:30 AM São Paulo = within 45 min of 9:00
    vi.setSystemTime(new Date('2026-05-06T12:30:00Z')) // Wed 9:30 BRT (UTC-3)
    expect(isInPostingWindow(schedule)).toBe(true)
  })

  it('returns false when outside all windows', () => {
    // Monday 10:00 São Paulo — no posting window
    vi.setSystemTime(new Date('2026-05-04T13:00:00Z')) // Mon 10:00 BRT
    expect(isInPostingWindow(schedule)).toBe(false)
  })

  it('returns false when >45 min past window', () => {
    // Wednesday 10:00 São Paulo = 60 min past 9:00
    vi.setSystemTime(new Date('2026-05-06T13:00:00Z')) // Wed 10:00 BRT
    expect(isInPostingWindow(schedule)).toBe(false)
  })

  it('returns true at exact posting time', () => {
    // Wednesday 9:00 São Paulo exact
    vi.setSystemTime(new Date('2026-05-06T12:00:00Z')) // Wed 9:00 BRT
    expect(isInPostingWindow(schedule)).toBe(true)
  })

  it('returns true for sunday window', () => {
    // Sunday 23:20 São Paulo
    vi.setSystemTime(new Date('2026-05-10T02:20:00Z')) // Sun 23:20 BRT
    expect(isInPostingWindow(schedule)).toBe(true)
  })

  it('returns false for empty schedule', () => {
    vi.setSystemTime(new Date('2026-05-06T12:30:00Z'))
    expect(isInPostingWindow([])).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/web && npx vitest run test/youtube/schedule-window.test.ts`

- [ ] **Step 3: Implement schedule-window**

```typescript
import type { SyncScheduleEntry } from './types'

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

const WINDOW_MINUTES = 45

export function isInPostingWindow(schedule: SyncScheduleEntry[]): boolean {
  if (schedule.length === 0) return false

  const now = new Date()

  for (const entry of schedule) {
    const targetDay = DAY_MAP[entry.day]
    if (targetDay === undefined) continue

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: entry.tz,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    })

    const parts = formatter.formatToParts(now)
    const nowDay = parts.find((p) => p.type === 'weekday')?.value
    const nowHour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
    const nowMinute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)

    const dayNames: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    }
    const currentDay = dayNames[nowDay ?? ''] ?? -1

    if (currentDay !== targetDay) continue

    const nowTotalMinutes = nowHour * 60 + nowMinute
    const targetTotalMinutes = entry.hour * 60

    const diff = nowTotalMinutes - targetTotalMinutes
    if (diff >= 0 && diff <= WINDOW_MINUTES) return true
  }

  return false
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd apps/web && npx vitest run test/youtube/schedule-window.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/youtube/schedule-window.test.ts apps/web/src/lib/youtube/schedule-window.ts
git commit -m "feat(youtube): posting window checker for smart cron scheduling"
```

---

### Task 5: YouTube API Client (TDD)

**Files:**
- Create: `apps/web/test/youtube/api-client.test.ts`
- Create: `apps/web/src/lib/youtube/api-client.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchRecentVideoIds,
  fetchVideoDetails,
  fetchChannelStats,
  parseDuration,
} from '@/lib/youtube/api-client'

describe('parseDuration', () => {
  it('parses PT14M32S', () => {
    expect(parseDuration('PT14M32S')).toEqual({ text: '14:32', seconds: 872 })
  })
  it('parses PT1H2M3S', () => {
    expect(parseDuration('PT1H2M3S')).toEqual({ text: '1:02:03', seconds: 3723 })
  })
  it('parses PT5M', () => {
    expect(parseDuration('PT5M')).toEqual({ text: '5:00', seconds: 300 })
  })
  it('parses PT30S', () => {
    expect(parseDuration('PT30S')).toEqual({ text: '0:30', seconds: 30 })
  })
  it('handles empty string', () => {
    expect(parseDuration('')).toEqual({ text: '0:00', seconds: 0 })
  })
})

describe('fetchRecentVideoIds', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns video IDs from playlistItems response', async () => {
    const mockResponse = {
      items: [
        { contentDetails: { videoId: 'vid1' } },
        { contentDetails: { videoId: 'vid2' } },
      ],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const ids = await fetchRecentVideoIds('PLtest123', 'test-key')
    expect(ids).toEqual(['vid1', 'vid2'])
  })

  it('throws on quota exceeded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { errors: [{ reason: 'quotaExceeded' }] } }), { status: 403 }),
    )

    await expect(fetchRecentVideoIds('PLtest', 'test-key')).rejects.toThrow('quotaExceeded')
  })
})

describe('fetchVideoDetails', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('parses video metadata correctly', async () => {
    const mockResponse = {
      items: [{
        id: 'vid1',
        snippet: {
          title: 'Test Video',
          description: 'Test desc',
          publishedAt: '2026-05-01T10:00:00Z',
          tags: ['nextjs', 'typescript'],
          thumbnails: {
            medium: { url: 'https://i.ytimg.com/vi/vid1/mqdefault.jpg' },
            high: { url: 'https://i.ytimg.com/vi/vid1/hqdefault.jpg' },
          },
        },
        contentDetails: { duration: 'PT14M32S' },
        statistics: { viewCount: '8200', likeCount: '412', commentCount: '38' },
      }],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const videos = await fetchVideoDetails(['vid1'], 'test-key')
    expect(videos).toHaveLength(1)
    expect(videos[0]).toMatchObject({
      youtubeVideoId: 'vid1',
      title: 'Test Video',
      description: 'Test desc',
      duration: '14:32',
      durationSeconds: 872,
      tags: ['nextjs', 'typescript'],
      viewCount: 8200,
      likeCount: 412,
      commentCount: 38,
    })
  })
})

describe('fetchChannelStats', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns subscriber and video counts', async () => {
    const mockResponse = {
      items: [{
        statistics: { subscriberCount: '4200', videoCount: '48' },
      }],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const stats = await fetchChannelStats('UCtest', 'test-key')
    expect(stats).toEqual({ subscriberCount: 4200, videoCount: 48 })
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/web && npx vitest run test/youtube/api-client.test.ts`

- [ ] **Step 3: Implement API client**

```typescript
const BASE = 'https://www.googleapis.com/youtube/v3'

export class YouTubeQuotaError extends Error {
  constructor() { super('quotaExceeded') }
}

async function ytFetch(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const reason = body?.error?.errors?.[0]?.reason
    if (reason === 'quotaExceeded') throw new YouTubeQuotaError()
    throw new Error(`YouTube API 403: ${reason ?? 'forbidden'}`)
  }
  if (!res.ok) throw new Error(`YouTube API ${res.status}`)
  return res.json()
}

export function parseDuration(iso: string): { text: string; seconds: number } {
  if (!iso) return { text: '0:00', seconds: 0 }
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return { text: '0:00', seconds: 0 }
  const h = parseInt(match[1] || '0', 10)
  const m = parseInt(match[2] || '0', 10)
  const s = parseInt(match[3] || '0', 10)
  const seconds = h * 3600 + m * 60 + s
  const text = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
  return { text, seconds }
}

export async function fetchRecentVideoIds(
  playlistId: string,
  apiKey: string,
  maxResults = 10,
): Promise<string[]> {
  const url = `${BASE}/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=${maxResults}&key=${apiKey}`
  const data = (await ytFetch(url)) as { items?: { contentDetails: { videoId: string } }[] }
  return (data.items ?? []).map((item) => item.contentDetails.videoId)
}

export interface ParsedVideo {
  youtubeVideoId: string
  title: string
  description: string
  publishedAt: string
  tags: string[]
  thumbnailUrl: string | null
  thumbnailHqUrl: string | null
  duration: string
  durationSeconds: number
  viewCount: number
  likeCount: number
  commentCount: number
}

export async function fetchVideoDetails(
  videoIds: string[],
  apiKey: string,
): Promise<ParsedVideo[]> {
  if (videoIds.length === 0) return []
  const ids = videoIds.join(',')
  const url = `${BASE}/videos?part=snippet,contentDetails,statistics&id=${ids}&key=${apiKey}`
  const data = (await ytFetch(url)) as { items?: Array<{
    id: string
    snippet: {
      title: string; description: string; publishedAt: string; tags?: string[]
      thumbnails: { medium?: { url: string }; high?: { url: string } }
    }
    contentDetails: { duration: string }
    statistics: { viewCount?: string; likeCount?: string; commentCount?: string }
  }> }

  return (data.items ?? []).map((item) => {
    const { text, seconds } = parseDuration(item.contentDetails.duration)
    return {
      youtubeVideoId: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      tags: item.snippet.tags ?? [],
      thumbnailUrl: item.snippet.thumbnails.medium?.url ?? null,
      thumbnailHqUrl: item.snippet.thumbnails.high?.url ?? null,
      duration: text,
      durationSeconds: seconds,
      viewCount: parseInt(item.statistics.viewCount ?? '0', 10),
      likeCount: parseInt(item.statistics.likeCount ?? '0', 10),
      commentCount: parseInt(item.statistics.commentCount ?? '0', 10),
    }
  })
}

export async function fetchChannelStats(
  channelId: string,
  apiKey: string,
): Promise<{ subscriberCount: number; videoCount: number }> {
  const url = `${BASE}/channels?part=statistics&id=${channelId}&key=${apiKey}`
  const data = (await ytFetch(url)) as { items?: Array<{
    statistics: { subscriberCount?: string; videoCount?: string }
  }> }
  const stats = data.items?.[0]?.statistics
  return {
    subscriberCount: parseInt(stats?.subscriberCount ?? '0', 10),
    videoCount: parseInt(stats?.videoCount ?? '0', 10),
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd apps/web && npx vitest run test/youtube/api-client.test.ts`
Expected: 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/youtube/api-client.test.ts apps/web/src/lib/youtube/api-client.ts
git commit -m "feat(youtube): API client with parseDuration, video/channel fetchers"
```

---

### Task 6: Sync Orchestrator

**Files:**
- Create: `apps/web/src/lib/youtube/sync.ts`

- [ ] **Step 1: Implement the sync orchestrator**

This module ties together the API client, auto-categorization, and Supabase upserts. It's called by the cron endpoint.

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchRecentVideoIds, fetchVideoDetails, fetchChannelStats, YouTubeQuotaError } from './api-client'
import { autoCategorize } from './auto-categorize'
import type { YouTubeChannelRow, YouTubeCategoryRow, SyncMode } from './types'

interface SyncResult {
  videosFound: number
  videosInserted: number
  videosUpdated: number
  quotaUsed: number
}

export async function syncChannel(
  supabase: SupabaseClient,
  channel: YouTubeChannelRow,
  apiKey: string,
  mode: SyncMode,
): Promise<SyncResult> {
  const result: SyncResult = { videosFound: 0, videosInserted: 0, videosUpdated: 0, quotaUsed: 0 }

  if (mode === 'metrics') {
    return refreshMetrics(supabase, channel, apiKey, result)
  }

  const videoIds = await fetchRecentVideoIds(channel.uploads_playlist_id, apiKey)
  result.quotaUsed += 1

  const { data: existing } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('channel_id', channel.id)
    .in('youtube_video_id', videoIds)

  const existingIds = new Set((existing ?? []).map((r: { youtube_video_id: string }) => r.youtube_video_id))
  const newIds = videoIds.filter((id) => !existingIds.has(id))
  result.videosFound = videoIds.length

  if (newIds.length === 0) return result

  const details = await fetchVideoDetails(newIds, apiKey)
  result.quotaUsed += 1

  const { data: categories } = await supabase
    .from('youtube_categories')
    .select('*')
    .eq('site_id', channel.site_id)
    .order('sort_order')

  for (const video of details) {
    const cat = autoCategorize(
      { title: video.title, tags: video.tags, description: video.description },
      (categories ?? []) as YouTubeCategoryRow[],
    )

    const row = {
      site_id: channel.site_id,
      channel_id: channel.id,
      youtube_video_id: video.youtubeVideoId,
      title: video.title,
      description: video.description,
      duration: video.duration,
      duration_seconds: video.durationSeconds,
      published_at: video.publishedAt,
      thumbnail_url: video.thumbnailUrl,
      thumbnail_hq_url: video.thumbnailHqUrl,
      tags: video.tags,
      view_count: video.viewCount,
      like_count: video.likeCount,
      comment_count: video.commentCount,
      auto_suggested_category_id: cat?.categoryId ?? null,
      category_id: cat?.autoApprove ? cat.categoryId : null,
    }

    const { error } = await supabase.from('youtube_videos').upsert(row, {
      onConflict: 'site_id,youtube_video_id',
    })

    if (!error) result.videosInserted += 1
  }

  const stats = await fetchChannelStats(channel.channel_id, apiKey)
  result.quotaUsed += 1

  await supabase.from('youtube_channels').update({
    subscriber_count: stats.subscriberCount,
    video_count: stats.videoCount,
    last_synced_at: new Date().toISOString(),
  }).eq('id', channel.id)

  return result
}

async function refreshMetrics(
  supabase: SupabaseClient,
  channel: YouTubeChannelRow,
  apiKey: string,
  result: SyncResult,
): Promise<SyncResult> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('channel_id', channel.id)
    .gte('published_at', thirtyDaysAgo)

  if (!recent || recent.length === 0) return result

  const ids = recent.map((r: { youtube_video_id: string }) => r.youtube_video_id)
  const batchSize = 50
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const details = await fetchVideoDetails(batch, apiKey)
    result.quotaUsed += 1

    for (const video of details) {
      await supabase.from('youtube_videos').update({
        view_count: video.viewCount,
        like_count: video.likeCount,
        comment_count: video.commentCount,
      }).eq('site_id', channel.site_id).eq('youtube_video_id', video.youtubeVideoId)
      result.videosUpdated += 1
    }
  }

  return result
}

export { YouTubeQuotaError }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/youtube/sync.ts
git commit -m "feat(youtube): sync orchestrator — fetch, upsert, auto-categorize, metrics refresh"
```

---

### Task 7: Cron Endpoint

**Files:**
- Create: `apps/web/src/app/api/cron/sync-youtube/route.ts`
- Modify: `apps/web/vercel.json`

- [ ] **Step 1: Implement the cron route**

```typescript
import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { syncChannel, YouTubeQuotaError } from '@/lib/youtube/sync'
import { isInPostingWindow } from '@/lib/youtube/schedule-window'
import type { YouTubeChannelRow, SyncMode } from '@/lib/youtube/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const mode = (req.nextUrl.searchParams.get('mode') ?? 'catchall') as SyncMode
  if (!['schedule', 'catchall', 'metrics', 'manual'].includes(mode)) {
    return Response.json({ error: 'invalid mode' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 500 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, `sync-youtube-${mode}`, runId, 'sync-youtube', async () => {
    const { data: channels } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('sync_enabled', true)

    if (!channels || channels.length === 0) {
      return { status: 'ok' as const, message: 'no channels configured' }
    }

    let totalInserted = 0
    let totalUpdated = 0
    let totalQuota = 0

    for (const channel of channels as YouTubeChannelRow[]) {
      if (mode === 'schedule' && !isInPostingWindow(channel.sync_schedules)) {
        continue
      }

      const logEntry = {
        site_id: channel.site_id,
        channel_id: channel.id,
        mode,
        status: 'started' as const,
      }

      await supabase.from('youtube_sync_log').insert(logEntry)

      try {
        const result = await syncChannel(supabase, channel, apiKey, mode)
        totalInserted += result.videosInserted
        totalUpdated += result.videosUpdated
        totalQuota += result.quotaUsed

        await supabase.from('youtube_sync_log').insert({
          ...logEntry,
          status: 'completed',
          videos_found: result.videosFound,
          videos_inserted: result.videosInserted,
          videos_updated: result.videosUpdated,
          quota_used: result.quotaUsed,
          completed_at: new Date().toISOString(),
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)

        if (err instanceof YouTubeQuotaError) {
          await supabase.from('youtube_sync_log').insert({
            ...logEntry, status: 'failed', error_message: 'quotaExceeded',
            completed_at: new Date().toISOString(),
          })
          return { status: 'error' as const, error: 'quotaExceeded', quota_used: totalQuota }
        }

        Sentry.captureException(err, { tags: { component: 'sync-youtube', mode } })
        await supabase.from('youtube_sync_log').insert({
          ...logEntry, status: 'failed', error_message: message,
          completed_at: new Date().toISOString(),
        })
      }
    }

    if (totalInserted > 0 || totalUpdated > 0) {
      revalidateTag('youtube')
    }

    return {
      status: 'ok' as const,
      mode,
      inserted: totalInserted,
      updated: totalUpdated,
      quota_used: totalQuota,
    }
  })
}
```

- [ ] **Step 2: Add cron entries to vercel.json**

Add these 3 entries to the existing `crons` array in `apps/web/vercel.json`:

```json
{ "path": "/api/cron/sync-youtube?mode=schedule", "schedule": "*/30 * * * *" },
{ "path": "/api/cron/sync-youtube?mode=catchall", "schedule": "0 7 * * *" },
{ "path": "/api/cron/sync-youtube?mode=metrics", "schedule": "0 12,20 * * *" }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/cron/sync-youtube/route.ts apps/web/vercel.json
git commit -m "feat(youtube): sync cron endpoint — 3 modes (schedule, catchall, metrics)"
```

---

### Task 8: Supabase Read Queries for Frontend

**Files:**
- Create: `apps/web/src/lib/youtube/queries.ts`

- [ ] **Step 1: Implement queries**

```typescript
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type {
  YouTubeVideoRow, YouTubeChannelRow, YouTubeCategoryRow,
  YouTubeCuratedCommentRow, YouTubePageData, YouTubeVideoView,
  YouTubeChannelView, YouTubeCategoryView, YouTubeCuratedCommentView,
} from './types'

export const getYouTubePageData = unstable_cache(
  async (siteId: string): Promise<YouTubePageData> => {
    const supabase = getSupabaseServiceClient()

    const [videosRes, channelsRes, categoriesRes, commentsRes] = await Promise.all([
      supabase
        .from('youtube_videos')
        .select('*, youtube_channels!inner(locale, handle)')
        .eq('site_id', siteId)
        .eq('is_hidden', false)
        .order('published_at', { ascending: false }),
      supabase
        .from('youtube_channels')
        .select('*')
        .eq('site_id', siteId),
      supabase
        .from('youtube_categories')
        .select('*')
        .eq('site_id', siteId)
        .order('sort_order'),
      supabase
        .from('youtube_curated_comments')
        .select('*, youtube_videos!inner(title, youtube_video_id, youtube_channels!inner(locale))')
        .eq('site_id', siteId)
        .order('display_order')
        .order('like_count', { ascending: false }),
    ])

    const channels = (channelsRes.data ?? []) as YouTubeChannelRow[]
    const categories = (categoriesRes.data ?? []) as YouTubeCategoryRow[]
    const channelMap = new Map(channels.map((c) => [c.id, c]))
    const categoryMap = new Map(categories.map((c) => [c.id, c]))

    const videos: YouTubeVideoView[] = (videosRes.data ?? []).map((row: YouTubeVideoRow & { youtube_channels: { locale: string; handle: string } }) => {
      const cat = row.category_id ? categoryMap.get(row.category_id) : null
      return {
        id: row.id,
        youtubeVideoId: row.youtube_video_id,
        title: row.title,
        titleTranslation: row.title_translation,
        description: row.description,
        descriptionTranslation: row.description_translation,
        duration: row.duration,
        durationSeconds: row.duration_seconds,
        publishedAt: row.published_at,
        thumbnailUrl: row.thumbnail_url,
        thumbnailHqUrl: row.thumbnail_hq_url,
        tags: row.tags,
        viewCount: row.view_count,
        likeCount: row.like_count,
        commentCount: row.comment_count,
        locale: row.youtube_channels.locale as 'pt' | 'en',
        channelHandle: row.youtube_channels.handle,
        categorySlug: cat?.slug ?? null,
        categoryName: null,
        categoryColor: cat?.color ?? null,
        isFeatured: row.is_featured,
      }
    })

    const categoryCounts = new Map<string, number>()
    for (const v of videos) {
      if (v.categorySlug) {
        categoryCounts.set(v.categorySlug, (categoryCounts.get(v.categorySlug) ?? 0) + 1)
      }
    }

    const categoryViews: YouTubeCategoryView[] = categories.map((c) => ({
      slug: c.slug,
      namePt: c.name_pt,
      nameEn: c.name_en,
      color: c.color,
      count: categoryCounts.get(c.slug) ?? 0,
    }))

    const channelViews: YouTubeChannelView[] = channels.map((c) => ({
      id: c.id,
      locale: c.locale,
      handle: c.handle,
      name: c.name,
      description: c.description,
      subscriberCount: c.subscriber_count,
      videoCount: c.video_count,
      thumbnailUrl: c.thumbnail_url,
      url: `https://www.youtube.com/${c.handle}`,
    }))

    const comments: YouTubeCuratedCommentView[] = (commentsRes.data ?? []).map((row: YouTubeCuratedCommentRow & { youtube_videos: { title: string; youtube_video_id: string; youtube_channels: { locale: string } } }) => ({
      id: row.id,
      videoId: row.video_id,
      videoTitle: row.youtube_videos.title,
      videoYoutubeId: row.youtube_videos.youtube_video_id,
      authorHandle: row.author_handle,
      authorAvatarUrl: row.author_avatar_url,
      textPt: row.text_pt,
      textEn: row.text_en,
      likeCount: row.like_count,
      channelLocale: row.youtube_videos.youtube_channels.locale as 'pt' | 'en',
      publishedAt: row.published_at,
    }))

    const totalDurationSeconds = videos.reduce((sum, v) => sum + v.durationSeconds, 0)

    return {
      videos,
      channels: channelViews,
      categories: categoryViews,
      comments,
      totalVideoCount: videos.length,
      totalDurationSeconds,
    }
  },
  ['youtube-page-data'],
  { revalidate: 3600, tags: ['youtube'] },
)
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/youtube/queries.ts
git commit -m "feat(youtube): cached Supabase read queries for frontend page data"
```

---

### Task 9: SEO — Metadata + Sitemap + Nav Link

**Files:**
- Modify: `apps/web/lib/seo/page-metadata.ts`
- Modify: `apps/web/lib/seo/enumerator.ts`
- Modify: `apps/web/src/components/layout/header-types.ts`

- [ ] **Step 1: Add `generateYoutubeMetadata()` to `page-metadata.ts`**

Add this function after the existing `generateNewsletterLandingMetadata`:

```typescript
export function generateYoutubeMetadata(
  config: SiteSeoConfig,
  locale: string,
): Metadata {
  const isEn = locale === 'en'
  const title = isEn ? 'Videos' : 'Vídeos'
  const description = isEn
    ? 'Live-coding, dev setup, career insights — two YouTube channels, one head.'
    : 'Live-coding, dev setup, carreira — dois canais no YouTube, uma cabeça.'

  return {
    title: `${title} — ${config.siteName}`,
    description,
    alternates: {
      canonical: `${config.siteUrl}/youtube`,
      languages: {
        'pt-BR': `${config.siteUrl}/youtube`,
        en: `${config.siteUrl}/youtube`,
      },
    },
    openGraph: {
      title: `${title} — ${config.siteName}`,
      description,
      url: `${config.siteUrl}/youtube`,
      siteName: config.siteName,
      type: 'website',
      images: [{ url: config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png` }],
    },
    twitter: {
      card: 'summary_large_image',
      site: config.twitterHandle ? `@${config.twitterHandle}` : undefined,
    },
  }
}
```

- [ ] **Step 2: Add `/youtube` to static routes in `enumerator.ts`**

In the `staticRoutes` array inside `enumerateSiteRoutes`, add:

```typescript
{ url: '/youtube', priority: 0.7, changeFrequency: 'weekly' as const },
```

Add it after the `/about` entry.

- [ ] **Step 3: Update nav link in `header-types.ts`**

Change the YouTube nav entry from external to internal. Replace:

```typescript
{ key: 'youtube', href: YT_CHANNELS[locale].url, label: l('nav.youtube'), external: true },
```

With:

```typescript
{ key: 'youtube', href: '/youtube', label: l('nav.youtube') },
```

- [ ] **Step 4: Run tests to ensure nothing broke**

Run: `cd apps/web && npx vitest run`

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/seo/page-metadata.ts apps/web/lib/seo/enumerator.ts apps/web/src/components/layout/header-types.ts
git commit -m "feat(youtube): SEO metadata, sitemap entry, nav link → internal /youtube"
```

---

### Task 10: Server Page Component (RSC)

**Files:**
- Create: `apps/web/src/app/(public)/youtube/page.tsx`
- Create: `apps/web/src/app/(public)/youtube/youtube-types.ts`

- [ ] **Step 1: Create client-side prop types**

`youtube-types.ts`:

```typescript
export type { YouTubePageData, YouTubeVideoView, YouTubeChannelView, YouTubeCategoryView, YouTubeCuratedCommentView } from '@/lib/youtube/types'
```

- [ ] **Step 2: Create the server page component**

`page.tsx`:

```typescript
import type { Metadata } from 'next'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateYoutubeMetadata } from '@/lib/seo/page-metadata'
import { getSiteContext, tryGetSiteContext } from '@/lib/cms/site-context'
import { getYouTubePageData } from '@/lib/youtube/queries'
import { YouTubePageClient } from './youtube-page-client'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await tryGetSiteContext()
  if (!ctx) return {}
  const config = await getSiteSeoConfig(ctx.siteId)
  return generateYoutubeMetadata(config, ctx.defaultLocale)
}

export default async function YouTubePage() {
  const ctx = await getSiteContext()
  const data = await getYouTubePageData(ctx.siteId)

  return (
    <YouTubePageClient
      data={data}
      locale={ctx.defaultLocale === 'pt-BR' ? 'pt' : 'en'}
    />
  )
}
```

- [ ] **Step 3: Add JSON-LD (BreadcrumbList + ItemList + VideoObject nodes)**

In `page.tsx`, import `composeGraph` from `@/lib/seo/jsonld/graph`, `JsonLdScript` from `@/lib/seo/jsonld/render`, and the builder functions. Compose:
- `BreadcrumbList`: Home → Vídeos
- `ItemList` wrapping `VideoObject` nodes (one per video): `name`, `description`, `thumbnailUrl`, `uploadDate`, `duration` (ISO 8601 format like `PT14M32S`), `contentUrl` (`https://www.youtube.com/watch?v=${id}`), `embedUrl` (`https://www.youtube.com/embed/${id}`)

Render `<JsonLdScript graph={graph} />` inside the page. Follow the pattern from `apps/web/src/app/(public)/blog/[locale]/[slug]/page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(public)/youtube/page.tsx apps/web/src/app/(public)/youtube/youtube-types.ts
git commit -m "feat(youtube): RSC page with ISR, SEO metadata, JSON-LD, data fetching"
```

---

### Task 11: Client Page Component — Shell + Hero + Channel Strip + Stats

**Files:**
- Create: `apps/web/src/app/(public)/youtube/youtube-page-client.tsx`
- Create: `apps/web/src/app/(public)/youtube/youtube-hero.tsx`
- Create: `apps/web/src/app/(public)/youtube/youtube-channel-strip.tsx`
- Create: `apps/web/src/app/(public)/youtube/youtube-stats-strip.tsx`

This is the largest task. All components follow `design/youtube.jsx` as source of truth. The implementation must replicate the exact same structure: fonts (Fraunces, JetBrains Mono, Source Serif, Caveat), colors (`--pb-*` CSS variables + hardcoded dark theme palette), Paper/Tape from `@/components/pinboard`, and the pinboard rotation/lift functions.

- [ ] **Step 1: Create `youtube-page-client.tsx`**

Client root with filter state, URL sync, section composition. Port from `design/youtube.jsx` lines 14-101 (state + filtering logic) and lines 1004-1105 (render tree).

Key responsibilities:
- `useState` for `filters` (`cat`, `ch`, `tag`, `q`) + `page` (PAGE_SIZE = 6)
- `useEffect` for URL sync via `history.replaceState`
- Compute `filtered`, `hasFilters`, `latestPT`, `latestEN`, `featurePick`, `featureSidekicks`
- Render sections in order: Hero → ChannelStrip → StatsStrip → FeatureBlock → BookmarkAd → CommentsWall → MarginaliaAd → FilterBar + ArchiveGrid → BowtieAd → Subscribe
- Import `'use client'` at top

- [ ] **Step 2: Create `youtube-hero.tsx`**

Port from `design/youtube.jsx` HeroPT (lines 210-343) and HeroEN (lines 345-409). Use `Paper`/`Tape` from `@/components/pinboard`. The hero is locale-adaptive:
- PT: `grid-template-columns: 1.35fr 1fr` with golden marker underline (use `isolation: isolate` CSS)
- EN: full-width with `grid-template-columns: 2fr 1fr`

- [ ] **Step 3: Create `youtube-channel-strip.tsx`**

Port from `design/youtube.jsx` ChannelStrip (lines 443-482). Two-column grid with hover border color transition.

- [ ] **Step 4: Create `youtube-stats-strip.tsx`**

Port from `design/youtube.jsx` StatsStrip (lines 484-526). 4-column grid with dashed borders. Compute `hoursTotal` and `fmtNum` helper from props.

- [ ] **Step 5: Verify page renders**

Start dev server: `npm run dev -w apps/web`
Open: `http://localhost:3000/youtube`
Expected: Page renders with empty state (no videos in DB yet). Header/footer from layout.tsx appear correctly.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(public)/youtube/youtube-page-client.tsx \
  apps/web/src/app/(public)/youtube/youtube-hero.tsx \
  apps/web/src/app/(public)/youtube/youtube-channel-strip.tsx \
  apps/web/src/app/(public)/youtube/youtube-stats-strip.tsx
git commit -m "feat(youtube): client shell + hero (locale-adaptive) + channel strip + stats"
```

---

### Task 12: Feature Block + Comments Wall + Subscribe

**Files:**
- Create: `apps/web/src/app/(public)/youtube/youtube-feature-block.tsx`
- Create: `apps/web/src/app/(public)/youtube/youtube-comments-wall.tsx`
- Create: `apps/web/src/app/(public)/youtube/youtube-subscribe.tsx`

- [ ] **Step 1: Create `youtube-feature-block.tsx`**

Port from `design/youtube.jsx` FeatureBlock (lines 529-655). 1.3fr/1fr grid: big featured card (video with `is_featured=true`, fallback to most recent) + 3 sidekick cards with hover transitions + series shortcut chips at bottom.

- [ ] **Step 2: Create `youtube-comments-wall.tsx`**

Port from `design/youtube.jsx` CommentsWall (lines 658-753). 1fr/2fr grid with left editorial text + right 2×2 comment cards.

**Locale filtering logic**: Filter comments where `target_locale IS NULL OR target_locale === currentLocale`. Take top 4 by `display_order` then `like_count` desc.

Each comment card: Paper with alternating tint, Tape, author avatar (gradient circle), italic quote with red `"`, footer with video title link + heart count.

- [ ] **Step 3: Create `youtube-subscribe.tsx`**

Port from `design/youtube.jsx` SubscribeBlock (lines 942-1001). Red-tinted border box, centered text, two-column channel cards with hover lift.

- [ ] **Step 4: Verify all sections render**

Reload `http://localhost:3000/youtube` — all sections should render (with empty data gracefully handled).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/(public)/youtube/youtube-feature-block.tsx \
  apps/web/src/app/(public)/youtube/youtube-comments-wall.tsx \
  apps/web/src/app/(public)/youtube/youtube-subscribe.tsx
git commit -m "feat(youtube): feature block + comments wall (locale-filtered) + subscribe duplex"
```

---

### Task 13: Archive — Filter Bar + Grid + Card

**Files:**
- Create: `apps/web/src/app/(public)/youtube/youtube-archive.tsx`
- Create: `apps/web/src/app/(public)/youtube/youtube-archive-card.tsx`

- [ ] **Step 1: Create `youtube-archive-card.tsx`**

Port from `design/youtube.jsx` ArchiveCard (lines 884-936). Paper + Tape + VideoThumb with flag badge + category tag + title + description + duration/views + tags (max 3).

The card uses:
- `Paper` with `rotation={rot(index + 11)}` and `translateY={lift(index + 11)}`
- `Tape` with `tapeR` color, position 40%, rotation `(index * 7) % 10 - 5` deg
- YouTube thumbnail URL as `<img>` with fallback gradient + dot pattern overlay
- Flag badge positioned absolute top-right on thumbnail

- [ ] **Step 2: Create `youtube-archive.tsx`**

Port from `design/youtube.jsx` FilterBar (lines 756-881) + archive grid (lines 1034-1086).

Filter bar structure:
1. Search input (monospace) + channel toggle (🌐 Ambos / 🇧🇷 PT / 🇺🇸 EN) + clear button
2. Category chips: ★ Latest (virtual default) + DB categories with count
3. Tag chips: top 12 by usage, toggleable
4. Result count + sort annotation (Caveat cursive)
5. 3-column grid with ArchiveCard
6. "CARREGAR MAIS" button (PAGE_SIZE = 6)

Receives `filters`, `update`, `reset`, `filtered`, `visible`, `hasFilters`, `page`, `setPage` from parent via props.

- [ ] **Step 3: Verify filtering works**

Test URL params: `?cat=build-in-public&ch=pt&tag=nextjs&q=cms` should filter correctly.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(public)/youtube/youtube-archive.tsx \
  apps/web/src/app/(public)/youtube/youtube-archive-card.tsx
git commit -m "feat(youtube): archive section — filter bar + 3-col grid + paginated load more"
```

---

### Task 14: Ad Integration

**Files:**
- Modify: `apps/web/src/app/(public)/youtube/youtube-page-client.tsx`

- [ ] **Step 1: Wire ad slots into the client component**

Import existing ad components from `@/components/blog/ads/` (BookmarkAd, MarginaliaAd, DoormanAd) and the blog-ad-slots Bowtie component from `@/app/(public)/blog/blog-ad-slots.tsx`.

Use `resolveAdCreatives()` from `@/lib/ads/resolve.ts` in the server component (`page.tsx`) and pass resolved creatives as props. The 4 slot keys:
- `youtube:top:doorman` → DoormanAd (OFF default)
- `youtube:mid:bookmark` → BookmarkAd (between Feature and Comments)
- `youtube:post-comments:marginalia` → MarginaliaAd (after Comments)
- `youtube:pre-subscribe:bowtie` → BowtieAd quiet variant (after Archive)

If the ad-engine slot config doesn't have these keys yet, the resolve function will return null — the sections render conditionally: `{adBookmark && <BookmarkAd ... />}`.

- [ ] **Step 2: Update `page.tsx` to resolve ad creatives**

Add ad resolution in the server component and pass as props:

```typescript
import { resolveAdCreatives } from '@/lib/ads/resolve'

// In the page function, after getYouTubePageData:
const ads = await resolveAdCreatives(ctx.siteId, [
  'youtube:top:doorman',
  'youtube:mid:bookmark',
  'youtube:post-comments:marginalia',
  'youtube:pre-subscribe:bowtie',
])
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(public)/youtube/youtube-page-client.tsx \
  apps/web/src/app/(public)/youtube/page.tsx
git commit -m "feat(youtube): wire 4 ad slots — doorman, bookmark, marginalia, bowtie"
```

---

### Task 15: CMS — Video Management Page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/videos/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/videos/actions.ts`

- [ ] **Step 1: Create server actions**

`actions.ts` — CRUD actions following existing CMS pattern (see `apps/web/src/app/cms/(authed)/blog/actions.ts`):

```typescript
'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

const UpdateVideoSchema = z.object({
  id: z.string().uuid(),
  title_translation: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  is_featured: z.boolean().optional(),
  is_hidden: z.boolean().optional(),
  cms_notes: z.string().nullable().optional(),
})

export async function updateVideo(input: z.infer<typeof UpdateVideoSchema>) {
  const siteId = await requireEditAccess()
  const parsed = UpdateVideoSchema.parse(input)
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('youtube_videos')
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq('id', parsed.id)
    .eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  return { ok: true as const }
}

export async function approveCategory(videoId: string) {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: video } = await supabase.from('youtube_videos')
    .select('auto_suggested_category_id')
    .eq('id', videoId).eq('site_id', siteId).single()

  if (!video?.auto_suggested_category_id) return { ok: false as const, error: 'no suggestion' }

  const { error } = await supabase.from('youtube_videos')
    .update({ category_id: video.auto_suggested_category_id, updated_at: new Date().toISOString() })
    .eq('id', videoId).eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  return { ok: true as const }
}

export async function rejectCategory(videoId: string) {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('youtube_videos')
    .update({ auto_suggested_category_id: null, updated_at: new Date().toISOString() })
    .eq('id', videoId).eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  return { ok: true as const }
}

export async function triggerSync(channelId?: string) {
  const siteId = await requireEditAccess()
  const cron = process.env.CRON_SECRET
  if (!cron) return { ok: false as const, error: 'CRON_SECRET not set' }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/cron/sync-youtube?mode=manual`, {
    headers: { Authorization: `Bearer ${cron}` },
  })

  if (!res.ok) return { ok: false as const, error: `sync failed: ${res.status}` }
  revalidateTag('youtube')
  return { ok: true as const }
}
```

- [ ] **Step 2: Create page component**

`page.tsx` — server component that fetches all videos + channels + categories and renders a table/grid UI with inline editing:

```typescript
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export default async function YouTubeVideosPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'view' })

  const supabase = getSupabaseServiceClient()
  const [videosRes, channelsRes, categoriesRes] = await Promise.all([
    supabase.from('youtube_videos')
      .select('*, youtube_channels!inner(locale, handle, name)')
      .eq('site_id', siteId)
      .order('published_at', { ascending: false }),
    supabase.from('youtube_channels')
      .select('*').eq('site_id', siteId),
    supabase.from('youtube_categories')
      .select('*').eq('site_id', siteId).order('sort_order'),
  ])

  // Render table with videos, inline edit fields, category approve/reject badges,
  // channel filters, featured/hidden toggles, sync status + "Sync Now" button.
  // Follow the existing CMS page patterns (blog hub, campaigns list).
  // ...component implementation follows existing CMS UI conventions...
}
```

Implementation note: Use the existing CMS table/list component patterns from `apps/web/src/app/cms/(authed)/blog/page.tsx`. The exact UI structure (table columns, filter dropdowns, inline edit forms) should follow the established CMS conventions in this codebase.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/videos/page.tsx \
  apps/web/src/app/cms/(authed)/youtube/videos/actions.ts
git commit -m "feat(youtube/cms): video management page with inline edit + category approve/reject"
```

---

### Task 16: CMS — Categories Page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/categories/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/categories/actions.ts`

- [ ] **Step 1: Create server actions**

```typescript
'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

const CategorySchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name_pt: z.string().min(1),
  name_en: z.string().min(1),
  description_pt: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  match_keywords: z.array(z.string()),
  auto_approve: z.boolean(),
})

export async function createCategory(input: z.infer<typeof CategorySchema>) {
  const siteId = await requireEditAccess()
  const parsed = CategorySchema.parse(input)
  const supabase = getSupabaseServiceClient()

  const { data: maxOrder } = await supabase
    .from('youtube_categories')
    .select('sort_order')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const { error } = await supabase.from('youtube_categories').insert({
    ...parsed, site_id: siteId, sort_order: (maxOrder?.sort_order ?? 0) + 1,
  })

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  return { ok: true as const }
}

export async function updateCategory(id: string, input: z.infer<typeof CategorySchema>) {
  const siteId = await requireEditAccess()
  const parsed = CategorySchema.parse(input)
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('youtube_categories')
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq('id', id).eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  return { ok: true as const }
}

export async function deleteCategory(id: string) {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('youtube_categories')
    .delete().eq('id', id).eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  return { ok: true as const }
}

export async function reorderCategories(orderedIds: string[]) {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  for (let i = 0; i < orderedIds.length; i++) {
    await supabase.from('youtube_categories')
      .update({ sort_order: i })
      .eq('id', orderedIds[i]).eq('site_id', siteId)
  }

  revalidateTag('youtube')
  return { ok: true as const }
}
```

- [ ] **Step 2: Create page component**

Server component with category list, create form, keyword editor, auto_approve toggle. Follow existing CMS patterns (e.g., newsletter settings page).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/categories/page.tsx \
  apps/web/src/app/cms/(authed)/youtube/categories/actions.ts
git commit -m "feat(youtube/cms): category CRUD with keyword editor + reorder"
```

---

### Task 17: CMS — Curated Comments Page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/comments/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/comments/actions.ts`

- [ ] **Step 1: Create server actions**

```typescript
'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

const CommentSchema = z.object({
  video_id: z.string().uuid(),
  author_handle: z.string().min(1),
  author_avatar_url: z.string().nullable().optional(),
  text_pt: z.string().min(1),
  text_en: z.string().min(1),
  like_count: z.number().int().min(0),
  target_locale: z.enum(['pt', 'en']).nullable(),
  published_at: z.string().nullable().optional(),
})

export async function createComment(input: z.infer<typeof CommentSchema>) {
  const siteId = await requireEditAccess()
  const parsed = CommentSchema.parse(input)
  const supabase = getSupabaseServiceClient()

  const { data: maxOrder } = await supabase
    .from('youtube_curated_comments')
    .select('display_order')
    .eq('site_id', siteId)
    .order('display_order', { ascending: false })
    .limit(1)
    .single()

  const { error } = await supabase.from('youtube_curated_comments').insert({
    ...parsed, site_id: siteId, display_order: (maxOrder?.display_order ?? 0) + 1,
  })

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  return { ok: true as const }
}

export async function updateComment(id: string, input: Partial<z.infer<typeof CommentSchema>>) {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('youtube_curated_comments')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id).eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  return { ok: true as const }
}

export async function deleteComment(id: string) {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('youtube_curated_comments')
    .delete().eq('id', id).eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  return { ok: true as const }
}

export async function reorderComments(orderedIds: string[]) {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  for (let i = 0; i < orderedIds.length; i++) {
    await supabase.from('youtube_curated_comments')
      .update({ display_order: i })
      .eq('id', orderedIds[i]).eq('site_id', siteId)
  }

  revalidateTag('youtube')
  return { ok: true as const }
}
```

- [ ] **Step 2: Create page component**

Server component with:
- List of curated comments with video selector dropdown
- Bilingual text fields (text_pt, text_en)
- `target_locale` selector: Both / PT only / EN only
- Drag-to-reorder via display_order
- Delete button

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/comments/page.tsx \
  apps/web/src/app/cms/(authed)/youtube/comments/actions.ts
git commit -m "feat(youtube/cms): curated comments CRUD with locale targeting + reorder"
```

---

### Task 18: CMS Settings — YouTube Section

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/page.tsx`
- Modify: `apps/web/src/app/cms/(authed)/settings/actions.ts`

- [ ] **Step 1: Add YouTube settings actions**

Add to existing `actions.ts`:

```typescript
const SyncScheduleSchema = z.object({
  channel_id: z.string().uuid(),
  sync_enabled: z.boolean(),
  sync_schedules: z.array(z.object({
    day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    hour: z.number().int().min(0).max(23),
    tz: z.string(),
    label: z.string(),
  })),
})

export async function updateYouTubeChannelSettings(input: z.infer<typeof SyncScheduleSchema>) {
  const siteId = await requireEditAccess()
  const parsed = SyncScheduleSchema.parse(input)
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('youtube_channels')
    .update({
      sync_enabled: parsed.sync_enabled,
      sync_schedules: parsed.sync_schedules,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.channel_id).eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  return { ok: true as const }
}
```

- [ ] **Step 2: Add YouTube section to settings page**

In the settings `page.tsx`, add a query for `youtube_channels` and pass to the client component. The client renders a "YouTube" section with:
- Per-channel: schedule editor (day dropdowns + hour picker + timezone), sync toggle, "Sync Now" button
- Last sync status display (from `youtube_sync_log` most recent per channel)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/settings/page.tsx \
  apps/web/src/app/cms/(authed)/settings/actions.ts
git commit -m "feat(youtube/cms): settings section with per-channel sync schedules"
```

---

### Task 19: Final Test Suite Run + Cleanup

**Files:**
- All test files created in Tasks 3-5

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All existing tests pass + 20 new YouTube tests pass

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Verify dev server**

Run: `npm run dev -w apps/web`
Open: `http://localhost:3000/youtube`
Verify:
- Page renders without errors
- Header shows "Vídeos" as internal link (not external)
- Empty state is graceful (no crashes)
- URL params work: `?ch=pt&cat=latest`

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore(youtube): final cleanup and test verification"
```
