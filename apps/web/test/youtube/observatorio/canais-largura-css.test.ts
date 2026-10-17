// @vitest-environment node
/** L6 (Gio 17/10): a tabela de Canais a 1440 px sem painel tem 1.152 px úteis e não pode rolar na horizontal. Regra de orçamento (não mede o navegador):
 *  as larguras medidas pelo Gio em Longos (canais-a3 / L6-gio-parcial) com o piso que o CSS e o TSX declaram hoje devem somar com 20 px de folga. */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const dir = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_canais')
const css = fs.readFileSync(path.join(dir, 'canais.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const tsx = fs.readFileSync(path.join(dir, 'channel-table.tsx'), 'utf8')
const SEM_PAINEL = '[data-obs-screen="canais"]:not(.drawer-open) .tablebox'
/** O último valor declarado vence (o L6 sobrepõe as regras da A3 mais abaixo no arquivo). */
const px = (re: RegExp): number => { const m = [...css.matchAll(new RegExp(re.source, 'g'))]; expect(m.length, String(re)).toBeGreaterThan(0); return Number(m[m.length - 1]![1]) }

describe('canais.css: orçamento de largura a 1440 px sem painel', () => {
  it('as colunas que o L6 espremeu continuam espremidas e as duas que o Gio achou estão cortadas', () => {
    expect(css).toContain(`${SEM_PAINEL} .cad .v{white-space:normal}`)
    expect(css).toMatch(/\.tablebox td\.cmp\{padding-left:1px;padding-right:1px\}/)
    expect(px(/:not\(\.drawer-open\) \.tablebox \.cad\{min-width:(\d+)px\}/)).toBe(84)
    expect(px(/\.tablebox table th\.cmp,[^{]*td\.cmp\{width:(\d+)px/)).toBe(56)
  })
  it('Views/dia pede 112 px de cabeçalho (era 128)', () => {
    expect(tsx).toMatch(/k: 'vpd'[^\n]*minW: 112/)
  })
  it('a soma das colunas medidas fica 20 px abaixo dos 1.152 úteis', () => {
    const pos = px(/--cn-pos-w:(\d+)px/)
    const sync = px(/\.tablebox \.sync\{max-width:(\d+)px\}/)
    const ritmo = px(/:not\(\.drawer-open\) \.tablebox \.cad\{min-width:(\d+)px\}/)
    const vpd = Number(tsx.match(/k: 'vpd'[^\n]*minW: (\d+)/)![1])
    const cmp = 60 // "Comparar" a 12,5 px (58) + 1 px de respiro de cada lado
    const canal = 193, direcao = 157, outliers = 100, trocas = 96, crescimento = 99, acoes = 40 // medidos pelo Gio em Longos
    const soma = pos + canal + direcao + ritmo + vpd + outliers + trocas + crescimento + sync + cmp + acoes
    expect(soma).toBeLessThanOrEqual(1152 - 20)
  })
})
