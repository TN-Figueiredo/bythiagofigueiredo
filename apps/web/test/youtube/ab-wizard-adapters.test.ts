import { describe, it, expect } from 'vitest'
import { wizardConfigToAbConfig, initWizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'

describe('wizardConfigToAbConfig', () => {
  it('converts confidence integer 95 to decimal 0.95', () => {
    const result = wizardConfigToAbConfig({ confidence: 95, duration: 14, burnIn: 2, rotation: 'abba' })
    expect(result.confidence_threshold).toBe(0.95)
  })
  it('maps duration to max_duration_days', () => {
    const result = wizardConfigToAbConfig({ confidence: 95, duration: 21, burnIn: 2, rotation: 'abba' })
    expect(result.max_duration_days).toBe(21)
  })
  it('passes rotation through unchanged', () => {
    const result = wizardConfigToAbConfig({ confidence: 95, duration: 14, burnIn: 2, rotation: 'round_robin' })
    expect(result.rotation_pattern).toBe('round_robin')
  })
  it('não grava auto_apply_winner (A/B Lab P2)', () => {
    const result = wizardConfigToAbConfig({ confidence: 95, duration: 14, burnIn: 2, rotation: 'abba' })
    expect(result).not.toHaveProperty('auto_apply_winner')
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
  it('não produz autoApply nem playoff (A/B Lab P2)', () => {
    const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
    expect(wc).not.toHaveProperty('autoApply')
    expect(wc).not.toHaveProperty('playoff')
  })
  it('maps default_duration_days', () => {
    const wc = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
    expect(wc.duration).toBe(14)
  })
})
