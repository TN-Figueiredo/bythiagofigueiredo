import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResolveQuery, AudioAssetRow, AudioStatus } from './audio-schemas'

export type ResolveStatus = 'LOCAL' | 'PENDING_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH'

export interface ScoreBreakdown {
  category: number
  tags: number
  mood: number
  energy: number
  bpm_in_range: number
  duration_in_range: number
  reuse_scenarios: number
  instruments: number
}

export interface ScoreResult {
  score: number
  breakdown: ScoreBreakdown
  resolve_status: ResolveStatus
}

export interface AudioMatch {
  asset: AudioAssetRow
  score: number
  breakdown: ScoreBreakdown
  resolve_status: ResolveStatus
}

export interface ResolveResult {
  matches: AudioMatch[]
  query_time_ms: number
}

function intersection(a: string[], b: string[]): string[] {
  const setB = new Set(b)
  return a.filter(x => setB.has(x))
}

function toResolveStatus(score: number, status: AudioStatus): ResolveStatus {
  if (score >= 8 && status === 'downloaded') return 'LOCAL'
  if (score >= 8 && status === 'pending') return 'PENDING_MATCH'
  if (score >= 4) return 'PARTIAL_MATCH'
  return 'NO_MATCH'
}

export function scoreAsset(asset: AudioAssetRow, query: ResolveQuery): ScoreResult {
  const breakdown: ScoreBreakdown = {
    category: 0, tags: 0, mood: 0, energy: 0,
    bpm_in_range: 0, duration_in_range: 0, reuse_scenarios: 0, instruments: 0,
  }

  if (query.category && asset.category === query.category) breakdown.category = 5

  const qTags = query.tags ?? []
  const aTags = asset.tags ?? []
  if (qTags.length > 0 && aTags.length > 0) breakdown.tags = Math.min(intersection(aTags, qTags).length * 2, 8)

  const qMood = query.mood ?? []
  const aMood = asset.mood ?? []
  if (qMood.length > 0 && aMood.length > 0) breakdown.mood = Math.min(intersection(aMood, qMood).length * 2, 6)

  if (query.energy != null && asset.energy != null) {
    if (Math.abs(asset.energy - query.energy) <= 1) breakdown.energy = 3
  }

  if (query.bpm_range && asset.bpm != null) {
    const bpm = asset.bpm
    if (bpm >= query.bpm_range.min && bpm <= query.bpm_range.max) breakdown.bpm_in_range = 3
  }

  if (query.duration_range && asset.duration_seconds != null) {
    const dur = asset.duration_seconds
    if (dur >= query.duration_range.min && dur <= query.duration_range.max) breakdown.duration_in_range = 2
  }

  const qReuse = query.reuse_scenarios ?? []
  const aReuse = asset.reuse_scenarios ?? []
  if (qReuse.length > 0 && aReuse.length > 0 && intersection(aReuse, qReuse).length > 0) breakdown.reuse_scenarios = 4

  const qInst = query.instruments ?? []
  const aInst = asset.instruments ?? []
  if (qInst.length > 0 && aInst.length > 0) breakdown.instruments = Math.min(intersection(aInst, qInst).length, 3)

  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0)
  return { score, breakdown, resolve_status: toResolveStatus(score, asset.status) }
}

export async function resolveAudio(
  supabase: SupabaseClient,
  siteId: string,
  query: ResolveQuery,
): Promise<ResolveResult> {
  const t0 = Date.now()

  let q = supabase
    .from('audio_assets')
    .select('*')
    .eq('site_id', siteId)
    .eq('type', query.type)
    .neq('status', 'retired')

  if (query.tags && query.tags.length > 0) q = q.overlaps('tags', query.tags)
  if (query.mood && query.mood.length > 0) q = q.overlaps('mood', query.mood)
  if (query.reuse_scenarios && query.reuse_scenarios.length > 0) q = q.overlaps('reuse_scenarios', query.reuse_scenarios)

  const { data, error } = await q.limit((query.limit ?? 5) * 4)
  if (error) throw new Error(error.message)

  const matches = ((data ?? []) as AudioAssetRow[])
    .map((asset: AudioAssetRow) => {
      const { score, breakdown, resolve_status } = scoreAsset(asset, query)
      return { asset, score, breakdown, resolve_status }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, query.limit ?? 5)

  return { matches, query_time_ms: Date.now() - t0 }
}
