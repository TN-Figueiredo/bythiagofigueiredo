// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { Lancamentos } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/lancamentos'
import type { ModeloDeLancamentos } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/lancamentos-model'

afterEach(cleanup)

/** Gio T15-1: o texto do SVG nao escala com a largura (tamanho fixo em px de tela, >= 12) e o rotulo do eixo cabe na margem. */
const modelo: ModeloDeLancamentos = {
  tipo: 'curvas', soShorts: false, frase: null, temNormal: true, temCasaSemPonto: false, melhorN: null,
  escala: { ymax: 25000, rotulos: ['0', '12,5 mil', '25 mil'] },
  normal: [1, 2, 3, 5, 7, 14, 21, 30].map(a => ({ idadeDias: a, valor: 100 + a, n: 5 })),
  videos: [{
    id: 'v0', ordem: 1, titulo: 'T', legenda: 'l', faixa: 'perto', faixaNome: 'perto do normal', razao: '1× no dia 7', ultima: { dia: 7, razao: 1 },
    curva: [{ idadeDias: 1, views: 100 }, { idadeDias: 7, views: 300 }], passou: null, frase: { negrito: 'a', resto: 'b' },
  }],
}

describe('graficos do canal: texto de tamanho fixo', () => {
  it('o svg tem width/height em px iguais ao viewBox (nada de 100%)', () => {
    render(<Lancamentos modelo={modelo} horas={null} />)
    const svg = document.querySelector('svg.pc-svg')!
    const [, , w, h] = svg.getAttribute('viewBox')!.split(' ')
    expect(svg.getAttribute('width')).toBe(w)
    expect(svg.getAttribute('height')).toBe(h)
  })
  it('o rotulo mais largo do eixo y cabe na margem esquerda (12 px mono ~ 7,3 px por caractere)', () => {
    render(<Lancamentos modelo={modelo} horas={null} />)
    const eixo = [...document.querySelectorAll('svg.pc-svg text.ic-ax')].filter(t => t.getAttribute('text-anchor') === 'end' && t.textContent !== 'dias desde a publicação')
    expect(eixo.length).toBeGreaterThan(0)
    for (const t of eixo) expect(t.textContent!.length * 7.3).toBeLessThanOrEqual(Number(t.getAttribute('x')))
  })
  it('o CSS do svg nao o encolhe nem o estica (max-width:none) e todo texto do SVG tem >= 12 px', () => {
    const css = readFileSync('src/app/cms/(authed)/youtube/competitors/_canal/medidas/canal-medidas.css', 'utf8')
    expect(css).toMatch(/\.pc-svg\{[^}]*max-width:none/)
    for (const m of css.matchAll(/\.(ic-ax|pc-idx|pc-pint|pc-hbt|pc-nmt)\{font:\d+ (\d+)px/g)) expect(Number(m[2])).toBeGreaterThanOrEqual(12)
  })
})

describe('"n = k" das celulas do canal (Gio T15-3)', () => {
  it('o <small> da celula tem regra propria de >= 12 px (o padrao do navegador da 11,2 px)', () => {
    const css = readFileSync('src/app/cms/(authed)/youtube/competitors/_canal/medidas/canal-medidas.css', 'utf8')
    expect(css).toMatch(/\.pc-cel dd\.v small\{font-size:12px/)
  })
})

describe('textos sem promessa de acao que a tela nao tem (Gio T15-4)', () => {
  const ler = (p: string): string => readFileSync(p, 'utf8')
  it('frase do topo e frase das horas nao mandam "tente de novo"', () => {
    expect(ler('src/app/cms/(authed)/youtube/competitors/_canal/medidas/frase-do-topo.ts')).not.toMatch(/tente de novo/)
    expect(ler('src/lib/youtube/observatorio/medidas-telas/frases-das-horas.ts')).not.toMatch(/tente de novo/)
  })
})
