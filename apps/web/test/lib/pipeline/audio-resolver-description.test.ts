import { describe, it, expect } from 'vitest'
import { scoreAsset } from '@/lib/pipeline/audio-resolver'
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
    tags: ['cinematic'],
    mood: ['inspiring'],
    instruments: ['strings'],
    reuse_scenarios: [],
    energy: 3,
    bpm: 100,
    duration_seconds: 120,
    metadata: {},
    version: 1,
    ...overrides,
  }
}

describe('scoreAsset description scoring', () => {
  it('awards +2 when description is provided', () => {
    const query: ResolveQuery = { type: 'music', description: 'epic cinematic', limit: 5 }
    const { breakdown } = scoreAsset(makeAsset() as never, query)
    expect(breakdown.description).toBe(2)
  })

  it('awards 0 when no description', () => {
    const query: ResolveQuery = { type: 'music', category: 'cinematic', limit: 5 }
    const { breakdown } = scoreAsset(makeAsset() as never, query)
    expect(breakdown.description).toBe(0)
  })
})
