// Observatório A5 (E2): em que faixa de série cada vídeo de um canal está, e o que é devido hoje. Puro.
import crypto from 'crypto'
import { RULES } from '@/lib/youtube/observatorio/rules'

export type Tier = 'diaria' | 'semanal'
const DAY = 86_400_000, HOUR = 3_600_000

/** Dias desde 1970 de uma data 'AAAA-MM-DD' (uma data de São Paulo já pronta: sem fuso aqui). */
export const dayNumber = (date: string): number => Math.floor(Date.parse(date.slice(0, 10) + 'T00:00:00Z') / DAY)
export const addDays = (date: string, n: number): string => new Date(Date.parse(date.slice(0, 10) + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10)
/** O dia fixo de cada vídeo no ciclo de 7 (pelo id do YouTube, que não muda): espalha a passada semanal pelos 7 dias. */
export const weekSlotOf = (ytId: string): number => crypto.createHash('sha256').update(ytId).digest().readUInt32BE(0) % 7

export interface TierVideo { id: string; publishedAt: number | null; pinned: boolean; dailyUntil: string | null; tier: Tier | null }
export interface TierPlan { daily: string[]; weekly: string[]; changes: Array<{ video_id: string; tier: Tier }>; cut: number }

type Why = 'fixado' | 'top' | 'promovido' | 'idade' | null
/** Mais recente primeiro; sem data por último; empate pelo id (a ordem é sempre a mesma). */
const byRecency = (a: TierVideo, b: TierVideo): number => {
  if (a.publishedAt == null || b.publishedAt == null) return a.publishedAt == null && b.publishedAt == null ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.publishedAt == null ? 1 : -1
  return b.publishedAt - a.publishedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

export function classifyTiers(videos: readonly TierVideo[], o: { videoLimit: number; nowMs: number; today: string }): TierPlan {
  const ordered = [...videos].sort(byRecency)
  // videoLimit vem do banco sem trava: inteiro, de 0 ao teto (NaN e negativo valem 0).
  const limit = Math.max(0, Math.min(Math.trunc(o.videoLimit) || 0, RULES.videoLimitMax))
  const top = new Set(ordered.slice(0, limit).map(v => v.id))
  const why = new Map<string, Why>(ordered.map(v => [v.id,
    v.pinned ? 'fixado'
      : top.has(v.id) ? 'top'
        : v.dailyUntil != null && v.dailyUntil >= o.today ? 'promovido'
          : v.publishedAt != null && o.nowMs - v.publishedAt <= RULES.series.dailyAgeDays * DAY ? 'idade' : null]))
  // Teto de segurança: os fixados não contam; saem primeiro os de "idade" mais antigos, depois os "promovidos" que
  // vencem antes; os N mais recentes nunca saem. Quem sai vai para a semanal, e o número é devolvido (nunca em silêncio).
  const counted = ordered.filter(v => { const w = why.get(v.id); return w != null && w !== 'fixado' })
  let over = counted.length - RULES.videoLimitMax, cut = 0
  if (over > 0) {
    const victims = [
      ...counted.filter(v => why.get(v.id) === 'idade').sort((a, b) => (a.publishedAt ?? 0) - (b.publishedAt ?? 0)),
      ...counted.filter(v => why.get(v.id) === 'promovido').sort((a, b) => (a.dailyUntil ?? '').localeCompare(b.dailyUntil ?? '')),
    ]
    for (const v of victims) { if (over <= 0) break; why.set(v.id, null); over--; cut++ }
  }
  const daily: string[] = [], weekly: string[] = [], changes: TierPlan['changes'] = []
  for (const v of ordered) {
    const tier: Tier = why.get(v.id) != null ? 'diaria' : 'semanal'
    ;(tier === 'diaria' ? daily : weekly).push(v.id)
    if (v.tier !== tier) changes.push({ video_id: v.id, tier })
  }
  return { daily, weekly, changes, cut }
}

/**
 * Um vídeo semanal é devido hoje quando ainda não tem ponto hoje E (hoje é o dia fixo dele, OU o último ponto tem 7 dias
 * ou mais, OU nunca teve ponto e está na faixa há 7 dias ou mais). `lastPoint` = a data do ponto mais recente nos últimos
 * 8 dias (null = nenhum nesse intervalo).
 */
export function weeklyDue(v: { ytId: string; lastPoint: string | null; tierSince: string | null }, today: string): boolean {
  if (v.lastPoint != null && v.lastPoint.slice(0, 10) === today.slice(0, 10)) return false // vale pelo dia, mesmo se vier com hora
  if (dayNumber(today) % 7 === weekSlotOf(v.ytId)) return true
  const since = v.lastPoint ?? v.tierSince
  return since != null && dayNumber(today) - dayNumber(since) >= RULES.series.weeklyEveryDays
}

/** Promoção por ganho: entre dois pontos a no máximo 8 dias, ganhou `minViews` e pelo menos `minShare` do total. */
export function shouldPromote(prev: { date: string; views: number } | null, cur: { views: number }, today: string): boolean {
  // views nulo/ausente = não medido, e falta de medida não é ganho.
  if (!prev || !Number.isFinite(prev.views) || !Number.isFinite(cur.views)) return false
  const days = dayNumber(today) - dayNumber(prev.date)
  if (days < 1 || days > RULES.series.weeklyMaxGapDays) return false
  const gain = cur.views - prev.views
  return gain >= RULES.promotion.minViews && cur.views > 0 && gain / cur.views >= RULES.promotion.minShare
}

/** Primeiras horas: só vídeo cuja descoberta o Observatório registrou (discovered_at), até 24 h depois de publicado, com menos de 72 h. */
export function earlyEligible(v: { discoveredAt: string | null; publishedAt: string | null }, nowMs: number): boolean {
  const d = v.discoveredAt ? Date.parse(v.discoveredAt) : NaN, p = v.publishedAt ? Date.parse(v.publishedAt) : NaN
  if (!Number.isFinite(d) || !Number.isFinite(p)) return false
  return d - p <= RULES.series.earlyDiscoverHours * HOUR && nowMs >= p && nowMs - p < RULES.series.earlyHours * HOUR
}
