import { describe, it, expect } from 'vitest'
import { computeQrFunnel, type QrFunnelInput } from './qr-funnel.js'

describe('computeQrFunnel', () => {
  it('computes 3-step funnel', () => {
    const input: QrFunnelInput = { scans: 1000, clicks: 800, conversions: 200 }
    const result = computeQrFunnel(input)
    expect(result.steps).toHaveLength(3)
    expect(result.steps[0].label).toBe('Escaneamentos')
    expect(result.steps[0].value).toBe(1000)
    expect(result.steps[1].label).toBe('Cliques')
    expect(result.steps[1].value).toBe(800)
    expect(result.steps[2].label).toBe('Conversoes')
    expect(result.steps[2].value).toBe(200)
  })

  it('computes drop-off percentages between steps', () => {
    const input: QrFunnelInput = { scans: 1000, clicks: 500, conversions: 100 }
    const result = computeQrFunnel(input)
    expect(result.steps[0].pct).toBe(100)
    expect(result.steps[1].pct).toBe(50)
    expect(result.steps[2].pct).toBe(10)
  })

  it('handles zero scans', () => {
    const result = computeQrFunnel({ scans: 0, clicks: 0, conversions: 0 })
    expect(result.steps[0].pct).toBe(0)
    expect(result.steps[1].pct).toBe(0)
    expect(result.steps[2].pct).toBe(0)
  })

  it('computes overall conversion rate', () => {
    const result = computeQrFunnel({ scans: 200, clicks: 150, conversions: 30 })
    expect(result.overallRate).toBeCloseTo(15.0, 0)
  })

  it('handles when clicks > scans (edge case)', () => {
    const result = computeQrFunnel({ scans: 50, clicks: 100, conversions: 10 })
    expect(result.steps[1].pct).toBe(100)
  })
})
