// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { agruparMarcas, faixasDaSubida, modoDasLinhas, posicaoDaMudanca, raiaDoCampo } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/dias-model'

describe('E5a T20, dias', () => {
  it('faixa de 7 barras a partir da borda direita do dia da subida; 14 dias antes', () => {
    const f = faixasDaSubida('2026-10-10')
    expect(f.subida.dias).toHaveLength(7)
    expect(f.subida.dias[0]).toBe('2026-10-11')
    expect(f.antes.dias).toHaveLength(14)
    expect(f.antes.dias[13]).toBe('2026-10-09')
  })
  it('mais de 6 mudanças vira traço curto; marcas a menos de 26 px viram ×N', () => {
    expect(modoDasLinhas(6)).toBe('atravessa')
    expect(modoDasLinhas(14)).toBe('traco_curto')
    const g = agruparMarcas([{ x: 10, raia: 'title' as const }, { x: 20, raia: 'title' as const }, { x: 90, raia: 'title' as const }])
    expect(g).toHaveLength(2)
    expect(g[0]!.n).toBe(2)
    expect(g[0]!.rotulo).toBe('×2')
  })
  it('contagem parada vira divisa entre os dois dias; campos viram raias', () => {
    expect(posicaoDaMudanca({ dia: '2026-10-12', diaDe: '2026-10-10', precisao: 'parada', tardia: false })).toEqual({ tipo: 'divisa', depoisDe: '2026-10-10', antesDe: '2026-10-12' })
    expect(raiaDoCampo('titulo')).toBe('title')
    expect(raiaDoCampo('tags')).toBe('outras')
  })
})
