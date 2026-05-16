export type ResolveStatus = 'LOCAL' | 'PENDING_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH'

export type SfxCategory = 'IMPACT' | 'RISER' | 'DROP' | 'TRANSITION' | 'AMBIENT' | 'FOLEY'

export const SCORE_MAX = 34

export interface ScoreBreakdownEntry {
  score: number
  max: number
}

export interface MusicRecommendation {
  track: string
  artist: string
  original_filename?: string
  audio_asset_id?: string
  resolve_status: ResolveStatus
  score: number
  score_max: number
  score_breakdown?: Record<string, ScoreBreakdownEntry>
  reasoning?: string
  delta_vs_favorite?: Record<string, number>
  category?: string
  energy?: number
  bpm?: number
  key?: string
  duration?: string
  artlist_url?: string
}

export interface SceneMusic {
  track?: string
  artist?: string
  original_filename?: string
  audio_asset_id?: string
  resolve_status?: ResolveStatus
  score?: number
  score_breakdown?: Record<string, ScoreBreakdownEntry>
  reasoning?: string
  recommendations?: MusicRecommendation[]
  favorite_index?: number
  search_terms?: string
  artlist_url?: string
  style?: string
  entry_cue?: string
  continuation?: string
}

export interface SceneSFX {
  timestamp: string
  description: string
  search_terms?: string
  audio_asset_id?: string
  resolve_status?: ResolveStatus
  sfx_category?: SfxCategory
  original_filename?: string
  score?: number
  score_max?: number
  artlist_url?: string
}

export const RESOLVE_COLORS: Record<ResolveStatus, { label: string; color: string; bg: string; border: string }> = {
  LOCAL: { label: '✓ Local', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
  PENDING_MATCH: { label: '⏳ Download', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' },
  PARTIAL_MATCH: { label: '~ Partial', color: '#f97316', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.3)' },
  NO_MATCH: { label: '🔗 Search', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)' },
}

export const SFX_CATEGORY_COLORS: Record<SfxCategory, { bg: string; color: string }> = {
  IMPACT: { bg: 'rgba(239,68,68,0.1)', color: '#f87171' },
  RISER: { bg: 'rgba(16,185,129,0.1)', color: '#34d399' },
  DROP: { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24' },
  TRANSITION: { bg: 'rgba(14,165,233,0.1)', color: '#38bdf8' },
  AMBIENT: { bg: 'rgba(107,114,128,0.1)', color: '#9ca3af' },
  FOLEY: { bg: 'rgba(107,114,128,0.1)', color: '#9ca3af' },
}
