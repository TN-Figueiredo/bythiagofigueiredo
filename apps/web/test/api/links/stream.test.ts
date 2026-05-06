import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockLinkSingle = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'link_clicks') {
        return {
          select: () => ({
            eq: () => ({
              gt: () => ({
                order: () => ({
                  limit: mockSelect,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'tracked_links') {
        return {
          select: () => ({
            eq: () => ({
              single: mockLinkSingle,
            }),
          }),
        }
      }
      return {}
    },
  }),
}))

describe('GET /api/links/[id]/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelect.mockResolvedValue({ data: [], error: null })
    mockLinkSingle.mockReturnValue({
      data: { id: 'link-1', site_id: 'site-1' },
      error: null,
    })
  })

  it('returns 401 when no x-site-id header present', async () => {
    const { GET } = await import('../../../src/app/api/links/[id]/stream/route')
    const req = new Request('http://localhost/api/links/link-1/stream')
    const res = await GET(req, { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when link not found', async () => {
    mockLinkSingle.mockReturnValue({ data: null, error: { message: 'not found' } })
    const { GET } = await import('../../../src/app/api/links/[id]/stream/route')
    const req = new Request('http://localhost/api/links/link-1/stream', {
      headers: { 'x-site-id': 'site-1' },
    })
    const res = await GET(req, { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 403 when link belongs to different site', async () => {
    mockLinkSingle.mockReturnValue({
      data: { id: 'link-1', site_id: 'different-site' },
      error: null,
    })
    const { GET } = await import('../../../src/app/api/links/[id]/stream/route')
    const req = new Request('http://localhost/api/links/link-1/stream', {
      headers: { 'x-site-id': 'site-1' },
    })
    const res = await GET(req, { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(403)
  })

  it('returns SSE response with correct content-type', async () => {
    const { GET } = await import('../../../src/app/api/links/[id]/stream/route')
    const req = new Request('http://localhost/api/links/link-1/stream', {
      headers: { 'x-site-id': 'site-1' },
    })
    const res = await GET(req, { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.headers.get('content-type')).toBe('text/event-stream')
    expect(res.headers.get('cache-control')).toBe('no-cache')
    expect(res.headers.get('connection')).toBe('keep-alive')
    // Cancel the stream to avoid hanging
    if (res.body) {
      const reader = res.body.getReader()
      await reader.cancel()
    }
  })

  it('streams click events as JSON SSE messages', async () => {
    mockSelect
      .mockResolvedValueOnce({
        data: [
          {
            id: 'click-1',
            clicked_at: '2026-05-05T12:00:00Z',
            country: 'BR',
            referrer_domain: 'twitter.com',
            is_bot: false,
          },
        ],
        error: null,
      })
      .mockResolvedValue({ data: [], error: null })

    const { GET } = await import('../../../src/app/api/links/[id]/stream/route')
    const req = new Request('http://localhost/api/links/link-1/stream', {
      headers: { 'x-site-id': 'site-1' },
    })
    const res = await GET(req, { params: Promise.resolve({ id: 'link-1' }) })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    const { value } = await reader.read()
    const text = decoder.decode(value)
    expect(text).toContain('data:')
    expect(text).toContain('click-1')
    await reader.cancel()
  })
})
