# YouTube CMS Channel Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire YouTube channel registration, home page DB queries, conditional rendering, and per-locale weekly pick into the CMS and public site.

**Architecture:** 3 parallel tracks — (1) CMS channel registration UI with YouTube API lookup, (2) replace hardcoded home page data with DB queries + conditional rendering, (3) per-locale weekly pick with `pinned_until` column and CMS picker UI. Tracks share types/queries but can be developed concurrently after shared foundations (Tasks 1-3) land.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Supabase (PostgreSQL 17), YouTube Data API v3, Zod, Vitest, Tailwind 4.

---

## File Map

### New files
| File | Purpose |
|---|---|
| `supabase/migrations/20260505000002_youtube_pinned_until.sql` | Add `pinned_until` column + partial unique index |

### Modified files — Track 1 (CMS Registration)
| File | Changes |
|---|---|
| `apps/web/src/lib/youtube/api-client.ts` | Add `lookupChannelByHandle()` + `ChannelLookupResult` type |
| `apps/web/src/app/cms/(authed)/settings/actions.ts` | Add `lookupYouTubeChannel`, `addYouTubeChannel`, `removeYouTubeChannel` server actions |
| `apps/web/src/app/cms/(authed)/settings/page.tsx` | Expand youtube_channels SELECT to include extra columns |
| `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx` | Rewrite `YouTubeSection` with add form, preview card, remove confirmation |

### Modified files — Track 2 (Home Page Wiring)
| File | Changes |
|---|---|
| `apps/web/lib/home/types.ts` | Update `HomeVideo` + `HomeChannel` types to match DB schema |
| `apps/web/lib/home/queries.ts` | Add `getHomeChannels`, `getHomeVideos`, `getWeeklyPick`, `getVideoCount` |
| `apps/web/src/app/(public)/components/PinboardHome.tsx` | Replace `SAMPLE_VIDEOS` import with DB queries, pass channels + hasVideos to children |
| `apps/web/src/app/(public)/components/DualHero.tsx` | Accept `channels`/`hasVideos`/`isPinned`, add "coming soon" placeholder |
| `apps/web/src/app/(public)/components/ChannelStrip.tsx` | Accept `channels` prop, remove `YOUTUBE_CHANNELS` import, conditional 0/1/2 |
| `apps/web/src/app/(public)/components/VideoGrid.tsx` | Accept `channels` prop, remove `YOUTUBE_CHANNELS` import, add "coming soon" teaser |
| `apps/web/src/app/(public)/components/SubscribePair.tsx` | Accept `channels` prop, remove `YOUTUBE_CHANNELS` import, conditional rendering |
| `apps/web/src/app/(public)/components/StatsStrip.tsx` | No changes (already handles `videoCount=0`) |
| `apps/web/src/components/layout/header-types.ts` | Remove hardcoded `YT_CHANNELS`, accept channels from layout |
| `apps/web/src/components/layout/header-ctas.tsx` | Accept optional `channelUrl` prop, hide Subscribe button when null |
| `apps/web/src/components/layout/global-header.tsx` | Accept `channelUrl` prop, pass to CTAs |
| `apps/web/src/app/(public)/layout.tsx` | Fetch channels from DB, pass to header |
| `apps/web/src/app/locales/en.json` | Add i18n keys for "coming soon" and 1-channel adaptive text |
| `apps/web/src/app/locales/pt-BR.json` | Same i18n keys in Portuguese |

### Modified files — Track 3 (Weekly Pick)
| File | Changes |
|---|---|
| `apps/web/src/app/cms/(authed)/youtube/videos/actions.ts` | Add `pinWeeklyPick`, `unpinWeeklyPick` server actions |
| `apps/web/src/app/cms/(authed)/youtube/videos/videos-connected.tsx` | Add pick banners UI at top of page + picker dialog |
| `apps/web/src/app/cms/(authed)/youtube/videos/page.tsx` | Fetch pinned video data for pick banners |
| `apps/web/src/app/(public)/youtube/page.tsx` | Add 0-channel redirect + 0-video "coming soon" state |

### Deleted files
| File | Reason |
|---|---|
| `apps/web/lib/home/videos-data.ts` | Hardcoded data fully replaced by DB queries |

### Test files
| File | Purpose |
|---|---|
| `apps/web/test/youtube/api-client.test.ts` | Unit tests for `lookupChannelByHandle` input parsing |
| `apps/web/test/youtube/home-queries.test.ts` | Unit tests for locale mapping + query builders |
| `apps/web/test/integration/youtube-weekly-pick.test.ts` | DB-gated integration tests for pin/unpin/expiry |

---

## Task 1: Migration — `pinned_until` column

**Files:**
- Create: `supabase/migrations/20260505000002_youtube_pinned_until.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Weekly pick: pinned_until replaces is_featured for home page locale-specific picks
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS pinned_until timestamptz;

-- Only 1 pinned video per channel (= per locale, since UNIQUE(site_id, locale) on channels)
DROP INDEX IF EXISTS youtube_videos_pinned_per_channel;
CREATE UNIQUE INDEX youtube_videos_pinned_per_channel
  ON youtube_videos(channel_id) WHERE pinned_until > now();

DROP INDEX IF EXISTS idx_youtube_videos_pinned;
CREATE INDEX idx_youtube_videos_pinned
  ON youtube_videos(site_id, pinned_until DESC) WHERE pinned_until IS NOT NULL;
```

- [ ] **Step 2: Validate locally**

Run: `npm run db:start && npm run db:reset`
Expected: Migration applies cleanly, no errors.

- [ ] **Step 3: Push to prod**

Run: `npm run db:push:prod`
Expected: Prompts YES, applies 1 migration.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260505000002_youtube_pinned_until.sql
git commit -m "feat(youtube): add pinned_until column for weekly pick per locale"
```

---

## Task 2: API Client — `lookupChannelByHandle`

**Files:**
- Modify: `apps/web/src/lib/youtube/api-client.ts`
- Create: `apps/web/test/youtube/api-client-lookup.test.ts`

- [ ] **Step 1: Write failing tests for input parsing**

Create `apps/web/test/youtube/api-client-lookup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseHandleInput } from '../../src/lib/youtube/api-client'

describe('parseHandleInput', () => {
  it('extracts handle from full URL', () => {
    expect(parseHandleInput('https://www.youtube.com/@tnFigueiredoTV')).toBe('@tnFigueiredoTV')
  })

  it('extracts handle from URL without www', () => {
    expect(parseHandleInput('https://youtube.com/@byThiagoFigueiredo')).toBe('@byThiagoFigueiredo')
  })

  it('extracts channel ID from /channel/ URL', () => {
    expect(parseHandleInput('https://www.youtube.com/channel/UCxyz123')).toBe('UCxyz123')
  })

  it('passes through handle with @', () => {
    expect(parseHandleInput('@tnFigueiredoTV')).toBe('@tnFigueiredoTV')
  })

  it('prepends @ to bare handle', () => {
    expect(parseHandleInput('tnFigueiredoTV')).toBe('@tnFigueiredoTV')
  })

  it('trims whitespace', () => {
    expect(parseHandleInput('  @handle  ')).toBe('@handle')
  })

  it('handles youtube.com/c/ custom URL', () => {
    expect(parseHandleInput('https://youtube.com/c/mychannel')).toBe('@mychannel')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run test/youtube/api-client-lookup.test.ts`
Expected: FAIL — `parseHandleInput` is not exported.

- [ ] **Step 3: Implement `parseHandleInput` and `lookupChannelByHandle`**

Add to `apps/web/src/lib/youtube/api-client.ts` (after the existing `fetchChannelStats` function):

```typescript
export interface ChannelLookupResult {
  channelId: string
  handle: string
  name: string
  description: string | null
  uploadsPlaylistId: string
  subscriberCount: number
  videoCount: number
  thumbnailUrl: string | null
  bannerUrl: string | null
  customUrl: string | null
}

export function parseHandleInput(raw: string): string {
  const input = raw.trim()
  const channelMatch = input.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/)
  if (channelMatch) return channelMatch[1]
  const handleMatch = input.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/)
  if (handleMatch) return `@${handleMatch[1]}`
  const customMatch = input.match(/youtube\.com\/c\/([a-zA-Z0-9_.-]+)/)
  if (customMatch) return `@${customMatch[1]}`
  if (input.startsWith('@')) return input
  return `@${input}`
}

export async function lookupChannelByHandle(
  handleOrUrl: string,
  apiKey: string,
): Promise<ChannelLookupResult | null> {
  const parsed = parseHandleInput(handleOrUrl)
  const isChannelId = parsed.startsWith('UC')

  const param = isChannelId ? `id=${parsed}` : `forHandle=${parsed}`
  const url = `${BASE}/channels?part=snippet,statistics,contentDetails&${param}&key=${apiKey}`
  const data = (await ytFetch(url)) as {
    items?: Array<{
      id: string
      snippet: {
        title: string
        description: string
        customUrl?: string
        thumbnails: { medium?: { url: string } }
      }
      statistics: { subscriberCount?: string; videoCount?: string }
      contentDetails: { relatedPlaylists: { uploads: string } }
      brandingSettings?: { image?: { bannerExternalUrl?: string } }
    }>
  }

  const item = data.items?.[0]
  if (!item) return null

  return {
    channelId: item.id,
    handle: item.snippet.customUrl ?? parsed,
    name: item.snippet.title,
    description: item.snippet.description || null,
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
    subscriberCount: parseInt(item.statistics.subscriberCount ?? '0', 10),
    videoCount: parseInt(item.statistics.videoCount ?? '0', 10),
    thumbnailUrl: item.snippet.thumbnails.medium?.url ?? null,
    bannerUrl: item.brandingSettings?.image?.bannerExternalUrl ?? null,
    customUrl: item.snippet.customUrl ?? null,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:web -- --run test/youtube/api-client-lookup.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/api-client.ts apps/web/test/youtube/api-client-lookup.test.ts
git commit -m "feat(youtube): add lookupChannelByHandle API client + parseHandleInput"
```

---

## Task 3: Update shared types

**Files:**
- Modify: `apps/web/lib/home/types.ts`

- [ ] **Step 1: Update `HomeChannel` and `HomeVideo` types**

In `apps/web/lib/home/types.ts`, replace the existing `HomeChannel` and `HomeVideo` types:

```typescript
export type HomeChannel = {
  id: string
  locale: 'en' | 'pt-BR'
  handle: string
  url: string
  flag: string
  name: string
  subscriberCount: number
  thumbnailUrl: string | null
}

export type HomeVideo = {
  id: string
  locale: 'en' | 'pt-BR'
  title: string
  description: string
  thumbnailUrl: string | null
  duration: string
  viewCount: number
  publishedAt: string
  categoryName: string | null
  categoryColor: string | null
  youtubeUrl: string
  channelHandle: string
  youtubeVideoId: string
  isPinned: boolean
}
```

- [ ] **Step 2: Run typecheck to find all breakages**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -50`
Expected: Type errors in files importing `HomeVideo`/`HomeChannel`. This is expected — those files will be updated in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/home/types.ts
git commit -m "feat(youtube): update HomeChannel/HomeVideo types for DB wiring"
```

---

## Task 4: Home page queries

**Files:**
- Modify: `apps/web/lib/home/queries.ts`

**Depends on:** Task 3 (types)

- [ ] **Step 1: Add locale mapping constants and YouTube query functions**

Add these imports and functions to `apps/web/lib/home/queries.ts` (at the end of the file, after `getSubscriberCount`):

```typescript
import { unstable_cache } from 'next/cache'
import type { HomeChannel, HomeVideo } from './types'

const DB_LOCALE_MAP: Record<string, 'pt' | 'en'> = { 'pt-BR': 'pt', 'en': 'en' }
const HOME_LOCALE_MAP: Record<string, 'en' | 'pt-BR'> = { 'pt': 'pt-BR', 'en': 'en' }
const LOCALE_FLAG: Record<string, string> = { 'pt': '🇧🇷', 'en': '🌎' }

export const getHomeChannels = unstable_cache(
  async (siteId: string): Promise<HomeChannel[]> => {
    const db = getSupabaseServiceClient()
    const { data, error } = await db
      .from('youtube_channels')
      .select('id, locale, handle, name, subscriber_count, thumbnail_url, custom_url')
      .eq('site_id', siteId)
      .order('locale')

    if (error || !data) return []
    return data.map((c) => {
      const homeLocale = HOME_LOCALE_MAP[c.locale as string] ?? 'en'
      return {
        id: c.id as string,
        locale: homeLocale,
        handle: c.handle as string,
        url: `https://www.youtube.com/${c.handle as string}`,
        flag: LOCALE_FLAG[c.locale as string] ?? '🌎',
        name: c.name as string,
        subscriberCount: (c.subscriber_count as number) ?? 0,
        thumbnailUrl: (c.thumbnail_url as string) ?? null,
      }
    })
  },
  ['home-channels'],
  { revalidate: 3600, tags: ['youtube'] },
)

export const getHomeVideos = unstable_cache(
  async (siteId: string, locale: string, limit = 3): Promise<HomeVideo[]> => {
    const dbLocale = DB_LOCALE_MAP[locale] ?? locale
    const db = getSupabaseServiceClient()
    const { data, error } = await db
      .from('youtube_videos')
      .select(`
        id, youtube_video_id, title, description, thumbnail_url, duration,
        view_count, published_at, is_hidden,
        youtube_channels!inner(locale, handle),
        youtube_categories(slug, name_pt, name_en, color)
      `)
      .eq('site_id', siteId)
      .eq('youtube_channels.locale', dbLocale)
      .eq('is_hidden', false)
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return (data as Record<string, unknown>[]).map((row) => {
      const ch = row['youtube_channels'] as { locale: string; handle: string }
      const cat = row['youtube_categories'] as { slug: string; name_pt: string; name_en: string; color: string } | null
      const homeLocale = HOME_LOCALE_MAP[ch.locale] ?? 'en'
      const catName = cat ? (ch.locale === 'pt' ? cat.name_pt : cat.name_en) : null
      return {
        id: row['id'] as string,
        locale: homeLocale,
        title: row['title'] as string,
        description: (row['description'] as string) ?? '',
        thumbnailUrl: (row['thumbnail_url'] as string) ?? null,
        duration: row['duration'] as string,
        viewCount: row['view_count'] as number,
        publishedAt: row['published_at'] as string,
        categoryName: catName,
        categoryColor: cat?.color ?? null,
        youtubeUrl: `https://www.youtube.com/watch?v=${row['youtube_video_id'] as string}`,
        channelHandle: ch.handle,
        youtubeVideoId: row['youtube_video_id'] as string,
        isPinned: false,
      }
    })
  },
  ['home-videos'],
  { revalidate: 3600, tags: ['youtube'] },
)

export const getWeeklyPick = unstable_cache(
  async (siteId: string, locale: string): Promise<HomeVideo | null> => {
    const dbLocale = DB_LOCALE_MAP[locale] ?? locale
    const db = getSupabaseServiceClient()

    const selectCols = `
      id, youtube_video_id, title, description, thumbnail_url, duration,
      view_count, published_at, pinned_until,
      youtube_channels!inner(locale, handle),
      youtube_categories(slug, name_pt, name_en, color)
    `

    // Try pinned first
    const { data: pinned } = await db
      .from('youtube_videos')
      .select(selectCols)
      .eq('site_id', siteId)
      .eq('youtube_channels.locale', dbLocale)
      .eq('is_hidden', false)
      .gt('pinned_until', new Date().toISOString())
      .order('pinned_until', { ascending: false })
      .limit(1)

    const row = (pinned as Record<string, unknown>[] | null)?.[0]

    // Fallback: latest by published_at
    const source = row ?? await (async () => {
      const { data } = await db
        .from('youtube_videos')
        .select(selectCols)
        .eq('site_id', siteId)
        .eq('youtube_channels.locale', dbLocale)
        .eq('is_hidden', false)
        .order('published_at', { ascending: false })
        .limit(1)
      return (data as Record<string, unknown>[] | null)?.[0] ?? null
    })()

    if (!source) return null

    const ch = source['youtube_channels'] as { locale: string; handle: string }
    const cat = source['youtube_categories'] as { slug: string; name_pt: string; name_en: string; color: string } | null
    const homeLocale = HOME_LOCALE_MAP[ch.locale] ?? 'en'
    const catName = cat ? (ch.locale === 'pt' ? cat.name_pt : cat.name_en) : null
    const pinnedUntil = source['pinned_until'] as string | null
    const isPinned = !!pinnedUntil && new Date(pinnedUntil) > new Date()

    return {
      id: source['id'] as string,
      locale: homeLocale,
      title: source['title'] as string,
      description: (source['description'] as string) ?? '',
      thumbnailUrl: (source['thumbnail_url'] as string) ?? null,
      duration: source['duration'] as string,
      viewCount: source['view_count'] as number,
      publishedAt: source['published_at'] as string,
      categoryName: catName,
      categoryColor: cat?.color ?? null,
      youtubeUrl: `https://www.youtube.com/watch?v=${source['youtube_video_id'] as string}`,
      channelHandle: ch.handle,
      youtubeVideoId: source['youtube_video_id'] as string,
      isPinned,
    }
  },
  ['weekly-pick'],
  { revalidate: 3600, tags: ['youtube'] },
)

export const getVideoCount = unstable_cache(
  async (siteId: string, locale: string): Promise<number> => {
    const dbLocale = DB_LOCALE_MAP[locale] ?? locale
    const db = getSupabaseServiceClient()
    const { count, error } = await db
      .from('youtube_videos')
      .select('id, youtube_channels!inner(locale)', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('youtube_channels.locale', dbLocale)
      .eq('is_hidden', false)

    if (error) return 0
    return count ?? 0
  },
  ['video-count'],
  { revalidate: 3600, tags: ['youtube'] },
)
```

Note: `unstable_cache` is already imported in the file's existing imports from `next/cache` — check if it's there; if not, add it alongside the existing imports.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep "queries.ts"`
Expected: No errors in queries.ts (component type errors from Task 3 are expected elsewhere).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/home/queries.ts
git commit -m "feat(youtube): add home page YouTube queries with unstable_cache"
```

---

## Task 5: Add i18n keys

**Files:**
- Modify: `apps/web/src/app/locales/en.json`
- Modify: `apps/web/src/app/locales/pt-BR.json`

- [ ] **Step 1: Add YouTube conditional/coming-soon keys to en.json**

Add these keys to `apps/web/src/app/locales/en.json` (in the `home.channels` section, after existing keys):

```json
"home.channels.headlineSingle": "one channel, one vision",
"home.channels.sublineSingle": "SUBSCRIBE",
"home.youtube.comingSoon": "first video coming soon",
"home.youtube.comingSoonSub": "Subscribe to the channel to get notified when it drops.",
"home.subscribe.ytSubtitle2": "Live-coding, setup tours, bug retrospectives. A new video every Thursday, sometimes two.",
"home.subscribe.subscribersSuffix": "subscribers",
"home.subscribe.scheduleNote": "next Thursday: new videos on both channels"
```

- [ ] **Step 2: Add same keys to pt-BR.json**

```json
"home.channels.headlineSingle": "um canal, uma visão",
"home.channels.sublineSingle": "INSCREVA-SE",
"home.youtube.comingSoon": "primeiro vídeo em breve",
"home.youtube.comingSoonSub": "Inscreva-se no canal para ser notificado quando sair.",
"home.subscribe.ytSubtitle2": "Live-coding, tours de setup, retrospectivas de bug. Um vídeo novo toda quinta, às vezes dois.",
"home.subscribe.subscribersSuffix": "inscritos",
"home.subscribe.scheduleNote": "quinta que vem: vídeos novos nos dois canais"
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/locales/en.json apps/web/src/app/locales/pt-BR.json
git commit -m "feat(youtube): add i18n keys for conditional rendering and coming-soon states"
```

---

## Task 6: Wire PinboardHome to DB queries

**Files:**
- Modify: `apps/web/src/app/(public)/components/PinboardHome.tsx`

**Depends on:** Tasks 3, 4

- [ ] **Step 1: Replace hardcoded imports with DB queries**

In `PinboardHome.tsx`:

1. Remove line 23: `import { SAMPLE_VIDEOS } from '../../../../lib/home/videos-data'`

2. Add import: `import { getHomeChannels, getHomeVideos, getWeeklyPick, getVideoCount } from '../../../../lib/home/queries'`

3. Add import: `import { getSiteContext } from '../../../../lib/cms/site-context'`

4. Inside the `PinboardHome` function, after the existing `Promise.all` block (line 39-48), add a second parallel fetch:

```typescript
const { siteId } = await getSiteContext()
const dbLocale = locale === 'pt-BR' ? 'pt' : 'en'

const [channels, weeklyPick, localeVideos, videoCount] = await Promise.all([
  getHomeChannels(siteId),
  getWeeklyPick(siteId, locale),
  getHomeVideos(siteId, locale, 3),
  getVideoCount(siteId, locale),
])

const hasChannels = channels.length > 0
const hasVideos = videoCount > 0
```

5. Remove the old lines 50-51 and 63:
```typescript
// DELETE these lines:
// const localeVideos = SAMPLE_VIDEOS.filter(v => v.locale === locale)
// const featuredVideo = localeVideos[0] ?? null
// const videoCount = localeVideos.length
```

6. Update the JSX to pass new props:

Replace the DualHero call:
```typescript
<DualHero post={featuredPost} video={weeklyPick} channels={channels} hasVideos={hasVideos} locale={locale} t={t} />
```

Replace the ChannelStrip call:
```typescript
<ChannelStrip newsletter={primaryNewsletter} channels={channels} locale={locale} t={t} />
```

Wrap the first BookmarkPlaceholder + VideoGrid in a conditional:
```typescript
{hasChannels && (
  <>
    <BookmarkPlaceholder locale={locale} t={t} />
    <div className="pb-section">
      <VideoGrid videos={localeVideos} channels={channels} hasVideos={hasVideos} locale={locale} t={t} />
    </div>
    <BookmarkPlaceholder locale={locale} t={t} />
  </>
)}
{!hasChannels && (
  <BookmarkPlaceholder locale={locale} t={t} />
)}
```

Replace the SubscribePair call:
```typescript
<SubscribePair newsletter={primaryNewsletter} channels={channels} locale={locale} t={t} />
```

- [ ] **Step 2: Commit (will have type errors until component props are updated — that's OK)**

```bash
git add apps/web/src/app/\(public\)/components/PinboardHome.tsx
git commit -m "feat(youtube): wire PinboardHome to DB queries, pass channels to children"
```

---

## Task 7: Update DualHero for conditional rendering

**Files:**
- Modify: `apps/web/src/app/(public)/components/DualHero.tsx`

**Depends on:** Task 6

- [ ] **Step 1: Update Props type and add coming-soon card**

Replace the entire `DualHero.tsx` content. Key changes:
- Add `channels` and `hasVideos` to Props
- Keep existing post card unchanged
- Add "coming soon" placeholder card when `channels.length > 0 && !hasVideos`
- Add `★ PINNED` badge when `video?.isPinned`

Update the Props type (line 13-18):
```typescript
type Props = {
  post: HomePost | null
  video: HomeVideo | null
  channels: HomeChannel[]
  hasVideos: boolean
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}
```

Add `HomeChannel` to the import from types:
```typescript
import type { HomePost, HomeVideo, HomeChannel } from '../../../../lib/home/types'
```

Update function signature:
```typescript
export function DualHero({ post, video, channels, hasVideos, locale, t }: Props) {
```

Add `hasChannels` constant after existing constants:
```typescript
const hasChannels = channels.length > 0
const showVideo = hasChannels && hasVideos && video
const showComingSoon = hasChannels && !hasVideos
const hasContent = post || showVideo || showComingSoon
```

Update the `cols` calculation:
```typescript
const cols = post && (showVideo || showComingSoon) ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-2xl mx-auto'
```

Replace the `{video && (` block (lines 113-161) with:

```typescript
{/* ── Video card ── */}
{showVideo && video && (
  <div style={{ position: 'relative', paddingTop: 20, paddingBottom: 28 }}>
    <div
      className="dh-card dh-card-video"
      style={{ background: 'var(--pb-paper)', position: 'relative', transform: 'rotate(0.8deg)', boxShadow: 'var(--pb-shadow-card)' }}
    >
      <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: 'var(--pb-tapeR)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, left: '22%', transform: 'rotate(4deg)' }} />
      <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: 'var(--pb-tape)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, right: '15%', transform: 'rotate(-3deg)' }} />

      {video.isPinned && (
        <div className="font-mono" style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, background: 'var(--pb-accent)', color: '#FFF', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, padding: '3px 8px' }}>
          ★ PINNED
        </div>
      )}

      <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        <div style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden', background: video.thumbnailUrl ? undefined : 'linear-gradient(135deg, #51201F 0%, #142229 100%)' }}>
          {video.thumbnailUrl && (
            <img src={video.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.55))' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 68, height: 48, background: 'var(--pb-yt)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,51,51,0.4)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
          <div className="font-mono" style={{ position: 'absolute', top: 8, left: 8, background: 'var(--pb-yt)', color: '#FFF', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, padding: '3px 7px' }}>
            ▶ YouTube
          </div>
          <div className="font-mono" style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.85)', color: '#FFF', fontSize: 11, padding: '2px 7px' }}>
            {video.duration}
          </div>
        </div>
        <div style={{ padding: '22px 26px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            {video.categoryName && (
              <span className="font-mono" style={{ padding: '2px 8px', background: video.categoryColor ?? 'var(--pb-yt)', color: '#FFF', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
                {video.categoryName}
              </span>
            )}
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--pb-muted)', letterSpacing: '0.1em' }}>
              {video.viewCount > 0 ? `${video.viewCount.toLocaleString()} · ` : ''}{videoDate}
            </span>
          </div>
          <h3 className="font-fraunces" style={{ fontSize: 'clamp(24px, 2.8vw, 34px)', lineHeight: 1.08, letterSpacing: '-0.02em', margin: 0, fontWeight: 500, color: 'var(--pb-ink)' }}>
            {video.title}
          </h3>
          <p style={{ fontSize: 14.5, color: 'var(--pb-muted)', lineHeight: 1.55, marginTop: 12, marginBottom: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {video.description}
          </p>
        </div>
      </a>
    </div>
    <div className="font-caveat hidden md:block" style={{ position: 'absolute', bottom: -22, right: 32, color: 'var(--pb-accent)', fontSize: 20, transform: 'rotate(2deg)' }}>
      {t['hero.video.fresh'] ?? (isPt ? 'novo no canal →' : 'fresh on the channel →')}
    </div>
  </div>
)}

{/* ── Coming soon placeholder ── */}
{showComingSoon && (
  <div style={{ position: 'relative', paddingTop: 20, paddingBottom: 28 }}>
    <div
      className="dh-card"
      style={{ background: 'var(--pb-paper)', position: 'relative', transform: 'rotate(0.8deg)', boxShadow: 'var(--pb-shadow-card)', opacity: 0.85 }}
    >
      <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: 'var(--pb-tapeR)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, left: '22%', transform: 'rotate(4deg)' }} />

      <div style={{ aspectRatio: '16 / 9', background: 'linear-gradient(135deg, #1a1714 0%, #2a2218 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 56, height: 40, background: 'rgba(255,45,32,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,45,32,0.6)"><path d="M8 5v14l11-7z" /></svg>
          </div>
          <div className="font-caveat" style={{ fontSize: 14, color: 'rgba(242,235,219,0.5)', transform: 'rotate(-1deg)' }}>
            {t['home.youtube.comingSoon']}
          </div>
        </div>
        <div className="font-mono" style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(255,45,32,0.3)', color: 'rgba(255,255,255,0.6)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, padding: '3px 7px' }}>
          ▶ YouTube
        </div>
      </div>
      <div style={{ padding: '22px 26px 26px' }}>
        <div className="font-caveat" style={{ fontSize: 16, color: 'var(--pb-accent)', transform: 'rotate(-0.5deg)' }}>
          {isPt ? 'Primeiro vídeo saindo do forno' : 'First video dropping soon'}
        </div>
        <p style={{ fontSize: 12, color: 'var(--pb-muted)', marginTop: 4 }}>
          {t['home.youtube.comingSoonSub']}
        </p>
        {channels[0] && (
          <a
            href={channels[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, background: 'var(--pb-yt)', color: '#FFF', padding: '6px 14px', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            {t['home.youtube.subscribe']}
          </a>
        )}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/components/DualHero.tsx
git commit -m "feat(youtube): DualHero conditional rendering + coming-soon placeholder + PINNED badge"
```

---

## Task 8: Update ChannelStrip for dynamic channels

**Files:**
- Modify: `apps/web/src/app/(public)/components/ChannelStrip.tsx`

**Depends on:** Task 3

- [ ] **Step 1: Replace hardcoded import with channels prop**

In `ChannelStrip.tsx`:

1. Remove line 3: `import { YOUTUBE_CHANNELS } from '@/lib/home/videos-data'`

2. Add `HomeChannel` to the import from types:
```typescript
import type { HomeNewsletter, HomeChannel } from '@/lib/home/types'
```

3. Update Props type:
```typescript
type Props = {
  newsletter?: HomeNewsletter | null
  channels: HomeChannel[]
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}
```

4. Update the function signature and body:
```typescript
export function ChannelStrip({ newsletter, channels, locale, t }: Props) {
  if (channels.length === 0) return null

  const primary = channels.find(c => c.locale === locale) ?? channels[0]
  const secondary = channels.find(c => c.locale !== primary.locale)
  const allChannels = secondary ? [primary, secondary] : [primary]
  const hasNl = !!newsletter
  const isSingle = allChannels.length === 1
```

5. Update the headline to be adaptive:
```typescript
<div className="font-caveat" style={{ color: 'var(--pb-yt)', fontSize: 26, transform: 'rotate(-1.5deg)', display: 'inline-block', whiteSpace: 'nowrap' }}>
  ▶ {isSingle ? t['home.channels.headlineSingle'] : t['home.channels.headline']}
</div>
```

6. Update the subline:
```typescript
<span className="font-mono uppercase" style={{ fontSize: 11, color: 'var(--pb-muted)', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
  {isSingle ? t['home.channels.sublineSingle'] : t['home.channels.subline']}
</span>
```

7. Replace `channels` references in the map with `allChannels`:
Change `{channels.map((ch, idx) => (` to `{allChannels.map((ch, idx) => (`

8. In the `ChannelCard` function, update the subscriber count display (line 136-138):
```typescript
<div style={{ fontSize: 12, color: 'var(--pb-muted)', marginTop: 2 }}>
  {ch.subscriberCount > 0 ? `${ch.subscriberCount.toLocaleString()} ` : '— '}
  {t['channels.subscribersSuffix']}
</div>
```

Update the ChannelCard prop type to accept HomeChannel:
```typescript
function ChannelCard({ ch, idx, locale, t }: {
  ch: HomeChannel
  idx: number
  locale: string
  t: Record<string, string>
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/components/ChannelStrip.tsx
git commit -m "feat(youtube): ChannelStrip accepts dynamic channels, adaptive 1/2 headline"
```

---

## Task 9: Update VideoGrid for conditional rendering

**Files:**
- Modify: `apps/web/src/app/(public)/components/VideoGrid.tsx`

**Depends on:** Task 3

- [ ] **Step 1: Replace hardcoded import, add coming-soon teaser**

In `VideoGrid.tsx`:

1. Remove line 4: `import { YOUTUBE_CHANNELS } from '../../../../lib/home/videos-data'`

2. Add import:
```typescript
import type { HomeVideo, HomeChannel } from '../../../../lib/home/types'
```

3. Update Props:
```typescript
type Props = {
  videos: HomeVideo[]
  channels: HomeChannel[]
  hasVideos: boolean
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}
```

4. Update function:
```typescript
export function VideoGrid({ videos, channels, hasVideos, locale, t }: Props) {
  if (channels.length === 0) return null

  const isPt = locale === 'pt-BR'
  const localeChannel = channels.find(c => c.locale === locale) ?? channels[0]
  const channelUrl = localeChannel.url
```

5. Replace the early return (`if (videos.length === 0) return null`) with a coming-soon teaser. After the `SectionHeader` and `<h2>` inside the section, add:

```typescript
{!hasVideos ? (
  <div style={{ textAlign: 'center', padding: '32px 20px', border: '1px dashed rgba(255,45,32,0.2)', borderRadius: 6 }}>
    <div style={{ width: 64, height: 44, background: 'rgba(255,45,32,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,45,32,0.5)"><path d="M8 5v14l11-7z" /></svg>
    </div>
    <div className="font-caveat" style={{ fontSize: 20, color: 'var(--pb-accent)', marginBottom: 6, transform: 'rotate(-1deg)' }}>
      {t['home.youtube.comingSoon']}
    </div>
    <p style={{ fontSize: 13, color: 'var(--pb-faint)', marginBottom: 14 }}>
      {t['home.youtube.comingSoonSub']}
    </p>
    <a
      href={channelUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono uppercase"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--pb-yt)', color: '#FFF', padding: '10px 22px', fontSize: 11, letterSpacing: '0.14em', fontWeight: 600, textDecoration: 'none' }}
    >
      ▶ {t['home.youtube.subscribe']}
    </a>
  </div>
) : (
  // existing grid + button code here
)}
```

6. Update view count display in video cards (line 72):
```typescript
{video.duration}{video.viewCount > 0 ? ` · ${video.viewCount.toLocaleString()}` : ''}
```

7. Replace `video.series` with `video.categoryName ?? t['feed.type.video']` (lines 59).

8. Replace `video.youtubeUrl` with the correct URL (already correct from queries).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/components/VideoGrid.tsx
git commit -m "feat(youtube): VideoGrid dynamic channels + coming-soon teaser"
```

---

## Task 10: Update SubscribePair for dynamic channels

**Files:**
- Modify: `apps/web/src/app/(public)/components/SubscribePair.tsx`

**Depends on:** Task 3

- [ ] **Step 1: Replace hardcoded import and strings**

In `SubscribePair.tsx`:

1. Remove line 3: `import { YOUTUBE_CHANNELS } from '../../../../lib/home/videos-data'`

2. Add import:
```typescript
import type { HomeNewsletter, HomeChannel } from '../../../../lib/home/types'
```

3. Update Props:
```typescript
type Props = {
  newsletter: HomeNewsletter | null
  channels: HomeChannel[]
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}
```

4. Update function:
```typescript
export function SubscribePair({ newsletter, channels, locale, t }: Props) {
  const isPt = locale === 'pt-BR'
  const primary = channels.find(c => c.locale === locale)
  const secondary = channels.find(c => c.locale !== locale)
  const allChannels = [primary, secondary].filter(Boolean) as HomeChannel[]
```

5. If `allChannels.length === 0`, hide the YouTube card entirely — render only the newsletter card at full width:
```typescript
const gridCols = allChannels.length === 0 ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-1 md:grid-cols-2'
```

6. Wrap the YouTube PaperCard (lines 67-116) in a conditional:
```typescript
{allChannels.length > 0 && (
  <div style={{ position: 'relative', paddingTop: 18 }}>
    {/* ... existing YouTube PaperCard ... */}
  </div>
)}
```

7. Replace the hardcoded description (lines 78-80):
```typescript
<p style={{ fontSize: 15, color: 'var(--pb-muted)', marginTop: 14, lineHeight: 1.55 }}>
  {t['home.subscribe.ytSubtitle2'] ?? t['home.subscribe.ytSubtitle']}
</p>
```

8. Update the channels map to use `allChannels`:
```typescript
{allChannels.map((ch) => (
```

9. Replace hardcoded subscriber text (line 95):
```typescript
{ch.subscriberCount > 0 ? `${ch.subscriberCount.toLocaleString()} ` : '— '}
{t['home.subscribe.subscribersSuffix']} · {ch.locale === 'pt-BR' ? t['home.channels.channelPtBr'] : t['home.channels.channelEn']}
```

10. Replace hardcoded subscribe button text (line 105):
```typescript
{t['channels.subscribe']}
```

11. Replace hardcoded footer text (line 112):
```typescript
{allChannels.length >= 2 ? t['home.subscribe.scheduleNote'] : t['home.channels.youtubeSchedule']}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/components/SubscribePair.tsx
git commit -m "feat(youtube): SubscribePair dynamic channels, conditional rendering, i18n"
```

---

## Task 11: Update header/nav for conditional YouTube

**Files:**
- Modify: `apps/web/src/components/layout/header-types.ts`
- Modify: `apps/web/src/components/layout/header-ctas.tsx`
- Modify: `apps/web/src/components/layout/global-header.tsx`
- Modify: `apps/web/src/app/(public)/layout.tsx`

**Depends on:** Task 4

- [ ] **Step 1: Update header-types.ts**

In `apps/web/src/components/layout/header-types.ts`:

Remove the `YT_CHANNELS` constant (lines 24-27).

Update `GlobalHeaderProps` to include optional `channelUrl`:
```typescript
export type GlobalHeaderProps = {
  locale: HeaderLocale
  currentTheme: HeaderTheme
  variant: HeaderVariant
  ctas: HeaderCtaVariant
  t: Record<string, string>
  channelUrl?: string | null
}
```

Update `buildNavItems` to accept an optional `hasChannels` parameter and conditionally include the YouTube nav item:
```typescript
export function buildNavItems(
  locale: HeaderLocale,
  variant: HeaderVariant,
  t: Record<string, string>,
  hasChannels = true,
): NavItem[] {
  const l = (key: string): string => t[key] ?? key
  const items: NavItem[] = [
    { key: 'home', href: localePath('/', locale), label: l('nav.home') },
    { key: 'blog', href: localePath('/blog', locale), label: l('nav.blog') },
  ]

  if (hasChannels) {
    items.push({ key: 'youtube', href: localePath('/youtube', locale), label: l('nav.youtube') })
  }

  items.push(
    { key: 'newsletters', href: localePath('/newsletters', locale), label: l('nav.newsletters') },
    { key: 'about', href: localePath('/about', locale), label: l('nav.about') },
  )

  if (variant === 'full') {
    items.push({ key: 'contact', href: localePath('/contact', locale), label: l('nav.contact') })
  }

  return items
}
```

- [ ] **Step 2: Update header-ctas.tsx**

In `apps/web/src/components/layout/header-ctas.tsx`:

Remove the import of `YT_CHANNELS`:
```typescript
// DELETE: import { YT_CHANNELS } from './header-types'
```

Update Props to accept `channelUrl`:
```typescript
type Props = {
  variant: HeaderCtaVariant
  locale: HeaderLocale
  t: Record<string, string>
  channelUrl?: string | null
}
```

Update the function:
```typescript
export function HeaderCTAs({ variant, locale, t, channelUrl }: Props) {
```

In the `variant === 'home'` block, wrap the Subscribe button in a conditional:
```typescript
if (variant === 'home') {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {channelUrl && (
        <a
          href={channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t['header.subscribe']}
          className="font-jetbrains no-underline"
          style={{
            background: 'var(--pb-yt)',
            color: '#FFF',
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 600,
            transform: 'rotate(-1deg)',
            boxShadow: '0 2px 0 rgba(0,0,0,0.1)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          {locale === 'pt-BR' ? 'Inscrever' : 'Subscribe'}
        </a>
      )}
      <a
        href={localePath('/newsletters', locale)}
        className="font-jetbrains no-underline"
        style={{
          background: 'var(--pb-marker)',
          color: 'var(--pb-ink-on-accent)',
          padding: '7px 12px',
          fontSize: 12,
          fontWeight: 600,
          transform: 'rotate(1deg)',
          display: 'inline-block',
          boxShadow: '0 2px 0 rgba(0,0,0,0.1)',
        }}
      >
        ✉ Newsletter
      </a>
    </div>
  )
}
```

- [ ] **Step 3: Update global-header.tsx to pass channelUrl**

Read `global-header.tsx` first to understand its structure, then pass `channelUrl` through to HeaderCTAs and `hasChannels` to nav items. The `GlobalHeader` component receives `GlobalHeaderProps` which now includes `channelUrl`.

- [ ] **Step 4: Update public layout.tsx to fetch channels**

In `apps/web/src/app/(public)/layout.tsx`, add the channel fetch and compute the locale-matching channel URL:

```typescript
import { getHomeChannels } from '../../lib/home/queries'

// Inside the function, after getting ctx/locale:
const channels = ctx ? await getHomeChannels(ctx.siteId) : []
const localeChannel = channels.find(c => c.locale === locale) ?? channels[0]
const channelUrl = localeChannel?.url ?? null
const hasChannels = channels.length > 0
```

Pass `channelUrl` to `GlobalHeader`:
```typescript
<GlobalHeader
  locale={locale}
  currentTheme={theme}
  variant="full"
  ctas="home"
  t={t}
  channelUrl={channelUrl}
/>
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/header-types.ts apps/web/src/components/layout/header-ctas.tsx apps/web/src/components/layout/global-header.tsx apps/web/src/app/\(public\)/layout.tsx
git commit -m "feat(youtube): conditional header Subscribe button + YouTube nav link"
```

---

## Task 12: CMS server actions for channel registration

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/actions.ts`

**Depends on:** Task 2

- [ ] **Step 1: Add Zod schemas and server actions**

Add to `apps/web/src/app/cms/(authed)/settings/actions.ts`:

```typescript
import { lookupChannelByHandle, type ChannelLookupResult } from '@/lib/youtube/api-client'

type LookupResult = { ok: true; channel: ChannelLookupResult } | { ok: false; error: string }

const handleInputSchema = z.object({
  handleOrUrl: z.string().min(1, 'Handle or URL is required').max(200),
})

export async function lookupYouTubeChannel(input: z.infer<typeof handleInputSchema>): Promise<LookupResult> {
  const parsed = handleInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  await requireEditAccess()

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { ok: false, error: 'YouTube API key not configured' }

  try {
    const channel = await lookupChannelByHandle(parsed.data.handleOrUrl, apiKey)
    if (!channel) return { ok: false, error: 'Channel not found. Check the handle and try again.' }
    return { ok: true, channel }
  } catch (e) {
    if (e instanceof Error && e.message === 'quotaExceeded') {
      return { ok: false, error: 'YouTube API limit reached. Try again later.' }
    }
    return { ok: false, error: 'Failed to look up channel. Please try again.' }
  }
}

const addChannelSchema = z.object({
  channelId: z.string().min(1),
  locale: z.enum(['pt', 'en']),
  handle: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  uploadsPlaylistId: z.string().min(1),
  subscriberCount: z.number().int().min(0),
  videoCount: z.number().int().min(0),
  thumbnailUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  customUrl: z.string().nullable(),
})

export async function addYouTubeChannel(input: z.infer<typeof addChannelSchema>): Promise<ActionResult> {
  const parsed = addChannelSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // Check locale not taken
  const { data: existing } = await supabase
    .from('youtube_channels')
    .select('id, name')
    .eq('site_id', siteId)
    .eq('locale', parsed.data.locale)
    .limit(1)
  if (existing && existing.length > 0) {
    return { ok: false, error: `Locale ${parsed.data.locale} is already assigned to "${(existing[0] as { name: string }).name}".` }
  }

  // Check channel not already registered
  const { data: dup } = await supabase
    .from('youtube_channels')
    .select('id, locale')
    .eq('site_id', siteId)
    .eq('channel_id', parsed.data.channelId)
    .limit(1)
  if (dup && dup.length > 0) {
    return { ok: false, error: `This channel is already registered as ${(dup[0] as { locale: string }).locale}.` }
  }

  const { error } = await supabase.from('youtube_channels').insert({
    site_id: siteId,
    channel_id: parsed.data.channelId,
    locale: parsed.data.locale,
    handle: parsed.data.handle,
    name: parsed.data.name,
    description: parsed.data.description,
    uploads_playlist_id: parsed.data.uploadsPlaylistId,
    subscriber_count: parsed.data.subscriberCount,
    video_count: parsed.data.videoCount,
    thumbnail_url: parsed.data.thumbnailUrl,
    banner_url: parsed.data.bannerUrl,
    custom_url: parsed.data.customUrl,
    sync_enabled: true,
    sync_schedules: [],
  })

  if (error) return { ok: false, error: error.message }

  // Trigger first sync in background
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    fetch(`${baseUrl}/api/cron/sync-youtube?mode=manual`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cronSecret}` },
    }).catch(() => {})
  }

  revalidateTag('youtube')
  revalidatePath('/cms/settings')
  revalidatePath('/')
  return { ok: true }
}

const removeChannelSchema = z.object({
  channelId: z.string().uuid(),
})

export async function removeYouTubeChannel(input: z.infer<typeof removeChannelSchema>): Promise<ActionResult> {
  const parsed = removeChannelSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // Delete videos first (cascade to comments), then sync log, then channel
  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id')
    .eq('id', parsed.data.channelId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return { ok: false, error: 'Channel not found' }

  await supabase.from('youtube_curated_comments')
    .delete()
    .in('video_id', supabase.from('youtube_videos').select('id').eq('channel_id', channel.id))

  await supabase.from('youtube_videos').delete().eq('channel_id', channel.id)
  await supabase.from('youtube_sync_log').delete().eq('channel_id', channel.id)

  const { error } = await supabase.from('youtube_channels').delete().eq('id', channel.id).eq('site_id', siteId)
  if (error) return { ok: false, error: error.message }

  revalidateTag('youtube')
  revalidatePath('/cms/settings')
  revalidatePath('/')
  return { ok: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/settings/actions.ts
git commit -m "feat(youtube): add lookupYouTubeChannel, addYouTubeChannel, removeYouTubeChannel server actions"
```

---

## Task 13: CMS YouTube channel registration UI

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx`
- Modify: `apps/web/src/app/cms/(authed)/settings/page.tsx`

**Depends on:** Task 12

- [ ] **Step 1: Update page.tsx to fetch more channel data**

In `apps/web/src/app/cms/(authed)/settings/page.tsx`, update the YouTube channels query (currently line 35-37) to select more columns:

```typescript
supabase.from('youtube_channels')
  .select('id, name, handle, locale, channel_id, subscriber_count, video_count, thumbnail_url, sync_enabled, sync_schedules, last_synced_at')
  .eq('site_id', siteId)
  .order('locale')
```

Update the `YouTubeChannelData` interface in `settings-connected.tsx` to match:

```typescript
interface YouTubeChannelData {
  id: string
  name: string
  handle: string
  locale: string
  channel_id: string
  subscriber_count: number
  video_count: number
  thumbnail_url: string | null
  sync_enabled: boolean
  sync_schedules: Array<{
    day: string
    hour: number
    tz: string
    label: string
  }> | null
  last_synced_at: string | null
}
```

- [ ] **Step 2: Rewrite YouTubeSection with add form**

Replace the `YouTubeSection` component (lines 1185-1221 in `settings-connected.tsx`) with a version that includes the add-channel form. The component should:

1. Show existing channel cards (reuse `YouTubeChannelCard`)
2. Show "Add Channel" form below existing cards:
   - Text input for handle/URL
   - "Look Up" button that calls `lookupYouTubeChannel`
   - Loading spinner during lookup
   - Error message on failure
   - Preview card on success (avatar placeholder, name, subscriber count, video count)
   - Locale radio buttons (pt-BR / en, disabled if taken)
   - "Add Channel" button that calls `addYouTubeChannel`
   - Success toast + auto-sync status
3. Disable form when 2 channels exist ("2/2 locales used")
4. Add remove button to each channel card with confirmation dialog

This is the most UI-heavy task. The component should follow the existing CMS styling patterns (dark theme: `bg-cms-surface`, `text-cms-text`, `border-cms-border`, etc.).

Add a "Remove" button to `YouTubeChannelCard` at the bottom of the card:

```typescript
<button
  type="button"
  onClick={() => setShowRemoveConfirm(true)}
  className="text-red-400 hover:text-red-300 text-xs mt-4"
>
  Remove channel
</button>
```

With a confirmation dialog:
```typescript
{showRemoveConfirm && (
  <div className="mt-3 p-3 border border-red-500/30 rounded bg-red-950/20">
    <p className="text-sm text-red-300 mb-2">
      Remove {channel.name}? This will delete all synced videos and comments.
    </p>
    <div className="flex gap-2">
      <button onClick={handleRemove} disabled={isPending} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded">
        {isPending ? 'Removing...' : 'Confirm Remove'}
      </button>
      <button onClick={() => setShowRemoveConfirm(false)} className="px-3 py-1.5 bg-cms-surface-hover text-cms-text-secondary text-xs rounded">
        Cancel
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Run tests**

Run: `npm run test:web`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/settings/settings-connected.tsx apps/web/src/app/cms/\(authed\)/settings/page.tsx
git commit -m "feat(youtube): CMS channel registration UI with lookup, preview, locale selector, remove"
```

---

## Task 14: Weekly pick server actions

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/videos/actions.ts`

**Depends on:** Task 1

- [ ] **Step 1: Add pin/unpin actions**

Add to `apps/web/src/app/cms/(authed)/youtube/videos/actions.ts`:

```typescript
const pinSchema = z.object({
  videoId: z.string().uuid(),
  channelId: z.string().uuid(),
  durationDays: z.number().int().min(1).max(30),
})

export async function pinWeeklyPick(input: z.infer<typeof pinSchema>): Promise<ActionResult> {
  const parsed = pinSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // Clear existing pin for this channel
  await supabase
    .from('youtube_videos')
    .update({ pinned_until: null, updated_at: new Date().toISOString() })
    .eq('channel_id', parsed.data.channelId)
    .eq('site_id', siteId)
    .gt('pinned_until', new Date().toISOString())

  // Set new pin
  const pinnedUntil = new Date()
  pinnedUntil.setDate(pinnedUntil.getDate() + parsed.data.durationDays)

  const { error } = await supabase
    .from('youtube_videos')
    .update({ pinned_until: pinnedUntil.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', parsed.data.videoId)
    .eq('channel_id', parsed.data.channelId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateTag('youtube')
  revalidatePath('/')
  return { ok: true }
}

const unpinSchema = z.object({
  channelId: z.string().uuid(),
})

export async function unpinWeeklyPick(input: z.infer<typeof unpinSchema>): Promise<ActionResult> {
  const parsed = unpinSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('youtube_videos')
    .update({ pinned_until: null, updated_at: new Date().toISOString() })
    .eq('channel_id', parsed.data.channelId)
    .eq('site_id', siteId)
    .gt('pinned_until', new Date().toISOString())

  if (error) return { ok: false, error: error.message }

  revalidateTag('youtube')
  revalidatePath('/')
  return { ok: true }
}
```

Add the `ActionResult` type if not already imported — check the file's existing imports. The existing file already defines it locally:
```typescript
type ActionResult = { ok: true } | { ok: false; error: string }
```

Also add `zodError` helper if not already present:
```typescript
function zodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(', ') || 'Validation failed'
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/youtube/videos/actions.ts
git commit -m "feat(youtube): add pinWeeklyPick and unpinWeeklyPick server actions"
```

---

## Task 15: Weekly pick CMS UI (pick banners + picker dialog)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/videos/videos-connected.tsx`
- Modify: `apps/web/src/app/cms/(authed)/youtube/videos/page.tsx`

**Depends on:** Task 14

- [ ] **Step 1: Update page.tsx to pass pinned video data**

In `apps/web/src/app/cms/(authed)/youtube/videos/page.tsx`, add a query for current pinned videos per channel to pass to the connected component. After the existing data fetches, add:

```typescript
// Fetch current pins (one per channel at most)
const { data: pins } = await supabase
  .from('youtube_videos')
  .select('id, title, channel_id, pinned_until, youtube_channels!inner(locale)')
  .eq('site_id', siteId)
  .gt('pinned_until', new Date().toISOString())
```

Pass `pins` as a new prop to the connected component.

- [ ] **Step 2: Add pick banners to videos-connected.tsx**

At the top of the page (before filters), add a 2-column grid showing the current pick state per locale. Each banner shows:

- **Pinned state**: colored border, video title truncated, "PINNED {days}d" badge, expiry date, "Change" and "Unpin" buttons
- **Default state**: dashed border, "Latest: {title}", "DEFAULT" badge, "Pin" button
- **No channel state**: hidden

The "Change"/"Pin" button opens a picker dialog (modal).

- [ ] **Step 3: Build picker dialog component**

Add a `PickerDialog` component inside `videos-connected.tsx` (or as a sibling file). The dialog:

1. Opens as a modal overlay
2. Header: "Pin {flag} {LOCALE} Weekly Pick"
3. Search input filtering videos by title
4. Scrollable list of videos for the selected locale (sorted by published_at desc)
5. Each row: thumbnail (64×36px), title, duration, date, views
6. Selected video highlighted with checkmark
7. Bottom bar: duration selector (7d/15d/30d toggle), "Pin until {date}" button
8. Calls `pinWeeklyPick` on confirm

- [ ] **Step 4: Run tests**

Run: `npm run test:web`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/youtube/videos/videos-connected.tsx apps/web/src/app/cms/\(authed\)/youtube/videos/page.tsx
git commit -m "feat(youtube): weekly pick CMS UI with per-locale banners and searchable picker dialog"
```

---

## Task 16: /youtube page zero-video state

**Files:**
- Modify: `apps/web/src/app/(public)/youtube/page.tsx`

**Depends on:** Task 4

- [ ] **Step 1: Add 0-channel redirect and 0-video coming-soon state**

In `apps/web/src/app/(public)/youtube/page.tsx`, after fetching `data` from `getYouTubePageData`:

```typescript
import { redirect } from 'next/navigation'

// After data fetch:
if (data.channels.length === 0) {
  redirect('/')
}

if (data.totalVideoCount === 0) {
  // Render coming-soon page
  return (
    <>
      <JsonLdScript graph={graph} />
      <section style={{ textAlign: 'center', padding: '80px 20px', maxWidth: 640, margin: '0 auto' }}>
        <div className="font-mono" style={{ fontSize: 10, color: '#FF2D20', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>
          § 01 · the channel
        </div>
        <h1 className="font-fraunces" style={{ fontSize: 36, fontWeight: 500, margin: '0 0 8px', letterSpacing: '-0.02em', color: 'var(--pb-ink)' }}>
          YouTube
        </h1>
        <p style={{ fontSize: 14, color: 'var(--pb-faint)', margin: '0 0 28px' }}>
          live-coding, setup, bugs
        </p>
        <div style={{ border: '1px dashed rgba(255,45,32,0.2)', borderRadius: 8, padding: '40px 20px' }}>
          <div style={{ width: 72, height: 50, background: 'rgba(255,45,32,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(255,45,32,0.5)"><path d="M8 5v14l11-7z" /></svg>
          </div>
          <div className="font-caveat" style={{ fontSize: 24, color: 'var(--pb-accent)', marginBottom: 8, transform: 'rotate(-1deg)' }}>
            {locale === 'pt' ? 'primeiro vídeo em breve' : 'first video coming soon'}
          </div>
          <p style={{ fontSize: 13, color: 'var(--pb-faint)', margin: '0 0 20px' }}>
            {locale === 'pt' ? 'Inscreva-se no canal para ser notificado.' : 'Subscribe to the channel to get notified when it drops.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360, margin: '0 auto' }}>
            {data.channels.map((ch) => (
              <a
                key={ch.id}
                href={ch.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ border: '2px solid #FF2D20', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,45,32,0.04)', textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#FF2D20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{ch.locale === 'pt' ? '🇧🇷' : '🌎'} {ch.name}</div>
                </div>
                <span style={{ background: '#FF2D20', color: 'white', padding: '6px 12px', fontSize: 11, fontWeight: 600 }}>
                  {locale === 'pt' ? 'Inscrever' : 'Subscribe'}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/youtube/page.tsx
git commit -m "feat(youtube): /youtube page 0-channel redirect + 0-video coming-soon state"
```

---

## Task 17: Delete hardcoded data + final cleanup

**Files:**
- Delete: `apps/web/lib/home/videos-data.ts`

**Depends on:** Tasks 6-11 (all components updated)

- [ ] **Step 1: Delete videos-data.ts**

```bash
rm apps/web/lib/home/videos-data.ts
```

- [ ] **Step 2: Run typecheck to verify no remaining imports**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: Clean — no errors. If any file still imports from `videos-data`, fix the import.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: All tests pass (api + web).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(youtube): delete hardcoded SAMPLE_VIDEOS and YOUTUBE_CHANNELS"
```

---

## Task 18: Integration tests for weekly pick

**Files:**
- Create: `apps/web/test/integration/youtube-weekly-pick.test.ts`

**Depends on:** Tasks 1, 4, 14

- [ ] **Step 1: Write DB-gated integration tests**

Create `apps/web/test/integration/youtube-weekly-pick.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { createClient } from '@supabase/supabase-js'

describe.skipIf(skipIfNoLocalDb())('YouTube weekly pick', () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let siteId: string
  let channelId: string
  let videoIds: string[]

  beforeAll(async () => {
    // Seed site
    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .limit(1)
      .single()
    siteId = site!.id

    // Seed channel
    const { data: ch } = await supabase
      .from('youtube_channels')
      .insert({
        site_id: siteId,
        channel_id: 'UCtest123',
        locale: 'en',
        handle: '@testchannel',
        name: 'Test Channel',
        uploads_playlist_id: 'UUtest123',
      })
      .select('id')
      .single()
    channelId = ch!.id

    // Seed 3 videos
    const videos = []
    for (let i = 0; i < 3; i++) {
      const { data: v } = await supabase
        .from('youtube_videos')
        .insert({
          site_id: siteId,
          channel_id: channelId,
          youtube_video_id: `test-vid-${i}`,
          title: `Test Video ${i}`,
          published_at: new Date(Date.now() - i * 86400000).toISOString(),
          duration: '10:00',
          duration_seconds: 600,
        })
        .select('id')
        .single()
      videos.push(v!.id)
    }
    videoIds = videos
  })

  afterAll(async () => {
    await supabase.from('youtube_videos').delete().eq('channel_id', channelId)
    await supabase.from('youtube_channels').delete().eq('id', channelId)
  })

  it('pinning a video sets pinned_until', async () => {
    const pinnedUntil = new Date(Date.now() + 7 * 86400000).toISOString()
    await supabase
      .from('youtube_videos')
      .update({ pinned_until: pinnedUntil })
      .eq('id', videoIds[1])

    const { data } = await supabase
      .from('youtube_videos')
      .select('pinned_until')
      .eq('id', videoIds[1])
      .single()

    expect(data!.pinned_until).toBeTruthy()
    expect(new Date(data!.pinned_until as string).getTime()).toBeGreaterThan(Date.now())
  })

  it('partial unique index allows only 1 pin per channel', async () => {
    const pinnedUntil = new Date(Date.now() + 7 * 86400000).toISOString()

    // Pin video 0
    await supabase
      .from('youtube_videos')
      .update({ pinned_until: pinnedUntil })
      .eq('id', videoIds[0])

    // Pin video 2 (should fail due to unique index if video 0 still pinned)
    const { error } = await supabase
      .from('youtube_videos')
      .update({ pinned_until: pinnedUntil })
      .eq('id', videoIds[2])

    expect(error).toBeTruthy()

    // Cleanup: unpin video 0
    await supabase
      .from('youtube_videos')
      .update({ pinned_until: null })
      .eq('id', videoIds[0])
  })

  it('clearing pin before setting new one works', async () => {
    const pinnedUntil = new Date(Date.now() + 7 * 86400000).toISOString()

    // Pin video 0
    await supabase
      .from('youtube_videos')
      .update({ pinned_until: pinnedUntil })
      .eq('id', videoIds[0])

    // Clear all pins for channel
    await supabase
      .from('youtube_videos')
      .update({ pinned_until: null })
      .eq('channel_id', channelId)
      .gt('pinned_until', new Date().toISOString())

    // Now pin video 2
    const { error } = await supabase
      .from('youtube_videos')
      .update({ pinned_until: pinnedUntil })
      .eq('id', videoIds[2])

    expect(error).toBeNull()

    // Cleanup
    await supabase
      .from('youtube_videos')
      .update({ pinned_until: null })
      .eq('id', videoIds[2])
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npm run test:web -- --run test/integration/youtube-weekly-pick.test.ts`
Expected: Tests PASS (if `HAS_LOCAL_DB=1` and Supabase local running) or SKIP (if no local DB).

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/integration/youtube-weekly-pick.test.ts
git commit -m "test(youtube): DB-gated integration tests for weekly pick pin/unpin"
```

---

## Task 19: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (api + web).

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: Clean, no errors.

- [ ] **Step 3: Start dev server and verify visually**

Run: `npm run dev -w apps/web`

Verify in browser:
1. **Home page** — YouTube sections should show "coming soon" teasers (if no channels in DB) or hide entirely (if no channels at all)
2. **CMS Settings > YouTube** — Add channel form should be visible
3. **CMS YouTube > Videos** — Pick banners should appear at top
4. **/youtube** — Should redirect to `/` if no channels, or show coming-soon if channels but no videos

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(youtube): final adjustments from visual verification"
```
