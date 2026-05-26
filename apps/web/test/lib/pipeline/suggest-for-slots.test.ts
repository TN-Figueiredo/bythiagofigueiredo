import { describe, it, expect } from 'vitest'
import {
  groupCandidatesByPlaylist,
  suggestForSlot,
  type PlaylistGroup,
  type SlotSuggestion,
} from '@/lib/pipeline/suggest-for-slots'
import type { SlotCandidate, WeekSlot } from '@/lib/pipeline/up-next-types'
import type { Stage } from '@/lib/pipeline/up-next-constants'

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function makeCandidate(overrides: Partial<SlotCandidate> = {}): SlotCandidate {
  return {
    id: 'item-1',
    title: 'Test Item',
    stage: 'draft' as Stage,
    format: 'video',
    language: 'pt-br',
    playlist_id: null,
    playlist_name: null,
    playlist_position: null,
    playlist_total: null,
    ...overrides,
  }
}

function makeSlot(overrides: Partial<WeekSlot> = {}): WeekSlot {
  return {
    day: '2026-05-26',
    dayLabel: 'Ter',
    hour: '10:00',
    format: 'video',
    channelLocale: null,
    channelId: null,
    isRestDay: false,
    assignedItem: null,
    effortMinutes: 120,
    ...overrides,
  }
}

/* ================================================================== */
/*  groupCandidatesByPlaylist                                          */
/* ================================================================== */

describe('groupCandidatesByPlaylist', () => {
  it('returns empty array for empty input', () => {
    expect(groupCandidatesByPlaylist([])).toEqual([])
  })

  it('groups items without playlist into "Avulsos"', () => {
    const candidates = [
      makeCandidate({ id: 'a' }),
      makeCandidate({ id: 'b' }),
    ]
    const groups = groupCandidatesByPlaylist(candidates)
    expect(groups).toHaveLength(1)
    expect(groups[0].playlistId).toBeNull()
    expect(groups[0].playlistName).toBe('Avulsos')
    expect(groups[0].items).toHaveLength(2)
  })

  it('groups items by playlist_id correctly', () => {
    const candidates = [
      makeCandidate({ id: 'a', playlist_id: 'pl-1', playlist_name: 'Series A', playlist_position: 1, playlist_total: 5 }),
      makeCandidate({ id: 'b', playlist_id: 'pl-2', playlist_name: 'Series B', playlist_position: 1, playlist_total: 3 }),
      makeCandidate({ id: 'c', playlist_id: 'pl-1', playlist_name: 'Series A', playlist_position: 2, playlist_total: 5 }),
    ]
    const groups = groupCandidatesByPlaylist(candidates)
    const pl1 = groups.find(g => g.playlistId === 'pl-1')
    const pl2 = groups.find(g => g.playlistId === 'pl-2')
    expect(pl1).toBeDefined()
    expect(pl1!.items).toHaveLength(2)
    expect(pl2).toBeDefined()
    expect(pl2!.items).toHaveLength(1)
  })

  it('sorts near-completion playlists first', () => {
    // pl-near: 9 of 10 done (1 remain = 10%, near completion)
    // pl-far: 1 of 10 done (9 remain = 90%, not near)
    const candidates = [
      makeCandidate({ id: 'a', playlist_id: 'pl-far', playlist_name: 'Far', playlist_position: 1, playlist_total: 10 }),
      makeCandidate({ id: 'b', playlist_id: 'pl-near', playlist_name: 'Near', playlist_position: 9, playlist_total: 10 }),
    ]
    const groups = groupCandidatesByPlaylist(candidates)
    expect(groups[0].playlistId).toBe('pl-near')
    expect(groups[0].nearCompletion).toBe(true)
    expect(groups[1].playlistId).toBe('pl-far')
    expect(groups[1].nearCompletion).toBe(false)
  })

  it('sets nearCompletion when remaining ≤ 20%', () => {
    // 8 of 10 done → 2 remain → 20% → near completion
    const candidates = [
      makeCandidate({ id: 'a', playlist_id: 'pl-1', playlist_name: 'Almost Done', playlist_position: 8, playlist_total: 10 }),
    ]
    const groups = groupCandidatesByPlaylist(candidates)
    expect(groups[0].nearCompletion).toBe(true)

    // 7 of 10 done → 3 remain → 30% → NOT near completion
    const candidates2 = [
      makeCandidate({ id: 'b', playlist_id: 'pl-2', playlist_name: 'Not Done', playlist_position: 7, playlist_total: 10 }),
    ]
    const groups2 = groupCandidatesByPlaylist(candidates2)
    expect(groups2[0].nearCompletion).toBe(false)
  })

  it('always places Avulsos last', () => {
    const candidates = [
      makeCandidate({ id: 'a' }), // no playlist → Avulsos
      makeCandidate({ id: 'b', playlist_id: 'pl-1', playlist_name: 'Series A', playlist_position: 1, playlist_total: 5 }),
    ]
    const groups = groupCandidatesByPlaylist(candidates)
    expect(groups[groups.length - 1].playlistId).toBeNull()
    expect(groups[groups.length - 1].playlistName).toBe('Avulsos')
  })

  it('sorts items by playlist_position within group', () => {
    const candidates = [
      makeCandidate({ id: 'c', playlist_id: 'pl-1', playlist_name: 'S', playlist_position: 3, playlist_total: 5 }),
      makeCandidate({ id: 'a', playlist_id: 'pl-1', playlist_name: 'S', playlist_position: 1, playlist_total: 5 }),
      makeCandidate({ id: 'b', playlist_id: 'pl-1', playlist_name: 'S', playlist_position: 2, playlist_total: 5 }),
    ]
    const groups = groupCandidatesByPlaylist(candidates)
    expect(groups[0].items.map(i => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('computes progress correctly', () => {
    const candidates = [
      makeCandidate({ id: 'a', playlist_id: 'pl-1', playlist_name: 'S', playlist_position: 3, playlist_total: 10 }),
      makeCandidate({ id: 'b', playlist_id: 'pl-1', playlist_name: 'S', playlist_position: 7, playlist_total: 10 }),
    ]
    const groups = groupCandidatesByPlaylist(candidates)
    // done = max position = 7, total = 10
    expect(groups[0].progress).toEqual({ done: 7, total: 10 })
  })

  it('computes progress for Avulsos group', () => {
    const candidates = [
      makeCandidate({ id: 'a' }),
      makeCandidate({ id: 'b' }),
      makeCandidate({ id: 'c' }),
    ]
    const groups = groupCandidatesByPlaylist(candidates)
    // Avulsos: done = 0, total = items.length
    expect(groups[0].progress).toEqual({ done: 0, total: 3 })
  })
})

/* ================================================================== */
/*  suggestForSlot                                                     */
/* ================================================================== */

describe('suggestForSlot', () => {
  it('returns empty array for empty candidates', () => {
    const slot = makeSlot()
    expect(suggestForSlot(slot, [], [])).toEqual([])
  })

  it('filters by format match', () => {
    const slot = makeSlot({ format: 'blog_post' })
    const candidates = [
      makeCandidate({ id: 'vid', format: 'video', stage: 'draft' }),
      makeCandidate({ id: 'blog', format: 'blog_post', stage: 'draft' }),
    ]
    const result = suggestForSlot(slot, candidates, [])
    expect(result).toHaveLength(1)
    expect(result[0].candidate.id).toBe('blog')
  })

  it('excludes already-assigned items', () => {
    const slot = makeSlot()
    const otherSlot = makeSlot({
      day: '2026-05-27',
      assignedItem: { id: 'assigned-1', title: 'Assigned', stage: 'draft' },
    })
    const candidates = [
      makeCandidate({ id: 'assigned-1', stage: 'draft' }),
      makeCandidate({ id: 'free-1', stage: 'draft' }),
    ]
    const result = suggestForSlot(slot, candidates, [slot, otherSlot])
    expect(result).toHaveLength(1)
    expect(result[0].candidate.id).toBe('free-1')
  })

  it('excludes scheduled and published stages', () => {
    const slot = makeSlot()
    const candidates = [
      makeCandidate({ id: 'a', stage: 'scheduled' }),
      makeCandidate({ id: 'b', stage: 'published' }),
      makeCandidate({ id: 'c', stage: 'draft' }),
    ]
    const result = suggestForSlot(slot, candidates, [])
    expect(result).toHaveLength(1)
    expect(result[0].candidate.id).toBe('c')
  })

  it('ranks progressed items higher', () => {
    const slot = makeSlot()
    const candidates = [
      makeCandidate({ id: 'idea', stage: 'idea' }),       // score: 0*10 = 0
      makeCandidate({ id: 'edicao', stage: 'edicao' }),   // score: 5*10 = 50
      makeCandidate({ id: 'ready', stage: 'ready' }),     // score: 7*10 = 70
    ]
    const result = suggestForSlot(slot, candidates, [])
    expect(result[0].candidate.id).toBe('ready')
    expect(result[1].candidate.id).toBe('edicao')
    expect(result[2].candidate.id).toBe('idea')
  })

  it('penalizes playlists already assigned this week', () => {
    const assignedSlot = makeSlot({
      day: '2026-05-27',
      assignedItem: { id: 'other-ep', title: 'Ep 1', stage: 'draft' },
    })
    // Two candidates at same stage, but one's playlist is already assigned
    const candidates = [
      makeCandidate({
        id: 'ep2',
        stage: 'edicao', // score: 50 - 30 = 20
        playlist_id: 'pl-1',
        playlist_name: 'Series',
        playlist_position: 2,
        playlist_total: 5,
      }),
      makeCandidate({
        id: 'standalone',
        stage: 'edicao', // score: 50
      }),
    ]
    // 'other-ep' belongs to 'pl-1' — we need it in weekSlots with that playlist
    // Actually, the assigned item only has id/title/stage. The penalty checks
    // if the candidate's playlist_id matches any assigned item's id that is in
    // the same playlist. Let me re-read the spec:
    // "score: -30 if playlist already has item assigned this week"
    // This means: if any weekSlot has an assignedItem whose id matches another
    // candidate from the same playlist_id. We need the candidates list to check.
    // Actually, I think the penalty checks: among all weekSlots' assignedItems,
    // is there any item whose playlist matches the candidate's playlist?
    // Since assignedItem only has {id, title, stage}, we need to cross-reference
    // with candidates. Let me think about this differently:
    // The simplest interpretation: check if any other candidate with the same
    // playlist_id is already assigned in weekSlots.
    // Let me adjust: make 'other-ep' also be a candidate with same playlist_id.
    const allCandidates = [
      makeCandidate({
        id: 'other-ep',
        stage: 'draft',
        playlist_id: 'pl-1',
        playlist_name: 'Series',
        playlist_position: 1,
        playlist_total: 5,
      }),
      ...candidates,
    ]
    const slot = makeSlot()
    const result = suggestForSlot(slot, allCandidates, [slot, assignedSlot])
    // 'other-ep' is assigned so excluded from results
    // 'standalone' (edicao, score 50) should rank above 'ep2' (edicao, score 50-30=20)
    const ids = result.map(r => r.candidate.id)
    expect(ids.indexOf('standalone')).toBeLessThan(ids.indexOf('ep2'))
    expect(result.find(r => r.candidate.id === 'standalone')!.score).toBeGreaterThan(
      result.find(r => r.candidate.id === 'ep2')!.score,
    )
  })

  it('respects maxSuggestions limit', () => {
    const slot = makeSlot()
    const candidates = Array.from({ length: 10 }, (_, i) =>
      makeCandidate({ id: `item-${i}`, stage: 'draft' }),
    )
    const result = suggestForSlot(slot, candidates, [], 3)
    expect(result).toHaveLength(3)
  })

  it('defaults maxSuggestions to 5', () => {
    const slot = makeSlot()
    const candidates = Array.from({ length: 10 }, (_, i) =>
      makeCandidate({ id: `item-${i}`, stage: 'draft' }),
    )
    const result = suggestForSlot(slot, candidates, [])
    expect(result).toHaveLength(5)
  })

  it('tags reason correctly for each suggestion', () => {
    const slot = makeSlot()
    const candidates = [
      // ready = stage 7, score 70 ≥ 60 → 'progressed'
      makeCandidate({ id: 'progressed', stage: 'ready' }),
      // idea = stage 0, score 0 < 60, no playlist → 'backlog'
      makeCandidate({ id: 'backlog', stage: 'idea' }),
      // edicao = stage 5, score 50 < 60, has playlist, no penalty → 'playlist_rotation'
      makeCandidate({
        id: 'rotation',
        stage: 'edicao',
        playlist_id: 'pl-1',
        playlist_name: 'S',
        playlist_position: 1,
        playlist_total: 5,
      }),
    ]
    const result = suggestForSlot(slot, candidates, [])

    expect(result.find(r => r.candidate.id === 'progressed')!.reason).toBe('progressed')
    expect(result.find(r => r.candidate.id === 'progressed')!.reasonLabel).toBe('Avançado (ready)')

    expect(result.find(r => r.candidate.id === 'backlog')!.reason).toBe('backlog')
    expect(result.find(r => r.candidate.id === 'backlog')!.reasonLabel).toBe('No backlog')

    expect(result.find(r => r.candidate.id === 'rotation')!.reason).toBe('playlist_rotation')
    expect(result.find(r => r.candidate.id === 'rotation')!.reasonLabel).toBe('Rodízio de playlist')
  })

  it('filters by language compatibility when channelLocale is set', () => {
    const slot = makeSlot({ channelLocale: 'pt' })
    const candidates = [
      makeCandidate({ id: 'pt', language: 'pt-br', stage: 'draft' }),
      makeCandidate({ id: 'en', language: 'en', stage: 'draft' }),
      makeCandidate({ id: 'both', language: 'both', stage: 'draft' }),
    ]
    const result = suggestForSlot(slot, candidates, [])
    const ids = result.map(r => r.candidate.id)
    expect(ids).toContain('pt')
    expect(ids).toContain('both')
    expect(ids).not.toContain('en')
  })

  it('does not filter by language when channelLocale is null', () => {
    const slot = makeSlot({ channelLocale: null })
    const candidates = [
      makeCandidate({ id: 'pt', language: 'pt-br', stage: 'draft' }),
      makeCandidate({ id: 'en', language: 'en', stage: 'draft' }),
    ]
    const result = suggestForSlot(slot, candidates, [])
    expect(result).toHaveLength(2)
  })
})
