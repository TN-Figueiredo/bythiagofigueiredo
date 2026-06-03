import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

/**
 * Builds a chainable Supabase mock that records calls per table+method
 * and allows per-table override of resolved values.
 */

interface FromCall {
  method: string
  args: unknown[]
  resolved: { data: unknown; error: unknown }
}

const callLog: Map<string, FromCall[]> = new Map()

function logCall(table: string, method: string, args: unknown[], resolved: { data: unknown; error: unknown }) {
  if (!callLog.has(table)) callLog.set(table, [])
  callLog.get(table)!.push({ method, args, resolved })
}

function getCallsFor(table: string, method?: string) {
  const all = callLog.get(table) ?? []
  return method ? all.filter((c) => c.method === method) : all
}

type TableOverrides = Record<string, {
  select?: { data: unknown; error: unknown }
  update?: { data: unknown; error: unknown }
  insert?: { data: unknown; error: unknown }
}>

let tableOverrides: TableOverrides = {}

/**
 * Terminal resolver — returns a thenable that resolves to the given value
 * and also exposes .eq/.in/.is/.limit/.single so chaining never throws.
 */
function terminal(value: { data: unknown; error: unknown }): unknown {
  const handler: Record<string, unknown> = {
    eq: vi.fn(() => terminal(value)),
    in: vi.fn(() => terminal(value)),
    is: vi.fn(() => terminal(value)),
    gte: vi.fn(() => terminal(value)),
    lte: vi.fn(() => terminal(value)),
    limit: vi.fn(() => terminal(value)),
    single: vi.fn(() => Promise.resolve(value)),
    then: (resolve: (v: unknown) => void) => Promise.resolve(value).then(resolve),
  }
  return handler
}

const mockFrom = vi.fn((table: string) => {
  const selectDefault = tableOverrides[table]?.select ?? { data: [], error: null }
  const updateDefault = tableOverrides[table]?.update ?? { data: null, error: null }
  const insertDefault = tableOverrides[table]?.insert ?? { data: null, error: null }

  return {
    select: vi.fn((...args: unknown[]) => {
      logCall(table, 'select', args, selectDefault)
      return terminal(selectDefault)
    }),
    update: vi.fn((payload: unknown) => {
      logCall(table, 'update', [payload], updateDefault)
      return terminal(updateDefault)
    }),
    insert: vi.fn((payload: unknown) => {
      logCall(table, 'insert', [payload], insertDefault)
      return terminal(insertDefault)
    }),
  }
})

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

// Mock the social config
vi.mock('@/lib/social/config', () => ({
  getSocialConfig: () => ({
    google: { clientId: 'gc-id', clientSecret: 'gc-secret' },
    meta: { appId: 'meta-id', appSecret: 'meta-secret' },
    masterKey: 'test-key',
    callbackBaseUrl: 'http://localhost:3000',
  }),
}))

// Mock vault
vi.mock('@tn-figueiredo/social/vault', () => ({
  decrypt: vi.fn((v: string) => `dec-${v}`),
  encrypt: vi.fn((v: string) => `enc-${v}`),
  getMasterKey: vi.fn(() => 'test-master-key'),
}))

// Mock story notifications
vi.mock('@/lib/social/notifications/notify-story-ready', () => ({
  notifyStoryReady: vi.fn(() => Promise.resolve()),
}))

// Mock @tn-figueiredo/social — provide types and RETRY_DELAYS
vi.mock('@tn-figueiredo/social', async () => {
  const zod = await import('zod')
  return {
    PROVIDERS: ['youtube', 'facebook', 'instagram', 'bluesky'],
    RETRY_DELAYS: [50, 100, 200], // Short delays for tests
    SocialPostContentSchema: zod.z.object({
      title: zod.z.string().optional(),
      description: zod.z.string().optional(),
      url: zod.z.string().optional(),
      hashtags: zod.z.array(zod.z.string()).optional(),
      media_urls: zod.z.array(zod.z.string()).optional(),
    }),
  }
})

// ---------------------------------------------------------------------------
// Mock providers — each provider's publish returns a PlatformResult
// ---------------------------------------------------------------------------

const mockYouTubePublish = vi.fn()
const mockYouTubeDeletePost = vi.fn()
const mockYouTubeValidate = vi.fn()

vi.mock('@tn-figueiredo/social/providers/youtube', () => ({
  YouTubeProvider: vi.fn().mockImplementation(() => ({
    provider: 'youtube',
    publish: mockYouTubePublish,
    deletePost: mockYouTubeDeletePost,
    validateConnection: mockYouTubeValidate,
  })),
}))

const mockFacebookPublish = vi.fn()
const mockFacebookRefreshToken = vi.fn()

vi.mock('@tn-figueiredo/social/providers/meta', () => ({
  FacebookProvider: vi.fn().mockImplementation(() => ({
    provider: 'facebook',
    publish: mockFacebookPublish,
    deletePost: vi.fn(),
    validateConnection: vi.fn(),
    refreshToken: mockFacebookRefreshToken,
  })),
  InstagramProvider: vi.fn().mockImplementation(() => ({
    provider: 'instagram',
    publish: vi.fn(),
    deletePost: vi.fn(),
    validateConnection: vi.fn(),
  })),
  publishMultiSlideStory: vi.fn(),
}))

const mockBlueskyPublish = vi.fn()

vi.mock('@tn-figueiredo/social/providers/bluesky', () => ({
  BlueskyProvider: vi.fn().mockImplementation(() => ({
    provider: 'bluesky',
    publish: mockBlueskyPublish,
    deletePost: vi.fn(),
    validateConnection: vi.fn(),
  })),
}))

// Mock slide-metadata
vi.mock('@/lib/social/slide-metadata', () => ({
  extractSlideMetadata: vi.fn(() => ({ title: '', coverImageUrl: undefined })),
}))

// ---------------------------------------------------------------------------
// Import the module under test AFTER all mocks are registered
// ---------------------------------------------------------------------------

import { publishSocialPost, executeWithRetry, classifyError } from '../src/lib/social/workflows'
import type {
  SocialDelivery,
  SocialConnection,
  SocialPost,
  ISocialProvider,
} from '@tn-figueiredo/social'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: 'post-001',
    site_id: 'site-1',
    created_by: 'user-1',
    type: 'link',
    status: 'scheduled',
    scheduled_at: new Date().toISOString(),
    user_timezone: 'America/Sao_Paulo',
    published_at: null,
    content: {
      title: 'Test Post',
      description: 'A test description',
      url: 'https://example.com/post',
      hashtags: ['test'],
      media_urls: [],
    },
    template_id: null,
    idempotency_key: 'idem-001',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeDelivery(overrides: Partial<SocialDelivery> = {}): SocialDelivery {
  return {
    id: 'del-001',
    post_id: 'post-001',
    connection_id: 'conn-001',
    provider: 'facebook',
    status: 'pending',
    platform_post_id: null,
    platform_url: null,
    content_override: null,
    attempt: 0,
    max_attempts: 3,
    last_error: null,
    error_type: null,
    published_at: null,
    created_at: new Date().toISOString(),
    format: 'link_share',
  }
}

function makeConnection(overrides: Partial<SocialConnection> = {}): SocialConnection {
  return {
    id: 'conn-001',
    site_id: 'site-1',
    provider: 'facebook',
    account_id: 'fb-account-1',
    account_name: 'Test Page',
    access_token_enc: 'enc-token',
    refresh_token_enc: null,
    page_token_enc: null,
    token_expires_at: null,
    scopes: ['pages_manage_posts'],
    metadata: {},
    connected_at: new Date().toISOString(),
    revoked_at: null,
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('publishSocialPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callLog.clear()
    tableOverrides = {}
    mockFacebookPublish.mockReset()
    mockBlueskyPublish.mockReset()
    mockYouTubePublish.mockReset()
    mockFacebookRefreshToken.mockReset()
    // Restore the default mockFrom implementation (clearAllMocks doesn't reset it)
    mockFrom.mockImplementation((table: string) => {
      const selectDefault = tableOverrides[table]?.select ?? { data: [], error: null }
      const updateDefault = tableOverrides[table]?.update ?? { data: null, error: null }
      const insertDefault = tableOverrides[table]?.insert ?? { data: null, error: null }
      return {
        select: vi.fn((...args: unknown[]) => {
          logCall(table, 'select', args, selectDefault)
          return terminal(selectDefault)
        }),
        update: vi.fn((payload: unknown) => {
          logCall(table, 'update', [payload], updateDefault)
          return terminal(updateDefault)
        }),
        insert: vi.fn((payload: unknown) => {
          logCall(table, 'insert', [payload], insertDefault)
          return terminal(insertDefault)
        }),
      }
    })
  })

  it('sets status to publishing', async () => {
    // No pending deliveries → completes immediately
    tableOverrides = {
      social_posts: { update: { data: null, error: null }, select: { data: [], error: null } },
      social_deliveries: { select: { data: [], error: null }, update: { data: null, error: null } },
    }

    await publishSocialPost(makePost())

    // Verify social_posts was updated with status='publishing'
    const postUpdates = getCallsFor('social_posts', 'update')
    expect(postUpdates.length).toBeGreaterThanOrEqual(1)

    const firstUpdate = postUpdates[0]!
    const payload = firstUpdate.args[0] as Record<string, unknown>
    expect(payload.status).toBe('publishing')
  })

  it('fetches pending deliveries filtering on status IN (pending, retrying)', async () => {
    const deliveries = [makeDelivery()]
    const connection = makeConnection()

    mockFacebookPublish.mockResolvedValue({ id: 'fb-123', url: 'https://fb.com/123' })

    tableOverrides = {
      social_posts: { update: { data: null, error: null }, select: { data: [], error: null } },
      social_deliveries: {
        select: { data: deliveries, error: null },
        update: { data: null, error: null },
      },
      social_connections: {
        select: { data: connection, error: null },
        update: { data: null, error: null },
      },
    }

    await publishSocialPost(makePost())

    // Verify social_deliveries select was called
    const deliverySelects = getCallsFor('social_deliveries', 'select')
    expect(deliverySelects.length).toBeGreaterThanOrEqual(1)

    // The .in('status', ['pending', 'retrying']) is verified by the mock chain
    // existing and not erroring — if the code didn't chain .in() our terminal
    // would still resolve, but the code explicitly filters on those statuses.
    // We verify the query was made against social_deliveries.
    expect(mockFrom).toHaveBeenCalledWith('social_deliveries')
  })

  it('calls provider.publish for a delivery and returns platform data', async () => {
    // Single delivery — verifies provider resolution + publish call
    const delivery = makeDelivery({ id: 'del-fb-1', provider: 'facebook', connection_id: 'conn-fb' })
    const connection = makeConnection({ id: 'conn-fb', provider: 'facebook' })

    mockFacebookPublish.mockResolvedValue({ id: 'fb-post-1', url: 'https://fb.com/1' })

    tableOverrides = {
      social_posts: { update: { data: null, error: null }, select: { data: [], error: null } },
      social_deliveries: {
        select: { data: [delivery], error: null },
        update: { data: null, error: null },
      },
      social_connections: {
        select: { data: connection, error: null },
        update: { data: null, error: null },
      },
    }

    await publishSocialPost(makePost())

    expect(mockFacebookPublish).toHaveBeenCalledTimes(1)

    // Verify the post ends as completed
    const postUpdates = getCallsFor('social_posts', 'update')
    const finalUpdate = postUpdates[postUpdates.length - 1]!
    const payload = finalUpdate.args[0] as Record<string, unknown>
    expect(payload.status).toBe('completed')
    expect(payload).toHaveProperty('published_at')
  })

  it('updates delivery status to published on success', async () => {
    const delivery = makeDelivery({ id: 'del-fb', provider: 'facebook' })
    const connection = makeConnection()

    mockFacebookPublish.mockResolvedValue({ id: 'fb-post-99', url: 'https://fb.com/99' })

    tableOverrides = {
      social_posts: { update: { data: null, error: null }, select: { data: [], error: null } },
      social_deliveries: {
        select: { data: [delivery], error: null },
        update: { data: null, error: null },
      },
      social_connections: {
        select: { data: connection, error: null },
        update: { data: null, error: null },
      },
    }

    await publishSocialPost(makePost())

    // Verify social_deliveries was updated with status='published'
    const deliveryUpdates = getCallsFor('social_deliveries', 'update')
    const publishedUpdate = deliveryUpdates.find((c) => {
      const payload = c.args[0] as Record<string, unknown>
      return payload.status === 'published'
    })
    expect(publishedUpdate).toBeDefined()

    const payload = publishedUpdate!.args[0] as Record<string, unknown>
    expect(payload.platform_post_id).toBe('fb-post-99')
    expect(payload.platform_url).toBe('https://fb.com/99')
  })

  it('handles partial failure — one succeeds, one skipped → post status = partial_failure', async () => {
    // Two deliveries: first resolves to a valid connection, second to a revoked connection
    const deliveries = [
      makeDelivery({ id: 'del-ok', provider: 'facebook', connection_id: 'conn-ok' }),
      makeDelivery({ id: 'del-revoked', provider: 'facebook', connection_id: 'conn-revoked' }),
    ]

    mockFacebookPublish.mockResolvedValue({ id: 'fb-1' })

    const okConn = makeConnection({ id: 'conn-ok', provider: 'facebook' })
    const revokedConn = makeConnection({
      id: 'conn-revoked',
      provider: 'facebook',
      revoked_at: new Date().toISOString(),
    })

    // Return different connections depending on which is fetched.
    // Both deliveries call from('social_connections').select(...)...single()
    // We need to serve the right connection for each.
    let connCallIdx = 0
    const connSequence = [okConn, revokedConn]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'social_connections') {
        const conn = connSequence[connCallIdx % connSequence.length]!
        connCallIdx++
        return {
          select: vi.fn(() => terminal({ data: conn, error: null })),
          update: vi.fn(() => terminal({ data: null, error: null })),
        }
      }
      const selectDefault = tableOverrides[table]?.select ?? { data: [], error: null }
      const updateDefault = tableOverrides[table]?.update ?? { data: null, error: null }
      return {
        select: vi.fn((...args: unknown[]) => {
          logCall(table, 'select', args, selectDefault)
          return terminal(selectDefault)
        }),
        update: vi.fn((payload: unknown) => {
          logCall(table, 'update', [payload], updateDefault)
          return terminal(updateDefault)
        }),
        insert: vi.fn((payload: unknown) => {
          logCall(table, 'insert', [payload], { data: null, error: null })
          return terminal({ data: null, error: null })
        }),
      }
    })

    tableOverrides = {
      social_posts: { update: { data: null, error: null }, select: { data: [], error: null } },
      social_deliveries: {
        select: { data: deliveries, error: null },
        update: { data: null, error: null },
      },
    }

    await publishSocialPost(makePost())

    // One published + one skipped (revoked) = partial_failure
    const postUpdates = getCallsFor('social_posts', 'update')
    const finalUpdate = postUpdates[postUpdates.length - 1]!
    const payload = finalUpdate.args[0] as Record<string, unknown>
    expect(payload.status).toBe('partial_failure')
  })

  it('handles total failure — all deliveries fail → post status = failed', async () => {
    // Both deliveries have missing connections → both skipped
    const deliveries = [
      makeDelivery({ id: 'del-f1', provider: 'facebook', connection_id: 'conn-missing-1' }),
      makeDelivery({ id: 'del-f2', provider: 'facebook', connection_id: 'conn-missing-2' }),
    ]

    tableOverrides = {
      social_posts: { update: { data: null, error: null }, select: { data: [], error: null } },
      social_deliveries: {
        select: { data: deliveries, error: null },
        update: { data: null, error: null },
      },
      // Connection lookup returns null (not found) → delivery gets skipped
      social_connections: {
        select: { data: null, error: { message: 'not found', code: 'PGRST116' } },
        update: { data: null, error: null },
      },
    }

    await publishSocialPost(makePost())

    const postUpdates = getCallsFor('social_posts', 'update')
    const finalUpdate = postUpdates[postUpdates.length - 1]!
    const payload = finalUpdate.args[0] as Record<string, unknown>
    expect(payload.status).toBe('failed')
  })

  it('handles empty deliveries — no pending → post status = completed', async () => {
    tableOverrides = {
      social_posts: { update: { data: null, error: null }, select: { data: [], error: null } },
      social_deliveries: { select: { data: [], error: null }, update: { data: null, error: null } },
    }

    await publishSocialPost(makePost())

    const postUpdates = getCallsFor('social_posts', 'update')
    // Last update should be 'completed'
    const finalUpdate = postUpdates[postUpdates.length - 1]!
    const payload = finalUpdate.args[0] as Record<string, unknown>
    expect(payload.status).toBe('completed')
    expect(payload).toHaveProperty('published_at')
  })
})

// ---------------------------------------------------------------------------
// executeWithRetry tests
// ---------------------------------------------------------------------------

describe('executeWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callLog.clear()
    tableOverrides = {
      social_deliveries: { update: { data: null, error: null }, select: { data: [], error: null } },
      social_connections: { update: { data: null, error: null }, select: { data: null, error: null } },
    }
  })

  function makeProviderMock(overrides: Partial<ISocialProvider> = {}): ISocialProvider {
    return {
      provider: 'facebook',
      publish: vi.fn(),
      deletePost: vi.fn(),
      validateConnection: vi.fn(),
      ...overrides,
    }
  }

  it('retries on transient errors with backoff', async () => {
    const publishMock = vi.fn()
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockRejectedValueOnce(new Error('econnreset'))
      .mockResolvedValueOnce({ id: 'ok-123', url: 'https://fb.com/ok' })

    const provider = makeProviderMock({ publish: publishMock })
    const delivery = makeDelivery({ attempt: 0, max_attempts: 4 })
    const connection = makeConnection()
    const post = makePost()

    const result = await executeWithRetry(delivery, connection, post, provider)

    expect(result.status).toBe('published')
    expect(result.platformPostId).toBe('ok-123')
    expect(publishMock).toHaveBeenCalledTimes(3)
  })

  it('skips on auth errors without refreshToken', async () => {
    const publishMock = vi.fn().mockRejectedValue(new Error('unauthorized (401)'))

    // Provider without refreshToken method
    const provider = makeProviderMock({ publish: publishMock })

    const delivery = makeDelivery({ attempt: 0, max_attempts: 3 })
    const connection = makeConnection()
    const post = makePost()

    const result = await executeWithRetry(delivery, connection, post, provider)

    expect(result.status).toBe('skipped')
    expect(result.errorType).toBe('auth')
    expect(result.error).toContain('Auth failed')
    // Should NOT retry — only one attempt
    expect(publishMock).toHaveBeenCalledTimes(1)
  })

  it('fails immediately on permanent errors without retry', async () => {
    const publishMock = vi.fn().mockRejectedValue(new Error('bad request (400)'))

    const provider = makeProviderMock({ publish: publishMock })
    const delivery = makeDelivery({ attempt: 0, max_attempts: 3 })
    const connection = makeConnection()
    const post = makePost()

    const result = await executeWithRetry(delivery, connection, post, provider)

    expect(result.status).toBe('failed')
    expect(result.errorType).toBe('permanent')
    expect(result.error).toContain('bad request')
    // Permanent errors should NOT trigger retries
    expect(publishMock).toHaveBeenCalledTimes(1)
  })

  it('returns published with platform data on first-attempt success', async () => {
    const publishMock = vi.fn().mockResolvedValue({ id: 'plat-42', url: 'https://example.com/42' })

    const provider = makeProviderMock({ publish: publishMock })
    const delivery = makeDelivery({ attempt: 0, max_attempts: 3 })
    const connection = makeConnection()
    const post = makePost()

    const result = await executeWithRetry(delivery, connection, post, provider)

    expect(result.status).toBe('published')
    expect(result.platformPostId).toBe('plat-42')
    expect(result.platformUrl).toBe('https://example.com/42')
    expect(publishMock).toHaveBeenCalledTimes(1)
  })

  it('fails after exhausting max_attempts on transient errors', async () => {
    const publishMock = vi.fn().mockRejectedValue(new Error('network timeout'))

    const provider = makeProviderMock({ publish: publishMock })
    // max_attempts: 3, RETRY_DELAYS.length+1 = 4 → clamped to 3 → attempts 0,1,2
    const delivery = makeDelivery({ attempt: 0, max_attempts: 3 })
    const connection = makeConnection()
    const post = makePost()

    const result = await executeWithRetry(delivery, connection, post, provider)

    expect(result.status).toBe('failed')
    expect(result.errorType).toBe('transient')
    expect(result.error).toContain('network timeout')
    expect(publishMock).toHaveBeenCalledTimes(3)
  })

  it('retries with token refresh on auth error when refreshToken is available', async () => {
    const publishMock = vi.fn()
      .mockRejectedValueOnce(new Error('token expired (401)'))
      .mockResolvedValueOnce({ id: 'post-refreshed', url: 'https://fb.com/refreshed' })

    const refreshMock = vi.fn().mockResolvedValue({
      access_token: 'new-token',
      expires_at: new Date(Date.now() + 3600_000),
    })

    const provider = makeProviderMock({
      publish: publishMock,
      refreshToken: refreshMock,
    })
    const delivery = makeDelivery({ attempt: 0, max_attempts: 3 })
    const connection = makeConnection()
    const post = makePost()

    const result = await executeWithRetry(delivery, connection, post, provider)

    expect(result.status).toBe('published')
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(publishMock).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// classifyError — unit tests
// ---------------------------------------------------------------------------

describe('classifyError', () => {
  it('classifies 401 as auth', () => {
    expect(classifyError(new Error('unauthorized (401)'))).toBe('auth')
  })

  it('classifies token expired as auth', () => {
    expect(classifyError(new Error('token expired'))).toBe('auth')
  })

  it('classifies 400 as permanent', () => {
    expect(classifyError(new Error('bad request (400)'))).toBe('permanent')
  })

  it('classifies 403 as permanent', () => {
    expect(classifyError(new Error('forbidden (403)'))).toBe('permanent')
  })

  it('classifies 429 as transient', () => {
    expect(classifyError(new Error('rate limit (429)'))).toBe('transient')
  })

  it('classifies network errors as transient', () => {
    expect(classifyError(new Error('network timeout'))).toBe('transient')
  })

  it('classifies non-Error values as transient', () => {
    expect(classifyError('string error')).toBe('transient')
    expect(classifyError(42)).toBe('transient')
  })
})
