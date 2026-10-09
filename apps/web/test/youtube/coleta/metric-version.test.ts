// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { metricVersion } from '@/lib/youtube/coleta/metric-version'

describe('metricVersion', () => {
  it.each([
    ['2015-08-27', 'views_ate_2025-03-30'],
    ['2025-03-30', 'views_ate_2025-03-30'],
    ['2025-03-31', 'views_2025-03-31_a_2026-08-26'],
    ['2026-08-26', 'views_2025-03-31_a_2026-08-26'],
    ['2026-08-27', 'views_desde_2026-08-27'],
    ['2026-10-08', 'views_desde_2026-08-27'],
  ])('%s → %s', (dia, esperado) => {
    expect(metricVersion(dia)).toBe(esperado)
  })
  it('dia fora do formato lança (nunca escolhe uma versão por palpite)', () => {
    expect(() => metricVersion('20260925')).toThrow()
    expect(() => metricVersion('')).toThrow()
  })
})
