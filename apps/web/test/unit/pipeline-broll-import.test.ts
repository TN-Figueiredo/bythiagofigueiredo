import { describe, it, expect } from 'vitest'
import {
  mapBRollJsonToDbRow,
  classifyBRollImportItem,
  buildBRollDiffLog,
  buildBRollExportJson,
} from '@/lib/pipeline/broll-import'
import type { BRollAssetRow, BRollImportItem } from '@/lib/pipeline/broll-schemas'

describe('mapBRollJsonToDbRow', () => {
  it('maps minimal import item', () => {
    const item: BRollImportItem = { asset_id: 'BROLL_01' }
    const row = mapBRollJsonToDbRow(item)
    expect(row.asset_id).toBe('BROLL_01')
    expect(row.type).toBe('footage')
    expect(row.source).toBe('local')
    expect(row.source_type).toBe('pessoal')
    expect(row.resolution).toBe('1080p')
    expect(row.has_audio).toBe(false)
    expect(row.reusable).toBe(true)
    expect(row.status).toBe('available')
  })

  it('maps full import item', () => {
    const item: BRollImportItem = {
      asset_id: 'BROLL_DRONE_01',
      original_filename: 'DJI_0042.mp4',
      renamed_to: 'drone-sunset.mp4',
      sha256: 'a'.repeat(64),
      file_size_bytes: 1024000,
      type: 'photo',
      source: 'dji',
      source_type: 'generico',
      category: 'drone',
      subcategory: 'aerial',
      location: 'Floripa',
      description: 'Sunset drone shot',
      tags: ['drone', 'sunset'],
      codec: 'h265',
      fps: 60,
      resolution: '4k',
      width: 3840,
      height: 2160,
      duration_seconds: 45,
      bitrate_kbps: 50000,
      has_audio: true,
      color_profile: 'rec709',
      reusable: false,
      status: 'pending',
      captured_at: '2026-05-10T14:00:00Z',
      metadata: { camera: 'DJI Mini 4' },
    }
    const row = mapBRollJsonToDbRow(item)
    expect(row.type).toBe('photo')
    expect(row.source_type).toBe('generico')
    expect(row.location).toBe('Floripa')
    expect(row.tags).toEqual(['drone', 'sunset'])
    expect(row.metadata).toEqual({ camera: 'DJI Mini 4' })
  })
})

describe('classifyBRollImportItem', () => {
  it('returns create when no existing', () => {
    expect(classifyBRollImportItem({ asset_id: 'X' }, null)).toBe('create')
  })

  it('returns skip when sha256 matches and no other diffs', () => {
    const sha = 'a'.repeat(64)
    expect(classifyBRollImportItem(
      { asset_id: 'X', sha256: sha },
      { sha256: sha, tags: [] },
    )).toBe('skip')
  })

  it('returns update when sha256 matches but has other diffs', () => {
    const sha = 'a'.repeat(64)
    expect(classifyBRollImportItem(
      { asset_id: 'X', sha256: sha, tags: ['new'] },
      { sha256: sha, tags: ['old'] },
    )).toBe('update')
  })

  it('returns update when sha256 differs', () => {
    expect(classifyBRollImportItem(
      { asset_id: 'X', sha256: 'a'.repeat(64) },
      { sha256: 'b'.repeat(64), tags: [] },
    )).toBe('update')
  })
})

describe('buildBRollDiffLog', () => {
  it('returns empty for identical rows', () => {
    const row = { asset_id: 'X', sha256: 'a', tags: ['x'] }
    expect(buildBRollDiffLog(row, row)).toEqual([])
  })

  it('detects field changes', () => {
    const diffs = buildBRollDiffLog(
      { asset_id: 'X', tags: ['old'], description: 'old' },
      { asset_id: 'X', tags: ['new'], description: 'new' },
    )
    expect(diffs).toHaveLength(2)
    expect(diffs.map(d => d.field)).toContain('tags')
    expect(diffs.map(d => d.field)).toContain('description')
  })

  it('skips undefined new values', () => {
    const diffs = buildBRollDiffLog(
      { asset_id: 'X', tags: ['old'] },
      { asset_id: 'X', tags: undefined },
    )
    expect(diffs).toHaveLength(0)
  })
})

describe('buildBRollExportJson', () => {
  it('builds export with search index', () => {
    const assets: BRollAssetRow[] = [
      {
        id: '1', site_id: 's1', asset_id: 'BROLL_01', original_filename: 'clip.mp4',
        renamed_to: null, sha256: null, file_size_bytes: null,
        type: 'footage', source: 'local', source_type: 'pessoal',
        category: 'drone', subcategory: null, location: 'Floripa',
        description: null, tags: ['sunset', 'drone'],
        codec: null, fps: null, resolution: '4k',
        width: null, height: null, duration_seconds: null,
        bitrate_kbps: null, has_audio: false, color_profile: null,
        storage_url: null, thumbnail_url: null, proxy_url: null,
        reusable: true, status: 'available', captured_at: null,
        metadata: {}, version: 1, created_at: '', updated_at: '',
      },
      {
        id: '2', site_id: 's1', asset_id: 'BROLL_02', original_filename: 'photo.jpg',
        renamed_to: null, sha256: null, file_size_bytes: null,
        type: 'photo', source: 'local', source_type: 'generico',
        category: 'product', subcategory: null, location: 'Studio',
        description: null, tags: ['product'],
        codec: null, fps: null, resolution: '1080p',
        width: null, height: null, duration_seconds: null,
        bitrate_kbps: null, has_audio: false, color_profile: null,
        storage_url: null, thumbnail_url: null, proxy_url: null,
        reusable: true, status: 'available', captured_at: null,
        metadata: {}, version: 1, created_at: '', updated_at: '',
      },
    ]

    const result = buildBRollExportJson(assets)
    expect(result.schema).toBe('broll-library')
    expect(result.schema_version).toBe('1.0.0')
    expect(result.items).toHaveLength(2)
    expect(result.summary.total).toBe(2)
    expect(result.summary.by_type).toEqual({ footage: 1, photo: 1 })
    expect(result.search_index.tags).toContain('sunset')
    expect(result.search_index.tags).toContain('product')
    expect(result.search_index.categories).toContain('drone')
    expect(result.search_index.locations).toContain('Floripa')
    expect(result.search_index.locations).toContain('Studio')
  })
})
