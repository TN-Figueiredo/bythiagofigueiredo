export function formatSubscriberCount(count: number): string | null {
  if (count < 10) return null
  if (count < 1000) return String(count)
  return `${(count / 1000).toFixed(1)}k`
}

export function formatDaysAgo(days: number, locale: 'en' | 'pt-BR'): string {
  if (days === 0) return locale === 'pt-BR' ? 'hoje' : 'today'
  if (days === 1) return locale === 'pt-BR' ? 'ontem' : 'yesterday'
  return locale === 'pt-BR' ? `há ${days} dias` : `${days} days ago`
}

function toLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

export function resolveAccentTextColor(accentHex: string): '#000000' | '#FFFFFF' {
  const r = toLinear(parseInt(accentHex.slice(1, 3), 16) / 255)
  const g = toLinear(parseInt(accentHex.slice(3, 5), 16) / 255)
  const b = toLinear(parseInt(accentHex.slice(5, 7), 16) / 255)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

const CADENCE_MAP: Record<number, { en: string; 'pt-BR': string }> = {
  7: { en: 'Weekly', 'pt-BR': 'Semanal' },
  14: { en: 'Bi-weekly', 'pt-BR': 'Quinzenal' },
  30: { en: 'Monthly', 'pt-BR': 'Mensal' },
}

export function deriveCadenceLabel(
  cadenceLabel: string | null,
  cadenceDays: number,
  locale: 'en' | 'pt-BR',
): string | null {
  if (cadenceLabel) return cadenceLabel
  return CADENCE_MAP[cadenceDays]?.[locale] ?? null
}
