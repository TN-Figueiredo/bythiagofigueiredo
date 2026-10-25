// @vitest-environment node
/** Decisão 75, Task 1: regras do CSS das pastilhas + contrastes calculados. */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')
const read = (f: string) => semComentario(fs.readFileSync(path.join(DIR, f), 'utf8'))
const css = read('_chrome/ausencia/ausencia.css')
const tokens = read('_chrome/tokens-telas.css')
const chrome = read('_chrome/tokens-obs.css')

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const lum = (c: number[]) => { const [r, g, b] = c.map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! }
const contraste = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05) }
const composto = (rgba: string, fundo: number[]) => { const m = rgba.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/)!; const a = Number(m[4]); return [1, 2, 3].map((i, k) => Math.round(Number(m[i]) * a + fundo[k]! * (1 - a))) }

const bloco = (src: string, claro: boolean) => {
  const re = claro ? /\[data-theme="light"\] \[data-obs\]\{([^}]*)\}/g : /(?<!\] )\[data-obs\]\{([^}]*)\}/g
  return [...src.matchAll(re)].map(m => m[1]!).join(';')
}
const tok = (b: string, nome: string) => { const m = b.match(new RegExp('--' + nome + ':(#[0-9A-Fa-f]{6})')); if (!m) throw new Error('token ausente: --' + nome); return m[1]! }
const tokRgba = (b: string, nome: string) => { const m = b.match(new RegExp('--' + nome + ':(rgba\\([^)]*\\))')); if (!m) throw new Error('token ausente: --' + nome); return m[1]! }

describe('ausencia.css', () => {
  it('sem color-mix', () => expect(css).not.toMatch(/color-mix\s*\(/))
  it('nenhum texto abaixo de 12 px', () => {
    const decl = [...css.matchAll(/font(?:-size)?\s*:\s*([^;}]*)/g)].map(m => m[1]!)
    expect(decl.length).toBeGreaterThan(0)
    const small = decl.flatMap(d => [...d.matchAll(/(?:^|\s)(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1]))).filter(n => n > 0 && n < 12)
    expect(small).toEqual([])
  })
  it('.obs-au-retry tem min-height:44px', () => {
    expect(css.match(/\.obs-au-retry\s*\{([^}]*)\}/)?.[1]).toMatch(/min-height\s*:\s*44px/)
  })
})

describe('tokens --res-* e contrastes (calculados)', () => {
  const nomes = ['res-bg', 'res-line', 'res-ink']
  for (const claro of [false, true]) {
    const tema = claro ? 'claro' : 'escuro'
    it(`${tema}: os três --res-* existem e os contrastes valem`, () => {
      const t = bloco(tokens, claro), c = bloco(chrome, claro)
      for (const n of nomes) expect(() => tok(t, n)).not.toThrow()
      const surface = rgb(tok(c, 'surface'))
      expect(contraste(rgb(tok(t, 'res-line')), surface)).toBeGreaterThanOrEqual(3)
      expect(contraste(rgb(tok(t, 'res-ink')), rgb(tok(t, 'res-bg')))).toBeGreaterThanOrEqual(4.5)
      const fundoFalhou = composto(tokRgba(c, 'danger-subtle'), surface)
      expect(contraste(rgb(tok(c, 'danger')), fundoFalhou)).toBeGreaterThanOrEqual(3)
    })
  }
})
