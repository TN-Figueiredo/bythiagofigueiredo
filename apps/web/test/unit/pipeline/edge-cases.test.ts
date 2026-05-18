import { describe, it, expect } from 'vitest'
import { migrateToPostProdV2 } from '@/lib/pipeline/postprod-migration'
import { PostProdSectionSchema } from '@/lib/pipeline/postprod-schemas'
import { roteiroToTipTap, tipTapToRoteiro } from '@/lib/pipeline/script-serializer'
import {
  mapBRollJsonToDbRow,
  classifyBRollImportItem,
  buildBRollDiffLog,
  buildBRollExportJson,
} from '@/lib/pipeline/broll-import'
import type { RoteiroBeat, ScriptLine } from '@/lib/pipeline/roteiro-schemas'
import type { BRollAssetRow, BRollImportItem } from '@/lib/pipeline/broll-schemas'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBRollRow(overrides: Partial<BRollAssetRow> = {}): BRollAssetRow {
  return {
    id: 'row-1',
    site_id: 'site-1',
    asset_id: 'BROLL_01',
    original_filename: 'clip.mp4',
    renamed_to: null,
    sha256: null,
    file_size_bytes: null,
    type: 'footage',
    source: 'local',
    source_type: 'pessoal',
    category: null,
    subcategory: null,
    location: null,
    description: null,
    tags: [],
    codec: null,
    fps: null,
    resolution: '1080p',
    width: null,
    height: null,
    duration_seconds: null,
    bitrate_kbps: null,
    has_audio: false,
    color_profile: null,
    storage_url: null,
    thumbnail_url: null,
    proxy_url: null,
    reusable: true,
    status: 'available',
    captured_at: null,
    metadata: {},
    version: 1,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

// ─── migrateToPostProdV2 — edge cases ─────────────────────────────────────────

describe('migrateToPostProdV2 — edge cases', () => {
  it('returns empty v2 structure and warning for empty scenes array', () => {
    const { data, warnings } = migrateToPostProdV2({ scenes: { scenes: [] } })
    expect(data.schema_version).toBe('2.0')
    expect(data.timeline.beats).toHaveLength(0)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('No legacy data')
  })

  it('handles scene with null/undefined optional fields gracefully', () => {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [
          {
            number: 1,
            label: 'Minimal',
            timestamps: undefined,
            duration: undefined,
            status: undefined,
            difficulty: undefined,
            narrative: undefined,
            edit_notes: undefined,
            transition: undefined,
            music: undefined,
            sfx: undefined,
          },
        ],
      },
    })
    const beat = data.timeline.beats[0]!
    expect(beat.label).toBe('Minimal')
    expect(beat.timecode_in).toBeUndefined()
    expect(beat.timecode_out).toBeUndefined()
    expect(beat.duration_sec).toBeUndefined()
    expect(beat.status).toBe('pending')
    expect(beat.difficulty).toBeUndefined()
    expect(beat.narrative).toBeUndefined()
    expect(beat.edit_notes).toEqual([])
    expect(beat.transition_in).toBeUndefined()
    expect(data.assets[0]).toBeUndefined()
  })

  it('result from migration is idempotent when re-migrating as v2 crossref/speedramps', () => {
    const first = migrateToPostProdV2({
      crossref: {
        summary: 'Good',
        rows: [{ beat: 'Hook', status: 'match' }],
        divergences: ['small offset'],
      },
      speedramps: {
        ramps: [{ section: 'Intro', speed: '1.2x' }],
      },
    })

    // Migrate again using the already-migrated data as input
    const second = migrateToPostProdV2({
      crossref: {
        beats: first.data.crossref.beats.map(b => ({
          beat: b.beat,
          srt_timestamp: b.srt_timestamp,
          duration: b.duration,
          status: b.status,
        })),
        divergences: first.data.crossref.divergences,
        summary: first.data.crossref.summary,
      },
      speedramps: {
        ramps: first.data.speedramps.sections,
      },
    })

    expect(second.data.crossref.beats[0]!.beat).toBe('Hook')
    expect(second.data.crossref.beats[0]!.status).toBe('match')
    expect(second.data.crossref.divergences).toEqual(['small offset'])
    expect(second.data.speedramps.sections[0]!.section).toBe('Intro')
  })

  it('handles mixed scenes with and without assets', () => {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [
          { number: 1, label: 'No assets' },
          { number: 2, label: 'With music', music: { track_name: 'Rise', bpm: 128 } },
          { number: 3, label: 'No assets 2' },
          { number: 4, label: 'With sfx', sfx: [{ label: 'whoosh', type: 'whoosh' }] },
        ],
      },
    })

    expect(data.assets[0]).toBeUndefined()  // scene 1, index 0
    expect(data.assets[1]).toBeDefined()    // scene 2, index 1
    expect(data.assets[2]).toBeUndefined()  // scene 3, index 2
    expect(data.assets[3]).toBeDefined()    // scene 4, index 3
    expect(data.assets[1]!.music[0]!.track_name).toBe('Rise')
    expect(data.assets[3]!.sfx[0]!.label).toBe('whoosh')
  })

  it('handles very large scene count', () => {
    const scenes = Array.from({ length: 100 }, (_, i) => ({
      number: i + 1,
      label: `Scene ${i + 1}`,
      duration: '5s',
    }))

    const { data } = migrateToPostProdV2({ scenes: { scenes } })
    expect(data.timeline.beats).toHaveLength(100)
    expect(data.timeline.total_duration_sec).toBe(500)
    expect(data.timeline.beats[99]!.index).toBe(99)
    expect(data.timeline.beats[99]!.label).toBe('Scene 100')
  })

  it('handles scene with missing number field by using number as index', () => {
    // Scene with number 5 should produce index 4
    const { data } = migrateToPostProdV2({
      scenes: { scenes: [{ number: 5, label: 'Late Entry' }] },
    })
    expect(data.timeline.beats[0]!.index).toBe(4)
  })

  it('round-trip: migrate → validate schema → migrate again produces valid v2', () => {
    const input = {
      scenes: {
        scenes: [
          {
            number: 1,
            label: 'Hook',
            timestamps: '00:00:00-00:00:15',
            duration: '15s',
            status: 'done',
            music: { track_name: 'Rise', bpm: 120 },
            sfx: [{ label: 'whoosh', type: 'whoosh' }],
          },
        ],
      },
      crossref: {
        summary: 'OK',
        rows: [{ beat: 'Hook', status: 'match' }],
      },
      speedramps: {
        ramps: [{ section: 'Hook', speed: '1.0x' }],
      },
    }

    const first = migrateToPostProdV2(input)
    // Validate the v2 schema
    const validated = PostProdSectionSchema.safeParse(first.data)
    expect(validated.success).toBe(true)

    // Re-migrate from raw input yields same structure
    const second = migrateToPostProdV2(input)
    expect(second.data.schema_version).toBe(first.data.schema_version)
    expect(second.data.timeline.beats).toHaveLength(first.data.timeline.beats.length)
    expect(second.data.crossref.beats).toHaveLength(first.data.crossref.beats.length)
    expect(second.data.speedramps.sections).toHaveLength(first.data.speedramps.sections.length)
  })

  it('handles crossref with empty rows array', () => {
    const { data, warnings } = migrateToPostProdV2({
      crossref: { rows: [], summary: 'empty crossref', source: 'cowork' },
    })
    expect(data.crossref.beats).toHaveLength(0)
    expect(data.crossref.summary).toBe('empty crossref')
    // crossref object is present — the warning fires only when ALL inputs are absent
    expect(warnings).toHaveLength(0)
  })

  it('handles speedramps with empty sections alias', () => {
    const { data } = migrateToPostProdV2({
      speedramps: { segments: [] },
    })
    expect(data.speedramps.sections).toHaveLength(0)
  })

  it('normalizes all difficulty levels', () => {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [
          { number: 1, label: 'A', difficulty: 'simple' },
          { number: 2, label: 'B', difficulty: 'moderate' },
          { number: 3, label: 'C', difficulty: 'difficult' },
          { number: 4, label: 'D', difficulty: 'very hard' },
          { number: 5, label: 'E', difficulty: 'unknown_val' },
        ],
      },
    })
    expect(data.timeline.beats.map(b => b.difficulty)).toEqual([
      'easy', 'medium', 'hard', 'complex', undefined,
    ])
  })

  it('parses timeline timecode with em-dash separator', () => {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [{ number: 1, label: 'A', timeline: '00:01:00–00:02:00' }],
      },
    })
    expect(data.timeline.beats[0]!.timecode_in).toBe('00:01:00')
    expect(data.timeline.beats[0]!.timecode_out).toBe('00:02:00')
  })

  it('duration in minutes is converted to seconds correctly', () => {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [{ number: 1, label: 'Long', duration: '2.5min' }],
      },
    })
    expect(data.timeline.beats[0]!.duration_sec).toBe(150)
  })

  it('crossref script_est alias falls back to script_estimate', () => {
    const { data } = migrateToPostProdV2({
      crossref: {
        rows: [{ beat: 'Hook', script_est: '0:45' }],
      },
    })
    expect(data.crossref.beats[0]!.script_estimate).toBe('0:45')
  })

  it('sfx uses description when label is missing', () => {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [{
          number: 1,
          label: 'A',
          sfx: [{ description: 'glass break' }],
        }],
      },
    })
    expect(data.assets[0]!.sfx[0]!.label).toBe('glass break')
  })

  it('sfx falls back to "SFX" when both label and description are missing', () => {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [{
          number: 1,
          label: 'A',
          sfx: [{ type: 'riser' }],
        }],
      },
    })
    expect(data.assets[0]!.sfx[0]!.label).toBe('SFX')
  })

  it('crossref normalizes all status aliases', () => {
    const { data } = migrateToPostProdV2({
      crossref: {
        rows: [
          { beat: 'A', status: 'ok' },
          { beat: 'B', status: 'aligned' },
          { beat: 'C', status: 'diverged' },
          { beat: 'D', status: 'mismatch' },
          { beat: 'E', status: 'missing' },
          { beat: 'F', status: 'added' },
          { beat: 'G', status: 'unknown' },
        ],
      },
    })
    expect(data.crossref.beats.map(b => b.status)).toEqual([
      'match', 'match', 'diverge', 'diverge', 'missing', 'extra', 'match',
    ])
  })
})

// ─── script-serializer — edge cases ──────────────────────────────────────────

describe('roteiroToTipTap — edge cases', () => {
  it('empty script produces a doc with one empty paragraph', () => {
    const beat: RoteiroBeat = { idx: 0, name: 'Empty', status: 'PENDING', script: [] }
    const doc = roteiroToTipTap(beat)
    expect(doc.type).toBe('doc')
    expect(doc.content).toHaveLength(1)
    expect(doc.content![0]!.type).toBe('paragraph')
    expect(doc.content![0]!.content).toBeUndefined()
  })

  it('line with accent includes highlight mark (no forced italic)', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'X', status: 'PENDING',
      script: [{ type: 'line', text: 'Highlight me', accent: '#ff0000' }],
    }
    const doc = roteiroToTipTap(beat)
    const textNode = doc.content![0]!.content![0]!
    expect(textNode.marks).toContainEqual({ type: 'highlight', attrs: { color: '#ff0000' } })
    expect(textNode.marks).not.toContainEqual({ type: 'italic' })
  })

  it('line without accent has no highlight mark', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'X', status: 'PENDING',
      script: [{ type: 'line', text: 'No accent' }],
    }
    const doc = roteiroToTipTap(beat)
    const marks = doc.content![0]!.content![0]!.marks ?? []
    const hasHighlight = marks.some(m => m.type === 'highlight')
    expect(hasHighlight).toBe(false)
  })

  it('handles all four line types in one beat', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'All types', status: 'PENDING',
      script: [
        { type: 'note', tag: 'VISUAL', text: 'show montage' },
        { type: 'line', text: 'I was there.' },
        { type: 'pause', duration: 1.0 },
        { type: 'ref', text: 'See other doc' },
      ],
    }
    const doc = roteiroToTipTap(beat)
    expect(doc.content).toHaveLength(4)
    expect(doc.content![0]!.type).toBe('scriptTag')
    expect(doc.content![1]!.type).toBe('paragraph')
    expect(doc.content![2]!.type).toBe('scriptPause')
    expect(doc.content![3]!.type).toBe('blockquote')
  })

  it('very long text is preserved in line node', () => {
    const longText = 'A'.repeat(5000)
    const beat: RoteiroBeat = {
      idx: 0, name: 'Long', status: 'PENDING',
      script: [{ type: 'line', text: longText }],
    }
    const doc = roteiroToTipTap(beat)
    expect(doc.content![0]!.content![0]!.text).toBe(longText)
  })

  it('special characters and emoji in text are preserved', () => {
    const specialText = 'Hello <world> & "friends" 🌍 café'
    const beat: RoteiroBeat = {
      idx: 0, name: 'Special', status: 'PENDING',
      script: [{ type: 'line', text: specialText }],
    }
    const doc = roteiroToTipTap(beat)
    expect(doc.content![0]!.content![0]!.text).toBe(specialText)
  })

  it('unicode characters in ref text are preserved', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'Unicode', status: 'PENDING',
      script: [{ type: 'ref', text: 'Ñoño ações — résumé 日本語' }],
    }
    const doc = roteiroToTipTap(beat)
    // blockquote -> paragraph -> [bold "REF ", plain text]
    const paraContent = doc.content![0]!.content![0]!.content!
    const plainText = paraContent[1]!.text
    expect(plainText).toBe('Ñoño ações — résumé 日本語')
  })

  it('pause duration zero is preserved', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'Zero', status: 'PENDING',
      script: [{ type: 'pause', duration: 0 }],
    }
    const doc = roteiroToTipTap(beat)
    expect(doc.content![0]!.attrs?.duration).toBe(0)
  })

  it('note tag NARRACAO is preserved', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'Narracao', status: 'PENDING',
      script: [{ type: 'note', tag: 'NARRACAO', text: 'narrate this' }],
    }
    const doc = roteiroToTipTap(beat)
    expect(doc.content![0]!.attrs?.tag).toBe('NARRACAO')
  })
})

describe('tipTapToRoteiro — edge cases', () => {
  it('returns empty array for doc with no content', () => {
    const lines = tipTapToRoteiro({ type: 'doc' })
    expect(lines).toEqual([])
  })

  it('returns empty array for doc with empty content array', () => {
    const lines = tipTapToRoteiro({ type: 'doc', content: [] })
    expect(lines).toEqual([])
  })

  it('skips scriptTag node with no text content', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'scriptTag', attrs: { tag: 'VISUAL' }, content: [] }],
    }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toHaveLength(0)
  })

  it('skips blockquote that extracts to empty string after stripping REF prefix', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'REF ' }],
        }],
      }],
    }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toHaveLength(0)
  })

  it('scriptPause with missing attrs duration defaults to 0', () => {
    const doc = { type: 'doc', content: [{ type: 'scriptPause' }] }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toEqual([{ type: 'pause', duration: 0 }])
  })

  it('scriptPause with string duration attr defaults to 0', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'scriptPause', attrs: { duration: 'long' } }],
    }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toEqual([{ type: 'pause', duration: 0 }])
  })

  it('unknown node types are silently ignored', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'unknownNode', content: [{ type: 'text', text: 'ignored' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'kept', marks: [{ type: 'italic' }] }] },
      ],
    }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toHaveLength(1)
    expect(lines[0]!.type).toBe('line')
    expect((lines[0] as { text: string }).text).toBe('kept')
  })

  it('paragraph with multiple text nodes concatenates text', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Part one ', marks: [{ type: 'italic' }] },
          { type: 'text', text: 'part two' },
        ],
      }],
    }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toHaveLength(1)
    expect((lines[0] as { text: string }).text).toBe('Part one part two')
  })

  it('accent is read from first content node highlight mark', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Accented',
          marks: [
            { type: 'italic' },
            { type: 'highlight', attrs: { color: '#00ff00' } },
          ],
        }],
      }],
    }
    const lines = tipTapToRoteiro(doc)
    expect((lines[0] as { accent: string }).accent).toBe('#00ff00')
  })
})

describe('round-trip — roteiro ↔ tipTap', () => {
  it('roteiro → tipTap → roteiro is identical for all line types', () => {
    const script: ScriptLine[] = [
      { type: 'note', tag: 'VISUAL', text: 'show drone footage' },
      { type: 'note', tag: 'DIRECTION', text: 'calm and measured' },
      { type: 'note', tag: 'NARRACAO', text: 'narrator voice' },
      { type: 'line', text: 'I spent four years there.' },
      { type: 'line', text: 'It changed me.', accent: '#ff0000' },
      { type: 'pause', duration: 0.5 },
      { type: 'pause', duration: 0 },
      { type: 'ref', text: 'Reference material here' },
    ]

    const beat: RoteiroBeat = { idx: 0, name: 'Test', status: 'PENDING', script }
    const doc = roteiroToTipTap(beat)
    const result = tipTapToRoteiro(doc)

    expect(result).toHaveLength(script.length)
    for (let i = 0; i < script.length; i++) {
      expect(result[i]!.type).toBe(script[i]!.type)
      if ('text' in script[i]! && 'text' in result[i]!) {
        expect((result[i] as { text: string }).text).toBe((script[i] as { text: string }).text)
      }
      if ('duration' in script[i]! && 'duration' in result[i]!) {
        expect((result[i] as { duration: number }).duration).toBe((script[i] as { duration: number }).duration)
      }
      if ('tag' in script[i]! && 'tag' in result[i]!) {
        expect((result[i] as { tag: string }).tag).toBe((script[i] as { tag: string }).tag)
      }
      if ('accent' in script[i]! && 'accent' in result[i]!) {
        expect((result[i] as { accent?: string }).accent).toBe((script[i] as { accent?: string }).accent)
      }
    }
  })

  it('tipTap → roteiro → tipTap is structurally identical', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'scriptTag', attrs: { tag: 'VISUAL' }, content: [{ type: 'text', text: 'montage' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'I lived there.', marks: [{ type: 'italic' }] }] },
        { type: 'scriptPause', attrs: { duration: 1.5 } },
        {
          type: 'blockquote',
          content: [{
            type: 'paragraph',
            content: [
              { type: 'text', text: 'REF ', marks: [{ type: 'bold' }] },
              { type: 'text', text: 'see note' },
            ],
          }],
        },
      ],
    }

    const beat: RoteiroBeat = { idx: 0, name: 'Test', status: 'PENDING', script: [] }

    // tipTap → roteiro
    const lines = tipTapToRoteiro(doc)
    // roteiro → tipTap
    const beat2: RoteiroBeat = { ...beat, script: lines }
    const doc2 = roteiroToTipTap(beat2)

    expect(doc2.content).toHaveLength(doc.content.length)
    expect(doc2.content![0]!.type).toBe('scriptTag')
    expect(doc2.content![0]!.attrs?.tag).toBe('VISUAL')
    expect(doc2.content![1]!.type).toBe('paragraph')
    expect(doc2.content![2]!.type).toBe('scriptPause')
    expect(doc2.content![2]!.attrs?.duration).toBe(1.5)
    expect(doc2.content![3]!.type).toBe('blockquote')
  })

  it('empty beat round-trips to empty beat', () => {
    const beat: RoteiroBeat = { idx: 0, name: 'Empty', status: 'PENDING', script: [] }
    const doc = roteiroToTipTap(beat)
    const lines = tipTapToRoteiro(doc)
    // The empty paragraph produced should parse to zero lines
    expect(lines).toHaveLength(0)
  })

  it('special characters round-trip faithfully', () => {
    const text = 'Ações de <script> & "quotes" 🚀 café'
    const beat: RoteiroBeat = {
      idx: 0, name: 'Special', status: 'PENDING',
      script: [{ type: 'line', text }],
    }
    const doc = roteiroToTipTap(beat)
    const result = tipTapToRoteiro(doc)
    expect((result[0] as { text: string }).text).toBe(text)
  })

  it('very long text round-trips faithfully', () => {
    const longText = 'Word '.repeat(1000).trim()
    const beat: RoteiroBeat = {
      idx: 0, name: 'LongBeat', status: 'PENDING',
      script: [{ type: 'line', text: longText }],
    }
    const doc = roteiroToTipTap(beat)
    const result = tipTapToRoteiro(doc)
    expect((result[0] as { text: string }).text).toBe(longText)
  })
})

// ─── broll-import — edge cases ────────────────────────────────────────────────

describe('mapBRollJsonToDbRow — edge cases', () => {
  it('includes tags in output only when tags array is provided', () => {
    const withTags = mapBRollJsonToDbRow({ asset_id: 'X', tags: ['a', 'b'] })
    expect(withTags.tags).toEqual(['a', 'b'])

    const withoutTags = mapBRollJsonToDbRow({ asset_id: 'X' })
    expect('tags' in withoutTags).toBe(false)
  })

  it('includes metadata in output only when metadata is provided', () => {
    const withMeta = mapBRollJsonToDbRow({ asset_id: 'X', metadata: { key: 'val' } })
    expect(withMeta.metadata).toEqual({ key: 'val' })

    const withoutMeta = mapBRollJsonToDbRow({ asset_id: 'X' })
    expect('metadata' in withoutMeta).toBe(false)
  })

  it('preserves all explicit values over defaults', () => {
    const item: BRollImportItem = {
      asset_id: 'BROLL_99',
      type: 'photo',
      source: 'dji',
      source_type: 'generico',
      resolution: '4k',
      has_audio: true,
      reusable: false,
      status: 'retired',
    }
    const row = mapBRollJsonToDbRow(item)
    expect(row.type).toBe('photo')
    expect(row.source).toBe('dji')
    expect(row.source_type).toBe('generico')
    expect(row.resolution).toBe('4k')
    expect(row.has_audio).toBe(true)
    expect(row.reusable).toBe(false)
    expect(row.status).toBe('retired')
  })
})

describe('classifyBRollImportItem — edge cases', () => {
  it('returns update when existing has no sha256 even if new row has sha256', () => {
    const result = classifyBRollImportItem(
      { asset_id: 'X', sha256: 'a'.repeat(64) },
      { sha256: null, tags: [] },
    )
    expect(result).toBe('update')
  })

  it('returns skip for identical metadata when sha256 matches', () => {
    const sha = 'c'.repeat(64)
    const result = classifyBRollImportItem(
      { asset_id: 'X', sha256: sha },
      { sha256: sha, tags: [] },
    )
    expect(result).toBe('skip')
  })

  it('returns update when tags differ even with matching sha256', () => {
    const sha = 'd'.repeat(64)
    const result = classifyBRollImportItem(
      { asset_id: 'X', sha256: sha, tags: ['new-tag'] },
      { sha256: sha, tags: ['old-tag'] },
    )
    expect(result).toBe('update')
  })
})

describe('buildBRollDiffLog — edge cases', () => {
  it('handles null vs undefined as different values', () => {
    const diffs = buildBRollDiffLog(
      { asset_id: 'X', description: null },
      { asset_id: 'X', description: 'new' },
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0]!.field).toBe('description')
    expect(diffs[0]!.old).toBeNull()
    expect(diffs[0]!.new).toBe('new')
  })

  it('skips asset_id and sha256 fields always', () => {
    const diffs = buildBRollDiffLog(
      { asset_id: 'X', sha256: 'a'.repeat(64) },
      { asset_id: 'Y', sha256: 'b'.repeat(64) },
    )
    expect(diffs).toHaveLength(0)
  })

  it('uses new row asset_id as the diff asset_id', () => {
    const diffs = buildBRollDiffLog(
      { asset_id: 'OLD', description: 'before' },
      { asset_id: 'NEW', description: 'after' },
    )
    expect(diffs[0]!.asset_id).toBe('NEW')
  })

  it('detects nested object changes via JSON serialization', () => {
    const diffs = buildBRollDiffLog(
      { asset_id: 'X', metadata: { camera: 'old' } },
      { asset_id: 'X', metadata: { camera: 'new' } },
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0]!.field).toBe('metadata')
  })
})

describe('buildBRollExportJson — edge cases', () => {
  it('returns empty export for empty asset array', () => {
    const result = buildBRollExportJson([])
    expect(result.schema).toBe('broll-library')
    expect(result.items).toHaveLength(0)
    expect(result.summary.total).toBe(0)
    expect(result.summary.by_type).toEqual({})
    expect(result.search_index.tags).toHaveLength(0)
    expect(result.search_index.categories).toHaveLength(0)
    expect(result.search_index.locations).toHaveLength(0)
  })

  it('deduplicates tags in search index', () => {
    const assets: BRollAssetRow[] = [
      makeBRollRow({ asset_id: 'A', tags: ['sunset', 'drone'] }),
      makeBRollRow({ asset_id: 'B', tags: ['sunset', 'city'] }),
    ]
    const result = buildBRollExportJson(assets)
    const sunsetCount = result.search_index.tags.filter(t => t === 'sunset').length
    expect(sunsetCount).toBe(1)
    expect(result.search_index.tags).toContain('drone')
    expect(result.search_index.tags).toContain('city')
  })

  it('deduplicates categories in search index', () => {
    const assets: BRollAssetRow[] = [
      makeBRollRow({ asset_id: 'A', category: 'drone' }),
      makeBRollRow({ asset_id: 'B', category: 'drone' }),
      makeBRollRow({ asset_id: 'C', category: 'studio' }),
    ]
    const result = buildBRollExportJson(assets)
    expect(result.search_index.categories.filter(c => c === 'drone')).toHaveLength(1)
    expect(result.search_index.categories).toContain('studio')
  })

  it('deduplicates locations in search index', () => {
    const assets: BRollAssetRow[] = [
      makeBRollRow({ asset_id: 'A', location: 'Floripa' }),
      makeBRollRow({ asset_id: 'B', location: 'Floripa' }),
      makeBRollRow({ asset_id: 'C', location: 'Studio' }),
    ]
    const result = buildBRollExportJson(assets)
    expect(result.search_index.locations.filter(l => l === 'Floripa')).toHaveLength(1)
  })

  it('counts by_type correctly for large batch with duplicate IDs', () => {
    // broll-import itself doesn't enforce unique IDs — that's the DB's job
    const assets: BRollAssetRow[] = [
      makeBRollRow({ asset_id: 'BROLL_01', type: 'footage' }),
      makeBRollRow({ asset_id: 'BROLL_01', type: 'footage' }), // duplicate ID
      makeBRollRow({ asset_id: 'BROLL_02', type: 'photo' }),
      makeBRollRow({ asset_id: 'BROLL_03', type: 'photo' }),
    ]
    const result = buildBRollExportJson(assets)
    expect(result.summary.total).toBe(4)
    expect(result.summary.by_type.footage).toBe(2)
    expect(result.summary.by_type.photo).toBe(2)
  })

  it('very large batch is exported without error', () => {
    const assets: BRollAssetRow[] = Array.from({ length: 500 }, (_, i) =>
      makeBRollRow({ asset_id: `BROLL_${i.toString().padStart(3, '0')}` }),
    )
    const result = buildBRollExportJson(assets)
    expect(result.items).toHaveLength(500)
    expect(result.summary.total).toBe(500)
  })

  it('assets with null category/location are excluded from search index', () => {
    const assets: BRollAssetRow[] = [
      makeBRollRow({ asset_id: 'A', category: null, location: null }),
      makeBRollRow({ asset_id: 'B', category: 'drone', location: null }),
    ]
    const result = buildBRollExportJson(assets)
    expect(result.search_index.categories).toEqual(['drone'])
    expect(result.search_index.locations).toHaveLength(0)
  })

  it('exported_at is a valid ISO 8601 date string', () => {
    const result = buildBRollExportJson([])
    expect(() => new Date(result.exported_at)).not.toThrow()
    expect(new Date(result.exported_at).toISOString()).toBe(result.exported_at)
  })
})
