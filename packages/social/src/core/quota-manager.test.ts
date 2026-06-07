import { describe, it, expect } from 'vitest'
import { checkQuota, recordUsage, type IQuotaStore } from './quota-manager'
import type { YouTubeQuotaUsage } from './types'

function makeStore(unitsUsed: number) {
  const upserts: Array<{ siteId: string; date: string; units: number }> = []
  const store: IQuotaStore = {
    async getUsage(siteId, date): Promise<YouTubeQuotaUsage | null> {
      return {
        date,
        site_id: siteId,
        units_used: unitsUsed,
        operations: [],
        updated_at: '',
      }
    },
    async upsertUsage(siteId, date, units) {
      upserts.push({ siteId, date, units })
    },
  }
  return { store, upserts }
}

describe('checkQuota', () => {
  it('allows an operation when enough quota remains', async () => {
    const { store } = makeStore(0)
    const r = await checkQuota('site-1', 'videos.insert', store) // cost 1600
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(10_000 - 1600)
  })

  it('denies when cost exceeds remaining quota', async () => {
    const { store } = makeStore(9_000) // remaining 1000 < 1600
    const r = await checkQuota('site-1', 'videos.insert', store)
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(1_000)
    expect(r.warning).toContain('Quota exhausted')
  })

  it('emits a warning when usage crosses the 80% threshold', async () => {
    const { store } = makeStore(7_960) // +50 (videos.update) = 8010 >= 8000
    const r = await checkQuota('site-1', 'videos.update', store)
    expect(r.allowed).toBe(true)
    expect(r.warning).toMatch(/quota at \d+%/)
  })

  it('does not warn below the 80% threshold', async () => {
    const { store } = makeStore(0)
    const r = await checkQuota('site-1', 'videos.list', store) // cost 1
    expect(r.warning).toBeUndefined()
  })
})

describe('recordUsage', () => {
  it('upserts the operation cost', async () => {
    const { store, upserts } = makeStore(0)
    await recordUsage('site-1', 'thumbnails.set', store) // cost 50
    expect(upserts).toHaveLength(1)
    expect(upserts[0]?.units).toBe(50)
    expect(upserts[0]?.siteId).toBe('site-1')
  })
})
