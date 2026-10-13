// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CONFERENCIAS, DIAS_ATE_O_VERMELHO, E1_E2_DEPLOY, conferenciasE1E2, conferenciasEmFalha, conferenciasVencidas, diasDeAtraso, hojeSP, type Conferencia,
} from '@/lib/conferencias'

// Duas partes. A primeira testa as funções puras com datas RELATIVAS a um AGORA com timers falsos (nenhum ano futuro
// fixo: o guardião test/unit/test-hygiene.test.ts reprova). A segunda confere a lista PUBLICADA, cujas datas reais
// (inclusive 2027) moram em `lib/conferencias.ts` e precisam aparecer aqui: por isso este arquivo está na ALLOWLIST do
// guardião, com o motivo.

const AGORA = new Date('2026-10-12T15:00:00.000Z')
/** Dia de São Paulo `n` dias depois do AGORA (negativo = antes). */
const dia = (n: number): string => hojeSP(new Date(Date.now() + n * 86_400_000))
/** A conferência do teste é devida no dia do AGORA; `hoje` varia com `dia(k)`. */
const c = (extra: Partial<Conferencia> = {}): Conferencia => ({ id: 'x-d7', etapa: 'EX', data: dia(0), responsavel: 'agente', onde: 'plano X', feitaEm: null, ...extra })

describe('conferências com data (item 246)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('na véspera e no próprio dia não está vencida; no dia seguinte está, com o nome', () => {
    expect(conferenciasVencidas(dia(-1), [c()])).toEqual([])
    expect(conferenciasVencidas(dia(0), [c()])).toEqual([])
    expect(conferenciasVencidas(dia(1), [c()]).map(x => x.id)).toEqual(['x-d7'])
  })
  it('com a data de feita, nunca mais aparece', () => {
    expect(conferenciasVencidas(dia(400), [c({ feitaEm: dia(2) })])).toEqual([])
    expect(conferenciasEmFalha(dia(400), [c({ feitaEm: dia(2) })])).toEqual([])
  })
  it('lista vazia: nenhuma vencida, nenhuma em falha', () => {
    expect(conferenciasVencidas(dia(400), [])).toEqual([])
    expect(conferenciasEmFalha(dia(400), [])).toEqual([])
  })
  it('o dia é o de São Paulo: 02:59 UTC ainda é o dia anterior', () => {
    const viradaUtc = new Date(`${dia(1)}T03:00:00.000Z`)   // 00:00 em São Paulo (UTC-3, sem horário de verão)
    expect(hojeSP(new Date(viradaUtc.getTime() - 60_000))).toBe(dia(0))
    expect(hojeSP(viradaUtc)).toBe(dia(1))
  })
  it('dias de atraso: hoje menos a data devida, em dias de calendário', () => {
    expect(diasDeAtraso(dia(0), c())).toBe(0)
    expect(diasDeAtraso(dia(7), c())).toBe(7)
    expect(diasDeAtraso(dia(-1), c())).toBe(-1)
    expect(diasDeAtraso(dia(366), c())).toBe(366)
  })
  it('dias de atraso na virada de mês, de ano e em ano bissexto (calendário fixo, passado, sem relação com o relógio)', () => {
    expect(diasDeAtraso('2020-03-01', c({ data: '2020-02-28' }))).toBe(2)
    expect(diasDeAtraso('2021-01-02', c({ data: '2020-12-31' }))).toBe(2)
  })
  it('a decisão do controlador: vencida há 7 dias fica só no resumo; há 8 dias é falha', () => {
    expect(DIAS_ATE_O_VERMELHO).toBe(7)
    const lista = [c()]
    expect(conferenciasVencidas(dia(7), lista).map(x => x.id)).toEqual(['x-d7'])   // 7 dias: vencida
    expect(conferenciasEmFalha(dia(7), lista)).toEqual([])                          // ...mas ainda sem vermelho
    expect(conferenciasEmFalha(dia(8), lista).map(x => x.id)).toEqual(['x-d7'])    // 8 dias: vermelho
    expect(conferenciasEmFalha(dia(1), lista)).toEqual([])                          // 1 dia: sem vermelho
  })
  it('vencida há muito tempo continua em falha até alguém preencher feitaEm (não é mudo nem some sozinha)', () => {
    expect(conferenciasEmFalha(dia(400), [c()]).map(x => x.id)).toEqual(['x-d7'])
    expect(conferenciasEmFalha(dia(400), [c({ feitaEm: dia(400) })])).toEqual([])
  })
  it('só as que passaram do limite entram na falha, na ordem da lista', () => {
    const lista = [c({ id: 'a', data: dia(-17) }), c({ id: 'b', data: dia(-3) }), c({ id: 'c', data: dia(-16), feitaEm: dia(-13) }), c({ id: 'd', data: dia(-13) })]
    expect(conferenciasEmFalha(dia(0), lista).map(x => x.id)).toEqual(['a', 'd'])
    expect(conferenciasVencidas(dia(0), lista).map(x => x.id)).toEqual(['a', 'b', 'd'])
  })
})

describe('a lista publicada (CONFERENCIAS)', () => {
  const ehData = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00.000Z`).toISOString().slice(0, 10) === s
  const datasDa = (etapa: string): Record<string, string> => Object.fromEntries(CONFERENCIAS.filter(x => x.etapa === etapa).map(x => [x.id, x.data]))

  it('é bem formada: ids únicos, datas reais do calendário, feitaEm nula ou data, consulta escrita', () => {
    expect(new Set(CONFERENCIAS.map(x => x.id)).size).toBe(CONFERENCIAS.length)
    for (const x of CONFERENCIAS) {
      expect(ehData(x.data), `${x.id}: data ${x.data}`).toBe(true)
      expect(x.feitaEm === null || ehData(x.feitaEm), `${x.id}: feitaEm ${String(x.feitaEm)}`).toBe(true)
      expect(x.onde.length, x.id).toBeGreaterThan(20)
      expect(x.etapa, x.id).toMatch(/^E\d+$/)
    }
  })
  it('nenhuma foi "feita" num dia que ainda não chegou (feitaEm digitado errado esconderia a conferência)', () => {
    const hoje = hojeSP(new Date())   // relógio real: o marcador de feita é um dia que de fato passou
    for (const x of CONFERENCIAS) {
      if (x.feitaEm !== null) expect(x.feitaEm <= hoje, `${x.id}: feitaEm ${x.feitaEm} depois de hoje (${hoje})`).toBe(true)
    }
  })
  it('as conferências da E20 estão na lista, com as datas do plano', () => {
    expect(datasDa('E20')).toMatchObject({ 'e20-tamanho-d8': '2026-10-21', 'e20-tamanho-30d': '2026-11-12', 'e20-prova-90d': '2027-01-09', 'e20-prova-180d': '2027-04-09' })
  })
  it('e20-segundo-cron: devida em 14/10, a leitura da base de blobs_guardados_antes', () => {
    const x = CONFERENCIAS.find(y => y.id === 'e20-segundo-cron')
    expect(x).toMatchObject({ etapa: 'E20', data: '2026-10-14', responsavel: 'agente', feitaEm: null })
    expect(x?.onde).toContain('blobs_guardados_antes')
  })
  it('as conferências da E12 (D0 = 13/10/2026) estão na lista, com as datas do ledger', () => {
    expect(datasDa('E12')).toEqual({
      'e12-d3': '2026-10-16', 'e12-d7': '2026-10-20', 'e12-d9': '2026-10-22',
      'e12-item95-a': '2026-11-01', 'e12-item95-b': '2026-11-08', 'e12-d31': '2026-11-13',
    })
  })
  it('as conferências da E19 (avisoDesde = 12/10/2026) estão na lista; a de 30 dias é do dono', () => {
    expect(datasDa('E19')).toEqual({ 'e19-d1': '2026-10-13', 'e19-veredito': '2026-10-20', 'e19-15o-dia': '2026-10-26', 'e19-30o-dia': '2026-11-11' })
    expect(CONFERENCIAS.find(x => x.id === 'e19-30o-dia')?.responsavel).toBe('dono')
    for (const x of CONFERENCIAS.filter(y => y.etapa === 'E19' && y.id !== 'e19-30o-dia')) expect(x.responsavel, x.id).toBe('agente')
  })
  it('a lista está em ordem de data (quem lê o resumo vê a mais antiga primeiro)', () => {
    const datas = CONFERENCIAS.map(x => x.data)
    expect(datas).toEqual([...datas].sort())
  })
})

// (portão final, dados I-5) As conferências de E1 e E2 (coleta dos concorrentes) dependem do dia do envio, que o controlador preenche
// em E1_E2_DEPLOY no commit do envio. Sem a data, a lista NÃO tem as entradas: nada vence e o cron não fica vermelho por elas.
describe('conferências de E1 e E2 (relativas ao dia do envio)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  const ehData = (x: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(x) && new Date(`${x}T00:00:00.000Z`).toISOString().slice(0, 10) === x
  const IDS = ['e1e2-d0', 'e1e2-d1', 'e1e2-d3', 'e1e2-d7', 'e1e2-d8', 'e1e2-d9']

  it('com o dia do envio: seis entradas em D0, D+1, D+3, D+7, D+8 e D+9, em ordem, do agente, sem feitaEm', () => {
    const l = conferenciasE1E2(dia(-10))
    expect(l.map(x => x.id)).toEqual(IDS)
    expect(l.map(x => x.data)).toEqual([0, 1, 3, 7, 8, 9].map(n => dia(-10 + n)))
    for (const x of l) {
      expect(x.responsavel, x.id).toBe('agente')
      expect(x.feitaEm, x.id).toBeNull()
      expect(x.etapa, x.id).toMatch(/^E\d+$/)
      expect(x.onde.length, x.id).toBeGreaterThan(20)
    }
  })
  it('as consultas: raw, K5, K6 com 2%, cota entre 195 e 215, K16 = 0, I-7, R1 e o 9º dia', () => {
    const por = Object.fromEntries(conferenciasE1E2(dia(0)).map(x => [x.id, x.onde]))
    expect(por['e1e2-d0']).toMatch(/competitor_raw[\s\S]*K5[\s\S]*K16/)
    expect(por['e1e2-d1']).toMatch(/K6[\s\S]*2%[\s\S]*195[\s\S]*215/)
    expect(por['e1e2-d3']).toMatch(/K8[\s\S]*K6[\s\S]*5%[\s\S]*I-7/)
    expect(por['e1e2-d8']).toMatch(/R1/)
    expect(por['e1e2-d9']).toMatch(/semanal_atrasados_9d[\s\S]*sem_miniatura_9d/)
  })
  it('vence no dia seguinte à data: D0 vence em D+1, e com 8 dias de atraso deixa o cron vermelho', () => {
    const l = conferenciasE1E2(dia(0))
    expect(conferenciasVencidas(dia(0), l)).toEqual([])
    expect(conferenciasVencidas(dia(1), l).map(x => x.id)).toEqual(['e1e2-d0'])
    expect(conferenciasEmFalha(dia(8), l).map(x => x.id)).toEqual(['e1e2-d0'])
  })
  it('SEM o dia do envio (indefinido): nenhuma entrada, nada vence e o cron não fica vermelho, por mais longe que esteja o dia', () => {
    expect(conferenciasE1E2(null)).toEqual([])
    expect(conferenciasVencidas(dia(4000), conferenciasE1E2(null))).toEqual([])
    expect(conferenciasEmFalha(dia(4000), conferenciasE1E2(null))).toEqual([])
  })
  it('data do envio malformada NÃO é silêncio: vira uma entrada vermelha que manda corrigir a constante', () => {
    for (const ruim of ['amanhã', '2026-13-45', '12/10/2026', '']) {
      const l = conferenciasE1E2(ruim)
      expect(l.map(x => x.id), ruim).toEqual(['e1e2-deploy-invalido'])
      expect(conferenciasEmFalha(dia(0), l).map(x => x.id), ruim).toEqual(['e1e2-deploy-invalido'])
      expect(l[0]!.onde).toContain('E1_E2_DEPLOY')
    }
  })
  it('a constante publicada é nula (envio ainda não feito, e a lista não tem as entradas) ou uma data real (e a lista tem as seis)', () => {
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith('e1e2-')).map(x => x.id)
    if (E1_E2_DEPLOY === null) expect(publicadas).toEqual([])
    else {
      expect(ehData(E1_E2_DEPLOY)).toBe(true)
      expect(publicadas).toEqual(IDS)
    }
  })
})
