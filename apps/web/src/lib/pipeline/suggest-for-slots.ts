import { STAGE_ORDER, LOCALE_TO_LANGUAGE } from './up-next-constants'
import type { Stage } from './up-next-constants'
import type { SlotCandidate, WeekSlot } from './up-next-types'

/* ------------------------------------------------------------------ */
/*  groupCandidatesByPlaylist                                          */
/* ------------------------------------------------------------------ */

export interface PlaylistGroup {
  playlistId: string | null
  playlistName: string
  items: SlotCandidate[]
  progress: { done: number; total: number }
  nearCompletion: boolean
}

export function groupCandidatesByPlaylist(candidates: SlotCandidate[]): PlaylistGroup[] {
  if (candidates.length === 0) return []
  const map = new Map<string | null, SlotCandidate[]>()
  for (const c of candidates) {
    const key = c.playlist_id
    const group = map.get(key)
    if (group) group.push(c)
    else map.set(key, [c])
  }
  const groups: PlaylistGroup[] = []
  for (const [playlistId, items] of map) {
    // Sort items within group by playlist_position ascending
    items.sort((a, b) => (a.playlist_position ?? 0) - (b.playlist_position ?? 0))

    const first = items[0]!
    const total = first.playlist_total ?? items.length
    const position = Math.max(...items.map(i => i.playlist_position ?? 0))
    const done = playlistId ? position : 0
    const remaining = total - done
    groups.push({
      playlistId: playlistId ?? null,
      playlistName: playlistId ? (first.playlist_name ?? 'Playlist') : 'Avulsos',
      items,
      progress: { done, total },
      nearCompletion: playlistId !== null && total > 0 && remaining / total <= 0.2,
    })
  }
  groups.sort((a, b) => {
    if (a.playlistId === null) return 1
    if (b.playlistId === null) return -1
    if (a.nearCompletion !== b.nearCompletion) return a.nearCompletion ? -1 : 1
    return b.progress.total - a.progress.total
  })
  return groups
}

/* ------------------------------------------------------------------ */
/*  suggestForSlot                                                     */
/* ------------------------------------------------------------------ */

export interface SlotSuggestion {
  candidate: SlotCandidate
  reason: 'progressed' | 'playlist_rotation' | 'backlog'
  reasonLabel: string
  score: number
}

const EXCLUDED_STAGES: Set<Stage> = new Set(['scheduled', 'published'])

export function suggestForSlot(
  slot: WeekSlot,
  candidates: SlotCandidate[],
  weekSlots: WeekSlot[],
  maxSuggestions = 5,
): SlotSuggestion[] {
  // Collect IDs already assigned in any slot this week
  const assignedIds = new Set<string>()
  for (const ws of weekSlots) {
    if (ws.assignedItem) assignedIds.add(ws.assignedItem.id)
  }

  // Collect playlist IDs that already have an item assigned this week
  const assignedPlaylistIds = new Set<string>()
  for (const c of candidates) {
    if (c.playlist_id && assignedIds.has(c.id)) {
      assignedPlaylistIds.add(c.playlist_id)
    }
  }

  // Determine the target language from channelLocale
  const targetLang = slot.channelLocale ? LOCALE_TO_LANGUAGE[slot.channelLocale] : null

  // Filter candidates
  const filtered = candidates.filter(c => {
    if (c.format !== slot.format) return false
    if (EXCLUDED_STAGES.has(c.stage)) return false
    if (assignedIds.has(c.id)) return false
    if (targetLang && c.language !== targetLang && c.language !== 'both') return false
    return true
  })

  // Score and tag each candidate
  const suggestions: SlotSuggestion[] = filtered.map(c => {
    const stageScore = STAGE_ORDER[c.stage] * 10
    const playlistPenalty = c.playlist_id && assignedPlaylistIds.has(c.playlist_id) ? 30 : 0
    const score = stageScore - playlistPenalty

    let reason: SlotSuggestion['reason']
    let reasonLabel: string

    if (stageScore >= 60) {
      reason = 'progressed'
      reasonLabel = `Avançado (${c.stage})`
    } else if (playlistPenalty === 0 && c.playlist_id) {
      reason = 'playlist_rotation'
      reasonLabel = 'Rodízio de playlist'
    } else {
      reason = 'backlog'
      reasonLabel = 'No backlog'
    }

    return { candidate: c, reason, reasonLabel, score }
  })

  // Sort descending by score
  suggestions.sort((a, b) => b.score - a.score)

  return suggestions.slice(0, maxSuggestions)
}
