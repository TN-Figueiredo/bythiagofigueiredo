// @vitest-environment node
// Guarda de CSS do visualizador de thumbnail: camada pela escala, sem color-mix, sem z-index numérico, corpo mínimo de 12 px.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const css = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_chrome/thumb-viewer/thumb-viewer.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('thumb-viewer.css', () => {
  it('o diálogo usa a camada --z-modal e nenhum z-index é numérico', () => {
    const z = [...css.matchAll(/z-index\s*:\s*([^;}]*)/g)].map(m => m[1].trim())
    expect(z).toEqual(['var(--z-modal)'])
  })
  it('sem color-mix()', () => { expect(css).not.toMatch(/color-mix\(/) })
  it('toda classe é .obs-tv-*', () => {
    const classes = [...css.matchAll(/\.([a-z][\w-]*)/g)].map(m => m[1]).filter(c => !/^\d/.test(c))
    for (const c of classes) expect(c, c).toMatch(/^obs-tv-?/)
  })
  it('nenhum corpo de texto abaixo de 12 px', () => {
    for (const m of css.matchAll(/font(?:-size)?\s*:\s*(?:[\w\s]*?)(\d+(?:\.\d+)?)px/g)) expect(Number(m[1]), m[0]).toBeGreaterThanOrEqual(12)
  })
  it('a região viva do status nunca some da árvore de acessibilidade: nada de :empty{display:none}; a altura de uma linha fica reservada', () => {
    expect(css).not.toMatch(/\.obs-tv-msg:empty/)
    expect(css).toMatch(/\.obs-tv-msg\s*\{[^}]*min-height\s*:/)
    // e nenhuma regra esconde a região (display:none, visibility:hidden) por qualquer via
    for (const m of css.matchAll(/([^{}]*\.obs-tv-msg[^{}]*)\{([^}]*)\}/g)) expect(m[2], m[1]).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden/)
  })
})

describe('thumb-viewer.css · 11b B1 (controles em cima, como o mockup)', () => {
  it('a caixa tem quatro faixas (título, barra, imagem, informação) e a barra é uma linha que quebra', () => {
    const box = /\.obs-tv-box\s*\{([^}]*)\}/.exec(css)![1]!
    expect(/grid-template-rows\s*:\s*([^;]*)/.exec(box)![1]!.trim()).toBe('auto auto minmax(0,1fr) auto')
    expect(css).toMatch(/\.obs-tv-tools\s*\{[^}]*display\s*:\s*flex[^}]*flex-wrap\s*:\s*wrap/)
  })
  it('não sobrou regra do rodapé antigo nem do empurrão do Comparar', () => {
    expect(css).not.toMatch(/\.obs-tv-foot/)
    expect(css).not.toMatch(/\.obs-tv-cmpbtn/)
    expect(css).not.toMatch(/\.obs-tv-nav/)
  })
  it('alvos de toque de 44 px em janela estreita e em toque grosseiro continuam valendo', () => {
    expect(css).toMatch(/@media \(max-width:900px\)\{[\s\S]*?\.obs-tv-b\{min-height:44px\}/)
    expect(css).toMatch(/@media \(pointer:coarse\)\{\.obs-tv-b\{min-height:44px\}/)
  })
})
