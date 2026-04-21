import { describe, it, expect } from 'vitest'
import { generateSlots, type CadenceConfig } from '@/lib/content-queue/slots'

describe('generateSlots', () => {
  const base: CadenceConfig = {
    cadenceDays: 7,
    startDate: '2026-04-01',
    lastSentAt: null,
    paused: false,
  }

  it('generates N future slots from start date', () => {
    const slots = generateSlots(base, { today: '2026-04-10', count: 4 })
    expect(slots).toEqual([
      '2026-04-15',
      '2026-04-22',
      '2026-04-29',
      '2026-05-06',
    ])
  })

  it('uses lastSentAt as anchor when available', () => {
    const config = { ...base, lastSentAt: '2026-04-08T09:00:00Z' }
    const slots = generateSlots(config, { today: '2026-04-10', count: 3 })
    expect(slots).toEqual([
      '2026-04-15',
      '2026-04-22',
      '2026-04-29',
    ])
  })

  it('returns empty array when paused', () => {
    const config = { ...base, paused: true }
    const slots = generateSlots(config, { today: '2026-04-10', count: 4 })
    expect(slots).toEqual([])
  })

  it('skips past slots', () => {
    const slots = generateSlots(base, { today: '2026-04-20', count: 3 })
    expect(slots).toEqual([
      '2026-04-22',
      '2026-04-29',
      '2026-05-06',
    ])
  })

  it('handles custom cadence (9 days)', () => {
    const config = { ...base, cadenceDays: 9 }
    const slots = generateSlots(config, { today: '2026-04-01', count: 3 })
    expect(slots).toEqual([
      '2026-04-10',
      '2026-04-19',
      '2026-04-28',
    ])
  })
})
