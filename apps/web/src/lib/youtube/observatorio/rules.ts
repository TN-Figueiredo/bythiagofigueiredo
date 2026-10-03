/** Port of dados.js:113-133 (single source of rules) + tierOf + NICHES. */
export const RULES = {
  outlierMin: 2,
  weakBase: 3,
  effect: { afterDays: 7, maxBeforeDays: 7, minBeforeDays: 3, minN: 5, pp: 10, simultHours: 48 },
  pattern: { minN: 10, minDiff: 0.3 },
  attribution: { solo: 0.6, second: 0.2 },
  theme: { minCount: 3, minShare: 0.4, trend: { minDelta: 3, minPct: 0.25, text: '▲/▼ só quando a diferença entre os últimos 90 dias e os 90 anteriores é de 3 vídeos ou mais E de 25% ou mais; senão ≈' } },
  habit: { minCount: 3, minShare: 0.3, weeks: 13 },
  tiers: { mid: 2, high: 5, top: 10 },
  testCompareMaxDays: 14,
  staleSyncHours: 24,
  videoLimitMax: 200,
  channelLimit: 75,
}
export interface AgeBand { id: string; lo: number; hi: number; label: string }
export const AGE_BANDS: AgeBand[] = [
  { id: '0-7', lo: 0, hi: 7, label: '0–7 dias' }, { id: '8-30', lo: 8, hi: 30, label: '8–30 dias' }, { id: '31-90', lo: 31, hi: 90, label: '31–90 dias' },
  { id: '91-365', lo: 91, hi: 365, label: '91–365 dias' }, { id: '365+', lo: 366, hi: 1e9, label: 'mais de 365 dias' },
]
export const bandOf = (ageDays: number): AgeBand => AGE_BANDS.find(b => ageDays >= b.lo && ageDays <= b.hi) || AGE_BANDS[0]!
export const OUT_WINDOWS: AgeBand[] = [
  { id: '0-30', lo: 0, hi: 30, label: '0–30 d' }, { id: '31-90', lo: 31, hi: 90, label: '31–90 d' }, { id: '91-180', lo: 91, hi: 180, label: '91–180 d' },
  { id: '181-365', lo: 181, hi: 365, label: '181–365 d' }, { id: '365+', lo: 366, hi: 1e9, label: 'mais de 1 ano' },
]
export const winOf = (ageDays: number): AgeBand | undefined => OUT_WINDOWS.find(w => ageDays >= w.lo && ageDays <= w.hi)
export const DEFAULT_AGES = ['0-30', '31-90']
export const NICHES = {
  viagem: { id: 'viagem', label: 'Viagem', color: { dark: '#5BBF8A', light: '#11692F' } },
  ia: { id: 'ia', label: 'IA', color: { dark: '#6EA8FE', light: '#1D4ED8' } },
} as const
export type Tier = 'top' | 'high' | 'mid'
export const tierOf = (x: number | null): Tier | null =>
  x == null ? null : x >= RULES.tiers.top ? 'top' : x >= RULES.tiers.high ? 'high' : x >= RULES.tiers.mid ? 'mid' : null
