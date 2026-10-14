// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(__dirname, '../../src/app/cms/(authed)/youtube/ab-lab/_components')
const ler = (f: string) => readFileSync(join(DIR, f), 'utf8')

describe('emenda Logan + Naksu (P2): acabamento', () => {
  it('a frase fixa e a versão curta têm o texto do Logan', () => {
    const c = ler('ab-constants.ts')
    expect(c).toContain("'CTR ainda não medido. Você decide o vencedor.'")
    expect(c).toContain("'CTR não medido'")
  })
  it('early sem "Coletando dados" nem "Burn-in"; tabela do early usa "—" e "em rotação"', () => {
    for (const f of ['early-hero.tsx', 'early-band.tsx', 'early-detail.tsx', 'early-variant-table.tsx']) {
      expect(ler(f)).not.toMatch(/Coletando dados|Burn-in|coletando/)
    }
    expect(ler('early-variant-table.tsx')).not.toContain('--\n')
    expect(ler('early-variant-table.tsx')).toContain('em rotação')
  })
  it('barra de progresso do aprendizado usa a cor do CMS', () => {
    expect(ler('learnings-panel.tsx')).not.toContain('bg-blue-500')
  })
})
