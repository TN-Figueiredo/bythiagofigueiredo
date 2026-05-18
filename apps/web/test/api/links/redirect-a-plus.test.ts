import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLink = {
  id: 'link-1',
  site_id: 'site-1',
  code: 'abc',
  title: 'My Link',
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

describe('GET /go/[code] — A++ features', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockMaybeSingle.mockResolvedValue({ data: { id: 'site-1' }, error: null })
  })

  describe('UTM overwrite prevention', () => {
    it('does NOT overwrite existing UTM params on destination', async () => {
      mockResolve.mockResolvedValue({
        ...mockLink,
        destination_url: 'https://example.com/page?utm_source=existing',
        utm_source: 'link-override',
      })
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
      const location = res.headers.get('location')!
      const url = new URL(location)
      expect(url.searchParams.get('utm_source')).toBe('existing')
    })

    it('appends UTM params when destination has no conflicting ones', async () => {
      mockResolve.mockResolvedValue({
        ...mockLink,
        destination_url: 'https://example.com/page',
        utm_source: 'newsletter',
        utm_medium: 'email',
      })
      const { GET } = await import('../../../src/app/go/[code]/route')
      const req = new Request('http://go.example.com/abc', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      const location = res.headers.get('location')!
      const url = new URL(location)
      expect(url.searchParams.get('utm_source')).toBe('newsletter')
      expect(url.searchParams.get('utm_medium')).toBe('email')
    })

    it('preserves partial existing UTMs and fills the rest', async () => {
      mockResolve.mockResolvedValue({
        ...mockLink,
        destination_url: 'https://example.com/page?utm_campaign=original',
        utm_source: 'social',
        utm_campaign: 'override-should-not-apply',
        utm_term: 'keyword',
      })
      const { GET } = await import('../../../src/app/go/[code]/route')
      const req = new Request('http://go.example.com/abc', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      const location = res.headers.get('location')!
      const url = new URL(location)
      expect(url.searchParams.get('utm_campaign')).toBe('original')
      expect(url.searchParams.get('utm_source')).toBe('social')
      expect(url.searchParams.get('utm_term')).toBe('keyword')
    })
  })

  describe('activates_at — coming-soon rewrite', () => {
    it('rewrites to /go/coming-soon when activates_at is in the future', async () => {
      const future = new Date(Date.now() + 86_400_000).toISOString()
      mockResolve.mockResolvedValue({
        ...mockLink,
        activates_at: future,
      })
      const { GET } = await import('../../../src/app/go/[code]/route')
      const req = new Request('http://go.example.com/abc', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      // NextResponse.rewrite returns 200 with x-middleware-rewrite header
      expect(res.headers.get('x-middleware-rewrite')).toBeTruthy()
      const rewriteUrl = new URL(res.headers.get('x-middleware-rewrite')!)
      expect(rewriteUrl.pathname).toBe('/go/coming-soon')
      expect(rewriteUrl.searchParams.get('title')).toBe('My Link')
      expect(rewriteUrl.searchParams.get('activates')).toBe(future)
    })

    it('does NOT rewrite when activates_at is in the past', async () => {
      const past = new Date(Date.now() - 86_400_000).toISOString()
      mockResolve.mockResolvedValue({
        ...mockLink,
        activates_at: past,
      })
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

    it('uses link code as fallback title when title is null', async () => {
      const future = new Date(Date.now() + 86_400_000).toISOString()
      mockResolve.mockResolvedValue({
        ...mockLink,
        title: null,
        activates_at: future,
      })
      const { GET } = await import('../../../src/app/go/[code]/route')
      const req = new Request('http://go.example.com/abc', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      const rewriteUrl = new URL(res.headers.get('x-middleware-rewrite')!)
      expect(rewriteUrl.searchParams.get('title')).toBe('abc')
    })
  })

  describe('UTM values passed to recordClick', () => {
    it('forwards all UTM fields to recordClick', async () => {
      mockResolve.mockResolvedValue({
        ...mockLink,
        utm_source: 'ig',
        utm_medium: 'story',
        utm_campaign: 'launch',
        utm_term: 'promo',
        utm_content: 'banner',
        utm_id: 'uid-42',
      })
      const { GET } = await import('../../../src/app/go/[code]/route')
      const req = new Request('http://go.example.com/abc', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      expect(mockRecordClick).toHaveBeenCalledWith(
        expect.objectContaining({
          linkId: 'link-1',
          siteId: 'site-1',
          utmSource: 'ig',
          utmMedium: 'story',
          utmCampaign: 'launch',
          utmTerm: 'promo',
          utmContent: 'banner',
          utmId: 'uid-42',
        }),
      )
    })

    it('passes null UTMs to recordClick when link has no UTM config', async () => {
      mockResolve.mockResolvedValue(mockLink)
      const { GET } = await import('../../../src/app/go/[code]/route')
      const req = new Request('http://go.example.com/abc', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      expect(mockRecordClick).toHaveBeenCalledWith(
        expect.objectContaining({
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmTerm: null,
          utmContent: null,
          utmId: null,
        }),
      )
    })
  })

  describe('Click ID passthrough', () => {
    it('forwards gclid to destination when pass_click_ids is true', async () => {
      mockResolve.mockResolvedValue({
        ...mockLink,
        pass_click_ids: true,
      })
      const { GET } = await import('../../../src/app/go/[code]/route')
      const req = new Request('http://go.example.com/abc?gclid=abc123', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      const location = res.headers.get('location')!
      const url = new URL(location)
      expect(url.searchParams.get('gclid')).toBe('abc123')
    })

    it('does NOT forward click IDs when pass_click_ids is false', async () => {
      mockResolve.mockResolvedValue({
        ...mockLink,
        pass_click_ids: false,
      })
      const { GET } = await import('../../../src/app/go/[code]/route')
      const req = new Request('http://go.example.com/abc?gclid=abc123', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      const location = res.headers.get('location')!
      const url = new URL(location)
      expect(url.searchParams.has('gclid')).toBe(false)
    })

    it('passes adClickIds to recordClick when click IDs are forwarded', async () => {
      mockResolve.mockResolvedValue({
        ...mockLink,
        pass_click_ids: true,
      })
      const { GET } = await import('../../../src/app/go/[code]/route')
      const req = new Request('http://go.example.com/abc?gclid=abc123', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      expect(mockRecordClick).toHaveBeenCalledWith(
        expect.objectContaining({
          adClickIds: expect.objectContaining({ gclid: 'abc123' }),
        }),
      )
    })
  })

  describe('Cache-Control for 301 + click IDs', () => {
    it('sets Cache-Control: private, no-store on 301 redirect with click IDs', async () => {
      mockResolve.mockResolvedValue({
        ...mockLink,
        redirect_type: 301,
        pass_click_ids: true,
      })
      const { GET } = await import('../../../src/app/go/[code]/route')
      const req = new Request('http://go.example.com/abc?gclid=test', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      expect(res.status).toBe(301)
      expect(res.headers.get('cache-control')).toBe('private, no-store')
    })

    it('does NOT set Cache-Control on 302 redirect with click IDs', async () => {
      mockResolve.mockResolvedValue({
        ...mockLink,
        redirect_type: 302,
        pass_click_ids: true,
      })
      const { GET } = await import('../../../src/app/go/[code]/route')
      const req = new Request('http://go.example.com/abc?gclid=test', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      expect(res.status).toBe(302)
      expect(res.headers.get('cache-control')).toBeNull()
    })

    it('does NOT set Cache-Control on 301 without click IDs', async () => {
      mockResolve.mockResolvedValue({
        ...mockLink,
        redirect_type: 301,
        pass_click_ids: true,
      })
      const { GET } = await import('../../../src/app/go/[code]/route')
      // No click IDs in the request URL
      const req = new Request('http://go.example.com/abc', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      expect(res.status).toBe(301)
      expect(res.headers.get('cache-control')).toBeNull()
    })
  })

  describe('Custom params', () => {
    it('appends custom_params to destination URL', async () => {
      mockResolve.mockResolvedValue({
        ...mockLink,
        custom_params: { ref: 'social', campaign: 'summer' },
      })
      const { GET } = await import('../../../src/app/go/[code]/route')
      const req = new Request('http://go.example.com/abc', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      const location = res.headers.get('location')!
      const url = new URL(location)
      expect(url.searchParams.get('ref')).toBe('social')
      expect(url.searchParams.get('campaign')).toBe('summer')
    })

    it('skips utm_ keys in custom_params', async () => {
      mockResolve.mockResolvedValue({
        ...mockLink,
        custom_params: { utm_source: 'hack', ref: 'ok' },
      })
      const { GET } = await import('../../../src/app/go/[code]/route')
      const req = new Request('http://go.example.com/abc', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      const location = res.headers.get('location')!
      const url = new URL(location)
      expect(url.searchParams.has('utm_source')).toBe(false)
      expect(url.searchParams.get('ref')).toBe('ok')
    })

    it('does not overwrite existing destination params', async () => {
      mockResolve.mockResolvedValue({
        ...mockLink,
        destination_url: 'https://example.com/page?ref=original',
        custom_params: { ref: 'new' },
      })
      const { GET } = await import('../../../src/app/go/[code]/route')
      const req = new Request('http://go.example.com/abc', {
        headers: {
          host: 'go.example.com',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0',
        },
      })
      const res = await GET(req, { params: Promise.resolve({ code: 'abc' }) })
      const location = res.headers.get('location')!
      const url = new URL(location)
      expect(url.searchParams.get('ref')).toBe('original')
    })
  })
})
