// @vitest-environment node
// S8-F4 T10b: aviso de volume (puro e com leitura) e comEstatistica.
import { describe, it, expect } from 'vitest'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { avisoDeVolume, comEstatistica, montarAvisoDeVolume } from '@/lib/youtube/ab-gravacao/aviso-volume'
import type { Placar } from '@/lib/youtube/ab-gravacao/placar'

const HOJE = '2026-10-24'
const AGORA = new Date('2026-10-24T15:00:00Z')
const N2 = 10_315 // volumeMinimo(0,04; V=2)

const base = (o: Partial<Parameters<typeof montarAvisoDeVolume>[0]> = {}) =>
  montarAvisoDeVolume({ V: 2, teto: 14, p1: 0.04, base_estimada: true, impressoesDia: 1800, usouUltimos7: false, hoje: HOJE, ...o })

describe('montarAvisoDeVolume', () => {
  it('Phil A10: teto 14, V=2, N=10.315, 1.800 imp/dia => 12 dias, so_decide_depois (nunca ok)', () => {
    const a = base()
    expect(a).toMatchObject({ estado: 'so_decide_depois', dias_previstos: 12, n: N2, impressoes_dia: 1800, base_estimada: true })
    expect((a as { texto: string }).texto).toMatch(/só decide depois que o YouTube enviar os últimos dias \(cerca de 15 dias depois do início\)/)
  })
  it('Yannis R-3: padrão V=2 (teto 15) com 1.800/dia => so_decide_depois, não teto_justo', () => {
    expect(base({ teto: 15 }).estado).toBe('so_decide_depois')
  })
  it('volume que cabe com folga 0 => teto_justo com a folga real e a de +1 dia', () => {
    const a = montarAvisoDeVolume({ V: 3, teto: 17, p1: 0.04, base_estimada: false, impressoesDia: 100_000, usouUltimos7: false, hoje: HOJE })
    expect(a).toMatchObject({ estado: 'teto_justo', folga_min: 0 })
    expect((a as { texto: string }).texto).toMatch(/folga 0 na original com teto de 17 dias; com teto de \d+ dias a folga mínima passa a ser 1/)
  })
  it('Phil D4: padrão V=2 (15, folga 1) cabe => ok, não alarme; folga 0 (teto 13) => teto_justo; teto largo => ok', () => {
    expect(base({ teto: 15, impressoesDia: 100_000 })).toMatchObject({ estado: 'ok', texto: null })
    expect(base({ teto: 13, impressoesDia: 100_000 })).toMatchObject({ estado: 'teto_justo', folga_min: 0 })
    expect(base({ teto: 30, impressoesDia: 100_000 })).toMatchObject({ estado: 'ok', texto: null })
  })
  it('nao_chega quando passa de teto - 1', () => {
    const a = base({ teto: 14, impressoesDia: 1000 })
    expect(a).toMatchObject({ estado: 'nao_chega' })
    expect((a as { texto: string }).texto).toMatch(/não chega ao volume em 14 dias.*inconclusivo por volume/)
  })
  it('V=1 => sem_variantes; V=4 => variantes_demais (antes de volumeMinimo, sem exceção); zero dia válido => sem_medicao', () => {
    expect(base({ V: 1 }).estado).toBe('sem_variantes')
    expect(base({ V: 4 }).estado).toBe('variantes_demais')
    expect(base({ impressoesDia: null }).estado).toBe('sem_medicao')
  })
  it('estimativa pelos últimos 7 dias entra no texto', () => {
    expect((base({ usouUltimos7: true }) as { texto: string }).texto).toContain('últimos 7 dias')
  })
})

describe('comEstatistica', () => {
  const placar = { regra: 'v2', estatistica: 'nao_calculada', variantes: [] } as unknown as Placar
  it('calculada sse p_adj != null', () => {
    expect(comEstatistica(placar, { p_adj: 0.01 }).estatistica).toBe('calculada')
    expect(comEstatistica(placar, { p_adj: 0 }).estatistica).toBe('calculada')
    expect(comEstatistica(placar, { p_adj: null }).estatistica).toBe('nao_calculada')
    expect(comEstatistica(placar, {}).estatistica).toBe('nao_calculada')
    expect(comEstatistica(placar, null).estatistica).toBe('nao_calculada')
  })
})

type Tabelas = Record<string, { data: unknown; error?: unknown }>
function fakeSb(t: Tabelas) {
  const from = (tabela: string) => {
    const r = t[tabela] ?? { data: [], error: null }
    const res = { data: r.data, error: r.error ?? null }
    const self: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'gte', 'order', 'range']) self[m] = () => self
    self.maybeSingle = () => Promise.resolve(res)
    self.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(res).then(ok, ko)
    return self
  }
  return { from } as never
}
const teste = (nVar: number, config: unknown = {}) => ({
  data: { id: 't1', config, youtube_videos: { youtube_video_id: 'yt1', channel_id: 'c1' }, variants: Array.from({ length: nVar }, (_, i) => ({ id: `v${i}` })) },
})
const alcance = (porDia: (k: number) => number | null) => ({
  data: Array.from({ length: 14 }, (_, i) => 14 - i).flatMap((k) => {
    const imp = porDia(k)
    return imp === null ? [] : [{ youtube_video_id: 'yt1', day_pt: addDays(HOJE, -k), thumbnail_impressions: imp, thumbnail_ctr: 0.05, source_report_id: 'r', report_create_time: '2026-10-01T00:00:00Z' }]
  }),
})

describe('avisoDeVolume (leitura)', () => {
  it('Phil N9: vídeo novo, 14 dias de entrega decrescente => impressoes_dia = média de 7 dias', async () => {
    const r = await avisoDeVolume(fakeSb({ ab_tests: teste(2), yt_own_video_reach_daily: alcance((k) => (k >= 8 ? 3000 : 1000)) }), 's', 't1', AGORA)
    expect(r.ok && r.aviso).toMatchObject({ impressoes_dia: 1000, base_estimada: false })
    expect(r.ok && (r.aviso as { texto: string }).texto).toContain('últimos 7 dias')
  })
  it('sem nenhum dia válido => sem_medicao; V=1 => sem_variantes; V=4 => variantes_demais (sem ler a entrega)', async () => {
    expect(await avisoDeVolume(fakeSb({ ab_tests: teste(2) }), 's', 't1', AGORA)).toEqual({ ok: true, aviso: { estado: 'sem_medicao', texto: 'sem medição para estimar o volume' } })
    expect((await avisoDeVolume(fakeSb({ ab_tests: teste(1) }), 's', 't1', AGORA) as { aviso: { estado: string } }).aviso.estado).toBe('sem_variantes')
    expect((await avisoDeVolume(fakeSb({ ab_tests: teste(4) }), 's', 't1', AGORA) as { aviso: { estado: string } }).aviso.estado).toBe('variantes_demais')
  })
  it('D1: só a original no banco e V=2 no pedido => não dá sem_variantes (maior V vence; teto do pedido vale)', async () => {
    const sem = await avisoDeVolume(fakeSb({ ab_tests: teste(1) }), 's', 't1', AGORA, { V: 2 })
    expect(sem.ok && sem.aviso.estado).toBe('sem_medicao')
    const com = await avisoDeVolume(fakeSb({ ab_tests: teste(1), yt_own_video_reach_daily: alcance(() => 100_000) }), 's', 't1', AGORA, { V: 3, teto: 30 })
    expect(com.ok && com.aviso.estado).toBe('ok')
    const banco = await avisoDeVolume(fakeSb({ ab_tests: teste(3) }), 's', 't1', AGORA, { V: 1 })
    expect(banco.ok && banco.aviso.estado).not.toBe('sem_variantes')
  })
  it('V=3 sem teto explícito calcula sobre 17; com teto_explicito usa o teto escolhido', async () => {
    const sb = (cfg: unknown) => fakeSb({ ab_tests: teste(3, cfg), yt_own_video_reach_daily: alcance(() => 100_000) })
    const padrao = await avisoDeVolume(sb({ max_duration_days: 14 }), 's', 't1', AGORA)
    expect(padrao.ok && padrao.aviso).toMatchObject({ estado: 'teto_justo', folga_min: 0 })
    const explicito = await avisoDeVolume(sb({ max_duration_days: 30, teto_explicito: true }), 's', 't1', AGORA)
    expect(explicito.ok && explicito.aviso.estado).toBe('ok')
  })
  it('erro de leitura => ok:false, nunca ok', async () => {
    const r = await avisoDeVolume(fakeSb({ ab_tests: teste(2), yt_own_video_reach_daily: { data: null, error: { message: 'x' } } }), 's', 't1', AGORA)
    expect(r.ok).toBe(false)
  })
})
