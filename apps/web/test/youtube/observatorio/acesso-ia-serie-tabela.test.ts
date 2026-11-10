// @vitest-environment node
/**
 * A5 F2a T9: a `serie` de um canal em CSV longo (`saida: 'tabela'`), a soma da semana com motivo (`somaDaSemana`) e o item herdado da F0.5b
 * (o `responder` lê `Tabela.dias`; sem `dias` cai em `diaDaLinha` e avisa). As tabelas são de fixture, DESCENDENTES (do dia mais recente ao mais antigo,
 * como a `canal-linha-do-tempo` real), com a data ISO só em `Tabela.dias`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ empacotar: {} as Record<string, ReturnType<typeof import('vitest')['vi']['fn']>>, captured: [] as unknown[][] }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => m.captured.push(a), captureException: (...a: unknown[]) => m.captured.push(a) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))

import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { csvDaSerie, pontosDaSerie, somaDaSemana, type PontoCsv } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/serie-tabela'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { novaLegenda } from '@/lib/youtube/observatorio/contexto-ia/tabela-csv'
import { foraDaLeituraFrase } from '@/lib/youtube/observatorio/proprio/vpd'
import type { Celula, PacoteModelo, Tabela, TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { base, medido, modeloCheio, naoMedido, rotulo, zero } from './contexto-ia-fixture'

const abrir = ABRIDOR_DE_SESSAO
const C1 = '11111111-1111-4111-8111-111111111111'
/** 10/11/2026 12:00 em São Paulo (terça). O dia de hoje do pedido é 2026-11-10. */
const AGORA = Date.UTC(2026, 10, 10, 15, 0, 0)
const HOJE = '2026-11-10'
const TELAS: TelaId[] = ['canais', 'canal', 'video', 'comparar', 'outliers', 'insights', 'mudancas', 'fila', 'canal-proprio', 'video-proprio', 'ritmo', 'sugestoes']
const pacote = (modelo: PacoteModelo) => ({ modelo, recente: '10/11/2026 09:10', estado: {} as Record<string, string> })
const dobra = (tela: TelaId, modelo: PacoteModelo | null) => (m.empacotar[tela] as ReturnType<typeof vi.fn>).mockImplementation(async () => (modelo === null ? null : pacote(modelo)))

beforeEach(() => {
  m.captured.length = 0
  for (const t of TELAS) m.empacotar[t] = vi.fn(async () => null)
})

/* ------------------------------------------------------------------ fixtures */

const ms = (d: string): number => Date.parse(`${d}T00:00:00Z`)
const mais = (d: string, n: number): string => new Date(ms(d) + n * 86_400_000).toISOString().slice(0, 10)
const entre = (a: string, b: string): number => Math.round((ms(b) - ms(a)) / 86_400_000)
const dmDe = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const dmaDe = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
/** O ganho de um dia na fixture: 1000 + dias desde 01/09 (distinto por dia, para a soma não casar por acaso). */
const ganhoDe = (d: string): number => 1000 + entre('2026-09-01', d)
const med = (x: number, o = 'p'): Celula => medido(String(x), x, o)
const semReg = (o = 'p'): Celula => naoMedido('sem registro', o)
const dim = (o = 'p'): Celula => ({ papel: 'numero', estado: 'nao_medido', motivo: 'o total diminuiu', origem: o, causa: 'diminuiu' })

interface OpcoesDaTabela {
  ultimo?: string
  n?: number
  /** a célula de um dia; padrão: ganho do dia depois da coleta, sem registro antes */
  celula?: (dia: string) => Celula
  inicio?: string
  id?: string
  semana?: 'soma' | 'ultima' | undefined
  fuso?: 'sao_paulo' | 'pacifico'
  privada?: boolean
  rotuloDoDia?: (dia: string) => string
  semDias?: boolean
}
/** Tabela `dia_a_dia` DESCENDENTE (a 1ª linha é o dia mais recente), data ISO só em `dias`. */
function tabela(o: OpcoesDaTabela = {}): Tabela {
  const ultimo = o.ultimo ?? '2026-11-09'
  const n = o.n ?? 90
  const inicio = o.inicio ?? '2026-10-03'
  const dias = Array.from({ length: n }, (_, i) => mais(ultimo, -i))
  const celula = o.celula ?? ((d: string) => (d < inicio ? semReg() : med(ganhoDe(d))))
  const semana = 'semana' in o ? o.semana : 'soma'
  return {
    id: o.id ?? 'canal-linha-do-tempo', titulo: 'Linha do tempo: views ganhas por dia', tipo: 'dia_a_dia', nomeNoCorte: 'views por dia do canal', privada: o.privada ?? false,
    ...(semana ? { semana } : {}), fuso: o.fuso ?? 'sao_paulo', ...(o.semDias ? {} : { dias }),
    colunas: ['Dia', 'Views ganhas', 'Situação'],
    linhas: dias.map((d, i): Celula[] => [rotulo(o.rotuloDoDia ? o.rotuloDoDia(d) : `seg ${dmDe(d)}`, `p.t[${i}].dia`), celula(d), base('com views', `p.t[${i}].s`)]),
  }
}
const modelo = (t: Tabela | Tabela[], extra: Partial<PacoteModelo> = {}, tela: TelaId = 'canal'): PacoteModelo =>
  ({ ...modeloCheio(), tela, foco: [{ nome: 'Nômade Raiz', oQueE: 'concorrente', detalhe: 'canal A' }], tabelas: Array.isArray(t) ? t : [t], ...extra })

const csvDe = (texto: string): string[] => {
  const a = texto.indexOf('```csv\n')
  if (a < 0) return []
  const resto = texto.slice(a + 7)
  return resto.slice(0, resto.indexOf('\n```')).split('\n')
}
const pontos = (mm: PacoteModelo, p: { de: string; ate: string; grao: 'dia' | 'semana' }): PontoCsv[] => pontosDaSerie(mm, C1, 'c1', p, AGORA)
const dias7 = (segunda: string, c: (d: string, i: number) => Celula): Array<{ dia: string; celula: Celula }> => Array.from({ length: 7 }, (_, i) => ({ dia: mais(segunda, i), celula: c(mais(segunda, i), i) }))

/* ------------------------------------------------------------------ somaDaSemana (pura) */

describe('somaDaSemana', () => {
  it('(a) 7 dias medidos de 100 a 106 somam 721', () => {
    const r = somaDaSemana('2026-10-05', dias7('2026-10-05', (_, i) => med(100 + i)), HOJE, 'soma')
    expect(r).toEqual({ x: 721, diasMedidos: 7, motivo: null })
  })
  it('(a2) a soma sai arredondada a 2 casas e zero medido soma zero', () => {
    expect(somaDaSemana('2026-10-05', dias7('2026-10-05', () => med(0.1)), HOJE, 'soma').x).toBe(0.7)
    expect(somaDaSemana('2026-10-05', dias7('2026-10-05', () => zero('p')), HOJE, 'soma')).toEqual({ x: 0, diasMedidos: 7, motivo: null })
  })
  it('(b) 6 de 7 dias: sem soma, k = 6, motivo dias_sem_leitura', () => {
    const r = somaDaSemana('2026-10-05', dias7('2026-10-05', (_, i) => (i === 3 ? semReg() : med(100 + i))), HOJE, 'soma')
    expect(r).toEqual({ x: null, diasMedidos: 6, motivo: 'dias_sem_leitura' })
  })
  it('(b2) menos de 7 linhas na tabela (semana cortada pela tabela) nunca soma', () => {
    const r = somaDaSemana('2026-10-05', dias7('2026-10-05', (_, i) => med(100 + i)).slice(0, 6), HOJE, 'soma')
    expect(r.x).toBeNull()
    expect(r.diasMedidos).toBe(6)
  })
  it('(c) semana corrente (hoje numa quarta): semana_aberta', () => {
    const r = somaDaSemana('2026-11-02', dias7('2026-11-02', (d, i) => (d <= '2026-11-04' ? med(100 + i) : semReg())), '2026-11-04', 'soma')
    expect(r).toEqual({ x: null, diasMedidos: 3, motivo: 'semana_aberta' })
  })
  it('(d) dia com causa diminuiu: total_corrigido, nunca dias_sem_leitura', () => {
    const r = somaDaSemana('2026-10-05', dias7('2026-10-05', (_, i) => (i === 2 ? dim() : med(100 + i))), HOJE, 'soma')
    expect(r).toEqual({ x: null, diasMedidos: 6, motivo: 'total_corrigido' })
  })
  it('(e) tabela sem semana declarada: tabela_sem_soma, mesmo com 7 dias medidos', () => {
    const r = somaDaSemana('2026-10-05', dias7('2026-10-05', (_, i) => med(100 + i)), HOJE, null)
    expect(r).toEqual({ x: null, diasMedidos: 7, motivo: 'tabela_sem_soma' })
  })
  it('regra ultima: a última leitura medida da semana', () => {
    const r = somaDaSemana('2026-10-05', dias7('2026-10-05', (d, i) => (i === 6 ? semReg() : med(100 + i))), HOJE, 'ultima')
    expect(r).toEqual({ x: 105, diasMedidos: 6, motivo: null })
  })
})

/* ------------------------------------------------------------------ pontosDaSerie */

describe('pontosDaSerie', () => {
  it('(i3) a data de cada ponto vem de Tabela.dias, não do texto do rótulo', () => {
    const t = tabela({ rotuloDoDia: (d) => `D-${entre(d, HOJE)}`, n: 10 })
    const ps = pontos(modelo(t), { de: '2026-11-05', ate: '2026-11-09', grao: 'dia' })
    expect(ps.map((p) => p.data)).toEqual(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'])
    expect(ps.map((p) => p.x)).toEqual(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'].map(ganhoDe))
  })

  it('só lê tabela com dias: sem dias, a série sai sem pontos', () => {
    expect(pontos(modelo(tabela({ semDias: true })), { de: '2026-11-01', ate: '2026-11-09', grao: 'dia' })).toEqual([])
  })

  it('(i2) início da coleta: a tabela vem DESCENDENTE e o início é o MENOR dia com leitura, não a posição', () => {
    // os 20 dias mais antigos sem registro; o 21º dia (2026-10-03 + 0) é o primeiro com leitura
    const t = tabela({ n: 40, ultimo: '2026-11-09', inicio: mais('2026-11-09', -39 + 20) })
    const inicio = mais('2026-11-09', -39 + 20)
    const ps = pontos(modelo(t), { de: mais('2026-11-09', -39), ate: mais('2026-11-09', -39 + 2), grao: 'dia' })
    expect(ps.map((p) => p.estado)).toEqual(['nao_medido', 'nao_medido', 'nao_medido'])
    for (const p of ps) expect(p.motivo).toBe(`antes do início da coleta deste canal (${dmaDe(inicio)})`)
  })

  it('(i2) variante: o 21º dia é diminuiu e continua sendo o início', () => {
    const inicio = '2026-10-20'
    const t = tabela({ n: 40, ultimo: '2026-11-09', celula: (d) => (d < inicio ? semReg() : d === inicio ? dim() : med(ganhoDe(d))) })
    const ps = pontos(modelo(t), { de: '2026-10-01', ate: '2026-10-02', grao: 'dia' })
    expect(ps).toHaveLength(2)
    for (const p of ps) expect(p.motivo).toBe(`antes do início da coleta deste canal (${dmaDe(inicio)})`)
    const noInicio = pontos(modelo(t), { de: inicio, ate: inicio, grao: 'dia' })[0]!
    expect(noInicio.estado).toBe('nao_medido')
    expect(noInicio.motivo).toBe('o YouTube corrigiu o total para baixo neste dia; não há ganho a somar')
  })

  it('(i2) pedido depois do último retrato: "sem leitura depois de" o MAIOR dia com leitura', () => {
    const t = tabela({ celula: (d) => (d >= '2026-10-03' && d <= '2026-11-05' ? med(ganhoDe(d)) : semReg()) })
    const ps = pontos(modelo(t), { de: '2026-11-07', ate: '2026-11-08', grao: 'dia' })
    expect(ps).toHaveLength(2)
    for (const p of ps) { expect(p.estado).toBe('nao_medido'); expect(p.motivo).toBe(`sem leitura depois de ${dmaDe('2026-11-05')}`) }
  })

  it('buraco no meio: "sem leitura"; dia fora da tabela, antes: "fora dos 90 dias"', () => {
    const t = tabela({ n: 30, inicio: '2026-10-01', celula: (d) => (d === '2026-10-20' ? semReg() : med(ganhoDe(d))) })
    const mm = modelo(t)
    expect(pontos(mm, { de: '2026-10-20', ate: '2026-10-20', grao: 'dia' })[0]!.motivo).toBe('sem leitura')
    // a tabela de 30 dias começa em 11/10: o dia 2026-10-08 ... não; 11-09 menos 29 = 10-11
    const antes = pontos(mm, { de: '2026-10-09', ate: '2026-10-12', grao: 'dia' })
    expect(antes[0]!.motivo).toBe('fora dos 90 dias que a tela guarda')
    expect(antes[3]!.estado).toBe('medido')
  })

  it('(h) intervalo inteiro fora da tabela: UMA linha resumo por medida, "a tela cobre de … a …"', () => {
    const ps = pontos(modelo(tabela()), { de: '2026-05-01', ate: '2026-05-31', grao: 'dia' })
    expect(ps).toHaveLength(1)
    expect(ps[0]).toMatchObject({ data: '2026-05-01', medida: 'views_ganhas', x: null, estado: 'nao_medido', motivo: `a tela cobre de ${dmaDe('2026-08-12')} a ${dmaDe('2026-11-09')}` })
  })

  it('canal sem nenhuma leitura: as linhas dizem a frase da tela, valor vazio', () => {
    const ps = pontos(modelo(tabela({ celula: () => semReg() })), { de: '2026-11-01', ate: '2026-11-02', grao: 'dia' })
    expect(ps.map((p) => [p.estado, p.x, p.motivo])).toEqual([['nao_medido', null, 'ainda não há leitura de views deste canal'], ['nao_medido', null, 'ainda não há leitura de views deste canal']])
  })

  it('(f) de numa quarta e ate numa terça: a 1ª semana começa na segunda anterior e a última termina no domingo seguinte', () => {
    const ps = pontos(modelo(tabela()), { de: '2026-10-07', ate: '2026-11-03', grao: 'semana' })
    expect(ps.map((p) => p.data)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'])
    expect(ps.every((p) => p.diasMedidos !== undefined)).toBe(true)
  })

  it('semana: 7 dias medidos soma; semana de início da coleta parcial sai k de 7; semana aberta diz quando termina', () => {
    const mm = modelo(tabela({ ultimo: '2026-11-09', celula: (d) => (d < '2026-10-03' ? semReg() : d <= '2026-11-04' ? med(ganhoDe(d)) : semReg()) }))
    const ps = pontos(mm, { de: '2026-09-28', ate: '2026-11-08', grao: 'semana' })
    const porData = new Map(ps.map((p) => [p.data, p]))
    // 05/10: 7 dias medidos
    const soma = Array.from({ length: 7 }, (_, i) => ganhoDe(mais('2026-10-05', i))).reduce((a, b) => a + b, 0)
    expect(porData.get('2026-10-05')).toMatchObject({ x: soma, estado: 'medido', diasMedidos: 7 })
    // 28/09: só 03/10 e 04/10 têm leitura
    expect(porData.get('2026-09-28')).toMatchObject({ x: null, estado: 'nao_medido', diasMedidos: 2, motivo: '5 de 7 dias sem leitura' })
    // 02/11: segunda a quarta lidas; hoje é 10/11, então a semana de 02/11 JÁ passou: dias sem leitura
    expect(porData.get('2026-11-02')).toMatchObject({ x: null, diasMedidos: 3, motivo: '4 de 7 dias sem leitura' })
  })

  it('semana corrente: o motivo é semana ainda aberta (termina em dd/mm)', () => {
    const mm = modelo(tabela({ ultimo: '2026-11-09', celula: (d) => (d < '2026-10-03' ? semReg() : d <= '2026-11-09' ? med(ganhoDe(d)) : semReg()) }))
    const ps = pontosDaSerie(mm, C1, 'c1', { de: '2026-11-09', ate: '2026-11-10', grao: 'semana' }, AGORA)
    expect(ps).toHaveLength(1)
    expect(ps[0]).toMatchObject({ data: '2026-11-09', x: null, motivo: 'semana ainda aberta (termina em 15/11)', diasMedidos: 1 })
  })

  it('semana inteira antes do início da coleta e semana inteira antes da tabela têm motivo próprio', () => {
    const ps = pontos(modelo(tabela()), { de: '2026-08-03', ate: '2026-09-27', grao: 'semana' })
    const porData = new Map(ps.map((p) => [p.data, p]))
    expect(porData.get('2026-08-03')!.motivo).toBe('fora dos 90 dias que a tela guarda')
    expect(porData.get('2026-09-21')!.motivo).toBe(`antes do início da coleta deste canal (${dmaDe('2026-10-03')})`)
  })

  it('(e) tabela sem semana declarada no grão semana: tabela_sem_soma, valor vazio', () => {
    const ps = pontos(modelo(tabela({ semana: undefined })), { de: '2026-10-05', ate: '2026-10-11', grao: 'semana' })
    expect(ps[0]).toMatchObject({ x: null, estado: 'nao_medido', diasMedidos: 7, motivo: 'esta tabela não soma por semana; peça o grão dia' })
  })

  it('(j) próprio sem o direito: uma linha restrito por dia pedido, nenhum número; o direito traz os números', () => {
    const SENTINELA = 987654
    const privada = tabela({ id: 'privado-views-por-dia', privada: true, fuso: 'pacifico', celula: () => med(SENTINELA), inicio: '2026-08-01' })
    const sem = modelo(privada, { tabelas: [], privado: { estado: 'excluido', motivo: 'sem_direito', itens: 'views por dia' } }, 'canal-proprio')
    const ps = pontos(sem, { de: '2026-11-01', ate: '2026-11-03', grao: 'dia' })
    expect(ps.map((p) => [p.data, p.estado, p.x])).toEqual([['2026-11-01', 'restrito', null], ['2026-11-02', 'restrito', null], ['2026-11-03', 'restrito', null]])
    expect(ps[0]!.motivo).toContain('Quem gerou este pacote não tem o direito')
    // o empacotador nunca entrega tabela privada sem o direito, mas se entregasse a série NÃO pode vazar o número
    const vazando = modelo(privada, { privado: { estado: 'excluido', motivo: 'sem_direito', itens: 'views por dia' } }, 'canal-proprio')
    const pv = pontos(vazando, { de: '2026-11-01', ate: '2026-11-03', grao: 'dia' })
    expect(pv.every((p) => p.estado === 'restrito' && p.x === null)).toBe(true)
    expect(JSON.stringify(pv)).not.toContain(String(SENTINELA))
    const com = modelo(privada, { privado: { estado: 'incluido', itens: 'views por dia' } }, 'canal-proprio')
    expect(pontos(com, { de: '2026-11-01', ate: '2026-11-01', grao: 'dia' })[0]).toMatchObject({ medida: 'views', x: SENTINELA, estado: 'medido' })
  })
})

/* ------------------------------------------------------------------ csvDaSerie */

describe('csvDaSerie', () => {
  const p = (o: Partial<PontoCsv>): PontoCsv => ({ data: '2026-10-05', canalId: C1, apelido: 'c1', medida: 'views_ganhas', x: 15230, estado: 'medido', ...o })
  it('grão dia: 6 colunas, sem dias_medidos; o canal é o apelido e o uuid fica no dicionário', () => {
    const r = csvDaSerie([p({}), p({ data: '2026-10-06', x: null, estado: 'nao_medido', motivo: 'sem leitura' })], 'dia', novaLegenda())
    expect(r.cabecalho).toBe('dia,canal,medida,valor,estado,motivo_id')
    expect(r.linhas).toEqual(['2026-10-05,c1,views_ganhas,15230,medido,', '2026-10-06,c1,views_ganhas,,nao_medido,m1'])
    expect(r.dicionarioDeCanais.join('\n')).toContain(`c1: ${C1}`)
  })
  it('grão semana: semana_inicio e dias_medidos', () => {
    const r = csvDaSerie([p({ diasMedidos: 7 }), p({ data: '2026-10-12', x: null, estado: 'nao_medido', diasMedidos: 5, motivo: '2 de 7 dias sem leitura' })], 'semana', novaLegenda())
    expect(r.cabecalho).toBe('semana_inicio,canal,medida,valor,estado,dias_medidos,motivo_id')
    expect(r.linhas).toEqual(['2026-10-05,c1,views_ganhas,15230,medido,7,', '2026-10-12,c1,views_ganhas,,nao_medido,5,m1'])
  })
})

/* ------------------------------------------------------------------ pelo responder */

const SEMANA = { acao: 'serie', canal_id: C1, de: '2026-10-05', ate: '2026-11-08', grao: 'semana', saida: 'tabela' }

describe('responder: serie em tabela (um canal)', () => {
  it('(g) o exemplo 1.1: cabeçalho, uuid no dicionário e as linhas na ordem', async () => {
    dobra('canal', modelo(tabela()))
    const r = await responder(SEMANA, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    const csv = csvDe(r.texto)
    expect(csv[0]).toBe('semana_inicio,canal,medida,valor,estado,dias_medidos,motivo_id')
    expect(r.texto).toContain(`c1: ${C1}`)
    const somaDa = (seg: string): number => Array.from({ length: 7 }, (_, i) => ganhoDe(mais(seg, i))).reduce((a, b) => a + b, 0)
    expect(csv.slice(1)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'].map((s) => `${s},c1,views_ganhas,${somaDa(s)},medido,7,`))
    expect(r.texto).toContain('Semanas de 05/10 a 08/11, segunda a domingo')
    expect(r.texto).toContain('Gráfico sugerido: linha')
    expect(r.params).toMatchObject({ saida: 'tabela' })
  })

  it('(g2) grão dia: uma linha por dia, data crescente, e a semana sem registro antes da coleta dita o motivo', async () => {
    dobra('canal', modelo(tabela()))
    const r = await responder({ acao: 'serie', canal_id: C1, de: '2026-10-01', ate: '2026-10-05', grao: 'dia', saida: 'tabela' }, abrir, AGORA)
    const csv = csvDe(r.texto)
    expect(csv[0]).toBe('dia,canal,medida,valor,estado,motivo_id')
    expect(csv.slice(1).map((l) => l.split(',')[0])).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'])
    expect(csv[1]).toMatch(/^2026-10-01,c1,views_ganhas,,nao_medido,m1$/)
    expect(r.texto).toContain(`antes do início da coleta deste canal (${dmaDe('2026-10-03')})`)
    expect(csv[3]).toBe(`2026-10-03,c1,views_ganhas,${ganhoDe('2026-10-03')},medido,`)
  })

  it('(h) intervalo inteiro fora: uma linha resumo e a Cobertura conta as linhas', async () => {
    dobra('canal', modelo(tabela()))
    const r = await responder({ acao: 'serie', canal_id: C1, de: '2026-05-01', ate: '2026-05-31', grao: 'dia', saida: 'tabela' }, abrir, AGORA)
    expect(csvDe(r.texto).slice(1)).toHaveLength(1)
    expect(r.texto).toContain(`a tela cobre de ${dmaDe('2026-08-12')} a ${dmaDe('2026-11-09')}`)
    expect(r.texto).toContain('Nenhum ponto medido entre')
    expect(r.texto).toContain('linhas: 1 de 1')
  })

  it('serie sem tabela dia_a_dia: a frase de hoje no texto, CSV só com o cabeçalho, Cobertura serieAusente', async () => {
    dobra('canal', modelo([], {}))
    const r = await responder(SEMANA, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(csvDe(r.texto)).toEqual(['semana_inicio,canal,medida,valor,estado,dias_medidos,motivo_id'])
    expect(r.texto).toContain('a série dia a dia não veio nesta leitura')
    expect(r.texto).toContain('A série não veio neste recorte; ausência não é zero.')
  })

  it('tabela dia_a_dia sem data de calendário fica fora do CSV e a Cobertura diz', async () => {
    const cedo = { ...tabela({ id: 'privado-views-por-dia-cedo', privada: true, semDias: true }) }
    dobra('canal', modelo([tabela(), cedo], { privado: { estado: 'incluido', itens: 'views' } }, 'canal'))
    const r = await responder({ ...SEMANA, grao: 'dia', de: '2026-11-01', ate: '2026-11-03' }, abrir, AGORA)
    expect(csvDe(r.texto).slice(1)).toHaveLength(3)
    expect(r.texto).toContain('sem data de calendário')
  })

  it('(j) pelo responder: sem o direito, linhas restrito e nenhum número do próprio; com o direito, "privado: sim" e a base com N fora da soma', async () => {
    const SENT = 987654
    const privada = tabela({ id: 'privado-views-por-dia', privada: true, fuso: 'pacifico', celula: () => med(SENT), inicio: '2026-08-01' })
    const aviso: Tabela = { id: 'privado-views-em-frases', titulo: 'Views por dia do canal, em frases', tipo: 'fixa', nomeNoCorte: 'frases', privada: true, colunas: ['Texto'], linhas: [[base(foraDaLeituraFrase(3), 'p.av')]] }
    dobra('canal-proprio', modelo([], { privado: { estado: 'excluido', motivo: 'sem_direito', itens: 'views por dia' } }, 'canal-proprio'))
    const sem = await responder({ acao: 'serie', canal_id: C1, de: '2026-11-01', ate: '2026-11-03', grao: 'dia', saida: 'tabela' }, abrir, AGORA)
    expect(sem.desfecho).toBe('ok')
    expect(csvDe(sem.texto).slice(1).every((l) => l.includes(',restrito,'))).toBe(true)
    expect(sem.texto).not.toContain(String(SENT))
    expect(sem.incluiuPrivado).toBe(false)
    dobra('canal-proprio', modelo([privada, aviso], { privado: { estado: 'incluido', itens: 'views por dia' } }, 'canal-proprio'))
    const com = await responder({ acao: 'serie', canal_id: C1, de: '2026-11-01', ate: '2026-11-03', grao: 'dia', saida: 'tabela' }, abrir, AGORA)
    expect(com.texto).toContain('privado: sim')
    expect(com.texto).toContain(`${SENT}`)
    expect(com.texto).toContain('3 fora da soma')
    expect(com.texto).toContain('horário do Pacífico')
    expect(com.incluiuPrivado).toBe(true)
    // sem o aviso de teto, sem o trecho "fora da soma"
    dobra('canal-proprio', modelo([privada], { privado: { estado: 'incluido', itens: 'views por dia' } }, 'canal-proprio'))
    const semAviso = await responder({ acao: 'serie', canal_id: C1, de: '2026-11-01', ate: '2026-11-03', grao: 'dia', saida: 'tabela' }, abrir, AGORA)
    expect(semAviso.texto).not.toContain('fora da soma')
  })

  it('a base do concorrente diz Shorts incluídos e horário de São Paulo', async () => {
    dobra('canal', modelo(tabela()))
    const r = await responder({ ...SEMANA, grao: 'dia', de: '2026-11-01', ate: '2026-11-03' }, abrir, AGORA)
    expect(r.texto).toContain('Shorts incluídos')
    expect(r.texto).toContain('horário de São Paulo')
  })

  it('corte por tamanho: acima de 400 dias o grão dia passa à semana, e ficam as semanas mais recentes em linhas inteiras', async () => {
    dobra('canal', modelo(tabela({ n: 90 })))
    const r = await responder({ acao: 'serie', canal_id: C1, de: '2025-01-01', ate: '2026-11-09', grao: 'dia', saida: 'tabela' }, abrir, AGORA)
    const csv = csvDe(r.texto)
    expect(csv[0].startsWith('semana_inicio')).toBe(true)
    expect(csv.length - 1).toBeLessThanOrEqual(400)
    expect(r.params.cortes).toBeGreaterThan(0)
  })

  it('o registro grava saida efetiva "tabela" e linhas/total do CSV', async () => {
    dobra('canal', modelo(tabela()))
    const r = await responder(SEMANA, abrir, AGORA)
    expect(r.params).toMatchObject({ saida: 'tabela', linhas: 5, total: 5, sem_x: 0 })
  })

  it('o modo texto da série não muda: sem saida, nenhuma linha de CSV', async () => {
    dobra('canal', modelo(tabela()))
    const r = await responder({ acao: 'serie', canal_id: C1, de: '2026-10-05', ate: '2026-11-08', grao: 'semana' }, abrir, AGORA)
    expect(r.texto).not.toContain('```csv')
    expect(r.texto).toContain('semana de 05/10/2026 (segunda a domingo)')
  })

  it('(i) modo texto: a soma da semana e a frase de semana incompleta são as de sempre', async () => {
    const t = tabela({ celula: (d) => (d === '2026-10-14' ? semReg() : d < '2026-10-03' ? semReg() : med(ganhoDe(d))) })
    dobra('canal', modelo(t))
    const r = await responder({ acao: 'serie', canal_id: C1, de: '2026-10-05', ate: '2026-10-18', grao: 'semana' }, abrir, AGORA)
    const soma = Array.from({ length: 7 }, (_, i) => ganhoDe(mais('2026-10-05', i))).reduce((a, b) => a + b, 0)
    expect(r.texto).toContain(String(soma))
    expect(r.texto).toContain('semana incompleta: 6 de 7 dias medidos')
  })
})

/* ------------------------------------------------------------------ item herdado da F0.5b: o responder lê Tabela.dias */

describe('responder lê Tabela.dias (modo texto)', () => {
  const SERIE = { acao: 'serie', canal_id: C1, de: '2026-11-01', ate: '2026-11-09' }
  const avisosDoSentry = (): string[] => m.captured.map((c) => String(c[0]))

  it('com dias: a data vem de dias, mesmo com rótulo que o texto não lê, e não há aviso dias_do_texto', async () => {
    dobra('canal', modelo(tabela({ rotuloDoDia: (d) => `D-${entre(d, HOJE)}` })))
    const r = await responder(SERIE, abrir, AGORA)
    expect(r.texto).toContain('D-1')
    expect(r.texto).not.toContain('sem data reconhecível')
    expect(avisosDoSentry().some((a) => a.includes('dias_do_texto'))).toBe(false)
  })

  it('sem dias (apagado): cai no diaDaLinha e avisa dias_do_texto com o id da tabela', async () => {
    const t = tabela()
    delete (t as { dias?: string[] }).dias
    dobra('canal', modelo({ ...t, linhas: t.linhas.map((l, i) => [rotulo(`${String(10 - i - 1).padStart(2, '0')}/11/2026`, `p.${i}`), l[1]!, l[2]!]) }))
    const r = await responder(SERIE, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    const achado = m.captured.find((c) => String(c[0]).includes('dias_do_texto'))
    expect(achado).toBeDefined()
    expect(JSON.stringify(achado)).toContain('canal-linha-do-tempo')
  })

  it('dias com tamanho diferente de linhas: não vale, avisa e usa o texto', async () => {
    const t = tabela({ n: 5, rotuloDoDia: (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` })
    dobra('canal', modelo({ ...t, dias: t.dias!.slice(0, 3) }))
    await responder(SERIE, abrir, AGORA)
    expect(avisosDoSentry().some((a) => a.includes('dias_do_texto'))).toBe(true)
  })

  it('tabela que nunca tem data (SEMANA_FECHADA) não avisa: é do desenho', async () => {
    const cedo = tabela({ id: 'privado-views-por-dia-cedo', semDias: true, n: 3, privada: true })
    dobra('canal', modelo(cedo, { privado: { estado: 'incluido', itens: 'x' } }))
    await responder(SERIE, abrir, AGORA)
    expect(avisosDoSentry().some((a) => a.includes('dias_do_texto'))).toBe(false)
  })
})
