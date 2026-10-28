// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakePostgrest, type FakeQuery } from './helpers/fake-postgrest'
import { makeTestRow } from './helpers/ab-fixtures'

const estado = vi.hoisted(() => ({
  tabelas: {} as Record<string, Array<Record<string, unknown>>>,
  falha: null as null | ((q: FakeQuery) => { code?: string; message: string } | null),
  fake: null as null | ReturnType<typeof import('./helpers/fake-postgrest').fakePostgrest>,
}))

vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true }) }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => estado.fake!.client }))
vi.mock('@/lib/youtube/ab-statistics', async (orig) => {
  const real = await orig<typeof import('@/lib/youtube/ab-statistics')>()
  return { ...real, calculateBayesianConfidence: vi.fn((...a: Parameters<typeof real.calculateBayesianConfidence>) => real.calculateBayesianConfidence(...a)) }
})

import { getTestResults, toDetailView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { diasDaDecisao, type CicloComNumero } from '@/lib/youtube/ab-gravacao/decisao-v2'
import { diaDoTeste } from '@/lib/youtube/ab-dia-do-teste'

const ESPIAO = vi.mocked(calculateBayesianConfidence)
const dias = (n: number) => new Date(Date.now() - n * 86400000).toISOString()
const diaPt = (n: number) => dias(n).slice(0, 10)

type Row = Record<string, unknown>
function ciclo(id: string, n: number, variant: string, o: Row = {}): Row {
  return {
    id, test_id: 't1', variant_id: variant, cycle_number: n, started_at: dias(5), ended_at: dias(4),
    backfill_status: 'pending', backfill_attempts: 0, applied_metadata: null, created_at: dias(5), ...o,
  }
}
const VARIANTES: Row[] = [
  { id: 'v-a', test_id: 't1', label: 'original', is_original: true, blob_url: null, blob_key: null, file_size_bytes: null, dimensions: null, title_text: null, metadata: {}, sort_order: 0, created_at: dias(9), source_variant_id: null },
  { id: 'v-b', test_id: 't1', label: 'B', is_original: false, blob_url: null, blob_key: null, file_size_bytes: null, dimensions: null, title_text: null, metadata: {}, sort_order: 1, created_at: dias(9), source_variant_id: null },
]
function dia(variant: string | null, n: number, estadoAlc: string, imp: number | null, ctr: number | null, extra: Row = {}, site = 'site-1'): Row {
  return {
    test_id: 't1', day_pt: diaPt(n), site_id: site, variant_id: variant, motivo_sem_variante: variant === null ? 'menos_de_90' : null,
    alcance_estado: estadoAlc, impressoes: imp, ctr, views: null, views_estado: 'nao_medido',
    retratado_em: dias(1), final: false, ...extra,
  }
}
function diasPadrao(): Row[] {
  return [
    ...[10, 9, 8, 7].map(n => dia('v-a', n, 'medido', 1000, 0.05)),
    ...[10, 9, 8].map(n => dia('v-b', n, 'medido', 1000, 0.08)),
    dia('v-b', 7, 'aguardando', null, null),
    dia(null, 6, 'nao_medido', null, null),
  ]
}
function semear(testO: Row = {}, diasLinhas: Row[] = diasPadrao()) {
  estado.falha = null
  estado.tabelas = {
    ab_tests: [{ ...makeTestRow({ id: 't1', site_id: 'site-1', status: 'active', started_at: dias(12) }), youtube_videos: { youtube_video_id: 'Abc123def45' }, ...testO }],
    ab_test_variants: VARIANTES.map(v => ({ ...v })),
    ab_test_cycles: [ciclo('c1', 1, 'v-a'), ciclo('c2', 2, 'v-b'), ciclo('c3', 3, 'v-a', { ended_at: null })],
    ab_test_polls: [],
    ab_test_dias: diasLinhas,
    // uma linha de outro teste dá as colunas ao fake; o teste t1 não tem histórico
    ab_test_restores: [{ test_id: 'outro', seq: 1, campo: 'title', destino: 'x', estado: 'ok', escreveu: true, motivo: null, iniciativa: 'dono', em: dias(30) }],
  }
  estado.fake = fakePostgrest({ tables: estado.tabelas, fail: q => estado.falha?.(q) ?? null })
}


const V2 = { regra_duracao: 'v2', config: { max_duration_days: 15, teto_explicito: true } }
const restoreOk = (destino: string, em: string) => ({ title: undefined, thumbnail: { estado: 'ok', destino, forcado: false, escreveu: true, erro: null, em, attempts: 1 } })

beforeEach(() => { ESPIAO.mockClear(); semear() })

describe('M7b D21: o cartão do vencedor mostra o que está no ar', () => {
  const concluido = (o: Row) => ({
    ...V2, status: 'completed', test_type: 'thumbnail', completed_at: dias(5), completed_reason: 'manual_winner', winner_variant_id: 'v-b',
    result_metadata: { v2: { desfecho: 'vencedor_provavel', vencedor_sugerido: 'v-b', provisorio: false, encerrado_em_dia: diaPt(6), n: 100 } },
    restore_seq: 2, ...o,
  })
  it('B escolhida, depois Reverter (a original voltou e a escolha é a original): original no ar, "Mantida por você", vencedor do teste B à parte', async () => {
    semear(concluido({ escolha_variant_id: 'v-a', escolha_em: dias(1), restore_status: restoreOk('original', dias(1)) }))
    const r = await getTestResults('t1')
    const v = await toDetailView(r!)
    expect(v.status === 'completed' && v.outcome).toBe('winner')
    if (v.status !== 'completed' || v.outcome !== 'winner') throw new Error('esperava vencedor')
    expect(v.winnerLabel).toBe('B')
    expect(v.noAr).toEqual({ letra: 'A', original: true })
    expect(v.escolhaDoDono).toBe('mantida')
  })
  it('B escolhida e confirmada no ar: "Escolhida por você" com B no ar', async () => {
    semear(concluido({ escolha_variant_id: 'v-b', escolha_em: dias(1), restore_status: restoreOk('v-b', dias(1)) }))
    const v = await toDetailView((await getTestResults('t1'))!)
    if (v.status !== 'completed' || v.outcome !== 'winner') throw new Error('esperava vencedor')
    expect(v.noAr).toEqual({ letra: 'B', original: false })
    expect(v.escolhaDoDono).toBe('escolhida')
  })
  it('legado sem escolha gravada, vencedor B encerrado à mão e a original no ar: não afirma que o dono escolheu', async () => {
    semear(concluido({ restore_status: restoreOk('original', dias(1)) }))
    const v = await toDetailView((await getTestResults('t1'))!)
    if (v.status !== 'completed' || v.outcome !== 'winner') throw new Error('esperava vencedor')
    expect(v.noAr.letra).toBe('A')
    expect(v.escolhaDoDono).toBeNull()
  })
})
