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

const fioCss = readFileSync(join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_chrome/comentarios/fio.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('T2 · CSS do fio único', () => {
  it('sem color-mix(), sem z-index numérico, nenhuma fonte abaixo de 12px', () => {
    expect(fioCss).not.toMatch(/color-mix\(/)
    expect(fioCss).not.toMatch(/z-index:\s*-?\d/)
    for (const m of fioCss.matchAll(/font-size:\s*([\d.]+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
    for (const m of fioCss.matchAll(/font:\s*[\d ]*?(\d+(?:\.\d+)?)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
  })
  it('o token do criador existe nos dois temas e o link tem 44px', () => {
    expect(fioCss).toMatch(/--cf-criador:var\(--lado-b\)/)
    expect(fioCss).toMatch(/--cf-criador-bg:rgba\(124,200,248,\.10\)/)
    expect(fioCss).toMatch(/\[data-theme="light"\] \[data-obs\]\{--cf-criador-bg:rgba\(11,107,168,\.08\)/)
    expect(fioCss).toMatch(/\.cf-link\{min-height:44px/)
  })
})
