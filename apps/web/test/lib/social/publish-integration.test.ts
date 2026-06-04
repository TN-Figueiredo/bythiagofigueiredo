// apps/web/test/lib/social/publish-integration.test.ts
//
// End-to-end integration test for the social publish flow.
//
// Strategy: mock at the Supabase boundary and provider boundary; let
// createSocialPostFromContent + publishSocialPost run their real logic.
// This verifies the data flow between the two major orchestrators.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// ── Supabase mock (table-aware, call-tracking)
// ---------------------------------------------------------------------------

// These hold the rows that each operation "writes" so we can assert later.
let _insertedDeliveries: unknown[] = []
let _updatedPostPatches: Array<{ patch: Record<string, unknown>; id?: string }> = []
let _updatedDeliveryPatches: Array<{ patch: Record<string, unknown>; id?: string }> = []
let _updatedConnectionPatches: Array<{ patch: Record<string, unknown>; id?: string }> = []

// Per-test configurable return values
let _mockDeliveries: unknown[] = []
let _mockConnectionData: unknown = null
let _mockPostInsertResult: { data: { id: string } | null; error: { message: string } | null } = {
  data: { id: 'post-1' },
  error: null,
}

// The Supabase mock returned by getSupabaseServiceClient() in workflows.ts
const mockServiceClient = {
  from: vi.fn((table: string) => {
    if (table === 'social_posts') {
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: (col: string, id: string) => {
            _updatedPostPatches.push({ patch, id })
            return Promise.resolve({ error: null })
          },
        }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    }
    if (table === 'social_deliveries') {
      return {
        insert: (rows: unknown) => {
          if (Array.isArray(rows)) {
            _insertedDeliveries.push(...rows)
          } else {
            _insertedDeliveries.push(rows)
          }
          return Promise.resolve({ error: null })
        },
        select: () => ({
          eq: () => ({
            in: () =>
              Promise.resolve({ data: _mockDeliveries, error: null }),
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: (col: string, id: string) => {
            _updatedDeliveryPatches.push({ patch, id })
            return Promise.resolve({ error: null })
          },
        }),
      }
    }
    if (table === 'social_connections') {
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              in: () =>
                Promise.resolve({
                  data: [
                    { id: 'conn-fb', provider: 'facebook' },
                    { id: 'conn-ig', provider: 'instagram' },
                  ],
                  error: null,
                }),
            }),
            single: vi.fn().mockResolvedValue({ data: _mockConnectionData, error: null }),
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: (col: string, id: string) => {
            _updatedConnectionPatches.push({ patch, id })
            return Promise.resolve({ error: null })
          },
        }),
      }
    }
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({
              data: { telegram_chat_id: null, email: 'user@example.com' },
              error: null,
            }),
          }),
        }),
      }
    }
    // Generic fallback
    return {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  }),
}

// createSocialPostFromContent receives supabase as a parameter (no service
// client call), so we just pass the mock directly. But the workflows module
// calls getSupabaseServiceClient() internally, so we need both.
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockServiceClient,
}))

// ---------------------------------------------------------------------------
// ── Provider mocks
// ---------------------------------------------------------------------------

const mockFbPublish = vi.fn()
const mockIgPublish = vi.fn()
const mockBskyPublish = vi.fn()
const mockYtPublish = vi.fn()

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
}))

vi.mock('@tn-figueiredo/social/providers/bluesky', () => ({
  BlueskyProvider: class {
    provider = 'bluesky' as const
    publish = mockBskyPublish
    deletePost = vi.fn()
    validateConnection = vi.fn().mockResolvedValue(true)
  },
}))

vi.mock('@tn-figueiredo/social/providers/youtube', () => ({
  YouTubeProvider: class {
    provider = 'youtube' as const
    publish = mockYtPublish
    deletePost = vi.fn()
    validateConnection = vi.fn().mockResolvedValue(true)
  },
}))

// Use real package but stub crypto helpers and shorten delays
vi.mock('@tn-figueiredo/social', async () => {
  const actual = await vi.importActual('@tn-figueiredo/social')
  return {
    ...actual,
    RETRY_DELAYS: [5, 10] as const,
  }
})

vi.mock('@tn-figueiredo/social/vault', () => ({
  decrypt: (_enc: string) => 'decrypted-token',
  encrypt: (_val: string) => 'encrypted-token',
  getMasterKey: () => 'test-master-key-32-chars-padded!!!',
}))

// ---------------------------------------------------------------------------
// ── Other dependencies
// ---------------------------------------------------------------------------

vi.mock('@/lib/social/config', () => ({
  getSocialConfig: () => ({
    meta: { appId: 'test-app-id', appSecret: 'test-app-secret' },
    masterKey: 'test-master-key',
  }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setTag: vi.fn(),
}))

const mockBlobPut = vi.fn()
vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockBlobPut(...args),
}))

vi.mock('@tn-figueiredo/email', () => ({
  ResendEmailAdapter: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({ id: 'email-1' }),
  })),
  createEmailService: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// story-generator and template-renderer are dynamically imported inside workflows
const mockGenerateStoryImage = vi.fn()
vi.mock('@/lib/social/story-generator', () => ({
  generateStoryImage: (...args: unknown[]) => mockGenerateStoryImage(...args),
}))

const mockRenderTemplate = vi.fn()
vi.mock('@/lib/social/template-renderer', () => ({
  renderTemplate: (...args: unknown[]) => mockRenderTemplate(...args),
}))

// notifyStoryReady is called fire-and-forget inside prepareStoryDelivery;
// mock it so we can assert whether it was invoked.
const mockNotifyStoryReady = vi.fn()
vi.mock('@/lib/social/notifications/notify-story-ready', () => ({
  notifyStoryReady: (...args: unknown[]) => mockNotifyStoryReady(...args),
}))

// Mock ensureTrackedLink used by createSocialPostFromContent
const mockEnsureTrackedLink = vi.fn()
vi.mock('@/lib/links/auto-link', () => ({
  ensureTrackedLink: (...args: unknown[]) => mockEnsureTrackedLink(...args),
  generateShortCode: vi.fn().mockReturnValue('xYz1234'),
}))

// Mock content-metadata — real logic needs DB rows, keep unit-isolated
vi.mock('@/lib/social/content-metadata', () => ({
  extractContentMetadata: vi.fn().mockResolvedValue({
    title: 'Empire AI Post',
    url: 'https://bythiagofigueiredo.com/pt/blog/empire-ai',
    image: 'https://cdn.example.com/cover.jpg',
    excerpt: 'The AI empire grows',
    tags: ['AI', 'Empire'],
    locale: 'pt',
  }),
}))

// Mock pipeline — createInitialPipelineSteps is pure; keep fast
vi.mock('@/lib/social/pipeline', () => ({
  createInitialPipelineSteps: vi.fn().mockReturnValue([
    { step: 'post_created', status: 'completed', at: '2026-01-01T00:00:00Z' },
    { step: 'short_link', status: 'completed', at: '2026-01-01T00:00:01Z' },
    { step: 'platform_prepare', status: 'pending', at: '' },
    { step: 'deliver', status: 'pending', at: '' },
  ]),
  updatePipelineStep: vi.fn().mockResolvedValue(undefined),
}))

// Suppress fire-and-forget fetch in createSocialPostFromContent
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })

// ---------------------------------------------------------------------------
// ── Imports (after all vi.mock declarations)
// ---------------------------------------------------------------------------

import { publishSocialPost } from '@/lib/social/workflows'
import { createSocialPostFromContent } from '@/lib/social/create-from-content'
import type { SocialConfig } from '@/lib/social/types'
import type { SocialPost, SocialDelivery, SocialConnection } from '@tn-figueiredo/social'

// ---------------------------------------------------------------------------
// ── Shared test fixtures
// ---------------------------------------------------------------------------

const BASE_SITE_ID = 'site-integration-1'
const BASE_USER_ID = 'user-integration-1'
const BASE_POST_ID = 'post-integration-1'

const defaultSocialConfig: SocialConfig = {
  enabled: true,
  platforms: ['facebook', 'instagram'],
  captions: {
    facebook: { pt: 'Novo post no ar!' },
    instagram: { pt: 'Story no ar!' },
  },
  hashtags: ['#AI', '#Empire'],
  image_source: 'og_image',
  ig_template: 'card',
  formats: {
    facebook: 'link_share',
    instagram: 'story',
  },
}

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: BASE_POST_ID,
    site_id: BASE_SITE_ID,
    created_by: BASE_USER_ID,
    type: 'link',
    status: 'draft',
    scheduled_at: null,
    user_timezone: 'America/Sao_Paulo',
    published_at: null,
    content: {
      title: 'Empire AI Post',
      url: 'https://bythiagofigueiredo.com/pt/blog/empire-ai',
      description: 'The AI empire grows',
      hashtags: ['#AI', '#Empire'],
      media_urls: ['https://cdn.example.com/cover.jpg'],
    },
    template_id: null,
    idempotency_key: `idem-${BASE_POST_ID}`,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeDelivery(overrides: Partial<SocialDelivery & { format?: string; template_config?: unknown }> = {}): SocialDelivery & { format?: string; template_config?: unknown } {
  return {
    id: 'del-1',
    post_id: BASE_POST_ID,
    connection_id: 'conn-fb',
    provider: 'facebook',
    status: 'pending',
    platform_post_id: null,
    platform_url: null,
    content_override: null,
    attempt: 0,
    max_attempts: 1,
    last_error: null,
    error_type: null,
    published_at: null,
    created_at: '2026-01-01T00:00:00Z',
    format: 'link_share',
    template_config: null,
    ...overrides,
  }
}

function makeConnection(overrides: Partial<SocialConnection> = {}): SocialConnection {
  return {
    id: 'conn-fb',
    site_id: BASE_SITE_ID,
    provider: 'facebook',
    account_id: 'acc-fb-1',
    account_name: 'Integration FB',
    access_token_enc: 'enc-access-fb',
    refresh_token_enc: null,
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

// Supabase mock for createSocialPostFromContent (receives supabase as param)
function buildCreateMock({
  existingPost = null as { id: string; status: string } | null,
  postInsertResult = _mockPostInsertResult,
} = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'social_posts') {
        return {
          insert: vi.fn().mockReturnValue({
            select: () => ({
              single: vi.fn().mockResolvedValue(postInsertResult),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  in: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: existingPost,
                      error: null,
                    }),
                  }),
                }),
              }),
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }
      }
      if (table === 'social_deliveries') {
        return {
          insert: vi.fn((rows: unknown) => {
            if (Array.isArray(rows)) {
              _insertedDeliveries.push(...rows)
            } else {
              _insertedDeliveries.push(rows)
            }
            return Promise.resolve({ error: null })
          }),
        }
      }
      if (table === 'social_connections') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                in: () =>
                  Promise.resolve({
                    data: [
                      { id: 'conn-fb', provider: 'facebook' },
                      { id: 'conn-ig', provider: 'instagram' },
                    ],
                    error: null,
                  }),
              }),
            }),
          }),
        }
      }
      if (table === 'tracked_links') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// ── Helper: configure the service-client mock for publishSocialPost
// ---------------------------------------------------------------------------

function mountWorkflowMock({
  deliveries = [] as unknown[],
  connectionData = makeConnection() as unknown,
} = {}) {
  _mockDeliveries = deliveries
  _mockConnectionData = connectionData

  // Patch the single() call on social_connections for executeWithRetry's lookup
  vi.mocked(mockServiceClient.from).mockImplementation((table: string) => {
    if (table === 'social_posts') {
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => {
            _updatedPostPatches.push({ patch, id })
            // Must be thenable for simple `await .update().eq()` AND
            // support CAS chain `.update().eq().or().select().maybeSingle()`
            const result = Promise.resolve({ error: null }) as Promise<{ error: null }> & {
              or: ReturnType<typeof vi.fn>
            }
            result.or = vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id }, error: null }),
              }),
            })
            return result
          },
        }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    }
    if (table === 'social_deliveries') {
      return {
        insert: (rows: unknown) => {
          if (Array.isArray(rows)) _insertedDeliveries.push(...rows)
          else _insertedDeliveries.push(rows)
          return Promise.resolve({ error: null })
        },
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve({ data: _mockDeliveries, error: null }),
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => {
            _updatedDeliveryPatches.push({ patch, id })
            return Promise.resolve({ error: null })
          },
        }),
      }
    }
    if (table === 'social_connections') {
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              in: () =>
                Promise.resolve({
                  data: [
                    { id: 'conn-fb', provider: 'facebook' },
                    { id: 'conn-ig', provider: 'instagram' },
                  ],
                  error: null,
                }),
            }),
            single: vi.fn().mockResolvedValue({ data: connectionData, error: null }),
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => {
            _updatedConnectionPatches.push({ patch, id })
            return Promise.resolve({ error: null })
          },
        }),
      }
    }
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({
              data: { telegram_chat_id: null, email: 'user@example.com' },
              error: null,
            }),
          }),
        }),
      }
    }
    return {
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })
}

// ---------------------------------------------------------------------------
// ── Test 1: Full publish flow (happy path)
// ---------------------------------------------------------------------------

describe('Integration: Full publish flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _insertedDeliveries = []
    _updatedPostPatches = []
    _updatedDeliveryPatches = []
    _updatedConnectionPatches = []

    mockFbPublish.mockResolvedValue({ id: 'fb-post-1', url: 'https://facebook.com/p/1' })
    mockIgPublish.mockResolvedValue({ id: 'ig-post-1', url: 'https://instagram.com/p/1' })

    mockEnsureTrackedLink.mockResolvedValue({ linkId: 'link-1', code: 'empire-ai', isNew: true })
    mockRenderTemplate.mockRejectedValue(new Error('renderer unavailable'))
    mockGenerateStoryImage.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    mockBlobPut.mockResolvedValue({ url: 'https://blob.test/story.png' })
    mockNotifyStoryReady.mockResolvedValue({ ok: true })

    process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com'
  })

  it('Step 1-2: createSocialPostFromContent inserts delivery rows for each active connection', async () => {
    const supabase = buildCreateMock() as never

    const result = await createSocialPostFromContent({
      supabase,
      siteId: BASE_SITE_ID,
      contentType: 'blog',
      contentId: 'blog-post-1',
      config: defaultSocialConfig,
      origin: 'auto',
      userId: BASE_USER_ID,
    })

    expect(result.postId).toBe('post-1')
    expect(result.shortLinkId).toBe('link-1')

    // Two delivery rows must have been inserted (facebook + instagram)
    expect(_insertedDeliveries).toHaveLength(2)
    const providers = (_insertedDeliveries as Array<{ provider: string }>).map((d) => d.provider)
    expect(providers).toContain('facebook')
    expect(providers).toContain('instagram')
  })

  it('Step 2: delivery rows have correct format per platform', async () => {
    const supabase = buildCreateMock() as never

    await createSocialPostFromContent({
      supabase,
      siteId: BASE_SITE_ID,
      contentType: 'blog',
      contentId: 'blog-post-1',
      config: defaultSocialConfig,
      origin: 'auto',
      userId: BASE_USER_ID,
    })

    const rows = _insertedDeliveries as Array<{ provider: string; format: string; status: string; attempt: number; max_attempts: number }>
    const fbRow = rows.find((r) => r.provider === 'facebook')!
    const igRow = rows.find((r) => r.provider === 'instagram')!

    expect(fbRow.format).toBe('link_share')
    expect(igRow.format).toBe('story')
    expect(fbRow.status).toBe('pending')
    expect(igRow.status).toBe('pending')
    expect(fbRow.attempt).toBe(0)
    expect(fbRow.max_attempts).toBe(3)
  })

  it('Step 3-4: publishSocialPost sets status to "publishing" then processes each delivery', async () => {
    mountWorkflowMock({
      deliveries: [
        makeDelivery({ id: 'del-fb', provider: 'facebook', format: 'link_share', connection_id: 'conn-fb' }),
        makeDelivery({ id: 'del-ig', provider: 'instagram', format: 'story', connection_id: 'conn-ig' }),
      ],
      connectionData: makeConnection(),
    })

    await publishSocialPost(makeSocialPost())

    // First update must be status='publishing'
    const firstUpdate = _updatedPostPatches[0]!
    expect(firstUpdate.patch.status).toBe('publishing')
  })

  it('Step 5: per-delivery status is updated to "published" after success', async () => {
    mountWorkflowMock({
      deliveries: [
        makeDelivery({ id: 'del-fb', provider: 'facebook', format: 'link_share', connection_id: 'conn-fb' }),
      ],
      connectionData: makeConnection(),
    })

    await publishSocialPost(makeSocialPost())

    // Delivery update calls: attempt/status update (from executeWithRetry) + final status
    const deliveryUpdates = _updatedDeliveryPatches
    expect(deliveryUpdates.length).toBeGreaterThanOrEqual(1)

    // The final delivery update must contain 'published' status
    const finalDeliveryUpdate = deliveryUpdates.find((u) => u.patch.status === 'published')
    expect(finalDeliveryUpdate).toBeDefined()
    expect(finalDeliveryUpdate!.patch.platform_post_id).toBe('fb-post-1')
  })

  it('Step 6: post status is "completed" when all deliveries succeed', async () => {
    mountWorkflowMock({
      deliveries: [
        makeDelivery({ id: 'del-fb', provider: 'facebook', format: 'link_share', connection_id: 'conn-fb' }),
      ],
      connectionData: makeConnection(),
    })

    await publishSocialPost(makeSocialPost())

    const finalPostUpdate = _updatedPostPatches.find((u) => u.patch.status !== 'publishing')
    expect(finalPostUpdate?.patch.status).toBe('completed')
  })

  it('Step 6: story delivery triggers notifyStoryReady notification', async () => {
    mountWorkflowMock({
      deliveries: [
        makeDelivery({ id: 'del-ig', provider: 'instagram', format: 'story', connection_id: 'conn-ig' }),
      ],
      connectionData: makeConnection({ id: 'conn-ig', provider: 'instagram' }),
    })

    await publishSocialPost(makeSocialPost())

    // notifyStoryReady is fire-and-forget; give microtasks a chance to settle
    await new Promise((r) => setImmediate(r))

    expect(mockNotifyStoryReady).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: BASE_POST_ID,
        imageUrl: 'https://blob.test/story.png',
        userId: BASE_USER_ID,
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// ── Test 2: Partial failure flow
// ---------------------------------------------------------------------------

describe('Integration: Partial failure flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _insertedDeliveries = []
    _updatedPostPatches = []
    _updatedDeliveryPatches = []

    mockEnsureTrackedLink.mockResolvedValue({ linkId: 'link-2', code: 'partial', isNew: true })
    mockRenderTemplate.mockRejectedValue(new Error('renderer unavailable'))
    mockGenerateStoryImage.mockResolvedValue(Buffer.from([0x89]))
    mockBlobPut.mockResolvedValue({ url: 'https://blob.test/story.png' })
    mockNotifyStoryReady.mockResolvedValue({ ok: true })
  })

  it('post status = "partial_failure" when one platform succeeds and one fails', async () => {
    mockFbPublish.mockResolvedValue({ id: 'fb-ok', url: 'https://facebook.com/p/ok' })
    mockBskyPublish.mockRejectedValue(new Error('API error (400)'))

    mountWorkflowMock({
      deliveries: [
        makeDelivery({ id: 'del-fb', provider: 'facebook', format: 'link_share', connection_id: 'conn-fb' }),
        makeDelivery({ id: 'del-bsky', provider: 'bluesky', format: 'link_card', connection_id: 'conn-bsky', max_attempts: 1 }),
      ],
      connectionData: makeConnection(),
    })

    await publishSocialPost(makeSocialPost())

    const finalPostUpdate = _updatedPostPatches.find((u) => u.patch.status !== 'publishing')
    expect(finalPostUpdate?.patch.status).toBe('partial_failure')
  })

  it('failed delivery records correct error info', async () => {
    mockFbPublish.mockResolvedValue({ id: 'fb-ok', url: 'https://facebook.com/p/ok' })
    mockBskyPublish.mockRejectedValue(new Error('Bad request (400)'))

    mountWorkflowMock({
      deliveries: [
        makeDelivery({ id: 'del-fb', provider: 'facebook', format: 'link_share', connection_id: 'conn-fb' }),
        makeDelivery({ id: 'del-bsky', provider: 'bluesky', format: 'link_card', connection_id: 'conn-bsky', max_attempts: 1 }),
      ],
      connectionData: makeConnection(),
    })

    await publishSocialPost(makeSocialPost())

    // Find the delivery update for the bluesky failure
    const failedUpdate = _updatedDeliveryPatches.find((u) => u.patch.status === 'failed')
    expect(failedUpdate).toBeDefined()
    expect(failedUpdate!.patch.last_error).toContain('Bad request')
    expect(failedUpdate!.patch.error_type).toBe('permanent')
  })

  it('published_at is set on post when at least one delivery succeeds', async () => {
    mockFbPublish.mockResolvedValue({ id: 'fb-ok', url: 'https://facebook.com/p/ok' })
    mockBskyPublish.mockRejectedValue(new Error('Server error (500)'))

    mountWorkflowMock({
      deliveries: [
        makeDelivery({ id: 'del-fb', provider: 'facebook', format: 'link_share', connection_id: 'conn-fb' }),
        makeDelivery({ id: 'del-bsky', provider: 'bluesky', format: 'link_card', connection_id: 'conn-bsky', max_attempts: 1 }),
      ],
      connectionData: makeConnection(),
    })

    await publishSocialPost(makeSocialPost())

    const finalPostUpdate = _updatedPostPatches.find((u) => u.patch.status === 'partial_failure')
    expect(finalPostUpdate?.patch.published_at).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// ── Test 3: Auth error stops retry and marks connection for review
// ---------------------------------------------------------------------------

describe('Integration: Auth error stops retry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _updatedPostPatches = []
    _updatedDeliveryPatches = []
    _updatedConnectionPatches = []
    _insertedDeliveries = []

    mockRenderTemplate.mockRejectedValue(new Error('unavailable'))
    mockGenerateStoryImage.mockResolvedValue(Buffer.from([0x89]))
    mockBlobPut.mockResolvedValue({ url: 'https://blob.test/story.png' })
    mockNotifyStoryReady.mockResolvedValue({ ok: true })
    mockEnsureTrackedLink.mockResolvedValue({ linkId: 'link-3', code: 'auth-test', isNew: true })
  })

  it('no retry occurs on 401 — publish called exactly once', async () => {
    mockFbPublish.mockRejectedValue(new Error('Unauthorized (401)'))

    mountWorkflowMock({
      deliveries: [
        makeDelivery({ id: 'del-fb', provider: 'facebook', format: 'link_share', connection_id: 'conn-fb', max_attempts: 3 }),
      ],
      connectionData: makeConnection(),
    })

    await publishSocialPost(makeSocialPost())

    // publish must have been called only once (no retry on auth error)
    expect(mockFbPublish).toHaveBeenCalledTimes(1)
  })

  it('delivery status is set to "skipped" on auth failure', async () => {
    mockFbPublish.mockRejectedValue(new Error('token revoked'))

    mountWorkflowMock({
      deliveries: [
        makeDelivery({ id: 'del-fb', provider: 'facebook', format: 'link_share', connection_id: 'conn-fb', max_attempts: 3 }),
      ],
      connectionData: makeConnection(),
    })

    await publishSocialPost(makeSocialPost())

    const skippedUpdate = _updatedDeliveryPatches.find((u) => u.patch.status === 'skipped')
    expect(skippedUpdate).toBeDefined()
    expect(String(skippedUpdate!.patch.last_error)).toContain('Auth failed')
    expect(skippedUpdate!.patch.error_type).toBe('auth')
  })

  it('post status is "failed" when auth error causes only delivery to be skipped', async () => {
    mockFbPublish.mockRejectedValue(new Error('Unauthorized (401)'))

    mountWorkflowMock({
      deliveries: [
        makeDelivery({ id: 'del-fb', provider: 'facebook', format: 'link_share', connection_id: 'conn-fb', max_attempts: 3 }),
      ],
      connectionData: makeConnection(),
    })

    await publishSocialPost(makeSocialPost())

    // skipped counts as failed in the aggregate
    const finalPostUpdate = _updatedPostPatches.find((u) => u.patch.status !== 'publishing')
    expect(finalPostUpdate?.patch.status).toBe('failed')
  })

  it('revoked connection → delivery is skipped without calling publish', async () => {
    mountWorkflowMock({
      deliveries: [
        makeDelivery({ id: 'del-fb', provider: 'facebook', format: 'link_share', connection_id: 'conn-fb' }),
      ],
      connectionData: makeConnection({ revoked_at: '2026-05-01T00:00:00Z' }),
    })

    await publishSocialPost(makeSocialPost())

    expect(mockFbPublish).not.toHaveBeenCalled()

    const skippedUpdate = _updatedDeliveryPatches.find((u) => u.patch.status === 'skipped')
    expect(skippedUpdate?.patch.last_error).toBe('Connection has been revoked')
  })
})
