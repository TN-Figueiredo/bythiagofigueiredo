// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MASTER = 'b'.repeat(64)
const ACCOUNT = '11111111-1111-4111-8111-111111111111'
const SITE = '22222222-2222-4222-8222-222222222222'
const USER = '33333333-3333-4333-8333-333333333333'
const ORIGIN = 'https://bythiagofigueiredo.com'

const cookieGet = vi.fn()
const cookieSet = vi.fn()
const cookieDelete = vi.fn()
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-nonce': 'csp-nonce-1' })),
  cookies: vi.fn(async () => ({ get: cookieGet, set: cookieSet, delete: cookieDelete })),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/oauth/origin', () => ({
  getSiteDomains: vi.fn(async () => ['bythiagofigueiredo.com']),
  resolveOAuthOrigin: vi.fn(() => 'https://bythiagofigueiredo.com'),
  assertSameOriginFetch: vi.fn(() => null),
}))
vi.mock('@/lib/oauth/consent', () => ({ recordSocialConsent: vi.fn(async () => undefined) }))
vi.mock('@/lib/instagram/token', () => ({
  getVaultKeyOrNull: vi.fn(() => Buffer.alloc(32)),
  writeAccessToken: vi.fn((plain: string) => `v1:${plain}`),
  redact: vi.fn((s: string) => s),
}))
vi.mock('@/lib/instagram/api-client', () => ({
  GRAPH_API_BASE: 'https://graph.instagram.com/v25.0',
  TOKEN_API_BASE: 'https://graph.instagram.com/v25.0',
  fetchInstagramProfile: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

// ── Task 4 — sync pós-OAuth em after() ──────────────────────────────────────
const afterCallbacks: Array<() => Promise<void> | void> = []
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: vi.fn((cb: () => Promise<void> | void) => { afterCallbacks.push(cb) }) }
})
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/instagram/sync-log', () => ({
  openSyncRow: vi.fn(async () => 'log-1'),
  closeSyncRow: vi.fn(async () => undefined),
}))
vi.mock('@/lib/instagram/sync', () => ({ syncInstagramAccount: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { resolveOAuthOrigin } from '@/lib/oauth/origin'
import { recordSocialConsent } from '@/lib/oauth/consent'
import { writeAccessToken } from '@/lib/instagram/token'
import { fetchInstagramProfile } from '@/lib/instagram/api-client'
import { revalidateTag } from 'next/cache'
import { openSyncRow, closeSyncRow } from '@/lib/instagram/sync-log'
import { syncInstagramAccount } from '@/lib/instagram/sync'
import { deriveHmacKey, signState, verifyState } from '@/lib/oauth/state'
import { GET, maxDuration } from '@/app/api/instagram/oauth/callback/route'

const key = () => deriveHmacKey(MASTER, 'instagram-oauth-state-hmac')

function validState(over: Record<string, unknown> = {}) {
  return signState({
    typ: 'state', siteId: SITE, userId: USER, accountId: ACCOUNT, origin: ORIGIN,
    nonce: 'nonce-abc', exp: Math.floor(Date.now() / 1000) + 1800, ...over,
  }, key())
}

interface TargetRow {
  id: string; site_id: string; handle: string
  ig_user_id: string | null; ig_user_id_source: 'oauth' | 'legacy'
}

const updateSpy = vi.fn()
const orSpy = vi.fn()
const insertSpy = vi.fn()

function mockDb(opts: {
  target: TargetRow | null
  updated?: Record<string, unknown>[]
  updateError?: { message: string } | null
}) {
  updateSpy.mockReset(); orSpy.mockReset(); insertSpy.mockReset()
  insertSpy.mockResolvedValue({ error: null })
  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'instagram_sync_log') return { insert: insertSpy }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: opts.target, error: opts.target ? null : { message: 'no rows' } })),
            })),
          })),
        })),
        update: vi.fn((patch: Record<string, unknown>) => {
          updateSpy(patch)
          return {
            eq: vi.fn(() => ({
              or: vi.fn((filter: string) => {
                orSpy(filter)
                return {
                  select: vi.fn(async () => ({
                    data: opts.updated ?? [{ id: ACCOUNT, site_id: SITE }],
                    error: opts.updateError ?? null,
                  })),
                }
              }),
            })),
          }
        }),
      }
    }),
  } as never)
}

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function exchangeOk(permissions = 'instagram_business_basic') {
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ access_token: 'short', user_id: 17841400000000000, permissions }] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'long-lived-token', expires_in: 5_184_000 }) })
}

function req(qs: string) {
  return new NextRequest(`${ORIGIN}/api/instagram/oauth/callback${qs}`)
}

// DESVIO do plano (deliberado): este `beforeEach` está no ESCOPO DO ARQUIVO, não
// dentro do primeiro `describe`. No plano ele era local ao primeiro bloco, o que
// deixava o segundo `describe` ("post-OAuth sync") rodando com `mockFetch` vazio
// e sem `vi.clearAllMocks()` — a troca de código falhava, `after()` nunca era
// agendado e as asserções do sync não podiam falhar por motivo nenhum além disso.
beforeEach(() => {
  vi.clearAllMocks()
  process.env.INSTAGRAM_APP_ID = 'ig-app-id'
  process.env.INSTAGRAM_APP_SECRET = 'ig-app-secret'
  process.env.SOCIAL_MASTER_KEY = MASTER
  process.env.NEXT_PUBLIC_APP_URL = ORIGIN
  cookieGet.mockImplementation((name: string) =>
    name === '__Secure-ig_oauth_nonce' ? { name, value: 'nonce-abc' } : undefined)
  vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: USER } } as never)
  vi.mocked(resolveOAuthOrigin).mockReturnValue(ORIGIN)
  vi.mocked(fetchInstagramProfile).mockResolvedValue({
    id: '17841400000000000', userId: '9988776655', username: 'thiago.figueiredo',
  })
  vi.mocked(writeAccessToken).mockImplementation((plain: string) => `v1:${plain}`)
  vi.mocked(openSyncRow).mockResolvedValue('log-1')
  mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'thiago.figueiredo', ig_user_id: '17841400000000000', ig_user_id_source: 'oauth' } })
  exchangeOk()
})

describe('GET /api/instagram/oauth/callback', () => {
  it('declares maxDuration = 120 (plano Pro)', () => {
    expect(maxDuration).toBe(120)
  })

  it('connects, writes v1: token + identity, zeroes the episode and answers success', async () => {
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('"success":true')
    expect(html).toContain('Connected!')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')
    const patch = updateSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch.access_token).toBe('v1:long-lived-token')
    expect(patch.ig_user_id).toBe('17841400000000000')
    expect(patch.ig_professional_id).toBe('9988776655')
    expect(patch.ig_user_id_source).toBe('oauth')
    expect(patch.handle).toBe('thiago.figueiredo')
    expect(patch.token_error).toBeNull()
    expect(patch.token_error_at).toBeNull()
    expect(patch.token_error_mode).toBeNull()
    expect(patch.token_alert_sent_at).toBeNull()
    expect(patch.token_alert_attempt_at).toBeNull()
    expect(patch.token_reprobe_at).toBeNull()
    expect(typeof patch.token_refreshed_at).toBe('string')
    expect(writeAccessToken).toHaveBeenCalledWith('long-lived-token')
    expect(recordSocialConsent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: USER, siteId: SITE, category: 'social_feed_read' }),
    )
  })

  it('deletes the nonce cookie with the same Path on every response', async () => {
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(cookieDelete).toHaveBeenCalledWith({ name: '__Secure-ig_oauth_nonce', path: '/api/instagram/oauth' })
  })

  it('reconnects every profile row of the site in one click (pt + en)', async () => {
    mockDb({
      target: { id: ACCOUNT, site_id: SITE, handle: 'thiago.figueiredo', ig_user_id: '17841400000000000', ig_user_id_source: 'oauth' },
      updated: [{ id: ACCOUNT, site_id: SITE }, { id: 'other-row', site_id: SITE }],
    })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"success":true')
    expect(updateSpy).toHaveBeenCalledTimes(1)
  })

  it('answers write_failed when the update matches 0 rows', async () => {
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'thiago.figueiredo', ig_user_id: '17841400000000000', ig_user_id_source: 'oauth' }, updated: [] })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"code":"write_failed"')
    expect(Sentry.captureMessage).toHaveBeenCalledWith('instagram oauth write matched 0 rows', 'warning')
  })

  it('answers write_failed when the update errors', async () => {
    mockDb({
      target: { id: ACCOUNT, site_id: SITE, handle: 'thiago.figueiredo', ig_user_id: '17841400000000000', ig_user_id_source: 'oauth' },
      updateError: { message: 'boom' },
    })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"code":"write_failed"')
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it('answers write_failed when writeAccessToken throws', async () => {
    vi.mocked(writeAccessToken).mockImplementation(() => { throw new Error('VaultUnavailableError') })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"code":"write_failed"')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('answers 400 browser_changed when the nonce cookie is absent, before verifyState', async () => {
    cookieGet.mockReturnValue(undefined)
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(400)
    const html = await res.text()
    expect(html).toContain('"code":"browser_changed"')
    expect(html).toContain('Authorization finished in a different browser')
  })

  it('answers 400 invalid_state when the nonce is present but diverges', async () => {
    cookieGet.mockImplementation((name: string) =>
      name === '__Secure-ig_oauth_nonce' ? { name, value: 'other-nonce' } : undefined)
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('"code":"invalid_state"')
  })

  it('answers 400 invalid_state for a well-signed but expired state, writing nothing', async () => {
    const now = Date.parse('2026-09-06T12:00:00Z')
    vi.useFakeTimers({ now, toFake: ['Date'] })
    const stale = validState({ exp: Math.floor(now / 1000) - 1 })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(stale)}`))
    expect(res.status).toBe(400)
    const html = await res.text()
    expect(html).toContain('Invalid or expired authorization')
    expect(updateSpy).not.toHaveBeenCalled()
    expect(recordSocialConsent).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('answers 400 when the request origin does not match state.origin (site A on host B)', async () => {
    vi.mocked(resolveOAuthOrigin).mockReturnValue('https://other-site.com')
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('"code":"invalid_state"')
  })

  it('answers cancelled with targetOrigin = state.origin and writes nothing', async () => {
    const res = await GET(req(`?error=access_denied&error_reason=user_denied&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('"code":"cancelled"')
    expect(html).toContain(ORIGIN)
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('answers 401 session_changed when the session is gone or belongs to another user', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'unauthenticated' } as never)
    const a = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(a.status).toBe(401)
    expect(await a.text()).toContain('"code":"session_changed"')

    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'someone-else' } } as never)
    const b = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(b.status).toBe(401)
    expect(await b.text()).toContain('"code":"session_changed"')
  })

  it('is NOT subject to assertSameOriginFetch (cross-site is not 403 here)', async () => {
    const res = await GET(new NextRequest(
      `${ORIGIN}/api/instagram/oauth/callback?code=abc&state=${encodeURIComponent(validState())}`,
      { headers: { 'Sec-Fetch-Site': 'cross-site' } },
    ))
    expect(res.status).toBe(200)
  })

  it('shows only the numeric code from a flat Meta error, never its error_message', async () => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error_type: 'OAuthException', code: 400, error_message: 'redirect_uri does not match' }),
    })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    const html = await res.text()
    expect(html).toContain('Instagram rejected the authorization (code 400)')
    expect(html).not.toContain('redirect_uri does not match')
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })

  it('falls back to the bare sentence when the Meta error body has no code', async () => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error_message: 'nope' }) })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    const html = await res.text()
    expect(html).toContain('Instagram rejected the authorization')
    expect(html).not.toContain('(code')
  })

  it('answers permission_denied when instagram_business_basic is missing from permissions', async () => {
    mockFetch.mockReset()
    exchangeOk('instagram_business_manage_messages')
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"code":"permission_denied"')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('answers exchange_failed when the long-lived exchange or /me throws', async () => {
    mockFetch.mockReset()
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ access_token: 'short', user_id: 1, permissions: 'instagram_business_basic' }] }) })
      .mockRejectedValueOnce(new Error('timeout'))
    const a = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await a.text()).toContain('"code":"exchange_failed"')

    mockFetch.mockReset(); exchangeOk()
    vi.mocked(fetchInstagramProfile).mockRejectedValue(new Error('boom'))
    const b = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await b.text()).toContain('"code":"exchange_failed"')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('uses me.id for ig_user_id and warns once when the exchange user_id differs', async () => {
    vi.mocked(fetchInstagramProfile).mockResolvedValue({ id: '17841499999999999', userId: '9988776655', username: 'thiago.figueiredo' })
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'thiago.figueiredo', ig_user_id: '17841499999999999', ig_user_id_source: 'oauth' } })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"success":true')
    expect((updateSpy.mock.calls[0]?.[0] as Record<string, unknown>).ig_user_id).toBe('17841499999999999')
    expect(Sentry.captureMessage).toHaveBeenCalledWith('instagram id spaces differ', 'warning')
  })

  it('falls back to the exchange user_id when /me has no id, without warning', async () => {
    vi.mocked(fetchInstagramProfile).mockResolvedValue({ id: null, userId: '9988776655', username: 'thiago.figueiredo' })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"success":true')
    expect((updateSpy.mock.calls[0]?.[0] as Record<string, unknown>).ig_user_id).toBe('17841400000000000')
    expect(Sentry.captureMessage).not.toHaveBeenCalledWith('instagram id spaces differ', 'warning')
  })

  it('stores ig_professional_id = null when /me returns no user_id', async () => {
    vi.mocked(fetchInstagramProfile).mockResolvedValue({ id: '17841400000000000', userId: null, username: 'thiago.figueiredo' })
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect((updateSpy.mock.calls[0]?.[0] as Record<string, unknown>).ig_professional_id).toBeNull()
  })

  it('stores ig_professional_id = null (never fails) when it is malformed', async () => {
    vi.mocked(fetchInstagramProfile).mockResolvedValue({ id: '17841400000000000', userId: 'not-a-number', username: 'thiago.figueiredo' })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"success":true')
    expect((updateSpy.mock.calls[0]?.[0] as Record<string, unknown>).ig_professional_id).toBeNull()
    expect(Sentry.captureMessage).toHaveBeenCalledWith('instagram professional id malformed', 'warning')
  })

  it('answers identity_invalid when both ids are absent, when the id is malformed and when the username is malformed', async () => {
    mockFetch.mockReset()
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ access_token: 'short', permissions: 'instagram_business_basic' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'long-lived-token', expires_in: 5_184_000 }) })
    vi.mocked(fetchInstagramProfile).mockResolvedValue({ id: null, userId: null, username: 'thiago.figueiredo' })
    expect(await (await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))).text())
      .toContain('"code":"identity_invalid"')

    mockFetch.mockReset(); exchangeOk()
    vi.mocked(fetchInstagramProfile).mockResolvedValue({ id: '178414000000000000000000000000000', userId: null, username: 'thiago.figueiredo' })
    expect(await (await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))).text())
      .toContain('"code":"identity_invalid"')

    mockFetch.mockReset(); exchangeOk()
    vi.mocked(fetchInstagramProfile).mockResolvedValue({ id: '17841400000000000', userId: null, username: 'Not A Handle!' })
    expect(await (await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))).text())
      .toContain('"code":"identity_invalid"')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('offers a mismatch banner (no write) when an oauth row has a different id and there is no rebind', async () => {
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'other.handle', ig_user_id: '17840000000000001', ig_user_id_source: 'oauth' } })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('"status":"handle_mismatch"')
    expect(updateSpy).not.toHaveBeenCalled()
    expect(cookieSet).toHaveBeenCalledWith(expect.objectContaining({
      name: '__Secure-ig_handle_mismatch', httpOnly: true, sameSite: 'lax',
      maxAge: 600, path: '/cms/settings',
    }))
    const cookieValue = vi.mocked(cookieSet).mock.calls[0]?.[0].value as string
    const p = verifyState(cookieValue, key(), { typ: 'mismatch', requireExp: true })
    expect(p?.authorizedIgUserId).toBe('17841400000000000')
    expect(p?.authorizedHandle).toBe('thiago.figueiredo')
    expect(p?.accountId).toBe(ACCOUNT)
  })

  it('writes when allowRebindTo matches the authorized id', async () => {
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'other.handle', ig_user_id: '17840000000000001', ig_user_id_source: 'oauth' } })
    const st = validState({ allowRebindTo: '17841400000000000' })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(st)}`))
    expect(await res.text()).toContain('"success":true')
    expect(updateSpy).toHaveBeenCalledTimes(1)
  })

  it('reconnects a legacy row whose handle matches even with an ig_user_id from another app', async () => {
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'thiago.figueiredo', ig_user_id: '999', ig_user_id_source: 'legacy' } })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"success":true')
  })

  it('offers a mismatch (no write) for a legacy row with a different handle', async () => {
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'someone.else', ig_user_id: '17841400000000000', ig_user_id_source: 'legacy' } })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"status":"handle_mismatch"')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('never rewrites oauth rows by handle nor legacy rows by id (or-filter shape)', async () => {
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    const filter = orSpy.mock.calls[0]?.[0] as string
    expect(filter).toContain(`id.eq.${ACCOUNT}`)
    expect(filter).toContain('and(ig_user_id.eq.17841400000000000,ig_user_id_source.eq.oauth)')
    expect(filter).toContain('and(handle.eq.thiago.figueiredo,ig_user_id_source.eq.legacy)')
  })

  it('answers 404 account_not_found when the target row is gone', async () => {
    mockDb({ target: null })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(404)
    expect(await res.text()).toContain('"code":"account_not_found"')
  })

  it('gates on configuration before anything else', async () => {
    delete process.env.INSTAGRAM_APP_SECRET
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(503)
    expect(await res.text()).toContain('"code":"not_configured"')
  })

  it('carries the CSP nonce, message type, provider, targetOrigin and backHref in the HTML', async () => {
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    const html = await res.text()
    expect(html).toContain('csp-nonce-1')
    expect(html).toContain('"type":"instagram-oauth-result"')
    expect(html).toContain('"provider":"instagram"')
    expect(html).toContain(ORIGIN)
    expect(html).toContain('/cms/settings/instagram')
  })
})

describe('GET /api/instagram/oauth/callback — post-OAuth sync', () => {
  beforeEach(() => {
    afterCallbacks.length = 0
    vi.mocked(openSyncRow).mockResolvedValue('log-1')
    vi.mocked(syncInstagramAccount).mockResolvedValue({
      postsFound: 12, postsInserted: 12, postsUpdated: 0, mediaCached: 12,
      partial: false, mediaFailed: 0,
    } as never)
  })

  it('opens the started row with the filtered permissions BEFORE scheduling after()', async () => {
    mockFetch.mockReset()
    exchangeOk('instagram_business_basic,instagram_business_manage_comments,bogus_scope')
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(openSyncRow).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: ACCOUNT }),
      'manual',
      { detail: 'instagram_business_basic,instagram_business_manage_comments' },
    )
    expect(afterCallbacks).toHaveLength(1)
    expect(syncInstagramAccount).not.toHaveBeenCalled()   // só roda dentro do after()
  })

  it('runs the sync with a deadline, closes the row and revalidates when posts changed', async () => {
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    await afterCallbacks[0]?.()
    expect(syncInstagramAccount).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: ACCOUNT }),
      'long-lived-token',
      expect.objectContaining({ deadlineAt: expect.any(Number) }),
    )
    expect(closeSyncRow).toHaveBeenCalledWith(expect.anything(), 'log-1', expect.objectContaining({ postsInserted: 12 }))
    expect(revalidateTag).toHaveBeenCalledWith('instagram-feed', { expire: 0 })
  })

  it('does not revalidate when nothing changed', async () => {
    vi.mocked(syncInstagramAccount).mockResolvedValue({
      postsFound: 12, postsInserted: 0, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 0,
    } as never)
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    await afterCallbacks[0]?.()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('MUST NOT mark the token invalid nor alert when the post-OAuth sync fails', async () => {
    vi.mocked(syncInstagramAccount).mockRejectedValue(
      Object.assign(new Error('Invalid OAuth access token'), { type: 'OAuthException', code: 190 }),
    )
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    await afterCallbacks[0]?.()
    expect(closeSyncRow).toHaveBeenCalledWith(expect.anything(), 'log-1', null, expect.stringContaining('Invalid OAuth access token'))
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      { tags: { component: 'instagram-oauth-postsync' } },
    )
    expect(updateSpy).toHaveBeenCalledTimes(1)   // só a escrita de conexão
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('warns when the sync log row could not be opened', async () => {
    vi.mocked(openSyncRow).mockResolvedValue(null)
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(Sentry.captureMessage).toHaveBeenCalledWith('instagram oauth: sync log row missing', 'warning')
  })

  it('writes the rebind audit trail when the identity changed', async () => {
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'old.handle', ig_user_id: '17840000000000001', ig_user_id_source: 'oauth' } })
    const st = validState({ allowRebindTo: '17841400000000000' })
    await GET(req(`?code=abc&state=${encodeURIComponent(st)}`))
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      account_id: ACCOUNT, site_id: SITE, mode: 'rebind', status: 'completed',
      error_message: 'identity: @old.handle/17840000000000001 → @thiago.figueiredo/17841400000000000',
    }))
  })

  it('writes no rebind trail when the identity is unchanged', async () => {
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    const calls = insertSpy.mock.calls.filter((c) => (c[0] as { mode?: string }).mode === 'rebind')
    expect(calls).toHaveLength(0)
  })
})
