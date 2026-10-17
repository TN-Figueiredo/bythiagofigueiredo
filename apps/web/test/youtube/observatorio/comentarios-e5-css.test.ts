// @vitest-environment node
// Gio C5, defeito A: a seção de comentários de destaque tem regra própria de título e de ⓘ (as de .ibtn das outras telas são escopadas).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_chrome/comentarios/comentarios.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('C5 · CSS da seção de comentários de destaque', () => {
  it('o título tem regra com peso acima de 400', () => {
    expect(css).toMatch(/\.cd-secao \.cd-titulo\{[^}]*font:600 /)
  })
  it('o ⓘ mede 24 px no desktop e 44 px no toque e a 390', () => {
    expect(css).toMatch(/\.cd-secao \.ibtn\{width:24px;height:24px/)
    expect(css).toMatch(/pointer:coarse\),\(max-width:900px\)\{[^}]*\.cd-secao \.ibtn\{width:44px;height:44px/)
  })
  it('sem color-mix() nem z-index numérico', () => {
    expect(css).not.toMatch(/color-mix\(/)
    expect(css).not.toMatch(/z-index:\s*-?\d/)
  })
})
