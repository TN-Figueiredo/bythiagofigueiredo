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

describe('E5a T20, bloco de idade, fronteira', () => {
  const m = (valor: number, n = 5) => ({ estado: 'medido' as const, valor, n, janela: { de: null, ate: null, dias: null }, notas: [] })
  const ponto = (idadeDias: number, valor: number) => ({ idadeDias, ponto: m(valor) })
  const normal = (n: number) => ({
    estado: 'medido' as const, valor: [1, 7, 30].map((idadeDias) => ({ idadeDias, ponto: m(1000 * idadeDias, n), relativoAV30: m(1) })), n, janela: { de: null, ate: null, dias: null }, notas: [],
  })
  const poucos = {
    estado: 'medido' as const, valor: [1, 7, 30].map((idadeDias) => ({ idadeDias, ponto: { estado: 'nao_medido' as const, motivo: 'poucos_videos' as const, n: 2, minimo: 3, notas: [] }, relativoAV30: m(1) })), n: 2, janela: { de: null, ate: null, dias: null }, notas: [],
  }
  const base = { hojeSP: '2026-10-16', inicioDaContagem: '2026-10-03', publicadoEm: '2026-09-01', aoVivo: false, saiuDoYoutube: false, horasAteEntrar: 1 }
  const IDADES = [1, 2, 3, 5, 7, 14, 21, 30, 60, 90]
  it('ok: a razão escrita e a largura das duas barras de um par têm a razão dos valores', () => {
    const b = blocoDeIdade({ ...base, pontos: IDADES.map((i) => ponto(i, 2800 * (i === 1 ? 1 : 0) + 1000 * i)), normal: normal(14) })
    expect(b.tipo).toBe('ok')
    if (b.tipo !== 'ok') return
    const par = b.pares.find((p) => p.idade === 7)!
    expect(par.estado).toBe('ok')
    expect(par.razao?.texto).toMatch(/o normal|perto do normal/)
    if (par.normal?.tipo === 'medido' && par.video) {
      expect(par.video.fracao / par.normal.fracao).toBeCloseTo(par.video.views / par.normal.views, 6)
    }
  })
  it('normal com 2 vídeos: não medido, e o ponto do vídeo continua', () => {
    const b = blocoDeIdade({ ...base, pontos: IDADES.map((i) => ponto(i, 100)), normal: poucos })
    if (b.tipo !== 'ok') throw new Error(b.tipo)
    const p = b.pontos.find((x) => x.idade === 7)!
    expect(p.video.tipo).toBe('medido')
    expect(p.normal.tipo).toBe('nao_medido')
    expect(p.razao).toBeNull()
  })
  it('normal com 0 vídeos: "nenhum vídeo chegou a esta idade", nunca "só 0"', () => {
    const b = blocoDeIdade({ ...base, pontos: IDADES.map((i) => ponto(i, 100)), normal: null })
    if (b.tipo !== 'ok') throw new Error(b.tipo)
    const p = b.pontos[0]!
    expect(p.normal.tipo === 'nao_medido' && p.normal.frase).toContain('nenhum vídeo chegou a esta idade')
    expect(JSON.stringify(b)).not.toContain('só 0')
  })
  it('valor zero não escreve razão e a barra fica sem o piso de 4 px', () => {
    const b = blocoDeIdade({ ...base, pontos: IDADES.map((i) => ponto(i, i === 1 ? 0 : 100)), normal: normal(14) })
    if (b.tipo !== 'ok') throw new Error(b.tipo)
    const par = b.pares.find((p) => p.idade === 1)!
    expect(par.razao).toBeNull()
    expect(par.video?.zero).toBe(true)
  })
  it('coerência: a célula da faixa e o ponto do gráfico leem o mesmo número', () => {
    const b = blocoDeIdade({ ...base, pontos: IDADES.map((i) => ponto(i, 777 + i)), normal: normal(14) })
    if (b.tipo !== 'ok') throw new Error(b.tipo)
    for (const c of celulasDaFaixa(b)) {
      const p = b.pontos.find((x) => x.idade === c.idade)!
      expect(c.views).toBe(p.video.tipo === 'medido' ? p.video.views : null)
    }
  })
})
