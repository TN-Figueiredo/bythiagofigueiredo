import { describe, it, expect } from 'vitest'
import { AB_TEST_CONFIG_DEFAULTS } from '@/lib/youtube/ab-types'
import type { AbTestConfig } from '@/lib/youtube/ab-types'

describe('AB Test Config', () => {
  it('has all required default fields', () => {
    const defaults = AB_TEST_CONFIG_DEFAULTS
    expect(defaults.max_duration_days).toBe(14)
    expect(defaults.confidence_threshold).toBe(0.95)
    expect(defaults.burn_in_days).toBe(2)
    expect(defaults.auto_apply_winner).toBe(true)
    expect(defaults.rotation_pattern).toBe('abba')
    expect(defaults.stability_threshold).toBe(3)
  })

  it('config merge preserves user overrides', () => {
    const userConfig: Partial<AbTestConfig> = {
      max_duration_days: 30,
      confidence_threshold: 0.90,
    }
    const merged = { ...AB_TEST_CONFIG_DEFAULTS, ...userConfig }
    expect(merged.max_duration_days).toBe(30)
    expect(merged.confidence_threshold).toBe(0.90)
    expect(merged.burn_in_days).toBe(2)
    expect(merged.stability_threshold).toBe(3)
  })

  it('confidence threshold is a ratio (0-1), not percentage', () => {
    expect(AB_TEST_CONFIG_DEFAULTS.confidence_threshold).toBeGreaterThan(0)
    expect(AB_TEST_CONFIG_DEFAULTS.confidence_threshold).toBeLessThanOrEqual(1)
  })

  it('burn-in days multiplied by variant count gives cycle exclusion count', () => {
    const burnIn = AB_TEST_CONFIG_DEFAULTS.burn_in_days
    expect(burnIn * 2).toBe(4)
    expect(burnIn * 3).toBe(6)
  })
})

describe('ABBA rotation balance over config duration', () => {
  it('14-day test with 2 variants has perfect balance', async () => {
    const { getVariantForCycle } = await import('@/lib/youtube/ab-rotation')
    const days = AB_TEST_CONFIG_DEFAULTS.max_duration_days
    const counts = [0, 0]
    for (let i = 0; i < days; i++) counts[getVariantForCycle(2, i)]++
    expect(counts[0]).toBe(7)
    expect(counts[1]).toBe(7)
  })

  it('14-day test with 3 variants is nearly balanced', async () => {
    const { getVariantForCycle } = await import('@/lib/youtube/ab-rotation')
    const days = AB_TEST_CONFIG_DEFAULTS.max_duration_days
    const counts = [0, 0, 0]
    for (let i = 0; i < days; i++) counts[getVariantForCycle(3, i)]++
    const min = Math.min(...counts)
    const max = Math.max(...counts)
    expect(max - min).toBeLessThanOrEqual(2)
  })
})
