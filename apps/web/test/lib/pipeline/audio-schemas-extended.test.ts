import { describe, it, expect } from 'vitest'
import { AudioAssetCreateSchema, AudioAssetUpdateSchema, ResolveQuerySchema, ImportSchema, AudioUsageCreateSchema, ImportItemSchema } from '@/lib/pipeline/audio-schemas'

describe('AudioAssetCreateSchema extended', () => {
  it('accepts valid music asset with minimal fields', () => {
    const result = AudioAssetCreateSchema.safeParse({
      asset_id: 'MUSIC_01',
      original_filename: 'track.mp3',
      type: 'music',
      tags: ['cinematic'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid type', () => {
    const result = AudioAssetCreateSchema.safeParse({
      asset_id: 'X',
      original_filename: 'x.mp3',
      type: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects energy out of range (10)', () => {
    const result = AudioAssetCreateSchema.safeParse({
      asset_id: 'X',
      original_filename: 'x.mp3',
      type: 'music',
      energy: 10,
    })
    expect(result.success).toBe(false)
  })

  it('defaults tags to empty array when omitted', () => {
    const result = AudioAssetCreateSchema.safeParse({
      asset_id: 'X',
      original_filename: 'x.mp3',
      type: 'sfx',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.tags).toEqual([])
  })
})

describe('AudioAssetUpdateSchema extended', () => {
  it('requires version', () => {
    const result = AudioAssetUpdateSchema.safeParse({ tags: ['new'] })
    expect(result.success).toBe(false)
  })

  it('strips omitted asset_id from parsed data', () => {
    const result = AudioAssetUpdateSchema.safeParse({ version: 1, asset_id: 'NEW_ID' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).not.toHaveProperty('asset_id')
  })

  it('strips omitted type from parsed data', () => {
    const result = AudioAssetUpdateSchema.safeParse({ version: 1, type: 'sfx' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).not.toHaveProperty('type')
  })

  it('accepts valid partial update', () => {
    const result = AudioAssetUpdateSchema.safeParse({ version: 2, energy: 4, tags: ['updated'] })
    expect(result.success).toBe(true)
  })
})

describe('ResolveQuerySchema extended', () => {
  it('defaults limit to 5 when omitted', () => {
    const result = ResolveQuerySchema.safeParse({ type: 'music' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(5)
  })

  it('rejects limit above 20', () => {
    const result = ResolveQuerySchema.safeParse({ type: 'sfx', limit: 50 })
    expect(result.success).toBe(false)
  })

  it('accepts bpm_range and duration_range together', () => {
    const result = ResolveQuerySchema.safeParse({
      type: 'music',
      bpm_range: { min: 80, max: 120 },
      duration_range: { min: 30, max: 180 },
    })
    expect(result.success).toBe(true)
  })
})

describe('ImportSchema extended', () => {
  it('accepts valid import payload with defaults', () => {
    const result = ImportSchema.safeParse({
      schema_version: '6.1.0',
      music: [{ asset_id: 'M1', original_filename: 'track.mp3' }],
      sfx: [],
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.dry_run).toBe(false)
  })

  it('rejects music array over 500 items', () => {
    const items = Array.from({ length: 501 }, (_, i) => ({ asset_id: `M${i}` }))
    const result = ImportSchema.safeParse({
      schema_version: '6.1.0',
      music: items,
    })
    expect(result.success).toBe(false)
  })

  it('defaults dry_run to false when omitted', () => {
    const result = ImportSchema.safeParse({
      schema_version: '6.1.0',
      music: [],
      sfx: [],
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.dry_run).toBe(false)
  })
})

describe('ImportItemSchema strips unknown fields', () => {
  it('strips unknown fields (no passthrough)', () => {
    const result = ImportItemSchema.safeParse({
      asset_id: 'M1',
      original_filename: 'track.mp3',
      malicious_field: '<script>alert(1)</script>',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).not.toHaveProperty('malicious_field')
  })

  it('preserves known metadata fields', () => {
    const result = ImportItemSchema.safeParse({
      asset_id: 'M1',
      mix_notes: 'Boost bass at 80Hz',
      pairs_well_with: ['M2', 'M3'],
      avoid_with: ['S1'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.mix_notes).toBe('Boost bass at 80Hz')
      expect(result.data.pairs_well_with).toEqual(['M2', 'M3'])
    }
  })
})

describe('AudioUsageCreateSchema', () => {
  it('accepts valid usage record', () => {
    const result = AudioUsageCreateSchema.safeParse({
      audio_asset_id: '00000000-0000-0000-0000-000000000001',
      pipeline_item_id: '00000000-0000-0000-0000-000000000002',
      usage_type: 'background',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID audio_asset_id', () => {
    const result = AudioUsageCreateSchema.safeParse({
      audio_asset_id: 'not-a-uuid',
      pipeline_item_id: '00000000-0000-0000-0000-000000000002',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid usage_type', () => {
    const result = AudioUsageCreateSchema.safeParse({
      audio_asset_id: '00000000-0000-0000-0000-000000000001',
      pipeline_item_id: '00000000-0000-0000-0000-000000000002',
      usage_type: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('defaults usage_type to background', () => {
    const result = AudioUsageCreateSchema.safeParse({
      audio_asset_id: '00000000-0000-0000-0000-000000000001',
      pipeline_item_id: '00000000-0000-0000-0000-000000000002',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.usage_type).toBe('background')
  })

  it('accepts all valid usage types', () => {
    for (const ut of ['background', 'sfx', 'transition', 'intro', 'outro']) {
      const result = AudioUsageCreateSchema.safeParse({
        audio_asset_id: '00000000-0000-0000-0000-000000000001',
        pipeline_item_id: '00000000-0000-0000-0000-000000000002',
        usage_type: ut,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts optional scene_number and notes', () => {
    const result = AudioUsageCreateSchema.safeParse({
      audio_asset_id: '00000000-0000-0000-0000-000000000001',
      pipeline_item_id: '00000000-0000-0000-0000-000000000002',
      scene_number: 3,
      notes: 'Background for intro sequence',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.scene_number).toBe(3)
      expect(result.data.notes).toBe('Background for intro sequence')
    }
  })
})
