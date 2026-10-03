// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { currentSlotStart, isDue } from '@/lib/youtube/competitor-sync-batch'

const sp = (iso: string) => Date.parse(iso + '-03:00')
describe('6 h slots in São Paulo', () => {
  it('slot start is the last 00/06/12/18 SP', () => {
    expect(currentSlotStart(sp('2026-10-24T15:02:00'))).toBe(sp('2026-10-24T12:00:00'))
    expect(currentSlotStart(sp('2026-10-24T00:00:00'))).toBe(sp('2026-10-24T00:00:00'))
    expect(currentSlotStart(sp('2026-10-24T05:59:59'))).toBe(sp('2026-10-24T00:00:00'))
  })
  it('due when never synced or synced before the slot', () => {
    const now = sp('2026-10-24T15:02:00')
    expect(isDue(null, now)).toBe(true)
    expect(isDue(new Date(sp('2026-10-24T11:59:00')).toISOString(), now)).toBe(true)
    expect(isDue(new Date(sp('2026-10-24T12:01:00')).toISOString(), now)).toBe(false)
  })
})
describe('runCompetitorBatch', () => {
  it('syncs at most batchSize channels, oldest first, and reports what is still due', async () => {
    vi.resetModules()
    const synced: string[] = []
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(async (r: { id: string }) => { synced.push(r.id); return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 3 } }) }))
    const rows = [{ id: 'a', channel_id: 'A', site_id: 's', last_synced_at: null }, { id: 'b', channel_id: 'B', site_id: 's', last_synced_at: '2026-10-24T13:00:00.000Z' }, { id: 'c', channel_id: 'C', site_id: 's', last_synced_at: '2026-10-24T14:00:00.000Z' }]
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 2, budgetMs: 1e9, now: () => sp('2026-10-24T15:02:00') })
    expect(synced).toEqual(['a', 'b'])
    expect(r).toMatchObject({ synced: 2, errors: 0, remainingDue: 1, stoppedForTime: false })
  })
  it('one failing channel does not stop the batch', async () => {
    vi.resetModules()
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(async (r: { id: string }) => { if (r.id === 'a') throw new Error('404'); return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 3 } }) }))
    const rows = [{ id: 'a', channel_id: 'A', site_id: 's', last_synced_at: null }, { id: 'b', channel_id: 'B', site_id: 's', last_synced_at: null }]
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    expect(await runCompetitorBatch({ apiKey: 'k', batchSize: 5, budgetMs: 1e9, now: () => sp('2026-10-24T15:02:00') })).toMatchObject({ synced: 1, errors: 1 })
  })
})
