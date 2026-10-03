// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

const KEY = '0f8fad5b-d9cb-469f-a165-70867728950e'

async function load(o: { allowed?: boolean; row?: { id: string; bookmarked: boolean } | null } = {}) {
  vi.resetModules()
  const calls: Array<{ op: string; args: unknown[] }> = []
  const chain = (result: unknown) => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'or', 'order', 'limit']) q[m] = (...args: unknown[]) => { calls.push({ op: m, args }); return q }
    q.maybeSingle = async () => result
    q.update = (...args: unknown[]) => { calls.push({ op: 'update', args }); return q }
    q.then = (res: (x: unknown) => unknown) => Promise.resolve({ error: null }).then(res)
    return q
  }
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => (o.allowed === false ? { ok: false, reason: 'forbidden' } : { ok: true, user: { id: 'u1' } }) }))
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => chain({ data: o.row === undefined ? { id: 'c1', bookmarked: false } : o.row }) }) }))
  const { toggleChangeBookmark } = await import('@/app/cms/(authed)/youtube/competitors/actions')
  return { toggleChangeBookmark, calls }
}

describe('toggleChangeBookmark (swipe file of Mudanças)', () => {
  it('refuses without edit access', async () => {
    const { toggleChangeBookmark, calls } = await load({ allowed: false })
    expect(await toggleChangeBookmark(KEY)).toEqual({ ok: false })
    expect(calls).toEqual([])
  })
  it('refuses a key that is not a uuid (no filter injection)', async () => {
    const { toggleChangeBookmark, calls } = await load()
    expect(await toggleChangeBookmark('x,id.neq.0')).toEqual({ ok: false })
    expect(calls).toEqual([])
  })
  it('finds the row by the version key within the site and flips bookmarked', async () => {
    const { toggleChangeBookmark, calls } = await load()
    expect(await toggleChangeBookmark(KEY)).toEqual({ ok: true, saved: true })
    expect(calls).toContainEqual({ op: 'eq', args: ['site_id', 's1'] })
    expect(calls).toContainEqual({ op: 'or', args: [`to_version_id.eq.${KEY},id.eq.${KEY}`] })
    expect(calls).toContainEqual({ op: 'update', args: [{ bookmarked: true }] })
  })
  it('says no when no change row matches', async () => {
    const { toggleChangeBookmark } = await load({ row: null })
    expect(await toggleChangeBookmark(KEY)).toEqual({ ok: false })
  })
})
