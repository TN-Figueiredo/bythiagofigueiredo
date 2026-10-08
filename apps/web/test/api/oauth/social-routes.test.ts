// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Degrau "administrar o site": as rotas de OAuth pedem `requireSiteAdminScope`. Aqui ele é
// dirigido pelo mesmo mock de sessão que estes testes já controlam (`requireSiteScope`), para
// os cenários de "sem sessão" / "sessão trocou" continuarem valendo. A recusa específica da
// editora fica em test/cms/site-admin-step-integracoes.test.ts.
vi.mock('@/lib/cms/auth-guards', async () => {
  const server = await import('@tn-figueiredo/auth-nextjs/server')
  return {
    requireSiteAdminScope: (siteId: string) => server.requireSiteScope({ area: 'cms', siteId, mode: 'edit' }),
    siteAdminOnlyMessage: (acao: string) => `Só quem administra o site pode ${acao}.`,
  }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

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
import * as Sentry from '@sentry/nextjs'
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

function makeServiceClient(
  voltaram: Array<{ id: string }> = [],
  erroUpdate: { code: string } | null = null,
) {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const insert = vi.fn().mockResolvedValue({ error: null })
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { id: 'social_integration_v1_pt-BR' },
    error: null,
  })
  const chamadas: Array<{ tabela: string; op: string; args: unknown[] }> = []
  const chain: Record<string, unknown> = {}
  const from = vi.fn((tabela: string) => {
    const filtros: unknown[] = []
    let op = 'select'
    const cadeia: Record<string, unknown> = {
      upsert,
      insert,
      maybeSingle,
      update: (patch: unknown) => {
        op = 'update'
        chamadas.push({ tabela, op, args: [patch, filtros] })
        return cadeia
      },
      delete: () => {
        op = 'delete'
        chamadas.push({ tabela, op, args: [filtros] })
        return cadeia
      },
      eq: (c: string, v: unknown) => {
        filtros.push([c, v])
        return cadeia
      },
      is: () => cadeia,
      order: () => cadeia,
      limit: () => cadeia,
      select: () => cadeia,
      then: (ok: (v: unknown) => unknown) =>
        Promise.resolve(
          op === 'update'
            ? erroUpdate
              ? { data: null, error: erroUpdate }
              : { data: voltaram, error: null }
            : { data: null, error: null },
        ).then(ok),
    }
    return cadeia
  })
  return { from, chain, upsert, insert, maybeSingle, chamadas }
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

  // -------------------------------------------------------------------
  // Seleção de canal e escopos (2026-09-18).
  //
  // Duas reconexões falharam na prática pelo que o start manda à Meta/Google:
  //   - YouTube: com `prompt=consent` sozinho, o Google reaproveita a sessão
  //     ativa e devolve o canal PADRÃO. Reconectar @tnfigueiredotv (1.2 mil
  //     inscritos) criou conexão para @thiagofigueiredo1301 (0 inscritos), e
  //     repetir repetia o mesmo canal — não havia como escolher.
  //   - Meta: o diálogo recusou o pedido INTEIRO com "Invalid Scopes:
  //     read_insights, instagram_manage_insights". Um escopo indisponível não
  //     degrada o pedido, ele bloqueia o diálogo e derruba a publicação junto.
  // -------------------------------------------------------------------

  it('YouTube: pede o seletor de conta, senão o Google devolve o canal padrão', async () => {
    const res = await START(startReq(), { params: Promise.resolve({ provider: 'google' }) })
    const url = new URL(res.headers.get('location')!)
    const prompt = url.searchParams.get('prompt')
    expect(prompt).toContain('select_account')
    // `consent` continua: é ele que garante o refresh token.
    expect(prompt).toContain('consent')
    expect(url.searchParams.get('access_type')).toBe('offline')
  })

  it('Meta: por padrão NÃO pede os escopos de insights que bloqueiam o diálogo', async () => {
    const res = await START(startReq(), { params: Promise.resolve({ provider: 'meta' }) })
    const scope = new URL(res.headers.get('location')!).searchParams.get('scope') ?? ''
    expect(scope).not.toContain('read_insights')
    expect(scope).not.toContain('instagram_manage_insights')
    // o que a publicação de fato precisa continua sendo pedido
    for (const s of ['pages_show_list', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish']) {
      expect(scope).toContain(s)
    }
  })

  it('Meta: com META_REQUEST_INSIGHTS_SCOPES=1 os escopos de métricas voltam', async () => {
    vi.stubEnv('META_REQUEST_INSIGHTS_SCOPES', '1')
    const res = await START(startReq(), { params: Promise.resolve({ provider: 'meta' }) })
    const scope = new URL(res.headers.get('location')!).searchParams.get('scope') ?? ''
    expect(scope).toContain('read_insights')
    expect(scope).toContain('instagram_manage_insights')
    vi.unstubAllEnvs()
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

  it('returns 403 site_admin_required for insufficient_access (a sessão não administra o site)', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'insufficient_access' })
    const res = await CALLBACK(callbackReq(validState(NOW)), {
      params: Promise.resolve({ provider: 'google' }),
    })
    expect(res.status).toBe(403)
    const html = await res.text()
    expect(html).toContain('"code":"site_admin_required"')
    expect(html).toContain('Só quem administra o site pode conectar uma conta de rede social.')
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

  it('L1b: reconexão devolve o canal em reautorizar a ok e apaga o carimbo do aviso', async () => {
    mockServiceClient = makeServiceClient([{ id: 'canal-uuid-1' }])
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const res = await CALLBACK(callbackReq(validState(NOW)), { params: Promise.resolve({ provider: 'google' }) })
    expect(res.status).toBe(200)

    const up = mockServiceClient.chamadas.find(c => c.tabela === 'youtube_channels' && c.op === 'update')!
    expect(up.args[0]).toEqual({ collection_status: 'ok' })
    expect(up.args[1]).toEqual([['site_id', SITE], ['channel_id', 'ch1'], ['collection_status', 'reautorizar']])

    const del = mockServiceClient.chamadas.find(c => c.tabela === 'ops_alert_state' && c.op === 'delete')!
    expect(del.args[0]).toEqual([['key', 'sync-analytics:canal-uuid-1:reautorizar']])
  })

  it('L1b: canal que não estava em reautorizar (zero linhas) não apaga carimbo nenhum e conecta igual', async () => {
    mockServiceClient = makeServiceClient([])
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const res = await CALLBACK(callbackReq(validState(NOW)), { params: Promise.resolve({ provider: 'google' }) })
    expect(res.status).toBe(200)
    expect(mockServiceClient.chamadas.filter(c => c.tabela === 'ops_alert_state')).toEqual([])
    expect(mockServiceClient.insert).toHaveBeenCalledTimes(1)
  })

  it('L1b: exceção ao devolver o canal a ok não derruba a conexão e o consentimento é gravado', async () => {
    mockServiceClient = makeServiceClient([])
    const original = mockServiceClient.from
    mockServiceClient.from = vi.fn((tabela: string) => {
      if (tabela === 'youtube_channels') throw new Error('banco fora')
      return original(tabela)
    }) as typeof original
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const res = await CALLBACK(callbackReq(validState(NOW)), { params: Promise.resolve({ provider: 'google' }) })
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('"success":true')
    expect(mockServiceClient.insert).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it('L1b: update que devolve error (sem lançar) não derruba a conexão, não apaga carimbo e avisa o Sentry', async () => {
    mockServiceClient = makeServiceClient([{ id: 'canal-uuid-1' }], { code: '57014' })
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const res = await CALLBACK(callbackReq(validState(NOW)), { params: Promise.resolve({ provider: 'google' }) })
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('"success":true')
    expect(mockServiceClient.chamadas.filter(c => c.op === 'delete')).toEqual([])
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
})
