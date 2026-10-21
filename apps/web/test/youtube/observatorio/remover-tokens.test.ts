// @vitest-environment node
/** F2 do Remover canal, T1: o vermelho do escuro vem de tokens (--dg-*, --toast-*), nunca de um #B42318 solto. */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const ler = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const CHROME = ler('_chrome/chrome.css'), CANAIS = ler('_canais/canais.css'), KIT = ler('_chrome/kit.css')

/** O corpo da primeira regra cujo seletor é exatamente `sel`. */
function corpo(src: string, sel: string): string {
  const re = new RegExp('(^|\\})\\s*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'm')
  const m = re.exec(src)
  if (!m) throw new Error('regra não encontrada: ' + sel)
  return m[2]!.replace(/\s+/g, '')
}

const ESCURO = ['--dg-bg:#432A27', '--dg-bg-hover:#53332F', '--dg-line:#F26B6B', '--dg-fg:#FFB9B3', '--toast-bg:#2D1B19', '--toast-line:#F26B6B']
const CLARO = ['--dg-bg:#B42318', '--dg-bg-hover:#9A1D14', '--dg-line:#B42318', '--dg-fg:#FFFFFF', '--toast-bg:#FDF0EE', '--toast-line:#B42318']

describe('F2 · tokens do vermelho', () => {
  it('T1.1 chrome.css declara os 6 tokens nos dois temas', () => {
    const esc = corpo(CHROME, '[data-obs]'), cla = corpo(CHROME, '[data-theme="light"] [data-obs]')
    for (const t of ESCURO) expect(esc).toContain(t)
    for (const t of CLARO) expect(cla).toContain(t)
  })
  it.each([['canais', CANAIS, '[data-obs-screen="canais"]'], ['kit', KIT, '[data-obs-screen="canal"]']])('T1.2 %s: .btn.danger usa os tokens', (_n, src, esc) => {
    expect(corpo(src, esc + ' .btn.danger')).toBe('background:var(--dg-bg);border-color:var(--dg-line);color:var(--dg-fg)')
    expect(corpo(src, esc + ' .btn.danger:hover')).toContain('background:var(--dg-bg-hover)')
    expect(src).not.toMatch(/\.btn\.danger[^{]*\{[^}]*#B42318/i)
  })
  it.each([['canais', CANAIS, '[data-obs-screen="canais"]'], ['kit', KIT, '[data-obs-screen="canal"]']])('T1.3 %s: danger desabilitado mantém o vermelho e vem depois da regra genérica', (_n, src, esc) => {
    const sel = esc + ' .btn.danger[aria-disabled="true"]'
    const i = src.indexOf(sel), g = src.indexOf(esc + ' .modal .btn[aria-disabled="true"]')
    expect(i).toBeGreaterThan(-1)
    expect(g).toBeGreaterThan(-1)
    expect(i).toBeGreaterThan(g)
    const b = corpo(src, src.slice(src.lastIndexOf('}', i) + 1, src.indexOf('{', i)).trim())
    for (const d of ['border-color:var(--dg-line)', 'color:var(--dg-fg)', 'background:transparent', 'border-style:dashed', 'opacity:.8']) expect(b).toContain(d)
  })
  it('T1.4 o toast bad usa os tokens do toast', () => {
    const b = corpo(CHROME, '[data-obs] .obs-ch-toast.obs-ch-bad')
    expect(b).toContain('background:var(--toast-bg)')
    expect(b).toContain('border-color:var(--toast-line)')
  })
  it('T1.5 nenhum dos três usa color-mix', () => {
    for (const s of [CHROME, CANAIS, KIT]) expect(s).not.toMatch(/color-mix\s*\(/)
  })
})

describe('I2: botão bloqueado no claro', () => {
  it('o bloqueado usa o vermelho de texto do tema claro (contraste), em kit.css e canais.css', async () => {
    const { readFileSync } = await import('node:fs')
    const dir = 'src/app/cms/(authed)/youtube/competitors/'
    for (const [f, scr] of [['_chrome/kit.css', 'canal'], ['_canais/canais.css', 'canais']]) {
      expect(readFileSync(dir + f, 'utf8')).toContain(`[data-theme="light"] [data-obs-screen="${scr}"] .btn.danger[aria-disabled="true"]{--dg-fg:var(--danger-text)}`)
    }
  })
})
