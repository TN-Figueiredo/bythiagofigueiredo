import { describe, it, expect } from 'vitest'
import { LARGURA_MINIMA_ORIGINAL, nivelDeResolucao } from '@/lib/youtube/resolucao'

describe('nivelDeResolucao (regra única de 1280)', () => {
  it('fronteira: 1279 baixa, 1280 ok, null não medida', () => {
    expect(LARGURA_MINIMA_ORIGINAL).toBe(1280)
    expect(nivelDeResolucao({ largura: 1279, altura: 720 })).toBe('baixa')
    expect(nivelDeResolucao({ largura: 1280, altura: 720 })).toBe('ok')
    expect(nivelDeResolucao(null)).toBe('nao_medida')
  })
})
