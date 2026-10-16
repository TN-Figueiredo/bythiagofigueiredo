// @vitest-environment node
/** T22 (CSS das trocas): cor literal (color-mix renderiza transparente no Opera) e estado sem número separável em escala de cinza, só pela forma. */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_proprio')
const lerCss = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const regra = (css: string, seletor: string): string => {
  const m = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(x => x[1]!.split(',').map(t => t.trim()).includes(seletor))
  return m.map(x => x[2]!).join(';')
}

describe('trocas.css e impressoes.css', () => {
  it('trocas.css e impressoes.css não contêm color-mix(', () => {
    for (const f of ['trocas.css', 'impressoes.css']) expect(lerCss(f), f).not.toMatch(/color-mix\(/)
  })
  it('o fundo da faixa cheia é rgba literal nos dois temas (token --ab-fundo)', () => {
    const css = lerCss('impressoes.css')
    const escuro = regra(css, '.ic'), claro = regra(css, '[data-theme="light"] .ic')
    expect(escuro).toMatch(/--ab-fundo:rgba\(\d+,\d+,\d+,[.\d]+\)/)
    expect(claro).toMatch(/--ab-fundo:rgba\(\d+,\d+,\d+,[.\d]+\)/)
    expect(escuro.match(/--ab-fundo:[^;]+/)![0]).not.toBe(claro.match(/--ab-fundo:[^;]+/)![0])
    expect(regra(css, '.ic-faixa-fundo')).toContain('fill:var(--ab-fundo)')
  })
  it('as formas de borda dos estados sem número são distintas (estilo, espessura, fundo), cinco mais o zero medido', () => {
    const css = lerCss('trocas.css')
    const base = regra(css, '.tr-lado')
    const largura = (r: string) => r.match(/border-width:([^;]+)/)?.[1] ?? base.match(/border:\s*([\d.]+px)/)?.[1] ?? '?'
    const sig = (est: string) => {
      const r = regra(css, '.tr-lado-' + est)
      return [r.match(/border-style:([^;]+)/)?.[1] ?? 'solid', largura(r), /repeating-linear-gradient/.test(r) ? 'hachura' : 'liso'].join('|')
    }
    const estados = ['nao-medido', 'sem-antes', 'sem-dias', 'poucas', 'erro']
    const sigs = estados.map(sig)
    expect(new Set(sigs).size, sigs.join(' / ')).toBe(estados.length)
    expect(sigs[0]).toContain('hachura')
    // o zero medido é a caixa vazada: nenhuma regra própria de hachura nem de estilo especial
    expect(regra(css, '.tr-lado-zero')).not.toMatch(/repeating-linear-gradient/)
    expect(new Set([...sigs, sig('zero')]).size).toBe(estados.length + 1)
  })
  it('a hachura do não medido tem cor literal nos dois temas', () => {
    const css = lerCss('trocas.css')
    expect(regra(css, '.tr-lado-nao-medido')).toMatch(/rgba\(/)
    expect(regra(css, '[data-theme="light"] .tr-lado-nao-medido')).toMatch(/rgba\(/)
  })
  it('nenhum texto abaixo de 12 px em trocas.css', () => {
    for (const m of lerCss('trocas.css').matchAll(/font-size:(\d+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
  })
})
