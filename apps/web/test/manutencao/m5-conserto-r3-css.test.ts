// @vitest-environment node
// Manutenção M5, conserto r3 (27/10): as medidas de CSS que Naksu pediu (N3, N5, N7), lidas do arquivo.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const C = 'src/app/cms/(authed)/youtube/competitors'
const lê = (f: string): string => readFileSync(`${C}/${f}`, 'utf8')

describe('Naksu N3: o eixo do painel do banco', () => {
  const css = lê('_chrome/aviso-banco/aviso-banco.css')
  it('os rótulos do eixo não quebram ("1 ano") e têm 12 px', () => {
    expect(css).toMatch(/\.bl-ts span,\.bl-ax span\{white-space:nowrap\}/)
    expect(css).toMatch(/\.bl-ax\{[^}]*font:500 12px/)
    expect(css).toMatch(/\.bl-ts\{[^}]*font:500 12px/)
  })
  it('a linha de baixo (.bl-l2) fica abaixo do eixo, que termina em 63 px', () => { expect(css).toMatch(/\.bl-l2\{top:75px/) })
})
describe('Naksu N5: alvos', () => {
  it('a pastilha e a marca têm 36 px no desktop e 44 em toque ou celular', () => {
    const css = lê('_chrome/aviso-banco/aviso-banco.css')
    expect(css).toMatch(/\.bl-p\{[^}]*min-height:36px/)
    expect(css).toMatch(/\.bl-ch\{[^}]*min-height:36px/)
    expect(css).toMatch(/@media \(pointer:coarse\),\(max-width:640px\)\{\[data-obs\] \.bl-p,\[data-obs\] \.bl-ch\{min-height:44px\}\}/)
  })
  it('o botão do Arquivo e o da peça 7 sobem para 44 px em toque (tablet incluso)', () => {
    expect(lê('_arquivo/arquivo.css')).toMatch(/@media \(max-width:820px\),\(pointer:coarse\)\{\.arq-btn\{min-height:44px\}\}/)
    expect(lê('_canais/esperam-comandos.css')).toMatch(/@media \(pointer:coarse\)\{\.p7-sh \.btn,\.p7-ac>\.btn\{min-height:44px\}\}/)
  })
})
describe('Naksu N7: o traço entre etapas feitas', () => {
  it('usa --dim (3:1 ou mais), não --border-strong', () => {
    const css = lê('_arquivo/arquivo.css')
    expect(css).toMatch(/\.arq-et::before\{[^}]*border-top:2px solid var\(--dim\)/)
  })
})
