import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock — must come before any import that touches the module
// ---------------------------------------------------------------------------

const mockEq = vi.fn()
const mockIn = vi.fn()
const mockSingle = vi.fn()
const mockUpdate = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

// Wire up chainable fluent interface defaults
mockEq.mockReturnValue({ eq: mockEq, in: mockIn, single: mockSingle })
mockIn.mockReturnValue({ data: [], error: null })
mockSingle.mockResolvedValue({ data: null, error: null })
mockUpdate.mockReturnValue({ eq: mockEq })
mockSelect.mockReturnValue({ eq: mockEq, in: mockIn, single: mockSingle })
mockFrom.mockReturnValue({ update: mockUpdate, select: mockSelect })

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

// ---------------------------------------------------------------------------
// Social package mock — short delays to keep tests fast
// ---------------------------------------------------------------------------

vi.mock('@tn-figueiredo/social', async () => {
  const actual = await vi.importActual('@tn-figueiredo/social')
  return {
    ...actual,
    RETRY_DELAYS: [10, 20] as const,
    decrypt: (_enc: string) => 'decrypted-token',
    encrypt: (_val: string) => 'encrypted-token',
    getMasterKey: () => 'test-master-key-32-chars-padded!!!',
  }
})

// ---------------------------------------------------------------------------
// Provider mocks — each provider module
// ---------------------------------------------------------------------------

const mockFbPublish = vi.fn()
const mockIgPublish = vi.fn()
const mockBskyPublish = vi.fn()
const mockYtPublish = vi.fn()

vi.mock('@tn-figueiredo/social/providers/bluesky', () => ({
  BlueskyProvider: class {
    provider = 'bluesky' as const
    publish = mockBskyPublish
    deletePost = vi.fn()
    validateConnection = vi.fn().mockResolvedValue(true)
  },
}))

const mockPublishMultiSlideStory = vi.fn()

vi.mock('@tn-figueiredo/social/providers/meta', () => ({
  FacebookProvider: class {
    provider = 'facebook' as const
    publish = mockFbPublish
    deletePost = vi.fn()
    validateConnection = vi.fn().mockResolvedValue(true)
  },
  InstagramProvider: class {
    provider = 'instagram' as const
    publish = mockIgPublish
    deletePost = vi.fn()
    validateConnection = vi.fn().mockResolvedValue(true)
  },
  publishMultiSlideStory: (...args: unknown[]) => mockPublishMultiSlideStory(...args),
}))

vi.mock('@tn-figueiredo/social/providers/youtube', () => ({
  YouTubeProvider: class {
    provider = 'youtube' as const
    publish = mockYtPublish
    deletePost = vi.fn()
    validateConnection = vi.fn().mockResolvedValue(true)
  },
}))

// ---------------------------------------------------------------------------
// Template renderer — default: rejects (falls through to legacy generator)
// ---------------------------------------------------------------------------

const mockRenderTemplate = vi.fn()
vi.mock('@/lib/social/template-renderer', () => ({
  renderTemplate: (...args: unknown[]) => mockRenderTemplate(...args),
}))

// ---------------------------------------------------------------------------
// Story generator (legacy fallback)
// ---------------------------------------------------------------------------

const mockGenerateStoryImage = vi.fn()
vi.mock('@/lib/social/story-generator', () => ({
  generateStoryImage: (...args: unknown[]) => mockGenerateStoryImage(...args),
}))

// ---------------------------------------------------------------------------
// Vercel Blob
// ---------------------------------------------------------------------------

const mockBlobPut = vi.fn()
vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockBlobPut(...args),
}))

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const mockNotifyStoryReady = vi.fn()
vi.mock('@/lib/social/notifications/notify-story-ready', () => ({
  notifyStoryReady: (...args: unknown[]) => mockNotifyStoryReady(...args),
}))

// ---------------------------------------------------------------------------
// Sentry
// ---------------------------------------------------------------------------

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

vi.mock('@/lib/social/config', () => ({
  getSocialConfig: () => ({
    meta: { appId: 'test-app-id', appSecret: 'test-app-secret' },
    masterKey: 'test-master-key',
  }),
}))

// ---------------------------------------------------------------------------
// Email package (needed for transitive imports)
// ---------------------------------------------------------------------------

vi.mock('@tn-figueiredo/email', () => ({
  ResendEmailAdapter: vi.fn(),
  createEmailService: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Imports (after all mocks)
// ---------------------------------------------------------------------------

import { classifyError, executeWithRetry, publishSocialPost } from '@/lib/social/workflows'
import type {
  ISocialProvider,
  SocialConnection,
  SocialDelivery,
  SocialPost,
} from '@tn-figueiredo/social'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: 'post-1',
    site_id: 'site-1',
    created_by: 'user-1',
    type: 'link',
    status: 'scheduled',
    scheduled_at: null,
    user_timezone: 'America/Sao_Paulo',
    published_at: null,
    content: {
      title: 'Test Post',
      url: 'https://example.com/post',
      description: 'A test description',
      hashtags: ['#test'],
      media_urls: ['https://example.com/image.jpg'],
    },
    template_id: null,
    idempotency_key: 'idem-key-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeDelivery(overrides: Partial<SocialDelivery> = {}): SocialDelivery {
  return {
    id: 'delivery-1',
    post_id: 'post-1',
    connection_id: 'conn-1',
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
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeConnection(overrides: Partial<SocialConnection> = {}): SocialConnection {
  return {
    id: 'conn-1',
    site_id: 'site-1',
    provider: 'facebook',
    account_id: 'acc-1',
    account_name: 'Test Account',
    access_token_enc: 'enc-access-token',
    refresh_token_enc: 'enc-refresh-token',
    page_token_enc: null,
    token_expires_at: null,
    scopes: ['publish_actions'],
    metadata: {},
    connected_at: '2026-01-01T00:00:00Z',
    revoked_at: null,
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeProvider(overrides: Partial<ISocialProvider> = {}): ISocialProvider {
  return {
    provider: 'facebook',
    publish: vi.fn().mockResolvedValue({ id: 'plat-123', url: 'https://facebook.com/p/123' }),
    deletePost: vi.fn().mockResolvedValue(undefined),
    validateConnection: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// A. classifyError()
// ---------------------------------------------------------------------------

describe('classifyError', () => {
  describe('auth errors', () => {
    it('classifies HTTP 401 as auth', () => {
      expect(classifyError(new Error('Request failed (401)'))).toBe('auth')
    })

    it('classifies message containing "unauthorized" as auth', () => {
      expect(classifyError(new Error('Unauthorized access to resource'))).toBe('auth')
    })

    it('classifies message containing "token expired" as auth', () => {
      expect(classifyError(new Error('token expired please re-authenticate'))).toBe('auth')
    })

    it('classifies message containing "token revoked" as auth', () => {
      expect(classifyError(new Error('Access token revoked by user'))).toBe('auth')
    })
  })

  describe('permanent errors', () => {
    it('classifies HTTP 400 as permanent', () => {
      expect(classifyError(new Error('Bad request (400)'))).toBe('permanent')
    })

    it('classifies HTTP 403 as permanent', () => {
      expect(classifyError(new Error('Forbidden (403)'))).toBe('permanent')
    })

    it('classifies HTTP 404 as permanent', () => {
      expect(classifyError(new Error('Not found (404)'))).toBe('permanent')
    })

    it('classifies HTTP 422 as permanent', () => {
      expect(classifyError(new Error('Unprocessable entity (422)'))).toBe('permanent')
    })

    it('classifies message containing "policy" as permanent', () => {
      expect(classifyError(new Error('Content violates community policy'))).toBe('permanent')
    })
  })

  describe('transient errors', () => {
    it('classifies HTTP 429 as transient', () => {
      expect(classifyError(new Error('Too many requests (429)'))).toBe('transient')
    })

    it('classifies HTTP 500 as transient', () => {
      expect(classifyError(new Error('Internal server error (500)'))).toBe('transient')
    })

    it('classifies HTTP 502 as transient', () => {
      expect(classifyError(new Error('Bad gateway (502)'))).toBe('transient')
    })

    it('classifies HTTP 503 as transient', () => {
      expect(classifyError(new Error('Service unavailable (503)'))).toBe('transient')
    })

    it('classifies message containing "rate limit" as transient', () => {
      expect(classifyError(new Error('Rate limit exceeded, retry after 60s'))).toBe('transient')
    })
  })

  describe('unknown / non-Error inputs', () => {
    it('defaults to transient for completely unknown error messages', () => {
      expect(classifyError(new Error('Something unexpected happened'))).toBe('transient')
    })

    it('defaults to transient for non-Error string', () => {
      expect(classifyError('some string error')).toBe('transient')
    })

    it('defaults to transient for null', () => {
      expect(classifyError(null)).toBe('transient')
    })

    it('defaults to transient for undefined', () => {
      expect(classifyError(undefined)).toBe('transient')
    })

    it('defaults to transient for plain object with message property', () => {
      expect(classifyError({ message: 'unauthorized' })).toBe('transient')
    })
  })
})

// ---------------------------------------------------------------------------
// B. executeWithRetry()
// ---------------------------------------------------------------------------

describe('executeWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset default Supabase mock chain
    mockEq.mockReturnValue({ eq: mockEq, in: mockIn, single: mockSingle })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockSelect.mockReturnValue({ eq: mockEq, in: mockIn, single: mockSingle })
    mockFrom.mockReturnValue({ update: mockUpdate, select: mockSelect })
  })

  it('returns published result on first-attempt success', async () => {
    const provider = makeProvider()
    const result = await executeWithRetry(makeDelivery(), makeConnection(), makePost(), provider)

    expect(result).toEqual({
      status: 'published',
      platformPostId: 'plat-123',
      platformUrl: 'https://facebook.com/p/123',
    })
    expect(provider.publish).toHaveBeenCalledTimes(1)
  })

  it('does not retry after first-attempt success', async () => {
    const provider = makeProvider()
    await executeWithRetry(makeDelivery(), makeConnection(), makePost(), provider)

    expect(provider.publish).toHaveBeenCalledTimes(1)
  })

  it('retries on transient error and returns published after success', async () => {
    const provider = makeProvider({
      publish: vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({ id: 'plat-retry', url: 'https://facebook.com/p/retry' }),
    })

    const result = await executeWithRetry(makeDelivery(), makeConnection(), makePost(), provider)

    expect(result).toEqual({
      status: 'published',
      platformPostId: 'plat-retry',
      platformUrl: 'https://facebook.com/p/retry',
    })
    expect(provider.publish).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry on auth error — returns skipped immediately', async () => {
    const provider = makeProvider({
      publish: vi.fn().mockRejectedValue(new Error('Unauthorized (401)')),
    })

    const result = await executeWithRetry(makeDelivery(), makeConnection(), makePost(), provider)

    expect(result.status).toBe('skipped')
    expect(provider.publish).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on permanent error — returns failed immediately', async () => {
    const provider = makeProvider({
      publish: vi.fn().mockRejectedValue(new Error('Bad request (400)')),
    })

    const result = await executeWithRetry(makeDelivery(), makeConnection(), makePost(), provider)

    expect(result.status).toBe('failed')
    expect(result.errorType).toBe('permanent')
    expect(provider.publish).toHaveBeenCalledTimes(1)
  })

  it('exhausts all retries on persistent transient errors and returns failed', async () => {
    const publish = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    const provider = makeProvider({ publish })

    // max_attempts=3, RETRY_DELAYS=[10,20] → 3 attempts total
    const delivery = makeDelivery({ attempt: 0, max_attempts: 3 })
    const result = await executeWithRetry(delivery, makeConnection(), makePost(), provider)

    expect(result.status).toBe('failed')
    expect(result.error).toBe('ECONNRESET')
    expect(publish).toHaveBeenCalledTimes(3)
  })

  it('respects maxRetries parameter — caps at RETRY_DELAYS.length + 1', async () => {
    const publish = vi.fn().mockRejectedValue(new Error('Rate limit (429)'))
    const provider = makeProvider({ publish })

    // max_attempts=99 is capped to RETRY_DELAYS.length + 1 = 3
    const delivery = makeDelivery({ attempt: 0, max_attempts: 99 })
    await executeWithRetry(delivery, makeConnection(), makePost(), provider)

    // RETRY_DELAYS=[10,20] → max 3 attempts
    expect(publish).toHaveBeenCalledTimes(3)
  })

  it('returns failed immediately when delivery.attempt >= max_attempts', async () => {
    const provider = makeProvider()
    const delivery = makeDelivery({ attempt: 3, max_attempts: 3 })
    const result = await executeWithRetry(delivery, makeConnection(), makePost(), provider)

    expect(result).toEqual({
      status: 'failed',
      error: 'Max attempts exceeded',
      errorType: 'transient',
    })
    expect(provider.publish).not.toHaveBeenCalled()
  })

  it('updates delivery status to "publishing" on first attempt', async () => {
    const provider = makeProvider()
    await executeWithRetry(makeDelivery(), makeConnection(), makePost(), provider)

    expect(mockFrom).toHaveBeenCalledWith('social_deliveries')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, status: 'publishing' }),
    )
  })

  it('updates delivery status to "retrying" on subsequent attempts', async () => {
    const publish = vi.fn()
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({ id: 'ok' })

    const provider = makeProvider({ publish })
    await executeWithRetry(makeDelivery(), makeConnection(), makePost(), provider)

    const updateCalls = mockUpdate.mock.calls
    expect(updateCalls[0][0]).toMatchObject({ status: 'publishing', attempt: 1 })
    expect(updateCalls[1][0]).toMatchObject({ status: 'retrying', attempt: 2 })
  })
})

// ---------------------------------------------------------------------------
// C. publishSocialPost() — main orchestrator
// ---------------------------------------------------------------------------

describe('publishSocialPost', () => {
  const fbDelivery = {
    id: 'del-fb',
    post_id: 'post-1',
    connection_id: 'conn-1',
    provider: 'facebook' as const,
    status: 'pending' as const,
    attempt: 0,
    max_attempts: 1,
    platform_post_id: null,
    platform_url: null,
    content_override: null,
    last_error: null,
    error_type: null,
    published_at: null,
    created_at: '2026-01-01T00:00:00Z',
    format: 'link_share' as const,
    template_config: null,
  }

  const bskyDelivery = {
    id: 'del-bsky',
    post_id: 'post-1',
    connection_id: 'conn-2',
    provider: 'bluesky' as const,
    status: 'pending' as const,
    attempt: 0,
    max_attempts: 1,
    platform_post_id: null,
    platform_url: null,
    content_override: null,
    last_error: null,
    error_type: null,
    published_at: null,
    created_at: '2026-01-01T00:00:00Z',
    format: 'link_card' as const,
    template_config: null,
  }

  const igStoryDelivery = {
    id: 'del-ig-story',
    post_id: 'post-1',
    connection_id: 'conn-3',
    provider: 'instagram' as const,
    status: 'pending' as const,
    attempt: 0,
    max_attempts: 1,
    platform_post_id: null,
    platform_url: null,
    content_override: null,
    last_error: null,
    error_type: null,
    published_at: null,
    created_at: '2026-01-01T00:00:00Z',
    format: 'story' as const,
    template_config: null,
  }

  const connData = {
    id: 'conn-1',
    site_id: 'site-1',
    provider: 'facebook' as const,
    account_id: 'acc-1',
    account_name: 'Test',
    access_token_enc: 'enc-token',
    refresh_token_enc: null,
    page_token_enc: null,
    token_expires_at: null,
    scopes: [],
    metadata: {},
    connected_at: '2026-01-01T00:00:00Z',
    revoked_at: null,
    updated_at: '2026-01-01T00:00:00Z',
  }

  function mountSupabaseMock({
    deliveries = [fbDelivery] as unknown[],
    connection = connData as unknown,
    onPostUpdate = (_patch: Record<string, unknown>) => {},
  } = {}) {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'social_posts') {
        return {
          update: (patch: Record<string, unknown>) => {
            onPostUpdate(patch)
            return { eq: vi.fn().mockResolvedValue({ error: null }) }
          },
        }
      }
      if (table === 'social_deliveries') {
        return {
          select: () => ({
            eq: () => ({
              in: () => Promise.resolve({ data: deliveries, error: null }),
            }),
          }),
          update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      if (table === 'social_connections') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: connection, error: null }),
            }),
          }),
        }
      }
      return {
        update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        select: () => ({ eq: vi.fn() }),
        insert: () => Promise.resolve({ error: null }),
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFbPublish.mockResolvedValue({ id: 'fb-123', url: 'https://facebook.com/p/123' })
    mockBskyPublish.mockResolvedValue({ id: 'at://post/1', url: 'https://bsky.app/post/1' })
    mockIgPublish.mockResolvedValue({ id: 'ig-123', url: 'https://instagram.com/p/123' })
    mockGenerateStoryImage.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    mockBlobPut.mockResolvedValue({ url: 'https://blob.vercel-storage.com/story.png' })
    mockNotifyStoryReady.mockResolvedValue({ ok: true })
    mockRenderTemplate.mockRejectedValue(new Error('template-renderer unavailable'))
  })

  it('happy path — single delivery succeeds → post status = completed', async () => {
    let capturedStatus: string | undefined
    mountSupabaseMock({
      onPostUpdate: (patch) => {
        if (patch.status && patch.status !== 'publishing') capturedStatus = patch.status as string
      },
    })

    await publishSocialPost(makePost())

    expect(capturedStatus).toBe('completed')
  })

  it('happy path — multiple deliveries all succeed → post status = completed', async () => {
    let capturedStatus: string | undefined
    mountSupabaseMock({
      deliveries: [fbDelivery, bskyDelivery],
      onPostUpdate: (patch) => {
        if (patch.status && patch.status !== 'publishing') capturedStatus = patch.status as string
      },
    })

    await publishSocialPost(makePost())

    expect(mockFbPublish).toHaveBeenCalledTimes(1)
    expect(mockBskyPublish).toHaveBeenCalledTimes(1)
    expect(capturedStatus).toBe('completed')
  })

  it('one delivery fails, one succeeds → post status = partial_failure', async () => {
    mockFbPublish.mockResolvedValue({ id: 'fb-123', url: 'https://facebook.com/p/123' })
    mockBskyPublish.mockRejectedValue(new Error('API error (400)'))

    let capturedStatus: string | undefined
    mountSupabaseMock({
      deliveries: [fbDelivery, bskyDelivery],
      onPostUpdate: (patch) => {
        if (patch.status && patch.status !== 'publishing') capturedStatus = patch.status as string
      },
    })

    await publishSocialPost(makePost())

    expect(capturedStatus).toBe('partial_failure')
  })

  it('all deliveries fail → post status = failed', async () => {
    mockFbPublish.mockRejectedValue(new Error('Server error (500)'))

    let capturedStatus: string | undefined
    mountSupabaseMock({
      onPostUpdate: (patch) => {
        if (patch.status && patch.status !== 'publishing') capturedStatus = patch.status as string
      },
    })

    await publishSocialPost(makePost())

    expect(capturedStatus).toBe('failed')
  })

  it('story delivery calls story generation pipeline', async () => {
    mountSupabaseMock({
      deliveries: [igStoryDelivery],
      connection: { ...connData, provider: 'instagram' as const },
    })

    await publishSocialPost(makePost())

    // Template renderer was tried first (throws), then legacy generator was used
    expect(mockRenderTemplate).toHaveBeenCalledTimes(1)
    expect(mockGenerateStoryImage).toHaveBeenCalledTimes(1)
    expect(mockBlobPut).toHaveBeenCalledTimes(1)
  })

  it('connection revoked → delivery skipped, does not call publish', async () => {
    mountSupabaseMock({
      connection: { ...connData, revoked_at: '2026-05-01T00:00:00Z' },
    })

    await publishSocialPost(makePost())

    expect(mockFbPublish).not.toHaveBeenCalled()
  })

  it('no pending deliveries → post status set to completed immediately', async () => {
    let capturedStatus: string | undefined
    mountSupabaseMock({
      deliveries: [],
      onPostUpdate: (patch) => {
        if (patch.status) capturedStatus = patch.status as string
      },
    })

    await publishSocialPost(makePost())

    expect(capturedStatus).toBe('completed')
    expect(mockFbPublish).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// D. prepareStoryDelivery() — tested indirectly via publishSocialPost
// ---------------------------------------------------------------------------

describe('prepareStoryDelivery (via publishSocialPost)', () => {
  const igConnData = {
    id: 'conn-3',
    site_id: 'site-1',
    provider: 'instagram' as const,
    account_id: 'acc-3',
    account_name: 'IG Account',
    access_token_enc: 'enc-token',
    refresh_token_enc: null,
    page_token_enc: null,
    token_expires_at: null,
    scopes: [],
    metadata: {},
    connected_at: '2026-01-01T00:00:00Z',
    revoked_at: null,
    updated_at: '2026-01-01T00:00:00Z',
  }

  const storyDeliveryWithTemplate = {
    id: 'del-ig',
    post_id: 'post-1',
    connection_id: 'conn-3',
    provider: 'instagram' as const,
    status: 'pending' as const,
    attempt: 0,
    max_attempts: 1,
    platform_post_id: null,
    platform_url: null,
    content_override: null,
    last_error: null,
    error_type: null,
    published_at: null,
    created_at: '2026-01-01T00:00:00Z',
    format: 'story' as const,
    template_config: { templateId: 'tmpl-bold', template: 'bold' },
  }

  function mountMocks() {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'social_posts') {
        return { update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
      }
      if (table === 'social_deliveries') {
        return {
          select: () => ({
            eq: () => ({
              in: () => Promise.resolve({ data: [storyDeliveryWithTemplate], error: null }),
            }),
          }),
          update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      if (table === 'social_connections') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: igConnData, error: null }),
            }),
          }),
        }
      }
      return {
        update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        select: vi.fn(),
        insert: () => Promise.resolve({ error: null }),
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockIgPublish.mockResolvedValue({ id: 'ig-123', url: 'https://instagram.com/p/123' })
    mockBlobPut.mockResolvedValue({ url: 'https://blob.vercel-storage.com/story.png' })
    mockNotifyStoryReady.mockResolvedValue({ ok: true })
    mockRenderTemplate.mockRejectedValue(new Error('template unavailable'))
    mockGenerateStoryImage.mockResolvedValue(Buffer.from([0xff]))
  })

  it('uses template renderer when template_config has templateId', async () => {
    mockRenderTemplate.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    mountMocks()

    await publishSocialPost(makePost())

    expect(mockRenderTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'tmpl-bold' }),
    )
    // Legacy generator should NOT be called when template renderer succeeds
    expect(mockGenerateStoryImage).not.toHaveBeenCalled()
  })

  it('falls back to legacy story generator when template renderer throws', async () => {
    mockRenderTemplate.mockRejectedValue(new Error('Renderer crashed'))
    mountMocks()

    await publishSocialPost(makePost())

    expect(mockGenerateStoryImage).toHaveBeenCalledTimes(1)
    expect(mockBlobPut).toHaveBeenCalledTimes(1)
  })

  it('returns original post content when both renderers fail', async () => {
    mockRenderTemplate.mockRejectedValue(new Error('template error'))
    mockGenerateStoryImage.mockRejectedValue(new Error('generator error'))
    mountMocks()

    // Should not throw — falls back gracefully
    await expect(publishSocialPost(makePost())).resolves.toBeUndefined()

    // Blob should NOT be called since both renderers failed
    expect(mockBlobPut).not.toHaveBeenCalled()
  })

  it('uploads generated story image to Vercel Blob with correct path', async () => {
    mockRenderTemplate.mockRejectedValue(new Error('not found'))
    mockGenerateStoryImage.mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff]))
    mountMocks()

    await publishSocialPost(makePost())

    expect(mockBlobPut).toHaveBeenCalledWith(
      expect.stringMatching(/^stories\/post-1-\d+\.png$/),
      expect.any(Buffer),
      expect.objectContaining({ access: 'public', addRandomSuffix: false }),
    )
  })

  it('sends story-ready notification after successful story upload', async () => {
    mockRenderTemplate.mockResolvedValue(Buffer.from([0x89, 0x50]))
    mountMocks()

    await publishSocialPost(makePost())

    expect(mockNotifyStoryReady).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: 'post-1',
        imageUrl: 'https://blob.vercel-storage.com/story.png',
      }),
    )
  })
})
