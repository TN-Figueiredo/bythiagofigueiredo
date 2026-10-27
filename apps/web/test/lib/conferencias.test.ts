// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DIMENSOES_LIGADO_EM } from '@/lib/youtube/coleta/e11-config'
import {
  CONFERENCIAS, REABERTAS, REABERTAS_EM, DIAS_ATE_O_VERMELHO, E10_DEPLOY, E11_DEPLOY, E5A_DEPLOY, E5A_RI_DEPLOY, E5A_COMENTARIOS_DEPLOY, E5A_COMENTARIOS_COLETA_LIGADA, E14_DEPLOY, E16_E15_DEPLOY, E17_D1_DEPLOY, E17_D1_NUCLEO_DEPLOY, E17_D2_ABERTURA, E17_D2_DEPLOY, E17_D2_PODA_DEPLOY, E18_DEPLOY, E1_E2_DEPLOY, E9_DEPLOY, E6_P2_DEPLOY, E6_P3_APLICADA, E8_COLETA_DEPLOY, conferenciasE10, conferenciasE11, conferenciasE17D1, conferenciasE17D1Nucleo, conferenciasE5A, conferenciasE5ARi, conferenciasE5AComentarios, conferenciasE14, conferenciasE16E15, conferenciasE17D2, conferenciasE17D2Abertura, conferenciasE17D2Poda, conferenciasE18, conferenciasE1E2, conferenciasE9, conferenciasX3, X3_LIGADA, conferenciasE6P2, conferenciasE6P3, conferenciasE8Coleta, conferenciasEmFalha, conferenciasVencidas, diasDeAtraso, hojeSP, E6_P4_APLICADA, E18P2_APLICADA, E18P2_COBERTURA_DEPLOY, conferenciasE6P4, conferenciasE18P2, conferenciasE18P2Cobertura, type Conferencia,
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
    expect(x).toMatchObject({ etapa: 'E20', data: '2026-10-14', responsavel: 'agente', feitaEm: '2026-10-14' })
    expect(x?.onde).toContain('blobs_guardados_antes')
  })
  it('as conferências da E12 (D0 = 13/10/2026) estão na lista, com as datas do ledger', () => {
    expect(datasDa('E12')).toEqual({
      'e12-d3': '2026-10-16', 'e12-d7': '2026-10-20', 'e12-d9': '2026-10-22',
      'e12-item95-a': '2026-11-01', 'e12-item95-b': '2026-11-08', 'e12-d31': '2026-11-13',
    })
  })
  it('as conferências da E19 (avisoDesde = 12/10/2026) estão na lista; a de 30 dias é do dono', () => {
    expect(datasDa('E19')).toEqual({ 'e19-d1': '2026-10-13', 'e19-veredito': '2026-10-20', 'e19-t0-48h': '2026-10-25', 'e19-15o-dia': '2026-10-26', 'e19-30o-dia': '2026-11-11' })
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
  it('com o deploy real (E1_E2_DEPLOY): d0 (13/10), d1 (14/10) e d3, d7, d8 (27/10) foram feitas; as demais e1e2-* seguem sem feitaEm', () => {
    const l = CONFERENCIAS.filter(x => x.id.startsWith('e1e2-'))
    expect(l.map(x => x.id)).toEqual(IDS)
    for (const x of l) expect(x.feitaEm, x.id).toBe(x.id === 'e1e2-d0' ? '2026-10-13' : x.id === 'e1e2-d1' ? '2026-10-14' : ['e1e2-d3', 'e1e2-d7', 'e1e2-d8'].includes(x.id) ? '2026-10-27' : null)
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
    // filtro positivo nos ids da P2 (portão 15/10, M-3): conferência nova da E6 (p3, p4...) não quebra este teste
    const DA_P2 = new Set([...IDS, 'e6-p2-deploy-invalido'])
    const publicadas = CONFERENCIAS.filter(x => DA_P2.has(x.id)).map(x => x.id)
    if (E6_P2_DEPLOY === null) expect(publicadas).toEqual([])
    else {
      expect(ehData(E6_P2_DEPLOY)).toBe(true)
      expect([...publicadas].sort()).toEqual([...IDS].sort())
    }
  })
})

// A5 E6 P3 (Tarefa 4; plano 2026-10-13-a5-e6-p3, seção 7): as conferências de depois de apagar as linhas vazias do diário dependem do dia em
// que o dono aplicou a MG15 (E6_P3_APLICADA, dia de São Paulo, preenchido na Tarefa 7). Sem a data, a lista NÃO tem as entradas: nada vence.
describe('conferências de E6 P3 (apagar linhas vazias do diário, relativas ao dia da aplicação)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  const ehData = (x: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(x) && new Date(`${x}T00:00:00.000Z`).toISOString().slice(0, 10) === x
  const IDS = ['e6-p3-d0', 'e6-p3-d1', 'e6-p3-d7', 'e6-p3-d14']

  it('E6_P3_APLICADA nula = nenhuma entrada, e nada vence nem fica vermelho por mais longe que esteja o dia (o caso de dado ausente)', () => {
    expect(conferenciasE6P3(null)).toEqual([])
    expect(conferenciasVencidas(dia(4000), conferenciasE6P3(null))).toEqual([])
    expect(conferenciasEmFalha(dia(4000), conferenciasE6P3(null))).toEqual([])
  })
  it('malformada = uma entrada de erro de 1970 que cita a constante (2026-13-01, 13/10/2026 e texto vazio)', () => {
    for (const ruim of ['2026-13-01', '13/10/2026', '']) {
      const l = conferenciasE6P3(ruim)
      expect(l.map(x => x.id), ruim).toEqual(['e6-p3-aplicada-invalida'])
      expect(l[0]!.data).toBe('1970-01-01')
      expect(l[0]!.etapa).toBe('E6')
      expect(l[0]!.onde).toContain('E6_P3_APLICADA')
      expect(conferenciasEmFalha(dia(0), l).map(x => x.id), ruim).toEqual(['e6-p3-aplicada-invalida'])
    }
  })
  it('preenchida = quatro entradas nas datas certas (D, D + 1, D + 7, D + 14), em ordem, do agente, etapa E6, sem feitaEm', () => {
    const l = conferenciasE6P3(dia(-30))
    expect(l.map(x => x.id)).toEqual(IDS)
    expect(l.map(x => x.data)).toEqual([0, 1, 7, 14].map(n => dia(-30 + n)))
    for (const x of l) {
      expect(x.responsavel, x.id).toBe('agente')
      expect(x.feitaEm, x.id).toBeNull()
      expect(x.etapa, x.id).toBe('E6')
      expect(x.onde, x.id).toContain('2026-10-13-a5-e6-p3-apagar-linhas-vazias-do-diario-plan.md')
    }
  })
  it('o texto de cada uma diz o esperado do plano (V1 a V7, CP6 = 0, 2 MB, CSV com sha256 e MG16)', () => {
    const por = Object.fromEntries(conferenciasE6P3(dia(0)).map(x => [x.id, x.onde]))
    expect(por['e6-p3-d0']).toMatch(/V1 a V7[\s\S]*2 MB[\s\S]*sha256/)
    expect(por['e6-p3-d1']).toMatch(/CP6 = 0[\s\S]*não medido/)
    expect(por['e6-p3-d7']).toMatch(/CP8[\s\S]*2 MB/)
    expect(por['e6-p3-d14']).toMatch(/sha256[\s\S]*MG16/)
  })
  it('vence no dia seguinte à data, e com 8 dias de atraso deixa o cron vermelho', () => {
    const l = conferenciasE6P3(dia(0))
    expect(conferenciasVencidas(dia(0), l).map(x => x.id)).toEqual([])
    expect(conferenciasVencidas(dia(1), l).map(x => x.id)).toEqual(['e6-p3-d0'])
    expect(conferenciasVencidas(dia(15), l).map(x => x.id)).toEqual(IDS)
    expect(conferenciasEmFalha(dia(8), l).map(x => x.id)).toEqual(['e6-p3-d0'])
  })
  it('a constante publicada é nula ou uma data real, e, se tiver data, a lista publicada tem a entrada e6-p3-d0 (pega o espalhamento esquecido)', () => {
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith('e6-p3-')).map(x => x.id)
    if (E6_P3_APLICADA === null) expect(publicadas).toEqual([])
    else {
      expect(ehData(E6_P3_APLICADA)).toBe(true)
      expect(publicadas).toContain('e6-p3-d0')
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

describe('conferência fixa da E4 (e4-dia31, fora de E4_DEPLOY)', () => {
  it('existe na lista publicada em 03/11/2026, do agente, ainda não feita, apontando a Tarefa 12 do plano', () => {
    const x = CONFERENCIAS.find(y => y.id === 'e4-dia31')
    expect(x).toBeDefined()
    expect(x!.data).toBe('2026-11-03')
    expect(x!.etapa).toBe('E4')
    expect(x!.responsavel).toBe('agente')
    expect(x!.feitaEm).toBeNull()
    expect(x!.onde).toMatch(/Tarefa 12[\s\S]*30 a 32 dias[\s\S]*13 h/)
  })
})

describe('conferências de E10 (arquivo, pausa e sinal de limite, relativas ao dia do envio)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  const ehData = (x: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(x) && new Date(`${x}T00:00:00.000Z`).toISOString().slice(0, 10) === x
  const IDS = ['e10-i4', 'e10-d0', 'e10-cms-1', 'e10-d1', 'e10-miniaturas', 'e10-d7', 'e10-d14', 'e10-ensaio', 'e10-d28']
  const DIAS = [0, 0, 0, 1, 3, 7, 14, 14, 28]

  it('nulo não dá entrada e nada vence; data válida dá as nove, nas datas certas; o ensaio é do dono', () => {
    expect(conferenciasE10(null)).toEqual([])
    expect(conferenciasVencidas(dia(4000), conferenciasE10(null))).toEqual([])
    expect(conferenciasEmFalha(dia(4000), conferenciasE10(null))).toEqual([])
    const l = conferenciasE10(dia(-40))
    expect(l.map(x => x.id)).toEqual(IDS)
    expect(l.map(x => x.data)).toEqual(DIAS.map(n => dia(-40 + n)))
    for (const x of l) {
      expect(x.responsavel, x.id).toBe(x.id === 'e10-ensaio' ? 'dono' : 'agente')
      expect(x.feitaEm, x.id).toBeNull()
      expect(x.etapa, x.id).toBe('E10')
      expect(x.onde.length, x.id).toBeGreaterThan(20)
    }
  })
  it('data malformada vira a entrada vencida de 1970 que manda corrigir a constante', () => {
    for (const ruim of ['amanhã', '2026-13-45', '12/10/2026', '']) {
      const m = conferenciasE10(ruim)
      expect(m.map(x => x.id), ruim).toEqual(['e10-deploy-invalido'])
      expect(m[0]!.onde).toContain('E10_DEPLOY')
      expect(conferenciasVencidas(dia(0), m).map(x => x.id), ruim).toEqual(['e10-deploy-invalido'])
      expect(conferenciasEmFalha(dia(0), m).map(x => x.id), ruim).toEqual(['e10-deploy-invalido'])
    }
  })
  it('o que cada uma manda olhar: merge-base do I-4, 4 leituras do D0, menos de 1,5 s, miniaturas zeradas', () => {
    const por = Object.fromEntries(conferenciasE10(dia(0)).map(x => [x.id, x.onde]))
    expect(por['e10-i4']).toMatch(/git grep -q "collection_paused_at == null" origin\/main[\s\S]*git grep -q "fora_pausado" origin\/main/)
    expect(por['e10-i4']).not.toMatch(/is-ancestor/)
    expect(por['e10-d0']).toMatch(/\(1\)[\s\S]*\(2\)[\s\S]*\(3\)[\s\S]*\(4\)/)
    expect(por['e10-d0']).toMatch(/obs_db_size_daily[\s\S]*competitor_collection_pauses[\s\S]*170,7/)
    expect(por['e10-cms-1']).toMatch(/obs_archive_channel_counts[\s\S]*1,5 s/)
    expect(por['e10-miniaturas']).toMatch(/blob_urls_pending/)
  })
  it('vence no dia seguinte à data, e com 8 dias de atraso deixa o cron vermelho', () => {
    const l = conferenciasE10(dia(0))
    expect(conferenciasVencidas(dia(1), l).map(x => x.id)).toEqual(['e10-i4', 'e10-d0', 'e10-cms-1'])
    expect(conferenciasEmFalha(dia(9), l).map(x => x.id)).toEqual(['e10-i4', 'e10-d0', 'e10-cms-1', 'e10-d1'])
  })
  it('a constante publicada é nula (sem as entradas na lista) ou uma data real (e a lista tem as nove)', () => {
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith('e10-')).map(x => x.id)
    if (E10_DEPLOY === null) expect(publicadas).toEqual([])
    else {
      expect(ehData(E10_DEPLOY)).toBe(true)
      expect([...publicadas].sort()).toEqual([...IDS].sort())
    }
  })
})


// A5 E5a leva 1: as conferências dependem do dia da promoção a `main`, que o controlador preenche em E5A_DEPLOY; sem a data, a lista NÃO tem as entradas.
describe('conferências de E5a (tela Canais e conta da aba Mudanças, relativas ao dia do envio)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  const ehData = (x: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(x) && new Date(`${x}T00:00:00.000Z`).toISOString().slice(0, 10) === x
  const IDS = ['e5a-d0', 'e5a-d7', 'e5a-aviso-contagem', 'e5a-em-queda']

  it('nulo não dá entrada e nada vence; data válida dá as quatro, D0 e D+7 relativas e as outras de calendário', () => {
    expect(conferenciasE5A(null)).toEqual([])
    expect(conferenciasVencidas(dia(4000), conferenciasE5A(null))).toEqual([])
    expect(conferenciasEmFalha(dia(4000), conferenciasE5A(null))).toEqual([])
    const l = conferenciasE5A(dia(-40))
    expect([...l.map(x => x.id)].sort()).toEqual([...IDS].sort())
    const por = Object.fromEntries(l.map(x => [x.id, x]))
    expect(por['e5a-d0']!.data).toBe(dia(-40))
    expect(por['e5a-d7']!.data).toBe(dia(-33))
    expect(ehData(por['e5a-aviso-contagem']!.data)).toBe(true)
    expect(ehData(por['e5a-em-queda']!.data)).toBe(true)
    expect(por['e5a-aviso-contagem']!.data < por['e5a-em-queda']!.data).toBe(true)
    expect(l.map(x => x.data)).toEqual([...l.map(x => x.data)].sort())
    for (const x of l) {
      expect(x.responsavel, x.id).toBe('agente')
      expect(x.feitaEm, x.id).toBeNull()
      expect(x.etapa, x.id).toBe('E5')
      expect(x.onde.length, x.id).toBeGreaterThan(20)
    }
  })
  it('data malformada vira a entrada vencida de 1970 que manda corrigir a constante', () => {
    for (const ruim of ['amanhã', '2026-13-45', '12/10/2026', '']) {
      const m = conferenciasE5A(ruim)
      expect(m.map(x => x.id), ruim).toEqual(['e5a-deploy-invalido'])
      expect(m[0]!.onde).toContain('E5A_DEPLOY')
      expect(conferenciasVencidas(dia(0), m).map(x => x.id), ruim).toEqual(['e5a-deploy-invalido'])
      expect(conferenciasEmFalha(dia(0), m).map(x => x.id), ruim).toEqual(['e5a-deploy-invalido'])
    }
  })
  it('o que cada uma manda olhar: D0 com a consulta e o Sentry, D+7 com o gatilho dos 40 canais, aviso e queda', () => {
    const por = Object.fromEntries(conferenciasE5A(dia(0)).map(x => [x.id, x.onde]))
    expect(por['e5a-d0']).toMatch(/1440[\s\S]*390[\s\S]*medidas-telas-canais[\s\S]*canais-sem-retrato/)
    expect(por['e5a-d7']).toMatch(/tempo_esgotado[\s\S]*40/)
    expect(por['e5a-aviso-contagem']).toMatch(/mudança de contagem/)
    expect(por['e5a-em-queda']).toMatch(/em queda/)
  })
  it('a constante publicada é nula (sem as entradas na lista) ou uma data real (e a lista tem as quatro)', () => {
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith('e5a-') && !x.id.startsWith('e5a-ri-') && !x.id.startsWith('e5a-comentarios-')).map(x => x.id)
    if (E5A_DEPLOY === null) expect(publicadas).toEqual([])
    else {
      expect(ehData(E5A_DEPLOY)).toBe(true)
      expect([...publicadas].sort()).toEqual([...IDS].sort())
    }
  })
})

// A5 E5a leva 2 (Referências e Inscritos, R8): as quatro conferências dependem do dia da promoção a `main`, que o controlador preenche em E5A_RI_DEPLOY.
describe('conferências de E5a RI (Referências e Inscritos, relativas ao dia do envio)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  const ehData = (x: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(x) && new Date(`${x}T00:00:00.000Z`).toISOString().slice(0, 10) === x
  const IDS = ['e5a-ri-d0', 'e5a-ri-d1-cortes', 'e5a-ri-d1-sete-dias', 'e5a-ri-d28']

  it('E5A_RI_DEPLOY nula: nenhuma entrada, e nada vence', () => {
    expect(conferenciasE5ARi(null)).toEqual([])
    expect(conferenciasVencidas(dia(4000), conferenciasE5ARi(null))).toEqual([])
    expect(conferenciasEmFalha(dia(4000), conferenciasE5ARi(null))).toEqual([])
  })
  it('malformada: uma entrada de erro, vencida e vermelha', () => {
    for (const ruim of ['amanhã', '2026-13-45', '12/10/2026', '']) {
      const m = conferenciasE5ARi(ruim)
      expect(m.map(x => x.id), ruim).toEqual(['e5a-ri-deploy-invalido'])
      expect(m[0]!.onde).toContain('E5A_RI_DEPLOY')
      expect(conferenciasVencidas(dia(0), m).map(x => x.id), ruim).toEqual(['e5a-ri-deploy-invalido'])
      expect(conferenciasEmFalha(dia(0), m).map(x => x.id), ruim).toEqual(['e5a-ri-deploy-invalido'])
    }
  })
  it('preenchida: as quatro, com as datas relativas ao envio (D0, D+1, D+1, D+28), em ordem', () => {
    const l = conferenciasE5ARi(dia(-40))
    expect(l.map(x => x.id)).toEqual(IDS)
    expect(l.map(x => x.data)).toEqual([dia(-40), dia(-39), dia(-39), dia(-12)])
    for (const x of l) {
      expect(x.etapa, x.id).toBe('E5')
      expect(x.responsavel, x.id).toBe('agente')
      expect(x.feitaEm, x.id).toBeNull()
      expect(x.onde, x.id).toContain('2026-10-13-a5-e5a-telas-dos-concorrentes-plan.md')
    }
    const por = Object.fromEntries(l.map(x => [x.id, x.onde]))
    expect(por['e5a-ri-d0']).toMatch(/CP-RI1[\s\S]*sem medida[\s\S]*missing_since[\s\S]*last_synced_at/)
    expect(por['e5a-ri-d1-cortes']).toMatch(/CP-RI2[\s\S]*p75\/p25[\s\S]*2 e 6/)
    expect(por['e5a-ri-d1-sete-dias']).toMatch(/CP-RI4[\s\S]*0,5[\s\S]*14 dias/)
    expect(por['e5a-ri-d28']).toMatch(/CP-RI3/)
  })
  it('nenhuma nasce vencida: no dia do envio e no dia seguinte nada está vencido', () => {
    const l = conferenciasE5ARi(dia(0))
    expect(conferenciasVencidas(dia(0), l)).toEqual([])
    expect(conferenciasEmFalha(dia(0), l)).toEqual([])
    expect(conferenciasVencidas(dia(1), l).map(x => x.id)).toEqual(['e5a-ri-d0'])
  })
  it('a constante publicada é nula (sem entradas) ou uma data real (e a lista tem as quatro)', () => {
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith('e5a-ri-')).map(x => x.id)
    if (E5A_RI_DEPLOY === null) expect(publicadas).toEqual([])
    else {
      expect(ehData(E5A_RI_DEPLOY)).toBe(true)
      expect([...publicadas].sort()).toEqual([...IDS].sort())
    }
  })
})

// A5 E5a grupo C (Comentários de destaque, C5): D0 pelo dia do envio; mais 29 e mais 31 pelo dia em que a coleta foi ligada (CP24).
describe('conferências de E5a grupo C (Comentários de destaque)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  it('E5A_COMENTARIOS_DEPLOY nula: nenhuma entrada, e nada vence', () => {
    expect(conferenciasE5AComentarios(null, dia(-100))).toEqual([])
    expect(conferenciasVencidas(dia(4000), conferenciasE5AComentarios(null))).toEqual([])
  })
  it('malformada: uma entrada vermelha, de qualquer das duas datas', () => {
    for (const ruim of ['amanhã', '2026-13-45', '']) {
      const a = conferenciasE5AComentarios(ruim)
      expect(a.map(x => x.id), ruim).toEqual(['e5a-comentarios-deploy-invalido'])
      expect(conferenciasEmFalha(dia(0), a).map(x => x.id), ruim).toEqual(['e5a-comentarios-deploy-invalido'])
      const b = conferenciasE5AComentarios(dia(0), ruim)
      expect(b.map(x => x.id), ruim).toEqual(['e5a-comentarios-coleta-invalido'])
      expect(b[0]!.onde).toContain('E5A_COMENTARIOS_COLETA_LIGADA')
    }
  })
  it('coleta ligada nula: só a D0', () => {
    const l = conferenciasE5AComentarios(dia(-10), null)
    expect(l.map(x => x.id)).toEqual(['e5a-comentarios-d0'])
    expect(l[0]!.data).toBe(dia(-10))
    expect(l[0]!.onde).not.toContain('Também nesta D0')
  })
  it('coleta ligada depois do envio: D0, mais 29 e mais 31, em ordem', () => {
    const l = conferenciasE5AComentarios(dia(-50), dia(-45))
    expect(l.map(x => x.id)).toEqual(['e5a-comentarios-d0', 'e5a-comentarios-identidade-vencida', 'e5a-comentarios-retrato-30-dias'])
    expect(l.map(x => x.data)).toEqual([dia(-50), dia(-16), dia(-14)])
    for (const x of l) { expect(x.etapa, x.id).toBe('E5'); expect(x.feitaEm, x.id).toBeNull() }
    expect(l[1]!.onde).toMatch(/item 125/)
    expect(l[2]!.onde).toMatch(/pelo menos 5/)
  })
  it('coleta ligada há 40 dias no dia do envio: mais 29 e mais 31 não são geradas e a D0 traz o esperado das duas', () => {
    const l = conferenciasE5AComentarios(dia(0), dia(-40))
    expect(l.map(x => x.id)).toEqual(['e5a-comentarios-d0'])
    expect(l[0]!.onde).toMatch(/item 125/)
    expect(l[0]!.onde).toMatch(/pelo menos 5/)
    expect(conferenciasVencidas(dia(0), l)).toEqual([])
  })
  it('a constante publicada é nula (sem entradas) ou uma data real', () => {
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith('e5a-comentarios-')).map(x => x.id)
    if (E5A_COMENTARIOS_DEPLOY === null) expect(publicadas).toEqual([])
    else expect(publicadas).toContain('e5a-comentarios-d0')
    expect(E5A_COMENTARIOS_COLETA_LIGADA === null || /^\d{4}-\d{2}-\d{2}$/.test(E5A_COMENTARIOS_COLETA_LIGADA)).toBe(true)
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

// E18 (versões do vídeo próprio): as seis conferências nascem do dia do envio; a constante fica `null` até o controlador preencher.
describe('conferências da E18 (versões do vídeo próprio, relativas ao dia do envio)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  const IDS = ['e18-d0', 'e18-d1', 'e18-d3', 'e18-d7', 'e18-d14', 'e18-d30']
  const DIAS = [0, 1, 3, 7, 14, 30]

  it('E18_DEPLOY nula não cria entrada, e nada vence por mais longe que esteja o dia', () => {
    expect(conferenciasE18(null)).toEqual([])
    expect(conferenciasVencidas(dia(4000), conferenciasE18(null))).toEqual([])
    expect(conferenciasEmFalha(dia(4000), conferenciasE18(null))).toEqual([])
  })
  it('data malformada vira a entrada vermelha de 1970 que manda corrigir a constante', () => {
    for (const ruim of ['amanhã', '2026-13-45', '12/10/2026', '']) {
      const l = conferenciasE18(ruim)
      expect(l.map(x => x.id), ruim).toEqual(['e18-deploy-invalido'])
      expect(l[0]!.data).toBe('1970-01-01')
      expect(l[0]!.onde).toContain('E18_DEPLOY')
      expect(conferenciasEmFalha(dia(0), l).map(x => x.id), ruim).toEqual(['e18-deploy-invalido'])
    }
  })
  it('com a data, as seis entradas em D0, D+1, D+3, D+7, D+14 e D+30, do agente, sem feitaEm', () => {
    const l = conferenciasE18(dia(-40))
    expect(l.map(x => x.id)).toEqual(IDS)
    expect(l.map(x => x.data)).toEqual(DIAS.map(n => dia(-40 + n)))
    for (const x of l) {
      expect(x.responsavel, x.id).toBe('agente')
      expect(x.feitaEm, x.id).toBeNull()
      expect(x.etapa, x.id).toBe('E18')
      expect(x.onde.length, x.id).toBeGreaterThan(40)
    }
  })
  it('cada uma vence no dia seguinte à sua data, e com 8 dias de atraso deixa o cron vermelho', () => {
    const l = conferenciasE18(dia(0))
    for (const [i, x] of l.entries()) {
      expect(conferenciasVencidas(dia(DIAS[i]!), [x]), x.id).toEqual([])
      expect(conferenciasVencidas(dia(DIAS[i]! + 1), [x]).map(y => y.id), x.id).toEqual([x.id])
      expect(conferenciasEmFalha(dia(DIAS[i]! + 7), [x]), x.id).toEqual([])
      expect(conferenciasEmFalha(dia(DIAS[i]! + 8), [x]).map(y => y.id), x.id).toEqual([x.id])
    }
  })
  it('a constante publicada é nula (sem as entradas na lista) ou uma data real (e a lista tem as seis)', () => {
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith('e18-')).map(x => x.id)
    if (E18_DEPLOY === null) expect(publicadas).toEqual([])
    else {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(E18_DEPLOY)).toBe(true)
      expect([...publicadas].sort()).toEqual([...IDS].sort())
    }
  })
})

// E17 degrau 2 (acesso pelo Claude Code, Tarefa 16): datas relativas ao AGORA com timers falsos, como o resto do arquivo.
describe('E17 degrau 2: conferências de envio, abertura e poda', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })

  it('valores publicados: envio e poda em 15/10 (promoção a main), abertura ainda fechada; só as entradas de envio e poda existem', () => {
    expect(E17_D2_DEPLOY).toBe('2026-10-15')
    expect(E17_D2_ABERTURA).toBeNull()
    expect(E17_D2_PODA_DEPLOY).toBe('2026-10-15')
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith('e17d2-')).map(x => x.id)
    expect([...publicadas].sort()).toEqual([...conferenciasE17D2(E17_D2_DEPLOY), ...conferenciasE17D2Poda(E17_D2_PODA_DEPLOY)].map(x => x.id).sort())
    expect(publicadas.every(id => !id.includes('invalid'))).toBe(true)
    expect(conferenciasE17D2Abertura(E17_D2_ABERTURA)).toEqual([])
    expect(conferenciasE17D2(null)).toEqual([])
    expect(conferenciasE17D2Abertura(null)).toEqual([])
    expect(conferenciasE17D2Poda(null)).toEqual([])
  })
  it('com uma data, as entradas saem em ordem e com data absoluta: D0, D+1, D+7; A0, A0+1, A0+7, A0+30; P+1, P+7', () => {
    const d = conferenciasE17D2(dia(-10))
    expect(d.map(x => x.id)).toEqual(['e17d2-d0', 'e17d2-d1', 'e17d2-d7'])
    expect(d.map(x => x.data)).toEqual([dia(-10), dia(-9), dia(-3)])
    const a = conferenciasE17D2Abertura(dia(-10))
    expect(a.map(x => x.id)).toEqual(['e17d2-a0', 'e17d2-a0-1', 'e17d2-a0-7', 'e17d2-a0-30'])
    expect(a.map(x => x.data)).toEqual([dia(-10), dia(-9), dia(-3), dia(20)])
    const p = conferenciasE17D2Poda(dia(-10))
    expect(p.map(x => x.id)).toEqual(['e17d2-poda-p1', 'e17d2-poda-p7'])
    expect(p.map(x => x.data)).toEqual([dia(-9), dia(-3)])
    for (const x of [...d, ...a, ...p]) { expect(x.etapa).toBe('E17'); expect(x.feitaEm).toBeNull(); expect(x.onde).toContain('a5-e17-d2') }
  })
  it('a K10 só está em A0+7 (não em A0+1) e a leitura a mais traz a consulta por dia de UTC e a frase "ninguém usou"', () => {
    const a = Object.fromEntries(conferenciasE17D2Abertura(dia(-10)).map(x => [x.id, x.onde]))
    expect(a['e17d2-a0']).toContain('included_private = true')
    expect(a['e17d2-a0']).toContain('sem_desfecho = 0')
    expect(a['e17d2-a0-30']).toContain('50 MB')
    expect(a['e17d2-a0-7']).toMatch(/K10/)
    expect(a['e17d2-a0-1']).not.toMatch(/K10/)
    expect(a['e17d2-a0-7']).toMatch(/at at time zone 'UTC'/)
    expect(a['e17d2-a0-7']).toMatch(/ninguém usou/)
    expect(a['e17d2-a0-7']).toMatch(/o plano não sobe o número sozinho/)
  })
  it('data malformada vira a entrada de 1970, vermelha, nas três', () => {
    for (const [f, id] of [[conferenciasE17D2, 'e17d2-deploy-invalido'], [conferenciasE17D2Abertura, 'e17d2-abertura-invalida'], [conferenciasE17D2Poda, 'e17d2-poda-deploy-invalido']] as const) {
      const l = f('2026-02-30')
      expect(l.map(x => x.id)).toEqual([id])
      expect(l[0]!.data).toBe('1970-01-01')
    }
  })
  it('com E17_D2_PODA_DEPLOY nula, nenhuma entrada da K7 existe; com data, saem P+1 e P+7', () => {
    expect(conferenciasE17D2Poda(null)).toEqual([])
    expect(conferenciasE17D2Poda(dia(0)).map(x => x.onde.includes('K7'))).toEqual([true, true])
  })
})

// A5 E6 P4 e E18 parte 2 (Tarefa 11; plano 2026-10-13-a5-e6-p4-e-e18-parte-2-dieta-final, seção 7): três marcos, três constantes, todas nulas até o dia.
describe.each([
  { nome: 'E18P2_COBERTURA_DEPLOY', fn: conferenciasE18P2Cobertura, pref: 'e18p2-cob-', etapa: 'E18', ids: ['e18p2-cob-d0', 'e18p2-cob-d1', 'e18p2-cob-d7', 'e18p2-cob-d14'], dias: [0, 1, 7, 14], invalido: 'e18p2-cob-deploy-invalido', publicada: E18P2_COBERTURA_DEPLOY },
  { nome: 'E6_P4_APLICADA', fn: conferenciasE6P4, pref: 'e6-p4-', etapa: 'E6', ids: ['e6-p4-d0', 'e6-p4-d1', 'e6-p4-d7'], dias: [0, 1, 7], invalido: 'e6-p4-aplicada-invalida', publicada: E6_P4_APLICADA },
  { nome: 'E18P2_APLICADA', fn: conferenciasE18P2, pref: 'e18p2-d', etapa: 'E18', ids: ['e18p2-d0', 'e18p2-d1', 'e18p2-d7', 'e18p2-d30'], dias: [0, 1, 7, 30], invalido: 'e18p2-aplicada-invalida', publicada: E18P2_APLICADA },
])('conferências de $nome', ({ nome, fn, pref, etapa, ids, dias, invalido, publicada }) => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  const ehData = (x: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(x) && new Date(`${x}T00:00:00.000Z`).toISOString().slice(0, 10) === x

  it('constante nula = nenhuma entrada, e nada vence por mais longe que esteja o dia (dado ausente)', () => {
    expect(fn(null)).toEqual([])
    expect(conferenciasVencidas(dia(4000), fn(null))).toEqual([])
    expect(conferenciasEmFalha(dia(4000), fn(null))).toEqual([])
  })
  it('malformada = uma entrada de erro de 1970 que cita a constante (2026-13-01, 13/10/2026 e texto vazio)', () => {
    for (const ruim of ['2026-13-01', '13/10/2026', '']) {
      const l = fn(ruim)
      expect(l.map(x => x.id), ruim).toEqual([invalido])
      expect(l[0]!.data).toBe('1970-01-01')
      expect(l[0]!.onde).toContain(nome)
      expect(conferenciasEmFalha(dia(0), l).map(x => x.id), ruim).toEqual([invalido])
    }
  })
  it('preenchida = as datas certas, em ordem, do agente, sem feitaEm, apontando para o plano', () => {
    const l = fn(dia(-40))
    expect(l.map(x => x.id)).toEqual(ids)
    expect(l.map(x => x.data)).toEqual(dias.map(n => dia(-40 + n)))
    for (const x of l) {
      expect(x.responsavel, x.id).toBe('agente')
      expect(x.feitaEm, x.id).toBeNull()
      expect(x.etapa, x.id).toBe(etapa)
      expect(x.onde, x.id).toContain('2026-10-13-a5-e6-p4-e-e18-parte-2-dieta-final-plan.md')
    }
  })
  it('a constante publicada é nula ou uma data real, e, se tiver data, a lista publicada tem as entradas (pega o espalhamento esquecido)', () => {
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith(pref) && x.id !== invalido).map(x => x.id)
    if (publicada === null) expect(publicadas).toEqual([])
    else {
      expect(ehData(publicada)).toBe(true)
      expect(publicadas).toContain(ids[0])
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
    expect(por['e17d1-d7']).toMatch(/exceto `pacote:canal-proprio`.*31\.500/)
    expect(por['e17d1-d0']).toMatch(/total em caracteres/)
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

// A5 E11 (Tarefa 14): as conferências do canal próprio em tabelas dependem do dia da promoção a `main` (D), preenchido em E11_DEPLOY no commit do envio.
describe('conferências de E11 (canal próprio em tabelas, relativas ao dia do envio)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  const IDS = ['e11-d1', 'e11-d5', 'e11-d14', 'e11-relatorio-refeito']

  it('E11_DEPLOY nula = nenhuma entrada, e nada vence nem fica vermelho', () => {
    expect(conferenciasE11(null)).toEqual([])
    expect(conferenciasVencidas(dia(4000), conferenciasE11(null))).toEqual([])
    expect(conferenciasEmFalha(dia(4000), conferenciasE11(null))).toEqual([])
  })
  it('malformada = uma entrada de erro (vermelha) que manda corrigir a constante', () => {
    for (const ruim of ['amanhã', '2026-13-45', '17/10/2026', '']) {
      const l = conferenciasE11(ruim)
      expect(l.map(x => x.id), ruim).toEqual(['e11-deploy-invalido'])
      expect(l[0]!.etapa).toBe('E11')
      expect(conferenciasEmFalha(dia(0), l).map(x => x.id), ruim).toEqual(['e11-deploy-invalido'])
      expect(l[0]!.onde).toContain('E11_DEPLOY')
    }
  })
  it('preenchida = as quatro entradas com as datas certas (D+1, D+5, D+14, D+60), do agente, etapa E11, sem feitaEm', () => {
    const l = conferenciasE11('2026-10-17')
    expect(l.map(x => x.id)).toEqual(IDS)
    expect(l.map(x => x.data)).toEqual(['2026-10-18', '2026-10-22', '2026-10-31', '2026-12-16'])
    for (const x of l) {
      expect(x.responsavel, x.id).toBe('agente')
      expect(x.feitaEm, x.id).toBeNull()
      expect(x.etapa, x.id).toBe('E11')
      expect(x.onde.length, x.id).toBeGreaterThan(20)
    }
  })
  it('a lista publicada espalha as entradas (ou nenhuma, se E11_DEPLOY é nula)', () => {
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith('e11-') && x.id !== 'e11-religar-ou-retirar').map(x => x.id)
    if (E11_DEPLOY === null) expect(publicadas).toEqual([])
    else expect([...publicadas].sort()).toEqual([...IDS].sort())
  })
  it('E11_DEPLOY (dia de São Paulo) e DIMENSOES_LIGADO_EM (dia do Pacífico) não diferem em mais de um dia', () => {
    expect(E11_DEPLOY).not.toBeNull()
    const dif = Math.abs(Date.parse(`${E11_DEPLOY}T00:00:00.000Z`) - Date.parse(`${DIMENSOES_LIGADO_EM}T00:00:00.000Z`)) / 86_400_000
    expect(dif).toBeLessThanOrEqual(1)
  })
})

// E9 (fila "Saíram do YouTube"): as quatro conferências com data nascem do dia do envio; a constante fica `null` até o controlador preencher.
describe('conferências da E9 (fila "Saíram do YouTube", relativas ao dia do envio)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  const IDS = ['e9-d0', 'e9-d1', 'e9-d7', 'e9-d30']
  const DIAS = [0, 1, 7, 30]

  it('E9_DEPLOY nula não cria entrada, e nada vence por mais longe que esteja o dia', () => {
    expect(conferenciasE9(null)).toEqual([])
    expect(conferenciasVencidas(dia(4000), conferenciasE9(null))).toEqual([])
    expect(conferenciasEmFalha(dia(4000), conferenciasE9(null))).toEqual([])
  })
  it('data malformada vira a entrada vermelha de 1970 que manda corrigir a constante', () => {
    for (const ruim of ['amanhã', '2026-13-45', '12/10/2026', '']) {
      const l = conferenciasE9(ruim)
      expect(l.map(x => x.id), ruim).toEqual(['e9-deploy-invalido'])
      expect(l[0]!.data).toBe('1970-01-01')
      expect(l[0]!.onde).toContain('E9_DEPLOY')
      expect(conferenciasEmFalha(dia(0), l).map(x => x.id), ruim).toEqual(['e9-deploy-invalido'])
    }
  })
  it('com a data, as quatro entradas em D, D+1, D+7 e D+30, do agente, sem feitaEm, e o d0 exige o campo prova_ausentes', () => {
    const l = conferenciasE9(dia(-40))
    expect(l.map(x => x.id)).toEqual(IDS)
    expect(l.map(x => x.data)).toEqual(DIAS.map(n => dia(-40 + n)))
    for (const x of l) {
      expect(x.responsavel, x.id).toBe('agente')
      expect(x.feitaEm, x.id).toBeNull()
      expect(x.etapa, x.id).toBe('E9')
      expect(x.onde.length, x.id).toBeGreaterThan(40)
    }
    expect(l[0]!.onde).toContain('prova_ausentes')
  })
  it('cada uma vence no dia seguinte à sua data, e com 8 dias de atraso deixa o cron vermelho', () => {
    const l = conferenciasE9(dia(0))
    for (const [i, x] of l.entries()) {
      expect(conferenciasVencidas(dia(DIAS[i]!), [x]), x.id).toEqual([])
      expect(conferenciasVencidas(dia(DIAS[i]! + 1), [x]).map(y => y.id), x.id).toEqual([x.id])
      expect(conferenciasEmFalha(dia(DIAS[i]! + 7), [x]), x.id).toEqual([])
      expect(conferenciasEmFalha(dia(DIAS[i]! + 8), [x]).map(y => y.id), x.id).toEqual([x.id])
    }
  })
  it('a constante publicada é nula (sem as entradas na lista) ou uma data real (e a lista tem as quatro)', () => {
    const publicadas = CONFERENCIAS.filter(x => x.id.startsWith('e9-')).map(x => x.id)
    if (E9_DEPLOY === null) expect(publicadas).toEqual([])
    else {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(E9_DEPLOY)).toBe(true)
      expect([...publicadas].sort()).toEqual([...IDS].sort())
    }
  })
})

describe('X3: conferências com data (A5 X3)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: AGORA, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })
  it('X3_LIGADA = 18/10 (1ª rodada da coleta): as três entradas publicadas; nula não publica nada', () => {
    expect(X3_LIGADA).toBe('2026-10-18')
    expect(conferenciasX3(null)).toEqual([])
    expect(CONFERENCIAS.filter(x => x.id.startsWith('x3-')).map(x => [x.id, x.data])).toEqual([
      ['x3-d1', '2026-10-19'], ['x3-d7', '2026-10-25'], ['x3-d30', '2026-11-17'],
    ])
  })
  it('com data: D+1, D+7 e D+30 em ordem, do agente, com a consulta', () => {
    const l = conferenciasX3(dia(-40))
    expect(l.map(x => x.id)).toEqual(['x3-d1', 'x3-d7', 'x3-d30'])
    expect(l.map(x => x.data)).toEqual([1, 7, 30].map(n => dia(-40 + n)))
    for (const x of l) { expect(x.responsavel).toBe('agente'); expect(x.feitaEm).toBeNull(); expect(x.etapa).toMatch(/^E\d+$/); expect(x.onde.length).toBeGreaterThan(20) }
  })
  it('data malformada vira entrada de 1970 (vermelha)', () => {
    expect(conferenciasX3('2026-13-45').map(x => [x.id, x.data])).toEqual([['x3-ligada-invalida', '1970-01-01']])
  })
})

// Fecho da A5 (dono, 23/10): as 37 vencidas sem prova reabrem em REABERTAS_EM; a data do plano não muda.
describe('reabertas (fecho da A5)', () => {
  it('toda reaberta existe na lista, segue sem feitaEm e conta o vencimento de REABERTAS_EM', () => {
    expect(REABERTAS.size).toBe(37)
    for (const id of REABERTAS) {
      const c = CONFERENCIAS.find(x => x.id === id)
      expect(c, id).toBeDefined()
      if (c?.feitaEm) continue // feita depois (lote de 27/10 em FEITAS): sai do vermelho por prova
      expect(c?.reabertaEm, id).toBe(REABERTAS_EM)
      expect(diasDeAtraso(REABERTAS_EM, c!), id).toBe(0)
    }
  })
  it('a data do plano fica: e7-l1-d7 segue com data de 19/10 (feita em 27/10)', () => {
    expect(CONFERENCIAS.find(x => x.id === 'e7-l1-d7')).toMatchObject({ data: '2026-10-19', feitaEm: '2026-10-27' })
  })
  it('lote feitaEm de 27/10: todo id existe e tem a data (reabertas-27-10-resultado.md)', () => {
    const ids = 'e6-retrato e10-d0 e16-d1 e16-k1 e8-primeira-execucao e10-d1 e1e2-d3 e17d2-d1 e17d2-poda-p1 e6-p3-d1 e8-tempo-real e11-d1 e9-d1 e7-l1-d7 e1e2-d7 e15-atraso-d7 e20-tamanho-d8 e10-d7 e5a-d7 e10-i4 i7-k6-d3 e15-np-d3 e8-tres-dias e9-d0 e1e2-d8 e19-15o-dia'.split(' ')
    for (const id of ids) {
      const c = CONFERENCIAS.find(x => x.id === id)
      expect(c, id).toBeDefined()
      expect(c?.feitaEm, id).toBe(id === 'e19-15o-dia' ? '2026-10-26' : '2026-10-27')
    }
  })
})
