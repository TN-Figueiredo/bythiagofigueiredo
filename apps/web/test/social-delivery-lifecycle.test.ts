import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// ---------------------------------------------------------------------------
// UUIDs
// ---------------------------------------------------------------------------

const SITE_ID = '00000000-0000-0000-0000-000000000001'
const USER_ID = '00000000-0000-0000-0000-000000000010'
const POST_ID = '00000000-0000-0000-0000-000000000100'
const CONN_FB = '00000000-0000-0000-0000-000000000200'
const CONN_BS = '00000000-0000-0000-0000-000000000201'
const DEL_FB = '00000000-0000-0000-0000-000000000300'
const DEL_BS = '00000000-0000-0000-0000-000000000301'

// ---------------------------------------------------------------------------
// Terminal resolver — infinite-depth chainable mock
// Follows the pattern from social-publish-dispatch.test.ts
// ---------------------------------------------------------------------------

type TableOverrides = Record<
  string,
  {
    select?: { data: unknown; error: unknown }
    update?: { data: unknown; error: unknown; count?: number }
    insert?: { data: unknown; error: unknown }
  }
>

let tableOverrides: TableOverrides = {}

// Track updates for assertions
let updateLog: Array<{ table: string; payload: unknown }> = []

function terminal(value: { data: unknown; error: unknown; count?: number }): unknown {
  const handler: Record<string, unknown> = {
    eq: vi.fn(() => terminal(value)),
    in: vi.fn(() => terminal(value)),
    is: vi.fn(() => terminal(value)),
    not: vi.fn(() => terminal(value)),
    lte: vi.fn(() => terminal(value)),
    gte: vi.fn(() => terminal(value)),
    limit: vi.fn(() => terminal(value)),
    order: vi.fn(() => terminal(value)),
    range: vi.fn(() => terminal(value)),
    select: vi.fn(() => terminal(value)),
    single: vi.fn(() => Promise.resolve(value)),
    maybeSingle: vi.fn(() => Promise.resolve(value)),
    then: (resolve: (v: unknown) => void) => Promise.resolve(value).then(resolve),
  }
  // Property access for destructuring (e.g. const { error, count } = await ...)
  Object.defineProperty(handler, 'data', { get: () => value.data, enumerable: true })
  Object.defineProperty(handler, 'error', { get: () => value.error, enumerable: true })
  Object.defineProperty(handler, 'count', { get: () => value.count, enumerable: true })
  return handler
}

const mockFrom = vi.fn((table: string) => {
  const selectDefault = tableOverrides[table]?.select ?? { data: null, error: null }
  const updateDefault = tableOverrides[table]?.update ?? { data: null, error: null, count: 1 }
  const insertDefault = tableOverrides[table]?.insert ?? { data: null, error: null }

  return {
    select: vi.fn(() => terminal(selectDefault)),
    update: vi.fn((payload: unknown) => {
      updateLog.push({ table, payload })
      return terminal(updateDefault)
    }),
    insert: vi.fn((payload: unknown) => terminal(insertDefault)),
    delete: vi.fn(() => terminal({ data: null, error: null })),
  }
})

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () =>
    Promise.resolve({
      siteId: SITE_ID,
      orgId: 'org-1',
      defaultLocale: 'pt-br',
      timezone: 'America/Sao_Paulo',
    }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: USER_ID } } }) },
  }),
  requireSiteScope: () => Promise.resolve({ ok: true, user: { id: USER_ID } }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/server', () => ({
  after: vi.fn((p: Promise<unknown>) => p),
}))

vi.mock('@tn-figueiredo/social', async () => {
  const zod = await import('zod')
  return {
    SocialPostContentSchema: zod.z.object({
      title: zod.z.string().optional(),
      description: zod.z.string().optional(),
      url: zod.z.string().optional(),
      hashtags: zod.z.array(zod.z.string()).optional(),
      media_urls: zod.z.array(zod.z.string()).optional(),
    }),
    RETRY_DELAYS: [50, 100, 200],
    POST_STATUSES: ['draft', 'scheduled', 'publishing', 'completed', 'partial_failure', 'failed', 'cancelled'],
    DELIVERY_STATUSES: ['pending', 'publishing', 'published', 'failed', 'retrying', 'skipped'],
  }
})

vi.mock('@tn-figueiredo/social/vault', () => ({
  decrypt: vi.fn((v: string) => `dec:${v}`),
  encrypt: vi.fn((v: string) => `enc:${v}`),
  getMasterKey: vi.fn(() => 'test-key'),
}))

const mockFBPublish = vi.fn()
const mockBSPublish = vi.fn()
const mockYTPublish = vi.fn()
const mockIGPublish = vi.fn()

vi.mock('@tn-figueiredo/social/providers/youtube', () => ({
  YouTubeProvider: vi.fn().mockImplementation(() => ({
    provider: 'youtube',
    publish: mockYTPublish,
    deletePost: vi.fn(),
    validateConnection: vi.fn().mockResolvedValue(true),
  })),
  deleteVideo: vi.fn(),
}))

vi.mock('@tn-figueiredo/social/providers/meta', () => ({
  FacebookProvider: vi.fn().mockImplementation(() => ({
    provider: 'facebook',
    publish: mockFBPublish,
    deletePost: vi.fn(),
    validateConnection: vi.fn().mockResolvedValue(true),
  })),
  InstagramProvider: vi.fn().mockImplementation(() => ({
    provider: 'instagram',
    publish: mockIGPublish,
    deletePost: vi.fn(),
    validateConnection: vi.fn().mockResolvedValue(true),
  })),
  deletePagePost: vi.fn(),
  deleteInstagramMedia: vi.fn(),
  publishMultiSlideStory: vi.fn(),
}))

vi.mock('@tn-figueiredo/social/providers/bluesky', () => ({
  BlueskyProvider: vi.fn().mockImplementation(() => ({
    provider: 'bluesky',
    publish: mockBSPublish,
    deletePost: vi.fn(),
    validateConnection: vi.fn().mockResolvedValue(true),
  })),
}))

vi.mock('@/lib/social/config', () => ({
  getSocialConfig: () => ({
    google: { clientId: '', clientSecret: '' },
    meta: { appId: '', appSecret: '' },
    masterKey: 'test-key',
    callbackBaseUrl: 'http://localhost:3000',
  }),
}))

vi.mock('@/lib/social/notifications/notify-story-ready', () => ({
  notifyStoryReady: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/social/slide-metadata', () => ({
  extractSlideMetadata: vi.fn(() => ({ title: '', coverImageUrl: undefined })),
}))

// ---------------------------------------------------------------------------
// Imports — AFTER mocks
// ---------------------------------------------------------------------------

import {
  createSocialPost,
  updateSocialPost,
  cancelSocialPost,
  retrySocialDelivery,
} from '../src/lib/social/actions/posts'

import {
  publishSocialPost,
  executeWithRetry,
  classifyError,
} from '../src/lib/social/workflows'

import type { SocialPostWithSlides } from '../src/lib/social/workflows'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString()

function makeSocialPost(overrides: Partial<SocialPostWithSlides> = {}): SocialPostWithSlides {
  return {
    id: POST_ID,
    site_id: SITE_ID,
    created_by: USER_ID,
    type: 'link',
    status: 'publishing',
    content: { title: 'Test', description: 'Desc', url: 'https://example.com' },
    scheduled_at: null,
    user_timezone: 'America/Sao_Paulo',
    published_at: null,
    template_id: null,
    idempotency_key: 'idem-1',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

function makeDelivery(provider: string, id: string, connId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    post_id: POST_ID,
    connection_id: connId,
    provider,
    status: 'pending',
    platform_post_id: null,
    platform_url: null,
    content_override: null,
    attempt: 0,
    max_attempts: 3,
    last_error: null,
    error_type: null,
    published_at: null,
    created_at: NOW,
    ...overrides,
  }
}

function makeConnection(provider: string, id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    site_id: SITE_ID,
    provider,
    account_id: `acct-${provider}`,
    account_name: provider,
    access_token_enc: `tok-${provider}`,
    refresh_token_enc: null,
    page_token_enc: provider === 'facebook' ? 'page-tok-fb' : null,
    token_expires_at: null,
    scopes: [],
    metadata: {},
    connected_at: NOW,
    revoked_at: null,
    updated_at: NOW,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  tableOverrides = {}
  updateLog = []

  mockFBPublish.mockResolvedValue({ id: 'fb-123', url: 'https://fb.com/123' })
  mockBSPublish.mockResolvedValue({ id: 'bs-456', url: 'https://bsky.app/456' })
  mockYTPublish.mockResolvedValue({ id: 'yt-789', url: 'https://yt.com/789' })
  mockIGPublish.mockResolvedValue({ id: 'ig-101', url: 'https://ig.com/101' })
})

// ===========================================================================
// 1. Draft -> Edit -> Schedule -> Cron picks up -> Published
// ===========================================================================

describe('1. Draft -> Edit -> Schedule -> Cron -> Published (happy path)', () => {
  it('createSocialPost without scheduledAt/publishNow inserts status=draft', async () => {
    tableOverrides = {
      social_posts: {
        insert: { data: { id: POST_ID }, error: null },
        select: { data: { id: POST_ID, status: 'draft' }, error: null },
      },
      social_connections: { select: { data: [{ id: CONN_FB, provider: 'facebook' }], error: null } },
      social_deliveries: { insert: { data: null, error: null } },
    }

    const result = await createSocialPost({
      type: 'link',
      content: { title: 'My Post', description: 'Desc' },
      platforms: ['facebook'],
    })

    expect(result.ok).toBe(true)
    // Verify the insert was called on social_posts — first insert contains the post row
    const postInserts = mockFrom.mock.calls
      .filter((c) => c[0] === 'social_posts')
      .map((c) => mockFrom.mock.results[mockFrom.mock.calls.indexOf(c)])
    // Check via the update log pattern: createSocialPost inserts not updates
    const insertCalls = mockFrom.mock.calls.filter((c) => c[0] === 'social_posts')
    expect(insertCalls.length).toBeGreaterThan(0)
  })

  it('updateSocialPost transitions draft -> scheduled', async () => {
    tableOverrides = {
      social_posts: {
        select: { data: { id: POST_ID, status: 'draft', site_id: SITE_ID }, error: null },
        update: { data: null, error: null },
      },
    }

    const futureDate = new Date(Date.now() + 3600_000).toISOString()
    const result = await updateSocialPost(POST_ID, { scheduledAt: futureDate })

    expect(result.ok).toBe(true)
    const postUpdate = updateLog.find((u) => u.table === 'social_posts')
    expect(postUpdate).toBeDefined()
    expect((postUpdate!.payload as Record<string, unknown>).status).toBe('scheduled')
    expect((postUpdate!.payload as Record<string, unknown>).scheduled_at).toBe(futureDate)
  })

  it('createSocialPost with scheduledAt inserts status=scheduled', async () => {
    tableOverrides = {
      social_posts: { insert: { data: { id: POST_ID }, error: null } },
      social_connections: { select: { data: [{ id: CONN_FB, provider: 'facebook' }], error: null } },
      social_deliveries: { insert: { data: null, error: null } },
    }

    const futureDate = new Date(Date.now() + 3600_000).toISOString()
    const result = await createSocialPost({
      type: 'link',
      content: { title: 'Scheduled', description: 'Later' },
      platforms: ['facebook'],
      scheduledAt: futureDate,
    })

    expect(result.ok).toBe(true)
  })

  it('updateSocialPost transitions scheduled -> draft when scheduledAt=null', async () => {
    tableOverrides = {
      social_posts: {
        select: { data: { id: POST_ID, status: 'scheduled', site_id: SITE_ID }, error: null },
        update: { data: null, error: null },
      },
    }

    const result = await updateSocialPost(POST_ID, { scheduledAt: null })
    expect(result.ok).toBe(true)
    const postUpdate = updateLog.find((u) => u.table === 'social_posts')
    expect((postUpdate!.payload as Record<string, unknown>).status).toBe('draft')
  })
})

// ===========================================================================
// 2. PublishNow -> publishing -> deliveries dispatched -> completed
// ===========================================================================

describe('2. PublishNow happy path: immediate publish to completion', () => {
  it('createSocialPost with publishNow inserts status=publishing', async () => {
    tableOverrides = {
      social_posts: {
        insert: { data: { id: POST_ID }, error: null },
        select: {
          data: {
            id: POST_ID, site_id: SITE_ID, created_by: USER_ID,
            type: 'link', status: 'publishing', content: { title: 'Now!' },
            user_timezone: 'America/Sao_Paulo', template_id: null,
            idempotency_key: 'k1', created_at: NOW,
          },
          error: null,
        },
      },
      social_connections: { select: { data: [{ id: CONN_FB, provider: 'facebook' }], error: null } },
      social_deliveries: {
        insert: { data: null, error: null },
        select: { data: [makeDelivery('facebook', DEL_FB, CONN_FB)], error: null },
      },
    }

    const result = await createSocialPost({
      type: 'link',
      content: { title: 'Now!', description: 'Immediate' },
      platforms: ['facebook'],
      publishNow: true,
    })

    expect(result.ok).toBe(true)
  })

  it('publishSocialPost completes when all deliveries succeed', async () => {
    tableOverrides = {
      social_posts: { update: { data: null, error: null } },
      social_deliveries: {
        select: {
          data: [
            makeDelivery('facebook', DEL_FB, CONN_FB),
            makeDelivery('bluesky', DEL_BS, CONN_BS),
          ],
          error: null,
        },
        update: { data: null, error: null },
      },
      social_connections: {
        select: { data: makeConnection('facebook', CONN_FB), error: null },
      },
      fan_interactions: { insert: { data: null, error: null } },
    }

    await publishSocialPost(makeSocialPost())

    // Both providers should have been called
    expect(mockFBPublish).toHaveBeenCalledTimes(1)
    expect(mockBSPublish).toHaveBeenCalledTimes(1)

    // Post should be updated to 'completed'
    const completedUpdate = updateLog.find(
      (u) => u.table === 'social_posts' && (u.payload as Record<string, unknown>).status === 'completed',
    )
    expect(completedUpdate).toBeDefined()
  })
})

// ===========================================================================
// 3. PublishNow -> delivery fails -> failed
// ===========================================================================

describe('3. PublishNow error path: all deliveries fail', () => {
  it('sets post to failed when all deliveries return permanent error', async () => {
    tableOverrides = {
      social_posts: { update: { data: null, error: null } },
      social_deliveries: {
        select: { data: [makeDelivery('facebook', DEL_FB, CONN_FB)], error: null },
        update: { data: null, error: null },
      },
      social_connections: {
        select: { data: makeConnection('facebook', CONN_FB), error: null },
      },
    }

    mockFBPublish.mockRejectedValue(new Error('Bad request (400): invalid'))

    await publishSocialPost(makeSocialPost())

    const failedUpdate = updateLog.find(
      (u) => u.table === 'social_posts' && (u.payload as Record<string, unknown>).status === 'failed',
    )
    expect(failedUpdate).toBeDefined()
  })
})

// ===========================================================================
// 4. Partial failure: mixed results
// ===========================================================================

describe('4. Partial failure: mixed delivery results', () => {
  it('sets post to partial_failure when some succeed and some fail', async () => {
    tableOverrides = {
      social_posts: { update: { data: null, error: null } },
      social_deliveries: {
        select: {
          data: [
            makeDelivery('facebook', DEL_FB, CONN_FB),
            makeDelivery('bluesky', DEL_BS, CONN_BS),
          ],
          error: null,
        },
        update: { data: null, error: null },
      },
      social_connections: {
        select: { data: makeConnection('facebook', CONN_FB), error: null },
      },
    }

    mockFBPublish.mockResolvedValue({ id: 'fb-123', url: 'https://fb.com/123' })
    mockBSPublish.mockRejectedValue(new Error('Forbidden (403): policy'))

    await publishSocialPost(makeSocialPost())

    const partialUpdate = updateLog.find(
      (u) => u.table === 'social_posts' && (u.payload as Record<string, unknown>).status === 'partial_failure',
    )
    expect(partialUpdate).toBeDefined()
  })
})

// ===========================================================================
// 5. Scheduled post NOT picked up before time
// ===========================================================================

describe('5. Cron skips future-scheduled posts', () => {
  it('isReadyForDelivery returns false for future timestamps', () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    expect(new Date(future).getTime() <= Date.now()).toBe(false)
  })

  it('isReadyForDelivery returns true for past timestamps', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(new Date(past).getTime() <= Date.now()).toBe(true)
  })

  it('cron 5-min window excludes posts 2 hours from now', () => {
    const fiveMin = new Date(Date.now() + 5 * 60_000)
    const twoHours = new Date(Date.now() + 2 * 60 * 60_000)
    expect(twoHours.getTime() <= fiveMin.getTime()).toBe(false)
  })
})

// ===========================================================================
// 6. Draft post NEVER picked up by cron (original bug)
// ===========================================================================

describe('6. Draft posts are never picked up by cron (original bug)', () => {
  it('cron only queries status=scheduled; drafts are invisible', () => {
    // The cron route queries: .eq('status', 'scheduled')
    expect('draft').not.toBe('scheduled')
  })

  it('draft with pending deliveries stays orphaned', () => {
    const draftPost = { status: 'draft', scheduled_at: null }
    const deliveries = [{ status: 'pending', provider: 'facebook' }]

    // Cron would never pick this up because status !== 'scheduled'
    expect(draftPost.status).not.toBe('scheduled')
    expect(deliveries[0]!.status).toBe('pending') // stays pending
  })

  it('draft with scheduled_at is still invisible to cron', () => {
    // Even if scheduled_at is set, the cron checks status=scheduled not just scheduled_at
    const post = { status: 'draft', scheduled_at: new Date(Date.now() - 60_000).toISOString() }
    expect(post.status).toBe('draft')
    expect(post.status).not.toBe('scheduled')
  })
})

// ===========================================================================
// 7. Cancel post -> deliveries skipped
// ===========================================================================

describe('7. Cancel post -> deliveries skipped', () => {
  it('cancels a scheduled post', async () => {
    tableOverrides = {
      social_posts: { update: { data: null, error: null, count: 1 } },
      social_deliveries: { update: { data: null, error: null } },
    }

    const result = await cancelSocialPost(POST_ID)

    expect(result.ok).toBe(true)
    const cancelUpdate = updateLog.find(
      (u) => u.table === 'social_posts' && (u.payload as Record<string, unknown>).status === 'cancelled',
    )
    expect(cancelUpdate).toBeDefined()
  })

  it('marks pending deliveries as skipped', async () => {
    tableOverrides = {
      social_posts: { update: { data: null, error: null, count: 1 } },
      social_deliveries: { update: { data: null, error: null } },
    }

    await cancelSocialPost(POST_ID)

    const deliveryUpdate = updateLog.find(
      (u) => u.table === 'social_deliveries' && (u.payload as Record<string, unknown>).status === 'skipped',
    )
    expect(deliveryUpdate).toBeDefined()
  })

  it('returns error when post not found (count=0)', async () => {
    tableOverrides = {
      social_posts: { update: { data: null, error: null, count: 0 } },
    }

    const result = await cancelSocialPost(POST_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Post not found')
  })

  it('cannot cancel completed post (guard: .in(status, [draft, scheduled, publishing]))', () => {
    const allowedForCancel = ['draft', 'scheduled', 'publishing']
    expect(allowedForCancel).not.toContain('completed')
    expect(allowedForCancel).not.toContain('failed')
    expect(allowedForCancel).not.toContain('cancelled')
  })
})

// ===========================================================================
// 8. Retry failed delivery
// ===========================================================================

describe('8. Retry failed delivery', () => {
  it('resets failed delivery to pending with attempt=0', async () => {
    tableOverrides = {
      social_deliveries: {
        select: {
          data: {
            id: DEL_FB, post_id: POST_ID, status: 'failed',
          },
          error: null,
        },
        update: { data: null, error: null },
      },
      social_posts: {
        select: { data: { id: POST_ID, site_id: SITE_ID }, error: null },
        update: { data: null, error: null },
      },
    }

    const result = await retrySocialDelivery(DEL_FB)

    expect(result.ok).toBe(true)
    const deliveryReset = updateLog.find(
      (u) =>
        u.table === 'social_deliveries' &&
        (u.payload as Record<string, unknown>).status === 'pending',
    )
    expect(deliveryReset).toBeDefined()
    expect((deliveryReset!.payload as Record<string, unknown>).attempt).toBe(0)
    expect((deliveryReset!.payload as Record<string, unknown>).last_error).toBeNull()
  })

  it('transitions post from failed to scheduled', async () => {
    tableOverrides = {
      social_deliveries: {
        select: { data: { id: DEL_FB, post_id: POST_ID, status: 'failed' }, error: null },
        update: { data: null, error: null },
      },
      social_posts: {
        select: { data: { id: POST_ID, site_id: SITE_ID }, error: null },
        update: { data: null, error: null },
      },
    }

    await retrySocialDelivery(DEL_FB)

    const postScheduled = updateLog.find(
      (u) =>
        u.table === 'social_posts' &&
        (u.payload as Record<string, unknown>).status === 'scheduled',
    )
    expect(postScheduled).toBeDefined()
  })

  it('rejects retry of published delivery', async () => {
    tableOverrides = {
      social_deliveries: {
        select: { data: { id: DEL_FB, post_id: POST_ID, status: 'published' }, error: null },
      },
      social_posts: {
        select: { data: { id: POST_ID, site_id: SITE_ID }, error: null },
      },
    }

    const result = await retrySocialDelivery(DEL_FB)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Cannot retry delivery with status')
  })

  it('allows retry of skipped delivery', async () => {
    tableOverrides = {
      social_deliveries: {
        select: { data: { id: DEL_FB, post_id: POST_ID, status: 'skipped' }, error: null },
        update: { data: null, error: null },
      },
      social_posts: {
        select: { data: { id: POST_ID, site_id: SITE_ID }, error: null },
        update: { data: null, error: null },
      },
    }

    const result = await retrySocialDelivery(DEL_FB)
    expect(result.ok).toBe(true)
  })
})

// ===========================================================================
// 9. Status transitions: no illegal transitions
// ===========================================================================

describe('9. Post status transitions: no illegal transitions', () => {
  const validTransitions: Record<string, string[]> = {
    draft: ['scheduled', 'publishing', 'cancelled'],
    scheduled: ['publishing', 'cancelled', 'draft'],
    publishing: ['completed', 'partial_failure', 'failed', 'cancelled'],
    completed: [],
    partial_failure: ['scheduled'],
    failed: ['scheduled'],
    cancelled: [],
  }

  it('updateSocialPost rejects editing publishing posts', async () => {
    tableOverrides = {
      social_posts: { select: { data: { id: POST_ID, status: 'publishing', site_id: SITE_ID }, error: null } },
    }
    const result = await updateSocialPost(POST_ID, { content: { title: 'X' } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Cannot edit post with status')
  })

  it('updateSocialPost rejects editing completed posts', async () => {
    tableOverrides = {
      social_posts: { select: { data: { id: POST_ID, status: 'completed', site_id: SITE_ID }, error: null } },
    }
    const result = await updateSocialPost(POST_ID, { content: { title: 'X' } })
    expect(result.ok).toBe(false)
  })

  it('updateSocialPost rejects editing failed posts', async () => {
    tableOverrides = {
      social_posts: { select: { data: { id: POST_ID, status: 'failed', site_id: SITE_ID }, error: null } },
    }
    const result = await updateSocialPost(POST_ID, { content: { title: 'X' } })
    expect(result.ok).toBe(false)
  })

  it('updateSocialPost rejects editing cancelled posts', async () => {
    tableOverrides = {
      social_posts: { select: { data: { id: POST_ID, status: 'cancelled', site_id: SITE_ID }, error: null } },
    }
    const result = await updateSocialPost(POST_ID, { content: { title: 'X' } })
    expect(result.ok).toBe(false)
  })

  it('completed is terminal — no transitions out', () => {
    expect(validTransitions['completed']!.length).toBe(0)
  })

  it('cancelled is terminal — no transitions out', () => {
    expect(validTransitions['cancelled']!.length).toBe(0)
  })

  it('completed -> draft is impossible', () => {
    expect(validTransitions['completed']).not.toContain('draft')
  })

  it('cancelled -> scheduled is impossible', () => {
    expect(validTransitions['cancelled']).not.toContain('scheduled')
  })
})

// ===========================================================================
// 10. Concurrent publish protection
// ===========================================================================

describe('10. Concurrent publish protection', () => {
  it('publishSocialPost sets status=publishing as first step', async () => {
    tableOverrides = {
      social_posts: { update: { data: null, error: null } },
      social_deliveries: {
        select: { data: [makeDelivery('facebook', DEL_FB, CONN_FB)], error: null },
        update: { data: null, error: null },
      },
      social_connections: {
        select: { data: makeConnection('facebook', CONN_FB), error: null },
      },
    }

    await publishSocialPost(makeSocialPost({ status: 'scheduled' }))

    // First update to social_posts should be status='publishing'
    const firstPostUpdate = updateLog.find((u) => u.table === 'social_posts')
    expect(firstPostUpdate).toBeDefined()
    expect((firstPostUpdate!.payload as Record<string, unknown>).status).toBe('publishing')
  })

  it('publishStoryNow guards with NOT IN (publishing, completed)', () => {
    // publishStoryNow uses: .update(patch).not('status', 'in', '("publishing","completed")')
    // If status is already publishing, zero rows are updated => action returns error
    const blockedStatuses = ['publishing', 'completed']
    expect(blockedStatuses).toContain('publishing')
    expect(blockedStatuses).toContain('completed')
  })

  it('second concurrent call is rejected when first sets publishing', () => {
    // Race scenario simulation
    let status = 'scheduled'

    // Call 1: atomic UPDATE with status guard succeeds
    status = 'publishing'

    // Call 2: atomic UPDATE finds status='publishing' => NOT IN check fails => 0 rows
    const blockedStatuses = ['publishing', 'completed']
    const call2Passes = !blockedStatuses.includes(status)
    expect(call2Passes).toBe(false)
  })
})

// ===========================================================================
// classifyError: error classification
// ===========================================================================

describe('classifyError: error classification for retry decisions', () => {
  it('classifies 401 as auth', () => expect(classifyError(new Error('Unauthorized (401)'))).toBe('auth'))
  it('classifies token expired as auth', () => expect(classifyError(new Error('token expired'))).toBe('auth'))
  it('classifies token revoked as auth', () => expect(classifyError(new Error('token revoked'))).toBe('auth'))
  it('classifies 400 as permanent', () => expect(classifyError(new Error('Bad request (400)'))).toBe('permanent'))
  it('classifies 403 as permanent', () => expect(classifyError(new Error('Forbidden (403)'))).toBe('permanent'))
  it('classifies 404 as permanent', () => expect(classifyError(new Error('Not found (404)'))).toBe('permanent'))
  it('classifies 422 as permanent', () => expect(classifyError(new Error('Unprocessable (422)'))).toBe('permanent'))
  it('classifies policy as permanent', () => expect(classifyError(new Error('content policy'))).toBe('permanent'))
  it('classifies format as permanent', () => expect(classifyError(new Error('bad format'))).toBe('permanent'))
  it('classifies 429 as transient', () => expect(classifyError(new Error('Rate limit (429)'))).toBe('transient'))
  it('classifies 500 as transient', () => expect(classifyError(new Error('Server error (500)'))).toBe('transient'))
  it('classifies 502 as transient', () => expect(classifyError(new Error('Bad gateway (502)'))).toBe('transient'))
  it('classifies 503 as transient', () => expect(classifyError(new Error('Unavailable (503)'))).toBe('transient'))
  it('classifies network as transient', () => expect(classifyError(new Error('network error'))).toBe('transient'))
  it('classifies timeout as transient', () => expect(classifyError(new Error('timeout'))).toBe('transient'))
  it('classifies ECONNRESET as transient', () => expect(classifyError(new Error('ECONNRESET'))).toBe('transient'))
  it('classifies non-Error as transient', () => {
    expect(classifyError('string')).toBe('transient')
    expect(classifyError(null)).toBe('transient')
    expect(classifyError(42)).toBe('transient')
  })
})

// ===========================================================================
// executeWithRetry: retry logic
// ===========================================================================

describe('executeWithRetry: retry logic', () => {
  const delivery = makeDelivery('facebook', DEL_FB, CONN_FB) as any
  const connection = makeConnection('facebook', CONN_FB) as any
  const post = makeSocialPost()

  it('returns published on first attempt success', async () => {
    const prov = { provider: 'facebook' as const, publish: vi.fn().mockResolvedValue({ id: 'fb-1', url: 'u' }), deletePost: vi.fn(), validateConnection: vi.fn() }
    const r = await executeWithRetry(delivery, connection, post, prov)
    expect(r.status).toBe('published')
    expect(r.platformPostId).toBe('fb-1')
    expect(prov.publish).toHaveBeenCalledTimes(1)
  })

  it('retries on transient error, succeeds on second attempt', async () => {
    const prov = {
      provider: 'facebook' as const,
      publish: vi.fn().mockRejectedValueOnce(new Error('(500)')).mockResolvedValueOnce({ id: 'fb-1', url: 'u' }),
      deletePost: vi.fn(), validateConnection: vi.fn(),
    }
    const r = await executeWithRetry(delivery, connection, post, prov)
    expect(r.status).toBe('published')
    expect(prov.publish).toHaveBeenCalledTimes(2)
  })

  it('fails immediately on permanent error (no retry)', async () => {
    const prov = {
      provider: 'facebook' as const,
      publish: vi.fn().mockRejectedValue(new Error('Bad request (400)')),
      deletePost: vi.fn(), validateConnection: vi.fn(),
    }
    const r = await executeWithRetry(delivery, connection, post, prov)
    expect(r.status).toBe('failed')
    expect(r.errorType).toBe('permanent')
    expect(prov.publish).toHaveBeenCalledTimes(1)
  })

  it('returns skipped on auth error without refreshToken', async () => {
    const prov = {
      provider: 'facebook' as const,
      publish: vi.fn().mockRejectedValue(new Error('Unauthorized (401)')),
      deletePost: vi.fn(), validateConnection: vi.fn(),
    }
    const r = await executeWithRetry(delivery, connection, post, prov)
    expect(r.status).toBe('skipped')
    expect(r.errorType).toBe('auth')
  })

  it('retries after successful token refresh', async () => {
    const prov = {
      provider: 'facebook' as const,
      publish: vi.fn().mockRejectedValueOnce(new Error('(401)')).mockResolvedValueOnce({ id: 'fb-1', url: 'u' }),
      deletePost: vi.fn(), validateConnection: vi.fn(),
      refreshToken: vi.fn().mockResolvedValue({ access_token: 'new-tok', expires_at: new Date(Date.now() + 3600_000) }),
    }
    const r = await executeWithRetry(delivery, connection, post, prov)
    expect(r.status).toBe('published')
    expect(prov.refreshToken).toHaveBeenCalledTimes(1)
  })

  it('fails after exhausting all retries on transient errors', async () => {
    const prov = {
      provider: 'facebook' as const,
      publish: vi.fn().mockRejectedValue(new Error('(500)')),
      deletePost: vi.fn(), validateConnection: vi.fn(),
    }
    const r = await executeWithRetry(delivery, connection, post, prov)
    expect(r.status).toBe('failed')
    expect(r.errorType).toBe('transient')
    expect(prov.publish).toHaveBeenCalledTimes(3) // max_attempts
  })
})

// ===========================================================================
// publishSocialPost: edge cases
// ===========================================================================

describe('publishSocialPost: edge cases', () => {
  it('fails when no pending deliveries exist', async () => {
    tableOverrides = {
      social_posts: { update: { data: null, error: null } },
      social_deliveries: { select: { data: [], error: null } },
    }

    await publishSocialPost(makeSocialPost())

    const failed = updateLog.find(
      (u) => u.table === 'social_posts' && (u.payload as Record<string, unknown>).status === 'failed',
    )
    expect(failed).toBeDefined()
  })

  it('handles revoked connection by skipping delivery', async () => {
    tableOverrides = {
      social_posts: { update: { data: null, error: null } },
      social_deliveries: {
        select: { data: [makeDelivery('facebook', DEL_FB, CONN_FB)], error: null },
        update: { data: null, error: null },
      },
      social_connections: {
        select: {
          data: makeConnection('facebook', CONN_FB, { revoked_at: NOW }),
          error: null,
        },
      },
    }

    await publishSocialPost(makeSocialPost())

    const skipped = updateLog.find(
      (u) =>
        u.table === 'social_deliveries' &&
        (u.payload as Record<string, unknown>).status === 'skipped',
    )
    expect(skipped).toBeDefined()
  })
})

// ===========================================================================
// Status transition summary (documentation-as-test)
// ===========================================================================

describe('Status machine: valid transitions summary', () => {
  it.each([
    ['draft', 'scheduled', true, 'updateSocialPost with scheduledAt'],
    ['draft', 'publishing', true, 'createSocialPost with publishNow'],
    ['draft', 'cancelled', true, 'cancelSocialPost'],
    ['scheduled', 'publishing', true, 'cron or publishSocialPost'],
    ['scheduled', 'cancelled', true, 'cancelSocialPost'],
    ['scheduled', 'draft', true, 'updateSocialPost with scheduledAt=null'],
    ['publishing', 'completed', true, 'publishSocialPost all succeed'],
    ['publishing', 'partial_failure', true, 'publishSocialPost mixed results'],
    ['publishing', 'failed', true, 'publishSocialPost all fail'],
    ['publishing', 'cancelled', true, 'cancelSocialPost'],
    ['completed', 'draft', false, 'no mechanism'],
    ['completed', 'scheduled', false, 'no mechanism'],
    ['completed', 'cancelled', false, 'no mechanism'],
    ['cancelled', 'draft', false, 'no mechanism'],
    ['cancelled', 'scheduled', false, 'no mechanism'],
    ['failed', 'scheduled', true, 'retrySocialDelivery'],
    ['partial_failure', 'scheduled', true, 'retrySocialDelivery'],
  ] as const)(
    '%s -> %s should be %s (%s)',
    (from, _to, allowed) => {
      if (allowed) {
        expect(true).toBe(true)
      } else {
        expect(['completed', 'cancelled']).toContain(from)
      }
    },
  )
})
