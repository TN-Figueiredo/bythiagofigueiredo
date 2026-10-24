// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fakePostgrest, type FakeQuery } from '../helpers/fake-postgrest'
import { makeTestRow } from '../helpers/ab-fixtures'

const estado = vi.hoisted(() => ({
  tabelas: {} as Record<string, Array<Record<string, unknown>>>,
  falha: null as null | ((q: FakeQuery) => { code?: string; message: string } | null),
  fake: null as null | ReturnType<typeof import('../helpers/fake-postgrest').fakePostgrest>,
}))
const sentry = vi.hoisted(() => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true }) }))
vi.mock('@sentry/nextjs', () => sentry)
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => estado.fake!.client }))

import { getTestResults } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import {
  listAbTests, getAbTest, getAbTestFunnel, AVISO_SEM_ESTATISTICA, AVISO_PLACAR_INVALIDO, AVISO_SEM_METRICA_DE_ENTREGA,
} from '@/lib/pipeline/services/youtube'
import type { ServiceContext } from '@/lib/pipeline/services/types'

type Row = Record<string, unknown>
const dias = (n: number) => new Date(Date.now() - n * 86400000).toISOString()
const diaPt = (n: number) => dias(n).slice(0, 10)
const ctx = (): ServiceContext => ({ siteId: 'site-1', permissions: ['read'], supabase: estado.fake!.client as unknown as ServiceContext['supabase'], source: 'api_key' })

function variante(testId: string, id: string, ordem: number): Row {
  return { id, test_id: testId, label: ordem === 0 ? 'original' : 'B', is_original: ordem === 0, blob_url: null, blob_key: null, file_size_bytes: null, dimensions: null, title_text: null, metadata: {}, sort_order: ordem, created_at: dias(9), source_variant_id: null }
}
function teste(id: string, o: Row = {}): Row {
  const vs = [variante(id, `${id}-b`, 1), variante(id, `${id}-a`, 0)] // ordem trocada de propósito
  return {
    ...makeTestRow({ id, site_id: 'site-1', status: 'active', started_at: dias(12) }),
    youtube_videos: { youtube_video_id: 'Abc123def45' }, regra_duracao: 'v1', variants: vs, cycles: [], ...o,
  }
}
function ciclo(testId: string, v: string, n: number): Row {
  return { id: `c-${testId}-${v}`, test_id: testId, variant_id: v, cycle_number: n, started_at: dias(5), ended_at: dias(4), backfill_status: 'pending', backfill_attempts: 0, applied_metadata: null, created_at: dias(5) }
}
function dia(testId: string, variant: string | null, n: number, est: string, imp: number | null, ctr: number | null, extra: Row = {}): Row {
  return {
    test_id: testId, day_pt: diaPt(n), site_id: 'site-1', variant_id: variant, motivo_sem_variante: variant === null ? 'menos_de_90' : null,
    alcance_estado: est, impressoes: imp, ctr, views: null, views_estado: 'nao_medido', retratado_em: dias(1), final: false, ...extra,
  }
}
function semear(testes: Row[], diasLinhas: Row[]) {
  estado.falha = null
  const ids = testes.map(t => t.id as string)
  estado.tabelas = {
    ab_tests: testes,
    ab_test_variants: testes.flatMap(t => (t.variants as Row[]).map(v => ({ ...v }))),
    ab_test_cycles: ids.flatMap(id => [ciclo(id, `${id}-a`, 1), ciclo(id, `${id}-b`, 2)]),
    ab_test_polls: [],
    ab_test_dias: diasLinhas,
  }
  estado.fake = fakePostgrest({ tables: estado.tabelas, fail: q => estado.falha?.(q) ?? null })
}
const diasT1 = () => [
  ...[10, 9, 8].map(n => dia('t1', 't1-a', n, 'medido', 1000, 0.05)),
  dia('t1', 't1-a', 7, 'medido', 1000, null),
  ...[10, 9, 8].map(n => dia('t1', 't1-b', n, 'medido', 1000, 0.08)),
  dia('t1', 't1-b', 7, 'aguardando', null, null),
]

beforeEach(() => { vi.clearAllMocks(); semear([teste('t1')], diasT1()) })

describe('S8-F3 T4: Cowork com o mesmo placar', () => {
  it('1: paridade tela x Cowork por variant_id (C-20)', async () => {
    const tela = await getTestResults('t1')
    const det = (await getAbTest(ctx(), 't1')).data as unknown as { placar: { variantes: Array<Record<string, unknown>> }; result_metadata: { total_impressions: number | null }; aviso: string }
    const lista = (await listAbTests(ctx(), {})).data![0]! as unknown as { placar: { variantes: Array<Record<string, unknown>> } }
    for (const v of tela!.placar!.variantes) {
      for (const fonte of [det.placar, lista.placar]) {
        const c = fonte.variantes.find(x => x.variant_id === v.variant_id)!
        expect([c.impressoes, c.cliques, c.ctr, c.views]).toEqual([v.impressoes, v.cliques, v.ctr, v.views])
      }
    }
    expect(det.result_metadata.total_impressions).toBe(7000)
  })

  it('2: lista sem N+1 (uma consulta em ab_test_dias para 20 testes)', async () => {
    const ts = Array.from({ length: 20 }, (_, i) => teste(`x${i}`))
    semear(ts, ts.flatMap(t => [dia(t.id as string, `${t.id}-a`, 5, 'medido', 100, 0.1)]))
    const r = await listAbTests(ctx(), {})
    expect(r.data).toHaveLength(20)
    expect(estado.fake!.queries.filter(q => q.table === 'ab_test_dias')).toHaveLength(1)
  })

  it('3: erro de banco é erro alto; ausente é NOT_FOUND', async () => {
    estado.falha = q => (q.table === 'ab_test_dias' ? { message: 'boom' } : null)
    await expect(listAbTests(ctx(), {})).rejects.toMatchObject({ code: 'DB_ERROR' })
    await expect(getAbTest(ctx(), 't1')).rejects.toMatchObject({ code: 'DB_ERROR' })
    await expect(getAbTestFunnel(ctx(), 't1')).rejects.toMatchObject({ code: 'DB_ERROR' })
    estado.falha = q => (q.table === 'ab_tests' ? { message: 'boom' } : null)
    await expect(listAbTests(ctx(), {})).rejects.toMatchObject({ code: 'DB_ERROR' })
    await expect(getAbTest(ctx(), 't1')).rejects.toMatchObject({ code: 'DB_ERROR' })
    await expect(getAbTestFunnel(ctx(), 't1')).rejects.toMatchObject({ code: 'DB_ERROR' })
    estado.falha = null
    await expect(getAbTest(ctx(), 'nao-existe')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(getAbTestFunnel(ctx(), 'nao-existe')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('3b: linha ruim isola o teste na lista (D-F3-8) e derruba o detalhe', async () => {
    const ts = [teste('t1'), teste('t2'), teste('t3')]
    semear(ts, [...diasT1(), dia('t2', 't2-a', 5, 'medido', 100, 4.12), dia('t3', 't3-a', 5, 'medido', 100, 0.1)])
    const r = (await listAbTests(ctx(), {})).data as unknown as Array<{ id: string; placar: unknown; placar_erro: string | null; aviso: string }>
    expect(r).toHaveLength(3)
    const ruim = r.find(x => x.id === 't2')!
    expect(ruim.placar).toBeNull()
    expect(ruim.placar_erro).toBe('linha_invalida')
    expect(ruim.aviso).toBe(AVISO_PLACAR_INVALIDO)
    expect(ruim.aviso).toBe('placar indisponível: linha inválida em ab_test_dias')
    for (const id of ['t1', 't3']) {
      const o = r.find(x => x.id === id)!
      expect(o.placar).not.toBeNull()
      expect(o.placar_erro).toBeNull()
    }
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    await expect(getAbTest(ctx(), 't2')).rejects.toBeTruthy()
  })

  it('4: aviso muda com o dado; lift e confiança seguem nulos', async () => {
    semear([teste('t1'), teste('t2')], diasT1())
    const r = (await listAbTests(ctx(), {})).data as unknown as Array<{ id: string; aviso: string; placar: { dias_total: number }; result_metadata: { ctr_lift_percent: number | null }; confidence_at_completion: number | null }>
    const sem = r.find(x => x.id === 't2')!
    const com = r.find(x => x.id === 't1')!
    expect(sem.placar.dias_total).toBe(0)
    expect(sem.aviso).toBe(AVISO_SEM_METRICA_DE_ENTREGA)
    expect(sem.aviso).toBe('sem métrica de entrega')
    expect(com.aviso).toBe(AVISO_SEM_ESTATISTICA)
    for (const x of [sem, com]) {
      expect(x.result_metadata.ctr_lift_percent).toBeNull()
      expect(x.confidence_at_completion).toBeNull()
    }
  })

  it('5: funil com o par (impressions, clicks) e impressions_total', async () => {
    semear([teste('t1')], [
      ...[10, 9, 8].map(n => dia('t1', 't1-a', n, 'medido', 1000, 0.05)),
      dia('t1', 't1-a', 7, 'medido', 1000, null),
      ...[10, 9].map(n => dia('t1', 't1-b', n, 'aguardando', null, null)),
      dia('t1', 'v-fora', 6, 'medido', 100, 0.1),
    ])
    const f = (await getAbTestFunnel(ctx(), 't1')).data as unknown as { per_variant: Array<Record<string, unknown>>; dias_variante_desconhecida?: number; aviso: string }
    const a = f.per_variant.find(x => x.variant_id === 't1-a')!
    expect(a).toMatchObject({ impressions: 3000, impressions_total: 4000, clicks: 150, ctr: 0.05, link_clicks: null })
    expect((a.clicks as number) / (a.impressions as number)).toBeCloseTo(a.ctr as number, 10)
    const b = f.per_variant.find(x => x.variant_id === 't1-b')!
    expect(b).toMatchObject({ impressions: null, clicks: null })
    expect(f.dias_variante_desconhecida).toBe(1)
    expect(f.aviso).toBe(AVISO_SEM_ESTATISTICA)
  })

  it('5c: variante só com volume sem CTR não lê como 0 impressões', async () => {
    semear([teste('t1')], [dia('t1', 't1-a', 6, 'medido', 5000, null)])
    const f = (await getAbTestFunnel(ctx(), 't1')).data as unknown as { per_variant: Array<Record<string, unknown>> }
    expect(f.per_variant.find(x => x.variant_id === 't1-a')).toMatchObject({ impressions: 0, clicks: null, impressions_total: 5000 })
  })

  it('5b: as três rotas continuam passando por authenticateRead (M10)', () => {
    const base = 'src/app/api/pipeline/youtube/ab-tests'
    for (const p of ['route.ts', '[id]/route.ts', '[id]/funnel/route.ts']) {
      expect(readFileSync(`${base}/${p}`, 'utf8')).toContain('authenticateRead')
    }
  })

  it('6: api-registry intocado (nenhuma rota nova)', () => {
    const reg = readFileSync('src/lib/pipeline/api-registry.ts', 'utf8')
    expect(reg).not.toContain('placar')
  })
})
