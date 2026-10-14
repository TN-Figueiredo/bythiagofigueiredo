// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { RULES } from '@/lib/youtube/observatorio/rules'
import { PROPRIO_RULES, type RegrasTroca } from '@/lib/youtube/observatorio/proprio-versoes/regras'
import type { OrigemGravavel } from '@/lib/youtube/observatorio/proprio-versoes/tipos'

describe('regras das versões do vídeo próprio', () => {
  it('RULES.proprio é a mesma referência de PROPRIO_RULES (o número mora num lugar só)', () => {
    expect(RULES.proprio).toBe(PROPRIO_RULES)
  })

  it('os três valores padrão', () => {
    expect(PROPRIO_RULES.trocaMinImpressoesPorLado).toBe(100)
    expect(PROPRIO_RULES.trocaJanelaDias).toBe(7)
    expect(PROPRIO_RULES.retoqueContaComoTroca).toBe(false)
  })

  it('o objeto é mutável e RegrasTroca descreve o mesmo formato', () => {
    const copia: RegrasTroca = { ...PROPRIO_RULES, trocaMinImpressoesPorLado: 50 }
    expect(copia.trocaMinImpressoesPorLado).toBe(50)
    expect(PROPRIO_RULES.trocaMinImpressoesPorLado).toBe(100)
  })

  it("OrigemGravavel não aceita 'cms'", () => {
    const ok: OrigemGravavel = 'ab_lab'
    // @ts-expect-error 'cms' é só de leitura
    const ruim: OrigemGravavel = 'cms'
    expect([ok, ruim]).toHaveLength(2)
  })
})
