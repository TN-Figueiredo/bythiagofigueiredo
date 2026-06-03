import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ------------------------------------------------------------------ */
/*  Hoisted mock state                                                  */
/* ------------------------------------------------------------------ */

const POST_ID = '00000000-0000-0000-0000-000000000099'
const SITE_ID = 'site-tracked-links'
const USER_ID = 'user-tracked-links'
const SOURCE_ID = '00000000-0000-0000-0000-000000000042'
const LINK_ID = '00000000-0000-0000-0000-000000001111'
const SHORT_CODE = 'AbCdEfG'

const {
  mockPostInsert,
  mockConnectionsSelect,
  mockDeliveryInsert,
  mockPostUpdate,
  mockEnsureTrackedLink,
} = vi.hoisted(() => ({
  mockPostInsert: {
    data: { id: '00000000-0000-0000-0000-000000000099' } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  mockConnectionsSelect: {
    data: [] as Array<{ id: string; provider: string }> | null,
    error: null as { message: string } | null,
  },
  mockDeliveryInsert: {
    error: null as { message: string } | null,
  },
  mockPostUpdate: {
    error: null as { message: string } | null,
  },
  mockEnsureTrackedLink: {
    result: {
      linkId: '00000000-0000-0000-0000-000000001111',
      code: 'AbCdEfG',
      isNew: true,
    } as { linkId: string; code: string; isNew: boolean } | null,
    throws: false,
  },
}))

/* Track calls */
const insertedPosts = vi.fn()
const insertedDeliveries = vi.fn()
const updatedPosts = vi.fn()

/* ------------------------------------------------------------------ */
/*  Mock: Supabase service client                                       */
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
                single: () => Promise.resolve({ ...mockPostInsert }),
              }),
            }
          },
          update: (patch: unknown) => {
            updatedPosts(patch)
            return {
              eq: () => ({
                error: mockPostUpdate.error,
                // chain for manual link update: .update(...).eq('id', postId)
                eq: () => ({ error: mockPostUpdate.error }),
              }),
            }
          },
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: POST_ID,
                    site_id: SITE_ID,
                    created_by: USER_ID,
                    type: 'link',
                    status: 'draft',
                    content: {},
                    scheduled_at: null,
                    user_timezone: 'America/Sao_Paulo',
                    published_at: null,
                    template_id: null,
                    idempotency_key: 'idem-tl',
                    created_at: '2026-01-01T00:00:00Z',
                    updated_at: '2026-01-01T00:00:00Z',
                  },
                  error: null,
                }),
            }),
          }),
        }
      }
      if (table === 'social_connections') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                in: () => Promise.resolve({ ...mockConnectionsSelect }),
              }),
            }),
          }),
        }
      }
      if (table === 'social_deliveries') {
        return {
          insert: (rows: unknown) => {
            insertedDeliveries(rows)
            return Promise.resolve({ error: mockDeliveryInsert.error })
          },
        }
      }
      return {
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
        }),
      }
    },
  }),
}))

/* ------------------------------------------------------------------ */
/*  Mock: ensureTrackedLink and buildShortUrl                           */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/links/auto-link', () => ({
  ensureTrackedLink: vi.fn(async () => {
    if (mockEnsureTrackedLink.throws) throw new Error('link-service-down')
    return mockEnsureTrackedLink.result
  }),
}))

vi.mock('@/lib/links/short-url', () => ({
  buildShortUrl: (code: string) => `https://bythiagofigueiredo.com/go/${code}`,
}))

/* ------------------------------------------------------------------ */
/*  Mock: auth / site context / infra                                   */
/* ------------------------------------------------------------------ */

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: USER_ID } } }) },
  }),
  requireSiteScope: () => ({ ok: true, user: { id: USER_ID } }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => ({ siteId: SITE_ID, timezone: 'America/Sao_Paulo' }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/server', () => ({ after: vi.fn() }))

vi.mock('../src/lib/social/workflows', () => ({
  publishSocialPost: vi.fn().mockResolvedValue(undefined),
}))

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
      captions: zod.z.record(zod.z.string()).optional(),
    }),
  }
})

vi.mock('@tn-figueiredo/social/vault', () => ({
  decrypt: vi.fn((v: string) => `dec-${v}`),
  encrypt: vi.fn((v: string) => `enc-${v}`),
  getMasterKey: vi.fn(() => 'test-master-key'),
}))

vi.mock('@tn-figueiredo/links/qr', () => ({
  CardCompositionSchema: (async () => {
    const zod = await import('zod')
    return zod.z.object({})
  })(),
}))

/* ------------------------------------------------------------------ */
/*  Import under test (after all mocks)                                 */
/* ------------------------------------------------------------------ */

import { createSocialPost } from '../src/lib/social/actions/posts'
import { ensureTrackedLink } from '@/lib/links/auto-link'

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function sourceLinkedInput(overrides: Record<string, unknown> = {}) {
  return {
    type: 'link' as const,
    content: {
      title: 'My Blog Post',
      description: 'A great blog post',
      url: 'https://bythiagofigueiredo.com/blog/my-post',
    },
    platforms: ['facebook', 'instagram'] as Array<'youtube' | 'facebook' | 'instagram' | 'bluesky'>,
    sourceContentId: SOURCE_ID,
    sourceContentType: 'blog' as const,
    ...overrides,
  }
}

function manualPostInput(overrides: Record<string, unknown> = {}) {
  return {
    type: 'link' as const,
    content: {
      title: 'Manual Post',
      description: 'A manual post with a link',
      url: 'https://example.com/some-article',
    },
    platforms: ['facebook'] as Array<'youtube' | 'facebook' | 'instagram' | 'bluesky'>,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe('createSocialPost — tracked links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPostInsert.data = { id: POST_ID }
    mockPostInsert.error = null
    mockConnectionsSelect.data = []
    mockConnectionsSelect.error = null
    mockDeliveryInsert.error = null
    mockPostUpdate.error = null
    mockEnsureTrackedLink.result = { linkId: LINK_ID, code: SHORT_CODE, isNew: true }
    mockEnsureTrackedLink.throws = false
  })

  /* ---------------------------------------------------------------- */
  /*  A. Source-linked content: ensureTrackedLink called before insert  */
  /* ---------------------------------------------------------------- */

  describe('source-linked content (blog, newsletter, etc.)', () => {
    it('calls ensureTrackedLink when content has url + sourceContentId + sourceContentType', async () => {
      const result = await createSocialPost(sourceLinkedInput())
      expect(result.ok).toBe(true)

      expect(ensureTrackedLink).toHaveBeenCalledTimes(1)
      const [, passedSiteId, passedSourceId, passedSourceType, passedUrl] =
        (ensureTrackedLink as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[]
      expect(passedSiteId).toBe(SITE_ID)
      expect(passedSourceId).toBe(SOURCE_ID)
      expect(passedSourceType).toBe('blog')
      expect(passedUrl).toBe('https://bythiagofigueiredo.com/blog/my-post')
    })

    it('sets short_link_id on the inserted post row when link creation succeeds', async () => {
      await createSocialPost(sourceLinkedInput())

      const row = insertedPosts.mock.calls[0][0] as Record<string, unknown>
      expect(row.short_link_id).toBe(LINK_ID)
    })

    it('rewrites content.url to the short URL before inserting the post', async () => {
      await createSocialPost(sourceLinkedInput())

      const row = insertedPosts.mock.calls[0][0] as Record<string, unknown>
      const content = row.content as Record<string, unknown>
      expect(content.url).toBe(`https://bythiagofigueiredo.com/go/${SHORT_CODE}`)
    })

    it('does NOT set short_link_id when ensureTrackedLink returns null', async () => {
      mockEnsureTrackedLink.result = null

      await createSocialPost(sourceLinkedInput())

      const row = insertedPosts.mock.calls[0][0] as Record<string, unknown>
      expect(row.short_link_id).toBeUndefined()
    })

    it('does NOT call ensureTrackedLink when content has no url', async () => {
      const input = sourceLinkedInput()
      ;(input.content as Record<string, unknown>).url = undefined

      const result = await createSocialPost(input as Parameters<typeof createSocialPost>[0])
      expect(result.ok).toBe(true)
      expect(ensureTrackedLink).not.toHaveBeenCalled()
    })

    it('does NOT call ensureTrackedLink when sourceContentId is missing', async () => {
      const result = await createSocialPost(manualPostInput())
      // manualPostInput has a url but no sourceContentId
      // ensureTrackedLink will be called for the manual path (after insert), not the source path
      const calls = (ensureTrackedLink as ReturnType<typeof vi.fn>).mock.calls
      // sourceType for manual is 'social', not 'blog'
      const sourceCalls = calls.filter(
        (c: unknown[]) => (c as string[])[3] !== 'social',
      )
      expect(sourceCalls).toHaveLength(0)
    })

    it('swallows ensureTrackedLink errors without failing the create', async () => {
      mockEnsureTrackedLink.throws = true

      const result = await createSocialPost(sourceLinkedInput())
      // The post should still be created successfully
      expect(result.ok).toBe(true)
      expect(result.ok && result.data.id).toBe(POST_ID)
    })

    it('passes utmCampaign with social- prefix to ensureTrackedLink', async () => {
      await createSocialPost(sourceLinkedInput())

      const args = (ensureTrackedLink as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[]
      const utmCampaign = args[6] as string
      expect(utmCampaign).toMatch(/^social-/)
    })
  })

  /* ---------------------------------------------------------------- */
  /*  B. Manual posts: ensureTrackedLink called after insert            */
  /* ---------------------------------------------------------------- */

  describe('manual posts (no sourceContentId)', () => {
    it('calls ensureTrackedLink with sourceType "social" using the postId as sourceId', async () => {
      const result = await createSocialPost(manualPostInput())
      expect(result.ok).toBe(true)

      expect(ensureTrackedLink).toHaveBeenCalledTimes(1)
      const [, passedSiteId, passedSourceId, passedSourceType] =
        (ensureTrackedLink as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[]
      expect(passedSiteId).toBe(SITE_ID)
      expect(passedSourceId).toBe(POST_ID)
      expect(passedSourceType).toBe('social')
    })

    it('updates the post with short_link_id and rewritten url after insert', async () => {
      await createSocialPost(manualPostInput())

      expect(updatedPosts).toHaveBeenCalledTimes(1)
      const patch = updatedPosts.mock.calls[0][0] as Record<string, unknown>
      expect(patch.short_link_id).toBe(LINK_ID)
      const content = patch.content as Record<string, unknown>
      expect(content.url).toBe(`https://bythiagofigueiredo.com/go/${SHORT_CODE}`)
    })

    it('does NOT update post when ensureTrackedLink returns null', async () => {
      mockEnsureTrackedLink.result = null

      await createSocialPost(manualPostInput())

      expect(updatedPosts).not.toHaveBeenCalled()
    })

    it('swallows errors without failing the create', async () => {
      mockEnsureTrackedLink.throws = true

      const result = await createSocialPost(manualPostInput())
      expect(result.ok).toBe(true)
    })

    it('does NOT call ensureTrackedLink when content has no url', async () => {
      const result = await createSocialPost({
        type: 'text' as const,
        content: { title: 'No URL', description: 'Just text' },
        platforms: ['facebook'],
      })
      expect(result.ok).toBe(true)
      expect(ensureTrackedLink).not.toHaveBeenCalled()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  C. content_override per delivery platform caption               */
  /* ---------------------------------------------------------------- */

  describe('content_override on delivery rows', () => {
    beforeEach(() => {
      mockConnectionsSelect.data = [
        { id: 'conn-fb', provider: 'facebook' },
        { id: 'conn-ig', provider: 'instagram' },
        { id: 'conn-bs', provider: 'bluesky' },
      ]
    })

    it('sets content_override with platform caption when captions map is provided', async () => {
      const result = await createSocialPost({
        type: 'text' as const,
        content: {
          title: 'Multi-platform post',
          description: 'Default description',
          captions: {
            facebook: 'Facebook-specific caption',
            instagram: 'Instagram-specific caption',
          },
        } as Parameters<typeof createSocialPost>[0]['content'],
        platforms: ['facebook', 'instagram', 'bluesky'],
      })
      expect(result.ok).toBe(true)

      expect(insertedDeliveries).toHaveBeenCalledTimes(1)
      const rows = insertedDeliveries.mock.calls[0][0] as Array<Record<string, unknown>>

      const fbRow = rows.find((r) => r.provider === 'facebook')
      const igRow = rows.find((r) => r.provider === 'instagram')
      const bsRow = rows.find((r) => r.provider === 'bluesky')

      expect(fbRow?.content_override).toEqual({ description: 'Facebook-specific caption' })
      expect(igRow?.content_override).toEqual({ description: 'Instagram-specific caption' })
      // Bluesky has no caption override → null
      expect(bsRow?.content_override).toBeNull()
    })

    it('sets content_override to null for all platforms when no captions map provided', async () => {
      const result = await createSocialPost({
        type: 'text' as const,
        content: { title: 'Post', description: 'Hello' },
        platforms: ['facebook', 'instagram', 'bluesky'],
      })
      expect(result.ok).toBe(true)

      const rows = insertedDeliveries.mock.calls[0][0] as Array<Record<string, unknown>>
      for (const row of rows) {
        expect(row.content_override).toBeNull()
      }
    })

    it('preserves existing format logic unchanged alongside content_override', async () => {
      mockConnectionsSelect.data = [
        { id: 'conn-ig', provider: 'instagram' },
        { id: 'conn-bs', provider: 'bluesky' },
        { id: 'conn-fb', provider: 'facebook' },
      ]

      await createSocialPost({
        type: 'text' as const,
        content: {
          title: 'Story post',
          description: 'Caption',
          captions: { instagram: 'IG caption' },
        } as Parameters<typeof createSocialPost>[0]['content'],
        platforms: ['instagram', 'bluesky', 'facebook'],
        storyMode: true,
      })

      const rows = insertedDeliveries.mock.calls[0][0] as Array<Record<string, unknown>>
      const byProvider = Object.fromEntries(rows.map((r) => [r.provider as string, r]))

      // Format still works correctly
      expect(byProvider.instagram?.format).toBe('story')
      expect(byProvider.bluesky?.format).toBe('link_card')
      expect(byProvider.facebook?.format).toBe('link_share')

      // content_override also correct
      expect(byProvider.instagram?.content_override).toEqual({ description: 'IG caption' })
      expect(byProvider.bluesky?.content_override).toBeNull()
      expect(byProvider.facebook?.content_override).toBeNull()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  D. No double ensureTrackedLink call for source-linked content    */
  /* ---------------------------------------------------------------- */

  it('only calls ensureTrackedLink once for source-linked content (not the manual path)', async () => {
    await createSocialPost(sourceLinkedInput())

    // Should be called exactly once (the source-linked path, not the manual path)
    expect(ensureTrackedLink).toHaveBeenCalledTimes(1)
    const [, , , passedSourceType] =
      (ensureTrackedLink as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[]
    expect(passedSourceType).toBe('blog')
  })
})
