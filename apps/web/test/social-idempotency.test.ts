import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mutable state (must be hoisted — vi.mock calls run before module scope)
// ---------------------------------------------------------------------------

const { POST_ID, SITE_ID, USER_ID, mockCasRow, mockCasUpdateReturn } = vi.hoisted(() => {
  const POST_ID = '00000000-0000-0000-0000-000000000099'
  const SITE_ID = 'site-cas-test'
  const USER_ID = 'user-cas-test'

  return {
    POST_ID,
    SITE_ID,
    USER_ID,
    // Row returned by the initial SELECT * (post lookup)
    mockCasRow: {
      data: {
        id: POST_ID,
        site_id: SITE_ID,
        created_by: USER_ID,
        type: 'text',
        status: 'draft',
        content: { title: 'CAS test', description: 'Hello' },
        scheduled_at: null,
        user_timezone: 'America/Sao_Paulo',
        published_at: null,
        template_id: null,
        idempotency_key: 'idem-cas',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      } as Record<string, unknown> | null,
      error: null as { message: string } | null,
    },
    // What the CAS UPDATE → .select('id').maybeSingle() returns.
    // null  → CAS failed (already transitioned) — idempotent early return
    // { id } → CAS succeeded — proceed with workflow
    mockCasUpdateReturn: {
      data: null as { id: string } | null,
      error: null as { message: string } | null,
    },
  }
})

// ---------------------------------------------------------------------------
// Supabase mock — mirrors the publishDraftPost chain:
//   from('social_posts').select('*').eq.eq.single()          → post lookup
//   from('social_deliveries').select.eq (count)              → delivery count
//   from('social_posts').update.eq('id').eq('status','draft').select('id').maybeSingle()  → CAS
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'social_posts') {
        return {
          // Initial row fetch: select('*').eq(id).eq(site_id).single()
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ ...mockCasRow }),
              }),
            }),
          }),
          // CAS update chain: update().eq('id').eq('status','draft').select('id').maybeSingle()
          update: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve({ ...mockCasUpdateReturn }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'social_deliveries') {
        return {
          // Delivery count: select('id', {count,head}).eq().single() — return count=1
          select: () => ({
            eq: () => ({
              // count query returns count=1 so the post has deliveries configured
              count: 1,
              data: null,
              error: null,
            }),
          }),
        }
      }
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      }
    },
  }),
}))

// ---------------------------------------------------------------------------
// Auth / site context mocks
// ---------------------------------------------------------------------------

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

const mockAfter = vi.fn()
vi.mock('next/server', () => ({
  after: (...args: unknown[]) => mockAfter(...args),
}))

// Prevent actual workflow execution
const mockPublishSocialPost = vi.fn().mockResolvedValue(undefined)
vi.mock('../src/lib/social/workflows', () => ({
  publishSocialPost: (...args: unknown[]) => mockPublishSocialPost(...args),
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

vi.mock('@/lib/links/auto-link', () => ({
  ensureTrackedLink: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/links/short-url', () => ({
  buildShortUrl: (code: string) => `https://bythiagofigueiredo.com/go/${code}`,
}))

// ---------------------------------------------------------------------------
// Import under test (after all mocks)
// ---------------------------------------------------------------------------

import { publishDraftPost } from '../src/lib/social/actions/posts'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CAS idempotency — publishDraftPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: post exists and is a draft
    mockCasRow.data = {
      id: POST_ID,
      site_id: SITE_ID,
      created_by: USER_ID,
      type: 'text',
      status: 'draft',
      content: { title: 'CAS test', description: 'Hello' },
      scheduled_at: null,
      user_timezone: 'America/Sao_Paulo',
      published_at: null,
      template_id: null,
      idempotency_key: 'idem-cas',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }
    mockCasRow.error = null

    // Default: CAS succeeds (lock acquired)
    mockCasUpdateReturn.data = { id: POST_ID }
    mockCasUpdateReturn.error = null
  })

  // -------------------------------------------------------------------------
  // 1. Happy path — CAS succeeds → workflow fires
  // -------------------------------------------------------------------------

  it('triggers workflow when CAS update acquires the lock', async () => {
    mockCasUpdateReturn.data = { id: POST_ID } // lock acquired

    const result = await publishDraftPost(POST_ID)
    expect(result.ok).toBe(true)

    // after() called with the workflow promise
    expect(mockAfter).toHaveBeenCalledTimes(1)
    expect(mockPublishSocialPost).toHaveBeenCalledTimes(1)

    const postArg = mockPublishSocialPost.mock.calls[0][0] as Record<string, unknown>
    expect(postArg.id).toBe(POST_ID)
    expect(postArg.status).toBe('publishing')
  })

  // -------------------------------------------------------------------------
  // 2. CAS fails (returns null) — already transitioned by a concurrent call
  //    → idempotent early return, no workflow fired, no error
  // -------------------------------------------------------------------------

  it('returns ok:true without triggering workflow when CAS lock is not acquired', async () => {
    // Simulate concurrent call already moved status to 'publishing'
    mockCasUpdateReturn.data = null

    const result = await publishDraftPost(POST_ID)

    // Idempotent success — not an error
    expect(result.ok).toBe(true)
    expect(result).toMatchObject({ ok: true })

    // Workflow must NOT be triggered on the second call
    expect(mockAfter).not.toHaveBeenCalled()
    expect(mockPublishSocialPost).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 3. Status guard (pre-CAS): if the fetched row is not 'draft', reject early
  // -------------------------------------------------------------------------

  it('returns error when post status is not draft (pre-CAS status check)', async () => {
    if (mockCasRow.data) {
      mockCasRow.data = { ...mockCasRow.data, status: 'publishing' }
    }

    const result = await publishDraftPost(POST_ID)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('rascunho')

    // Neither the CAS update nor the workflow should be called
    expect(mockPublishSocialPost).not.toHaveBeenCalled()
    expect(mockAfter).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 4. Invalid UUID → validation error before any DB call
  // -------------------------------------------------------------------------

  it('returns error for invalid post ID', async () => {
    const result = await publishDraftPost('not-a-uuid')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('Invalid post ID')
  })

  // -------------------------------------------------------------------------
  // 5. Post not found
  // -------------------------------------------------------------------------

  it('returns error when post is not found', async () => {
    mockCasRow.data = null

    const result = await publishDraftPost(POST_ID)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('not found')
  })
})
