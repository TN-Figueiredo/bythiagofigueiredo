// @vitest-environment node
/**
 * Onda de consertos de UX da A4 (revisão de 12/10): o quadradinho de "não medido" volta à hachura do mockup (B1, contraste calculado nos dois
 * temas), o zero medido tem forma própria (B2) e a linha de números do cartão não deixa um valor colar no outro (C1).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')
const read = (f: string) => semComentario(fs.readFileSync(path.join(DIR, f), 'utf8'))
const MOCKUP = path.resolve(__dirname, '../../../../../.superpowers/sdd/2026-10-12-telas-a4-canal-proprio-plan/mockup-congelado-12-10/a4.css')

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contraste = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05) }

const tokens = read('_chrome/tokens-telas.css')
const escuro = (n: string) => tokens.match(new RegExp('\\[data-obs\\]\\{[^}]*--' + n + ':(#[0-9A-Fa-f]{6})'))![1]!
const claro = (n: string) => tokens.match(new RegExp('\\[data-theme="light"\\] \\[data-obs\\]\\{[^}]*--' + n + ':(#[0-9A-Fa-f]{6})'))![1]!

/** As regras do tokens-telas.css cujo seletor contém `trecho`. */
const regras = (css: string, trecho: string) => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(m => m[1]!.includes(trecho)).map(m => ({ sel: m[1]!.trim(), corpo: m[2]! }))

describe('B1: o quadradinho de "não medido" tem a hachura do mockup (listra de 2 px na cor cheia)', () => {
  const FORMA = 'repeating-linear-gradient(135deg,var(--nm) 0 2px,var(--nm-bg) 2px 5px)'.replace(/\s/g, '')
  const QUADRADOS = ['.nm-q', '.so-nm', '.lr-s.nmk .obs-ch-nm', '.ic-sw.nm']

  it('o mockup congelado usa exatamente esta hachura em .nm-h (a fonte dos valores)', () => {
    const m = fs.readFileSync(MOCKUP, 'utf8').match(/\.nm-h\{[^}]*\}/)![0].replace(/\s/g, '')
    expect(m).toContain(FORMA)
  })

  it.each(QUADRADOS)('%s recebe a hachura forte, no tema escuro e no claro (a regra do tema claro não a desfaz)', sel => {
    const r = regras(tokens, sel)
    const escuras = r.filter(x => !x.sel.includes('data-theme'))
    const claras = r.filter(x => x.sel.includes('data-theme="light"'))
    expect(escuras.length, 'regra escura de ' + sel).toBeGreaterThan(0)
    expect(claras.length, 'regra clara de ' + sel).toBeGreaterThan(0)
    for (const x of [...escuras, ...claras]) expect(x.corpo.replace(/\s/g, '')).toContain(FORMA)
  })

  it('a hachura usa só tokens (--nm, --nm-bg) e nenhuma delas é color-mix ou rgba fraco', () => {
    expect(tokens).not.toMatch(/color-mix\s*\(/)
    for (const x of QUADRADOS.flatMap(s => regras(tokens, s))) expect(x.corpo).not.toMatch(/rgba\(/)
  })

  it('contraste da listra (--nm) contra o fundo (--nm-bg): pelo menos 3:1 nos DOIS temas (mockup: 7,76:1; implementado antes: 1,15:1)', () => {
    const e = contraste(escuro('nm'), escuro('nm-bg'))
    const c = contraste(claro('nm'), claro('nm-bg'))
    expect(e).toBeGreaterThanOrEqual(3)
    expect(c).toBeGreaterThanOrEqual(3)
    // calculado dos tokens (a revisão mediu 7,76:1 por pixel, com suavização): 6,77:1 no escuro e acima de 3:1 no claro
    expect(e).toBeCloseTo(6.77, 1)
    // a listra FRACA antiga (rgba .14 sobre --nm-bg) ficava em 1,15:1: é o que não pode voltar
    expect(contraste('#4A3041', escuro('nm-bg'))).toBeLessThan(1.3)
  })

  it('o tamanho e a borda do quadrado seguem o mockup: 14 px, borda de --nm-line', () => {
    expect(read('_proprio/proprio.css')).toMatch(/\.nm-q\{[^}]*width:14px;height:14px/)
    expect(read('_comparar/comparar.css')).toMatch(/\.so-nm\{[^}]*width:14px;height:14px/)
    for (const x of QUADRADOS.flatMap(s => regras(tokens, s))) expect(x.corpo).toMatch(/border:1px solid var\(--nm-line\)/)
  })
})

describe('B2: zero medido tem a sua forma (caixa vazada), distinta da hachura de "não medido"', () => {
  it('.obs-ch-zero: contorno em --im-zero, sem fundo hachurado, e o tema claro escurece o token', () => {
    const r = regras(tokens, '.obs-ch-zero')
    expect(r.length).toBeGreaterThan(0)
    const corpo = r.map(x => x.corpo).join(';')
    expect(corpo).toMatch(/border:1\.5px solid var\(--im-zero\)/)
    expect(corpo).not.toMatch(/gradient/)
    // contraste do contorno contra a superfície do cartão (>= 3:1 nos dois temas)
    expect(contraste(escuro('im-zero'), '#221E1A')).toBeGreaterThanOrEqual(3)
    expect(contraste(claro('im-zero'), '#FBF7F0')).toBeGreaterThanOrEqual(3)
  })
})

describe('C1: a linha de números do cartão do canal próprio não deixa um valor colar no outro', () => {
  const css = read('_proprio/proprio.css')
  const regra = css.match(/\[data-own="1"\] \.cv-nums3\{([^}]*)\}/)?.[1] ?? ''
  it('quebra de linha entre as colunas em vez de colunas fixas apertadas, com vão de pelo menos 8 px', () => {
    expect(regra).toMatch(/display:flex/)
    expect(regra).toMatch(/flex-wrap:wrap/)
    const gap = regra.match(/gap:\s*(?:\d+(?:px)?\s+)?(\d+)px/)
    expect(gap, 'gap da linha de números').not.toBeNull()
    expect(Number(gap![1])).toBeGreaterThanOrEqual(8)
  })
  it('números e rótulos não quebram por dentro (nowrap) e a pastilha não é mais um bloco de duas linhas', () => {
    expect(css).toMatch(/\.cv-nums3 \.cv-c\{[^}]*white-space:nowrap/)
    expect(css).not.toMatch(/\.cv-nums3 \.cv-c\.nd \.obs-ch-nm\{white-space:normal\}/)
  })
})
