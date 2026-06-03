import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const ORIG_ID = '00000000-0000-0000-0000-000000000001'
const NEW_ID  = '00000000-0000-0000-0000-000000000002'
const SITE_ID = 'site-dup-links'
const USER_ID = 'user-dup-links'
const LINK_ID = '00000000-0000-0000-0000-000000001234'
const SHORT_CODE = 'Abc1234'

/* ------------------------------------------------------------------ */
/*  Hoisted mutable state                                               */
/* ------------------------------------------------------------------ */

const {
  mockOriginalPost,
  mockInsertResult,
  mockEnsureTrackedLink,
} = vi.hoisted(() => ({
  mockOriginalPost: {
    data: null as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  mockInsertResult: {
    data: { id: '00000000-0000-0000-0000-000000000002' } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  mockEnsureTrackedLink: {
    result: {
      linkId: '00000000-0000-0000-0000-000000001234',
      code: 'Abc1234',
      isNew: false,
    } as { linkId: string; code: string; isNew: boolean } | null,
    throws: false,
  },
}))

/* Track insert calls */
const mockInsert = vi.fn()

/* ------------------------------------------------------------------ */
/*  Mock: Supabase service client                                       */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'social_posts') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve(mockOriginalPost),
            }),
          }),
          insert: (row: unknown) => {
            mockInsert(row)
            return {
              select: () => ({
                single: () => Promise.resolve(mockInsertResult),
              }),
            }
          },
        }
      }
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
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
/*  Mock: auth / site-context / infra                                   */
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

import { duplicatePost } from '../src/lib/social/actions/posts'
import { ensureTrackedLink } from '@/lib/links/auto-link'

/* ------------------------------------------------------------------ */
/*  Test helpers                                                        */
/* ------------------------------------------------------------------ */

function makeOriginalPost(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ORIG_ID,
    site_id: SITE_ID,
    created_by: USER_ID,
    type: 'link',
    status: 'completed',
    content: {
      title: 'Original Blog Post',
      description: 'Great read',
      url: 'https://bythiagofigueiredo.com/blog/great-read',
    },
    template_id: null,
    user_timezone: 'America/Sao_Paulo',
    source_content_id: 'blog-1',
    source_content_type: 'blog',
    short_link_id: 'link-1',
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe('duplicatePost — source fields + tracked link reuse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOriginalPost.data = makeOriginalPost()
    mockOriginalPost.error = null
    mockInsertResult.data = { id: NEW_ID }
    mockInsertResult.error = null
    mockEnsureTrackedLink.result = { linkId: LINK_ID, code: SHORT_CODE, isNew: false }
    mockEnsureTrackedLink.throws = false
  })

  /* ---------------------------------------------------------------- */
  /*  A. source_content_id and source_content_type are copied          */
  /* ---------------------------------------------------------------- */

  it('copies source_content_id from the original post to the new row', async () => {
    const result = await duplicatePost(ORIG_ID)
    expect(result.ok).toBe(true)

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const row = mockInsert.mock.calls[0][0] as Record<string, unknown>
    expect(row.source_content_id).toBe('blog-1')
  })

  it('copies source_content_type from the original post to the new row', async () => {
    const result = await duplicatePost(ORIG_ID)
    expect(result.ok).toBe(true)

    const row = mockInsert.mock.calls[0][0] as Record<string, unknown>
    expect(row.source_content_type).toBe('blog')
  })

  /* ---------------------------------------------------------------- */
  /*  B. ensureTrackedLink is called with original's source fields      */
  /* ---------------------------------------------------------------- */

  it('calls ensureTrackedLink with original source_content_id and source_content_type', async () => {
    await duplicatePost(ORIG_ID)

    expect(ensureTrackedLink).toHaveBeenCalledTimes(1)
    const [, passedSiteId, passedSourceId, passedSourceType, passedUrl] =
      (ensureTrackedLink as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[]
    expect(passedSiteId).toBe(SITE_ID)
    expect(passedSourceId).toBe('blog-1')
    expect(passedSourceType).toBe('blog')
    expect(passedUrl).toBe('https://bythiagofigueiredo.com/blog/great-read')
  })

  it('passes a social-dup- prefixed utmCampaign to ensureTrackedLink', async () => {
    await duplicatePost(ORIG_ID)

    const args = (ensureTrackedLink as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[]
    expect(String(args[6])).toMatch(/^social-dup-/)
  })

  /* ---------------------------------------------------------------- */
  /*  C. short_link_id is set on the duplicate row                     */
  /* ---------------------------------------------------------------- */

  it('sets short_link_id on the new row when ensureTrackedLink returns a link', async () => {
    await duplicatePost(ORIG_ID)

    const row = mockInsert.mock.calls[0][0] as Record<string, unknown>
    expect(row.short_link_id).toBe(LINK_ID)
  })

  it('sets short_link_id to null when ensureTrackedLink returns null', async () => {
    mockEnsureTrackedLink.result = null

    await duplicatePost(ORIG_ID)

    const row = mockInsert.mock.calls[0][0] as Record<string, unknown>
    expect(row.short_link_id).toBeNull()
  })

  /* ---------------------------------------------------------------- */
  /*  D. Error handling                                                 */
  /* ---------------------------------------------------------------- */

  it('still creates the duplicate when ensureTrackedLink throws', async () => {
    mockEnsureTrackedLink.throws = true

    const result = await duplicatePost(ORIG_ID)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.id).toBe(NEW_ID)
    // short_link_id should be null (link creation failed gracefully)
    const row = mockInsert.mock.calls[0][0] as Record<string, unknown>
    expect(row.short_link_id).toBeNull()
  })

  /* ---------------------------------------------------------------- */
  /*  E. No ensureTrackedLink when source fields are absent            */
  /* ---------------------------------------------------------------- */

  it('does NOT call ensureTrackedLink when original has no source_content_id', async () => {
    mockOriginalPost.data = makeOriginalPost({
      source_content_id: null,
      source_content_type: null,
    })

    await duplicatePost(ORIG_ID)

    expect(ensureTrackedLink).not.toHaveBeenCalled()
    const row = mockInsert.mock.calls[0][0] as Record<string, unknown>
    expect(row.short_link_id).toBeNull()
  })

  it('does NOT call ensureTrackedLink when original content has no url', async () => {
    mockOriginalPost.data = makeOriginalPost({
      content: { title: 'No URL', description: 'Just text' },
    })

    await duplicatePost(ORIG_ID)

    expect(ensureTrackedLink).not.toHaveBeenCalled()
    const row = mockInsert.mock.calls[0][0] as Record<string, unknown>
    expect(row.short_link_id).toBeNull()
  })

  /* ---------------------------------------------------------------- */
  /*  F. Existing behavior preserved                                    */
  /* ---------------------------------------------------------------- */

  it('sets status to draft and origin to manual on the new row', async () => {
    await duplicatePost(ORIG_ID)

    const row = mockInsert.mock.calls[0][0] as Record<string, unknown>
    expect(row.status).toBe('draft')
    expect(row.origin).toBe('manual')
  })

  it('returns the new post id on success', async () => {
    const result = await duplicatePost(ORIG_ID)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.id).toBe(NEW_ID)
  })

  it('returns forbidden when original post belongs to a different site', async () => {
    mockOriginalPost.data = makeOriginalPost({ site_id: 'other-site' })

    const result = await duplicatePost(ORIG_ID)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('forbidden')
  })

  it('returns Post not found when original does not exist', async () => {
    mockOriginalPost.data = null
    mockOriginalPost.error = { message: 'not found' }

    const result = await duplicatePost(ORIG_ID)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('Post not found')
  })

  it('returns invalid post ID error for non-UUID input', async () => {
    const result = await duplicatePost('not-a-uuid')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('Invalid post ID')
  })
})
