// A5 E5a, Tarefa 14b: contas de apresentação que as páginas do canal e do vídeo dividem.
import { describe, expect, it } from 'vitest'
import { progresso } from '@/lib/youtube/observatorio/medidas-telas/progresso'
import { ganhosPorDia } from '@/lib/youtube/observatorio/medidas-telas/ganho-por-dia'
import { faixaDeLancamento, razaoEscrita, normalSem } from '@/lib/youtube/observatorio/medidas-telas/faixa-do-normal'
import { linhaDeCorteNaJanela, subidaFechaEm } from '@/lib/youtube/observatorio/medidas-telas/calendario-das-paginas'
import { somaDias } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { direcaoDoCanalInteiro, type RetratoDoCanal } from '@/lib/youtube/observatorio/medidas/direcao'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import type { VideoComSerie } from '@/lib/youtube/observatorio/medidas/curva'
import type { MarcaLida } from '@/lib/youtube/observatorio/medidas/m1'

const HOJE = '2026-10-14'

describe('E5a T14b: progresso', () => {
  it('sem data devolve nulo (a tela escreve o motivo sem barra e sem data)', () => {
    expect(progresso(112, null, HOJE)).toBeNull()
  })
  it('50 de 112 a 62 dias da data; no dia, 112 de 112', () => {
    expect(progresso(112, somaDias(HOJE, 62), HOJE)).toEqual({ feitos: 50, total: 112, fechaEm: somaDias(HOJE, 62) })
    expect(progresso(112, HOJE, HOJE)?.feitos).toBe(112)
  })
  it('nunca sai de 0 a total', () => {
    expect(progresso(56, somaDias(HOJE, 400), HOJE)?.feitos).toBe(0)
    expect(progresso(56, somaDias(HOJE, -3), HOJE)?.feitos).toBe(56)
  })
})

describe('E5a T14b: ganho por dia', () => {
  const dias = (n: number, f: (k: number) => number | null): RetratoDoCanal[] => Array.from({ length: n }, (_, k) => ({ dia: somaDias(HOJE, -(n - 1 - k)), views: f(k) }))
  it('nenhum retrato: todo dia é sem_registro, nenhum é zero', () => {
    const g = ganhosPorDia([], somaDias(HOJE, -9), HOJE)
    expect(g.length).toBe(10)
    expect(g.every((x) => x.tipo === 'sem_registro')).toBe(true)
  })
  it('view_count nulo e dia que falta: sem_registro no dia e no seguinte', () => {
    const r = dias(10, (k) => (k === 4 ? null : 1000 + k * 10))
    const g = ganhosPorDia(r, r[0]!.dia, HOJE)
    expect(g[4]!.tipo).toBe('sem_registro')
    expect(g[5]!.tipo).toBe('sem_registro')
    expect(g[6]).toEqual({ dia: r[6]!.dia, tipo: 'medido', ganho: 10 })
  })
  it('dia com o total menor que o da véspera é diminuiu, nunca ganho negativo; zero é medido', () => {
    const g = ganhosPorDia([{ dia: '2026-10-12', views: 100 }, { dia: '2026-10-13', views: 90 }, { dia: '2026-10-14', views: 90 }], '2026-10-13', '2026-10-14')
    expect(g).toEqual([{ dia: '2026-10-13', tipo: 'diminuiu' }, { dia: '2026-10-14', tipo: 'medido', ganho: 0 }])
  })
  it('a soma dos 28 últimos ganhos é igual ao ganhoRecente de M3(a) quando os 28 dias têm registro', () => {
    const r = dias(90, (k) => 1_000_000 + 4000 * k + 10 * k * k)
    const m = direcaoDoCanalInteiro(r, HOJE)
    expect(m.estado).toBe('medido')
    const g = ganhosPorDia(r, somaDias(HOJE, -27), HOJE)
    const soma = g.reduce((s, x) => s + (x.tipo === 'medido' ? x.ganho : 0), 0)
    expect(soma).toBe(m.estado === 'medido' ? m.valor.ganhoRecente : -1)
  })
})

describe('E5a T14b: faixa do normal', () => {
  it('razão exatamente 2 é muito acima; 1,5 é acima; dois terços é perto', () => {
    expect(faixaDeLancamento(2)).toBe('muito_acima')
    expect(faixaDeLancamento(1.5)).toBe('acima')
    expect(faixaDeLancamento(1.4999)).toBe('perto')
    expect(faixaDeLancamento(2 / 3)).toBe('perto')
    expect(faixaDeLancamento(0.66)).toBe('abaixo')
  })
  it('razão dentro de 10% é "perto do normal" com o sinal de igual; fora dela, vezes o normal', () => {
    expect(razaoEscrita(1090, 1000)).toEqual({ texto: '＝ perto do normal', igual: true })
    expect(razaoEscrita(1100, 1000).igual).toBe(true)
    expect(razaoEscrita(1101, 1000).igual).toBe(false)
    expect(razaoEscrita(2800, 1000).texto).toBe('2,8 vezes o normal')
    expect(razaoEscrita(1500, 1000).texto).toBe('1,5 vez o normal')
    expect(razaoEscrita(500, 1000).texto).toBe('0,5 vez o normal, abaixo')
  })
  it('normal zero não tem razão', () => {
    expect(razaoEscrita(10, 0)).toEqual({ texto: 'sem normal para comparar', igual: false })
  })
  it('o limiar de igual é o da E4', () => {
    const lim = MEASURE_RULES.equalPct
    expect(razaoEscrita(1000 * (1 + lim), 1000).igual).toBe(true)
  })
  it('normalSem tira o próprio vídeo da conta do normal', () => {
    const base = Date.UTC(2026, 8, 1)
    const D = 864e5
    const marca = (views: number): MarcaLida => ({ views, likes: null, comments: null, likesHidden: null, readBeforeAt: base + D, readAfterAt: base + D + 3_600_000, ageBaseAt: base })
    const v = (id: string, views: number): VideoComSerie & { id: string } => ({
      id, formato: 'long', publicadoEm: base, baseMs: base, wasLive: false, agendadoOuNoAr: false,
      marcas: { 1: marca(views) }, faltas: {},
    })
    const todos = [v('a', 100), v('b', 200), v('c', 300), v('d', 10_000)]
    const agoraMs = base + 20 * D
    const com = normalSem(todos, 'zzz', { formato: 'long', agoraMs })
    const sem = normalSem(todos, 'd', { formato: 'long', agoraMs })
    const ponto1 = (m: typeof com) => (m.estado === 'medido' ? m.valor.find((p) => p.idadeDias === 1)!.ponto : null)
    const pCom = ponto1(com), pSem = ponto1(sem)
    expect(pCom?.estado === 'medido' && pCom.n).toBe(4)
    expect(pSem?.estado === 'medido' && pSem.valor).toBe(200)
    expect(pSem?.estado === 'medido' && pSem.n).toBe(3)
    // sem dois vídeos, o ponto cai abaixo de 3 vídeos: não medido, nunca um número com base fraca
    const dois = normalSem(todos.filter((x) => x.id !== 'a'), 'c', { formato: 'long', agoraMs })
    expect(dois.estado).toBe('nao_medido')
  })
})

describe('E5a T14b: calendário das páginas', () => {
  it('a subida fecha 15 dias depois do primeiro dia de contagem, contando hoje', () => {
    expect(subidaFechaEm(1, HOJE)).toBe(somaDias(HOJE, 14))
    expect(subidaFechaEm(15, HOJE)).toBe(HOJE)
    expect(subidaFechaEm(40, HOJE)).toBe(HOJE)
    expect(subidaFechaEm(0, HOJE)).toBe(somaDias(HOJE, 15))
  })
  it('a linha de 24/08 aparece com a data na janela e some no primeiro dia em que sai', () => {
    expect(linhaDeCorteNaJanela('2026-08-20', '2026-09-01')).toBe('2026-08-24')
    expect(linhaDeCorteNaJanela('2026-08-24', '2026-09-01')).toBe('2026-08-24')
    expect(linhaDeCorteNaJanela('2026-08-25', '2026-09-01')).toBeNull()
    expect(linhaDeCorteNaJanela('2026-07-01', '2026-08-23')).toBeNull()
  })
})
