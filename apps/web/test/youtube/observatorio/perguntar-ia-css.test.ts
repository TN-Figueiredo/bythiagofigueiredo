// @vitest-environment node
/** G-2/G-3 (Gio, portão N3): o diálogo mora fora de [data-obs-screen]; o CSS dele traz o próprio ícone de 16 px e o ⓘ de 24/44 px. */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const css = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_chrome/perguntar-ia/perguntar-ia.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('perguntar-ia.css', () => {
  it('svg.i do diálogo: 16 px, traço, sem preenchimento', () => {
    const m = css.match(/\.pi-dlg svg\.i\s*\{([^}]*)\}/)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/width:16px/)
    expect(m![1]).toMatch(/height:16px/)
    expect(m![1]).toMatch(/fill:none/)
    expect(m![1]).toMatch(/stroke:currentColor/)
  })
  it('ⓘ do diálogo: 24 px, 44 px em pointer:coarse', () => {
    expect(css).toMatch(/\.pi-ibtn\s*\{[^}]*width:24px;height:24px/)
    expect(css).toMatch(/@media \(pointer:coarse\)\{[^}]*\.pi-ibtn\{width:44px;height:44px/)
  })
  it('botões do diálogo têm altura própria (não dependem da tela)', () => {
    expect(css).toMatch(/\.pi-dlg \.btn\s*\{[^}]*min-height:40px/)
  })
  it('M1 (Yannis 17/10): o painel do ⓘ não é inerte (o clique não atravessa) e o botão aberto fica acima dele', () => {
    const pop = css.match(/\.pi-pop\s*\{([^}]*)\}/)
    expect(pop).not.toBeNull()
    expect(pop![1]).not.toMatch(/pointer-events\s*:\s*none/)
    expect(css).toMatch(/\.pi-dlg \.ibtn\[aria-expanded="true"\]\s*\{[^}]*position:relative;z-index:var\(--z-conteudo\)/)
  })
})
