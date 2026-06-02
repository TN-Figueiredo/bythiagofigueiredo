import { describe, it, expect, vi, afterEach } from 'vitest'
import { fmtBR, fmtC, brDec, fmtRelative } from '../../../src/lib/youtube/format'

describe('fmtBR', () => {
  it('formats with PT-BR thousands separator and 2 decimals', () => {
    expect(fmtBR(1234.56)).toBe('1.234,56')
  })

  it('pads decimals', () => {
    expect(fmtBR(42)).toBe('42,00')
  })

  it('handles zero', () => {
    expect(fmtBR(0)).toBe('0,00')
  })

  it('handles negative numbers', () => {
    expect(fmtBR(-1500.1)).toBe('-1.500,10')
  })
})

describe('fmtC', () => {
  it('returns plain number below 1000', () => {
    expect(fmtC(42)).toBe('42')
    expect(fmtC(999)).toBe('999')
  })

  it('formats thousands with "mil"', () => {
    expect(fmtC(1500)).toBe('1,5 mil')
    expect(fmtC(2000)).toBe('2 mil')
    expect(fmtC(184000)).toBe('184 mil')
  })

  it('formats millions with "mi"', () => {
    expect(fmtC(2_800_000)).toBe('2,8 mi')
    expect(fmtC(1_000_000)).toBe('1 mi')
    expect(fmtC(10_500_000)).toBe('10,5 mi')
  })

  it('handles negative numbers', () => {
    expect(fmtC(-1500)).toBe('-1,5 mil')
  })
})

describe('brDec', () => {
  it('formats with comma and given decimals', () => {
    expect(brDec(6.234, 1)).toBe('6,2')
  })

  it('pads with zeros', () => {
    expect(brDec(3, 2)).toBe('3,00')
  })

  it('handles zero decimals', () => {
    expect(brDec(7.8, 0)).toBe('8')
  })
})

describe('fmtRelative', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns "agora" for less than a minute', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRelative(new Date(now - 30_000))).toBe('agora')
  })

  it('returns minutes', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRelative(new Date(now - 5 * 60_000))).toBe('há 5min')
  })

  it('returns hours', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRelative(new Date(now - 2 * 3_600_000))).toBe('há 2h')
  })

  it('returns "há 1 dia" for singular', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRelative(new Date(now - 86_400_000))).toBe('há 1 dia')
  })

  it('returns plural days', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRelative(new Date(now - 3 * 86_400_000))).toBe('há 3 dias')
  })

  it('accepts ISO string input', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const iso = new Date(now - 7200_000).toISOString()
    expect(fmtRelative(iso)).toBe('há 2h')
  })
})
