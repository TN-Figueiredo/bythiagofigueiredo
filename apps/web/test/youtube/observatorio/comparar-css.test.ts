// @vitest-environment node
/** A3 Tarefa 8: regras do CSS da tela de comparação (sem navegador): sem color-mix, sem z-index numérico, nenhum texto abaixo de 12 px, alvos de 44 px no toque. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CSS = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_comparar/comparar.css'), 'utf8')
const SEM_COMENTARIO = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

describe('comparar.css', () => {
  it('nenhum color-mix()', () => { expect(SEM_COMENTARIO).not.toMatch(/color-mix\s*\(/) })
  it('nenhum z-index numérico: só var(--z-*)', () => {
    for (const m of SEM_COMENTARIO.matchAll(/z-index\s*:\s*([^;}]+)/g)) expect(m[1]!.trim(), m[0]).toMatch(/^var\(--z-[a-z-]+\)$/)
  })
  it('nenhum texto abaixo de 12 px', () => {
    const tam = [...SEM_COMENTARIO.matchAll(/font-size\s*:\s*([\d.]+)px/g)].map(m => Number(m[1]))
    const atalho = [...SEM_COMENTARIO.matchAll(/font\s*:\s*[\w ]*?(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1]))
    for (const n of [...tam, ...atalho]) expect(n).toBeGreaterThanOrEqual(12)
    expect(tam.length + atalho.length).toBeGreaterThan(5)
  })
  it('alvos de 44 px sob pointer:coarse: seletor, botão de inverter, ⓘ e links', () => {
    const blocos = [...SEM_COMENTARIO.matchAll(/@media\s*\(pointer:\s*coarse\)\s*\{([\s\S]*?)\n\}/g)].map(m => m[1]!).join('\n')
    expect(blocos).toBeTruthy()
    for (const seletor of ['select', '.cp-swap', '.ibtn', '.cp-open a']) expect(blocos, seletor).toContain(seletor)
    expect(blocos).toMatch(/44px/)
  })
  it('a tela não usa --success nem --danger: nenhum verde nem vermelho de veredito', () => {
    expect(SEM_COMENTARIO).not.toMatch(/--success|--danger|--ok-subtle|--danger-subtle|#22c55e|#ef4444/i)
  })
  it('a tabela vira pilha com rótulo abaixo de 820 px, e a página não rola na horizontal', () => {
    expect(SEM_COMENTARIO).toMatch(/@media\s*\(max-width:\s*820px\)/)
    expect(SEM_COMENTARIO).toMatch(/overflow-wrap:\s*anywhere/)
  })
  it('todas as regras ficam sob [data-obs-screen="comparar"] (ou #flut, para a dica flutuante)', () => {
    const regras = SEM_COMENTARIO.replace(/@media[^{]*\{/g, '').split('}').map(r => r.split('{')[0]!.trim()).filter(s => s && !s.startsWith('@'))
    for (const sel of regras) for (const parte of sel.split(',')) expect(parte.trim(), parte).toMatch(/^(\[data-theme="light"\] )?(\[data-obs-screen="comparar"\]|#flut)/)
  })
  it('as cores dos lados entram pela variável --c (o chip e o sublinhado de 3 px do cabeçalho)', () => {
    expect(SEM_COMENTARIO).toMatch(/border-bottom:\s*3px solid var\(--c\)/)
    expect(SEM_COMENTARIO).toMatch(/color:\s*var\(--on-lado\)/)
  })

  it('T9: o botão apagado da forja é tracejado, em --muted, e o hover não muda nada (spec 17.4); alvo de 44 px no toque', () => {
    const regra = SEM_COMENTARIO.match(/\.cp-fj-btn,\[data-obs-screen="comparar"\] \.cp-fj-btn:hover\{([^}]*)\}/)
    expect(regra, 'regra do botão e do :hover juntas').not.toBeNull()
    expect(regra![1]).toMatch(/border:1px dashed/); expect(regra![1]).toMatch(/color:var\(--muted\)/); expect(regra![1]).toMatch(/cursor:default/)
    expect(SEM_COMENTARIO).toMatch(/@media \(pointer:coarse\)\{[^@]*\.cp-fj-btn\{min-height:44px/)
  })
  it('T9: as colunas dos mais vistos e as faixas de publicação empilham abaixo de 820 px', () => {
    const bloco = SEM_COMENTARIO.match(/@media \(max-width:820px\)\{\s*\[data-obs-screen="comparar"\] \.cp-vids\{([^}]*)\}[\s\S]*?\n\}/)
    expect(bloco, 'media de 820 px dos blocos novos').not.toBeNull()
    expect(bloco![1]).toContain('grid-template-columns:minmax(0,1fr)')
    expect(bloco![0]).toMatch(/\.cp-pr\{grid-template-columns:minmax\(0,1fr\)/)
  })
  it('T9: o traço de formato não confirmado tem outra forma (tracejado), não só outra cor', () => {
    expect(SEM_COMENTARIO).toMatch(/\.cp-strip \.t\.nc\{[^}]*border:1px dashed var\(--c\)/)
    const alturas = [...SEM_COMENTARIO.matchAll(/\.cp-strip \.t\.(lg|sh|nc)\{height:(\d+)px/g)].map(m => `${m[1]}:${m[2]}`)
    expect(new Set(alturas.map(a => a.split(':')[1])).size).toBe(3)
  })

  it('o rótulo do lado na célula (.cp-lb) só aparece na pilha de 820 px, com a cor do lado e o corpo de 12 px; na tabela larga some', () => {
    expect(SEM_COMENTARIO).toMatch(/\.cp-lb\{display:none\}/)
    const media = SEM_COMENTARIO.match(/@media \(max-width:820px\)\{([\s\S]*?)\n\}\n@media \(max-width:640px\)/)
    expect(media, 'media de 820 px da tabela').not.toBeNull()
    const regra = media![1]!.match(/\.cp-t td \.cp-lb\{([^}]*)\}/)
    expect(regra, 'regra do rótulo na pilha').not.toBeNull()
    expect(regra![1]).toMatch(/display:inline-flex/); expect(regra![1]).toMatch(/background:var\(--c\)/); expect(regra![1]).toMatch(/color:var\(--on-lado\)/)
    expect(regra![1]).toMatch(/font:600 12px/)
  })
  it('44 px sob pointer:coarse: cada alvo tem a medida na PRÓPRIA regra (não basta 44px aparecer em qualquer lugar do bloco)', () => {
    const blocos = [...SEM_COMENTARIO.matchAll(/@media\s*\(pointer:\s*coarse\)\s*\{([\s\S]*?)\n\}/g)].map(m => m[1]!).join('\n')
    for (const [seletor, prop] of [['.sel select', 'height'], ['.cp-swap', 'min-height'], ['.ibtn', 'width'], ['.ibtn', 'height'], ['.cp-open a', 'min-height'], ['.cp-fj-btn', 'min-height']] as const) {
      const regra = blocos.split('\n').find(l => l.includes(seletor + '{'))
      expect(regra, seletor).toBeTruthy()
      expect(regra!, `${seletor} ${prop}`).toMatch(new RegExp(`${prop}:44px`))
    }
  })
  it('o laço de z-index não é vácuo: a regex enxerga uma ocorrência conhecida', () => {
    expect([...'a{z-index:var(--z-marca)}'.matchAll(/z-index\s*:\s*([^;}]+)/g)]).toHaveLength(1)
  })
})
