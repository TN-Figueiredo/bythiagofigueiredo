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
