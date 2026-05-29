import type { AbTestConfig, AbTestSiteSettings, DisplayLabel } from './ab-types'

export interface WizardConfig {
  confidence: number      // integer 80-99
  duration: number        // days 7-28
  autoApply: boolean
  burnIn: number          // days 0-3
  rotation: 'abba' | 'round_robin' | 'random'
  playoff: boolean
}

export interface ClickMomentVariant {
  label: DisplayLabel
  color: string
  thumbUrl: string | null
  thumbBg?: string
  title: string
  ctr: number
  isLeader?: boolean
  isWinner?: boolean
}

export function wizardConfigToAbConfig(cfg: WizardConfig): Partial<AbTestConfig> {
  return {
    confidence_threshold: cfg.confidence / 100,
    max_duration_days: cfg.duration,
    auto_apply_winner: cfg.autoApply,
    burn_in_days: cfg.burnIn,
    rotation_pattern: cfg.rotation,
    stability_threshold: 3,
  }
}

export function initWizardConfig(settings: AbTestSiteSettings): WizardConfig {
  return {
    confidence: Math.round(settings.default_confidence * 100),
    duration: settings.default_duration_days,
    autoApply: settings.default_auto_apply,
    burnIn: settings.default_burn_in_days,
    rotation: 'abba',
    playoff: true,
  }
}
