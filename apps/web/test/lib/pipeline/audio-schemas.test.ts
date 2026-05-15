import { describe, it, expect } from 'vitest'
import {
  AudioAssetCreateSchema,
  AudioAssetUpdateSchema,
  ResolveQuerySchema,
  ImportSchema,
  AudioUsageCreateSchema,
} from '@/lib/pipeline/audio-schemas'

const baseMusic = {
  asset_id: 'MUSIC_01',
  original_filename: 'epic_track.mp3',
  type: 'music' as const,
  track_name: 'Epic Journey',
  artist: 'Some Artist',
  energy: 4,
  tags: ['cinematic', 'epic'],
  mood: ['inspiring'],
  instruments: ['strings', 'brass'],
}

const baseSfx = {
  asset_id: 'SFX_RISER_01',
  original_filename: 'whoosh.wav',
  type: 'sfx' as const,
}

describe('AudioAssetCreateSchema', () => {
  it('accepts a valid music asset', () => {
    const result = AudioAssetCreateSchema.safeParse(baseMusic)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('downloaded')
      expect(result.data.reusable).toBe(true)
    }
  })

  it('accepts a valid SFX asset with minimal fields', () => {
    const result = AudioAssetCreateSchema.safeParse(baseSfx)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tags).toEqual([])
      expect(result.data.mood).toEqual([])
    }
  })

  it('rejects missing asset_id', () => {
    const { asset_id: _, ...rest } = baseMusic
    expect(AudioAssetCreateSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing original_filename', () => {
    const { original_filename: _, ...rest } = baseMusic
    expect(AudioAssetCreateSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects invalid type', () => {
    expect(AudioAssetCreateSchema.safeParse({ ...baseMusic, type: 'podcast' }).success).toBe(false)
  })

  it('rejects invalid status', () => {
    expect(AudioAssetCreateSchema.safeParse({ ...baseMusic, status: 'archived' }).success).toBe(false)
  })

  it('rejects energy = 0', () => {
    expect(AudioAssetCreateSchema.safeParse({ ...baseMusic, energy: 0 }).success).toBe(false)
  })

  it('rejects energy = 6', () => {
    expect(AudioAssetCreateSchema.safeParse({ ...baseMusic, energy: 6 }).success).toBe(false)
  })

  it('accepts energy boundaries (1 and 5)', () => {
    expect(AudioAssetCreateSchema.safeParse({ ...baseMusic, energy: 1 }).success).toBe(true)
    expect(AudioAssetCreateSchema.safeParse({ ...baseMusic, energy: 5 }).success).toBe(true)
  })

  it('rejects invalid artlist_url', () => {
    expect(AudioAssetCreateSchema.safeParse({ ...baseMusic, artlist_url: 'not-url' }).success).toBe(false)
  })
})

describe('AudioAssetUpdateSchema', () => {
  it('accepts partial update with version', () => {
    const result = AudioAssetUpdateSchema.safeParse({ version: 2, track_name: 'New Title' })
    expect(result.success).toBe(true)
  })

  it('rejects update without version', () => {
    expect(AudioAssetUpdateSchema.safeParse({ track_name: 'New' }).success).toBe(false)
  })
})

describe('ResolveQuerySchema', () => {
  it('accepts full resolve query with nested ranges', () => {
    const result = ResolveQuerySchema.safeParse({
      type: 'music',
      category: 'cinematic',
      tags: ['epic'],
      energy: 4,
      bpm_range: { min: 80, max: 120 },
      duration_range: { min: 30, max: 180 },
      limit: 5,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.bpm_range?.min).toBe(80)
      expect(result.data.duration_range?.max).toBe(180)
    }
  })

  it('rejects bpm_range with missing max', () => {
    expect(ResolveQuerySchema.safeParse({ type: 'music', bpm_range: { min: 80 } }).success).toBe(false)
  })
})

describe('ImportSchema', () => {
  it('accepts valid import payload', () => {
    const result = ImportSchema.safeParse({
      schema_version: '6.1.0',
      dry_run: true,
      music: [{ asset_id: 'a1' }],
      sfx: [{ asset_id: 's1' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.dry_run).toBe(true)
      expect(result.data.music).toHaveLength(1)
    }
  })

  it('applies default dry_run = false', () => {
    const result = ImportSchema.safeParse({ schema_version: '6.1.0' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.dry_run).toBe(false)
  })
})

describe('AudioUsageCreateSchema', () => {
  it('accepts valid usage record', () => {
    const result = AudioUsageCreateSchema.safeParse({
      audio_asset_id: '00000000-0000-0000-0000-000000000001',
      pipeline_item_id: '00000000-0000-0000-0000-000000000002',
      usage_type: 'intro',
      scene_number: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid usage_type', () => {
    expect(AudioUsageCreateSchema.safeParse({
      audio_asset_id: '00000000-0000-0000-0000-000000000001',
      pipeline_item_id: '00000000-0000-0000-0000-000000000002',
      usage_type: 'voiceover',
    }).success).toBe(false)
  })
})
