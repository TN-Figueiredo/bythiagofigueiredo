import { describe, it, expect } from 'vitest'
import {
  localDatetimeToIso,
  isoToLocalDatetime,
} from '../../src/editor/campaign-meta-form'

describe('localDatetimeToIso', () => {
  it('returns null for empty input', () => {
    expect(localDatetimeToIso('')).toBeNull()
    expect(localDatetimeToIso('   ')).toBeNull()
  })

  it('parses a wall-clock datetime-local string to an ISO UTC string', () => {
    // Round-trip: parse a local wall-clock, get an ISO back. We don't assert
    // a specific offset (depends on test runner TZ) but we assert that the
    // result parses back to the same wall-clock via Date.
    const raw = '2026-05-01T10:30'
    const iso = localDatetimeToIso(raw)
    expect(iso).not.toBeNull()
    const round = new Date(iso!)
    expect(round.getFullYear()).toBe(2026)
    expect(round.getMonth()).toBe(4) // May = index 4
    expect(round.getDate()).toBe(1)
    expect(round.getHours()).toBe(10)
    expect(round.getMinutes()).toBe(30)
  })

  it('returns null for unparseable input', () => {
    expect(localDatetimeToIso('not-a-date')).toBeNull()
  })
})

describe('isoToLocalDatetime', () => {
  it('returns empty for null/invalid', () => {
    expect(isoToLocalDatetime(null)).toBe('')
    expect(isoToLocalDatetime('garbage')).toBe('')
  })

  it('round-trips with localDatetimeToIso', () => {
    const original = '2026-05-01T10:30'
    const iso = localDatetimeToIso(original)
    expect(iso).not.toBeNull()
    const back = isoToLocalDatetime(iso)
    expect(back).toBe(original)
  })
})
