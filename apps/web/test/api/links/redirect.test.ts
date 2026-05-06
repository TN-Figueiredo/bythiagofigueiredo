import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLink = {
  id: 'link-1',
  site_id: 'site-1',
  short_code: 'abc',
  destination_url: 'https://example.com/page',
  redirect_type: 301,
  status: 'active',
  is_password_protected: false,
  max_clicks: null,
  total_clicks: 5,
  expires_at: null,
}

const mockResolve = vi.fn()
const mockRecordClick = vi.fn().mockResolvedValue({ deduplicated: false, isBot: false })

vi.mock('@/lib/links/resolver', () => ({
  resolveLink: (...args: unknown[]) => mockResolve(...args),
}))

vi.mock('@/lib/links/click-recorder', () => ({
  recordClick: (...args: unknown[]) => mockRecordClick(...args),
  isBot: (ua: string) => ua.includes('Googlebot'),
}))

vi.mock('next/cache', () => ({
  unstable_cache: (fn: Function) => fn,
}))

describe('GET /go/[code]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 301 redirect for active link', async () => {
    mockResolve.mockResolvedValue(mockLink)
    const { GET } = await import('../../../src/app/go/[code]/route')
    const req = new Request('http://go.example.com/abc', {
      headers: {
        'x-site-id': 'site-1',
        'x-forwarded-for': '1.2.3.4',
        'user-agent': 'Mozilla/5.0',
      },
    })
    const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://example.com/page')
  })

  it('returns 302 redirect when redirect_type is 302', async () => {
    mockResolve.mockResolvedValue({ ...mockLink, redirect_type: 302 })
    const { GET } = await import('../../../src/app/go/[code]/route')
    const req = new Request('http://go.example.com/abc', {
      headers: {
        'x-site-id': 'site-1',
        'x-forwarded-for': '1.2.3.4',
        'user-agent': 'Mozilla/5.0',
      },
    })
    const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
    expect(res.status).toBe(302)
  })

  it('returns 404 when link not found', async () => {
    mockResolve.mockResolvedValue(null)
    const { GET } = await import('../../../src/app/go/[code]/route')
    const req = new Request('http://go.example.com/nope', {
      headers: { 'x-site-id': 'site-1' },
    })
    const res = await GET(req, { params: Promise.resolve({ code: 'nope' }) })
    expect(res.status).toBe(404)
  })

  it('returns 410 when link is expired', async () => {
    mockResolve.mockResolvedValue({
      ...mockLink,
      status: 'expired',
      expires_at: '2025-01-01T00:00:00Z',
    })
    const { GET } = await import('../../../src/app/go/[code]/route')
    const req = new Request('http://go.example.com/abc', {
      headers: { 'x-site-id': 'site-1' },
    })
    const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
    expect(res.status).toBe(410)
  })

  it('returns 410 when click limit reached', async () => {
    mockResolve.mockResolvedValue({
      ...mockLink,
      max_clicks: 5,
      total_clicks: 5,
    })
    const { GET } = await import('../../../src/app/go/[code]/route')
    const req = new Request('http://go.example.com/abc', {
      headers: { 'x-site-id': 'site-1' },
    })
    const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
    expect(res.status).toBe(410)
  })

  it('redirects to interstitial when password protected', async () => {
    mockResolve.mockResolvedValue({ ...mockLink, is_password_protected: true })
    const { GET } = await import('../../../src/app/go/[code]/route')
    const req = new Request('http://go.example.com/abc', {
      headers: { 'x-site-id': 'site-1' },
    })
    const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/go/abc/unlock')
  })

  it('records click non-blocking after redirect', async () => {
    mockResolve.mockResolvedValue(mockLink)
    const { GET } = await import('../../../src/app/go/[code]/route')
    const req = new Request('http://go.example.com/abc', {
      headers: {
        'x-site-id': 'site-1',
        'x-forwarded-for': '1.2.3.4',
        'user-agent': 'Mozilla/5.0',
        referer: 'https://twitter.com/post',
      },
    })
    await GET(req, { params: Promise.resolve({ code: 'abc' }) })
    // recordClick is called but non-blocking (fire-and-forget)
    expect(mockRecordClick).toHaveBeenCalledWith(
      expect.objectContaining({
        linkId: 'link-1',
        siteId: 'site-1',
        ip: '1.2.3.4',
      }),
    )
  })
})
