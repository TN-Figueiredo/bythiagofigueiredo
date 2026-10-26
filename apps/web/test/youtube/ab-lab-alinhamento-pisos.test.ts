// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const dir = join(__dirname, '../../src/app/cms/(authed)/youtube/ab-lab/_components')
const pv2 = readFileSync(join(dir, 'blocos-v2.css'), 'utf8')
const pm4 = readFileSync(join(dir, 'placar-do-teste.css'), 'utf8')

describe('Falta para decidir alinhado ao Placar', () => {
  it('.pv2 e .pm4-in usam o mesmo recuo horizontal (s5 largo, s3 estreito) e a mesma largura máxima do cartão', () => {
    expect(pm4).toMatch(/\.pm4-in \{ padding: var\(--s5\); \}/)
    expect(pv2).toMatch(/\.pv2 \{[^}]*padding: 0 var\(--s5\) var\(--s4\)/)
    expect(pv2).toMatch(/@media \(max-width: 640px\) \{ \.pv2 \{ padding-inline: var\(--s3\); \} \}/)
    expect(pm4).toContain('.pm4-in { padding: var(--s5) var(--s3) var(--s4); }')
    expect(pv2).toMatch(/\.pv2-pisos \{[^}]*max-width: 1040px/)
    expect(pm4).toMatch(/\.pm4-card \{[^}]*max-width: 1040px/)
  })
})
