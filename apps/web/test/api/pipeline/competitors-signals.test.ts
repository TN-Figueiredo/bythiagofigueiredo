// @vitest-environment node
// F2 T8: as rotas GET /competitors/signals e POST /competitors/signals/[id]/dismiss. O serviço é o REAL, sobre um cliente sintético.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PipelineServiceError, type ServiceContext } from '@/lib/pipeline/services/types'
import { fakeSb, type Consulta, type Resposta } from '../../youtube/observatorio/sinais/fake-sb'

const SITE = '11111111-1111-4111-8111-111111111111'
const SINAL = '22222222-2222-4222-8222-222222222222'
const estado = vi.hoisted(() => ({ ctx: null as unknown, auth: null as unknown }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateRead: vi.fn(async () => ({ ok: true, auth: estado.auth })),
  authenticateWrite: vi.fn(async () => ({ ok: true, auth: estado.auth })),
  pipelineError: vi.fn((code: string, msg: string, status: number) => new Response(JSON.stringify({ error: { code, message: msg } }), { status })),
  pipelineSuccess: vi.fn((data: unknown, status: number) => new Response(JSON.stringify({ data }), { status })),
}))
vi.mock('@/lib/pipeline/services/http-adapter', () => ({
  authToServiceContext: vi.fn(() => estado.ctx),
  serviceErrorToResponse: vi.fn((err: unknown) => {
    if (err instanceof PipelineServiceError) return new Response(JSON.stringify({ error: { code: err.code, message: err.message } }), { status: err.status })
    return new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR' } }), { status: 500 })
  }),
}))

import { GET } from '@/app/api/pipeline/youtube/competitors/signals/route'
import { POST } from '@/app/api/pipeline/youtube/competitors/signals/[id]/dismiss/route'

const AGORA_ISO = new Date().toISOString()
const linha = { id: SINAL, kind: 'destino', subject_key: 'pais:JP', acao: 'video_novo', forca: 9.5, motivo: 'dois canais estouraram', rule_version: 'sinais-v1+semente-1', first_seen_at: AGORA_ISO, expires_at: new Date(Date.now() + 864e5).toISOString(),
  evidence: { outliers: [{ video_id: 'o1', canal_id: 'c1', published_at: AGORA_ISO, mult_vpd7: 6, mult_tela: 3, vpd7: 900, formato: 'long' }], outliers_total: 2, canais: 2, proprios: [] } }

let rpcResposta: unknown = { ok: true }
function montar(permissoes: string[], sinais: unknown[] = [linha]) {
  const w = fakeSb((c: Consulta): Resposta => {
    if (c.tabela === 'rpc:niche_signals_dispensar') return { data: rpcResposta }
    if (c.tabela === 'niche_signals') return { data: sinais, count: sinais.length }
    if (c.tabela === 'niche_signals_estado') return { data: [{ computed_at: AGORA_ISO, motivo_vazio: null, contagens: { canais_total: 3 } }] }
    if (c.tabela === 'video_lugares') return { data: [{ video_id: 'x' }] }
    return { data: [] }
  })
  const ctx: ServiceContext = { siteId: SITE, permissions: permissoes as ServiceContext['permissions'], keyId: 'chave-1', supabase: w.sb, source: 'api_key' }
  estado.ctx = ctx
  estado.auth = { siteId: SITE, permissions: permissoes, source: 'api_key', keyId: 'chave-1' }
  return w
}
const get = (q = '') => GET(new NextRequest(`http://localhost/api/pipeline/youtube/competitors/signals${q}`))
const post = (corpo: unknown, id = SINAL) => POST(
  new NextRequest(`http://localhost/api/pipeline/youtube/competitors/signals/${id}/dismiss`, { method: 'POST', body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) }),
  { params: Promise.resolve({ id }) },
)

beforeEach(() => { rpcResposta = { ok: true } })

describe('GET /competitors/signals', () => {
  it('devolve n, itens com id e subject_key, motivoVazio e a ação derivada; sem texto de terceiro nem URL de imagem', async () => {
    montar(['read'])
    const r = await get()
    expect(r.status).toBe(200)
    const { data } = await r.json() as { data: { n: number; itens: Array<Record<string, unknown>>; motivoVazio: unknown; calculoLigado: boolean } }
    expect(data.n).toBe(1)
    expect(data.itens[0]).toMatchObject({ id: SINAL, subject_key: 'pais:JP', acao: 'video_novo', acao_gravada: 'video_novo', proprios_agora: [] })
    expect(data.motivoVazio).toBeNull()
    const texto = JSON.stringify(data)
    expect(texto).not.toMatch(/"(title|titulo|thumbnail|thumbnail_url|comment|texto)"|https?:\/\//i)
    expect(Object.keys((data.itens[0] as { evidence: Record<string, unknown> }).evidence).sort()).toEqual(['canais', 'outliers', 'outliers_total', 'proprios'])
    expect(Object.keys((data.itens[0] as { evidence: { outliers: Array<Record<string, unknown>> } }).evidence.outliers[0]!).sort())
      .toEqual(['canal_id', 'formato', 'mult_tela', 'mult_vpd7', 'published_at', 'video_id', 'vpd7'])
  })

  it('limit chega à consulta (máximo 50)', async () => {
    const w = montar(['read'])
    await get('?limit=7')
    expect(w.consultas.find((c) => c.tabela === 'niche_signals')!.limite).toBe(7)
    const w2 = montar(['read'])
    await get('?limit=900')
    expect(w2.consultas.find((c) => c.tabela === 'niche_signals')!.limite).toBe(50)
  })

  it('lista vazia traz o motivo, nunca mudo', async () => {
    montar(['read'], [])
    const { data } = await (await get()).json() as { data: { n: number; motivoVazio: string | null } }
    expect(data.n).toBe(0)
    expect(data.motivoVazio).not.toBeNull()
  })
})

describe('POST /competitors/signals/[id]/dismiss', () => {
  it('chave write dispensa e grava dispensado_por com a chave', async () => {
    const w = montar(['write'])
    const r = await post({ status: 'dispensado', motivo: 'ja_fiz' })
    expect(r.status).toBe(200)
    expect(w.rpc[0]).toEqual({ nome: 'niche_signals_dispensar', args: { p_site: SITE, p_id: SINAL, p_status: 'dispensado', p_motivo: 'ja_fiz', p_por: 'key:chave-1' } })
  })

  it('chave só read: 403 FORBIDDEN e nada é chamado', async () => {
    const w = montar(['read'])
    const r = await post({ status: 'dispensado', motivo: 'ja_fiz' })
    expect(r.status).toBe(403)
    expect(w.rpc).toEqual([])
  })

  it("status 'feito' é recusado (E-1): 400, nada é chamado", async () => {
    const w = montar(['write'])
    expect((await post({ status: 'feito', motivo: 'ja_fiz' })).status).toBe(400)
    expect((await post({ status: 'dispensado' })).status).toBe(400)
    expect((await post({ status: 'dispensado', motivo: 'inventado' })).status).toBe(400)
    expect((await post({ status: 'dispensado', motivo: 'ja_fiz', extra: 1 })).status).toBe(400)
    expect((await post('não é json')).status).toBe(400)
    expect((await post({ status: 'dispensado', motivo: 'ja_fiz' }, 'nao-e-uuid')).status).toBe(400)
    expect(w.rpc).toEqual([])
  })

  it('id de outro site: 404; já respondido: 409; motivo que não cabe no tipo: 422', async () => {
    montar(['write'])
    rpcResposta = { ok: false, motivo: 'nao_encontrado' }
    expect((await post({ status: 'dispensado', motivo: 'ja_fiz' })).status).toBe(404)
    rpcResposta = { ok: false, motivo: 'nao_aberto' }
    expect((await post({ status: 'dispensado', motivo: 'ja_fiz' })).status).toBe(409)
    rpcResposta = { ok: false, motivo: 'motivo_invalido' }
    expect((await post({ status: 'dispensado', motivo: 'nao_e_parecido' })).status).toBe(422)
  })
})
