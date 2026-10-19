// @vitest-environment node
/** F1 do Remover canal (Yannis, desvio b): `colunasDaSoma` entende `t.a + t.b`; qualquer outra forma devolve nulo (a soma não é conferida em silêncio). */
import { describe, it, expect } from 'vitest'
import { colunasDaSoma } from '@/lib/youtube/observatorio/arquivo/sessao'

describe('colunasDaSoma', () => {
  it('duas colunas, uma coluna, expressão composta e nulo', () => {
    expect(colunasDaSoma('t.id + t.vistas')).toEqual(['id', 'vistas'])
    expect(colunasDaSoma('t.id')).toEqual(['id'])
    expect(colunasDaSoma('t.id + coalesce(t.x,0)')).toBeNull()
    expect(colunasDaSoma(null)).toBeNull()
  })
})
