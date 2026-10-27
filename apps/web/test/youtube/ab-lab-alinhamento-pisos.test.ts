// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const dir = join(__dirname, '../../src/app/cms/(authed)/youtube/ab-lab/_components')
const pv2 = readFileSync(join(dir, 'blocos-v2.css'), 'utf8')
const pm4 = readFileSync(join(dir, 'placar-do-teste.css'), 'utf8')

describe('Falta para decidir alinhado ao Placar', () => {
  it('.pv2 e .pm4-in sem recuo horizontal próprio (rentes à coluna) e mesma largura máxima do cartão', () => {
    expect(pm4).toMatch(/\.pm4-in \{ padding: var\(--s5\) 0; \}/)
    expect(pv2).toMatch(/\.pv2 \{[^}]*padding: var\(--s6\) 0 var\(--s4\)/)
    expect(pv2).not.toMatch(/\.pv2 \{ padding-inline/)
    expect(pm4).toContain('.pm4-in { padding: var(--s5) 0 var(--s4); }')
    expect(pv2).toMatch(/\.pv2-pisos \{[^}]*max-width: 1040px/)
    expect(pm4).toMatch(/\.pm4-card \{[^}]*max-width: 1040px/)
  })
  it('D4: ⓘ e link A/B Lab com alvo de 44 px por pseudo-elemento', () => {
    expect(pm4).toContain('.pm4 .dica-i::after, .pv2 .dica-i::after { content: \'\'; position: absolute; inset: -10px; }')
    expect(readFileSync(join(dir, 'detail-header-lab.css'), 'utf8')).toContain('.dhl-crumb a::after { content: \'\'; position: absolute; inset: -13px -6px; }')
  })
  it('D5: no bloco estreito o título ocupa a linha inteira', () => {
    expect(pm4).toMatch(/\.pm4-vh \{ flex-wrap: wrap; \}/)
    expect(pm4).toMatch(/\.pm4-vt \{ flex: 1 1 100%; \}/)
  })
  it('M3: selo "No ar" do placar não depende do CSS do diálogo', () => {
    expect(pm4).toContain('.pm4-noar {')
    expect(readFileSync(join(dir, 'placar-do-teste.tsx'), 'utf8')).not.toContain('ab-end-test-dialog.css')
  })
})
