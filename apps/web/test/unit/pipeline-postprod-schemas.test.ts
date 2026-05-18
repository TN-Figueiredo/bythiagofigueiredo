import { describe, it, expect } from 'vitest'
import {
  PostProdSectionSchema,
  TimelineSchema,
  BeatSchema,
  TrackConfigSchema,
  MusicAssetRefSchema,
  SFXAssetRefSchema,
  VisualAssetRefSchema,
  BeatAssetsSchema,
  CrossRefSchema,
  CrossRefBeatSchema,
  SpeedRampsSchema,
  SpeedRampSectionSchema,
} from '@/lib/pipeline/postprod-schemas'

describe('TrackConfigSchema', () => {
  it('accepts valid track config', () => {
    const result = TrackConfigSchema.safeParse({
      id: 'v1',
      label: 'Video 1',
      type: 'video',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.locked).toBe(false)
      expect(result.data.muted).toBe(false)
      expect(result.data.visible).toBe(true)
    }
  })

  it('rejects missing id', () => {
    expect(TrackConfigSchema.safeParse({ label: 'V1', type: 'video' }).success).toBe(false)
  })

  it('rejects invalid type', () => {
    expect(TrackConfigSchema.safeParse({ id: 'v1', label: 'V1', type: 'invalid' }).success).toBe(false)
  })
})

describe('BeatSchema', () => {
  it('accepts valid beat with defaults', () => {
    const result = BeatSchema.safeParse({ index: 0, label: 'Hook' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('pending')
      expect(result.data.edit_notes).toEqual([])
    }
  })

  it('accepts full beat', () => {
    const result = BeatSchema.safeParse({
      index: 3,
      label: 'Development',
      beat_ref: 'beat_3',
      timecode_in: '00:02:30',
      timecode_out: '00:04:15',
      duration_sec: 105,
      status: 'done',
      difficulty: 'hard',
      narrative: 'Main argument section',
      edit_notes: ['Jump cut here', 'Add lower third'],
      transition_in: { type: 'crossfade', reasoning: 'Smooth topic change' },
      transition_out: { type: 'cut' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative index', () => {
    expect(BeatSchema.safeParse({ index: -1, label: 'Hook' }).success).toBe(false)
  })

  it('rejects invalid status', () => {
    expect(BeatSchema.safeParse({ index: 0, label: 'Hook', status: 'unknown' }).success).toBe(false)
  })
})

describe('TimelineSchema', () => {
  it('accepts empty timeline with defaults', () => {
    const result = TimelineSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tracks).toEqual([])
      expect(result.data.beats).toEqual([])
      expect(result.data.total_duration_sec).toBe(0)
      expect(result.data.fps).toBe(30)
    }
  })

  it('accepts timeline with tracks and beats', () => {
    const result = TimelineSchema.safeParse({
      tracks: [{ id: 'v1', label: 'Video', type: 'video' }],
      beats: [{ index: 0, label: 'Intro' }],
      total_duration_sec: 600,
      fps: 60,
    })
    expect(result.success).toBe(true)
  })

  it('rejects fps out of range', () => {
    expect(TimelineSchema.safeParse({ fps: 0 }).success).toBe(false)
    expect(TimelineSchema.safeParse({ fps: 241 }).success).toBe(false)
  })
})

describe('MusicAssetRefSchema', () => {
  it('accepts minimal music ref with default role', () => {
    const result = MusicAssetRefSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.role).toBe('primary')
    }
  })

  it('accepts full music ref', () => {
    const result = MusicAssetRefSchema.safeParse({
      asset_id: 'MUSIC_EPIC_01',
      track_name: 'Rise Above',
      artist: 'Composer X',
      bpm: 120,
      energy: 4,
      entry_style: 'fade_in_4bars',
      role: 'secondary',
      volume_db: -6,
      notes: 'Comes in after hook',
    })
    expect(result.success).toBe(true)
  })
})

describe('SFXAssetRefSchema', () => {
  it('requires label', () => {
    expect(SFXAssetRefSchema.safeParse({}).success).toBe(false)
    expect(SFXAssetRefSchema.safeParse({ label: 'whoosh' }).success).toBe(true)
  })

  it('defaults type to other', () => {
    const result = SFXAssetRefSchema.safeParse({ label: 'click' })
    if (result.success) expect(result.data.type).toBe('other')
  })
})

describe('VisualAssetRefSchema', () => {
  it('requires label', () => {
    expect(VisualAssetRefSchema.safeParse({}).success).toBe(false)
  })

  it('accepts full visual ref', () => {
    const result = VisualAssetRefSchema.safeParse({
      asset_id: 'BROLL_DRONE_01',
      label: 'Drone flyover',
      type: 'broll',
      timecode_in: '00:01:30',
      timecode_out: '00:01:38',
      speed: '1.5x',
      effect: 'color_grade_warm',
      notes: 'Slow reveal',
    })
    expect(result.success).toBe(true)
  })
})

describe('BeatAssetsSchema', () => {
  it('accepts empty beat assets with defaults', () => {
    const result = BeatAssetsSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.music).toEqual([])
      expect(result.data.sfx).toEqual([])
      expect(result.data.visual).toEqual([])
      expect(result.data.ambience).toEqual([])
      expect(result.data.soundDesign).toEqual([])
    }
  })

  it('accepts populated beat assets', () => {
    const result = BeatAssetsSchema.safeParse({
      music: [{ track_name: 'Epic Rise' }],
      sfx: [{ label: 'whoosh', type: 'whoosh' }],
      visual: [{ label: 'drone shot', type: 'broll' }],
      ambience: [{ label: 'office hum' }],
      soundDesign: [{ label: 'bass drop' }],
    })
    expect(result.success).toBe(true)
  })
})

describe('CrossRefSchema', () => {
  it('accepts empty crossref with defaults', () => {
    const result = CrossRefSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.summary).toBe('')
      expect(result.data.beats).toEqual([])
      expect(result.data.divergences).toEqual([])
    }
  })

  it('accepts full crossref', () => {
    const result = CrossRefSchema.safeParse({
      summary: 'Script and edit align well',
      beats: [
        { beat: 'Hook', srt_timestamp: '00:00:00', duration: '15s', status: 'match' },
        { beat: 'CTA', srt_timestamp: '00:08:00', duration: '30s', status: 'diverge' },
      ],
      divergences: ['CTA is 10s longer than planned'],
      source: 'cowork',
    })
    expect(result.success).toBe(true)
  })
})

describe('CrossRefBeatSchema', () => {
  it('requires beat label', () => {
    expect(CrossRefBeatSchema.safeParse({}).success).toBe(false)
    expect(CrossRefBeatSchema.safeParse({ beat: 'Hook' }).success).toBe(true)
  })

  it('defaults status to match', () => {
    const result = CrossRefBeatSchema.safeParse({ beat: 'Hook' })
    if (result.success) expect(result.data.status).toBe('match')
  })
})

describe('SpeedRampsSchema', () => {
  it('accepts empty speedramps with defaults', () => {
    const result = SpeedRampsSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sections).toEqual([])
      expect(result.data.summary).toBe('')
    }
  })

  it('accepts full speedramps', () => {
    const result = SpeedRampsSchema.safeParse({
      summary: 'Dynamic pacing',
      base: '1.15x',
      est_final: '9:30',
      edit_style: 'aggressive',
      sections: [
        { section: 'Hook', speed: '1.0x', rationale: 'Keep original pace' },
        { section: 'Filler', srt_range: '02:30-03:00', timeline: '02:10-02:20', speed: '2.0x', rationale: 'Skip redundant' },
      ],
      source: 'cowork',
    })
    expect(result.success).toBe(true)
  })
})

describe('SpeedRampSectionSchema', () => {
  it('requires section and speed', () => {
    expect(SpeedRampSectionSchema.safeParse({}).success).toBe(false)
    expect(SpeedRampSectionSchema.safeParse({ section: 'Hook' }).success).toBe(false)
    expect(SpeedRampSectionSchema.safeParse({ section: 'Hook', speed: '1.0x' }).success).toBe(true)
  })
})

describe('PostProdSectionSchema', () => {
  it('accepts minimal valid schema', () => {
    const result = PostProdSectionSchema.safeParse({ schema_version: '2.0' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.schema_version).toBe('2.0')
      expect(result.data.timeline.fps).toBe(30)
      expect(result.data.assets).toEqual({})
      expect(result.data.crossref.beats).toEqual([])
      expect(result.data.speedramps.sections).toEqual([])
    }
  })

  it('rejects wrong schema_version', () => {
    expect(PostProdSectionSchema.safeParse({ schema_version: '1.0' }).success).toBe(false)
    expect(PostProdSectionSchema.safeParse({ schema_version: '3.0' }).success).toBe(false)
  })

  it('accepts full postprod section', () => {
    const full = {
      schema_version: '2.0' as const,
      timeline: {
        tracks: [
          { id: 'v1', label: 'Video 1', type: 'video' },
          { id: 'a1', label: 'Audio 1', type: 'audio' },
          { id: 'm1', label: 'Music', type: 'music' },
        ],
        beats: [
          { index: 0, label: 'Hook', timecode_in: '00:00:00', timecode_out: '00:00:15', duration_sec: 15, status: 'done' },
          { index: 1, label: 'Intro', timecode_in: '00:00:15', timecode_out: '00:01:00', duration_sec: 45, status: 'in_progress' },
        ],
        total_duration_sec: 600,
        fps: 30,
      },
      assets: {
        0: {
          music: [{ asset_id: 'MUSIC_01', track_name: 'Epic Rise', role: 'primary' }],
          sfx: [{ label: 'whoosh', type: 'whoosh' }],
          visual: [{ label: 'drone shot', type: 'broll', asset_id: 'BROLL_01' }],
          ambience: [],
          soundDesign: [],
        },
        1: {
          music: [],
          sfx: [],
          visual: [{ label: 'screen capture', type: 'screen_recording' }],
          ambience: [{ label: 'office ambience' }],
          soundDesign: [],
        },
      },
      crossref: {
        summary: 'Aligns with script',
        beats: [{ beat: 'Hook', srt_timestamp: '00:00:00', duration: '15s', status: 'match' }],
        divergences: [],
        source: 'cowork',
      },
      speedramps: {
        summary: 'Standard pacing',
        base: '1.0x',
        est_final: '10:00',
        edit_style: 'moderate',
        sections: [{ section: 'Hook', speed: '1.0x', rationale: 'Keep pace' }],
        source: 'cowork',
      },
    }
    const result = PostProdSectionSchema.safeParse(full)
    expect(result.success).toBe(true)
  })

  it('coerces string beat index keys to numbers', () => {
    const result = PostProdSectionSchema.safeParse({
      schema_version: '2.0',
      assets: {
        '0': { music: [], sfx: [], visual: [{ label: 'clip' }], ambience: [], soundDesign: [] },
      },
    })
    expect(result.success).toBe(true)
  })
})
