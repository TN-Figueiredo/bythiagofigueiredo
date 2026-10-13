// @vitest-environment node
// Taxa de clique com intervalo de Wilson (95%) e o veredito contra a taxa do canal. Funções puras, sem banco.
import { describe, it, expect } from 'vitest'
import {
  wilson, taxaComIntervalo, veredito, canalLargo,
  Z_95, FOLGA_QUASE_SE_TOCAM, LARGURA_SEM_REFERENCIA, FATOR_LARGURA_INCONCLUSIVA, LARGURA_CANAL_LARGO,
  type TaxaComIntervalo,
} from '@/lib/youtube/observatorio/proprio/taxa'

/** Uma taxa já com intervalo, montada à mão para o veredito (lo e hi escolhidos; taxa no meio). */
const faixa = (lo: number, hi: number): TaxaComIntervalo => ({ cliques: 0, imp: 1000, taxa: (lo + hi) / 2, lo, hi, largura: hi - lo })

describe('constantes do brief', () => {
  it('95% de confiança (z = 1,96); folga de 0,4 ponto; 3x a largura do canal; 15 pontos sem referência; 5 pontos no canal', () => {
    expect(Z_95).toBe(1.96)
    expect(FOLGA_QUASE_SE_TOCAM).toBe(0.004)
    expect(FATOR_LARGURA_INCONCLUSIVA).toBe(3)
    expect(LARGURA_SEM_REFERENCIA).toBe(0.15)
    expect(LARGURA_CANAL_LARGO).toBe(0.05)
  })
})

describe('wilson', () => {
  it('n = 0: null, nunca NaN (não há taxa de zero impressões)', () => {
    expect(wilson(0, 0)).toBeNull()
    expect(wilson(5, 0)).toBeNull()
  })
  it('k = 0: o limite de baixo é exatamente 0 e o de cima é z²/(n+z²)', () => {
    const w = wilson(0, 10)!
    expect(w.lo).toBe(0)
    expect(w.hi).toBeCloseTo(0.2775401687666165, 12)
    expect(w.hi).toBeCloseTo((1.96 ** 2) / (10 + 1.96 ** 2), 12)
  })
  it('k = n: o limite de cima é exatamente 1 e o de baixo é n/(n+z²)', () => {
    const w = wilson(10, 10)!
    expect(w.hi).toBe(1)
    expect(w.lo).toBeCloseTo(0.7224598312333834, 12)
    expect(w.lo).toBeCloseTo(10 / (10 + 1.96 ** 2), 12)
  })
  it('1 de 1 e 0 de 1: nunca sai de [0, 1]', () => {
    expect(wilson(1, 1)!.hi).toBe(1)
    expect(wilson(1, 1)!.lo).toBeCloseTo(0.20654329147389294, 12)
    expect(wilson(0, 1)!.lo).toBe(0)
    expect(wilson(0, 1)!.hi).toBeCloseTo(0.7934567085261071, 12)
  })
  it('valor conhecido do mockup magro: 2 cliques em 18 impressões = 3,1% a 32,8%', () => {
    const w = wilson(2, 18)!
    expect(w.lo).toBeCloseTo(0.0310189, 6)
    expect(w.hi).toBeCloseTo(0.3280024, 6)
    expect((w.lo * 100).toFixed(1)).toBe('3.1')
    expect((w.hi * 100).toFixed(1)).toBe('32.8')
  })
  it('valor conhecido do canal: 3.036 de 61.023 = 4,8% a 5,2%', () => {
    const w = wilson(3036, 61023)!
    expect(w.lo).toBeCloseTo(0.0480547, 6)
    expect(w.hi).toBeCloseTo(0.0515054, 6)
    expect((w.lo * 100).toFixed(1)).toBe('4.8')
    expect((w.hi * 100).toFixed(1)).toBe('5.2')
  })
  it('o intervalo estreita com o volume e sempre contém a taxa observada', () => {
    const pequeno = wilson(5, 100)!, grande = wilson(500, 10000)!
    expect(grande.hi - grande.lo).toBeLessThan(pequeno.hi - pequeno.lo)
    expect(pequeno.lo).toBeLessThan(0.05)
    expect(pequeno.hi).toBeGreaterThan(0.05)
  })
  it('cliques estimados não são inteiros (impressões x taxa de cada dia): k fracionário vale', () => {
    const w = wilson(2.5, 18)!
    expect(w.lo).toBeGreaterThan(wilson(2, 18)!.lo)
    expect(w.hi).toBeGreaterThan(wilson(2, 18)!.hi)
  })
  it('entrada impossível vira null: k > n, k negativo, n negativo, NaN, infinito', () => {
    expect(wilson(11, 10)).toBeNull()
    expect(wilson(-1, 10)).toBeNull()
    expect(wilson(1, -10)).toBeNull()
    expect(wilson(Number.NaN, 10)).toBeNull()
    expect(wilson(1, Number.NaN)).toBeNull()
    expect(wilson(1, Infinity)).toBeNull()
    expect(wilson(Infinity, Infinity)).toBeNull()
  })
  it('excesso de ponto flutuante em k (a soma de estimativas passa de n por um fio) é aparado, não vira null', () => {
    expect(wilson(10 + 1e-12, 10)).toEqual(wilson(10, 10))
  })
})

describe('taxaComIntervalo', () => {
  it('cliques e impressões: taxa, limites e largura', () => {
    const t = taxaComIntervalo(2, 18)!
    expect(t.taxa).toBeCloseTo(2 / 18, 12)
    expect(t.cliques).toBe(2)
    expect(t.imp).toBe(18)
    expect(t.lo).toBeCloseTo(0.0310189, 6)
    expect(t.hi).toBeCloseTo(0.3280024, 6)
    expect(t.largura).toBeCloseTo(t.hi - t.lo, 12)
  })
  it('sem impressão (0 ou nula) ou sem cliques (nulo): null, nunca 0%', () => {
    expect(taxaComIntervalo(0, 0)).toBeNull()
    expect(taxaComIntervalo(5, 0)).toBeNull()
    expect(taxaComIntervalo(5, null)).toBeNull()
    expect(taxaComIntervalo(null, 100)).toBeNull()
    expect(taxaComIntervalo(null, null)).toBeNull()
  })
  it('zero clique com impressões é ZERO MEDIDO: taxa 0 com intervalo, não null', () => {
    const t = taxaComIntervalo(0, 200)!
    expect(t.taxa).toBe(0)
    expect(t.lo).toBe(0)
    expect(t.hi).toBeGreaterThan(0)
  })
})

describe('veredito', () => {
  const canal = faixa(0.048, 0.052) // largura 0,4 ponto
  it('faixa do vídeo toda acima da do canal: acima', () => {
    expect(veredito(faixa(0.06, 0.07), canal)).toMatchObject({ direcao: 'acima', quaseSeTocam: false, inconclusivo: false })
  })
  it('faixa do vídeo toda abaixo da do canal: abaixo', () => {
    expect(veredito(faixa(0.03, 0.04), canal)).toMatchObject({ direcao: 'abaixo', quaseSeTocam: false, inconclusivo: false })
  })
  it('faixas que se cruzam ou se tocam: igual', () => {
    expect(veredito(faixa(0.045, 0.055), canal).direcao).toBe('igual')
    expect(veredito(faixa(0.052, 0.06), canal).direcao).toBe('igual') // tocar não é separar
    expect(veredito(faixa(0.04, 0.048), canal).direcao).toBe('igual')
  })
  it('folga menor que 0,4 ponto entre as faixas: quaseSeTocam; a partir de 0,4: não', () => {
    // canal.hi = 0,052; video.lo = 0,055 -> folga 0,3 ponto
    expect(veredito(faixa(0.055, 0.07), canal)).toMatchObject({ direcao: 'acima', quaseSeTocam: true })
    // folga exata de 0,4 ponto não é "quase": o limite é estrito
    expect(veredito(faixa(0.056, 0.07), canal).quaseSeTocam).toBe(false)
    // abaixo: canal.lo = 0,048; video.hi = 0,046 -> folga 0,2 ponto
    expect(veredito(faixa(0.03, 0.046), canal)).toMatchObject({ direcao: 'abaixo', quaseSeTocam: true })
    expect(veredito(faixa(0.03, 0.043), canal).quaseSeTocam).toBe(false)
  })
  it('quaseSeTocam é falso quando a direção é igual (as faixas já se cruzam)', () => {
    expect(veredito(faixa(0.049, 0.06), canal).quaseSeTocam).toBe(false)
  })
  it('com referência: inconclusivo quando a largura do vídeo passa de 3x a do canal (estrito)', () => {
    // canal 0,4 ponto -> limite 1,2 ponto
    expect(veredito(faixa(0.0, 0.0125), canal).inconclusivo).toBe(true)
    expect(veredito(faixa(0.0, 0.0115), canal).inconclusivo).toBe(false)
    const c2 = faixa(0, 0.04) // largura 0,04 -> limite 0,12
    expect(veredito(faixa(0, 0.12), c2).inconclusivo).toBe(false) // exatamente 3x não passa
    expect(veredito(faixa(0, 0.1201), c2).inconclusivo).toBe(true)
  })
  it('o caso magro do mockup (2 de 18 contra o canal de 3.036 de 61.023): igual e inconclusivo', () => {
    const v = veredito(taxaComIntervalo(2, 18)!, taxaComIntervalo(3036, 61023)!)
    expect(v).toEqual({ direcao: 'igual', quaseSeTocam: false, inconclusivo: true })
  })
  it('sem referência (o canal não tem taxa): sem direção e inconclusivo só se a largura passa de 15 pontos', () => {
    expect(veredito(faixa(0, 0.15), null)).toEqual({ direcao: null, quaseSeTocam: false, inconclusivo: false })
    expect(veredito(faixa(0, 0.1501), null)).toEqual({ direcao: null, quaseSeTocam: false, inconclusivo: true })
    expect(veredito(taxaComIntervalo(2, 18)!, null).inconclusivo).toBe(true) // 29,7 pontos
    expect(veredito(taxaComIntervalo(3036, 61023)!, null).inconclusivo).toBe(false)
  })
})

describe('canalLargo', () => {
  it('largura acima de 5 pontos pede "Ainda não dá para dizer se é alta ou baixa."; exatamente 5 não', () => {
    expect(canalLargo(faixa(0, 0.05))).toBe(false)
    expect(canalLargo(faixa(0, 0.0501))).toBe(true)
    expect(canalLargo(taxaComIntervalo(2, 18)!)).toBe(true)
    expect(canalLargo(taxaComIntervalo(3036, 61023)!)).toBe(false)
  })
})
