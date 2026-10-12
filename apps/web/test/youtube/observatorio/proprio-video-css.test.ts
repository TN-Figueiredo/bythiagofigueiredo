// @vitest-environment node
// A4 13.4: regras de CSS da tela do vídeo que dá para provar sem navegador (a medida real de 390 px e do toque é do fecho, 13.5/15b):
// nenhum color-mix() em cor com significado, nenhum z-index numérico, nenhum texto abaixo de 12 px, alvo de 44 px em pointer:coarse nos controles
// novos, e a tabela das réguas virando cartões abaixo de 760 px (nenhuma largura fixa sobrevive ao tamanho de um celular).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_proprio')
const ARQUIVOS = ['reguas.css', 'video-blocos.css'] as const
const css = (f: string) => readFileSync(join(DIR, f), 'utf8')
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')

describe('13.4 CSS dos blocos do vídeo', () => {
  for (const f of ARQUIVOS) {
    const c = semComentarios(css(f))
    it(`${f}: nenhum color-mix() nem z-index numérico`, () => {
      expect(c).not.toMatch(/color-mix\(/)
      expect(c).not.toMatch(/z-index:\s*-?\d/)
    })
    it(`${f}: nenhum texto abaixo de 12 px`, () => {
      const tamanhos = [...c.matchAll(/font-size:\s*([\d.]+)px/g)].map(m => Number(m[1]))
        .concat([...c.matchAll(/font:\s*(?:[a-z]+\s+)?(?:\d{3}\s+)?([\d.]+)px/g)].map(m => Number(m[1])))
      expect(tamanhos.length).toBeGreaterThan(0)
      expect(Math.min(...tamanhos)).toBeGreaterThanOrEqual(12)
    })
  }

  it('toque (pointer:coarse): o ⓘ, o botão da forja e o link da posição ganham 44 px', () => {
    const b = semComentarios(css('video-blocos.css')), r = semComentarios(css('reguas.css'))
    expect(b).toMatch(/pointer:coarse\)\{[^}]*\.vb-info\{width:44px;height:44px/)
    expect(b).toMatch(/pointer:coarse\)\{[^}]*\.vb-forja-btn\{min-height:44px/)
    expect(r).toMatch(/pointer:coarse\)\{[\s\S]*\.vb-rg-p a\{[^}]*min-height:44px/)
  })

  it('abaixo de 760 px a tabela das réguas vira cartões: as larguras fixas das colunas são anuladas e a régua ocupa a linha toda', () => {
    const r = semComentarios(css('reguas.css'))
    const m = r.match(/@media \(max-width:760px\)\{([\s\S]*?)\n\}/)
    expect(m).not.toBeNull()
    const q = m![1]!
    expect(q).toMatch(/\.vb-rg-tb tr\{?[^}]*display:block|\.vb-rg-tb,\.vb-rg-tb tbody,\.vb-rg-tb tr,\.vb-rg-tb th,\.vb-rg-tb td\{display:block;width:auto\}/)
    expect(q).toMatch(/\.vb-rg-nm\{width:auto/)
    expect(q).toMatch(/\.vb-rg-v\{width:auto/)
    expect(q).toMatch(/\.vb-rg-p\{[^}]*width:auto/)
    expect(q).toMatch(/\.vb-rg-c\{grid-column:1\/3/)
  })

  it('a cor de direção só aparece nas classes de direção do % assistido, nunca na taxa de clique', () => {
    const b = semComentarios(css('video-blocos.css'))
    const usos = [...b.matchAll(/([^{}]+)\{[^}]*var\(--dir-(?:up|dn|eq)\)/g)].map(m => m[1]!.trim())
    expect(usos.length).toBe(3)
    for (const u of usos) expect(u).toMatch(/\.vb-dir-/)
    expect(b).not.toMatch(/\.vb-ctr[^{]*\{[^}]*var\(--dir-/)
  })
})
