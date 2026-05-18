import { describe, it, expect } from 'vitest'
import { migrateToPostProdV2 } from '@/lib/pipeline/postprod-migration'

describe('migrateToPostProdV2', () => {
  it('creates empty v2.0 structure when no input data', () => {
    const { data, warnings } = migrateToPostProdV2({})
    expect(data.schema_version).toBe('2.0')
    expect(data.timeline.beats).toEqual([])
    expect(data.assets).toEqual({})
    expect(data.crossref.beats).toEqual([])
    expect(data.speedramps.sections).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('No legacy data')
  })

  it('migrates legacy scenes to timeline beats', () => {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [
          {
            number: 1,
            label: 'Hook',
            timestamps: '00:00:00 - 00:00:15',
            duration: '15s',
            status: 'done',
            difficulty: 'easy',
            narrative: 'Attention grabber',
            edit_notes: ['Add zoom effect'],
          },
          {
            number: 2,
            label: 'Intro',
            timestamps: '00:00:15-00:01:00',
            duration: '45s',
            status: 'in_progress',
          },
        ],
      },
    })

    expect(data.timeline.beats).toHaveLength(2)

    const hook = data.timeline.beats[0]!
    expect(hook.index).toBe(0)
    expect(hook.label).toBe('Hook')
    expect(hook.timecode_in).toBe('00:00:00')
    expect(hook.timecode_out).toBe('00:00:15')
    expect(hook.duration_sec).toBe(15)
    expect(hook.status).toBe('done')
    expect(hook.difficulty).toBe('easy')
    expect(hook.narrative).toBe('Attention grabber')
    expect(hook.edit_notes).toEqual(['Add zoom effect'])

    const intro = data.timeline.beats[1]!
    expect(intro.index).toBe(1)
    expect(intro.status).toBe('in_progress')
  })

  it('extracts music and SFX into beat assets', () => {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [
          {
            number: 1,
            label: 'Hook',
            music: {
              track_name: 'Epic Rise',
              artist: 'Composer X',
              bpm: 120,
              energy: 4,
              entry_style: 'fade_in',
              role: 'primary',
              asset_id: 'MUSIC_01',
            },
            sfx: [
              { label: 'whoosh', type: 'whoosh', timecode: '00:00:02' },
              { description: 'impact hit', type: 'impact' },
            ],
          },
        ],
      },
    })

    expect(data.assets[0]).toBeDefined()
    expect(data.assets[0]!.music).toHaveLength(1)
    expect(data.assets[0]!.music[0]!.track_name).toBe('Epic Rise')
    expect(data.assets[0]!.music[0]!.asset_id).toBe('MUSIC_01')
    expect(data.assets[0]!.sfx).toHaveLength(2)
    expect(data.assets[0]!.sfx[0]!.label).toBe('whoosh')
    expect(data.assets[0]!.sfx[1]!.label).toBe('impact hit')
  })

  it('migrates crossref with rows format', () => {
    const { data } = migrateToPostProdV2({
      crossref: {
        summary: 'Script matches well',
        rows: [
          { beat: 'Hook', srt_timestamp: '00:00:00', duration: '15s', status: 'match' },
          { beat: 'CTA', srt_timestamp: '00:08:00', duration: '30s', status: 'diverge' },
        ],
        divergences: ['CTA runs 10s long'],
        source: 'cowork',
      },
    })

    expect(data.crossref.summary).toBe('Script matches well')
    expect(data.crossref.beats).toHaveLength(2)
    expect(data.crossref.beats[0]!.beat).toBe('Hook')
    expect(data.crossref.beats[0]!.status).toBe('match')
    expect(data.crossref.beats[1]!.status).toBe('diverge')
    expect(data.crossref.divergences).toEqual(['CTA runs 10s long'])
    expect(data.crossref.source).toBe('cowork')
  })

  it('migrates crossref with beats format (alias)', () => {
    const { data } = migrateToPostProdV2({
      crossref: {
        beats: [{ beat: 'Intro', status: 'ok' }],
        key_divergences: ['Timing off'],
      },
    })

    expect(data.crossref.beats).toHaveLength(1)
    expect(data.crossref.beats[0]!.status).toBe('match') // 'ok' normalizes to 'match'
    expect(data.crossref.divergences).toEqual(['Timing off'])
  })

  it('migrates speedramps with ramps format', () => {
    const { data } = migrateToPostProdV2({
      speedramps: {
        ramps: [
          { section: 'Hook', speed: '1.0x', rationale: 'Keep pace' },
          { section: 'Filler', srt_range: '02:30-03:00', speed: '2.0x' },
        ],
        base_acceleration: '1.15x',
        est_final: '9:30',
        edit_style: 'aggressive',
        source: 'cowork',
      },
    })

    expect(data.speedramps.sections).toHaveLength(2)
    expect(data.speedramps.base).toBe('1.15x')
    expect(data.speedramps.est_final).toBe('9:30')
    expect(data.speedramps.edit_style).toBe('aggressive')
    expect(data.speedramps.source).toBe('cowork')
  })

  it('migrates speedramps with segments format (alias)', () => {
    const { data } = migrateToPostProdV2({
      speedramps: {
        segments: [{ section: 'Intro', speed: '1.5x' }],
      },
    })

    expect(data.speedramps.sections).toHaveLength(1)
    expect(data.speedramps.sections[0]!.section).toBe('Intro')
  })

  it('handles scenes as raw array', () => {
    const { data } = migrateToPostProdV2({
      scenes: [
        { number: 1, label: 'Scene 1' },
        { number: 2, label: 'Scene 2' },
      ],
    })

    expect(data.timeline.beats).toHaveLength(2)
  })

  it('calculates total_duration_sec from beats', () => {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [
          { number: 1, label: 'Hook', duration: '15s' },
          { number: 2, label: 'Main', duration: '5min' },
        ],
      },
    })

    expect(data.timeline.total_duration_sec).toBe(315) // 15 + 300
  })

  it('normalizes status values', () => {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [
          { number: 1, label: 'A', status: 'complete' },
          { number: 2, label: 'B', status: 'in progress' },
          { number: 3, label: 'C', status: 'editing' },
          { number: 4, label: 'D', status: 'reviewing' },
          { number: 5, label: 'E', status: 'unknown' },
        ],
      },
    })

    expect(data.timeline.beats.map(b => b.status)).toEqual([
      'done', 'in_progress', 'in_progress', 'review', 'pending',
    ])
  })

  it('handles transition data', () => {
    const { data } = migrateToPostProdV2({
      scenes: {
        scenes: [
          {
            number: 1,
            label: 'Hook',
            transition: { type: 'crossfade', reasoning: 'Smooth entry' },
          },
        ],
      },
    })

    expect(data.timeline.beats[0]!.transition_in).toEqual({
      type: 'crossfade',
      reasoning: 'Smooth entry',
    })
  })

  it('assigns default label when scene has no label', () => {
    const { data } = migrateToPostProdV2({
      scenes: { scenes: [{ number: 3 }] },
    })

    expect(data.timeline.beats[0]!.label).toBe('Scene 3')
  })

  it('does not create assets entry when scene has no music/sfx', () => {
    const { data } = migrateToPostProdV2({
      scenes: { scenes: [{ number: 1, label: 'Clean' }] },
    })

    expect(data.assets[0]).toBeUndefined()
  })

  it('full migration produces valid structure', () => {
    const { data, warnings } = migrateToPostProdV2({
      scenes: {
        scenes: [
          {
            number: 1,
            label: 'Hook',
            timestamps: '00:00:00-00:00:15',
            duration: '15s',
            status: 'done',
            music: { track_name: 'Rise', bpm: 120, energy: 4 },
            sfx: [{ label: 'whoosh' }],
          },
        ],
      },
      crossref: {
        summary: 'OK',
        rows: [{ beat: 'Hook', status: 'match' }],
      },
      speedramps: {
        ramps: [{ section: 'Hook', speed: '1.0x' }],
        est_final: '10:00',
      },
    })

    expect(data.schema_version).toBe('2.0')
    expect(data.timeline.beats).toHaveLength(1)
    expect(data.assets[0]).toBeDefined()
    expect(data.crossref.beats).toHaveLength(1)
    expect(data.speedramps.sections).toHaveLength(1)
    expect(warnings).toHaveLength(0)
  })
})
