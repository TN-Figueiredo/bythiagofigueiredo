// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sentry = vi.hoisted(() => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)
const saude = vi.hoisted(() => ({ recordCronFailure: vi.fn(), recordCronSuccess: vi.fn() }))
vi.mock('@/lib/cron-health', () => saude)
const settle = vi.hoisted(() => ({ encerrarComPrazo: vi.fn() }))
vi.mock('@/lib/youtube/ab-evaluate-phases', () => settle)

import { rodarDecisaoV2, selecionarParaDecisao, notaDeFalhaDecisao } from '@/lib/youtube/ab-gravacao/decisao-v2-step'
import type { EntradasParaDecisao } from '@/lib/youtube/ab-gravacao/retrato-step'
import { getVariantForCycle } from '@/lib/youtube/ab-rotation'
import { addDays, boundsAnalytics, dayPt } from '@/lib/youtube/coleta/day-pt'
import { criarFakeSb, type FakeSb, type Linha } from '../../helpers/fake-sb-gravacao'

const VID = 'abcdefghijk'
const agora = new Date()
const hoje = dayPt(agora)
const ontem = addDays(hoje, -1)
const N_OK = 10_300

interface Opc {
  id?: string; status?: 'active' | 'completed' | 'archived'; nDias?: number; V?: 2 | 3 | 4; v2?: Record<string, unknown> | null
  completed_reason?: string | null; finais?: boolean; semLinhas?: boolean; semCiclos?: boolean; originais?: number
  ctrNaoOriginal?: number; teto?: number; completedEm?: string | null
}
function cenario(o: Opc = {}): { f: FakeSb; id: string; entradas: EntradasParaDecisao } {
  const id = o.id ?? 't1'
  const V = o.V ?? 2
  const nDias = o.nDias ?? 8
  const status = o.status ?? 'active'
  const vs = ['vo', 'va', 'vb', 'vc'].slice(0, V)
  const dia = (i: number) => addDays(hoje, i - nDias)
  const ciclos: Linha[] = []
  const dias: Linha[] = []
  const nCiclos = status === 'active' ? nDias + 1 : nDias
  for (let i = 0; i < nCiclos; i++) {
    const v = vs[getVariantForCycle(V, i)]!
    const ini = new Date(boundsAnalytics(dia(i)).start).toISOString()
    const fim = i + 1 < nCiclos ? new Date(boundsAnalytics(dia(i + 1)).start).toISOString() : status === 'active' ? null : new Date(boundsAnalytics(hoje).start).toISOString()
    ciclos.push({ id: `c${id}${i}`, test_id: id, variant_id: v, started_at: ini, ended_at: fim, applied_metadata: null, cycle_number: i })
    if (i < nDias && !o.semLinhas) {
      dias.push({
        test_id: id, day_pt: dia(i), site_id: 's1', variant_id: v, motivo_sem_variante: null, alcance_estado: 'medido', impressoes: 5000,
        ctr: v === 'vo' ? 0.04 : (o.ctrNaoOriginal ?? 0.05), views: 100, views_estado: 'medido', retratado_em: agora.toISOString(), final: o.finais ?? true,
      })
    }
  }
  const completedAt = status === 'active' ? null : (o.completedEm ?? new Date(boundsAnalytics(hoje).start + 3_600_000).toISOString())
  const variantes: Linha[] = vs.map((v, k) => ({ id: v, test_id: id, is_original: o.originais === 0 ? false : o.originais === 2 ? k < 2 : k === 0 }))
  const v2 = o.v2 === null ? undefined : { n: N_OK, k: 7.85, p1: 0.04, ...(o.v2 ?? {}) }
  const teste: Linha = {
    id, site_id: 's1', status, regra_duracao: 'v2', paused_at: null, completed_at: completedAt, completed_reason: o.completed_reason ?? (status === 'active' ? null : 'regra_v2'),
    original_title: null, started_at: ciclos[0]!.started_at, result_metadata: v2 ? { v2 } : {}, config: { max_duration_days: o.teto ?? 14 },
    youtube_videos: { youtube_video_id: VID, channel_id: 'ch1' },
  }
  const f = criarFakeSb({ ab_tests: [teste], ab_test_variants: variantes, ab_test_cycles: o.semCiclos ? [] : ciclos, ab_test_dias: dias })
  f.rpcRetorno.ab_test_v2_gravar = 1
  const entradas: EntradasParaDecisao = {
    porTeste: new Map(), ciclosPorTeste: new Map(), alcancePorVideoDia: new Map(), relatoriosPorCanalDia: new Map(), metaPorVideoDia: new Map(),
    videosLidos: new Set([VID]),
  }
  return { f, id, entradas }
}
const gravs = (f: FakeSb) => f.rpcs.filter(r => r.nome === 'ab_test_v2_gravar')
const ultima = (f: FakeSb) => gravs(f).at(-1)?.args.p_v2 as Record<string, unknown>
const rodar = (c: { f: FakeSb; entradas: EntradasParaDecisao }, t = Date.now()) => rodarDecisaoV2(c.f.sb, agora, c.entradas, t)

beforeEach(() => {
  vi.clearAllMocks()
  settle.encerrarComPrazo.mockResolvedValue([{ testId: 't1', resultado: 'feito' }])
})

describe('selecionarParaDecisao (pura)', () => {
  const L = (o: Linha): Linha => ({ id: 'x', status: 'completed', completed_reason: 'regra_v2', result_metadata: {}, ...o })
  const ids = (ls: Linha[]) => selecionarParaDecisao(ls as never).length
  it('matriz de 8 linhas', () => {
    expect(ids([L({ status: 'active' })])).toBe(1) // ativo entra
    expect(ids([L({ result_metadata: { v2: { encerrado_em_dia: '2026-10-01', provisorio: false } } })])).toBe(0) // final
    expect(ids([L({ result_metadata: { v2: { encerrado_em_dia: '2026-10-01', provisorio: true } } })])).toBe(1)
    expect(ids([L({ result_metadata: { v2: { encerrado_em_dia: '2026-10-01' } } })])).toBe(1) // provisorio nulo
    expect(ids([L({ completed_reason: 'manual_winner' })])).toBe(0) // à mão, sem encerrado_em_dia
    expect(ids([L({ completed_reason: 'manual_winner', result_metadata: { v2: { encerrado_em_dia: '2026-10-01', provisorio: true } } })])).toBe(1) // aplicado (T11b)
    expect(ids([L({ status: 'archived', result_metadata: { v2: { encerrado_em_dia: '2026-10-01', provisorio: true } } })])).toBe(1)
    expect(ids([L({ status: 'paused' })])).toBe(0)
  })
  it('concluído por regra_v2 sem encerrado_em_dia (gravação falhou) entra; sem chave v2 e outro motivo fica fora', () => {
    expect(ids([L({})])).toBe(1)
    expect(ids([L({ completed_reason: 'max_duration' })])).toBe(0)
  })
})

describe('guardas v1 (Yannis D4)', () => {
  it('terceira guarda: selecionarParaDecisao descarta linha com regra_duracao v1, mesmo ativa', () => {
    const L = (o: Linha): Linha => ({ id: 'x', status: 'active', completed_reason: null, result_metadata: {}, regra_duracao: 'v2', ...o })
    expect(selecionarParaDecisao([L({})] as never)).toHaveLength(1)
    expect(selecionarParaDecisao([L({ regra_duracao: 'v1' })] as never)).toHaveLength(0)
  })
  it('segunda guarda: RPC devolvendo -1 no congelamento do N (teste v1 que vazou da consulta): sem settle e uma só falha', async () => {
    const c = cenario({ v2: null, nDias: 14, teto: 14 })
    c.f.rpcRetorno.ab_test_v2_gravar = -1
    const r = await rodar(c)
    expect(settle.encerrarComPrazo).not.toHaveBeenCalled()
    expect(r).toMatchObject({ status: 'error' })
    expect((r as { error: string }).error).toContain('gravar v2 falhou')
    expect(saude.recordCronFailure).toHaveBeenCalledTimes(1)
  })
})

describe('notaDeFalhaDecisao', () => {
  it('30 falhas: até 480 caracteres e termina em "e mais N"', () => {
    const n = notaDeFalhaDecisao(Array.from({ length: 30 }, (_, i) => `teste-${i}: nao_voltou ${'x'.repeat(20)}`))
    expect(n.length).toBeLessThanOrEqual(480)
    expect(n).toMatch(/ e mais \d+$/)
  })
  it('1 falha: sem sufixo', () => { expect(notaDeFalhaDecisao(['teste-1: erro'])).toBe('teste-1: erro') })
})

describe('rodarDecisaoV2: leitura', () => {
  it('nenhum teste v2: só as duas consultas de seleção', async () => {
    const f = criarFakeSb({})
    const r = await rodarDecisaoV2(f.sb, agora, undefined, Date.now())
    expect(r).toMatchObject({ status: 'ok', avaliados: 0 })
    expect(f.consultasLogicas()).toBe(2)
    expect(f.rpcs).toHaveLength(0)
  })

  it('Y-2: a decisão usa o banco (100 impressões final), não o recálculo em memória', async () => {
    const c = cenario({ nDias: 6 })
    for (const l of c.f.tabelas.ab_test_dias!) l.impressoes = 100
    c.entradas.alcancePorVideoDia.set(`${VID}|${ontem}`, { thumbnail_impressions: 900, thumbnail_ctr: 0.04, source_report_id: 'r', report_create_time: agora.toISOString() })
    await rodar(c)
    const ua = (ultima(c.f).ultima_avaliacao as { volume: Record<string, number> })
    expect(ua.volume.vo).toBe(300) // 3 dias x 100
  })

  it('A5: linha com a chave extra "ciclos" é recusada pela leitura sem ela? Não: a seleção de colunas a exclui', async () => {
    const c = cenario({ nDias: 6 })
    for (const l of c.f.tabelas.ab_test_dias!) l.ciclos = [{ x: 1 }]
    const r = await rodar(c)
    expect(r).toMatchObject({ status: 'ok', avaliados: 1 })
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('sem ciclos: pulado com Sentry (A7d)', async () => {
    const c = cenario({ semCiclos: true })
    const r = await rodar(c)
    expect(r).toMatchObject({ status: 'ok', avaliados: 0 })
    expect(sentry.captureMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ fingerprint: ['ab-decisao-sem-ciclos', 't1'] }))
  })

  it('N1: V=3 em que a 3a variante nunca foi atribuída: 3 chaves em dias_validos (a 3a com 0)', async () => {
    const c = cenario({ V: 3, nDias: 6 })
    c.f.tabelas.ab_test_dias = c.f.tabelas.ab_test_dias!.filter(l => l.variant_id !== 'vb')
    await rodar(c)
    const ua = ultima(c.f).ultima_avaliacao as { dias_validos: Record<string, number> }
    expect(Object.keys(ua.dias_validos).sort()).toEqual(['va', 'vb', 'vo'])
    expect(ua.dias_validos.vb).toBe(0)
  })

  it('N1: 0 original, 2 originais ou V=4: pulado com Sentry', async () => {
    for (const o of [{ originais: 0 }, { originais: 2 }, { V: 4 as const }]) {
      vi.clearAllMocks()
      const c = cenario(o)
      const r = await rodar(c)
      expect(r).toMatchObject({ avaliados: 0 })
      expect(sentry.captureMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ fingerprint: ['ab-decisao-variantes', 't1'] }))
      expect(gravs(c.f)).toHaveLength(0)
    }
  })

  it('lerDiasDosTestes com erro de banco: falha (não "pulado"), uma só chamada de falha', async () => {
    const c = cenario({})
    c.f.erros.ab_test_dias = 'caiu'
    const r = await rodar(c)
    expect(r).toMatchObject({ status: 'error', health_written: true })
    expect(saude.recordCronFailure).toHaveBeenCalledTimes(1)
    expect(saude.recordCronFailure).toHaveBeenCalledWith('ab-retrato', expect.stringMatching(/^decisao_v2: /))
  })
})

describe('rodarDecisaoV2: congelamento do N', () => {
  it('congela com a flag; 2a rodada devolve 0 e usa o gravado; vídeo fora de videosLidos não congela', async () => {
    const c = cenario({ v2: null, nDias: 3 })
    await rodar(c)
    const g = gravs(c.f).filter(r => r.args.p_so_se_sem_n === true)
    expect(g).toHaveLength(1)
    expect(g[0]!.args.p_v2).toMatchObject({ n: expect.any(Number), base_estimada: true })
    // 2a rodada: o banco já tem n (a RPC devolve 0)
    const d = cenario({ v2: null, nDias: 3 })
    d.f.rpcRetorno.ab_test_v2_gravar = 0
    ;(d.f.tabelas.ab_tests![0]!.result_metadata as Record<string, unknown>) = { v2: { n: 777 } }
    // a releitura traz o n gravado por outro escritor
    await rodar(d)
    expect(d.f.rpcs.some(r => r.nome === 'ab_test_v2_gravar')).toBe(true)
    // fora de videosLidos
    const e = cenario({ v2: null, nDias: 3 })
    e.entradas.videosLidos = new Set()
    await rodar(e)
    expect(gravs(e.f).filter(r => r.args.p_so_se_sem_n === true)).toHaveLength(0)
    expect(sentry.captureMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ fingerprint: ['ab-decisao-sem-entrada', 't1'] }))
    expect((ultima(e.f).ultima_avaliacao as { sem_n?: boolean }).sem_n).toBe(true)
  })

  it('N4: sem leitura do vídeo por várias rodadas e depois no teto: congela com p1 0,04, sem_leitura, e há desfecho', async () => {
    const c = cenario({ v2: null, nDias: 15, teto: 15 })
    c.entradas.videosLidos = new Set()
    await rodar(c)
    const cong = gravs(c.f).find(r => r.args.p_so_se_sem_n === true)
    expect(cong?.args.p_v2).toMatchObject({ p1: 0.04, base_estimada: true, p1_motivo: 'sem_leitura' })
    expect(settle.encerrarComPrazo).toHaveBeenCalled()
    const fim = gravs(c.f).at(-1)!.args.p_v2 as { desfecho: string }
    expect(fim.desfecho).toBeDefined()
    expect(fim.desfecho).not.toBe('inconclusivo_por_falha')
  })
})

describe('rodarDecisaoV2: ativos', () => {
  it('seguir: grava só ultima_avaliacao; nada de settle', async () => {
    const c = cenario({ nDias: 6 })
    const r = await rodar(c)
    expect(r).toMatchObject({ status: 'ok', avaliados: 1, encerrados: 0 })
    expect(settle.encerrarComPrazo).not.toHaveBeenCalled()
    expect(ultima(c.f).ultima_avaliacao).toMatchObject({ acao: 'seguir', dias_relogio: 6 })
    expect(ultima(c.f).desfecho).toBeUndefined()
  })

  it('N7/m3: pisos fechados e ninguém passa => vencedor_sugerido null + por_variante novo', async () => {
    const c = cenario({ nDias: 8, ctrNaoOriginal: 0.04 })
    await rodar(c)
    const p = ultima(c.f)
    expect(p.vencedor_sugerido).toBeNull()
    expect(p).toHaveProperty('por_variante')
  })

  it('B1/B2: variante significativamente pior nunca é o sugerido; todas piores => a original; a melhor continua', async () => {
    const pior = cenario({ nDias: 12, ctrNaoOriginal: 0.02 })
    await rodar(pior)
    expect(ultima(pior.f).vencedor_sugerido).toBe('vo')
    const melhor = cenario({ nDias: 12, ctrNaoOriginal: 0.08 })
    await rodar(melhor)
    expect(ultima(melhor.f).vencedor_sugerido).toBe('va')
  })

  it('encerrar (teto): settle feito grava desfecho completo, tentativa_falhou null e p_hist', async () => {
    const c = cenario({ nDias: 14, teto: 14 })
    const r = await rodar(c)
    expect(r).toMatchObject({ status: 'ok', encerrados: 1, desfechos: 1 })
    const g = gravs(c.f).at(-1)!
    expect(g.args.p_v2).toMatchObject({ desfecho: expect.any(String), desfecho_no_encerramento: expect.any(String), encerrado_em_dia: ontem, tentativa_falhou: null })
    expect(g.args.p_hist).toEqual([{ em: expect.any(String), desfecho: (g.args.p_v2 as { desfecho: string }).desfecho }])
    expect(saude.recordCronFailure).not.toHaveBeenCalled()
  })

  it('settle lança: sem desfecho, tentativa_falhou, uma falha; depois sucesso limpa', async () => {
    const c = cenario({ nDias: 14, teto: 14 })
    settle.encerrarComPrazo.mockResolvedValue([{ testId: 't1', resultado: 'erro', erro: 'boom' }])
    const r = await rodar(c)
    expect(r).toMatchObject({ status: 'error', health_written: true })
    expect(ultima(c.f).desfecho).toBeUndefined()
    expect(ultima(c.f).tentativa_falhou).toMatchObject({ motivo: expect.any(String) })
    expect(saude.recordCronFailure).toHaveBeenCalledTimes(1)
  })

  it('nao_voltou: desfecho gravado na mesma rodada, volta_falhou à parte e recordCronFailure', async () => {
    const c = cenario({ nDias: 14, teto: 14 })
    settle.encerrarComPrazo.mockResolvedValue([{ testId: 't1', resultado: 'nao_voltou' }])
    const r = await rodar(c)
    expect(r.status).toBe('error')
    expect(ultima(c.f).desfecho).toBeDefined()
    expect(ultima(c.f)).toHaveProperty('volta_falhou')
    expect(ultima(c.f).tentativa_falhou).toBeNull()
    expect(saude.recordCronFailure).toHaveBeenCalledTimes(1)
  })

  it('pausado_teste_youtube: motivo teste_youtube, sem recordCronFailure, sem desfecho', async () => {
    const c = cenario({ nDias: 14, teto: 14 })
    settle.encerrarComPrazo.mockResolvedValue([{ testId: 't1', resultado: 'pausado_teste_youtube' }])
    const r = await rodar(c)
    expect(r.status).toBe('ok')
    expect(ultima(c.f)).toMatchObject({ tentativa_falhou: { motivo: 'teste_youtube' } })
    expect(ultima(c.f).desfecho).toBeUndefined()
    expect(saude.recordCronFailure).not.toHaveBeenCalled()
  })

  it('em_andamento: mesmo dia PT não falha; dia PT seguinte falha', async () => {
    settle.encerrarComPrazo.mockResolvedValue([{ testId: 't1', resultado: 'outro_escritor' }])
    const a = cenario({ nDias: 14, teto: 14 })
    expect((await rodar(a)).status).toBe('ok')
    const b = cenario({ nDias: 14, teto: 14, v2: { tentativa_falhou: { em: agora.toISOString(), motivo: 'outro_escritor', em_andamento_desde: hoje } } })
    expect((await rodar(b)).status).toBe('ok')
    const c = cenario({ nDias: 14, teto: 14, v2: { tentativa_falhou: { em: agora.toISOString(), motivo: 'outro_escritor', em_andamento_desde: addDays(hoje, -1) } } })
    expect((await rodar(c)).status).toBe('error')
    expect(saude.recordCronFailure).toHaveBeenCalledTimes(1)
  })

  it('ja_encerrado e adiado_por_tempo: nada gravado e sem falha', async () => {
    for (const resultado of ['ja_encerrado', 'adiado_por_tempo'] as const) {
      settle.encerrarComPrazo.mockResolvedValue([{ testId: 't1', resultado }])
      const c = cenario({ nDias: 14, teto: 14 })
      const r = await rodar(c)
      expect(r.status).toBe('ok')
      expect(gravs(c.f).some(g => 'tentativa_falhou' in (g.args.p_v2 as object))).toBe(false)
    }
  })

  it('exceção em um teste não derruba os outros', async () => {
    const c = cenario({ nDias: 6 })
    const outro = cenario({ id: 't2', nDias: 6 })
    for (const k of ['ab_tests', 'ab_test_variants', 'ab_test_cycles', 'ab_test_dias'] as const) c.f.tabelas[k]!.push(...outro.f.tabelas[k]!)
    let n = 0
    const orig = c.f.sb.rpc.bind(c.f.sb)
    ;(c.f.sb as { rpc: unknown }).rpc = (nome: string, args: Record<string, unknown>) => { if (n++ === 0) throw new Error('x'); return orig(nome, args) }
    const r = await rodar(c)
    expect(r.status).toBe('error')
    expect(gravs(c.f).length).toBeGreaterThanOrEqual(1) // o 2o teste foi avaliado
    expect(saude.recordCronFailure).toHaveBeenCalledTimes(1)
  })
})

describe('rodarDecisaoV2: concluídos', () => {
  const concluido = (o: Opc = {}) => cenario({ status: 'completed', nDias: 12, finais: false, v2: { encerrado_em_dia: ontem, desfecho: 'sem_diferenca_detectavel', desfecho_no_encerramento: 'sem_diferenca_detectavel', provisorio: true }, ...o })

  it('desfecho muda: grava com p_hist e mantém desfecho_no_encerramento', async () => {
    const c = concluido({ ctrNaoOriginal: 0.08 })
    await rodar(c)
    const g = gravs(c.f).at(-1)!
    expect(g.args.p_v2).toMatchObject({ desfecho: 'vencedor_provavel' })
    expect(g.args.p_v2).not.toHaveProperty('desfecho_no_encerramento', 'vencedor_provavel')
    expect(g.args.p_hist).toEqual([{ em: expect.any(String), desfecho: 'vencedor_provavel' }])
  })

  it('A7a: concluído sem linhas nunca finaliza', async () => {
    const c = concluido({ semLinhas: true })
    await rodar(c)
    expect(gravs(c.f).some(g => (g.args.p_v2 as { provisorio?: boolean }).provisorio === false)).toBe(false)
  })

  it('A7b e N6: todas as linhas final (inclui o dia de completed_at) => desfecho_final sem finalizado_por_prazo', async () => {
    const c = concluido({ finais: true, status: 'archived' })
    // linha do dia de completed_at (hoje, depois de encerrado_em_dia) fora do filtro: não pode virar prazo
    c.f.tabelas.ab_test_dias!.push({ ...c.f.tabelas.ab_test_dias![0]!, day_pt: hoje, final: false })
    await rodar(c)
    const p = ultima(c.f)
    expect(p).toMatchObject({ provisorio: false, desfecho_final: expect.any(String) })
    expect(p.finalizado_por_prazo).toBeUndefined()
  })

  it('A7c: passou encerrado_em_dia + 12 => finalizado_por_prazo e entra em falhas', async () => {
    const velho = addDays(hoje, -14)
    const c = concluido({ v2: { encerrado_em_dia: velho, desfecho: 'sem_diferenca_detectavel', desfecho_no_encerramento: 'sem_diferenca_detectavel', provisorio: true } })
    const r = await rodar(c)
    expect(ultima(c.f)).toMatchObject({ provisorio: false, finalizado_por_prazo: true })
    expect(r.status).toBe('error')
  })

  it('A9: settle ok e RPC do desfecho falhou: pelo rede_tentou_em => inconclusivo_por_falha', async () => {
    const compl = new Date(boundsAnalytics(hoje).start + 3_600_000)
    const c = cenario({ status: 'completed', nDias: 12, completedEm: compl.toISOString(), v2: { rede_tentou_em: new Date(compl.getTime() - 120_000).toISOString() } })
    await rodar(c)
    expect(ultima(c.f)).toMatchObject({ desfecho: 'inconclusivo_por_falha', desfecho_no_encerramento: 'inconclusivo_por_falha', provisorio: false })
  })

  it('A9: sem rede_tentou_em, pelo relógio >= teto + 3 => inconclusivo_por_falha', async () => {
    const c = cenario({ status: 'completed', nDias: 17, teto: 14 })
    await rodar(c)
    expect(ultima(c.f)).toMatchObject({ desfecho: 'inconclusivo_por_falha' })
  })

  it('N4: settle ok pela regra e gravação falhou: desfecho do banco, igual ao recálculo do dia', async () => {
    const c = cenario({ status: 'completed', nDias: 12, teto: 14 })
    await rodar(c)
    const p = ultima(c.f) as { desfecho: string; desfecho_no_encerramento: string }
    expect(p.desfecho_no_encerramento).toBe(p.desfecho)
    expect(p.desfecho).not.toBe('inconclusivo_por_falha')
  })
})

describe('rodarDecisaoV2: N3 uma só falha por dia', () => {
  it('dois testes falhando no mesmo dia => 1 chamada a recordCronFailure', async () => {
    const c = cenario({ nDias: 14, teto: 14 })
    const outro = cenario({ id: 't2', nDias: 14, teto: 14 })
    for (const k of ['ab_tests', 'ab_test_variants', 'ab_test_cycles', 'ab_test_dias'] as const) c.f.tabelas[k]!.push(...outro.f.tabelas[k]!)
    settle.encerrarComPrazo.mockResolvedValue([{ testId: 'x', resultado: 'erro', erro: 'boom' }])
    const r = await rodar(c)
    expect(r.status).toBe('error')
    expect(saude.recordCronFailure).toHaveBeenCalledTimes(1)
  })
})
