import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLink = {
  id: 'link-1',
  site_id: 'site-1',
  code: 'abc',
  title: null,
  destination_url: 'https://example.com/page',
  redirect_type: 301,
  active: true,
  deleted_at: null,
  password_hash: null,
  click_limit: null,
  total_clicks: 5,
  expires_at: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,
  utm_id: null,
  launched_at: null,
  activates_at: null,
  custom_params: {},
  pass_click_ids: false,
}

const mockResolve = vi.fn()
const mockRecordClick = vi.fn().mockResolvedValue({ deduplicated: false, isBot: false })

const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'site-1' }, error: null })
const mockContains = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
const mockSelect = vi.fn().mockReturnValue({ contains: mockContains })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

vi.mock('@/lib/links/resolver', () => ({
  resolveLink: (...args: unknown[]) => mockResolve(...args),
}))

vi.mock('@/lib/links/click-recorder', () => ({
  recordClick: (...args: unknown[]) => mockRecordClick(...args),
  isBot: (ua: string) => ua.includes('Googlebot'),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
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
        host: 'go.example.com',
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
        host: 'go.example.com',
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
      headers: { host: 'go.example.com' },
    })
    const res = await GET(req, { params: Promise.resolve({ code: 'nope' }) })
    expect(res.status).toBe(404)
  })

  it('returns 410 when link is expired', async () => {
    mockResolve.mockResolvedValue({
      ...mockLink,
      active: false,
      deleted_at: null,
    })
    const { GET } = await import('../../../src/app/go/[code]/route')
    const req = new Request('http://go.example.com/abc', {
      headers: { host: 'go.example.com' },
    })
    const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
    expect(res.status).toBe(410)
  })

  it('returns 410 when click limit reached', async () => {
    mockResolve.mockResolvedValue({
      ...mockLink,
      click_limit: 5,
      total_clicks: 5,
    })
    const { GET } = await import('../../../src/app/go/[code]/route')
    const req = new Request('http://go.example.com/abc', {
      headers: { host: 'go.example.com' },
    })
    const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
    expect(res.status).toBe(410)
  })

  it('redirects to interstitial when password protected', async () => {
    mockResolve.mockResolvedValue({ ...mockLink, password_hash: '$2b$10$somehash' })
    const { GET } = await import('../../../src/app/go/[code]/route')
    const req = new Request('http://go.example.com/abc', {
      headers: { host: 'go.example.com' },
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
        host: 'go.example.com',
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

  it('returns 400 when host does not resolve to a site', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const { GET } = await import('../../../src/app/go/[code]/route')
    const req = new Request('http://go.unknown.com/abc', {
      headers: { host: 'go.unknown.com' },
    })
    const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('site_not_resolved')
  })
})
