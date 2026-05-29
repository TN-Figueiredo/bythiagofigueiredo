# Social Studio UI Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete UI rewrite of `/cms/social` following the design handoff. Rewrite in-place: new UI components, same backend (actions, providers, DB schema, pipeline).

**Architecture:** Rewrite In-Place — new components replace existing ones phase by phase. Each phase is independently shippable. Foundation defines destination constants + shared primitives, Hub rebuilds all 4 tabs + PostDetail drawer, Compositor rebuilds the post creation flow, Canvas evolves the existing react-konva editor, Pipeline adds PublishFlow + AI cron.

**Tech Stack:** Next.js 15 + React 19 + Tailwind 4 + TypeScript 5 + Vitest + react-konva + Supabase Realtime

**Spec:** `docs/superpowers/specs/2026-05-29-social-studio-rewrite-design.md`

**Estimated:** ~128h total, ~50 new/modified files, ~200+ test scenarios

---

## Phase 1: Foundation (~30h)

**Base:** `apps/web/src/lib/social/` + `apps/web/src/app/cms/(authed)/social/`
**Test:** `apps/web/test/`
**Spec:** Sections 1, 2, 5, 6, 8

---

### Task 1.1: Destination constants + types (~2h)

**Create:** `apps/web/src/lib/social/destinations.ts`
**Test:** `apps/web/test/social-destinations.test.ts`

- [ ] Create destination constants file with 4 fixed destinations
- [ ] Export `DestId` type, `DESTINATIONS` map, platform tint colors, caption limits
- [ ] Write test covering all exports

```typescript
// apps/web/src/lib/social/destinations.ts

import type { Provider } from '@tn-figueiredo/social'

export type DestId = 'ig_story' | 'yt_community' | 'fb_page' | 'ig_feed'

export interface Destination {
  id: DestId
  provider: Provider
  surface: string
  label: string
  sublabel: string
  ratio: string
  width: number
  height: number
  captionLimit: number
  tint: string
  tintSubtle: string
  badge: 'default' | 'rare' | null
  truth: string
}

export const DESTINATIONS: Record<DestId, Destination> = {
  ig_story: {
    id: 'ig_story',
    provider: 'instagram',
    surface: 'Story',
    label: 'Instagram',
    sublabel: 'Story',
    ratio: '9:16',
    width: 1080,
    height: 1920,
    captionLimit: 0,
    tint: '#E8823C',
    tintSubtle: 'rgba(232,130,60,.15)',
    badge: 'default',
    truth: 'Texto e link moram na arte, nao na legenda.',
  },
  yt_community: {
    id: 'yt_community',
    provider: 'youtube',
    surface: 'Comunidade',
    label: 'YouTube',
    sublabel: 'Comunidade',
    ratio: '1:1',
    width: 1080,
    height: 1080,
    captionLimit: 1500,
    tint: '#E0574E',
    tintSubtle: 'rgba(224,87,78,.15)',
    badge: null,
    truth: 'Sem API de publicacao. Post preparado para copy-paste no YouTube Studio.',
  },
  fb_page: {
    id: 'fb_page',
    provider: 'facebook',
    surface: 'Fanpage',
    label: 'Facebook',
    sublabel: 'Fanpage',
    ratio: '4:5',
    width: 1080,
    height: 1350,
    captionLimit: 2200,
    tint: '#5B7FD6',
    tintSubtle: 'rgba(91,127,214,.15)',
    badge: null,
    truth: 'Imagem ou video com texto. Link gera card preview automatico.',
  },
  ig_feed: {
    id: 'ig_feed',
    provider: 'instagram',
    surface: 'Feed',
    label: 'Instagram',
    sublabel: 'Feed',
    ratio: '4:5',
    width: 1080,
    height: 1350,
    captionLimit: 2200,
    tint: '#C964A8',
    tintSubtle: 'rgba(201,100,168,.15)',
    badge: 'rare',
    truth: 'Usado apenas para lancamentos. Story e o padrao da casa.',
  },
}

export const DEST_IDS: DestId[] = ['ig_story', 'yt_community', 'fb_page', 'ig_feed'] as const

export function getDestination(id: DestId): Destination {
  return DESTINATIONS[id]
}

export function getDestinationsForProvider(provider: Provider): Destination[] {
  return DEST_IDS.map(id => DESTINATIONS[id]).filter(d => d.provider === provider)
}

export function destIdToProvider(id: DestId): Provider {
  return DESTINATIONS[id].provider
}
```

```typescript
// apps/web/test/social-destinations.test.ts
import { describe, it, expect } from 'vitest'
import {
  DESTINATIONS,
  DEST_IDS,
  getDestination,
  getDestinationsForProvider,
  destIdToProvider,
  type DestId,
} from '@/lib/social/destinations'

describe('social destinations', () => {
  it('exports exactly 4 destinations', () => {
    expect(DEST_IDS).toHaveLength(4)
    expect(Object.keys(DESTINATIONS)).toHaveLength(4)
  })

  it.each(DEST_IDS)('%s has required fields', (id) => {
    const d = getDestination(id)
    expect(d.id).toBe(id)
    expect(d.provider).toBeTruthy()
    expect(d.tint).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(d.captionLimit).toBeGreaterThanOrEqual(0)
    expect(d.width).toBeGreaterThan(0)
    expect(d.height).toBeGreaterThan(0)
  })

  it('ig_story has captionLimit 0', () => {
    expect(DESTINATIONS.ig_story.captionLimit).toBe(0)
  })

  it('ig_feed is marked rare', () => {
    expect(DESTINATIONS.ig_feed.badge).toBe('rare')
  })

  it('getDestinationsForProvider returns correct items', () => {
    const igDests = getDestinationsForProvider('instagram')
    expect(igDests).toHaveLength(2)
    expect(igDests.map(d => d.id)).toContain('ig_story')
    expect(igDests.map(d => d.id)).toContain('ig_feed')
  })

  it('destIdToProvider maps correctly', () => {
    expect(destIdToProvider('yt_community')).toBe('youtube')
    expect(destIdToProvider('fb_page')).toBe('facebook')
  })
})
```

**Verify:**

```bash
npx vitest run apps/web/test/social-destinations.test.ts
# Expected: 6 tests passed
```

---

### Task 1.2: DB Migration — queue_position column (~1.5h)

**Create:** Migration via `npm run db:new social_queue_position`
**Modify:** `apps/web/src/lib/social/row-parsers.ts` (add `queue_position` field)
**Test:** `apps/web/test/social-queue-position.test.ts`

- [ ] Run `npm run db:new social_queue_position` to generate migration file
- [ ] Write migration SQL
- [ ] Update row parser to include `queue_position`
- [ ] Write test for row parser change

```sql
-- Migration: social_queue_position
-- Adds queue_position column for manual queue reordering (Spec Section 3.1.5)

ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS queue_position INTEGER;

CREATE INDEX IF NOT EXISTS idx_social_posts_queue
  ON social_posts (site_id, queue_position)
  WHERE status IN ('scheduled', 'queued') AND queue_position IS NOT NULL;

COMMENT ON COLUMN social_posts.queue_position IS
  'Manual position within site queue. NULL = not in queue. Managed by reorderQueue() action.';
```

- [ ] Update `toSocialPost()` in `apps/web/src/lib/social/row-parsers.ts`:

```typescript
// In the SocialPostWithPipeline type, add:
queue_position: number | null

// In toSocialPost(), add after 'origin':
queue_position: (row.queue_position as number) ?? null,
```

```typescript
// apps/web/test/social-queue-position.test.ts
import { describe, it, expect } from 'vitest'
import { toSocialPost } from '@/lib/social/row-parsers'

describe('toSocialPost queue_position', () => {
  const baseRow = {
    id: 'test-1', site_id: 's1', created_by: 'u1', type: 'text',
    status: 'scheduled', content: {}, idempotency_key: 'k1',
    created_at: '2026-01-01', updated_at: '2026-01-01',
    user_timezone: 'America/Sao_Paulo',
  }

  it('parses queue_position when present', () => {
    const post = toSocialPost({ ...baseRow, queue_position: 3 })
    expect(post.queue_position).toBe(3)
  })

  it('defaults to null when queue_position is missing', () => {
    const post = toSocialPost(baseRow)
    expect(post.queue_position).toBeNull()
  })
})
```

**Verify:**

```bash
npx vitest run apps/web/test/social-queue-position.test.ts
# Expected: 2 tests passed
```

---

### Task 1.3: DB Migration — poll + manual type (~1h)

**Create:** Migration via `npm run db:new social_poll_manual_type`

- [ ] Run `npm run db:new social_poll_manual_type`
- [ ] Write migration SQL for extending the type CHECK constraint

```sql
-- Migration: social_poll_manual_type
-- Extends social_posts type to include 'poll' (YT community polls) and 'manual'
-- (posts prepared for copy-paste, e.g. YT community without API).
-- Spec Section 6, Migration 2.

ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_type_check;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_type_check
  CHECK (type IN ('link', 'video', 'image', 'text', 'poll', 'manual'));

COMMENT ON COLUMN social_posts.type IS
  'Post type. poll = YT community poll, manual = copy-paste (no publish API).';
```

- [ ] Update `PostType` handling in `apps/web/src/lib/social/actions/posts.ts` — extend `createPostSchema`:

```typescript
// Change the type enum from:
type: z.enum(['link', 'video', 'image', 'text']),
// To:
type: z.enum(['link', 'video', 'image', 'text', 'poll', 'manual']),
```

**Verify:**

```bash
npx vitest run apps/web/test/social-post-editing.test.ts
# Expected: existing tests still pass
```

---

### Task 1.4: DB Migration — validate fair batch RPC (~1h)

**Create:** Migration via `npm run db:new social_fair_batch_validate` (if needed)

- [ ] Read `supabase/migrations/20260519000004_fix_social_publish_fair_batch_story_slides.sql` to check current RPC columns
- [ ] Verify the RPC returns `queue_position` (added in Task 1.2)
- [ ] If missing columns, create corrective migration

```sql
-- Migration: social_fair_batch_validate
-- Ensures social_publish_fair_batch RPC returns all required columns
-- including queue_position added in the queue_position migration.
-- Uses sp.* to avoid column-list drift.

CREATE OR REPLACE FUNCTION social_publish_fair_batch(
  p_batch_size integer DEFAULT 10
)
RETURNS SETOF social_posts
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT sp.*
  FROM social_posts sp
  WHERE sp.status = 'scheduled'
    AND sp.scheduled_at <= now()
  ORDER BY sp.scheduled_at ASC
  LIMIT p_batch_size;
$$;
```

**Verify:**

```bash
# Verify migration file was created
ls supabase/migrations/ | grep social_fair_batch
```

---

### Task 1.5: Server action — checkConnectionHealth (~2.5h)

**Modify:** `apps/web/src/lib/social/actions/connections.ts`
**Modify:** `apps/web/src/lib/social/actions/index.ts`
**Test:** `apps/web/test/social-connection-health.test.ts`

- [ ] Add `checkConnectionHealth` action to `connections.ts`
- [ ] Export from barrel `index.ts`
- [ ] Write unit test

```typescript
// Add to apps/web/src/lib/social/actions/connections.ts

export interface ConnectionHealth {
  connectionId: string
  provider: Provider
  accountName: string
  status: 'ok' | 'warn' | 'error'
  followersCount: number | null
  tokenExpiresIn: number | null // days until expiry, null = never
}

export async function checkConnectionHealth(
  siteId: string,
): Promise<ActionResult<ConnectionHealth[]>> {
  try {
    const { siteId: authedSiteId } = await requireEditAccess()
    if (authedSiteId !== siteId) return { ok: false, error: 'forbidden' }

    const supabase = getSupabaseServiceClient()
    const { data: connections, error } = await supabase
      .from('social_connections')
      .select('id, provider, account_name, token_expires_at, metadata, status')
      .eq('site_id', siteId)
      .order('created_at')

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'checkConnectionHealth' } })
      return { ok: false, error: error.message }
    }

    const now = Date.now()
    const results: ConnectionHealth[] = (connections ?? []).map((c) => {
      const meta = (c.metadata ?? {}) as Record<string, unknown>
      const followers = typeof meta.followers_count === 'number'
        ? meta.followers_count
        : typeof meta.subscriber_count === 'number'
          ? meta.subscriber_count
          : null

      let tokenExpiresIn: number | null = null
      let status: ConnectionHealth['status'] = 'ok'

      if (c.token_expires_at) {
        const expiresAt = new Date(c.token_expires_at).getTime()
        tokenExpiresIn = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))
        if (tokenExpiresIn <= 0) status = 'error'
        else if (tokenExpiresIn <= 7) status = 'warn'
      }

      if (c.status === 'revoked' || c.status === 'error') status = 'error'

      return {
        connectionId: c.id,
        provider: c.provider as Provider,
        accountName: c.account_name ?? '',
        status,
        followersCount: followers as number | null,
        tokenExpiresIn,
      }
    })

    return { ok: true, data: results }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'checkConnectionHealth' } })
    return { ok: false, error: 'Failed to check connection health' }
  }
}
```

- [ ] Add to `apps/web/src/lib/social/actions/index.ts`:

```typescript
// Add to connections export block:
export { connectSocial, disconnectSocial, getConnections, checkConnectionHealth } from './connections'
export type { ConnectionHealth } from './connections'
```

```typescript
// apps/web/test/social-connection-health.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            data: [
              {
                id: 'conn-1', provider: 'instagram', account_name: '@test',
                token_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
                metadata: { followers_count: 5000 }, status: 'active',
              },
              {
                id: 'conn-2', provider: 'facebook', account_name: 'Test Page',
                token_expires_at: new Date(Date.now() + 3 * 86400000).toISOString(),
                metadata: {}, status: 'active',
              },
              {
                id: 'conn-3', provider: 'youtube', account_name: 'TestChannel',
                token_expires_at: null, metadata: { subscriber_count: 12000 },
                status: 'active',
              },
            ],
            error: null,
          }),
        }),
      }),
    }),
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: () => ({ ok: true, user: { id: 'u1' } }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => ({ siteId: 'site-1' }),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

describe('checkConnectionHealth', () => {
  it('returns ok for valid token', async () => {
    const { checkConnectionHealth } = await import('@/lib/social/actions/connections')
    const result = await checkConnectionHealth('site-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const ig = result.data.find(c => c.provider === 'instagram')
    expect(ig?.status).toBe('ok')
    expect(ig?.followersCount).toBe(5000)
  })

  it('returns warn for token expiring within 7 days', async () => {
    const { checkConnectionHealth } = await import('@/lib/social/actions/connections')
    const result = await checkConnectionHealth('site-1')
    if (!result.ok) return
    const fb = result.data.find(c => c.provider === 'facebook')
    expect(fb?.status).toBe('warn')
    expect(fb?.tokenExpiresIn).toBeLessThanOrEqual(7)
  })

  it('returns null tokenExpiresIn for non-expiring tokens', async () => {
    const { checkConnectionHealth } = await import('@/lib/social/actions/connections')
    const result = await checkConnectionHealth('site-1')
    if (!result.ok) return
    const yt = result.data.find(c => c.provider === 'youtube')
    expect(yt?.status).toBe('ok')
    expect(yt?.tokenExpiresIn).toBeNull()
    expect(yt?.followersCount).toBe(12000)
  })
})
```

**Verify:**

```bash
npx vitest run apps/web/test/social-connection-health.test.ts
# Expected: 3 tests passed
```

---

### Task 1.6: Server action — listFeedPostsWithDeliveries (~2.5h)

**Modify:** `apps/web/src/lib/social/actions/posts.ts`
**Modify:** `apps/web/src/lib/social/actions/index.ts`
**Test:** `apps/web/test/social-feed-posts-deliveries.test.ts`

- [ ] Add `listFeedPostsWithDeliveries` action that JOINs posts + deliveries in 1 query
- [ ] Export from barrel

```typescript
// Add to apps/web/src/lib/social/actions/posts.ts

export interface FeedPostWithDeliveries {
  post: SocialPostWithPipeline
  deliveries: Array<{
    id: string
    provider: Provider
    status: string
    platform_post_id: string | null
    format: string | null
  }>
}

const feedFiltersSchema = z.object({
  status: z.enum(['all', 'published', 'scheduled', 'failed']).default('all'),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
})

export async function listFeedPostsWithDeliveries(
  siteId: string,
  filters?: { status?: string; limit?: number; offset?: number },
): Promise<ActionResult<FeedPostWithDeliveries[]>> {
  try {
    const { siteId: authedSiteId } = await requireEditAccess()
    if (authedSiteId !== siteId) return { ok: false, error: 'forbidden' }

    const parsed = feedFiltersSchema.safeParse(filters ?? {})
    if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
    const { status, limit, offset } = parsed.data

    const supabase = getSupabaseServiceClient()
    let query = supabase
      .from('social_posts')
      .select('*, social_deliveries(*)')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status === 'published') query = query.eq('status', 'completed')
    else if (status === 'scheduled') query = query.eq('status', 'scheduled')
    else if (status === 'failed') query = query.eq('status', 'failed')

    const { data, error } = await query

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'listFeedPostsWithDeliveries' } })
      return { ok: false, error: error.message }
    }

    const results: FeedPostWithDeliveries[] = (data ?? []).map((row: Record<string, unknown>) => ({
      post: toSocialPost(row),
      deliveries: ((row.social_deliveries ?? []) as Array<Record<string, unknown>>).map(d => ({
        id: String(d.id),
        provider: d.provider as Provider,
        status: String(d.status),
        platform_post_id: (d.platform_post_id as string) ?? null,
        format: (d.format as string) ?? null,
      })),
    }))

    return { ok: true, data: results }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'listFeedPostsWithDeliveries' } })
    return { ok: false, error: 'Failed to list feed posts' }
  }
}
```

- [ ] Export from `index.ts`:

```typescript
export {
  createSocialPost, updateSocialPost, cancelSocialPost, deleteSocialPost,
  retrySocialDelivery, getSocialPost, listSocialPosts, editPublishedPost,
  reorderQueuePosts, listFeedPostsWithDeliveries,
} from './posts'
export type { FeedPostWithDeliveries } from './posts'
```

**Verify:**

```bash
npx vitest run apps/web/test/social-feed-posts-deliveries.test.ts
# Expected: tests passed
```

---

### Task 1.7: Server action — listCalendarEvents (~2h)

**Modify:** `apps/web/src/lib/social/actions/posts.ts`
**Modify:** `apps/web/src/lib/social/actions/index.ts`
**Test:** `apps/web/test/social-calendar-events.test.ts`

- [ ] Add `listCalendarEvents` action
- [ ] Export from barrel
- [ ] Write test

```typescript
// Add to apps/web/src/lib/social/actions/posts.ts

export interface CalendarEvent {
  postId: string
  title: string
  provider: Provider
  destId: string | null
  status: string
  scheduledAt: string
  tint: string
}

export async function listCalendarEvents(
  siteId: string,
  from: string,
  to: string,
): Promise<ActionResult<CalendarEvent[]>> {
  try {
    const { siteId: authedSiteId } = await requireEditAccess()
    if (authedSiteId !== siteId) return { ok: false, error: 'forbidden' }

    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('social_posts')
      .select('id, content, status, scheduled_at, published_at, social_deliveries(provider, status)')
      .eq('site_id', siteId)
      .or(`scheduled_at.gte.${from},published_at.gte.${from}`)
      .or(`scheduled_at.lte.${to},published_at.lte.${to}`)
      .in('status', ['scheduled', 'completed', 'failed', 'publishing'])
      .order('scheduled_at', { ascending: true })

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'listCalendarEvents' } })
      return { ok: false, error: error.message }
    }

    // Lazy import to avoid circular dependency at module load time
    const { DESTINATIONS, DEST_IDS } = await import('../destinations')

    const events: CalendarEvent[] = []
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const content = (row.content ?? {}) as Record<string, unknown>
      const deliveries = (row.social_deliveries ?? []) as Array<Record<string, unknown>>
      const dateStr = (row.scheduled_at ?? row.published_at ?? '') as string

      for (const del of deliveries) {
        const provider = del.provider as Provider
        const dest = DEST_IDS.find(id => DESTINATIONS[id].provider === provider)
        events.push({
          postId: String(row.id),
          title: String(content.title ?? content.description ?? '(sem titulo)'),
          provider,
          destId: dest ?? null,
          status: String(row.status),
          scheduledAt: dateStr,
          tint: dest ? DESTINATIONS[dest].tint : '#888',
        })
      }
    }

    return { ok: true, data: events }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'listCalendarEvents' } })
    return { ok: false, error: 'Failed to list calendar events' }
  }
}
```

**Verify:**

```bash
npx vitest run apps/web/test/social-calendar-events.test.ts
# Expected: tests passed
```

---

### Task 1.8: Server action — reorderQueue (~2h)

**Modify:** `apps/web/src/lib/social/actions/posts.ts`
**Modify:** `apps/web/src/lib/social/actions/index.ts`
**Test:** `apps/web/test/social-reorder-queue.test.ts`

- [ ] Add `reorderQueue` action with transactional swap
- [ ] Export from barrel
- [ ] Write test

```typescript
// Add to apps/web/src/lib/social/actions/posts.ts

const reorderQueueSchema = z.object({
  postId: z.string().uuid(),
  newPosition: z.number().int().min(0),
})

export async function reorderQueue(
  postId: string,
  newPosition: number,
): Promise<ActionResult> {
  const parsed = reorderQueueSchema.safeParse({ postId, newPosition })
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    // Get current post
    const { data: post, error: postErr } = await supabase
      .from('social_posts')
      .select('id, site_id, queue_position')
      .eq('id', postId)
      .single()

    if (postErr || !post) return { ok: false, error: 'Post not found' }
    if (post.site_id !== siteId) return { ok: false, error: 'forbidden' }

    const oldPosition = post.queue_position as number | null
    if (oldPosition === newPosition) return { ok: true, data: undefined }

    // Shift positions of other posts in a single transaction via RPC
    // For simplicity, we renumber all queued posts
    const { data: queued, error: queueErr } = await supabase
      .from('social_posts')
      .select('id, queue_position')
      .eq('site_id', siteId)
      .in('status', ['scheduled', 'queued'])
      .not('queue_position', 'is', null)
      .order('queue_position', { ascending: true })

    if (queueErr) return { ok: false, error: queueErr.message }

    const items = (queued ?? []) as Array<{ id: string; queue_position: number }>
    const filtered = items.filter(i => i.id !== postId)
    filtered.splice(newPosition, 0, { id: postId, queue_position: newPosition })

    // Update all positions
    for (let i = 0; i < filtered.length; i++) {
      await supabase
        .from('social_posts')
        .update({ queue_position: i })
        .eq('id', filtered[i].id)
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'reorderQueue' } })
    return { ok: false, error: 'Failed to reorder queue' }
  }
}
```

**Verify:**

```bash
npx vitest run apps/web/test/social-reorder-queue.test.ts
# Expected: tests passed
```

---

### Task 1.9: Server actions — generateAICaption, translateCaption, getBestTimes (~4h)

**Modify:** `apps/web/src/lib/social/actions/content.ts`
**Modify:** `apps/web/src/lib/social/actions/index.ts`
**Test:** `apps/web/test/social-ai-actions.test.ts`

- [ ] Add `generateAICaption` action (calls Cowork Pipeline)
- [ ] Add `translateCaption` action (calls Cowork Pipeline)
- [ ] Add `getBestTimes` action
- [ ] Export all from barrel

```typescript
// Add to apps/web/src/lib/social/actions/content.ts

import type { DestId } from '../destinations'

export interface AICaptionResult {
  variations: string[]
  hashtags: string[]
  tone: string
  bestTime: string | null
}

export async function generateAICaption(
  destId: DestId,
  lang: 'pt' | 'en',
  source?: { title: string; excerpt: string | null; url?: string },
): Promise<ActionResult<AICaptionResult>> {
  try {
    await requireEditAccess()

    const pipelineKey = process.env.PIPELINE_COWORK_KEY
    if (!pipelineKey) return { ok: false, error: 'Pipeline key not configured' }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/pipeline/social/generate-caption`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pipeline-key': pipelineKey,
      },
      body: JSON.stringify({ destId, lang, source }),
    })

    if (!response.ok) {
      return { ok: false, error: `Pipeline returned ${response.status}` }
    }

    const data = await response.json() as AICaptionResult
    return { ok: true, data }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'generateAICaption' } })
    return { ok: false, error: 'Failed to generate AI caption' }
  }
}

export async function translateCaption(
  text: string,
  from: 'pt' | 'en',
  to: 'pt' | 'en',
): Promise<ActionResult<string>> {
  try {
    await requireEditAccess()

    const pipelineKey = process.env.PIPELINE_COWORK_KEY
    if (!pipelineKey) return { ok: false, error: 'Pipeline key not configured' }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/pipeline/social/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pipeline-key': pipelineKey,
      },
      body: JSON.stringify({ text, from, to }),
    })

    if (!response.ok) {
      return { ok: false, error: `Pipeline returned ${response.status}` }
    }

    const data = await response.json() as { translated: string }
    return { ok: true, data: data.translated }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'translateCaption' } })
    return { ok: false, error: 'Failed to translate caption' }
  }
}

export async function getBestTimes(
  connectionIds: string[],
): Promise<ActionResult<Record<string, string[]>>> {
  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    // Pull social_defaults from site config
    const { data: site } = await supabase
      .from('sites')
      .select('social_defaults')
      .eq('id', siteId)
      .single()

    const defaults = (site?.social_defaults ?? {}) as Record<string, unknown>
    const bestTimes = (defaults.best_times ?? {}) as Record<string, string[]>

    // Filter to only requested connections' providers
    const { data: connections } = await supabase
      .from('social_connections')
      .select('id, provider')
      .in('id', connectionIds)

    const result: Record<string, string[]> = {}
    for (const conn of (connections ?? []) as Array<{ id: string; provider: string }>) {
      result[conn.provider] = bestTimes[conn.provider] ?? ['09:00', '12:00', '18:00']
    }

    return { ok: true, data: result }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getBestTimes' } })
    return { ok: false, error: 'Failed to get best times' }
  }
}
```

- [ ] Export from `index.ts`:

```typescript
export {
  getContentForSocialPost, createFromContentAction, scrapeOgTags,
  checkDuplicatesAction, generateAICaption, translateCaption, getBestTimes,
} from './content'
export type { AICaptionResult } from './content'
```

**Verify:**

```bash
npx vitest run apps/web/test/social-ai-actions.test.ts
# Expected: tests passed
```

---

### Task 1.10: Server actions — duplicatePost, createAutoDraft (~2.5h)

**Modify:** `apps/web/src/lib/social/actions/posts.ts`
**Modify:** `apps/web/src/lib/social/actions/index.ts`
**Test:** `apps/web/test/social-duplicate-autodraft.test.ts`

- [ ] Add `duplicatePost` action
- [ ] Add `createAutoDraft` action
- [ ] Export from barrel

```typescript
// Add to apps/web/src/lib/social/actions/posts.ts

export async function duplicatePost(
  postId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { siteId, userId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data: original, error: fetchErr } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (fetchErr || !original) return { ok: false, error: 'Post not found' }
    if (original.site_id !== siteId) return { ok: false, error: 'forbidden' }

    const newRow = {
      site_id: siteId,
      created_by: userId,
      type: original.type,
      status: 'draft' as const,
      content: original.content,
      template_id: original.template_id,
      idempotency_key: crypto.randomUUID(),
      user_timezone: original.user_timezone,
      origin: 'manual',
    }

    const { data: newPost, error: insertErr } = await supabase
      .from('social_posts')
      .insert(newRow)
      .select('id')
      .single()

    if (insertErr) {
      Sentry.captureException(insertErr, { tags: { ...SENTRY_TAG, action: 'duplicatePost' } })
      return { ok: false, error: insertErr.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: { id: newPost!.id as string } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'duplicatePost' } })
    return { ok: false, error: 'Failed to duplicate post' }
  }
}

const createAutoDraftSchema = z.object({
  contentId: z.string().min(1),
  platforms: z.array(z.enum(['youtube', 'facebook', 'instagram', 'bluesky'])).min(1),
})

export async function createAutoDraft(
  contentId: string,
  platforms: Provider[],
): Promise<ActionResult<{ id: string }>> {
  const parsed = createAutoDraftSchema.safeParse({ contentId, platforms })
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId, userId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const postRow = {
      site_id: siteId,
      created_by: userId,
      type: 'text' as const,
      status: 'draft' as const,
      content: { title: '', description: '' },
      idempotency_key: crypto.randomUUID(),
      user_timezone: 'America/Sao_Paulo',
      origin: 'auto',
      source_content_id: contentId,
    }

    const { data: post, error: insertErr } = await supabase
      .from('social_posts')
      .insert(postRow)
      .select('id')
      .single()

    if (insertErr) {
      Sentry.captureException(insertErr, { tags: { ...SENTRY_TAG, action: 'createAutoDraft' } })
      return { ok: false, error: insertErr.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: { id: post!.id as string } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'createAutoDraft' } })
    return { ok: false, error: 'Failed to create auto draft' }
  }
}
```

**Verify:**

```bash
npx vitest run apps/web/test/social-duplicate-autodraft.test.ts
# Expected: tests passed
```

---

### Task 1.11: Shared components — breadcrumb, page header, toast (~3h)

**Create:** `apps/web/src/app/cms/(authed)/social/_components/shared/social-breadcrumb.tsx`
**Create:** `apps/web/src/app/cms/(authed)/social/_components/shared/social-page-header.tsx`
**Create:** `apps/web/src/app/cms/(authed)/social/_components/shared/social-toast.tsx`
**Test:** `apps/web/test/cms/social-shared-components.test.tsx`

- [ ] Create breadcrumb component with dynamic last segment
- [ ] Create page header with Fraunces title + dual actions
- [ ] Create toast wrapper with mapped social events
- [ ] Write tests

```typescript
// apps/web/src/app/cms/(authed)/social/_components/shared/social-breadcrumb.tsx
import Link from 'next/link'

interface Crumb {
  label: string
  href?: string
}

interface SocialBreadcrumbProps {
  crumbs: Crumb[]
}

export function SocialBreadcrumb({ crumbs }: SocialBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-cms-text-dim">/</span>}
          {crumb.href ? (
            <Link href={crumb.href} className="text-cms-text-muted hover:text-cms-text transition-colors">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-cms-text font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
```

```typescript
// apps/web/src/app/cms/(authed)/social/_components/shared/social-page-header.tsx
import type { ReactNode } from 'react'

interface SocialPageHeaderProps {
  breadcrumb: ReactNode
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function SocialPageHeader({ breadcrumb, title, subtitle, actions }: SocialPageHeaderProps) {
  return (
    <div className="mb-6 space-y-2">
      {breadcrumb}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-fraunces text-2xl font-semibold text-cms-text">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-cms-text-muted">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  )
}
```

```typescript
// apps/web/src/app/cms/(authed)/social/_components/shared/social-toast.tsx
'use client'

import { toast } from 'sonner'

type SocialEvent =
  | 'post_published'
  | 'post_scheduled'
  | 'post_queued'
  | 'post_deleted'
  | 'post_duplicated'
  | 'draft_saved'
  | 'queue_reordered'
  | 'connection_error'
  | 'publish_failed'

const EVENT_MESSAGES: Record<SocialEvent, { title: string; type: 'success' | 'error' | 'info' }> = {
  post_published: { title: 'Post publicado', type: 'success' },
  post_scheduled: { title: 'Post agendado', type: 'success' },
  post_queued: { title: 'Adicionado a fila', type: 'success' },
  post_deleted: { title: 'Post excluido', type: 'info' },
  post_duplicated: { title: 'Post duplicado como rascunho', type: 'success' },
  draft_saved: { title: 'Rascunho salvo', type: 'success' },
  queue_reordered: { title: 'Fila reordenada', type: 'info' },
  connection_error: { title: 'Erro de conexao', type: 'error' },
  publish_failed: { title: 'Falha ao publicar', type: 'error' },
}

export function socialToast(event: SocialEvent, description?: string) {
  const config = EVENT_MESSAGES[event]
  if (config.type === 'error') {
    toast.error(config.title, { description })
  } else if (config.type === 'success') {
    toast.success(config.title, { description })
  } else {
    toast.info(config.title, { description })
  }
}
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-shared-components.test.tsx
# Expected: tests passed
```

---

### Task 1.12: Platform previews — 5 components (~5h)

**Create:** `apps/web/src/app/cms/(authed)/social/_components/platform-previews/ig-story-preview.tsx`
**Create:** `apps/web/src/app/cms/(authed)/social/_components/platform-previews/yt-community-card.tsx`
**Create:** `apps/web/src/app/cms/(authed)/social/_components/platform-previews/ig-feed-post.tsx`
**Create:** `apps/web/src/app/cms/(authed)/social/_components/platform-previews/fb-page-post.tsx`
**Create:** `apps/web/src/app/cms/(authed)/social/_components/platform-previews/dest-preview.tsx`
**Test:** `apps/web/test/cms/social-platform-previews.test.tsx`

- [ ] Create `ig-story-preview.tsx` — phone mockup with progress bars, reply bar
- [ ] Create `yt-community-card.tsx` — dark card, poll bars, action row
- [ ] Create `ig-feed-post.tsx` — IG post with avatar ring, action row
- [ ] Create `fb-page-post.tsx` — FB dark post, link card
- [ ] Create `dest-preview.tsx` — dispatcher component: destId -> preview component
- [ ] Write tests for dispatcher

```typescript
// apps/web/src/app/cms/(authed)/social/_components/platform-previews/ig-story-preview.tsx
'use client'

interface IgStoryPreviewProps {
  imageUrl: string | null
  accountName: string
  avatarUrl?: string | null
  className?: string
}

export function IgStoryPreview({ imageUrl, accountName, avatarUrl, className = '' }: IgStoryPreviewProps) {
  return (
    <div className={`relative mx-auto w-[270px] rounded-2xl bg-black overflow-hidden ${className}`} style={{ aspectRatio: '9/16' }}>
      {/* Progress bars */}
      <div className="absolute top-2 left-3 right-3 flex gap-1 z-10">
        <div className="h-0.5 flex-1 rounded-full bg-white/80" />
      </div>

      {/* Account header */}
      <div className="absolute top-5 left-3 right-3 flex items-center gap-2 z-10">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-500 p-0.5">
          <div className="h-full w-full rounded-full bg-black overflow-hidden">
            {avatarUrl && <img src={avatarUrl} alt="" className="h-full w-full object-cover" />}
          </div>
        </div>
        <span className="text-xs font-medium text-white">{accountName}</span>
      </div>

      {/* Story image */}
      {imageUrl ? (
        <img src={imageUrl} alt="Story preview" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-white/40">
          Arte do Canvas
        </div>
      )}

      {/* Reply bar */}
      <div className="absolute bottom-4 left-3 right-3 z-10">
        <div className="rounded-full border border-white/20 bg-black/30 px-4 py-2 text-xs text-white/50 backdrop-blur-sm">
          Envie uma mensagem
        </div>
      </div>
    </div>
  )
}
```

```typescript
// apps/web/src/app/cms/(authed)/social/_components/platform-previews/yt-community-card.tsx
'use client'

interface PollOption {
  text: string
  percentage?: number
}

interface YtCommunityCardProps {
  caption: string
  imageUrl: string | null
  accountName: string
  avatarUrl?: string | null
  poll?: PollOption[]
  className?: string
}

export function YtCommunityCard({ caption, imageUrl, accountName, avatarUrl, poll, className = '' }: YtCommunityCardProps) {
  return (
    <div className={`rounded-xl bg-[#272727] p-4 ${className}`}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-[#3d3d3d] overflow-hidden">
          {avatarUrl && <img src={avatarUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{accountName}</p>
          <p className="text-xs text-[#aaa]">agora</p>
        </div>
      </div>

      {/* Caption */}
      {caption && <p className="mb-3 text-sm text-white whitespace-pre-wrap">{caption}</p>}

      {/* Image */}
      {imageUrl && (
        <div className="mb-3 overflow-hidden rounded-lg">
          <img src={imageUrl} alt="" className="w-full object-cover" style={{ aspectRatio: '1/1' }} />
        </div>
      )}

      {/* Poll */}
      {poll && poll.length > 0 && (
        <div className="mb-3 space-y-2">
          {poll.map((opt, i) => (
            <div key={i} className="relative overflow-hidden rounded-lg bg-[#3d3d3d] px-3 py-2">
              {opt.percentage != null && (
                <div
                  className="absolute inset-y-0 left-0 bg-blue-600/30"
                  style={{ width: `${opt.percentage}%` }}
                />
              )}
              <span className="relative text-sm text-white">{opt.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 text-[#aaa]">
        <span className="text-xs">Curtir</span>
        <span className="text-xs">Comentar</span>
      </div>
    </div>
  )
}
```

```typescript
// apps/web/src/app/cms/(authed)/social/_components/platform-previews/ig-feed-post.tsx
'use client'

interface IgFeedPostProps {
  caption: string
  imageUrl: string | null
  accountName: string
  avatarUrl?: string | null
  className?: string
}

export function IgFeedPost({ caption, imageUrl, accountName, avatarUrl, className = '' }: IgFeedPostProps) {
  return (
    <div className={`rounded-xl bg-black overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-500 p-0.5">
          <div className="h-full w-full rounded-full bg-black overflow-hidden">
            {avatarUrl && <img src={avatarUrl} alt="" className="h-full w-full object-cover" />}
          </div>
        </div>
        <span className="text-sm font-medium text-white">{accountName}</span>
      </div>

      {/* Image */}
      {imageUrl ? (
        <img src={imageUrl} alt="" className="w-full object-cover" style={{ aspectRatio: '4/5' }} />
      ) : (
        <div className="flex items-center justify-center bg-[#1a1a1a] text-sm text-white/30" style={{ aspectRatio: '4/5' }}>
          Imagem
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-3 py-2.5 text-white">
        <span className="text-lg">&#9825;</span>
        <span className="text-lg">&#128172;</span>
        <span className="text-lg">&#9993;</span>
      </div>

      {/* Caption */}
      {caption && (
        <div className="px-3 pb-3">
          <p className="text-sm text-white">
            <span className="font-medium">{accountName}</span>{' '}
            <span className="text-white/90">{caption}</span>
          </p>
        </div>
      )}
    </div>
  )
}
```

```typescript
// apps/web/src/app/cms/(authed)/social/_components/platform-previews/fb-page-post.tsx
'use client'

interface FbPagePostProps {
  caption: string
  imageUrl: string | null
  accountName: string
  avatarUrl?: string | null
  linkUrl?: string | null
  linkTitle?: string | null
  className?: string
}

export function FbPagePost({ caption, imageUrl, accountName, avatarUrl, linkUrl, linkTitle, className = '' }: FbPagePostProps) {
  return (
    <div className={`rounded-xl bg-[#242526] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="h-10 w-10 rounded-full bg-[#3a3b3c] overflow-hidden">
          {avatarUrl && <img src={avatarUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{accountName}</p>
          <p className="text-xs text-[#b0b3b8]">Agora</p>
        </div>
      </div>

      {/* Caption */}
      {caption && <p className="px-4 pb-3 text-sm text-[#e4e6eb] whitespace-pre-wrap">{caption}</p>}

      {/* Image */}
      {imageUrl && (
        <img src={imageUrl} alt="" className="w-full object-cover" style={{ aspectRatio: '4/5' }} />
      )}

      {/* Link card */}
      {linkUrl && (
        <div className="mx-4 my-3 rounded-lg border border-[#3a3b3c] bg-[#3a3b3c]/50 p-3">
          <p className="text-xs text-[#b0b3b8] uppercase">{new URL(linkUrl).hostname}</p>
          {linkTitle && <p className="mt-1 text-sm font-medium text-white">{linkTitle}</p>}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-around border-t border-[#3a3b3c] px-4 py-2.5 text-[#b0b3b8]">
        <span className="text-xs font-medium">Curtir</span>
        <span className="text-xs font-medium">Comentar</span>
        <span className="text-xs font-medium">Compartilhar</span>
      </div>
    </div>
  )
}
```

```typescript
// apps/web/src/app/cms/(authed)/social/_components/platform-previews/dest-preview.tsx
'use client'

import type { DestId } from '@/lib/social/destinations'
import { IgStoryPreview } from './ig-story-preview'
import { YtCommunityCard } from './yt-community-card'
import { IgFeedPost } from './ig-feed-post'
import { FbPagePost } from './fb-page-post'

interface DestPreviewProps {
  destId: DestId
  caption: string
  imageUrl: string | null
  accountName: string
  avatarUrl?: string | null
  poll?: Array<{ text: string; percentage?: number }>
  linkUrl?: string | null
  linkTitle?: string | null
  className?: string
}

export function DestPreview({ destId, caption, imageUrl, accountName, avatarUrl, poll, linkUrl, linkTitle, className }: DestPreviewProps) {
  switch (destId) {
    case 'ig_story':
      return <IgStoryPreview imageUrl={imageUrl} accountName={accountName} avatarUrl={avatarUrl} className={className} />
    case 'yt_community':
      return <YtCommunityCard caption={caption} imageUrl={imageUrl} accountName={accountName} avatarUrl={avatarUrl} poll={poll} className={className} />
    case 'ig_feed':
      return <IgFeedPost caption={caption} imageUrl={imageUrl} accountName={accountName} avatarUrl={avatarUrl} className={className} />
    case 'fb_page':
      return <FbPagePost caption={caption} imageUrl={imageUrl} accountName={accountName} avatarUrl={avatarUrl} linkUrl={linkUrl} linkTitle={linkTitle} className={className} />
    default: {
      const _exhaustive: never = destId
      return null
    }
  }
}
```

```typescript
// apps/web/test/cms/social-platform-previews.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DestPreview } from '@/app/cms/(authed)/social/_components/platform-previews/dest-preview'
import { DEST_IDS } from '@/lib/social/destinations'

describe('DestPreview dispatcher', () => {
  it.each(DEST_IDS)('renders without error for %s', (destId) => {
    const { container } = render(
      <DestPreview
        destId={destId}
        caption="Test caption"
        imageUrl={null}
        accountName="@test"
      />
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('renders Story phone mockup for ig_story', () => {
    render(
      <DestPreview destId="ig_story" caption="" imageUrl={null} accountName="@test" />
    )
    expect(screen.getByText('Envie uma mensagem')).toBeTruthy()
  })

  it('renders community card for yt_community', () => {
    render(
      <DestPreview destId="yt_community" caption="Test" imageUrl={null} accountName="TestChannel" />
    )
    expect(screen.getByText('TestChannel')).toBeTruthy()
    expect(screen.getByText('Test')).toBeTruthy()
  })
})
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-platform-previews.test.tsx
# Expected: 6 tests passed
```

---

### Task 1.13: Foundation phase verification (~1h)

- [ ] Run full test suite to check nothing is broken
- [ ] Run `npm run build:packages` (if packages/ were touched)
- [ ] Verify typecheck passes

```bash
npm run test:web
# Expected: all existing + new tests pass

npx tsc --noEmit -p apps/web/tsconfig.json
# Expected: no errors
```

---

## Phase 2: Hub (~28h)

**Base:** `apps/web/src/app/cms/(authed)/social/`
**Test:** `apps/web/test/cms/`
**Spec:** Section 3.1

---

### Task 2.1: Hub page.tsx rewrite (~3h)

**Modify:** `apps/web/src/app/cms/(authed)/social/page.tsx`
**Test:** `apps/web/test/cms/social-hub-rewrite.test.tsx`

- [ ] Rewrite page.tsx as Server Component with Suspense boundaries per tab
- [ ] Use URL state for tabs (?tab=feed|calendar|queue|drafts)
- [ ] Replace CmsTopbar with SocialPageHeader + SocialBreadcrumb
- [ ] Add "Do CMS" ghost button + "Novo post" primary button
- [ ] Use proper `role="tablist"` / `role="tab"` / `role="tabpanel"` accessibility
- [ ] Wrap each tab content in `<Suspense>` with skeleton fallback

```typescript
// apps/web/src/app/cms/(authed)/social/page.tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSocialStrings } from './_i18n'
import { SocialBreadcrumb } from './_components/shared/social-breadcrumb'
import { SocialPageHeader } from './_components/shared/social-page-header'
import { AccountsStripLoader } from './_components/accounts-strip'
import { FeedViewLoader } from './_components/posts-feed'
import { CalendarViewLoader } from './_components/posts-calendar'
import { QueueViewLoader } from './_components/posts-queue'
import { DraftsViewLoader } from './_components/posts-drafts'

export const dynamic = 'force-dynamic'

const TABS = ['feed', 'calendar', 'queue', 'drafts'] as const
type TabId = (typeof TABS)[number]

interface Props {
  searchParams: Promise<{ tab?: string; status?: string; week?: string }>
}

export default async function SocialHubPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const params = await searchParams
  const tab = (TABS.includes(params.tab as TabId) ? params.tab : 'feed') as TabId

  const breadcrumb = (
    <SocialBreadcrumb crumbs={[
      { label: 'Social', href: '/cms/social' },
      { label: t.posts.tabs[tab] },
    ]} />
  )

  const actions = (
    <>
      <Link
        href="/cms/social/new?mode=cms"
        className="rounded-lg border border-cms-border px-4 py-2 text-sm font-medium text-cms-text hover:bg-cms-surface transition-colors"
      >
        Do CMS
      </Link>
      <Link
        href="/cms/social/new"
        className="rounded-lg bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover transition-colors"
      >
        Novo post
      </Link>
    </>
  )

  return (
    <div className="p-6 space-y-6">
      <SocialPageHeader
        breadcrumb={breadcrumb}
        title="Social Studio"
        subtitle="Gerenciar posts, agenda e fila de publicacao"
        actions={actions}
      />

      {/* Tab bar */}
      <div role="tablist" className="flex gap-1 border-b border-cms-border">
        {TABS.map(tabId => (
          <Link
            key={tabId}
            href={tabId === 'feed' ? '/cms/social' : `/cms/social?tab=${tabId}`}
            role="tab"
            aria-selected={tab === tabId}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === tabId
                ? 'text-pb-accent border-b-2 border-pb-accent'
                : 'text-cms-text-muted hover:text-cms-text'
            }`}
          >
            {t.posts.tabs[tabId]}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {tab === 'feed' && (
          <>
            <Suspense fallback={<AccountsStripSkeleton />}>
              <AccountsStripLoader siteId={ctx.siteId} />
            </Suspense>
            <Suspense fallback={<FeedSkeleton />}>
              <FeedViewLoader siteId={ctx.siteId} status={params.status} />
            </Suspense>
          </>
        )}
        {tab === 'calendar' && (
          <Suspense fallback={<CalendarSkeleton />}>
            <CalendarViewLoader siteId={ctx.siteId} week={params.week} />
          </Suspense>
        )}
        {tab === 'queue' && (
          <Suspense fallback={<QueueSkeleton />}>
            <QueueViewLoader siteId={ctx.siteId} />
          </Suspense>
        )}
        {tab === 'drafts' && (
          <Suspense fallback={<DraftsSkeleton />}>
            <DraftsViewLoader siteId={ctx.siteId} />
          </Suspense>
        )}
      </div>
    </div>
  )
}

// Skeleton placeholders
function AccountsStripSkeleton() {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(252px,1fr))] gap-3 animate-pulse">
    {[1,2,3].map(i => <div key={i} className="h-20 rounded-lg bg-cms-surface" />)}
  </div>
}

function FeedSkeleton() {
  return <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-4 animate-pulse">
    {[1,2,3,4,5,6].map(i => <div key={i} className="h-72 rounded-lg bg-cms-surface" />)}
  </div>
}

function CalendarSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg bg-cms-surface" />
}

function QueueSkeleton() {
  return <div className="space-y-2 animate-pulse">
    {[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-cms-surface" />)}
  </div>
}

function DraftsSkeleton() {
  return <div className="space-y-2 animate-pulse">
    {[1,2,3].map(i => <div key={i} className="h-20 rounded-lg bg-cms-surface" />)}
  </div>
}
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-hub-rewrite.test.tsx
# Expected: tests passed
```

---

### Task 2.2: AccountsStrip component (~3h)

**Modify:** `apps/web/src/app/cms/(authed)/social/_components/accounts-strip.tsx` (create new)
**Test:** `apps/web/test/cms/social-accounts-strip.test.tsx`

- [ ] Create `AccountsStripLoader` (Server Component that fetches health data)
- [ ] Create `AccountsStrip` (Client Component for rendering)
- [ ] Grid `repeat(auto-fit, minmax(252px, 1fr))`
- [ ] Each card: platform icon (36px square with tint), handle, followers, health dot
- [ ] Green dot = ok, amber "Reconectar" = warn, red "Expirado" = error
- [ ] Write tests

```typescript
// apps/web/src/app/cms/(authed)/social/_components/accounts-strip.tsx
import { checkConnectionHealth, type ConnectionHealth } from '@/lib/social/actions'
import { DESTINATIONS, type DestId } from '@/lib/social/destinations'

// Server Component that fetches + renders
export async function AccountsStripLoader({ siteId }: { siteId: string }) {
  const result = await checkConnectionHealth(siteId)
  if (!result.ok) return null
  if (result.data.length === 0) return null
  return <AccountsStripClient connections={result.data} />
}

// Separate client component for interactivity
// In practice, this would be in its own 'use client' file, or we split the file.
// For this plan, we show the pattern:
```

```typescript
// apps/web/src/app/cms/(authed)/social/_components/accounts-strip-client.tsx
'use client'

import type { ConnectionHealth } from '@/lib/social/actions'
import Link from 'next/link'

interface AccountsStripClientProps {
  connections: ConnectionHealth[]
}

const PROVIDER_ICONS: Record<string, { bg: string; label: string }> = {
  instagram: { bg: 'bg-[#E8823C]/15', label: 'IG' },
  youtube: { bg: 'bg-[#E0574E]/15', label: 'YT' },
  facebook: { bg: 'bg-[#5B7FD6]/15', label: 'FB' },
  bluesky: { bg: 'bg-sky-500/15', label: 'BS' },
}

function formatFollowers(count: number | null): string {
  if (count == null) return '--'
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return String(count)
}

export function AccountsStripClient({ connections }: AccountsStripClientProps) {
  return (
    <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(252px,1fr))] gap-3">
      {connections.map(conn => {
        const icon = PROVIDER_ICONS[conn.provider] ?? { bg: 'bg-gray-500/15', label: '?' }
        return (
          <div key={conn.connectionId} className="flex items-center gap-3 rounded-xl border border-cms-border bg-cms-surface px-4 py-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${icon.bg} text-sm font-bold`}>
              {icon.label}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-cms-text">{conn.accountName}</p>
              <p className="text-xs text-cms-text-muted">{formatFollowers(conn.followersCount)} seguidores</p>
            </div>
            <div className="shrink-0">
              {conn.status === 'ok' && (
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" title="Conectado" />
              )}
              {conn.status === 'warn' && (
                <Link href="/cms/social/accounts" className="text-xs font-medium text-amber-400 hover:text-amber-300">
                  Reconectar
                </Link>
              )}
              {conn.status === 'error' && (
                <Link href="/cms/social/accounts" className="text-xs font-medium text-red-400 hover:text-red-300">
                  Expirado
                </Link>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-accounts-strip.test.tsx
# Expected: tests passed
```

---

### Task 2.3: FeedView + FeedCard rewrite (~5h)

**Modify:** `apps/web/src/app/cms/(authed)/social/_components/posts-feed.tsx`
**Create:** `apps/web/src/app/cms/(authed)/social/_components/feed-card.tsx`
**Test:** `apps/web/test/cms/social-feed-rewrite.test.tsx`

- [ ] Create `FeedViewLoader` (Server Component that calls `listFeedPostsWithDeliveries`)
- [ ] Rewrite `PostsFeed` with URL-driven filter chips (using `?status=` param)
- [ ] Create `FeedCard` with 200px media height, Story mini (113x200), dest chip overlay, status badge
- [ ] Filter chips use `aria-pressed` for accessibility
- [ ] Grid `repeat(auto-fill, minmax(248px, 1fr))`
- [ ] Empty state per filter with contextual icon + text
- [ ] Write tests

The `FeedCard` must render:
- Media area (200px fixed height, `object-cover`)
- Story mini renders at 113x200 within card
- Dest chip (platform glyph + label) overlaid top-left
- Status badge overlaid top-right
- Footer: origin icon + name, metrics or error action

```typescript
// apps/web/src/app/cms/(authed)/social/_components/feed-card.tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { DestId } from '@/lib/social/destinations'
import { DESTINATIONS } from '@/lib/social/destinations'
import type { SocialPostWithPipeline } from '@/lib/social/row-parsers'

interface FeedCardProps {
  post: SocialPostWithPipeline
  destId: DestId | null
  destLabel: string
  provider: string
  statusLabel: string
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/20 text-green-400',
  scheduled: 'bg-blue-500/20 text-blue-400',
  failed: 'bg-red-500/20 text-red-400',
  draft: 'bg-yellow-500/20 text-yellow-400',
  publishing: 'bg-blue-500/20 text-blue-400',
}

export function FeedCard({ post, destId, destLabel, provider, statusLabel }: FeedCardProps) {
  const dest = destId ? DESTINATIONS[destId] : null
  const imageUrl = post.content.image ?? post.content.cover_image ?? null
  const isStory = destId === 'ig_story'
  const title = post.content.title ?? post.content.description ?? '(sem titulo)'

  return (
    <Link
      href={`/cms/social/${post.id}`}
      className="group relative overflow-hidden rounded-xl border border-cms-border bg-cms-surface transition-all hover:-translate-y-0.5 hover:border-cms-text/20"
    >
      {/* Media area — fixed 200px height */}
      <div className="relative h-[200px] overflow-hidden bg-cms-bg">
        {imageUrl ? (
          isStory ? (
            <div className="flex h-full items-center justify-center">
              <img
                src={imageUrl}
                alt=""
                className="h-[200px] w-[113px] rounded-lg object-cover"
              />
            </div>
          ) : (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-cms-text-dim">
            Sem imagem
          </div>
        )}

        {/* Dest chip — top left */}
        {dest && (
          <span
            className="absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm"
            style={{ backgroundColor: `${dest.tint}cc` }}
          >
            {destLabel}
          </span>
        )}

        {/* Status badge — top right */}
        <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[post.status] ?? 'bg-gray-500/20 text-gray-400'}`}>
          {statusLabel}
        </span>
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5">
        <p className="truncate text-sm font-medium text-cms-text">{title}</p>
        <p className="mt-0.5 text-xs text-cms-text-muted">
          {post.scheduled_at
            ? new Date(post.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : post.published_at
              ? new Date(post.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
              : ''}
        </p>
      </div>
    </Link>
  )
}
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-feed-rewrite.test.tsx
# Expected: tests passed
```

---

### Task 2.4: PostDetail Drawer — intercepting route (~5h)

**Create:** `apps/web/src/app/cms/(authed)/social/@drawer/(.)social/[id]/page.tsx` (or `@drawer/(.)` pattern)
**Create:** `apps/web/src/app/cms/(authed)/social/_components/drawer-shell.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/social/layout.tsx` (add `@drawer` slot)
**Test:** `apps/web/test/cms/social-drawer.test.tsx`

- [ ] Create layout.tsx with `@drawer` parallel route slot
- [ ] Create intercepting route `@drawer/(.)` pattern
- [ ] Create `DrawerShell` client component (440px, slide-in, focus trap, Escape close)
- [ ] Render: breadcrumb, status badge, native preview, metrics grid, delivery cards
- [ ] Footer actions vary by status (published/scheduled/failed)
- [ ] Wire `duplicatePost` action for the "Duplicar" button
- [ ] Write tests

```typescript
// apps/web/src/app/cms/(authed)/social/layout.tsx
import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
  drawer: ReactNode
}

export default function SocialLayout({ children, drawer }: LayoutProps) {
  return (
    <>
      {children}
      {drawer}
    </>
  )
}
```

```typescript
// apps/web/src/app/cms/(authed)/social/@drawer/default.tsx
export default function DrawerDefault() {
  return null
}
```

```typescript
// apps/web/src/app/cms/(authed)/social/_components/drawer-shell.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'

interface DrawerShellProps {
  children: ReactNode
}

export function DrawerShell({ children }: DrawerShellProps) {
  const router = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') router.back()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router])

  // Trap focus inside drawer
  useEffect(() => {
    const el = overlayRef.current
    if (!el) return
    const focusable = el.querySelectorAll<HTMLElement>(
      'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length > 0) focusable[0].focus()
  }, [])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => router.back()}
      />

      {/* Drawer panel */}
      <div
        className="relative w-[440px] max-w-full overflow-y-auto bg-cms-bg border-l border-cms-border animate-[ab-drawer-in_300ms_ease-out]"
      >
        {children}
      </div>
    </div>
  )
}
```

The intercepting route page would be a Server Component that fetches post data and renders inside `DrawerShell` with the native preview, metrics, and footer actions.

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-drawer.test.tsx
# Expected: tests passed
```

---

### Task 2.5: CalendarView rewrite — weekly 7-col (~4h)

**Modify:** `apps/web/src/app/cms/(authed)/social/_components/posts-calendar.tsx`
**Test:** `apps/web/test/cms/social-calendar-rewrite.test.tsx`

- [ ] Change from monthly view to weekly 7-col (Mon-Sun) grid
- [ ] Use `?week=2026-W22` URL state with week navigation arrows
- [ ] Events as chips with dest tint (`border-left: 2px solid {tint}`)
- [ ] Empty days show "+ slot livre"
- [ ] Current day highlighted with accent border
- [ ] Create `CalendarViewLoader` Server Component that calls `listCalendarEvents`
- [ ] Write tests

The weekly grid should:
- Parse ISO week format (`2026-W22`) to get Monday start date
- Show 7 columns (Mon-Sun) with date headers
- Each event chip shows time (HH:mm) + truncated title + dest color bar
- "Anterior" / "Proxima" navigation buttons update `?week=` param

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-calendar-rewrite.test.tsx
# Expected: tests passed
```

---

### Task 2.6: QueueView rewrite — pointer DnD + keyboard (~4h)

**Modify:** `apps/web/src/app/cms/(authed)/social/_components/posts-queue.tsx`
**Test:** `apps/web/test/cms/social-queue-rewrite.test.tsx`

- [ ] Rewrite with pointer events drag-and-drop (not HTML5 Drag API)
- [ ] Use `queue_position` field for ordering
- [ ] Each item: drag handle, position number, dest icon, caption preview, destination + language, scheduled time
- [ ] Keyboard: Arrow Up/Down to move item, Enter to confirm
- [ ] Use `useOptimistic` (React 19) for instant reorder feedback
- [ ] Call `reorderQueue` action on drop
- [ ] Create `QueueViewLoader` Server Component
- [ ] Write tests

Key implementation details:
- `onPointerDown` starts drag, `onPointerMove` tracks position, `onPointerUp` commits
- Use CSS `touch-action: none` on handle to prevent scroll during drag
- Minimum touch target 44px for handles
- Animate position changes with CSS transitions

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-queue-rewrite.test.tsx
# Expected: tests passed
```

---

### Task 2.7: DraftsView rewrite — AI drafts display (~3h)

**Modify:** `apps/web/src/app/cms/(authed)/social/_components/posts-drafts.tsx`
**Test:** `apps/web/test/cms/social-drafts-rewrite.test.tsx`

- [ ] Filter to posts with `origin: 'auto'` and `status: 'draft'`
- [ ] Each item: Cowork purple icon, title, description, confidence badge (%), dest+language chip, trigger text
- [ ] "Descartar" / "Revisar" action buttons per item
- [ ] "Automacoes" button at top links to `/cms/social/accounts?tab=automations`
- [ ] Confidence badge: green >=80%, amber 50-79%, red <50%
- [ ] Create `DraftsViewLoader` Server Component
- [ ] Write tests

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-drafts-rewrite.test.tsx
# Expected: tests passed
```

---

### Task 2.8: Hub phase verification (~1h)

- [ ] Run all social tests
- [ ] Typecheck
- [ ] Visual review of Hub page with all 4 tabs

```bash
npx vitest run apps/web/test/cms/social-*.test.tsx apps/web/test/social-*.test.ts
# Expected: all tests pass

npx tsc --noEmit -p apps/web/tsconfig.json
# Expected: no errors
```

---

## Phase 3: Compositor (~24h)

**Base:** `apps/web/src/app/cms/(authed)/social/new/`
**Test:** `apps/web/test/cms/`
**Spec:** Section 3.2

---

### Task 3.1: Compositor page.tsx rewrite (~2h)

**Modify:** `apps/web/src/app/cms/(authed)/social/new/page.tsx`

- [ ] Rewrite as Server Component with mode from URL (?mode=cms|blank)
- [ ] Add SocialPageHeader with dynamic breadcrumb
- [ ] Add segmented control "Do CMS" | "Em branco"
- [ ] Fetch connections, pass to ComposerShell
- [ ] Suspense boundary around ComposerShell
- [ ] Wire all necessary action callbacks

```typescript
// apps/web/src/app/cms/(authed)/social/new/page.tsx
import { Suspense } from 'react'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getConnections } from '@/lib/social/actions'
import { SocialBreadcrumb } from '../_components/shared/social-breadcrumb'
import { SocialPageHeader } from '../_components/shared/social-page-header'
import { ComposerShell } from './_components/composer-shell'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ mode?: string; draft?: string; lang?: string }>
}

export default async function CompositorPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const params = await searchParams
  const mode = (params.mode === 'blank' ? 'blank' : 'cms') as 'cms' | 'blank'

  const result = await getConnections(ctx.siteId)
  const connections = result.ok ? result.data : []

  const breadcrumb = (
    <SocialBreadcrumb crumbs={[
      { label: 'Social', href: '/cms/social' },
      { label: 'Novo Post' },
    ]} />
  )

  return (
    <div className="p-6">
      <SocialPageHeader breadcrumb={breadcrumb} title="Novo Post" />
      <Suspense fallback={<CompositorSkeleton />}>
        <ComposerShell
          connections={connections}
          initialMode={mode}
          draftId={params.draft}
          siteId={ctx.siteId}
        />
      </Suspense>
    </div>
  )
}

function CompositorSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px] animate-pulse">
      <div className="space-y-4">
        <div className="h-12 rounded-lg bg-cms-surface" />
        <div className="h-40 rounded-lg bg-cms-surface" />
        <div className="h-32 rounded-lg bg-cms-surface" />
      </div>
      <div className="h-[500px] rounded-lg bg-cms-surface" />
    </div>
  )
}
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-compositor-page.test.tsx
# Expected: tests passed
```

---

### Task 3.2: DestCard component (~2.5h)

**Create:** `apps/web/src/app/cms/(authed)/social/new/_components/dest-card.tsx`
**Test:** `apps/web/test/cms/social-dest-card.test.tsx`

- [ ] Create DestCard with: tint border, platform icon, label+sublabel, badge (default/rare), truth text
- [ ] Checkbox toggle to enable/disable destination
- [ ] Click card = focus (highlight border); checkbox = toggle publish
- [ ] Disabled state: opacity 0.62
- [ ] Render 4 cards in a row using `DESTINATIONS` from `destinations.ts`
- [ ] Write tests

```typescript
// apps/web/src/app/cms/(authed)/social/new/_components/dest-card.tsx
'use client'

import type { DestId } from '@/lib/social/destinations'
import { DESTINATIONS } from '@/lib/social/destinations'

interface DestCardProps {
  destId: DestId
  isOn: boolean
  isFocused: boolean
  onToggle: (destId: DestId) => void
  onFocus: (destId: DestId) => void
}

export function DestCard({ destId, isOn, isFocused, onToggle, onFocus }: DestCardProps) {
  const dest = DESTINATIONS[destId]

  return (
    <button
      type="button"
      onClick={() => onFocus(destId)}
      className={`relative flex flex-col gap-2 rounded-xl border-2 p-3 text-left transition-all ${
        isFocused
          ? 'border-current shadow-sm'
          : 'border-cms-border'
      } ${!isOn ? 'opacity-[0.62]' : ''}`}
      style={{ color: isFocused ? dest.tint : undefined }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: dest.tint }}
          >
            {dest.sublabel.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-cms-text">{dest.label}</p>
            <p className="text-xs text-cms-text-muted">{dest.sublabel}</p>
          </div>
        </div>

        {/* Toggle checkbox */}
        <input
          type="checkbox"
          checked={isOn}
          onChange={(e) => {
            e.stopPropagation()
            onToggle(destId)
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-cms-border accent-current"
          aria-label={`${isOn ? 'Desativar' : 'Ativar'} ${dest.label} ${dest.sublabel}`}
        />
      </div>

      {/* Badge */}
      {dest.badge && (
        <span className={`self-start rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
          dest.badge === 'default' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
        }`}>
          {dest.badge === 'default' ? 'padrao' : 'raro'}
        </span>
      )}

      {/* Truth text */}
      <p className="text-xs leading-relaxed text-cms-text-dim">{dest.truth}</p>
    </button>
  )
}
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-dest-card.test.tsx
# Expected: tests passed
```

---

### Task 3.3: useComposer hook (~3h)

**Create:** `apps/web/src/app/cms/(authed)/social/new/_components/use-composer.ts`
**Test:** `apps/web/test/cms/social-use-composer.test.ts`

- [ ] Extract 22+ states from composer-shell into custom hook
- [ ] State: mode, lang, destsOn, focused, captions, poll, sched, schedDate, schedTime, publishing, cmsPicked, aiData, aiLoading, design
- [ ] Handlers: toggleDest, focusDest, setCaption, setMode, setLang, setSched, setScheduleDate, setScheduleTime, applyAISuggestion, applyPoll, updateDesign
- [ ] Return typed state + handlers object
- [ ] Write tests using `renderHook`

```typescript
// apps/web/src/app/cms/(authed)/social/new/_components/use-composer.ts
'use client'

import { useState, useCallback } from 'react'
import type { DestId } from '@/lib/social/destinations'
import { DEST_IDS } from '@/lib/social/destinations'
import type { CardComposition } from '@tn-figueiredo/links/qr'

export interface PollConfig {
  options: string[]
  durationHours: number
}

export interface CMSContent {
  id: string
  type: string
  title: string
  excerpt: string | null
  imageUrl: string | null
  url: string
  locale: string
}

export interface AISuggestion {
  variations: string[]
  hashtags: string[]
  tone: string
  bestTime: string | null
}

export interface ComposerState {
  mode: 'cms' | 'blank'
  lang: 'pt' | 'en'
  destsOn: Record<DestId, boolean>
  focused: DestId
  captions: Record<string, string>
  poll: PollConfig | null
  sched: 'now' | 'schedule' | 'queue'
  schedDate: string
  schedTime: string
  publishing: boolean
  cmsPicked: CMSContent | null
  aiData: AISuggestion | null
  aiLoading: boolean
  design: CardComposition | null
}

const DEFAULT_DESTS_ON: Record<DestId, boolean> = {
  ig_story: true,
  yt_community: true,
  fb_page: true,
  ig_feed: false,
}

export function useComposer(initialMode: 'cms' | 'blank' = 'cms') {
  const [mode, setMode] = useState<'cms' | 'blank'>(initialMode)
  const [lang, setLang] = useState<'pt' | 'en'>('pt')
  const [destsOn, setDestsOn] = useState<Record<DestId, boolean>>(DEFAULT_DESTS_ON)
  const [focused, setFocused] = useState<DestId>('ig_story')
  const [captions, setCaptions] = useState<Record<string, string>>({})
  const [poll, setPoll] = useState<PollConfig | null>(null)
  const [sched, setSched] = useState<'now' | 'schedule' | 'queue'>('now')
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [cmsPicked, setCmsPicked] = useState<CMSContent | null>(null)
  const [aiData, setAiData] = useState<AISuggestion | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [design, setDesign] = useState<CardComposition | null>(null)

  const toggleDest = useCallback((id: DestId) => {
    setDestsOn(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const focusDest = useCallback((id: DestId) => {
    setFocused(id)
  }, [])

  const captionKey = useCallback((destId: DestId, language: 'pt' | 'en') => {
    return `${destId}_${language}`
  }, [])

  const setCaption = useCallback((destId: DestId, language: 'pt' | 'en', value: string) => {
    setCaptions(prev => ({ ...prev, [`${destId}_${language}`]: value }))
  }, [])

  const getCaption = useCallback((destId: DestId, language: 'pt' | 'en') => {
    return captions[`${destId}_${language}`] ?? ''
  }, [captions])

  const applyAISuggestion = useCallback((suggestion: AISuggestion) => {
    setAiData(suggestion)
  }, [])

  const updateDesign = useCallback((composition: CardComposition) => {
    setDesign(composition)
  }, [])

  const activeDests = DEST_IDS.filter(id => destsOn[id])

  return {
    // State
    mode, lang, destsOn, focused, captions, poll, sched,
    schedDate, schedTime, publishing, cmsPicked, aiData,
    aiLoading, design, activeDests,
    // Setters
    setMode, setLang, toggleDest, focusDest, setCaption, getCaption,
    setPoll, setSched, setSchedDate, setSchedTime, setPublishing,
    setCmsPicked, setAiData, setAiLoading, applyAISuggestion, updateDesign,
  }
}
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-use-composer.test.ts
# Expected: tests passed
```

---

### Task 3.4: useComposerPersistence hook (~2h)

**Create:** `apps/web/src/app/cms/(authed)/social/new/_components/use-composer-persistence.ts`
**Test:** `apps/web/test/cms/social-composer-persistence.test.ts`

- [ ] Save composer state to `sessionStorage` every 5 seconds
- [ ] Add `beforeunload` handler when state has changes
- [ ] Restore from sessionStorage on mount (key: `social-composer-draft`)
- [ ] Restore from draft ID if `?draft={id}` is present
- [ ] "Salvar rascunho" creates `social_post` with `status: 'draft'`
- [ ] Write tests

```typescript
// Key behaviors:
// 1. On mount: check sessionStorage for key 'social-composer-${draftId ?? "new"}'
// 2. Every 5s: serialize state and write to sessionStorage
// 3. beforeunload: warn if unsaved changes exist
// 4. saveDraft(): calls createSocialPost with status='draft', returns postId
// 5. clearPersistence(): remove sessionStorage key
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-composer-persistence.test.ts
# Expected: tests passed
```

---

### Task 3.5: CMSPicker rewrite (~3h)

**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/content-picker.tsx`
**Test:** `apps/web/test/cms/social-cms-picker.test.tsx`

- [ ] Add Cowork purple banner at top ("Montado automatico pela IA")
- [ ] Tabs: Todos / Blog / Newsletter / Video
- [ ] Content cards with thumbnail, badges (BLOG/NEWSLETTER/VIDEO + language PT/EN), MiniDots for suggested destinations
- [ ] On select: auto-fill language, destinations, captions, canvas title
- [ ] Show "Montado automatico" ribbon after selection
- [ ] Write tests

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-cms-picker.test.tsx
# Expected: tests passed
```

---

### Task 3.6: CaptionEditor per-destination (~2.5h)

**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/caption-editor.tsx` (create new or modify existing composer-editor)
**Test:** `apps/web/test/cms/social-caption-editor.test.tsx`

- [ ] Create CaptionEditor that adapts per destination:
  - **ig_story:** note "texto/link moram na arte" + short optional input
  - **yt_community:** textarea (1500 limit) + platform note + "Adicionar enquete" button
  - **fb_page:** textarea (2200 limit) + platform note + hashtag area
  - **ig_feed:** textarea (2200 limit) + platform note + hashtag area
- [ ] Character counter showing `{count}/{limit}` with warning color at 90%+
- [ ] Platform-specific placeholder text
- [ ] Write tests

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-caption-editor.test.tsx
# Expected: tests passed
```

---

### Task 3.7: AICaptionBlock + TranslateButton (~3h)

**Create:** `apps/web/src/app/cms/(authed)/social/new/_components/ai-caption-block.tsx`
**Create:** `apps/web/src/app/cms/(authed)/social/new/_components/translate-button.tsx`
**Test:** `apps/web/test/cms/social-ai-caption.test.tsx`

- [ ] AICaptionBlock: "Gerar com IA" button -> calls `generateAICaption` -> shows:
  - 2 clickable variations (click to apply to caption)
  - Hashtags with "Adicionar" button
  - Best time suggestion (click to switch to schedule mode + set time)
  - Cowork purple accent color
  - Loading spinner during generation
- [ ] TranslateButton: PT<->EN toggle, calls `translateCaption`, shows loading state
- [ ] Write tests

```typescript
// apps/web/src/app/cms/(authed)/social/new/_components/ai-caption-block.tsx
'use client'

import { useState } from 'react'
import type { DestId } from '@/lib/social/destinations'
import type { AISuggestion } from './use-composer'

interface AICaptionBlockProps {
  destId: DestId
  lang: 'pt' | 'en'
  source?: { title: string; excerpt: string | null; url?: string }
  onApplyVariation: (text: string) => void
  onApplyHashtags: (tags: string[]) => void
  onApplyBestTime: (time: string) => void
  onGenerateCaption: (destId: DestId, lang: 'pt' | 'en', source?: { title: string; excerpt: string | null; url?: string }) => Promise<AISuggestion | null>
}

export function AICaptionBlock({
  destId, lang, source, onApplyVariation, onApplyHashtags, onApplyBestTime, onGenerateCaption,
}: AICaptionBlockProps) {
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)

  async function handleGenerate() {
    setLoading(true)
    try {
      const result = await onGenerateCaption(destId, lang, source)
      if (result) setSuggestion(result)
    } finally {
      setLoading(false)
    }
  }

  if (!suggestion) {
    return (
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-[var(--cms-cowork)]/30 bg-[var(--cms-cowork)]/10 px-3 py-2 text-sm font-medium text-[var(--cms-cowork)] hover:bg-[var(--cms-cowork)]/20 transition-colors disabled:opacity-50"
      >
        {loading ? 'Gerando...' : 'Gerar com IA'}
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--cms-cowork)]/20 bg-[var(--cms-cowork)]/5 p-3 animate-[ab-fade-up_300ms_ease-out]">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--cms-cowork)]">
        Sugestoes da IA
      </p>

      {/* Variations */}
      <div className="space-y-2">
        {suggestion.variations.map((text, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onApplyVariation(text)}
            className="block w-full rounded-lg border border-cms-border bg-cms-surface p-2 text-left text-sm text-cms-text hover:border-[var(--cms-cowork)]/40 transition-colors"
          >
            {text}
          </button>
        ))}
      </div>

      {/* Hashtags */}
      {suggestion.hashtags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {suggestion.hashtags.map(tag => (
            <span key={tag} className="rounded-full bg-cms-surface px-2 py-0.5 text-xs text-cms-text-muted">
              #{tag}
            </span>
          ))}
          <button
            type="button"
            onClick={() => onApplyHashtags(suggestion.hashtags)}
            className="text-xs font-medium text-[var(--cms-cowork)] hover:underline"
          >
            Adicionar
          </button>
        </div>
      )}

      {/* Best time */}
      {suggestion.bestTime && (
        <button
          type="button"
          onClick={() => onApplyBestTime(suggestion.bestTime!)}
          className="text-xs text-cms-text-muted hover:text-[var(--cms-cowork)]"
        >
          Melhor horario: {suggestion.bestTime}
        </button>
      )}
    </div>
  )
}
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-ai-caption.test.tsx
# Expected: tests passed
```

---

### Task 3.8: LivePreview + CanvasEmbed (~2h)

**Create:** `apps/web/src/app/cms/(authed)/social/new/_components/live-preview.tsx`
**Create:** `apps/web/src/app/cms/(authed)/social/new/_components/canvas-embed.tsx`
**Test:** `apps/web/test/cms/social-live-preview.test.tsx`

- [ ] LivePreview: sticky right column, renders `DestPreview` for focused destination
- [ ] CanvasEmbed: mini preview of current canvas design + "Abrir editor" button
- [ ] Show for visual destinations (ig_story, ig_feed, fb_page) — hide for yt_community if no image
- [ ] Wire canvas open/close state
- [ ] Write tests

```typescript
// apps/web/src/app/cms/(authed)/social/new/_components/live-preview.tsx
'use client'

import type { DestId } from '@/lib/social/destinations'
import { DESTINATIONS } from '@/lib/social/destinations'
import { DestPreview } from '../../_components/platform-previews/dest-preview'

interface LivePreviewProps {
  destId: DestId
  caption: string
  imageUrl: string | null
  accountName: string
  avatarUrl?: string | null
  poll?: Array<{ text: string; percentage?: number }>
}

export function LivePreview({ destId, caption, imageUrl, accountName, avatarUrl, poll }: LivePreviewProps) {
  const dest = DESTINATIONS[destId]

  return (
    <div className="sticky top-6">
      <div className="mb-2 flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: dest.tint }}
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cms-text-dim">
          Preview {dest.label} {dest.sublabel}
        </p>
      </div>
      <DestPreview
        destId={destId}
        caption={caption}
        imageUrl={imageUrl}
        accountName={accountName}
        avatarUrl={avatarUrl}
        poll={poll}
      />
    </div>
  )
}
```

```typescript
// apps/web/src/app/cms/(authed)/social/new/_components/canvas-embed.tsx
'use client'

interface CanvasEmbedProps {
  thumbnailUrl: string | null
  onOpenEditor: () => void
}

export function CanvasEmbed({ thumbnailUrl, onOpenEditor }: CanvasEmbedProps) {
  return (
    <div className="rounded-xl border border-cms-border bg-cms-surface overflow-hidden">
      {/* Mini preview */}
      <div className="relative aspect-video bg-cms-bg">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="Canvas preview" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-cms-text-dim">
            Sem arte
          </div>
        )}
      </div>
      <div className="p-3">
        <button
          type="button"
          onClick={onOpenEditor}
          className="w-full rounded-lg border border-cms-border px-3 py-2 text-sm font-medium text-cms-text hover:bg-cms-bg transition-colors"
        >
          Abrir editor
        </button>
      </div>
    </div>
  )
}
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-live-preview.test.tsx
# Expected: tests passed
```

---

### Task 3.9: SchedulePanel (~2h)

**Create:** `apps/web/src/app/cms/(authed)/social/new/_components/schedule-panel.tsx`
**Test:** `apps/web/test/cms/social-schedule-panel.test.tsx`

- [ ] Day chips (next 7 days) — clickable, selected state
- [ ] Time chips (hour slots) — clickable, selected state
- [ ] Best-time dots (orange circle) on recommended slots from `getBestTimes`
- [ ] Expands above the footer when "Agendar" mode is selected
- [ ] Animation: `ab-fade-up` on expand
- [ ] Write tests

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-schedule-panel.test.tsx
# Expected: tests passed
```

---

### Task 3.10: ComposerShell rewrite + footer (~4h)

**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/composer-shell.tsx`
**Test:** `apps/web/test/cms/social-compositor-shell.test.tsx`

- [ ] Rewrite ComposerShell to use `useComposer` hook + `useComposerPersistence`
- [ ] 2-column layout: build (left) + preview (right, 380px) at >=1080px
- [ ] 1-column at <1080px with preview above caption
- [ ] Left column: DestCards row -> dest header -> CanvasEmbed -> CaptionEditor -> AICaptionBlock
- [ ] Right column: LivePreview (sticky)
- [ ] Sticky footer with segmented control: Agora | Agendar | Fila
- [ ] Footer actions: "Salvar rascunho" (ghost) + primary button (changes per mode)
- [ ] "Agora" -> "Publicar" (green) -> opens PublishFlow
- [ ] "Agendar" -> "Agendar" button + SchedulePanel expands
- [ ] "Fila" -> "Adicionar a fila"
- [ ] Write tests

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-compositor-shell.test.tsx
# Expected: tests passed
```

---

### Task 3.11: Compositor phase verification (~1h)

- [ ] Run all tests
- [ ] Typecheck
- [ ] Visual review of Compositor in both modes

```bash
npx vitest run apps/web/test/cms/social-*.test.tsx apps/web/test/social-*.test.ts
npx tsc --noEmit -p apps/web/tsconfig.json
```

---

## Phase 4: Canvas Editor (~16h)

**Base:** `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/`
**Test:** `apps/web/test/cms/`
**Spec:** Section 3.3

---

### Task 4.1: Extend aspect ratios to 6 (~2h)

**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/social-left-panel.tsx`
**Test:** `apps/web/test/cms/social-canvas-ratios.test.tsx`

- [ ] Add 3 new ratios to `SOCIAL_ASPECT_RATIOS`:
  - Paisagem: 16:9 (1920x1080)
  - Wide/OG: 1200x630
  - Custom: user-defined
- [ ] Update grid layout to accommodate 6 ratio buttons (2x3 grid)
- [ ] Keep existing Story (9:16), Quadrado (1:1), Feed (4:5)
- [ ] Update `SocialAspectRatio` type
- [ ] Write tests

```typescript
// Extended ratios in social-left-panel.tsx
export const SOCIAL_ASPECT_RATIOS = [
  { name: 'Story' as const, width: 1080, height: 1920, label: 'Story 9:16' },
  { name: 'Quadrado' as const, width: 1080, height: 1080, label: 'Quadrado 1:1' },
  { name: 'Feed' as const, width: 1080, height: 1350, label: 'Feed 4:5' },
  { name: 'Paisagem' as const, width: 1920, height: 1080, label: 'Paisagem 16:9' },
  { name: 'Wide' as const, width: 1200, height: 630, label: 'Wide/OG' },
  { name: 'Custom' as const, width: 1080, height: 1080, label: 'Custom' },
] as const

export type SocialAspectRatio = (typeof SOCIAL_ASPECT_RATIOS)[number]['name']
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-canvas-ratios.test.tsx
# Expected: tests passed
```

---

### Task 4.2: New element types — GIF, Sticker, Logo, Frame (~4h)

**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/social-left-panel.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/social-right-panel.tsx`
**Test:** `apps/web/test/cms/social-canvas-elements.test.tsx`

- [ ] Add element types to left panel: GIF, Sticker, Logo, Frame (in addition to existing Text, Image, QR)
- [ ] 7 total element type buttons in "Adicionar" section
- [ ] GIF: opens picker (or URL input), renders as static frame in Konva, tooltip explains limitation
- [ ] Sticker: text input for button label + note about tracked link
- [ ] Logo: fixed brand logo element
- [ ] Frame: decorative frame overlay
- [ ] Update right panel to show inspectors for new element types
- [ ] Write tests

Key details:
- GIF tooltip: "GIF renderizado como frame estatico na exportacao"
- Sticker: creates a link-tracked element (uses existing short link infrastructure)
- Logo/Frame: simple positioned elements

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-canvas-elements.test.tsx
# Expected: tests passed
```

---

### Task 4.3: Video background support (~3h)

**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/social-left-panel.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/social-canvas.tsx`
**Test:** `apps/web/test/cms/social-canvas-video-bg.test.tsx`

- [ ] Add "Video" option to background type selector (Solid / Image / Video / Degrade)
- [ ] Video upload via existing media system
- [ ] Capture first frame for Konva rendering (Konva only renders static)
- [ ] Export uses captured frame as background
- [ ] Video background data stored in composition JSON: `{ type: 'video', url: string, frameUrl: string }`
- [ ] Write tests

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-canvas-video-bg.test.tsx
# Expected: tests passed
```

---

### Task 4.4: Story frames strip (~3h)

**Create:** `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/story-frames-strip.tsx`
**Test:** `apps/web/test/cms/social-story-frames.test.tsx`

- [ ] Multi-frame strip below canvas for Story mode (9:16 only)
- [ ] Add / Remove / Reorder frames
- [ ] Each frame is an independent composition
- [ ] Active frame highlighted with accent border
- [ ] Reorder via drag or keyboard
- [ ] Maximum 10 frames
- [ ] Write tests

```typescript
// apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/story-frames-strip.tsx
'use client'

import type { CardComposition } from '@tn-figueiredo/links/qr'

interface StoryFrame {
  id: string
  composition: CardComposition
  thumbnailUrl: string | null
}

interface StoryFramesStripProps {
  frames: StoryFrame[]
  activeFrameId: string
  onSelectFrame: (frameId: string) => void
  onAddFrame: () => void
  onRemoveFrame: (frameId: string) => void
  onReorderFrames: (fromIndex: number, toIndex: number) => void
}

export function StoryFramesStrip({
  frames, activeFrameId, onSelectFrame, onAddFrame, onRemoveFrame, onReorderFrames,
}: StoryFramesStripProps) {
  return (
    <div className="flex items-center gap-2 border-t border-cms-border bg-cms-bg px-4 py-3 overflow-x-auto">
      {frames.map((frame, i) => (
        <button
          key={frame.id}
          type="button"
          onClick={() => onSelectFrame(frame.id)}
          className={`relative h-16 w-9 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
            frame.id === activeFrameId ? 'border-pb-accent' : 'border-cms-border hover:border-cms-text/30'
          }`}
        >
          {frame.thumbnailUrl ? (
            <img src={frame.thumbnailUrl} alt={`Frame ${i + 1}`} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-[8px] text-cms-text-dim">{i + 1}</span>
          )}

          {frames.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemoveFrame(frame.id) }}
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white opacity-0 group-hover:opacity-100"
              aria-label={`Remover frame ${i + 1}`}
            >
              x
            </button>
          )}
        </button>
      ))}

      {frames.length < 10 && (
        <button
          type="button"
          onClick={onAddFrame}
          className="flex h-16 w-9 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-cms-border text-cms-text-muted hover:border-cms-text/30 hover:text-cms-text transition-colors"
          aria-label="Adicionar frame"
        >
          +
        </button>
      )}
    </div>
  )
}
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-story-frames.test.tsx
# Expected: tests passed
```

---

### Task 4.5: "Usar no post" button + toolbar updates (~2h)

**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/social-toolbar.tsx`
**Modify:** `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/index.tsx`
**Test:** `apps/web/test/cms/social-canvas-use-in-post.test.tsx`

- [ ] Add "Usar no post" primary button to toolbar (right side)
- [ ] On click: export current design, close canvas overlay, return to compositor with design data
- [ ] Update toolbar breadcrumb: `Posts > Story > {title}`
- [ ] Template load must preserve undo history (don't reset undo stack on template apply)
- [ ] Write tests

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-canvas-use-in-post.test.tsx
# Expected: tests passed
```

---

### Task 4.6: Canvas phase verification (~2h)

- [ ] Run all canvas tests
- [ ] Typecheck
- [ ] Run `npm run build:packages` (canvas may touch packages/)
- [ ] Visual review of canvas editor with new features

```bash
npm run build:packages
npx vitest run apps/web/test/cms/social-canvas-*.test.tsx
npx tsc --noEmit -p apps/web/tsconfig.json
```

---

## Phase 5: Pipeline & Integration (~30h)

**Base:** Multiple paths
**Test:** `apps/web/test/`
**Spec:** Sections 3.2.6, 10, 4

---

### Task 5.1: PublishFlow modal (~6h)

**Create:** `apps/web/src/app/cms/(authed)/social/new/_components/publish-flow.tsx`
**Test:** `apps/web/test/cms/social-publish-flow.test.tsx`

- [ ] Modal overlay with 4 animated steps: Post -> Short Link -> Preparar destino -> Entregar
- [ ] Sequential CSS `transition-delay` for step animation
- [ ] Real-time progress via Supabase Realtime on `social_deliveries` status changes
- [ ] After all steps: per-destination results (success with link / error with reason)
- [ ] Facebook error state: "Token da pagina expirou" + "Reconectar" button
- [ ] YouTube: "Ready to Post" screen with copy-paste content (type='manual')
- [ ] Footer: "Fechar" / "Ver no feed"
- [ ] Write tests

```typescript
// apps/web/src/app/cms/(authed)/social/new/_components/publish-flow.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSocialDeliveries } from '@/lib/social/realtime'
import type { DestId } from '@/lib/social/destinations'
import { DESTINATIONS } from '@/lib/social/destinations'

type FlowStep = 'post' | 'short_link' | 'prepare' | 'deliver'

interface PublishFlowProps {
  postId: string
  activeDests: DestId[]
  onClose: () => void
}

const STEPS: { id: FlowStep; label: string }[] = [
  { id: 'post', label: 'Criar post' },
  { id: 'short_link', label: 'Short link' },
  { id: 'prepare', label: 'Preparar destinos' },
  { id: 'deliver', label: 'Entregar' },
]

export function PublishFlow({ postId, activeDests, onClose }: PublishFlowProps) {
  const router = useRouter()
  const deliveries = useSocialDeliveries(postId)
  const [currentStep, setCurrentStep] = useState<number>(0)

  // Advance steps based on delivery status changes
  useEffect(() => {
    if (deliveries.length === 0) return

    const allDelivered = deliveries.every(d =>
      d.status === 'published' || d.status === 'failed'
    )
    const anyPreparing = deliveries.some(d => d.status === 'pending')

    if (allDelivered) setCurrentStep(3)
    else if (!anyPreparing && deliveries.length > 0) setCurrentStep(2)
  }, [deliveries])

  const allDone = deliveries.length > 0 && deliveries.every(d =>
    d.status === 'published' || d.status === 'failed'
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-2xl bg-cms-surface p-6 shadow-2xl">
        {/* Steps progress */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex-1">
              <div className={`h-1 rounded-full transition-all duration-500 ${
                i <= currentStep ? 'bg-green-500' : 'bg-cms-border'
              }`} style={{ transitionDelay: `${i * 200}ms` }} />
              <p className={`mt-1 text-xs ${
                i <= currentStep ? 'text-cms-text' : 'text-cms-text-dim'
              }`}>{step.label}</p>
            </div>
          ))}
        </div>

        {/* Results per destination */}
        {allDone && (
          <div className="space-y-3 animate-[ab-fade-up_300ms_ease-out]">
            {deliveries.map(del => {
              const dest = activeDests.find(id => DESTINATIONS[id].provider === del.provider)
              const destConfig = dest ? DESTINATIONS[dest] : null

              return (
                <div key={del.id} className="flex items-center gap-3 rounded-lg border border-cms-border bg-cms-bg p-3">
                  {destConfig && (
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: destConfig.tint }}
                    >
                      {destConfig.sublabel.slice(0, 2)}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-cms-text">{destConfig?.label ?? del.provider}</p>
                  </div>
                  {del.status === 'published' ? (
                    <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-400">No ar</span>
                  ) : (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">Erro</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-cms-border px-4 py-2 text-sm text-cms-text hover:bg-cms-bg"
          >
            Fechar
          </button>
          {allDone && (
            <button
              type="button"
              onClick={() => { onClose(); router.push('/cms/social?tab=feed') }}
              className="rounded-lg bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
            >
              Ver no feed
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-publish-flow.test.tsx
# Expected: tests passed
```

---

### Task 5.2: AI/Cowork cron — social-auto-draft (~4h)

**Create:** `apps/web/src/app/api/cron/social-auto-draft/route.ts`
**Test:** `apps/web/test/social-auto-draft-cron.test.ts`

- [ ] Create cron API route at `/api/cron/social-auto-draft`
- [ ] Detects new content (blog/newsletter/video published in last 24h) without associated social post
- [ ] Generates draft via `createAutoDraft` action
- [ ] Sets `origin: 'auto'`, confidence score, trigger metadata in pipeline_steps JSONB
- [ ] Schedule: every 30 minutes (via Vercel Cron config)
- [ ] Requires `CRON_SECRET` header validation
- [ ] Write tests

```typescript
// apps/web/src/app/api/cron/social-auto-draft/route.ts
import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseServiceClient()
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Find blog posts published in last 24h without social posts
    const { data: blogPosts } = await supabase
      .from('blog_posts')
      .select('id, site_id, title, slug')
      .gte('published_at', cutoff)
      .eq('status', 'published')

    const { data: existingSocial } = await supabase
      .from('social_posts')
      .select('content')
      .gte('created_at', cutoff)

    // Filter to content without existing social posts
    const existingContentIds = new Set(
      (existingSocial ?? [])
        .map(p => (p.content as Record<string, unknown>)?.source_content_id)
        .filter(Boolean)
    )

    let draftsCreated = 0
    for (const post of (blogPosts ?? [])) {
      if (existingContentIds.has(post.id)) continue

      const { error } = await supabase
        .from('social_posts')
        .insert({
          site_id: post.site_id,
          created_by: '00000000-0000-0000-0000-000000000000', // system user
          type: 'text',
          status: 'draft',
          content: {
            title: post.title,
            source_content_id: post.id,
            source_content_type: 'blog',
          },
          origin: 'auto',
          idempotency_key: crypto.randomUUID(),
          user_timezone: 'America/Sao_Paulo',
          pipeline_steps: [
            {
              step: 'auto_draft',
              status: 'completed',
              at: new Date().toISOString(),
              data: {
                trigger: 'blog_published',
                confidence: 0.85,
                source_title: post.title,
              },
            },
          ],
        })

      if (!error) draftsCreated++
    }

    return NextResponse.json({ ok: true, draftsCreated })
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'social-auto-draft-cron' } })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [ ] Add to `vercel.json` cron config:

```json
{
  "crons": [
    {
      "path": "/api/cron/social-auto-draft",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

**Verify:**

```bash
npx vitest run apps/web/test/social-auto-draft-cron.test.ts
# Expected: tests passed
```

---

### Task 5.3: i18n strings update (~2h)

**Modify:** `apps/web/src/app/cms/(authed)/social/_i18n/types.ts`
**Modify:** `apps/web/src/app/cms/(authed)/social/_i18n/pt-BR.ts`
**Modify:** `apps/web/src/app/cms/(authed)/social/_i18n/en.ts`
**Test:** `apps/web/test/cms/social-i18n-completeness.test.ts`

- [ ] Add new string keys for all rewrite components:
  - Hub: `hub.title`, `hub.subtitle`, `hub.fromCms`, `hub.newPost`
  - AccountsStrip: `accounts.followers`, `accounts.reconnect`, `accounts.expired`
  - FeedCard: `feed.noImage`, `feed.storyMini`
  - Calendar: `calendar.slotFree`, `calendar.prevWeek`, `calendar.nextWeek`
  - Queue: `queue.dragHandle`, `queue.position`, `queue.keyboard`
  - Drafts: `drafts.confidence`, `drafts.trigger`, `drafts.discard`, `drafts.review`, `drafts.automations`
  - Compositor: `compositor.destCards.*`, `compositor.caption.*`, `compositor.ai.*`, `compositor.schedule.*`
  - Canvas: `canvas.ratios.*`, `canvas.elements.*`, `canvas.useInPost`
  - PublishFlow: `publishFlow.steps.*`, `publishFlow.results.*`
- [ ] Write completeness test: both locale files must have identical key sets
- [ ] Write test

```typescript
// apps/web/test/cms/social-i18n-completeness.test.ts
import { describe, it, expect } from 'vitest'
import { ptBR } from '@/app/cms/(authed)/social/_i18n/pt-BR'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

function flatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return flatKeys(value as Record<string, unknown>, fullKey)
    }
    return [fullKey]
  })
}

describe('social i18n completeness', () => {
  it('pt-BR and en have identical key sets', () => {
    const ptKeys = flatKeys(ptBR as Record<string, unknown>).sort()
    const enKeys = flatKeys(en as Record<string, unknown>).sort()

    const missingInEn = ptKeys.filter(k => !enKeys.includes(k))
    const missingInPt = enKeys.filter(k => !ptKeys.includes(k))

    expect(missingInEn, 'Keys missing in en').toEqual([])
    expect(missingInPt, 'Keys missing in pt-BR').toEqual([])
  })
})
```

**Verify:**

```bash
npx vitest run apps/web/test/cms/social-i18n-completeness.test.ts
# Expected: 1 test passed
```

---

### Task 5.4: CSS tokens + animations (~1h)

**Modify:** `apps/web/src/app/globals.css`

- [ ] Add social-specific CSS custom properties if not already defined:

```css
/* Inside :root, [data-theme="dark"] block */
--social-ig-tint: #E8823C;
--social-ig-feed-tint: #C964A8;
--social-yt-tint: #E0574E;
--social-fb-tint: #5B7FD6;
```

- [ ] Add drawer slide-in animation (if `ab-drawer-in` not already defined):

```css
@keyframes social-drawer-in {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

@keyframes social-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] Verify existing `ab-fade-up` and `ab-drawer-in` keyframes can be reused (they should, as they were added in the AB Lab redesign)

**Verify:**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

---

### Task 5.5: Integration tests (~8h)

**Create:** `apps/web/test/integration/social-studio-rewrite.test.tsx`
**Create:** `apps/web/test/cms/social-compositor-flow.test.tsx`

- [ ] Hub integration: tabs switch correctly, URL state persists
- [ ] Feed: filter chips update URL, cards render with correct dest chips
- [ ] Calendar: week navigation works, events display with correct tints
- [ ] Queue: reorder persists via action, optimistic UI reverts on error
- [ ] Drafts: AI drafts show confidence, discard/review actions work
- [ ] Compositor: mode switch works, dest toggle/focus works, caption updates per dest
- [ ] PublishFlow: steps animate sequentially, results display per dest
- [ ] SchedulePanel: day/time selection, best-time dots render
- [ ] Canvas: ratio switch, new element creation, "Usar no post" returns design
- [ ] PostDetail drawer: opens from feed card, shows preview, footer actions by status
- [ ] Test all 9 new server actions with mock data

```typescript
// apps/web/test/cms/social-compositor-flow.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { useComposer } from '@/app/cms/(authed)/social/new/_components/use-composer'

describe('Compositor flow', () => {
  it('toggles destinations on/off', () => {
    const { result } = renderHook(() => useComposer('cms'))

    expect(result.current.destsOn.ig_story).toBe(true)
    expect(result.current.destsOn.ig_feed).toBe(false)

    act(() => result.current.toggleDest('ig_feed'))
    expect(result.current.destsOn.ig_feed).toBe(true)

    act(() => result.current.toggleDest('ig_story'))
    expect(result.current.destsOn.ig_story).toBe(false)
  })

  it('focuses destination updates focused state', () => {
    const { result } = renderHook(() => useComposer('cms'))

    expect(result.current.focused).toBe('ig_story')

    act(() => result.current.focusDest('yt_community'))
    expect(result.current.focused).toBe('yt_community')
  })

  it('captions are per-dest per-lang', () => {
    const { result } = renderHook(() => useComposer('cms'))

    act(() => result.current.setCaption('ig_story', 'pt', 'Ola'))
    act(() => result.current.setCaption('ig_story', 'en', 'Hello'))
    act(() => result.current.setCaption('fb_page', 'pt', 'Post FB'))

    expect(result.current.getCaption('ig_story', 'pt')).toBe('Ola')
    expect(result.current.getCaption('ig_story', 'en')).toBe('Hello')
    expect(result.current.getCaption('fb_page', 'pt')).toBe('Post FB')
    expect(result.current.getCaption('yt_community', 'pt')).toBe('')
  })

  it('activeDests reflects destsOn state', () => {
    const { result } = renderHook(() => useComposer('cms'))

    expect(result.current.activeDests).toContain('ig_story')
    expect(result.current.activeDests).not.toContain('ig_feed')

    act(() => result.current.toggleDest('ig_feed'))
    expect(result.current.activeDests).toContain('ig_feed')
  })
})
```

**Verify:**

```bash
npx vitest run apps/web/test/integration/social-studio-rewrite.test.tsx apps/web/test/cms/social-compositor-flow.test.tsx
# Expected: all tests passed
```

---

### Task 5.6: Visual review per screen (~4h)

- [ ] Hub Feed tab: cards render with 200px media, dest chips, status badges
- [ ] Hub Calendar tab: weekly grid with tinted events
- [ ] Hub Queue tab: draggable items, position numbers, keyboard support
- [ ] Hub Drafts tab: AI items with confidence badges, Cowork purple
- [ ] PostDetail drawer: slides in from right, 440px, focus trap works
- [ ] Compositor "Do CMS" mode: content picker, auto-fill flow
- [ ] Compositor "Em branco" mode: empty dest cards, caption editing
- [ ] Canvas editor: 6 ratios visible, new element types
- [ ] PublishFlow modal: step animation, per-dest results
- [ ] SchedulePanel: day/time chips, best-time dots
- [ ] Responsive: 1080px breakpoint, 760px CMS sidebar hidden
- [ ] Accessibility: tab navigation, aria attributes, focus trap

---

### Task 5.7: Final polish + full verification (~5h)

- [ ] Run complete test suite
- [ ] Typecheck entire app
- [ ] Build test (simulates Vercel)
- [ ] Fix any remaining issues
- [ ] Update any broken imports from removed/renamed components

```bash
# Full verification sequence
npm run build:packages
npm run test:web
npx tsc --noEmit -p apps/web/tsconfig.json
cd apps/web && npx next build
```

- [ ] Verify all existing social tests still pass (regression check)
- [ ] Verify no `any` types introduced
- [ ] Verify all new files are kebab-case
- [ ] Verify all new components are PascalCase

---

## Summary

| Phase | Tasks | New Files | Modified Files | Tests | Hours |
|-------|-------|-----------|---------------|-------|-------|
| 1: Foundation | 13 | ~12 | ~8 | ~40 scenarios | ~30h |
| 2: Hub | 8 | ~8 | ~5 | ~50 scenarios | ~28h |
| 3: Compositor | 11 | ~10 | ~3 | ~45 scenarios | ~24h |
| 4: Canvas | 6 | ~2 | ~4 | ~25 scenarios | ~16h |
| 5: Pipeline | 7 | ~5 | ~5 | ~40 scenarios | ~30h |
| **Total** | **45** | **~37** | **~25** | **~200** | **~128h** |

### Key dependencies between phases

- Phase 2 depends on Phase 1 (destinations, new actions, platform previews)
- Phase 3 depends on Phase 1 (destinations, AI actions) + Phase 2 (shared components)
- Phase 4 depends on Phase 1 (destinations for ratios) — can be parallelized with Phase 3
- Phase 5 depends on Phases 2+3 (PublishFlow needs compositor, cron needs actions)

### Files NOT touched (preserved as-is)

- `packages/social/` — providers remain unchanged
- `apps/web/src/lib/social/pipeline.ts` — reused
- `apps/web/src/lib/social/platform-prepare.ts` — reused
- `apps/web/src/lib/social/realtime.ts` — reused
- `apps/web/src/lib/social/token-refresh.ts` — reused
- All existing `supabase/migrations/` — only new ones added
- `apps/web/src/app/cms/(authed)/social/accounts/` — separate section, not in scope
- `apps/web/src/app/cms/(authed)/social/insights/` — separate section, not in scope
- `apps/web/src/app/cms/(authed)/social/stories/` — subsumed by new compositor with Story support
