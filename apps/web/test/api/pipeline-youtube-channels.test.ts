// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PipelineAuth } from '@/lib/pipeline/auth'
import { fakePostgrest, type FakePostgrestOptions } from '../helpers/fake-postgrest'

vi.mock('@/lib/pipeline/auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/auth')>()),
  authenticatePipeline: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))

import { authenticatePipeline } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { GET } from '@/app/api/pipeline/youtube/channels/route'

const SITE = 'site-1'
const URL_ = 'http://localhost/api/pipeline/youtube/channels'

function keyAuth(permissions: string[]): PipelineAuth {
  return { siteId: SITE, permissions, source: 'api_key', keyHash: 'h', keyId: 'k' } as PipelineAuth
}
function asKey(permissions: string[]) {
  vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth: keyAuth(permissions) })
}
function useDb(opts: FakePostgrestOptions) {
  const sb = fakePostgrest(opts)
  vi.mocked(getSupabaseServiceClient).mockReturnValue(sb.client as never)
  return sb
}
function row(over: Record<string, unknown>) {
  return {
    id: 'c1', site_id: SITE, channel_id: 'UCx', slug: 'tnfigueiredotv', name: 'Canal', handle: '@canal', locale: 'pt',
    niche: 'viagem', subscriber_count: 10, video_count: 2, sync_enabled: true, last_synced_at: null,
    created_at: '2026-01-01T00:00:00Z',
    // colunas sensíveis que existem na linha e NUNCA podem sair
    access_token: 'SECRET-ACCESS', refresh_token: 'SECRET-REFRESH', oauth_connection_id: 'oc', api_key: 'k',
    ...over,
  }
}
const NICHES = [{ site_id: SITE, slug: 'viagem', label: 'Viagem', color_dark: '#111', color_light: '#222', sort_order: 10 }]

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/pipeline/youtube/channels', () => {
  it('sem chave → 401', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, error: 'Missing API key', status: 401 } as never)
    const res = await GET(new Request(URL_) as never)
    expect(res.status).toBe(401)
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })

  it('chave sem leitura nem inteligência → 403, sem tocar o banco', async () => {
    asKey([])
    const res = await GET(new Request(URL_) as never)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })

  it.each([['read'], ['intelligence'], ['read', 'intelligence'], ['write'], ['admin']])('chave com %s → 200', async (...perms) => {
    asKey(perms)
    useDb({ tables: { youtube_channels: [row({})], youtube_niches: NICHES } })
    const res = await GET(new Request(URL_) as never)
    expect(res.status).toBe(200)
  })

  it('sessão do CMS (read+write) também passa', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth: { siteId: SITE, permissions: ['read', 'write'], source: 'session' } as PipelineAuth })
    useDb({ tables: { youtube_channels: [row({})], youtube_niches: NICHES } })
    expect((await GET(new Request(URL_) as never)).status).toBe(200)
  })

  it('devolve os doze campos do contrato, na ordem de cadastro, só do site da chave, e nunca coluna sensível', async () => {
    asKey(['intelligence'])
    useDb({
      tables: {
        youtube_channels: [
          row({ id: 'c-en', slug: 'bythiagofigueiredo', locale: 'en', created_at: '2026-02-01T00:00:00Z' }),
          row({ id: 'c-pt', created_at: '2026-01-01T00:00:00Z' }),
          row({ id: 'c-alheio', site_id: 'site-2', created_at: '2025-01-01T00:00:00Z' }),
        ],
        youtube_niches: NICHES,
      },
    })
    const res = await GET(new Request(URL_) as never)
    const body = await res.json()
    expect(body.data.map((c: { id: string }) => c.id)).toEqual(['c-pt', 'c-en'])
    expect(Object.keys(body.data[0]).sort()).toEqual([
      'channel_id', 'handle', 'id', 'last_synced_at', 'locale', 'name', 'niche', 'niche_label', 'slug',
      'subscriber_count', 'sync_enabled', 'video_count',
    ])
    expect(body.data[0]).toMatchObject({ slug: 'tnfigueiredotv', niche: 'viagem', niche_label: 'Viagem', locale: 'pt' })
    const text = JSON.stringify(body)
    expect(text).not.toMatch(/SECRET|access_token|refresh_token|oauth|api_key|site_id/)
  })

  it('site sem canal → 200 com data []', async () => {
    asKey(['read'])
    useDb({ tables: { youtube_channels: [row({ site_id: 'site-2' })], youtube_niches: NICHES } })
    const res = await GET(new Request(URL_) as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [] })
  })

  it('canal sem nicho → niche e niche_label null', async () => {
    asKey(['read'])
    useDb({ tables: { youtube_channels: [row({ niche: null })], youtube_niches: NICHES } })
    const body = await (await GET(new Request(URL_) as never)).json()
    expect(body.data[0]).toMatchObject({ niche: null, niche_label: null })
  })

  it('banco sem a coluna slug (42703) → slug null, 200', async () => {
    asKey(['read'])
    const rows = [row({})].map(({ slug: _s, ...rest }) => rest)
    useDb({ tables: { youtube_channels: rows, youtube_niches: NICHES } })
    const res = await GET(new Request(URL_) as never)
    expect(res.status).toBe(200)
    expect((await res.json()).data[0].slug).toBeNull()
  })

  it('erro do banco → 500 sem vazar a mensagem interna, e nunca lista vazia', async () => {
    asKey(['read'])
    useDb({
      tables: { youtube_channels: [row({})] },
      fail: q => (q.table === 'youtube_channels' ? { code: '57014', message: 'canceling statement: relation "youtube_channels" secret-host.internal' } : null),
    })
    const res = await GET(new Request(URL_) as never)
    expect(res.status).toBe(500)
    const text = JSON.stringify(await res.json())
    expect(text).toContain('INTERNAL_ERROR')
    expect(text).not.toMatch(/secret-host|relation|57014|statement/)
  })

  it('exceção inesperada (cliente indisponível) → 500 genérico', async () => {
    asKey(['read'])
    vi.mocked(getSupabaseServiceClient).mockImplementation(() => { throw new Error('boom: postgres://user:pw@host') })
    const res = await GET(new Request(URL_) as never)
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toMatch(/boom|postgres:/)
  })

  it('a resposta leva os cabeçalhos de rate limit de uma chave de API', async () => {
    asKey(['read'])
    useDb({ tables: { youtube_channels: [], youtube_niches: NICHES } })
    const res = await GET(new Request(URL_) as never)
    expect([...res.headers.keys()].some(k => k.toLowerCase().includes('ratelimit') || k.toLowerCase().startsWith('x-ratelimit'))).toBe(true)
  })
})
