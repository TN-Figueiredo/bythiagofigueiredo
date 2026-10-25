import type { AbTestConfig, AbTestSiteSettings, DisplayLabel } from './ab-types'

export interface WizardConfig {
  confidence: number      // integer 80-99
  duration: number        // days 7-28
  burnIn: number          // days 0-3
  rotation: 'abba' | 'round_robin' | 'random'
  /** Legado: o assistente v2 não tem mais o controle de duração e o adaptador nunca manda `max_duration_days` (o início grava `tetoPadrao(V)`). */
  durationTouched?: boolean
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
    burn_in_days: cfg.burnIn,
    rotation_pattern: cfg.rotation, // o passo trava em ABBA; o início da v2 recusa o resto
    stability_threshold: 3,
  }
}

export function initWizardConfig(settings: AbTestSiteSettings): WizardConfig {
  return {
    confidence: Math.round(settings.default_confidence * 100),
    duration: settings.default_duration_days,
    burnIn: settings.default_burn_in_days,
    rotation: 'abba',
  }
}
