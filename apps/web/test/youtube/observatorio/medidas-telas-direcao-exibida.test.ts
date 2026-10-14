// @vitest-environment node
// apps/web/test/youtube/observatorio/medidas-telas-direcao-exibida.test.ts
// E5a Tarefa 1: a direção exibida, uma regra para as três telas (classifica sobre o inteiro que a tela escreve).
import { describe, it, expect } from 'vitest'
import { direcaoExibida, pctDosGanhos, posicaoNaRegua, posicoesDeCompeticao } from '@/lib/youtube/observatorio/medidas-telas/direcao-exibida'

describe('direção exibida (E5a T1)', () => {
  it('9,68% aparece +10% e sobe; 9,4% aparece +9% e é estável', () => {
    expect(direcaoExibida(0.0968)).toEqual({ pct: 10, simbolo: 'sobe', texto: '+10%' })
    expect(direcaoExibida(0.094)).toEqual({ pct: 9, simbolo: 'estavel', texto: '+9%' })
  })
  it('−9,5% aparece −10% e desce; −9,4% é estável', () => {
    expect(pctDosGanhos(905, 1000)).toBe(-10)
    expect(direcaoExibida(-0.095).simbolo).toBe('desce')
    expect(pctDosGanhos(1095, 1000)).toBe(10)
    expect(direcaoExibida(-0.094)).toEqual({ pct: -9, simbolo: 'estavel', texto: '−9%' })
  })
  it('o arredondamento não depende da representação do número', () => {
    expect(direcaoExibida(0.0951).pct).toBe(10)
    expect(direcaoExibida(-0.0951).pct).toBe(-10)
    expect(direcaoExibida(0.0949).pct).toBe(9)
    expect(direcaoExibida(-0.0949).pct).toBe(-9)
    expect(direcaoExibida(0.095).pct).toBe(10)
    expect(direcaoExibida(0.145).pct).toBe(15)
  })
  it('−0,1% aparece 0% e estável, sem sinal', () => {
    for (const v of [-0.001, 0.001]) {
      const d = direcaoExibida(v)
      expect(Object.is(d.pct, 0)).toBe(true)
      expect(d.texto).toBe('0%'); expect(d.simbolo).toBe('estavel')
    }
  })
  it('pctDosGanhos recusa base zero em vez de inventar número', () => {
    expect(() => pctDosGanhos(10, 0)).toThrow()
  })
  it('fora da escala encosta na ponta e guarda o valor', () => {
    const acima = posicaoNaRegua(217, 60), abaixo = posicaoNaRegua(-63, 60)
    expect(acima.foraDaEscala).toBe('acima'); expect(acima.fracao).toBeCloseTo(0.95, 10)
    expect(abaixo.foraDaEscala).toBe('abaixo'); expect(abaixo.fracao).toBeCloseTo(0.05, 10)
    expect(posicaoNaRegua(0, 50)).toEqual({ fracao: 0.5, foraDaEscala: null })
    expect(posicaoNaRegua(50, 50).foraDaEscala).toBeNull()
  })
  it('com o valor exato, −49,8% fica dentro da escala e −50,4% fica fora, e sem ele nada muda', () => {
    expect(posicaoNaRegua(-50, 50, -0.498).foraDaEscala).toBeNull()
    expect(posicaoNaRegua(-50, 50, -0.504).foraDaEscala).toBe('abaixo')
    expect(posicaoNaRegua(-50, 50)).toEqual(posicaoNaRegua(-50, 50, undefined))
    expect(posicaoNaRegua(-50, 50).foraDaEscala).toBeNull()
  })
  it('empate de competição: três em +24 são 2º e o seguinte é 5º', () => {
    expect(posicoesDeCompeticao([40, 24, 24, 24, 3])).toEqual([1, 2, 2, 2, 5])
    expect(posicoesDeCompeticao([])).toEqual([])
  })
})
