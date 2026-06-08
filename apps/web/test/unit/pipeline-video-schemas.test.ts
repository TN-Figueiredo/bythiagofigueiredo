import { describe, it, expect } from 'vitest'
import {
  VIDEO_READ_WPS,
  videoLineSecs,
  videoBeatRead,
  vidTotals,
  fmtClock,
  IdeiaSectionSchema,
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
