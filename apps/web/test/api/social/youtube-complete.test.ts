// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockRequireSiteScope, mockGetSiteContext } = vi.hoisted(() => ({
  mockRequireSiteScope: vi.fn(),
  mockGetSiteContext: vi.fn(),
}))

const mockSingle = vi.fn()
const mockUpdateEq = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: mockGetSiteContext,
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: mockRequireSiteScope,
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

import { POST } from '../../../src/app/api/social/youtube/complete/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SITE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const POST_ID = '11111111-2222-3333-4444-555555555555'

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/social/youtube/complete', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/social/youtube/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSiteContext.mockResolvedValue({
      siteId: SITE_ID,
      orgId: 'org-1',
      defaultLocale: 'pt-br',
    })
    mockRequireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
  })

  it('returns 403 when user lacks CMS edit scope', async () => {
    mockRequireSiteScope.mockResolvedValueOnce({
      ok: false,
      reason: 'forbidden',
    })
    const res = await POST(makeRequest({ videoId: 'abc123' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 400 when videoId is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  it('returns 400 when postId is not a valid UUID', async () => {
    const res = await POST(makeRequest({ videoId: 'vid-1', postId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  it('returns ok when videoId provided without postId (no DB write)', async () => {
    const res = await POST(makeRequest({ videoId: 'vid-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.videoId).toBe('vid-1')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns 404 when postId does not exist in social_posts', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
    })

    const res = await POST(makeRequest({ videoId: 'vid-1', postId: POST_ID }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Post not found')
  })

  it('updates post content with video_id on success', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: POST_ID, content: { title: 'test' } },
      error: null,
    })
    mockUpdateEq.mockResolvedValueOnce({ data: null, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'social_posts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single: mockSingle }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: mockUpdateEq,
          }),
        }
      }
      return {}
    })

    const res = await POST(makeRequest({ videoId: 'vid-1', postId: POST_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.videoId).toBe('vid-1')
  })
})
