# Instagram Feed Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Instagram feed auto-sync with pin/slot system and configurable public display component, mirroring the YouTube-mirror pattern.

**Architecture:** Instagram Graph API → daily cron sync → Supabase (4 tables) + Vercel Blob cache → `<InstagramFeed />` server component with per-instance layout/count props. CMS settings page for account config, token management, and drag-to-reorder pin slots via @dnd-kit.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL + RLS), Vercel Blob, @dnd-kit/core + @dnd-kit/sortable, Vitest, Zod

**Spec:** `docs/superpowers/specs/2026-05-07-instagram-feed-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260507190000_instagram_feed.sql` | DB schema: 4 tables + indexes + RLS |
| `apps/web/src/lib/instagram/types.ts` | Row types, view types, SyncMode |
| `apps/web/src/lib/instagram/api-client.ts` | Instagram Graph API fetch + token refresh |
| `apps/web/src/lib/instagram/sync.ts` | Sync service: fetch posts, upsert, cache media |
| `apps/web/src/lib/instagram/slots.ts` | Slot resolution algorithm (pinned + auto-fill) |
| `apps/web/src/lib/instagram/queries.ts` | Public data queries with `unstable_cache` |
| `apps/web/src/lib/instagram/actions.ts` | Server actions for CMS settings UI |
| `apps/web/src/app/api/cron/instagram-sync/route.ts` | Daily sync cron endpoint |
| `apps/web/src/app/api/cron/instagram-token-refresh/route.ts` | Weekly token refresh cron endpoint |
| `apps/web/src/components/instagram/instagram-feed.tsx` | Public `<InstagramFeed />` server component |
| `apps/web/src/components/instagram/polaroid-card.tsx` | Polaroid card component (grid + scatter) |
| `apps/web/src/components/instagram/slot-manager.tsx` | CMS drag-to-reorder slot manager (client) |
| `apps/web/test/instagram/types.test.ts` | Type guard tests |
| `apps/web/test/instagram/api-client.test.ts` | API client tests |
| `apps/web/test/instagram/sync.test.ts` | Sync service tests |
| `apps/web/test/instagram/slots.test.ts` | Slot resolution tests |
| `apps/web/test/instagram/cron-route.test.ts` | Cron endpoint tests |
| `apps/web/test/instagram/actions.test.ts` | Server action tests |
| `apps/web/test/instagram/instagram-feed.test.tsx` | Component render tests |

### Modified Files

| File | Change |
|------|--------|
| `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx` | Add `'instagram'` to SectionId + SECTIONS + InstagramSection component |
| `apps/web/src/app/cms/(authed)/settings/actions.ts` | Add Instagram server actions (add/remove account, set token, update settings, update slots, trigger sync) |
| `apps/web/src/app/(public)/components/PinboardHome.tsx` | Wire `<InstagramFeed />` into homepage |
| `apps/web/lib/home/queries.ts` | Add `getInstagramPosts()` query |
| `apps/web/lib/home/types.ts` | Add `HomeInstagramPost` type |
| `apps/web/vercel.json` | Add 2 new cron schedules |
| `apps/web/package.json` | Add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260507190000_instagram_feed.sql`
- Test: `apps/web/test/instagram/types.test.ts` (validates types match schema after Task 2)

- [ ] **Step 1: Create the migration file**

```sql
-- Instagram Feed Integration
-- Mirrors YouTube-mirror pattern: accounts, posts, feed_slots, sync_log

-- ── Tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.instagram_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  locale          text NOT NULL DEFAULT 'pt',
  handle          text NOT NULL,
  ig_user_id      text,
  access_token    text,
  token_expires_at timestamptz,
  sync_enabled    boolean NOT NULL DEFAULT true,
  display_slots   int NOT NULL DEFAULT 6,
  layout_type     text NOT NULL DEFAULT 'grid',
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT instagram_accounts_display_slots_check
    CHECK (display_slots >= 1 AND display_slots <= 12),
  CONSTRAINT instagram_accounts_layout_type_check
    CHECK (layout_type IN ('grid', 'scatter')),
  CONSTRAINT instagram_accounts_locale_check
    CHECK (locale IN ('pt', 'en')),
  CONSTRAINT instagram_accounts_site_locale_key
    UNIQUE (site_id, locale)
);

CREATE TABLE IF NOT EXISTS public.instagram_posts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  ig_media_id      text NOT NULL,
  media_type       text NOT NULL,
  media_url        text,
  thumbnail_url    text,
  cached_image_url text,
  caption          text,
  permalink        text NOT NULL,
  like_count       int NOT NULL DEFAULT 0,
  comments_count   int NOT NULL DEFAULT 0,
  ig_timestamp     timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT instagram_posts_media_type_check
    CHECK (media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM')),
  CONSTRAINT instagram_posts_ig_media_id_key
    UNIQUE (ig_media_id)
);

CREATE INDEX idx_instagram_posts_account_ts
  ON public.instagram_posts (account_id, ig_timestamp DESC);

CREATE TABLE IF NOT EXISTS public.instagram_feed_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  position    int NOT NULL,
  post_id     uuid REFERENCES public.instagram_posts(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT instagram_feed_slots_position_check
    CHECK (position >= 1 AND position <= 12),
  CONSTRAINT instagram_feed_slots_account_position_key
    UNIQUE (account_id, position)
);

CREATE TABLE IF NOT EXISTS public.instagram_sync_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  account_id     uuid REFERENCES public.instagram_accounts(id) ON DELETE SET NULL,
  mode           text NOT NULL,
  status         text NOT NULL,
  posts_found    int NOT NULL DEFAULT 0,
  posts_inserted int NOT NULL DEFAULT 0,
  posts_updated  int NOT NULL DEFAULT 0,
  media_cached   int NOT NULL DEFAULT 0,
  error_message  text,
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT instagram_sync_log_mode_check
    CHECK (mode IN ('daily', 'manual', 'token_refresh')),
  CONSTRAINT instagram_sync_log_status_check
    CHECK (status IN ('started', 'completed', 'failed'))
);

CREATE INDEX idx_instagram_sync_log_recent
  ON public.instagram_sync_log (site_id, created_at DESC);

-- ── RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_accounts_public_read ON public.instagram_accounts;
CREATE POLICY instagram_accounts_public_read
  ON public.instagram_accounts FOR SELECT
  USING (public.site_visible(site_id));

DROP POLICY IF EXISTS instagram_accounts_staff_write ON public.instagram_accounts;
CREATE POLICY instagram_accounts_staff_write
  ON public.instagram_accounts TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_posts_public_read ON public.instagram_posts;
CREATE POLICY instagram_posts_public_read
  ON public.instagram_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.site_visible(a.site_id)
    )
  );

DROP POLICY IF EXISTS instagram_posts_staff_write ON public.instagram_posts;
CREATE POLICY instagram_posts_staff_write
  ON public.instagram_posts TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.can_edit_site(a.site_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.can_edit_site(a.site_id)
    )
  );

ALTER TABLE public.instagram_feed_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_feed_slots_public_read ON public.instagram_feed_slots;
CREATE POLICY instagram_feed_slots_public_read
  ON public.instagram_feed_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.site_visible(a.site_id)
    )
  );

DROP POLICY IF EXISTS instagram_feed_slots_staff_write ON public.instagram_feed_slots;
CREATE POLICY instagram_feed_slots_staff_write
  ON public.instagram_feed_slots TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.can_edit_site(a.site_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.can_edit_site(a.site_id)
    )
  );

ALTER TABLE public.instagram_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_sync_log_staff_read ON public.instagram_sync_log;
CREATE POLICY instagram_sync_log_staff_read
  ON public.instagram_sync_log FOR SELECT TO authenticated
  USING (public.can_edit_site(site_id));
```

- [ ] **Step 2: Verify migration syntax**

Run: `cat supabase/migrations/20260507190000_instagram_feed.sql | head -5`
Expected: file exists with correct header

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260507190000_instagram_feed.sql
git commit -m "feat(instagram): add database migration for feed integration

Four tables: instagram_accounts, instagram_posts, instagram_feed_slots,
instagram_sync_log. RLS policies mirror YouTube pattern."
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `apps/web/src/lib/instagram/types.ts`
- Test: `apps/web/test/instagram/types.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/test/instagram/types.test.ts
import { describe, it, expect } from 'vitest'
import type {
  InstagramAccountRow,
  InstagramPostRow,
  InstagramFeedSlotRow,
  InstagramSyncLogRow,
  InstagramPostView,
  ResolvedSlot,
  InstagramSyncMode,
} from '@/lib/instagram/types'

describe('Instagram types', () => {
  it('InstagramAccountRow has all required fields', () => {
    const row: InstagramAccountRow = {
      id: 'acc-1',
      site_id: 'site-1',
      locale: 'pt',
      handle: '@test',
      ig_user_id: '123',
      access_token: 'tok',
      token_expires_at: '2026-07-01T00:00:00Z',
      sync_enabled: true,
      display_slots: 6,
      layout_type: 'grid',
      last_synced_at: null,
      created_at: '2026-05-07T00:00:00Z',
      updated_at: '2026-05-07T00:00:00Z',
    }
    expect(row.id).toBe('acc-1')
    expect(row.layout_type).toBe('grid')
  })

  it('InstagramPostRow has all required fields', () => {
    const row: InstagramPostRow = {
      id: 'post-1',
      account_id: 'acc-1',
      ig_media_id: '17890123456789',
      media_type: 'IMAGE',
      media_url: 'https://scontent.cdninstagram.com/...',
      thumbnail_url: null,
      cached_image_url: 'https://abc.public.blob.vercel-storage.com/instagram/...',
      caption: 'Hello world',
      permalink: 'https://www.instagram.com/p/abc123/',
      like_count: 42,
      comments_count: 5,
      ig_timestamp: '2026-05-01T12:00:00Z',
      created_at: '2026-05-07T00:00:00Z',
      updated_at: '2026-05-07T00:00:00Z',
    }
    expect(row.media_type).toBe('IMAGE')
  })

  it('InstagramFeedSlotRow supports null post_id for auto-fill', () => {
    const slot: InstagramFeedSlotRow = {
      id: 'slot-1',
      account_id: 'acc-1',
      position: 1,
      post_id: null,
      created_at: '2026-05-07T00:00:00Z',
      updated_at: '2026-05-07T00:00:00Z',
    }
    expect(slot.post_id).toBeNull()
  })

  it('ResolvedSlot has pinned flag', () => {
    const slot: ResolvedSlot = {
      position: 1,
      post: {
        id: 'post-1',
        igMediaId: '17890123456789',
        mediaType: 'IMAGE',
        cachedImageUrl: 'https://blob.vercel-storage.com/...',
        caption: 'test',
        permalink: 'https://instagram.com/p/abc/',
        likeCount: 10,
        commentsCount: 2,
        igTimestamp: '2026-05-01T12:00:00Z',
      },
      pinned: true,
    }
    expect(slot.pinned).toBe(true)
  })

  it('InstagramSyncMode covers all valid modes', () => {
    const modes: InstagramSyncMode[] = ['daily', 'manual', 'token_refresh']
    expect(modes).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/instagram/types.test.ts`
Expected: FAIL — module `@/lib/instagram/types` not found

- [ ] **Step 3: Implement types**

```typescript
// apps/web/src/lib/instagram/types.ts

// ── DB Row types (snake_case, match Supabase columns) ──

export interface InstagramAccountRow {
  id: string
  site_id: string
  locale: 'pt' | 'en'
  handle: string
  ig_user_id: string | null
  access_token: string | null
  token_expires_at: string | null
  sync_enabled: boolean
  display_slots: number
  layout_type: 'grid' | 'scatter'
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface InstagramPostRow {
  id: string
  account_id: string
  ig_media_id: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url: string | null
  thumbnail_url: string | null
  cached_image_url: string | null
  caption: string | null
  permalink: string
  like_count: number
  comments_count: number
  ig_timestamp: string
  created_at: string
  updated_at: string
}

export interface InstagramFeedSlotRow {
  id: string
  account_id: string
  position: number
  post_id: string | null
  created_at: string
  updated_at: string
}

export interface InstagramSyncLogRow {
  id: string
  site_id: string
  account_id: string | null
  mode: InstagramSyncMode
  status: 'started' | 'completed' | 'failed'
  posts_found: number
  posts_inserted: number
  posts_updated: number
  media_cached: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

// ── Frontend view types (camelCase, serialized from server → client) ──

export interface InstagramPostView {
  id: string
  igMediaId: string
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  cachedImageUrl: string | null
  caption: string | null
  permalink: string
  likeCount: number
  commentsCount: number
  igTimestamp: string
}

export interface ResolvedSlot {
  position: number
  post: InstagramPostView
  pinned: boolean
}

export interface InstagramAccountView {
  id: string
  locale: 'pt' | 'en'
  handle: string
  syncEnabled: boolean
  displaySlots: number
  layoutType: 'grid' | 'scatter'
  lastSyncedAt: string | null
  tokenExpiresAt: string | null
}

export type InstagramSyncMode = 'daily' | 'manual' | 'token_refresh'

export interface SyncResult {
  postsFound: number
  postsInserted: number
  postsUpdated: number
  mediaCached: number
}

export function toPostView(row: InstagramPostRow): InstagramPostView {
  return {
    id: row.id,
    igMediaId: row.ig_media_id,
    mediaType: row.media_type,
    cachedImageUrl: row.cached_image_url,
    caption: row.caption,
    permalink: row.permalink,
    likeCount: row.like_count,
    commentsCount: row.comments_count,
    igTimestamp: row.ig_timestamp,
  }
}

export function toAccountView(row: InstagramAccountRow): InstagramAccountView {
  return {
    id: row.id,
    locale: row.locale,
    handle: row.handle,
    syncEnabled: row.sync_enabled,
    displaySlots: row.display_slots,
    layoutType: row.layout_type,
    lastSyncedAt: row.last_synced_at,
    tokenExpiresAt: row.token_expires_at,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/instagram/types.test.ts`
Expected: PASS — all 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/instagram/types.ts apps/web/test/instagram/types.test.ts
git commit -m "feat(instagram): add TypeScript types for Instagram feed

Row types (DB), view types (frontend), SyncResult, ResolvedSlot,
toPostView/toAccountView converters."
```

---

## Task 3: Instagram API Client

**Files:**
- Create: `apps/web/src/lib/instagram/api-client.ts`
- Test: `apps/web/test/instagram/api-client.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/test/instagram/api-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import {
  fetchInstagramMedia,
  refreshAccessToken,
  InstagramApiError,
} from '@/lib/instagram/api-client'

describe('fetchInstagramMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed media items on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: '17890123456789',
            media_type: 'IMAGE',
            media_url: 'https://scontent.cdninstagram.com/img.jpg',
            thumbnail_url: null,
            caption: 'Hello',
            permalink: 'https://www.instagram.com/p/abc123/',
            like_count: 42,
            comments_count: 5,
            timestamp: '2026-05-01T12:00:00+0000',
          },
        ],
        paging: {},
      }),
    })

    const result = await fetchInstagramMedia('user-123', 'tok-abc')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('17890123456789')
    expect(result[0].media_type).toBe('IMAGE')
    expect(result[0].like_count).toBe(42)
  })

  it('handles pagination (fetches next page)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: '1', media_type: 'IMAGE', media_url: 'u', caption: null, permalink: 'p', like_count: 0, comments_count: 0, timestamp: '2026-01-01T00:00:00+0000' }],
          paging: { next: 'https://graph.instagram.com/next-page' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: '2', media_type: 'VIDEO', media_url: 'u2', thumbnail_url: 'th', caption: 'cap', permalink: 'p2', like_count: 1, comments_count: 0, timestamp: '2026-01-02T00:00:00+0000' }],
          paging: {},
        }),
      })

    const result = await fetchInstagramMedia('user-123', 'tok', 100)
    expect(result).toHaveLength(2)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws InstagramApiError on API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: 'Invalid OAuth access token', type: 'OAuthException', code: 190 },
      }),
    })

    await expect(fetchInstagramMedia('user-123', 'bad-tok')).rejects.toThrow(InstagramApiError)
  })

  it('throws InstagramApiError on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await expect(fetchInstagramMedia('user-123', 'tok')).rejects.toThrow()
  })
})

describe('refreshAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns new token and expiry on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-tok',
        token_type: 'bearer',
        expires_in: 5184000,
      }),
    })

    const result = await refreshAccessToken('old-tok')
    expect(result.accessToken).toBe('new-tok')
    expect(result.expiresIn).toBe(5184000)
  })

  it('throws on revoked token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: 'Error validating access token', type: 'OAuthException', code: 190 },
      }),
    })

    await expect(refreshAccessToken('revoked-tok')).rejects.toThrow(InstagramApiError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/instagram/api-client.test.ts`
Expected: FAIL — module `@/lib/instagram/api-client` not found

- [ ] **Step 3: Implement API client**

```typescript
// apps/web/src/lib/instagram/api-client.ts

const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0'
const MEDIA_FIELDS = 'id,media_type,media_url,thumbnail_url,caption,permalink,like_count,comments_count,timestamp'

export class InstagramApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly type: string,
  ) {
    super(message)
    this.name = 'InstagramApiError'
  }
}

export interface InstagramMediaItem {
  id: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url: string | null
  thumbnail_url?: string | null
  caption: string | null
  permalink: string
  like_count: number
  comments_count: number
  timestamp: string
}

async function handleApiResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = `Instagram API ${res.status}`
    let errCode = res.status
    let errType = 'HttpError'
    try {
      const body = await res.json()
      if (body?.error) {
        errMsg = body.error.message ?? errMsg
        errCode = body.error.code ?? errCode
        errType = body.error.type ?? errType
      }
    } catch {
      // ignore parse failure
    }
    throw new InstagramApiError(errMsg, errCode, errType)
  }
  return res.json() as Promise<T>
}

export async function fetchInstagramMedia(
  igUserId: string,
  accessToken: string,
  limit = 50,
): Promise<InstagramMediaItem[]> {
  const all: InstagramMediaItem[] = []
  let url: string | null =
    `${GRAPH_API_BASE}/${igUserId}/media?fields=${MEDIA_FIELDS}&access_token=${accessToken}&limit=${Math.min(limit, 50)}`

  while (url && all.length < limit) {
    const data = await handleApiResponse<{
      data: InstagramMediaItem[]
      paging?: { next?: string }
    }>(await fetch(url))

    all.push(...data.data)
    url = data.paging?.next ?? null
  }

  return all.slice(0, limit)
}

export async function refreshAccessToken(
  currentToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = `${GRAPH_API_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`
  const data = await handleApiResponse<{
    access_token: string
    token_type: string
    expires_in: number
  }>(await fetch(url))

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/instagram/api-client.test.ts`
Expected: PASS — all 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/instagram/api-client.ts apps/web/test/instagram/api-client.test.ts
git commit -m "feat(instagram): add API client for Instagram Graph API

fetchInstagramMedia with pagination, refreshAccessToken,
InstagramApiError error class."
```

---

## Task 4: Sync Service

**Files:**
- Create: `apps/web/src/lib/instagram/sync.ts`
- Test: `apps/web/test/instagram/sync.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/test/instagram/sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { InstagramAccountRow } from '@/lib/instagram/types'

vi.mock('@/lib/instagram/api-client', () => ({
  fetchInstagramMedia: vi.fn(),
  InstagramApiError: class InstagramApiError extends Error {
    code: number
    type: string
    constructor(msg: string, code: number, type: string) {
      super(msg)
      this.code = code
      this.type = type
    }
  },
}))

vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({ url: 'https://blob.vercel-storage.com/cached.jpg' }),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { syncInstagramAccount } from '@/lib/instagram/sync'
import { fetchInstagramMedia } from '@/lib/instagram/api-client'
import { put } from '@vercel/blob'

const mockFetchMedia = vi.mocked(fetchInstagramMedia)
const mockBlobPut = vi.mocked(put)

function makeAccount(overrides: Partial<InstagramAccountRow> = {}): InstagramAccountRow {
  return {
    id: 'acc-1',
    site_id: 'site-1',
    locale: 'pt',
    handle: '@test',
    ig_user_id: 'ig-user-1',
    access_token: 'tok-abc',
    token_expires_at: '2026-07-01T00:00:00Z',
    sync_enabled: true,
    display_slots: 6,
    layout_type: 'grid',
    last_synced_at: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function mockSupabase() {
  const upsertFn = vi.fn().mockReturnValue({ data: null, error: null })
  const updateEqFn = vi.fn().mockReturnValue({ data: null, error: null })
  const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn })
  const selectFn = vi.fn()

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'instagram_posts') {
        return {
          select: selectFn.mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          upsert: upsertFn,
        }
      }
      if (table === 'instagram_accounts') {
        return { update: updateFn }
      }
      return { insert: vi.fn().mockReturnValue({ data: null, error: null }) }
    }),
  }
  return { supabase, upsertFn, updateFn, updateEqFn }
}

describe('syncInstagramAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })
  })

  it('inserts new posts and caches media to Blob', async () => {
    mockFetchMedia.mockResolvedValueOnce([
      {
        id: 'media-1',
        media_type: 'IMAGE',
        media_url: 'https://scontent.cdninstagram.com/img.jpg',
        caption: 'Post 1',
        permalink: 'https://instagram.com/p/1/',
        like_count: 10,
        comments_count: 2,
        timestamp: '2026-05-01T12:00:00+0000',
      },
    ])

    const { supabase, upsertFn } = mockSupabase()
    const result = await syncInstagramAccount(supabase as never, makeAccount())

    expect(result.postsFound).toBe(1)
    expect(result.postsInserted).toBe(1)
    expect(upsertFn).toHaveBeenCalledTimes(1)
    expect(mockBlobPut).toHaveBeenCalledTimes(1)
    expect(result.mediaCached).toBe(1)
  })

  it('skips media cache for existing posts', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [{ ig_media_id: 'media-1', cached_image_url: 'https://blob/existing.jpg' }],
          error: null,
        }),
      }),
    })

    mockFetchMedia.mockResolvedValueOnce([
      {
        id: 'media-1',
        media_type: 'IMAGE',
        media_url: 'https://scontent.cdninstagram.com/img.jpg',
        caption: 'Updated caption',
        permalink: 'https://instagram.com/p/1/',
        like_count: 20,
        comments_count: 5,
        timestamp: '2026-05-01T12:00:00+0000',
      },
    ])

    const { supabase, upsertFn } = mockSupabase()
    supabase.from = vi.fn((table: string) => {
      if (table === 'instagram_posts') {
        return {
          select: selectMock,
          upsert: upsertFn,
        }
      }
      if (table === 'instagram_accounts') {
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ data: null, error: null }) }) }
      }
      return {} as never
    })

    const result = await syncInstagramAccount(supabase as never, makeAccount())
    expect(result.postsUpdated).toBe(1)
    expect(mockBlobPut).not.toHaveBeenCalled()
    expect(result.mediaCached).toBe(0)
  })

  it('throws when account has no access token', async () => {
    const { supabase } = mockSupabase()
    await expect(
      syncInstagramAccount(supabase as never, makeAccount({ access_token: null })),
    ).rejects.toThrow('No access token')
  })

  it('throws when account has no ig_user_id', async () => {
    const { supabase } = mockSupabase()
    await expect(
      syncInstagramAccount(supabase as never, makeAccount({ ig_user_id: null })),
    ).rejects.toThrow('No Instagram user ID')
  })

  it('caches thumbnail_url for VIDEO posts', async () => {
    mockFetchMedia.mockResolvedValueOnce([
      {
        id: 'vid-1',
        media_type: 'VIDEO',
        media_url: 'https://video.cdninstagram.com/vid.mp4',
        thumbnail_url: 'https://scontent.cdninstagram.com/thumb.jpg',
        caption: 'Video',
        permalink: 'https://instagram.com/p/vid/',
        like_count: 5,
        comments_count: 1,
        timestamp: '2026-05-02T12:00:00+0000',
      },
    ])

    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })

    const { supabase } = mockSupabase()
    const result = await syncInstagramAccount(supabase as never, makeAccount())

    expect(result.mediaCached).toBe(1)
    const putCall = mockBlobPut.mock.calls[0]
    expect(putCall[0]).toContain('vid-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/instagram/sync.test.ts`
Expected: FAIL — module `@/lib/instagram/sync` not found

- [ ] **Step 3: Implement sync service**

```typescript
// apps/web/src/lib/instagram/sync.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { put } from '@vercel/blob'
import { fetchInstagramMedia } from './api-client'
import type { InstagramAccountRow, SyncResult } from './types'

export async function syncInstagramAccount(
  supabase: SupabaseClient,
  account: InstagramAccountRow,
): Promise<SyncResult> {
  if (!account.access_token) throw new Error('No access token')
  if (!account.ig_user_id) throw new Error('No Instagram user ID')

  const result: SyncResult = { postsFound: 0, postsInserted: 0, postsUpdated: 0, mediaCached: 0 }

  const media = await fetchInstagramMedia(account.ig_user_id, account.access_token)
  result.postsFound = media.length

  if (media.length === 0) return result

  const mediaIds = media.map((m) => m.id)
  const { data: existing } = await supabase
    .from('instagram_posts')
    .select('ig_media_id, cached_image_url')
    .eq('account_id', account.id)
    .in('ig_media_id', mediaIds)

  const existingMap = new Map(
    (existing ?? []).map((r: { ig_media_id: string; cached_image_url: string | null }) => [r.ig_media_id, r.cached_image_url]),
  )

  for (const item of media) {
    const isNew = !existingMap.has(item.id)
    let cachedImageUrl = existingMap.get(item.id) ?? null

    if (isNew) {
      const urlToCache = item.media_type === 'VIDEO'
        ? (item.thumbnail_url ?? item.media_url)
        : item.media_url

      if (urlToCache) {
        try {
          const imgRes = await fetch(urlToCache)
          if (imgRes.ok) {
            const buffer = Buffer.from(await imgRes.arrayBuffer())
            const ext = item.media_type === 'VIDEO' ? 'jpg' : 'jpg'
            const blobResult = await put(
              `instagram/${account.id}/${item.id}.${ext}`,
              buffer,
              { access: 'public', addRandomSuffix: false, contentType: 'image/jpeg' },
            )
            cachedImageUrl = blobResult.url
            result.mediaCached++
          }
        } catch {
          // media cache failure is non-fatal — post still gets stored
        }
      }
    }

    const row = {
      account_id: account.id,
      ig_media_id: item.id,
      media_type: item.media_type,
      media_url: item.media_url,
      thumbnail_url: item.thumbnail_url ?? null,
      cached_image_url: cachedImageUrl,
      caption: item.caption,
      permalink: item.permalink,
      like_count: item.like_count,
      comments_count: item.comments_count,
      ig_timestamp: item.timestamp,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('instagram_posts').upsert(row, {
      onConflict: 'ig_media_id',
    })

    if (!error) {
      if (isNew) result.postsInserted++
      else result.postsUpdated++
    }
  }

  await supabase
    .from('instagram_accounts')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', account.id)

  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/instagram/sync.test.ts`
Expected: PASS — all 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/instagram/sync.ts apps/web/test/instagram/sync.test.ts
git commit -m "feat(instagram): add sync service

Fetches media from Instagram Graph API, upserts to DB,
caches images to Vercel Blob. Handles IMAGE/VIDEO/CAROUSEL."
```

---

## Task 5: Slot Resolution

**Files:**
- Create: `apps/web/src/lib/instagram/slots.ts`
- Test: `apps/web/test/instagram/slots.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/test/instagram/slots.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { InstagramPostRow, InstagramFeedSlotRow } from '@/lib/instagram/types'

import { resolveSlots } from '@/lib/instagram/slots'

function makePost(id: string, igTimestamp: string, overrides: Partial<InstagramPostRow> = {}): InstagramPostRow {
  return {
    id,
    account_id: 'acc-1',
    ig_media_id: `media-${id}`,
    media_type: 'IMAGE',
    media_url: null,
    thumbnail_url: null,
    cached_image_url: `https://blob/${id}.jpg`,
    caption: `Post ${id}`,
    permalink: `https://instagram.com/p/${id}/`,
    like_count: 10,
    comments_count: 2,
    ig_timestamp: igTimestamp,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function makeSlot(position: number, postId: string | null): InstagramFeedSlotRow {
  return {
    id: `slot-${position}`,
    account_id: 'acc-1',
    position,
    post_id: postId,
    created_at: '',
    updated_at: '',
  }
}

describe('resolveSlots', () => {
  it('fills all slots with latest posts when no pins exist', () => {
    const posts = [
      makePost('p1', '2026-05-03T00:00:00Z'),
      makePost('p2', '2026-05-02T00:00:00Z'),
      makePost('p3', '2026-05-01T00:00:00Z'),
    ]
    const slots = [makeSlot(1, null), makeSlot(2, null), makeSlot(3, null)]

    const result = resolveSlots(slots, posts, 3)
    expect(result).toHaveLength(3)
    expect(result[0].post.id).toBe('p1')
    expect(result[0].pinned).toBe(false)
    expect(result[1].post.id).toBe('p2')
    expect(result[2].post.id).toBe('p3')
  })

  it('keeps pinned posts in position, fills rest with latest', () => {
    const posts = [
      makePost('p1', '2026-05-04T00:00:00Z'),
      makePost('p2', '2026-05-03T00:00:00Z'),
      makePost('p3', '2026-05-02T00:00:00Z'),
      makePost('p4', '2026-05-01T00:00:00Z'),
    ]
    const slots = [
      makeSlot(1, 'p3'),
      makeSlot(2, null),
      makeSlot(3, null),
    ]

    const result = resolveSlots(slots, posts, 3)
    expect(result[0].post.id).toBe('p3')
    expect(result[0].pinned).toBe(true)
    expect(result[1].post.id).toBe('p1')
    expect(result[1].pinned).toBe(false)
    expect(result[2].post.id).toBe('p2')
    expect(result[2].pinned).toBe(false)
  })

  it('handles all slots pinned', () => {
    const posts = [
      makePost('p1', '2026-05-03T00:00:00Z'),
      makePost('p2', '2026-05-02T00:00:00Z'),
    ]
    const slots = [makeSlot(1, 'p2'), makeSlot(2, 'p1')]

    const result = resolveSlots(slots, posts, 2)
    expect(result).toHaveLength(2)
    expect(result[0].post.id).toBe('p2')
    expect(result[0].pinned).toBe(true)
    expect(result[1].post.id).toBe('p1')
    expect(result[1].pinned).toBe(true)
  })

  it('handles fewer posts than slots (returns only available)', () => {
    const posts = [makePost('p1', '2026-05-01T00:00:00Z')]
    const slots = [makeSlot(1, null), makeSlot(2, null), makeSlot(3, null)]

    const result = resolveSlots(slots, posts, 3)
    expect(result).toHaveLength(1)
  })

  it('handles deleted pinned post (null post_id treated as auto)', () => {
    const posts = [
      makePost('p1', '2026-05-02T00:00:00Z'),
      makePost('p2', '2026-05-01T00:00:00Z'),
    ]
    const slots = [
      makeSlot(1, 'deleted-post-id'),
      makeSlot(2, null),
    ]

    const result = resolveSlots(slots, posts, 2)
    expect(result).toHaveLength(2)
    expect(result[0].post.id).toBe('p1')
    expect(result[0].pinned).toBe(false)
  })

  it('respects count override (fewer than slots)', () => {
    const posts = [
      makePost('p1', '2026-05-03T00:00:00Z'),
      makePost('p2', '2026-05-02T00:00:00Z'),
      makePost('p3', '2026-05-01T00:00:00Z'),
    ]
    const slots = [makeSlot(1, null), makeSlot(2, null), makeSlot(3, null)]

    const result = resolveSlots(slots, posts, 2)
    expect(result).toHaveLength(2)
  })

  it('creates default slots when none exist', () => {
    const posts = [
      makePost('p1', '2026-05-02T00:00:00Z'),
      makePost('p2', '2026-05-01T00:00:00Z'),
    ]

    const result = resolveSlots([], posts, 3)
    expect(result).toHaveLength(2)
    expect(result[0].pinned).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/instagram/slots.test.ts`
Expected: FAIL — module `@/lib/instagram/slots` not found

- [ ] **Step 3: Implement slot resolution**

```typescript
// apps/web/src/lib/instagram/slots.ts
import type { InstagramPostRow, InstagramFeedSlotRow, ResolvedSlot } from './types'
import { toPostView } from './types'

export function resolveSlots(
  slots: InstagramFeedSlotRow[],
  allPosts: InstagramPostRow[],
  count: number,
): ResolvedSlot[] {
  const postMap = new Map(allPosts.map((p) => [p.id, p]))
  const sortedSlots = [...slots]
    .sort((a, b) => a.position - b.position)
    .slice(0, count)

  const pinnedPostIds = new Set<string>()
  for (const slot of sortedSlots) {
    if (slot.post_id && postMap.has(slot.post_id)) {
      pinnedPostIds.add(slot.post_id)
    }
  }

  const latestPool = allPosts
    .filter((p) => !pinnedPostIds.has(p.id))
    .sort((a, b) => new Date(b.ig_timestamp).getTime() - new Date(a.ig_timestamp).getTime())

  let poolIdx = 0
  const resolved: ResolvedSlot[] = []

  if (sortedSlots.length === 0) {
    for (let i = 0; i < count && poolIdx < latestPool.length; i++) {
      resolved.push({
        position: i + 1,
        post: toPostView(latestPool[poolIdx++]),
        pinned: false,
      })
    }
    return resolved
  }

  for (const slot of sortedSlots) {
    if (slot.post_id && postMap.has(slot.post_id)) {
      resolved.push({
        position: slot.position,
        post: toPostView(postMap.get(slot.post_id)!),
        pinned: true,
      })
    } else if (poolIdx < latestPool.length) {
      resolved.push({
        position: slot.position,
        post: toPostView(latestPool[poolIdx++]),
        pinned: false,
      })
    }
  }

  return resolved
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/instagram/slots.test.ts`
Expected: PASS — all 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/instagram/slots.ts apps/web/test/instagram/slots.test.ts
git commit -m "feat(instagram): add slot resolution algorithm

Pinned posts stay in position, remaining slots auto-fill with
latest non-pinned posts. Handles edge cases: deleted pins,
fewer posts than slots, count override."
```

---

## Task 6: Public Queries (unstable_cache)

**Files:**
- Create: `apps/web/src/lib/instagram/queries.ts`
- Modify: `apps/web/lib/home/queries.ts` (add `getInstagramPosts`)
- Modify: `apps/web/lib/home/types.ts` (add `HomeInstagramPost`)

- [ ] **Step 1: Create Instagram queries module**

```typescript
// apps/web/src/lib/instagram/queries.ts
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { resolveSlots } from './slots'
import type { InstagramAccountRow, InstagramPostRow, InstagramFeedSlotRow, ResolvedSlot } from './types'

export const getInstagramFeedData = unstable_cache(
  async (
    siteId: string,
    locale: string,
    count?: number,
  ): Promise<{ account: InstagramAccountRow | null; slots: ResolvedSlot[] }> => {
    const supabase = getSupabaseServiceClient()
    const dbLocale = locale === 'pt-BR' ? 'pt' : locale

    const { data: account } = await supabase
      .from('instagram_accounts')
      .select('id, site_id, locale, handle, ig_user_id, sync_enabled, display_slots, layout_type, last_synced_at, created_at, updated_at')
      .eq('site_id', siteId)
      .eq('locale', dbLocale)
      .single()

    if (!account) return { account: null, slots: [] }

    const effectiveCount = count ?? (account as InstagramAccountRow).display_slots

    const [postsRes, slotsRes] = await Promise.all([
      supabase
        .from('instagram_posts')
        .select('*')
        .eq('account_id', account.id)
        .order('ig_timestamp', { ascending: false })
        .limit(50),
      supabase
        .from('instagram_feed_slots')
        .select('*')
        .eq('account_id', account.id)
        .order('position'),
    ])

    const posts = (postsRes.data ?? []) as InstagramPostRow[]
    const feedSlots = (slotsRes.data ?? []) as InstagramFeedSlotRow[]
    const resolved = resolveSlots(feedSlots, posts, effectiveCount)

    return {
      account: account as unknown as InstagramAccountRow,
      slots: resolved,
    }
  },
  ['instagram-feed-data'],
  { revalidate: 3600, tags: ['instagram-feed'] },
)
```

- [ ] **Step 2: Add HomeInstagramPost type to `apps/web/lib/home/types.ts`**

Open `apps/web/lib/home/types.ts` and add at the end:

```typescript
export interface HomeInstagramPost {
  id: string
  cachedImageUrl: string | null
  caption: string | null
  permalink: string
  likeCount: number
  igTimestamp: string
  pinned: boolean
}
```

- [ ] **Step 3: Add `getInstagramPosts` to `apps/web/lib/home/queries.ts`**

Add at the end of the file:

```typescript
export const getInstagramPosts = unstable_cache(
  async (siteId: string, locale: string, limit = 6): Promise<HomeInstagramPost[]> => {
    const { getInstagramFeedData } = await import('@/lib/instagram/queries')
    const { slots } = await getInstagramFeedData(siteId, locale, limit)
    return slots.map((s) => ({
      id: s.post.id,
      cachedImageUrl: s.post.cachedImageUrl,
      caption: s.post.caption,
      permalink: s.post.permalink,
      likeCount: s.post.likeCount,
      igTimestamp: s.post.igTimestamp,
      pinned: s.pinned,
    }))
  },
  ['home-instagram-posts'],
  { revalidate: 3600, tags: ['instagram-feed'] },
)
```

Import `HomeInstagramPost` from `./types` if not already auto-resolved.

- [ ] **Step 4: Verify files compile**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep -i instagram | head -20`
Expected: No errors related to Instagram files

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/instagram/queries.ts apps/web/lib/home/queries.ts apps/web/lib/home/types.ts
git commit -m "feat(instagram): add public queries with unstable_cache

getInstagramFeedData for component, getInstagramPosts for Pinboard.
Both use 1h revalidation + instagram-feed tag."
```

---

## Task 7: Cron — Daily Sync Endpoint

**Files:**
- Create: `apps/web/src/app/api/cron/instagram-sync/route.ts`
- Test: `apps/web/test/instagram/cron-route.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/test/instagram/cron-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn(
    (_sb: unknown, _key: unknown, _runId: unknown, _job: unknown, fn: () => Promise<{ status: string; [k: string]: unknown }>) =>
      fn().then((r) => {
        const { status, ...extra } = r
        if (status === 'error') return Response.json(extra, { status: 500 })
        return Response.json(extra, { status: 200 })
      }),
  ),
  newRunId: vi.fn(() => 'run-1'),
}))

vi.mock('@/lib/instagram/sync', () => ({
  syncInstagramAccount: vi.fn(),
}))

import { GET } from '@/app/api/cron/instagram-sync/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { syncInstagramAccount } from '@/lib/instagram/sync'
import { revalidateTag } from 'next/cache'

const mockSync = vi.mocked(syncInstagramAccount)
const mockGetClient = vi.mocked(getSupabaseServiceClient)
const mockRevalidate = vi.mocked(revalidateTag)

function makeRequest(mode = 'daily', secret = 'test-secret'): NextRequest {
  return new NextRequest(`http://localhost/api/cron/instagram-sync?mode=${mode}`, {
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('GET /api/cron/instagram-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'test-secret')
  })

  it('returns 401 without valid CRON_SECRET', async () => {
    const res = await GET(makeRequest('daily', 'wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns ok when no accounts configured', async () => {
    mockGetClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    } as never)

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe('no accounts configured')
  })

  it('syncs accounts and revalidates cache', async () => {
    const insertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }),
      }),
    })
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })

    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{
                  id: 'acc-1', site_id: 'site-1', locale: 'pt', handle: '@test',
                  ig_user_id: 'ig-1', access_token: 'tok', token_expires_at: null,
                  sync_enabled: true, display_slots: 6, layout_type: 'grid',
                  last_synced_at: null, created_at: '', updated_at: '',
                }],
                error: null,
              }),
            }),
          }
        }
        if (table === 'instagram_sync_log') {
          return { insert: insertFn, update: updateFn }
        }
        return {}
      }),
    } as never)

    mockSync.mockResolvedValueOnce({
      postsFound: 10, postsInserted: 3, postsUpdated: 7, mediaCached: 3,
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(mockSync).toHaveBeenCalledTimes(1)
    expect(mockRevalidate).toHaveBeenCalledWith('instagram-feed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/instagram/cron-route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement cron endpoint**

```typescript
// apps/web/src/app/api/cron/instagram-sync/route.ts
import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { syncInstagramAccount } from '@/lib/instagram/sync'
import type { InstagramAccountRow, InstagramSyncMode } from '@/lib/instagram/types'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const mode = (req.nextUrl.searchParams.get('mode') ?? 'daily') as InstagramSyncMode
  if (!['daily', 'manual'].includes(mode)) {
    return Response.json({ error: 'invalid mode' }, { status: 400 })
  }

  const accountId = req.nextUrl.searchParams.get('accountId')
  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, `instagram-sync-${mode}`, runId, 'instagram-sync', async () => {
    let query = supabase
      .from('instagram_accounts')
      .select('*')
      .eq('sync_enabled', true)

    if (accountId) {
      query = query.eq('id', accountId)
    }

    const { data: accounts } = await query

    if (!accounts || accounts.length === 0) {
      return { status: 'ok' as const, message: 'no accounts configured' }
    }

    let totalInserted = 0
    let totalUpdated = 0
    let totalCached = 0

    for (const account of accounts as InstagramAccountRow[]) {
      const { data: logRow } = await supabase.from('instagram_sync_log').insert({
        site_id: account.site_id,
        account_id: account.id,
        mode,
        status: 'started',
      }).select('id').single()

      const logId = logRow?.id

      try {
        const result = await syncInstagramAccount(supabase, account)
        totalInserted += result.postsInserted
        totalUpdated += result.postsUpdated
        totalCached += result.mediaCached

        if (logId) {
          await supabase.from('instagram_sync_log').update({
            status: 'completed',
            posts_found: result.postsFound,
            posts_inserted: result.postsInserted,
            posts_updated: result.postsUpdated,
            media_cached: result.mediaCached,
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)

        if (logId) {
          await supabase.from('instagram_sync_log').update({
            status: 'failed',
            error_message: message,
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }

        Sentry.captureException(err, { tags: { component: 'instagram-sync', mode } })
      }
    }

    if (totalInserted > 0 || totalUpdated > 0) {
      revalidateTag('instagram-feed')
    }

    return {
      status: 'ok' as const,
      mode,
      inserted: totalInserted,
      updated: totalUpdated,
      cached: totalCached,
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/instagram/cron-route.test.ts`
Expected: PASS — all 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/cron/instagram-sync/route.ts apps/web/test/instagram/cron-route.test.ts
git commit -m "feat(instagram): add daily sync cron endpoint

GET /api/cron/instagram-sync — CRON_SECRET auth, withCronLock,
sync_log tracking, Sentry error reporting, cache revalidation."
```

---

## Task 8: Cron — Token Refresh Endpoint

**Files:**
- Create: `apps/web/src/app/api/cron/instagram-token-refresh/route.ts`

- [ ] **Step 1: Implement token refresh endpoint**

```typescript
// apps/web/src/app/api/cron/instagram-token-refresh/route.ts
import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { refreshAccessToken } from '@/lib/instagram/api-client'
import type { InstagramAccountRow } from '@/lib/instagram/types'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, 'instagram-token-refresh', runId, 'instagram-token-refresh', async () => {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .not('access_token', 'is', null)
      .lt('token_expires_at', sevenDaysFromNow)

    if (!accounts || accounts.length === 0) {
      return { status: 'ok' as const, message: 'no tokens need refresh' }
    }

    let refreshed = 0
    let failed = 0

    for (const account of accounts as InstagramAccountRow[]) {
      if (!account.access_token) continue

      const { data: logRow } = await supabase.from('instagram_sync_log').insert({
        site_id: account.site_id,
        account_id: account.id,
        mode: 'token_refresh',
        status: 'started',
      }).select('id').single()

      const logId = logRow?.id

      try {
        const { accessToken, expiresIn } = await refreshAccessToken(account.access_token)
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

        await supabase.from('instagram_accounts').update({
          access_token: accessToken,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }).eq('id', account.id)

        if (logId) {
          await supabase.from('instagram_sync_log').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }

        refreshed++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)

        if (logId) {
          await supabase.from('instagram_sync_log').update({
            status: 'failed',
            error_message: message,
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }

        Sentry.captureException(err, {
          tags: { component: 'instagram-token-refresh', account_id: account.id },
        })
        failed++
      }
    }

    return { status: 'ok' as const, refreshed, failed }
  })
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep instagram-token | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/cron/instagram-token-refresh/route.ts
git commit -m "feat(instagram): add weekly token refresh cron

GET /api/cron/instagram-token-refresh — refreshes tokens expiring
within 7 days using Instagram Graph API refresh endpoint."
```

---

## Task 9: Vercel Cron Configuration

**Files:**
- Modify: `apps/web/vercel.json`

- [ ] **Step 1: Add Instagram cron schedules**

In `apps/web/vercel.json`, add to the `crons` array (after the YouTube entries):

```json
{ "path": "/api/cron/instagram-sync", "schedule": "0 8 * * *" },
{ "path": "/api/cron/instagram-token-refresh", "schedule": "0 6 * * 1" }
```

- [ ] **Step 2: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('apps/web/vercel.json', 'utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add apps/web/vercel.json
git commit -m "feat(instagram): add cron schedules to vercel.json

Daily sync at 08:00 UTC, weekly token refresh at 06:00 UTC Monday."
```

---

## Task 10: Install @dnd-kit Dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install dependencies**

Run: `cd apps/web && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 2: Verify install**

Run: `node -e "require('@dnd-kit/core'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore(instagram): install @dnd-kit for drag-to-reorder slots"
```

---

## Task 11: Server Actions for CMS Settings

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/actions.ts`
- Test: `apps/web/test/instagram/actions.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/test/instagram/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockGetClient = vi.mocked(getSupabaseServiceClient)

describe('Instagram server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('addInstagramAccount inserts row with handle and locale', async () => {
    const insertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'acc-1' }, error: null }),
      }),
    })
    mockGetClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: insertFn }),
    } as never)

    const { addInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const result = await addInstagramAccount({ handle: '@test', locale: 'pt' })
    expect(result.ok).toBe(true)
    expect(insertFn).toHaveBeenCalledTimes(1)
  })

  it('addInstagramAccount rejects invalid locale', async () => {
    const { addInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const result = await addInstagramAccount({ handle: '@test', locale: 'fr' as never })
    expect(result.ok).toBe(false)
  })

  it('updateInstagramSlots updates positions in batch', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    const deleteFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gt: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    mockGetClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        upsert: upsertFn,
        delete: deleteFn,
      }),
    } as never)

    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: 'acc-1',
      slots: [
        { position: 1, postId: 'post-1' },
        { position: 2, postId: null },
      ],
    })
    expect(result.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/instagram/actions.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Add Instagram actions to settings/actions.ts**

Add the following at the end of `apps/web/src/app/cms/(authed)/settings/actions.ts`:

```typescript
// ── Instagram ──────────────────────────────────────────────────────

const instagramAccountSchema = z.object({
  handle: z.string().min(1).max(50),
  locale: z.enum(['pt', 'en']),
})

const instagramSettingsSchema = z.object({
  accountId: z.string().uuid(),
  sync_enabled: z.boolean().optional(),
  display_slots: z.number().int().min(1).max(12).optional(),
  layout_type: z.enum(['grid', 'scatter']).optional(),
})

const instagramTokenSchema = z.object({
  accountId: z.string().uuid(),
  accessToken: z.string().min(1),
})

const instagramSlotSchema = z.object({
  accountId: z.string().uuid(),
  slots: z.array(z.object({
    position: z.number().int().min(1).max(12),
    postId: z.string().uuid().nullable(),
  })),
})

export async function addInstagramAccount(input: {
  handle: string
  locale: string
}): Promise<ActionResult> {
  const parsed = instagramAccountSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('instagram_accounts')
    .insert({
      site_id: siteId,
      handle: parsed.data.handle,
      locale: parsed.data.locale,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function removeInstagramAccount(input: {
  accountId: string
}): Promise<ActionResult> {
  const parsed = z.object({ accountId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('instagram_accounts')
    .delete()
    .eq('id', parsed.data.accountId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  revalidateTag('instagram-feed')
  return { ok: true }
}

export async function updateInstagramSettings(input: {
  accountId: string
  sync_enabled?: boolean
  display_slots?: number
  layout_type?: 'grid' | 'scatter'
}): Promise<ActionResult> {
  const parsed = instagramSettingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { accountId, ...updates } = parsed.data

  const { error } = await supabase
    .from('instagram_accounts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', accountId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  revalidateTag('instagram-feed')
  return { ok: true }
}

export async function setInstagramToken(input: {
  accountId: string
  accessToken: string
}): Promise<ActionResult> {
  const parsed = instagramTokenSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('instagram_accounts')
    .update({
      access_token: parsed.data.accessToken,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.accountId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function triggerInstagramSync(input: {
  accountId: string
}): Promise<ActionResult> {
  const parsed = z.object({ accountId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  await requireEditAccess()

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return { ok: false, error: 'CRON_SECRET not configured' }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(
      `${baseUrl}/api/cron/instagram-sync?mode=manual&accountId=${parsed.data.accountId}`,
      { headers: { authorization: `Bearer ${cronSecret}` } },
    )
    if (!res.ok) return { ok: false, error: `Sync failed: ${res.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Sync request failed' }
  }

  revalidatePath('/cms/settings')
  return { ok: true }
}

export async function updateInstagramSlots(input: {
  accountId: string
  slots: { position: number; postId: string | null }[]
}): Promise<ActionResult> {
  const parsed = instagramSlotSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const rows = parsed.data.slots.map((s) => ({
    account_id: parsed.data.accountId,
    position: s.position,
    post_id: s.postId,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('instagram_feed_slots')
    .upsert(rows, { onConflict: 'account_id,position' })

  if (error) return { ok: false, error: error.message }
  revalidateTag('instagram-feed')
  revalidatePath('/cms/settings')
  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/instagram/actions.test.ts`
Expected: PASS — all 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/settings/actions.ts apps/web/test/instagram/actions.test.ts
git commit -m "feat(instagram): add CMS server actions

addInstagramAccount, removeInstagramAccount, updateInstagramSettings,
setInstagramToken, triggerInstagramSync, updateInstagramSlots."
```

---

## Task 12: CMS Slot Manager Component (drag-to-reorder)

**Files:**
- Create: `apps/web/src/components/instagram/slot-manager.tsx`

- [ ] **Step 1: Implement the slot manager client component**

```tsx
// apps/web/src/components/instagram/slot-manager.tsx
'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SlotItem {
  id: string
  position: number
  postId: string | null
  thumbnailUrl: string | null
  caption: string | null
}

interface SlotManagerProps {
  slots: SlotItem[]
  allPosts: { id: string; cachedImageUrl: string | null; caption: string | null }[]
  onReorder: (slots: { position: number; postId: string | null }[]) => void
  onPinPost: (position: number, postId: string | null) => void
  disabled?: boolean
}

function SortableSlotCard({
  slot,
  onTogglePin,
  disabled,
}: {
  slot: SlotItem
  onTogglePin: () => void
  disabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot.id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg border p-2 ${
        slot.postId
          ? 'border-indigo-500/50 bg-indigo-950/30'
          : 'border-slate-600 bg-slate-800/50'
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        {slot.thumbnailUrl ? (
          <img
            src={slot.thumbnailUrl}
            alt={slot.caption ?? ''}
            className="aspect-square w-full rounded object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded bg-slate-700 text-xs text-slate-500">
            Auto
          </div>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-slate-500">#{slot.position}</span>
        <button
          type="button"
          onClick={onTogglePin}
          disabled={disabled}
          className="text-xs text-slate-400 hover:text-indigo-400 disabled:opacity-50"
        >
          {slot.postId ? 'Unpin' : 'Pin'}
        </button>
      </div>
    </div>
  )
}

export function SlotManager({
  slots: initialSlots,
  allPosts,
  onReorder,
  onPinPost,
  disabled,
}: SlotManagerProps) {
  const [slots, setSlots] = useState(initialSlots)
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      setSlots((prev) => {
        const oldIndex = prev.findIndex((s) => s.id === active.id)
        const newIndex = prev.findIndex((s) => s.id === over.id)
        const reordered = arrayMove(prev, oldIndex, newIndex).map((s, i) => ({
          ...s,
          position: i + 1,
        }))

        onReorder(reordered.map((s) => ({ position: s.position, postId: s.postId })))
        return reordered
      })
    },
    [onReorder],
  )

  const handleTogglePin = (position: number) => {
    const slot = slots.find((s) => s.position === position)
    if (slot?.postId) {
      onPinPost(position, null)
      setSlots((prev) =>
        prev.map((s) =>
          s.position === position ? { ...s, postId: null, thumbnailUrl: null, caption: null } : s,
        ),
      )
    } else {
      setPickerSlot(position)
    }
  }

  const handlePickPost = (postId: string) => {
    if (pickerSlot === null) return
    const post = allPosts.find((p) => p.id === postId)
    onPinPost(pickerSlot, postId)
    setSlots((prev) =>
      prev.map((s) =>
        s.position === pickerSlot
          ? { ...s, postId, thumbnailUrl: post?.cachedImageUrl ?? null, caption: post?.caption ?? null }
          : s,
      ),
    )
    setPickerSlot(null)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-slate-400">Drag to reorder · Click Pin/Unpin to assign posts</p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slots.map((s) => s.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((slot) => (
              <SortableSlotCard
                key={slot.id}
                slot={slot}
                onTogglePin={() => handleTogglePin(slot.position)}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {pickerSlot !== null && (
        <div className="mt-3 rounded-lg border border-slate-600 bg-slate-800 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-slate-300">Select a post for slot #{pickerSlot}</p>
            <button
              type="button"
              onClick={() => setPickerSlot(null)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
          <div className="grid max-h-48 grid-cols-6 gap-2 overflow-y-auto">
            {allPosts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => handlePickPost(post.id)}
                className="rounded border border-slate-700 hover:border-indigo-500"
              >
                {post.cachedImageUrl ? (
                  <img
                    src={post.cachedImageUrl}
                    alt={post.caption ?? ''}
                    className="aspect-square w-full rounded object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-slate-700 text-xs text-slate-500">
                    ?
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep slot-manager | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/instagram/slot-manager.tsx
git commit -m "feat(instagram): add drag-to-reorder SlotManager component

@dnd-kit sortable grid with pin/unpin toggle and post picker modal.
Client component for CMS settings."
```

---

## Task 13: CMS Settings — Instagram Section

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx`

- [ ] **Step 1: Add 'instagram' to SectionId and SECTIONS**

In `settings-connected.tsx`:

1. Add `'instagram'` to the `SectionId` type union (after `'youtube'`):
```typescript
type SectionId =
  | 'branding'
  | 'seo'
  | 'newsletters'
  | 'blog-cadence'
  | 'youtube'
  | 'instagram'
  | 'localization'
  | 'danger-zone'
```

2. Add to `SECTIONS` array (after YouTube entry):
```typescript
{ id: 'instagram', label: 'Instagram' },
```

3. Add `instagramAccounts` to Props interface:
```typescript
interface Props {
  site: SiteData
  newsletterTypes: NewsletterTypeData[]
  blogCadence: BlogCadenceData[]
  youtubeChannels?: YouTubeChannelData[]
  instagramAccounts?: InstagramAccountData[]
  initialSection: string
  seoFlags?: SeoFlags
  readOnly?: boolean
}
```

4. Add `InstagramAccountData` type (near other data types):
```typescript
interface InstagramAccountData {
  id: string
  locale: 'pt' | 'en'
  handle: string
  sync_enabled: boolean
  display_slots: number
  layout_type: 'grid' | 'scatter'
  last_synced_at: string | null
  token_expires_at: string | null
  posts: { id: string; cached_image_url: string | null; caption: string | null }[]
  sync_logs: { mode: string; status: string; posts_found: number; posts_inserted: number; posts_updated: number; created_at: string; error_message: string | null }[]
  slots: { id: string; position: number; post_id: string | null; thumbnail_url: string | null; caption: string | null }[]
}
```

- [ ] **Step 2: Add the render case**

In the main component's render section (after the YouTube section):

```tsx
{activeSection === 'instagram' && (
  <InstagramSection
    accounts={instagramAccounts ?? []}
    readOnly={readOnly}
  />
)}
```

Add `instagramAccounts` to the destructured props in `SettingsConnected`.

- [ ] **Step 3: Implement InstagramSection component**

Add above the main `SettingsConnected` export:

```tsx
function InstagramSection({
  accounts: initialAccounts,
  readOnly,
}: {
  accounts: InstagramAccountData[]
  readOnly: boolean
}) {
  const [, startTransition] = useTransition()
  const [accounts, setAccounts] = useState(initialAccounts)

  const handleRemove = (accountId: string) => {
    if (!confirm('Remove this Instagram account and all synced posts?')) return
    startTransition(async () => {
      const { removeInstagramAccount } = await import('./actions')
      const res = await removeInstagramAccount({ accountId })
      if (res.ok) setAccounts(prev => prev.filter(a => a.id !== accountId))
      else alert(res.error)
    })
  }

  const handleAdded = (acc: InstagramAccountData) => {
    setAccounts(prev => [...prev, acc])
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-200">Instagram Feed</h2>

      {accounts.length === 0 && (
        <p className="text-sm text-slate-400">No Instagram account configured.</p>
      )}

      {accounts.map((account) => (
        <InstagramAccountCard
          key={account.id}
          account={account}
          readOnly={readOnly}
          onRemove={() => handleRemove(account.id)}
        />
      ))}

      {accounts.length < 2 && !readOnly && (
        <AddInstagramForm
          existingLocales={accounts.map(a => a.locale)}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}

function InstagramAccountCard({
  account,
  readOnly,
  onRemove,
}: {
  account: InstagramAccountData
  readOnly: boolean
  onRemove: () => void
}) {
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()
  const [syncEnabled, setSyncEnabled] = useState(account.sync_enabled)
  const [displaySlots, setDisplaySlots] = useState(account.display_slots)
  const [layoutType, setLayoutType] = useState(account.layout_type)
  const [token, setToken] = useState('')
  const [syncing, setSyncing] = useState(false)

  const flag = account.locale === 'pt' ? '🇧🇷' : '🇺🇸'

  const daysUntilExpiry = account.token_expires_at
    ? Math.ceil((new Date(account.token_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) return
    setSaveState('saving')
    startTransition(async () => {
      const { updateInstagramSettings } = await import('./actions')
      const res = await updateInstagramSettings({
        accountId: account.id,
        sync_enabled: syncEnabled,
        display_slots: displaySlots,
        layout_type: layoutType,
      })
      setSaveState(res.ok ? 'success' : 'error')
    })
  }

  const handleSetToken = () => {
    if (!token.trim()) return
    startTransition(async () => {
      const { setInstagramToken } = await import('./actions')
      const res = await setInstagramToken({ accountId: account.id, accessToken: token.trim() })
      if (res.ok) { setToken(''); alert('Token saved') }
      else alert(res.error)
    })
  }

  const handleSync = () => {
    setSyncing(true)
    startTransition(async () => {
      const { triggerInstagramSync } = await import('./actions')
      const res = await triggerInstagramSync({ accountId: account.id })
      setSyncing(false)
      if (!res.ok) alert(res.error)
    })
  }

  const handleSlotReorder = (slots: { position: number; postId: string | null }[]) => {
    startTransition(async () => {
      const { updateInstagramSlots } = await import('./actions')
      await updateInstagramSlots({ accountId: account.id, slots })
    })
  }

  const handlePinPost = (position: number, postId: string | null) => {
    startTransition(async () => {
      const { updateInstagramSlots } = await import('./actions')
      const currentSlots = account.slots.map(s => ({
        position: s.position,
        postId: s.position === position ? postId : s.post_id,
      }))
      await updateInstagramSlots({ accountId: account.id, slots: currentSlots })
    })
  }

  const { SlotManager } = require('@/components/instagram/slot-manager')

  return (
    <div className="space-y-4">
      <form onSubmit={handleSaveSettings} className={sectionCls()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{flag}</span>
            <h3 className="text-base font-medium text-slate-200">{account.handle}</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || readOnly}
              className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
            {!readOnly && (
              <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-300">
                Remove
              </button>
            )}
          </div>
        </div>

        {account.last_synced_at && (
          <p className="text-xs text-slate-500">
            Last sync: {new Date(account.last_synced_at).toLocaleString()}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
              disabled={readOnly}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500"
            />
            Auto-sync enabled
          </label>

          <div className="space-y-1">
            <label className={labelCls()}>Layout</label>
            <select
              value={layoutType}
              onChange={(e) => setLayoutType(e.target.value as 'grid' | 'scatter')}
              disabled={readOnly}
              className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            >
              <option value="grid">Grid</option>
              <option value="scatter">Scatter</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className={labelCls()}>Display Slots ({displaySlots})</label>
          <input
            type="range"
            min={1}
            max={12}
            value={displaySlots}
            onChange={(e) => setDisplaySlots(Number(e.target.value))}
            disabled={readOnly}
            className="w-full"
          />
        </div>

        {!readOnly && (
          <div className="flex justify-end pt-2">
            <SaveButton state={saveState} />
          </div>
        )}
      </form>

      {/* Token management */}
      <div className={sectionCls()}>
        <h4 className="text-sm font-medium text-slate-300">Access Token</h4>
        {daysUntilExpiry !== null && (
          <p className={`text-xs ${daysUntilExpiry < 7 ? 'text-amber-400' : 'text-slate-500'}`}>
            Expires in {daysUntilExpiry} days · Auto-refresh enabled
          </p>
        )}
        {!readOnly && (
          <div className="flex items-end gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste long-lived access token"
              className="flex-1 rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
            />
            <button
              type="button"
              onClick={handleSetToken}
              disabled={!token.trim()}
              className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        )}
      </div>

      {/* Slot manager */}
      {account.posts.length > 0 && (
        <div className={sectionCls()}>
          <h4 className="text-sm font-medium text-slate-300">Pin Management</h4>
          <SlotManager
            slots={account.slots.map(s => ({
              id: s.id,
              position: s.position,
              postId: s.post_id,
              thumbnailUrl: s.thumbnail_url,
              caption: s.caption,
            }))}
            allPosts={account.posts.map(p => ({
              id: p.id,
              cachedImageUrl: p.cached_image_url,
              caption: p.caption,
            }))}
            onReorder={handleSlotReorder}
            onPinPost={handlePinPost}
            disabled={readOnly}
          />
        </div>
      )}

      {/* Sync log */}
      {account.sync_logs.length > 0 && (
        <div className={sectionCls()}>
          <h4 className="text-sm font-medium text-slate-300">Sync History</h4>
          <div className="space-y-1">
            {account.sync_logs.slice(0, 5).map((log, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">{new Date(log.created_at).toLocaleDateString()}</span>
                <span className={log.status === 'completed' ? 'text-green-400' : log.status === 'failed' ? 'text-red-400' : 'text-slate-400'}>
                  {log.status}
                </span>
                {log.status === 'completed' && (
                  <span className="text-slate-500">{log.posts_inserted} new, {log.posts_updated} updated</span>
                )}
                {log.error_message && (
                  <span className="text-red-400">{log.error_message}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AddInstagramForm({
  existingLocales,
  onAdded,
}: {
  existingLocales: string[]
  onAdded: (acc: InstagramAccountData) => void
}) {
  const [handle, setHandle] = useState('')
  const [locale, setLocale] = useState<'pt' | 'en'>(
    existingLocales.includes('pt') ? 'en' : 'pt',
  )
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableLocales = (['pt', 'en'] as const).filter(l => !existingLocales.includes(l))

  const handleAdd = async () => {
    if (!handle.trim()) return
    setAdding(true)
    setError(null)
    const { addInstagramAccount } = await import('./actions')
    const res = await addInstagramAccount({ handle: handle.trim(), locale })
    setAdding(false)
    if (!res.ok) { setError(res.error); return }
    onAdded({
      id: crypto.randomUUID(),
      handle: handle.trim(),
      locale,
      sync_enabled: true,
      display_slots: 6,
      layout_type: 'grid',
      last_synced_at: null,
      token_expires_at: null,
      posts: [],
      sync_logs: [],
      slots: [],
    })
    setHandle('')
  }

  return (
    <div className={sectionCls()}>
      <h3 className="text-sm font-medium text-slate-300">Add Instagram Account</h3>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className={labelCls()}>Handle</label>
          <input
            type="text"
            value={handle}
            onChange={e => { setHandle(e.target.value); setError(null) }}
            placeholder="@bythiagofigueiredo"
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
          />
        </div>
        <div className="space-y-1">
          <label className={labelCls()}>Locale</label>
          <select
            value={locale}
            onChange={e => setLocale(e.target.value as 'pt' | 'en')}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
          >
            {availableLocales.map(l => (
              <option key={l} value={l}>{l === 'pt' ? '🇧🇷 PT-BR' : '🌎 EN'}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !handle.trim()}
          className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Connect'}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Update keyboard shortcut range**

In the `handleKeyDown` effect, update the key range check from `e.key <= '6'` to `e.key <= '8'` (since we now have 8 sections with Instagram added).

- [ ] **Step 5: Verify compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/settings/settings-connected.tsx
git commit -m "feat(instagram): add CMS settings section

InstagramSection with account card, token management, display settings,
drag-to-reorder slot manager, sync history. Mirrors YouTube pattern."
```

---

## Task 14: Settings Page Data Loading

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/page.tsx` (the server page that loads data for `SettingsConnected`)

- [ ] **Step 1: Find the settings page.tsx**

Run: `find apps/web/src/app/cms -name "page.tsx" -path "*settings*" | head -3`

- [ ] **Step 2: Add Instagram data fetching**

In the settings page server component, add Instagram account data fetching alongside the existing YouTube channel fetch. Query `instagram_accounts` with:

```typescript
const { data: instagramAccounts } = await supabase
  .from('instagram_accounts')
  .select('id, locale, handle, sync_enabled, display_slots, layout_type, last_synced_at, token_expires_at')
  .eq('site_id', siteId)
  .order('locale')
```

For each account, also fetch posts, slots, and recent sync logs:

```typescript
const instagramData = await Promise.all(
  (instagramAccounts ?? []).map(async (acc) => {
    const [postsRes, slotsRes, logsRes] = await Promise.all([
      supabase.from('instagram_posts')
        .select('id, cached_image_url, caption')
        .eq('account_id', acc.id)
        .order('ig_timestamp', { ascending: false })
        .limit(50),
      supabase.from('instagram_feed_slots')
        .select('id, position, post_id')
        .eq('account_id', acc.id)
        .order('position'),
      supabase.from('instagram_sync_log')
        .select('mode, status, posts_found, posts_inserted, posts_updated, created_at, error_message')
        .eq('account_id', acc.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const posts = postsRes.data ?? []
    const rawSlots = slotsRes.data ?? []
    const postMap = new Map(posts.map(p => [p.id, p]))

    return {
      ...acc,
      posts,
      sync_logs: logsRes.data ?? [],
      slots: rawSlots.map(s => ({
        ...s,
        thumbnail_url: s.post_id ? postMap.get(s.post_id)?.cached_image_url ?? null : null,
        caption: s.post_id ? postMap.get(s.post_id)?.caption ?? null : null,
      })),
    }
  }),
)
```

Pass `instagramAccounts={instagramData}` to `<SettingsConnected />`.

- [ ] **Step 3: Verify compiles and page loads**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep settings | head -10`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/settings/page.tsx
git commit -m "feat(instagram): load Instagram data in settings page

Fetches accounts, posts, slots, and sync logs for CMS settings UI."
```

---

## Task 15: Polaroid Card Component

**Files:**
- Create: `apps/web/src/components/instagram/polaroid-card.tsx`

- [ ] **Step 1: Implement the polaroid card**

```tsx
// apps/web/src/components/instagram/polaroid-card.tsx
import type { InstagramPostView } from '@/lib/instagram/types'

const TAPE_COLORS = [
  'bg-amber-300/40',
  'bg-sky-300/40',
  'bg-rose-300/40',
]

function seededRandom(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash % 1000) / 1000
}

interface PolaroidCardProps {
  post: InstagramPostView
  index: number
  pinned?: boolean
  className?: string
}

export function PolaroidCard({ post, index, pinned, className = '' }: PolaroidCardProps) {
  const rand = seededRandom(post.id)
  const rotation = (rand - 0.5) * 6
  const tapeColor = TAPE_COLORS[index % TAPE_COLORS.length]

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative block ${className}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <div className="relative bg-[#faf8f4] p-2 pb-8 shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg dark:bg-[#2a2824]">
        {/* Grain texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />

        {/* Tape */}
        <div className={`absolute -top-2 left-1/2 z-10 h-5 w-12 -translate-x-1/2 -rotate-1 rounded-sm ${tapeColor}`} />

        {/* Photo */}
        <div className="relative aspect-square overflow-hidden">
          {post.cachedImageUrl ? (
            <img
              src={post.cachedImageUrl}
              alt={post.caption ?? ''}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-200 dark:bg-slate-700">
              <span className="text-sm text-slate-400">No image</span>
            </div>
          )}
          {/* Vignette */}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.15)]" />
        </div>

        {/* Caption */}
        <div className="mt-2 px-0.5">
          {post.caption && (
            <p className="line-clamp-2 font-['Caveat',cursive] text-sm leading-tight text-slate-700 dark:text-slate-300">
              {post.caption}
            </p>
          )}
          <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-400">
            <span>{formatDate(post.igTimestamp)}</span>
            <span>♥ {post.likeCount}</span>
          </div>
        </div>
      </div>
    </a>
  )
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep polaroid | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/instagram/polaroid-card.tsx
git commit -m "feat(instagram): add PolaroidCard component

Paper background, grain texture, translucent tape, Caveat font
caption, organic seeded rotation per card. Matches Pinboard design."
```

---

## Task 16: Public InstagramFeed Component

**Files:**
- Create: `apps/web/src/components/instagram/instagram-feed.tsx`
- Test: `apps/web/test/instagram/instagram-feed.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// apps/web/test/instagram/instagram-feed.test.tsx
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/instagram/queries', () => ({
  getInstagramFeedData: vi.fn(),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', defaultLocale: 'pt-BR' }),
}))

import { getInstagramFeedData } from '@/lib/instagram/queries'

const mockGetData = vi.mocked(getInstagramFeedData)

describe('InstagramFeed', () => {
  it('returns null when no account configured', async () => {
    mockGetData.mockResolvedValueOnce({ account: null, slots: [] })

    const { InstagramFeed } = await import('@/components/instagram/instagram-feed')
    const result = await InstagramFeed({})
    expect(result).toBeNull()
  })

  it('returns null when no posts available', async () => {
    mockGetData.mockResolvedValueOnce({
      account: {
        id: 'acc-1', site_id: 'site-1', locale: 'pt', handle: '@test',
        ig_user_id: null, access_token: null, token_expires_at: null,
        sync_enabled: true, display_slots: 6, layout_type: 'grid',
        last_synced_at: null, created_at: '', updated_at: '',
      },
      slots: [],
    })

    const { InstagramFeed } = await import('@/components/instagram/instagram-feed')
    const result = await InstagramFeed({})
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/instagram/instagram-feed.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement InstagramFeed**

```tsx
// apps/web/src/components/instagram/instagram-feed.tsx
import { getSiteContext } from '@/lib/cms/site-context'
import { getInstagramFeedData } from '@/lib/instagram/queries'
import { PolaroidCard } from './polaroid-card'
import type { ResolvedSlot, InstagramAccountRow } from '@/lib/instagram/types'

interface InstagramFeedProps {
  accountId?: string
  layout?: 'grid' | 'scatter'
  count?: number
  locale?: string
  className?: string
}

const SCATTER_POSITIONS: Record<number, { top: string; left: string }[]> = {
  3: [
    { top: '5%', left: '5%' },
    { top: '10%', left: '38%' },
    { top: '0%', left: '68%' },
  ],
  5: [
    { top: '0%', left: '2%' },
    { top: '15%', left: '22%' },
    { top: '5%', left: '42%' },
    { top: '18%', left: '60%' },
    { top: '2%', left: '78%' },
  ],
  6: [
    { top: '0%', left: '0%' },
    { top: '12%', left: '18%' },
    { top: '2%', left: '36%' },
    { top: '15%', left: '52%' },
    { top: '5%', left: '68%' },
    { top: '10%', left: '84%' },
  ],
}

function getGridCols(count: number): string {
  if (count <= 3) return 'grid-cols-3'
  if (count <= 4) return 'grid-cols-4'
  if (count <= 6) return 'grid-cols-3'
  if (count <= 8) return 'grid-cols-4'
  return 'grid-cols-4'
}

export async function InstagramFeed({
  accountId,
  layout,
  count,
  locale,
  className = '',
}: InstagramFeedProps) {
  const { siteId, defaultLocale } = await getSiteContext()
  const effectiveLocale = locale ?? defaultLocale ?? 'pt-BR'

  const { account, slots } = await getInstagramFeedData(siteId, effectiveLocale, count)

  if (!account || slots.length === 0) return null

  const effectiveLayout = layout ?? (account as InstagramAccountRow).layout_type
  const handle = (account as InstagramAccountRow).handle

  return (
    <section className={`${className}`}>
      {/* Section Header */}
      <div className="mb-6 text-center">
        <p className="font-['Caveat',cursive] text-lg text-indigo-400 dark:text-indigo-300" style={{ transform: 'rotate(-2deg)' }}>
          últimos cliques
        </p>
        <h2 className="font-['Fraunces',serif] text-2xl font-semibold text-slate-800 dark:text-slate-100">
          do iPhone, sem filtro
        </h2>
        <p className="mt-1 font-mono text-xs text-slate-500">
          {handle} · atualizado automaticamente
        </p>
      </div>

      {/* Grid layout */}
      {effectiveLayout === 'grid' && (
        <div className={`grid gap-4 ${getGridCols(slots.length)} max-md:grid-cols-2`}>
          {slots.map((slot, i) => (
            <div
              key={slot.post.id}
              className="transition-transform"
              style={{ transform: `translateY(${i % 2 === 0 ? 14 : -4}px)` }}
            >
              <PolaroidCard post={slot.post} index={i} pinned={slot.pinned} />
            </div>
          ))}
        </div>
      )}

      {/* Scatter layout (desktop only) */}
      {effectiveLayout === 'scatter' && (
        <>
          {/* Desktop scatter */}
          <div className="relative hidden min-h-[500px] md:block">
            {slots.map((slot, i) => {
              const positions = SCATTER_POSITIONS[slots.length] ?? SCATTER_POSITIONS[6] ?? []
              const pos = positions[i % positions.length] ?? { top: '0%', left: `${(i / slots.length) * 80}%` }
              return (
                <div
                  key={slot.post.id}
                  className="absolute w-[180px]"
                  style={{ top: pos.top, left: pos.left, animation: `float ${3 + (i % 3)}s ease-in-out ${i * 0.5}s infinite` }}
                >
                  <PolaroidCard post={slot.post} index={i} pinned={slot.pinned} />
                </div>
              )
            })}
          </div>

          {/* Mobile fallback: staggered 2-col grid */}
          <div className="grid grid-cols-2 gap-3 md:hidden">
            {slots.map((slot, i) => (
              <div
                key={slot.post.id}
                style={{ transform: `translateY(${i % 2 === 0 ? 14 : -4}px)` }}
              >
                <PolaroidCard post={slot.post} index={i} pinned={slot.pinned} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Follow button */}
      <div className="mt-8 text-center">
        <a
          href={`https://instagram.com/${handle.replace('@', '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded bg-slate-900 px-6 py-2.5 font-mono text-xs font-medium uppercase tracking-wider text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Siga no Instagram
        </a>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/instagram/instagram-feed.test.tsx`
Expected: PASS — both tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/instagram/instagram-feed.tsx apps/web/test/instagram/instagram-feed.test.tsx
git commit -m "feat(instagram): add public InstagramFeed server component

Grid + scatter layouts with mobile staggered fallback.
Per-instance configurable via props. Polaroid card design."
```

---

## Task 17: Wire Into Pinboard Homepage

**Files:**
- Modify: `apps/web/src/app/(public)/components/PinboardHome.tsx`

- [ ] **Step 1: Add Instagram import and data fetch**

In `PinboardHome.tsx`:

1. Add import at the top:
```typescript
import { InstagramFeed } from '@/components/instagram/instagram-feed'
```

2. No data fetch needed in `PinboardHome` — `<InstagramFeed />` is a server component that fetches its own data internally.

- [ ] **Step 2: Add `<InstagramFeed />` to the render**

Place it after the video section and before the subscribe section:

```tsx
{/* Instagram Feed */}
<InstagramFeed layout="scatter" count={5} className="px-4 py-12" />
```

- [ ] **Step 3: Verify page compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep PinboardHome | head -5`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(public\)/components/PinboardHome.tsx
git commit -m "feat(instagram): wire InstagramFeed into Pinboard homepage

Scatter layout with 5 posts on the homepage."
```

---

## Task 18: Add Float Animation CSS

**Files:**
- The global CSS file where Tailwind is configured (likely `apps/web/src/app/globals.css` or similar)

- [ ] **Step 1: Find global CSS file**

Run: `find apps/web/src -name "globals.css" -o -name "global.css" | head -3`

- [ ] **Step 2: Add float keyframe animation**

Append to the global CSS file:

```css
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(instagram): add float keyframe for scatter layout animation"
```

---

## Task 19: Run Full Test Suite

- [ ] **Step 1: Run all Instagram tests**

Run: `cd apps/web && npx vitest run test/instagram/`
Expected: All tests pass

- [ ] **Step 2: Run full web test suite**

Run: `npm run test:web`
Expected: All tests pass (no regressions)

- [ ] **Step 3: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Fix any failures**

If any test or typecheck fails, fix the issue before proceeding.

- [ ] **Step 5: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix(instagram): resolve test/type issues from integration"
```

---

## Summary

| Task | Description | Estimated |
|------|-------------|-----------|
| 1 | Database migration (4 tables + RLS) | 5 min |
| 2 | TypeScript types | 5 min |
| 3 | Instagram API client | 5 min |
| 4 | Sync service | 10 min |
| 5 | Slot resolution algorithm | 5 min |
| 6 | Public queries (unstable_cache) | 5 min |
| 7 | Cron — daily sync endpoint | 5 min |
| 8 | Cron — token refresh endpoint | 5 min |
| 9 | Vercel cron configuration | 2 min |
| 10 | Install @dnd-kit | 2 min |
| 11 | Server actions for CMS | 10 min |
| 12 | Slot manager component (drag-to-reorder) | 10 min |
| 13 | CMS settings Instagram section | 15 min |
| 14 | Settings page data loading | 5 min |
| 15 | Polaroid card component | 5 min |
| 16 | Public InstagramFeed component | 10 min |
| 17 | Wire into Pinboard homepage | 3 min |
| 18 | Float animation CSS | 2 min |
| 19 | Full test suite validation | 5 min |

**Parallelizable groups:**
- Tasks 1–2 (migration + types): sequential (types depend on schema)
- Tasks 3–5 (API client, sync, slots): parallelizable after Task 2
- Tasks 6–8 (queries, cron endpoints): parallelizable after Tasks 3–5
- Tasks 9–10 (config, deps): parallelizable anytime
- Tasks 11–14 (CMS UI): sequential (each builds on prior)
- Tasks 15–17 (public component): parallelizable after Task 6
- Task 18: independent
- Task 19: after everything
