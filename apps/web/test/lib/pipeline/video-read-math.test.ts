// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  beatReadSecs,
  sectionReadSecs,
  READ_WPM_PT,
  READ_WPM_EN,
  READ_WPS_PT,
  READ_WPS_EN,
} from '@/lib/pipeline/video-read-math'
import { beatSections } from '@/lib/pipeline/video-perform'
import type { RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'

const beat = (script: RoteiroBeatV3['script'] = []): RoteiroBeatV3 => ({
  idx: 0, name: 'B', status: 'PENDING', script,
})

const sixWords = 'um dois tres quatro cinco seis'
// A longer line so the per-language cadence difference survives rounding to whole seconds.
const fortyWords = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ')

describe('per-language reading constants', () => {
  it('exports distinct PT and EN cadences (wpm + derived wps)', () => {
    expect(READ_WPM_PT).toBeGreaterThan(0)
    expect(READ_WPM_EN).toBeGreaterThan(0)
    expect(READ_WPM_PT).not.toBe(READ_WPM_EN)
    expect(READ_WPS_PT).toBeCloseTo(READ_WPM_PT / 60, 5)
    expect(READ_WPS_EN).toBeCloseTo(READ_WPM_EN / 60, 5)
  })
})

describe('beatReadSecs — honest duration', () => {
  it('returns 0 for an empty beat', () => {
    expect(beatReadSecs(beat(), 'pt')).toBe(0)
    expect(beatReadSecs(beat(), 'en')).toBe(0)
  })
  it('PT and EN differ for the same spoken text', () => {
    const b = beat([{ type: 'line', text: fortyWords }])
    expect(beatReadSecs(b, 'pt')).not.toBe(beatReadSecs(b, 'en'))
  })
  it('folds explicit pause.duration into the estimate', () => {
    const noPause = beat([{ type: 'line', text: sixWords }])
    const withPause = beat([{ type: 'line', text: sixWords }, { type: 'pause', duration: 3 }])
    expect(beatReadSecs(withPause, 'pt')).toBe(beatReadSecs(noPause, 'pt') + 3)
  })
  it('ignores dir/vis/ed/action items in the spoken estimate', () => {
    const a = beat([{ type: 'line', text: sixWords }])
    const b = beat([
      { type: 'line', text: sixWords },
      { type: 'dir', text: 'tom' },
      { type: 'vis', text: 'broll' },
      { type: 'ed', text: 'corta' },
      { type: 'action', text: 'aponta' },
    ])
    expect(beatReadSecs(b, 'pt')).toBe(beatReadSecs(a, 'pt'))
  })
})

describe('sectionReadSecs — per derived section', () => {
  it('estimates only the section lines', () => {
    const b = beat([
      { type: 'line', text: sixWords },
      { type: 'dir', text: 'tom' },
      { type: 'line', text: sixWords },
    ])
    const [s0, s1] = beatSections(b, 0)
    expect(sectionReadSecs(b, s0!, 'pt')).toBe(beatReadSecs(beat([{ type: 'line', text: sixWords }]), 'pt'))
    expect(sectionReadSecs(b, s1!, 'pt')).toBe(beatReadSecs(beat([{ type: 'line', text: sixWords }]), 'pt'))
  })
  it('includes a pause that falls between the section lines', () => {
    const b = beat([
      { type: 'line', text: sixWords },
      { type: 'pause', duration: 2 },
      { type: 'line', text: sixWords },
    ])
    const [s0] = beatSections(b, 0)
    const noPause = beat([{ type: 'line', text: sixWords }, { type: 'line', text: sixWords }])
    expect(sectionReadSecs(b, s0!, 'pt')).toBe(beatReadSecs(noPause, 'pt') + 2)
  })
  it('PT and EN differ for the same section', () => {
    const b = beat([{ type: 'line', text: fortyWords }])
    const [s0] = beatSections(b, 0)
    expect(sectionReadSecs(b, s0!, 'pt')).not.toBe(sectionReadSecs(b, s0!, 'en'))
  })
})
