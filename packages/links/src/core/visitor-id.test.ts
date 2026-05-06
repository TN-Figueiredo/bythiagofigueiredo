import { describe, it, expect, vi, afterEach } from 'vitest'
import { computeVisitorId } from './visitor-id.js'

describe('computeVisitorId', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a hex string of 64 characters (sha256)', () => {
    const id = computeVisitorId('192.168.1.1', 'Mozilla/5.0')
    expect(id).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic for the same ip + ua + day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'))
    const a = computeVisitorId('10.0.0.1', 'Chrome/120')
    const b = computeVisitorId('10.0.0.1', 'Chrome/120')
    expect(a).toBe(b)
  })

  it('differs for different IPs', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'))
    const a = computeVisitorId('10.0.0.1', 'Chrome/120')
    const b = computeVisitorId('10.0.0.2', 'Chrome/120')
    expect(a).not.toBe(b)
  })

  it('differs for different user agents', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'))
    const a = computeVisitorId('10.0.0.1', 'Chrome/120')
    const b = computeVisitorId('10.0.0.1', 'Firefox/115')
    expect(a).not.toBe(b)
  })

  it('differs between days for the same ip + ua', () => {
    vi.useFakeTimers()

    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'))
    const day1 = computeVisitorId('10.0.0.1', 'Chrome/120')

    vi.setSystemTime(new Date('2026-05-06T12:00:00Z'))
    const day2 = computeVisitorId('10.0.0.1', 'Chrome/120')

    expect(day1).not.toBe(day2)
  })

  it('uses YYYY-MM-DD format (UTC) in the hash input', () => {
    vi.useFakeTimers()
    // 2026-05-05 23:59 UTC is still May 5
    vi.setSystemTime(new Date('2026-05-05T23:59:59Z'))
    const late = computeVisitorId('10.0.0.1', 'Chrome/120')

    vi.setSystemTime(new Date('2026-05-05T00:00:00Z'))
    const early = computeVisitorId('10.0.0.1', 'Chrome/120')

    expect(late).toBe(early) // same UTC day
  })
})
