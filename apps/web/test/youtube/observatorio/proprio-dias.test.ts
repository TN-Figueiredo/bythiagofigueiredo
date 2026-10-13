import { describe, it, expect } from 'vitest'
import { periodoDoAlcance, montarDias, resumir, alcancePorVideo, motivoDiaTexto, JANELA_ALCANCE_DIAS } from '@/lib/youtube/observatorio/proprio/dias'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { AlcanceCanal, RelatorioDia, AlcanceLinha } from '@/lib/youtube/observatorio/proprio/tipos'

const rel = (dia: string, status: RelatorioDia['status'] = 'baixado', normalizado = true): RelatorioDia => ({ dia, status, normalizado })
const lin = (ytId: string, dia: string, imp: number | null, ctr: number | null): AlcanceLinha => ({ ytId, dia, imp, ctr })
/** Longe depois de todos os dias fixos destes casos: D e D-1 não tocam nenhum deles. */
const HOJE = addDays('2026-10-08', 30)
const canal = (relatorios: RelatorioDia[], linhas: AlcanceLinha[]): AlcanceCanal => ({ canalId: 'c1', relatorios, linhas, ultimoRelatorio: null, descartados: 0 })

describe('período do alcance', () => {
  it('sem relatório nenhum: null (nunca um período inventado)', () => {
    expect(periodoDoAlcance([])).toBeNull()
  })
  it('termina no relatório mais novo, de qualquer status, e começa no mais antigo quando há menos de 30 dias', () => {
    expect(periodoDoAlcance([rel('2026-10-01'), rel('2026-10-05', 'listado', false)])).toEqual({ de: '2026-10-01', ate: '2026-10-05', dias: 5 })
  })
  it('corta em 30 dias', () => {
    const p = periodoDoAlcance([rel('2026-08-01'), rel('2026-10-08')])
    expect(p).toEqual({ de: '2026-09-09', ate: '2026-10-08', dias: JANELA_ALCANCE_DIAS })
  })
})

describe('os três estados do dia', () => {
  const a = canal(
    [rel('2026-10-01'), rel('2026-10-02', 'vazio'), rel('2026-10-03', 'listado', false), rel('2026-10-05', 'erro', false), rel('2026-10-06', 'baixado', false), rel('2026-10-07', 'expirado_sem_baixar', false)],
    [lin('v1', '2026-10-01', 10, 0.1), lin('v2', '2026-10-01', 5, 0.2)],
  )
  const { dias, periodo } = montarDias(a, { hoje: HOJE })
  const de = (d: string) => dias.find(x => x.dia === d)!
  it('todo dia do período aparece, inclusive o que não tem relatório', () => {
    expect(periodo).toEqual({ de: '2026-10-01', ate: '2026-10-07', dias: 7 })
    expect(dias.map(d => d.dia)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'])
  })
  it('dia com linha: impressões somadas e cliques sem arredondar', () => {
    expect(de('2026-10-01')).toEqual({ dia: '2026-10-01', situacao: 'com-impressoes', motivo: null, imp: 15, cliques: 2 })
  })
  it('relatório vazio e normalizado: ZERO MEDIDO, com 0 e não null', () => {
    expect(de('2026-10-02')).toEqual({ dia: '2026-10-02', situacao: 'zero-medido', motivo: null, imp: 0, cliques: 0 })
  })
  it('não medido tem null nas duas contagens e o motivo de cada caso', () => {
    expect(de('2026-10-03')).toMatchObject({ situacao: 'nao-medido', motivo: 'nao-baixado', imp: null, cliques: null })
    expect(de('2026-10-04')).toMatchObject({ situacao: 'nao-medido', motivo: 'sem-relatorio', imp: null, cliques: null })
    expect(de('2026-10-05')).toMatchObject({ situacao: 'nao-medido', motivo: 'erro', imp: null })
    expect(de('2026-10-06')).toMatchObject({ situacao: 'nao-medido', motivo: 'nao-baixado', imp: null })
    expect(de('2026-10-07')).toMatchObject({ situacao: 'nao-medido', motivo: 'expirado', imp: null })
  })
  it('status que o código não conhece é não medido, nunca zero', () => {
    const x = montarDias(canal([rel('2026-10-01', 'desconhecido', true)], []), { hoje: HOJE })
    expect(x.dias[0]).toMatchObject({ situacao: 'nao-medido', imp: null })
  })
})

describe('o vídeo dentro do canal', () => {
  const a = canal([rel('2026-10-01'), rel('2026-10-02'), rel('2026-10-03', 'listado', false)], [lin('v1', '2026-10-01', 10, 0.1), lin('v2', '2026-10-02', 4, 0.5)])
  it('dia medido em que o vídeo não veio é zero medido; dia não medido continua não medido', () => {
    const { dias } = montarDias(a, { hoje: HOJE, ytId: 'v1' })
    expect(dias.map(d => [d.situacao, d.imp])).toEqual([['com-impressoes', 10], ['zero-medido', 0], ['nao-medido', null]])
  })
  it('vídeo que nunca apareceu: todos os dias medidos em zero, nenhum inventado', () => {
    expect(montarDias(a, { hoje: HOJE, ytId: 'v9' }).dias.map(d => d.imp)).toEqual([0, 0, null])
  })
})

describe('CTR ausente e linha órfã', () => {
  it('dia com impressão e CTR nulo: impressões valem, cliques é null (não medido), nunca 0', () => {
    const { dias } = montarDias(canal([rel('2026-10-01')], [lin('v1', '2026-10-01', 10, null), lin('v2', '2026-10-01', 5, 0.2)]), { hoje: HOJE })
    expect(dias[0]).toMatchObject({ imp: 15, cliques: null })
  })
  it('linha com impressões nulas não soma e não vira zero', () => {
    const { dias } = montarDias(canal([rel('2026-10-01')], [lin('v1', '2026-10-01', null, null)]), { hoje: HOJE })
    expect(dias[0]).toMatchObject({ situacao: 'zero-medido', imp: 0 })
  })
  it('linha de alcance em dia sem relatório medido: vale a linha e sai um aviso', () => {
    const x = montarDias(canal([rel('2026-10-01', 'listado', false)], [lin('v1', '2026-10-01', 3, 0)]), { hoje: HOJE })
    expect(x.dias[0]).toMatchObject({ situacao: 'com-impressoes', imp: 3, cliques: 0 })
    expect(x.avisos).toHaveLength(1)
  })
  it('dois relatórios no mesmo dia: basta um medido', () => {
    const x = montarDias(canal([rel('2026-10-01', 'listado', false), rel('2026-10-01', 'vazio')], []), { hoje: HOJE })
    expect(x.dias[0]).toMatchObject({ situacao: 'zero-medido', imp: 0 })
  })
})

describe('resumo e por vídeo', () => {
  const a = canal([rel('2026-10-01'), rel('2026-10-02', 'vazio'), rel('2026-10-03', 'listado', false)], [lin('v1', '2026-10-01', 10, 0.1), lin('v2', '2026-10-01', 5, 0.2)])
  it('conta dias lidos, com impressão e não medidos; o não medido não entra na soma', () => {
    expect(resumir(montarDias(a, { hoje: HOJE }).dias)).toEqual({ imp: 15, cliques: 2, diasComImpressao: 1, diasLidos: 2, diasNaoMedidos: 1, diasSemCtr: 0 })
  })
  it('nenhum dia lido: impressões e cliques são null, não 0', () => {
    expect(resumir(montarDias(canal([rel('2026-10-01', 'listado', false)], []), { hoje: HOJE }).dias)).toEqual({ imp: null, cliques: null, diasComImpressao: 0, diasLidos: 0, diasNaoMedidos: 1, diasSemCtr: 0 })
    expect(resumir([])).toEqual({ imp: null, cliques: null, diasComImpressao: 0, diasLidos: 0, diasNaoMedidos: 0, diasSemCtr: 0 })
  })
  it('por vídeo: só quem teve impressão; fora do período não conta', () => {
    const m = alcancePorVideo(canal([rel('2026-10-01'), rel('2026-10-02')], [lin('v1', '2026-10-01', 10, 0.1), lin('v1', '2026-10-02', 2, 0.5), lin('v1', '2026-08-01', 99, 1), lin('v3', '2026-10-02', 0, 0)]), new Map())
    expect([...m.keys()]).toEqual(['v1'])
    expect(m.get('v1')).toEqual({ imp: 12, cliques: 2, diasComImpressao: 2 })
  })
  it('motivoDiaTexto: as frases do spec 16.6, sem palavra interna', () => {
    expect(motivoDiaTexto('nao-baixado')).toBe('relatório ainda não baixado (não medido)')
    for (const m of ['sem-relatorio', 'nao-baixado', 'erro', 'expirado'] as const) expect(motivoDiaTexto(m)).toMatch(/não medido/)
  })
})

describe('buracos da revisão da Tarefa 1', () => {
  it('resumir: dia com impressão e cliques null deixa o TOTAL de cliques null (não soma como 0), em qualquer ordem', () => {
    const com = { situacao: 'com-impressoes' as const, motivo: null }
    const a = { dia: '2026-10-01', ...com, imp: 10, cliques: 3 }
    const b = { dia: '2026-10-02', ...com, imp: 20, cliques: null }
    for (const dias of [[a, b], [b, a]]) {
      expect(resumir(dias)).toEqual({ imp: 30, cliques: null, diasComImpressao: 2, diasLidos: 2, diasNaoMedidos: 0, diasSemCtr: 1 })
    }
    expect(resumir([b]).cliques).toBeNull()
    expect(resumir([a]).cliques).toBe(3)
  })
  it('alcancePorVideo: um dia com impressão e CTR nulo deixa os cliques do vídeo null; as impressões continuam somando; outro vídeo não é afetado', () => {
    const a = canal([rel('2026-10-01'), rel('2026-10-02'), rel('2026-10-03')], [
      lin('v1', '2026-10-01', 10, 0.1), lin('v1', '2026-10-02', 20, null), lin('v1', '2026-10-03', 10, 0.1),
      lin('v2', '2026-10-01', 10, 0.5),
    ])
    const m = alcancePorVideo(a, new Map())
    expect(m.get('v1')).toEqual({ imp: 40, cliques: null, diasComImpressao: 3 })
    expect(m.get('v2')).toEqual({ imp: 10, cliques: 5, diasComImpressao: 1 })
    // o CTR nulo vindo primeiro ou por último dá o mesmo
    const b = canal([rel('2026-10-01'), rel('2026-10-02')], [lin('v1', '2026-10-01', 20, null), lin('v1', '2026-10-02', 10, 0.1)])
    expect(alcancePorVideo(b, new Map()).get('v1')?.cliques).toBeNull()
  })
  it('dois relatórios não medidos no mesmo dia: nao-baixado vence erro, que vence expirado (as três combinações, nas duas ordens)', () => {
    const motivo = (...status: RelatorioDia['status'][]) => {
      const dia = '2026-10-02'
      const { dias } = montarDias(canal([rel('2026-10-01'), ...status.map(s => rel(dia, s, false))], []), { hoje: HOJE })
      return dias.find(x => x.dia === dia)?.motivo
    }
    expect(motivo('listado', 'erro')).toBe('nao-baixado')
    expect(motivo('erro', 'listado')).toBe('nao-baixado')
    expect(motivo('erro', 'expirado_sem_baixar')).toBe('erro')
    expect(motivo('expirado_sem_baixar', 'erro')).toBe('erro')
    expect(motivo('listado', 'expirado_sem_baixar')).toBe('nao-baixado')
    expect(motivo('expirado_sem_baixar', 'listado')).toBe('nao-baixado')
  })
  it('motivoDiaTexto: o texto literal de erro e de expirado', () => {
    expect(motivoDiaTexto('erro')).toBe('o relatório deste dia deu erro (não medido)')
    expect(motivoDiaTexto('expirado')).toBe('o relatório deste dia expirou sem ser baixado (não medido)')
  })
  it('série só de zero medido: o resumo diz zero (0 e 0), não "não medido"', () => {
    const a = canal([rel('2026-10-01', 'vazio'), rel('2026-10-02', 'baixado'), rel('2026-10-03', 'vazio')], [])
    const { dias } = montarDias(a, { hoje: HOJE })
    expect(dias.every(d => d.situacao === 'zero-medido')).toBe(true)
    expect(resumir(dias)).toEqual({ imp: 0, cliques: 0, diasComImpressao: 0, diasLidos: 3, diasNaoMedidos: 0, diasSemCtr: 0 })
  })
})
