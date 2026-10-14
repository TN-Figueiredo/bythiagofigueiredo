// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CONFERENCIAS, DIAS_ATE_O_VERMELHO, E14_DEPLOY, E16_E15_DEPLOY, E17_D1_DEPLOY, E17_D1_NUCLEO_DEPLOY, E1_E2_DEPLOY, E6_P2_DEPLOY, E8_COLETA_DEPLOY, conferenciasE14, conferenciasE16E15, conferenciasE17D1, conferenciasE17D1Nucleo, conferenciasE1E2, conferenciasE6P2, conferenciasE8Coleta, conferenciasEmFalha, conferenciasVencidas, diasDeAtraso, hojeSP, type Conferencia,
} from '@/lib/conferencias'
import { CONTEXTO_IA_RULES } from '@/lib/youtube/observatorio/contexto-ia/regras'

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
  it('com o deploy real (E1_E2_DEPLOY): a e1e2-d0 foi feita em 13/10/2026 (D0 do Lote 1 verde) e as demais e1e2-* seguem sem feitaEm', () => {
    const l = CONFERENCIAS.filter(x => x.id.startsWith('e1e2-'))
    expect(l.map(x => x.id)).toEqual(IDS)
    for (const x of l) expect(x.feitaEm, x.id).toBe(x.id === 'e1e2-d0' ? '2026-10-13' : null)
    // a data é fato do envio real: um envio hipotético (outra data de deploy) não herda a conferência como feita
    expect(conferenciasE1E2(dia(-10)).every(x => x.feitaEm === null)).toBe(true)
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

// A5 E8 (Tarefa 11a): as conferências da retenção dependem do dia da promoção a `main` (R), que o controlador preenche em
// E8_COLETA_DEPLOY no commit do envio. Sem a data, a lista NÃO tem as entradas: nada vence e o cron não fica vermelho por elas.
describe('conferências de E8 (coleta da retenção, relativas ao dia do envio)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  const ehData = (x: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(x) && new Date(`${x}T00:00:00.000Z`).toISOString().slice(0, 10) === x
  const IDS = ['e8-primeira-execucao', 'e8-tres-dias', 'e8-tempo-real', 'e8-primeira-leva']

  it('sem a data não há entradas de E8, e nada vence por mais longe que esteja o dia', () => {
    expect(conferenciasE8Coleta(null)).toEqual([])
    expect(conferenciasVencidas(dia(4000), conferenciasE8Coleta(null))).toEqual([])
    expect(conferenciasEmFalha(dia(4000), conferenciasE8Coleta(null))).toEqual([])
  })
  it('com a data, as quatro, nas datas certas: R + 1, R + 3 (duas) e R + 8, do agente, etapa E8, sem feitaEm', () => {
    const l = conferenciasE8Coleta(dia(-10))
    expect(l.map(x => x.id)).toEqual(IDS)
    expect(l.map(x => x.data)).toEqual([1, 3, 3, 8].map(n => dia(-10 + n)))
    for (const x of l) {
      expect(x.responsavel, x.id).toBe('agente')
      expect(x.feitaEm, x.id).toBeNull()
      expect(x.etapa, x.id).toBe('E8')
      expect(x.onde.length, x.id).toBeGreaterThan(20)
    }
  })
  it('as consultas: o resumo do primeiro cron, K7 em três dias, K6 na primeira leva, e o tempo real com o corte de 250 s e os prazos de 2 s, 2 s e 1 s', () => {
    const por = Object.fromEntries(conferenciasE8Coleta(dia(0)).map(x => [x.id, x.onde]))
    expect(por['e8-primeira-execucao']).toMatch(/resumo\.retencao[\s\S]*ms_passos\.retencao/)
    expect(por['e8-tres-dias']).toMatch(/K7/)
    expect(por['e8-primeira-leva']).toMatch(/K6/)
    expect(por['e8-tempo-real']).toMatch(/ms\.cauda[\s\S]*250 s[\s\S]*2 s, 2 s e 1 s[\s\S]*10 s/)
  })
  it('vence no dia seguinte à data, e com 8 dias de atraso deixa o cron vermelho', () => {
    const l = conferenciasE8Coleta(dia(0))
    expect(conferenciasVencidas(dia(1), l).map(x => x.id)).toEqual([])
    expect(conferenciasVencidas(dia(2), l).map(x => x.id)).toEqual(['e8-primeira-execucao'])
    expect(conferenciasEmFalha(dia(9), l).map(x => x.id)).toEqual(['e8-primeira-execucao'])
  })
  it('data malformada vira a entrada de aviso (vermelha) que manda corrigir a constante', () => {
    for (const ruim of ['amanhã', '2026-13-45', '12/10/2026', '']) {
      const l = conferenciasE8Coleta(ruim)
      expect(l.map(x => x.id), ruim).toEqual(['e8-coleta-deploy-invalido'])
      expect(l[0]!.etapa).toBe('E8')
      expect(conferenciasEmFalha(dia(0), l).map(x => x.id), ruim).toEqual(['e8-coleta-deploy-invalido'])
      expect(l[0]!.onde).toContain('E8_COLETA_DEPLOY')
    }
  })
  it('a constante publicada é nula (sem as entradas na lista) ou uma data real (e a lista tem as quatro): esquecer de espalhar na lista publicada reprova', () => {
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith('e8-')).map(x => x.id)
    if (E8_COLETA_DEPLOY === null) expect(publicadas).toEqual([])
    else {
      expect(ehData(E8_COLETA_DEPLOY)).toBe(true)
      expect([...publicadas].sort()).toEqual([...IDS].sort())
    }
  })
})

// A5 E6 P2 (Tarefas 11b e 15; portão de dados do release 1, I1 e I2): as conferências da dieta do diário dependem do dia da promoção
// a `main` (D), que o controlador preenche em E6_P2_DEPLOY no commit do envio. Sem a data, a lista NÃO tem as entradas: nada vence.
// D é o dia do deploy pronto ANTES do cron das 12:00 UTC: a primeira execução da dieta é a de D (se o deploy não ficou pronto, D é o dia seguinte).
describe('conferências de E6 P2 (dieta do diário, relativas ao dia do envio)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  const ehData = (x: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(x) && new Date(`${x}T00:00:00.000Z`).toISOString().slice(0, 10) === x
  const IDS = ['e6-p2-primeira-execucao', 'e6-retrato', 'e6-p2-tres-execucoes']

  it('sem a data não há entradas de E6 P2, e nada vence nem fica vermelho por mais longe que esteja o dia', () => {
    expect(conferenciasE6P2(null)).toEqual([])
    expect(conferenciasVencidas(dia(4000), conferenciasE6P2(null))).toEqual([])
    expect(conferenciasEmFalha(dia(4000), conferenciasE6P2(null))).toEqual([])
  })
  it('com a data, as três, em ordem: a primeira execução e o retrato em D, as três execuções em D + 2; do agente, etapa E6, sem feitaEm', () => {
    const l = conferenciasE6P2(dia(-10))
    expect(l.map(x => x.id)).toEqual(IDS)
    expect(l.map(x => x.data)).toEqual([0, 0, 2].map(n => dia(-10 + n)))
    for (const x of l) {
      expect(x.responsavel, x.id).toBe('agente')
      expect(x.feitaEm, x.id).toBeNull()
      expect(x.etapa, x.id).toBe('E6')
      expect(x.onde.length, x.id).toBeGreaterThan(20)
    }
  })
  it('a primeira execução diz o esperado CERTO de apagadas (N0 da consulta P-2, não "perto de 280") e que zero no primeiro dia é reprovação', () => {
    const por = Object.fromEntries(conferenciasE6P2(dia(0)).map(x => [x.id, x.onde]))
    const p = por['e6-p2-primeira-execucao']!
    expect(p).toMatch(/apagadas[\s\S]*N0/)
    expect(p).toMatch(/P-2/)
    expect(p).toMatch(/7 × 35/)
    expect(p).toMatch(/intervalos[\s\S]*70/)
    expect(p).toMatch(/com_buraco[\s\S]*0/)
    expect(p).toMatch(/= 0 com N0 > 0 no PRIMEIRO dia é reprovação/)
    expect(p).toMatch(/segundo dia em diante[\s\S]*= 0 é o normal/)
    expect(p).toMatch(/D-1/)
    expect(p).not.toMatch(/280/)
  })
  it('o retrato usa a regra de três partes e as três execuções liberam a P3', () => {
    const por = Object.fromEntries(conferenciasE6P2(dia(0)).map(x => [x.id, x.onde]))
    expect(por['e6-retrato']).toMatch(/três partes/)
    expect(por['e6-retrato']).toMatch(/medido/)
    expect(por['e6-p2-tres-execucoes']).toMatch(/K3 = 0[\s\S]*K5[\s\S]*K8 = 0[\s\S]*P3/)
  })
  it('vence no dia seguinte à data, e com 8 dias de atraso deixa o cron vermelho', () => {
    const l = conferenciasE6P2(dia(0))
    expect(conferenciasVencidas(dia(0), l).map(x => x.id)).toEqual([])
    expect(conferenciasVencidas(dia(1), l).map(x => x.id)).toEqual(['e6-p2-primeira-execucao', 'e6-retrato'])
    expect(conferenciasVencidas(dia(3), l).map(x => x.id)).toEqual(IDS)
    expect(conferenciasEmFalha(dia(8), l).map(x => x.id)).toEqual(['e6-p2-primeira-execucao', 'e6-retrato'])
  })
  it('data malformada vira a entrada de aviso (vermelha) que manda corrigir a constante', () => {
    for (const ruim of ['amanhã', '2026-13-45', '12/10/2026', '']) {
      const l = conferenciasE6P2(ruim)
      expect(l.map(x => x.id), ruim).toEqual(['e6-p2-deploy-invalido'])
      expect(l[0]!.etapa).toBe('E6')
      expect(conferenciasEmFalha(dia(0), l).map(x => x.id), ruim).toEqual(['e6-p2-deploy-invalido'])
      expect(l[0]!.onde).toContain('E6_P2_DEPLOY')
    }
  })
  it('a constante publicada é nula (sem as entradas na lista) ou uma data real (e a lista tem as três): esquecer de espalhar na lista publicada reprova', () => {
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith('e6-')).map(x => x.id)
    if (E6_P2_DEPLOY === null) expect(publicadas).toEqual([])
    else {
      expect(ehData(E6_P2_DEPLOY)).toBe(true)
      expect([...publicadas].sort()).toEqual([...IDS].sort())
    }
  })
})

// A5 E14 (Tarefa 12): as conferências dos comentários de destaque dependem do dia da promoção a `main` (D), que o controlador
// preenche em E14_DEPLOY no commit do envio. Sem a data, a lista NÃO tem as entradas: nada vence e o cron não fica vermelho por elas.
describe('conferências de E14 (comentários de destaque, relativas ao dia do envio)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  const ehData = (x: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(x) && new Date(`${x}T00:00:00.000Z`).toISOString().slice(0, 10) === x
  const IDS = ['e14-d1', 'e14-d7', 'e14-d29', 'e14-d31']

  it('conferenciasE14: nulo não dá entrada e nada vence; data válida dá as quatro, nas datas D+1, D+7, D+29 e D+31; data malformada dá a entrada vencida', () => {
    expect(conferenciasE14(null)).toEqual([])
    expect(conferenciasVencidas(dia(4000), conferenciasE14(null))).toEqual([])
    expect(conferenciasEmFalha(dia(4000), conferenciasE14(null))).toEqual([])
    const l = conferenciasE14(dia(-40))
    expect(l.map(x => x.id)).toEqual(IDS)
    expect(l.map(x => x.data)).toEqual([1, 7, 29, 31].map(n => dia(-40 + n)))
    for (const x of l) {
      expect(x.responsavel, x.id).toBe('agente')
      expect(x.feitaEm, x.id).toBeNull()
      expect(x.etapa, x.id).toBe('E14')
      expect(x.onde.length, x.id).toBeGreaterThan(20)
    }
    for (const ruim of ['amanhã', '2026-13-45', '12/10/2026', '']) {
      const m = conferenciasE14(ruim)
      expect(m.map(x => x.id), ruim).toEqual(['e14-deploy-invalido'])
      expect(m[0]!.etapa).toBe('E14')
      expect(m[0]!.onde).toContain('E14_DEPLOY')
      expect(conferenciasVencidas(dia(0), m).map(x => x.id), ruim).toEqual(['e14-deploy-invalido'])
      expect(conferenciasEmFalha(dia(0), m).map(x => x.id), ruim).toEqual(['e14-deploy-invalido'])
    }
  })
  it('o que cada uma manda olhar: a reconciliação da cota, a soma dos retratos, os 28 dias da primeira anulação e a identidade zerada', () => {
    const por = Object.fromEntries(conferenciasE14(dia(0)).map(x => [x.id, x.onde]))
    expect(por['e14-d1']).toMatch(/youtube_quota_usage[\s\S]*units_used/)
    expect(por['e14-d1']).toMatch(/competitor_video_comment_snaps/)
    expect(por['e14-d7']).toMatch(/proibido/)
    expect(por['e14-d29']).toMatch(/apagadas > 0[\s\S]*anular_identidade/)
    expect(por['e14-d31']).toMatch(/author_purged_at/)
    expect(por['e14-d31']).toMatch(/retratos_perdidos_7d/)
  })
  it('vence no dia seguinte à data, e com 8 dias de atraso deixa o cron vermelho', () => {
    const l = conferenciasE14(dia(0))
    expect(conferenciasVencidas(dia(1), l).map(x => x.id)).toEqual([])
    expect(conferenciasVencidas(dia(2), l).map(x => x.id)).toEqual(['e14-d1'])
    expect(conferenciasEmFalha(dia(9), l).map(x => x.id)).toEqual(['e14-d1'])
  })
  it('a constante publicada é nula (sem as entradas na lista) ou uma data real (e a lista tem as quatro)', () => {
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith('e14-')).map(x => x.id)
    if (E14_DEPLOY === null) expect(publicadas).toEqual([])
    else {
      expect(ehData(E14_DEPLOY)).toBe(true)
      expect([...publicadas].sort()).toEqual([...IDS].sort())
    }
  })
})

// A5 E16/E15 (Tarefa 15): as conferências da agenda e da captura horária dependem do dia da promoção a `main` (D0), que o
// controlador preenche em E16_E15_DEPLOY no commit do envio. Sem a data, a lista NÃO tem as entradas: nada vence e o cron não
// fica vermelho por elas (portão final, dados I3).
describe('conferências de E16 e E15 (agenda e captura horária, relativas ao dia do envio)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  const ehData = (x: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(x) && new Date(`${x}T00:00:00.000Z`).toISOString().slice(0, 10) === x
  const IDS = ['e16-d1', 'e16-k1', 'e15-np-d3', 'e15-atraso-d7', 'e15-medicao-d14', 'e16-14-dias', 'e15-tamanho-d30', 'e15-bruto-d60']
  const DIAS = [1, 1, 3, 7, 14, 14, 30, 60]

  it('E16_E15_DEPLOY nula não cria entrada, e nada vence por mais longe que esteja o dia', () => {
    expect(conferenciasE16E15(null)).toEqual([])
    expect(conferenciasVencidas(dia(4000), conferenciasE16E15(null))).toEqual([])
    expect(conferenciasEmFalha(dia(4000), conferenciasE16E15(null))).toEqual([])
  })
  it('data malformada vira a entrada vermelha de 1970 que manda corrigir a constante', () => {
    for (const ruim of ['amanhã', '2026-13-45', '12/10/2026', '']) {
      const l = conferenciasE16E15(ruim)
      expect(l.map(x => x.id), ruim).toEqual(['e16-e15-deploy-invalido'])
      expect(l[0]!.data).toBe('1970-01-01')
      expect(l[0]!.onde).toContain('E16_E15_DEPLOY')
      expect(conferenciasEmFalha(dia(0), l).map(x => x.id), ruim).toEqual(['e16-e15-deploy-invalido'])
    }
  })
  it('com a data, as oito entradas com D0 + 1, 1, 3, 7, 14, 14, 30 e 60, do agente, sem feitaEm', () => {
    const l = conferenciasE16E15(dia(-70))
    expect(l.map(x => x.id)).toEqual(IDS)
    expect(l.map(x => x.data)).toEqual(DIAS.map(n => dia(-70 + n)))
    for (const x of l) {
      expect(x.responsavel, x.id).toBe('agente')
      expect(x.feitaEm, x.id).toBeNull()
      expect(x.etapa, x.id).toMatch(/^E(15|16)$/)
      expect(x.id.startsWith(x.etapa.toLowerCase() + '-'), x.id).toBe(true)
      expect(x.onde.length, x.id).toBeGreaterThan(20)
    }
  })
  it('cada uma vence no dia seguinte à sua data, e com 8 dias de atraso deixa o cron vermelho', () => {
    const l = conferenciasE16E15(dia(0))
    for (const [i, x] of l.entries()) {
      expect(conferenciasVencidas(dia(DIAS[i]!), [x]), x.id).toEqual([])
      expect(conferenciasVencidas(dia(DIAS[i]! + 1), [x]).map(y => y.id), x.id).toEqual([x.id])
      expect(conferenciasEmFalha(dia(DIAS[i]! + 7), [x]), x.id).toEqual([])
      expect(conferenciasEmFalha(dia(DIAS[i]! + 8), [x]).map(y => y.id), x.id).toEqual([x.id])
    }
    expect(conferenciasVencidas(dia(1), l)).toEqual([])
    expect(conferenciasVencidas(dia(2), l).map(x => x.id)).toEqual(['e16-d1', 'e16-k1'])
    expect(conferenciasVencidas(dia(61), l).map(x => x.id)).toEqual(IDS)
  })
  it('o que cada uma manda olhar: K2/K3 e a série semanal fechada, K1, K4/K10, K5, K6/K7 por curl, K8 com a projeção, K9', () => {
    const por = Object.fromEntries(conferenciasE16E15(dia(0)).map(x => [x.id, x.onde]))
    expect(por['e16-d1']).toMatch(/K2[\s\S]*K3[\s\S]*sem_tempo[\s\S]*item 216[\s\S]*série semanal fechou `ok` no dia/)
    expect(por['e16-k1']).toMatch(/K1[\s\S]*naoTerminouVermelhoEm[\s\S]*catalogo\.ts/)
    expect(por['e15-np-d3']).toMatch(/K4[\s\S]*videos_abaixo_do_lido[\s\S]*K10/)
    expect(por['e15-atraso-d7']).toMatch(/K5[\s\S]*95[\s\S]*5 minutos/)
    expect(por['e15-medicao-d14']).toMatch(/K6[\s\S]*K7[\s\S]*curl[\s\S]*chave de API[\s\S]*obterToken/)
    expect(por['e16-14-dias']).toMatch(/OBS_AGENDA/)
    expect(por['e15-tamanho-d30']).toMatch(/K8[\s\S]*170 B[\s\S]*12 meses/)
    expect(por['e15-bruto-d60']).toMatch(/K9[\s\S]*59 dias/)
  })
  it('a constante publicada é nula (sem as entradas na lista) ou uma data real (e a lista tem as oito): esquecer de espalhar na lista publicada reprova', () => {
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith('e16-') || x.id.startsWith('e15-')).map(x => x.id)
    if (E16_E15_DEPLOY === null) expect(publicadas).toEqual([])
    else {
      expect(ehData(E16_E15_DEPLOY)).toBe(true)
      expect([...publicadas].sort()).toEqual([...IDS].sort())
    }
  })
})

// A5 E17 degrau 1 (Tarefa 13a): as conferências do botão "Perguntar a uma IA" dependem do dia da promoção a `main` (D), que o
// controlador preenche em E17_D1_DEPLOY no commit do envio que LIGA o botão. O núcleo vai antes, desligado, com a sua própria data.
describe('conferências de E17 degrau 1 (Perguntar a uma IA, relativas ao dia do envio)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  const IDS = ['e17d1-d0', 'e17d1-ci', 'e17d1-d1', 'e17d1-d7', 'e17d1-d365']

  it('E17_D1_DEPLOY nula = nenhuma entrada; malformada = uma entrada de erro; preenchida = cinco entradas (d0 e ci em D0, depois D+1, D+7, D+365)', () => {
    expect(conferenciasE17D1(null)).toEqual([])
    expect(conferenciasVencidas(dia(4000), conferenciasE17D1(null))).toEqual([])
    const l = conferenciasE17D1(dia(-40))
    expect(l.map(x => x.id)).toEqual(IDS)
    expect(l.map(x => x.data)).toEqual([0, 0, 1, 7, 365].map(n => dia(-40 + n)))
    for (const x of l) {
      expect(x.etapa, x.id).toBe('E17')
      expect(x.feitaEm, x.id).toBeNull()
      expect(x.onde.length, x.id).toBeGreaterThan(20)
    }
    for (const ruim of ['amanhã', '2026-13-45', '']) {
      const m = conferenciasE17D1(ruim)
      expect(m.map(x => x.id), ruim).toEqual(['e17d1-deploy-invalido'])
      expect(m[0]!.onde).toContain('E17_D1_DEPLOY')
      expect(conferenciasEmFalha(dia(0), m).map(x => x.id), ruim).toEqual(['e17d1-deploy-invalido'])
    }
  })
  it('o que cada uma manda olhar: o registro do primeiro uso, o job da CI, as contagens por tela, a mediana e a retenção de 400 dias', () => {
    const por = Object.fromEntries(conferenciasE17D1(dia(0)).map(x => [x.id, x.onde]))
    expect(por['e17d1-d0']).toMatch(/obs_ai_access_log/)
    expect(por['e17d1-ci']).toMatch(/observatorio-a5-e17-d1-registro/)
    expect(por['e17d1-d1']).toMatch(/pergunta/)
    expect(por['e17d1-d7']).toMatch(/piso_passou/)
    expect(por['e17d1-d365']).toMatch(/400/)
  })
  it('E17_D1_NUCLEO_DEPLOY nula = nenhuma entrada; preenchida = uma entrada em D+1 do envio do núcleo', () => {
    expect(conferenciasE17D1Nucleo(null)).toEqual([])
    const l = conferenciasE17D1Nucleo(dia(-10))
    expect(l.map(x => x.id)).toEqual(['e17d1-nucleo-d1'])
    expect(l[0]!.data).toBe(dia(-9))
    expect(l[0]!.responsavel).toBe('agente')
    expect(l[0]!.etapa).toBe('E17')
    expect(l[0]!.onde).toMatch(/Sentry/)
    expect(conferenciasE17D1Nucleo('amanhã').map(x => x.id)).toEqual(['e17d1-nucleo-deploy-invalido'])
  })
  it('a lista publicada só tem as entradas quando a constante está preenchida', () => {
    const ids = CONFERENCIAS.filter(x => x.id.startsWith('e17d1-')).map(x => x.id).sort()
    const esperado = [...(E17_D1_DEPLOY === null ? [] : IDS), ...(E17_D1_NUCLEO_DEPLOY === null ? [] : ['e17d1-nucleo-d1'])].sort()
    expect(ids).toEqual(esperado)
  })
  // Lê as duas constantes de verdade, sem simular: é o que deixa vermelho, na CI, um `ligado: true` commitado fora do envio
  // (por exemplo durante o portão de UX) e um envio que esqueça de ligar. A data do núcleo NÃO entra: o núcleo vai desligado.
  it('E17_D1_DEPLOY nula exige CONTEXTO_IA_RULES.ligado falso; preenchida exige verdadeiro', () => {
    expect(CONTEXTO_IA_RULES.ligado).toBe(E17_D1_DEPLOY !== null)
  })
})
