// @vitest-environment node
/** Regras do CSS novo da página do canal (restrições globais da A1): sem color-mix, sem z-index numérico, tudo sob a tela. */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const read = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe.each(['_canal/canal.css', '_chrome/trail-chrome.css'])('%s', f => {
  const css = read(f)
  it('nenhum color-mix e nenhum z-index numérico', () => {
    expect(css).not.toMatch(/color-mix\s*\(/)
    expect(css).not.toMatch(/z-index\s*:\s*-?\d/)
  })
  it('nenhum texto de corpo abaixo de 12 px', () => {
    const small = [...css.matchAll(/font(?:-size)?\s*:\s*(?:[^;}]*?\s)?(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1])).filter(n => n < 12 && n > 0)
    expect(small).toEqual([])
  })
})

describe('canal.css', () => {
  const css = read('_canal/canal.css')
  it('todo seletor fica sob [data-obs-screen="canal"], ou é uma flutuante em #flut', () => {
    const out: string[] = []
    const walk = (text: string) => {
      let i = 0
      while (i < text.length) {
        const o = text.indexOf('{', i)
        if (o < 0) break
        const prelude = text.slice(i, o).trim()
        let d = 1, j = o + 1
        while (j < text.length && d) { if (text[j] === '{') d++; else if (text[j] === '}') d--; j++ }
        const body = text.slice(o + 1, j - 1)
        if (prelude.startsWith('@media')) walk(body)
        else if (!prelude.startsWith('@')) {
          let depth = 0, cur = ''
          const parts: string[] = []
          for (const ch of prelude) { if (ch === '(') depth++; else if (ch === ')') depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += ch }
          parts.push(cur)
          for (const s of parts.map(x => x.trim())) if (!/^(\[data-theme="light"\] )?\[data-obs-screen="canal"\]/.test(s) && !s.startsWith('#flut ')) out.push(s)
        }
        i = j
      }
    }
    walk(css)
    expect(out).toEqual([])
  })
  it('o esqueleto só aparece depois de 100 ms, também com "reduzir movimento"', () => {
    expect(css).toMatch(/\.ld\{opacity:0;animation:obs-cn-ld 0s linear 100ms forwards\}/)
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\{\[data-obs-screen="canal"\] \.ld\{animation:obs-cn-ld 0s linear 100ms forwards!important\}/)
  })
  it('a faixa quebra em 3 colunas em 900 px e em 2 em 600 px', () => {
    expect(css).toContain('@media (max-width:900px)')
    expect(css).toMatch(/flex:0 0 33\.333%/)
    expect(css).toMatch(/flex:0 0 50%/)
  })
})
