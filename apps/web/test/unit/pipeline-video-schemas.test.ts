import { describe, it, expect } from 'vitest'
import {
  VIDEO_READ_WPS,
  videoLineSecs,
  videoBeatRead,
  vidTotals,
  fmtClock,
  IdeiaSectionSchema,
  PosBriefSchema,
  posOverrideKey,
} from '@/lib/pipeline/video-schemas'
import { VideoMetadataSchema } from '@/lib/pipeline/schemas'
import type { RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'

describe('VIDEO_READ_WPS', () => {
  it('is 2.1 (~125 wpm per v3 handoff; distinct from blog beatReadTime 2.5)', () => {
    expect(VIDEO_READ_WPS).toBe(2.1)
  })
})

describe('videoLineSecs', () => {
  it('= max(1, round(words/2.1)), strips ** emphasis', () => {
    // 13 words / 2.1 = 6.19 → round 6
    expect(videoLineSecs('um dois tres quatro cinco seis sete oito nove dez onze doze treze')).toBe(6)
    // emphasis markers stripped, not counted as separators
    expect(videoLineSecs('**zero** receita')).toBe(1) // 2 words / 2.1 = 0.95 → round 1 (floored at 1)
    expect(videoLineSecs('')).toBe(1) // floor at 1
  })
})

describe('videoBeatRead', () => {
  it('= ceil(beatWordCount/2.1 + sum(pause.duration)) over v3 lines', () => {
    const beat: RoteiroBeatV3 = {
      idx: 0, name: 'B', status: 'PENDING',
      script: [
        { type: 'line', text: 'um dois tres quatro cinco seis sete oito nove dez' }, // 10 words
        { type: 'pause', duration: 0.5 },
        { type: 'vis', text: 'ignored b-roll note' },
      ],
    }
    // 10/2.1 = 4.762 + 0.5 = 5.262 → ceil 6
    expect(videoBeatRead(beat)).toBe(6)
  })
})

describe('vidTotals', () => {
  it('sums target dur and read estimate across beats', () => {
    const beats: RoteiroBeatV3[] = [
      { idx: 0, name: 'B1', status: 'PENDING', duration: 24, script: [{ type: 'line', text: 'um dois tres' }] },
      { idx: 1, name: 'B2', status: 'PENDING', duration: 18, script: [{ type: 'pause', duration: 1 }] },
    ]
    const t = vidTotals(beats)
    expect(t.dur).toBe(42)
    expect(t.read).toBe(videoBeatRead(beats[0]!) + videoBeatRead(beats[1]!))
  })
})

describe('fmtClock', () => {
  it('formats seconds as m:ss', () => {
    expect(fmtClock(0)).toBe('0:00')
    expect(fmtClock(128)).toBe('2:08')
    expect(fmtClock(65)).toBe('1:05')
  })
})

describe('IdeiaSectionSchema', () => {
  it('defaults all fields and is strict', () => {
    const parsed = IdeiaSectionSchema.parse({})
    expect(parsed).toEqual({ title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' })
  })
  it('rejects unknown keys', () => {
    expect(IdeiaSectionSchema.safeParse({ title: 'x', bogus: 1 }).success).toBe(false)
  })
})

describe('PosBriefSchema — per-beat overrides', () => {
  it('accepts an overrides map keyed by beat id with partial fields', () => {
    const r = PosBriefSchema.safeParse({
      kind: 'brief',
      overrides: {
        'beat-abc': { line: 'Frase nova', cue: 'Drone na cidade' },
        i2: { broll: ['Close no teclado', 'Tela do editor'] },
      },
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.overrides?.['beat-abc']).toEqual({ line: 'Frase nova', cue: 'Drone na cidade' })
      expect(r.data.overrides?.i2?.broll).toEqual(['Close no teclado', 'Tela do editor'])
    }
  })

  it('overrides is optional — a brief without it still parses (no default injected)', () => {
    const r = PosBriefSchema.safeParse({ kind: 'brief' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.overrides).toBeUndefined()
  })

  it('rejects unknown keys inside an override entry (strict)', () => {
    const r = PosBriefSchema.safeParse({
      kind: 'brief',
      overrides: { i0: { line: 'ok', bogus: 'nope' } },
    })
    expect(r.success).toBe(false)
  })

  it('enforces limits: line ≤280, cue ≤200, broll ≤8 items of ≤200', () => {
    expect(PosBriefSchema.safeParse({ kind: 'brief', overrides: { i0: { line: 'x'.repeat(281) } } }).success).toBe(false)
    expect(PosBriefSchema.safeParse({ kind: 'brief', overrides: { i0: { cue: 'x'.repeat(201) } } }).success).toBe(false)
    expect(PosBriefSchema.safeParse({ kind: 'brief', overrides: { i0: { broll: Array.from({ length: 9 }, () => 'v') } } }).success).toBe(false)
    expect(PosBriefSchema.safeParse({ kind: 'brief', overrides: { i0: { line: 'x'.repeat(280), cue: 'y'.repeat(200), broll: Array.from({ length: 8 }, () => 'v') } } }).success).toBe(true)
  })
})

describe('posOverrideKey', () => {
  it('uses the beat durable id when present', () => {
    const beat: RoteiroBeatV3 = { idx: 0, id: 'b-77', name: 'B', status: 'PENDING', script: [] }
    expect(posOverrideKey(beat, 3)).toBe('b-77')
  })
  it('falls back to the positional i<index> for legacy beats with no id', () => {
    const beat: RoteiroBeatV3 = { idx: 0, name: 'B', status: 'PENDING', script: [] }
    expect(posOverrideKey(beat, 3)).toBe('i3')
  })
})

describe('VideoMetadataSchema extension', () => {
  it('accepts pillar, duration_range, recorded_at', () => {
    const r = VideoMetadataSchema.safeParse({
      pillar: 'viagem', duration_range: '14–17 min', recorded_at: '23 abr 2026',
    })
    expect(r.success).toBe(true)
  })
  it('rejects an invalid pillar', () => {
    expect(VideoMetadataSchema.safeParse({ pillar: 'culinaria' }).success).toBe(false)
  })
})
