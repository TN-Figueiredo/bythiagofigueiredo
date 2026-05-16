import { describe, it, expect } from 'vitest'
import { mapJsonToDbRow, classifyImportItem, buildDiffLog, buildExportJson } from '@/lib/pipeline/audio-import'

describe('mapJsonToDbRow', () => {
  it('maps music JSON fields to DB columns', () => {
    const item = {
      asset_id: 'MUSIC_01',
      original_filename: 'track.mp3',
      rename_to: 'epic_journey.mp3',
      key: 'Cm',
      bpm: 120,
      genre: 'cinematic',
      artist: 'Test Artist',
      track_name: 'Epic Journey',
      tags: ['cinematic', 'epic'],
      mood: ['inspiring'],
      instruments: ['strings'],
      audio: { duration_seconds: 180, sample_rate: 48000, bit_depth: 24, channels: 2, codec: 'PCM' },
      mix_notes: 'Layer under VO',
    }
    const row = mapJsonToDbRow(item, 'music')
    expect(row.type).toBe('music')
    expect(row.renamed_to).toBe('epic_journey.mp3')
    expect(row.music_key).toBe('Cm')
    expect(row.duration_seconds).toBe(180)
    expect(row.tags).toEqual(['cinematic', 'epic'])
    expect(row.metadata?.audio).toEqual({ duration_seconds: 180, sample_rate: 48000, bit_depth: 24, channels: 2, codec: 'PCM' })
    expect(row.metadata?.mix_notes).toBe('Layer under VO')
  })

  it('maps SFX JSON fields', () => {
    const item = {
      asset_id: 'SFX_01',
      original_filename: 'whoosh.wav',
      category: 'transition',
      subcategory: 'riser',
      reuse_scenarios: ['weekly_vlog'],
      entry_style: 'hard_cut',
      duration_hint: '2-4s',
    }
    const row = mapJsonToDbRow(item, 'sfx')
    expect(row.type).toBe('sfx')
    expect(row.category).toBe('transition')
    expect(row.subcategory).toBe('riser')
    expect(row.metadata?.entry_style).toBe('hard_cut')
    expect(row.metadata?.duration_hint).toBe('2-4s')
  })
})

describe('classifyImportItem', () => {
  it('returns create when no existing match', () => {
    expect(classifyImportItem({ asset_id: 'NEW_01', sha256: 'abc' }, null)).toBe('create')
  })

  it('returns skip when sha256 matches and metadata identical', () => {
    const row = { asset_id: 'A', sha256: 'abc', tags: ['x'] }
    const existing = { asset_id: 'A', sha256: 'abc', tags: ['x'] }
    expect(classifyImportItem(row, existing)).toBe('skip')
  })

  it('returns update when sha256 matches but metadata differs', () => {
    const row = { asset_id: 'A', sha256: 'abc', tags: ['x', 'y'] }
    const existing = { asset_id: 'A', sha256: 'abc', tags: ['x'] }
    expect(classifyImportItem(row, existing)).toBe('update')
  })
})

describe('buildDiffLog', () => {
  it('produces diff entries for changed fields', () => {
    const oldRow = { asset_id: 'A', tags: ['x'], energy: 3 }
    const newRow = { asset_id: 'A', tags: ['x', 'y'], energy: 4 }
    const diffs = buildDiffLog(oldRow, newRow)
    expect(diffs).toHaveLength(2)
    expect(diffs.find(d => d.field === 'energy')).toEqual({ asset_id: 'A', field: 'energy', old: 3, new: 4 })
  })

  it('returns empty for identical rows', () => {
    const row = { asset_id: 'A', tags: ['x'] }
    expect(buildDiffLog(row, row)).toHaveLength(0)
  })
})

describe('buildExportJson', () => {
  it('separates music and sfx into arrays', () => {
    const assets = [
      { type: 'music', asset_id: 'M1', tags: ['a'] },
      { type: 'sfx', asset_id: 'S1', tags: ['b'] },
    ]
    const result = buildExportJson(assets as never)
    expect(result.music).toHaveLength(1)
    expect(result.sfx).toHaveLength(1)
    expect(result.summary.total).toBe(2)
  })

  it('includes search_index aggregation', () => {
    const assets = [
      { type: 'music', asset_id: 'M1', tags: ['cinematic'], mood: ['inspiring'], instruments: ['strings'], category: null },
    ]
    const result = buildExportJson(assets as never)
    expect(result.search_index.tags).toContain('cinematic')
    expect(result.search_index.moods).toContain('inspiring')
  })

  it('includes naming_convention in export', () => {
    const result = buildExportJson([])
    expect(result.naming_convention).toBeDefined()
    expect(result.naming_convention.pattern).toBe('{TYPE}_{CATEGORY}_{NUMBER}')
  })
})
