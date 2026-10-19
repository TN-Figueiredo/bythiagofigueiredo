// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { criarBanco, type Linha } from '../youtube/teste-youtube/registro/banco-falso'

const SITE = '11111111-1111-4111-8111-111111111111'
const OUTRO = '22222222-2222-4222-8222-222222222222'
const V_UUID = '33333333-3333-4333-8333-333333333333'
const ID1 = '44444444-4444-4444-8444-444444444441'
const ID2 = '44444444-4444-4444-8444-444444444442'
const ID_OUTRO = '44444444-4444-4444-8444-444444444443'

const estado = vi.hoisted(() => ({ sb: null as unknown, mcpSite: '11111111-1111-4111-8111-111111111111' }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => estado.sb }))
vi.mock('@/lib/pipeline/mcp/context', () => ({
  getMcpContext: () => ({ siteId: estado.mcpSite, permissions: ['read'], keyHash: 'h', keyId: 'k' }),
}))
vi.mock('@/lib/pipeline/helpers', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/helpers')>()),
  authenticateRead: vi.fn(async () => ({ ok: true, auth: { siteId: SITE, permissions: ['read'], source: 'api_key', keyHash: 'h', keyId: 'k' } })),
}))

import { GET as listar } from '@/app/api/pipeline/youtube/ab-tests/native/route'
import { GET as obter } from '@/app/api/pipeline/youtube/ab-tests/native/[id]/route'
import { manageAbTest } from '@/lib/pipeline/mcp/services/ab-tests'
import { serializarAvaliacao, serializarRegistro, type LinhaAbNativeTest } from '@/lib/youtube/teste-youtube/registro/serializar'

function registro(o: Partial<LinhaAbNativeTest> & { id: string; site_id: string }): Linha {
  return {
    video_id: V_UUID, youtube_video_id: 'qIg9a7vqcNo', origem: 'detectado', campos: ['titulo'], estado: 'em_andamento',
    variantes_titulo: ['A', 'B'], votos_titulo: { '0': 29, '1': 31 }, titulo_oficial: null,
    primeira_vista: '2026-10-18T10:00:00+00:00', ultima_vista: '2026-10-18T12:00:00+00:00',
    desfecho_estado: null, desfecho_motivo: null, desfecho_em: null, desfecho_versao_regra: null,
    vencedor_titulo: null, vencedor_fonte: null, evidencia: [{ rodada: 'r1' }, { rodada: 'r2' }], evidencia_cortada: false,
    versao_regra: 1, created_at: '2026-10-18T12:00:00+00:00', ...o,
  }
}
function avaliacao(i: number, site = SITE, video = V_UUID): Linha {
  return {
    id: i, site_id: site, video_id: video, avaliada_em: new Date(Date.UTC(2026, 9, 18, 0, i)).toISOString(),
    estado_14: 'provavel_teste', estado_48: 'sem_leitura', motivo_14: null, mistas_48: 2, mistas_48_fora_quarentena: 1,
    min_desde_escrita: [90], erro: null, retroativa: false, aviso: null, contagem: { segredo: 1 }, versao_regra: 1,
  }
}
function mundo() {
  const { sb } = criarBanco({
    ab_native_tests: [
      registro({ id: ID1, site_id: SITE, created_at: '2026-10-18T12:00:00+00:00' }),
      registro({ id: ID2, site_id: SITE, estado: 'encerrado', youtube_video_id: 'AAAAAAAAAAA', created_at: '2026-10-17T12:00:00+00:00' }),
      registro({ id: ID_OUTRO, site_id: OUTRO }),
    ],
    ab_native_avaliacoes: Array.from({ length: 25 }, (_, i) => avaliacao(i + 1)),
  })
  estado.sb = sb
}
const req = (u: string) => new NextRequest('http://localhost' + u)
const corpo = async (r: Response) => (await r.json()) as { data?: any; error?: { code: string } }

describe('GET native', () => {
  beforeEach(mundo)
  it('sem filtro devolve só o site do contexto', async () => {
    const r = await listar(req('/api/pipeline/youtube/ab-tests/native'))
    expect(r.status).toBe(200)
    const { data } = await corpo(r)
    expect(data.testes.map((t: { id: string }) => t.id)).toEqual([ID1, ID2])
  })
  it('estado fora do enum -> 400 VALIDATION_ERROR', async () => {
    const r = await listar(req('/api/pipeline/youtube/ab-tests/native?estado=x'))
    expect(r.status).toBe(400)
    expect((await corpo(r)).error?.code).toBe('VALIDATION_ERROR')
  })
  it('estado válido filtra', async () => {
    const { data } = await corpo(await listar(req('/api/pipeline/youtube/ab-tests/native?estado=encerrado')))
    expect(data.testes.map((t: { id: string }) => t.id)).toEqual([ID2])
  })
  it('video_id (11 caracteres do YouTube) filtra; formato inválido -> 400', async () => {
    const { data } = await corpo(await listar(req('/api/pipeline/youtube/ab-tests/native?video_id=qIg9a7vqcNo')))
    expect(data.testes.map((t: { id: string }) => t.id)).toEqual([ID1])
    expect((await listar(req('/api/pipeline/youtube/ab-tests/native?video_id=curto'))).status).toBe(400)
  })
})

describe('GET native/:id', () => {
  beforeEach(mundo)
  const chama = (id: string) => obter(req('/x'), { params: Promise.resolve({ id }) })
  it('registro + no máximo 20 avaliações, da mais nova para a mais velha', async () => {
    const r = await chama(ID1)
    expect(r.status).toBe(200)
    const { data } = await corpo(r)
    expect(data.teste.id).toBe(ID1)
    expect(data.avaliacoes).toHaveLength(20)
    const datas = data.avaliacoes.map((a: { avaliada_em: string }) => a.avaliada_em)
    expect([...datas].sort().reverse()).toEqual(datas)
    expect(JSON.stringify(data)).not.toContain('segredo')
  })
  it('id de outro site -> 404; id inexistente -> 404; não-uuid -> 400', async () => {
    expect((await chama(ID_OUTRO)).status).toBe(404)
    expect((await chama('44444444-4444-4444-8444-4444444444ff')).status).toBe(404)
    expect((await chama('nao-e-uuid')).status).toBe(400)
  })
})

describe('serialização', () => {
  const base = registro({ id: ID1, site_id: SITE }) as unknown as LinhaAbNativeTest
  it('conta as rodadas da evidência e nunca expõe a evidência crua', () => {
    const s = serializarRegistro(base)
    expect(s.evidencia_rodadas).toBe(2)
    expect(JSON.stringify(s)).not.toContain('"rodada"')
    expect(s.vencedor).toBeNull()
    expect(s.titulo_oficial).toBeNull()
  })
  it('vencedor só com fonte regra ou dono (data_api fica fora desta fase)', () => {
    expect(serializarRegistro({ ...base, vencedor_titulo: 'T', vencedor_fonte: 'dono' }).vencedor).toEqual({ titulo: 'T', fonte: 'dono' })
    expect(serializarRegistro({ ...base, vencedor_titulo: 'T', vencedor_fonte: 'regra' }).vencedor).toEqual({ titulo: 'T', fonte: 'regra' })
    expect(serializarRegistro({ ...base, vencedor_titulo: 'T', vencedor_fonte: 'data_api' }).vencedor).toBeNull()
  })
  it('evidência não-lista conta 0 e retroativa nula vira false', () => {
    expect(serializarRegistro({ ...base, evidencia: null }).evidencia_rodadas).toBe(0)
    expect(serializarAvaliacao({ ...(avaliacao(1) as never), retroativa: null }).retroativa).toBe(false)
  })
})

describe('MCP list_native / get_native', () => {
  beforeEach(mundo)
  const texto = (r: { content: Array<{ type: string; text?: string }> }): unknown => JSON.parse(r.content[0]!.text!)
  it('list_native devolve o mesmo objeto da rota', async () => {
    const rota = await corpo(await listar(req('/api/pipeline/youtube/ab-tests/native')))
    const mcp = texto(await manageAbTest({ action: 'list_native' }) as never) as { data?: unknown }
    expect(mcp.data ?? mcp).toEqual(rota.data)
  })
  it('get_native devolve o mesmo objeto da rota; exige test_id', async () => {
    const rota = await corpo(await obter(req('/x'), { params: Promise.resolve({ id: ID1 }) }))
    const mcp = texto(await manageAbTest({ action: 'get_native', test_id: ID1 }) as never) as { data?: unknown }
    expect(mcp.data ?? mcp).toEqual(rota.data)
    expect(JSON.stringify(await manageAbTest({ action: 'get_native' }))).toContain('VALIDATION_ERROR')
  })
  it('estado inválido no MCP -> VALIDATION_ERROR', async () => {
    expect(JSON.stringify(await manageAbTest({ action: 'list_native', estado: 'x' }))).toContain('VALIDATION_ERROR')
  })
})
