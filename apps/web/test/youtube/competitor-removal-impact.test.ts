// @vitest-environment node
// apps/web/test/youtube/competitor-removal-impact.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseRemovalImpact } from '@/lib/youtube/competitor-removal-impact'

const OK = { status: 'ok', name: 'Canal Um', videos: 50, pinned: 2, versions: 180, daily_days: 12, bookmarks: 3 }
const CH = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

describe('parseRemovalImpact', () => {
  it('lê os cinco números e o nome; trocas salvas diferentes de zero', () => {
    expect(parseRemovalImpact(OK)).toEqual({ name: 'Canal Um', videos: 50, pinned: 2, versions: 180, dailyDays: 12, bookmarks: 3 })
  })
  it('canal sem troca salva: bookmarks é zero de verdade', () => {
    expect(parseRemovalImpact({ ...OK, bookmarks: 0 })!.bookmarks).toBe(0)
  })
  it('canal recém-adicionado, sem nada gravado: zeros de verdade', () => {
    expect(parseRemovalImpact({ status: 'ok', name: null, videos: 0, pinned: 0, versions: 0, daily_days: 0, bookmarks: 0 })).toEqual({ name: null, videos: 0, pinned: 0, versions: 0, dailyDays: 0, bookmarks: 0 })
  })
  it('canal de outro site (not_found) é nulo, nunca zeros', () => {
    expect(parseRemovalImpact({ status: 'not_found' })).toBeNull()
  })
  it.each([
    ['resposta nula', null],
    ['lista', [OK]],
    ['status desconhecido', { ...OK, status: 'x' }],
    ['número ausente', { status: 'ok', name: 'C', videos: 1, pinned: 0, versions: 3 }],
    ['bookmarks ausente (função antiga no banco)', { status: 'ok', name: 'C', videos: 1, pinned: 0, versions: 3, daily_days: 2 }],
    ['número como texto', { ...OK, versions: '180' }],
    ['número negativo', { ...OK, pinned: -1 }],
  ])('%s lança, nunca vira zero', (_n, data) => {
    expect(() => parseRemovalImpact(data)).toThrow('competitor_channel_removal_impact')
  })
})

async function load(o: { allowed?: boolean; rpc?: { data: unknown; error: { message: string } | null } } = {}) {
  vi.resetModules()
  const order: string[] = [], rpcCalls: Array<[string, unknown]> = []
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => { order.push('guard'); return o.allowed === false ? { ok: false, reason: 'forbidden' } : { ok: true, user: { id: 'u1' } } } }))
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { order.push('db'); return { rpc: async (name: string, args: unknown) => { rpcCalls.push([name, args]); return o.rpc ?? { data: OK, error: null } } } } }))
  const { getCompetitorRemovalImpactAction } = await import('@/app/cms/(authed)/youtube/competitors/actions')
  return { act: getCompetitorRemovalImpactAction, order, rpcCalls }
}

describe('getCompetitorRemovalImpactAction', () => {
  it('o guard vem primeiro; sem acesso a função não é chamada', async () => {
    const a = await load({ allowed: false })
    expect(await a.act(CH)).toEqual({ ok: false })
    expect(a.order).toEqual(['guard'])
  })
  it('chama a função com o site do contexto e o canal pedido', async () => {
    const a = await load()
    expect(await a.act(CH)).toEqual({ ok: true, impact: { name: 'Canal Um', videos: 50, pinned: 2, versions: 180, dailyDays: 12, bookmarks: 3 } })
    expect(a.rpcCalls).toEqual([['competitor_channel_removal_impact', { p_site_id: 's1', p_channel_id: CH }]])
    expect(a.order).toEqual(['guard', 'db'])
  })
  it('id que não é uuid é recusado sem tocar no banco', async () => {
    const a = await load()
    expect(await a.act('x')).toEqual({ ok: false })
    expect(a.rpcCalls).toEqual([])
  })
  it('canal de outro site, erro do banco e resposta inesperada: ok false, nunca zeros', async () => {
    for (const rpc of [{ data: { status: 'not_found' }, error: null }, { data: null, error: { message: 'timeout' } }, { data: { status: 'ok' }, error: null }]) {
      expect(await (await load({ rpc })).act(CH)).toEqual({ ok: false })
    }
  })
})
