// @vitest-environment node
/** M6a layout r6 (reconferência r5 do Gio, 28/10). */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const C = resolve(__dirname, '../../src/app/cms/(authed)/youtube/competitors')
const css = readFileSync(`${C}/_arquivo/arquivo.css`, 'utf8')
const peca = readFileSync(`${C}/_arquivo-saida/peca-tirar-mes.tsx`, 'utf8')

describe('layout r6', () => {
  it('só o rótulo de "Mês mais antigo no banco:" não quebra; o valor quebra', () => {
    expect(css).toMatch(/\.arq-mesb-r\{white-space:nowrap\}/)
    expect(css).not.toMatch(/\.arq-mesb\{[^}]*white-space:nowrap/)
    expect(peca).toContain('<span className="arq-mesb-r">Mês mais antigo no banco:</span>')
  })
  it('a margem negativa do ⓘ não passa do espaçamento de 8px do botão', () => {
    const gap = Number(/\.arq-acao\{[^}]*gap:(\d+)px/.exec(css)![1])
    const topo = Math.abs(Number(/\.arq-efl \.dica-i\{[^}]*margin:(-?\d+)px/.exec(css)![1]))
    expect(topo).toBeLessThanOrEqual(gap)
  })
  it('a linha de efeito de esconder só promete "mostrar de novo" quando a saída é em dois passos', () => {
    expect(peca).toContain("${e.dois_passos ? 'dá' : 'não dá'} para mostrar de novo")
  })
})
