// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let mockServiceClient: ReturnType<typeof makeServiceClient>

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn(),
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-nonce': 'test-nonce-abc', 'x-default-locale': 'pt-BR' }),
}))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockServiceClient,
}))
vi.mock('@tn-figueiredo/social/vault', () => ({
  encrypt: (plain: string) => `v1:${plain}`,
  getMasterKey: () => Buffer.alloc(32),
}))

import { NextRequest } from 'next/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import {
  deriveHmacKey,
  signState,
  verifyState,
  SOCIAL_STATE_LABEL,
  STATE_TTL_SECONDS,
} from '@/lib/oauth/state'
import { GET as START } from '../../../src/app/api/social/oauth/[provider]/route'
import { GET as CALLBACK } from '../../../src/app/api/social/oauth/[provider]/callback/route'

const SITE = '11111111-2222-4333-8444-555555555555'
const USER = '66666666-7777-4888-8999-aaaaaaaaaaaa'
const MASTER = 'f'.repeat(64)
const KEY = deriveHmacKey(MASTER, SOCIAL_STATE_LABEL)
const NOW = Date.UTC(2026, 8, 6, 12, 0, 0)

function startReq(): NextRequest {
  return new NextRequest('https://bythiagofigueiredo.com/api/social/oauth/google')
}

function makeServiceClient() {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const insert = vi.fn().mockResolvedValue({ error: null })
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { id: 'social_integration_v1_pt-BR' },
    error: null,
  })
  const chain: Record<string, unknown> = {
    upsert,
    insert,
    maybeSingle,
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  }
  for (const key of ['select', 'eq', 'is', 'order', 'limit']) {
    ;(chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  }
  const from = vi.fn().mockReturnValue(chain)
  return { from, chain, upsert, insert, maybeSingle }
}

function callbackReq(state: string, code = 'meta-code'): NextRequest {
  return new NextRequest(
    `https://bythiagofigueiredo.com/api/social/oauth/google/callback?code=${code}&state=${encodeURIComponent(state)}`,
    { headers: { 'user-agent': 'Mozilla/5.0 (Test)', 'x-forwarded-for': '203.0.113.9' } },
  )
}

function validState(now: number) {
  return signState(
    { typ: 'state', siteId: SITE, userId: USER, exp: Math.floor(now / 1000) + STATE_TTL_SECONDS },
    KEY,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SOCIAL_MASTER_KEY = MASTER
  process.env.GOOGLE_CLIENT_ID = 'google-client-id'
  process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com'
  vi.mocked(getSiteContext).mockResolvedValue({
    siteId: SITE,
    orgId: 'org',
    defaultLocale: 'en',
    timezone: 'America/Sao_Paulo',
  })
  vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: USER } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('social oauth start', () => {
  it('signs a state with typ, siteId, userId and a 30-minute exp', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const res = await START(startReq(), { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).not.toBeNull()
    const stateParam = new URL(location!).searchParams.get('state')
    expect(stateParam).not.toBeNull()

    const payload = verifyState(stateParam!, KEY, { typ: 'state', requireExp: true })
    expect(payload).not.toBeNull()
    expect(payload!.siteId).toBe(SITE)
    expect(payload!.userId).toBe(USER)
    expect(payload!.exp).toBe(Math.floor(NOW / 1000) + 1800)
  })

  it('signs the same shape for meta', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    process.env.META_APP_ID = 'meta-app-id'
    const res = await START(
      new NextRequest('https://bythiagofigueiredo.com/api/social/oauth/meta'),
      { params: Promise.resolve({ provider: 'meta' }) },
    )
    const stateParam = new URL(res.headers.get('location')!).searchParams.get('state')
    expect(verifyState(stateParam!, KEY, { typ: 'state', requireExp: true })).not.toBeNull()
  })

  it('the signed state stops verifying 31 minutes later', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const res = await START(startReq(), { params: Promise.resolve({ provider: 'google' }) })
    const stateParam = new URL(res.headers.get('location')!).searchParams.get('state')
    vi.setSystemTime(NOW + 31 * 60_000)
    expect(verifyState(stateParam!, KEY, { typ: 'state', requireExp: true })).toBeNull()
  })

  it('still refuses an unauthorized caller with 401 json', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'unauthenticated' })
    const res = await START(startReq(), { params: Promise.resolve({ provider: 'google' }) })
    expect(res.status).toBe(401)
  })
})

describe('social oauth callback — state and session', () => {
  beforeEach(() => {
    mockServiceClient = makeServiceClient()
  })

  it('rejects a state with no exp as 400 invalid_state and writes nothing', async () => {
    const state = signState({ typ: 'state', siteId: SITE, userId: USER }, KEY)
    const res = await CALLBACK(callbackReq(state), {
      params: Promise.resolve({ provider: 'google' }),
    })
    expect(res.status).toBe(400)
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    const html = await res.text()
    expect(html).toContain('Invalid or expired authorization')
    expect(html).toContain('"code":"invalid_state"')
    expect(mockServiceClient.upsert).not.toHaveBeenCalled()
    expect(mockServiceClient.insert).not.toHaveBeenCalled()
  })

  it('rejects a well-signed but EXPIRED state as 400, with no consent write', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const state = validState(NOW)
    vi.setSystemTime(NOW + 31 * 60_000)
    const res = await CALLBACK(callbackReq(state), {
      params: Promise.resolve({ provider: 'google' }),
    })
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Invalid or expired authorization')
    expect(mockServiceClient.upsert).not.toHaveBeenCalled()
    expect(mockServiceClient.insert).not.toHaveBeenCalled()
    expect(requireSiteScope).not.toHaveBeenCalled()
  })

  it('returns 401 session_changed when there is no session, and writes nothing', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'unauthenticated' })
    const res = await CALLBACK(callbackReq(validState(NOW)), {
      params: Promise.resolve({ provider: 'google' }),
    })
    expect(res.status).toBe(401)
    const html = await res.text()
    expect(html).toContain('"code":"session_changed"')
    expect(html).toContain('Session changed during authorization')
    expect(mockServiceClient.upsert).not.toHaveBeenCalled()
    expect(mockServiceClient.insert).not.toHaveBeenCalled()
  })

  it('returns 403 session_changed for insufficient_access', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'insufficient_access' })
    const res = await CALLBACK(callbackReq(validState(NOW)), {
      params: Promise.resolve({ provider: 'google' }),
    })
    expect(res.status).toBe(403)
    expect(await res.text()).toContain('"code":"session_changed"')
  })

  it('returns 401 when the signed-in user is not the one who started the flow', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    vi.mocked(requireSiteScope).mockResolvedValue({
      ok: true,
      user: { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
    })
    const res = await CALLBACK(callbackReq(validState(NOW)), {
      params: Promise.resolve({ provider: 'google' }),
    })
    expect(res.status).toBe(401)
    expect(await res.text()).toContain('"code":"session_changed"')
    expect(mockServiceClient.upsert).not.toHaveBeenCalled()
  })

  it('re-checks the scope against the state siteId, in edit mode', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'unauthenticated' })
    await CALLBACK(callbackReq(validState(NOW)), {
      params: Promise.resolve({ provider: 'google' }),
    })
    expect(requireSiteScope).toHaveBeenCalledWith({ area: 'cms', siteId: SITE, mode: 'edit' })
  })
})

describe('social oauth callback — success path', () => {
  beforeEach(() => {
    mockServiceClient = makeServiceClient()
    process.env.GOOGLE_CLIENT_SECRET = 'google-secret'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('oauth2.googleapis.com/token')) {
          return new Response(
            JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'Bearer' }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        return new Response(
          JSON.stringify({
            items: [{ id: 'ch1', snippet: { title: 'My Channel' }, statistics: {} }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('connects, records consent with insert, and returns 200 html carrying the nonce', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const res = await CALLBACK(callbackReq(validState(NOW)), {
      params: Promise.resolve({ provider: 'google' }),
    })

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('<script nonce="test-nonce-abc">')
    expect(html).toContain('"type":"social-oauth-result"')
    expect(html).toContain('"success":true')
    expect(html).toContain('href="/cms/social/accounts"')

    expect(mockServiceClient.upsert).toHaveBeenCalledTimes(1)
    expect(mockServiceClient.insert).toHaveBeenCalledTimes(1)
    const consentRow = mockServiceClient.insert.mock.calls[0]![0] as Record<string, unknown>
    expect(consentRow.category).toBe('social_integration')
    expect(consentRow.user_id).toBe(USER)
    expect(consentRow.site_id).toBe(SITE)
    expect(consentRow.ip).toBe('203.0.113.9')
  })
})
