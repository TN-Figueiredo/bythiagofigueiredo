// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

const KEY = '0f8fad5b-d9cb-469f-a165-70867728950e'

async function load(o: { allowed?: boolean; rows?: Array<{ id: string; bookmarked: boolean }> } = {}) {
  vi.resetModules()
  const calls: Array<{ op: string; args: unknown[] }> = []
  const rows = o.rows ?? [{ id: 'c1', bookmarked: false }]
  const chain = () => {
    let updating = false
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'or', 'in']) q[m] = (...args: unknown[]) => { calls.push({ op: m, args }); return q }
    q.update = (...args: unknown[]) => { updating = true; calls.push({ op: 'update', args }); return q }
    q.then = (res: (x: unknown) => unknown) => Promise.resolve(updating ? { error: null } : { data: rows, error: null }).then(res)
    return q
  }
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => (o.allowed === false ? { ok: false, reason: 'forbidden' } : { ok: true, user: { id: 'u1' } }) }))
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => chain() }) }))
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
    expect(calls).toContainEqual({ op: 'in', args: ['id', ['c1']] })
  })
  it('updates ALL rows of that version together; any saved one makes the toggle unsave all', async () => {
    const { toggleChangeBookmark, calls } = await load({ rows: [{ id: 'a', bookmarked: false }, { id: 'b', bookmarked: true }] })
    expect(await toggleChangeBookmark(KEY)).toEqual({ ok: true, saved: false })
    expect(calls).toContainEqual({ op: 'update', args: [{ bookmarked: false }] })
    expect(calls).toContainEqual({ op: 'in', args: ['id', ['a', 'b']] })
  })
  it('says no when no change row matches', async () => {
    const { toggleChangeBookmark } = await load({ rows: [] })
    expect(await toggleChangeBookmark(KEY)).toEqual({ ok: false })
  })
})
