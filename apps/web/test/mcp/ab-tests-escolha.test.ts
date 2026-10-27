// @vitest-environment node
/** M7b T16: paridade de leitura. `escolha` (sem `escolha_por`) e `no_ar` pela fonte única; uma só leitura de histórico por página. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakePostgrestComDias as fakePostgrest } from '../helpers/fake-postgrest-dias'
import type { FakePostgrestOptions } from '../helpers/fake-postgrest'

let sb = fakePostgrest({ tables: {} })
vi.mock('@/lib/pipeline/mcp/context', () => ({ getMcpContext: () => ({ siteId: 'site-1', permissions: ['read'], keyHash: 'h', keyId: 'key-1' }) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => sb.client }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))

import * as youtube from '@/lib/pipeline/services/youtube'
import { manageAbTest } from '@/lib/pipeline/mcp/services/ab-tests'
import type { ServiceContext } from '@/lib/pipeline/services/types'

const SITE = 'site-1'
const ctxOf = (): ServiceContext => ({ siteId: SITE, permissions: ['read'], supabase: sb.client as unknown as ServiceContext['supabase'], source: 'api_key' })
const dia = (n: number) => new Date(Date.now() - n * 86400000).toISOString()

const variantes = (t: string) => [
  { id: `${t}-a`, label: 'original', is_original: true, blob_url: null, title_text: 'Orig', metadata: {}, sort_order: 0 },
  { id: `${t}-b`, label: 'B', is_original: false, blob_url: null, title_text: 'B', metadata: {}, sort_order: 1 },
]
const teste = (id: string, o: Record<string, unknown> = {}) => ({
  id, site_id: SITE, name: id, status: 'completed', test_type: 'title', youtube_video_id: `yt-${id}`, created_at: dia(20), started_at: dia(15),
  completed_at: dia(5), completed_reason: 'manual_winner', winner_variant_id: `${id}-b`, winner_applied_at: null, config: {}, result_metadata: null,
  restore_status: { title: { estado: 'ok', destino: `${id}-b`, forcado: false, escreveu: true, erro: null, em: dia(4), attempts: 1 } }, restore_seq: 1,
  escolha_variant_id: `${id}-b`, escolha_em: dia(4), escolha_por: 'user-secreto-1', variants: variantes(id), cycles: [], ...o,
})
const mundo = (testes: Record<string, unknown>[], restores: Record<string, unknown>[] = []): FakePostgrestOptions => ({
  tables: {
    sites: [{ id: SITE }], ab_tests: testes, ab_test_variants: [], ab_test_cycles: [], thumbnail_library: [],
    ab_test_restores: restores.length ? restores : [{ test_id: 'outro', seq: 1, campo: 'title', destino: 'x', estado: 'ok', escreveu: true, motivo: null, iniciativa: 'dono', em: dia(30) }],
  },
})
const comoJson = (x: unknown) => JSON.parse(JSON.stringify(x))
const idasAoHistorico = () => sb.queries.filter(q => q.table === 'ab_test_restores').length

beforeEach(() => { sb = fakePostgrest(mundo([])) })

describe('T16: escolha e no_ar na leitura do MCP', () => {
  it('get_test: escolha {variant_id, letra, em} e no_ar confirmado; nunca escolha_por', async () => {
    sb = fakePostgrest(mundo([teste('t1')]))
    const { data } = await youtube.getAbTest(ctxOf(), 't1')
    expect(data.escolha).toEqual({ variant_id: 't1-b', letra: 'B', em: expect.any(String) })
    expect(data.no_ar).toMatchObject({ letra: 'B', confirmado: true })
    expect(JSON.stringify(data)).not.toContain('escolha_por')
    expect(JSON.stringify(data)).not.toContain('user-secreto-1')
  })

  it('B escolhida e depois a original de volta: no_ar é a original (A) e a escolha é a original', async () => {
    const t = teste('t2', {
      restore_seq: 2, escolha_variant_id: 't2-a',
      restore_status: { title: { estado: 'ok', destino: 'original', forcado: false, escreveu: true, erro: null, em: dia(1), attempts: 1 } },
    })
    sb = fakePostgrest(mundo([t], [{ test_id: 't2', seq: 1, campo: 'title', destino: 't2-b', estado: 'ok', escreveu: true, motivo: null, iniciativa: 'dono', em: dia(4) }]))
    const { data } = await youtube.getAbTest(ctxOf(), 't2')
    expect(data.no_ar).toMatchObject({ letra: 'A', confirmado: true })
    expect(data.escolha).toMatchObject({ letra: 'A' })
    expect(data.winner_variant_id).toBe('t2-b') // a escolha nunca muda o vencedor
  })

  it('sem escolha do dono: escolha null', async () => {
    sb = fakePostgrest(mundo([teste('t3', { escolha_em: null, escolha_variant_id: null, escolha_por: null })]))
    const { data } = await youtube.getAbTest(ctxOf(), 't3')
    expect(data.escolha).toBeNull()
  })

  it('teste rodando: no_ar null (só concluído tem)', async () => {
    sb = fakePostgrest(mundo([teste('t4', { status: 'active', completed_at: null, escolha_em: null, escolha_variant_id: null })]))
    const { data } = await youtube.getAbTest(ctxOf(), 't4')
    expect(data.no_ar).toBeNull()
    expect(data.escolha).toBeNull()
  })

  it('list_tests: UMA leitura de histórico para a página inteira, não uma por item', async () => {
    sb = fakePostgrest(mundo([teste('l1'), teste('l2'), teste('l3'), teste('l4', { status: 'active', completed_at: null })]))
    const { data } = await youtube.listAbTests(ctxOf(), {})
    expect(data).toHaveLength(4)
    expect(idasAoHistorico()).toBe(1)
    expect(JSON.stringify(data)).not.toContain('escolha_por')
  })

  it('histórico que falha: no_ar desconhecido (confirmado false), nunca inventado', async () => {
    const m = mundo([teste('t5')])
    m.tables.ab_test_restores = [] // sem colunas no fake: a leitura devolve erro
    sb = fakePostgrest(m)
    const { data } = await youtube.getAbTest(ctxOf(), 't5')
    expect(data.no_ar).toEqual({ letra: null, desde: null, confirmado: false })
  })

  it('paridade: a ação MCP get_test dá o mesmo JSON do serviço', async () => {
    sb = fakePostgrest(mundo([teste('t6')]))
    const rest = await youtube.getAbTest(ctxOf(), 't6')
    const r = await manageAbTest({ action: 'get_test', test_id: 't6' })
    const mcp = JSON.parse((r.content[0] as { text: string }).text) as Record<string, unknown>
    expect(mcp.escolha).toEqual(comoJson(rest.data.escolha))
    expect(mcp.no_ar).toEqual(comoJson(rest.data.no_ar))
  })
})
