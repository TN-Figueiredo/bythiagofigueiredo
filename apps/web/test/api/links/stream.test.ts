import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockLinkSingle = vi.fn()
const mockScope = vi.fn()

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (o: unknown) => mockScope(o) }))

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
    // editor com sessão: a guarda `edit` do site do link deixa passar
    mockScope.mockImplementation(async (o: { siteId: string }) => (o.siteId === 'site-1' ? { ok: true, user: { id: 'u1' } } : { ok: false, reason: 'insufficient_access' }))
  })

  const chamar = async (headers: Record<string, string> = {}) => {
    const { GET } = await import('../../../src/app/api/links/[id]/stream/route')
    return GET(new Request('http://localhost/api/links/link-1/stream', { headers }), { params: Promise.resolve({ id: 'link-1' }) })
  }

  it('sem sessão: 401 (e a guarda é a de EDITAR o site do link)', async () => {
    mockScope.mockResolvedValue({ ok: false, reason: 'unauthenticated' })
    expect((await chamar()).status).toBe(401)
    expect(mockScope).toHaveBeenCalledWith({ area: 'cms', siteId: 'site-1', mode: 'edit' })
  })

  it('reporter (sessão sem direito de editar): 403', async () => {
    mockScope.mockResolvedValue({ ok: false, reason: 'insufficient_access' })
    expect((await chamar()).status).toBe(403)
  })

  it('x-site-id forjado não muda o resultado: nem libera quem não edita, nem derruba quem edita', async () => {
    mockScope.mockResolvedValue({ ok: false, reason: 'insufficient_access' })
    expect((await chamar({ 'x-site-id': 'site-1' })).status).toBe(403)
    mockScope.mockImplementation(async (o: { siteId: string }) => (o.siteId === 'site-1' ? { ok: true, user: { id: 'u1' } } : { ok: false, reason: 'insufficient_access' }))
    const res = await chamar({ 'x-site-id': 'outro-site' })
    expect(res.status).toBe(200)
    await res.body?.getReader().cancel()
  })

  it('link inexistente: 404 para quem edita algo; 401 sem sessão e 403 sem direito (não revela se o id existe)', async () => {
    mockLinkSingle.mockReturnValue({ data: null, error: { message: 'not found' } })
    mockScope.mockResolvedValue({ ok: false, reason: 'unauthenticated' })
    expect((await chamar()).status).toBe(401)
    mockScope.mockResolvedValue({ ok: false, reason: 'insufficient_access' })
    expect((await chamar()).status).toBe(403)
    mockScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    expect((await chamar()).status).toBe(404)
  })

  it('link de outro site: a guarda é do site do link (editor do site-1 recebe 403)', async () => {
    mockLinkSingle.mockReturnValue({ data: { id: 'link-1', site_id: 'different-site' }, error: null })
    expect((await chamar()).status).toBe(403)
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
