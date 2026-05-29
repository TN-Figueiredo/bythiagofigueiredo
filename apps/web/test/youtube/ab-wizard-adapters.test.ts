import { describe, it, expect } from 'vitest'
import { wizardConfigToAbConfig, initWizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'

describe('wizardConfigToAbConfig', () => {
  it('converts confidence integer 95 to decimal 0.95', () => {
    const result = wizardConfigToAbConfig({ confidence: 95, duration: 14, autoApply: true, burnIn: 2, rotation: 'abba', playoff: false })
    expect(result.confidence_threshold).toBe(0.95)
  })
  it('maps duration to max_duration_days', () => {
    const result = wizardConfigToAbConfig({ confidence: 95, duration: 21, autoApply: true, burnIn: 2, rotation: 'abba', playoff: false })
    expect(result.max_duration_days).toBe(21)
  })
  it('passes rotation through unchanged', () => {
    const result = wizardConfigToAbConfig({ confidence: 95, duration: 14, autoApply: true, burnIn: 2, rotation: 'round_robin', playoff: false })
    expect(result.rotation_pattern).toBe('round_robin')
  })
})

describe('initWizardConfig', () => {
  it('converts default_confidence 0.95 to integer 95', () => {
    const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
    expect(wc.confidence).toBe(95)
  })
  it('defaults rotation to abba', () => {
    const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
    expect(wc.rotation).toBe('abba')
  })
  it('defaults playoff to true', () => {
    const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
    expect(wc.playoff).toBe(true)
  })
  it('maps default_duration_days', () => {
    const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
    expect(wc.duration).toBe(14)
  })
})
