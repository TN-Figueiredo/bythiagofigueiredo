import { describe, it, expect } from 'vitest'
import {
  fmtTime,
  fmtDur,
  pRand,
  badgeTextColor,
  tickInterval,
  calcPxPerSec,
  difficultyColor,
} from '@/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/utils'

describe('fmtTime', () => {
  it('formats zero seconds', () => {
    expect(fmtTime(0)).toBe('00:00')
  })

  it('formats seconds < 60', () => {
    expect(fmtTime(45)).toBe('00:45')
  })

  it('formats minutes and seconds', () => {
    expect(fmtTime(125)).toBe('02:05')
  })

  it('handles fractional seconds by flooring', () => {
    expect(fmtTime(90.7)).toBe('01:30')
  })
})

describe('fmtDur', () => {
  it('formats short durations in seconds', () => {
    expect(fmtDur(30)).toBe('30s')
  })

  it('formats exact minutes', () => {
    expect(fmtDur(120)).toBe('2m')
  })

  it('formats minutes with remaining seconds', () => {
    expect(fmtDur(93)).toBe('1m33s')
  })

  it('pads single-digit seconds', () => {
    expect(fmtDur(62)).toBe('1m02s')
  })
})

describe('pRand', () => {
  it('returns values in [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const val = pRand(i)
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })

  it('is deterministic for same seed', () => {
    expect(pRand(42)).toBe(pRand(42))
  })

  it('produces different values for different seeds', () => {
    expect(pRand(1)).not.toBe(pRand(2))
  })
})

describe('badgeTextColor', () => {
  it('returns dark text for light backgrounds', () => {
    expect(badgeTextColor('#ffffff')).toBe('#111')
    expect(badgeTextColor('#f5f5f5')).toBe('#111')
  })

  it('returns light text for dark backgrounds', () => {
    expect(badgeTextColor('#000000')).toBe('#fff')
    expect(badgeTextColor('#1a1a1a')).toBe('#fff')
  })

  it('handles mid-tone colors', () => {
    const result = badgeTextColor('#808080')
    expect(['#111', '#fff']).toContain(result)
  })
})

describe('tickInterval', () => {
  it('returns 1 for very short durations', () => {
    expect(tickInterval(10)).toBe(1)
  })

  it('returns 2 for 15-30s durations', () => {
    expect(tickInterval(25)).toBe(2)
  })

  it('returns 5 for 30-60s durations', () => {
    expect(tickInterval(45)).toBe(5)
  })

  it('returns 10 for 1-3 minute durations', () => {
    expect(tickInterval(120)).toBe(10)
  })

  it('returns 30 for 3-10 minute durations', () => {
    expect(tickInterval(400)).toBe(30)
  })

  it('returns 60 for long durations', () => {
    expect(tickInterval(700)).toBe(60)
  })
})

describe('calcPxPerSec', () => {
  it('computes pixels per second at 1x zoom', () => {
    expect(calcPxPerSec(600, 60, 1)).toBe(10)
  })

  it('scales linearly with zoom', () => {
    expect(calcPxPerSec(600, 60, 2)).toBe(20)
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

  it('is case-insensitive', () => {
    expect(difficultyColor('easy')).toBe('#27AE60')
    expect(difficultyColor('Hard')).toBe('#E74C3C')
  })

  it('defaults to orange for unknown difficulty', () => {
    expect(difficultyColor('EXTREME')).toBe('#E67E22')
  })
})
