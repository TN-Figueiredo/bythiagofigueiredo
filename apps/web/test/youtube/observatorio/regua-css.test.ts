// @vitest-environment node
/** Tarefa 7 (A3): regras do CSS novo da régua do nicho + o tema claro das cores dos lados (contraste calculado). */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')
const read = (f: string) => semComentario(fs.readFileSync(path.join(DIR, f), 'utf8'))

describe('regua.css', () => {
  const css = read('_chrome/regua/regua.css')
  it('nenhum color-mix e nenhum z-index numérico (só var(--z-*))', () => {
    expect(css).not.toMatch(/color-mix\s*\(/)
    expect(css).not.toMatch(/z-index\s*:\s*-?\d/)
    const z = [...css.matchAll(/z-index\s*:\s*([^;}]*)/g)].map(m => m[1]!.trim())
    expect(z.length).toBeGreaterThan(0)
    for (const v of z) expect(v).toMatch(/^var\(--z-[a-z-]+\)$/)
  })
  it('nenhum texto abaixo de 12 px', () => {
    const decl = [...css.matchAll(/font(?:-size)?\s*:\s*([^;}]*)/g)].map(m => m[1]!)
    expect(decl.length).toBeGreaterThan(0)
    const small = decl.flatMap(d => [...d.matchAll(/(?:^|\s)(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1]))).filter(n => n > 0 && n < 12)
    expect(small).toEqual([])
  })
  it('sem animação: nenhuma transition nem animation na régua', () => {
    expect(css).not.toMatch(/transition/)
    expect(css).not.toMatch(/animation|@keyframes/)
  })
  it('toda classe é do prefixo próprio obs-rg- (ou o selo de "não medido" do kit)', () => {
    const classes = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]!))
    expect(classes.size).toBeGreaterThan(5)
    for (const c of classes) expect(c, c).toMatch(/^(obs-rg(-|$)|obs-fl-|obs-ch-nm$)/)
  })
  it('a dica é de #flut: nenhuma regra da dica fica sob a célula', () => {
    expect(css).toMatch(/#flut \.obs-fl-tip\.obs-rg-tip/)
  })
  it('o texto escrito só para leitor de tela existe e está escondido sem display:none', () => {
    const r = css.match(/\.obs-rg-sr\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(r).toMatch(/position\s*:\s*absolute/)
    expect(r).not.toMatch(/display\s*:\s*none/)
  })
  it('a letra do lado usa o texto escuro/claro do token --on-lado', () => {
    expect(css).toMatch(/\.obs-rg-ch\s*\{[^}]*color\s*:\s*var\(--on-lado\)/)
  })
})

describe('cores dos lados no tema claro (WCAG, calculado)', () => {
  const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! }
  const contraste = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05) }
  const claro = (css: string) => css.match(/\[data-theme="light"\] \[data-obs\]\{([^}]*)\}/g) ?? []
  const token = (blocos: string[], nome: string) => {
    for (const b of blocos) { const m = b.match(new RegExp('--' + nome + ':(#[0-9A-Fa-f]{6})')); if (m) return m[1]! }
    throw new Error('token claro ausente: --' + nome)
  }
  const escuro = (css: string, nome: string) => { const m = css.match(new RegExp('\\[data-obs\\]\\{[^}]*--' + nome + ':(#[0-9A-Fa-f]{6})')); if (!m) throw new Error('token escuro ausente: --' + nome); return m[1]! }
  const tokens = read('_chrome/tokens-telas.css')
  const chrome = read('_chrome/chrome.css')
  const surfaceClaro = token(claro(chrome), 'surface'), surfaceEscuro = escuro(chrome, 'surface')
  const lados = ['lado-o', 'lado-b', 'lado-n'] as const

  it('o tema escuro mantém os valores do spec e ganha --on-lado', () => {
    expect(escuro(tokens, 'lado-o')).toBe('#FF8240'); expect(escuro(tokens, 'lado-b')).toBe('#7CC8F8'); expect(escuro(tokens, 'lado-n')).toBe('#D9C08F')
    expect(escuro(tokens, 'on-lado')).toBe('#16130F')
  })
  for (const l of lados) {
    it(`--${l} no tema claro: traço sobre --surface >= 3 (não-texto) e letra sobre a cor >= 4,5`, () => {
      const cor = token(claro(tokens), l), on = token(claro(tokens), 'on-lado')
      expect(contraste(cor, surfaceClaro), 'traço').toBeGreaterThanOrEqual(3)
      expect(contraste(on, cor), 'letra').toBeGreaterThanOrEqual(4.5)
    })
    it(`--${l} no tema escuro: traço >= 3 e letra >= 4,5 (conferência do que o spec calculou)`, () => {
      const cor = escuro(tokens, l), on = escuro(tokens, 'on-lado')
      expect(contraste(cor, surfaceEscuro), 'traço').toBeGreaterThanOrEqual(3)
      expect(contraste(on, cor), 'letra').toBeGreaterThanOrEqual(4.5)
    })
  }
  it('no tema claro os dois lados mais usados (laranja e azul) são cores diferentes das do escuro', () => {
    expect(token(claro(tokens), 'lado-o')).not.toBe('#FF8240')
    expect(token(claro(tokens), 'lado-b')).not.toBe('#7CC8F8')
  })
  it('o traço dos canais sem destaque (--dim) passa de 3:1 nos dois temas', () => {
    expect(contraste(escuro(chrome, 'dim'), surfaceEscuro)).toBeGreaterThanOrEqual(3)
    expect(contraste(token(claro(chrome), 'dim'), surfaceClaro)).toBeGreaterThanOrEqual(3)
  })
})
