import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scoreAsset, resolveAudio } from '@/lib/pipeline/audio-resolver'
import type { ResolveQuery } from '@/lib/pipeline/audio-schemas'

function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    site_id: '00000000-0000-0000-0000-000000000002',
    asset_id: 'MUSIC_01',
    original_filename: 'track.mp3',
    type: 'music' as const,
    status: 'downloaded' as const,
    category: 'cinematic',
    tags: ['cinematic', 'epic', 'powerful'],
    mood: ['inspiring', 'triumphant'],
    instruments: ['strings', 'brass', 'percussion'],
    reuse_scenarios: ['weekly_vlog', 'product_launch'],
    energy: 4,
    bpm: 100,
    duration_seconds: 120,
    metadata: {},
    version: 1,
    ...overrides,
  }
}

function fullQuery(): ResolveQuery {
  return {
    type: 'music',
    category: 'cinematic',
    tags: ['cinematic', 'epic', 'powerful'],
    mood: ['inspiring', 'triumphant'],
    instruments: ['strings', 'brass', 'percussion'],
    reuse_scenarios: ['weekly_vlog'],
    energy: 4,
    bpm_range: { min: 80, max: 120 },
    duration_range: { min: 60, max: 180 },
    limit: 5,
  }
}

describe('scoreAsset', () => {
  it('returns high score for a perfect match', () => {
    const { score, breakdown } = scoreAsset(makeAsset(), fullQuery())
    expect(breakdown.category).toBe(5)
    expect(breakdown.energy).toBe(3)
    expect(breakdown.bpm_in_range).toBe(3)
    expect(breakdown.duration_in_range).toBe(2)
    expect(breakdown.reuse_scenarios).toBe(4)
    expect(score).toBeGreaterThanOrEqual(25)
  })

  it('returns 5 for category-only match', () => {
    const asset = makeAsset({ tags: [], mood: [], instruments: [], reuse_scenarios: [], energy: null, bpm: null, duration_seconds: null })
    const query: ResolveQuery = { type: 'music', category: 'cinematic', limit: 5 }
    expect(scoreAsset(asset, query).score).toBe(5)
  })

  it('returns 0 when nothing overlaps', () => {
    const asset = makeAsset({ category: 'jazz', tags: ['relaxed'], mood: ['calm'], instruments: ['piano'], reuse_scenarios: ['podcast'], energy: 2, bpm: 70, duration_seconds: 45 })
    const query: ResolveQuery = { type: 'music', category: 'cinematic', tags: ['epic'], mood: ['intense'], instruments: ['strings'], reuse_scenarios: ['product_launch'], energy: 5, bpm_range: { min: 140, max: 180 }, duration_range: { min: 120, max: 240 }, limit: 5 }
    expect(scoreAsset(asset, query).score).toBe(0)
  })

  it('gives +3 for exact energy match', () => {
    const { breakdown } = scoreAsset(makeAsset({ energy: 3 }), { type: 'music', energy: 3, limit: 5 } as ResolveQuery)
    expect(breakdown.energy).toBe(3)
  })

  it('gives +3 for energy within ±1', () => {
    const { breakdown } = scoreAsset(makeAsset({ energy: 3 }), { type: 'music', energy: 4, limit: 5 } as ResolveQuery)
    expect(breakdown.energy).toBe(3)
  })

  it('gives 0 for energy off by 2', () => {
    const { breakdown } = scoreAsset(makeAsset({ energy: 2 }), { type: 'music', energy: 4, limit: 5 } as ResolveQuery)
    expect(breakdown.energy).toBe(0)
  })

  it('gives +3 when bpm is in range', () => {
    const { breakdown } = scoreAsset(makeAsset({ bpm: 100 }), { type: 'music', bpm_range: { min: 90, max: 110 }, limit: 5 } as ResolveQuery)
    expect(breakdown.bpm_in_range).toBe(3)
  })

  it('gives 0 when bpm is out of range', () => {
    const { breakdown } = scoreAsset(makeAsset({ bpm: 60 }), { type: 'music', bpm_range: { min: 90, max: 110 }, limit: 5 } as ResolveQuery)
    expect(breakdown.bpm_in_range).toBe(0)
  })

  it('caps tags at 8 points', () => {
    const { breakdown } = scoreAsset(makeAsset({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] }), { type: 'music', tags: ['a', 'b', 'c', 'd', 'e', 'f'], limit: 5 } as ResolveQuery)
    expect(breakdown.tags).toBe(8)
  })

  it('caps instruments at 3 points', () => {
    const { breakdown } = scoreAsset(makeAsset({ instruments: ['a', 'b', 'c', 'd'] }), { type: 'music', instruments: ['a', 'b', 'c', 'd'], limit: 5 } as ResolveQuery)
    expect(breakdown.instruments).toBe(3)
  })

  it('downloaded + score >= 8 → LOCAL', () => {
    expect(scoreAsset(makeAsset(), fullQuery()).resolve_status).toBe('LOCAL')
  })

  it('pending + score >= 8 → PENDING_MATCH', () => {
    expect(scoreAsset(makeAsset({ status: 'pending' }), fullQuery()).resolve_status).toBe('PENDING_MATCH')
  })

  it('score 4-7 → PARTIAL_MATCH', () => {
    const asset = makeAsset({ tags: [], mood: [], instruments: [], reuse_scenarios: [], energy: null, bpm: null, duration_seconds: null })
    expect(scoreAsset(asset, { type: 'music', category: 'cinematic', limit: 5 } as ResolveQuery).resolve_status).toBe('PARTIAL_MATCH')
  })

  it('score < 4 → NO_MATCH', () => {
    const asset = makeAsset({ category: null, tags: ['epic'], mood: [], instruments: [], reuse_scenarios: [], energy: null, bpm: null, duration_seconds: null })
    expect(scoreAsset(asset, { type: 'music', tags: ['epic'], limit: 5 } as ResolveQuery).resolve_status).toBe('NO_MATCH')
  })
})

describe('resolveAudio', () => {
  it('returns sorted matches with query_time_ms', async () => {
    const mockData = [
      makeAsset({ asset_id: 'low', tags: [], mood: [], instruments: [], reuse_scenarios: [], category: null, energy: null, bpm: null, duration_seconds: null }),
      makeAsset({ asset_id: 'high' }),
    ]
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        overlaps: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        textSearch: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      }),
    }

    const result = await resolveAudio(mockSupabase as never, 'site-id', fullQuery())
    expect(result.matches.length).toBeGreaterThan(0)
    expect(result.query_time_ms).toBeGreaterThanOrEqual(0)
    expect(result.matches[0].asset.asset_id).toBe('high')
  })

  it('returns empty matches when no candidates', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        overlaps: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        textSearch: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }
    const result = await resolveAudio(mockSupabase as never, 'site-id', fullQuery())
    expect(result.matches).toHaveLength(0)
  })

  it('throws on supabase error', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        overlaps: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        textSearch: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'connection refused' } }),
      }),
    }
    await expect(resolveAudio(mockSupabase as never, 'site-id', fullQuery())).rejects.toThrow('connection refused')
  })

  it('filters out zero-score assets', async () => {
    const zeroScoreAsset = makeAsset({ category: 'jazz', tags: ['relaxed'], mood: ['calm'], instruments: ['piano'], reuse_scenarios: ['podcast'], energy: 2, bpm: 70, duration_seconds: 45 })
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        overlaps: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        textSearch: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [zeroScoreAsset], error: null }),
      }),
    }
    const result = await resolveAudio(mockSupabase as never, 'site-id', fullQuery())
    expect(result.matches).toHaveLength(0)
  })
})
