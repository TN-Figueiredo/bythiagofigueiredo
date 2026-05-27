import { describe, it, expect } from 'vitest'
import {
  computeItemStatus,
  computeMetrics,
  type CalendarItem,
  type CadenceSlot,
} from '@/lib/schedule/schedule-queries'

/* ------------------------------------------------------------------ */
/*  computeItemStatus                                                 */
/* ------------------------------------------------------------------ */

describe('computeItemStatus', () => {
  const today = '2026-05-16'

  it('maps "published" raw status to published', () => {
    expect(computeItemStatus('published', '2026-05-10', today)).toBe('published')
  })

  it('maps "sent" raw status to published', () => {
    expect(computeItemStatus('sent', '2026-05-10', today)).toBe('published')
  })

  it('returns overdue when dateKey is before today and not published', () => {
    expect(computeItemStatus('scheduled', '2026-05-10', today)).toBe('overdue')
  })

  it('returns scheduled when rawStatus is scheduled and not past', () => {
    expect(computeItemStatus('scheduled', '2026-05-20', today)).toBe('scheduled')
  })

  it('returns queued for any other status in the future', () => {
    expect(computeItemStatus('queued', '2026-05-20', today)).toBe('queued')
    expect(computeItemStatus('ready', '2026-05-20', today)).toBe('queued')
  })

  it('returns overdue for queued item with past dateKey', () => {
    expect(computeItemStatus('queued', '2026-05-15', today)).toBe('overdue')
  })

  it('handles same-day as today correctly for scheduled', () => {
    // today is not "before today"
    expect(computeItemStatus('scheduled', '2026-05-16', today)).toBe('scheduled')
  })
})

/* ------------------------------------------------------------------ */
/*  computeMetrics                                                    */
/* ------------------------------------------------------------------ */

describe('computeMetrics', () => {
  const today = '2026-05-16'
  const month = '2026-05'

  const items: CalendarItem[] = [
    { id: '1', type: 'blog', title: 'A', status: 'published', dateKey: '2026-05-10', time: null, editUrl: '/a' },
    { id: '2', type: 'blog', title: 'B', status: 'published', dateKey: '2026-05-12', time: null, editUrl: '/b' },
    { id: '3', type: 'newsletter', title: 'C', status: 'scheduled', dateKey: '2026-05-20', time: '10:00', editUrl: '/c' },
    { id: '4', type: 'video', title: 'D', status: 'queued', dateKey: '2026-05-22', time: null, editUrl: '/d' },
    { id: '5', type: 'blog', title: 'E', status: 'overdue', dateKey: '2026-05-14', time: null, editUrl: '/e' },
    { id: '6', type: 'newsletter', title: 'F', status: 'published', dateKey: '2026-04-30', time: null, editUrl: '/f' }, // outside month
  ]

  const cadenceSlots: CadenceSlot[] = [
    { dateKey: '2026-05-10', type: 'newsletter', contextId: 'nl-1', createUrl: '/new' },
    { dateKey: '2026-05-17', type: 'newsletter', contextId: 'nl-1', createUrl: '/new' },
    { dateKey: '2026-05-24', type: 'newsletter', contextId: 'nl-1', createUrl: '/new' },
  ]

  it('counts published items within the current month', () => {
    const m = computeMetrics(items, cadenceSlots, month, today)
    // Items 1, 2 are published in May; Item 6 is April
    expect(m.publishedThisMonth).toBe(2)
  })

  it('counts scheduled/queued items on or after today', () => {
    const m = computeMetrics(items, cadenceSlots, month, today)
    // Items 3 (scheduled 2026-05-20) and 4 (queued 2026-05-22)
    expect(m.scheduledAhead).toBe(2)
  })

  it('counts overdue items', () => {
    const m = computeMetrics(items, cadenceSlots, month, today)
    expect(m.overdueCount).toBe(1)
  })

  it('calculates cadence health percentage', () => {
    const m = computeMetrics(items, cadenceSlots, month, today)
    // 3 cadence slots in May. Item with type=newsletter on 2026-05-10? No (item 6 is April, item 1 on 05-10 is blog)
    // Actually checking: slots are newsletter type. On 2026-05-10 we have item 1 (blog) not newsletter.
    // So 0 out of 3 filled = 0%
    expect(m.cadenceHealthPct).toBe(0)
  })

  it('returns 100% cadence health when no cadence slots exist', () => {
    const m = computeMetrics(items, [], month, today)
    expect(m.cadenceHealthPct).toBe(100)
  })

  it('correctly counts filled cadence slots', () => {
    const itemsWithNl: CalendarItem[] = [
      ...items,
      { id: '7', type: 'newsletter', title: 'G', status: 'published', dateKey: '2026-05-10', time: null, editUrl: '/g' },
    ]
    const m = computeMetrics(itemsWithNl, cadenceSlots, month, today)
    // 1 out of 3 = 33%
    expect(m.cadenceHealthPct).toBe(33)
  })

  it('includes video cadence slots in health calculation', () => {
    const items: CalendarItem[] = [
      { id: 'v1', type: 'video', title: 'Vid A', status: 'published', dateKey: '2026-01-07', time: null, editUrl: '/v1' },
    ]
    const cadenceSlots: CadenceSlot[] = [
      { dateKey: '2026-01-07', type: 'video', contextId: 'ch-1', createUrl: '/new' },
      { dateKey: '2026-01-14', type: 'video', contextId: 'ch-1', createUrl: '/new' },
    ]
    const result = computeMetrics(items, cadenceSlots, '2026-01', '2026-01-10')
    expect(result.cadenceHealthPct).toBe(50)
  })

  it('includes blog cadence slots in health calculation', () => {
    const items: CalendarItem[] = []
    const cadenceSlots: CadenceSlot[] = [
      { dateKey: '2026-01-05', type: 'blog', contextId: 'cad-1', createUrl: '/new' },
      { dateKey: '2026-01-12', type: 'blog', contextId: 'cad-1', createUrl: '/new' },
    ]
    const result = computeMetrics(items, cadenceSlots, '2026-01', '2026-01-10')
    expect(result.cadenceHealthPct).toBe(0)
  })

  it('mixes newsletter, video, and blog cadence slots in health', () => {
    const items: CalendarItem[] = [
      { id: 'v1', type: 'video', title: 'Vid', status: 'published', dateKey: '2026-01-07', time: null, editUrl: '/v1' },
      { id: 'n1', type: 'newsletter', title: 'NL', status: 'published', dateKey: '2026-01-10', time: null, editUrl: '/n1' },
    ]
    const cadenceSlots: CadenceSlot[] = [
      { dateKey: '2026-01-07', type: 'video', contextId: 'ch-1', createUrl: '/new' },
      { dateKey: '2026-01-10', type: 'newsletter', contextId: 'nl-1', createUrl: '/new' },
      { dateKey: '2026-01-14', type: 'blog', contextId: 'cad-1', createUrl: '/new' },
    ]
    const result = computeMetrics(items, cadenceSlots, '2026-01', '2026-01-10')
    // 2 of 3 slots filled
    expect(result.cadenceHealthPct).toBe(67)
  })
})
