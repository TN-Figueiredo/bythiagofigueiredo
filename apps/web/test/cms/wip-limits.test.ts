import { describe, it, expect } from 'vitest'
import { getWipStatus, DEFAULT_WIP_LIMITS, type WipStatusLevel } from '../../src/lib/pipeline/up-next-constants'

describe('DEFAULT_WIP_LIMITS', () => {
  it('has limits for all 4 stage groups', () => {
    expect(DEFAULT_WIP_LIMITS).toHaveProperty('escrever')
    expect(DEFAULT_WIP_LIMITS).toHaveProperty('gravar')
    expect(DEFAULT_WIP_LIMITS).toHaveProperty('pos-prod')
    expect(DEFAULT_WIP_LIMITS).toHaveProperty('prontos')
  })
  it('has reasonable positive values', () => {
    for (const limit of Object.values(DEFAULT_WIP_LIMITS)) {
      expect(limit).toBeGreaterThan(0)
    }
  })
})

describe('getWipStatus', () => {
  const limits = { escrever: 5, gravar: 2, 'pos-prod': 3, prontos: 4 }

  it('returns ok when count is below limit', () => {
    const result = getWipStatus({ escrever: 3 }, limits)
    expect(result.escrever).toBe<WipStatusLevel>('ok')
  })

  it('returns warning when count equals limit', () => {
    const result = getWipStatus({ gravar: 2 }, limits)
    expect(result.gravar).toBe<WipStatusLevel>('warning')
  })

  it('returns exceeded when count is above limit', () => {
    const result = getWipStatus({ 'pos-prod': 5 }, limits)
    expect(result['pos-prod']).toBe<WipStatusLevel>('exceeded')
  })

  it('returns ok for zero counts', () => {
    const result = getWipStatus({ prontos: 0 }, limits)
    expect(result.prontos).toBe<WipStatusLevel>('ok')
  })

  it('handles mixed statuses', () => {
    const counts = { escrever: 3, gravar: 2, 'pos-prod': 5, prontos: 0 }
    const result = getWipStatus(counts, limits)
    expect(result.escrever).toBe<WipStatusLevel>('ok')
    expect(result.gravar).toBe<WipStatusLevel>('warning')
    expect(result['pos-prod']).toBe<WipStatusLevel>('exceeded')
    expect(result.prontos).toBe<WipStatusLevel>('ok')
  })

  it('uses DEFAULT_WIP_LIMITS when no custom limits provided', () => {
    const result = getWipStatus({})
    // All groups from DEFAULT_WIP_LIMITS should appear in result
    for (const group of Object.keys(DEFAULT_WIP_LIMITS)) {
      expect(result).toHaveProperty(group)
    }
  })

  it('treats missing count keys as 0', () => {
    const result = getWipStatus({}, limits)
    // All groups should be 'ok' since 0 < any positive limit
    expect(result.escrever).toBe<WipStatusLevel>('ok')
    expect(result.gravar).toBe<WipStatusLevel>('ok')
    expect(result['pos-prod']).toBe<WipStatusLevel>('ok')
    expect(result.prontos).toBe<WipStatusLevel>('ok')
  })

  it('handles warning at limit - 1 threshold', () => {
    // limit - 1 should be 'ok', limit should be 'warning'
    const result1 = getWipStatus({ escrever: 4 }, limits) // 4 < 5
    const result2 = getWipStatus({ escrever: 5 }, limits) // 5 === 5
    expect(result1.escrever).toBe<WipStatusLevel>('ok')
    expect(result2.escrever).toBe<WipStatusLevel>('warning')
  })
})
