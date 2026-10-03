// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createClock, floorHour, ceilHour, DAY } from '@/lib/youtube/observatorio/time'
import { createFmt } from '@/lib/youtube/observatorio/fmt'
import { median, quant } from '@/lib/youtube/observatorio/stats'
import { RULES, bandOf, winOf, tierOf, DEFAULT_AGES } from '@/lib/youtube/observatorio/rules'

const sp = (iso: string) => Date.parse(iso + '-03:00')
const NOW = sp('2026-10-24T15:02:00'), START = sp('2026-10-03T00:00:00'), SNAP0 = sp('2026-10-03T12:00:00')
const c = createClock(NOW, START, SNAP0), f = createFmt(c)

describe('São Paulo clock', () => {
  it('weekday from the real calendar', () => {
    expect(c.weekday(NOW)).toBe('sábado')
    expect(c.weekday(sp('2026-10-20T12:00:00'))).toBe('terça')
    expect(c.weekday(sp('2026-05-31T12:00:00'))).toBe('domingo')
  })
  it('ago: hours below 48 h, rounded days after, "agora" under a minute, never negative', () => {
    expect(c.ago(NOW - 39 * 36e5)).toBe('há 39 h')
    expect(c.ago(NOW - 3 * DAY)).toBe('há 3 dias')
    expect(c.ago(NOW - 30_000)).toBe('agora')
    expect(c.ago(NOW + 60_000)).toBe('no futuro')
  })
  it('windowText across midnight', () => {
    expect(c.windowText(sp('2026-10-21T18:00:00'), sp('2026-10-22T00:00:00'))).toBe('entre 21/10 18h e 22/10 00h')
    expect(c.windowText(sp('2026-10-24T06:00:00'), sp('2026-10-24T12:00:00'))).toBe('entre 24/10 06h e 12h')
  })
  it('windowText with real batch times contains the real window (floorHour/ceilHour)', () => {
    expect(c.windowText(floorHour(sp('2026-10-24T06:20:00')), ceilHour(sp('2026-10-24T12:40:00')))).toBe('entre 24/10 06h e 13h')
    expect(ceilHour(sp('2026-10-24T12:00:00'))).toBe(sp('2026-10-24T12:00:00'))
  })
  it('snap index 21 is 24/10 12:00', () => expect(c.dmhm(c.snapTime(21))).toBe('24/10 12:00'))
  it('snap index rounding at or after/before', () => {
    expect(c.snapIdxAtOrBefore(c.snapTime(21) + 1000)).toBe(21)
    expect(c.snapIdxAtOrAfter(c.snapTime(21) + 1000)).toBe(22)
    expect(c.snapIdxAtOrAfter(c.snapTime(5))).toBe(5)
  })
  it('labels follow dataset.seriesStart, not a hardcoded 03/10 (Review Focus 1)', () => {
    const late = createClock(sp('2026-11-20T10:00:00'), sp('2026-11-02T00:00:00'), sp('2026-11-02T12:00:00'))
    expect(late.dm(late.seriesStart)).toBe('02/11')
  })
  it('dmOrDmy compares the year with today, not a literal', () => {
    expect(c.dmOrDmy(sp('2026-03-05T12:00:00'))).toBe('05/03')
    expect(c.dmOrDmy(sp('2025-03-05T12:00:00'))).toBe('05/03/2025')
    const prev = createClock(sp('2025-01-10T10:00:00'), START, SNAP0)
    expect(prev.dmOrDmy(sp('2024-03-05T12:00:00'))).toBe('05/03/2024')
    expect(prev.dmOrDmy(sp('2025-03-05T12:00:00'))).toBe('05/03')
  })
  it('dur', () => { expect(c.dur(3.2 * DAY, true)).toBe('≈ 3 d'); expect(c.dur(10.5 * 36e5)).toBe('10 h 30 min') })
})
describe('pt-BR numbers', () => {
  it('num/mult/pct/pp with U+2212', () => {
    expect(f.num(207_600)).toBe('207,6 mil'); expect(f.num(1_900_000)).toBe('1,9 mi'); expect(f.num(-1500)).toBe('−1,5 mil')
    expect(f.mult(4)).toBe('4,0×'); expect(f.pct(-0.41)).toBe('−41%'); expect(f.pp(-3.4)).toBe('−3 pp'); expect(f.pp(12.6)).toBe('+13 pp')
  })
  it('subs keeps 3 significant digits', () => { expect(f.subs(3214)).toBe('3,21 mil'); expect(f.subs(128_400)).toBe('128 mil') })
  it('age uses whole days, hours under a day', () => {
    expect(f.age({ ageDays: 30, pub: NOW - 30.9 * DAY })).toBe('há 30 dias')
    expect(f.age({ ageDays: 0, pub: NOW - 11 * 36e5 })).toBe('há 11 h')
    expect(f.age(null)).toBe('—')
  })
  it('labelReason never chains separators', () => {
    expect(f.labelReason('inconclusivo', 'Antes: 1 dia — pouco para comparar.')).toBe('inconclusivo. Antes: 1 dia — pouco para comparar.')
  })
})
describe('stats', () => {
  it('median/quant', () => { expect(median([3, 1, 2, 4])).toBe(2.5); expect(median([])).toBeNull(); expect(quant([1, 2, 3, 4, 5], 0.25)).toBe(2) })
})
describe('rules', () => {
  it('verbatim values', () => {
    expect(RULES.outlierMin).toBe(2); expect(RULES.weakBase).toBe(3); expect(RULES.channelLimit).toBe(75)
    expect(RULES.effect).toEqual({ afterDays: 7, maxBeforeDays: 7, minBeforeDays: 3, minN: 5, pp: 10, simultHours: 48 })
    expect(RULES.tiers).toEqual({ mid: 2, high: 5, top: 10 })
    expect(DEFAULT_AGES).toEqual(['0-30', '31-90'])
  })
  it('bands, windows and tiers', () => {
    expect(bandOf(7).id).toBe('0-7'); expect(bandOf(8).id).toBe('8-30'); expect(bandOf(366).id).toBe('365+')
    expect(winOf(30)!.id).toBe('0-30'); expect(winOf(31)!.id).toBe('31-90')
    expect(tierOf(null)).toBeNull(); expect(tierOf(1.9)).toBeNull(); expect(tierOf(2)).toBe('mid'); expect(tierOf(5)).toBe('high'); expect(tierOf(10)).toBe('top')
  })
})
