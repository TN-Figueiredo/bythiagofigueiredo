import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ------------------------------------------------------------------ */
/*  Configurable mock state via vi.hoisted                             */
/* ------------------------------------------------------------------ */

const POST_ID = '00000000-0000-0000-0000-000000000001'
const SITE_ID = 's1'
const USER_ID = 'u1'

const { mockSiteId, mockPostInsert, mockConnectionsSelect, mockDeliveryInsert, mockFullPostSelect } =
  vi.hoisted(() => ({
    mockSiteId: { value: 's1' },
    mockPostInsert: {
      data: { id: '00000000-0000-0000-0000-000000000001' } as Record<string, unknown> | null,
      error: null as { message: string } | null,
    },
    mockConnectionsSelect: {
      data: [] as Array<{ id: string; provider: string }> | null,
      error: null as { message: string } | null,
    },
    mockDeliveryInsert: {
      error: null as { message: string } | null,
    },
    mockFullPostSelect: {
      data: {
        id: '00000000-0000-0000-0000-000000000001',
        site_id: 's1',
        created_by: 'u1',
        type: 'text',
        status: 'publishing',
        content: { title: 'Test', description: 'Hello' },
        scheduled_at: null,
        user_timezone: 'America/Sao_Paulo',
        published_at: null,
        template_id: null,
        idempotency_key: 'idem-key',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      } as Record<string, unknown> | null,
      error: null as { message: string } | null,
    },
  }))

/* Track all inserted rows */
const insertedPosts = vi.fn()
const insertedDeliveries = vi.fn()

/* ------------------------------------------------------------------ */
/*  Mock: Supabase service client                                      */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'social_posts') {
        return {
          insert: (row: unknown) => {
            insertedPosts(row)
            return {
              select: () => ({
                single: () => ({ ...mockPostInsert }),
              }),
            }
          },
          select: () => ({
            eq: () => ({
              single: () => ({ ...mockFullPostSelect }),
            }),
          }),
        }
      }
      if (table === 'social_connections') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                in: () => ({ ...mockConnectionsSelect }),
              }),
            }),
          }),
        }
      }
      if (table === 'social_deliveries') {
        return {
          insert: (rows: unknown) => {
            insertedDeliveries(rows)
            return { error: mockDeliveryInsert.error }
          },
        }
      }
      return {
        select: () => ({
          eq: () => ({ single: () => ({ data: null, error: null }) }),
        }),
      }
    },
  }),
}))

/* ------------------------------------------------------------------ */
/*  Mock: Auth, site context, Sentry, cache, after, workflows          */
/* ------------------------------------------------------------------ */

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: USER_ID, email: 'test@test.com' } } }),
    },
  }),
  requireSiteScope: () => ({ ok: true, user: { id: USER_ID } }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => ({ siteId: mockSiteId.value, timezone: 'America/Sao_Paulo' }),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const mockAfter = vi.fn()
vi.mock('next/server', () => ({
  after: (...args: unknown[]) => mockAfter(...args),
}))

const mockPublishSocialPost = vi.fn().mockResolvedValue(undefined)
vi.mock('../src/lib/social/workflows', () => ({
  publishSocialPost: (...args: unknown[]) => mockPublishSocialPost(...args),
}))

/* ------------------------------------------------------------------ */
/*  Mock: @tn-figueiredo/social — provide SocialPostContentSchema      */
/* ------------------------------------------------------------------ */

vi.mock('@tn-figueiredo/social', async () => {
  const zod = await import('zod')
  return {
    PROVIDERS: ['youtube', 'facebook', 'instagram', 'bluesky'],
    RETRY_DELAYS: [50, 100, 200],
    SocialPostContentSchema: zod.z.object({
      title: zod.z.string().optional(),
      description: zod.z.string().optional(),
      url: zod.z.string().url().optional(),
      hashtags: zod.z.array(zod.z.string()).optional(),
      media_urls: zod.z.array(zod.z.string().url()).optional(),
      video_id: zod.z.string().optional(),
    }),
  }
})

vi.mock('@tn-figueiredo/social/vault', () => ({
  decrypt: vi.fn((v: string) => `dec-${v}`),
  encrypt: vi.fn((v: string) => `enc-${v}`),
  getMasterKey: vi.fn(() => 'test-master-key'),
}))

/* ------------------------------------------------------------------ */
/*  Mock: transitive dependencies from types → story-types             */
/* ------------------------------------------------------------------ */

vi.mock('@tn-figueiredo/links/qr', () => ({
  CardCompositionSchema: (async () => {
    const zod = await import('zod')
    return zod.z.object({})
  })(),
}))

/* ------------------------------------------------------------------ */
/*  Import under test (after mocks) — use relative path               */
/* ------------------------------------------------------------------ */

import { createSocialPost } from '../src/lib/social/actions/posts'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    type: 'text' as const,
    content: { title: 'Test Post', description: 'Hello world' },
    platforms: ['facebook'] as Array<'youtube' | 'facebook' | 'instagram' | 'bluesky'>,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('createSocialPost — publish-now path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSiteId.value = SITE_ID
    mockPostInsert.data = { id: POST_ID }
    mockPostInsert.error = null
    mockConnectionsSelect.data = []
    mockConnectionsSelect.error = null
    mockDeliveryInsert.error = null
    mockFullPostSelect.data = {
      id: POST_ID,
      site_id: SITE_ID,
      created_by: USER_ID,
      type: 'text',
      status: 'publishing',
      content: { title: 'Test', description: 'Hello' },
      scheduled_at: null,
      user_timezone: 'America/Sao_Paulo',
      published_at: null,
      template_id: null,
      idempotency_key: 'idem-key',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }
    mockFullPostSelect.error = null
  })

  /* ---------------------------------------------------------------- */
  /*  1. Draft mode                                                    */
  /* ---------------------------------------------------------------- */

  it('creates a draft when neither publishNow nor scheduledAt are set', async () => {
    const result = await createSocialPost(baseInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.id).toBe(POST_ID)

    const row = insertedPosts.mock.calls[0][0]
    expect(row.status).toBe('draft')
    expect(row.scheduled_at).toBeNull()

    // No workflow triggered
    expect(mockAfter).not.toHaveBeenCalled()
    expect(mockPublishSocialPost).not.toHaveBeenCalled()
  })

  /* ---------------------------------------------------------------- */
  /*  2. Schedule mode                                                 */
  /* ---------------------------------------------------------------- */

  it('creates a scheduled post when scheduledAt is provided', async () => {
    const scheduledAt = '2026-07-01T10:00:00.000Z'
    const result = await createSocialPost(baseInput({ scheduledAt }))
    expect(result.ok).toBe(true)

    const row = insertedPosts.mock.calls[0][0]
    expect(row.status).toBe('scheduled')
    expect(row.scheduled_at).toBe(scheduledAt)

    // No immediate workflow — scheduler picks it up later
    expect(mockAfter).not.toHaveBeenCalled()
    expect(mockPublishSocialPost).not.toHaveBeenCalled()
  })

  /* ---------------------------------------------------------------- */
  /*  3. Publish now mode                                              */
  /* ---------------------------------------------------------------- */

  it('sets status to publishing and triggers after(publishSocialPost) when publishNow is true', async () => {
    mockConnectionsSelect.data = [
      { id: 'conn-fb', provider: 'facebook' },
    ]

    const result = await createSocialPost(baseInput({ publishNow: true }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.id).toBe(POST_ID)

    const row = insertedPosts.mock.calls[0][0]
    expect(row.status).toBe('publishing')

    // after() was called with a Promise (the publishSocialPost(...).catch(...) chain)
    expect(mockAfter).toHaveBeenCalledTimes(1)
    expect(mockPublishSocialPost).toHaveBeenCalledTimes(1)

    // The first arg to publishSocialPost should be a SocialPostWithSlides object
    const postArg = mockPublishSocialPost.mock.calls[0][0]
    expect(postArg.id).toBe(POST_ID)
    expect(postArg.status).toBe('publishing')
    expect(postArg.site_id).toBe(SITE_ID)
  })

  /* ---------------------------------------------------------------- */
  /*  4. Publish now with no connections                               */
  /* ---------------------------------------------------------------- */

  it('creates the post with no deliveries when no connections exist', async () => {
    mockConnectionsSelect.data = []

    const result = await createSocialPost(baseInput({ publishNow: true }))
    expect(result.ok).toBe(true)

    // Post inserted
    expect(insertedPosts).toHaveBeenCalledTimes(1)

    // No deliveries inserted
    expect(insertedDeliveries).not.toHaveBeenCalled()

    // after() still called for the workflow
    expect(mockAfter).toHaveBeenCalledTimes(1)
  })

  /* ---------------------------------------------------------------- */
  /*  5. Publish now with multiple platforms                           */
  /* ---------------------------------------------------------------- */

  it('creates delivery rows for each connected platform', async () => {
    mockConnectionsSelect.data = [
      { id: 'conn-fb', provider: 'facebook' },
      { id: 'conn-ig', provider: 'instagram' },
      { id: 'conn-bs', provider: 'bluesky' },
    ]

    const result = await createSocialPost(
      baseInput({
        platforms: ['facebook', 'instagram', 'bluesky'],
        publishNow: true,
      }),
    )
    expect(result.ok).toBe(true)

    expect(insertedDeliveries).toHaveBeenCalledTimes(1)
    const rows = insertedDeliveries.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows).toHaveLength(3)

    const providers = rows.map((r) => r.provider)
    expect(providers).toContain('facebook')
    expect(providers).toContain('instagram')
    expect(providers).toContain('bluesky')

    // All deliveries start as pending
    for (const row of rows) {
      expect(row.status).toBe('pending')
      expect(row.post_id).toBe(POST_ID)
      expect(row.attempt).toBe(0)
      expect(row.max_attempts).toBe(3)
    }
  })

  /* ---------------------------------------------------------------- */
  /*  6. Format mapping: Instagram non-story => 'image_post'           */
  /* ---------------------------------------------------------------- */

  it('sets format to image_post for Instagram without storyMode', async () => {
    mockConnectionsSelect.data = [{ id: 'conn-ig', provider: 'instagram' }]

    await createSocialPost(
      baseInput({
        platforms: ['instagram'],
        publishNow: true,
        storyMode: false,
      }),
    )

    const rows = insertedDeliveries.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    expect(rows[0].provider).toBe('instagram')
    expect(rows[0].format).toBe('image_post')
  })

  /* ---------------------------------------------------------------- */
  /*  7. Format mapping: Instagram story => 'story'                    */
  /* ---------------------------------------------------------------- */

  it('sets format to story for Instagram with storyMode', async () => {
    mockConnectionsSelect.data = [{ id: 'conn-ig', provider: 'instagram' }]

    await createSocialPost(
      baseInput({
        platforms: ['instagram'],
        publishNow: true,
        storyMode: true,
      }),
    )

    const rows = insertedDeliveries.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    expect(rows[0].provider).toBe('instagram')
    expect(rows[0].format).toBe('story')
  })

  /* ---------------------------------------------------------------- */
  /*  8. Format mapping: Facebook => 'link_share'                      */
  /* ---------------------------------------------------------------- */

  it('sets format to link_share for Facebook', async () => {
    mockConnectionsSelect.data = [{ id: 'conn-fb', provider: 'facebook' }]

    await createSocialPost(
      baseInput({
        platforms: ['facebook'],
        publishNow: true,
      }),
    )

    const rows = insertedDeliveries.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    expect(rows[0].provider).toBe('facebook')
    expect(rows[0].format).toBe('link_share')
  })

  /* ---------------------------------------------------------------- */
  /*  9. Format mapping: Bluesky => 'link_card'                        */
  /* ---------------------------------------------------------------- */

  it('sets format to link_card for Bluesky', async () => {
    mockConnectionsSelect.data = [{ id: 'conn-bs', provider: 'bluesky' }]

    await createSocialPost(
      baseInput({
        platforms: ['bluesky'],
        publishNow: true,
      }),
    )

    const rows = insertedDeliveries.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    expect(rows[0].provider).toBe('bluesky')
    expect(rows[0].format).toBe('link_card')
  })

  /* ---------------------------------------------------------------- */
  /*  10. Idempotency: each call generates a unique idempotency key    */
  /* ---------------------------------------------------------------- */

  it('generates a unique idempotency_key for each call', async () => {
    await createSocialPost(baseInput())
    await createSocialPost(baseInput())

    expect(insertedPosts).toHaveBeenCalledTimes(2)

    const key1 = insertedPosts.mock.calls[0][0].idempotency_key as string
    const key2 = insertedPosts.mock.calls[1][0].idempotency_key as string

    // Both should be valid UUIDs
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    expect(key1).toMatch(uuidRe)
    expect(key2).toMatch(uuidRe)

    // They must differ
    expect(key1).not.toBe(key2)
  })

  /* ---------------------------------------------------------------- */
  /*  Edge cases                                                       */
  /* ---------------------------------------------------------------- */

  it('returns error when post insert fails', async () => {
    mockPostInsert.data = null
    mockPostInsert.error = { message: 'duplicate key' }

    const result = await createSocialPost(baseInput({ publishNow: true }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('duplicate key')

    // No deliveries or workflow attempted
    expect(insertedDeliveries).not.toHaveBeenCalled()
    expect(mockAfter).not.toHaveBeenCalled()
  })

  it('returns error when connections query fails', async () => {
    mockConnectionsSelect.data = null
    mockConnectionsSelect.error = { message: 'connection timeout' }

    const result = await createSocialPost(baseInput({ publishNow: true }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('connection timeout')
  })

  it('returns error when delivery insert fails', async () => {
    mockConnectionsSelect.data = [{ id: 'conn-fb', provider: 'facebook' }]
    mockDeliveryInsert.error = { message: 'constraint violation' }

    const result = await createSocialPost(baseInput({ publishNow: true }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('constraint violation')
  })

  it('rejects invalid input (empty platforms)', async () => {
    const result = await createSocialPost(baseInput({ platforms: [] }))
    expect(result.ok).toBe(false)
  })

  it('scheduledAt takes precedence over publishNow (status = scheduled, no after)', async () => {
    const scheduledAt = '2026-08-01T12:00:00.000Z'
    const result = await createSocialPost(
      baseInput({ publishNow: true, scheduledAt }),
    )
    expect(result.ok).toBe(true)

    const row = insertedPosts.mock.calls[0][0]
    expect(row.status).toBe('scheduled')

    // publishNow true but scheduledAt present => condition is NOT met for after()
    expect(mockAfter).not.toHaveBeenCalled()
  })

  it('sets all formats correctly in a multi-platform post with storyMode', async () => {
    mockConnectionsSelect.data = [
      { id: 'conn-fb', provider: 'facebook' },
      { id: 'conn-ig', provider: 'instagram' },
      { id: 'conn-bs', provider: 'bluesky' },
    ]

    await createSocialPost(
      baseInput({
        platforms: ['facebook', 'instagram', 'bluesky'],
        publishNow: true,
        storyMode: true,
      }),
    )

    const rows = insertedDeliveries.mock.calls[0][0] as Array<Record<string, unknown>>
    const byProvider = Object.fromEntries(rows.map((r) => [r.provider, r.format]))

    expect(byProvider.facebook).toBe('link_share')
    expect(byProvider.instagram).toBe('story') // storyMode affects only Instagram
    expect(byProvider.bluesky).toBe('link_card')
  })
})
