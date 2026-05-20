import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock infrastructure (matching actions-critical.test.ts pattern)
// ---------------------------------------------------------------------------

function chainableEq(resolvedValue = { data: null, error: null }): ReturnType<typeof vi.fn> {
  const fn: ReturnType<typeof vi.fn> = vi.fn().mockImplementation(() => ({
    eq: chainableEq(resolvedValue),
    single: vi.fn().mockResolvedValue(resolvedValue),
    in: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(resolvedValue),
    }),
  }))
  return fn
}

const mockUpdate = vi.fn().mockReturnValue({
  eq: chainableEq(),
})

let mockFromImpl: ((table: string) => unknown) | null = null

const mockFrom = vi.fn((table: string) => {
  if (mockFromImpl) return mockFromImpl(table)
  return {
    select: vi.fn().mockReturnValue({
      eq: chainableEq(),
    }),
    update: mockUpdate,
  }
})

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 'site-1', orgId: 'o1', defaultLocale: 'pt-br' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: () => Promise.resolve({ ok: true, user: { id: 'user-1' } }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
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
      captions: zod.z.record(zod.z.string(), zod.z.record(zod.z.string(), zod.z.string())).optional(),
    }),
    RETRY_DELAYS: [5000, 30000, 120000],
  }
})

vi.mock('@tn-figueiredo/social/vault', () => ({
  decrypt: vi.fn((v: string) => v),
  getMasterKey: vi.fn(() => 'test-key'),
  encrypt: vi.fn((v: string) => v),
}))

// Import after mocks are set up
// NOTE: @/lib/social/actions is ambiguous (file .ts vs directory /) — use relative paths
import { getEditRules } from '../src/lib/social/types'
import { editPublishedPost } from '../src/lib/social/actions'

// ---------------------------------------------------------------------------
// getEditRules — pure function tests (no DB, no mocks needed)
// ---------------------------------------------------------------------------

describe('getEditRules per-platform rules', () => {
  it('enforces caption-only editing for Facebook', () => {
    const rules = getEditRules('facebook')
    expect(rules.canEditCaption).toBe(true)
    expect(rules.canEditMedia).toBe(false)
    expect(rules.method).toBe('update')
  })

  it('enforces delete+recreate for Bluesky with warning', () => {
    const rules = getEditRules('bluesky')
    expect(rules.canEditCaption).toBe(true)
    expect(rules.canEditMedia).toBe(false)
    expect(rules.method).toBe('delete_recreate')
    expect(rules.warning).toContain('engagement')
  })

  it('marks Instagram as read-only', () => {
    const rules = getEditRules('instagram')
    expect(rules.canEditCaption).toBe(false)
    expect(rules.canEditMedia).toBe(false)
    expect(rules.readOnly).toBe(true)
    expect(rules.readOnlyReason).toContain('does not support editing')
  })

  it('marks YouTube as read-only', () => {
    const rules = getEditRules('youtube')
    expect(rules.canEditCaption).toBe(false)
    expect(rules.readOnly).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// editPublishedPost — server action tests (with mocked DB)
// ---------------------------------------------------------------------------

describe('editPublishedPost action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFromImpl = null
  })

  it('rejects invalid post ID', async () => {
    const result = await editPublishedPost('bad-id', 'also-bad', { caption: 'test' })
    expect(result.ok).toBe(false)
    expect(result).toHaveProperty('error', 'Invalid post ID')
  })

  it('rejects invalid delivery ID', async () => {
    const result = await editPublishedPost(
      '00000000-0000-0000-0000-000000000001',
      'bad-delivery',
      { caption: 'test' },
    )
    expect(result.ok).toBe(false)
    expect(result).toHaveProperty('error', 'Invalid delivery ID')
  })

  it('rejects empty caption', async () => {
    const result = await editPublishedPost(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      { caption: '' },
    )
    expect(result.ok).toBe(false)
    expect(result).toHaveProperty('error')
  })

  it('rejects editing read-only platforms (Instagram)', async () => {
    mockFromImpl = (table: string) => {
      if (table === 'social_posts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: '00000000-0000-0000-0000-000000000001', status: 'completed', site_id: 'site-1' },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'social_deliveries') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: '00000000-0000-0000-0000-000000000002',
                    provider: 'instagram',
                    platform_post_id: 'ig-123',
                    connection_id: 'conn-1',
                    status: 'published',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      return { select: vi.fn().mockReturnValue({ eq: chainableEq() }) }
    }

    const result = await editPublishedPost(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      { caption: 'New caption' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('does not support editing')
    }
  })

  it('rejects editing non-published posts', async () => {
    mockFromImpl = () => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: '00000000-0000-0000-0000-000000000001', status: 'draft', site_id: 'site-1' },
              error: null,
            }),
          }),
        }),
      }),
    })

    const result = await editPublishedPost(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      { caption: 'test' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Cannot edit post with status')
    }
  })
})
