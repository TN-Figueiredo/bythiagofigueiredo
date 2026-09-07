// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createHmac } from 'node:crypto'

const MASTER = 'a'.repeat(64)

const cookieSet = vi.fn()
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-nonce': 'csp-nonce-1' })),
  cookies: vi.fn(async () => ({ set: cookieSet, get: vi.fn(), delete: vi.fn() })),
}))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/oauth/origin', () => ({
  getSiteDomains: vi.fn(async () => ['bythiagofigueiredo.com']),
  resolveOAuthOrigin: vi.fn(() => 'https://bythiagofigueiredo.com'),
  assertSameOriginFetch: vi.fn(() => null),
}))
vi.mock('@/lib/instagram/token', () => ({ getVaultKeyOrNull: vi.fn(() => Buffer.alloc(32)) }))

import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { resolveOAuthOrigin, assertSameOriginFetch } from '@/lib/oauth/origin'
import { getVaultKeyOrNull } from '@/lib/instagram/token'
import { deriveHmacKey, signState, verifyState } from '@/lib/oauth/state'
import { GET } from '@/app/api/instagram/oauth/route'

const ACCOUNT = '11111111-1111-4111-8111-111111111111'
const SITE = '22222222-2222-4222-8222-222222222222'
const USER = '33333333-3333-4333-8333-333333333333'

function accountFound(found: boolean) {
  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: found ? { id: ACCOUNT } : null, error: null })),
          })),
        })),
      })),
    })),
  } as never)
}

function req(qs = `?account_id=${ACCOUNT}`, headers: Record<string, string> = {}) {
  return new NextRequest(`https://bythiagofigueiredo.com/api/instagram/oauth${qs}`, { headers })
}

describe('GET /api/instagram/oauth (start)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.INSTAGRAM_APP_ID = 'ig-app-id'
    process.env.INSTAGRAM_APP_SECRET = 'ig-app-secret'
    process.env.SOCIAL_MASTER_KEY = MASTER
    process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com'
    vi.mocked(getSiteContext).mockResolvedValue({
      siteId: SITE, orgId: 'org', defaultLocale: 'pt-BR', timezone: 'America/Sao_Paulo',
    } as never)
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: USER } } as never)
    vi.mocked(resolveOAuthOrigin).mockReturnValue('https://bythiagofigueiredo.com')
    vi.mocked(assertSameOriginFetch).mockReturnValue(null)
    vi.mocked(getVaultKeyOrNull).mockReturnValue(Buffer.alloc(32))
    accountFound(true)
  })

  it('redirects to Instagram without force_reauth on a normal connect', async () => {
    const res = await GET(req())
    expect(res.status).toBe(302)
    const loc = new URL(res.headers.get('location') ?? '')
    expect(loc.origin + loc.pathname).toBe('https://www.instagram.com/oauth/authorize')
    expect(loc.searchParams.get('client_id')).toBe('ig-app-id')
    expect(loc.searchParams.get('redirect_uri')).toBe('https://bythiagofigueiredo.com/api/instagram/oauth/callback')
    expect(loc.searchParams.get('response_type')).toBe('code')
    expect(loc.searchParams.get('scope')).toBe('instagram_business_basic')
    expect(loc.searchParams.get('enable_fb_login')).toBe('false')
    expect(loc.searchParams.get('force_reauth')).toBeNull()
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it('sets the nonce cookie with __Secure- prefix, 30 min and the OAuth path', async () => {
    await GET(req())
    expect(cookieSet).toHaveBeenCalledWith(expect.objectContaining({
      name: '__Secure-ig_oauth_nonce', httpOnly: true, secure: true,
      sameSite: 'lax', maxAge: 1800, path: '/api/instagram/oauth',
    }))
  })

  it('signs a state carrying typ, ids, origin, nonce and a future exp', async () => {
    const res = await GET(req())
    const state = new URL(res.headers.get('location') ?? '').searchParams.get('state') ?? ''
    const key = deriveHmacKey(MASTER, 'instagram-oauth-state-hmac')
    const nonce = vi.mocked(cookieSet).mock.calls[0]?.[0].value as string
    // `requireNonce` é BOOLEANO (só exige que o campo exista) — quem compara com o
    // cookie é o callback (Task 3). Passar a string aqui é erro de typecheck.
    const p = verifyState(state, key, { typ: 'state', requireNonce: true, requireExp: true })
    expect(p).not.toBeNull()
    expect(p?.nonce).toBe(nonce)
    expect(p?.siteId).toBe(SITE)
    expect(p?.userId).toBe(USER)
    expect(p?.accountId).toBe(ACCOUNT)
    expect(p?.origin).toBe('https://bythiagofigueiredo.com')
    expect((p?.exp ?? 0) * 1000).toBeGreaterThan(Date.now())
  })

  it('adds force_reauth only for different=1', async () => {
    const res = await GET(req(`?account_id=${ACCOUNT}&different=1`))
    expect(new URL(res.headers.get('location') ?? '').searchParams.get('force_reauth')).toBe('true')
  })

  it('never adds force_reauth on a rebind and carries allowRebindTo into the state', async () => {
    const key = deriveHmacKey(MASTER, 'instagram-oauth-state-hmac')
    const rebind = signState({
      typ: 'rebind', siteId: SITE, userId: USER, accountId: ACCOUNT,
      allowRebindTo: '17841400000000000', exp: Math.floor(Date.now() / 1000) + 300,
    }, key)
    const res = await GET(req(`?account_id=${ACCOUNT}&rebind=${encodeURIComponent(rebind)}`))
    const loc = new URL(res.headers.get('location') ?? '')
    expect(loc.searchParams.get('force_reauth')).toBeNull()
    const p = verifyState(loc.searchParams.get('state') ?? '', key, { typ: 'state', requireExp: true })
    expect(p?.allowRebindTo).toBe('17841400000000000')
  })

  it('returns 400 for a rebind signed with the wrong typ', async () => {
    const key = deriveHmacKey(MASTER, 'instagram-oauth-state-hmac')
    const bad = signState({
      typ: 'state', siteId: SITE, userId: USER, accountId: ACCOUNT,
      allowRebindTo: '1', exp: Math.floor(Date.now() / 1000) + 300,
    }, key)
    const res = await GET(req(`?account_id=${ACCOUNT}&rebind=${encodeURIComponent(bad)}`))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Invalid or expired authorization')
  })

  it('answers unauthenticated with 401 HTML, postMessage and the sign-in back link', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'unauthenticated' } as never)
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    const html = await res.text()
    expect(html).toContain('"code":"session_changed"')
    expect(html).toContain('postMessage')
    expect(html).toContain('/cms/login?next=/cms/settings/instagram')
    // Caixa exata do mapa de C2 (`OAUTH_ERROR_TEXT.session_changed`):
    // 'Session changed during authorization — sign in and try again'.
    expect(html).toContain('sign in and try again')
  })

  it('answers insufficient_access with 403 HTML, never JSON', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'insufficient_access' } as never)
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await res.text()).toContain('"code":"session_changed"')
  })

  it('answers a cross-site fetch with 403 HTML cross_origin', async () => {
    vi.mocked(assertSameOriginFetch).mockReturnValue({ status: 403, code: 'cross_origin' })
    const res = await GET(req(`?account_id=${ACCOUNT}`, { 'Sec-Fetch-Site': 'cross-site' }))
    expect(res.status).toBe(403)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await res.text()).toContain('This page must be opened from the CMS')
  })

  it('answers 503 not_configured without the Instagram app credentials', async () => {
    delete process.env.INSTAGRAM_APP_ID
    const res = await GET(req())
    expect(res.status).toBe(503)
    expect(await res.text()).toContain('"code":"not_configured"')
  })

  it('answers 503 vault_unavailable without a usable vault key', async () => {
    vi.mocked(getVaultKeyOrNull).mockReturnValue(null)
    const res = await GET(req())
    expect(res.status).toBe(503)
    expect(await res.text()).toContain('"code":"vault_unavailable"')
  })

  it('answers 404 account_not_found for an account of another site', async () => {
    accountFound(false)
    const res = await GET(req())
    expect(res.status).toBe(404)
    expect(await res.text()).toContain('"code":"account_not_found"')
  })

  it('answers 400 origin_not_allowed when getSiteContext throws', async () => {
    vi.mocked(getSiteContext).mockRejectedValue(new Error('Site context not set'))
    const res = await GET(req())
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('"code":"origin_not_allowed"')
  })

  it('answers 400 origin_not_allowed when the origin does not resolve', async () => {
    vi.mocked(resolveOAuthOrigin).mockReturnValue(null)
    const res = await GET(req())
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('"code":"origin_not_allowed"')
  })

  it('uses the unprefixed cookie name on loopback', async () => {
    vi.mocked(resolveOAuthOrigin).mockReturnValue('http://localhost:3997')
    await GET(new NextRequest('http://localhost:3997/api/instagram/oauth?account_id=' + ACCOUNT))
    expect(cookieSet).toHaveBeenCalledWith(expect.objectContaining({ name: 'ig_oauth_nonce', secure: false }))
  })

  it('keeps the HMAC label separate from the social one', () => {
    expect(deriveHmacKey(MASTER, 'instagram-oauth-state-hmac'))
      .not.toBe(createHmac('sha256', MASTER).update('oauth-state-hmac').digest('hex'))
  })
})
