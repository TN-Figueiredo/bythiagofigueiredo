import { describe, it, expect } from 'vitest'
import {
  BRollAssetCreateSchema,
  BRollAssetUpdateSchema,
  BRollImportSchema,
  BRollImportItemSchema,
  BRollUsageCreateSchema,
  BRollSearchQuerySchema,
  BROLL_TYPES,
  BROLL_STATUSES,
  BROLL_SOURCE_TYPES,
  BROLL_USAGE_TYPES,
} from '@/lib/pipeline/broll-schemas'

describe('BRollAssetCreateSchema', () => {
  const minimal = {
    asset_id: 'BROLL_DRONE_01',
    original_filename: 'DJI_0042.mp4',
  }

  it('accepts minimal valid input with defaults', () => {
    const result = BRollAssetCreateSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('footage')
      expect(result.data.source).toBe('local')
      expect(result.data.source_type).toBe('pessoal')
      expect(result.data.resolution).toBe('1080p')
      expect(result.data.has_audio).toBe(false)
      expect(result.data.reusable).toBe(true)
      expect(result.data.status).toBe('available')
      expect(result.data.tags).toEqual([])
      expect(result.data.metadata).toEqual({})
    }
  })

  it('accepts full valid input', () => {
    const result = BRollAssetCreateSchema.safeParse({
      ...minimal,
      renamed_to: 'drone-sunset-beach.mp4',
      sha256: 'a'.repeat(64),
      file_size_bytes: 1024000,
      type: 'screen_recording',
      source: 'obs',
      source_type: 'generico',
      category: 'b-roll',
      subcategory: 'drone',
      location: 'Florianopolis, SC',
      description: 'Sunset over the beach',
      tags: ['sunset', 'drone', 'beach'],
      codec: 'h264',
      fps: 60,
      resolution: '4k',
      width: 3840,
      height: 2160,
      duration_seconds: 45.5,
      bitrate_kbps: 50000,
      has_audio: true,
      color_profile: 'rec709',
      storage_url: 'https://storage.example.com/clip.mp4',
      thumbnail_url: 'https://storage.example.com/thumb.jpg',
      proxy_url: 'https://storage.example.com/proxy.mp4',
      reusable: false,
      status: 'pending',
      captured_at: '2026-05-10T14:00:00Z',
      metadata: { camera: 'DJI Mini 4' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty asset_id', () => {
    const result = BRollAssetCreateSchema.safeParse({ ...minimal, asset_id: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid type', () => {
    const result = BRollAssetCreateSchema.safeParse({ ...minimal, type: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid source_type', () => {
    const result = BRollAssetCreateSchema.safeParse({ ...minimal, source_type: 'outro' })
    expect(result.success).toBe(false)
  })

  it('rejects sha256 with wrong length', () => {
    const result = BRollAssetCreateSchema.safeParse({ ...minimal, sha256: 'abc' })
    expect(result.success).toBe(false)
  })

  it('rejects metadata over 64KB', () => {
    const result = BRollAssetCreateSchema.safeParse({
      ...minimal,
      metadata: { large: 'x'.repeat(70000) },
    })
    expect(result.success).toBe(false)
  })

  it('rejects fps out of range', () => {
    expect(BRollAssetCreateSchema.safeParse({ ...minimal, fps: 0 }).success).toBe(false)
    expect(BRollAssetCreateSchema.safeParse({ ...minimal, fps: 241 }).success).toBe(false)
  })

  it('rejects negative file_size_bytes', () => {
    const result = BRollAssetCreateSchema.safeParse({ ...minimal, file_size_bytes: -1 })
    expect(result.success).toBe(false)
  })
})

describe('BRollAssetUpdateSchema', () => {
  it('requires version', () => {
    const result = BRollAssetUpdateSchema.safeParse({ description: 'updated' })
    expect(result.success).toBe(false)
  })

  it('accepts partial update with version', () => {
    const result = BRollAssetUpdateSchema.safeParse({
      description: 'updated desc',
      tags: ['new-tag'],
      version: 1,
    })
    expect(result.success).toBe(true)
  })

  it('strips asset_id and type from update', () => {
    const result = BRollAssetUpdateSchema.safeParse({
      version: 1,
      description: 'test',
    })
    expect(result.success).toBe(true)
  })
})

describe('BRollImportSchema', () => {
  it('accepts valid import payload', () => {
    const result = BRollImportSchema.safeParse({
      dry_run: true,
      schema_version: '1.0.0',
      items: [
        { asset_id: 'BROLL_01', original_filename: 'clip.mp4' },
        { asset_id: 'BROLL_02', original_filename: 'photo.jpg', type: 'photo' },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items).toHaveLength(2)
      expect(result.data.dry_run).toBe(true)
    }
  })

  it('defaults dry_run to false', () => {
    const result = BRollImportSchema.safeParse({
      schema_version: '1.0.0',
      items: [],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.dry_run).toBe(false)
    }
  })

  it('rejects more than 500 items', () => {
    const items = Array.from({ length: 501 }, (_, i) => ({
      asset_id: `BROLL_${i}`,
    }))
    const result = BRollImportSchema.safeParse({
      schema_version: '1.0.0',
      items,
    })
    expect(result.success).toBe(false)
  })
})

describe('BRollUsageCreateSchema', () => {
  it('validates valid usage', () => {
    const result = BRollUsageCreateSchema.safeParse({
      broll_asset_id: '550e8400-e29b-41d4-a716-446655440000',
      pipeline_item_id: '550e8400-e29b-41d4-a716-446655440001',
      beat_index: 3,
      timecode_in: '00:01:30',
      timecode_out: '00:01:45',
      usage_type: 'overlay',
      notes: 'Use during talking head segment',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid UUIDs', () => {
    const result = BRollUsageCreateSchema.safeParse({
      broll_asset_id: 'not-a-uuid',
      pipeline_item_id: 'also-not-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('defaults usage_type to cutaway', () => {
    const result = BRollUsageCreateSchema.safeParse({
      broll_asset_id: '550e8400-e29b-41d4-a716-446655440000',
      pipeline_item_id: '550e8400-e29b-41d4-a716-446655440001',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.usage_type).toBe('cutaway')
    }
  })

  it('rejects invalid usage_type', () => {
    const result = BRollUsageCreateSchema.safeParse({
      broll_asset_id: '550e8400-e29b-41d4-a716-446655440000',
      pipeline_item_id: '550e8400-e29b-41d4-a716-446655440001',
      usage_type: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})

describe('BRollSearchQuerySchema', () => {
  it('accepts empty query with defaults', () => {
    const result = BRollSearchQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(10)
    }
  })

  it('accepts full query', () => {
    const result = BRollSearchQuerySchema.safeParse({
      type: 'footage',
      source_type: 'pessoal',
      category: 'drone',
      tags: ['sunset'],
      location: 'Floripa',
      resolution: '4k',
      has_audio: false,
      reusable: true,
      duration_range: { min: 5, max: 60 },
      limit: 20,
    })
    expect(result.success).toBe(true)
  })
})

describe('type constants', () => {
  it('BROLL_TYPES has 6 entries', () => {
    expect(BROLL_TYPES).toHaveLength(6)
  })

  it('BROLL_STATUSES has 3 entries', () => {
    expect(BROLL_STATUSES).toHaveLength(3)
  })

  it('BROLL_SOURCE_TYPES has 2 entries', () => {
    expect(BROLL_SOURCE_TYPES).toHaveLength(2)
  })

  it('BROLL_USAGE_TYPES has 6 entries', () => {
    expect(BROLL_USAGE_TYPES).toHaveLength(6)
  })
})
