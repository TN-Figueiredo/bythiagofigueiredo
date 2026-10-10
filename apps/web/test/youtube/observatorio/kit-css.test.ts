// @vitest-environment node
/** O kit promovido (spec de telas, seção 2 "Reuso exige promoção"; plano da A0, D4): cada classe obs-ch-* tem as mesmas
 *  declarações da classe de tela de onde veio. Quem mudar uma sem a outra quebra aqui.
 *  Compara TODAS as regras de um seletor (não só a primeira): uma regra pode estar repartida em duas (o kit junta as
 *  duas), pode estar numa lista de seletores (`.youtag,.langtag`) ou dentro de um `@media`. */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const css = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

interface Rule { media: string | null; sels: string[]; body: string }
const normSel = (s: string) => s.replace(/\s*>\s*/g, ' > ').replace(/\s+/g, ' ').trim()
/** A lista de seletores se parte nas vírgulas de fora dos parênteses: `:is(.a,.b) li` é um seletor só. */
function splitSelectors(prelude: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (const ch of prelude) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out
}
/** Regras de primeiro nível e as de dentro de `@media` (um nível). `@keyframes` e outras at-rules ficam de fora. */
function parse(src: string): Rule[] {
  const out: Rule[] = []
  const walk = (text: string, media: string | null) => {
    let i = 0
    while (i < text.length) {
      const o = text.indexOf('{', i)
      if (o < 0) break
      const prelude = text.slice(i, o).trim()
      let d = 1, j = o + 1
      while (j < text.length && d) { if (text[j] === '{') d++; else if (text[j] === '}') d--; j++ }
      const body = text.slice(o + 1, j - 1)
      if (prelude.startsWith('@media')) walk(body, prelude.replace(/\s+/g, ''))
      else if (!prelude.startsWith('@')) out.push({ media, sels: splitSelectors(prelude).map(normSel), body })
      i = j
    }
  }
  walk(src, null)
  return out
}
/** Declarações finais (a última de cada propriedade vence) de todas as regras cujo seletor — sozinho ou numa lista — é `sel`. */
function decl(rules: Rule[], sel: string, media: string | null = null, only?: RegExp): Record<string, string> {
  const want = normSel(sel), got: Record<string, string> = {}
  let n = 0
  for (const r of rules) {
    if (r.media !== media || !r.sels.includes(want)) continue
    n++
    for (const d of r.body.split(';')) {
      const k = d.indexOf(':')
      if (k < 0) continue
      const prop = d.slice(0, k).trim(), val = d.slice(k + 1).trim().replace(/\s+/g, ' ')
      if (prop && (!only || only.test(prop))) got[prop] = val
    }
  }
  if (!n) throw new Error('regra não encontrada: ' + sel + (media ? ' em ' + media : ''))
  return got
}

const C = '_canais/canais.css', I = '_insights/insights.css', O = '_outliers/outliers.css'
const CN = '[data-obs-screen="canais"]', IN = '[data-obs-screen="insights"]'
const PARES: Array<[string, string, string]> = [
  [C, CN + ' .dstats', '[data-obs] .obs-ch-dstats'],
  [C, CN + ' .dstats > div', '[data-obs] .obs-ch-dstats > div'],
  [C, CN + ' .dstats > div:nth-child(n+4)', '[data-obs] .obs-ch-dstats > div:nth-child(n+4)'],
  [C, CN + ' .dstats .l', '[data-obs] .obs-ch-dstats .l'],
  [C, CN + ' .dstats .v', '[data-obs] .obs-ch-dstats .v'],
  [C, CN + ' .youtag', '[data-obs] .obs-ch-youtag'],
  [I, IN + ' .stamp', '[data-obs] .obs-ch-stamp'],
  [I, IN + ' .stamp svg', '[data-obs] .obs-ch-stamp svg'],
  [I, IN + ' .stamp.sm', '[data-obs] .obs-ch-stamp.sm'],
  [O, '.obs-out .obs-out-card', '[data-obs] .obs-ch-card'],
  [O, '.obs-out .obs-out-card:hover', '[data-obs] .obs-ch-card:hover'],
  [O, '.obs-out .obs-out-ttl', '[data-obs] .obs-ch-ttl'],
]
// o `@media` do mosaico de números (900 px): as mesmas três regras nas duas cópias
const MEDIA = '@media(max-width:900px)'
const PARES_MEDIA: Array<[string, string, string]> = [
  [C, CN + ' .dstats', '[data-obs] .obs-ch-dstats'],
  [C, CN + ' .dstats > div', '[data-obs] .obs-ch-dstats > div'],
  [C, CN + ' .dstats > div:nth-child(n+4)', '[data-obs] .obs-ch-dstats > div:nth-child(n+4)'],
  [C, CN + ' .dstats > div:last-child:nth-child(odd)', '[data-obs] .obs-ch-dstats > div:last-child:nth-child(odd)'],
]
// O diálogo de remoção (D11): as regras de Canais que o RemoveDialog usa, copiadas para a página do canal. Mesmas
// declarações; a camada é a única diferença (o z-index numérico de lá vira var(--z-modal) aqui).
const CNL = '[data-obs-screen="canal"]'
const DIALOGO: string[] = [
  ' .sr', ' .btn', ' .btn:hover', ' .btn.danger', ' .btn.danger:hover',
  ' .modal.on', ' .modal .box', ' .modal p', ' .modal .acts',
  ' .modal:has(.fx-remove)', ' .modal .box.fx-remove', ' .modal .fx-remove h2',
  ' .modal .fx-loss-box', ' .modal .fx-loss-box > *', ' .modal .fx-loss-box > .fx-sizer',
  ' :is(.fx-loss,.fx-lossz)', ' :is(.fx-loss,.fx-lossz) li', ' :is(.fx-loss,.fx-lossz) li + li',
  ' :is(.fx-loss,.fx-lossz) b', ' :is(.fx-loss,.fx-lossz) b.fx-wait', ' :is(.fx-loss,.fx-lossz) span span',
  ' .modal p.fx-never', ' .modal .fx-msg', ' .modal .fx-remove .acts',
  ' .modal .btn[aria-disabled="true"]', ' .modal .btn[aria-disabled="true"]:hover', ' .modal .btn[aria-disabled="true"]:active',
]
describe('Observatório · kit promovido', () => {
  const kit = parse(css('_chrome/kit.css'))
  it.each(PARES)('%s %s = %s', (arquivo, origem, promovida) => {
    expect(decl(kit, promovida)).toEqual(decl(parse(css(arquivo)), origem))
  })
  it.each(PARES_MEDIA)('@media 900px: %s %s = %s', (arquivo, origem, promovida) => {
    expect(decl(kit, promovida, MEDIA)).toEqual(decl(parse(css(arquivo)), origem, MEDIA))
  })
  it('os tokens --youtag-* do kit têm o valor da tela de Canais, nos dois temas', () => {
    const canais = parse(css(C)), YT = /^--youtag-/
    expect(decl(kit, '[data-obs]', null, YT)).toEqual(decl(canais, CN, null, YT))
    expect(decl(kit, '[data-theme="light"] [data-obs]', null, YT)).toEqual(decl(canais, '[data-theme="light"] ' + CN, null, YT))
    expect(Object.keys(decl(kit, '[data-obs]', null, YT)).sort()).toEqual(['--youtag-bg', '--youtag-border', '--youtag-text'])
  })
  it.each(DIALOGO)('diálogo de remoção:%s', sufixo => {
    expect(decl(kit, CNL + sufixo)).toEqual(decl(parse(css(C)), CN + sufixo))
  })
  it('diálogo de remoção: o .modal é igual ao de Canais, menos a camada, que vem da escala', () => {
    const naoZ = /^(?!z-index$)/
    expect(decl(kit, CNL + ' .modal', null, naoZ)).toEqual(decl(parse(css(C)), CN + ' .modal', null, naoZ))
    expect(decl(kit, CNL + ' .modal')['z-index']).toBe('var(--z-modal)')
  })
  it('diálogo de remoção: o @media de toque é o mesmo', () => {
    const m = '@media(pointer:coarse)'
    expect(decl(kit, CNL + ' .modal .fx-remove .acts .btn.btn', m)).toEqual(decl(parse(css(C)), CN + ' .modal .fx-remove .acts .btn.btn', m))
  })
  it('o conferidor pega a deriva: uma declaração mudada, ou uma regra repartida em duas, aparece na comparação', () => {
    const a = parse('.x .a{color:red}.x .a{margin:0}'), b = parse('.y .a{color:red;margin:0}'), c = parse('.y .a{color:blue;margin:0}')
    expect(decl(a, '.x .a')).toEqual(decl(b, '.y .a'))
    expect(decl(a, '.x .a')).not.toEqual(decl(c, '.y .a'))
    expect(decl(parse('.x .a,.x .b{flex:none}'), '.x .b')).toEqual({ flex: 'none' })
    expect(() => decl(a, '.nao-existe')).toThrow(/regra não encontrada/)
  })
  it('o kit não traz color-mix nem z-index numérico', () => {
    const raw = css('_chrome/kit.css')
    expect(raw).not.toMatch(/color-mix\s*\(/)
    expect(raw).not.toMatch(/z-index\s*:\s*-?\d/)
  })
})
