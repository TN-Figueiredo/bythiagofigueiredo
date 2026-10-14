// @vitest-environment node
// A5 · E11 · Tarefa 11: leitor de servidor das dimensões e do detalhe da origem (banco falso; o banco de verdade é a Tarefa 12).
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { edicaoDe } from './edicao-teste'
import type { EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'
import {
  lerDimensoes, lerDetalheDaOrigem, ErroLeituraDimensoes, TETO_VIDEOS_DIMENSOES, JANELA_MAX_DIAS, type PedidoDimensoes,
} from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import { estadoDoDiaLido, type DiaLido } from '@/lib/youtube/observatorio/proprio/dimensoes-estado'
import { dayPt, addDays } from '@/lib/youtube/coleta/day-pt'

const captureException = vi.fn()
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => captureException(...a), captureMessage: vi.fn() }))

const S = 'site-a', C = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10', OUTRO_CANAL = '9a9a9a9a-5a47-4d0e-9b1c-7e6a2d4f8a10'
const HOJE = dayPt(new Date())
const d = (n: number) => addDays(HOJE, -n)
const SENTINELA = 'zz-sentinela-e11'
const V = 'vid00000001'
const ENV_ANTES = process.env.YT_OWN_STEPS_OFF
afterEach(() => { if (ENV_ANTES === undefined) delete process.env.YT_OWN_STEPS_OFF; else process.env.YT_OWN_STEPS_OFF = ENV_ANTES; captureException.mockClear() })

const cob = (yt: string, set: string, de: string, ate: string, over: Row = {}): Row => ({ youtube_video_id: yt, metric_set: set, covered_from: de, covered_to: ate, site_id: S, channel_id: C, ...over })
const diario = (yt: string, dia: string, views: number | null, over: Row = {}): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: S, channel_id: C, views, ...over })
const dim = (yt: string, dia: string, kind: string, valor: string, views: number | null, minutos: number | null = null, over: Row = {}): Row =>
  ({ youtube_video_id: yt, day_pt: dia, dim_kind: kind, dim_value: valor, site_id: S, channel_id: C, views, watch_time_minutes: minutos, ...over })
const relatorio = (dia: string, norm: boolean, over: Row = {}): Row =>
  ({ report_id: 'r-' + dia, site_id: S, channel_id: C, report_type_id: 'channel_reach_basic_a1', start_time: dia + 'T07:00:00+00:00', normalized_at: norm ? dia + 'T12:00:00+00:00' : null, ...over })
const alcanceBase = (yt: string, dia: string, imp: number | null): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: S, channel_id: C, thumbnail_impressions: imp })
const alcanceDim = (yt: string, dia: string, origem: string, aparelho: string, so: string, imp: number | null, cliques: number | null = null): Row =>
  ({ youtube_video_id: yt, day_pt: dia, traffic_source_type: origem, device_type: aparelho, operating_system: so, site_id: S, channel_id: C, thumbnail_impressions: imp, thumbnail_clicks_est: cliques })
const detalhe = (yt: string, dia: string, tipo: string, texto: string, hash: string, views: number | null, minutos: number | null = null, over: Row = {}): Row =>
  ({ youtube_video_id: yt, day_pt: dia, source_type: tipo, detail: texto, detail_hash: hash, site_id: S, channel_id: C, views, watch_time_minutes: minutos, ...over })
const tentativa = (kind: string, dia: string, outcome: string, over: Row = {}): Row =>
  ({ scope_type: 'video', scope_id: V, kind, attempt_day: dia, site_id: S, channel_id: C, outcome, last_attempt_at: dia + 'T10:00:00Z', ...over })

/** Um cliente que faz falhar com o código dado toda leitura de UMA tabela (o falso só sabe falhar com XX000). */
function comErroNaTabela(sb: SupabaseClient, tabela: string, code: string): SupabaseClient {
  return {
    from: (t: string) => {
      if (t !== tabela) return sb.from(t)
      const falha = { data: null, error: { code, message: 'conteudo ' + SENTINELA } }
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'neq', 'is']) q[m] = () => q
      q.range = async () => falha
      q.then = (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(falha).then(ok, ko)
      return q
    },
  } as unknown as SupabaseClient
}

// `desde` recuado: os dias de teto são relativos a hoje, e o padrão do código é uma data fixa (testada à parte, sem este campo)
const DESDE_ANTIGO = Object.fromEntries(['trafego', 'dispositivo', 'pais', 'inscrito', 'detalhe', 'alcance_dim'].map(c => [c, '2020-01-01']))
let pedido: PedidoDimensoes
beforeAll(async () => { pedido = { edicao: await edicaoDe(S), canalId: C, hoje: HOJE, ytIds: [V], de: d(6), ate: d(1), desde: DESDE_ANTIGO } })

const dia = (r: Awaited<ReturnType<typeof lerDimensoes>>, conj: 'trafego' | 'dispositivo' | 'pais' | 'inscrito' | 'alcance_dim', n: number, yt = V): DiaLido => {
  if (r.acesso !== 'ok') throw new Error('esperava ok')
  const v = r.dado.conjuntos[conj].videos.find(x => x.ytId === yt)
  const x = v?.dias.find(y => y.dia === d(n))
  if (!x) throw new Error('dia ' + n + ' não veio')
  return x
}

describe('acesso: o token de edição', () => {
  it('sem token = negado e NENHUMA consulta (os dois leitores)', async () => {
    const db = fakeSupabase({ yt_own_video_dim_daily: [dim(V, d(3), 'country', 'BR', 5)] })
    expect(await lerDimensoes(db.client, { ...pedido, edicao: null })).toEqual({ acesso: 'negado' })
    expect(await lerDetalheDaOrigem(db.client, { ...pedido, edicao: null })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('objeto forjado = negado e nenhuma consulta', async () => {
    const db = fakeSupabase({})
    // @ts-expect-error literal não é um EdicaoDoSite
    const forjado: EdicaoDoSite = { siteId: S }
    expect(await lerDimensoes(db.client, { ...pedido, edicao: forjado })).toEqual({ acesso: 'negado' })
    expect(await lerDetalheDaOrigem(db.client, { ...pedido, edicao: forjado })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('canal que não é uuid = negado sem consulta (o Postgres lançaria 22P02)', async () => {
    const db = fakeSupabase({})
    expect(await lerDimensoes(db.client, { ...pedido, canalId: 'nao-e-uuid' })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('filtra por site (o do token) e por canal: dado de outro site ou de outro canal não aparece', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: [cob(V, 'base', d(6), d(1)), cob(V, 'pais', d(6), d(1))],
      yt_own_video_daily: [diario(V, d(3), 5)],
      yt_own_video_dim_daily: [dim(V, d(3), 'country', 'BR', 5), dim(V, d(3), 'country', 'US', 4, null, { site_id: 'outro-site' }), dim(V, d(3), 'country', 'AR', 4, null, { channel_id: OUTRO_CANAL })],
    })
    const r = await lerDimensoes(db.client, pedido)
    expect(dia(r, 'pais', 3).linhas.map(l => l.valor)).toEqual(['BR'])
    const outro = await lerDimensoes(db.client, { ...pedido, edicao: await edicaoDe('outro-site') })
    // com a prova de OUTRO site só aparece a linha daquele site (nunca a do site-a)
    expect(dia(outro, 'pais', 3).linhas.map(l => l.valor)).toEqual(['US'])
  })
})

describe('janela e teto de vídeos', () => {
  it('janela maior que 120 dias lança, sem consultar', async () => {
    const db = fakeSupabase({})
    await expect(lerDimensoes(db.client, { ...pedido, de: addDays(HOJE, -JANELA_MAX_DIAS - 1), ate: HOJE })).rejects.toThrow(/janela/i)
    await expect(lerDetalheDaOrigem(db.client, { ...pedido, de: addDays(HOJE, -JANELA_MAX_DIAS - 1), ate: HOJE })).rejects.toThrow(/janela/i)
    expect(db.trips).toEqual([])
  })
  it('exatamente 120 dias passa', async () => {
    const db = fakeSupabase({})
    const r = await lerDimensoes(db.client, { ...pedido, de: addDays(HOJE, -(JANELA_MAX_DIAS - 1)), ate: HOJE })
    expect(r.acesso).toBe('ok')
  })
  it('de depois de ate, ou data que não existe, lança', async () => {
    const db = fakeSupabase({})
    await expect(lerDimensoes(db.client, { ...pedido, de: d(1), ate: d(5) })).rejects.toThrow(/janela/i)
    await expect(lerDimensoes(db.client, { ...pedido, de: '2026-02-31', ate: d(1) })).rejects.toThrow(/janela/i)
    expect(db.trips).toEqual([])
  })
  it(`mais de ${TETO_VIDEOS_DIMENSOES} vídeos: só os ${TETO_VIDEOS_DIMENSOES} primeiros`, async () => {
    const db = fakeSupabase({})
    const ids = Array.from({ length: 60 }, (_, i) => 'vid' + String(i).padStart(8, '0'))
    const r = await lerDimensoes(db.client, { ...pedido, ytIds: ids })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.conjuntos.pais.videos.map(v => v.ytId)).toEqual(ids.slice(0, TETO_VIDEOS_DIMENSOES))
  })
})

describe('falha de leitura nunca vira lista vazia', () => {
  it('erro de banco é LANÇADO, sem o texto do banco', async () => {
    const db = fakeSupabase({}, { failOn: 'yt_own_video_dim_daily' })
    const err = await lerDimensoes(db.client, pedido).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ErroLeituraDimensoes)
    expect(err).toMatchObject({ tabela: 'yt_own_video_dim_daily', motivo: 'erro_de_banco' })
  })
  it('erro do detalhe é lançado e a mensagem não leva o conteúdo do banco (privacidade)', async () => {
    const db = fakeSupabase({})
    const sb = comErroNaTabela(db.client, 'yt_own_video_traffic_detail_daily', '57014')
    const err = await lerDetalheDaOrigem(sb, pedido).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ErroLeituraDimensoes)
    expect(String((err as Error).message)).not.toContain(SENTINELA)
    expect(JSON.stringify(err)).not.toContain(SENTINELA)
    expect(captureException).not.toHaveBeenCalled()
  })
  it('mais de 1.000 linhas pagina e traz todas', async () => {
    const dias = Array.from({ length: 6 }, (_, i) => d(i + 1))
    const rows: Row[] = []
    for (const dd of dias) for (let i = 0; i < 250; i++) rows.push(dim(V, dd, 'country', 'C' + String(i).padStart(3, '0'), 1))
    expect(rows.length).toBe(1500)
    const db = fakeSupabase({ yt_own_video_dim_daily: rows })
    const r = await lerDimensoes(db.client, pedido)
    const total = dias.reduce((s, dd) => s + dia(r, 'pais', Math.round((new Date(HOJE).getTime() - new Date(dd).getTime()) / 86_400_000)).linhas.length, 0)
    expect(total).toBe(1500)
    expect(db.ranges.filter(x => x.table === 'yt_own_video_dim_daily').length).toBeGreaterThan(1)
  })
  it('passou do teto de linhas: lança com a contagem, nunca corta em silêncio', async () => {
    const rows: Row[] = []
    for (let i = 0; i < 1500; i++) rows.push(dim(V, d(2), 'country', 'C' + String(i).padStart(4, '0'), 1))
    const db = fakeSupabase({ yt_own_video_dim_daily: rows })
    const err = await lerDimensoes(db.client, { ...pedido, tetoLinhas: 1200 }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ErroLeituraDimensoes)
    expect(err).toMatchObject({ motivo: 'passou_do_teto', tabela: 'yt_own_video_dim_daily' })
    expect((err as ErroLeituraDimensoes).lidas).toBeGreaterThan(1200)
    expect(String((err as Error).message)).toMatch(/\d/)
  })
  it('o detalhe também pagina e também passa do teto com falha', async () => {
    const rows: Row[] = []
    for (let i = 0; i < 1500; i++) rows.push(detalhe(V, d(2), '5', SENTINELA + i, 'h' + String(i).padStart(5, '0'), 1))
    const db = fakeSupabase({ yt_own_video_traffic_detail_daily: rows })
    const ok = await lerDetalheDaOrigem(db.client, pedido)
    if (ok.acesso !== 'ok') throw new Error('esperava ok')
    expect(ok.dado.conjunto.videos[0]!.dias.find(x => x.dia === d(2))!.linhas.length).toBe(1500)
    const err = await lerDetalheDaOrigem(db.client, { ...pedido, tetoLinhas: 1200 }).catch((e: unknown) => e)
    expect(err).toMatchObject({ motivo: 'passou_do_teto', tabela: 'yt_own_video_traffic_detail_daily' })
    expect(String((err as Error).message)).not.toContain(SENTINELA)
  })
})

describe('os estados do conjunto', () => {
  it('nada coletado: tabelas vazias = nao_coletado nos cinco conjuntos (não é zero), e cada dia é não medido', async () => {
    const db = fakeSupabase({})
    const r = await lerDimensoes(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    for (const c of Object.values(r.dado.conjuntos)) expect(c.estado).toEqual({ tipo: 'nao_coletado' })
    expect(estadoDoDiaLido(dia(r, 'pais', 3)).de('BR')).toMatchObject({ tipo: 'nao_medido', motivo: 'fora_da_cobertura' })
  })
  it('schema ausente (tabela nova não existe) = schema_ausente SÓ nos conjuntos dela, sem lançar', async () => {
    const db = fakeSupabase({})
    const r = await lerDimensoes(comErroNaTabela(db.client, 'yt_own_video_dim_daily', 'PGRST205'), pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    for (const c of ['trafego', 'dispositivo', 'pais', 'inscrito'] as const) {
      expect(r.dado.conjuntos[c].estado).toEqual({ tipo: 'schema_ausente' })
      expect(r.dado.conjuntos[c].videos).toEqual([])
    }
    expect(r.dado.conjuntos.alcance_dim.estado).toEqual({ tipo: 'nao_coletado' })
    const r2 = await lerDimensoes(comErroNaTabela(db.client, 'yt_own_video_reach_dim_daily', '42P01'), pedido)
    if (r2.acesso !== 'ok') throw new Error('esperava ok')
    expect(r2.dado.conjuntos.alcance_dim.estado.tipo).toBe('schema_ausente')
    expect(r2.dado.conjuntos.pais.estado.tipo).toBe('nao_coletado')
  })
  it('a cobertura (MG14) ausente derruba todos os conjuntos para schema_ausente, e o detalhe também', async () => {
    const db = fakeSupabase({})
    const sb = comErroNaTabela(db.client, 'yt_own_video_coverage', 'PGRST205')
    const r = await lerDimensoes(sb, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(new Set(Object.values(r.dado.conjuntos).map(c => c.estado.tipo))).toEqual(new Set(['schema_ausente']))
    const det = await lerDetalheDaOrigem(sb, pedido)
    if (det.acesso !== 'ok') throw new Error('esperava ok')
    expect(det.dado.conjunto.estado.tipo).toBe('schema_ausente')
  })
  it('passo desligado: dimensoes liga os quatro da API, normalizadores liga o detalhe e o alcance_dim', async () => {
    const db = fakeSupabase({})
    process.env.YT_OWN_STEPS_OFF = 'dimensoes'
    const a = await lerDimensoes(db.client, pedido)
    if (a.acesso !== 'ok') throw new Error('esperava ok')
    expect(a.dado.conjuntos.pais.estado).toEqual({ tipo: 'passo_desligado', comDados: false })
    expect(a.dado.conjuntos.alcance_dim.estado.tipo).toBe('nao_coletado')
    const det = await lerDetalheDaOrigem(db.client, pedido)
    if (det.acesso !== 'ok') throw new Error('esperava ok')
    expect(det.dado.conjunto.estado.tipo).toBe('nao_coletado')
    process.env.YT_OWN_STEPS_OFF = ' Normalizadores '
    const b = await lerDimensoes(db.client, pedido)
    if (b.acesso !== 'ok') throw new Error('esperava ok')
    expect(b.dado.conjuntos.alcance_dim.estado.tipo).toBe('passo_desligado')
    expect(b.dado.conjuntos.pais.estado.tipo).toBe('nao_coletado')
    const det2 = await lerDetalheDaOrigem(db.client, pedido)
    if (det2.acesso !== 'ok') throw new Error('esperava ok')
    expect(det2.dado.conjunto.estado.tipo).toBe('passo_desligado')
  })
  it('sem a variável (apagada): nenhum passo está desligado', async () => {
    delete process.env.YT_OWN_STEPS_OFF
    const db = fakeSupabase({})
    const r = await lerDimensoes(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(Object.values(r.dado.conjuntos).some(c => c.estado.tipo === 'passo_desligado')).toBe(false)
  })
  it('passo desligado com dado já coletado diz comDados e deixa os dias legíveis', async () => {
    process.env.YT_OWN_STEPS_OFF = 'dimensoes'
    const db = fakeSupabase({ yt_own_video_coverage: [cob(V, 'base', d(6), d(1)), cob(V, 'pais', d(6), d(1))], yt_own_video_daily: [diario(V, d(3), 5)], yt_own_video_dim_daily: [dim(V, d(3), 'country', 'BR', 5)] })
    const r = await lerDimensoes(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.conjuntos.pais.estado).toEqual({ tipo: 'passo_desligado', comDados: true })
    expect(estadoDoDiaLido(dia(r, 'pais', 3)).de('BR')).toMatchObject({ tipo: 'valor', views: 5 })
  })
  it('coleta em erro: a tentativa mais recente do kind com erro; "ok" mais antigo não a esconde', async () => {
    const db = fakeSupabase({
      yt_own_collection_attempts: [tentativa('dimensoes', d(3), 'ok'), tentativa('dimensoes', d(1), 'erro_http', { error: 'http_403', scope_id: 'outro' }), tentativa('normalizador_alcance_dim', d(1), 'ok')],
      yt_own_video_coverage: [cob(V, 'pais', d(6), d(1))],
    })
    const r = await lerDimensoes(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.conjuntos.pais.estado).toEqual({ tipo: 'coleta_em_erro', outcome: 'erro_http', comDados: true })
    expect(r.dado.conjuntos.trafego.estado.tipo).toBe('coleta_em_erro')
    expect(r.dado.conjuntos.alcance_dim.estado.tipo).toBe('nao_coletado')
  })
  it('um erro numa tentativa do dia mais recente basta, ainda que outra do mesmo dia tenha dado ok', async () => {
    const db = fakeSupabase({ yt_own_collection_attempts: [tentativa('dimensoes', d(1), 'ok'), tentativa('dimensoes', d(1), 'sem_conexao', { scope_id: 'outro' })] })
    const r = await lerDimensoes(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.conjuntos.pais.estado).toMatchObject({ tipo: 'coleta_em_erro', outcome: 'sem_conexao' })
  })
  it('só a tentativa do mesmo canal conta', async () => {
    const db = fakeSupabase({ yt_own_collection_attempts: [tentativa('dimensoes', d(1), 'erro_http', { channel_id: OUTRO_CANAL })] })
    const r = await lerDimensoes(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.conjuntos.pais.estado.tipo).toBe('nao_coletado')
  })
})

describe('os dias: nunca zero por ausência', () => {
  const cobertura = [cob(V, 'base', d(6), d(2)), cob(V, 'pais', d(6), d(2))]
  it('coberto com linha = valor; sem a linha e a soma fecha = zero medido; sem atividade na base = zero medido', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: cobertura,
      yt_own_video_daily: [diario(V, d(3), 5)],
      yt_own_video_dim_daily: [dim(V, d(3), 'country', 'BR', 5, 2.5)],
    })
    const r = await lerDimensoes(db.client, pedido)
    const d3 = estadoDoDiaLido(dia(r, 'pais', 3))
    expect(d3.de('BR')).toEqual({ tipo: 'valor', views: 5, minutos: 2.5 })
    expect(d3.de('US')).toEqual({ tipo: 'zero_medido' })
    expect(estadoDoDiaLido(dia(r, 'pais', 4)).de('BR')).toEqual({ tipo: 'zero_medido' })
  })
  it('soma abaixo da base = zero ou abaixo do limiar; acima = em revisão', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: cobertura,
      yt_own_video_daily: [diario(V, d(3), 9), diario(V, d(4), 2)],
      yt_own_video_dim_daily: [dim(V, d(3), 'country', 'BR', 5), dim(V, d(4), 'country', 'BR', 5)],
    })
    const r = await lerDimensoes(db.client, pedido)
    expect(estadoDoDiaLido(dia(r, 'pais', 3)).de('US')).toEqual({ tipo: 'zero_ou_abaixo_do_limiar' })
    expect(estadoDoDiaLido(dia(r, 'pais', 4)).de('BR')).toEqual({ tipo: 'em_revisao' })
  })
  it('dia fora da cobertura do conjunto = não medido, ainda que a base exista', async () => {
    const db = fakeSupabase({ yt_own_video_coverage: cobertura, yt_own_video_daily: [diario(V, d(1), 5)] })
    const r = await lerDimensoes(db.client, pedido)
    expect(estadoDoDiaLido(dia(r, 'pais', 1)).de('BR')).toMatchObject({ tipo: 'nao_medido', motivo: 'fora_da_cobertura' })
  })
  it('quatro famílias: dia fora da cobertura base = base não medida (buraco na base), nunca zero', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: [cob(V, 'base', d(6), d(5)), cob(V, 'base', d(3), d(2)), cob(V, 'pais', d(6), d(2)), cob(V, 'trafego', d(6), d(2))],
      yt_own_video_daily: [diario(V, d(4), 5)],
      yt_own_video_dim_daily: [dim(V, d(4), 'country', 'BR', 5)],
    })
    const r = await lerDimensoes(db.client, pedido)
    const buraco = dia(r, 'pais', 4)
    expect(buraco.baseMedida).toBe(false)
    expect(estadoDoDiaLido(buraco).de('BR')).toMatchObject({ tipo: 'nao_medido', motivo: 'base_nao_medida' })
    expect(estadoDoDiaLido(dia(r, 'trafego', 4)).de('YT_SEARCH')).toMatchObject({ motivo: 'base_nao_medida' })
    expect(dia(r, 'pais', 5).baseMedida).toBe(true)
  })
  it('alcance por dimensão: sem o relatório básico do dia normalizado = base não medida', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: [cob(V, 'alcance_dim', d(6), d(2))],
      yt_reporting_reports: [relatorio(d(3), false), relatorio(d(4), true)],
      yt_own_video_reach_daily: [alcanceBase(V, d(4), 10), alcanceBase(V, d(3), 10)],
      yt_own_video_reach_dim_daily: [alcanceDim(V, d(3), '5', '104', '4', 10)],
    })
    const r = await lerDimensoes(db.client, pedido)
    const sem = dia(r, 'alcance_dim', 3)
    expect(sem.baseMedida).toBe(false)
    expect(estadoDoDiaLido(sem).de('5|104|4')).toMatchObject({ tipo: 'nao_medido', motivo: 'base_nao_medida' })
    const com = dia(r, 'alcance_dim', 4)
    expect(com.baseMedida).toBe(true)
    expect(com.base).toBe(10)
    expect(estadoDoDiaLido(com).de('5|104|4')).toEqual({ tipo: 'zero_ou_abaixo_do_limiar' })
  })
  it('alcance por dimensão com relatório normalizado: valor, cliques estimados e zero medido quando a soma fecha', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: [cob(V, 'alcance_dim', d(6), d(2))],
      yt_reporting_reports: [relatorio(d(3), true)],
      yt_own_video_reach_daily: [alcanceBase(V, d(3), 10)],
      yt_own_video_reach_dim_daily: [alcanceDim(V, d(3), '5', '104', '4', 6, 1), alcanceDim(V, d(3), '5', '101', '2', 4, null)],
    })
    const r = await lerDimensoes(db.client, pedido)
    const x = dia(r, 'alcance_dim', 3)
    expect(x.linhas.map(l => [l.valor, l.views, l.cliquesEst])).toEqual([['5|101|2', 4, null], ['5|104|4', 6, 1]])
    expect(estadoDoDiaLido(x).de('5|104|4')).toMatchObject({ tipo: 'valor', views: 6 })
    expect(estadoDoDiaLido(x).de('7|102|9')).toEqual({ tipo: 'zero_medido' })
  })
  it('antes do início do conjunto traz a data de partida; o início vem do pedido ou do padrão', async () => {
    const db = fakeSupabase({ yt_own_video_coverage: cobertura })
    const r = await lerDimensoes(db.client, { ...pedido, desde: { pais: d(4) } })
    expect(estadoDoDiaLido(dia(r, 'pais', 5)).de('BR')).toEqual({ tipo: 'nao_medido', motivo: 'antes_do_inicio', desde: d(4) })
    expect(dia(r, 'pais', 4).antesDoInicio).toBe(false)
    expect(dia(r, 'trafego', 5).desde).toBe('2026-10-10')
    expect(dia(r, 'alcance_dim', 5).desde).toBe('2026-09-08')
  })
  it('código desconhecido aparece com rótulo de desconhecido, e o valor cru fica', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: [cob(V, 'base', d(6), d(2)), cob(V, 'trafego', d(6), d(2))],
      yt_own_video_daily: [diario(V, d(3), 5)],
      yt_own_video_dim_daily: [dim(V, d(3), 'traffic_source', 'YT_SEARCH', 3), dim(V, d(3), 'traffic_source', 'NOVA_ORIGEM', 2)],
    })
    const r = await lerDimensoes(db.client, pedido)
    const [conhecida, nova] = [dia(r, 'trafego', 3).linhas.find(l => l.valor === 'YT_SEARCH')!, dia(r, 'trafego', 3).linhas.find(l => l.valor === 'NOVA_ORIGEM')!]
    expect(conhecida).toMatchObject({ rotulo: 'Pesquisa do YouTube', catalogado: true })
    expect(nova.catalogado).toBe(false)
    expect(nova.rotulo.toLowerCase()).toContain('desconhecid')
    expect(nova.rotulo).not.toBe('')
  })
  it('valor ruim (negativo) vira nulo e entra em descartados; nunca zero', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: cobertura,
      yt_own_video_daily: [diario(V, d(3), 5)],
      yt_own_video_dim_daily: [dim(V, d(3), 'country', 'BR', -4, 1)],
    })
    const r = await lerDimensoes(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(dia(r, 'pais', 3).linhas[0]).toMatchObject({ valor: 'BR', views: null, minutos: 1 })
    expect(r.dado.descartados).toBe(1)
  })
  it('um dia por posição da janela, em ordem crescente, para cada vídeo', async () => {
    const db = fakeSupabase({})
    const r = await lerDimensoes(db.client, { ...pedido, ytIds: [V, 'vid00000002'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    const v = r.dado.conjuntos.pais.videos
    expect(v.map(x => x.ytId)).toEqual([V, 'vid00000002'])
    expect(v[0]!.dias.map(x => x.dia)).toEqual([d(6), d(5), d(4), d(3), d(2), d(1)])
  })
})

describe('lerDetalheDaOrigem', () => {
  const cobDet = [cob(V, 'base', d(6), d(2)), cob(V, 'detalhe', d(6), d(2))]
  it('traz detail e source_type como vieram, com o tipo de detalhe e o rótulo da origem', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: cobDet,
      yt_own_video_daily: [diario(V, d(3), 10)],
      yt_own_video_traffic_detail_daily: [detalhe(V, d(3), '5', SENTINELA, 'a'.repeat(64), 6, 1.5), detalhe(V, d(3), '5', '', 'b'.repeat(64), 4, null)],
    })
    const r = await lerDetalheDaOrigem(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    const x = r.dado.conjunto.videos[0]!.dias.find(y => y.dia === d(3))!
    expect(x.linhas.map(l => [l.sourceType, l.detail, l.views, l.minutos])).toEqual(expect.arrayContaining([['5', SENTINELA, 6, 1.5], ['5', '', 4, null]]))
    expect(x.linhas[0]).toMatchObject({ rotulo: 'Pesquisa do YouTube', catalogado: true, tipoDetalhe: 'termo' })
    expect(r.dado.conjunto.estado).toEqual({ tipo: 'coletado' })
    expect(estadoDoDiaLido(x).soma).toBe(10)
    expect(estadoDoDiaLido(x).de(x.linhas[0]!.valor).tipo).toBe('valor')
  })
  it('a chave da linha não leva o conteúdo do detalhe (só o hash)', async () => {
    const db = fakeSupabase({ yt_own_video_coverage: cobDet, yt_own_video_traffic_detail_daily: [detalhe(V, d(3), '5', SENTINELA, 'c'.repeat(64), 6)] })
    const r = await lerDetalheDaOrigem(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.conjunto.videos[0]!.dias.find(y => y.dia === d(3))!.linhas[0]!.valor).not.toContain(SENTINELA)
  })
  it('dia fora da cobertura base = base não medida; fora da cobertura do detalhe = não medido', async () => {
    const db = fakeSupabase({ yt_own_video_coverage: [cob(V, 'base', d(6), d(5)), cob(V, 'detalhe', d(6), d(2))] })
    const r = await lerDetalheDaOrigem(db.client, { ...pedido, desde: undefined })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    const dias = r.dado.conjunto.videos[0]!.dias
    expect(estadoDoDiaLido(dias.find(y => y.dia === d(3))!).de('x')).toMatchObject({ tipo: 'nao_medido', motivo: 'base_nao_medida' })
    expect(estadoDoDiaLido(dias.find(y => y.dia === d(1))!).de('x')).toMatchObject({ tipo: 'nao_medido', motivo: 'fora_da_cobertura' })
    expect(dias.find(y => y.dia === d(6))!.desde).toBe('2026-09-08')
  })
  it('nada coletado = nao_coletado; coleta em erro usa o kind normalizador_trafego', async () => {
    const vazio = await lerDetalheDaOrigem(fakeSupabase({}).client, pedido)
    if (vazio.acesso !== 'ok') throw new Error('esperava ok')
    expect(vazio.dado.conjunto.estado).toEqual({ tipo: 'nao_coletado' })
    const db = fakeSupabase({ yt_own_collection_attempts: [tentativa('normalizador_trafego', d(1), 'erro_http'), tentativa('dimensoes', d(1), 'ok')] })
    const r = await lerDetalheDaOrigem(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.conjunto.estado).toMatchObject({ tipo: 'coleta_em_erro', outcome: 'erro_http' })
  })
  it('schema ausente do detalhe não lança', async () => {
    const r = await lerDetalheDaOrigem(comErroNaTabela(fakeSupabase({}).client, 'yt_own_video_traffic_detail_daily', '42P01'), pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.conjunto.estado).toEqual({ tipo: 'schema_ausente' })
    expect(r.dado.conjunto.videos).toEqual([])
  })
  it('filtra por site e canal', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: cobDet,
      yt_own_video_traffic_detail_daily: [detalhe(V, d(3), '5', 'meu', 'd'.repeat(64), 1), detalhe(V, d(3), '5', 'outro', 'e'.repeat(64), 1, null, { site_id: 'outro-site' }), detalhe(V, d(3), '5', 'canal', 'f'.repeat(64), 1, null, { channel_id: OUTRO_CANAL })],
    })
    const r = await lerDetalheDaOrigem(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.conjunto.videos[0]!.dias.find(y => y.dia === d(3))!.linhas.map(l => l.detail)).toEqual(['meu'])
  })
})
