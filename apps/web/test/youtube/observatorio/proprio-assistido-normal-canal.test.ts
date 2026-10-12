// @vitest-environment node
// A4 13.4 (conserto I2): o "normal" do % assistido NA TELA DO VÍDEO é a mediana do CANAL (os outros vídeos com views), não a da faixa de duração.
// Função pura ao lado de `normalDaFaixa` (que a aba Retenção do canal continua usando, sem mudança).
import { describe, it, expect } from 'vitest'
import { MIN_VIDEOS_FAIXA, normalDoCanal } from '@/lib/youtube/observatorio/proprio/assistido'

describe('normalDoCanal', () => {
  it('é a mediana dos % assistidos que existem; nulo (sem views) não conta como vídeo com views nem como zero', () => {
    expect(normalDoCanal([40, 50, 60, 70, 80, null, null])).toEqual({ comViews: 5, normal: 60 })
    expect(normalDoCanal([10, 20, 30, 40, 50, 60])).toEqual({ comViews: 6, normal: 35 })
  })

  it('exige o mínimo de vídeos com views (o mesmo de MIN_VIDEOS_FAIXA = 5): com 4 não há normal e a contagem sai', () => {
    expect(MIN_VIDEOS_FAIXA).toBe(5)
    expect(normalDoCanal([40, 50, 60, 70, null, null, null])).toEqual({ comViews: 4, normal: null })
    expect(normalDoCanal([])).toEqual({ comViews: 0, normal: null })
    expect(normalDoCanal([null, null, null, null, null, null])).toEqual({ comViews: 0, normal: null })
  })

  it('acima de 100 é dado válido e entra na mediana', () => {
    expect(normalDoCanal([120, 130, 140, 50, 60]).normal).toBe(120)
  })
})
