// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  NoActiveConnectionError: class extends Error {},
  TokenRevokedError: class extends Error {},
  requireSiteScope: vi.fn(),
  getSiteContext: vi.fn(),
  ensureFreshToken: vi.fn(),
  defaultOwnChannel: vi.fn(),
  channelResult: { data: null as unknown, error: null as unknown },
  connResult: { data: null as unknown, error: null as unknown },
  channelEq: [] as Array<[string, string]>,
  capture: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: h.getSiteContext }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: h.requireSiteScope }))
vi.mock('@sentry/nextjs', () => ({ captureException: h.capture, captureMessage: h.captureMessage }))
vi.mock('@/lib/youtube/default-channel', () => ({ defaultOwnChannel: h.defaultOwnChannel }))
vi.mock('@/lib/social/token-refresh', () => ({
  ensureFreshToken: h.ensureFreshToken,
  NoActiveConnectionError: h.NoActiveConnectionError,
  TokenRevokedError: h.TokenRevokedError,
}))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      const result = () => (table === 'youtube_channels' ? h.channelResult : h.connResult)
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.is = () => chain
      chain.eq = (c: string, v: string) => {
        if (table === 'youtube_channels') h.channelEq.push([c, v])
        return chain
      }
      chain.maybeSingle = () => Promise.resolve(result())
      return chain
    },
  }),
}))

import { POST } from '../../../src/app/api/social/youtube/upload-session/route'

const SITE = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const CH_UUID = '11111111-2222-3333-4444-555555555555'
const TOKEN = 'ya29.SECRET-TOKEN'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/social/youtube/upload-session', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}
const base = { title: 'Meu vídeo', privacyStatus: 'private' as const }

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  h.channelEq.length = 0
  h.getSiteContext.mockResolvedValue({ siteId: SITE })
  h.requireSiteScope.mockResolvedValue({ ok: true })
  h.channelResult = { data: { channel_id: 'UCabc', name: 'Canal PT' }, error: null }
  h.connResult = { data: { scopes: ['youtube.upload', 'youtube'] }, error: null }
  h.ensureFreshToken.mockResolvedValue({ accessToken: TOKEN, connectionId: 'c1' })
  h.defaultOwnChannel.mockResolvedValue({ id: CH_UUID, channelId: 'UCdefault', name: 'Padrão', hasConnection: true })
  fetchMock = vi.fn().mockResolvedValue(
    new Response('{}', { status: 200, headers: { location: 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=XYZ' } }),
  )
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('POST /api/social/youtube/upload-session', () => {
  it('sem permissão: 403 e nada é lido', async () => {
    h.requireSiteScope.mockResolvedValue({ ok: false })
    const res = await POST(req({ ...base, channel: 'UCabc' }))
    expect(res.status).toBe(403)
    expect(h.ensureFreshToken).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('corpo inválido: 400', async () => {
    expect((await POST(req({ title: '' }))).status).toBe(400)
    expect((await POST(req({ ...base, channel: 'nao-e-canal' }))).status).toBe(400)
  })

  it('canal de outro site: 404, filtrado por site, sem token', async () => {
    h.channelResult = { data: null, error: null }
    const res = await POST(req({ ...base, channel: 'UCoutro' }))
    expect(res.status).toBe(404)
    expect(h.channelEq).toContainEqual(['site_id', SITE])
    expect(h.ensureFreshToken).not.toHaveBeenCalled()
  })

  it('aceita o uuid de youtube_channels', async () => {
    const res = await POST(req({ ...base, channel: CH_UUID }))
    expect(res.status).toBe(200)
    expect(h.channelEq).toContainEqual(['id', CH_UUID])
  })

  it('canal sem conexão: 409 claro (linha ausente e NoActiveConnectionError)', async () => {
    h.connResult = { data: null, error: null }
    let res = await POST(req({ ...base, channel: 'UCabc' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('Connect the channel')

    h.connResult = { data: { scopes: ['youtube.upload'] }, error: null }
    h.ensureFreshToken.mockRejectedValue(new h.NoActiveConnectionError('x'))
    res = await POST(req({ ...base, channel: 'UCabc' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('channel_not_connected')
  })

  it('sem o escopo youtube.upload: 403 pedindo reconexão, sem chamar o Google', async () => {
    h.connResult = { data: { scopes: ['youtube', 'yt-analytics.readonly'] }, error: null }
    const res = await POST(req({ ...base, channel: 'UCabc' }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe('missing_scope')
    expect(json.error).toContain('Reconnect')
    expect(h.ensureFreshToken).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('token revogado: 409 pedindo reconexão', async () => {
    h.ensureFreshToken.mockRejectedValue(new h.TokenRevokedError('x'))
    const res = await POST(req({ ...base, channel: 'UCabc' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('token_revoked')
  })

  it('caminho feliz: chama o Google certo e não vaza o token', async () => {
    const res = await POST(req({ ...base, channel: 'UCabc', contentType: 'video/mp4', contentLength: 1234 }))
    expect(res.status).toBe(200)
    expect(h.ensureFreshToken).toHaveBeenCalledWith(SITE, 'youtube', 'UCabc')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(headers['X-Upload-Content-Type']).toBe('video/mp4')
    expect(headers['X-Upload-Content-Length']).toBe('1234')
    expect(JSON.parse(init.body as string).snippet.title).toBe('Meu vídeo')

    const text = JSON.stringify(await res.json())
    expect(text).toContain('upload_id=XYZ')
    expect(text).not.toContain(TOKEN)
  })

  it('sem canal no corpo: usa o canal padrão', async () => {
    const res = await POST(req(base))
    expect(res.status).toBe(200)
    expect(h.defaultOwnChannel).toHaveBeenCalledTimes(1)
    expect(h.ensureFreshToken).toHaveBeenCalledWith(SITE, 'youtube', 'UCdefault')
  })

  it('site sem canal e sem canal pedido: 404', async () => {
    h.defaultOwnChannel.mockResolvedValue(null)
    expect((await POST(req(base))).status).toBe(404)
  })

  it('erro do Google: 502 sem o corpo do Google', async () => {
    fetchMock.mockResolvedValue(new Response('quotaExceeded internal detail ' + TOKEN, { status: 403 }))
    const res = await POST(req({ ...base, channel: 'UCabc' }))
    expect(res.status).toBe(502)
    const text = JSON.stringify(await res.json())
    expect(text).toContain('403')
    expect(text).not.toContain('quotaExceeded')
    expect(text).not.toContain(TOKEN)
  })

  it('falha de rede no Google: 502 genérico', async () => {
    fetchMock.mockRejectedValue(new Error('boom ' + TOKEN))
    const res = await POST(req({ ...base, channel: 'UCabc' }))
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain(TOKEN)
  })

  it('erro de banco na conexão: 500 sem texto do Postgres', async () => {
    h.connResult = { data: null, error: { message: 'relation secret_table timeout' } }
    const res = await POST(req({ ...base, channel: 'UCabc' }))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('secret_table')
  })
})
