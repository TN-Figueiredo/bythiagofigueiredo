// apps/web/test/unit/timeline-utils.test.ts

import { describe, it, expect } from 'vitest'
import { fmtTime, fmtDur, pRand, badgeTextColor, tickInterval, calcPxPerSec, difficultyColor, parsePostProdContent } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/utils'

describe('fmtTime', () => {
  it('formats 0 as 00:00', () => {
    expect(fmtTime(0)).toBe('00:00')
  })

  it('formats 93 as 01:33', () => {
    expect(fmtTime(93)).toBe('01:33')
  })

  it('formats 600 as 10:00', () => {
    expect(fmtTime(600)).toBe('10:00')
  })
})

describe('fmtDur', () => {
  it('formats seconds under 60', () => {
    expect(fmtDur(24)).toBe('24s')
  })

  it('formats exact minutes', () => {
    expect(fmtDur(120)).toBe('2m')
  })

  it('formats minutes + seconds', () => {
    expect(fmtDur(93)).toBe('1m33s')
  })
})

describe('pRand', () => {
  it('returns deterministic value for same seed', () => {
    expect(pRand(42)).toBe(pRand(42))
  })

  it('returns value in [0,1)', () => {
    for (let i = 0; i < 100; i++) {
      const v = pRand(i)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('badgeTextColor', () => {
  it('returns dark text for light colors', () => {
    expect(badgeTextColor('#F1C40F')).toBe('#111')
  })

  it('returns white text for dark colors', () => {
    expect(badgeTextColor('#8E44AD')).toBe('#fff')
  })
})

describe('tickInterval', () => {
  it('returns 1 for very short durations', () => {
    expect(tickInterval(10)).toBe(1)
  })

  it('returns 5 for ~1min durations', () => {
    expect(tickInterval(45)).toBe(5)
  })

  it('returns 10 for 2-3min durations', () => {
    expect(tickInterval(93)).toBe(10)
  })
})

describe('calcPxPerSec', () => {
  it('calculates base at zoom 1', () => {
    expect(calcPxPerSec(800, 100, 1)).toBe(8)
  })

  it('scales with zoom', () => {
    expect(calcPxPerSec(800, 100, 2)).toBe(16)
  })
})

describe('difficultyColor', () => {
  it('returns green for EASY', () => {
    expect(difficultyColor('EASY')).toBe('#27AE60')
  })

  it('returns red for HARD', () => {
    expect(difficultyColor('HARD')).toBe('#E74C3C')
  })

  it('returns orange for MEDIUM', () => {
    expect(difficultyColor('MEDIUM')).toBe('#E67E22')
  })
})

describe('parsePostProdContent', () => {
  it('parses scenes content into beats and assets', () => {
    const scenes = {
      beats: [{ idx: 0, label: 'Beat 0', name: 'Hook', duration: 24, absStart: 0, status: 'PENDING', difficulty: 'EASY', clips: {} }],
      assets: { 0: { music: [] } },
    }
    const result = parsePostProdContent(scenes, undefined, undefined)
    expect(result.beats).toHaveLength(1)
    expect(result.beats![0]!.name).toBe('Hook')
    expect(result.assets).toBeDefined()
  })

  it('parses crossRef and speedRamps', () => {
    const crossRef = { summary: 'test', beats: [], divergences: [] }
    const speedRamps = { summary: 'test', base: 'x', sections: [] }
    const result = parsePostProdContent(undefined, crossRef, speedRamps)
    expect(result.crossRef).toBeDefined()
    expect(result.speedRamps).toBeDefined()
  })

  it('returns empty object for null inputs', () => {
    const result = parsePostProdContent(null, null, null)
    expect(result).toEqual({})
  })
})
