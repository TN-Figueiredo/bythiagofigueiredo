// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { abrev, dm, larguraDaBarra, milhar } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/formatos'
import { blocoDeIdade, celulasDaFaixa } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/idade-model'

describe('E5a T20, formatos e bloco de idade', () => {
  it('números grandes por extenso, sem "mi"', () => {
    expect(abrev(1_020_000)).toBe('1,02 milhão')
    expect(abrev(2_400_000)).toBe('2,4 milhões')
    expect(abrev(94_300)).toBe('94,3 mil')
    expect(abrev(120_000)).toBe('120 mil')
    expect(milhar(1234)).toBe('1.234')
    expect(dm('2026-10-03')).toBe('03/10')
  })
  it('largura proporcional, com 4 px só para valor maior que zero', () => {
    expect(larguraDaBarra(0, 100, 200)).toBe(0)
    expect(larguraDaBarra(1, 100000, 200)).toBe(4)
    expect(larguraDaBarra(100, 100, 200)).toBe(200)
    expect(larguraDaBarra(50, 100, 200)).toBe(100)
  })
  it('dado ausente: pontos nulos viram "não carregou", nunca zero', () => {
    const b = blocoDeIdade({ hojeSP: '2026-10-16', inicioDaContagem: '2026-10-03', publicadoEm: '2026-10-10', aoVivo: false, saiuDoYoutube: false, horasAteEntrar: 1, pontos: null, normal: null })
    expect(b.tipo).toBe('nao_carregou')
    const c = celulasDaFaixa(b)
    expect(c.length).toBeGreaterThan(0)
  })
})
