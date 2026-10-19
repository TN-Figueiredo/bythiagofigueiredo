import { AB_TEST_CONFIG_DEFAULTS } from './ab-types'

const DIA_MS = 86_400_000

/** Dias corridos inteiros desde started_at até (fim ?? agora). Nulo sem início ou com data ilegível. */
export function diaDoTeste(startedAt: string | null, fimIso: string | null, agora: Date): number | null {
  if (!startedAt) return null
  const ini = new Date(startedAt).getTime()
  const fim = fimIso ? new Date(fimIso).getTime() : agora.getTime()
  if (!Number.isFinite(ini) || !Number.isFinite(fim)) return null
  return Math.max(0, Math.floor((fim - ini) / DIA_MS))
}

/** Duração prevista do teste em dias (config.max_duration_days; padrão 14). */
export function duracaoPrevista(config: { max_duration_days?: number } | null): number {
  const d = config?.max_duration_days
  return typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : AB_TEST_CONFIG_DEFAULTS.max_duration_days
}
