// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import type { DiarioLinha } from '@/lib/youtube/observatorio/proprio/tipos'
import {
  MIN_VIEWS_PERIODO, pctDoVideoNoPeriodo, normalDoPeriodo, normalDaFaixaNoPeriodo, contraInteiro, normalSemLeitura,
} from '@/lib/youtube/observatorio/proprio/assistido-periodo'

const ULTIMO = addDays(dayPt(new Date()), -3)
const d = (n: number) => addDays(ULTIMO, -n)
const linha = (ytId: string, dia: string, pct: number | null, views: number | null = 300): DiarioLinha => ({
  ytId, dia, views, pctAssistido: pct, duracaoMediaSeg: null,
})
/** Um vídeo por percentual, uma linha cada, com 300 views, no dia `ha` dias antes do último. */
const umaLinhaCada = (pcts: number[], ha = 1, prefixo = 'v'): { linhas: DiarioLinha[]; ids: string[] } => {
  const ids = pcts.map((_, i) => `${prefixo}${i}`)
  return { linhas: pcts.map((p, i) => linha(ids[i]!, d(ha), p)), ids }
}

describe('pctDoVideoNoPeriodo', () => {
  it('média diária pesada pelas views, só no intervalo', () => {
    const ls = [linha('a', d(1), 50, 100), linha('a', d(2), 60, 300), linha('a', d(40), 10, 1000), linha('b', d(1), 99, 100)]
    const r = pctDoVideoNoPeriodo(ls, 'a', d(27), ULTIMO)
    expect(r.views).toBe(400)
    expect(r.pct).toBeCloseTo((50 * 100 + 60 * 300) / 400, 6)
  })
  it('dia com views e sem percentual não entra; sem nenhum dia, pct nulo (nunca 0)', () => {
    const r = pctDoVideoNoPeriodo([linha('a', d(1), null, 500)], 'a', d(27), ULTIMO)
    expect(r).toEqual({ pct: null, views: 0 })
  })
})

describe('normalDoPeriodo', () => {
  it('cobertura inteira: a mediana por vídeo, arredondada', () => {
    const { linhas, ids } = umaLinhaCada([45, 47, 47, 49, 51])
    const n = normalDoPeriodo(linhas, ids, '28', ULTIMO, 0)
    expect(n).toMatchObject({ periodo: '28', pct: 47, pctArredondado: 47, views: 1500, videos: 5, motivo: null })
    expect(n.ate).toBe(ULTIMO)
    expect(n.de).toBe(d(27))
  })
  it('a tabela "melhorando": 51 contra 47 = +4 acima; 52 contra 47 = +5; 54 contra 52 = +2 na média', () => {
    const inteiro = normalDoPeriodo(...args([45, 47, 47, 49, 51], 200))
    const n90 = normalDoPeriodo(...args([49, 50, 51, 52, 53], 60))
    const n28 = normalDoPeriodo(...args([50, 51, 52, 53, 54], 5))
    expect(inteiro.pctArredondado).toBe(47)
    expect(n90.pctArredondado).toBe(51)
    expect(n28.pctArredondado).toBe(52)
    expect(contraInteiro(n90, inteiro)).toEqual({ dif: 4, leitura: 'acima' })
    expect(contraInteiro(n28, inteiro)).toEqual({ dif: 5, leitura: 'acima' })
    const n28b = normalDoPeriodo(...args([52, 53, 54, 55, 56], 5))
    expect(n28b.pctArredondado).toBe(54)
    expect(contraInteiro(n28b, n28)).toEqual({ dif: 2, leitura: 'na-media' })
  })
  it('piorando (49, 46, 43) contra 47 e 52', () => {
    const inteiro = normalDoPeriodo(...args([45, 47, 47, 49, 51], 200))
    const n90 = normalDoPeriodo(...args([47, 48, 49, 50, 51], 60))
    const n28 = normalDoPeriodo(...args([41, 42, 43, 44, 45], 5))
    expect(contraInteiro(n90, inteiro)).toEqual({ dif: 2, leitura: 'na-media' })
    expect(contraInteiro(n28, inteiro)).toEqual({ dif: -4, leitura: 'abaixo' })
  })
  it('diferença calculada sobre os arredondados: 51,4 e 47,6 dão +3, não +4', () => {
    const a = normalDoPeriodo(...args([51.4, 51.4, 51.4, 51.4, 51.4], 5))
    const b = normalDoPeriodo(...args([47.6, 47.6, 47.6, 47.6, 47.6], 200))
    expect(a.pctArredondado).toBe(51)
    expect(b.pctArredondado).toBe(48)
    expect(contraInteiro(a, b)).toEqual({ dif: 3, leitura: 'acima' })
  })
  it('999 views: poucas; 1.000: compara (a constante é importada)', () => {
    expect(MIN_VIEWS_PERIODO).toBe(1000)
    const ids = ['a', 'b']
    const poucas = normalDoPeriodo([linha('a', d(1), 50, 500), linha('b', d(1), 60, MIN_VIEWS_PERIODO - 501)], ids, '28', ULTIMO, 0)
    expect(poucas).toMatchObject({ pct: null, pctArredondado: null, views: MIN_VIEWS_PERIODO - 1, motivo: 'poucas-views' })
    const compara = normalDoPeriodo([linha('a', d(1), 50, 500), linha('b', d(1), 60, 500)], ids, '28', ULTIMO, 0)
    expect(compara.motivo).toBeNull()
    expect(compara.pct).toBe(55)
  })
  it('340 views: cobertura inteira = poucas-views; com buraco = cobertura-parcial; cobertura desconhecida = cobertura-parcial', () => {
    const ls = [linha('a', d(1), 50, 340)]
    expect(normalDoPeriodo(ls, ['a'], '28', ULTIMO, 0).motivo).toBe('poucas-views')
    expect(normalDoPeriodo(ls, ['a'], '28', ULTIMO, 1).motivo).toBe('cobertura-parcial')
    expect(normalDoPeriodo(ls, ['a'], '28', ULTIMO, null).motivo).toBe('cobertura-parcial')
    expect(normalDoPeriodo(ls, ['a'], '28', ULTIMO, 1).pct).toBeNull()
  })
  it('1.200 views e um vídeo com buraco: compara (a cobertura só decide abaixo do corte)', () => {
    const { linhas, ids } = umaLinhaCada([40, 50, 60, 50])
    const n = normalDoPeriodo(linhas, ids, '28', ULTIMO, 1)
    expect(n.views).toBe(1200)
    expect(n.motivo).toBeNull()
    expect(n.pct).toBe(50)
  })
  it('a mediana é por vídeo, não a média pesada pelas views do canal', () => {
    const ls = [linha('a', d(1), 90, 10_000), linha('b', d(1), 40, 100), linha('c', d(1), 42, 100)]
    const n = normalDoPeriodo(ls, ['a', 'b', 'c'], '28', ULTIMO, 0)
    expect(n.pct).toBe(42)
    expect(n.pct).not.toBeCloseTo((90 * 10_000 + 40 * 100 + 42 * 100) / 10_200, 0)
  })
  it('diário vazio: sem-diario; ultimoDia nulo: sem-diario', () => {
    expect(normalDoPeriodo([], ['a'], '28', ULTIMO, 0).motivo).toBe('sem-diario')
    expect(normalDoPeriodo([linha('a', d(1), 50)], ['a'], '28', null, 0).motivo).toBe('sem-diario')
  })
  it('última linha de 20 dias atrás e ultimoDia de hoje - 3: a janela de 28 dias termina em hoje - 3', () => {
    const n = normalDoPeriodo([linha('a', d(20), 50, 2000)], ['a'], '28', ULTIMO, 0)
    expect(n.ate).toBe(ULTIMO)
    expect(n.de).toBe(addDays(ULTIMO, -27))
    expect(n.pct).toBe(50)
  })
  it('negado e erro de leitura têm o motivo e nenhum número', () => {
    expect(normalSemLeitura('90', 'sem-acesso')).toEqual({ periodo: '90', de: null, ate: null, pct: null, pctArredondado: null, views: 0, videos: 0, motivo: 'sem-acesso' })
    expect(normalSemLeitura('inteiro', 'leitura-falhou').motivo).toBe('leitura-falhou')
  })
  it('dia com views e sem percentual não entra; vídeo sem nenhum dia que entre não pesa na mediana', () => {
    const ls = [linha('a', d(1), 50, 1500), linha('b', d(1), null, 5000)]
    const n = normalDoPeriodo(ls, ['a', 'b'], '28', ULTIMO, 0)
    expect(n.videos).toBe(1)
    expect(n.views).toBe(1500)
    expect(n.pct).toBe(50)
  })
  it('dia fora da janela de 28 não entra; o inteiro pega todos', () => {
    const ls = [linha('a', d(40), 80, 3000), linha('a', d(1), 50, 3000)]
    expect(normalDoPeriodo(ls, ['a'], '28', ULTIMO, 0).pct).toBe(50)
    expect(normalDoPeriodo(ls, ['a'], '90', ULTIMO, 0).pct).toBe(65)
    const inteiro = normalDoPeriodo(ls, ['a'], 'inteiro', ULTIMO, 0)
    expect(inteiro.pct).toBe(65)
    expect(inteiro.de).toBe(d(40))
    expect(inteiro.ate).toBe(d(1))
  })
  it('contraInteiro sem número de um dos lados: nulo', () => {
    const ok = normalDoPeriodo(...args([50, 50, 50, 50, 50], 5))
    const sem = normalSemLeitura('28', 'sem-acesso')
    expect(contraInteiro(sem, ok)).toBeNull()
    expect(contraInteiro(ok, sem)).toBeNull()
  })
})

/** (linhas, ids, '28'|..., ultimo, 0) a partir de percentuais e de quantos dias atrás. */
function args(pcts: number[], ha: number): [DiarioLinha[], string[], '28' | '90' | 'inteiro', string, number] {
  const { linhas, ids } = umaLinhaCada(pcts, ha)
  const periodo = ha > 90 ? 'inteiro' : ha > 28 ? '90' : '28'
  return [linhas, ids, periodo, ULTIMO, 0]
}

describe('normalDaFaixaNoPeriodo', () => {
  const faixa = (pcts: number[], dur: number, prefixo: string) => {
    const { linhas, ids } = umaLinhaCada(pcts, 1, prefixo)
    return { linhas, videos: ids.map(ytId => ({ ytId, dur })) }
  }
  it('55 e 56 contra 52; 53 e 54 contra 47; 43 e 44 contra 41 (+2 na média e +3 acima)', () => {
    const a = faixa([53, 54, 55, 56, 57], 200, 'a')
    const b = faixa([54, 55, 56, 57, 58], 600, 'b')
    const c = faixa([41, 42, 43, 44, 45], 1200, 'c')
    const r = normalDaFaixaNoPeriodo([...a.linhas, ...b.linhas, ...c.linhas], [...a.videos, ...b.videos, ...c.videos], '28', ULTIMO, 0)
    expect(r.map(x => x.faixa)).toEqual(['ate-5', '5-a-15', 'acima-15'])
    expect(r.map(x => x.normal.pctArredondado)).toEqual([55, 56, 43])
    const ref = (x: number) => ({ ...r[0]!.normal, pctArredondado: x })
    expect(contraInteiro(r[0]!.normal, ref(52))).toEqual({ dif: 3, leitura: 'acima' })
    expect(contraInteiro(r[2]!.normal, ref(41))).toEqual({ dif: 2, leitura: 'na-media' })
  })
  it('faixa com menos de 5 vídeos: sem normal e sem motivo (quem lê vê videos < 5)', () => {
    const a = faixa([50, 50, 50, 50], 200, 'a')
    const r = normalDaFaixaNoPeriodo(a.linhas, a.videos, '28', ULTIMO, 0)
    expect(r[0]!.normal).toMatchObject({ pct: null, pctArredondado: null, videos: 4, motivo: null })
  })
  it('a regra das poucas views e da cobertura vale por faixa', () => {
    const a = faixa([50, 50, 50, 50, 50], 200, 'a')
    const so = a.linhas.map(l => ({ ...l, views: 100 }))
    expect(normalDaFaixaNoPeriodo(so, a.videos, '28', ULTIMO, 0)[0]!.normal.motivo).toBe('poucas-views')
    expect(normalDaFaixaNoPeriodo(so, a.videos, '28', ULTIMO, 2)[0]!.normal.motivo).toBe('cobertura-parcial')
  })
  it('vídeo sem duração não entra em nenhuma faixa', () => {
    const a = umaLinhaCada([50, 50, 50, 50, 50])
    const r = normalDaFaixaNoPeriodo(a.linhas, a.ids.map(ytId => ({ ytId, dur: null })), '28', ULTIMO, 0)
    expect(r.every(x => x.normal.videos === 0)).toBe(true)
  })
})
