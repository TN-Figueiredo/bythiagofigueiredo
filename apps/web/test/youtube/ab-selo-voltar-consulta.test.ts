// @vitest-environment node
// P6 (Phil): a consulta "outro teste aberto" do detalhe (selo depois do Voltar): portão, achado e falha (sem_leitura).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakePostgrest, type FakeQuery } from '../helpers/fake-postgrest'
import { makeTestRow } from '../helpers/ab-fixtures'

const estado = vi.hoisted(() => ({
  tabelas: {} as Record<string, Array<Record<string, unknown>>>,
  falha: null as null | ((q: FakeQuery) => { code?: string; message: string } | null),
  fake: null as null | ReturnType<typeof import('../helpers/fake-postgrest').fakePostgrest>,
}))

vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true }) }))
const captura = vi.hoisted(() => vi.fn())
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: captura }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => estado.fake!.client }))
vi.mock('@/lib/youtube/ab-statistics', async (orig) => {
  const real = await orig<typeof import('@/lib/youtube/ab-statistics')>()
  return { ...real, calculateBayesianConfidence: vi.fn((...a: Parameters<typeof real.calculateBayesianConfidence>) => real.calculateBayesianConfidence(...a)) }
})

import { getTestResults, toDetailView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'

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
  }
  estado.fake = fakePostgrest({ tables: estado.tabelas, fail: q => estado.falha?.(q) ?? null })
}


const CONCLUIDO = {
  status: 'completed', completed_at: dias(2), completed_reason: 'manual_winner', winner_variant_id: 'v-b', winner_applied_at: null,
  test_type: 'thumbnail', regra_duracao: 'v2', config: { max_duration_days: 15, teto_explicito: true },
  restore_status: { thumbnail: { estado: 'ok', destino: 'original', em: dias(1), forcado: false, escreveu: true, attempts: 1 } },
  result_metadata: { v2: { n: 100, desfecho: 'vencedor_provavel', vencedor_sugerido: 'v-b', encerrado_em_dia: diaPt(3), provisorio: false } },
}
const OUTRO = { ...makeTestRow({ id: 't2', site_id: 'site-1', status: 'active', started_at: dias(1) }), youtube_video_id: 'vid-1' }
const consultaOutro = () => estado.fake!.on('ab_tests').filter(q => q.filters.some(f => f.op === 'neq' && f.col === 'id'))

async function detalhe(testO: Row = {}, outros: Row[] = []) {
  semear({ ...CONCLUIDO, ...testO })
  estado.tabelas.ab_tests!.push(...outros)
  const d = await toDetailView((await getTestResults('t1'))!)
  return d.v2 && d.v2.fase === 'concluido' ? d.v2 : null
}

describe('P6: consulta "outro teste aberto" do detalhe', () => {
  beforeEach(() => captura.mockClear())

  it('outro teste aberto no mesmo vídeo: bloqueio outro_teste, sem botão', async () => {
    const v2 = await detalhe({ youtube_video_id: 'vid-1' }, [OUTRO])
    expect(v2?.bloqueio).toBe('outro_teste')
    expect(v2?.aplicarDeNovo).toBeNull()
  })
  it('sem outro teste: oferece o botão', async () => {
    const v2 = await detalhe({ youtube_video_id: 'vid-1' })
    expect(v2?.bloqueio).toBeNull()
    expect(v2?.aplicarDeNovo).not.toBeNull()
  })
  it('a consulta falhou: sem_leitura (não "outro teste"), sem botão e com Sentry', async () => {
    semear({ ...CONCLUIDO, youtube_video_id: 'vid-1' })
    estado.falha = q => (q.table === 'ab_tests' && q.filters.some(f => f.op === 'neq' && f.col === 'id') ? { message: 'boom' } : null)
    const d = await toDetailView((await getTestResults('t1'))!)
    expect(d.v2 && d.v2.fase === 'concluido' && d.v2.bloqueio).toBe('sem_leitura')
    expect(d.v2 && d.v2.fase === 'concluido' && d.v2.aplicarDeNovo).toBeNull()
    expect(captura).toHaveBeenCalledWith(expect.anything(), { tags: { area: 'ab-lab-detalhe' } })
  })
  it('portão: com a aplicação feita (winner_applied_at) a consulta nem roda', async () => {
    await detalhe({ winner_applied_at: dias(1) })
    expect(consultaOutro()).toHaveLength(0)
  })
  it('portão: teste não concluído ou sem vencedor não consulta', async () => {
    await detalhe({ winner_variant_id: null })
    expect(consultaOutro()).toHaveLength(0)
  })
})
